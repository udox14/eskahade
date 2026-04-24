'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────────────────────────────────────
// EVENT
// ──────────────────────────────────────────────────────────────────────────────

export async function getActiveEventLight() {
    return queryOne<{ id: number, nama: string }>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

// ──────────────────────────────────────────────────────────────────────────────
// PENGAWAS (GURU)
// ──────────────────────────────────────────────────────────────────────────────

export async function getPengawasList(eventId: number) {
    try {
        return await query<any>(`
            SELECT p.*,
                (SELECT COUNT(*) FROM ehb_jadwal_pengawas jp WHERE jp.pengawas_id = p.id) as total_tugas
            FROM ehb_pengawas p
            WHERE p.ehb_event_id = ?
            ORDER BY p.nama_pengawas
        `, [eventId])
    } catch (e: any) {
        console.error("DB ERROR in getPengawasList:", e.message)
        return { __error: "getPengawasList: " + e.message } as any
    }
}

// Ambil semua guru untuk pilihan tambah pengawas
export async function getGuruList() {
    try {
        return await query<any>(`SELECT id, nama_lengkap as nama, status_kepegawaian FROM data_guru ORDER BY nama_lengkap`)
    } catch (e: any) {
        console.error("DB ERROR in getGuruList:", e.message)
        return { __error: "getGuruList: " + e.message } as any
    }
}

export async function addPengawas(eventId: number, pengawas: { guru_id?: number, nama_pengawas: string, tag: string }[]) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    if (pengawas.length === 0) return { error: 'Data kosong' }

    const stmts = pengawas.map(p => ({
        sql: `INSERT INTO ehb_pengawas (ehb_event_id, guru_id, nama_pengawas, tag) VALUES (?, ?, ?, ?)`,
        params: [eventId, p.guru_id || null, p.nama_pengawas, p.tag]
    }))

    await batch(stmts)
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

export async function updatePengawas(id: number, data: { nama_pengawas: string, tag: string }) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    await execute(`UPDATE ehb_pengawas SET nama_pengawas = ?, tag = ? WHERE id = ?`, [data.nama_pengawas, data.tag, id])
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

export async function deletePengawas(id: number) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    // Hapus jadwalnya juga
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE pengawas_id = ?`, [id])
    await execute(`DELETE FROM ehb_pengawas WHERE id = ?`, [id])
    
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// JADWAL PENGAWAS MANUAl / VIEW
// ──────────────────────────────────────────────────────────────────────────────

export async function getJadwalPengawasAll(eventId: number) {
    // Return flat list of all assignments
    return query<any>(`
        SELECT jp.*, p.nama_pengawas, p.tag, r.nomor_ruangan, r.nama_ruangan, r.jenis_kelamin,
               s.nomor_sesi, s.label as sesi_label, s.jam_group
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_pengawas p ON p.id = jp.pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE jp.ehb_event_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi, r.nomor_ruangan
    `, [eventId])
}

export async function getSesiList(eventId: number) {
    return query<any>(`SELECT * FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi`, [eventId])
}

export async function getTanggalList(eventId: number) {
    // Ambil tanggal dari jadwal EHB
    const res = await query<{tanggal: string}>(`SELECT DISTINCT tanggal FROM ehb_jadwal WHERE ehb_event_id = ? ORDER BY tanggal`, [eventId])
    return res.map(r => r.tanggal)
}

export async function getRuanganList(eventId: number) {
    return query<any>(`SELECT * FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan`, [eventId])
}

export async function saveAssignmentManual(eventId: number, jpId: number | null, pengawasId: number, ruanganId: number, tanggal: string, sesiId: number) {
     const session = await getSession()
     if (!session) return { error: 'Unauthorized' }

     try {
         if (jpId) {
             await execute(`UPDATE ehb_jadwal_pengawas SET pengawas_id = ? WHERE id = ?`, [pengawasId, jpId])
         } else {
             await execute(`
                 INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id)
                 VALUES (?, ?, ?, ?, ?)
             `, [eventId, pengawasId, ruanganId, tanggal, sesiId])
         }
         revalidatePath('/dashboard/ehb/pengawas')
         return { success: true }
     } catch(err: any) {
         if (err.message?.includes('UNIQUE')) return { error: 'Pengawas ini sudah bertugas di sesi yang sama, atau ruangan sudah terisi.'}
         return { error: err.message }
     }
}

export async function deleteAssignment(jpId: number) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE id = ?`, [jpId])
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// CETAK KARTU PENGAWAS
// ──────────────────────────────────────────────────────────────────────────────
export async function getKartuPengawasData(eventId: number, pengawasId: number) {
    const pengawas = await queryOne<any>(`SELECT * FROM ehb_pengawas WHERE id = ?`, [pengawasId])
    if (!pengawas) return null

    const tugas = await query<any>(`
        SELECT jp.tanggal, s.label as sesi_label, s.waktu_mulai, s.waktu_selesai, r.nomor_ruangan, r.jenis_kelamin
        FROM ehb_jadwal_pengawas jp
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        WHERE jp.pengawas_id = ?
        ORDER BY jp.tanggal, s.nomor_sesi
    `, [pengawasId])

    return { pengawas, tugas }
}
