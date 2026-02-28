'use server'

import { createClient } from '@/lib/supabase/server'

// Aturan libur tetap (sama dengan di page.tsx absensi-guru)
function isLibur(dayOfWeek: number, session: 'shubuh' | 'ashar' | 'maghrib'): boolean {
  // dayOfWeek: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  if (dayOfWeek === 2 && session === 'maghrib') return true // Selasa
  if (dayOfWeek === 4 && session === 'maghrib') return true // Kamis
  if (dayOfWeek === 5 && (session === 'shubuh' || session === 'ashar')) return true // Jumat
  return false
}

// Hitung jumlah hari efektif per sesi dalam rentang tanggal
function hitungHariEfektif(startDate: string, endDate: string, session: 'shubuh' | 'ashar' | 'maghrib'): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    if (!isLibur(current.getDay(), session)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

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
  badalAsHadir: boolean
) {
  const supabase = await createClient()

  // Pre-hitung hari efektif per sesi (dikurangi libur tetap)
  const hariEfektif = {
    shubuh: hitungHariEfektif(startDate, endDate, 'shubuh'),
    ashar:  hitungHariEfektif(startDate, endDate, 'ashar'),
    maghrib: hitungHariEfektif(startDate, endDate, 'maghrib'),
  }

  // B. Ambil Data Kelas & Guru Pengajarnya (Master Jadwal)
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

  const mapJadwal = new Map<string, any>()
  kelasList.forEach((k: any) => {
    mapJadwal.set(k.id, {
      name: k.nama_kelas,
      shubuh: k.guru_shubuh,
      ashar: k.guru_ashar,
      maghrib: k.guru_maghrib
    })
  })

  // C. Ambil Data Absensi
  const kelasIds = kelasList.map((k: any) => k.id)

  const { data: absensiList } = await supabase
    .from('absensi_guru')
    .select('kelas_id, tanggal, shubuh, ashar, maghrib')
    .in('kelas_id', kelasIds)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  if (!absensiList) return []

  // D. Bangun statsGuru dari master jadwal
  // total_wajib per guru = jumlah sesi × hari efektif sesi tersebut
  const statsGuru = new Map<string, any>()

  const initGuru = (guru: any) => {
    if (!guru || !guru.id) return
    if (!statsGuru.has(guru.id)) {
      statsGuru.set(guru.id, {
        id: guru.id,
        nama: guru.nama_lengkap,
        kelas_ajar: new Set<string>(),
        hadir: 0,
        badal: 0,
        kosong: 0,
        libur: 0,
        total_wajib: 0,
      })
    }
  }

  // Hitung total_wajib dari master jadwal × hari efektif per sesi
  kelasList.forEach((k: any) => {
    const sessions: Array<'shubuh' | 'ashar' | 'maghrib'> = ['shubuh', 'ashar', 'maghrib']
    sessions.forEach(session => {
      const guruKey = session === 'shubuh' ? 'guru_shubuh' : session === 'ashar' ? 'guru_ashar' : 'guru_maghrib'
      const guru = k[guruKey]
      if (!guru) return
      initGuru(guru)
      const stat = statsGuru.get(guru.id)
      // Tambah hari efektif sesi ini ke total_wajib guru
      stat.total_wajib += hariEfektif[session]
      const labelSesi = session === 'shubuh' ? 'Shubuh' : session === 'ashar' ? 'Ashar' : 'Maghrib'
      stat.kelas_ajar.add(`${k.nama_kelas} (${labelSesi})`)
    })
  })

  // E. Akumulasi hadir/badal/kosong dari data absensi
  // Baris libur (L) dikurangi dari total_wajib karena sudah dihitung di hari efektif
  absensiList.forEach((absen: any) => {
    const jadwal = mapJadwal.get(absen.kelas_id)
    if (!jadwal) return

    const processSession = (session: 'shubuh' | 'ashar' | 'maghrib') => {
      const guru = jadwal[session]
      if (!guru || !statsGuru.has(guru.id)) return
      const stat = statsGuru.get(guru.id)
      const status = absen[session]

      if (status === 'L') {
        // Libur mendadak (selain libur tetap) — kurangi dari total_wajib
        stat.libur++
        stat.total_wajib--
      } else if (status === 'H') stat.hadir++
      else if (status === 'B') stat.badal++
      else if (status === 'A') stat.kosong++
    }

    processSession('shubuh')
    processSession('ashar')
    processSession('maghrib')
  })

  // F. Konversi & hitung persentase
  const result = Array.from(statsGuru.values()).map(g => {
    const total_wajib = Math.max(g.total_wajib, 0)
    const pembilang = g.hadir + (badalAsHadir ? g.badal : 0)
    const persentase = total_wajib > 0 ? Math.round((pembilang / total_wajib) * 100) : 0
    const pct = (n: number) => total_wajib > 0 ? Math.round((n / total_wajib) * 100) : 0

    return {
      ...g,
      total_wajib,
      kelas_ajar: Array.from(g.kelas_ajar).join(', '),
      persentase,
      pct_hadir: pct(g.hadir),
      pct_badal: pct(g.badal),
      pct_kosong: pct(g.kosong),
    }
  })

  result.sort((a, b) => a.persentase - b.persentase)
  return result
}