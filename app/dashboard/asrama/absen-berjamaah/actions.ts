'use server'

import { query, getDB } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']

export async function getSessionBerjamaah() {
  const session = await getSession()
  if (!session) return null
  if (session.role === 'admin') return { role: 'admin', asrama_binaan: null }
  if (session.role === 'pengurus_asrama' && ASRAMA_PUTRI.includes(session.asrama_binaan || '')) {
    return { role: 'pengurus_asrama', asrama_binaan: session.asrama_binaan! }
  }
  return null // Tidak punya akses
}

export async function getDataAbsenBerjamaah(asrama: string, tanggal: string) {
  const session = await getSession()
  if (!session) return []

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [asrama])

  if (!santriList.length) return []

  const ids = santriList.map((s: any) => s.id)
  const ph = ids.map(() => '?').join(',')

  let absenList: any[] = []
  try {
    absenList = await query<any>(
      `SELECT santri_id, shubuh, ashar, maghrib, isya FROM absen_berjamaah WHERE tanggal = ? AND santri_id IN (${ph})`,
      [tanggal, ...ids]
    )
  } catch (_) {}

  const absenMap: Record<string, any> = {}
  absenList.forEach((a: any) => { absenMap[a.santri_id] = a })

  return santriList.map((s: any) => ({
    ...s,
    shubuh: absenMap[s.id]?.shubuh || null,
    ashar: absenMap[s.id]?.ashar || null,
    maghrib: absenMap[s.id]?.maghrib || null,
    isya: absenMap[s.id]?.isya || null,
  }))
}

// Batch save satu kamar: records per santri per tanggal
export async function batchSaveAbsenBerjamaah(
  records: { santri_id: string; shubuh: string | null; ashar: string | null; maghrib: string | null; isya: string | null }[],
  tanggal: string
) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }
  if (session.role === 'pengurus_asrama' && !ASRAMA_PUTRI.includes(session.asrama_binaan || '')) return { error: 'Tidak punya akses' }

  const db = await getDB()
  const stmts: any[] = []

  // Santri yang semua waktu hadir (semua null) → hapus record jika ada
  const allHadir = records.filter(r => !r.shubuh && !r.ashar && !r.maghrib && !r.isya).map(r => r.santri_id)
  const toUpsert = records.filter(r => r.shubuh || r.ashar || r.maghrib || r.isya)

  for (let i = 0; i < allHadir.length; i += 100) {
    const chunk = allHadir.slice(i, i + 100)
    stmts.push(
      db.prepare(`DELETE FROM absen_berjamaah WHERE tanggal = ? AND santri_id IN (${chunk.map(() => '?').join(',')})`).bind(tanggal, ...chunk)
    )
  }

  for (const r of toUpsert) {
    stmts.push(db.prepare(`
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, ashar, maghrib, isya, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = excluded.shubuh, ashar = excluded.ashar,
        maghrib = excluded.maghrib, isya = excluded.isya,
        created_by = excluded.created_by
    `).bind(r.santri_id, tanggal, r.shubuh, r.ashar, r.maghrib, r.isya, session.id))
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }

  revalidatePath('/dashboard/asrama/absen-berjamaah')
  return { success: true }
}
