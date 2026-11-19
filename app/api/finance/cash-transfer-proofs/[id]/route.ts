import { queryOne } from '@/lib/db'
import { getEffectiveRoles } from '@/lib/auth/session'
import { readProofStaffSession } from '@/lib/r2/read-session'
import { servePrivateProof, privateNotFound } from '@/lib/r2/private-proofs'

// Bukti Mutasi Kas Bank ↔ Tunai (struk ATM / slip teller): pencatat sendiri, atau Admin, Bendahara,
// Admin Koperasi, Pimpinan (pengawasan & rekonsiliasi). Semua kegagalan dijawab 404 tanpa detail.
type Context = { params: Promise<{ id: string }> }

async function authorize(id: string): Promise<string> {
  const row = await queryOne<{ operator_id: string; proof_object_key: string }>(
    `SELECT operator_id, proof_object_key FROM finance_cash_transfers WHERE id = ?`, [id])
  if (!row) throw new Error('Not found')
  const staff = await readProofStaffSession()
  if (!staff) throw new Error('Not found')
  const roles = getEffectiveRoles(staff)
  const allowed = staff.id === row.operator_id ||
    roles.some(role => ['admin', 'bendahara', 'admin_koperasi', 'pimpinan'].includes(role))
  if (!allowed) throw new Error('Not found')
  return row.proof_object_key
}

async function read(context: Context, head: boolean) {
  try {
    return await servePrivateProof(await authorize((await context.params).id), head)
  } catch {
    return privateNotFound(head)
  }
}
export async function GET(_request: Request, context: Context) { return read(context, false) }
export async function HEAD(_request: Request, context: Context) { return read(context, true) }
