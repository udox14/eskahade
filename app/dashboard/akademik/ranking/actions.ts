'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper: Tentukan Predikat
function getPredikat(rataRata: number) {
  if (rataRata >= 86) return 'Mumtaz'
  if (rataRata >= 76) return 'Jayyid Jiddan'
  if (rataRata >= 66) return 'Jayyid'
  if (rataRata >= 56) return 'Maqbul'
  return 'Dhoif'
}

// 1. Ambil Data Ranking yang Sudah Ada
export async function getDataRanking(kelasId: string, semester: number) {
  const supabase = await createClient()
  
  // STEP 1: Ambil ID semua santri di kelas ini
  const { data: santriKelas } = await supabase
    .from('riwayat_pendidikan')
    .select('id, santri(nama_lengkap, nis)')
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .order('santri(nama_lengkap)')

  if (!santriKelas || santriKelas.length === 0) return []

  const ids = santriKelas.map(s => s.id)

  // STEP 2: Ambil ranking mereka
  const { data: ranking } = await supabase
    .from('ranking')
    .select('*')
    .in('riwayat_pendidikan_id', ids)
    .eq('semester', semester)
    .order('ranking_kelas', { ascending: true })

  // Gabungkan data (Ranking + Nama Santri)
  const result = ranking?.map(r => {
    const s = santriKelas.find(sk => sk.id === r.riwayat_pendidikan_id)
    
    // PERBAIKAN: Cek apakah s.santri itu array atau object
    // Jika array, ambil elemen pertama [0]. Jika object, pakai langsung.
    const santriData = Array.isArray(s?.santri) ? s.santri[0] : s?.santri

    return {
      ...r,
      nama: santriData?.nama_lengkap || 'Tanpa Nama',
      nis: santriData?.nis || '-'
    }
  })

  return result || []
}

// 2. PROSES HITUNG ULANG (LOGIC UTAMA)
export async function hitungUlangRanking(kelasId: string, semester: number) {
  const supabase = await createClient()

  // A. Ambil ID Mapel Kunci untuk Tie-Breaker (Nahwu & Sharaf)
  const { data: mapelRef } = await supabase.from('mapel').select('id, nama')
  const idNahwu = mapelRef?.find(m => m.nama.toLowerCase() === 'nahwu')?.id
  const idSharaf = mapelRef?.find(m => m.nama.toLowerCase() === 'sharaf')?.id

  // B. Ambil Semua Santri di Kelas
  const { data: listSantri } = await supabase
    .from('riwayat_pendidikan')
    .select('id')
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')

  if (!listSantri || listSantri.length === 0) return { error: "Kelas kosong" }

  const riwayatIds = listSantri.map(s => s.id)

  // C. Ambil Semua Nilai Akademik mereka
  const { data: listNilai } = await supabase
    .from('nilai_akademik')
    .select('riwayat_pendidikan_id, mapel_id, nilai')
    .in('riwayat_pendidikan_id', riwayatIds)
    .eq('semester', semester)

  // D. Kalkulasi di Memory
  const rekapNilai: any[] = riwayatIds.map(id => {
    const nilaiAnak = listNilai?.filter(n => n.riwayat_pendidikan_id === id) || []
    
    const total = nilaiAnak.reduce((sum, curr) => sum + (curr.nilai || 0), 0)
    // Asumsi pembagi 10 mapel
    const rata = total > 0 ? (total / 10) : 0 

    const nilaiNahwu = nilaiAnak.find(n => n.mapel_id === idNahwu)?.nilai || 0
    const nilaiSharaf = nilaiAnak.find(n => n.mapel_id === idSharaf)?.nilai || 0

    return {
      riwayat_pendidikan_id: id,
      jumlah: total,
      rata: Number(rata.toFixed(2)),
      nahwu: nilaiNahwu,
      sharaf: nilaiSharaf
    }
  })

  // E. Sorting
  rekapNilai.sort((a, b) => {
    if (b.rata !== a.rata) return b.rata - a.rata
    if (b.nahwu !== a.nahwu) return b.nahwu - a.nahwu
    return b.sharaf - a.sharaf
  })

  // F. Siapkan Data
  const dataToUpsert = rekapNilai.map((item, index) => ({
    riwayat_pendidikan_id: item.riwayat_pendidikan_id,
    semester: semester,
    jumlah_nilai: item.jumlah,
    rata_rata: item.rata,
    ranking_kelas: index + 1,
    predikat: getPredikat(item.rata)
  }))

  // G. Simpan
  const { error } = await supabase
    .from('ranking')
    .upsert(dataToUpsert, { onConflict: 'riwayat_pendidikan_id, semester' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/akademik/ranking')
  return { success: true, count: dataToUpsert.length }
}

export async function getKelasList() {
  const supabase = await createClient()
  const { data } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas')
  return data || []
}