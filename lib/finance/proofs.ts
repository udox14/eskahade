import { queryOne } from '@/lib/db'
import { authorizeFinanceFeature } from './authorization'

export function isFinancialProofKey(key: string): boolean {
  return ['penyaluran-proofs','proofs'].some(prefix => key === prefix || key.startsWith(prefix + '/'))
}

export function financialProofKey(reference: string): string {
  let key = reference
  if (key.startsWith('/api/file/')) key = key.slice('/api/file/'.length)
  if (key.startsWith('/api/finance/proofs/')) key = key.slice('/api/finance/proofs/'.length)
  try { key = decodeURIComponent(key) } catch { throw new Error('Referensi bukti tidak valid.') }
  if (!isFinancialProofKey(key) || key.includes('..') || key.includes('\\') || key.includes('?') || key.includes('#')) throw new Error('Referensi bukti tidak valid.')
  return key
}

export async function authorizeFinancialProof(reference: string, distributionId?: string) {
  const {session,roles} = await authorizeFinanceFeature('/dashboard/keuangan/penyaluran')
  if (!roles.some(role=>['admin','bendahara','admin_koperasi','petugas_koperasi','pimpinan'].includes(role))) throw new Error('FORBIDDEN')
  const key = financialProofKey(reference)
  const row = await queryOne<{id:string}>(`SELECT id FROM finance_distributions
    WHERE (? IS NULL OR id=?) AND (proof_attachment_url IN (?,?,?) OR manual_transfer_proof_ref IN (?,?,?)) LIMIT 1`,
    [distributionId||null,distributionId||null,key,`/api/file/${key}`,`/api/finance/proofs/${key}`,key,`/api/file/${key}`,`/api/finance/proofs/${key}`])
  if (!row) {
    const owned=await queryOne<{owner_id:string}>('SELECT owner_id FROM finance_proofs WHERE object_key=? AND owner_id=?',[key,session.id])
    if(!owned || distributionId) throw new Error('NOT_FOUND: Bukti tidak terhubung ke penyaluran yang dapat diakses.')
  }
  return {key,session}
}

export async function validateFinancialProof(reference:string,operatorId:string) {
  const key=financialProofKey(reference)
  const proof=await queryOne<{content_hash:string;mime_type:string;size_bytes:number}>(
    'SELECT content_hash,mime_type,size_bytes FROM finance_proofs WHERE object_key=? AND owner_id=?',[key,operatorId])
  if(!proof) throw new Error('Bukti wajib berasal dari unggahan privat operator yang sah.')
  return {key,...proof}
}

export function privateProofUrl(reference:string):string {
  return '/api/finance/proofs/'+financialProofKey(reference).split('/').map(encodeURIComponent).join('/')
}
