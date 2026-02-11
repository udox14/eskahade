'use server'

import { createClient } from '@/lib/supabase/server'

// Helper: Klasifikasi Jenjang Sekolah
function getJenjang(sekolah: string | null) {
  if (!sekolah) return 'TIDAK_SEKOLAH'
  const s = sekolah.toUpperCase()
  
  if (s.includes('MTS') || s.includes('SMP') || s.includes('SADESA')) return 'SLTP'
  if (s.includes('MA') || s.includes('SMA') || s.includes('SMK')) return 'SLTA'
  if (s.includes('KULIAH') || s.includes('UNIVERSITAS') || s.includes('ST')) return 'KULIAH'
  
  return 'LAINNYA' 
}

export async function getSensusData(asramaFilter: string) {
  const supabase = await createClient()

  // 1. QUERY UTAMA: Ambil semua santri aktif
  let query = supabase
    .from('santri')
    .select(`
      id, 
      sekolah, 
      kelas_sekolah, 
      asrama,
      kamar, 
      created_at,
      riwayat_pendidikan (
        status_riwayat,
        kelas (marhalah(nama))
      )
    `)
    .eq('status_global', 'aktif')

  // Filter Asrama jika tidak pilih SEMUA
  if (asramaFilter && asramaFilter !== 'SEMUA') {
    query = query.eq('asrama', asramaFilter)
  }

  const { data: santriList } = await query
  if (!santriList) return null

  // 2. QUERY MUTASI KELUAR (Surat Berhenti Bulan Ini)
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  
  let queryKeluar = supabase
    .from('riwayat_surat')
    .select('santri!inner(asrama)', { count: 'exact', head: true }) 
    .eq('jenis_surat', 'BERHENTI')
    .gte('created_at', startMonth)

  if (asramaFilter && asramaFilter !== 'SEMUA') {
    queryKeluar = queryKeluar.eq('santri.asrama', asramaFilter)
  }
  
  const { count: jumlahKeluar } = await queryKeluar

  // 3. PENGOLAHAN DATA (AGGREGASI)
  const stats = {
    total: santriList.length,
    keluar_bulan_ini: jumlahKeluar || 0,
    masuk_bulan_ini: santriList.filter(s => s.created_at >= startMonth).length,
    
    // Statistik Jenjang
    jenjang: {
      SLTP: 0, SLTA: 0, KULIAH: 0, TIDAK_SEKOLAH: 0, LAINNYA: 0,
      detail: {} as Record<string, number>
    },
    
    // Statistik Kelas Sekolah
    kelas_sekolah: {} as Record<string, number>,
    
    // Statistik Marhalah (Pesantren)
    marhalah: {} as Record<string, number>,

    // BARU: Statistik Per Kamar (Nested: Asrama -> Kamar -> Count)
    distribusi_kamar: {} as Record<string, Record<string, number>>
  }

  santriList.forEach(s => {
    // A. Hitung Jenjang
    const jenjang = getJenjang(s.sekolah)
    // @ts-ignore
    if (stats.jenjang[jenjang] !== undefined) stats.jenjang[jenjang]++
    
    // Detail Sekolah
    const namaSekolah = s.sekolah ? s.sekolah.toUpperCase() : 'TIDAK SEKOLAH'
    stats.jenjang.detail[namaSekolah] = (stats.jenjang.detail[namaSekolah] || 0) + 1

    // B. Hitung Kelas Sekolah
    const kls = s.kelas_sekolah ? s.kelas_sekolah.toUpperCase() : 'BELUM SET'
    stats.kelas_sekolah[kls] = (stats.kelas_sekolah[kls] || 0) + 1

    // C. Hitung Marhalah
    const rRaw = s.riwayat_pendidikan
    const riwayatAktif = Array.isArray(rRaw) 
      ? rRaw.find((r: any) => r.status_riwayat === 'aktif')
      : rRaw

    let mNama = 'BELUM MASUK KELAS'
    
    if (riwayatAktif?.kelas) {
        const k = riwayatAktif.kelas
        const mRaw = (k as any).marhalah
        if (mRaw) {
            mNama = Array.isArray(mRaw) ? mRaw[0]?.nama : mRaw?.nama
        }
    }
    mNama = mNama || 'BELUM MASUK KELAS'
    stats.marhalah[mNama] = (stats.marhalah[mNama] || 0) + 1

    // D. Hitung Per Kamar (BARU)
    const namaAsrama = s.asrama || 'LAINNYA'
    const namaKamar = s.kamar || '?'

    if (!stats.distribusi_kamar[namaAsrama]) {
        stats.distribusi_kamar[namaAsrama] = {}
    }
    stats.distribusi_kamar[namaAsrama][namaKamar] = (stats.distribusi_kamar[namaAsrama][namaKamar] || 0) + 1
  })

  return stats
}