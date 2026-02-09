'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Santri Baru (Yang Belum Punya Kelas / Riwayat Pendidikan)
export async function getSantriBaru(search: string = '') {
  const supabase = await createClient()

  // Ambil santri yang statusnya aktif
  let query = supabase
    .from('santri')
    .select(`
      id, nis, nama_lengkap, jenis_kelamin,
      hasil_tes_klasifikasi (
        id, rekomendasi_marhalah, catatan_grade, hari_tes, sesi_tes
      ),
      riwayat_pendidikan (id)
    `)
    .eq('status_global', 'aktif')
    .order('nama_lengkap')

  if (search) {
    query = query.ilike('nama_lengkap', `%${search}%`)
  }

  const { data, error } = await query

  // Cek Error Database
  if (error) {
    console.error("Database Error:", error)
    throw new Error(error.message) // Lempar error agar ditangkap frontend
  }

  if (!data) return []

  // Filter & Mapping Data
  return data
    .filter((s: any) => {
      // Pastikan riwayat_pendidikan benar-benar kosong (Array kosong)
      const riwayat = s.riwayat_pendidikan
      return Array.isArray(riwayat) && riwayat.length === 0
    })
    .map((s: any) => {
      // PERBAIKAN: Handle hasil_tes_klasifikasi yang bisa berupa Array ATAU Object/Null
      const rawHasil = s.hasil_tes_klasifikasi
      
      // Jika Array, ambil elemen pertama. Jika Object, pakai langsung.
      const hasilData = Array.isArray(rawHasil) ? (rawHasil.length > 0 ? rawHasil[0] : null) : rawHasil

      return {
        id: s.id,
        nis: s.nis,
        nama: s.nama_lengkap,
        jk: s.jenis_kelamin,
        // Cek keberadaan objek hasilData untuk tentukan status
        status_tes: hasilData ? 'SUDAH' : 'BELUM',
        hasil: hasilData || null
      }
    })
}

// 2. Simpan Nilai & Hitung Rekomendasi
export async function simpanTes(formData: FormData) {
  const supabase = await createClient()
  
  const santriId = formData.get('santri_id') as string
  const hari = formData.get('hari_tes') as string
  const sesi = formData.get('sesi_tes') as string
  
  const tulis = formData.get('tulis_arab') as string
  const kelancaran = formData.get('baca_kelancaran') as string
  const tajwid = formData.get('baca_tajwid') as string
  const hafalan = Number(formData.get('hafalan_juz') || 0)
  const nahwu = formData.get('nahwu_pengalaman') === 'on'

  // --- ALGORITMA PENENTUAN MARHALAH ---
  let rekomendasi = 'Ibtidaiyyah 1'
  let grade = 'Grade B/C' // Default Reguler

  // Rule 1: Tamhidiyyah 1 (Tidak bisa tulis & Tidak bisa baca)
  if (tulis === 'TIDAK_BISA' && kelancaran === 'TIDAK_BISA') {
    rekomendasi = 'Tamhidiyyah 1'
    grade = '-'
  }
  // Rule 2: Tamhidiyyah 2 (Tulis Baik/Kurang TAPI Baca Tidak Lancar & Tajwid Kurang/Buruk)
  else if (
    (tulis === 'BAIK' || tulis === 'KURANG') && 
    kelancaran === 'TIDAK_LANCAR' && 
    (tajwid === 'KURANG' || tajwid === 'BURUK')
  ) {
    rekomendasi = 'Tamhidiyyah 2'
    grade = 'Grade A/B'
  }
  // Rule 3: Ibtidaiyyah 1 Grade A (Perfect Score)
  else if (
    (tulis === 'BAIK' || tulis === 'KURANG') && 
    kelancaran === 'LANCAR' && 
    tajwid === 'BAIK'
  ) {
    rekomendasi = 'Ibtidaiyyah 1'
    grade = 'Grade A'
  }
  // Sisanya masuk default (Ibtidaiyyah 1 Grade B/C)

  // Rule Tambahan: Nahwu
  if (nahwu) {
    grade += ' (REKOMENDASI TES NAHWU LANJUTAN)'
  }

  // Simpan ke DB (Upsert: Update jika sudah ada, Insert jika belum)
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('hasil_tes_klasifikasi')
    .upsert({
      santri_id: santriId,
      hari_tes: hari,
      sesi_tes: sesi,
      tulis_arab: tulis,
      baca_kelancaran: kelancaran,
      baca_tajwid: tajwid,
      hafalan_juz: hafalan,
      nahwu_pengalaman: nahwu,
      rekomendasi_marhalah: rekomendasi,
      catatan_grade: grade,
      tester_id: user?.id
    }, { onConflict: 'santri_id' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/santri/tes-klasifikasi')
  return { success: true }
}