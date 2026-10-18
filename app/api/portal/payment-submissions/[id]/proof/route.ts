import { authorizePortalProof, servePrivateProof, privateNotFound } from '@/lib/r2/private-proofs'

type Context = {params:Promise<{id:string}>}
async function read(context:Context, head:boolean) {
  try { return await servePrivateProof(await authorizePortalProof((await context.params).id), head) }
  catch { return privateNotFound(head) }
}
export async function GET(_request:Request, context:Context) { return read(context, false) }
export async function HEAD(_request:Request, context:Context) { return read(context, true) }
