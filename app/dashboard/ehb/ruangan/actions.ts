'use server'

import { query, queryOne, execute, generateId, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────────────────────────────────────
// RUANGAN
// ──────────────────────────────────────────────────────────────────────────────

export async function getRuanganList(eventId: number, jamGroup?: string) {
  if (jamGroup) {
      return query<any>(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id AND p.jam_group = ?) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `, [jamGroup, eventId])
  } else {
      return query<any>(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `, [eventId])
  }
}

export async function getJamGroups(eventId: number) {
    return query<{jam_group: string}>(`SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ? ORDER BY jam_group`, [eventId])
}

export async function addRuangan(eventId: number, data: { nomor_ruangan: number, nama_ruangan: string, kapasitas: number, jenis_kelamin: string }) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    await execute(`
      INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin)
      VALUES (?, ?, ?, ?, ?)
    `, [eventId, data.nomor_ruangan, data.nama_ruangan, data.kapasitas, data.jenis_kelamin])
    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) return { error: 'Nomor ruangan sudah ada di event ini' }
    return { error: err.message }
  }
}

export async function addRuanganBulk(eventId: number, count: number, startNo: number, kapasitas: number, jenis_kelamin: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    const stmts = []
    for (let i = 0; i < count; i++) {
      const nomor_ruangan = startNo + i
      stmts.push({
        sql: `INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)`,
        params: [eventId, nomor_ruangan, `Ruang ${nomor_ruangan}`, kapasitas, jenis_kelamin]
      })
    }
    await batch(stmts)
    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) return { error: 'Gagal generate. Ada bentrok dengan nomor ruangan yang sudah ada.' }
    return { error: err.message }
  }
}

export async function addRuanganImport(eventId: number, data: any[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    const stmts = data.map(item => ({
      sql: `INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ehb_event_id, nomor_ruangan) DO UPDATE SET 
            nama_ruangan = excluded.nama_ruangan, kapasitas = excluded.kapasitas, jenis_kelamin = excluded.jenis_kelamin`,
      params: [
        eventId, 
        parseInt(item['Nomor Ruangan']), 
        item['Nama Ruangan'] || `Ruang ${item['Nomor Ruangan']}`, 
        parseInt(item['Kapasitas']) || 20, 
        item['L/P'] === 'P' || item['L/P'] === 'Wanita' ? 'P' : 'L'
      ]
    }))
    await batch(stmts)
    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function updateRuangan(ruanganId: number, data: { nomor_ruangan: number, nama_ruangan: string, kapasitas: number, jenis_kelamin: string }) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    await execute(`
      UPDATE ehb_ruangan 
      SET nomor_ruangan = ?, nama_ruangan = ?, kapasitas = ?, jenis_kelamin = ?
      WHERE id = ?
    `, [data.nomor_ruangan, data.nama_ruangan, data.kapasitas, data.jenis_kelamin, ruanganId])
    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) return { error: 'Nomor ruangan sudah dipakai' }
    return { error: err.message }
  }
}

export async function deleteRuangan(ruanganId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Cek apakah ada peserta yang sudah diplot
  const count = await queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ruangan_id = ?`, [ruanganId])
  if (count && count.total > 0) return { error: 'Ruangan tidak bisa dihapus karena sudah ada peserta. Kosongkan dulu peserta di menu Plotting.' }

  await execute(`DELETE FROM ehb_ruangan WHERE id = ?`, [ruanganId])
  revalidatePath('/dashboard/ehb/ruangan')
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// RUANGAN DETAIL & PESERTA
// ──────────────────────────────────────────────────────────────────────────────

export async function getRuanganDetail(ruanganId: number) {
  const ruangan = await queryOne<any>(`SELECT * FROM ehb_ruangan WHERE id = ?`, [ruanganId])
  if (!ruangan) return null

  const peserta = await query<any>(`
    SELECT 
      p.*, 
      s.nama_lengkap, s.nis, s.kelas_sekolah, s.asrama, s.kamar,
      k.nama_kelas, m.nama AS marhalah_nama
    FROM ehb_plotting_santri p
    JOIN santri s ON s.id = p.santri_id
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE p.ruangan_id = ?
    ORDER BY p.jam_group, p.nomor_kursi
  `, [ruanganId])

  return { ruangan, peserta }
}

export async function getActiveEventLight() {
  return queryOne<{ id: number, nama: string }>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

// Untuk list pemindahan
export async function getOtherRuangan(eventId: number, currentRuanganId: number, jk: string) {
  return query<any>(`
    SELECT id, nomor_ruangan, nama_ruangan, kapasitas,
      (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as terisi
    FROM ehb_ruangan r
    WHERE r.ehb_event_id = ? AND r.id != ? AND r.jenis_kelamin = ?
    ORDER BY r.nomor_ruangan
  `, [eventId, currentRuanganId, jk])
}

export async function pindahSantri(santriId: string, eventId: number, targetRuanganId: number, newJamGroup: string) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    
    // Cari nomor kursi terakhir di ruangan target untuk jam_group yang sama
    const last = await queryOne<{max_kursi: number}>(`
        SELECT MAX(nomor_kursi) as max_kursi 
        FROM ehb_plotting_santri 
        WHERE ruangan_id = ? AND jam_group = ?
    `, [targetRuanganId, newJamGroup])

    const nextKursi = (last?.max_kursi || 0) + 1

    await execute(`
        UPDATE ehb_plotting_santri
        SET ruangan_id = ?, nomor_kursi = ?, jam_group = ?
        WHERE santri_id = ? AND ehb_event_id = ?
    `, [targetRuanganId, nextKursi, newJamGroup, santriId, eventId])

    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
}

export async function hapusPeserta(plottingId: number) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }
    await execute(`DELETE FROM ehb_plotting_santri WHERE id = ?`, [plottingId])
    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
}

export async function cariSantriUnplotted(eventId: number, jk: string, keyword: string) {
    // Cari santri aktif yang berjenis kelamin sesuai, dan BELUM diplot di event ini
    return query<any>(`
        SELECT s.id, s.nama_lengkap, s.nis, k.nama_kelas
        FROM santri s
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE s.status_global = 'aktif' 
          AND s.jenis_kelamin = ? 
          AND s.nama_lengkap LIKE ?
          AND s.id NOT IN (SELECT santri_id FROM ehb_plotting_santri WHERE ehb_event_id = ?)
        LIMIT 10
    `, [jk, `%${keyword}%`, eventId])
}

export async function tambahPesertaManual(eventId: number, ruanganId: number, santriId: string, jamGroup: string) {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    // Cari kursi kosong
    const last = await queryOne<{max_kursi: number}>(`
        SELECT MAX(nomor_kursi) as max_kursi 
        FROM ehb_plotting_santri 
        WHERE ruangan_id = ? AND jam_group = ?
    `, [ruanganId, jamGroup])
    const nextKursi = (last?.max_kursi || 0) + 1

    await execute(`
        INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group)
        VALUES (?, ?, ?, ?, ?)
    `, [eventId, ruanganId, santriId, nextKursi, jamGroup])

    revalidatePath('/dashboard/ehb/ruangan')
    return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// CETAK DATA
// ──────────────────────────────────────────────────────────────────────────────

export async function getDataCetakRuangan(ruanganId: number) {
    const { ruangan, peserta } = await getRuanganDetail(ruanganId) || {}
    if (!ruangan) return null
    
    // Group peserta by jam_group
    const grouped: Record<string, any[]> = {}
    if (peserta) {
        peserta.forEach((p: any) => {
            if (!grouped[p.jam_group]) grouped[p.jam_group] = []
            grouped[p.jam_group].push({
                no_kursi: p.nomor_kursi,
                no_peserta: `${String(ruangan.nomor_ruangan).padStart(2, '0')}-${String(p.nomor_kursi).padStart(2, '0')}`,
                nama: p.nama_lengkap,
                kelas: p.nama_kelas,
                marhalah: p.marhalah_nama
            })
        })
    }
    
    return { ruangan, peserta: grouped }
}

export async function getSesiListForRuangan(eventId: number) {
    return query<any>(`SELECT id, nomor_sesi, label, jam_group FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi`, [eventId])
}

export async function getDataBlankoAbsensi(ruanganId: number, sesiId: number) {
    const ruangan = await queryOne<any>(`SELECT * FROM ehb_ruangan WHERE id = ?`, [ruanganId])
    if (!ruangan) return null

    const sesi = await queryOne<any>(`SELECT * FROM ehb_sesi WHERE id = ?`, [sesiId])
    if (!sesi) return null

    // Ambil peserta untuk jam_group sesi ini
    const peserta = await query<any>(`
        SELECT 
            p.nomor_kursi,
            s.nama_lengkap, s.asrama, s.kamar,
            k.id as kelas_id, k.nama_kelas
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE p.ruangan_id = ? AND p.jam_group = ?
        ORDER BY p.nomor_kursi
    `, [ruanganId, sesi.jam_group])

    // Ambil mapel untuk setiap kelas peserta pada sesi ini
    const jadwalList = await query<any>(`
        SELECT j.kelas_id, j.tanggal, m.nama as mapel_nama
        FROM ehb_jadwal j
        JOIN mapel m ON m.id = j.mapel_id
        WHERE j.sesi_id = ? AND j.kelas_id IN (
            SELECT DISTINCT k.id
            FROM ehb_plotting_santri p
            JOIN riwayat_pendidikan rp ON rp.santri_id = p.santri_id AND rp.status_riwayat = 'aktif'
            JOIN kelas k ON k.id = rp.kelas_id
            WHERE p.ruangan_id = ? AND p.jam_group = ?
        )
        ORDER BY j.tanggal
    `, [sesiId, ruanganId, sesi.jam_group])

    // Map the jadwal to each student
    const jadwalPerKelas: Record<string, string[]> = {}
    jadwalList.forEach((j: any) => {
        if (!jadwalPerKelas[j.kelas_id]) jadwalPerKelas[j.kelas_id] = []
        jadwalPerKelas[j.kelas_id].push(j.mapel_nama)
    })

    const finalPeserta = peserta.map((p: any) => {
        return {
            no_kursi: p.nomor_kursi,
            no_peserta: `${String(ruangan.nomor_ruangan).padStart(2, '0')}-${String(p.nomor_kursi).padStart(2, '0')}`,
            nama: p.nama_lengkap,
            asrama_kamar: `${(p.asrama||'').substring(0,3).toUpperCase()}/${p.kamar||'-'}`,
            kelas: p.nama_kelas,
            mapel: jadwalPerKelas[p.kelas_id] || []
        }
    })

    // Cari max mapel count to draw columns
    let maxMapel = 0
    Object.values(jadwalPerKelas).forEach(m => {
        if (m.length > maxMapel) maxMapel = m.length
    })

    return { ruangan, sesi, peserta: finalPeserta, maxMapel }
}
