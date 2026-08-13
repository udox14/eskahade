/**
 * Kunci idempotensi dan deteksi duplikat.
 *
 * Dua masalah yang ditangani berkas ini:
 *
 * 1. Kunci yang dibangun dari teks yang diketik manusia (nomor dokumen,
 *    referensi bank, nomor kuitansi) menyatukan transaksi yang sebenarnya
 *    berbeda. Yang kedua tidak pernah diposting, namun dilaporkan berhasil
 *    beserta id transaksi milik yang pertama. `contentKey` menambahkan sidik
 *    jari isi transaksi sehingga hanya pengiriman yang benar-benar identik
 *    yang dianggap duplikat.
 *
 * 2. Blok catch yang menganggap "ada baris dengan kunci ini" sebagai bukti
 *    keberhasilan. Padahal catch menangkap semua error, termasuk jurnal tidak
 *    seimbang, saldo kurang, atau periode tertutup. `isUniqueViolation`
 *    membatasi jalur duplikat hanya untuk pelanggaran UNIQUE yang asli.
 */

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]))
  }
  return value
}

async function fingerprint(payload: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable(payload))))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * Kunci idempotensi untuk transaksi yang direferensikan lewat nomor dokumen.
 * Referensi yang sama dengan isi berbeda menghasilkan kunci berbeda, sehingga
 * transaksi kedua benar-benar diposting alih-alih ditelan sebagai duplikat.
 */
export async function contentKey(prefix: string, reference: string, payload: unknown): Promise<string> {
  return `${prefix}:${reference.trim().toLowerCase()}:${await fingerprint(payload)}`
}

/** Hanya pelanggaran UNIQUE yang boleh diperlakukan sebagai kiriman ulang. */
export function isUniqueViolation(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error || '')
  return /unique constraint failed/i.test(raw) || /SQLITE_CONSTRAINT_UNIQUE/i.test(raw)
}

/**
 * Kembalikan baris yang sudah ada hanya jika error memang pelanggaran UNIQUE
 * dan baris tersimpan benar-benar mewakili permintaan yang sama. Selain itu
 * `null`, agar pemanggil melaporkan kegagalan yang sebenarnya.
 */
export async function duplicateOf<T>(
  error: unknown,
  lookup: () => Promise<T | null>,
  matches: (row: T) => boolean = () => true,
): Promise<T | null> {
  if (!isUniqueViolation(error)) return null
  const existing = await lookup().catch(() => null)
  if (!existing || !matches(existing)) return null
  return existing
}
