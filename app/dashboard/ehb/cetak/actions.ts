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
  asrama: string
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
export type KelasOption = { id: string; nama_kelas: string }

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

export async function getKartuPesertaData(
  eventId: number,
  filter: { type: 'semua' | 'marhalah' | 'kelas'; marhalahId?: number; kelasId?: string }
) {
  const params: unknown[] = [eventId]
  let filterClause = ''

  if (filter.type === 'marhalah' && filter.marhalahId) {
    filterClause = 'AND m.id = ?'
    params.push(filter.marhalahId)
  } else if (filter.type === 'kelas' && filter.kelasId) {
    filterClause = 'AND k.id = ?'
    params.push(filter.kelasId)
  }

  return query<KartuData>(`
    SELECT
      ps.id,
      s.nama_lengkap,
      COALESCE(s.asrama, '-') as asrama,
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
