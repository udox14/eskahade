'use server'

import { assertFeature } from '@/lib/auth/feature'
import { execute, getDB, query } from '@/lib/db'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'
import { getNominalSppForYear } from '@/lib/spp/tunggakan'

const PATH = '/dashboard/psb/laporan-keuangan'
const SPP_JULI_BULAN = 7
const JENIS_NON_SPP = ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL'] as const
const JENIS_ALL = [...JENIS_NON_SPP, 'SPP_JULI'] as const
const STATUS_ORDER = ['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PAID', 'PLACED_KAMAR', 'DONE'] as const

type JenisBiaya = (typeof JENIS_ALL)[number]
type PsbStatus = (typeof STATUS_ORDER)[number]

export type PsbFinancialFilters = {
  q?: string
  tahunTagihan?: number
  tanggalMulai?: string
  tanggalSelesai?: string
  asrama?: string
  sekolah?: string
  jenisKelamin?: string
  statusPsb?: string
  statusPembayaran?: string
  jenisBiaya?: string
  metode?: string
  penerimaId?: string
  receiptNo?: string
  hanyaPiutang?: boolean
}

type SantriRow = {
  id: string
  nis: string | null
  nama_lengkap: string
  jenis_kelamin: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  asrama: string | null
  kamar: string | null
  tahun_masuk: number | null
  tanggal_masuk: string | null
  created_at: string | null
  kategori_efektif: string
  psb_status: string | null
  verified_at: string | null
  placed_asrama_at: string | null
  paid_at: string | null
  placed_kamar_at: string | null
  done_at: string | null
  payment_note: string | null
}

type PaymentRow = {
  id: string
  santri_id: string
  jenis_biaya: JenisBiaya
  tahun_tagihan: number | null
  nominal_bayar: number
  tanggal_bayar: string | null
  keterangan: string | null
  receipt_id: string | null
  receipt_no: string | null
  receipt_total: number | null
  receipt_created_at: string | null
  metode: string | null
  penerima_id: string | null
  penerima_nama: string | null
}

type BiayaSummary = {
  target: number
  terbayar: number
  sisa: number
}

let schemaReady: Promise<void> | null = null

async function ensureReportSchema() {
  if (!schemaReady) {
    schemaReady = ensureReportSchemaOnce().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

async function ensureReportSchemaOnce() {
  const paymentColumns = await query<{ name: string }>('PRAGMA table_info(pembayaran_tahunan)')
  if (!paymentColumns.some((col) => col.name === 'psb_receipt_id')) {
    await execute('ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)')
  }

  const sppColumns = await query<{ name: string }>('PRAGMA table_info(spp_log)')
  if (!sppColumns.some((col) => col.name === 'psb_receipt_id')) {
    await execute('ALTER TABLE spp_log ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)')
  }

  const receiptColumns = await query<{ name: string }>('PRAGMA table_info(psb_payment_receipt)')
  if (!receiptColumns.some((col) => col.name === 'is_void')) {
    await execute('ALTER TABLE psb_payment_receipt ADD COLUMN is_void INTEGER NOT NULL DEFAULT 0')
    await execute('ALTER TABLE psb_payment_receipt ADD COLUMN void_reason TEXT')
    await execute('ALTER TABLE psb_payment_receipt ADD COLUMN voided_by TEXT')
    await execute('ALTER TABLE psb_payment_receipt ADD COLUMN voided_at TEXT')
  }
  if (!receiptColumns.some((col) => col.name === 'metode')) {
    await execute("ALTER TABLE psb_payment_receipt ADD COLUMN metode TEXT NOT NULL DEFAULT 'TUNAI'")
  }

  const db = await getDB()
  await db.batch([
    db.prepare('CREATE INDEX IF NOT EXISTS idx_psb_receipt_santri ON psb_payment_receipt(santri_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_pembayaran_tahunan_psb_receipt ON pembayaran_tahunan(psb_receipt_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_spp_log_santri_tahun_bulan ON spp_log(santri_id, tahun, bulan)'),
  ])
}

function toInt(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStatus(status: string | null | undefined): PsbStatus {
  return STATUS_ORDER.includes(status as PsbStatus) ? status as PsbStatus : 'VERIFICATION'
}

function normalizeDate(value: unknown) {
  const text = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function effectiveYear(row: Pick<SantriRow, 'tahun_masuk' | 'tanggal_masuk' | 'created_at'>) {
  if (row.tahun_masuk) return Number(row.tahun_masuk)
  const tanggalMasukYear = Number(String(row.tanggal_masuk ?? '').slice(0, 4))
  if (Number.isFinite(tanggalMasukYear) && tanggalMasukYear > 0) return tanggalMasukYear
  const createdYear = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear()
  return Number.isFinite(createdYear) ? createdYear : new Date().getFullYear()
}

function emptyBiaya(): Record<JenisBiaya, BiayaSummary> {
  return {
    BANGUNAN: { target: 0, terbayar: 0, sisa: 0 },
    KESEHATAN: { target: 0, terbayar: 0, sisa: 0 },
    EHB: { target: 0, terbayar: 0, sisa: 0 },
    EKSKUL: { target: 0, terbayar: 0, sisa: 0 },
    SPP_JULI: { target: 0, terbayar: 0, sisa: 0 },
  }
}

function paymentStatus(totalTarget: number, totalTerbayar: number, totalSisa: number) {
  if (totalTarget <= 0 && totalTerbayar <= 0) return 'TANPA_TAGIHAN'
  if (totalSisa <= 0 && totalTarget > 0) return 'LUNAS'
  if (totalTerbayar > 0) return 'CICIL'
  return 'BELUM_BAYAR'
}

function matchesText(value: string | null | undefined, needle: string) {
  return String(value ?? '').toLowerCase().includes(needle)
}

function latestPayment(payments: PaymentRow[]) {
  return [...payments].sort((a, b) => {
    const dateCompare = String(b.tanggal_bayar ?? b.receipt_created_at ?? '').localeCompare(String(a.tanggal_bayar ?? a.receipt_created_at ?? ''))
    if (dateCompare !== 0) return dateCompare
    return String(b.id).localeCompare(String(a.id))
  })[0] ?? null
}

function buildNotes(payments: PaymentRow[], fallback: string | null) {
  const notes = payments.map((p) => p.keterangan).filter(Boolean) as string[]
  if (fallback) notes.push(fallback)
  return Array.from(new Set(notes)).join('; ')
}

export async function getPsbFinancialReport(filters: PsbFinancialFilters = {}) {
  const access = await assertFeature(PATH)
  if ('error' in access) return access
  await ensureReportSchema()

  const tahunTagihan = Number(filters.tahunTagihan) || new Date().getFullYear()
  const tanggalMulai = normalizeDate(filters.tanggalMulai)
  const tanggalSelesai = normalizeDate(filters.tanggalSelesai)
  const kategoriSql = getKategoriSantriEfektifSql('s')
  const baseWhere = `
    s.status_global = 'aktif'
    AND ((${kategoriSql}) = 'BARU' OR pf.id IS NOT NULL)
    AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
  `

  const santriRows = await query<SantriRow>(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           ${kategoriSql} AS kategori_efektif,
           COALESCE(pf.status, 'VERIFICATION') AS psb_status,
           pf.verified_at, pf.placed_asrama_at, pf.paid_at, pf.placed_kamar_at, pf.done_at,
           pf.payment_note
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE ${baseWhere}
    ORDER BY s.nama_lengkap
  `)

  const nonSppPayments = await query<PaymentRow>(`
    SELECT p.id, p.santri_id, p.jenis_biaya, p.tahun_tagihan, p.nominal_bayar, p.tanggal_bayar,
           p.keterangan, r.id AS receipt_id, r.receipt_no, r.total AS receipt_total,
           r.created_at AS receipt_created_at, r.metode, u.id AS penerima_id, u.full_name AS penerima_nama
    FROM pembayaran_tahunan p
    JOIN psb_payment_receipt r ON r.id = p.psb_receipt_id
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    LEFT JOIN users u ON u.id = p.penerima_id
    WHERE ${baseWhere}
      AND p.psb_receipt_id IS NOT NULL
      AND COALESCE(p.status, 'AKTIF') != 'VOID'
      AND COALESCE(r.is_void, 0) = 0
      AND p.jenis_biaya IN ('BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL')
  `)

  const sppPayments = await query<PaymentRow>(`
    SELECT sl.id, sl.santri_id, 'SPP_JULI' AS jenis_biaya, sl.tahun AS tahun_tagihan,
           sl.nominal_bayar, sl.tanggal_bayar, sl.keterangan,
           r.id AS receipt_id, r.receipt_no, r.total AS receipt_total,
           r.created_at AS receipt_created_at, r.metode, u.id AS penerima_id, u.full_name AS penerima_nama
    FROM spp_log sl
    JOIN psb_payment_receipt r ON r.id = sl.psb_receipt_id
    JOIN santri s ON s.id = sl.santri_id
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    LEFT JOIN users u ON u.id = sl.penerima_id
    WHERE ${baseWhere}
      AND sl.psb_receipt_id IS NOT NULL
      AND COALESCE(r.is_void, 0) = 0
      AND sl.bulan = ?
  `, [SPP_JULI_BULAN])

  const tarifRows = await query<{ tahun_angkatan: number; jenis_biaya: JenisBiaya; nominal: number; source_rank: number }>(`
    SELECT tahun_angkatan, jenis_biaya, nominal,
           CASE WHEN tahun_ajaran_id IS NULL THEN 0 ELSE 1 END AS source_rank
    FROM biaya_settings
    WHERE jenis_biaya IN ('BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL')
    ORDER BY source_rank ASC, id DESC
  `)
  const tarifMap = new Map<string, number>()
  tarifRows.forEach((row) => {
    const key = `${row.tahun_angkatan}:${row.jenis_biaya}`
    if (!tarifMap.has(key)) tarifMap.set(key, toInt(row.nominal))
  })
  const sppJuliTarif = await getNominalSppForYear(tahunTagihan)

  const paymentsBySantri = new Map<string, PaymentRow[]>()
  ;([...nonSppPayments, ...sppPayments] as PaymentRow[]).forEach((payment) => {
    if (!paymentsBySantri.has(payment.santri_id)) paymentsBySantri.set(payment.santri_id, [])
    paymentsBySantri.get(payment.santri_id)!.push(payment)
  })

  const rows = santriRows.map((santri) => {
    const tahunMasuk = effectiveYear(santri)
    const payments = paymentsBySantri.get(santri.id) ?? []
    const biaya = emptyBiaya()

    JENIS_NON_SPP.forEach((jenis) => {
      biaya[jenis].target = tarifMap.get(`${tahunMasuk}:${jenis}`) ?? 0
    })
    biaya.SPP_JULI.target = sppJuliTarif

    payments
      .filter((payment) => payment.jenis_biaya === 'BANGUNAN' || Number(payment.tahun_tagihan) === tahunTagihan)
      .forEach((payment) => {
        biaya[payment.jenis_biaya].terbayar += toInt(payment.nominal_bayar)
      })

    JENIS_ALL.forEach((jenis) => {
      biaya[jenis].sisa = Math.max(0, biaya[jenis].target - biaya[jenis].terbayar)
    })

    const totalTarget = JENIS_ALL.reduce((sum, jenis) => sum + biaya[jenis].target, 0)
    const totalTerbayar = JENIS_ALL.reduce((sum, jenis) => sum + biaya[jenis].terbayar, 0)
    const totalSisa = JENIS_ALL.reduce((sum, jenis) => sum + biaya[jenis].sisa, 0)
    const latest = latestPayment(payments)
    const receiptNos = Array.from(new Set(payments.map((p) => p.receipt_no).filter(Boolean) as string[]))
    const penerima = Array.from(new Set(payments.map((p) => p.penerima_nama).filter(Boolean) as string[]))

    return {
      id: santri.id,
      nis: santri.nis,
      nama_lengkap: santri.nama_lengkap,
      jenis_kelamin: santri.jenis_kelamin,
      sekolah: santri.sekolah,
      kelas_sekolah: santri.kelas_sekolah,
      asrama: santri.asrama,
      kamar: santri.kamar,
      tahun_masuk: tahunMasuk,
      kategori_efektif: santri.kategori_efektif,
      status_psb: normalizeStatus(santri.psb_status),
      verified_at: santri.verified_at,
      placed_asrama_at: santri.placed_asrama_at,
      paid_at: santri.paid_at,
      placed_kamar_at: santri.placed_kamar_at,
      done_at: santri.done_at,
      receipt_no_terakhir: latest?.receipt_no ?? null,
      receipt_no_list: receiptNos.join(', '),
      metode_terakhir: latest?.metode ?? null,
      penerima_terakhir: latest?.penerima_nama ?? null,
      penerima_list: penerima.join(', '),
      tanggal_bayar_terakhir: latest?.tanggal_bayar ?? latest?.receipt_created_at ?? null,
      biaya,
      total_target: totalTarget,
      total_terbayar: totalTerbayar,
      total_sisa: totalSisa,
      status_pembayaran: paymentStatus(totalTarget, totalTerbayar, totalSisa),
      catatan: buildNotes(payments, santri.payment_note),
      transactions: payments,
    }
  })

  const q = String(filters.q ?? '').trim().toLowerCase()
  const receiptNo = String(filters.receiptNo ?? '').trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    if (q && !matchesText(row.nama_lengkap, q) && !matchesText(row.nis, q)) return false
    if (filters.asrama && row.asrama !== filters.asrama) return false
    if (filters.sekolah && row.sekolah !== filters.sekolah) return false
    if (filters.jenisKelamin && row.jenis_kelamin !== filters.jenisKelamin) return false
    if (filters.statusPsb && row.status_psb !== filters.statusPsb) return false
    if (filters.statusPembayaran && row.status_pembayaran !== filters.statusPembayaran) return false
    if (filters.jenisBiaya && JENIS_ALL.includes(filters.jenisBiaya as JenisBiaya)) {
      const item = row.biaya[filters.jenisBiaya as JenisBiaya]
      if (item.target <= 0 && item.terbayar <= 0) return false
    }
    if (filters.metode && !row.transactions.some((t) => t.metode === filters.metode)) return false
    if (filters.penerimaId && !row.transactions.some((t) => t.penerima_id === filters.penerimaId)) return false
    if (receiptNo && !matchesText(row.receipt_no_list, receiptNo)) return false
    if (tanggalMulai && !row.transactions.some((t) => normalizeDate(t.tanggal_bayar ?? t.receipt_created_at) >= tanggalMulai)) return false
    if (tanggalSelesai && !row.transactions.some((t) => normalizeDate(t.tanggal_bayar ?? t.receipt_created_at) <= tanggalSelesai)) return false
    if (filters.hanyaPiutang && row.total_sisa <= 0) return false
    return true
  })

  const summary = {
    jumlahSantri: filteredRows.length,
    totalTarget: 0,
    totalTerbayar: 0,
    totalSisa: 0,
    byJenis: emptyBiaya(),
    byStatusPembayaran: {
      LUNAS: 0,
      CICIL: 0,
      BELUM_BAYAR: 0,
      TANPA_TAGIHAN: 0,
    },
  }
  filteredRows.forEach((row) => {
    summary.totalTarget += row.total_target
    summary.totalTerbayar += row.total_terbayar
    summary.totalSisa += row.total_sisa
    summary.byStatusPembayaran[row.status_pembayaran as keyof typeof summary.byStatusPembayaran] += 1
    JENIS_ALL.forEach((jenis) => {
      summary.byJenis[jenis].target += row.biaya[jenis].target
      summary.byJenis[jenis].terbayar += row.biaya[jenis].terbayar
      summary.byJenis[jenis].sisa += row.biaya[jenis].sisa
    })
  })

  const allTransactions = filteredRows.flatMap((row) => row.transactions.map((trx) => ({
    ...trx,
    nama_lengkap: row.nama_lengkap,
    nis: row.nis,
    asrama: row.asrama,
  })))

  const filterOptions = {
    asrama: Array.from(new Set(santriRows.map((row) => row.asrama).filter(Boolean) as string[])).sort(),
    sekolah: Array.from(new Set(santriRows.map((row) => row.sekolah).filter(Boolean) as string[])).sort(),
    penerima: Array.from(new Map(
      [...nonSppPayments, ...sppPayments]
        .filter((payment) => payment.penerima_id && payment.penerima_nama)
        .map((payment) => [payment.penerima_id!, { id: payment.penerima_id!, nama: payment.penerima_nama! }])
    ).values()).sort((a, b) => a.nama.localeCompare(b.nama, 'id-ID')),
  }

  return {
    tahunTagihan,
    summary,
    rows: filteredRows,
    transactions: allTransactions,
    filterOptions,
  }
}
