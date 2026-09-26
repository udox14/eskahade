// lib/finance/non-billable-santri.ts
// Aturan bisnis terpusat: santri yang TIDAK dikenai tagihan apa pun pada Sistem Keuangan Baru.
//
// Konteks bisnis:
// Santri asrama AL-BAGHORY adalah penduduk setempat (bukan santri jauh/bermukim),
// sehingga tidak dikenai tagihan apa pun: SPP, Uang Makan, Uang Nyuci, EHB,
// Ekstrakurikuler, Kesehatan, USPP, maupun Uang Jajan.
//
// Aturan ini bersifat MENYELURUH (blanket) untuk seluruh modul Sistem Keuangan Baru:
// - tidak pernah ditampilkan pada daftar/tabel/laporan;
// - tidak pernah dibuatkan kewajiban, order pembayaran, kartu, PIN, atau saldo uang jajan;
// - tidak boleh menerima pembayaran/allocation baru.

import { ASRAMA_TANPA_KAMAR } from '@/lib/asrama'

/**
 * Daftar asrama yang seluruh santrinya bebas tagihan keuangan.
 * Sumber tunggal: `ASRAMA_TANPA_KAMAR` pada `lib/asrama.ts` (AL-BAGHORY).
 */
export const ASRAMA_BEBAS_TAGIHAN: readonly string[] = ASRAMA_TANPA_KAMAR

/** True bila nilai asrama termasuk asrama yang bebas tagihan (case/whitespace-insensitive). */
export function isAsramaBebasTagihan(asrama: string | null | undefined): boolean {
  const normalized = (asrama ?? '').trim().toUpperCase()
  return ASRAMA_BEBAS_TAGIHAN.some((item) => item.trim().toUpperCase() === normalized)
}

/** Kelas error khusus agar pemanggil dapat membedakannya dari validasi biasa. */
export class NonBillableSantriError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonBillableSantriError'
  }
}

/**
 * Guard sisi server: lempar error bila santri termasuk kelompok bebas tagihan.
 * Dipakai pada semua titik mutasi/pembacaan per satu santri.
 */
export function assertSantriBillable(
  asrama: string | null | undefined,
  namaSantri?: string | null
): void {
  if (!isAsramaBebasTagihan(asrama)) return
  const label = namaSantri ? `Santri "${namaSantri}"` : 'Santri ini'
  throw new NonBillableSantriError(
    `${label} berasrama ${String(asrama ?? '').trim().toUpperCase()} (penduduk setempat) sehingga bebas dari seluruh tagihan keuangan.`
  )
}

/**
 * Membangun potongan SQL (predikat) untuk mengeluarkan santri bebas tagihan.
 *
 * @param column Ekspresi kolom asrama, mis. `s.asrama` atau `asrama`.
 *               Hanya boleh diisi literal dari kode (bukan input pengguna).
 * @param negate Bila true, hasilnya adalah predikat POSITIF (hanya santri bebas
 *               tagihan) — dipakai untuk pelaporan khusus, bukan untuk modul umum.
 */
export function nonBillableSantriSqlPredicate(column: string, negate = false): string {
  const normalized = `UPPER(TRIM(COALESCE(${column}, '')))`
  const list = ASRAMA_BEBAS_TAGIHAN.map(
    (item) => `'${item.trim().toUpperCase().replace(/'/g, "''")}'`
  ).join(', ')
  return negate ? `${normalized} IN (${list})` : `${normalized} NOT IN (${list})`
}

/**
 * Potongan SQL siap tempel pada klausa WHERE untuk mengeluarkan santri bebas tagihan.
 * Contoh: `WHERE s.status_global = 'aktif' ${excludeNonBillableSantriSql('s.asrama')}`
 */
export function excludeNonBillableSantriSql(column = 's.asrama'): string {
  return `AND ${nonBillableSantriSqlPredicate(column)}`
}
