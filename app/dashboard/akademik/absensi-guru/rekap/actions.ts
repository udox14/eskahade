'use server'

import { createClient } from '@/lib/supabase/server'

// 1. Ambil Marhalah untuk Filter
export async function getMarhalahList() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('*').order('urutan')
  return data || []
}

// 2. Logic Utama: Hitung Rekap Kinerja
export async function getRekapKinerjaGuru(
  startDate: string, 
  endDate: string, 
  marhalahId: string, 
  badalAsHadir: boolean // Opsi: Apakah Badal dihitung sebagai kehadiran?
) {
  const supabase = await createClient()

  // A. Ambil Data Kelas & Guru Pengajarnya (Master Jadwal)
  let queryKelas = supabase
    .from('kelas')
    .select(`
      id, nama_kelas, marhalah(nama),
      guru_shubuh:guru_shubuh_id(id, nama_lengkap),
      guru_ashar:guru_ashar_id(id, nama_lengkap),
      guru_maghrib:guru_maghrib_id(id, nama_lengkap)
    `)

  if (marhalahId) {
    queryKelas = queryKelas.eq('marhalah_id', marhalahId)
  }

  const { data: kelasList } = await queryKelas
  if (!kelasList) return []

  // Buat Lookup Map: Kelas ID -> Guru ID per Sesi
  // Agar nanti saat looping absen, kita tahu ID Kelas ini gurunya siapa
  const mapJadwal = new Map<string, any>()
  kelasList.forEach((k: any) => {
    mapJadwal.set(k.id, {
        name: k.nama_kelas,
        marhalah: k.marhalah?.nama,
        shubuh: k.guru_shubuh, // Object {id, nama}
        ashar: k.guru_ashar,
        maghrib: k.guru_maghrib
    })
  })

  // B. Ambil Data Absensi (Rentang Waktu)
  // Kita filter kelas_id berdasarkan kelas yang didapat di atas
  const kelasIds = kelasList.map((k: any) => k.id)
  
  const { data: absensiList } = await supabase
    .from('absensi_guru')
    .select('kelas_id, tanggal, shubuh, ashar, maghrib')
    .in('kelas_id', kelasIds)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  if (!absensiList) return []

  // C. AGREGASI DATA PER GURU
  // Kita butuh map: Guru ID -> Stats
  const statsGuru = new Map<string, any>()

  const initGuru = (guru: any) => {
    if (!guru || !guru.id) return
    if (!statsGuru.has(guru.id)) {
        statsGuru.set(guru.id, {
            id: guru.id,
            nama: guru.nama_lengkap,
            kelas_ajar: new Set(), // Untuk list kelas yang diajar
            hadir: 0,
            badal: 0,
            kosong: 0,
            libur: 0,
            total_wajib: 0 // (H + A + B)
        })
    }
  }

  // Loop setiap record absen (per hari per kelas)
  absensiList.forEach((absen: any) => {
    const jadwal = mapJadwal.get(absen.kelas_id)
    if (!jadwal) return

    // Proses per sesi
    const processSession = (session: 'shubuh'|'ashar'|'maghrib') => {
        const guru = jadwal[session]
        if (!guru) return // Tidak ada guru di sesi ini, skip

        initGuru(guru)
        const stat = statsGuru.get(guru.id)
        const status = absen[session] // H, A, B, L

        // Catat nama kelas (unik)
        stat.kelas_ajar.add(`${jadwal.name} (${session.charAt(0).toUpperCase()})`)

        if (status === 'L') {
            stat.libur++
            // Libur tidak menambah beban wajib
        } else {
            // Selain libur, dianggap jadwal wajib
            stat.total_wajib++
            
            if (status === 'H') stat.hadir++
            else if (status === 'B') stat.badal++
            else if (status === 'A') stat.kosong++ // Alpa/Kosong
        }
    }

    processSession('shubuh')
    processSession('ashar')
    processSession('maghrib')
  })

  // D. KONVERSI KE ARRAY & HITUNG PERSENTASE
  const result = Array.from(statsGuru.values()).map(g => {
    // Rumus Persentase
    // Opsi: badalAsHadir ? (H + B) : H
    const pembilang = g.hadir + (badalAsHadir ? g.badal : 0)
    const penyebut = g.total_wajib
    
    const persentase = penyebut > 0 
        ? Math.round((pembilang / penyebut) * 100) 
        : 0 // Jika libur terus, 0 atau 100? Kita set 0 dulu atau '-' di UI

    return {
        ...g,
        kelas_ajar: Array.from(g.kelas_ajar).join(', '),
        persentase
    }
  })

  // Sort: Paling rendah performanya di atas (biar ketahuan)
  result.sort((a, b) => a.persentase - b.persentase)

  return result
}