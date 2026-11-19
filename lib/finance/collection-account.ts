// lib/finance/collection-account.ts
// Nomor rekening collection Koperasi (rekening yang menerima transfer wali & penyaluran manual).
// Netral terhadap penyedia: dipakai rekonsiliasi rekening koran (impor CSV maupun API) dan penyaluran.
// Env: FINANCE_COLLECTION_ACCOUNT_NO (disarankan) atau BRI_COLLECTION_ACCOUNT_NO (nama lama, tetap didukung).

/** Mengembalikan nomor rekening (trim) atau string kosong bila belum dikonfigurasi. Pemanggil wajib fail-closed. */
export function getCollectionAccountNo(): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return (process.env.FINANCE_COLLECTION_ACCOUNT_NO || process.env.BRI_COLLECTION_ACCOUNT_NO || '').trim()
}
