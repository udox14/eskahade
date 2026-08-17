/**
 * Kode bank 3 digit untuk pendaftaran rekening penerima payout.
 *
 * Daftar ini sengaja dibatasi pada bank yang lazim dipakai di lingkungan
 * pesantren dan yang kodenya pasti. Salah kode berarti dana terkirim ke bank
 * yang salah, jadi bank di luar daftar TIDAK ditebak — pengguna memilih
 * "Bank lain" lalu mengisi kodenya sendiri dari buku tabungan atau mBanking.
 */
export const BANK_CODES = [
  { code: '014', name: 'BCA' },
  { code: '002', name: 'BRI' },
  { code: '008', name: 'Mandiri' },
  { code: '009', name: 'BNI' },
  { code: '451', name: 'Bank Syariah Indonesia (BSI)' },
  { code: '110', name: 'Bank BJB' },
  { code: '200', name: 'BTN' },
  { code: '011', name: 'Danamon' },
  { code: '013', name: 'Permata' },
  { code: '016', name: 'Maybank Indonesia' },
  { code: '019', name: 'Panin' },
  { code: '022', name: 'CIMB Niaga' },
  { code: '023', name: 'UOB Indonesia' },
  { code: '028', name: 'OCBC Indonesia' },
  { code: '111', name: 'Bank DKI' },
  { code: '147', name: 'Bank Muamalat' },
  { code: '153', name: 'Bank Sinarmas' },
  { code: '213', name: 'BTPN' },
  { code: '426', name: 'Bank Mega' },
  { code: '441', name: 'KB Bank (Bukopin)' },
] as const

/** Nilai penanda di dropdown; memunculkan isian kode manual. */
export const BANK_CODE_OTHER = 'LAIN'

export function bankLabel(code: string): string {
  const found = BANK_CODES.find(item => item.code === code)
  return found ? `${found.name} · ${found.code}` : code
}

/** Aturan yang sama dipakai server (`registerFinanceRecipient`) agar pesannya cocok dengan penolakannya. */
export function bankCodeProblem(code: string): string | null {
  return /^\d{3}$/.test(code.trim()) ? null : 'Kode bank harus tepat 3 angka.'
}

export function accountNumberProblem(account: string): string | null {
  const digits = account.replace(/\s/g, '')
  if (!digits) return 'Nomor rekening wajib diisi.'
  if (!/^\d+$/.test(digits)) return 'Nomor rekening hanya boleh berisi angka.'
  if (digits.length < 6 || digits.length > 24) return 'Nomor rekening harus 6–24 angka.'
  return null
}
