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
} from '../rules'

export async function getPlottingPengawasStatus(eventId: number) {
    await ensurePengawasSchema()

    // Info pengawas
    const pengawas = await query<any>(`
        SELECT 
            COUNT(id) as total,
            SUM(CASE WHEN tag = 'senior' THEN 1 ELSE 0 END) as total_senior,
            SUM(CASE WHEN tag = 'junior' THEN 1 ELSE 0 END) as total_junior,
            SUM(CASE WHEN jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_perempuan,
            SUM(CASE WHEN jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_laki
        FROM ehb_pengawas WHERE ehb_event_id = ?
    `, [eventId])

    // Info slot tugas yang dibutuhkan
    // Berapa ruangan ujian yang aktif per sesi per tanggal?
    // Ruangan aktif = ruangan yang ADA pesertanya untuk jam_group yang bersesuaian dengan sesi yang aktif pada tanggal tersebut
    
    // Tapi untuk simple logic:
    // Slot dibutuhkan = Jumlah Ruangan x Jumlah Sesi Aktif per Tanggal
    
    // Ambil tanggal & sesi dari jadwal
    const activeSlots = await query<any>(`
        SELECT j.tanggal, j.sesi_id, s.nomor_sesi, s.jam_group
        FROM ehb_jadwal j
        JOIN ehb_sesi s ON s.id = j.sesi_id
        WHERE j.ehb_event_id = ?
        GROUP BY j.tanggal, j.sesi_id
    `, [eventId])

    // Ambil ruangan
    const ruangan = await query<{id: number}>(`SELECT id FROM ehb_ruangan WHERE ehb_event_id = ?`, [eventId])
    
    const totalSlotDibutuhkan = activeSlots.length * ruangan.length

    // Info yang sudah terplot
    const terplot = await queryOne<{total: number}>(`SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?`, [eventId])

    return { 
        pengawas: pengawas[0] || { total: 0, total_senior: 0, total_junior: 0 },
        slotDibutuhkan: totalSlotDibutuhkan,
        terplot: terplot?.total || 0
    }
}

export async function resetPlottingPengawas(eventId: number) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?`, [eventId])
    await logActivity({
        actor: actorFromSession(session),
        module: 'ehb_pengawas_plotting',
        action: 'delete',
        fiturHref: '/dashboard/ehb/pengawas/plotting',
        logKind: 'delete',
        entityType: 'ehb_jadwal_pengawas_batch',
        entityId: String(eventId),
        entityLabel: 'Plotting pengawas EHB',
        summary: `Mereset plotting pengawas EHB`,
    })
    revalidatePath('/dashboard/ehb/pengawas')
    revalidatePath('/dashboard/ehb/pengawas/plotting')
    return { success: true }
}

export async function autoPlotPengawas(eventId: number) {
    await ensurePengawasSchema()

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    try {
        // 1. Ambil data pengawas
        const pengawasObj = await query<any>(`
            SELECT id, tag, jenis_kelamin
            FROM ehb_pengawas
            WHERE ehb_event_id = ?
        `, [eventId])
        if (pengawasObj.length === 0) return { error: 'Belum ada pengawas terdaftar.' }

        // 2. Ambil jadwal aktif (tanggal & sesi yang ada ujiannya)
        const activeSesi = await query<any>(`
            SELECT j.tanggal, j.sesi_id, s.nomor_sesi
            FROM ehb_jadwal j
            JOIN ehb_sesi s ON s.id = j.sesi_id
            WHERE j.ehb_event_id = ?
            GROUP BY j.tanggal, j.sesi_id
            ORDER BY j.tanggal, s.nomor_sesi
        `, [eventId])

        if (activeSesi.length === 0) return { error: 'Belum ada jadwal ujian yang terisi.' }

        // 3. Ambil ruangan (semua ruangan)
        const ruanganList = await query<{id: number, nomor_ruangan: number, jenis_kelamin: string}>(`
            SELECT id, nomor_ruangan, jenis_kelamin
            FROM ehb_ruangan
            WHERE ehb_event_id = ?
            ORDER BY nomor_ruangan
        `, [eventId])
        if (ruanganList.length === 0) return { error: 'Belum ada ruangan.' }

        const seniorConfig = await getPengawasRuleConfig(eventId)

        // Jika slot > pengawas, berarti pengawas akan jaga berkali-kali
        
        // Hapus plotting lama
        await execute(`DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?`, [eventId])

        const insertStmts: {sql: string, params: any[]}[] = []
        
        // State tracking untuk fairness & constraints
        const tugasCount: Record<number, number> = {} // pengawas_id -> total jaga
        pengawasObj.forEach(p => tugasCount[p.id] = 0)

        const historySesi: Record<number, {tgl: string, sesi: number}[]> = {}
        pengawasObj.forEach(p => historySesi[p.id] = [])

        // Group sesi by tanggal untuk mengetahui "last session of the day"
        const sesiPerTgl: Record<string, number[]> = {}
        activeSesi.forEach(s => {
            if (!sesiPerTgl[s.tanggal]) sesiPerTgl[s.tanggal] = []
            sesiPerTgl[s.tanggal].push(s.nomor_sesi)
        })

        const pickCandidate = (
            roomGender: 'L' | 'P',
            tanggal: string,
            nomorSesi: number,
            isLastSession: boolean,
            options?: {
                requiredGender?: 'L' | 'P'
                disallowGender?: 'L' | 'P'
                ignoreBackToBack?: boolean
            }
        ) => {
            const seeded = pengawasObj
                .map(p => ({ ...p, seed: Math.random() }))
                .sort((a, b) => a.seed - b.seed)
                .sort((a, b) => tugasCount[a.id] - tugasCount[b.id])

            for (const p of seeded) {
                const pengawasGender = normalizeJenisKelamin(p.jenis_kelamin)
                const pengawasTag = normalizePengawasTag(p.tag)

                if (pengawasGender === 'P' && roomGender !== 'P') continue
                if (options?.requiredGender && pengawasGender !== options.requiredGender) continue
                if (options?.disallowGender && pengawasGender === options.disallowGender) continue

                if (pengawasTag === 'senior') {
                    const violation = getSeniorRuleViolation(seniorConfig, nomorSesi, isLastSession)
                    if (violation) continue
                }

                const jagaDiSesiSama = historySesi[p.id].some(h => h.tgl === tanggal && h.sesi === nomorSesi)
                if (jagaDiSesiSama) continue

                if (!options?.ignoreBackToBack) {
                    const lastTugas = historySesi[p.id].slice(-1)[0]
                    if (lastTugas && lastTugas.tgl === tanggal && nomorSesi - lastTugas.sesi === 1) {
                        continue
                    }
                }

                return p
            }

            return null
        }

        // Loop setiap slot: (tanggal, sesi, ruangan)
        for (const s of activeSesi) {
            const isLastSession = Math.max(...sesiPerTgl[s.tanggal]) === s.nomor_sesi
            const femaleRooms = ruanganList
                .filter(room => normalizeJenisKelamin(room.jenis_kelamin) === 'P')
                .sort((a, b) => a.nomor_ruangan - b.nomor_ruangan)
            const maleRooms = ruanganList
                .filter(room => normalizeJenisKelamin(room.jenis_kelamin) !== 'P')
                .sort((a, b) => a.nomor_ruangan - b.nomor_ruangan)

            const femaleCandidatesForSession = pengawasObj.filter(p => {
                if (normalizeJenisKelamin(p.jenis_kelamin) !== 'P') return false
                if (historySesi[p.id].some(h => h.tgl === s.tanggal && h.sesi === s.nomor_sesi)) return false
                if (normalizePengawasTag(p.tag) === 'senior') {
                    const violation = getSeniorRuleViolation(seniorConfig, s.nomor_sesi, isLastSession)
                    if (violation) return false
                }
                return true
            })

            const femaleBlockSize = Math.min(femaleRooms.length, femaleCandidatesForSession.length)
            const reservedFemaleRoomIds = new Set(femaleRooms.slice(0, femaleBlockSize).map(room => room.id))

            const roomSequence = [
                ...maleRooms,
                ...femaleRooms.filter(room => reservedFemaleRoomIds.has(room.id)),
                ...femaleRooms.filter(room => !reservedFemaleRoomIds.has(room.id)),
            ]

            for (const r of roomSequence) {
                const roomGender = normalizeJenisKelamin(r.jenis_kelamin)
                const isReservedFemaleRoom = reservedFemaleRoomIds.has(r.id)

                let selectedP = pickCandidate(roomGender, s.tanggal, s.nomor_sesi, isLastSession, {
                    requiredGender: isReservedFemaleRoom ? 'P' : undefined,
                    disallowGender: roomGender === 'P' && !isReservedFemaleRoom ? 'P' : undefined,
                })

                if (!selectedP) {
                    selectedP = pickCandidate(roomGender, s.tanggal, s.nomor_sesi, isLastSession, {
                        requiredGender: isReservedFemaleRoom ? 'P' : undefined,
                        disallowGender: roomGender === 'P' && !isReservedFemaleRoom ? 'P' : undefined,
                        ignoreBackToBack: true,
                    })
                }

                if (!selectedP) {
                    const targetRoomLabel = `ruangan ${r.nomor_ruangan}`
                    return {
                        error: `Jumlah pengawas tidak mencukupi untuk memenuhi ${targetRoomLabel} pada tanggal ${s.tanggal} sesi ${s.nomor_sesi}.`
                    }
                }

                insertStmts.push({
                    sql: `INSERT INTO ehb_jadwal_pengawas (ehb_event_id, pengawas_id, ruangan_id, tanggal, sesi_id) VALUES (?, ?, ?, ?, ?)`,
                    params: [eventId, selectedP.id, r.id, s.tanggal, s.sesi_id]
                })

                tugasCount[selectedP.id]++
                historySesi[selectedP.id].push({ tgl: s.tanggal, sesi: s.nomor_sesi })
            }
        }

        if (insertStmts.length > 0) {
            await batch(insertStmts)
        }
        await logActivity({
            actor: actorFromSession(session),
            module: 'ehb_pengawas_plotting',
            action: 'update',
            fiturHref: '/dashboard/ehb/pengawas/plotting',
            logKind: 'update',
            entityType: 'ehb_jadwal_pengawas_batch',
            entityId: String(eventId),
            entityLabel: 'Plotting pengawas EHB',
            summary: `Melakukan auto plotting pengawas EHB`,
            details: { total_assignment: insertStmts.length },
        })

        revalidatePath('/dashboard/ehb/pengawas')
        revalidatePath('/dashboard/ehb/pengawas/plotting')
        return { success: true, count: insertStmts.length }

    } catch (err: any) {
        console.error("Auto Plotting Pengawas Error:", err)
        return { error: 'Terjadi kesalahan sistem: ' + err.message }
    }
}
