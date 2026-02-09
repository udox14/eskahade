'use server'

import { createClient } from '@/lib/supabase/server'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

// Helper: Hitung Rentang Rabu - Selasa (Hanya untuk referensi judul surat, bukan filter database ketat)
function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = (day < 3 ? day + 7 : day) - 3;
  d.setDate(d.getDate() - diff);
  
  const start = new Date(d); // Rabu
  const end = new Date(d);
  end.setDate(end.getDate() + 6); // Selasa depan

  return { start, end };
}

export async function getSantriTelat(tanggalRef: string) {
  const supabase = await createClient()
  const now = new Date()

  // PERBAIKAN LOGIC: 
  // Kita ambil SEMUA data yang statusnya 'AKTIF'.
  // Kenapa? Karena santri yang Mangkir sidang minggu lalu statusnya masih AKTIF.
  // Mereka harus muncul terus di surat pemanggilan sampai divonis (Selesai).
  
  const { data: rawData } = await supabase
    .from('perizinan')
    .select(`
      id, 
      jenis,
      tgl_selesai_rencana,
      tgl_kembali_aktual,
      santri (id, nama_lengkap, nis, asrama, kamar)
    `)
    .eq('status', 'AKTIF') // Kunci utama: Masih Aktif = Belum Tuntas
    .order('santri(asrama)')
    .order('santri(nama_lengkap)')

  if (!rawData || rawData.length === 0) return null

  const list: any[] = []

  rawData.forEach((item: any) => {
    const rencana = new Date(item.tgl_selesai_rencana)
    const aktual = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) : null
    
    // FILTER: Siapa yang masuk daftar panggil?
    // 1. Yang sudah balik TAPI telat (Menunggu Sidang) -> aktual > rencana
    // 2. Yang belum balik DAN sudah lewat jamnya (Overdue) -> now > rencana
    
    let isTarget = false
    let compareTime = now

    if (aktual) {
        // Kasus: Sudah input "Sudah Datang", tapi telat
        if (aktual > rencana) {
            isTarget = true
            compareTime = aktual
        }
    } else {
        // Kasus: Belum input "Sudah Datang" (Masih di luar / Kabur)
        if (now > rencana) {
            isTarget = true
            compareTime = now
        }
    }

    if (isTarget) {
        // Hitung durasi telat
        const telat = formatDistance(rencana, compareTime, { 
            locale: id, 
            addSuffix: false 
        })

        // Handle join array/object
        const s = Array.isArray(item.santri) ? item.santri[0] : item.santri

        list.push({
            nama: s.nama_lengkap,
            nis: s.nis,
            asrama: s.asrama || 'NON-ASRAMA',
            kamar: s.kamar || '-',
            jenis: item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
            rencana_kembali: item.tgl_selesai_rencana,
            durasi_telat: telat
        })
    }
  })

  if (list.length === 0) return null

  // Grouping by Asrama
  const groupedData = list.reduce((groups: any, item: any) => {
    const key = item.asrama
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {})

  return groupedData 
}