/// <reference types="node" />
// lib/r2/upload.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

async function getR2() {
  const { env } = await getCloudflareContext({ async: true })
  return env.R2_BUCKET
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9/_-]+/g, '-').replace(/\/+/g, '/').replace(/^-+|-+$/g, '')
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function uploadBufferToR2(params: {
  buffer: ArrayBuffer
  folder: string
  filenamePrefix: string
  contentType: string
}): Promise<{ url: string } | { error: string }> {
  try {
    const r2 = await getR2()
    const ext = extensionFromMime(params.contentType || 'image/jpeg')
    const folder = sanitizePathSegment(params.folder || 'uploads') || 'uploads'
    const prefix = sanitizePathSegment(params.filenamePrefix || 'file') || 'file'
    const key = `${folder}/${prefix}_${Date.now()}.${ext}`

    await r2.put(key, params.buffer, {
      httpMetadata: {
        contentType: params.contentType || 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      },
    })

    const baseUrl = process.env.R2_PUBLIC_URL!
    return { url: `${baseUrl}/${key}` }
  } catch (err: unknown) {
    return { error: `Gagal upload: ${errorMessage(err)}` }
  }
}

export async function uploadBase64ImageToR2(params: {
  base64: string
  folder: string
  filenamePrefix: string
}): Promise<{ url: string } | { error: string }> {
  const match = String(params.base64 || '').match(/^data:(.+?);base64,(.+)$/)
  if (!match) return { error: 'Format base64 tidak valid.' }

  const [, mimeType, payload] = match
  const bytes = Uint8Array.from(atob(payload), char => char.charCodeAt(0))
  return uploadBufferToR2({
    buffer: bytes.buffer,
    folder: params.folder,
    filenamePrefix: params.filenamePrefix,
    contentType: mimeType,
  })
}

export async function uploadToR2(
  file: File,
  filenamePrefix: string,
  folder = 'foto-santri'
): Promise<{ url: string } | { error: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    return uploadBufferToR2({
      buffer: arrayBuffer,
      folder,
      filenamePrefix,
      contentType: file.type || 'image/jpeg',
    })
  } catch (err: unknown) {
    return { error: `Gagal upload: ${errorMessage(err)}` }
  }
}

export async function deleteFromR2(url: string): Promise<void> {
  try {
    const r2 = await getR2()
    const baseUrl = process.env.R2_PUBLIC_URL!
    const key = url.replace(`${baseUrl}/`, '')
    if (key && key !== url) {
      await r2.delete(key)
    }
  } catch {
    console.error('Gagal hapus file lama dari R2')
  }
}
