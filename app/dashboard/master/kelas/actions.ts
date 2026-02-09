'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. GETTERS
export async function getMarhalahList() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('*').order('urutan')
  return data || []
}

export async function getKelasList() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kelas')
    .select('*, marhalah(nama)')
    .order('nama_kelas')
  return data || []
}

// 2. TAMBAH MANUAL
export async function tambahKelas(formData: FormData) {
  const supabase = await createClient()
  
  const namaKelas = formData.get('nama_kelas') as string
  const marhalahId = formData.get('marhalah_id') as string
  const jenisKelamin = formData.get('jenis_kelamin') as string

  const { data: tahunAktif } = await supabase
    .from('tahun_ajaran')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!tahunAktif) return { error: "Tidak ada tahun ajaran aktif." }

  // Cek duplikat manual
  const { data: exist } = await supabase
    .from('kelas')
    .select('id')
    .eq('nama_kelas', namaKelas)
    .eq('marhalah_id', marhalahId)
    .eq('tahun_ajaran_id', tahunAktif.id)
    .single()

  if (exist) return { error: "Kelas dengan nama ini sudah ada di marhalah tersebut." }

  const { error } = await supabase.from('kelas').insert({
    nama_kelas: namaKelas,
    marhalah_id: marhalahId,
    jenis_kelamin: jenisKelamin,
    tahun_ajaran_id: tahunAktif.id
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

// 3. HAPUS KELAS
export async function hapusKelas(kelasId: string) {
  const supabase = await createClient()

  const { count } = await supabase
    .from('riwayat_pendidikan')
    .select('*', { count: 'exact', head: true })
    .eq('kelas_id', kelasId)
    .eq('status_riwayat', 'aktif') 

  if (count && count > 0) {
    return { error: "Gagal hapus: Masih ada santri aktif di kelas ini. Kosongkan dulu." }
  }

  const { error } = await supabase.from('kelas').delete().eq('id', kelasId)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

// 4. IMPORT EXCEL MASSAL (Anti Duplikat)
export async function importKelasMassal(dataExcel: any[]) {
    const supabase = await createClient()

    // Ambil Tahun Ajaran Aktif
    const { data: tahunAktif } = await supabase
        .from('tahun_ajaran')
        .select('id')
        .eq('is_active', true)
        .single()

    if (!tahunAktif) return { error: "Tidak ada tahun ajaran aktif." }

    // Ambil Referensi Marhalah
    const { data: marhalahList } = await supabase.from('marhalah').select('id, nama')
    const mapMarhalah = new Map()
    marhalahList?.forEach(m => mapMarhalah.set(m.nama.toLowerCase().trim(), m.id))

    // CEK DATA EKSISTING (Untuk mencegah duplikat)
    const { data: existingClasses } = await supabase
        .from('kelas')
        .select('nama_kelas, marhalah_id')
        .eq('tahun_ajaran_id', tahunAktif.id)

    // Buat Set untuk pengecekan cepat (Format: "namakelas-idmarhalah")
    const existingSet = new Set(
        existingClasses?.map(c => `${c.nama_kelas.toLowerCase().trim()}-${c.marhalah_id}`)
    )

    const inserts = []
    const errors = []
    let duplicates = 0

    for (let i = 0; i < dataExcel.length; i++) {
        const row = dataExcel[i]
        const rowNum = i + 2
        
        const namaKelas = String(row['NAMA KELAS'] || row['nama kelas'] || '').trim()
        const namaMarhalah = String(row['MARHALAH'] || row['marhalah'] || '').trim()
        const jkRaw = String(row['JENIS KELAMIN'] || row['jenis kelamin'] || 'L').toUpperCase().trim()
        
        if (!namaKelas || !namaMarhalah) continue;

        const marhalahId = mapMarhalah.get(namaMarhalah.toLowerCase())
        
        if (!marhalahId) {
            errors.push(`Baris ${rowNum}: Marhalah '${namaMarhalah}' tidak ditemukan di sistem.`)
            continue
        }

        // CEK DUPLIKAT
        const keyCheck = `${namaKelas.toLowerCase()}-${marhalahId}`
        if (existingSet.has(keyCheck)) {
            duplicates++
            continue; // Skip, jangan dimasukkan ke inserts
        }

        // Normalisasi JK
        let jk = 'L'
        if (jkRaw === 'P' || jkRaw === 'PUTRI' || jkRaw === 'PEREMPUAN') jk = 'P'
        else if (jkRaw === 'C' || jkRaw === 'CAMPURAN') jk = 'C'

        inserts.push({
            nama_kelas: namaKelas,
            marhalah_id: marhalahId,
            jenis_kelamin: jk,
            tahun_ajaran_id: tahunAktif.id
        })
        
        // Tambahkan ke Set sementara agar tidak duplikat di dalam file excel itu sendiri
        existingSet.add(keyCheck)
    }

    if (errors.length > 0) {
        return { error: `Gagal sebagian:\n${errors.slice(0, 5).join('\n')}` }
    }

    if (inserts.length === 0) {
        if (duplicates > 0) return { error: `Semua data (${duplicates}) dilewati karena kelas sudah ada.` }
        return { error: "Tidak ada data valid untuk disimpan." }
    }

    const { error } = await supabase.from('kelas').insert(inserts)

    if (error) return { error: error.message }

    revalidatePath('/dashboard/master/kelas')
    return { success: true, count: inserts.length, skipped: duplicates }
}