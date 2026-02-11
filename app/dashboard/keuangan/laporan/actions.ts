'use server'

import { createClient } from '@/lib/supabase/server'

// Ambil Laporan Transaksi + Analisa Target
export async function getLaporanKeuangan(tahun: number) {
  const supabase = await createClient()

  // ---------------------------------------------------------
  // 1. DATA CASH FLOW (Uang yang fisik masuk di tahun ini)
  // ---------------------------------------------------------
  const startDate = `${tahun}-01-01`
  const endDate = `${tahun}-12-31 23:59:59`

  const { data: listTransaksi } = await supabase
    .from('pembayaran_tahunan')
    .select(`
      id, jenis_biaya, nominal_bayar, tahun_tagihan, tanggal_bayar, keterangan,
      santri (nama_lengkap, nis, asrama),
      penerima:penerima_id (full_name)
    `)
    .gte('tanggal_bayar', startDate)
    .lte('tanggal_bayar', endDate)
    .order('tanggal_bayar', { ascending: false })

  // Hitung Total Masuk (Cash Flow)
  const cashFlow = {
    BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0, TOTAL: 0
  }
  
  listTransaksi?.forEach((item: any) => {
    const jenis = item.jenis_biaya as keyof typeof cashFlow
    if (cashFlow[jenis] !== undefined) {
      cashFlow[jenis] += item.nominal_bayar
    }
    cashFlow.TOTAL += item.nominal_bayar
  })

  // ---------------------------------------------------------
  // 2. DATA TARGET & KEKURANGAN (Analisa Piutang)
  // ---------------------------------------------------------
  
  // A. Ambil Semua Santri Aktif
  const { data: santriList } = await supabase
    .from('santri')
    .select('id, tahun_masuk, created_at')
    .eq('status_global', 'aktif')

  // B. Ambil Semua Setting Tarif
  const { data: settings } = await supabase
    .from('biaya_settings')
    .select('*')

  // C. Ambil Riwayat Bayar (Untuk cek lunas/belum)
  // Kita butuh semua riwayat pembayaran santri aktif untuk menghitung sisa tagihan
  const { data: allPayments } = await supabase
    .from('pembayaran_tahunan')
    .select('santri_id, jenis_biaya, tahun_tagihan, nominal_bayar')

  // D. Kalkulasi Target
  const targets = {
    BANGUNAN: { target: 0, terima: 0, kurang: 0 },
    KESEHATAN: { target: 0, terima: 0, kurang: 0 },
    EHB: { target: 0, terima: 0, kurang: 0 },
    EKSKUL: { target: 0, terima: 0, kurang: 0 },
  }

  // Helper Map Tarif
  const mapTarif = new Map<string, number>() // key: "2024-BANGUNAN" val: 1000000
  settings?.forEach(s => {
    mapTarif.set(`${s.tahun_angkatan}-${s.jenis_biaya}`, s.nominal)
  })

  if (santriList && allPayments) {
    santriList.forEach(s => {
      const angkatan = s.tahun_masuk || new Date(s.created_at).getFullYear()

      // --- HITUNG BANGUNAN (Lifetime) ---
      const tarifBangunan = mapTarif.get(`${angkatan}-BANGUNAN`) || 0
      const sudahBayarBangunan = allPayments
        .filter(p => p.santri_id === s.id && p.jenis_biaya === 'BANGUNAN')
        .reduce((sum, p) => sum + p.nominal_bayar, 0)
      
      targets.BANGUNAN.target += tarifBangunan
      targets.BANGUNAN.terima += sudahBayarBangunan // Total diterima seumur hidup
      targets.BANGUNAN.kurang += Math.max(0, tarifBangunan - sudahBayarBangunan)

      // --- HITUNG TAHUNAN (Khusus Tahun yang Dipilih) ---
      // EHB, KESEHATAN, EKSKUL
      ;['KESEHATAN', 'EHB', 'EKSKUL'].forEach(jenis => {
          const tarif = mapTarif.get(`${angkatan}-${jenis}`) || 0
          // Cek pembayaran untuk TAHUN TAGIHAN ini (bukan tanggal bayar)
          const sudahBayar = allPayments
            .filter(p => p.santri_id === s.id && p.jenis_biaya === jenis && p.tahun_tagihan === tahun)
            .reduce((sum, p) => sum + p.nominal_bayar, 0)

          const key = jenis as 'KESEHATAN' | 'EHB' | 'EKSKUL'
          targets[key].target += tarif
          targets[key].terima += sudahBayar
          targets[key].kurang += Math.max(0, tarif - sudahBayar)
      })
    })
  }

  return { 
    cashFlow, // Uang masuk real di tahun ini
    targets,  // Analisa target vs kurang
    list: listTransaksi || [] 
  }
}