// This origin is public metadata, not a credential. Never accept arbitrary r2.dev hosts.
export const LEGACY_R2_ORIGIN = 'https://pub-1209482eb6d6461389443ee22c5764f5.r2.dev'
const privatePrefixes = ['proofs', 'penyaluran-proofs', 'bukti-portal', 'operasional-receipts', 'pengajian-evidence']
const publicPhotoPrefixes = ['foto-santri/', 'avatar-profil/', 'dashboard/']

export function canonicalObjectKey(value: string): string {
  if (!value || value.length > 2048) throw new Error('Invalid object reference')
  const key = decodeURIComponent(value)
  if (!/^[a-zA-Z0-9_-][a-zA-Z0-9._/-]*$/.test(key) || key.length > 1024 ||
      key.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid object reference')
  }
  return key
}

export function isPrivateObjectKey(key: string): boolean {
  return privatePrefixes.some(prefix => key === prefix || key.startsWith(prefix + '/'))
}

export function storedObjectKey(reference: string, prefix: string): string {
  let path = reference
  if (path.startsWith(LEGACY_R2_ORIGIN + '/')) path = path.slice(LEGACY_R2_ORIGIN.length + 1)
  else if (path.startsWith('/api/file/')) path = path.slice('/api/file/'.length)
  const key = canonicalObjectKey(path)
  if (!key.startsWith(prefix + '/')) throw new Error('Invalid object prefix')
  return key
}

export const portalProofUrl = (id: string) => `/api/portal/payment-submissions/${encodeURIComponent(id)}/proof`
export const transactionReceiptUrl = (id: string) => `/api/operasional/transactions/${encodeURIComponent(id)}/proof`
export const draftReceiptUrl = (key: string) => `/api/operasional/receipts/preview?key=${encodeURIComponent(key)}`

/** Pure display conversion; does not fetch URLs or rewrite stored records. */
export function publicMediaUrl(reference: string | null | undefined): string | undefined {
  if (!reference) return undefined
  try {
    if (reference.startsWith('/api/file/')) {
      const key = canonicalObjectKey(reference.slice('/api/file/'.length))
      return publicPhotoPrefixes.some(prefix => key.startsWith(prefix)) ? '/api/file/' + key.split('/').map(encodeURIComponent).join('/') : undefined
    }
    if (reference.startsWith(LEGACY_R2_ORIGIN + '/')) {
      const key = canonicalObjectKey(reference.slice(LEGACY_R2_ORIGIN.length + 1))
      if (!publicPhotoPrefixes.some(prefix => key.startsWith(prefix))) return undefined
      return '/api/file/' + key.split('/').map(encodeURIComponent).join('/')
    }
    // Bundled same-origin media; no protocol-relative, encoded or traversing paths.
    if (reference.startsWith('/') && !reference.startsWith('//') &&
        !reference.startsWith('/api/') && !isPrivateObjectKey(canonicalObjectKey(reference.slice(1)))) return reference
  } catch { /* Invalid stored media falls back to the existing empty avatar. */ }
  return undefined
}
