'use server'

import { query, queryOne } from '@/lib/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActiveEvent = {
  id: number
  nama: string
  semester: number
  tahun_ajaran_nama: string
}

export type KartuData = {
  id: number
  nama_lengkap: string
  asrama_kamar: string
  nomor_ruangan: number
  nomor_kursi: number
  jam_group: string
  nama_kelas: string | null
  kelas_id: string | null
  marhalah_id: number | null
  marhalah_nama: string | null
  event_nama: string
  semester: number
  tahun_ajaran_nama: string
  nomor_peserta: string
}

export type MarhalahOption = { id: number; nama: string }
export type KelasOption    = { id: string; nama_kelas: string }
export type PesertaOption  = {
  santri_id: string
  nama_lengkap: string
  nomor_peserta: string
  nama_kelas: string | null
  asrama_kamar: string
}

// ── Server Actions ─────────────────────────────────────────────────────────────

export async function getActiveEventForCetak() {
  return queryOne<ActiveEvent>(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1 LIMIT 1
  `)
}

export async function getMarhalahListForCetak(eventId: number) {
  return query<MarhalahOption>(`
    SELECT DISTINCT m.id, m.nama
    FROM ehb_plotting_santri ps
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ?
    ORDER BY m.urutan
  `, [eventId])
}

export async function getKelasListForCetak(eventId: number, marhalahId?: number) {
  const params: unknown[] = [eventId]
  const filter = marhalahId ? 'AND k.marhalah_id = ?' : ''
  if (marhalahId) params.push(marhalahId)

  return query<KelasOption>(`
    SELECT DISTINCT k.id, k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? ${filter}
    ORDER BY k.nama_kelas
  `, params)
}

// Daftar ringan semua peserta (untuk search + checkbox pilih sendiri)
export async function getSantriListForCetak(eventId: number) {
  return query<PesertaOption>(`
    SELECT
      s.id as santri_id,
      s.nama_lengkap,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      k.nama_kelas,
      COALESCE(s.asrama, '-') || ' / ' || COALESCE(s.kamar, '-') as asrama_kamar
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ?
    ORDER BY s.nama_lengkap
  `, [eventId])
}

export type RuanganOption   = { id: number; nomor_ruangan: number }
export type NomorPesertaItem = {
  id: number
  nomor_peserta: string
  nomor_ruangan: number
  semester: number
  tahun_ajaran_nama: string
}

export async function getRuanganListForCetak(eventId: number) {
  return query<RuanganOption>(`
    SELECT DISTINCT r.id, r.nomor_ruangan
    FROM ehb_ruangan r
    JOIN ehb_plotting_santri ps ON ps.ruangan_id = r.id
    WHERE ps.ehb_event_id = ?
    ORDER BY r.nomor_ruangan
  `, [eventId])
}

export async function getNomorPesertaData(eventId: number, ruanganId?: number) {
  const params: unknown[] = [eventId]
  const filter = ruanganId ? 'AND r.id = ?' : ''
  if (ruanganId) params.push(ruanganId)

  return query<NomorPesertaItem>(`
    SELECT DISTINCT
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      r.nomor_ruangan,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE ps.ehb_event_id = ? ${filter}
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `, params)
}

export async function getKartuPesertaData(
  eventId: number,
  filter: {
    type: 'semua' | 'marhalah' | 'kelas' | 'pilihan' | 'blanko'
    marhalahId?: number
    kelasId?: string
    santriIds?: string[]
  }
) {
  const params: unknown[] = [eventId]
  let filterClause = ''

  if (filter.type === 'marhalah' && filter.marhalahId) {
    filterClause = 'AND m.id = ?'
    params.push(filter.marhalahId)
  } else if (filter.type === 'kelas' && filter.kelasId) {
    filterClause = 'AND k.id = ?'
    params.push(filter.kelasId)
  } else if (filter.type === 'pilihan' && filter.santriIds && filter.santriIds.length > 0) {
    const ph = filter.santriIds.map(() => '?').join(',')
    filterClause = `AND s.id IN (${ph})`
    params.push(...filter.santriIds)
  }

  return query<KartuData>(`
    SELECT
      ps.id,
      s.nama_lengkap,
      COALESCE(s.asrama, '-') || ' / ' || COALESCE(s.kamar, '-') as asrama_kamar,
      r.nomor_ruangan,
      ps.nomor_kursi,
      ps.jam_group,
      k.nama_kelas,
      k.id as kelas_id,
      m.id as marhalah_id,
      m.nama as marhalah_nama,
      e.nama as event_nama,
      e.semester,
      ta.nama as tahun_ajaran_nama,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ? ${filterClause}
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `, params)
}

export type TempelanRuanganItem = {
  ruangan_id: number
  nomor_ruangan: number
  kapasitas: number | null
  nomor_kursi: number
  nomor_peserta: string
  jam_group: string
  nama_kelas: string | null
  semester: number
  tahun_ajaran_nama: string
}

export type TempelanRuanganSemuaItem = TempelanRuanganItem

export async function getTempelanRuanganData(eventId: number, ruanganId: number) {
  return query<TempelanRuanganItem>(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.kapasitas,
      ps.nomor_kursi,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      ps.jam_group,
      k.nama_kelas,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? AND ps.ruangan_id = ?
    ORDER BY ps.jam_group, ps.nomor_kursi
  `, [eventId, ruanganId])
}

export async function getTempelanRuanganSemuaData(eventId: number) {
  return query<TempelanRuanganSemuaItem>(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.kapasitas,
      ps.nomor_kursi,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      ps.jam_group,
      k.nama_kelas,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ?
    ORDER BY r.nomor_ruangan, ps.jam_group, ps.nomor_kursi
  `, [eventId])
}
export type DaftarHadirSesi = {
  tanggal: string
  label: string
}

export type DaftarHadirItem = {
  nomor_peserta: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  nama_kelas: string | null
}

export async function getJamGroupList(eventId: number) {
  return query<{ jam_group: string }>(`
    SELECT DISTINCT jam_group 
    FROM ehb_plotting_santri 
    WHERE ehb_event_id = ? 
    ORDER BY jam_group
  `, [eventId])
}

export async function getDaftarHadirSesi(eventId: number, jamGroup: string) {
  return query<DaftarHadirSesi>(`
    SELECT DISTINCT tanggal, label
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    WHERE j.ehb_event_id = ? AND s.jam_group = ?
    ORDER BY tanggal, s.nomor_sesi
  `, [eventId, jamGroup])
}

export type DaftarHadirSemuaItem = DaftarHadirItem & { ruangan_id: number; nomor_ruangan: number }

export async function getDaftarHadirData(eventId: number, ruanganId: number, jamGroup: string) {
  return query<DaftarHadirItem>(`
    SELECT
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? 
      AND ps.ruangan_id = ? 
      AND ps.jam_group = ?
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `, [eventId, ruanganId, jamGroup])
}

export async function getDaftarHadirSemuaData(eventId: number, jamGroup: string) {
  return query<DaftarHadirSemuaItem>(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? AND ps.jam_group = ?
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `, [eventId, jamGroup])
}

export type JadwalPengawasCetakEvent = ActiveEvent

export type JadwalPengawasCetakSesi = {
  id: number
  nomor_sesi: number
  label: string
  jam_group: string
  waktu_mulai: string | null
  waktu_selesai: string | null
}

export type JadwalPengawasCetakRuangan = {
  id: number
  nomor_ruangan: number
  nama_ruangan: string | null
}

export type JadwalPengawasCetakTanggal = {
  tanggal: string
}

export type JadwalPengawasCetakSlot = {
  tanggal: string
  sesi_id: number
}

export type JadwalPengawasCetakItem = {
  id: number
  tanggal: string
  sesi_id: number
  nomor_sesi: number
  ruangan_id: number
  nomor_ruangan: number
  pengawas_id: number
  nama_pengawas: string
  tag: string
}

export type PengawasCetakItem = {
  id: number
  nama_pengawas: string
  tag: string
}

export async function getJadwalPengawasCetakData(eventId: number) {
  const [sesiList, tanggalList, activeSlots, ruanganList, jadwal, pengawasList] = await Promise.all([
    query<JadwalPengawasCetakSesi>(`
      SELECT id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai
      FROM ehb_sesi
      WHERE ehb_event_id = ?
      ORDER BY nomor_sesi
    `, [eventId]),
    query<JadwalPengawasCetakTanggal>(`
      SELECT DISTINCT tanggal
      FROM ehb_jadwal
      WHERE ehb_event_id = ?
      ORDER BY tanggal
    `, [eventId]),
    query<JadwalPengawasCetakSlot>(`
      SELECT DISTINCT tanggal, sesi_id
      FROM ehb_jadwal
      WHERE ehb_event_id = ?
      ORDER BY tanggal, sesi_id
    `, [eventId]),
    query<JadwalPengawasCetakRuangan>(`
      SELECT id, nomor_ruangan, nama_ruangan
      FROM ehb_ruangan
      WHERE ehb_event_id = ?
      ORDER BY nomor_ruangan
    `, [eventId]),
    query<JadwalPengawasCetakItem>(`
      SELECT
        jp.id,
        jp.tanggal,
        jp.sesi_id,
        s.nomor_sesi,
        jp.ruangan_id,
        r.nomor_ruangan,
        jp.pengawas_id,
        p.nama_pengawas,
        p.tag
      FROM ehb_jadwal_pengawas jp
      JOIN ehb_pengawas p ON p.id = jp.pengawas_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE jp.ehb_event_id = ?
      ORDER BY jp.tanggal, s.nomor_sesi, r.nomor_ruangan, p.nama_pengawas
    `, [eventId]),
    query<PengawasCetakItem>(`
      SELECT id, nama_pengawas, tag
      FROM ehb_pengawas
      WHERE ehb_event_id = ?
      ORDER BY nama_pengawas
    `, [eventId]),
  ])

  return { sesiList, tanggalList, activeSlots, ruanganList, jadwal, pengawasList }
}

export type JadwalEhbCetakSesi = {
  id: number
  nomor_sesi: number
  label: string
  jam_group: string
  waktu_mulai: string | null
  waktu_selesai: string | null
}

export type JadwalEhbCetakKelas = {
  id: string
  nama_kelas: string
  marhalah_nama: string | null
  marhalah_urutan: number | null
  jam_group: string
}

export type JadwalEhbCetakItem = {
  tanggal: string
  sesi_id: number
  kelas_id: string
  mapel_nama: string
}

export type JadwalEhbCetakPanitia = {
  ketua: string
  sekretaris: string
}

export async function getJadwalEhbCetakData(eventId: number) {
  const event = await queryOne<ActiveEvent & { tanggal_mulai: string | null; tanggal_selesai: string | null }>(`
    SELECT e.id, e.nama, e.semester, e.tanggal_mulai, e.tanggal_selesai, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.id = ?
    LIMIT 1
  `, [eventId])

  const [sesiList, kelasList, jadwal] = await Promise.all([
    query<JadwalEhbCetakSesi>(`
      SELECT id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai
      FROM ehb_sesi
      WHERE ehb_event_id = ?
      ORDER BY nomor_sesi
    `, [eventId]),
    query<JadwalEhbCetakKelas>(`
      SELECT DISTINCT
        k.id,
        k.nama_kelas,
        m.nama as marhalah_nama,
        m.urutan as marhalah_urutan,
        kj.jam_group
      FROM ehb_kelas_jam kj
      JOIN kelas k ON k.id = kj.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE kj.ehb_event_id = ?
      ORDER BY m.urutan, k.nama_kelas
    `, [eventId]),
    query<JadwalEhbCetakItem>(`
      SELECT
        j.tanggal,
        j.sesi_id,
        j.kelas_id,
        mp.nama as mapel_nama
      FROM ehb_jadwal j
      JOIN mapel mp ON mp.id = j.mapel_id
      WHERE j.ehb_event_id = ?
      ORDER BY j.tanggal, j.sesi_id, j.kelas_id
    `, [eventId]),
  ])

  return {
    event,
    sesiList,
    kelasList,
    jadwal,
    panitia: { ketua: '', sekretaris: '' } satisfies JadwalEhbCetakPanitia,
  }
}
