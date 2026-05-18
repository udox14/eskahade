'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import {
    ensurePengawasSchema,
    getPengawasRuleConfig,
    getSeniorRuleViolation,
    normalizeJenisKelamin,
    normalizePengawasTag,
    upsertPengawasRuleConfig,
} from './rules'

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
    await ensurePengawasSchema()

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
        return await query<any>(`SELECT id, nama_lengkap as nama FROM data_guru ORDER BY nama_lengkap`)
    } catch (e: any) {
        console.error("DB ERROR in getGuruList:", e.message)
        return { __error: "getGuruList: " + e.message } as any
    }
}

export async function getSadesaList() {
    try {
        return await query<any>(`
            SELECT id, nama_lengkap as nama, nis, asrama, kamar, jenis_kelamin
            FROM santri
            WHERE status_global = 'aktif'
              AND kategori_santri = 'SADESA'
            ORDER BY nama_lengkap
        `)
    } catch (e: any) {
        console.error("DB ERROR in getSadesaList:", e.message)
        return { __error: "getSadesaList: " + e.message } as any
    }
}

export async function addPengawas(eventId: number, pengawas: { guru_id?: number, nama_pengawas: string, tag: string, jenis_kelamin: string }[]) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    if (pengawas.length === 0) return { error: 'Data kosong' }

    const stmts = pengawas.map(p => ({
        sql: `INSERT INTO ehb_pengawas (ehb_event_id, guru_id, nama_pengawas, tag, jenis_kelamin) VALUES (?, ?, ?, ?, ?)`,
        params: [
            eventId,
            p.guru_id || null,
            p.nama_pengawas,
            normalizePengawasTag(p.tag),
            normalizeJenisKelamin(p.jenis_kelamin),
        ]
    }))

    await batch(stmts)
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas',
        action: 'create',
        fiturHref: '/dashboard/ehb/pengawas',
        logKind: 'create',
        entityType: 'ehb_pengawas_batch',
        entityId: String(eventId),
        entityLabel: 'Pengawas EHB',
        summary: `Menambahkan ${pengawas.length} pengawas EHB`,
        details: { event_id: eventId, total_pengawas: pengawas.length },
    })
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

export async function updatePengawas(id: number, data: { nama_pengawas: string, tag: string, jenis_kelamin: string }) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    await execute(
        `UPDATE ehb_pengawas SET nama_pengawas = ?, tag = ?, jenis_kelamin = ? WHERE id = ?`,
        [data.nama_pengawas, normalizePengawasTag(data.tag), normalizeJenisKelamin(data.jenis_kelamin), id]
    )
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas',
        action: 'update',
        fiturHref: '/dashboard/ehb/pengawas',
        logKind: 'update',
        entityType: 'ehb_pengawas',
        entityId: String(id),
        entityLabel: data.nama_pengawas,
        summary: `Memperbarui pengawas ${data.nama_pengawas}`,
        details: { tag: normalizePengawasTag(data.tag), jenis_kelamin: normalizeJenisKelamin(data.jenis_kelamin) },
    })
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

export async function deletePengawas(id: number) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    const target = await queryOne<{ nama_pengawas: string }>('SELECT nama_pengawas FROM ehb_pengawas WHERE id = ?', [id])

    // Hapus jadwalnya juga
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE pengawas_id = ?`, [id])
    await execute(`DELETE FROM ehb_pengawas WHERE id = ?`, [id])
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas',
        action: 'delete',
        fiturHref: '/dashboard/ehb/pengawas',
        logKind: 'delete',
        entityType: 'ehb_pengawas',
        entityId: String(id),
        entityLabel: target?.nama_pengawas ?? `Pengawas ${id}`,
        summary: `Menghapus pengawas ${target?.nama_pengawas ?? id}`,
    })
    
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// JADWAL PENGAWAS MANUAl / VIEW
// ──────────────────────────────────────────────────────────────────────────────

export async function getJadwalPengawasAll(eventId: number) {
    await ensurePengawasSchema()

    // Return flat list of all assignments
    return query<any>(`
        SELECT jp.*, p.nama_pengawas, p.tag, p.jenis_kelamin as pengawas_jenis_kelamin, r.nomor_ruangan, r.nama_ruangan, r.jenis_kelamin,
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

async function getLastSessionNumber(eventId: number, tanggal: string) {
    const row = await queryOne<{ max_sesi: number | null }>(`
        SELECT MAX(s.nomor_sesi) as max_sesi
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ? AND j.tanggal = ?
    `, [eventId, tanggal])

    return Number(row?.max_sesi || 0)
}

export async function saveAssignmentManual(eventId: number, jpId: number | null, pengawasId: number, ruanganId: number, tanggal: string, sesiId: number) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const detail = await queryOne<{
        nama_pengawas: string
        tag: string
        pengawas_jenis_kelamin: string
        ruangan_jenis_kelamin: string
        nomor_sesi: number
    }>(`
        SELECT
            p.nama_pengawas,
            p.tag,
            p.jenis_kelamin as pengawas_jenis_kelamin,
            r.jenis_kelamin as ruangan_jenis_kelamin,
            s.nomor_sesi
        FROM ehb_pengawas p
        JOIN ehb_ruangan r ON r.id = ?
        JOIN ehb_sesi s ON s.id = ?
        WHERE p.id = ?
    `, [ruanganId, sesiId, pengawasId])

    if (!detail) return { error: 'Data pengawas, ruangan, atau sesi tidak ditemukan.' }

    const pengawasGender = normalizeJenisKelamin(detail.pengawas_jenis_kelamin)
    const ruanganGender = normalizeJenisKelamin(detail.ruangan_jenis_kelamin)

    if (pengawasGender === 'P' && ruanganGender !== 'P') {
        return { error: `Pengawas perempuan hanya boleh diplot di ruangan perempuan.` }
    }

    if (normalizePengawasTag(detail.tag) === 'senior') {
        const lastSessionNumber = await getLastSessionNumber(eventId, tanggal)
        const config = await getPengawasRuleConfig(eventId)
        const violation = getSeniorRuleViolation(
            config,
            detail.nomor_sesi,
            lastSessionNumber > 0 && detail.nomor_sesi === lastSessionNumber
        )

        if (violation) return { error: violation }
    }

    try {
        if (jpId) {
            await execute(`UPDATE ehb_jadwal_pengawas SET pengawas_id = ? WHERE id = ?`, [pengawasId, jpId])
        } else {
            await execute(`
                INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id)
                VALUES (?, ?, ?, ?, ?)
            `, [eventId, pengawasId, ruanganId, tanggal, sesiId])
        }
        await logActivity({
            actor: actorFromSession(session),
            module: 'ehb_pengawas',
            action: jpId ? 'update' : 'create',
            fiturHref: '/dashboard/ehb/pengawas',
            logKind: jpId ? 'update' : 'create',
            entityType: 'ehb_jadwal_pengawas',
            entityId: jpId ? String(jpId) : `${eventId}:${pengawasId}:${ruanganId}:${tanggal}:${sesiId}`,
            entityLabel: 'Jadwal pengawas EHB',
            summary: `${jpId ? 'Memperbarui' : 'Menambahkan'} jadwal pengawas manual`,
            details: { event_id: eventId, pengawas_id: pengawasId, ruangan_id: ruanganId, tanggal, sesi_id: sesiId },
        })
        revalidatePath('/dashboard/ehb/pengawas')
        return { success: true }
    } catch(err: any) {
        if (err.message?.includes('UNIQUE')) return { error: 'Pengawas ini sudah bertugas di sesi yang sama, atau ruangan sudah terisi.'}
        return { error: err.message }
    }
}

export async function deleteAssignment(jpId: number) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE id = ?`, [jpId])
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas',
        action: 'delete',
        fiturHref: '/dashboard/ehb/pengawas',
        logKind: 'delete',
        entityType: 'ehb_jadwal_pengawas',
        entityId: String(jpId),
        entityLabel: 'Jadwal pengawas EHB',
        summary: `Menghapus jadwal pengawas manual`,
    })
    revalidatePath('/dashboard/ehb/pengawas')
    return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// CETAK KARTU PENGAWAS
// ──────────────────────────────────────────────────────────────────────────────
export async function getKartuPengawasData(eventId: number, pengawasId: number) {
    await ensurePengawasSchema()

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

export async function getPengawasRuleConfigForEvent(eventId: number) {
    return getPengawasRuleConfig(eventId)
}

export async function savePengawasRuleConfigForEvent(eventId: number, data: {
    senior_allowed_sesi: number[]
    senior_blocked_sesi: number[]
    senior_avoid_last_session: boolean
}) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const saved = await upsertPengawasRuleConfig(eventId, data)
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas',
        action: 'update',
        fiturHref: '/dashboard/ehb/pengawas',
        logKind: 'update',
        entityType: 'ehb_pengawas_config',
        entityId: String(eventId),
        entityLabel: 'Rule senior pengawas EHB',
        summary: `Memperbarui rule pengawas senior EHB`,
        details: saved,
    })

    revalidatePath('/dashboard/ehb/pengawas')
    revalidatePath('/dashboard/ehb/pengawas/plotting')
    return { success: true, config: saved }
}
