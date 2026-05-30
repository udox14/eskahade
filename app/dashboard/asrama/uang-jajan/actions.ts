'use server'

import { query, queryOne, batch, generateId, getDB } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { WIB_TIME_ZONE } from '@/app/dashboard/ehb/_date-utils'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { runUangJajanAutoPotong } from '@/lib/uang-jajan/auto-potong'

const UANG_JAJAN_PATH = '/dashboard/asrama/uang-jajan'
const MONITORING_PATH = '/dashboard/dewan-santri/uang-jajan'

export type DompetType = 'JAJAN' | 'TABUNGAN'
export type TransaksiJenis = 'MASUK' | 'KELUAR'
export type AutoRuleScope = 'ASRAMA' | 'KAMAR' | 'SANTRI'
export type AutoMode = 'MANUAL' | 'AUTO'

type SantriRow = {
  id: string
  asrama: string | null
  nama_lengkap?: string
  foto_url?: string | null
  saldo_jajan: number
  saldo_tabungan: number
}

type TransaksiRow = {
  id: string
  santri_id: string
  jenis: TransaksiJenis
  nominal: number
  dompet: DompetType
  transfer_group_id: string | null
  asrama: string | null
}

type SantriKamarRow = {
  id: string
  nama_lengkap: string
  nis: string
  kamar: string | null
  asrama: string | null
  foto_url: string | null
  saldo_jajan: number
  saldo_tabungan: number
  auto_nominal: number | null
  auto_excluded: number
}

type RiwayatTabunganRow = {
  id: string
  santri_id: string
  jenis: TransaksiJenis
  nominal: number
  dompet: DompetType
  source: string
  keterangan: string | null
  created_by: string | null
  created_at: string
  transfer_group_id: string | null
  run_date: string | null
  admin_nama: string | null
}

export type AutoRuleRow = {
  id: string
  scope_type: AutoRuleScope
  asrama: string | null
  kamar: string | null
  santri_id: string | null
  santri_nama: string | null
  nominal: number
  jam: string
  days: string
  is_active: number
}

export type AutoSettingRow = {
  asrama: string
  mode: AutoMode
  jam: string
  days: string
  is_active: number
}

type ActionResult = { success: true } | { error: string }
const DEFAULT_AUTO_SETTING = { mode: 'MANUAL' as AutoMode, jam: '06:00', days: '[1,2,3,4,5,6]', is_active: 1 }

async function getUserRestriction() {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

function getStartOfCurrentMonthWibIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)

  return new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0)).toISOString()
}

function getTodayWib() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function normalizePositiveNominal(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
}

function saldoColumn(dompet: DompetType) {
  return dompet === 'JAJAN' ? 'saldo_uang_jajan' : 'saldo_tabungan'
}

function labelDompet(dompet: DompetType) {
  return dompet === 'JAJAN' ? 'Uang Jajan' : 'Tabungan'
}

async function getAllowedSantriRows(ids: string[]) {
  if (!ids.length) return new Map<string, SantriRow>()

  const restrictedAsrama = await getUserRestriction()
  const placeholders = ids.map(() => '?').join(',')
  const params: unknown[] = [...ids]

  let restrictionSql = ''
  if (restrictedAsrama) {
    restrictionSql = ' AND asrama = ?'
    params.push(restrictedAsrama)
  }

  const rows = await query<SantriRow>(
    `SELECT id, asrama, nama_lengkap, foto_url,
            COALESCE(saldo_uang_jajan, 0) AS saldo_jajan,
            COALESCE(saldo_tabungan, 0) AS saldo_tabungan
     FROM santri
     WHERE id IN (${placeholders})${restrictionSql}`,
    params
  )

  return new Map(rows.map(row => [row.id, row]))
}

async function getAllowedTransaksiRows(id: string) {
  const restrictedAsrama = await getUserRestriction()
  const trx = await queryOne<TransaksiRow>(
    `SELECT tl.id, tl.santri_id, tl.jenis, tl.nominal,
            COALESCE(tl.dompet, 'JAJAN') AS dompet,
            tl.transfer_group_id,
            s.asrama
     FROM tabungan_log tl
     INNER JOIN santri s ON s.id = tl.santri_id
     WHERE tl.id = ?${restrictedAsrama ? ' AND s.asrama = ?' : ''}`,
    restrictedAsrama ? [id, restrictedAsrama] : [id]
  )

  if (!trx) return []
  if (!trx.transfer_group_id) return [trx]

  return query<TransaksiRow>(
    `SELECT tl.id, tl.santri_id, tl.jenis, tl.nominal,
            COALESCE(tl.dompet, 'JAJAN') AS dompet,
            tl.transfer_group_id,
            s.asrama
     FROM tabungan_log tl
     INNER JOIN santri s ON s.id = tl.santri_id
     WHERE tl.transfer_group_id = ?${restrictedAsrama ? ' AND s.asrama = ?' : ''}`,
    restrictedAsrama ? [trx.transfer_group_id, restrictedAsrama] : [trx.transfer_group_id]
  )
}

export async function getKamarsTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  if (isAsramaTanpaKamar(targetAsrama)) return { kamars: [], asrama: targetAsrama }
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri
     WHERE asrama = ? AND status_global = 'aktif'
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [targetAsrama]
  )
  return { kamars: rows.map(r => r.kamar), asrama: targetAsrama }
}

export async function getStatsTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  if (isAsramaTanpaKamar(targetAsrama)) {
    return { uang_jajan_fisik: 0, tabungan_fisik: 0, total_titipan: 0, masuk_bulan_ini: 0, keluar_bulan_ini: 0, auto_bulan_ini: 0 }
  }
  const startMonth = getStartOfCurrentMonthWibIso()

  const row = await queryOne<{
    uang_jajan_fisik: number
    tabungan_fisik: number
    masuk: number
    keluar: number
    auto: number
  }>(
    `SELECT
       (SELECT COALESCE(SUM(saldo_uang_jajan), 0)
        FROM santri
        WHERE asrama = ? AND status_global = 'aktif') AS uang_jajan_fisik,
       (SELECT COALESCE(SUM(saldo_tabungan), 0)
        FROM santri
        WHERE asrama = ? AND status_global = 'aktif') AS tabungan_fisik,
       COALESCE(SUM(CASE WHEN jenis = 'MASUK' AND COALESCE(dompet, 'JAJAN') = 'JAJAN' THEN nominal ELSE 0 END), 0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis = 'KELUAR' AND COALESCE(dompet, 'JAJAN') = 'JAJAN' THEN nominal ELSE 0 END), 0) AS keluar,
       COALESCE(SUM(CASE WHEN source = 'AUTO_POTONG' THEN nominal ELSE 0 END), 0) AS auto
     FROM tabungan_log
     WHERE created_at >= ?
       AND santri_id IN (
         SELECT id FROM santri WHERE asrama = ? AND status_global = 'aktif'
       )`,
    [targetAsrama, targetAsrama, startMonth, targetAsrama]
  )

  const uangJajan = row?.uang_jajan_fisik ?? 0
  const tabungan = row?.tabungan_fisik ?? 0
  return {
    uang_jajan_fisik: uangJajan,
    tabungan_fisik: tabungan,
    total_titipan: uangJajan + tabungan,
    masuk_bulan_ini: row?.masuk ?? 0,
    keluar_bulan_ini: row?.keluar ?? 0,
    auto_bulan_ini: row?.auto ?? 0,
  }
}

export async function getSantriKamarTabungan(asramaRequest: string, kamar: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  if (isAsramaTanpaKamar(targetAsrama)) return []
  return query<SantriKamarRow>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama, s.foto_url,
            COALESCE(s.saldo_uang_jajan, 0) AS saldo_jajan,
            COALESCE(s.saldo_tabungan, 0) AS saldo_tabungan,
            (
              SELECT r.nominal
              FROM uang_jajan_auto_rule r
              WHERE r.scope_type = 'SANTRI'
                AND r.santri_id = s.id
                AND r.is_active = 1
              ORDER BY r.updated_at DESC, r.created_at DESC
              LIMIT 1
            ) AS auto_nominal,
            CASE WHEN EXISTS (
              SELECT 1
              FROM uang_jajan_auto_skip sk
              WHERE sk.santri_id = s.id
                AND sk.skip_date = 'PERMANENT'
                AND COALESCE(sk.is_active, 1) = 1
            ) THEN 1 ELSE 0 END AS auto_excluded
     FROM santri s
     WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
     ORDER BY s.nama_lengkap`,
    [targetAsrama, kamar]
  )
}

export async function searchSantriTabungan(asramaRequest: string, search: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  const q = search.trim()
  if (!q) return []
  return query<SantriKamarRow>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama, s.foto_url,
            COALESCE(s.saldo_uang_jajan, 0) AS saldo_jajan,
            COALESCE(s.saldo_tabungan, 0) AS saldo_tabungan,
            (
              SELECT r.nominal
              FROM uang_jajan_auto_rule r
              WHERE r.scope_type = 'SANTRI'
                AND r.santri_id = s.id
                AND r.is_active = 1
              ORDER BY r.updated_at DESC, r.created_at DESC
              LIMIT 1
            ) AS auto_nominal,
            CASE WHEN EXISTS (
              SELECT 1
              FROM uang_jajan_auto_skip sk
              WHERE sk.santri_id = s.id
                AND sk.skip_date = 'PERMANENT'
                AND COALESCE(sk.is_active, 1) = 1
            ) THEN 1 ELSE 0 END AS auto_excluded
     FROM santri s
     WHERE s.asrama = ? AND s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
     ORDER BY s.nama_lengkap
     LIMIT 40`,
    [targetAsrama, `%${q}%`, `%${q}%`]
  )
}

export async function simpanTransaksiDompet(
  santriId: string,
  dompet: DompetType,
  jenis: TransaksiJenis,
  nominal: number,
  keterangan: string
): Promise<ActionResult> {
  const nominalValid = normalizePositiveNominal(nominal)
  if (!nominalValid) return { error: 'Nominal tidak valid' }

  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const santriMap = await getAllowedSantriRows([santriId])
  const santri = santriMap.get(santriId)
  if (!santri) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  const saldoSaatIni = dompet === 'JAJAN' ? santri.saldo_jajan : santri.saldo_tabungan
  if (jenis === 'KELUAR' && saldoSaatIni < nominalValid) {
    return { error: `Saldo ${labelDompet(dompet)} tidak cukup.` }
  }

  const column = saldoColumn(dompet)
  const delta = jenis === 'MASUK' ? nominalValid : -nominalValid
  const now = new Date().toISOString()
  const desc = keterangan || (jenis === 'MASUK' ? `Setor ${labelDompet(dompet)}` : `Tarik ${labelDompet(dompet)}`)

  await batch([
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at, dompet, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL')`,
      params: [generateId(), santriId, jenis, nominalValid, desc, session.id, now, dompet],
    },
    {
      sql: `UPDATE santri SET ${column} = COALESCE(${column}, 0) + ? WHERE id = ?`,
      params: [delta, santriId],
    },
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'payment',
    fiturHref: UANG_JAJAN_PATH,
    logKind: 'create',
    entityType: 'santri',
    entityId: santriId,
    entityLabel: santri.nama_lengkap || santriId,
    summary: `${jenis === 'MASUK' ? 'Setor' : 'Tarik'} ${labelDompet(dompet)} ${santri.nama_lengkap || santriId}`,
    details: { nominal: nominalValid, keterangan: desc, jenis, dompet, asrama: santri.asrama ?? null },
  })

  revalidatePath(UANG_JAJAN_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function transferSaldo(
  santriId: string,
  arah: 'JAJAN_TO_TABUNGAN' | 'TABUNGAN_TO_JAJAN',
  nominal: number,
  keterangan: string
): Promise<ActionResult> {
  const nominalValid = normalizePositiveNominal(nominal)
  if (!nominalValid) return { error: 'Nominal tidak valid' }

  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const santriMap = await getAllowedSantriRows([santriId])
  const santri = santriMap.get(santriId)
  if (!santri) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  const from: DompetType = arah === 'JAJAN_TO_TABUNGAN' ? 'JAJAN' : 'TABUNGAN'
  const to: DompetType = arah === 'JAJAN_TO_TABUNGAN' ? 'TABUNGAN' : 'JAJAN'
  const sourceSaldo = from === 'JAJAN' ? santri.saldo_jajan : santri.saldo_tabungan
  if (sourceSaldo < nominalValid) return { error: `Saldo ${labelDompet(from)} tidak cukup.` }

  const groupId = generateId()
  const now = new Date().toISOString()
  const desc = keterangan || `Transfer ${labelDompet(from)} ke ${labelDompet(to)}`

  await batch([
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at, dompet, source, transfer_group_id)
            VALUES (?, ?, 'KELUAR', ?, ?, ?, ?, ?, 'TRANSFER', ?)`,
      params: [generateId(), santriId, nominalValid, desc, session.id, now, from, groupId],
    },
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at, dompet, source, transfer_group_id)
            VALUES (?, ?, 'MASUK', ?, ?, ?, ?, ?, 'TRANSFER', ?)`,
      params: [generateId(), santriId, nominalValid, desc, session.id, now, to, groupId],
    },
    { sql: `UPDATE santri SET ${saldoColumn(from)} = COALESCE(${saldoColumn(from)}, 0) - ? WHERE id = ?`, params: [nominalValid, santriId] },
    { sql: `UPDATE santri SET ${saldoColumn(to)} = COALESCE(${saldoColumn(to)}, 0) + ? WHERE id = ?`, params: [nominalValid, santriId] },
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'payment',
    fiturHref: UANG_JAJAN_PATH,
    logKind: 'create',
    entityType: 'santri',
    entityId: santriId,
    entityLabel: santri.nama_lengkap || santriId,
    summary: `Transfer ${labelDompet(from)} ke ${labelDompet(to)} ${santri.nama_lengkap || santriId}`,
    details: { nominal: nominalValid, dari: from, ke: to, asrama: santri.asrama ?? null },
  })

  revalidatePath(UANG_JAJAN_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function simpanTopup(santriId: string, nominal: number, keterangan: string): Promise<ActionResult> {
  return simpanTransaksiDompet(santriId, 'JAJAN', 'MASUK', nominal, keterangan || 'Topup Uang Jajan')
}

export async function simpanJajanMassal(
  listTransaksi: { santriId: string; nominal: number }[]
): Promise<{ success: boolean; count: number } | { error: string }> {
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const aggregateMap = new Map<string, number>()
  for (const item of listTransaksi) {
    const nominalValid = normalizePositiveNominal(item.nominal)
    if (!item.santriId || !nominalValid) return { error: 'Ada nominal jajan yang tidak valid.' }
    aggregateMap.set(item.santriId, (aggregateMap.get(item.santriId) ?? 0) + nominalValid)
  }

  const aggregatedList = Array.from(aggregateMap.entries()).map(([santriId, nominal]) => ({ santriId, nominal }))
  const santriMap = await getAllowedSantriRows(aggregatedList.map(item => item.santriId))
  if (santriMap.size !== aggregatedList.length) return { error: 'Sebagian santri tidak ditemukan atau tidak boleh diakses.' }

  for (const item of aggregatedList) {
    const saldo = santriMap.get(item.santriId)?.saldo_jajan ?? 0
    if (saldo < item.nominal) return { error: 'Saldo uang jajan tidak cukup untuk sebagian santri.' }
  }

  const now = new Date().toISOString()
  await batch([
    ...aggregatedList.map(item => ({
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at, dompet, source)
            VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?, 'JAJAN', 'JAJAN_HARIAN')`,
      params: [generateId(), item.santriId, item.nominal, session.id, now],
    })),
    ...aggregatedList.map(item => ({
      sql: `UPDATE santri SET saldo_uang_jajan = COALESCE(saldo_uang_jajan, 0) - ? WHERE id = ?`,
      params: [item.nominal, item.santriId],
    })),
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'payment',
    fiturHref: UANG_JAJAN_PATH,
    logKind: 'create',
    entityType: 'tabungan_batch',
    entityId: 'batch',
    entityLabel: 'Jajan harian massal',
    summary: `Mencatat jajan harian massal untuk ${aggregatedList.length} santri`,
    details: { count: aggregatedList.length, total_nominal: aggregatedList.reduce((sum, item) => sum + item.nominal, 0), dompet: 'JAJAN' },
  })

  revalidatePath(UANG_JAJAN_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true, count: aggregatedList.length }
}

export async function getRiwayatTabunganSantri(santriId: string) {
  const santriMap = await getAllowedSantriRows([santriId])
  if (!santriMap.has(santriId)) return []

  return query<RiwayatTabunganRow>(
    `SELECT tl.id, tl.santri_id, tl.jenis, tl.nominal,
            COALESCE(tl.dompet, 'JAJAN') AS dompet,
            COALESCE(tl.source, 'MANUAL') AS source,
            tl.keterangan, tl.created_by, tl.created_at, tl.transfer_group_id, tl.run_date,
            u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id = tl.created_by
     WHERE tl.santri_id = ?
     ORDER BY tl.created_at DESC
     LIMIT 30`,
    [santriId]
  )
}

export async function hapusTransaksi(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const rows = await getAllowedTransaksiRows(id)
  if (!rows.length) return { error: 'Transaksi tidak ditemukan atau tidak boleh diakses.' }

  const santriMap = await getAllowedSantriRows([rows[0].santri_id])
  const santri = santriMap.get(rows[0].santri_id)
  if (!santri) return { error: 'Santri transaksi tidak ditemukan atau tidak boleh diakses.' }

  let saldoJajan = santri.saldo_jajan
  let saldoTabungan = santri.saldo_tabungan
  for (const trx of rows) {
    if (trx.jenis === 'MASUK') {
      const saldo = trx.dompet === 'JAJAN' ? saldoJajan : saldoTabungan
      if (saldo < trx.nominal) return { error: `Saldo ${labelDompet(trx.dompet)} lebih kecil dari transaksi masuk yang akan dibatalkan.` }
      if (trx.dompet === 'JAJAN') saldoJajan -= trx.nominal
      else saldoTabungan -= trx.nominal
    } else {
      if (trx.dompet === 'JAJAN') saldoJajan += trx.nominal
      else saldoTabungan += trx.nominal
    }
  }

  await batch([
    ...rows.map(trx => ({ sql: 'DELETE FROM tabungan_log WHERE id = ?', params: [trx.id] })),
    { sql: 'UPDATE santri SET saldo_uang_jajan = ?, saldo_tabungan = ? WHERE id = ?', params: [saldoJajan, saldoTabungan, rows[0].santri_id] },
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'delete',
    fiturHref: UANG_JAJAN_PATH,
    logKind: 'delete',
    entityType: 'santri',
    entityId: rows[0].santri_id,
    entityLabel: santri.nama_lengkap || rows[0].santri_id,
    summary: `Menghapus transaksi uang jajan ${santri.nama_lengkap || rows[0].santri_id}`,
    details: { transaksi_id: id, count: rows.length },
  })

  revalidatePath(UANG_JAJAN_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function getAutoRules(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  return query<AutoRuleRow>(
    `SELECT r.id, r.scope_type, r.asrama, r.kamar, r.santri_id, s.nama_lengkap AS santri_nama,
            r.nominal, r.jam, r.days, r.is_active
     FROM uang_jajan_auto_rule r
     LEFT JOIN santri s ON s.id = r.santri_id
     WHERE r.asrama = ? OR (r.scope_type = 'SANTRI' AND s.asrama = ?)
     ORDER BY CASE r.scope_type WHEN 'ASRAMA' THEN 1 WHEN 'KAMAR' THEN 2 ELSE 3 END, r.kamar, s.nama_lengkap`,
    [targetAsrama, targetAsrama]
  )
}

export async function getAutoSetting(asramaRequest: string): Promise<AutoSettingRow> {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  const row = await queryOne<AutoSettingRow>(
    `SELECT asrama, mode, jam, days, is_active
     FROM uang_jajan_auto_setting
     WHERE asrama = ?`,
    [targetAsrama]
  )
  return row ?? { asrama: targetAsrama, ...DEFAULT_AUTO_SETTING }
}

export async function saveAutoSetting(input: {
  asrama: string
  mode: AutoMode
  jam: string
  days: number[]
  is_active: boolean
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || input.asrama
  if (input.mode !== 'MANUAL' && input.mode !== 'AUTO') return { error: 'Mode auto tidak valid.' }
  if (!/^\d{2}:\d{2}$/.test(input.jam)) return { error: 'Jam auto tidak valid.' }
  const days = input.days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  if (!days.length) return { error: 'Pilih minimal satu hari.' }

  const now = new Date().toISOString()
  await batch([
    {
      sql: `INSERT INTO uang_jajan_auto_setting
            (asrama, mode, jam, days, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asrama) DO UPDATE SET
              mode = excluded.mode,
              jam = excluded.jam,
              days = excluded.days,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at`,
      params: [targetAsrama, input.mode, input.jam, JSON.stringify([...new Set(days)].sort()), input.is_active ? 1 : 0, session.id, now, now],
    },
  ])

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function saveSantriAutoNominal(santriId: string, nominal: number, asramaRequest: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const nominalValid = normalizePositiveNominal(nominal)
  if (!nominalValid) return { error: 'Nominal auto tidak valid.' }

  const santriMap = await getAllowedSantriRows([santriId])
  const santri = santriMap.get(santriId)
  if (!santri) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || santri.asrama || asramaRequest
  const setting = await getAutoSetting(targetAsrama)
  const existing = await query<{ id: string }>(
    `SELECT id
     FROM uang_jajan_auto_rule
     WHERE scope_type = 'SANTRI' AND santri_id = ?
     ORDER BY updated_at DESC, created_at DESC`,
    [santriId]
  )
  const id = existing[0]?.id ?? generateId()
  const now = new Date().toISOString()

  await batch([
    {
      sql: `INSERT INTO uang_jajan_auto_rule
            (id, scope_type, asrama, kamar, santri_id, nominal, jam, days, is_active, created_by, created_at, updated_at)
            VALUES (?, 'SANTRI', ?, NULL, ?, ?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              asrama = excluded.asrama,
              kamar = NULL,
              santri_id = excluded.santri_id,
              nominal = excluded.nominal,
              jam = excluded.jam,
              days = excluded.days,
              is_active = 1,
              updated_at = excluded.updated_at`,
      params: [id, targetAsrama, santriId, nominalValid, setting.jam, setting.days, session.id, now, now],
    },
    ...existing.slice(1).map(row => ({
      sql: `UPDATE uang_jajan_auto_rule SET is_active = 0, updated_at = ? WHERE id = ?`,
      params: [now, row.id],
    })),
  ])

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function saveAutoRule(input: {
  id?: string
  scope_type: AutoRuleScope
  asrama: string
  kamar?: string | null
  santri_id?: string | null
  nominal: number
  jam: string
  days: number[]
  is_active: boolean
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || input.asrama
  const nominal = normalizePositiveNominal(input.nominal)
  if (!nominal) return { error: 'Nominal rule tidak valid.' }
  if (!/^\d{2}:\d{2}$/.test(input.jam)) return { error: 'Jam rule tidak valid.' }
  const days = input.days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  if (!days.length) return { error: 'Pilih minimal satu hari.' }
  if (input.scope_type === 'KAMAR' && !input.kamar) return { error: 'Kamar wajib dipilih untuk rule kamar.' }
  if (input.scope_type === 'SANTRI' && !input.santri_id) return { error: 'Santri wajib dipilih untuk override.' }

  if (input.scope_type === 'SANTRI' && input.santri_id) {
    const santriMap = await getAllowedSantriRows([input.santri_id])
    if (!santriMap.has(input.santri_id)) return { error: 'Santri override tidak ditemukan atau tidak boleh diakses.' }
  }

  const id = input.id || generateId()
  const now = new Date().toISOString()
  const params = [
    id,
    input.scope_type,
    targetAsrama,
    input.scope_type === 'KAMAR' ? input.kamar ?? null : null,
    input.scope_type === 'SANTRI' ? input.santri_id ?? null : null,
    nominal,
    input.jam,
    JSON.stringify([...new Set(days)].sort()),
    input.is_active ? 1 : 0,
    session.id,
    now,
    now,
  ]

  await batch([
    {
      sql: `INSERT INTO uang_jajan_auto_rule
            (id, scope_type, asrama, kamar, santri_id, nominal, jam, days, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              scope_type = excluded.scope_type,
              asrama = excluded.asrama,
              kamar = excluded.kamar,
              santri_id = excluded.santri_id,
              nominal = excluded.nominal,
              jam = excluded.jam,
              days = excluded.days,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at`,
      params,
    },
  ])

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function setSantriAutoExcluded(santriId: string, excluded: boolean, reason: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const santriMap = await getAllowedSantriRows([santriId])
  if (!santriMap.has(santriId)) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM uang_jajan_auto_skip WHERE santri_id = ? AND skip_date = 'PERMANENT'`,
    [santriId]
  )
  const now = new Date().toISOString()
  await batch([
    {
      sql: `INSERT INTO uang_jajan_auto_skip
            (id, santri_id, skip_date, reason, created_by, created_at, is_active, updated_at)
            VALUES (?, ?, 'PERMANENT', ?, ?, ?, ?, ?)
            ON CONFLICT(santri_id, skip_date) DO UPDATE SET
              reason = excluded.reason,
              created_by = excluded.created_by,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at`,
      params: [existing?.id ?? generateId(), santriId, reason || (excluded ? 'Skip auto permanen' : 'Aktifkan auto'), session.id, now, excluded ? 1 : 0, now],
    },
  ])
  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function deleteAutoRule(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const restrictedAsrama = await getUserRestriction()
  const params: unknown[] = [id]
  let restriction = ''
  if (restrictedAsrama) {
    restriction = ' AND asrama = ?'
    params.push(restrictedAsrama)
  }
  await batch([{ sql: `DELETE FROM uang_jajan_auto_rule WHERE id = ?${restriction}`, params }])
  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function skipAutoPotongToday(santriId: string, reason: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const santriMap = await getAllowedSantriRows([santriId])
  if (!santriMap.has(santriId)) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  await batch([
    {
      sql: `INSERT OR REPLACE INTO uang_jajan_auto_skip (id, santri_id, skip_date, reason, created_by, created_at)
            VALUES (COALESCE((SELECT id FROM uang_jajan_auto_skip WHERE santri_id = ? AND skip_date = ?), ?), ?, ?, ?, ?, ?)`,
      params: [santriId, getTodayWib(), generateId(), santriId, getTodayWib(), reason || 'Skip auto potong hari ini', session.id, new Date().toISOString()],
    },
  ])
  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function runAutoPotongNow() {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!hasRole(session, 'admin')) return { error: 'Hanya admin yang dapat menjalankan auto-potong manual.' }
  const db = await getDB()
  const result = await runUangJajanAutoPotong(db)
  revalidatePath(UANG_JAJAN_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true, result }
}

export async function getClientRestriction() {
  return getUserRestriction()
}
