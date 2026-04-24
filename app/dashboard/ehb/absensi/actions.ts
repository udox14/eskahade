'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getActiveEventLight() {
  return queryOne<{ id: number, nama: string }>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

// 1. Get Sesi List (Grouped by Tanggal & Sesi)
export async function getJadwalAktifList(eventId: number) {
    // Ambil daftar tanggal & sesi yang ada jadwal ulangannya
    return query<any>(`
        SELECT DISTINCT j.tanggal, j.sesi_id, s.label, s.jam_group, s.waktu_mulai, s.waktu_selesai
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ?
        ORDER BY j.tanggal, s.nomor_sesi
    `, [eventId])
}

// 2. Get Ruangan List for specific (Tanggal & Sesi)
export async function getRuanganForJadwal(eventId: number, tanggal: string, sesiId: number, jamGroup: string) {
    // Ambil semua ruangan fisik
    const ruanganList = await query<any>(`SELECT id, nomor_ruangan, nama_ruangan, jenis_kelamin FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan`, [eventId])
    
    // Ambil statistik per ruangan khusus untuk jamGroup dan jadwal yang ada mapelnya
    const statsList = await query<any>(`
        SELECT 
            p.ruangan_id,
            COUNT(s.id) as jumlah_peserta,
            GROUP_CONCAT(DISTINCT k.nama_kelas) as kelas_list
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN ehb_jadwal j ON j.kelas_id = k.id AND j.tanggal = ? AND j.sesi_id = ?
        WHERE p.ehb_event_id = ? AND p.jam_group = ?
        GROUP BY p.ruangan_id
    `, [tanggal, sesiId, eventId, jamGroup])

    const statsMap: any = {}
    statsList.forEach((st: any) => {
        statsMap[st.ruangan_id] = st
    })

    // Filter ruangan yang hanya punya peserta
    return ruanganList
        .map(r => ({
            ...r,
            jumlah_peserta: statsMap[r.id]?.jumlah_peserta || 0,
            kelas_list: statsMap[r.id]?.kelas_list || ''
        }))
        .filter(r => r.jumlah_peserta > 0)
}

// 3. Get List Peserta in Ruangan for specific (Tanggal & Sesi)
export async function getPesertaForAbsensi(eventId: number, ruanganId: number, tanggal: string, sesiId: number, jamGroup: string) {
    // Ambil santri di ruangan tsb, jam_group tsb, DAN kelasnya ada jadwal di (tanggal, sesiId)
    return query<any>(`
        SELECT 
            p.nomor_kursi, s.id as santri_id, s.nama_lengkap, s.nis, 
            k.nama_kelas, m.nama as marhalah_nama,
            a.status_absen
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN marhalah m ON m.id = k.marhalah_id
        JOIN ehb_jadwal j ON j.kelas_id = k.id AND j.tanggal = ? AND j.sesi_id = ?
        LEFT JOIN ehb_absensi a ON a.santri_id = s.id AND a.tanggal = ? AND a.sesi_id = ? AND a.ehb_event_id = ?
        WHERE p.ruangan_id = ? AND p.jam_group = ? AND p.ehb_event_id = ?
        ORDER BY p.nomor_kursi
    `, [tanggal, sesiId, tanggal, sesiId, eventId, ruanganId, jamGroup, eventId])
}

// 4. Save Absensi (Array of updates)
export async function saveAbsensiBatch(eventId: number, tanggal: string, sesiId: number, absensiUpdates: { santri_id: string, status: string | null }[]) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    try {
        const stmts = []
        
        for (const update of absensiUpdates) {
            if (update.status) {
                // Insert or Update (A/I/S)
                stmts.push({
                    sql: `
                        INSERT INTO ehb_absensi (ehb_event_id, santri_id, tanggal, sesi_id, status_absen) 
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(ehb_event_id, santri_id, tanggal, sesi_id) 
                        DO UPDATE SET status_absen = excluded.status_absen
                    `,
                    params: [eventId, update.santri_id, tanggal, sesiId, update.status]
                })
            } else {
                // Remove (Hadir)
                stmts.push({
                    sql: `DELETE FROM ehb_absensi WHERE ehb_event_id = ? AND santri_id = ? AND tanggal = ? AND sesi_id = ?`,
                    params: [eventId, update.santri_id, tanggal, sesiId]
                })
            }
        }

        if (stmts.length > 0) {
            await batch(stmts)
        }
        revalidatePath('/dashboard/ehb/absensi')
        return { success: true }
    } catch (err: any) {
        return { error: err.message }
    }
}
