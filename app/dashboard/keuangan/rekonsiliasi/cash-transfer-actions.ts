'use server'

import { revalidatePath } from 'next/cache'
import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import { getCashTransferReconciliation, linkCashTransferToStatement } from '@/lib/finance/cash-transfers'

const PATH = '/dashboard/keuangan/rekonsiliasi'

export async function getCashTransferReconciliationAction() {
  await authorizeFinanceFeature(PATH)
  return getCashTransferReconciliation()
}

/** Hasil dikembalikan (bukan dilempar) agar alasan penolakan tetap terbaca di produksi. */
export async function linkCashTransferAction(input: {
  cashTransferId: string
  statementTransactionId: string
  notes: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { session, roles } = await authorizeFinanceFeature(PATH, true)
    if (!roles.some(role => role === 'admin' || role === 'bendahara')) {
      throw new Error('Pencocokan mutasi kas hanya dapat dilakukan Admin atau Bendahara.')
    }
    await linkCashTransferToStatement(session.id, input)
    revalidatePath(PATH)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.'
    return { success: false, error: message.replace(/^(FORBIDDEN|UNAUTHORIZED):\s*/, '') }
  }
}
