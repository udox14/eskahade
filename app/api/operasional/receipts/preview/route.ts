import { authorizeReceiptDraft, servePrivateProof, privateNotFound } from '@/lib/r2/private-proofs'

async function read(request:Request, head:boolean) {
  try {
    const key = await authorizeReceiptDraft(new URL(request.url).searchParams.get('key') || '')
    return await servePrivateProof(key, head)
  } catch { return privateNotFound(head) }
}
export async function GET(request:Request) { return read(request, false) }
export async function HEAD(request:Request) { return read(request, true) }
