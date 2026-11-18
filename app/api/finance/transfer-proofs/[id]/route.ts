import { queryOne } from '@/lib/db'
import { getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { readProofStaffSession } from '@/lib/r2/read-session'
import { getPortalSession } from '@/lib/portal/session'
import { servePrivateProof, privateNotFound } from '@/lib/r2/private-proofs'
import { getVerifierScope, scopeAllows, TRANSFER_FEATURE_PATH } from '@/lib/finance/manual-transfer'

// Private transfer proof: the owning parent, or a verifier whose asrama scope covers the santri.
// Older proofs of a re-uploaded submission stay readable for staff via ?hash=<content_hash>.
type Context = { params: Promise<{ id: string }> }

async function authorize(id: string, hash: string | null): Promise<string> {
  const row = await queryOne<{ santri_id: string; asrama: string | null; proof_object_key: string | null }>(
    `SELECT s.santri_id, st.asrama, s.proof_object_key FROM finance_transfer_submissions s
     JOIN santri st ON st.id = s.santri_id WHERE s.id = ?`, [id])
  if (!row) throw new Error('Not found')
  const [staff, parent] = await Promise.all([readProofStaffSession(), getPortalSession()])
  let allowed = !!parent && !parent.must_change_password && parent.santri_id === row.santri_id && !hash
  if (!allowed && staff) {
    const roles = getEffectiveRoles(staff)
    const privileged = roles.some(role => ['admin', 'bendahara', 'pimpinan'].includes(role))
    if (privileged || await canAccessFeatureForSession(staff, TRANSFER_FEATURE_PATH)) {
      allowed = scopeAllows(await getVerifierScope(staff), row.asrama)
    }
  }
  if (!allowed) throw new Error('Not found')
  if (hash) {
    const proof = await queryOne<{ object_key: string }>(
      `SELECT object_key FROM finance_transfer_proofs WHERE submission_id = ? AND content_hash = ?`, [id, hash])
    if (!proof) throw new Error('Not found')
    return proof.object_key
  }
  if (!row.proof_object_key) throw new Error('Not found')
  return row.proof_object_key
}

async function read(request: Request, context: Context, head: boolean) {
  try {
    const hash = new URL(request.url).searchParams.get('hash')
    if (hash !== null && !/^[a-f0-9]{64}$/.test(hash)) return privateNotFound(head)
    return await servePrivateProof(await authorize((await context.params).id, hash), head)
  } catch {
    return privateNotFound(head)
  }
}
export async function GET(request: Request, context: Context) { return read(request, context, false) }
export async function HEAD(request: Request, context: Context) { return read(request, context, true) }
