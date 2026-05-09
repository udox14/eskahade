'use server'

import { query, queryOne, batch, generateId } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { WIB_TIME_ZONE } from '@/app/dashboard/ehb/_date-utils'
import { isAsramaTanpaKamar } from '@/lib/asrama'

const UANG_JAJAN_PATH = '/dashboard/asrama/uang-jajan'

type SantriRow = {
  id: string
  asrama: string | null
  nama_lengkap?: string
  saldo: number
}

type TransaksiRow = {
  santri_id: string
  jenis: string
  nominal: number
  asrama: string | null
}

type SantriKamarRow = {
  id: string
  nama_lengkap: string
  nis: string
  kamar: string | null
  asrama: string | null
  saldo: number
}

type RiwayatTabunganRow = {
  id: string
  santri_id: string
  jenis: string
  nominal: number
  keterangan: string | null
  created_by: string | null
  created_at: string
  admin_nama: string | null
}

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

function normalizePositiveNominal(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
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
    `SELECT id, asrama, nama_lengkap, COALESCE(saldo_tabungan, 0) AS saldo
     FROM santri
     WHERE id IN (${placeholders})${restrictionSql}`,
    params
  )

  return new Map(rows.map(row => [row.id, row]))
}

async function getAllowedTransaksiRow(id: string) {
  const restrictedAsrama = await getUserRestriction()
  const params: unknown[] = [id]

  let restrictionSql = ''
  if (restrictedAsrama) {
    restrictionSql = ' AND s.asrama = ?'
    params.push(restrictedAsrama)
  }

  return queryOne<TransaksiRow>(
    `SELECT tl.santri_id, tl.jenis, tl.nominal, s.asrama
     FROM tabungan_log tl
     INNER JOIN santri s ON s.id = tl.santri_id
     WHERE tl.id = ?${restrictionSql}`,
    params
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
    return {
      uang_fisik: 0,
      masuk_bulan_ini: 0,
      keluar_bulan_ini: 0,
    }
  }
  const startMonth = getStartOfCurrentMonthWibIso()

  const row = await queryOne<{ uang_fisik: number; masuk: number; keluar: number }>(
    `SELECT
       (SELECT COALESCE(SUM(saldo_tabungan), 0)
        FROM santri
        WHERE asrama = ? AND status_global = 'aktif') AS uang_fisik,
       COALESCE(SUM(CASE WHEN jenis = 'MASUK' THEN nominal ELSE 0 END), 0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis = 'KELUAR' THEN nominal ELSE 0 END), 0) AS keluar
     FROM tabungan_log
     WHERE created_at >= ?
       AND santri_id IN (
         SELECT id FROM santri WHERE asrama = ? AND status_global = 'aktif'
       )`,
    [targetAsrama, startMonth, targetAsrama]
  )

  return {
    uang_fisik: row?.uang_fisik ?? 0,
    masuk_bulan_ini: row?.masuk ?? 0,
    keluar_bulan_ini: row?.keluar ?? 0,
  }
}

export async function getSantriKamarTabungan(asramaRequest: string, kamar: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  if (isAsramaTanpaKamar(targetAsrama)) return []
  return query<SantriKamarRow>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama,
            COALESCE(s.saldo_tabungan, 0) AS saldo
     FROM santri s
     WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
     ORDER BY s.nama_lengkap`,
    [targetAsrama, kamar]
  )
}

export async function simpanTopup(
  santriId: string,
  nominal: number,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const nominalValid = normalizePositiveNominal(nominal)
  if (!nominalValid) return { error: 'Nominal tidak valid' }

  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const santriMap = await getAllowedSantriRows([santriId])
  if (!santriMap.has(santriId)) return { error: 'Santri tidak ditemukan atau tidak boleh diakses.' }

  const now = new Date().toISOString()
  await batch([
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'MASUK', ?, ?, ?, ?)`,
      params: [generateId(), santriId, nominalValid, keterangan || 'Topup Saldo', session.id, now],
    },
    {
      sql: `UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) + ? WHERE id = ?`,
      params: [nominalValid, santriId],
    },
  ])

  const santri = santriMap.get(santriId)
  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'payment',
    fiturHref: '/dashboard/asrama/uang-jajan',
    logKind: 'create',
    entityType: 'santri',
    entityId: santriId,
    entityLabel: santri?.nama_lengkap || santriId,
    summary: `Topup saldo uang jajan ${santri?.nama_lengkap || santriId}`,
    details: {
      nominal: nominalValid,
      keterangan: keterangan || 'Topup Saldo',
      jenis: 'MASUK',
      asrama: santri?.asrama ?? null,
    },
  })

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
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
    if (!item.santriId || !nominalValid) {
      return { error: 'Ada nominal jajan yang tidak valid.' }
    }
    aggregateMap.set(item.santriId, (aggregateMap.get(item.santriId) ?? 0) + nominalValid)
  }

  const aggregatedList = Array.from(aggregateMap.entries()).map(([santriId, nominal]) => ({ santriId, nominal }))
  const santriMap = await getAllowedSantriRows(aggregatedList.map(item => item.santriId))

  if (santriMap.size !== aggregatedList.length) {
    return { error: 'Sebagian santri tidak ditemukan atau tidak boleh diakses.' }
  }

  for (const item of aggregatedList) {
    const saldo = santriMap.get(item.santriId)?.saldo ?? 0
    if (saldo < item.nominal) {
      return { error: 'Saldo tidak cukup untuk sebagian santri. Batalkan dan periksa ulang.' }
    }
  }

  const now = new Date().toISOString()
  await batch([
    ...aggregatedList.map(item => ({
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?)`,
      params: [generateId(), item.santriId, item.nominal, session.id, now],
    })),
    ...aggregatedList.map(item => ({
      sql: `UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) - ? WHERE id = ?`,
      params: [item.nominal, item.santriId],
    })),
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'payment',
    fiturHref: '/dashboard/asrama/uang-jajan',
    logKind: 'create',
    entityType: 'tabungan_batch',
    entityId: 'batch',
    entityLabel: 'Jajan harian massal',
    summary: `Mencatat jajan harian massal untuk ${aggregatedList.length} santri`,
    details: {
      count: aggregatedList.length,
      total_nominal: aggregatedList.reduce((sum, item) => sum + item.nominal, 0),
    },
  })

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true, count: aggregatedList.length }
}

export async function getRiwayatTabunganSantri(santriId: string) {
  const santriMap = await getAllowedSantriRows([santriId])
  if (!santriMap.has(santriId)) return []

  return query<RiwayatTabunganRow>(
    `SELECT tl.*, u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id = tl.created_by
     WHERE tl.santri_id = ?
     ORDER BY tl.created_at DESC
     LIMIT 20`,
    [santriId]
  )
}

export async function hapusTransaksi(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const trx = await getAllowedTransaksiRow(id)
  if (!trx) return { error: 'Transaksi tidak ditemukan atau tidak boleh diakses.' }

  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null }>(
    'SELECT nama_lengkap, nis FROM santri WHERE id = ?',
    [trx.santri_id]
  )

  const santriMap = await getAllowedSantriRows([trx.santri_id])
  const saldoSaatIni = santriMap.get(trx.santri_id)?.saldo
  if (saldoSaatIni == null) {
    return { error: 'Santri transaksi tidak ditemukan atau tidak boleh diakses.' }
  }

  if (trx.jenis === 'MASUK' && saldoSaatIni < trx.nominal) {
    return { error: 'Saldo santri saat ini lebih kecil dari nominal topup yang akan dibatalkan.' }
  }

  const delta = trx.jenis === 'MASUK' ? -trx.nominal : trx.nominal
  await batch([
    { sql: 'DELETE FROM tabungan_log WHERE id = ?', params: [id] },
    {
      sql: 'UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) + ? WHERE id = ?',
      params: [delta, trx.santri_id],
    },
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'uang_jajan',
    action: 'delete',
    fiturHref: '/dashboard/asrama/uang-jajan',
    logKind: 'delete',
    entityType: 'santri',
    entityId: trx.santri_id,
    entityLabel: santri?.nama_lengkap || santri?.nis || trx.santri_id,
    summary: `Menghapus transaksi uang jajan ${santri?.nama_lengkap || santri?.nis || trx.santri_id}`,
    details: {
      transaksi_id: id,
      jenis: trx.jenis,
      nominal: trx.nominal,
      asrama: trx.asrama,
    },
  })

  revalidatePath(UANG_JAJAN_PATH)
  return { success: true }
}

export async function getClientRestriction() {
  return getUserRestriction()
}
