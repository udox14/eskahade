'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Daftar Kelas
export async function getKelasListForLeger() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  let query = supabase.from('kelas').select('id, nama_kelas, marhalah(nama)').order('nama_kelas')

  if (role === 'wali_kelas') {
    query = query.eq('wali_kelas_id', user.id)
  }

  const { data } = await query
  return data || []
}

// 2. Ambil Data Leger (Hanya Baca, Tidak Hitung Ulang)
export async function getLegerData(kelasId: string, semester: number) {
  const supabase = await createClient()

  // A. Ambil Mapel
  const { data: mapelList } = await supabase.from('mapel').select('id, nama').eq('aktif', true).order('nama')
  if (!mapelList) return { mapel: [], siswa: [] }

  // B. Ambil Santri
  const { data: santriList } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      id,
      santri (id, nama_lengkap, nis),
      ranking (jumlah_nilai, rata_rata, ranking_kelas)
    `)
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .eq('ranking.semester', semester)
    .order('santri(nama_lengkap)')
    .limit(1000)

  if (!santriList || santriList.length === 0) return { mapel: mapelList, siswa: [] }

  const riwayatIds = santriList.map(s => s.id)

  // C. Ambil Nilai
  const { data: nilaiList } = await supabase
    .from('nilai_akademik')
    .select('riwayat_pendidikan_id, mapel_id, nilai')
    .in('riwayat_pendidikan_id', riwayatIds)
    .eq('semester', semester)
    .limit(5000)

  // D. Pivot Data
  const legerSiswa = santriList.map(s => {
    const rankData = Array.isArray(s.ranking) ? s.ranking[0] : s.ranking
    const nilaiPerMapel: Record<string, number | string> = {}
    
    mapelList.forEach(m => {
      const n = nilaiList?.find(item => item.riwayat_pendidikan_id === s.id && item.mapel_id === m.id)
      nilaiPerMapel[m.id] = n ? n.nilai : 0 
    })

    const santriRaw = s.santri as any
    const santriObj = Array.isArray(santriRaw) ? santriRaw[0] : santriRaw

    return {
      id: s.id,
      riwayat_id: s.id, // Penting untuk update ranking
      nis: santriObj?.nis || '-',
      nama: santriObj?.nama_lengkap || 'Tanpa Nama',
      nilai: nilaiPerMapel,
      jumlah: rankData?.jumlah_nilai || 0,
      rata: rankData?.rata_rata || 0,
      rank: rankData?.ranking_kelas || '-'
    }
  })

  // Default Sort: Nama (Abjad) agar sesuai format Leger
  // Tidak diurutkan berdasarkan ranking di sini, agar murni data
  legerSiswa.sort((a, b) => a.nama.localeCompare(b.nama))

  return { mapel: mapelList, siswa: legerSiswa }
}

// 3. BARU: Hitung & Simpan Ranking (Kalkulator)
// Fungsi ini yang melakukan perhitungan berat saat tombol ditekan
export async function hitungDanSimpanLeger(kelasId: string, semester: number) {
  const supabase = await createClient()

  // Ambil data untuk kalkulasi
  const { mapel, siswa } = await getLegerData(kelasId, semester)
  if (siswa.length === 0) return { error: "Tidak ada siswa" }

  const totalMapel = mapel.length || 10 // Pembagi rata-rata (Default 10 jika error)

  // Array untuk menyimpan hasil hitungan sementara
  const kalkulasi = siswa.map(s => {
    // Hitung ulang jumlah dari raw nilai
    let jumlah = 0
    Object.values(s.nilai).forEach(v => {
        jumlah += Number(v) || 0
    })
    
    const rata = Number((jumlah / totalMapel).toFixed(2))

    return {
        riwayat_pendidikan_id: s.riwayat_id,
        semester,
        jumlah_nilai: jumlah,
        rata_rata: rata
    }
  })

  // Sorting Ranking (Terbesar ke Terkecil)
  kalkulasi.sort((a, b) => b.rata_rata - a.rata_rata)

  // Tambahkan Ranking ke data
  const dataToUpsert = kalkulasi.map((item, idx) => ({
    ...item,
    ranking_kelas: idx + 1,
    predikat: getPredikat(item.rata_rata)
  }))

  // Simpan ke Database
  const { error } = await supabase
    .from('ranking')
    .upsert(dataToUpsert, { onConflict: 'riwayat_pendidikan_id, semester' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/akademik/leger')
  return { success: true }
}

function getPredikat(rata: number) {
  if (rata >= 86) return 'Mumtaz'
  if (rata >= 76) return 'Jayyid Jiddan'
  if (rata >= 66) return 'Jayyid'
  if (rata >= 56) return 'Maqbul'
  return 'Dhoif'
}