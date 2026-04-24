'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getPlottingStatus(eventId: number) {
  // Ambil total santri aktif yang punya kelas dan map ke jam group via ehb_kelas_jam
  // Dikelompokkan per L/P
  const status = await query<any>(`
    SELECT 
      s.jenis_kelamin,
      COUNT(s.id) as total_santri,
      SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as terplot
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ?
    WHERE s.status_global = 'aktif'
    GROUP BY s.jenis_kelamin
  `, [eventId, eventId])

  // Ambil total kapasitas ruangan per L/P
  const kapasitas = await query<any>(`
    SELECT jenis_kelamin, SUM(kapasitas) as total_kapasitas, COUNT(id) as total_ruangan
    FROM ehb_ruangan
    WHERE ehb_event_id = ?
    GROUP BY jenis_kelamin
  `, [eventId])

  // Get unique jam groups for the event
  const jamGroups = await query<{jam_group: string}>(`
    SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ?
  `, [eventId])

  return { status, kapasitas, jamGroups: jamGroups.map(j => j.jam_group) }
}

export async function resetPlotting(eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  
  await execute(`DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?`, [eventId])
  revalidatePath('/dashboard/ehb/ruangan/plotting')
  revalidatePath('/dashboard/ehb/ruangan')
  return { success: true }
}

export async function autoPlotSantri(eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    // 1. Dapatkan daftar jam_group yang ada mappingnya
    const jamGroupsObj = await query<{jam_group: string}>(`SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ?`, [eventId])
    const jamGroups = jamGroupsObj.map(j => j.jam_group)

    if (jamGroups.length === 0) return { error: 'Belum ada mapping kelas ke jam group. Atur dulu di menu Jadwal EHB.' }

    // 2. Ambil semua ruangan per jenis_kelamin
    const ruanganL = await query<any>(`SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'L' ORDER BY nomor_ruangan`, [eventId])
    const ruanganP = await query<any>(`SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'P' ORDER BY nomor_ruangan`, [eventId])

    if (ruanganL.length === 0 && ruanganP.length === 0) return { error: 'Belum ada ruangan yang dikonfigurasi.' }

    // Hapus plotting lama untuk event ini
    await execute(`DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?`, [eventId])

    const insertStmts: {sql: string, params: any[]}[] = []

    // 3. Proses untuk setiap jenis kelamin dan setiap jam group secara terpisah
    const processPlotting = async (jk: string, ruanganList: any[]) => {
      if (ruanganList.length === 0) return

      for (const jg of jamGroups) {
        // Ambil santri yang sesuai JK, belum lulus, punya kelas, dan kelasnya masuk ke jam_group ini
        // Kita juga ambil urutan marhalah untuk cross seating
        const santriList = await query<any>(`
          SELECT s.id as santri_id, m.urutan as marhalah_urutan
          FROM santri s
          JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
          JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ? AND kj.jam_group = ?
          JOIN kelas k ON k.id = rp.kelas_id
          JOIN marhalah m ON m.id = k.marhalah_id
          WHERE s.status_global = 'aktif' AND s.jenis_kelamin = ?
        `, [eventId, jg, jk])

        if (santriList.length === 0) continue

        // Shuffle within same marhalah to make it random but we still know their marhalah
        const groupedByMarhalah: Record<number, string[]> = {}
        santriList.forEach((s: any) => {
          if (!groupedByMarhalah[s.marhalah_urutan]) groupedByMarhalah[s.marhalah_urutan] = []
          groupedByMarhalah[s.marhalah_urutan].push(s.santri_id)
        })

        // Shuffle arrays
        Object.keys(groupedByMarhalah).forEach(k => {
          groupedByMarhalah[parseInt(k)].sort(() => Math.random() - 0.5)
        })

        // Interleave algorithm for cross seating
        // Misal: A, B, C marhalah yang berbeda
        // Urutannya: A1, B1, C1, A2, B2, C2 ...
        const interleavedSantri: string[] = []
        let hasMore = true
        while(hasMore) {
          hasMore = false
          // Sort keys to pick predictably or we can randomize the pick order
          const keys = Object.keys(groupedByMarhalah).map(Number).sort((a,b)=>a-b)
          for (const k of keys) {
            if (groupedByMarhalah[k].length > 0) {
              interleavedSantri.push(groupedByMarhalah[k].pop()!)
              hasMore = true
            }
          }
        }

        // Mulai masukkan ke ruangan
        let sIdx = 0
        for (const r of ruanganList) {
          let kursi = 1
          while (kursi <= r.kapasitas && sIdx < interleavedSantri.length) {
            const sid = interleavedSantri[sIdx]
            insertStmts.push({
              sql: `INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group) VALUES (?, ?, ?, ?, ?)`,
              params: [eventId, r.id, sid, kursi, jg]
            })
            kursi++
            sIdx++
          }
        }

        // Note: Kalau sIdx < interleavedSantri.length berarti ada santri yang tidak kebagian ruangan (kapasitas kurang)
        // Kita biarkan saja (unplotted) agar admin bisa melihatnya dan menambah ruangan.
      }
    }

    await processPlotting('L', ruanganL)
    await processPlotting('P', ruanganP)

    if (insertStmts.length > 0) {
      await batch(insertStmts)
    }

    revalidatePath('/dashboard/ehb/ruangan/plotting')
    revalidatePath('/dashboard/ehb/ruangan')

    return { success: true, count: insertStmts.length }

  } catch (err: any) {
    console.error("Auto Plotting Error:", err)
    return { error: 'Terjadi kesalahan sistem saat plotting: ' + err.message }
  }
}

export async function getUnplottedSantri(eventId: number) {
   return query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, k.nama_kelas, kj.jam_group
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ?
    WHERE s.status_global = 'aktif' AND p.id IS NULL
    ORDER BY s.jenis_kelamin, k.nama_kelas, s.nama_lengkap
  `, [eventId, eventId])
}
