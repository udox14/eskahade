'use server'

import { query } from '@/lib/db'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

function getNamaSekolahLengkap(kode: string | null) {
  if (!kode) return 'LAINNYA'
  const k = kode.toUpperCase()
  if (k.includes('MTSN')) return 'MTsN 1 Tasikmalaya'
  if (k.includes('MTS')) return 'MTs. KH. A. WAHAB MUHSIN'
  if (k.includes('SMP')) return 'SMP. KHZ. Mushthafa'
  if (k.includes('MAN')) return 'MAN 1 Tasikmalaya'
  if (k.includes('SMA')) return 'SMA KHZ. Mushthafa'
  if (k.includes('SMK')) return 'SMK KH. A. Wahab Muhsin'
  if (k.includes('MI')) return 'MI'
  if (k.includes('KULIAH') || k.includes('SADESA')) return 'SADESA'
  return 'LAINNYA'
}

export async function getLaporanSensus(bulan: number, tahun: number) {
  const startDate = new Date(tahun, bulan - 1, 1).toISOString()
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString()

  const santriList = await query<any>(
    `SELECT id, nama_lengkap, asrama, kamar, sekolah, kelas_sekolah, alamat, created_at
     FROM santri WHERE status_global = 'aktif'`, []
  )

  // Sumber mutasi keluar:
  // 1. santri.tanggal_keluar dalam bulan ini — data dari fitur Santri Keluar (baru)
  //    alasan_keluar langsung dipakai sebagai keterangan
  // 2. riwayat_surat BERHENTI — fallback untuk data lama atau santri yang belum pakai fitur baru
  // Dua query parallel (Promise.all), digabung di memory
  const [keluarBaru, keluarLama, masukBaru] = await Promise.all([
    query<any>(`
      SELECT s.tanggal_keluar   AS created_at,
             s.alasan_keluar    AS detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.alamat
      FROM santri s
      WHERE s.status_global = 'keluar'
        AND s.tanggal_keluar >= ? AND s.tanggal_keluar <= ?
    `, [startDate.slice(0, 10), endDate.slice(0, 10)]),

    query<any>(`
      SELECT rs.created_at, rs.detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.alamat
      FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI'
        AND rs.created_at >= ? AND rs.created_at <= ?
        AND s.status_global != 'keluar'
    `, [startDate, endDate]),

    // Mutasi masuk: filter langsung di SQL — tidak JS filter dari santriList lengkap
    query<any>(
      `SELECT id, nama_lengkap, asrama, kamar, sekolah, kelas_sekolah, alamat, created_at
       FROM santri
       WHERE status_global = 'aktif' AND created_at >= ? AND created_at <= ?`,
      [startDate, endDate]
    ),
  ])
  const mutasiKeluarRaw = [...keluarBaru, ...keluarLama]

  const mutasiMasuk = masukBaru

  // A. REKAP ASRAMA
  const statsAsrama: any = {}
  ASRAMA_LIST.forEach(a => { statsAsrama[a] = { total: 0, keluar: 0, masuk: 0, kamar: {} } })

  santriList.forEach((s: any) => {
    const asrama = s.asrama || 'LAINNYA'
    const kamar = s.kamar || '?'
    if (!statsAsrama[asrama]) statsAsrama[asrama] = { total: 0, keluar: 0, masuk: 0, kamar: {} }
    statsAsrama[asrama].total++
    statsAsrama[asrama].kamar[kamar] = (statsAsrama[asrama].kamar[kamar] || 0) + 1
  })

  mutasiKeluarRaw.forEach((m: any) => {
    const asrama = m.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].keluar++
  })
  mutasiMasuk.forEach((m: any) => {
    const asrama = m.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].masuk++
  })

  // B. REKAP SEKOLAH
  const statsSekolah: any = {}
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

  santriList.forEach((s: any) => {
    const asrama = s.asrama || 'LAINNYA'
    if (!statsSekolah[asrama]) return

    const namaSekolah = getNamaSekolahLengkap(s.sekolah)
    const kelasRaw = s.kelas_sekolah ? s.kelas_sekolah.replace(/\D/g, '') : '0'
    let kelas = parseInt(kelasRaw)

    statsSekolah[asrama].TOTAL++

    if (namaSekolah.includes('MI')) statsSekolah[asrama].MI++
    else if (namaSekolah.includes('SADESA')) statsSekolah[asrama].SADESA++
    else if (namaSekolah.includes('MTsN')) {
      if ([7, 8, 9].includes(kelas)) statsSekolah[asrama].MTSN[kelas]++
      statsSekolah[asrama].MTSN.tot++
    } else if (namaSekolah.includes('MTs.')) {
      if ([7, 8, 9].includes(kelas)) statsSekolah[asrama].MTS[kelas]++
      statsSekolah[asrama].MTS.tot++
    } else if (namaSekolah.includes('SMP')) {
      if ([7, 8, 9].includes(kelas)) statsSekolah[asrama].SMP[kelas]++
      statsSekolah[asrama].SMP.tot++
    } else if (namaSekolah.includes('MAN')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if ([10, 11, 12].includes(kelas)) statsSekolah[asrama].MA[kelas]++
      statsSekolah[asrama].MA.tot++
    } else if (namaSekolah.includes('SMA')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if ([10, 11, 12].includes(kelas)) statsSekolah[asrama].SMA[kelas]++
      statsSekolah[asrama].SMA.tot++
    } else if (namaSekolah.includes('SMK')) {
      if (kelas === 1) kelas = 10; if (kelas === 2) kelas = 11; if (kelas === 3) kelas = 12
      if ([10, 11, 12].includes(kelas)) statsSekolah[asrama].SMK[kelas]++
      statsSekolah[asrama].SMK.tot++
    }
  })

  // C. LIST MUTASI
  const listMutasi = [
    ...mutasiMasuk.map((m: any) => ({ ...m, tipe: 'MASUK', tgl: m.created_at, ket: 'Santri Baru' })),
    ...mutasiKeluarRaw.map((m: any) => ({ ...m, tipe: 'KELUAR', tgl: m.created_at, ket: m.detail_info || 'Berhenti' })),
  ].sort((a, b) => new Date(a.tgl).getTime() - new Date(b.tgl).getTime())

  return {
    asrama: statsAsrama,
    sekolah: statsSekolah,
    mutasi: listMutasi,
    total_santri: santriList.length,
  }
}