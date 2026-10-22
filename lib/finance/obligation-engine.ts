import type { BillingStore } from './billing-store'
import { createTariffReader } from './tariff-reader'
import { createLegacyReader } from './legacy-reader'
import { computeObligationStatus } from './types'
import type { FinanceObligation, FinanceItemType, EnsureObligationOptions, FinanceExemption } from './types'
import { assertSantriBillable, assertSantriBillableUntukItem } from './non-billable-santri'
import { rupiah } from './money'

export function createObligationEngine(store: BillingStore) {
  const { queryOne, execute } = store
  const generateId = () => crypto.randomUUID()
  const now = () => new Date().toISOString()
  const { getActiveTariff } = createTariffReader(store,true)
  const { checkLegacySettlement, checkLegacyUsppStatus } = createLegacyReader(store,true)
  async function checkExemption(
    santriId: string,
    itemType: FinanceItemType,
    period: string,
    academicYearId?: number | null
  ): Promise<FinanceExemption | null> {
    let sql = `
      SELECT id, santri_id, item_type, academic_year_id,
             period_start, period_end, reason, notes,
             status, revoked_at, revoked_by, revocation_reason,
             created_by, created_at
      FROM finance_exemptions
      WHERE santri_id = ?
        AND status = 'ACTIVE'
        AND (item_type = ? OR item_type = 'ALL')
        AND (period_start IS NULL OR period_start <= ?)
        AND (period_end IS NULL OR period_end >= ?)
    `
    const params: unknown[] = [santriId, itemType, period, period]

    if (academicYearId) {
      sql += ` AND (academic_year_id = ? OR academic_year_id IS NULL)`
      params.push(academicYearId)
    }

    sql += `
      ORDER BY (CASE WHEN item_type = ? THEN 1 ELSE 0 END) DESC,
               created_at DESC
      LIMIT 1
    `
    params.push(itemType)

    return queryOne<FinanceExemption>(sql, params)
  }

  interface SantriSnapshotRow {
    id: string
    nama_lengkap: string
    status_global: string
    asrama: string | null
    kategori_santri: string | null
    tempat_makan_id: string | null
    tempat_mencuci_id: string | null
  }

  /**
   * Validasi format periode berdasarkan item type dan mapping Tahun Ajaran (Juli–Juni).
   * - Bulanan (SPP, UANG_MAKAN, UANG_NYUCI): Wajib 'YYYY-MM'
   *   - Bulan 07 s.d. 12: TA dimulai tahun YYYY -> nama TA: 'YYYY/YYYY+1'
   *   - Bulan 01 s.d. 06: TA dimulai tahun YYYY - 1 -> nama TA: 'YYYY-1/YYYY'
   * - Tahunan (EHB, EKSKUL, KESEHATAN): Wajib 'YYYY' (tahun awal TA) -> nama TA: 'YYYY/YYYY+1'
   * - Lifetime (USPP): Wajib 'LIFETIME'
   */
  function validateAndMapPeriod(
    itemType: FinanceItemType,
    period: string
  ): { targetAcademicYearName: string | null } {
    if (itemType === 'USPP') {
      if (period !== 'LIFETIME') {
        throw new Error(
          `Periode untuk USPP wajib bernilai 'LIFETIME', diterima: "${period}".`
        )
      }
      return { targetAcademicYearName: null }
    }

    if (itemType === 'SPP' || itemType === 'UANG_MAKAN' || itemType === 'UANG_NYUCI') {
      const match = period.match(/^(\d{4})-(\d{2})$/)
      if (!match) {
        throw new Error(
          `Format periode untuk tagihan bulanan (${itemType}) wajib YYYY-MM (contoh: 2026-07), diterima: "${period}".`
        )
      }
      const year = parseInt(match[1], 10)
      const month = parseInt(match[2], 10)
      if (month < 1 || month > 12) {
        throw new Error(`Bulan pada periode tidak valid: "${period}".`)
      }
      // Mapping Tahun Ajaran Pesantren: Juli (07) s.d. Juni (06)
      const startYear = month >= 7 ? year : year - 1
      return { targetAcademicYearName: `${startYear}/${startYear + 1}` }
    }

    if (itemType === 'EHB' || itemType === 'EKSKUL' || itemType === 'KESEHATAN') {
      const match = period.match(/^(\d{4})$/)
      if (!match) {
        throw new Error(
          `Format periode untuk tagihan tahunan (${itemType}) wajib YYYY (tahun awal TA, contoh: 2026), diterima: "${period}".`
        )
      }
      const startYear = parseInt(match[1], 10)
      return { targetAcademicYearName: `${startYear}/${startYear + 1}` }
    }

    throw new Error(`Tipe item tidak dikenali: "${itemType}".`)
  }

  /**
   * Memastikan record kewajiban santri telah terbentuk (materialized) secara on-demand & idempotent.
   * Penegakan aturan bisnis:
   * 1. Validasi period berdasarkan item type & mapping TA Juli–Juni.
   * 2. Hanya santri berstatus 'aktif' yang dapat dimaterialisasi.
   * 3. Wajib provider valid di master_jasa untuk Makan ('Makan') dan Nyuci ('Cuci').
   * 4. Resolusi tarif ketat tanpa fallback lintas tahun ajaran.
   * 5. Re-query obligation canonical setelah INSERT OR IGNORE untuk menjamin concurrency safety.
   */
  async function ensureObligation(
    santriId: string,
    itemType: FinanceItemType,
    period: string,
    options?: EnsureObligationOptions,
    preview = false,
    onProposedInsert?: (id: string) => void
  ): Promise<FinanceObligation> {
    // 1. Validasi format periode dan tentukan target nama Tahun Ajaran
    const { targetAcademicYearName } = validateAndMapPeriod(itemType, period)

    // 2. Cek apakah record kewajiban sudah ada di database (Idempotent)
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

    // 2b. Cutover / Legacy Guard: Cegah pembuatan kewajiban baru untuk periode/item historis legacy
    const legacyCheck = await checkLegacySettlement(santriId, itemType, period)
    if (legacyCheck.isLegacyManaged) {
      throw new Error(
        `Pembuatan kewajiban ${itemType} periode "${period}" ditolak: ${legacyCheck.reason} (Cegah duplicate debt).`
      )
    }

    // 3. Ambil data santri existing untuk verifikasi status aktif dan snapshot provider
    const santri = await queryOne<SantriSnapshotRow>(
      `SELECT id, nama_lengkap, status_global, asrama, kategori_santri, tempat_makan_id, tempat_mencuci_id
       FROM santri
       WHERE id = ?`,
      [santriId]
    )

    if (!santri) {
      throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
    }

    // Hanya santri aktif yang boleh dimaterialisasi
    if (santri.status_global !== 'aktif') {
      throw new Error(
        `Hanya santri berstatus 'aktif' yang dapat dimaterialisasi kewajibannya. Santri "${santri.nama_lengkap}" berstatus '${santri.status_global}'.`
      )
    }

    // Guard bebas tagihan:
    // - AL-BAGHORY (penduduk setempat) tidak boleh memiliki kewajiban apa pun.
    // - Kategori SADESA tidak boleh ditagih untuk UANG_MAKAN & UANG_NYUCI,
    //   sedangkan SPP/EHB/EKSKUL/KESEHATAN/USPP tetap dapat ditagih.
    assertSantriBillable(santri.asrama, santri.nama_lengkap)
    assertSantriBillableUntukItem(
      { asrama: santri.asrama, kategoriSantri: santri.kategori_santri, namaSantri: santri.nama_lengkap },
      itemType
    )

    // Wajibkan provider valid untuk Makan dan Nyuci dari master_jasa
    let providerId: string | null = null
    const mealProvider = options?.providerSnapshotId ?? santri.tempat_makan_id
    const washProvider = options?.providerSnapshotId ?? santri.tempat_mencuci_id
    if (itemType === 'UANG_MAKAN') {
      if (!mealProvider) {
        throw new Error(
          `Santri "${santri.nama_lengkap}" belum memiliki tempat makan/katering (tempat_makan_id kosong).`
        )
      }
      const validProvider = await queryOne<{ id: string }>(
        `SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Makan'`,
        [mealProvider]
      )
      if (!validProvider) {
        throw new Error(
          `Tempat makan santri "${santri.tempat_makan_id}" tidak valid pada master_jasa (wajib jenis 'Makan').`
        )
      }
      providerId = mealProvider
    } else if (itemType === 'UANG_NYUCI') {
      if (!washProvider) {
        throw new Error(
          `Santri "${santri.nama_lengkap}" belum memiliki tempat cuci/laundry (tempat_mencuci_id kosong).`
        )
      }
      const validProvider = await queryOne<{ id: string }>(
        `SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Cuci'`,
        [washProvider]
      )
      if (!validProvider) {
        throw new Error(
          `Tempat cuci santri "${santri.tempat_mencuci_id}" tidak valid pada master_jasa (wajib jenis 'Cuci').`
        )
      }
      providerId = washProvider
    }

    // 4. Validasi konsistensi academic_year_id dengan hasil mapping kalender Juli–Juni
    let academicYearId: number | null = null

    if (targetAcademicYearName) {
      const expectedTA = await queryOne<{ id: number; nama: string }>(
        `SELECT id, nama FROM tahun_ajaran WHERE nama = ? LIMIT 1`,
        [targetAcademicYearName]
      )
      if (!expectedTA) {
        throw new Error(
          `Tahun ajaran "${targetAcademicYearName}" untuk periode "${period}" (kalender Juli–Juni) belum terdaftar di master tahun_ajaran.`
        )
      }

      if (options?.academicYearId !== undefined && options?.academicYearId !== null) {
        if (options.academicYearId !== expectedTA.id) {
          const providedTA = await queryOne<{ id: number; nama: string }>(
            `SELECT id, nama FROM tahun_ajaran WHERE id = ?`,
            [options.academicYearId]
          )
          const providedName = providedTA ? providedTA.nama : `ID ${options.academicYearId} (tidak ditemukan)`
          throw new Error(
            `academic_year_id ${options.academicYearId} (${providedName}) tidak konsisten dengan periode "${period}" yang berada pada Tahun Ajaran ${expectedTA.nama} (kalender Juli–Juni).`
          )
        }
        academicYearId = options.academicYearId
      } else {
        academicYearId = expectedTA.id
      }
    } else {
      // USPP ('LIFETIME')
      if (options?.academicYearId !== undefined && options?.academicYearId !== null) {
        const providedTA = await queryOne<{ id: number }>(
          `SELECT id FROM tahun_ajaran WHERE id = ?`,
          [options.academicYearId]
        )
        if (!providedTA) {
          throw new Error(`Tahun ajaran dengan ID ${options.academicYearId} tidak ditemukan.`)
        }
        academicYearId = options.academicYearId
      } else {
        const activeYear = await queryOne<{ id: number }>(
          `SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`
        )
        academicYearId = activeYear ? activeYear.id : null
      }
    }

    // 5. Resolusi tarif aktif (Snapshot Tarif) - Ketat pada TA yang ditentukan
    // USPP can explicitly use the configured global lifetime tariff while keeping its academic-year snapshot.
    const tariff = await getActiveTariff(itemType, period, itemType === 'USPP' && options?.academicYearId === null ? null : academicYearId)

    if (!tariff) {
      throw new Error(
        `Tarif untuk item "${itemType}" periode "${period}" (Tahun Ajaran ID: ${academicYearId ?? 'Global'}) belum dikonfigurasi.`
      )
    }

    // 6. Resolusi pembebasan biaya santri (Exemption Engine)
    const exemption = await checkExemption(
      santriId,
      itemType,
      period,
      academicYearId
    )

    // 6b. Legacy Adapter untuk USPP/BANGUNAN:
    // Hitung total kewajiban historis dan pembayaran legacy yang sudah masuk.
    // Jika baru dibayar sebagian, bawa nilai pembayaran historis ke amount_paid TANPA membuat payment baru.
    let amountExpected = tariff.nominal
    let initialAmountPaid = 0

    if (itemType === 'USPP') {
      const usppStatus = await checkLegacyUsppStatus(santriId)
      if (usppStatus.totalTariff > 0 && !(options?.academicYearId === null && tariff.nominal === 0)) {
        amountExpected = usppStatus.totalTariff
      }
      if (usppStatus.legacyPaid > 0 && !usppStatus.isFullySettled) {
        initialAmountPaid = usppStatus.legacyPaid
      }
    }

    const amountExempted = exemption ? amountExpected : 0
    const amountPaid = initialAmountPaid
    rupiah(amountExpected,'Tagihan',true)
    rupiah(amountExempted,'Pembebasan',true)
    rupiah(amountPaid,'Pembayaran',true)
    const status = computeObligationStatus(amountExpected, amountExempted, amountPaid)

    const id = generateId()
    const timestamp = now()

    if (preview) return {
      id, santri_id: santriId, item_type: itemType, academic_year_id: tariff.academic_year_id ?? academicYearId,
      period, tariff_id: tariff.id, amount_expected: amountExpected, amount_exempted: amountExempted,
      amount_paid: amountPaid, status, provider_id: providerId, created_at: timestamp, updated_at: timestamp,
    }

    // An override is a tariff snapshot but its ID is not a finance_tariffs FK.
    const baseTariff = await queryOne<{ id: string }>('SELECT id FROM finance_tariffs WHERE id=?', [tariff.id])
    const tariffId = baseTariff?.id ?? null

    // 7. Simpan kewajiban ke database (gunakan INSERT OR IGNORE untuk mencegah race conditions)
    onProposedInsert?.(id)
    await execute(
      `INSERT OR IGNORE INTO finance_obligations (
        id, santri_id, item_type, academic_year_id, period,
        tariff_id, amount_expected, amount_exempted, amount_paid,
        status, provider_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        santriId,
        itemType,
        tariff.academic_year_id ?? academicYearId,
        period,
        tariffId,
        amountExpected,
        amountExempted,
        amountPaid,
        status,
        providerId,
        timestamp,
        timestamp,
      ]
    )

    // 8. Re-query canonical row untuk concurrency safety
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
        `Gagal mengambil record kewajiban kanonikal untuk santri "${santriId}", item "${itemType}", periode "${period}".`
      )
    }

    return canonical
  }


  return { ensureObligation, validateAndMapPeriod,
    previewObligation: (id: string, item: FinanceItemType, period: string, options?: EnsureObligationOptions) =>
      ensureObligation(id, item, period, options, true),
  }
}
