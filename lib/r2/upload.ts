/// <reference types="node" />
// lib/r2/upload.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

async function getR2() {
  const { env } = await getCloudflareContext({ async: true })
  return env.R2_BUCKET
}

export async function uploadToR2(
  file: File,
  santriId: string
): Promise<{ url: string } | { error: string }> {
  try {
    const r2 = await getR2()
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const key = `foto-santri/${santriId}_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()

    await r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      },
    })

    const baseUrl = process.env.R2_PUBLIC_URL!
    const url = `${baseUrl}/${key}`

    return { url }
  } catch (err: any) {
    return { error: `Gagal upload: ${err.message}` }
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