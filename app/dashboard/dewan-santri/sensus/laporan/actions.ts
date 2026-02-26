'use server'

import { createClient } from '@/lib/supabase/server'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

// Helper Mapping Sekolah (Hapus 'export' agar tidak dianggap Server Action)
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
  const supabase = await createClient()

  // Range Tanggal Bulan Ini
  const startDate = new Date(tahun, bulan - 1, 1).toISOString()
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString()

  // 1. DATA MASTER: Semua Santri Aktif
  const { data: santriList } = await supabase
    .from('santri')
    .select('id, nama_lengkap, asrama, kamar, sekolah, kelas_sekolah, created_at')
    .eq('status_global', 'aktif')

  // 2. DATA MUTASI KELUAR (Surat Berhenti Bulan Ini)
  const { data: mutasiKeluar } = await supabase
    .from('riwayat_surat')
    .select('created_at, detail_info, santri(nama_lengkap, asrama, kamar, sekolah, kelas_sekolah, alamat)')
    .eq('jenis_surat', 'BERHENTI')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  // 3. DATA MUTASI MASUK (Santri Baru Bulan Ini)
  const mutasiMasuk = santriList?.filter((s: any) => s.created_at >= startDate && s.created_at <= endDate) || []

  // --- PENGOLAHAN DATA (Aggregasi) ---

  // A. REKAP ASRAMA (Page 2)
  const statsAsrama: any = {}
  ASRAMA_LIST.forEach(a => {
    statsAsrama[a] = { total: 0, keluar: 0, masuk: 0, kamar: {} }
  })

  // Hitung Populasi & Kamar
  santriList?.forEach((s: any) => {
    const asrama = s.asrama || 'LAINNYA'
    const kamar = s.kamar || '?'
    
    if (!statsAsrama[asrama]) statsAsrama[asrama] = { total: 0, keluar: 0, masuk: 0, kamar: {} }
    
    statsAsrama[asrama].total++
    statsAsrama[asrama].kamar[kamar] = (statsAsrama[asrama].kamar[kamar] || 0) + 1
  })

  // Hitung Mutasi per Asrama
  mutasiKeluar?.forEach((m: any) => {
    const asrama = m.santri?.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].keluar++
  })
  mutasiMasuk.forEach((m: any) => {
    const asrama = m.asrama || 'LAINNYA'
    if (statsAsrama[asrama]) statsAsrama[asrama].masuk++
  })

  // B. REKAP SEKOLAH (Page 3)
  const statsSekolah: any = {}
  ASRAMA_LIST.forEach(a => {
    statsSekolah[a] = {
        MI: 0,
        MTS: { 7:0, 8:0, 9:0, tot:0 },
        MTSN: { 7:0, 8:0, 9:0, tot:0 },
        SMP: { 7:0, 8:0, 9:0, tot:0 },
        MA: { 10:0, 11:0, 12:0, tot:0 },
        SMA: { 10:0, 11:0, 12:0, tot:0 },
        SMK: { 10:0, 11:0, 12:0, tot:0 },
        SADESA: 0,
        TOTAL: 0
    }
  })

  santriList?.forEach((s: any) => {
      const asrama = s.asrama || 'LAINNYA'
      if (!statsSekolah[asrama]) return 

      const namaSekolah = getNamaSekolahLengkap(s.sekolah)
      const kelasRaw = s.kelas_sekolah ? s.kelas_sekolah.replace(/\D/g, '') : '0'
      const kelas = parseInt(kelasRaw)

      statsSekolah[asrama].TOTAL++

      // Mapping ke Struktur Laporan
      if (namaSekolah.includes('MI')) statsSekolah[asrama].MI++
      else if (namaSekolah.includes('SADESA')) statsSekolah[asrama].SADESA++
      else if (namaSekolah.includes('MTsN')) {
          if([7,8,9].includes(kelas)) statsSekolah[asrama].MTSN[kelas]++
          statsSekolah[asrama].MTSN.tot++
      }
      else if (namaSekolah.includes('MTs.')) {
          if([7,8,9].includes(kelas)) statsSekolah[asrama].MTS[kelas]++
          statsSekolah[asrama].MTS.tot++
      }
      else if (namaSekolah.includes('SMP')) {
          if([7,8,9].includes(kelas)) statsSekolah[asrama].SMP[kelas]++
          statsSekolah[asrama].SMP.tot++
      }
      else if (namaSekolah.includes('MAN')) {
          let kls = kelas
          if (kls === 1) kls = 10; if (kls === 2) kls = 11; if (kls === 3) kls = 12;
          
          if([10,11,12].includes(kls)) statsSekolah[asrama].MA[kls]++
          statsSekolah[asrama].MA.tot++
      }
      else if (namaSekolah.includes('SMA')) {
          let kls = kelas
          if (kls === 1) kls = 10; if (kls === 2) kls = 11; if (kls === 3) kls = 12;
          if([10,11,12].includes(kls)) statsSekolah[asrama].SMA[kls]++
          statsSekolah[asrama].SMA.tot++
      }
      else if (namaSekolah.includes('SMK')) {
          let kls = kelas
          if (kls === 1) kls = 10; if (kls === 2) kls = 11; if (kls === 3) kls = 12;
          if([10,11,12].includes(kls)) statsSekolah[asrama].SMK[kls]++
          statsSekolah[asrama].SMK.tot++
      }
  })

  // C. LIST MUTASI (Page 4)
  const listMutasi = [
      ...mutasiMasuk.map((m: any) => ({ ...m, tipe: 'MASUK', tgl: m.created_at, ket: 'Santri Baru' })),
      ...(mutasiKeluar?.map((m: any) => ({ ...m.santri, tipe: 'KELUAR', tgl: m.created_at, ket: m.detail_info || 'Berhenti' })) || [])
  ].sort((a, b) => new Date(a.tgl).getTime() - new Date(b.tgl).getTime())

  return {
    asrama: statsAsrama,
    sekolah: statsSekolah,
    mutasi: listMutasi,
    total_santri: santriList?.length || 0
  }
}