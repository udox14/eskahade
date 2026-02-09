'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

// 1. Ambil Daftar Santri yang TELAT (Overdue) atau MENUNGGU SIDANG
export async function getAntrianTelat() {
  const supabase = await createClient()
  const now = new Date()

  // Ambil SEMUA izin yang masih AKTIF
  // Kita filter manual di bawah agar lebih akurat menangkap status "Menunggu Sidang"
  const { data: rawData } = await supabase
    .from('perizinan')
    .select(`
      id,
      jenis,
      tgl_mulai,
      tgl_selesai_rencana,
      tgl_kembali_aktual,
      alasan,
      pemberi_izin,
      santri (id, nama_lengkap, nis, asrama, kamar)
    `)
    .eq('status', 'AKTIF')
    .order('tgl_selesai_rencana', { ascending: true })

  if (!rawData || rawData.length === 0) return []

  const list: any[] = []

  rawData.forEach((item: any) => {
    const rencana = new Date(item.tgl_selesai_rencana)
    const aktual = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) : null
    
    // LOGIKA FILTER:
    // 1. Jika tgl_kembali_aktual ADA -> Berarti sudah pulang tapi status AKTIF -> PASTI TELAT (Menunggu Sidang) -> MASUK LIST
    // 2. Jika tgl_kembali_aktual KOSONG -> Cek apakah rencana < sekarang? Jika ya -> TELAT (Overdue) -> MASUK LIST
    
    let isTarget = false
    let statusLabel = ''

    if (aktual) {
        isTarget = true
        statusLabel = 'SUDAH KEMBALI (Menunggu Sidang)'
    } else if (rencana < now) {
        isTarget = true
        statusLabel = 'BELUM KEMBALI (Overdue)'
    }

    if (isTarget) {
        // Hitung durasi telat
        // Jika sudah kembali, hitung dari Rencana s.d. Aktual
        // Jika belum kembali, hitung dari Rencana s.d. Sekarang
        const compareTime = aktual || now
        const durasi = formatDistance(rencana, compareTime, { 
            locale: id, 
            addSuffix: false 
        })

        // Handle join array/object
        const s = Array.isArray(item.santri) ? item.santri[0] : item.santri

        list.push({
            izin_id: item.id,
            santri_id: s.id,
            nama: s.nama_lengkap,
            info: `${s.asrama || '-'} / ${s.kamar || '-'}`,
            jenis: item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
            alasan: item.alasan,
            batas_kembali: item.tgl_selesai_rencana,
            tgl_kembali: item.tgl_kembali_aktual,
            status_label: statusLabel,
            durasi_telat: durasi
        })
    }
  })

  return list
}

// 2. Simpan Vonis (Keputusan Sidang)
export async function simpanVonisTelat(
  izinId: string, 
  santriId: string, 
  vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  // Skenario A: MANGKIR (Tidak Hadir Sidang)
  // Tidak ada perubahan data, biarkan tetap AKTIF agar muncul lagi
  if (vonis === 'MANGKIR') {
    return { success: true, message: "Ditandai Mangkir. Akan muncul lagi nanti." }
  }

  // Skenario B: TELAT MURNI (Kena Poin)
  if (vonis === 'TELAT_MURNI') {
    // 1. Catat Pelanggaran
    const { error: errP } = await supabase.from('pelanggaran').insert({
      santri_id: santriId,
      tanggal: now,
      jenis: 'SEDANG', 
      deskripsi: 'Terlambat kembali ke pondok (Melebihi batas izin).',
      poin: 25,
      penindak_id: user?.id
    })
    if (errP) return { error: errP.message }
  }

  // Skenario C: Selesai (Kasus ditutup)
  // Update status perizinan jadi 'KEMBALI'
  // Pastikan tgl_kembali_aktual terisi (jika sebelumnya kosong/overdue)
  const { error: errUpdate } = await supabase
    .from('perizinan')
    .update({ 
      status: 'KEMBALI',
      // Jika tgl_kembali_aktual masih kosong (kasus overdue yang divonis tanpa pulang dulu?), isi now
      // Tapi biasanya ini kasus 'Menunggu Sidang' yang tgl_kembali_aktualnya sudah ada.
      // Kita update updated_at saja untuk trigger jika ada
    })
    .eq('id', izinId)

  if (errUpdate) return { error: errUpdate.message }

  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}