'use server'

import { query } from '@/lib/db'

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
  jenjang: { SLTP: 0, SLTA: 0, KULIAH: 0, TIDAK_SEKOLAH: 0, LAINNYA: 0, detail: {} as Record<string, number> },
  kelas_sekolah: {} as Record<string, number>,
  marhalah: {} as Record<string, number>,
  distribusi_kamar: {} as Record<string, Record<string, number>>,
})

export async function getSensusData(asramaFilter: string) {
  let sql = `
    SELECT s.id, s.sekolah, s.kelas_sekolah, s.asrama, s.kamar, s.created_at,
           rp.status_riwayat, m.nama AS marhalah_nama
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE s.status_global = 'aktif'
  `
  const params: any[] = []
  if (asramaFilter && asramaFilter !== 'SEMUA') { sql += ' AND s.asrama = ?'; params.push(asramaFilter) }

  const santriList = await query<any>(sql, params)
  if (!santriList.length) return emptyStats()

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let keluarSql = `
    SELECT COUNT(*) AS total FROM riwayat_surat rs
    JOIN santri s ON s.id = rs.santri_id
    WHERE rs.jenis_surat = 'BERHENTI' AND rs.created_at >= ?
  `
  const keluarParams: any[] = [startMonth]
  if (asramaFilter && asramaFilter !== 'SEMUA') { keluarSql += ' AND s.asrama = ?'; keluarParams.push(asramaFilter) }

  const keluarResult = await query<any>(keluarSql, keluarParams)
  const jumlahKeluar = keluarResult[0]?.total || 0

  const stats = emptyStats()
  stats.total = santriList.length
  stats.keluar_bulan_ini = jumlahKeluar
  stats.masuk_bulan_ini = santriList.filter((s: any) => s.created_at >= startMonth).length

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
  })

  return stats
}