'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = (day < 3 ? day + 7 : day) - 3;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  
  const start = new Date(d); // Rabu
  const end = new Date(d);
  end.setDate(end.getDate() + 6); // Selasa depan

  return { start, end };
}

export async function getAbsensiData(kelasId: string, tanggalRef: string) {
  const supabase = await createClient()
  const { start, end } = getWeekRange(new Date(tanggalRef))

  const { data: santri } = await supabase
    .from('riwayat_pendidikan')
    .select('id, santri(id, nama_lengkap, nis)')
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif')
    .order('santri(nama_lengkap)')

  if (!santri || santri.length === 0) return { santri: [], absensi: [] }

  const { data: absensi } = await supabase
    .from('absensi_harian')
    .select('*')
    .in('riwayat_pendidikan_id', santri.map(s => s.id))
    .gte('tanggal', start.toISOString())
    .lte('tanggal', end.toISOString())

  return { santri: santri || [], absensi: absensi || [] }
}

// UPDATE: Hapus logic Auto-Pelanggaran. Hanya simpan status mentah.
export async function simpanAbsensi(dataInput: any[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const upsertData: any[] = []

  for (const item of dataInput) {
    upsertData.push({
      riwayat_pendidikan_id: item.riwayat_id,
      tanggal: item.tanggal,
      shubuh: item.shubuh || 'H',
      ashar: item.ashar || 'H',
      maghrib: item.maghrib || 'H',
      created_by: user.id,
      // Reset verifikasi jika status berubah (biar aman)
      // Tapi kita biarkan null dulu biar logic verifikasi yang handle
    })
  }

  const { error } = await supabase
    .from('absensi_harian')
    .upsert(upsertData, { onConflict: 'riwayat_pendidikan_id, tanggal' })

  if (error) {
    console.error("Error Absen:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/akademik/absensi')
  return { success: true }
}

export async function getKelasList() {
  const supabase = await createClient()
  const { data } = await supabase.from('kelas').select('id, nama_kelas')
  const sorted = (data || []).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
  return sorted
}