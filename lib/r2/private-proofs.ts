import { getCloudflareContext } from '@opennextjs/cloudflare'
import { queryOne } from '@/lib/db'
import { hasAnyRole, hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { readProofStaffSession } from './read-session'
import { canAccessFeatureForSession, canFeatureForSession } from '@/lib/auth/feature'
import { getPortalSession } from '@/lib/portal/session'
import { isDemoRequest } from '@/lib/auth/demo-context'
import { getSppScope, isSadesaCategory } from '@/lib/spp/unit-setor'
import { operationalUnitIds } from '@/lib/operasional/scope'
import { canonicalObjectKey, storedObjectKey, transactionReceiptUrl, LEGACY_R2_ORIGIN } from './references'

const recipientFeature = '/dashboard/operasional'
const bendaharaFeature = '/dashboard/keuangan/operasional'
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Local adapter boundary for the repository's minimal binding declarations.
// R2 get/head metadata shape follows the official Workers R2 API.
type ProofObject = {body?:ReadableStream; customMetadata?:Record<string,string>; writeHttpMetadata(headers:Headers):void}
type ProofBucket = Omit<R2Bucket, 'get'> & {
  get(key:string):Promise<ProofObject|null>
  head(key:string):Promise<ProofObject|null>
}
export const privateNotFound = (head = false) => new Response(head ? null : 'Not found', {status: 404, headers: {'Cache-Control': 'no-store'}})
export const proofDataset = async () => await isDemoRequest() ? 'demo' : 'production'

export async function privateBucket() {
  const {env} = await getCloudflareContext({async: true})
  return env.R2_BUCKET as ProofBucket
}

export async function servePrivateProof(key: string, head = false) {
  const bucket = await privateBucket()
  const metadata = await bucket.head(key)
  if (!metadata || (metadata.customMetadata?.dataset && metadata.customMetadata.dataset !== await proofDataset())) return privateNotFound(head)
  const object = head ? metadata : await bucket.get(key)
  if (!object) return privateNotFound(head)
  // New uploads are dataset-bound; legacy objects remain authorized by their DB resource.
  if (object.customMetadata?.dataset && object.customMetadata.dataset !== await proofDataset()) return privateNotFound(head)
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:")
  if (!imageTypes.includes(headers.get('Content-Type') || '')) {
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Content-Disposition', 'attachment; filename="bukti"')
  }
  return new Response(!head && 'body' in object ? object.body : null, {headers})
}

export async function authorizePortalProof(id: string) {
  const [staff, parent] = await Promise.all([readProofStaffSession(), getPortalSession()])
  if (!staff && (!parent || parent.must_change_password)) throw new Error('Not found')
  const row = await queryOne<{santri_id:string; kategori:string; bukti_url:string|null; asrama:string|null; kategori_santri:string|null}>(
    `SELECT ps.santri_id, ps.kategori, ps.bukti_url, s.asrama, s.kategori_santri
     FROM portal_payment_submission ps JOIN santri s ON s.id=ps.santri_id WHERE ps.id=?`, [id])
  if (!row?.bukti_url) throw new Error('Not found')
  let allowed = !!parent && !parent.must_change_password && parent.santri_id === row.santri_id
  if (!allowed && staff) {
    const feature = row.kategori === 'SPP' ? '/dashboard/asrama/spp/konfirmasi-portal' :
      row.kategori === 'NON_SPP' ? '/dashboard/keuangan/non-spp/konfirmasi-portal' : null
    if (feature && await canAccessFeatureForSession(staff, feature)) {
      if (row.kategori === 'NON_SPP') allowed = hasAnyRole(staff, ['admin', 'bendahara', 'demo'])
      else {
        const scope = getSppScope(staff)
        allowed = !!scope && (scope.kind === 'ADMIN' ||
          (scope.kind === 'ASRAMA' && !isSadesaCategory(row.kategori_santri) && row.asrama === scope.defaultUnit) ||
          (scope.kind === 'SADESA' && isSadesaCategory(row.kategori_santri)))
      }
    }
  }
  if (!allowed) throw new Error('Not found')
  return storedObjectKey(row.bukti_url, 'bukti-portal')
}

export async function authorizeReceiptUnit(unitId: string, write = false): Promise<SessionUser> {
  const staff = await readProofStaffSession()
  if (!staff || !unitId || unitId.length > 128 || (write && hasRole(staff, 'tester') && !isAdmin(staff))) throw new Error('Not found')
  let featureAllowed = false
  for (const feature of [recipientFeature, bendaharaFeature]) {
    if (await canAccessFeatureForSession(staff, feature) &&
        (!write || await canFeatureForSession(staff, feature, 'update'))) { featureAllowed = true; break }
  }
  if (!featureAllowed) throw new Error('Not found')
  const ids = operationalUnitIds(staff)
  if (ids !== null && !ids.includes(unitId)) throw new Error('Not found')
  const unit = await queryOne<{id:string}>('SELECT id FROM operasional_unit WHERE id=? AND is_active=1', [unitId])
  if (!unit) throw new Error('Not found')
  return staff
}

export async function authorizeTransactionProof(id: string) {
  if (!await readProofStaffSession()) throw new Error('Not found')
  const row = await queryOne<{unit_id:string;receipt_url:string|null}>(
    'SELECT unit_id,receipt_url FROM operasional_transaksi WHERE id=? AND is_deleted=0', [id])
  if (!row?.receipt_url) throw new Error('Not found')
  await authorizeReceiptUnit(row.unit_id)
  return storedObjectKey(row.receipt_url, 'operasional-receipts')
}

export async function authorizeReceiptDraft(key: string, unitId?: string) {
  key = canonicalObjectKey(key)
  if (!key.startsWith('operasional-receipts/')) throw new Error('Not found')
  const staff = await readProofStaffSession()
  if (!staff) throw new Error('Not found')
  // Authenticated metadata-only read. Draft metadata was written by the scoped uploader.
  const object = await (await privateBucket()).head(key)
  const metadata = object?.customMetadata
  if (!metadata || metadata.ownerId !== staff.id || metadata.dataset !== await proofDataset() ||
      !metadata.unitId || (unitId && metadata.unitId !== unitId)) throw new Error('Not found')
  await authorizeReceiptUnit(metadata.unitId)
  // Once linked (including a subsequently deleted row), only the transaction
  // resource route may authorize reads. Draft access cannot bypass its scope.
  const linked = await queryOne<{id:string}>(
    'SELECT id FROM operasional_transaksi WHERE receipt_url IN (?,?,?) LIMIT 1',
    [key, '/api/file/' + key, LEGACY_R2_ORIGIN + '/' + key])
  if (linked) throw new Error('Not found')
  return key
}

export async function receiptReferenceForSave(reference: string | null | undefined, unitId: string, id?: string) {
  if (!reference) return null
  await authorizeReceiptUnit(unitId, true)
  if (id) {
    const existing = await queryOne<{unit_id:string;receipt_url:string|null}>(
      'SELECT unit_id,receipt_url FROM operasional_transaksi WHERE id=? AND is_deleted=0', [id])
    if (!existing) throw new Error('Not found')
    await authorizeReceiptUnit(existing.unit_id, true)
    if (reference === transactionReceiptUrl(id) || reference === existing.receipt_url) return existing.receipt_url
  }
  return authorizeReceiptDraft(storedObjectKey(reference, 'operasional-receipts'), unitId)
}

export async function uploadPrivateImage(file: File, prefix: 'bukti-portal'|'operasional-receipts', metadata: Record<string,string>) {
  const limit = prefix === 'bukti-portal' ? 2 * 1024 * 1024 : 3 * 1024 * 1024
  if (!file.size || file.size > limit || !imageTypes.includes(file.type)) throw new Error('Format atau ukuran gambar tidak valid.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const valid = file.type === 'image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 :
    file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) :
    file.type === 'image/gif' ? ['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6))) :
    new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
  if (!valid) throw new Error('Isi gambar tidak valid.')
  const extension = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif' }[file.type]
  const key = `${prefix}/${crypto.randomUUID()}.${extension}`
  const stored = await (await privateBucket()).put(key, bytes, {
    httpMetadata: {contentType:file.type, cacheControl:'private, no-store'},
    customMetadata: {...metadata, dataset:await proofDataset()},
  })
  if (!stored) throw new Error('Penyimpanan bukti gagal.')
  return key
}
