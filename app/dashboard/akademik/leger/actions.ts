'use server'

import { createClient } from '@/lib/supabase/server'

// 1. Ambil Daftar Kelas (Sesuai Role)
export async function getKelasListForLeger() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Cek Profile untuk Role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  let query = supabase
    .from('kelas')
    .select('id, nama_kelas, marhalah(nama)')
    .order('nama_kelas')

  // Jika Wali Kelas, filter hanya kelas dia
  if (role === 'wali_kelas') {
    query = query.eq('wali_kelas_id', user.id)
  }

  const { data } = await query
  return data || []
}

// 2. Ambil Data Leger (Heavy Logic)
export async function getLegerData(kelasId: string, semester: number) {
  const supabase = await createClient()

  // A. Ambil Semua Mapel Aktif (Untuk Header Kolom)
  const { data: mapelList } = await supabase
    .from('mapel')
    .select('id, nama')
    .eq('aktif', true)
    .order('nama')

  if (!mapelList) return { mapel: [], siswa: [] }

  // B. Ambil Santri di Kelas Ini
  const { data: santriList } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      id,
      santri (id, nama_lengkap, nis),
      ranking (jumlah_nilai, rata_rata, ranking_kelas)
    `)
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .eq('ranking.semester', semester) // Filter ranking sesuai semester
    .order('santri(nama_lengkap)')

  if (!santriList || santriList.length === 0) return { mapel: mapelList, siswa: [] }

  const riwayatIds = santriList.map(s => s.id)

  // C. Ambil Semua Nilai Akademik Santri Tersebut
  const { data: nilaiList } = await supabase
    .from('nilai_akademik')
    .select('riwayat_pendidikan_id, mapel_id, nilai')
    .in('riwayat_pendidikan_id', riwayatIds)
    .eq('semester', semester)

  // D. PIVOT DATA (Menyusun nilai per siswa)
  const legerSiswa = santriList.map(s => {
    // Cari ranking (handle array/object)
    const rankData = Array.isArray(s.ranking) ? s.ranking[0] : s.ranking

    // Mapping nilai per mapel
    const nilaiPerMapel: Record<string, number | string> = {}
    
    mapelList.forEach(m => {
      // Cari nilai santri ini untuk mapel ini
      const n = nilaiList?.find(item => 
        item.riwayat_pendidikan_id === s.id && 
        item.mapel_id === m.id
      )
      nilaiPerMapel[m.id] = n ? n.nilai : 0 // 0 jika belum ada nilai
    })

    // FIX TYPESCRIPT ERROR: Gunakan 'as any' untuk by-pass strict checking pada nested join
    const santriRaw = s.santri as any
    const santriObj = Array.isArray(santriRaw) ? santriRaw[0] : santriRaw

    return {
      id: s.id,
      nis: santriObj?.nis || '-',
      nama: santriObj?.nama_lengkap || 'Tanpa Nama',
      nilai: nilaiPerMapel, // Object { "1": 80, "2": 90 }
      jumlah: rankData?.jumlah_nilai || 0,
      rata: rankData?.rata_rata || 0,
      rank: rankData?.ranking_kelas || '-'
    }
  })

  return {
    mapel: mapelList,
    siswa: legerSiswa
  }
}