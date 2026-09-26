// lib/finance/non-billable-santri.ts
// Aturan bisnis terpusat: santri yang TIDAK dikenai tagihan pada Sistem Keuangan Baru.
//
// Dua tingkat pengecualian:
//
// 1. BEBAS TOTAL — santri asrama AL-BAGHORY (penduduk setempat, bukan santri bermukim):
//    tidak dikenai tagihan apa pun (SPP, Uang Makan, Uang Nyuci, EHB, Ekskul, Kesehatan, USPP),
//    tidak muncul pada daftar/laporan modul keuangan, dan tidak punya kartu/PIN/VA/uang jajan.
//
// 2. BEBAS PER ITEM — santri kategori SADESA:
//    hanya dibebaskan dari item UANG_MAKAN dan UANG_NYUCI (tidak memakai katering & laundry),
//    SEDANGKAN SPP, EHB, EKSKUL, KESEHATAN, dan USPP TETAP DAPAT DITAGIH.
//    Pembebasan item lainnya untuk santri SADESA dilakukan manual oleh user melalui
//    Modul Pengaturan Keuangan → Pembebasan (Bab 14 PRD), bukan oleh aturan ini.
//
// Karena itu modul keuangan yang menampilkan SANTRI (bukan item) tetap menampilkan santri
// SADESA — mereka masih punya kewajiban SPP dkk. Yang dikecualikan adalah item makan/nyuci
// dan seluruh tampilan untuk AL-BAGHORY.

import { ASRAMA_TANPA_KAMAR } from '@/lib/asrama'
import { normalizeKategoriSantriDasar } from '@/lib/santri/kategori'

/** Item yang TIDAK ditagihkan kepada santri kategori SADESA. */
export const ITEM_BEBAS_SADESA: readonly string[] = ['UANG_MAKAN', 'UANG_NYUCI']

/** Kategori santri yang bebas pada item tertentu (lihat ITEM_BEBAS_SADESA). */
export const KATEGORI_BEBAS_ITEM: readonly string[] = ['SADESA']

/**
 * Daftar asrama yang seluruh santrinya bebas tagihan keuangan (bebas total).
 * Sumber tunggal: `ASRAMA_TANPA_KAMAR` pada `lib/asrama.ts` (AL-BAGHORY).
 */
export const ASRAMA_BEBAS_TAGIHAN: readonly string[] = ASRAMA_TANPA_KAMAR

/** True bila nilai asrama termasuk asrama yang bebas total (case/whitespace-insensitive). */
export function isAsramaBebasTagihan(asrama: string | null | undefined): boolean {
  const normalized = (asrama ?? '').trim().toUpperCase()
  return ASRAMA_BEBAS_TAGIHAN.some((item) => item.trim().toUpperCase() === normalized)
}

/** True bila kategori santri termasuk kategori yang bebas pada item tertentu (default REGULER). */
export function isKategoriBebasItem(kategoriSantri: string | null | undefined): boolean {
  const normalized = normalizeKategoriSantriDasar(kategoriSantri)
  return KATEGORI_BEBAS_ITEM.includes(normalized)
}

/** True bila kategori santri bebas pada item keuangan tertentu. */
export function isKategoriBebasItemTertentu(
  kategoriSantri: string | null | undefined,
  itemType: string | null | undefined
): boolean {
  if (!isKategoriBebasItem(kategoriSantri)) return false
  const normalizedItem = String(itemType ?? '').trim().toUpperCase()
  return ITEM_BEBAS_SADESA.includes(normalizedItem)
}

/** True bila santri bebas TOTAL dari seluruh tagihan (hanya AL-BAGHORY). */
export function isSantriBebasTagihan(input: {
  asrama?: string | null
  kategoriSantri?: string | null
}): boolean {
  return isAsramaBebasTagihan(input.asrama)
}

/**
 * True bila santri tidak boleh ditagih untuk item tertentu.
 * AL-BAGHORY → selalu true. SADESA → true hanya untuk UANG_MAKAN / UANG_NYUCI.
 */
export function isSantriBebasItem(
  input: { asrama?: string | null; kategoriSantri?: string | null },
  itemType: string | null | undefined
): boolean {
  if (isAsramaBebasTagihan(input.asrama)) return true
  return isKategoriBebasItemTertentu(input.kategoriSantri, itemType)
}

/** Label alasan pengecualian, dipakai pada pesan error/audit. */
export function alasanBebasTagihan(input: {
  asrama?: string | null
  kategoriSantri?: string | null
}): string | null {
  if (isAsramaBebasTagihan(input.asrama)) {
    return `berasrama ${String(input.asrama ?? '').trim().toUpperCase()} (penduduk setempat) sehingga bebas dari seluruh tagihan keuangan`
  }
  return null
}

/** Label alasan pengecualian per item. */
export function alasanBebasItem(
  input: { asrama?: string | null; kategoriSantri?: string | null },
  itemType: string | null | undefined
): string | null {
  if (isAsramaBebasTagihan(input.asrama)) {
    return `berasrama ${String(input.asrama ?? '').trim().toUpperCase()} (penduduk setempat) sehingga bebas dari seluruh tagihan keuangan`
  }
  if (isKategoriBebasItemTertentu(input.kategoriSantri, itemType)) {
    return `berkategori SADESA sehingga bebas dari tagihan ${String(itemType ?? '').trim().toUpperCase()}`
  }
  return null
}

/** Kelas error khusus agar pemanggil dapat membedakannya dari validasi biasa. */
export class NonBillableSantriError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonBillableSantriError'
  }
}

/**
 * Guard sisi server (BEBAS TOTAL): lempar error bila santri AL-BAGHORY.
 * Dipakai pada semua titik mutasi/pembacaan per satu santri.
 *
 * Parameter `kategoriSantri` sengaja diterima namun tidak dipakai: kategori SADESA
 * TIDAK membuat bebas total — SADESA hanya bebas pada item tertentu, lihat
 * `assertSantriBillableUntukItem()`. Parameter dipertahankan agar pemanggil tidak
 * salah menyimpulkan bahwa kategori sudah diperhitungkan.
 */
export function assertSantriBillable(
  asrama: string | null | undefined,
  namaSantri?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  kategoriSantri?: string | null
): void {
  const alasan = alasanBebasTagihan({ asrama })
  if (!alasan) return
  const label = namaSantri ? `Santri "${namaSantri}"` : 'Santri ini'
  throw new NonBillableSantriError(`${label} ${alasan}.`)
}

/**
 * Guard sisi server (PER ITEM): lempar error bila santri tidak boleh ditagih untuk item ini.
 */
export function assertSantriBillableUntukItem(
  input: { asrama?: string | null; kategoriSantri?: string | null; namaSantri?: string | null },
  itemType: string | null | undefined
): void {
  const alasan = alasanBebasItem(input, itemType)
  if (!alasan) return
  const label = input.namaSantri ? `Santri "${input.namaSantri}"` : 'Santri ini'
  throw new NonBillableSantriError(`${label} ${alasan}.`)
}

/** Daftar literal SQL dari sebuah daftar nilai (aman: literal dari kode, bukan input pengguna). */
function sqlList(values: readonly string[]): string {
  return values.map((item) => `'${item.trim().toUpperCase().replace(/'/g, "''")}'`).join(', ')
}

/**
 * Membangun potongan SQL untuk mengeluarkan santri BEBAS TOTAL (AL-BAGHORY).
 * Kategori santri tidak memengaruhi predikat ini — untuk SADESA gunakan
 * `nonBillableItemSqlPredicate()`.
 *
 * @param column Ekspresi kolom asrama, mis. `s.asrama` atau `asrama`.
 * @param negate Bila true, hasilnya predikat POSITIF (hanya santri bebas tagihan).
 */
export function nonBillableSantriSqlPredicate(column: string, negate = false): string {
  const normalizedAsrama = `UPPER(TRIM(COALESCE(${column}, '')))`
  const predikat = `(${normalizedAsrama} NOT IN (${sqlList(ASRAMA_BEBAS_TAGIHAN)}))`
  return negate ? `NOT ${predikat}` : predikat
}

/**
 * Membangun potongan SQL untuk mengeluarkan santri yang bebas pada ITEM tertentu:
 * AL-BAGHORY (selalu) dan SADESA (hanya bila itemType termasuk ITEM_BEBAS_SADESA).
 *
 * @param column Ekspresi kolom asrama, mis. `s.asrama`.
 * @param kategoriColumn Ekspresi kolom kategori santri, mis. `s.kategori_santri`.
 * @param itemType Item keuangan yang sedang dihitung/ditampilkan.
 */
export function nonBillableItemSqlPredicate(
  column: string,
  kategoriColumn: string,
  itemType: string | null | undefined
): string {
  const normalizedAsrama = `UPPER(TRIM(COALESCE(${column}, '')))`
  const bebasTotal = `${normalizedAsrama} NOT IN (${sqlList(ASRAMA_BEBAS_TAGIHAN)})`

  if (!ITEM_BEBAS_SADESA.includes(String(itemType ?? '').trim().toUpperCase())) {
    return `(${bebasTotal})`
  }

  const normalizedKategori = `UPPER(TRIM(COALESCE(${kategoriColumn}, 'REGULER')))`
  return `(${bebasTotal} AND ${normalizedKategori} NOT IN (${sqlList(KATEGORI_BEBAS_ITEM)}))`
}

/** True bila item keuangan tertentu dibebaskan untuk santri kategori SADESA. */
export function isItemBebasUntukSadesa(itemType: string | null | undefined): boolean {
  return ITEM_BEBAS_SADESA.includes(String(itemType ?? '').trim().toUpperCase())
}

/**
 * Potongan SQL siap tempel pada klausa WHERE untuk mengeluarkan santri bebas tagihan.
 * Contoh: `WHERE s.status_global = 'aktif' ${excludeNonBillableSantriSql('s.asrama')}`
 */
export function excludeNonBillableSantriSql(column = 's.asrama'): string {
  return `AND ${nonBillableSantriSqlPredicate(column)}`
}
