import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'
import { unreconciledAccountCount } from './reconciliation'

async function sha256(value: string): Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}

export type PeriodBlocker={key:'drafts'|'unreconciled'|'pending_payouts'|'suspense';label:string;detail:string;count:number;href:string}

/**
 * Prasyarat tutup buku dalam bentuk daftar yang bisa ditampilkan, bukan satu
 * pesan gagal setelah tombol ditekan. Dipakai UI Operasi agar bendahara tahu
 * persis apa yang harus dibereskan lebih dulu.
 */
export async function financePeriodReadiness(periodKey:string):Promise<{valid:boolean;blockers:PeriodBlocker[]}>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey))return{valid:false,blockers:[]}
  // Payout dibatasi ke periode yang ditutup. Tanpa filter ini, payout bulan
  // berjalan yang belum direkonsiliasi memblokir penutupan bulan sebelumnya.
  const raw=await queryOne<{drafts:number;pending_payouts:number;suspense:number}>(`SELECT
    (SELECT COUNT(*) FROM finance_journals WHERE status='DRAFT' AND substr(effective_date,1,7)=?) drafts,
    (SELECT COUNT(*) FROM finance_payouts WHERE status IN ('DIAJUKAN','DISETUJUI','DIPROSES') AND substr(created_at,1,7)<=?) pending_payouts,
    COALESCE((SELECT balance_rupiah FROM finance_account_balances WHERE account_id='fa-suspense'),0) suspense`,[periodKey,periodKey])
  if(!raw)return{valid:false,blockers:[]}
  const unreconciled=await unreconciledAccountCount(periodKey)
  const blockers:PeriodBlocker[]=[
    {key:'drafts',label:'Jurnal masih berstatus draft',detail:'Posting atau batalkan jurnal draft pada periode ini.',count:Number(raw.drafts),href:'/dashboard/keuangan-terpusat/transaksi'},
    {key:'unreconciled',label:'Rekening belum dicocokkan bulan ini',detail:'Bandingkan saldo pembukuan dengan rekening koran untuk setiap rekening kas.',count:unreconciled,href:'#reconciliation'},
    {key:'pending_payouts',label:'Pencairan belum selesai',detail:'Selesaikan pencairan berstatus DIAJUKAN, DISETUJUI, atau DIPROSES.',count:Number(raw.pending_payouts),href:'/dashboard/keuangan-terpusat/payout'},
    {key:'suspense',label:'Saldo akun suspense belum nol',detail:'Pindahkan saldo suspense ke akun yang benar lewat jurnal.',count:Number(raw.suspense),href:'/dashboard/keuangan-terpusat/transaksi'},
  ]
  return{valid:blockers.every(item=>item.count===0),blockers}
}

export async function closeFinancePeriod(periodKey:string,actorId:string){
  try{
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey))throw new Error('Format periode tidak valid.')
    const readiness=await financePeriodReadiness(periodKey)
    if(!readiness.valid)throw new Error('Tutup buku ditolak: masih ada jurnal draft, rekening belum dicocokkan, pencairan belum selesai, atau saldo suspense.')
    const totals=await query<{account_id:string;balance_rupiah:number}>(`SELECT account_id,balance_rupiah FROM finance_account_balances ORDER BY account_id`)
    const lastJournal=await queryOne<{id:string;created_at:string}>(`SELECT id,created_at FROM finance_journals WHERE status='POSTED' AND substr(effective_date,1,7)<=? ORDER BY effective_date DESC,created_at DESC,id DESC LIMIT 1`,[periodKey])
    const closeHash=await sha256(JSON.stringify({periodKey,totals,lastJournal}))
    const db=await getDB()
    await db.prepare(`INSERT INTO finance_periods(period_key,status,closed_at,closed_by,close_hash) VALUES(?,'CLOSED',datetime('now'),?,?)
      ON CONFLICT(period_key) DO UPDATE SET status='CLOSED',closed_at=datetime('now'),closed_by=excluded.closed_by,close_hash=excluded.close_hash`).bind(periodKey,actorId,closeHash).run()
    return{success:true as const,closeHash}
  }catch(error){return{success:false as const,...financeError(error)}}
}

/**
 * Buka kembali periode yang sudah ditutup. Dulu butuh dua persetujuan terpisah
 * lewat tabel finance_period_reopen_approvals; sekarang cukup satu approver
 * selain yang menutup, dengan alasan tercatat di kolom periode dan audit log.
 */
export async function reopenFinancePeriod(input:{periodKey:string;actorId:string;approvedBy:string;reason:string}){
  try{
    const cleanReason=input.reason.trim()
    if(cleanReason.length<10)throw new Error('Alasan pembukaan kembali minimal 10 karakter.')
    if(!input.approvedBy)throw new Error('Pembukaan kembali memerlukan satu penyetuju.')
    if(input.approvedBy===input.actorId)throw new Error('Penyetuju harus orang lain, bukan yang mengajukan.')
    const db=await getDB()
    // Cek hasil UPDATE: periode yang sudah OPEN atau tidak ada tidak boleh
    // dilaporkan berhasil dibuka kembali beserta audit log yang mengklaimnya.
    const result=await db.prepare(`UPDATE finance_periods
      SET status='OPEN',reopened_at=datetime('now'),reopened_by=?,reopen_approved_by=?,reopen_reason=?
      WHERE period_key=? AND status='CLOSED'`).bind(input.actorId,input.approvedBy,cleanReason,input.periodKey).run()
    if(!result.meta?.changes)throw new Error('Periode tidak ditemukan atau tidak dalam status tertutup.')
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'REOPEN','FINANCE_PERIOD',?,?)`)
      .bind(generateId(),input.actorId,input.periodKey,JSON.stringify({reason:cleanReason,approvedBy:input.approvedBy})).run()
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}
