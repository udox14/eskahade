'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession, isAdmin } from '@/lib/auth/session'
import { execute, query, queryOne } from '@/lib/db'
import { ensureGuruFeatureSchema, HAFALAN_TYPES, isHafalanType } from '@/lib/akademik/guru-access'
import { getCachedMarhalahList } from '@/lib/cache/master'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) return null
  await ensureGuruFeatureSchema()
  return session
}

export async function getMasterHafalanInitialData() {
  const session = await requireAdmin()
  if (!session) return { marhalah: [], types: HAFALAN_TYPES }
  return { marhalah: await getCachedMarhalahList(), types: HAFALAN_TYPES }
}

export async function getMasterHafalanList(jenis: string, marhalahId: number) {
  const session = await requireAdmin()
  if (!session || !isHafalanType(jenis) || !marhalahId) return []

  const rows = await query<any>(`
    SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan, hb.is_active AS bab_active,
           hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.urutan AS blok_urutan, hblk.is_active AS blok_active
    FROM hafalan_bab hb
    LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id
    WHERE hb.jenis = ? AND hb.marhalah_id = ?
    ORDER BY hb.urutan, hb.id, hblk.urutan, hblk.id
  `, [jenis, marhalahId])

  const map = new Map<number, any>()
  for (const row of rows) {
    if (!map.has(row.bab_id)) {
      map.set(row.bab_id, {
        id: row.bab_id,
        judul: row.judul,
        urutan: row.bab_urutan,
        is_active: row.bab_active === 1,
        blok: [],
      })
    }
    if (row.blok_id) {
      map.get(row.bab_id).blok.push({
        id: row.blok_id,
        label: row.label,
        deskripsi: row.deskripsi,
        urutan: row.blok_urutan,
        is_active: row.blok_active === 1,
      })
    }
  }
  return Array.from(map.values())
}

export async function tambahHafalanBab(payload: { jenis: string; marhalahId: number; judul: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const judul = String(payload.judul || '').trim()
  if (!judul) return { error: 'Judul bab wajib diisi.' }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, judul, urutan) VALUES (?, ?, ?, ?)',
    [payload.jenis, payload.marhalahId, judul, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_bab',
    entityLabel: judul,
    summary: `Menambahkan bab hafalan ${judul}`,
    details: { jenis: payload.jenis, marhalah_id: payload.marhalahId },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function tambahHafalanBlok(payload: { babId: number; label: string; deskripsi?: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const label = String(payload.label || '').trim()
  if (!label) return { error: 'Label blok wajib diisi.' }

  const bab = await queryOne<{ id: number; judul: string }>('SELECT id, judul FROM hafalan_bab WHERE id = ?', [payload.babId])
  if (!bab) return { error: 'Bab tidak ditemukan.' }

  await execute(
    'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
    [payload.babId, label, String(payload.deskripsi || '').trim() || null, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_blok',
    entityLabel: label,
    summary: `Menambahkan blok hafalan ${label}`,
    details: { bab_id: payload.babId },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function setHafalanActive(target: 'bab' | 'blok', id: number, active: boolean) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const table = target === 'bab' ? 'hafalan_bab' : 'hafalan_blok'
  await execute(`UPDATE ${table} SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [active ? 1 : 0, id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'update',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'update',
    entityType: table,
    entityId: String(id),
    summary: `${active ? 'Mengaktifkan' : 'Menonaktifkan'} ${target} hafalan`,
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}
