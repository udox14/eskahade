'use server'

import { query, getDB } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getSessionInfo() {
  const session = await getSession()
  if (!session) return null
  return { role: session.role, asrama_binaan: session.asrama_binaan ?? null }
}

// Hanya ambil daftar kamar — ringan, dipanggil saat halaman pertama dibuka
export async function getKamarsMalam(asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// Ambil santri + status absen + izin hanya untuk 1 kamar
export async function getDataAbsenMalamKamar(asrama: string, kamar: string, tanggal: string) {
  const session = await getSession()
  if (!session) return []

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [asrama, kamar])

  if (!santriList.length) return []

  const ids = santriList.map((s: any) => s.id)
  const ph = ids.map(() => '?').join(',')

  let absenList: any[] = []
  let izinList: any[] = []

  try {
    absenList = await query<any>(
      `SELECT santri_id, status FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${ph})`,
      [tanggal, ...ids]
    )
  } catch (_) {}

  try {
    izinList = await query<any>(
      `SELECT p.santri_id FROM perizinan p
       WHERE p.status = 'AKTIF'
         AND p.tgl_mulai <= ?
         AND p.tgl_selesai_rencana >= ?
         AND p.santri_id IN (${ph})`,
      [tanggal, tanggal, ...ids]
    )
  } catch (_) {}

  const absenMap: Record<string, string> = {}
  absenList.forEach((a: any) => { absenMap[a.santri_id] = a.status })
  const izinSet = new Set(izinList.map((i: any) => i.santri_id))

  return santriList.map((s: any) => ({
    ...s,
    status: izinSet.has(s.id) ? 'IZIN' : (absenMap[s.id] || 'HADIR'),
    is_izin: izinSet.has(s.id),
  }))
}

export async function batchSaveAbsenMalam(
  records: { santri_id: string; status: string }[],
  tanggal: string
) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  const toSave = records.filter(r => r.status === 'ALFA')
  const toDelete = records.filter(r => r.status !== 'ALFA').map(r => r.santri_id)

  const db = await getDB()
  const stmts: any[] = []

  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100)
    stmts.push(
      db.prepare(`DELETE FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${chunk.map(() => '?').join(',')})`).bind(tanggal, ...chunk)
    )
  }

  for (const r of toSave) {
    stmts.push(db.prepare(`
      INSERT INTO absen_malam_v2 (santri_id, tanggal, status, created_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET status = excluded.status, created_by = excluded.created_by
    `).bind(r.santri_id, tanggal, r.status, session.id))
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }

  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true, saved: toSave.length }
}