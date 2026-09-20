// lib/finance/bridge.ts
// Modul Coexistence Bridge Pembayaran Legacy ke Sistem Keuangan Baru
// Menjembatani pembayaran dari modul lama (spp_log, pembayaran_tahunan, spp_tunggakan_historis)
// ke modul keuangan baru (finance_payments, finance_allocations, finance_obligations).

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { recordCorrection } from '@/lib/finance/corrections'
import { getPaymentByExternalReference } from '@/lib/finance/payments'
import type { FinanceItemType, FinanceObligation } from '@/lib/finance/types'

export type LegacySourceType = 'SPP_LOG' | 'PEMBAYARAN_TAHUNAN' | 'SPP_TUNGGAKAN_HISTORIS'

export interface LegacyCandidateItem {
  source: LegacySourceType
  sourceId: string
  santriId: string
  santriName?: string
  santriNis?: string
  itemType: string
  period: string
  amount: number
  paidAt: string
  isAlreadySynced: boolean
  isExcluded: boolean
  exclusionReason?: string
  targetPaymentId?: string
}

export interface LegacyItemTypeSummary {
  count: number
  amount: number
  toSyncCount: number
  toSyncAmount: number
}

export interface LegacySyncPreviewSummary {
  totalLegacyRecords: number
  totalLegacyAmount: number
  alreadySyncedCount: number
  alreadySyncedAmount: number
  toSyncCount: number
  toSyncAmount: number
  excludedCount: number
  excludedAmount: number
  byItemType: Record<string, LegacyItemTypeSummary>
  sampleCandidates: LegacyCandidateItem[]
}

export interface LegacySyncResult {
  success: boolean
  source: LegacySourceType
  sourceId: string
  paymentId?: string
  paymentNumber?: string
  status: 'ALREADY_SYNCED' | 'SYNCED' | 'EXCLUDED' | 'ERROR'
  message?: string
}

export interface LegacyBackfillReport {
  processed: number
  synced: number
  alreadySynced: number
  excluded: number
  failed: number
  errors: Array<{ source: LegacySourceType; sourceId: string; error: string }>
}

function generatePaymentNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PAY-${datePart}-${randomSuffix}`
}

export function buildLegacyExternalReference(source: LegacySourceType, id: string | number): string {
  return `LEGACY_${source}:${id}`
}

/**
 * Melakukan pratinjau dry-run agregasi data pembayaran modul lama
 * yang memenuhi syarat atau sudah tersinkronisasi ke Sistem Keuangan Baru.
 */
export async function previewLegacySync(): Promise<LegacySyncPreviewSummary> {
  const summary: LegacySyncPreviewSummary = {
    totalLegacyRecords: 0,
    totalLegacyAmount: 0,
    alreadySyncedCount: 0,
    alreadySyncedAmount: 0,
    toSyncCount: 0,
    toSyncAmount: 0,
    excludedCount: 0,
    excludedAmount: 0,
    byItemType: {
      SPP: { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 },
      USPP: { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 },
      EHB: { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 },
      EKSKUL: { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 },
      KESEHATAN: { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 },
    },
    sampleCandidates: [],
  }

  // Helper untuk update byItemType
  const trackItem = (itemType: string, amount: number, isSynced: boolean, isExcluded: boolean) => {
    if (!summary.byItemType[itemType]) {
      summary.byItemType[itemType] = { count: 0, amount: 0, toSyncCount: 0, toSyncAmount: 0 }
    }
    summary.byItemType[itemType].count++
    summary.byItemType[itemType].amount += amount
    if (!isSynced && !isExcluded) {
      summary.byItemType[itemType].toSyncCount++
      summary.byItemType[itemType].toSyncAmount += amount
    }
  }

  // 1. Audit spp_log
  try {
    const sppLogs = await query<{
      id: string
      santri_id: string
      bulan: number
      tahun: number
      nominal_bayar: number
      tanggal_bayar: string
      nama_lengkap: string | null
      nis: string | null
      existing_payment_id: string | null
    }>(
      `SELECT sl.id, sl.santri_id, sl.bulan, sl.tahun, sl.nominal_bayar, sl.tanggal_bayar,
              s.nama_lengkap, s.nis,
              fp.id AS existing_payment_id
       FROM spp_log sl
       LEFT JOIN santri s ON s.id = sl.santri_id
       LEFT JOIN finance_payments fp ON fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_SPP_LOG:' || sl.id)`
    )

    for (const row of sppLogs) {
      summary.totalLegacyRecords++
      summary.totalLegacyAmount += row.nominal_bayar

      const isSynced = Boolean(row.existing_payment_id)
      const isExcluded = row.nominal_bayar <= 0
      const period = `${row.tahun}-${String(row.bulan).padStart(2, '0')}`

      if (isSynced) {
        summary.alreadySyncedCount++
        summary.alreadySyncedAmount += row.nominal_bayar
      } else if (isExcluded) {
        summary.excludedCount++
        summary.excludedAmount += row.nominal_bayar
      } else {
        summary.toSyncCount++
        summary.toSyncAmount += row.nominal_bayar
      }

      trackItem('SPP', row.nominal_bayar, isSynced, isExcluded)

      if (summary.sampleCandidates.length < 15) {
        summary.sampleCandidates.push({
          source: 'SPP_LOG',
          sourceId: row.id,
          santriId: row.santri_id,
          santriName: row.nama_lengkap || undefined,
          santriNis: row.nis || undefined,
          itemType: 'SPP',
          period,
          amount: row.nominal_bayar,
          paidAt: row.tanggal_bayar,
          isAlreadySynced: isSynced,
          isExcluded,
          exclusionReason: isExcluded ? 'Nominal <= 0' : undefined,
          targetPaymentId: row.existing_payment_id || undefined,
        })
      }
    }
  } catch (err) {
    console.error('[LegacyBridge] Failed to read spp_log candidates', err)
  }

  // 2. Audit pembayaran_tahunan
  try {
    const tahunanLogs = await query<{
      id: string
      santri_id: string
      jenis_biaya: string
      tahun_tagihan: number | null
      nominal_bayar: number
      tanggal_bayar: string
      status: string | null
      nama_lengkap: string | null
      nis: string | null
      tahun_ajaran_nama: string | null
      existing_payment_id: string | null
    }>(
      `SELECT pt.id, pt.santri_id, pt.jenis_biaya, pt.tahun_tagihan, pt.nominal_bayar, pt.tanggal_bayar, pt.status,
              s.nama_lengkap, s.nis,
              ta.nama AS tahun_ajaran_nama,
              fp.id AS existing_payment_id
       FROM pembayaran_tahunan pt
       LEFT JOIN santri s ON s.id = pt.santri_id
       LEFT JOIN tahun_ajaran ta ON ta.id = pt.tahun_ajaran_id
       LEFT JOIN finance_payments fp ON fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_PEMBAYARAN_TAHUNAN:' || pt.id)`
    )

    for (const row of tahunanLogs) {
      summary.totalLegacyRecords++
      summary.totalLegacyAmount += row.nominal_bayar

      let mappedItemType = row.jenis_biaya
      let period = '2026'
      if (row.jenis_biaya === 'BANGUNAN') {
        mappedItemType = 'USPP'
        period = 'LIFETIME'
      } else {
        period = row.tahun_tagihan
          ? String(row.tahun_tagihan)
          : row.tahun_ajaran_nama
          ? row.tahun_ajaran_nama.slice(0, 4)
          : (row.tanggal_bayar || '2026').slice(0, 4)
      }

      const isVoid = row.status === 'VOID'
      const isUnmapped = !['USPP', 'EHB', 'EKSKUL', 'KESEHATAN'].includes(mappedItemType)
      const isZero = row.nominal_bayar <= 0
      const isExcluded = isVoid || isUnmapped || isZero
      let exclusionReason: string | undefined
      if (isVoid) exclusionReason = 'Status VOID pada modul lama'
      else if (isUnmapped) exclusionReason = `Jenis biaya tidak terpetakan (${row.jenis_biaya})`
      else if (isZero) exclusionReason = 'Nominal bayar <= 0'

      const isSynced = Boolean(row.existing_payment_id)

      if (isSynced) {
        summary.alreadySyncedCount++
        summary.alreadySyncedAmount += row.nominal_bayar
      } else if (isExcluded) {
        summary.excludedCount++
        summary.excludedAmount += row.nominal_bayar
      } else {
        summary.toSyncCount++
        summary.toSyncAmount += row.nominal_bayar
      }

      trackItem(mappedItemType, row.nominal_bayar, isSynced, isExcluded)

      if (summary.sampleCandidates.length < 30) {
        summary.sampleCandidates.push({
          source: 'PEMBAYARAN_TAHUNAN',
          sourceId: row.id,
          santriId: row.santri_id,
          santriName: row.nama_lengkap || undefined,
          santriNis: row.nis || undefined,
          itemType: mappedItemType,
          period,
          amount: row.nominal_bayar,
          paidAt: row.tanggal_bayar,
          isAlreadySynced: isSynced,
          isExcluded,
          exclusionReason,
          targetPaymentId: row.existing_payment_id || undefined,
        })
      }
    }
  } catch (err) {
    console.error('[LegacyBridge] Failed to read pembayaran_tahunan candidates', err)
  }

  // 3. Audit spp_tunggakan_historis
  try {
    const tunggakanLogs = await query<{
      id: string
      santri_id: string
      bulan: number
      tahun: number
      nominal_tagihan: number
      tanggal_lunas: string | null
      status: string
      nama_lengkap: string | null
      nis: string | null
      existing_payment_id: string | null
    }>(
      `SELECT sth.id, sth.santri_id, sth.bulan, sth.tahun, sth.nominal_tagihan, sth.tanggal_lunas, sth.status,
              s.nama_lengkap, s.nis,
              fp.id AS existing_payment_id
       FROM spp_tunggakan_historis sth
       LEFT JOIN santri s ON s.id = sth.santri_id
       LEFT JOIN finance_payments fp ON fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_SPP_TUNGGAKAN_HISTORIS:' || sth.id)`
    )

    for (const row of tunggakanLogs) {
      summary.totalLegacyRecords++
      summary.totalLegacyAmount += row.nominal_tagihan

      const isSynced = Boolean(row.existing_payment_id)
      const isUnpaid = row.status !== 'LUNAS'
      const isZero = row.nominal_tagihan <= 0
      const isExcluded = isUnpaid || isZero
      let exclusionReason: string | undefined
      if (isUnpaid) exclusionReason = 'Status tunggakan belum LUNAS'
      else if (isZero) exclusionReason = 'Nominal tagihan <= 0'

      const period = `${row.tahun}-${String(row.bulan).padStart(2, '0')}`

      if (isSynced) {
        summary.alreadySyncedCount++
        summary.alreadySyncedAmount += row.nominal_tagihan
      } else if (isExcluded) {
        summary.excludedCount++
        summary.excludedAmount += row.nominal_tagihan
      } else {
        summary.toSyncCount++
        summary.toSyncAmount += row.nominal_tagihan
      }

      trackItem('SPP', row.nominal_tagihan, isSynced, isExcluded)

      if (summary.sampleCandidates.length < 40) {
        summary.sampleCandidates.push({
          source: 'SPP_TUNGGAKAN_HISTORIS',
          sourceId: row.id,
          santriId: row.santri_id,
          santriName: row.nama_lengkap || undefined,
          santriNis: row.nis || undefined,
          itemType: 'SPP',
          period,
          amount: row.nominal_tagihan,
          paidAt: row.tanggal_lunas || '',
          isAlreadySynced: isSynced,
          isExcluded,
          exclusionReason,
          targetPaymentId: row.existing_payment_id || undefined,
        })
      }
    }
  } catch (err) {
    console.error('[LegacyBridge] Failed to read spp_tunggakan_historis candidates', err)
  }

  return summary
}

/**
 * Internal dedicated historical obligation materializer for legacy coexistence bridge.
 * Contained strictly within bridge.ts to prevent legacy bypass from leaking into public ensureObligation.
 *
 * Invariant & Safety Rules:
 * 1. Idempotency: Checks existing finance_obligations record. If present, returns it directly.
 * 2. Inactive Student Bypass: Allows materializing historical obligations for inactive/graduated/archived
 *    santri without mutating their profile (santri.status_global remains untouched).
 * 3. Authoritative Billing Rules:
 *    - SPP: Authoritative expected nominal is Rp 70.000.
 *    - USPP (BANGUNAN): Authoritative nominal from biaya_settings for santri's angkatan (or default Rp 1.000.000).
 *    - EHB: Authoritative nominal from biaya_settings / standard (Rp 100.000).
 *    - EKSKUL: Authoritative nominal from biaya_settings / standard (Rp 50.000).
 *    - KESEHATAN: Authoritative nominal from biaya_settings / standard (Rp 200.000).
 * 4. Zero Debt Inflation: Initial amount_expected is set purely from authoritative tariff rules.
 *    It is NEVER modified to match incoming legacy payment amounts.
 * 5. Initial status: Starts with amount_paid = 0 and status = 'UNPAID'. Payments then allocate incrementally.
 */
async function materializeLegacyHistoricalObligation(
  santriId: string,
  itemType: FinanceItemType,
  period: string
): Promise<FinanceObligation> {
  // 1. Cek apakah record kewajiban sudah ada di database (Idempotent)
  const existing = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE santri_id = ? AND item_type = ? AND period = ?`,
    [santriId, itemType, period]
  )

  if (existing) {
    return existing
  }

  // 2. Ambil data santri existing (izinkan santri non-aktif/alumni/arsip untuk merekonstruksi histori)
  const santri = await queryOne<{
    id: string
    nama_lengkap: string
    status_global: string
    tahun_masuk: number | null
    created_at: string | null
  }>(
    `SELECT id, nama_lengkap, status_global, tahun_masuk, created_at
     FROM santri
     WHERE id = ?`,
    [santriId]
  )

  if (!santri) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }

  // 3. Tentukan academic_year_id yang sesuai
  let academicYearId: number | null = null
  if (itemType === 'SPP') {
    const parts = period.split('-')
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const taName = m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
    const ta = await queryOne<{ id: number }>(`SELECT id FROM tahun_ajaran WHERE nama = ? LIMIT 1`, [taName])
    academicYearId = ta ? ta.id : null
  } else if (itemType === 'USPP') {
    const activeTa = await queryOne<{ id: number }>(`SELECT id FROM tahun_ajaran WHERE status = 'Aktif' LIMIT 1`)
    academicYearId = activeTa ? activeTa.id : null
  } else {
    // EHB, EKSKUL, KESEHATAN (period = YYYY)
    const y = parseInt(period, 10)
    const taName = `${y}/${y + 1}`
    const ta = await queryOne<{ id: number }>(`SELECT id FROM tahun_ajaran WHERE nama = ? LIMIT 1`, [taName])
    academicYearId = ta ? ta.id : null
  }

  // 4. Resolusi tarif otoritatif (Authoritative Billing Rule)
  let amountExpected = 0
  let tariffId: string | null = null

  // Cek tabel finance_tariffs jika sudah terkonfigurasi
  const existingTariff = await queryOne<{ id: string; nominal: number }>(
    `SELECT id, nominal FROM finance_tariffs
     WHERE item_type = ? AND (academic_year_id = ? OR academic_year_id IS NULL)
     ORDER BY academic_year_id DESC, effective_from DESC LIMIT 1`,
    [itemType, academicYearId]
  )

  if (existingTariff && existingTariff.nominal > 0) {
    amountExpected = existingTariff.nominal
    tariffId = existingTariff.id
  } else {
    // Authoritative fallback dari biaya_settings / aturan resmi
    const angkatan = santri.tahun_masuk || (santri.created_at ? new Date(santri.created_at).getFullYear() : 2026)
    if (itemType === 'SPP') {
      amountExpected = 70000
      tariffId = 'trf-spp-bridge-fallback'
    } else if (itemType === 'USPP') {
      const bs = await queryOne<{ nominal: number }>(
        `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'BANGUNAN' AND (tahun_angkatan = ? OR tahun_angkatan IS NULL) ORDER BY tahun_angkatan DESC LIMIT 1`,
        [angkatan]
      )
      amountExpected = bs?.nominal && bs.nominal > 0 ? bs.nominal : 1000000
      tariffId = 'trf-uspp-bridge-fallback'
    } else if (itemType === 'EHB') {
      const bs = await queryOne<{ nominal: number }>(
        `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'EHB' AND (tahun_angkatan = ? OR tahun_angkatan IS NULL) ORDER BY tahun_angkatan DESC LIMIT 1`,
        [angkatan]
      )
      amountExpected = bs?.nominal && bs.nominal > 0 ? bs.nominal : 100000
      tariffId = 'trf-ehb-bridge-fallback'
    } else if (itemType === 'EKSKUL') {
      const bs = await queryOne<{ nominal: number }>(
        `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'EKSKUL' AND (tahun_angkatan = ? OR tahun_angkatan IS NULL) ORDER BY tahun_angkatan DESC LIMIT 1`,
        [angkatan]
      )
      amountExpected = bs?.nominal && bs.nominal > 0 ? bs.nominal : 50000
      tariffId = 'trf-ekskul-bridge-fallback'
    } else if (itemType === 'KESEHATAN') {
      const bs = await queryOne<{ nominal: number }>(
        `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'KESEHATAN' AND (tahun_angkatan = ? OR tahun_angkatan IS NULL) ORDER BY tahun_angkatan DESC LIMIT 1`,
        [angkatan]
      )
      amountExpected = bs?.nominal && bs.nominal > 0 ? bs.nominal : 200000
      tariffId = 'trf-kesehatan-bridge-fallback'
    }
  }

  const id = generateId()
  const timestamp = now()

  // 5. Simpan kewajiban historis awal dengan amount_paid = 0 dan status = 'UNPAID'
  await query(
    `INSERT OR IGNORE INTO finance_obligations (
      id, santri_id, item_type, academic_year_id, period,
      tariff_id, amount_expected, amount_exempted, amount_paid,
      status, provider_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'UNPAID', NULL, ?, ?)`,
    [
      id,
      santriId,
      itemType,
      academicYearId,
      period,
      tariffId,
      amountExpected,
      timestamp,
      timestamp,
    ]
  )

  // 6. Ambil record kanonikal
  const canonical = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE santri_id = ? AND item_type = ? AND period = ?`,
    [santriId, itemType, period]
  )

  if (!canonical) {
    throw new Error(
      `Gagal membuat kewajiban historis legacy untuk santri "${santriId}", item "${itemType}", periode "${period}".`
    )
  }

  return canonical
}

/**
 * Mensinkronisasikan satu transaksi pembayaran modul lama ke Sistem Keuangan Baru
 * secara atomik dan idempotent.
 *
 * Aturan Finansial:
 * 1. Idempotensi ketat berbasis external_reference = 'LEGACY_<SOURCE>:<id>' & channel = 'CASH'.
 * 2. Asal transaksi: source = 'LEGACY'.
 * 3. Tata kelola dana: fund_management = 'PRE_KOPERASI' (immutable, tidak masuk kas laci Koperasi).
 * 4. Materialisasi kewajiban atomik via materializeLegacyHistoricalObligation (tanpa merusak santri.status_global).
 * 5. Headroom Overpayment Safety: amount_expected tetap kanonikal (tidak pernah di-inflate). Kelebihan bayar
 *    dialokasikan hingga sisa kewajiban, sisanya diamankan ke finance_reconciliation_items.
 * 6. Pencatatan log ke finance_legacy_sync_log.
 */
export async function syncLegacyPayment(
  source: LegacySourceType,
  id: string | number
): Promise<LegacySyncResult> {
  const strId = String(id).trim()
  const externalRef = buildLegacyExternalReference(source, strId)

  // 1. Idempotency Check: apakah sudah tersinkronisasi sebelumnya?
  const existingPayment = await getPaymentByExternalReference('CASH', externalRef)
  if (existingPayment) {
    return {
      success: true,
      source,
      sourceId: strId,
      paymentId: existingPayment.id,
      paymentNumber: existingPayment.payment_number,
      status: 'ALREADY_SYNCED',
      message: 'Pembayaran legacy sudah tercatat di Sistem Keuangan Baru sebelumnya.',
    }
  }

  // 2. Baca data mentah dari tabel sumber legacy
  let santriId = ''
  let itemType: FinanceItemType = 'SPP'
  let period = ''
  let amount = 0
  let paidAt = now()
  let receivedBy: string | null = null
  let method = 'TUNAI'

  if (source === 'SPP_LOG') {
    const row = await queryOne<{
      id: string
      santri_id: string
      bulan: number
      tahun: number
      nominal_bayar: number
      tanggal_bayar: string
      penerima_id: string | null
    }>(
      `SELECT id, santri_id, bulan, tahun, nominal_bayar, tanggal_bayar, penerima_id
       FROM spp_log WHERE id = ?`,
      [strId]
    )
    if (!row) {
      throw new Error(`Data spp_log dengan ID "${strId}" tidak ditemukan.`)
    }
    if (row.nominal_bayar <= 0) {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: 'Nominal pembayaran SPP legacy <= 0.',
      }
    }
    santriId = row.santri_id
    itemType = 'SPP'
    period = `${row.tahun}-${String(row.bulan).padStart(2, '0')}`
    amount = row.nominal_bayar
    paidAt = row.tanggal_bayar ? (row.tanggal_bayar.length === 10 ? `${row.tanggal_bayar} 12:00:00` : row.tanggal_bayar) : now()
    receivedBy = row.penerima_id
    method = 'TUNAI'
  } else if (source === 'PEMBAYARAN_TAHUNAN') {
    const row = await queryOne<{
      id: string
      santri_id: string
      jenis_biaya: string
      tahun_tagihan: number | null
      tahun_ajaran_id: number | null
      nominal_bayar: number
      tanggal_bayar: string
      penerima_id: string | null
      status: string | null
      keterangan: string | null
      receipt_metode: string | null
    }>(
      `SELECT pt.id, pt.santri_id, pt.jenis_biaya, pt.tahun_tagihan, pt.tahun_ajaran_id,
              pt.nominal_bayar, pt.tanggal_bayar, pt.penerima_id, pt.status, pt.keterangan,
              r.metode AS receipt_metode
       FROM pembayaran_tahunan pt
       LEFT JOIN psb_payment_receipt r ON r.id = pt.psb_receipt_id
       WHERE pt.id = ?`,
      [strId]
    )
    if (!row) {
      throw new Error(`Data pembayaran_tahunan dengan ID "${strId}" tidak ditemukan.`)
    }
    if (row.status === 'VOID') {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: 'Pembayaran berstatus VOID pada modul lama.',
      }
    }
    if (row.nominal_bayar <= 0) {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: 'Nominal pembayaran tahunan legacy <= 0.',
      }
    }

    santriId = row.santri_id
    amount = row.nominal_bayar
    paidAt = row.tanggal_bayar ? (row.tanggal_bayar.length === 10 ? `${row.tanggal_bayar} 12:00:00` : row.tanggal_bayar) : now()
    receivedBy = row.penerima_id

    const isTransfer =
      row.receipt_metode?.toUpperCase() === 'TRANSFER' ||
      /\b(transfer|tf)\b/i.test(row.keterangan || '')
    method = isTransfer ? 'TRANSFER' : 'TUNAI'

    if (row.jenis_biaya === 'BANGUNAN') {
      itemType = 'USPP'
      period = 'LIFETIME'
    } else if (row.jenis_biaya === 'EHB' || row.jenis_biaya === 'EKSKUL' || row.jenis_biaya === 'KESEHATAN') {
      itemType = row.jenis_biaya as FinanceItemType
      if (row.tahun_tagihan) {
        period = String(row.tahun_tagihan)
      } else if (row.tahun_ajaran_id) {
        const ta = await queryOne<{ nama: string }>(`SELECT nama FROM tahun_ajaran WHERE id = ?`, [row.tahun_ajaran_id])
        period = ta?.nama ? ta.nama.slice(0, 4) : '2026'
      } else {
        period = paidAt.slice(0, 4) || '2026'
      }
    } else {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: `Jenis biaya "${row.jenis_biaya}" tidak memiliki padanan di Sistem Keuangan Baru.`,
      }
    }
  } else if (source === 'SPP_TUNGGAKAN_HISTORIS') {
    const row = await queryOne<{
      id: string
      santri_id: string
      bulan: number
      tahun: number
      nominal_tagihan: number
      status: string
      tanggal_lunas: string | null
      penerima_id: string | null
      updated_at: string
    }>(
      `SELECT id, santri_id, bulan, tahun, nominal_tagihan, status, tanggal_lunas, penerima_id, updated_at
       FROM spp_tunggakan_historis WHERE id = ?`,
      [strId]
    )
    if (!row) {
      throw new Error(`Data spp_tunggakan_historis dengan ID "${strId}" tidak ditemukan.`)
    }
    if (row.status !== 'LUNAS') {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: 'Tunggakan historis belum berstatus LUNAS.',
      }
    }
    if (row.nominal_tagihan <= 0) {
      return {
        success: false,
        source,
        sourceId: strId,
        status: 'EXCLUDED',
        message: 'Nominal tunggakan historis <= 0.',
      }
    }
    santriId = row.santri_id
    itemType = 'SPP'
    period = `${row.tahun}-${String(row.bulan).padStart(2, '0')}`
    amount = row.nominal_tagihan
    paidAt = row.tanggal_lunas
      ? (row.tanggal_lunas.length === 10 ? `${row.tanggal_lunas} 12:00:00` : row.tanggal_lunas)
      : (row.updated_at || now())
    receivedBy = row.penerima_id
    method = 'TUNAI'
  }

  // 3. Pastikan kewajiban canonical (finance_obligations) tersedia secara atomik via internal materializer
  const obligation = await materializeLegacyHistoricalObligation(santriId, itemType, period)

  // 4. Hitung alokasi dan overpayment headroom secara kanonikal
  // Sisa kewajiban yang masih dapat dialokasikan:
  const remainingHeadroom = Math.max(0, obligation.amount_expected - obligation.amount_exempted - obligation.amount_paid)
  const allocatedAmount = Math.min(amount, remainingHeadroom)
  const unallocatedExcess = amount - allocatedAmount

  let allocationStatus: 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED' = 'ALLOCATED'
  if (unallocatedExcess > 0) {
    allocationStatus = allocatedAmount > 0 ? 'PARTIALLY_ALLOCATED' : 'UNALLOCATED'
  }

  // 5. Siapkan batch statements
  const paymentId = generateId()
  const paymentNumber = generatePaymentNumber()
  const syncLogId = generateId()
  const timestamp = now()

  const statements: Array<{ sql: string; params: unknown[] }> = [
    // a. Record finance_payments
    {
      sql: `
        INSERT INTO finance_payments (
          id, payment_number, order_id, santri_id, channel, method,
          gross_amount, gateway_fee, net_amount, status, correction_status,
          allocation_status, paid_at, external_reference, cash_session_id,
          received_by, source, fund_management, created_at
        ) VALUES (?, ?, NULL, ?, 'CASH', ?, ?, 0, ?, 'PAID', 'NONE', ?, ?, ?, NULL, ?, 'LEGACY', 'PRE_KOPERASI', ?)
      `,
      params: [
        paymentId,
        paymentNumber,
        santriId,
        method,
        amount,
        amount,
        allocationStatus,
        paidAt,
        externalRef,
        receivedBy,
        timestamp,
      ],
    },
  ]

  // b. Record finance_allocations & update finance_obligations HANYA jika ada alokasi > 0
  if (allocatedAmount > 0) {
    const allocationId = generateId()
    statements.push({
      sql: `
        INSERT INTO finance_allocations (
          id, payment_id, obligation_id, target_type, item_type,
          provider_id, amount, disbursed_amount, distribution_status, created_at
        ) VALUES (?, ?, ?, 'OBLIGATION', ?, ?, ?, 0, 'UNDISBURSED', ?)
      `,
      params: [
        allocationId,
        paymentId,
        obligation.id,
        itemType,
        obligation.provider_id || null,
        allocatedAmount,
        timestamp,
      ],
    })

    // Update finance_obligations: amount_expected TIDAK PERNAH diubah/di-inflate!
    statements.push({
      sql: `
        UPDATE finance_obligations
        SET amount_paid = amount_paid + ?,
            status = CASE
              WHEN (amount_paid + ?) >= MAX(0, amount_expected - amount_exempted) THEN 'PAID'
              WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
              ELSE 'UNPAID'
            END,
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        allocatedAmount,
        allocatedAmount,
        allocatedAmount,
        timestamp,
        obligation.id,
      ],
    })
  }

  // c. Jika terjadi overpayment (kelebihan bayar), rutekan sisa dana ke canonical finance_reconciliation_items
  if (unallocatedExcess > 0) {
    const reconciliationItemId = generateId()
    const matchStatus = allocatedAmount > 0 ? 'AMOUNT_MISMATCH' : 'UNALLOCATED_TRANSFER'
    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, reconciliation_id, payment_id, settlement_id, cash_session_id,
          external_reference, internal_amount, external_amount, discrepancy_amount,
          match_status, resolution_action, resolution_notes, resolved_by,
          resolved_at, created_at
        ) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, 'NONE', ?, NULL, NULL, ?)
      `,
      params: [
        reconciliationItemId,
        paymentId,
        externalRef,
        allocatedAmount,
        amount,
        unallocatedExcess,
        matchStatus,
        `Kelebihan pembayaran modul lama (${source}) sebesar Rp ${unallocatedExcess.toLocaleString('id-ID')} melebihi sisa kewajiban (${remainingHeadroom.toLocaleString('id-ID')}). Nilai kewajiban tetap kanonikal tanpa inflasi.`,
        timestamp,
      ],
    })
  }

  // d. Record finance_legacy_sync_log
  statements.push({
    sql: `
      INSERT INTO finance_legacy_sync_log (
        id, source, source_id, target_payment_id, sync_status, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'SUCCESS', NULL, ?, ?)
    `,
    params: [
      syncLogId,
      source,
      strId,
      paymentId,
      timestamp,
      timestamp,
    ],
  })

  // 6. Eksekusi batch dengan idempotensi fallback jika race condition terjadi
  try {
    await batch(statements)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (
      errMsg.includes('uq_finance_payments_channel_ext_ref') ||
      (errMsg.includes('UNIQUE') && (errMsg.includes('external_reference') || errMsg.includes('channel')))
    ) {
      const fallbackExisting = await getPaymentByExternalReference('CASH', externalRef)
      if (fallbackExisting) {
        return {
          success: true,
          source,
          sourceId: strId,
          paymentId: fallbackExisting.id,
          paymentNumber: fallbackExisting.payment_number,
          status: 'ALREADY_SYNCED',
        }
      }
    }
    // Catat log kegagalan jika batch error
    await query(
      `INSERT INTO finance_legacy_sync_log (id, source, source_id, target_payment_id, sync_status, error_message, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'FAILED', ?, ?, ?)`,
      [generateId(), source, strId, errMsg, timestamp, timestamp]
    ).catch(() => null)
    throw err
  }

  return {
    success: true,
    source,
    sourceId: strId,
    paymentId,
    paymentNumber,
    status: 'SYNCED',
  }
}

/**
 * Membatalkan/mereverse pembayaran legacy di Sistem Keuangan Baru secara non-destruktif.
 * Dipanggil saat terjadi pembatalan (void/delete) pada modul lama.
 */
export async function syncLegacyPaymentReversal(
  source: LegacySourceType,
  id: string | number,
  reason: string,
  actorId?: string
): Promise<void> {
  const strId = String(id).trim()
  const externalRef = buildLegacyExternalReference(source, strId)

  // 1. Cari pembayaran di Sistem Keuangan Baru
  const payment = await getPaymentByExternalReference('CASH', externalRef)
  if (!payment) {
    // Belum pernah disinkronkan ke sistem baru, tidak ada yang perlu direverse
    return
  }

  if (payment.correction_status === 'FULLY_CORRECTED') {
    return
  }

  // 2. Eksekusi VOID non-destruktif via recordCorrection
  if (payment.allocations && payment.allocations.length > 0) {
    await recordCorrection({
      paymentId: payment.id,
      correctionType: 'VOID',
      reason: reason || `Pembalikkan otomatis transaksi modul lama (${source})`,
      createdBy: actorId || 'SYSTEM_LEGACY_BRIDGE',
      approvedBy: actorId || null,
      items: payment.allocations.map((a) => ({
        allocationId: a.id,
        amount: a.amount,
      })),
    })
  }

  // 3. Batalkan rekonsiliasi yang belum terselesaikan untuk pembayaran ini
  await query(
    `UPDATE finance_reconciliation_items
     SET resolution_action = 'VOID_RECORDED',
         resolution_notes = COALESCE(resolution_notes || '; ', '') || 'Pembalikan otomatis transaksi modul lama',
         resolved_at = ?
     WHERE payment_id = ? AND resolution_action = 'NONE'`,
    [now(), payment.id]
  ).catch(() => null)

  // 4. Perbarui status di finance_legacy_sync_log
  await query(
    `UPDATE finance_legacy_sync_log
     SET sync_status = 'VOIDED', updated_at = ?
     WHERE target_payment_id = ?`,
    [now(), payment.id]
  ).catch(() => null)
}

/**
 * Eksekutor batch backfill untuk menyinkronkan seluruh riwayat pembayaran legacy
 * yang belum masuk ke Sistem Keuangan Baru secara aman.
 */
export async function executeBackfillLegacyPayments(options?: {
  limit?: number
  source?: LegacySourceType
}): Promise<LegacyBackfillReport> {
  const report: LegacyBackfillReport = {
    processed: 0,
    synced: 0,
    alreadySynced: 0,
    excluded: 0,
    failed: 0,
    errors: [],
  }

  const maxLimit = options?.limit || 500

  // 1. Ambil kandidat spp_log
  if (!options?.source || options.source === 'SPP_LOG') {
    const sppRows = await query<{ id: string }>(
      `SELECT sl.id
       FROM spp_log sl
       WHERE NOT EXISTS (
         SELECT 1 FROM finance_payments fp
         WHERE fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_SPP_LOG:' || sl.id)
       )
       LIMIT ?`,
      [maxLimit - report.processed]
    )

    for (const r of sppRows) {
      report.processed++
      try {
        const res = await syncLegacyPayment('SPP_LOG', r.id)
        if (res.status === 'SYNCED') report.synced++
        else if (res.status === 'ALREADY_SYNCED') report.alreadySynced++
        else if (res.status === 'EXCLUDED') report.excluded++
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        report.failed++
        report.errors.push({ source: 'SPP_LOG', sourceId: r.id, error: errMsg })
      }
    }
  }

  // 2. Ambil kandidat pembayaran_tahunan
  if (report.processed < maxLimit && (!options?.source || options.source === 'PEMBAYARAN_TAHUNAN')) {
    const tahRows = await query<{ id: string }>(
      `SELECT pt.id
       FROM pembayaran_tahunan pt
       WHERE COALESCE(pt.status, 'AKTIF') != 'VOID'
         AND NOT EXISTS (
           SELECT 1 FROM finance_payments fp
           WHERE fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_PEMBAYARAN_TAHUNAN:' || pt.id)
         )
       LIMIT ?`,
      [maxLimit - report.processed]
    )

    for (const r of tahRows) {
      report.processed++
      try {
        const res = await syncLegacyPayment('PEMBAYARAN_TAHUNAN', r.id)
        if (res.status === 'SYNCED') report.synced++
        else if (res.status === 'ALREADY_SYNCED') report.alreadySynced++
        else if (res.status === 'EXCLUDED') report.excluded++
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        report.failed++
        report.errors.push({ source: 'PEMBAYARAN_TAHUNAN', sourceId: r.id, error: errMsg })
      }
    }
  }

  // 3. Ambil kandidat spp_tunggakan_historis
  if (report.processed < maxLimit && (!options?.source || options.source === 'SPP_TUNGGAKAN_HISTORIS')) {
    const sthRows = await query<{ id: string }>(
      `SELECT sth.id
       FROM spp_tunggakan_historis sth
       WHERE sth.status = 'LUNAS'
         AND NOT EXISTS (
           SELECT 1 FROM finance_payments fp
           WHERE fp.channel = 'CASH' AND fp.external_reference = ('LEGACY_SPP_TUNGGAKAN_HISTORIS:' || sth.id)
         )
       LIMIT ?`,
      [maxLimit - report.processed]
    )

    for (const r of sthRows) {
      report.processed++
      try {
        const res = await syncLegacyPayment('SPP_TUNGGAKAN_HISTORIS', r.id)
        if (res.status === 'SYNCED') report.synced++
        else if (res.status === 'ALREADY_SYNCED') report.alreadySynced++
        else if (res.status === 'EXCLUDED') report.excluded++
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        report.failed++
        report.errors.push({ source: 'SPP_TUNGGAKAN_HISTORIS', sourceId: r.id, error: errMsg })
      }
    }
  }

  return report
}
