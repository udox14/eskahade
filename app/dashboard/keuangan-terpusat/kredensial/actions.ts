'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache'
import { getFinanceDB as getDB,financeQuery as query,financeQueryOne as queryOne,queryOne as mainQueryOne } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'
import { issueCredential,setCredentialMode } from '@/lib/finance/credentials'
import type { CredentialKind,CredentialMode } from '@/lib/finance/types'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
const PATH='/dashboard/keuangan-terpusat/kredensial'
export async function issueCredentialAction(input:{nis:string;kind:CredentialKind;rawToken?:string}){const session=await requireFinanceAccess('CONFIGURE');const student=await mainQueryOne<{id:string}>(`SELECT id FROM santri WHERE nis=? AND status_global='aktif'`,[input.nis.trim()]);if(!student)return{error:'Santri aktif tidak ditemukan.'};await syncFinanceStudentSnapshot(student.id);const result=await issueCredential({santriId:student.id,kind:input.kind,rawToken:input.rawToken,actorId:session.id});if(result.success)revalidatePath(PATH);return result}
export async function setCredentialModeAction(input:{mode:CredentialMode;transitionFrom?:'RFID'|'QR'|null;transitionTo?:'RFID'|'QR'|null;transitionEndsAt?:string|null}){const session=await requireFinanceAccess('CONFIGURE');const result=await setCredentialMode({...input,actorId:session.id});if(result.success)revalidatePath(PATH);return result}
export async function markCredentialAction(id:string,status:'LOST'|'REVOKED'|'BLOCKED'){await requireFinanceAccess('CONFIGURE');const result=await (await getDB()).prepare(`UPDATE student_credentials SET status=?,blocked_reason=? WHERE id=? AND status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED')`).bind(status,status,id).run();if(!result.meta?.changes)return{error:'Credential tidak dapat diubah.'};revalidatePath(PATH);return{success:true as const}}
export async function getCredentialData(){await requireFinanceAccess('VIEW');return{policy:await queryOne<any>(`SELECT * FROM finance_credential_policy WHERE singleton_id=1`),credentials:await query<any>(`SELECT c.id,c.credential_kind,c.token_version,c.status,c.issued_at,c.expires_at,s.nis,s.full_name nama_lengkap FROM student_credentials c JOIN finance_student_snapshots s ON s.santri_id=c.santri_id ORDER BY c.issued_at DESC LIMIT 100`)}}
