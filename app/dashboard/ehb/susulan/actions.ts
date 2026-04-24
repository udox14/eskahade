'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getActiveEventLight() {
  return queryOne<{ id: number, nama: string }>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

export async function getSusulanList(eventId: number) {
    // Ambil daftar absensi (A/I/S) yang belum diselesaikan susulannya
    return query<any>(`
        SELECT 
            a.id as absensi_id,
            a.tanggal,
            a.status_absen,
            a.is_susulan_done,
            s.id as santri_id,
            s.nama_lengkap,
            s.nis,
            k.nama_kelas,
            m.nama as mapel_nama
        FROM ehb_absensi a
        JOIN santri s ON s.id = a.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN ehb_jadwal j ON j.kelas_id = k.id AND j.tanggal = a.tanggal AND j.sesi_id = a.sesi_id
        JOIN mapel m ON m.id = j.mapel_id
        WHERE a.ehb_event_id = ?
        ORDER BY a.is_susulan_done ASC, a.tanggal DESC, k.nama_kelas ASC, s.nama_lengkap ASC
    `, [eventId])
}

export async function markSusulanDone(absensiIds: number[]) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    try {
        const placeholders = absensiIds.map(() => '?').join(',')
        await execute(`UPDATE ehb_absensi SET is_susulan_done = 1 WHERE id IN (${placeholders})`, absensiIds)
        revalidatePath('/dashboard/ehb/susulan')
        return { success: true }
    } catch (err: any) {
        return { error: err.message }
    }
}
