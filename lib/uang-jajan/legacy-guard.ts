// Uang Jajan kini dikelola ledger Koperasi (finance_wallet_ledger): setor/bayar di Loket,
// isi online via transfer/BRIVA, dan pencairan via perwakilan asrama.
// Modul lama (tabungan_log + auto-potong) menulis santri.saldo_uang_jajan langsung di luar
// ledger sehingga bisa memotong dua kali. Tulis ke dompet JAJAN lama dimatikan; dompet
// Tabungan tidak terpengaruh. Dapat diaktifkan ulang hanya dengan app_settings
// legacy_uang_jajan_writes_enabled = '1' (keputusan eksplisit admin).

export const LEGACY_JAJAN_DISABLED_MESSAGE =
  'Uang jajan kini dikelola Koperasi. Gunakan Loket Kasir untuk setoran dan menu Pencairan Uang Jajan untuk pencairan.'

type Reader = { prepare(sql: string): { first<T>(): Promise<T | null> } }

export async function legacyJajanWritesEnabledWith(db: Reader): Promise<boolean> {
  const row = await db.prepare(`SELECT value FROM app_settings WHERE key = 'legacy_uang_jajan_writes_enabled'`).first<{ value: string }>().catch(() => null)
  return row?.value === '1'
}

export async function legacyJajanWritesEnabled(): Promise<boolean> {
  const { queryOne } = await import('@/lib/db')
  const row = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'legacy_uang_jajan_writes_enabled'`).catch(() => null)
  return row?.value === '1'
}
