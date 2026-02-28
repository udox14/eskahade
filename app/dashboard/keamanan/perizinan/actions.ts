'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil List Perizinan
export async function getPerizinanList(filterWaktu: 'HARI' | 'MINGGU' | 'BULAN' = 'HARI') {
  const supabase = await createClient()
  
  const now = new Date()
  let startDate = new Date()

  if (filterWaktu === 'HARI') {
    startDate.setHours(0, 0, 0, 0)
  } else if (filterWaktu === 'MINGGU') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startDate = new Date(now.setDate(diff))
    startDate.setHours(0, 0, 0, 0)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const { data, error } = await supabase
    .from('perizinan')
    .select(`
      id, created_at, status, jenis, alasan,
      tgl_mulai, tgl_selesai_rencana, tgl_kembali_aktual,
      santri (nama_lengkap, nis, asrama, kamar)
    `)
    // Tampilkan yang AKTIF (termasuk yang telat & menunggu sidang) 
    // ATAU yang KEMBALI (selesai) dalam rentang waktu filter
    .or(`status.eq.AKTIF,and(status.eq.KEMBALI,tgl_kembali_aktual.gte.${startDate.toISOString()})`)
    .order('created_at', { ascending: false })

  if (error) console.error(error)
  return data || []
}

// 2. Simpan Izin Baru
export async function simpanIzin(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const santri_id = formData.get('santri_id') as string
  const jenis = formData.get('jenis') as string
  const alasan = formData.get('alasan') as string
  const pemberi_izin = formData.get('pemberi_izin') as string
  
  let tgl_mulai, tgl_selesai_rencana

  if (jenis === 'PULANG') {
    const dStart = formData.get('date_start') as string
    const dEnd = formData.get('date_end') as string
    tgl_mulai = new Date(`${dStart}T08:00:00`).toISOString()
    tgl_selesai_rencana = new Date(`${dEnd}T17:00:00`).toISOString()
  } else {
    const date = formData.get('date_single') as string
    const tStart = formData.get('time_start') as string
    const tEnd = formData.get('time_end') as string
    tgl_mulai = new Date(`${date}T${tStart}:00`).toISOString()
    tgl_selesai_rencana = new Date(`${date}T${tEnd}:00`).toISOString()
  }

  const { error } = await supabase.from('perizinan').insert({
    santri_id,
    jenis,
    tgl_mulai,
    tgl_selesai_rencana,
    alasan,
    pemberi_izin,
    status: 'AKTIF',
    created_by: user?.id
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// 3. Update Status -> SUDAH DATANG (DENGAN CEK TELAT)
export async function setSudahDatang(id: string, waktuDatang: string) {
  const supabase = await createClient()

  // Ambil data rencana dulu untuk dibandingkan
  const { data: izin } = await supabase
    .from('perizinan')
    .select('tgl_selesai_rencana')
    .eq('id', id)
    .single()

  if (!izin) return { error: "Data izin tidak ditemukan." }

  const aktual = new Date(waktuDatang)
  const rencana = new Date(izin.tgl_selesai_rencana)

  // Cek apakah telat? (Aktual > Rencana)
  const isTelat = aktual > rencana

  let statusFinal = 'KEMBALI' // Default Tepat Waktu
  
  // Jika Telat, status biarkan 'AKTIF' agar masuk ke antrian Verifikasi Telat
  // Tapi tgl_kembali_aktual tetap diisi sebagai tanda dia sudah fisik di pondok
  if (isTelat) {
    statusFinal = 'AKTIF' 
  }

  const { error } = await supabase
    .from('perizinan')
    .update({
      status: statusFinal,
      tgl_kembali_aktual: aktual.toISOString()
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/keamanan/perizinan')
  
  if (isTelat) {
    return { success: true, message: "Terlambat! Masuk antrian verifikasi." }
  }
  return { success: true, message: "Tepat waktu. Izin selesai." }
}

// 4. Cari Santri
export async function cariSantri(keyword: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('santri')
    .select('id, nama_lengkap, nis, asrama, kamar')
    .ilike('nama_lengkap', `%${keyword}%`)
    .limit(5)
  return data || []
}