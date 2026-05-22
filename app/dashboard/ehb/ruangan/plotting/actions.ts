'use server'

import { query, execute, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

type PlotSantri = {
  santri_id: string
  marhalah_urutan: number
  marhalah_nama: string
}

type PlottingStatusRow = {
  jenis_kelamin: string
  jam_group: string
  total_santri: number
  terplot: number
}

type KapasitasRuanganRow = {
  jenis_kelamin: string
  total_kapasitas: number
  total_ruangan: number
}

type RuanganKapasitasDetailRow = {
  jenis_kelamin: string
  kapasitas: number
  nomor_ruangan: number
}

type RuanganSeatRow = {
  id: number
  nomor_ruangan: number
  kapasitas: number
}

type BatchStatement = {
  sql: string
  params: unknown[]
}

type UnplottedSantriRow = {
  id: string
  nama_lengkap: string
  nis: string
  jenis_kelamin: string
  nama_kelas: string
  jam_group: string
}

function normalizeMarhalahKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function getPlottingStatus(eventId: number) {
  // Ambil total santri aktif yang punya kelas dan map ke jam group via ehb_kelas_jam
  // Dikelompokkan per L/P
  const status = await query<PlottingStatusRow>(`
    SELECT 
      s.jenis_kelamin,
      kj.jam_group,
      COUNT(s.id) as total_santri,
      SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as terplot
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ? AND p.jam_group = kj.jam_group
    WHERE s.status_global IN ('aktif', 'nonaktif_sementara') AND m.nama NOT LIKE '%Mutaqaddimah%'
    GROUP BY s.jenis_kelamin, kj.jam_group
  `, [eventId, eventId])

  // Ambil total kapasitas ruangan per L/P
  const kapasitas = await query<KapasitasRuanganRow>(`
    SELECT jenis_kelamin, SUM(kapasitas) as total_kapasitas, COUNT(id) as total_ruangan
    FROM ehb_ruangan
    WHERE ehb_event_id = ?
    GROUP BY jenis_kelamin
  `, [eventId])

  const kapasitasDetail = await query<RuanganKapasitasDetailRow>(`
    SELECT jenis_kelamin, kapasitas, nomor_ruangan
    FROM ehb_ruangan
    WHERE ehb_event_id = ?
    ORDER BY jenis_kelamin, kapasitas DESC, nomor_ruangan ASC
  `, [eventId])

  // Get unique jam groups for the event
  const jamGroups = await query<{jam_group: string}>(`
    SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ?
  `, [eventId])

  return { status, kapasitas, kapasitasDetail, jamGroups: jamGroups.map(j => j.jam_group) }
}

export async function resetPlotting(eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  
  await execute(`DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?`, [eventId])
  await logActivity({
    actor: actorFromSession(session),
    module: 'ehb_ruangan_plotting',
    action: 'delete',
    fiturHref: '/dashboard/ehb/ruangan/plotting',
    logKind: 'delete',
    entityType: 'ehb_plotting_santri_batch',
    entityId: String(eventId),
    entityLabel: 'Plotting ruangan EHB',
    summary: `Mereset plotting peserta EHB`,
  })
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
    const ruanganL = await query<RuanganSeatRow>(`SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'L' ORDER BY nomor_ruangan`, [eventId])
    const ruanganP = await query<RuanganSeatRow>(`SELECT id, nomor_ruangan, kapasitas FROM ehb_ruangan WHERE ehb_event_id = ? AND jenis_kelamin = 'P' ORDER BY nomor_ruangan`, [eventId])

    if (ruanganL.length === 0 && ruanganP.length === 0) return { error: 'Belum ada ruangan yang dikonfigurasi.' }

    // Hapus plotting lama untuk event ini
    await execute(`DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?`, [eventId])

    const insertStmts: BatchStatement[] = []

    // 3. Proses untuk setiap jenis kelamin dan setiap jam group secara terpisah
    const processPlotting = async (jk: string, ruanganList: RuanganSeatRow[]) => {
      if (ruanganList.length === 0) return

      for (const jg of jamGroups) {
        // Ambil santri yang sesuai JK, belum lulus, punya kelas, dan kelasnya masuk ke jam_group ini
        // Kita juga ambil urutan marhalah untuk cross seating
        const santriList = await query<PlotSantri>(`
          SELECT s.id as santri_id, m.urutan as marhalah_urutan, m.nama as marhalah_nama
          FROM santri s
          JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
          JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ? AND kj.jam_group = ?
          JOIN kelas k ON k.id = rp.kelas_id
          JOIN marhalah m ON m.id = k.marhalah_id
          WHERE s.status_global IN ('aktif', 'nonaktif_sementara') AND s.jenis_kelamin = ? AND m.nama NOT LIKE '%Mutaqaddimah%'
          ORDER BY m.urutan ASC, k.nama_kelas ASC, s.nama_lengkap ASC
        `, [eventId, jg, jk])

        if (santriList.length === 0) continue

        // Bagi marhalah menjadi 2 track (ganjil/genap).
        // Cari marhalah dengan jumlah peserta terbanyak pada jam_group ini.
        // Semua peserta marhalah dominan masuk kursi ganjil.
        // Semua peserta marhalah lain masuk kursi genap.
        const marhalahCounts = new Map<string, { count: number; urutan: number; nama: string }>()
        for (const santri of santriList) {
          const key = `${santri.marhalah_urutan}|||${normalizeMarhalahKey(santri.marhalah_nama)}`
          const existing = marhalahCounts.get(key)
          if (existing) {
            existing.count += 1
          } else {
            marhalahCounts.set(key, {
              count: 1,
              urutan: santri.marhalah_urutan,
              nama: santri.marhalah_nama,
            })
          }
        }

        const dominantMarhalahKey = Array.from(marhalahCounts.entries())
          .sort((a, b) => {
            if (b[1].count !== a[1].count) return b[1].count - a[1].count
            if (a[1].urutan !== b[1].urutan) return a[1].urutan - b[1].urutan
            return a[1].nama.localeCompare(b[1].nama)
          })[0]?.[0]

        if (!dominantMarhalahKey) continue

        const trackOdd = santriList.filter(
          santri => `${santri.marhalah_urutan}|||${normalizeMarhalahKey(santri.marhalah_nama)}` === dominantMarhalahKey
        )
        const trackEven = santriList.filter(
          santri => `${santri.marhalah_urutan}|||${normalizeMarhalahKey(santri.marhalah_nama)}` !== dominantMarhalahKey
        )

        // Mulai masukkan ke ruangan berurutan
        for (const r of ruanganList) {
          let kursi = 1
          while (kursi <= r.kapasitas && (trackOdd.length > 0 || trackEven.length > 0)) {
            let chosenSeat: PlotSantri | undefined

            if (kursi % 2 === 1) {
              chosenSeat = trackOdd.shift()
            } else {
              chosenSeat = trackEven.shift()
            }

            if (!chosenSeat) {
              kursi++
              continue
            }

            insertStmts.push({
              sql: `INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group) VALUES (?, ?, ?, ?, ?)`,
              params: [eventId, r.id, chosenSeat.santri_id, kursi, jg]
            })
            kursi++
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
    await logActivity({
      actor: actorFromSession(session),
      module: 'ehb_ruangan_plotting',
      action: 'update',
      fiturHref: '/dashboard/ehb/ruangan/plotting',
      logKind: 'update',
      entityType: 'ehb_plotting_santri_batch',
      entityId: String(eventId),
      entityLabel: 'Plotting ruangan EHB',
      summary: `Melakukan auto plotting peserta EHB`,
      details: { total_assignment: insertStmts.length, jam_groups: jamGroups.length },
    })

    revalidatePath('/dashboard/ehb/ruangan/plotting')
    revalidatePath('/dashboard/ehb/ruangan')

    return { success: true, count: insertStmts.length }

  } catch (err: unknown) {
    console.error("Auto Plotting Error:", err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: 'Terjadi kesalahan sistem saat plotting: ' + message }
  }
}

export async function getUnplottedSantri(eventId: number) {
   return query<UnplottedSantriRow>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, k.nama_kelas, kj.jam_group
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ?
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_plotting_santri p ON p.santri_id = s.id AND p.ehb_event_id = ?
    WHERE s.status_global IN ('aktif', 'nonaktif_sementara') AND p.id IS NULL AND m.nama NOT LIKE '%Mutaqaddimah%'
    ORDER BY s.jenis_kelamin, k.nama_kelas, s.nama_lengkap
  `, [eventId, eventId])
}
