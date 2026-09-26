// lib/finance/matrix.ts
// Obligation Matrix Aggregator - Sistem Keuangan Baru Pesantren (Fase 2C)

import { query } from '@/lib/db'
import { nonBillableSantriSqlPredicate } from '@/lib/finance/non-billable-santri'
import type {
  FinanceItemType,
  FinanceObligationStatus,
  ObligationItemSummary,
  StudentObligationMatrixItem,
  StudentObligationMatrixFilter,
} from '@/lib/finance/types'

interface RawObligationRow {
  santri_id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  tempat_makan_id: string | null
  tempat_mencuci_id: string | null
  obligation_id: string | null
  item_type: string | null
  period: string | null
  amount_expected: number | null
  amount_exempted: number | null
  amount_paid: number | null
  status: string | null
  provider_id: string | null
  provider_name: string | null
}

function emptyItemSummary(itemType: FinanceItemType): ObligationItemSummary {
  return {
    obligationId: null,
    itemType,
    amountExpected: 0,
    amountExempted: 0,
    amountPaid: 0,
    remaining: 0,
    status: 'NOT_MATERIALIZED',
    providerId: null,
    providerName: null,
  }
}

function mapRowToSummary(
  row: RawObligationRow,
  defaultType?: FinanceItemType
): ObligationItemSummary {
  const itemType = (row.item_type as FinanceItemType) || defaultType || 'SPP'
  if (!row.obligation_id) {
    return emptyItemSummary(itemType)
  }

  const expected = row.amount_expected ?? 0
  const exempted = row.amount_exempted ?? 0
  const paid = row.amount_paid ?? 0
  const remaining = Math.max(0, expected - exempted - paid)

  return {
    obligationId: row.obligation_id,
    itemType,
    amountExpected: expected,
    amountExempted: exempted,
    amountPaid: paid,
    remaining,
    status: (row.status ?? 'UNPAID') as FinanceObligationStatus,
    providerId: row.provider_id,
    providerName: row.provider_name,
  }
}

/**
 * Menghasilkan matriks status kewajiban untuk seluruh santri aktif pada suatu periode.
 * Menggabungkan kewajiban bulanan, tahunan, dan USPP untuk visualisasi komprehensif.
 */
export async function getStudentsObligationMatrix(
  period: string, // YYYY-MM
  filter?: StudentObligationMatrixFilter
): Promise<StudentObligationMatrixItem[]> {
  const santriConditions: string[] = [
    "s.status_global = 'aktif'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = [period, period]

  if (filter?.asrama) {
    santriConditions.push('s.asrama = ?')
    params.push(filter.asrama)
  }

  if (filter?.search) {
    santriConditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const queryTerm = `%${filter.search}%`
    params.push(queryTerm, queryTerm)
  }

  const limitClause = filter?.limit ? `LIMIT ${filter.limit}` : ''
  const offsetClause = filter?.offset ? `OFFSET ${filter.offset}` : ''

  // Query santri aktif beserta seluruh kewajibannya yang relevan
  const sql = `
    SELECT
      s.id AS santri_id,
      s.nis,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      s.tempat_makan_id,
      s.tempat_mencuci_id,
      o.id AS obligation_id,
      o.item_type,
      o.period,
      o.amount_expected,
      o.amount_exempted,
      o.amount_paid,
      o.status,
      o.provider_id,
      m.nama_jasa AS provider_name
    FROM santri s
    LEFT JOIN finance_obligations o
      ON s.id = o.santri_id
      AND (
        o.period = ?
        OR o.period = 'LIFETIME'
        OR (length(o.period) = 4 AND substr(?, 1, 4) = o.period)
      )
    LEFT JOIN master_jasa m ON o.provider_id = m.id
    WHERE ${santriConditions.join(' AND ')}
    ORDER BY s.nama_lengkap ASC, o.item_type ASC
    ${limitClause} ${offsetClause}
  `

  const rows = await query<RawObligationRow>(sql, params)

  // Kelompokkan per santri_id
  const studentMap = new Map<string, {
    info: {
      santriId: string
      nis: string
      namaLengkap: string
      asrama: string | null
      kamar: string | null
      tempatMakanId: string | null
      tempatMencuciId: string | null
    }
    obligations: Map<string, RawObligationRow>
  }>()

  for (const r of rows) {
    if (!studentMap.has(r.santri_id)) {
      studentMap.set(r.santri_id, {
        info: {
          santriId: r.santri_id,
          nis: r.nis,
          namaLengkap: r.nama_lengkap,
          asrama: r.asrama,
          kamar: r.kamar,
          tempatMakanId: r.tempat_makan_id,
          tempatMencuciId: r.tempat_mencuci_id,
        },
        obligations: new Map(),
      })
    }

    if (r.obligation_id && r.item_type) {
      studentMap.get(r.santri_id)!.obligations.set(r.item_type, r)
    }
  }

  const results: StudentObligationMatrixItem[] = []

  for (const entry of studentMap.values()) {
    const { info, obligations } = entry

    const sppRow = obligations.get('SPP')
    const makanRow = obligations.get('UANG_MAKAN')
    const nyuciRow = obligations.get('UANG_NYUCI')
    const usppRow = obligations.get('USPP')

    const spp = sppRow ? mapRowToSummary(sppRow, 'SPP') : emptyItemSummary('SPP')
    const uangMakan = makanRow ? mapRowToSummary(makanRow, 'UANG_MAKAN') : emptyItemSummary('UANG_MAKAN')
    const uangNyuci = nyuciRow ? mapRowToSummary(nyuciRow, 'UANG_NYUCI') : emptyItemSummary('UANG_NYUCI')
    const uspp = usppRow ? mapRowToSummary(usppRow, 'USPP') : emptyItemSummary('USPP')

    const tahunan: ObligationItemSummary[] = []
    for (const annualType of ['EHB', 'EKSKUL', 'KESEHATAN'] as const) {
      const row = obligations.get(annualType)
      if (row) {
        tahunan.push(mapRowToSummary(row, annualType))
      }
    }

    const allItems = [spp, uangMakan, uangNyuci, uspp, ...tahunan]
    const totalExpected = allItems.reduce((acc, it) => acc + it.amountExpected, 0)
    const totalPaid = allItems.reduce((acc, it) => acc + it.amountPaid, 0)
    const totalRemaining = allItems.reduce((acc, it) => acc + it.remaining, 0)
    const totalExempted = allItems.reduce((acc, it) => acc + it.amountExempted, 0)

    let overallStatus: StudentObligationMatrixItem['overallStatus'] = 'BELUM_LUNAS'
    if (totalExpected > 0 && totalExempted >= totalExpected) {
      overallStatus = 'BEBAS'
    } else if (totalRemaining === 0 && totalPaid > 0) {
      overallStatus = 'LUNAS'
    } else if (totalPaid > 0) {
      overallStatus = 'CICILAN'
    } else {
      overallStatus = 'BELUM_LUNAS'
    }

    // Filter status jika diminta
    if (filter?.status && overallStatus !== filter.status) {
      continue
    }

    results.push({
      ...info,
      period,
      spp,
      uangMakan,
      uangNyuci,
      tahunan,
      uspp,
      totalExpected,
      totalPaid,
      totalRemaining,
      overallStatus,
    })
  }

  return results
}
