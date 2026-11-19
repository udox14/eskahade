'use server'

import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import {
  importManualBankStatement,
  previewStatementImport,
  type StatementImportInput,
  type StatementImportPreview,
} from '@/lib/finance/statement-import'
import type { StatementColumnMapping, StatementDateOrder } from '@/lib/finance/statement-csv'

// Sama seperti penyelesaian settlement (MANUAL_RESOLVED): hanya admin & bendahara.
async function operator() {
  const auth = await authorizeFinanceFeature('/dashboard/keuangan/rekonsiliasi', true)
  if (!auth.roles.some((r) => ['admin', 'bendahara'].includes(r))) throw new Error('FORBIDDEN')
  return auth.session
}

interface ImportPayload {
  csvText: string
  filename: string
  mapping?: StatementColumnMapping
  headerRowIndex?: number
  dateOrder?: StatementDateOrder
}

function clean(input: ImportPayload): StatementImportInput {
  return {
    csvText: String(input.csvText ?? ''),
    filename: String(input.filename ?? 'mutasi.csv'),
    mapping: input.mapping,
    headerRowIndex: typeof input.headerRowIndex === 'number' ? input.headerRowIndex : undefined,
    dateOrder: input.dateOrder === 'MDY' ? 'MDY' : 'DMY',
  }
}

export async function previewStatementImportAction(input: ImportPayload): Promise<StatementImportPreview> {
  await operator()
  return previewStatementImport(clean(input))
}

export async function confirmStatementImportAction(
  input: ImportPayload & { expectedCreditCount?: number; expectedCreditTotal?: number }
) {
  const user = await operator()
  const summary = await importManualBankStatement({
    ...clean(input),
    expectedCreditCount: input.expectedCreditCount === undefined ? undefined : Number(input.expectedCreditCount),
    expectedCreditTotal: input.expectedCreditTotal === undefined ? undefined : Number(input.expectedCreditTotal),
    importedBy: user.id,
  })
  return {
    newTransactionsCount: summary.newTransactionsCount,
    dedupedCount: summary.dedupedCount,
    creditsCount: summary.creditsCount,
    creditsTotalAmount: summary.creditsTotalAmount,
  }
}
