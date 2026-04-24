'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────────────────────────────────────
// EVENT EHB
// ──────────────────────────────────────────────────────────────────────────────

export async function getActiveEhbEvent() {
  return queryOne<any>(`
    SELECT e.*, ta.nama AS tahun_ajaran_nama
    FROM ehb_event e
    LEFT JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1
    ORDER BY e.id DESC
    LIMIT 1
  `)
}

export async function getAllEhbEvents() {
  return query<any>(`
    SELECT e.*, ta.nama AS tahun_ajaran_nama
    FROM ehb_event e
    LEFT JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    ORDER BY e.id DESC
  `)
}

export async function createEhbEvent(data: {
  tahunAjaranId: number
  semester: number
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
}) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Nonaktifkan event lama
  await execute(`UPDATE ehb_event SET is_active = 0`)

  await execute(
    `INSERT INTO ehb_event (tahun_ajaran_id, semester, nama, tanggal_mulai, tanggal_selesai, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
    [data.tahunAjaranId, data.semester, data.nama, data.tanggal_mulai, data.tanggal_selesai]
  )

  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function setActiveEvent(eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(`UPDATE ehb_event SET is_active = 0`)
  await execute(`UPDATE ehb_event SET is_active = 1 WHERE id = ?`, [eventId])

  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function deleteEhbEvent(eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Hapus semua data terkait
  await execute(`DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_pengawas WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_ruangan WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_jadwal WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_kelas_jam WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_sesi WHERE ehb_event_id = ?`, [eventId])
  await execute(`DELETE FROM ehb_event WHERE id = ?`, [eventId])

  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// SESI
// ──────────────────────────────────────────────────────────────────────────────

export async function getSesiList(eventId: number) {
  return query<any>(
    `SELECT * FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi`,
    [eventId]
  )
}

export interface SesiInput {
  id?: number
  nomor_sesi: number
  label: string
  jam_group: string
  waktu_mulai: string
  waktu_selesai: string
}

export async function saveSesiConfig(eventId: number, sesiList: SesiInput[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (!sesiList.length) return { error: 'Minimal 1 sesi' }

  // Hapus sesi lama, insert baru
  await execute(`DELETE FROM ehb_sesi WHERE ehb_event_id = ?`, [eventId])

  const stmts = sesiList.map(s => ({
    sql: `INSERT INTO ehb_sesi (ehb_event_id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai)
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: [eventId, s.nomor_sesi, s.label, s.jam_group, s.waktu_mulai || '', s.waktu_selesai || '']
  }))

  await batch(stmts)
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// KELAS JAM GROUP
// ──────────────────────────────────────────────────────────────────────────────

export async function getKelasJamMapping(eventId: number) {
  return query<any>(`
    SELECT kjm.*, k.nama_kelas, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           k.jenis_kelamin
    FROM ehb_kelas_jam kjm
    JOIN kelas k ON k.id = kjm.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE kjm.ehb_event_id = ?
    ORDER BY m.urutan, k.nama_kelas
  `, [eventId])
}

// Ambil semua kelas aktif (dari tahun ajaran aktif) untuk dipilih admin
export async function getKelasAktifList() {
  return query<any>(`
    SELECT k.id, k.nama_kelas, k.jenis_kelamin, m.id AS marhalah_id, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           (SELECT COUNT(*) FROM riwayat_pendidikan rp WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif') as jml_santri
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    JOIN marhalah m ON m.id = k.marhalah_id
    ORDER BY m.urutan, k.nama_kelas
  `)
}

export async function saveKelasJamMapping(
  eventId: number,
  mappings: { kelas_id: string; jam_group: string }[]
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(`DELETE FROM ehb_kelas_jam WHERE ehb_event_id = ?`, [eventId])

  if (!mappings.length) return { success: true }

  const stmts = mappings.map(m => ({
    sql: `INSERT INTO ehb_kelas_jam (ehb_event_id, kelas_id, jam_group) VALUES (?, ?, ?)`,
    params: [eventId, m.kelas_id, m.jam_group]
  }))

  await batch(stmts)
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────────
// JADWAL MAPEL
// ──────────────────────────────────────────────────────────────────────────────

export async function getJadwalEhb(eventId: number) {
  return query<any>(`
    SELECT j.*, s.nomor_sesi, s.label AS sesi_label, s.jam_group,
           mp.nama AS mapel_nama,
           k.nama_kelas, m.nama AS marhalah_nama
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    JOIN mapel mp ON mp.id = j.mapel_id
    JOIN kelas k ON k.id = j.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE j.ehb_event_id = ?
    ORDER BY j.tanggal, s.nomor_sesi, m.urutan, k.nama_kelas
  `, [eventId])
}

// Ambil tanggal-tanggal yang sudah ada di jadwal
export async function getTanggalJadwal(eventId: number) {
  const rows = await query<{ tanggal: string }>(`
    SELECT DISTINCT tanggal FROM ehb_jadwal WHERE ehb_event_id = ? ORDER BY tanggal
  `, [eventId])
  return rows.map(r => r.tanggal)
}

// Mapel aktif untuk pilihan
export async function getMapelAktifList() {
  return query<any>(`SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama`)
}

// Tahun ajaran untuk create event
export async function getTahunAjaranList() {
  return query<any>(`SELECT * FROM tahun_ajaran ORDER BY id DESC`)
}

export interface JadwalItem {
  tanggal: string
  sesi_id: number
  kelas_id: string
  mapel_id: number
}

export async function saveJadwalEhb(eventId: number, items: JadwalItem[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (!items.length) return { error: 'Tidak ada jadwal' }

  const stmts = items.map(item => ({
    sql: `INSERT INTO ehb_jadwal (ehb_event_id, tanggal, sesi_id, kelas_id, mapel_id)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ehb_event_id, tanggal, sesi_id, kelas_id) DO UPDATE SET
            mapel_id = excluded.mapel_id`,
    params: [eventId, item.tanggal, item.sesi_id, item.kelas_id, item.mapel_id]
  }))

  await batch(stmts)
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function hapusJadwalCell(eventId: number, tanggal: string, sesiId: number, kelasId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(
    `DELETE FROM ehb_jadwal WHERE ehb_event_id = ? AND tanggal = ? AND sesi_id = ? AND kelas_id = ?`,
    [eventId, tanggal, sesiId, kelasId]
  )
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function hapusTanggal(eventId: number, tanggal: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute(
    `DELETE FROM ehb_jadwal WHERE ehb_event_id = ? AND tanggal = ?`,
    [eventId, tanggal]
  )
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function updateTanggalJadwal(eventId: number, oldTanggal: string, newTanggal: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (!newTanggal) return { error: 'Tanggal baru tidak boleh kosong' }

  // Cek apakah tanggal baru sudah ada
  const existing = await queryOne(`SELECT id FROM ehb_jadwal WHERE ehb_event_id = ? AND tanggal = ? LIMIT 1`, [eventId, newTanggal])
  if (existing) return { error: 'Tanggal tersebut sudah memiliki jadwal' }

  await execute(
    `UPDATE ehb_jadwal SET tanggal = ? WHERE ehb_event_id = ? AND tanggal = ?`,
    [newTanggal, eventId, oldTanggal]
  )
  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}

export async function copyJadwalFromEvent(targetEventId: number, sourceEventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (targetEventId === sourceEventId) return { error: 'Tidak bisa copy ke event yang sama' }

  // 1. Bersihkan target event
  await execute(`DELETE FROM ehb_jadwal WHERE ehb_event_id = ?`, [targetEventId])
  await execute(`DELETE FROM ehb_kelas_jam WHERE ehb_event_id = ?`, [targetEventId])
  await execute(`DELETE FROM ehb_sesi WHERE ehb_event_id = ?`, [targetEventId])

  // 2. Copy Sesi
  const oldSesi = await query<any>(`SELECT * FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi`, [sourceEventId])
  const sesiMap = new Map<number, number>() // old_id -> new_id
  
  for (const s of oldSesi) {
    const res = await execute(
      `INSERT INTO ehb_sesi (ehb_event_id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [targetEventId, s.nomor_sesi, s.label, s.jam_group, s.waktu_mulai, s.waktu_selesai]
    )
    // Di SQLite D1, result insert returning bisa diambil dari hasil query jika driver mendukung,
    // tapi karena D1 execute mungkin tidak return rows di sini secara konsisten,
    // mari kita query balik ID barunya.
    const inserted = await queryOne<any>(
      `SELECT id FROM ehb_sesi WHERE ehb_event_id = ? AND nomor_sesi = ?`, 
      [targetEventId, s.nomor_sesi]
    )
    if (inserted) {
      sesiMap.set(s.id, inserted.id)
    }
  }

  // 3. Copy Kelas Jam Mapping
  const oldMapping = await query<any>(`SELECT * FROM ehb_kelas_jam WHERE ehb_event_id = ?`, [sourceEventId])
  if (oldMapping.length > 0) {
    const mapStmts = oldMapping.map(m => ({
      sql: `INSERT INTO ehb_kelas_jam (ehb_event_id, kelas_id, jam_group) VALUES (?, ?, ?)`,
      params: [targetEventId, m.kelas_id, m.jam_group]
    }))
    await batch(mapStmts)
  }

  // 4. Copy Jadwal dengan mapping tanggal
  const oldJadwal = await query<any>(`SELECT * FROM ehb_jadwal WHERE ehb_event_id = ? ORDER BY tanggal`, [sourceEventId])
  if (oldJadwal.length > 0) {
    // Ambil tanggal mulai target
    const targetEvent = await queryOne<any>(`SELECT tanggal_mulai FROM ehb_event WHERE id = ?`, [targetEventId])
    let newDateObj = targetEvent?.tanggal_mulai ? new Date(targetEvent.tanggal_mulai) : new Date()

    // Cari urutan tanggal unik dari event lama
    const oldDates = Array.from(new Set(oldJadwal.map((j: any) => j.tanggal))).sort()
    
    // Map old date ke new date (hari +1)
    const dateMap = new Map<string, string>()
    oldDates.forEach((oldDateStr, index) => {
      const mappedDate = new Date(newDateObj)
      mappedDate.setDate(mappedDate.getDate() + index)
      dateMap.set(oldDateStr as string, mappedDate.toISOString().split('T')[0])
    })

    const jadStmts = oldJadwal.map(j => {
      const newSesiId = sesiMap.get(j.sesi_id)
      const mappedTgl = dateMap.get(j.tanggal) || j.tanggal
      if (!newSesiId) return null
      return {
        sql: `INSERT INTO ehb_jadwal (ehb_event_id, tanggal, sesi_id, kelas_id, mapel_id) VALUES (?, ?, ?, ?, ?)`,
        params: [targetEventId, mappedTgl, newSesiId, j.kelas_id, j.mapel_id]
      }
    }).filter(Boolean) as any[]
    
    if (jadStmts.length > 0) {
      await batch(jadStmts)
    }
  }

  revalidatePath('/dashboard/ehb/jadwal')
  return { success: true }
}
