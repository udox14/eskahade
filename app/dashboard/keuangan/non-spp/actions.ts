'use server'

import { execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath, revalidateTag } from 'next/cache'

const PATH = '/dashboard/keuangan/non-spp'
const JENIS_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const
const JENIS_ALL = ['BANGUNAN', ...JENIS_TAHUNAN] as const
const LEGACY_CUTOFF_KEY = 'keuangan_non_spp_cutoff_tanggal'
const DEFAULT_LEGACY_CUTOFF = '2026-07-01'

type JenisBiaya = typeof JENIS_ALL[number]

type TahunAjaran = {
  id: number
  nama: string
  is_active: number
}

type SantriRow = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  tahun_masuk: number | null
  tanggal_masuk?: string | null
  created_at: string | null
  psb_flow_id?: string | null
}

type PaymentRow = {
  id: string
  santri_id: string
  jenis_biaya: JenisBiaya
  tahun_tagihan: number | null
  tahun_ajaran_id: number | null
  nominal_bayar: number
  tanggal_bayar: string
  penerima_id: string | null
  keterangan: string | null
  batch_id: string | null
  psb_receipt_id: string | null
  status: string | null
  void_reason: string | null
  voided_at: string | null
  penerima_nama?: string | null
  voided_by_name?: string | null
  nama_lengkap?: string
  nis?: string | null
  asrama?: string | null
  tahun_ajaran_nama?: string | null
}

type TarifMap = Record<JenisBiaya, number>

type OpeningBalanceRow = {
  id: string
  santri_id: string
  tahun_ajaran_id: number
  jenis_biaya: JenisBiaya
  nominal_tagihan: number
  status: string
  catatan: string | null
  created_at: string
  created_by: string | null
  void_reason: string | null
  voided_by: string | null
  voided_at: string | null
  penerima_nama?: string | null
}

function toInt(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyTarif(): TarifMap {
  return { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 }
}

function inferTahunTagihan(tahunAjaran: TahunAjaran | null) {
  const match = tahunAjaran?.nama?.match(/\b(20\d{2}|19\d{2})\b/)
  return match ? Number(match[1]) : new Date().getFullYear()
}

function activeCondition(alias = 'p') {
  return `COALESCE(${alias}.status, 'AKTIF') != 'VOID'`
}

function annualTaCondition(alias = 'p') {
  return `((${alias}.tahun_ajaran_id = ?) OR (${alias}.tahun_ajaran_id IS NULL AND ${alias}.tahun_tagihan = ?))`
}

function normalizeDate(value: string | null | undefined) {
  const text = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function effectiveYear(row: Pick<SantriRow, 'tahun_masuk' | 'tanggal_masuk' | 'created_at'>) {
  if (row.tahun_masuk) return Number(row.tahun_masuk)
  const tanggalMasukYear = Number(String(row.tanggal_masuk ?? '').slice(0, 4))
  if (Number.isFinite(tanggalMasukYear) && tanggalMasukYear > 0) return tanggalMasukYear
  const createdYear = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear()
  return Number.isFinite(createdYear) ? createdYear : new Date().getFullYear()
}

function isLegacySettledSantri(row: SantriRow, cutoffTanggal: string) {
  const createdDate = normalizeDate(row.created_at)
  return !!createdDate && createdDate < cutoffTanggal && !row.psb_flow_id
}

function openingEmpty(): TarifMap {
  return emptyTarif()
}

async function ensureLegacySchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await execute(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)',
    [LEGACY_CUTOFF_KEY, DEFAULT_LEGACY_CUTOFF]
  )
  await execute(`
    CREATE TABLE IF NOT EXISTS keuangan_non_spp_opening_balance (
      id                TEXT PRIMARY KEY,
      santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      tahun_ajaran_id   INTEGER NOT NULL REFERENCES tahun_ajaran(id),
      jenis_biaya       TEXT NOT NULL,
      nominal_tagihan   INTEGER NOT NULL DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'AKTIF',
      catatan           TEXT,
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      void_reason       TEXT,
      voided_by         TEXT REFERENCES users(id),
      voided_at         TEXT
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_santri_ta
      ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, status)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_ta_status
      ON keuangan_non_spp_opening_balance(tahun_ajaran_id, status)
  `)
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_non_spp_opening_balance_active
      ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, jenis_biaya)
      WHERE COALESCE(status, 'AKTIF') != 'VOID'
  `)
}

async function getLegacyCutoffTanggal() {
  await ensureLegacySchema()
  const row = await queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [LEGACY_CUTOFF_KEY])
  return normalizeDate(row?.value) ?? DEFAULT_LEGACY_CUTOFF
}

function groupOpeningBalances(rows: OpeningBalanceRow[]) {
  const bySantri = new Map<string, OpeningBalanceRow[]>()
  rows.forEach((row) => {
    if (!bySantri.has(row.santri_id)) bySantri.set(row.santri_id, [])
    bySantri.get(row.santri_id)!.push(row)
  })
  return bySantri
}

export async function getTahunAjaranOptions() {
  return query<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC')
}

export async function getActiveTahunAjaran() {
  return queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
}

export async function getTarifNonSpp(tahunAjaranId: number, tahunAngkatan: number) {
  const result = emptyTarif()

  const scoped = await query<{ jenis_biaya: JenisBiaya; nominal: number }>(
    'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ?',
    [tahunAjaranId, tahunAngkatan]
  )
  const rows = scoped.length
    ? scoped
    : await query<{ jenis_biaya: JenisBiaya; nominal: number }>(
        'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id IS NULL AND tahun_angkatan = ?',
        [tahunAngkatan]
      )

  rows.forEach((row) => {
    if (JENIS_ALL.includes(row.jenis_biaya)) result[row.jenis_biaya] = toInt(row.nominal)
  })
  return result
}

export async function getDaftarTarifNonSpp(tahunAjaranId: number) {
  const rows = await query<{ tahun_angkatan: number; jenis_biaya: JenisBiaya; nominal: number; source_rank: number }>(`
    SELECT tahun_angkatan, jenis_biaya, nominal, 0 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id = ?
    UNION ALL
    SELECT tahun_angkatan, jenis_biaya, nominal, 1 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id IS NULL
      AND tahun_angkatan NOT IN (
        SELECT DISTINCT tahun_angkatan FROM biaya_settings WHERE tahun_ajaran_id = ?
      )
    ORDER BY tahun_angkatan DESC, source_rank ASC
  `, [tahunAjaranId, tahunAjaranId])

  const grouped = new Map<number, TarifMap & { tahun: number; legacy: boolean }>()
  rows.forEach((row) => {
    if (!grouped.has(row.tahun_angkatan)) {
      grouped.set(row.tahun_angkatan, { tahun: row.tahun_angkatan, legacy: row.source_rank === 1, ...emptyTarif() })
    }
    const item = grouped.get(row.tahun_angkatan)!
    item[row.jenis_biaya] = toInt(row.nominal)
    item.legacy = item.legacy && row.source_rank === 1
  })

  return Array.from(grouped.values())
}

export async function simpanTarifNonSpp(input: {
  tahunAjaranId: number
  tahunAngkatan: number
  tarif: Partial<TarifMap>
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  const tahunAjaranId = Number(input.tahunAjaranId)
  const tahunAngkatan = Number(input.tahunAngkatan)
  if (!Number.isInteger(tahunAjaranId) || tahunAjaranId <= 0) return { error: 'Tahun ajaran tidak valid.' }
  if (!Number.isInteger(tahunAngkatan) || tahunAngkatan <= 0) return { error: 'Tahun angkatan tidak valid.' }

  for (const jenis of JENIS_ALL) {
    const nominal = Math.max(0, toInt(input.tarif[jenis]))
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ? AND jenis_biaya = ?',
      [tahunAjaranId, tahunAngkatan, jenis]
    )
    if (existing) {
      await execute('UPDATE biaya_settings SET nominal = ? WHERE id = ?', [nominal, existing.id])
    } else {
      await execute(
        'INSERT INTO biaya_settings (tahun_ajaran_id, tahun_angkatan, jenis_biaya, nominal) VALUES (?, ?, ?, ?)',
        [tahunAjaranId, tahunAngkatan, jenis, nominal]
      )
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'update_tarif',
    fiturHref: PATH,
    logKind: 'update',
    entityType: 'biaya_settings',
    entityLabel: `${tahunAjaranId}/${tahunAngkatan}`,
    summary: `Menyimpan tarif Non-SPP angkatan ${tahunAngkatan}`,
    details: { tahun_ajaran_id: tahunAjaranId, tahun_angkatan: tahunAngkatan, tarif: input.tarif },
  })

  
  revalidatePath(PATH)
  return { success: true }
}

async function loadTarifMap(tahunAjaranId: number) {
  const rows = await query<{ tahun_angkatan: number; jenis_biaya: JenisBiaya; nominal: number; source_rank: number }>(`
    SELECT tahun_angkatan, jenis_biaya, nominal, 0 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id = ?
    UNION ALL
    SELECT tahun_angkatan, jenis_biaya, nominal, 1 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id IS NULL
    ORDER BY source_rank ASC
  `, [tahunAjaranId])
  const map = new Map<string, number>()
  rows.forEach((row) => {
    const key = `${row.tahun_angkatan}-${row.jenis_biaya}`
    if (!map.has(key)) map.set(key, toInt(row.nominal))
  })
  return map
}

async function loadMonitoringRows(filters: {
  tahunAjaranId: number
  tahunTagihan: number
  asrama: string
  kamar: string
  search: string
}) {
  const cutoffTanggal = await getLegacyCutoffTanggal()
  let santriSql = `
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.status_global = 'aktif'
  `
  const santriParams: unknown[] = []
  if (filters.asrama && filters.asrama !== 'SEMUA') {
    santriSql += ' AND s.asrama = ?'
    santriParams.push(filters.asrama)
  }
  if (filters.kamar && filters.kamar !== 'SEMUA') {
    santriSql += ' AND s.kamar = ?'
    santriParams.push(filters.kamar)
  }
  if (filters.search.trim()) {
    santriSql += ' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)'
    const like = `%${filters.search.trim()}%`
    santriParams.push(like, like)
  }
  santriSql += ' ORDER BY s.nama_lengkap'

  const santri = await query<SantriRow>(santriSql, santriParams)
  const tarifMap = await loadTarifMap(filters.tahunAjaranId)
  const openingRows = await query<OpeningBalanceRow>(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.tahun_ajaran_id = ?
      AND COALESCE(ob.status, 'AKTIF') != 'VOID'
  `, [filters.tahunAjaranId])
  const openingBySantri = groupOpeningBalances(openingRows)

  let paySql = `
    SELECT p.*
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    WHERE s.status_global = 'aktif'
      AND ${activeCondition('p')}
      AND (
        p.jenis_biaya = 'BANGUNAN'
        OR (${annualTaCondition('p')})
      )
  `
  const payParams: unknown[] = [filters.tahunAjaranId, filters.tahunTagihan]
  if (filters.asrama && filters.asrama !== 'SEMUA') {
    paySql += ' AND s.asrama = ?'
    payParams.push(filters.asrama)
  }
  if (filters.kamar && filters.kamar !== 'SEMUA') {
    paySql += ' AND s.kamar = ?'
    payParams.push(filters.kamar)
  }
  if (filters.search.trim()) {
    paySql += ' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)'
    const like = `%${filters.search.trim()}%`
    payParams.push(like, like)
  }

  const payments = await query<PaymentRow>(paySql, payParams)
  const bySantri = new Map<string, PaymentRow[]>()
  payments.forEach((payment) => {
    if (!bySantri.has(payment.santri_id)) bySantri.set(payment.santri_id, [])
    bySantri.get(payment.santri_id)!.push(payment)
  })

  return santri.map((s) => {
    const tahunMasuk = effectiveYear(s)
    const legacySettled = isLegacySettledSantri(s, cutoffTanggal)
    const rows = bySantri.get(s.id) ?? []
    const openingRowsSantri = openingBySantri.get(s.id) ?? []
    const opening = openingEmpty()
    openingRowsSantri.forEach((row) => {
      if (JENIS_ALL.includes(row.jenis_biaya)) opening[row.jenis_biaya] += toInt(row.nominal_tagihan)
    })
    const tarif = emptyTarif()
    JENIS_ALL.forEach((jenis) => {
      tarif[jenis] = legacySettled ? opening[jenis] : (tarifMap.get(`${tahunMasuk}-${jenis}`) ?? 0)
    })

    const rawBangunanPaid = rows
      .filter((p) => p.jenis_biaya === 'BANGUNAN')
      .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
    const bangunanPaid = legacySettled && tarif.BANGUNAN <= 0 ? 0 : rawBangunanPaid
    const bangunanSisa = Math.max(0, tarif.BANGUNAN - bangunanPaid)

    const tahunan = Object.fromEntries(JENIS_TAHUNAN.map((jenis) => {
      const jenisRows = rows.filter((p) => p.jenis_biaya === jenis)
      const rawPaid = jenisRows.reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
      const paid = legacySettled && tarif[jenis] <= 0 ? 0 : rawPaid
      const sisa = Math.max(0, tarif[jenis] - paid)
      return [jenis, {
        tarif: tarif[jenis],
        paid,
        sisa,
        lunas: tarif[jenis] > 0 ? sisa <= 0 : false,
        paymentIds: jenisRows.filter((p) => !p.psb_receipt_id).map((p) => p.id),
        hasPsbPayment: jenisRows.some((p) => !!p.psb_receipt_id),
      }]
    }))

    const totalKurang = bangunanSisa + JENIS_TAHUNAN.reduce((sum, jenis) => sum + (tahunan as any)[jenis].sisa, 0)

    return {
      ...s,
      tahun_masuk_fix: tahunMasuk,
      is_legacy_settled: legacySettled,
      legacy_cutoff_tanggal: cutoffTanggal,
      opening_balance: opening,
      opening_balance_rows: openingRowsSantri,
      tarif,
      bangunan: {
        tarif: tarif.BANGUNAN,
        paid: bangunanPaid,
        sisa: bangunanSisa,
        status: tarif.BANGUNAN <= 0 ? '-' : bangunanSisa <= 0 ? 'LUNAS' : bangunanPaid > 0 ? 'CICIL' : 'BELUM',
        paymentIds: rows.filter((p) => p.jenis_biaya === 'BANGUNAN').map((p) => p.id),
      },
      tahunan,
      total_kurang: totalKurang,
      is_full_tahunan: JENIS_TAHUNAN.every((jenis) => (tahunan as any)[jenis].lunas),
    }
  })
}

export async function getMonitoringNonSpp(filters: {
  tahunAjaranId: number
  asrama?: string
  kamar?: string
  search?: string
}) {
  const tahunAjaran = await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [filters.tahunAjaranId])
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  return loadMonitoringRows({
    tahunAjaranId: filters.tahunAjaranId,
    tahunTagihan,
    asrama: filters.asrama || 'SEMUA',
    kamar: filters.kamar || 'SEMUA',
    search: filters.search || '',
  })
}

export async function bayarInlineNonSpp(input: {
  santriId: string
  tahunAjaranId: number
  jenis: JenisBiaya
  nominal?: number
}): Promise<{ success: true; id: string } | { error: string }> {
  const session = await getSession()
  if (!JENIS_ALL.includes(input.jenis)) return { error: 'Jenis biaya tidak valid.' }
  const tahunAjaran = await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [input.tahunAjaranId])
  if (!tahunAjaran) return { error: 'Tahun ajaran tidak ditemukan.' }
  const cutoffTanggal = await getLegacyCutoffTanggal()
  const santri = await queryOne<SantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `, [input.santriId])
  if (!santri) return { error: 'Santri tidak ditemukan.' }

  const tahunMasuk = effectiveYear(santri)
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  const legacySettled = isLegacySettledSantri(santri, cutoffTanggal)
  const tarif = legacySettled ? openingEmpty() : await getTarifNonSpp(tahunAjaran.id, tahunMasuk)
  if (legacySettled) {
    const openingRows = await query<OpeningBalanceRow>(`
      SELECT *
      FROM keuangan_non_spp_opening_balance
      WHERE santri_id = ?
        AND tahun_ajaran_id = ?
        AND COALESCE(status, 'AKTIF') != 'VOID'
    `, [santri.id, tahunAjaran.id])
    openingRows.forEach((row) => {
      if (JENIS_ALL.includes(row.jenis_biaya)) tarif[row.jenis_biaya] += toInt(row.nominal_tagihan)
    })
  }
  const target = tarif[input.jenis] ?? 0
  if (target <= 0) return { error: `Tarif ${input.jenis} belum diatur untuk angkatan ini.` }

  let nominal = Math.max(0, toInt(input.nominal))
  if (input.jenis === 'BANGUNAN') {
    const paid = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(nominal_bayar), 0) AS total FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = 'BANGUNAN' AND ${activeCondition()}`,
      [santri.id]
    )
    const sisa = Math.max(0, target - toInt(paid?.total))
    if (sisa <= 0) return { error: 'Uang Bangunan santri ini sudah lunas.' }
    nominal = nominal > 0 ? Math.min(nominal, sisa) : sisa
  } else {
    const paid = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(nominal_bayar), 0) AS total
       FROM pembayaran_tahunan p
       WHERE santri_id = ? AND jenis_biaya = ? AND ${activeCondition('p')} AND ${annualTaCondition('p')}`,
      [santri.id, input.jenis, tahunAjaran.id, tahunTagihan]
    )
    const sisa = Math.max(0, target - toInt(paid?.total))
    if (sisa <= 0) return { error: `${input.jenis} tahun ajaran ini sudah lunas.` }
    nominal = sisa
  }
  if (nominal <= 0) return { error: 'Nominal pembayaran tidak valid.' }

  const id = generateId()
  await execute(`
    INSERT INTO pembayaran_tahunan
      (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
  `, [
    id,
    santri.id,
    input.jenis,
    input.jenis === 'BANGUNAN' ? null : tahunTagihan,
    tahunAjaran.id,
    nominal,
    session?.id ?? null,
    input.jenis === 'BANGUNAN' ? 'Pembayaran Bangunan inline' : `Pembayaran ${input.jenis} ${tahunAjaran.nama}`,
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'payment',
    fiturHref: PATH,
    logKind: 'create',
    entityType: 'pembayaran_tahunan',
    entityId: id,
    entityLabel: santri.nama_lengkap || santri.nis || santri.id,
    summary: `Mencatat pembayaran ${input.jenis} untuk ${santri.nama_lengkap || santri.nis || santri.id}`,
    details: { santri_id: santri.id, tahun_ajaran_id: tahunAjaran.id, jenis_biaya: input.jenis, nominal },
  })

  revalidatePath(PATH)
  return { success: true, id }
}

export async function bulkBayarNonSpp(input: {
  santriIds: string[]
  tahunAjaranId: number
  jenis: JenisBiaya[]
}): Promise<{ success: true; batchId: string; inserted: number; skipped: number; total: number } | { error: string }> {
  const session = await getSession()
  const santriIds = Array.from(new Set(input.santriIds.filter(Boolean)))
  const jenisList = input.jenis.filter((jenis): jenis is JenisBiaya => JENIS_ALL.includes(jenis))
  if (!santriIds.length) return { error: 'Pilih santri terlebih dahulu.' }
  if (!jenisList.length) return { error: 'Pilih jenis biaya terlebih dahulu.' }

  const tahunAjaran = await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [input.tahunAjaranId])
  if (!tahunAjaran) return { error: 'Tahun ajaran tidak ditemukan.' }
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  const allRows = await loadMonitoringRows({
    tahunAjaranId: tahunAjaran.id,
    tahunTagihan,
    asrama: 'SEMUA',
    kamar: 'SEMUA',
    search: '',
  })
  const rowMap = new Map(allRows.map((row: any) => [row.id, row]))
  const batchId = generateId()
  let inserted = 0
  let skipped = 0
  let total = 0

  for (const santriId of santriIds) {
    const row: any = rowMap.get(santriId)
    if (!row) {
      skipped += jenisList.length
      continue
    }
    for (const jenis of jenisList) {
      const sisa = jenis === 'BANGUNAN' ? row.bangunan.sisa : row.tahunan[jenis]?.sisa
      if (!sisa || sisa <= 0) {
        skipped += 1
        continue
      }
      const id = generateId()
      await execute(`
        INSERT INTO pembayaran_tahunan
          (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, batch_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
      `, [
        id,
        santriId,
        jenis,
        jenis === 'BANGUNAN' ? null : tahunTagihan,
        tahunAjaran.id,
        batchId,
        sisa,
        session?.id ?? null,
        `Bulk Non-SPP ${tahunAjaran.nama}`,
      ])
      inserted += 1
      total += sisa
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'bulk_payment',
    fiturHref: PATH,
    logKind: 'create',
    entityType: 'pembayaran_tahunan',
    entityId: batchId,
    entityLabel: `Batch ${batchId}`,
    summary: `Mencatat bulk pembayaran Non-SPP untuk ${santriIds.length} santri`,
    details: { batch_id: batchId, tahun_ajaran_id: tahunAjaran.id, jenis: jenisList, inserted, skipped, total },
  })

  revalidatePath(PATH)
  return { success: true, batchId, inserted, skipped, total }
}

export async function voidPembayaranNonSpp(input: {
  paymentId?: string
  batchId?: string
  alasan: string
}): Promise<{ success: true; count: number } | { error: string }> {
  const session = await getSession()
  const alasan = input.alasan.trim()
  if (alasan.length < 5) return { error: 'Alasan void minimal 5 karakter.' }
  if (!input.paymentId && !input.batchId) return { error: 'Target void tidak valid.' }

  const params: unknown[] = []
  let where = activeCondition('p')
  if (input.paymentId) {
    where += ' AND p.id = ?'
    params.push(input.paymentId)
  } else {
    where += ' AND p.batch_id = ?'
    params.push(input.batchId)
  }

  const rows = await query<PaymentRow>(`SELECT p.* FROM pembayaran_tahunan p WHERE ${where}`, params)
  if (!rows.length) return { error: 'Transaksi aktif tidak ditemukan atau sudah di-void.' }

  const stamp = now()
  if (input.paymentId) {
    await execute(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `, [alasan, session?.id ?? null, stamp, input.paymentId])
  } else {
    await execute(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE batch_id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `, [alasan, session?.id ?? null, stamp, input.batchId])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'void',
    fiturHref: PATH,
    logKind: 'update',
    entityType: 'pembayaran_tahunan',
    entityId: input.paymentId || input.batchId,
    entityLabel: input.paymentId ? 'Transaksi Non-SPP' : `Batch ${input.batchId}`,
    summary: `Void ${rows.length} transaksi Non-SPP`,
    details: { payment_id: input.paymentId, batch_id: input.batchId, alasan, count: rows.length },
  })

  revalidatePath(PATH)
  return { success: true, count: rows.length }
}

export async function simpanOpeningBalanceNonSpp(input: {
  santriId: string
  tahunAjaranId: number
  jenis: JenisBiaya
  nominal: number
  catatan?: string
}): Promise<{ success: true; id: string } | { error: string }> {
  const session = await getSession()
  await ensureLegacySchema()
  if (!JENIS_ALL.includes(input.jenis)) return { error: 'Jenis biaya tidak valid.' }
  const nominal = Math.max(0, toInt(input.nominal))
  if (nominal <= 0) return { error: 'Nominal tagihan awal wajib lebih dari 0.' }

  const tahunAjaran = await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [input.tahunAjaranId])
  if (!tahunAjaran) return { error: 'Tahun ajaran tidak ditemukan.' }
  const cutoffTanggal = await getLegacyCutoffTanggal()
  const santri = await queryOne<SantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `, [input.santriId])
  if (!santri) return { error: 'Santri tidak ditemukan.' }
  if (!isLegacySettledSantri(santri, cutoffTanggal)) return { error: 'Tagihan awal hanya untuk santri legacy/migrasi.' }

  const existing = await queryOne<{ id: string }>(`
    SELECT id FROM keuangan_non_spp_opening_balance
    WHERE santri_id = ? AND tahun_ajaran_id = ? AND jenis_biaya = ? AND COALESCE(status, 'AKTIF') != 'VOID'
  `, [santri.id, tahunAjaran.id, input.jenis])
  const catatan = input.catatan?.trim() || `Tagihan awal migrasi ${tahunAjaran.nama}`

  if (existing) {
    await execute(`
      UPDATE keuangan_non_spp_opening_balance
      SET nominal_tagihan = ?, catatan = ?
      WHERE id = ?
    `, [nominal, catatan, existing.id])
    revalidatePath(PATH)
    revalidatePath(`${PATH}/buku-besar/${santri.id}`)
    return { success: true, id: existing.id }
  }

  const id = generateId()
  await execute(`
    INSERT INTO keuangan_non_spp_opening_balance
      (id, santri_id, tahun_ajaran_id, jenis_biaya, nominal_tagihan, status, catatan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'AKTIF', ?, ?, datetime('now'))
  `, [id, santri.id, tahunAjaran.id, input.jenis, nominal, catatan, session?.id ?? null])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'opening_balance',
    fiturHref: PATH,
    logKind: 'create',
    entityType: 'keuangan_non_spp_opening_balance',
    entityId: id,
    entityLabel: santri.nama_lengkap || santri.nis || santri.id,
    summary: `Menandai tagihan awal ${input.jenis} untuk ${santri.nama_lengkap || santri.nis || santri.id}`,
    details: { santri_id: santri.id, tahun_ajaran_id: tahunAjaran.id, jenis_biaya: input.jenis, nominal },
  })

  revalidatePath(PATH)
  revalidatePath(`${PATH}/buku-besar/${santri.id}`)
  return { success: true, id }
}

export async function voidOpeningBalanceNonSpp(input: {
  openingBalanceId: string
  alasan: string
}): Promise<{ success: true } | { error: string }> {
  const session = await getSession()
  await ensureLegacySchema()
  const alasan = input.alasan.trim()
  if (alasan.length < 5) return { error: 'Alasan void minimal 5 karakter.' }
  const row = await queryOne<OpeningBalanceRow>(`
    SELECT *
    FROM keuangan_non_spp_opening_balance
    WHERE id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
  `, [input.openingBalanceId])
  if (!row) return { error: 'Tagihan awal aktif tidak ditemukan.' }

  await execute(`
    UPDATE keuangan_non_spp_opening_balance
    SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
    WHERE id = ?
  `, [alasan, session?.id ?? null, now(), row.id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keuangan_non_spp',
    action: 'opening_balance_void',
    fiturHref: PATH,
    logKind: 'update',
    entityType: 'keuangan_non_spp_opening_balance',
    entityId: row.id,
    entityLabel: row.jenis_biaya,
    summary: `Void tagihan awal ${row.jenis_biaya}`,
    details: { santri_id: row.santri_id, tahun_ajaran_id: row.tahun_ajaran_id, alasan },
  })

  revalidatePath(PATH)
  revalidatePath(`${PATH}/buku-besar/${row.santri_id}`)
  return { success: true }
}

export async function getBukuBesarSantri(santriId: string, tahunAjaranId?: number) {
  if (!santriId) return null
  const cutoffTanggal = await getLegacyCutoffTanggal()
  const santri = await queryOne<SantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `, [santriId])
  if (!santri) return null

  const payments = await query<PaymentRow>(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `, [santriId])

  const tahunMasuk = effectiveYear(santri)
  const legacySettled = isLegacySettledSantri(santri, cutoffTanggal)
  const tahunAjaran = tahunAjaranId
    ? await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [tahunAjaranId])
    : await getActiveTahunAjaran()
  const openingRows = tahunAjaran ? await query<OpeningBalanceRow>(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.santri_id = ?
      AND ob.tahun_ajaran_id = ?
      AND COALESCE(ob.status, 'AKTIF') != 'VOID'
  `, [santri.id, tahunAjaran.id]) : []
  const tarif = tahunAjaran && !legacySettled ? await getTarifNonSpp(tahunAjaran.id, tahunMasuk) : emptyTarif()
  if (legacySettled) {
    openingRows.forEach((row) => {
      if (JENIS_ALL.includes(row.jenis_biaya)) tarif[row.jenis_biaya] += toInt(row.nominal_tagihan)
    })
  }
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  const active = payments.filter((p) => (p.status || 'AKTIF') !== 'VOID')
  const rawPaidBangunan = active.filter((p) => p.jenis_biaya === 'BANGUNAN').reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
  const paidBangunan = legacySettled && tarif.BANGUNAN <= 0 ? 0 : rawPaidBangunan
  const saldo = {
    BANGUNAN: Math.max(0, tarif.BANGUNAN - paidBangunan),
    KESEHATAN: 0,
    EHB: 0,
    EKSKUL: 0,
  }
  JENIS_TAHUNAN.forEach((jenis) => {
    const rawPaid = active
      .filter((p) => p.jenis_biaya === jenis && ((p.tahun_ajaran_id && p.tahun_ajaran_id === tahunAjaran?.id) || (!p.tahun_ajaran_id && p.tahun_tagihan === tahunTagihan)))
      .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
    const paid = legacySettled && tarif[jenis] <= 0 ? 0 : rawPaid
    saldo[jenis] = Math.max(0, tarif[jenis] - paid)
  })

  return {
    santri: { ...santri, tahun_masuk_fix: tahunMasuk, is_legacy_settled: legacySettled, legacy_cutoff_tanggal: cutoffTanggal },
    payments,
    openingBalances: openingRows,
    saldo,
    tarif,
  }
}

export async function getBukuBesarDetailNonSpp(santriId: string) {
  if (!santriId) return null
  const cutoffTanggal = await getLegacyCutoffTanggal()
  const santri = await queryOne<SantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `, [santriId])
  if (!santri) return null

  const tahunMasuk = effectiveYear(santri)
  const legacySettled = isLegacySettledSantri(santri, cutoffTanggal)
  const tahunAjaranList = await getTahunAjaranOptions()
  const payments = await query<PaymentRow>(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY datetime(p.tanggal_bayar) DESC, p.tanggal_bayar DESC, p.id DESC
  `, [santriId])

  const active = payments.filter((p) => (p.status || 'AKTIF') !== 'VOID')
  const openingRows = await query<OpeningBalanceRow>(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.santri_id = ?
    ORDER BY datetime(ob.created_at) DESC, ob.created_at DESC
  `, [santriId])
  const activeOpeningByTa = groupOpeningBalances(openingRows.filter((row) => (row.status || 'AKTIF') !== 'VOID'))
  const rawBangunanPaid = active
    .filter((p) => p.jenis_biaya === 'BANGUNAN')
    .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)

  const yearly = await Promise.all(tahunAjaranList.map(async (ta) => {
    const tarif = legacySettled ? emptyTarif() : await getTarifNonSpp(ta.id, tahunMasuk)
    if (legacySettled) {
      const taOpeningRows = (activeOpeningByTa.get(santriId) ?? []).filter((row) => row.tahun_ajaran_id === ta.id)
      taOpeningRows.forEach((row) => {
        if (JENIS_ALL.includes(row.jenis_biaya)) tarif[row.jenis_biaya] += toInt(row.nominal_tagihan)
      })
    }
    const tahunTagihan = inferTahunTagihan(ta)
    const categories = {
      BANGUNAN: {
        tarif: tarif.BANGUNAN,
        paid: legacySettled && tarif.BANGUNAN <= 0 ? 0 : rawBangunanPaid,
        sisa: Math.max(0, tarif.BANGUNAN - (legacySettled && tarif.BANGUNAN <= 0 ? 0 : rawBangunanPaid)),
      },
      KESEHATAN: { tarif: tarif.KESEHATAN, paid: 0, sisa: 0 },
      EHB: { tarif: tarif.EHB, paid: 0, sisa: 0 },
      EKSKUL: { tarif: tarif.EKSKUL, paid: 0, sisa: 0 },
    }

    JENIS_TAHUNAN.forEach((jenis) => {
      const rawPaid = active
        .filter((p) => p.jenis_biaya === jenis && ((p.tahun_ajaran_id && p.tahun_ajaran_id === ta.id) || (!p.tahun_ajaran_id && p.tahun_tagihan === tahunTagihan)))
        .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
      const paid = legacySettled && tarif[jenis] <= 0 ? 0 : rawPaid
      categories[jenis] = {
        tarif: tarif[jenis],
        paid,
        sisa: Math.max(0, tarif[jenis] - paid),
      }
    })

    const potential = JENIS_ALL.reduce((sum, jenis) => sum + categories[jenis].tarif, 0)
    const received = categories.BANGUNAN.paid + JENIS_TAHUNAN.reduce((sum, jenis) => sum + categories[jenis].paid, 0)
    const remaining = JENIS_ALL.reduce((sum, jenis) => sum + categories[jenis].sisa, 0)

    return {
      id: ta.id,
      nama: ta.nama,
      is_active: ta.is_active,
      tahun_tagihan: tahunTagihan,
      categories,
      potential,
      received,
      remaining,
      complete: remaining <= 0 && potential > 0,
    }
  }))

  return {
    santri: { ...santri, tahun_masuk_fix: tahunMasuk, is_legacy_settled: legacySettled, legacy_cutoff_tanggal: cutoffTanggal },
    yearly,
    payments,
    openingBalances: openingRows,
  }
}

export async function searchSantriNonSpp(keyword: string) {
  const like = `%${keyword.trim()}%`
  return query<SantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.status_global = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
    ORDER BY s.nama_lengkap
    LIMIT 12
  `, [like, like])
}

export async function getLaporanNonSpp(tahunAjaranId: number) {
  const tahunAjaran = await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [tahunAjaranId])
  if (!tahunAjaran) return null
  const tahunTagihan = inferTahunTagihan(tahunAjaran)

  const list = await query<PaymentRow>(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE (
      p.jenis_biaya = 'BANGUNAN'
      OR ${annualTaCondition('p')}
    )
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `, [tahunAjaran.id, tahunTagihan])

  const activeList = list.filter((item) => (item.status || 'AKTIF') !== 'VOID')
  const cashFlow = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0, TOTAL: 0 }
  activeList.forEach((item) => {
    if (JENIS_ALL.includes(item.jenis_biaya)) cashFlow[item.jenis_biaya] += toInt(item.nominal_bayar)
    cashFlow.TOTAL += toInt(item.nominal_bayar)
  })

  const rows = await loadMonitoringRows({ tahunAjaranId: tahunAjaran.id, tahunTagihan, asrama: 'SEMUA', kamar: 'SEMUA', search: '' })
  const legacySettledCount = rows.filter((row: any) => row.is_legacy_settled && row.total_kurang <= 0).length
  const legacyPiutangCount = rows.filter((row: any) => row.is_legacy_settled && row.total_kurang > 0).length
  const targets = {
    BANGUNAN: { target: 0, terima: 0, kurang: 0 },
    KESEHATAN: { target: 0, terima: 0, kurang: 0 },
    EHB: { target: 0, terima: 0, kurang: 0 },
    EKSKUL: { target: 0, terima: 0, kurang: 0 },
    TOTAL: { target: 0, terima: 0, kurang: 0 },
  }
  rows.forEach((row: any) => {
    targets.BANGUNAN.target += row.bangunan.tarif
    targets.BANGUNAN.terima += row.bangunan.paid
    targets.BANGUNAN.kurang += row.bangunan.sisa
    targets.TOTAL.target += row.bangunan.tarif
    targets.TOTAL.terima += row.bangunan.paid
    targets.TOTAL.kurang += row.bangunan.sisa
    JENIS_TAHUNAN.forEach((jenis) => {
      targets[jenis].target += row.tahunan[jenis].tarif
      targets[jenis].terima += row.tahunan[jenis].paid
      targets[jenis].kurang += row.tahunan[jenis].sisa
      targets.TOTAL.target += row.tahunan[jenis].tarif
      targets.TOTAL.terima += row.tahunan[jenis].paid
      targets.TOTAL.kurang += row.tahunan[jenis].sisa
    })
  })

  return {
    tahunAjaran,
    cashFlow,
    targets,
    list,
    legacy: {
      cutoffTanggal: await getLegacyCutoffTanggal(),
      settledCount: legacySettledCount,
      piutangCount: legacyPiutangCount,
    },
  }
}

export async function getNonSppReceipt(paymentId: string) {
  const receipt = await queryOne<PaymentRow & {
    sekolah: string | null
    kamar: string | null
    created_at: string | null
    tahun_masuk: number | null
    penerima_nama: string | null
  }>(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.created_at, s.tahun_masuk,
           ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    WHERE p.id = ?
  `, [paymentId])
  if (!receipt) return { error: 'Transaksi tidak ditemukan.' }

  const tahunMasuk = receipt.tahun_masuk || new Date(receipt.created_at || new Date()).getFullYear()
  const tarif = await queryOne<any>('SELECT nominal FROM biaya_settings WHERE jenis_biaya = ? AND tahun_angkatan = ?', [receipt.jenis_biaya, tahunMasuk])
  
  const paidRows = await query<any>(`
    SELECT nominal_bayar
    FROM pembayaran_tahunan
    WHERE santri_id = ? AND jenis_biaya = ? AND (tahun_tagihan = ? OR jenis_biaya = 'BANGUNAN') AND COALESCE(status, 'AKTIF') != 'VOID'
  `, [receipt.santri_id, receipt.jenis_biaya, receipt.tahun_tagihan])

  let totalDibayar = 0
  paidRows.forEach((p) => {
    totalDibayar += Number(p.nominal_bayar || 0)
  })

  const sisa = Math.max(0, Number(tarif?.nominal || 0) - totalDibayar)

  return { receipt, sisa }
}
