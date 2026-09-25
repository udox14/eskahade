import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession, isAdmin } from '@/lib/auth/session'
import { execute } from '@/lib/db'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getDashboardAppearance, parseHeroConfig } from '@/lib/dashboard/config'
import { deleteFromR2, uploadBufferToR2 } from '@/lib/r2/upload'

function hasImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin tidak valid.' }, { status: 403 })
  }
  const length = Number(request.headers.get('content-length') || 0)
  if (length > 9_000_000) return NextResponse.json({ error: 'Gambar terlalu besar.' }, { status: 413 })

  try {
    const body = await request.formData()
    const file = body.get('file')
    if (!(file instanceof File) || file.size < 1 || file.size > 8_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Pilih gambar PNG, JPEG, atau WebP maksimal 8 MB.' }, { status: 400 })
    }
    const rawConfig = body.get('config')
    let config: unknown
    try { config = JSON.parse(typeof rawConfig === 'string' ? rawConfig : '{}') }
    catch { return NextResponse.json({ error: 'Pengaturan crop tidak valid.' }, { status: 400 }) }
    const buffer = await file.arrayBuffer()
    if (!hasImageSignature(new Uint8Array(buffer), file.type)) {
      return NextResponse.json({ error: 'Isi file gambar tidak valid.' }, { status: 400 })
    }
    const before = (await getDashboardAppearance()).hero
    const uploaded = await uploadBufferToR2({
      buffer, folder: 'dashboard', filenamePrefix: `hero-${crypto.randomUUID()}`, contentType: file.type,
    })
    if ('error' in uploaded) throw new Error(uploaded.error)
    const after = parseHeroConfig(JSON.stringify({ ...before, ...(config && typeof config === 'object' ? config : {}), imageUrl: uploaded.url }))
    try {
      await execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('dashboard_hero', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [JSON.stringify(after)]
      )
    } catch (error) {
      await deleteFromR2(uploaded.url)
      throw error
    }
    await logActivity({ actor: actorFromSession(session), module: 'dashboard', action: 'update',
      entityType: 'app_setting', entityId: 'dashboard_hero', entityLabel: 'Hero dashboard',
      summary: 'Mengganti gambar hero dashboard', details: { before, after } })
    if (before.imageUrl.startsWith('/api/file/dashboard/')) await deleteFromR2(before.imageUrl)
    revalidatePath('/dashboard')
    return NextResponse.json({ url: uploaded.url, hero: after })
  } catch (error) {
    console.error('[dashboard-hero] upload failed', error)
    return NextResponse.json({ error: 'Gagal menyimpan gambar hero.' }, { status: 500 })
  }
}
