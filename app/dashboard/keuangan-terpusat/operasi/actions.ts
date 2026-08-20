'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache'
import { financeQuery as query,query as mainQuery,queryOne } from '@/lib/db'
import { runBulk } from '@/lib/finance/bulk'
import { financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import { andExcludeAsramaSql } from '@/lib/finance/asrama'
import { createFinanceBill,voidFinanceBill } from '@/lib/finance/billing'
import { reviewLateTopup } from '@/lib/finance/payments'
import { closeFinancePeriod,financePeriodReadiness,reopenFinancePeriod } from '@/lib/finance/periods'
import { reconciliationChecks,reconciliationTargets,recordReconciliationCheck } from '@/lib/finance/reconciliation'
import { reconcileGatewaySettlement } from '@/lib/finance/settlement'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
import { AKUN_KAS_MASUK } from '@/lib/finance/postings'
const PATH='/dashboard/keuangan-terpusat/operasi'
function refreshOperations(){revalidatePath(PATH);revalidatePath('/dashboard/keuangan-terpusat')}
export async function createBillAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),student=await queryOne<{id:string}>(`SELECT id FROM santri WHERE nis=? AND status_global='aktif' ${andExcludeAsramaSql('asrama')}`,[String(form.get('nis')||'').trim()]);if(!student)return{error:'Santri tidak ditemukan.'};await syncFinanceStudentSnapshot(student.id);const r=await createFinanceBill({santriId:student.id,billKind:String(form.get('kind')) as 'SPP'|'USPP'|'NON_SPP',title:String(form.get('title')),periodKey:String(form.get('period')||'')||null,amountRupiah:Number(form.get('amount')),dueDate:String(form.get('dueDate')||'')||null,actorId:s.id});if(r.success)revalidatePath(PATH);return r}
export async function recordReconciliationAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await recordReconciliationCheck({
    periodKey:String(form.get('period')),
    bankAccountLabel:String(form.get('bankLabel')),
    systemTotalRupiah:Number(form.get('systemTotal')),
    statementTotalRupiah:Number(form.get('statementTotal')),
    note:String(form.get('note')||'')||null,
    actorId:s.id,
  })
  if(r.success)refreshOperations()
  return r
}
export async function closePeriodAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),r=await closeFinancePeriod(String(form.get('period')),s.id);if(r.success)revalidatePath(PATH);return r}
export async function reopenPeriodAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await reopenFinancePeriod({
    periodKey:String(form.get('period')),
    actorId:s.id,
    approvedBy:String(form.get('approvedBy')||''),
    reason:String(form.get('reason')),
  })
  if(r.success)revalidatePath(PATH)
  return r
}
export async function settlementAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),r=await reconcileGatewaySettlement({idempotencyKey:String(form.get('reference')),grossRupiah:Number(form.get('gross')),netRupiah:Number(form.get('net')),providerFeeRupiah:Number(form.get('fee')),bankReference:String(form.get('reference')),actorId:s.id,effectiveDate:String(form.get('date')||'')||undefined});if(r.success)revalidatePath(PATH);return r}
export async function reviewLateTopupAction(form:FormData){
  const s=await requireFinanceAccess('CHECK')
  const r=await reviewLateTopup({paymentIntentId:String(form.get('paymentIntentId')),actorId:s.id,note:String(form.get('note'))})
  if(r.success)refreshOperations()
  return r
}
export async function voidBillAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await voidFinanceBill(String(form.get('billId')),s.id,String(form.get('reason')))
  if(r.success)refreshOperations()
  return r
}
/**
 * Impor massal tagihan santri. NIS diterjemahkan ke santri di server lewat satu
 * query, sehingga NIS yang tidak ada ditolak per baris beserta nomornya, bukan
 * menggagalkan seluruh berkas.
 */
export type BillImportRow={
  row:number;nis:string;kind:'SPP'|'USPP'|'NON_SPP';title:string;periodKey:string|null;amountRupiah:number;dueDate:string|null
}

export async function importBillsAction(rows:BillImportRow[]){
  const session=await requireFinanceAccess('CONFIGURE')
  const list=[...new Set(rows.map(item=>item.nis).filter(Boolean))]
  const students=list.length
    ? await mainQuery<{id:string;nis:string}>(`SELECT id,nis FROM santri WHERE status_global='aktif' ${andExcludeAsramaSql('asrama')} AND nis IN (${list.map(()=>'?').join(',')})`,list)
    : []
  const byNis=new Map(students.map(student=>[student.nis,student.id]))
  // Snapshot disinkronkan sekali per santri, bukan tiap baris tagihannya.
  for(const student of students)await syncFinanceStudentSnapshot(student.id)
  const summary=await runBulk(rows,async item=>{
    const santriId=byNis.get(item.nis)
    if(!santriId)return{success:false,error:`NIS ${item.nis} bukan santri aktif.`}
    return createFinanceBill({
      santriId,
      billKind:item.kind,
      title:item.title,
      periodKey:item.periodKey,
      amountRupiah:item.amountRupiah,
      dueDate:item.dueDate,
      actorId:session.id,
    })
  })
  if(summary.success&&summary.created)refreshOperations()
  return summary
}

/** Prasyarat tutup buku untuk periode tertentu, dipanggil ulang saat bendahara mengganti bulan. */
export async function getPeriodReadinessAction(periodKey:string){
  await requireFinanceAccess('VIEW')
  return financePeriodReadiness(periodKey)
}

export async function getOperationsData(){
  const session=await requireFinanceAccess('VIEW')
  const capabilities=await financeCapabilities(session)
  // Bulan lalu adalah periode yang paling sering ditutup, jadi kesiapannya
  // dimuat lebih dulu agar checklist langsung terisi tanpa menunggu klik.
  const jakarta=new Date(Date.now()+7*3600_000)
  const previous=new Date(Date.UTC(jakarta.getUTCFullYear(),jakarta.getUTCMonth()-1,1))
  const defaultPeriod=`${previous.getUTCFullYear()}-${String(previous.getUTCMonth()+1).padStart(2,'0')}`
  return{
    capabilities,
    defaultPeriod,
    readiness:await financePeriodReadiness(defaultPeriod),
    periods:await query<any>(`SELECT * FROM finance_periods ORDER BY period_key DESC LIMIT 24`),
    reconciliationTargets:await reconciliationTargets(),
    reconciliationChecks:await reconciliationChecks(defaultPeriod),
    staff:await mainQuery<any>(`SELECT id,full_name FROM users ORDER BY full_name`),
    paymentReviews:await query<any>(`SELECT p.id,p.merchant_order_id,p.amount_rupiah,p.charged_amount_rupiah,p.expires_at,p.paid_at,p.provider_reference,
      s.nis,s.full_name nama_lengkap
      FROM finance_payment_intents p
      LEFT JOIN finance_student_snapshots s ON s.santri_id=p.santri_id
      WHERE p.status='PAID' AND p.review_status='REQUIRED' ${andExcludeAsramaSql('s.asrama')}
      ORDER BY p.paid_at DESC LIMIT 100`),
    bills:await query<any>(`SELECT b.*,s.nis,s.full_name nama_lengkap FROM finance_bills b JOIN finance_student_snapshots s ON s.santri_id=b.santri_id
      WHERE 1=1 ${andExcludeAsramaSql('s.asrama')} ORDER BY b.created_at DESC LIMIT 30`),
  }
}
