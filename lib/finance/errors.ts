const FRIENDLY: Record<string, string> = {
  FINANCE_PERIOD_CLOSED: 'Periode pembukuan sudah ditutup.',
  FINANCE_JOURNAL_UNBALANCED: 'Jurnal tidak seimbang dan transaksi dibatalkan.',
  FINANCE_JOURNAL_IMMUTABLE: 'Jurnal yang sudah diposting tidak dapat diubah. Gunakan reversal.',
  FINANCE_ENTRY_IMMUTABLE: 'Baris jurnal bersifat permanen.',
  FINANCE_ACCOUNT_NEGATIVE: 'Transaksi akan membuat saldo akun negatif.',
  FINANCE_WALLET_INSUFFICIENT: 'Saldo santri tidak mencukupi.',
  FINANCE_WALLET_FROZEN: 'Akun keuangan santri sedang dibekukan.',
  FINANCE_SHIFT_NOT_OPEN: 'Shift kas tidak aktif.',
  FINANCE_SHIFT_OPERATOR_MISMATCH: 'Shift kas bukan milik operator ini.',
  FINANCE_WITHDRAWAL_CAP_EXCEEDED: 'Nominal melampaui batas per transaksi.',
  FINANCE_WITHDRAWAL_DENOMINATION: 'Nominal tidak sesuai kelipatan pencairan.',
  FINANCE_DAILY_LIMIT_EXCEEDED: 'Limit pencairan harian telah tercapai.',
  FINANCE_WEEKLY_LIMIT_EXCEEDED: 'Limit pencairan mingguan telah tercapai.',
  FINANCE_MONTHLY_LIMIT_EXCEEDED: 'Limit pencairan bulanan telah tercapai.',
  FINANCE_SELF_APPROVAL_FORBIDDEN: 'Pembuat transaksi tidak boleh menyetujui transaksi sendiri.',
  FINANCE_SELF_EXECUTION_FORBIDDEN: 'Eksekutor harus berbeda dari maker dan checker.',
}

export function financeError(error: unknown): { error: string; code?: string } {
  const raw = error instanceof Error ? error.message : String(error || '')
  const code = Object.keys(FRIENDLY).find(key => raw.includes(key))
  if (code) return { error: FRIENDLY[code], code }
  if (/unique constraint|constraint failed.*unique/i.test(raw)) {
    return { error: 'Transaksi yang sama sudah pernah diproses.', code: 'FINANCE_DUPLICATE' }
  }
  console.error('[finance]', raw)
  return { error: 'Transaksi keuangan gagal diproses dengan aman.' }
}

export function assertIntegerRupiah(value: number, label = 'Nominal'): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} harus berupa rupiah bulat lebih dari nol.`)
}
