'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Helper Email Generator
function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.com`
}

// 1. GETTERS
export async function getDataMaster() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { kelasList: [], guruList: [] };
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  const { data: kelas } = await supabaseAdmin
    .from('kelas')
    .select(`
      id, nama_kelas, marhalah(nama),
      guru_shubuh:guru_shubuh_id(id, nama_lengkap),
      guru_ashar:guru_ashar_id(id, nama_lengkap),
      guru_maghrib:guru_maghrib_id(id, nama_lengkap),
      wali_kelas:wali_kelas_id(full_name) 
    `)

  const { data: guru } = await supabaseAdmin
    .from('data_guru')
    .select('id, nama_lengkap, gelar')
    .order('nama_lengkap')

  const sortedKelas = (kelas || []).sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { 
    kelasList: sortedKelas, 
    guruList: guru || [] 
  }
}

// 2. MANAJEMEN GURU (CRUD MANUAL)
export async function tambahGuruManual(nama: string, gelar: string, kode: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.from('data_guru').insert({
    nama_lengkap: nama,
    gelar: gelar,
    kode_guru: kode
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuru(id: string) {
  const supabase = await createClient()

  // Cek relasi dulu (optional, tapi biasanya FK sudah handle via SET NULL)
  const { error } = await supabase.from('data_guru').delete().eq('id', id)

  if (error) return { error: "Gagal menghapus (Mungkin sedang dipakai di jadwal?)" }
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

// Hapus banyak guru sekaligus
export async function hapusGuruBatch(ids: string[]) {
  const supabase = await createClient()
  if (!ids || ids.length === 0) return { error: "Pilih minimal 1 guru" }
  const { error } = await supabase.from('data_guru').delete().in('id', ids)
  if (error) return { error: "Gagal menghapus (Mungkin sedang dipakai di jadwal?)" }
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: ids.length }
}

// 3. IMPORT DATA GURU (EXCEL) - dengan pengecekan duplikat
export async function importDataGuru(dataExcel: any[]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Server Key Error" }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  if (!dataExcel || dataExcel.length === 0) return { error: "Data kosong" }

  // Normalisasi data dari Excel
  const parsed = dataExcel.map(row => ({
    nama_lengkap: String(row['NAMA LENGKAP'] || row['nama'] || row['Nama'] || '').trim(),
    gelar: row['GELAR'] || row['gelar'] || '',
    kode_guru: row['KODE'] || row['kode'] || null
  })).filter(d => d.nama_lengkap)

  if (parsed.length === 0) return { error: "Tidak ada data guru valid" }

  // Ambil semua nama guru yang sudah ada di DB
  const { data: existing } = await supabaseAdmin
    .from('data_guru')
    .select('nama_lengkap')

  const existingNames = new Set(
    (existing || []).map((g: any) => g.nama_lengkap.toLowerCase().trim())
  )

  // Filter: hanya yang belum ada di DB
  const newOnly = parsed.filter(d => !existingNames.has(d.nama_lengkap.toLowerCase()))
  const skippedCount = parsed.length - newOnly.length

  // Semua duplikat - tidak ada yang perlu diinsert
  if (newOnly.length === 0) {
    return { success: true, count: 0, skipped: skippedCount, allDuplicate: true }
  }

  const { error } = await supabaseAdmin.from('data_guru').insert(newOnly)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: newOnly.length, skipped: skippedCount }
}

// 4. SET JADWAL BATCH (SIMPAN SEMUA) & AUTO ACCOUNT
export async function simpanJadwalBatch(listJadwal: any[]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Server Key Error" }
  
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let successCount = 0

  for (const item of listJadwal) {
    const { kelasId, shubuhId, asharId, maghribId } = item
    
    // A. Update Tabel Kelas
    const { error: errKelas } = await supabaseAdmin
      .from('kelas')
      .update({
        guru_shubuh_id: shubuhId || null,
        guru_ashar_id: asharId || null,
        guru_maghrib_id: maghribId || null
      })
      .eq('id', kelasId)

    if (errKelas) continue;

    // B. LOGIKA OTOMATIS WALI KELAS (Berdasarkan Guru Maghrib)
    if (maghribId) {
      const { data: guruData } = await supabaseAdmin
        .from('data_guru')
        .select('nama_lengkap')
        .eq('id', maghribId)
        .single()

      if (guruData) {
        const email = generateEmail(guruData.nama_lengkap)
        const password = "password123"

        let userId = null
        const { data: existingUsers } = await supabaseAdmin.from('profiles').select('id').eq('full_name', guruData.nama_lengkap).limit(1)
        
        if (existingUsers && existingUsers.length > 0) {
          userId = existingUsers[0].id
        } else {
          const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: guruData.nama_lengkap }
          })

          if (newUser.user) {
            userId = newUser.user.id
            await supabaseAdmin.from('profiles').upsert({
              id: userId,
              full_name: guruData.nama_lengkap,
              role: 'wali_kelas'
            })
          }
        }

        if (userId) {
          await supabaseAdmin.from('kelas').update({ wali_kelas_id: userId }).eq('id', kelasId)
        }
      }
    } else {
      await supabaseAdmin.from('kelas').update({ wali_kelas_id: null }).eq('id', kelasId)
    }
    successCount++
  }

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: successCount }
}