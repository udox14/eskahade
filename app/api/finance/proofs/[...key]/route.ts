import { getCloudflareContext } from '@opennextjs/cloudflare'
import { authorizeFinancialProof } from '@/lib/finance/proofs'

export async function GET(_request: Request, {params}: {params:Promise<{key:string[]}>}) {
  try {
    const {key} = await params
    const allowed = await authorizeFinancialProof(key.join('/'))
    const {env} = await getCloudflareContext({async:true})
    const object = await env.R2_BUCKET.get(allowed.key) as {body:ReadableStream;writeHttpMetadata(h:Headers):void}|null
    if (!object) return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
    const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control','private, no-store')
    return new Response(object.body,{headers})
  } catch {
    return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
  }
}
