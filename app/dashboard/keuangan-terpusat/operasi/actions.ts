'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache'
import { financeQuery as query,queryOne } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'
import { createFinanceBill } from '@/lib/finance/billing'
import { closeFinancePeriod,approvePeriodReopen,reopenFinancePeriod } from '@/lib/finance/periods'
import { importBankStatement } from '@/lib/finance/reconciliation'
import { reconcileGatewaySettlement } from '@/lib/finance/settlement'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
const PATH='/dashboard/keuangan-terpusat/operasi'
export async function createBillAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),student=await queryOne<{id:string}>(`SELECT id FROM santri WHERE nis=? AND status_global='aktif'`,[String(form.get('nis')||'').trim()]);if(!student)return{error:'Santri tidak ditemukan.'};await syncFinanceStudentSnapshot(student.id);const r=await createFinanceBill({santriId:student.id,billKind:String(form.get('kind')) as 'SPP'|'USPP'|'NON_SPP',title:String(form.get('title')),periodKey:String(form.get('period')||'')||null,amountRupiah:Number(form.get('amount')),dueDate:String(form.get('dueDate')||'')||null,actorId:s.id});if(r.success)revalidatePath(PATH);return r}
export async function importBankAction(form:FormData){const s=await requireFinanceAccess('EXECUTE'),file=form.get('file');if(!(file instanceof File))return{error:'Pilih file CSV/XLS/XLSX.'};const r=await importBankStatement({file,bankAccountLabel:String(form.get('bankLabel')||'Rekening Utama'),actorId:s.id});if(r.success)revalidatePath(PATH);return r}
export async function closePeriodAction(form:FormData){const s=await requireFinanceAccess('EXECUTE'),r=await closeFinancePeriod(String(form.get('period')),s.id);if(r.success)revalidatePath(PATH);return r}
export async function approveReopenAction(form:FormData){const s=await requireFinanceAccess('CHECK'),r=await approvePeriodReopen(String(form.get('period')),s.id,String(form.get('reason')));if(r.success)revalidatePath(PATH);return r}
export async function reopenPeriodAction(form:FormData){const s=await requireFinanceAccess('EXECUTE'),r=await reopenFinancePeriod(String(form.get('period')),s.id,String(form.get('reason')));if(r.success)revalidatePath(PATH);return r}
export async function settlementAction(form:FormData){const s=await requireFinanceAccess('EXECUTE'),r=await reconcileGatewaySettlement({idempotencyKey:String(form.get('reference')),grossRupiah:Number(form.get('gross')),netRupiah:Number(form.get('net')),providerFeeRupiah:Number(form.get('fee')),bankReference:String(form.get('reference')),actorId:s.id,effectiveDate:String(form.get('date')||'')||undefined});if(r.success)revalidatePath(PATH);return r}
export async function getOperationsData(){await requireFinanceAccess('VIEW');return{periods:await query<any>(`SELECT p.*,(SELECT COUNT(*) FROM finance_period_reopen_approvals a WHERE a.period_key=p.period_key) approval_count FROM finance_periods p ORDER BY period_key DESC LIMIT 24`),imports:await query<any>(`SELECT * FROM finance_reconciliation_imports ORDER BY created_at DESC LIMIT 20`),bills:await query<any>(`SELECT b.*,s.nis,s.full_name nama_lengkap FROM finance_bills b JOIN finance_student_snapshots s ON s.santri_id=b.santri_id ORDER BY b.created_at DESC LIMIT 30`)}}
