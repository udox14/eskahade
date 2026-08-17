/**
 * Penjalan impor massal untuk modul keuangan.
 *
 * Satu aturan yang dipegang seluruh pemakainya: **baris diproses satu per satu
 * dan kegagalan satu baris tidak membatalkan baris lain.** Bendahara mengunggah
 * puluhan sampai ratusan baris; menolak seluruh berkas karena satu NIS keliru
 * berarti pekerjaan diulang dari nol, dan itulah yang mendorong orang kembali
 * menginput manual.
 *
 * Dijalankan berurutan, bukan paralel: seluruh penulisan keuangan melewati
 * trigger D1 yang saling memeriksa saldo, dan eksekusi paralel membuat pesan
 * penolakan tidak lagi bisa dikaitkan ke barisnya.
 */

export const BULK_MAX_ROWS = 2_000

export type BulkRejection = { row: number; reason: string }

export type BulkSummary = {
  success: true
  created: number
  /** Baris yang tidak menghasilkan data baru karena isinya sudah pernah masuk. */
  skipped: number
  rejected: BulkRejection[]
}

export type BulkFailure = { success: false; error: string }

type RowOutcome = { success: boolean; error?: string; duplicate?: boolean }

export async function runBulk<T extends { row: number }>(
  rows: T[],
  work: (item: T) => Promise<RowOutcome>,
): Promise<BulkSummary | BulkFailure> {
  if (!Array.isArray(rows) || !rows.length) return { success: false, error: 'Tidak ada baris yang dikirim.' }
  if (rows.length > BULK_MAX_ROWS) return { success: false, error: `Maksimal ${BULK_MAX_ROWS.toLocaleString('id-ID')} baris per eksekusi.` }

  let created = 0
  let skipped = 0
  const rejected: BulkRejection[] = []

  for (const item of rows) {
    try {
      const outcome = await work(item)
      if (!outcome.success) rejected.push({ row: item.row, reason: outcome.error || 'Ditolak tanpa keterangan.' })
      else if (outcome.duplicate) skipped += 1
      else created += 1
    } catch (error) {
      rejected.push({ row: item.row, reason: error instanceof Error ? error.message : 'Kesalahan tak terduga.' })
    }
  }

  return { success: true, created, skipped, rejected }
}

/**
 * Kunci idempotensi untuk baris impor. Sengaja diturunkan dari isi baris,
 * tanggal, dan nomor barisnya — bukan dari nomor acak — supaya berkas yang
 * sama diunggah dua kali terdeteksi sebagai kiriman ulang, bukan menghasilkan
 * transaksi kedua. Uang tidak boleh keluar dua kali karena salah klik.
 */
export function bulkIdempotencyKey(scope: string, row: number, parts: Array<string | number | null>): string {
  const jakartaDay = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
  return `bulk:${scope}:${jakartaDay}:${parts.map(part => String(part ?? '')).join('|')}:${row}`
}
