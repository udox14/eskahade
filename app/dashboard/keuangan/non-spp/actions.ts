'use server'

import { execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath, revalidateTag } from 'next/cache'

const PATH = '/dashboard/keuangan/non-spp'
const JENIS_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const
const JENIS_ALL = ['BANGUNAN', ...JENIS_TAHUNAN] as const

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
  created_at: string | null
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

  revalidateTag('biaya-settings', 'everything')
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
  let santriSql = `
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif'
  `
  const santriParams: unknown[] = []
  if (filters.asrama && filters.asrama !== 'SEMUA') {
    santriSql += ' AND asrama = ?'
    santriParams.push(filters.asrama)
  }
  if (filters.kamar && filters.kamar !== 'SEMUA') {
    santriSql += ' AND kamar = ?'
    santriParams.push(filters.kamar)
  }
  if (filters.search.trim()) {
    santriSql += ' AND (nama_lengkap LIKE ? OR nis LIKE ?)'
    const like = `%${filters.search.trim()}%`
    santriParams.push(like, like)
  }
  santriSql += ' ORDER BY nama_lengkap'

  const santri = await query<SantriRow>(santriSql, santriParams)
  const tarifMap = await loadTarifMap(filters.tahunAjaranId)

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
    const tahunMasuk = s.tahun_masuk || (s.created_at ? new Date(s.created_at).getFullYear() : new Date().getFullYear())
    const rows = bySantri.get(s.id) ?? []
    const tarif = emptyTarif()
    JENIS_ALL.forEach((jenis) => { tarif[jenis] = tarifMap.get(`${tahunMasuk}-${jenis}`) ?? 0 })

    const bangunanPaid = rows
      .filter((p) => p.jenis_biaya === 'BANGUNAN')
      .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
    const bangunanSisa = Math.max(0, tarif.BANGUNAN - bangunanPaid)

    const tahunan = Object.fromEntries(JENIS_TAHUNAN.map((jenis) => {
      const jenisRows = rows.filter((p) => p.jenis_biaya === jenis)
      const paid = jenisRows.reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
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
  const santri = await queryOne<SantriRow>('SELECT id, nama_lengkap, nis, tahun_masuk, created_at FROM santri WHERE id = ?', [input.santriId])
  if (!santri) return { error: 'Santri tidak ditemukan.' }

  const tahunMasuk = santri.tahun_masuk || (santri.created_at ? new Date(santri.created_at).getFullYear() : new Date().getFullYear())
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  const tarif = await getTarifNonSpp(tahunAjaran.id, tahunMasuk)
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

export async function getBukuBesarSantri(santriId: string, tahunAjaranId?: number) {
  if (!santriId) return null
  const santri = await queryOne<SantriRow>('SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at FROM santri WHERE id = ?', [santriId])
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

  const tahunMasuk = santri.tahun_masuk || (santri.created_at ? new Date(santri.created_at).getFullYear() : new Date().getFullYear())
  const tahunAjaran = tahunAjaranId
    ? await queryOne<TahunAjaran>('SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?', [tahunAjaranId])
    : await getActiveTahunAjaran()
  const tarif = tahunAjaran ? await getTarifNonSpp(tahunAjaran.id, tahunMasuk) : emptyTarif()
  const tahunTagihan = inferTahunTagihan(tahunAjaran)
  const active = payments.filter((p) => (p.status || 'AKTIF') !== 'VOID')
  const paidBangunan = active.filter((p) => p.jenis_biaya === 'BANGUNAN').reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
  const saldo = {
    BANGUNAN: Math.max(0, tarif.BANGUNAN - paidBangunan),
    KESEHATAN: 0,
    EHB: 0,
    EKSKUL: 0,
  }
  JENIS_TAHUNAN.forEach((jenis) => {
    const paid = active
      .filter((p) => p.jenis_biaya === jenis && ((p.tahun_ajaran_id && p.tahun_ajaran_id === tahunAjaran?.id) || (!p.tahun_ajaran_id && p.tahun_tagihan === tahunTagihan)))
      .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
    saldo[jenis] = Math.max(0, tarif[jenis] - paid)
  })

  return { santri: { ...santri, tahun_masuk_fix: tahunMasuk }, payments, saldo, tarif }
}

export async function getBukuBesarDetailNonSpp(santriId: string) {
  if (!santriId) return null
  const santri = await queryOne<SantriRow>(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE id = ?
  `, [santriId])
  if (!santri) return null

  const tahunMasuk = santri.tahun_masuk || (santri.created_at ? new Date(santri.created_at).getFullYear() : new Date().getFullYear())
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
  const bangunanPaid = active
    .filter((p) => p.jenis_biaya === 'BANGUNAN')
    .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)

  const yearly = await Promise.all(tahunAjaranList.map(async (ta) => {
    const tarif = await getTarifNonSpp(ta.id, tahunMasuk)
    const tahunTagihan = inferTahunTagihan(ta)
    const categories = {
      BANGUNAN: {
        tarif: tarif.BANGUNAN,
        paid: bangunanPaid,
        sisa: Math.max(0, tarif.BANGUNAN - bangunanPaid),
      },
      KESEHATAN: { tarif: tarif.KESEHATAN, paid: 0, sisa: 0 },
      EHB: { tarif: tarif.EHB, paid: 0, sisa: 0 },
      EKSKUL: { tarif: tarif.EKSKUL, paid: 0, sisa: 0 },
    }

    JENIS_TAHUNAN.forEach((jenis) => {
      const paid = active
        .filter((p) => p.jenis_biaya === jenis && ((p.tahun_ajaran_id && p.tahun_ajaran_id === ta.id) || (!p.tahun_ajaran_id && p.tahun_tagihan === tahunTagihan)))
        .reduce((sum, p) => sum + toInt(p.nominal_bayar), 0)
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
    santri: { ...santri, tahun_masuk_fix: tahunMasuk },
    yearly,
    payments,
  }
}

export async function searchSantriNonSpp(keyword: string) {
  const like = `%${keyword.trim()}%`
  return query<SantriRow>(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
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

  return { tahunAjaran, cashFlow, targets, list }
}

export async function getNonSppReceipt(paymentId: string) {
  const receipt = await queryOne<PaymentRow & {
    sekolah: string | null
    kamar: string | null
    created_at: string | null
    penerima_nama: string | null
  }>(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.created_at,
           ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    WHERE p.id = ?
  `, [paymentId])
  if (!receipt) return { error: 'Transaksi tidak ditemukan.' }
  return { receipt }
}
