'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getPlottingPengawasStatus(eventId: number) {
    // Info pengawas
    const pengawas = await query<any>(`
        SELECT 
            COUNT(id) as total,
            SUM(CASE WHEN tag = 'senior' THEN 1 ELSE 0 END) as total_senior,
            SUM(CASE WHEN tag = 'junior' THEN 1 ELSE 0 END) as total_junior
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
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    
    await execute(`DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?`, [eventId])
    revalidatePath('/dashboard/ehb/pengawas')
    revalidatePath('/dashboard/ehb/pengawas/plotting')
    return { success: true }
}

export async function autoPlotPengawas(eventId: number) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    try {
        // 1. Ambil data pengawas
        const pengawasObj = await query<any>(`SELECT id, tag FROM ehb_pengawas WHERE ehb_event_id = ?`, [eventId])
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
        const ruanganList = await query<{id: number, nomor_ruangan: number}>(`SELECT id, nomor_ruangan FROM ehb_ruangan WHERE ehb_event_id = ? ORDER BY nomor_ruangan`, [eventId])
        if (ruanganList.length === 0) return { error: 'Belum ada ruangan.' }

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

        // Loop setiap slot: (tanggal, sesi, ruangan)
        for (const s of activeSesi) {
            const isLastSession = Math.max(...sesiPerTgl[s.tanggal]) === s.nomor_sesi

            for (const r of ruanganList) {
                // Cari pengawas yang cocok
                let selectedP = null
                
                // Shuffle pengawas to randomize tie-breakers
                const candidates = [...pengawasObj].sort(() => Math.random() - 0.5)
                
                // Sort by least assigned
                candidates.sort((a, b) => tugasCount[a.id] - tugasCount[b.id])

                for (const p of candidates) {
                    // Constraint 1: Senior tidak jaga sesi terakhir hari itu
                    if (isLastSession && p.tag === 'senior') continue

                    // Constraint 2: Tidak boleh jaga sesi berurutan di hari yang sama
                    const lastTugas = historySesi[p.id].slice(-1)[0]
                    if (lastTugas && lastTugas.tgl === s.tanggal && (s.nomor_sesi - lastTugas.sesi === 1)) {
                        continue // back-to-back
                    }
                    
                    // Constraint 3: Tentu saja tidak boleh di assign 2x di sesi yang sama
                    const jagaDiSesiSama = historySesi[p.id].some(h => h.tgl === s.tanggal && h.sesi === s.nomor_sesi)
                    if (jagaDiSesiSama) continue

                    // Memenuhi syarat!
                    selectedP = p
                    break
                }

                // Jika karena constraint yang sangat ketat kita tidak menemukan pengawas (misal semua back-to-back)
                // Kita fallback ambil siapa saja yang belum jaga di sesi ini (mengabaikan back-to-back)
                if (!selectedP) {
                     for (const p of candidates) {
                        const jagaDiSesiSama = historySesi[p.id].some(h => h.tgl === s.tanggal && h.sesi === s.nomor_sesi)
                        if (!jagaDiSesiSama) {
                            selectedP = p
                            break
                        }
                     }
                }

                // Masih ga ketemu? (Pengawas lebih sedikit dari ruangan) -> ini error fatal
                if (!selectedP) {
                     return { error: `Jumlah pengawas tidak mencukupi untuk memenuhi Ruangan pada Tanggal ${s.tanggal} Sesi ${s.nomor_sesi}. Tambah pengawas lagi.` }
                }

                // Assign
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

        revalidatePath('/dashboard/ehb/pengawas')
        revalidatePath('/dashboard/ehb/pengawas/plotting')
        return { success: true, count: insertStmts.length }

    } catch (err: any) {
        console.error("Auto Plotting Pengawas Error:", err)
        return { error: 'Terjadi kesalahan sistem: ' + err.message }
    }
}
