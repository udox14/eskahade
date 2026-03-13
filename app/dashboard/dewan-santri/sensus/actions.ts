'use server'

import { query, queryOne } from '@/lib/db'

function getJenjang(sekolah: string | null) {
  if (!sekolah) return 'TIDAK_SEKOLAH'
  const s = sekolah.toUpperCase()
  if (s.includes('MTS') || s.includes('SMP') || s.includes('SADESA')) return 'SLTP'
  if (s.includes('MA') || s.includes('SMA') || s.includes('SMK')) return 'SLTA'
  if (s.includes('KULIAH') || s.includes('UNIVERSITAS') || s.includes('ST')) return 'KULIAH'
  return 'LAINNYA'
}

const emptyStats = () => ({
  total: 0,
  keluar_bulan_ini: 0,
  masuk_bulan_ini: 0,
  jenis_kelamin: { L: 0, P: 0 },
  jenjang: { SLTP: 0, SLTA: 0, KULIAH: 0, TIDAK_SEKOLAH: 0, LAINNYA: 0, detail: {} as Record<string, number> },
  kelas_sekolah: {} as Record<string, number>,
  marhalah: {} as Record<string, number>,
  distribusi_kamar: {} as Record<string, Record<string, number>>,
  santri_kamar: {} as Record<string, Record<string, {id:string,nama_lengkap:string,nis:string,kelas_pesantren:string|null,sekolah:string|null,kelas_sekolah:string|null}[]>>,
})

export async function getSensusData(asramaFilter: string) {
  const asramaClause = (asramaFilter && asramaFilter !== 'SEMUA') ? 'AND s.asrama = ?' : ''
  const asramaParams = (asramaFilter && asramaFilter !== 'SEMUA') ? [asramaFilter] : []
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // FIX #4: Jalankan query agregasi dan detail secara paralel
  const [santriList, statsRow, keluarRow] = await Promise.all([
    // Detail per santri untuk distribusi kamar (tetap diperlukan karena strukturnya kompleks)
    query<any>(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
             s.asrama, s.kamar, s.created_at,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' ${asramaClause}
    `, asramaParams),

    // Agregasi angka ringkasan langsung di SQL
    queryOne<{ total: number; L: number; P: number; masuk: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) AS L,
        SUM(CASE WHEN s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) AS P,
        SUM(CASE WHEN s.created_at >= ? THEN 1 ELSE 0 END) AS masuk
      FROM santri s
      WHERE s.status_global = 'aktif' ${asramaClause}
    `, [startMonth, ...asramaParams]),

    // Hitung santri keluar bulan ini
    queryOne<{ total: number }>(`
      SELECT COUNT(*) AS total FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI' AND rs.created_at >= ?
      ${asramaClause}
    `, [startMonth, ...asramaParams]),
  ])

  if (!santriList.length) return emptyStats()

  const stats = emptyStats()
  stats.total = statsRow?.total ?? santriList.length
  stats.jenis_kelamin.L = statsRow?.L ?? 0
  stats.jenis_kelamin.P = statsRow?.P ?? 0
  stats.masuk_bulan_ini = statsRow?.masuk ?? 0
  stats.keluar_bulan_ini = keluarRow?.total ?? 0

  // Hitung distribusi jenjang, marhalah, kamar dari list (sudah lebih kecil karena filter asrama)
  santriList.forEach((s: any) => {
    const jenjang = getJenjang(s.sekolah)
    // @ts-ignore
    if (stats.jenjang[jenjang] !== undefined) stats.jenjang[jenjang]++

    const namaSekolah = s.sekolah ? s.sekolah.toUpperCase() : 'TIDAK SEKOLAH'
    stats.jenjang.detail[namaSekolah] = (stats.jenjang.detail[namaSekolah] || 0) + 1

    const kls = s.kelas_sekolah ? s.kelas_sekolah.toUpperCase() : 'BELUM SET'
    stats.kelas_sekolah[kls] = (stats.kelas_sekolah[kls] || 0) + 1

    const mNama = s.marhalah_nama || 'BELUM MASUK KELAS'
    stats.marhalah[mNama] = (stats.marhalah[mNama] || 0) + 1

    const namaAsrama = s.asrama || 'LAINNYA'
    const namaKamar = s.kamar || '?'
    if (!stats.distribusi_kamar[namaAsrama]) stats.distribusi_kamar[namaAsrama] = {}
    stats.distribusi_kamar[namaAsrama][namaKamar] = (stats.distribusi_kamar[namaAsrama][namaKamar] || 0) + 1
    if (!stats.santri_kamar[namaAsrama]) stats.santri_kamar[namaAsrama] = {}
    if (!stats.santri_kamar[namaAsrama][namaKamar]) stats.santri_kamar[namaAsrama][namaKamar] = []
    stats.santri_kamar[namaAsrama][namaKamar].push({
      id: s.id, nama_lengkap: s.nama_lengkap, nis: s.nis,
      kelas_pesantren: s.nama_kelas || null, sekolah: s.sekolah, kelas_sekolah: s.kelas_sekolah
    })
  })

  return stats
}
