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
    .select('riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib')
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
  // Baris yang semua H → hapus dari DB (tidak perlu disimpan, default = hadir)
  const deleteKeys: { riwayat_id: string, tanggal: string }[] = []

  for (const item of dataInput) {
    const s = item.shubuh || 'H'
    const a = item.ashar || 'H'
    const m = item.maghrib || 'H'

    if (s === 'H' && a === 'H' && m === 'H') {
      // Semua hadir → tidak perlu baris di DB, hapus kalau ada
      deleteKeys.push({ riwayat_id: item.riwayat_id, tanggal: item.tanggal })
    } else {
      upsertData.push({
        riwayat_pendidikan_id: item.riwayat_id,
        tanggal: item.tanggal,
        shubuh: s,
        ashar: a,
        maghrib: m,
        created_by: user.id,
      })
    }
  }

  // Hapus baris yang sekarang semua H (mungkin dulu dikoreksi dari alfa/sakit)
  for (const key of deleteKeys) {
    await supabase
      .from('absensi_harian')
      .delete()
      .eq('riwayat_pendidikan_id', key.riwayat_id)
      .eq('tanggal', key.tanggal)
  }

  // Upsert hanya yang ada ketidakhadiran
  if (upsertData.length > 0) {
    const { error } = await supabase
      .from('absensi_harian')
      .upsert(upsertData, { onConflict: 'riwayat_pendidikan_id, tanggal' })

    if (error) {
      console.error("Error Absen:", error)
      return { error: error.message }
    }
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