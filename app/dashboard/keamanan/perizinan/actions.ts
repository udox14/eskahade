'use server'

import { query, queryOne, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getPerizinanList(filterWaktu: 'HARI' | 'MINGGU' | 'BULAN' = 'HARI') {
  const now = new Date()
  let startDate = new Date()

  if (filterWaktu === 'HARI') {
    startDate.setHours(0, 0, 0, 0)
  } else if (filterWaktu === 'MINGGU') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startDate = new Date(now)
    startDate.setDate(diff)
    startDate.setHours(0, 0, 0, 0)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const startISO = startDate.toISOString()

  return query<any>(`
    SELECT p.id, p.created_at, p.status, p.jenis, p.alasan, p.pemberi_izin,
           p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
           s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.status = 'AKTIF'
       OR (p.status = 'KEMBALI' AND p.tgl_kembali_aktual >= ?)
    ORDER BY p.created_at DESC
  `, [startISO])
}

export async function simpanIzin(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()

  const santri_id = formData.get('santri_id') as string
  const jenis = formData.get('jenis') as string
  const alasan = formData.get('alasan') as string
  const pemberi_izin = formData.get('pemberi_izin') as string

  let tgl_mulai: string, tgl_selesai_rencana: string

  if (jenis === 'PULANG') {
    const dStart = formData.get('date_start') as string
    const dEnd = formData.get('date_end') as string
    tgl_mulai = new Date(`${dStart}T08:00:00`).toISOString()
    tgl_selesai_rencana = new Date(`${dEnd}T17:00:00`).toISOString()
  } else {
    const date = formData.get('date_single') as string
    const tStart = formData.get('time_start') as string
    const tEnd = formData.get('time_end') as string
    tgl_mulai = new Date(`${date}T${tStart}:00`).toISOString()
    tgl_selesai_rencana = new Date(`${date}T${tEnd}:00`).toISOString()
  }

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [generateId(), santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, session?.id ?? null])

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

export async function setSudahDatang(id: string, waktuDatang: string): Promise<{ success: boolean; message: string } | { error: string }> {
  const izin = await queryOne<{ tgl_selesai_rencana: string }>(
    'SELECT tgl_selesai_rencana FROM perizinan WHERE id = ?', [id]
  )
  if (!izin) return { error: 'Data izin tidak ditemukan.' }

  const aktual = new Date(waktuDatang)
  const rencana = new Date(izin.tgl_selesai_rencana)
  const isTelat = aktual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  await execute(
    'UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ?',
    [statusFinal, aktual.toISOString(), id]
  )

  revalidatePath('/dashboard/keamanan/perizinan')

  if (isTelat) return { success: true, message: 'Terlambat! Masuk antrian verifikasi.' }
  return { success: true, message: 'Tepat waktu. Izin selesai.' }
}

export async function cariSantri(keyword: string) {
  return query<any>(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE nama_lengkap LIKE ?
    LIMIT 5
  `, [`%${keyword}%`])
}

export async function hapusIzin(id: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'keamanan', 'dewan_santri'].includes(session.role)) {
    return { error: 'Akses ditolak' }
  }
  await execute('DELETE FROM perizinan WHERE id = ?', [id])
  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}
