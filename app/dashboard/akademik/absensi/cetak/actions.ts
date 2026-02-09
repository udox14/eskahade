'use server'

import { createClient } from '@/lib/supabase/server'

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = (day < 3 ? day + 7 : day) - 3;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  
  const start = new Date(d); // Rabu
  const end = new Date(d);
  end.setDate(end.getDate() + 6); // Selasa depan

  return { start, end };
}

export async function getRekapAlfaMingguan(tanggalRef: string) {
  const supabase = await createClient()
  const { start, end } = getWeekRange(new Date(tanggalRef))

  // 1. Ambil data absensi
  // Kriteria:
  // (A) Tanggal masuk range minggu ini DAN status 'A'
  // (B) ATAU Tanggal KAPANPUN tapi status 'A' DAN verif_xxx = 'BELUM' (Hutang sidang)
  
  const { data: rawData } = await supabase
    .from('absensi_harian')
    .select(`
      id, tanggal, 
      shubuh, ashar, maghrib,
      verif_shubuh, verif_ashar, verif_maghrib,
      riwayat:riwayat_pendidikan_id (
        santri (nama_lengkap, nis, asrama, kamar)
      )
    `)
    // Kita ambil agak luas, filter manual di JS biar logic OR-nya gampang
    .or('shubuh.eq.A,ashar.eq.A,maghrib.eq.A') 

  if (!rawData || rawData.length === 0) return []

  const rekapMap = new Map<string, any>()

  // Filter Data di Memory
  rawData.forEach((row: any) => {
    const tglRow = new Date(row.tanggal)
    // Cek apakah data ini relevan untuk dicetak sekarang?
    const isThisWeek = tglRow >= start && tglRow <= end
    
    // Cek per sesi: Masuk hitungan jika (Minggu ini) ATAU (Hutang Lama / 'BELUM')
    // Sesi yg sudah 'OK' (divonis) tidak perlu dipanggil lagi
    const isHitungShubuh = row.shubuh === 'A' && (isThisWeek || row.verif_shubuh === 'BELUM') && row.verif_shubuh !== 'OK'
    const isHitungAshar = row.ashar === 'A' && (isThisWeek || row.verif_ashar === 'BELUM') && row.verif_ashar !== 'OK'
    const isHitungMaghrib = row.maghrib === 'A' && (isThisWeek || row.verif_maghrib === 'BELUM') && row.verif_maghrib !== 'OK'

    if (!isHitungShubuh && !isHitungAshar && !isHitungMaghrib) return

    // Mapping Santri
    const s = Array.isArray(row.riwayat.santri) ? row.riwayat.santri[0] : row.riwayat.santri
    const nis = s.nis

    if (!rekapMap.has(nis)) {
      rekapMap.set(nis, {
        nama: s.nama_lengkap,
        asrama: s.asrama || '-',
        kamar: s.kamar || '-',
        alfa_shubuh: 0,
        alfa_ashar: 0,
        alfa_maghrib: 0,
        total: 0
      })
    }

    const curr = rekapMap.get(nis)
    
    if (isHitungShubuh) { curr.alfa_shubuh++; curr.total++; }
    if (isHitungAshar) { curr.alfa_ashar++; curr.total++; }
    if (isHitungMaghrib) { curr.alfa_maghrib++; curr.total++; }
  })

  return Array.from(rekapMap.values()).sort((a, b) => a.nama.localeCompare(b.nama))
}