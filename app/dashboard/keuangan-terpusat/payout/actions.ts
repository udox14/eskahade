'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery as query, financeQueryOne } from '@/lib/db'
import { financeAsramaScope, financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import { approvePayout, cancelPayout, createPayoutRequest, payApiPayout, payManualPayout, registerFinanceRecipient, verifyFinanceRecipient } from '@/lib/finance/payouts'
import { bulkIdempotencyKey, runBulk } from '@/lib/finance/bulk'

const PATH = '/dashboard/keuangan-terpusat/payout'

/** Biaya payout API diambil dari pengaturan runtime agar checker menyetujui angka yang sama dengan yang dibukukan. */
async function apiFeeRupiah(): Promise<number> {
  const setting = await financeQueryOne<{ value: string }>(`SELECT value FROM finance_settings WHERE key='finance_payout_api_fee_rupiah'`)
  const value = Number(setting?.value ?? 2500)
  return Number.isSafeInteger(value) && value >= 0 ? value : 2500
}

export async function getPayoutFeeAction(method: 'API'|'MANUAL_TRANSFER'|'CASH') {
  await requireFinanceAccess('VIEW')
  return { feeRupiah: method === 'API' ? await apiFeeRupiah() : 0 }
}

export async function createPayoutAction(input: { recipientId: string; payoutType: 'MEAL'|'LAUNDRY'|'PAYROLL'|'REFUND'|'OTHER'; amountRupiah: number; method: 'API'|'MANUAL_TRANSFER'|'CASH'; requestKey: string }) {
  const session = await requireFinanceAccess('CREATE')
  const result = await createPayoutRequest({ ...input, feeRupiah: input.method==='API'?await apiFeeRupiah():0, idempotencyKey: input.requestKey, makerId: session.id, asramaScope: financeAsramaScope(session) })
  if (result.success) revalidatePath(PATH); return result
}
export async function approvePayoutAction(id: string) { const s = await requireFinanceAccess('CHECK'); const r = await approvePayout(id,s.id); if(r.success)revalidatePath(PATH); return r }
export async function payPayoutAction(input: { id: string; reference: string }) { const s=await requireFinanceAccess('CHECK'); const r=await payManualPayout({payoutId:input.id,actorId:s.id,bankReference:input.reference}); if(r.success)revalidatePath(PATH); return r }
export async function payApiPayoutAction(id:string){const s=await requireFinanceAccess('CHECK');const r=await payApiPayout({payoutId:id,actorId:s.id});if(r.success)revalidatePath(PATH);return r}
export async function cancelPayoutAction(input:{id:string;reason:string}) { const s=await requireFinanceAccess('CHECK'); const r=await cancelPayout(input.id,s.id,input.reason); if(r.success)revalidatePath(PATH); return r }
export async function registerRecipientAction(input:{recipientType:'MEAL_MANAGER'|'LAUNDRY_MANAGER'|'TEACHER'|'OTHER';name:string;bankCode:string;accountNumber:string;accountHolderName:string}){const s=await requireFinanceAccess('CONFIGURE');const r=await registerFinanceRecipient({...input,asramaScope:financeAsramaScope(s),actorId:s.id});if(r.success)revalidatePath(PATH);return r}
export async function verifyRecipientAction(id:string){const s=await requireFinanceAccess('CHECK');const r=await verifyFinanceRecipient(id,s.id);if(r.success)revalidatePath(PATH);return r}

/** Satu baris template rekening penerima; dipakai bersama oleh UI dan action ini. */
export type RecipientImportRow = {
  row: number; recipientType: 'MEAL_MANAGER'|'LAUNDRY_MANAGER'|'TEACHER'|'OTHER'
  name: string; bankCode: string; accountNumber: string; accountHolderName: string
}

export type PayoutImportRow = {
  row: number; recipientId: string; payoutType: 'MEAL'|'LAUNDRY'|'PAYROLL'|'REFUND'|'OTHER'
  amountRupiah: number; method: 'API'|'MANUAL_TRANSFER'|'CASH'
}

/** Impor massal rekening penerima. Verifikasi oleh petugas lain tetap berlaku per rekening. */
export async function importRecipientsAction(rows: RecipientImportRow[]) {
  const session = await requireFinanceAccess('CONFIGURE')
  const scope = financeAsramaScope(session)
  const summary = await runBulk(rows, item => registerFinanceRecipient({
    recipientType: item.recipientType,
    name: item.name,
    bankCode: item.bankCode,
    accountNumber: item.accountNumber,
    accountHolderName: item.accountHolderName,
    asramaScope: scope,
    actorId: session.id,
  }))
  if (summary.success && summary.created) revalidatePath(PATH)
  return summary
}

/** Impor massal pengajuan payout. Maker tetap Anda; pemeriksa dan pelaksana tetap harus orang lain. */
export async function importPayoutsAction(rows: PayoutImportRow[]) {
  const session = await requireFinanceAccess('CREATE')
  const scope = financeAsramaScope(session)
  const fee = await apiFeeRupiah()
  const summary = await runBulk(rows, item => createPayoutRequest({
    recipientId: item.recipientId,
    payoutType: item.payoutType,
    amountRupiah: item.amountRupiah,
    method: item.method,
    feeRupiah: item.method === 'API' ? fee : 0,
    idempotencyKey: bulkIdempotencyKey('payout', item.row, [item.recipientId, item.payoutType, item.amountRupiah, item.method]),
    makerId: session.id,
    asramaScope: scope,
  }))
  if (summary.success && summary.created) revalidatePath(PATH)
  return summary
}

/** Menyetujui beberapa pencairan sekaligus; tiap baris tetap melewati pemeriksaan server satu per satu. */
export async function approvePayoutsAction(ids: string[]) {
  const session = await requireFinanceAccess('CHECK')
  const summary = await runBulk(ids.map((id, index) => ({ row: index + 1, id })), item => approvePayout(item.id, session.id))
  if (summary.success && summary.created) revalidatePath(PATH)
  return summary
}

export async function getPayoutData() {
  const session = await requireFinanceAccess('VIEW'); const scope=financeAsramaScope(session)
  const recipients=await query<any>(`SELECT id,name,recipient_type,asrama_scope,account_number_masked,status,verified_at FROM finance_recipients WHERE 1=1 ${scope?'AND asrama_scope=?':''} ORDER BY name`,scope?[scope]:[])
  const payouts=await query<any>(`SELECT p.*,r.name recipient_name FROM finance_payouts p JOIN finance_recipients r ON r.id=p.recipient_id WHERE 1=1 ${scope?'AND p.asrama_scope=?':''} ORDER BY p.created_at DESC LIMIT 100`,scope?[scope]:[])
  // nowMs dikirim dari server agar klien tidak memanggil Date.now() saat render.
  return {recipients,payouts,apiFeeRupiah:await apiFeeRupiah(),capabilities:await financeCapabilities(session),nowMs:Date.now()}
}
