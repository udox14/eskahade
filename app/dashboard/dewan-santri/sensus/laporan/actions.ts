'use server'

import { query } from '@/lib/db'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const EXCLUDE_AL_BAGHORY_SQL = "AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'"

type LaporanSantriRow = {
  id: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  kategori_santri: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  alamat: string | null
  created_at: string
}
type MutasiKeluarRow = LaporanSantriRow & {
  detail_info: string | null
  riwayat_id?: string | null
}
type MutasiRow = LaporanSantriRow & {
  mutasi_key: string
  tipe: 'MASUK' | 'KELUAR'
  tgl: string
  ket: string
}
type AsramaStats = { total: number; keluar: number; masuk: number; kamar: Record<string, number> }
type SltpClass = 7 | 8 | 9
type SltaClass = 10 | 11 | 12
type ClassStats = Partial<Record<SltpClass | SltaClass, number>> & { tot: number }
type SekolahStats = {
  MI: number
  MTS: ClassStats
  MTSN: ClassStats
  SMP: ClassStats
  MA: ClassStats
  SMA: ClassStats
  SMK: ClassStats
  SADESA: number
  TOTAL: number
}

function getNamaSekolahLengkap(kode: string | null, kategoriSantri?: string | null) {
  if (kategoriSantri === 'SADESA') return 'SADESA'
  if (!kode) return 'LAINNYA'
  const k = kode.toUpperCase()
  if (k.includes('MTSN')) return 'MTsN 1 Tasikmalaya'
  if (k.includes('MTS')) return 'MTs. KH. A. WAHAB MUHSIN'
  if (k.includes('SMP')) return 'SMP. KHZ. Mushthafa'
  if (k.includes('MAN')) return 'MAN 1 Tasikmalaya'
  if (k.includes('SMA')) return 'SMA KHZ. Mushthafa'
  if (k.includes('SMK')) return 'SMK KH. A. Wahab Muhsin'
  if (k.includes('MI')) return 'MI'
  if (k.includes('KULIAH')) return 'SADESA'
  return 'LAINNYA'
}

const isSltpClass = (kelas: number): kelas is SltpClass => kelas === 7 || kelas === 8 || kelas === 9
const isSltaClass = (kelas: number): kelas is SltaClass => kelas === 10 || kelas === 11 || kelas === 12

export async function getLaporanSensus(bulan: number, tahun: number) {
  const startDate = new Date(tahun, bulan - 1, 1).toISOString()
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString()

  const santriList = await query<LaporanSantriRow>(
    `SELECT id, nama_lengkap, asrama, kamar, kategori_santri, sekolah, kelas_sekolah, alamat, created_at
     FROM santri s
     WHERE s.status_global = 'aktif'
       ${EXCLUDE_AL_BAGHORY_SQL}`, []
  )

  // Sumber mutasi keluar:
  // 1. santri.tanggal_keluar dalam bulan ini — data dari fitur Santri Keluar (baru)
  //    alasan_keluar langsung dipakai sebagai keterangan
  // 2. riwayat_surat BERHENTI — fallback untuk data lama atau santri yang belum pakai fitur baru
  // Dua query parallel (Promise.all), digabung di memory
  const [keluarBaru, keluarLama, masukBaru] = await Promise.all([
    query<MutasiKeluarRow>(`
      SELECT s.id,
             s.tanggal_keluar   AS created_at,
             s.alasan_keluar    AS detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.kategori_santri, s.sekolah, s.kelas_sekolah, s.alamat
      FROM santri s
      WHERE s.status_global = 'keluar'
        AND s.tanggal_keluar >= ? AND s.tanggal_keluar <= ?
        ${EXCLUDE_AL_BAGHORY_SQL}
    `, [startDate.slice(0, 10), endDate.slice(0, 10)]),

    query<MutasiKeluarRow>(`
      SELECT s.id, rs.id AS riwayat_id, rs.created_at, rs.detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.kategori_santri, s.sekolah, s.kelas_sekolah, s.alamat
      FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI'
        AND rs.created_at >= ? AND rs.created_at <= ?
        AND s.status_global != 'keluar'
        ${EXCLUDE_AL_BAGHORY_SQL}
    `, [startDate, endDate]),

    // Mutasi masuk: filter langsung di SQL — tidak JS filter dari santriList lengkap
    query<LaporanSantriRow>(
      `SELECT id, nama_lengkap, asrama, kamar, kategori_santri, sekolah, kelas_sekolah, alamat, created_at
       FROM santri
       WHERE status_global = 'aktif' AND created_at >= ? AND created_at <= ?
         AND UPPER(TRIM(COALESCE(asrama, ''))) <> 'AL-BAGHORY'`,
      [startDate, endDate]
    ),
  ])
  const mutasiKeluarRaw = [...keluarBaru, ...keluarLama]

  const mutasiMasuk = masukBaru

  // A. REKAP ASRAMA
  const statsAsrama: Record<string, AsramaStats> = {}
  ASRAMA_LIST.forEach(a => { statsAsrama[a] = { total: 0, keluar: 0, masuk: 0, kamar: {} } })

  santriList.forEach((s) => {
    const asrama = s.asrama || 'LAINNYA'
    const kamar = s.kamar || '?'
    if (!statsAsrama[asrama]) statsAsrama[asrama] = { total: 0, keluar: 0, masuk: 0, kamar: {} }
    statsAsrama[asrama].total++
    statsAsrama[asrama].kamar[kamar] = (statsAsrama[asrama].kamar[kamar] || 0) + 1
  })

  mutasiKeluarRaw.forEach((m) => {
    const asrama = m.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].keluar++
  })
  mutasiMasuk.forEach((m) => {
    const asrama = m.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].masuk++
  })

  // B. REKAP SEKOLAH
  const statsSekolah: Record<string, SekolahStats> = {}
  ASRAMA_LIST.forEach(a => {
    statsSekolah[a] = {
      MI: 0,
      MTS: { 7: 0, 8: 0, 9: 0, tot: 0 },
      MTSN: { 7: 0, 8: 0, 9: 0, tot: 0 },
      SMP: { 7: 0, 8: 0, 9: 0, tot: 0 },
      MA: { 10: 0, 11: 0, 12: 0, tot: 0 },
      SMA: { 10: 0, 11: 0, 12: 0, tot: 0 },
      SMK: { 10: 0, 11: 0, 12: 0, tot: 0 },
      SADESA: 0,
      TOTAL: 0,
    }
  })

  santriList.forEach((s) => {
    const asrama = s.asrama || 'LAINNYA'
    if (!statsSekolah[asrama]) return

    const namaSekolah = getNamaSekolahLengkap(s.sekolah, s.kategori_santri)
    const kelasRaw = s.kelas_sekolah ? s.kelas_sekolah.replace(/\D/g, '') : '0'
    let kelas = parseInt(kelasRaw)

    statsSekolah[asrama].TOTAL++

    if (namaSekolah.includes('MI')) statsSekolah[asrama].MI++
    else if (namaSekolah.includes('SADESA')) statsSekolah[asrama].SADESA++
    else if (namaSekolah.includes('MTsN')) {
      if (isSltpClass(kelas)) statsSekolah[asrama].MTSN[kelas] = (statsSekolah[asrama].MTSN[kelas] || 0) + 1
      statsSekolah[asrama].MTSN.tot++
    } else if (namaSekolah.includes('MTs.')) {
      if (isSltpClass(kelas)) statsSekolah[asrama].MTS[kelas] = (statsSekolah[asrama].MTS[kelas] || 0) + 1
      statsSekolah[asrama].MTS.tot++
    } else if (namaSekolah.includes('SMP')) {
      if (isSltpClass(kelas)) statsSekolah[asrama].SMP[kelas] = (statsSekolah[asrama].SMP[kelas] || 0) + 1
      statsSekolah[asrama].SMP.tot++
    } else if (namaSekolah.includes('MAN')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if (isSltaClass(kelas)) statsSekolah[asrama].MA[kelas] = (statsSekolah[asrama].MA[kelas] || 0) + 1
      statsSekolah[asrama].MA.tot++
    } else if (namaSekolah.includes('SMA')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if (isSltaClass(kelas)) statsSekolah[asrama].SMA[kelas] = (statsSekolah[asrama].SMA[kelas] || 0) + 1
      statsSekolah[asrama].SMA.tot++
    } else if (namaSekolah.includes('SMK')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if (isSltaClass(kelas)) statsSekolah[asrama].SMK[kelas] = (statsSekolah[asrama].SMK[kelas] || 0) + 1
      statsSekolah[asrama].SMK.tot++
    }
  })

  // C. LIST MUTASI
  const listMutasi: MutasiRow[] = [
    ...mutasiMasuk.map((m): MutasiRow => ({ ...m, mutasi_key: `MASUK:${m.id}:${m.created_at}`, tipe: 'MASUK', tgl: m.created_at, ket: 'Santri Baru' })),
    ...mutasiKeluarRaw.map((m): MutasiRow => ({
      ...m,
      mutasi_key: `KELUAR:${m.riwayat_id || m.id}:${m.created_at}`,
      tipe: 'KELUAR',
      tgl: m.created_at,
      ket: m.detail_info || 'Berhenti',
    })),
  ].sort((a, b) => new Date(a.tgl).getTime() - new Date(b.tgl).getTime())

  return {
    asrama: statsAsrama,
    sekolah: statsSekolah,
    mutasi: listMutasi,
    total_santri: santriList.length,
  }
}
