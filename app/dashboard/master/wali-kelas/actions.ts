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
    .order('nama_kelas')

  const { data: guru } = await supabaseAdmin
    .from('data_guru')
    .select('*')
    .order('nama_lengkap')

  return { 
    kelasList: kelas || [], 
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

// 3. IMPORT DATA GURU (EXCEL)
export async function importDataGuru(dataExcel: any[]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Server Key Error" }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  if (!dataExcel || dataExcel.length === 0) return { error: "Data kosong" }

  const inserts = dataExcel.map(row => ({
    nama_lengkap: String(row['NAMA LENGKAP'] || row['nama'] || row['Nama'] || '').trim(),
    gelar: row['GELAR'] || row['gelar'] || '',
    kode_guru: row['KODE'] || row['kode'] || null
  })).filter(d => d.nama_lengkap)

  if (inserts.length === 0) return { error: "Tidak ada data guru valid" }

  const { error } = await supabaseAdmin.from('data_guru').insert(inserts)
  
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: inserts.length }
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