'use server'

import { query, queryOne, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function cariSantriAsrama(keyword: string, asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  return query<any>(`
    SELECT id, nama_lengkap, nis, kamar, asrama
    FROM santri
    WHERE asrama = ? AND status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `, [targetAsrama, `%${keyword}%`])
}

export async function simpanAbsenSakit(santriId: string, keterangan: 'BELI_SURAT' | 'TIDAK_BELI') {
  const session = await getSession()
  const today = new Date().toISOString().split('T')[0]

  const exist = await queryOne<{ id: string }>(
    'SELECT id FROM absen_sakit WHERE santri_id = ? AND tanggal = ?',
    [santriId, today]
  )
  if (exist) return { error: 'Santri ini sudah dicatat sakit hari ini.' }

  await execute(
    'INSERT INTO absen_sakit (id, santri_id, tanggal, keterangan, created_by) VALUES (?, ?, ?, ?, ?)',
    [generateId(), santriId, today, keterangan, session?.id ?? null]
  )

  revalidatePath('/dashboard/asrama/absen-sakit')
  return { success: true }
}

export async function getListSakitMingguan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const mondayStr = monday.toISOString().split('T')[0]
  const sundayStr = sunday.toISOString().split('T')[0]

  return query<any>(`
    SELECT ab.id, ab.tanggal, ab.keterangan, ab.created_at,
           s.nama_lengkap, s.nis, s.kamar, s.asrama
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    WHERE s.asrama = ?
      AND ab.tanggal >= ? AND ab.tanggal <= ?
    ORDER BY ab.created_at DESC
  `, [targetAsrama, mondayStr, sundayStr])
}

export async function getAsramaRestrictionClient() {
  return getUserRestriction()
}

export async function hapusAbsenSakit(id: string) {
  await execute('DELETE FROM absen_sakit WHERE id = ?', [id])
  revalidatePath('/dashboard/asrama/absen-sakit')
}