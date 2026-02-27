'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Kelas (Filter Hak Akses)
export async function getKelasList() {
  const supabase = await createClient()
  
  // --- CEK ROLE USER LOGIN ---
  const { data: { user } } = await supabase.auth.getUser()
  let isWaliKelas = false
  let userId = user?.id

  if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'wali_kelas') {
          isWaliKelas = true
      }
  }

  let query = supabase.from('kelas').select('id, nama_kelas, marhalah(nama)').order('nama_kelas')

  // Jika yang login wali kelas, hanya tampilkan kelas binaannya
  if (isWaliKelas && userId) {
      query = query.eq('wali_kelas_id', userId)
  }

  const { data } = await query
  return data || []
}

// 2. Kalkulasi Data Grading per Kelas
export async function getDataGrading(kelasId: string) {
  const supabase = await createClient()

  // A. Ambil santri aktif di kelas ini + nilai grade_lanjutan yang mungkin sudah disimpan sebelumnya
  const { data: listSantri } = await supabase
    .from('riwayat_pendidikan')
    .select('id, grade_lanjutan, santri(nama_lengkap, nis)')
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .order('santri(nama_lengkap)')

  if (!listSantri || listSantri.length === 0) return []
  const riwayatIds = listSantri.map(s => s.id)

  // B. Cari ID Mata Pelajaran Ilmu Alat (Nahwu & Sharaf)
  const { data: mapelRef } = await supabase.from('mapel').select('id, nama')
  const mapelIlmuAlatIds = mapelRef?.filter(m => 
    m.nama.toLowerCase().includes('nahwu') || m.nama.toLowerCase().includes('sharaf')
  ).map(m => m.id) || []

  // C. Ambil Seluruh Nilai Akademik mereka khusus Mapel Ilmu Alat (Semester 1 & 2)
  let listNilai: any[] = []
  if (mapelIlmuAlatIds.length > 0) {
    const { data } = await supabase
      .from('nilai_akademik')
      .select('riwayat_pendidikan_id, mapel_id, nilai, semester')
      .in('riwayat_pendidikan_id', riwayatIds)
      .in('mapel_id', mapelIlmuAlatIds)
    listNilai = data || []
  }

  // D. Proses Perhitungan Rata-rata & Rekomendasi
  const result = listSantri.map(s => {
    // Parsing data relasi santri
    const santriData = Array.isArray(s.santri) ? s.santri[0] : s.santri
    
    // Ambil nilai milik anak ini
    const myGrades = listNilai.filter(n => n.riwayat_pendidikan_id === s.id)

    let totalNilai = 0
    let countNilai = 0

    // Hitung total dari semua nilai (Nahwu/Sharaf, Smt 1 & Smt 2)
    myGrades.forEach(n => {
        if (n.nilai !== null && n.nilai !== undefined) {
            totalNilai += Number(n.nilai)
            countNilai++
        }
    })

    // Rata-rata Gabungan
    const rata = countNilai > 0 ? (totalNilai / countNilai) : 0
    
    // Logika Rekomendasi Sistem (A/B/C)
    let rekomendasi = 'Grade C'
    if (rata >= 70) {
        rekomendasi = 'Grade A'
    } else if (rata >= 50) {
        rekomendasi = 'Grade B'
    } else if (countNilai === 0) {
        // Jika tidak ada nilai sama sekali
        rekomendasi = '-' 
    }

    return {
      riwayat_id: s.id,
      nis: santriData?.nis || '-',
      nama: santriData?.nama_lengkap || 'Tanpa Nama',
      rata_rata: Number(rata.toFixed(1)),
      jumlah_komponen_nilai: countNilai,
      rekomendasi: rekomendasi,
      // Default Final Grade: Ambil dari DB (jika sudah pernah disave), kalau belum pakai Rekomendasi Sistem
      grade_final: s.grade_lanjutan || (rekomendasi !== '-' ? rekomendasi : 'Grade C')
    }
  })

  return result
}

// 3. Simpan Batch (Bulk Update)
export async function simpanGradingBatch(payload: { riwayat_id: string, grade: string }[]) {
  const supabase = await createClient()
  if (payload.length === 0) return { success: true }

  // Update secara paralel
  const promises = payload.map(item => {
    return supabase
      .from('riwayat_pendidikan')
      .update({ grade_lanjutan: item.grade })
      .eq('id', item.riwayat_id)
  })

  const results = await Promise.all(promises)
  
  const hasError = results.some(res => res.error !== null)
  if (hasError) throw new Error("Beberapa data gagal disimpan ke server.")

  revalidatePath('/dashboard/akademik/grading')
  return { success: true, count: payload.length }
}