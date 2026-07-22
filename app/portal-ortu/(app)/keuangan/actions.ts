'use server'

import { revalidatePath } from 'next/cache'
import { requirePortalSessionAction } from '@/lib/portal/session'
import { allocateStudentFunds } from '@/lib/finance/wallet'
import { createTopupIntent } from '@/lib/finance/payments'
import { financeQuery as query, financeQueryOne as queryOne, getFinanceDB as getDB, generateId, queryOne as mainQueryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { setStudentPin } from '@/lib/finance/credentials'

async function requirePortalFinanceAccess() {
  const session = await requirePortalSessionAction()
  if (session.guardian_id) {
    const link = await queryOne<{ access_level: string }>(`SELECT access_level FROM finance_guardian_students WHERE guardian_id=? AND santri_id=?`, [session.guardian_id, session.santri_id])
    if (link?.access_level !== 'PRIMARY_FINANCE') throw new Error('Hanya wali utama yang dapat mengubah keuangan santri.')
  }
  return session
}

export async function createPortalTopup(input: { amountRupiah: number; paymentMethod: string }) {
  const session = await requirePortalFinanceAccess()
  const method = String(input.paymentMethod || '').trim()
  const allowed = (process.env.DUITKU_PAYMENT_METHODS || '').split(',').map(x => x.trim()).filter(Boolean)
  if (!allowed.includes(method)) return { error: 'Metode pembayaran belum diaktifkan oleh bendahara.' }
  const fee = method === process.env.DUITKU_QRIS_METHOD
    ? Number(process.env.DUITKU_QRIS_FEE_RUPIAH || 0)
    : Number(process.env.DUITKU_VA_FEE_RUPIAH || 0)
  const result = await createTopupIntent({
    santriId: session.santri_id, amountRupiah: Number(input.amountRupiah), gatewayFeeRupiah: fee,
    paymentMethod: method, customerName: session.nama,
  })
  if (result.success) revalidatePath('/portal-ortu/keuangan')
  return result
}

export async function allocatePortalFunds(input: { destination: 'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'; amountRupiah: number; requestKey: string }) {
  const session = await requirePortalFinanceAccess()
  let amountRupiah=Number(input.amountRupiah),fullOutstandingRupiah:number|null=null,billingReference:string|null=null,billItems:Array<{billId:string;amountRupiah:number}>|undefined
  if(input.destination==='SPP'){
    const bills=await query<{id:string;remaining:number}>(`SELECT id,amount_rupiah-paid_rupiah remaining FROM finance_bills WHERE santri_id=? AND bill_kind='SPP' AND status='OPEN' ORDER BY due_date,id`,[session.santri_id]);const items=bills.map(item=>({billId:item.id,amountRupiah:Number(item.remaining)}));billItems=items;amountRupiah=items.reduce((sum,item)=>sum+item.amountRupiah,0);fullOutstandingRupiah=amountRupiah;billingReference=`SPP-ALL:${items.map(item=>item.billId).join(',')}`
  }else if(input.destination==='NON_SPP'){
    const bills=await query<{id:string;remaining:number}>(`SELECT id,amount_rupiah-paid_rupiah remaining FROM finance_bills WHERE santri_id=? AND bill_kind='NON_SPP' AND status='OPEN' ORDER BY due_date,id`,[session.santri_id]);const items=bills.map(item=>({billId:item.id,amountRupiah:Number(item.remaining)}));billItems=items;amountRupiah=items.reduce((sum,item)=>sum+item.amountRupiah,0);fullOutstandingRupiah=amountRupiah;billingReference=`NONSPP-ALL:${items.map(item=>item.billId).join(',')}`
  }else if(input.destination==='USPP'){
    const bills=await query<{id:string;remaining:number}>(`SELECT id,amount_rupiah-paid_rupiah remaining FROM finance_bills WHERE santri_id=? AND bill_kind='USPP' AND status IN ('OPEN','PARTIAL') ORDER BY due_date,id`,[session.santri_id]);let needed=amountRupiah;const items:Array<{billId:string;amountRupiah:number}>=[];for(const bill of bills){if(needed<=0)break;const applied=Math.min(needed,Number(bill.remaining));if(applied>0){items.push({billId:bill.id,amountRupiah:applied});needed-=applied}}if(needed>0)return{error:'Nominal melebihi sisa tagihan USPP.'};billItems=items;billingReference=`USPP:${items.map(item=>item.billId).join(',')}`
  }
  if(amountRupiah<=0)return{error:'Tidak ada tagihan/saldo alokasi yang valid.'}
  const result = await allocateStudentFunds({
    idempotencyKey: `portal:${session.santri_id}:${input.requestKey}`,
    santriId: session.santri_id, destination: input.destination, amountRupiah,fullOutstandingRupiah,billingReference,billItems,
    actorType: 'GUARDIAN', actorId: session.santri_id,
  })
  if (result.success) revalidatePath('/portal-ortu/keuangan')
  return result
}

export async function updatePortalWithdrawalLimits(input: { dailyRupiah: number | null; weeklyRupiah: number | null; monthlyRupiah: number | null; reauthSecret?: string }) {
  const session = await requirePortalFinanceAccess()
  const normalize = (value: number | null) => value == null || Number(value) === 0 ? null : Number(value)
  const next = { daily: normalize(input.dailyRupiah), weekly: normalize(input.weeklyRupiah), monthly: normalize(input.monthlyRupiah) }
  if (Object.values(next).some(value => value !== null && (!Number.isSafeInteger(value) || value <= 0))) return { error: 'Limit harus berupa rupiah bulat positif atau dikosongkan.' }
  const old = await queryOne<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(`SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`, [session.santri_id])
  const increased = ([['daily_rupiah', next.daily], ['weekly_rupiah', next.weekly], ['monthly_rupiah', next.monthly]] as const).some(([key, value]) => value !== null && (old?.[key] == null || value > Number(old[key])))
  if (increased) {
    const hash = session.guardian_id
      ? await queryOne<{ password_hash: string; pin_hash: string | null }>(`SELECT password_hash,pin_hash FROM finance_guardians WHERE id=? AND status='ACTIVE'`, [session.guardian_id])
      : await mainQueryOne<{ password_hash: string; pin_hash: null }>(`SELECT password_hash,NULL pin_hash FROM portal_ortu_credentials WHERE santri_id=? AND is_active=1`, [session.santri_id])
    const secret = String(input.reauthSecret || '')
    const verified = Boolean(hash && (await verifyPassword(secret, hash.password_hash) || Boolean(hash.pin_hash && await verifyPassword(secret, hash.pin_hash))))
    if (!verified) return { error: 'Password/PIN tidak valid. Kenaikan limit dibatalkan.' }
  }
  const db = await getDB()
  await db.batch([
    db.prepare(`INSERT INTO finance_withdrawal_limits(santri_id,daily_rupiah,weekly_rupiah,monthly_rupiah,changed_by_guardian_id,reauthenticated_at)
      VALUES(?,?,?,?,?,CASE WHEN ?=1 THEN datetime('now') ELSE NULL END)
      ON CONFLICT(santri_id) DO UPDATE SET daily_rupiah=excluded.daily_rupiah,weekly_rupiah=excluded.weekly_rupiah,monthly_rupiah=excluded.monthly_rupiah,version=version+1,changed_by_guardian_id=excluded.changed_by_guardian_id,reauthenticated_at=excluded.reauthenticated_at,updated_at=datetime('now')`).bind(session.santri_id,next.daily,next.weekly,next.monthly,session.guardian_id||null,increased?1:0),
    db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(generateId(),'WITHDRAWAL_LIMIT_CHANGED','STUDENT',session.santri_id,JSON.stringify(next)),
  ])
  revalidatePath('/portal-ortu/keuangan')
  return { success: true as const }
}

export async function resetPortalStudentPin(input:{accountPassword:string;newPin:string}){
  const session=await requirePortalFinanceAccess()
  const hash=session.guardian_id
    ? await queryOne<{password_hash:string}>(`SELECT password_hash FROM finance_guardians WHERE id=? AND status='ACTIVE'`,[session.guardian_id])
    : await mainQueryOne<{password_hash:string}>(`SELECT password_hash FROM portal_ortu_credentials WHERE santri_id=? AND is_active=1`,[session.santri_id])
  if(!hash||!await verifyPassword(String(input.accountPassword||''),hash.password_hash))return{error:'Password akun wali tidak valid.'}
  const result=await setStudentPin(session.santri_id,String(input.newPin||''))
  if(result.success)revalidatePath('/portal-ortu/keuangan')
  return result
}
