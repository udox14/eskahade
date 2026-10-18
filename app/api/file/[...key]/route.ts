import { getCloudflareContext } from '@opennextjs/cloudflare'
import { canonicalObjectKey, isPrivateObjectKey } from '@/lib/r2/references'

// Serve file R2 lewat worker (same-origin), lepas dari pub-*.r2.dev yang
// rate-limited. Dipakai untuk foto santri, avatar, TTD rapor, bukti, dll.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  let objectKey: string
  try { objectKey = canonicalObjectKey(Array.isArray(key) ? key.join('/') : String(key || '')) }
  catch { return new Response('Not found', { status:404, headers:{'Cache-Control':'no-store'} }) }
  if (isPrivateObjectKey(objectKey)) return new Response('Not found', { status:404, headers:{'Cache-Control':'no-store'} })

  const { env } = await getCloudflareContext({ async: true })
  // R2Bucket di-typing manual (Promise<unknown>); cast ke bentuk R2ObjectBody.
  const obj = await env.R2_BUCKET.get(objectKey) as {
    body: ReadableStream
    httpEtag: string
    writeHttpMetadata: (headers: Headers) => void
  } | null
  if (!obj) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
}
