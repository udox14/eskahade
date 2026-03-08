'use server'

import { query, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getDataAbsenMalam(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const santriList = await query<any>(`
    SELECT id, nama_lengkap, nis, kamar
    FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY kamar, nama_lengkap
  `, [targetAsrama])

  if (!santriList.length) return []

  const santriIds = santriList.map((s: any) => s.id)
  const ph = santriIds.map(() => '?').join(',')

  const absenList = await query<any>(`
    SELECT santri_id, status, updated_at
    FROM absen_asrama
    WHERE santri_id IN (${ph})
  `, santriIds)

  const izinList = await query<any>(`
    SELECT santri_id, jenis
    FROM perizinan
    WHERE status = 'AKTIF' AND santri_id IN (${ph})
  `, santriIds)

  const todayResetTime = new Date()
  todayResetTime.setHours(12, 0, 0, 0)
  if (new Date() < todayResetTime) todayResetTime.setDate(todayResetTime.getDate() - 1)

  return santriList.map((s: any) => {
    const izin = izinList.find((i: any) => i.santri_id === s.id)
    const absenDB = absenList.find((a: any) => a.santri_id === s.id)

    let statusFinal = 'BELUM'
    let isIzin = false

    if (izin) {
      statusFinal = `IZIN: ${izin.jenis}`
      isIzin = true
    } else if (absenDB) {
      const dbTime = new Date(absenDB.updated_at)
      if (dbTime > todayResetTime) statusFinal = absenDB.status
    }

    return {
      ...s,
      status: statusFinal,
      is_izin: isIzin,
      kamar_norm: parseInt(s.kamar) || 999,
    }
  })
}

export async function updateAbsenMalam(santriId: string, status: 'HADIR' | 'TIDAK') {
  const session = await getSession()

  await execute(`
    INSERT INTO absen_asrama (santri_id, status, updated_at, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(santri_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      created_by = excluded.created_by
  `, [santriId, status, new Date().toISOString(), session?.id ?? null])

  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}