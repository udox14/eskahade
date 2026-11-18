'use server'

// Pengaturan Jalur Pembayaran: mode BRIVA/Transfer, rekening tujuan, biaya admin transfer,
// kode unik, batas unggah bukti, dan pembagian tugas petugas verifikasi per asrama.

import { revalidatePath } from 'next/cache'
import { batch, generateId, now, query, queryOne } from '@/lib/db'
import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import { financeWritePlan } from '@/lib/finance/write-plan'
import { COOPERATIVE_FEE_CODES, getEffectiveCooperativeAdminFee, setCooperativeAdminFeeRule } from '@/lib/finance/cooperative-admin'
import {
  getTransferSettings,
  listTransferAccounts,
  parseChannelMode,
  TRANSFER_SETTING_KEYS,
  UNIQUE_CODE_MAX_LIMIT,
  UNIQUE_CODE_MIN_LIMIT,
  type PaymentChannelMode,
  type TransferAccount,
} from '@/lib/finance/transfer-config'
import { rupiah } from '@/lib/finance/money'
import { getEffectiveRoles } from '@/lib/auth/session'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'
import { isAsramaBebasTagihan } from '@/lib/finance/non-billable-santri'

const FEATURE = '/dashboard/keuangan/tarif'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

async function authorizeConfig() {
  const { session, roles } = await authorizeFinanceFeature(FEATURE, true)
  if (!roles.some(role => role === 'admin' || role === 'admin_koperasi')) {
    throw new Error('Pengaturan jalur pembayaran hanya dapat diubah oleh Admin atau Admin Koperasi.')
  }
  return session
}

function fail(error: unknown): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message.replace(/^FORBIDDEN:\s*/, '') : 'Terjadi kesalahan.' }
}

export interface VerifierCandidate {
  id: string
  full_name: string
  role: string
  asrama: string[]
}

export interface PaymentChannelSettingsData {
  mode: PaymentChannelMode
  brivaGateOpen: boolean
  transferFee: number
  brivaFee: number
  uniqueCodeMax: number
  proofDeadlineHours: number
  feeDeductEnabled: boolean
  accounts: TransferAccount[]
  verifiers: VerifierCandidate[]
  asramaOptions: string[]
  canConfigure: boolean
}

export async function getPaymentChannelSettingsAction(): Promise<PaymentChannelSettingsData> {
  const { session, roles } = await authorizeFinanceFeature(FEATURE, false)
  const [settings, accounts, transferFee, brivaFee, users, scopes] = await Promise.all([
    getTransferSettings(),
    listTransferAccounts(),
    getEffectiveCooperativeAdminFee(COOPERATIVE_FEE_CODES.TRANSFER, new Date().toISOString(), 'TRANSFER'),
    getEffectiveCooperativeAdminFee(),
    query<{ id: string; full_name: string; role: string; roles: string | null }>(
      `SELECT id, full_name, role, roles FROM users
       WHERE role IN ('admin_koperasi','petugas_koperasi','bendahara')
          OR roles LIKE '%petugas_koperasi%' OR roles LIKE '%admin_koperasi%'
       ORDER BY full_name LIMIT 200`),
    query<{ user_id: string; asrama: string }>(`SELECT user_id, asrama FROM finance_transfer_verifier_scopes ORDER BY asrama`),
  ])
  const byUser = new Map<string, string[]>()
  for (const scope of scopes) byUser.set(scope.user_id, [...(byUser.get(scope.user_id) || []), scope.asrama])
  return {
    mode: settings.channelMode,
    brivaGateOpen: process.env.FEATURE_FLAG_BRIVA_ONLINE === 'true',
    transferFee,
    brivaFee,
    uniqueCodeMax: settings.uniqueCodeMax,
    proofDeadlineHours: settings.proofDeadlineHours,
    feeDeductEnabled: settings.feeDeductEnabled,
    accounts,
    verifiers: users.map(user => ({ id: user.id, full_name: user.full_name, role: user.role, asrama: byUser.get(user.id) || [] })),
    asramaOptions: ALL_ASRAMA_LIST.filter(asrama => !isAsramaBebasTagihan(asrama)),
    canConfigure: getEffectiveRoles(session).some(role => role === 'admin' || role === 'admin_koperasi') && !roles.includes('pimpinan'),
  }
}

export async function savePaymentChannelSettingsAction(input: {
  mode: PaymentChannelMode
  transferFee: number
  uniqueCodeMax: number
  proofDeadlineHours: number
  feeDeductEnabled: boolean
}): Promise<Result> {
  try {
    const session = await authorizeConfig()
    const mode = parseChannelMode(input.mode)
    if (mode !== input.mode) throw new Error('Mode jalur pembayaran tidak valid.')
    const fee = rupiah(input.transferFee, 'Biaya admin transfer', true)
    if (fee > 100000) throw new Error('Biaya admin transfer maksimal Rp100.000.')
    const uniqueMax = rupiah(input.uniqueCodeMax, 'Batas kode unik')
    if (uniqueMax < UNIQUE_CODE_MIN_LIMIT || uniqueMax > UNIQUE_CODE_MAX_LIMIT) {
      throw new Error(`Batas kode unik harus antara ${UNIQUE_CODE_MIN_LIMIT} dan ${UNIQUE_CODE_MAX_LIMIT}.`)
    }
    const deadline = rupiah(input.proofDeadlineHours, 'Batas waktu unggah')
    if (deadline < 1 || deadline > 168) throw new Error('Batas waktu unggah bukti harus 1–168 jam.')
    if (mode !== 'BRIVA') {
      const active = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM finance_transfer_accounts WHERE is_active = 1`)
      if (!active?.n) throw new Error('Tambahkan minimal satu rekening tujuan aktif sebelum mengaktifkan transfer.')
    }
    const plan = financeWritePlan()
    const currentFee = await getEffectiveCooperativeAdminFee(COOPERATIVE_FEE_CODES.TRANSFER, new Date().toISOString(), 'TRANSFER')
    if (currentFee !== fee) {
      await setCooperativeAdminFeeRule({
        channel: 'TRANSFER', name: 'Biaya Admin Koperasi Transfer Manual', amount: fee, isEnabled: fee > 0, createdBy: session.id,
      }, plan)
    }
    const timestamp = now()
    const values: Array<[string, string]> = [
      [TRANSFER_SETTING_KEYS.channelMode, mode],
      [TRANSFER_SETTING_KEYS.uniqueCodeMax, String(uniqueMax)],
      [TRANSFER_SETTING_KEYS.proofDeadlineHours, String(deadline)],
      [TRANSFER_SETTING_KEYS.feeDeductEnabled, input.feeDeductEnabled ? '1' : '0'],
    ]
    for (const [key, value] of values) {
      plan.statements.push({
        sql: `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        params: [key, value, timestamp],
      })
    }
    await batch(plan.statements)
    revalidatePath(FEATURE)
    revalidatePath('/portal-ortu/tagihan')
    return { success: true }
  } catch (error) { return fail(error) }
}

function cleanAccount(input: { bankName: string; accountNumber: string; accountHolder: string; notes?: string | null }) {
  const bankName = String(input.bankName || '').trim().slice(0, 60)
  const accountNumber = String(input.accountNumber || '').replace(/[\s.-]/g, '')
  const accountHolder = String(input.accountHolder || '').trim().slice(0, 80)
  if (bankName.length < 2) throw new Error('Nama bank wajib diisi.')
  if (!/^\d{5,25}$/.test(accountNumber)) throw new Error('Nomor rekening harus berupa angka (5–25 digit).')
  if (accountHolder.length < 3) throw new Error('Nama pemilik rekening wajib diisi.')
  return { bankName, accountNumber, accountHolder, notes: String(input.notes || '').trim().slice(0, 160) || null }
}

export async function saveTransferAccountAction(input: {
  id?: string | null
  bankName: string
  accountNumber: string
  accountHolder: string
  notes?: string | null
  sortOrder?: number
}): Promise<Result> {
  try {
    const session = await authorizeConfig()
    const clean = cleanAccount(input)
    const sortOrder = Number.isSafeInteger(input.sortOrder) ? Math.max(0, Math.min(999, input.sortOrder as number)) : 0
    const timestamp = now()
    if (input.id) {
      // Orders and submissions keep their own snapshot, so editing never changes history.
      await batch([{
        sql: `UPDATE finance_transfer_accounts SET bank_name = ?, account_number = ?, account_holder = ?, notes = ?, sort_order = ?,
                updated_by = ?, updated_at = ? WHERE id = ?`,
        params: [clean.bankName, clean.accountNumber, clean.accountHolder, clean.notes, sortOrder, session.id, timestamp, input.id],
      }])
    } else {
      await batch([{
        sql: `INSERT INTO finance_transfer_accounts (id, bank_name, account_number, account_holder, notes, is_active, sort_order,
                created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        params: [generateId(), clean.bankName, clean.accountNumber, clean.accountHolder, clean.notes, sortOrder, session.id, timestamp, session.id, timestamp],
      }])
    }
    revalidatePath(FEATURE)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('UNIQUE')) return { success: false, error: 'Rekening dengan bank dan nomor yang sama sudah ada.' }
    return fail(error)
  }
}

export async function setTransferAccountActiveAction(id: string, active: boolean): Promise<Result> {
  try {
    const session = await authorizeConfig()
    if (!active) {
      const mode = (await getTransferSettings()).channelMode
      const remaining = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM finance_transfer_accounts WHERE is_active = 1 AND id != ?`, [id])
      if (mode !== 'BRIVA' && !remaining?.n) throw new Error('Minimal satu rekening harus aktif selama jalur transfer aktif.')
    }
    await batch([{ sql: `UPDATE finance_transfer_accounts SET is_active = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
      params: [active ? 1 : 0, session.id, now(), id] }])
    revalidatePath(FEATURE)
    return { success: true }
  } catch (error) { return fail(error) }
}

export async function saveVerifierScopesAction(input: { userId: string; asrama: string[] }): Promise<Result> {
  try {
    const session = await authorizeConfig()
    const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = ?`, [input.userId])
    if (!user) throw new Error('Petugas tidak ditemukan.')
    const allowed = new Set<string>(ALL_ASRAMA_LIST.filter(asrama => !isAsramaBebasTagihan(asrama)))
    const asrama = [...new Set(input.asrama.map(a => String(a).trim()))]
    if (asrama.some(a => !allowed.has(a))) throw new Error('Ada asrama yang tidak valid.')
    const timestamp = now()
    await batch([
      { sql: `DELETE FROM finance_transfer_verifier_scopes WHERE user_id = ?`, params: [input.userId] },
      ...asrama.map(a => ({
        sql: `INSERT INTO finance_transfer_verifier_scopes (user_id, asrama, created_by, created_at) VALUES (?, ?, ?, ?)`,
        params: [input.userId, a, session.id, timestamp] as unknown[],
      })),
    ])
    revalidatePath(FEATURE)
    revalidatePath('/dashboard/keuangan/verifikasi-transfer')
    return { success: true }
  } catch (error) { return fail(error) }
}
