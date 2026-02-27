'use server'

import { createClient } from '@/lib/supabase/server'

// 1. Cek Hak Akses (Scope) User
export async function getUserScope() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { role: 'guest', filter: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, asrama_binaan')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'wali_kelas'

  // LOGIKA PEMBATASAN DATA
  if (role === 'pengurus_asrama') {
    return { role, type: 'ASRAMA', value: profile?.asrama_binaan }
  }
  
  if (role === 'wali_kelas') {
    const { data: kelas } = await supabase
      .from('kelas')
      .select('id')
      .eq('wali_kelas_id', user.id)
      .single()
    
    return { role, type: 'KELAS', value: kelas?.id }
  }

  return { role, type: 'GLOBAL', value: null }
}

// 2. Ambil Data Rekap (Agregasi S/I/A)
export async function getRekapAbsensi(
  filterNama: string, 
  filterAsrama: string, 
  filterKelasId: string,
  filterKamar: string
) {
  const supabase = await createClient()
  const scope = await getUserScope()

  // --- QUERY SANTRI ---
  let query = supabase
    .from('santri')
    .select(`
      id, nama_lengkap, nis, asrama, kamar,
      riwayat_pendidikan!inner (
        id, kelas_id,
        kelas (id, nama_kelas) 
      )
    `)
    // Note: Saya hapus fetch marhalah(nama) karena tidak dipakai lagi untuk display
    .eq('status_global', 'aktif')
    .eq('riwayat_pendidikan.status_riwayat', 'aktif')
    .order('nama_lengkap')
    .limit(100)

  // Terapkan Scope Role
  if (scope.type === 'ASRAMA') {
    if (!scope.value) return [] 
    query = query.eq('asrama', scope.value)
  } else if (scope.type === 'KELAS') {
    if (!scope.value) return [] 
    query = query.eq('riwayat_pendidikan.kelas_id', scope.value)
  }

  // Terapkan Filter User
  if (filterAsrama && scope.type !== 'ASRAMA') {
    query = query.eq('asrama', filterAsrama)
  }
  
  if (filterKamar) {
    query = query.eq('kamar', filterKamar)
  }

  if (filterKelasId && scope.type !== 'KELAS') {
    query = query.eq('riwayat_pendidikan.kelas_id', filterKelasId)
  }
  if (filterNama) {
    query = query.ilike('nama_lengkap', `%${filterNama}%`)
  }

  const { data: santriList, error } = await query

  if (error || !santriList || santriList.length === 0) return []

  const riwayatIds = santriList.map((s: any) => {
    const r = Array.isArray(s.riwayat_pendidikan) ? s.riwayat_pendidikan[0] : s.riwayat_pendidikan
    return r?.id
  }).filter(Boolean)

  // --- QUERY ABSENSI ---
  const { data: absenList } = await supabase
    .from('absensi_harian')
    .select('riwayat_pendidikan_id, shubuh, ashar, maghrib')
    .in('riwayat_pendidikan_id', riwayatIds)
    .or('shubuh.neq.H,ashar.neq.H,maghrib.neq.H')

  // --- AGREGASI ---
  const result = santriList.map((s: any) => {
    const rArr = Array.isArray(s.riwayat_pendidikan) ? s.riwayat_pendidikan : [s.riwayat_pendidikan]
    const r = rArr[0] || {}
    
    const riwayatId = r.id
    const absenAnak = absenList?.filter(a => a.riwayat_pendidikan_id === riwayatId) || []

    let sakit = 0, izin = 0, alfa = 0

    absenAnak.forEach((row: any) => {
      if (row.shubuh === 'S') sakit++; if (row.shubuh === 'I') izin++; if (row.shubuh === 'A') alfa++;
      if (row.ashar === 'S') sakit++; if (row.ashar === 'I') izin++; if (row.ashar === 'A') alfa++;
      if (row.maghrib === 'S') sakit++; if (row.maghrib === 'I') izin++; if (row.maghrib === 'A') alfa++;
    })

    // Handle Kelas Data
    const kArr = Array.isArray(r.kelas) ? r.kelas : [r.kelas]
    const k = kArr[0] || {}
    
    // UPDATE: Hanya tampilkan nama kelas saja, tanpa marhalah di dalam kurung
    const namaKelas = k.nama_kelas || '-'

    return {
      id: s.id,
      nama: s.nama_lengkap,
      nis: s.nis,
      info_asrama: `${s.asrama || '-'} - Kamar ${s.kamar || '-'}`,
      info_kelas: namaKelas,
      total_s: sakit,
      total_i: izin,
      total_a: alfa,
      total_masalah: sakit + izin + alfa
    }
  })

  // Sort by Total Alfa
  return result.sort((a, b) => b.total_a - a.total_a)
}

// 3. Ambil Detail (Untuk Modal Popup)
export async function getDetailAbsensiSantri(santriId: string) {
  const supabase = await createClient()

  const { data: riwayat } = await supabase
    .from('riwayat_pendidikan')
    .select('id')
    .eq('santri_id', santriId)
    .eq('status_riwayat', 'aktif')
    .single()

  if (!riwayat) return []

  const { data } = await supabase
    .from('absensi_harian')
    .select('*')
    .eq('riwayat_pendidikan_id', riwayat.id)
    .or('shubuh.neq.H,ashar.neq.H,maghrib.neq.H')
    .order('tanggal', { ascending: false })

  return data || []
}

// Helper untuk Dropdown
export async function getReferensiFilter() {
  const supabase = await createClient()
  const { data: kelas } = await supabase.from('kelas').select('id, nama_kelas')
  const sorted = (kelas || []).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
  return { kelas: sorted }
}