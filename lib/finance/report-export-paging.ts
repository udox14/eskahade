// lib/finance/report-export-paging.ts
// Penelusuran seluruh halaman hasil filter untuk ekspor Excel (Fase 10: PRD Bab 34 & 41).
//
// Modul ini sengaja bebas dari dependensi server (db, session, RSC) agar:
// 1. dapat diuji langsung sebagai fungsi murni (lihat scripts/test-finance-excel-export.mjs);
// 2. dipakai ulang oleh seluruh jenis laporan tanpa duplikasi logika.

/**
 * Ukuran batch pengambilan data saat ekspor. Semua read-model laporan membatasi
 * pageSize maksimum 200, jadi nilai ini adalah batch terbesar yang valid.
 */
export const REPORT_EXPORT_PAGE_SIZE = 200

/**
 * Batas maksimum baris per berkas ekspor. Melindungi query, memori server, dan
 * payload server action dari dataset raksasa (PRD Bab 41). Bila terlampaui,
 * berkas tetap dibuat dan pengguna diberi tahu agar mempersempit filter.
 */
export const REPORT_EXPORT_MAX_ROWS = 5000

export interface ReportExportPayload<T> {
  items: T[]
  totalRecords: number
  truncated: boolean
}

export type ReportPageFetcher<T> = (
  page: number,
  pageSize: number
) => Promise<{ items: T[]; pagination: { totalRecords: number } }>

/**
 * Mengambil seluruh baris hasil filter secara bertahap:
 * - per batch `REPORT_EXPORT_PAGE_SIZE` agar query tetap ringan (PRD Bab 41);
 * - berhenti saat data habis, saat totalRecords tercapai, atau saat batas maksimum;
 * - `truncated = true` bila batas maksimum tercapai lebih dulu dari total data.
 */
export async function collectAllReportPages<T>(
  fetchPage: ReportPageFetcher<T>,
  options?: { maxRows?: number; pageSize?: number }
): Promise<ReportExportPayload<T>> {
  const maxRows = options?.maxRows ?? REPORT_EXPORT_MAX_ROWS
  const pageSize = options?.pageSize ?? REPORT_EXPORT_PAGE_SIZE
  const maxPages = Math.max(1, Math.ceil(maxRows / pageSize))

  const items: T[] = []
  let totalRecords = 0
  let truncated = false

  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetchPage(page, pageSize)
    totalRecords = res.pagination?.totalRecords ?? totalRecords

    if (res.items.length === 0) break

    items.push(...res.items)

    if (items.length >= maxRows) {
      items.length = maxRows
      truncated = totalRecords > items.length
      break
    }

    if (totalRecords > 0 && items.length >= totalRecords) break
  }

  return { items, totalRecords, truncated }
}
