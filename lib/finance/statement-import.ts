// lib/finance/statement-import.ts
// Impor manual rekening koran (CSV dari internet banking) → tabel statement yang sama dengan jalur API.
//
// Mengapa lewat persistBankStatementTransactions: semua guard evidence (dedup STRONG, trigger settlement,
// immutability baris, status fetch SUCCESS + cursor_advanced) tetap berlaku. Impor ini hanya MENGGANTI SUMBER DATA
// dari BRIAPI menjadi berkas; ia tidak melonggarkan aturan apa pun:
//   • settlement dari baris impor selalu MANUAL_RESOLVED (admin/bendahara + catatan + reconciliation item);
//   • PAID != SETTLED tetap berlaku; impor TIDAK mengubah status payment.
//
// Integritas berkas (salah satu wajib):
//   • rantai saldo terverifikasi dari kolom saldo awal/akhir per baris (format IBIZ BRI) — otomatis; atau
//   • operator mengetik jumlah baris kredit & total kredit sesuai tampilan internet banking.
// Tidak lolos → seluruh impor ditolak, tidak ada yang tersimpan.
import crypto from 'node:crypto'
import { query } from '@/lib/db'
import { persistBankStatementTransactions } from './bank-statement/statement-ingest'
import type { StatementIngestSummary } from './bank-statement/statement-ingest'
import type { BriBankStatementDetailData, BriBankStatementResponse } from './bank-statement/statement-types'
import { getCollectionAccountNo } from './collection-account'
import {
  MAX_STATEMENT_CSV_CHARS,
  detectStatementLayout,
  parseCsv,
  parseStatementRows,
  type StatementColumnMapping,
  type StatementDateOrder,
  type StatementParseError,
  type ParsedStatementLine,
} from './statement-csv'

export const MANUAL_IMPORT_RESPONSE_CODE = '2001400' // kode sukses yang dipahami persistBankStatementTransactions
export const MANUAL_IMPORT_MESSAGE_PREFIX = 'MANUAL_IMPORT'

export interface StatementImportInput {
  csvText: string
  filename: string
  mapping?: StatementColumnMapping
  headerRowIndex?: number
  dateOrder?: StatementDateOrder
}

export interface StatementImportPreview {
  ok: boolean
  accountNoMasked: string
  headers: string[]
  headerRowIndex: number
  mapping: Partial<StatementColumnMapping>
  sampleRows: string[][]
  columnCount: number
  errors: StatementParseError[]
  ignoredRows: number
  creditCount: number
  creditTotal: number
  debitCount: number
  debitTotal: number
  fromDate: string | null
  toDate: string | null
  alreadyImportedCount: number
  /** true bila rantai saldo berkas terverifikasi sehingga total manual tidak diperlukan. */
  balanceVerified: boolean
  preview: Array<{ row: number; date: string; type: 'CREDIT' | 'DEBIT'; amount: number; remark: string }>
}

function collectionAccountNo(): string {
  const accountNo = getCollectionAccountNo()
  if (!accountNo) throw new Error('Rekening collection belum dikonfigurasi.')
  return accountNo
}

function maskAccountNo(accountNo: string): string {
  return accountNo.length <= 4 ? '****' : `${'*'.repeat(accountNo.length - 4)}${accountNo.slice(-4)}`
}

function assertCsvSize(csvText: string) {
  if (typeof csvText !== 'string' || csvText.trim() === '') throw new Error('Berkas CSV kosong.')
  if (csvText.length > MAX_STATEMENT_CSV_CHARS) throw new Error('Berkas CSV terlalu besar (maks ±900 KB).')
}

function resolveLayout(input: StatementImportInput) {
  const { rows } = parseCsv(input.csvText)
  const detected = detectStatementLayout(rows)
  const headerRowIndex = input.headerRowIndex ?? detected.headerRowIndex
  const mapping = (input.mapping ?? detected.mapping) as Partial<StatementColumnMapping>
  return { rows, detected, headerRowIndex, mapping }
}

async function countAlreadyImported(accountNo: string, lines: ParsedStatementLine[]): Promise<number> {
  let existing = 0
  const ids = lines.map((l) => l.transactionId)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const rows = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM finance_bri_statement_transactions
       WHERE account_no = ? AND identity_strength = 'STRONG' AND transaction_id IN (${chunk.map(() => '?').join(',')})`,
      [accountNo, ...chunk]
    )
    existing += rows[0]?.n ?? 0
  }
  return existing
}

/** Pratinjau tanpa menulis apa pun. */
export async function previewStatementImport(input: StatementImportInput): Promise<StatementImportPreview> {
  assertCsvSize(input.csvText)
  const accountNo = collectionAccountNo()
  const { rows, detected, headerRowIndex, mapping } = resolveLayout(input)
  const columnCount = rows.reduce((w, r) => Math.max(w, r.length), 0)

  const base = {
    accountNoMasked: maskAccountNo(accountNo),
    headers: rows[headerRowIndex] ?? detected.headers,
    headerRowIndex,
    mapping,
    sampleRows: rows.slice(0, Math.min(rows.length, Math.max(headerRowIndex + 1, 0) + 6)),
    columnCount,
  }

  const complete = mapping.date !== undefined && (mapping.amount !== undefined || (mapping.credit !== undefined && mapping.debit !== undefined))
  if (!complete) {
    return {
      ...base, ok: false,
      errors: [{ row: 0, message: 'Kolom belum dikenali otomatis. Pilih kolom Tanggal dan Kredit/Debit (atau Nominal).' }],
      ignoredRows: 0, creditCount: 0, creditTotal: 0, debitCount: 0, debitTotal: 0,
      fromDate: null, toDate: null, alreadyImportedCount: 0, balanceVerified: false, preview: [],
    }
  }

  const parsed = parseStatementRows(rows, mapping as StatementColumnMapping, {
    headerRowIndex, dateOrder: input.dateOrder ?? 'DMY',
  }, accountNo)
  const ok = parsed.errors.length === 0
  return {
    ...base,
    ok,
    errors: parsed.errors.slice(0, 20),
    ignoredRows: parsed.ignoredRows,
    creditCount: parsed.creditCount,
    creditTotal: parsed.creditTotal,
    debitCount: parsed.debitCount,
    debitTotal: parsed.debitTotal,
    fromDate: parsed.fromDateTime?.slice(0, 10) ?? null,
    toDate: parsed.toDateTime?.slice(0, 10) ?? null,
    alreadyImportedCount: ok ? await countAlreadyImported(accountNo, parsed.lines) : 0,
    balanceVerified: ok && parsed.balanceChain === 'VERIFIED',
    preview: parsed.lines.slice(0, 8).map((l) => ({ row: l.rowNumber, date: l.transactionDate, type: l.type, amount: l.amount, remark: l.remark })),
  }
}

function toDetail(line: ParsedStatementLine): BriBankStatementDetailData {
  const detail: BriBankStatementDetailData = {
    transactionId: line.transactionId,
    amount: { value: `${line.amount}.00`, currency: 'IDR' },
    type: line.type,
    transactionDate: line.transactionDate,
    remark: line.remark,
  }
  if (line.balance !== null) {
    detail.detailBalance = { endAmount: [{ amount: { value: `${line.balance}.00`, currency: 'IDR' } }] }
  }
  return detail
}

export interface StatementImportConfirm extends StatementImportInput {
  /** Diketik operator dari tampilan internet banking: jumlah mutasi KREDIT. Wajib bila rantai saldo tidak tersedia. */
  expectedCreditCount?: number
  /** Diketik operator: total nominal mutasi KREDIT (Rupiah bulat). Wajib bila rantai saldo tidak tersedia. */
  expectedCreditTotal?: number
  importedBy: string
}

export async function importManualBankStatement(input: StatementImportConfirm): Promise<StatementIngestSummary> {
  assertCsvSize(input.csvText)
  const accountNo = collectionAccountNo()
  if (!input.importedBy) throw new Error('Operator tidak dikenali.')
  const { rows, headerRowIndex, mapping } = resolveLayout(input)
  const parsed = parseStatementRows(rows, mapping as StatementColumnMapping, {
    headerRowIndex, dateOrder: input.dateOrder ?? 'DMY',
  }, accountNo)
  if (parsed.errors.length > 0) {
    throw new Error(`Berkas tidak dapat diimpor: ${parsed.errors[0].row > 0 ? `baris ${parsed.errors[0].row}: ` : ''}${parsed.errors[0].message}`)
  }
  const balanceVerified = parsed.balanceChain === 'VERIFIED'
  const typed = input.expectedCreditCount !== undefined || input.expectedCreditTotal !== undefined
  if (!balanceVerified || typed) {
    const count = input.expectedCreditCount
    const total = input.expectedCreditTotal
    if (count === undefined || total === undefined || !Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(total) || total < 0) {
      throw new Error('Jumlah dan total kredit dari internet banking wajib diisi dengan angka bulat.')
    }
    if (parsed.creditCount !== count || parsed.creditTotal !== total) {
      throw new Error(
        `Total kredit tidak cocok dengan internet banking (berkas: ${parsed.creditCount} baris / Rp${parsed.creditTotal.toLocaleString('id-ID')}; ` +
        `Anda mengisi: ${count} baris / Rp${total.toLocaleString('id-ID')}). Tidak ada data yang disimpan.`
      )
    }
  }
  const nowMs = Date.now()
  if (parsed.lines.some((l) => Date.parse(l.transactionDate) > nowMs + 24 * 3600 * 1000)) {
    throw new Error('Berkas memuat tanggal di masa depan. Periksa format tanggal (DD/MM vs MM/DD).')
  }
  if (!parsed.fromDateTime || !parsed.toDateTime) throw new Error('Rentang tanggal berkas tidak dapat ditentukan.')

  const fileHash = crypto.createHash('sha256').update(input.csvText, 'utf8').digest('hex')
  const safeName = input.filename.replace(/[^\w.\- ]/g, '_').slice(0, 80)
  const response: BriBankStatementResponse = {
    responseCode: MANUAL_IMPORT_RESPONSE_CODE,
    responseMessage: `${MANUAL_IMPORT_MESSAGE_PREFIX} user=${input.importedBy} file=${safeName} sha256=${fileHash.slice(0, 16)} integrity=${balanceVerified ? 'BALANCE_CHAIN' : 'OPERATOR_TOTALS'}`,
    accountNo,
    totalCreditEntries: { numberOfEntries: String(parsed.creditCount), amount: { value: `${parsed.creditTotal}.00`, currency: 'IDR' } },
    totalDebitEntries: { numberOfEntries: String(parsed.debitCount), amount: { value: `${parsed.debitTotal}.00`, currency: 'IDR' } },
    detailData: parsed.lines.map(toDetail),
  }
  const summary = await persistBankStatementTransactions({
    accountNo,
    fromDateTime: parsed.fromDateTime,
    toDateTime: parsed.toDateTime,
    response,
    rawResponseJson: JSON.stringify(response),
  })
  if (!summary.cursorAdvanced) {
    throw new Error('Impor ditolak oleh pemeriksaan integritas statement. Tidak ada transaksi yang tersimpan.')
  }
  return summary
}
