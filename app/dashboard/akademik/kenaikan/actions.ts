'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Ambil Referensi Marhalah (Untuk Dropdown Asal)
export async function getMarhalahList() {
  const supabase = await createClient()
  const { data } = await supabase.from('marhalah').select('id, nama').order('urutan')
  return data || []
}

// 2. Ambil Santri per Marhalah (Untuk Download Template)
export async function getSantriByMarhalah(marhalahId: string) {
  const supabase = await createClient()

  // Ambil semua kelas di marhalah ini
  const { data: kelasList } = await supabase
    .from('kelas')
    .select('id')
    .eq('marhalah_id', marhalahId)
  
  if (!kelasList || kelasList.length === 0) return []
  const kelasIds = kelasList.map(k => k.id)

  // Ambil santri aktif di kelas-kelas tersebut
  const { data: listSantriRaw } = await supabase
    .from('riwayat_pendidikan')
    .select(`
      id,
      santri (id, nama_lengkap, nis),
      kelas (nama_kelas),
      ranking (rata_rata, predikat)
    `)
    .in('kelas_id', kelasIds)
    .eq('status_riwayat', 'aktif')
    .order('santri(nama_lengkap)')

  if (!listSantriRaw) return []

  // Normalisasi Data
  return listSantriRaw.map((item: any) => {
    const s = Array.isArray(item.santri) ? item.santri[0] : item.santri
    const k = Array.isArray(item.kelas) ? item.kelas[0] : item.kelas
    const r = Array.isArray(item.ranking) ? item.ranking[0] : item.ranking

    return {
      riwayat_id: item.id,
      santri_id: s?.id,
      nis: s?.nis,
      nama: s?.nama_lengkap,
      kelas_sekarang: k?.nama_kelas,
      rata_rata: r?.rata_rata || 0,
      predikat: r?.predikat || '-'
    }
  })
}

// 3. Proses Import Kenaikan (Logic Utama)
export async function importKenaikanKelas(dataExcel: any[]) {
  const supabase = await createClient()

  if (!dataExcel || dataExcel.length === 0) return { error: "Data kosong." }

  // A. Ambil Referensi Semua Kelas Aktif (Untuk Validasi Target)
  const { data: allClasses } = await supabase.from('kelas').select('id, nama_kelas')
  const mapKelas = new Map()
  // Simpan lowercase agar case-insensitive (misal admin ketik "2-a" padahal db "2-A")
  allClasses?.forEach(k => mapKelas.set(k.nama_kelas.trim().toLowerCase(), k.id))

  // B. Ambil Data Santri Aktif (Untuk Validasi NIS & Ambil ID Riwayat Lama)
  const { data: allActiveSantri } = await supabase
    .from('riwayat_pendidikan')
    .select('id, santri(nis)')
    .eq('status_riwayat', 'aktif')
  
  const mapNisToRiwayat = new Map()
  allActiveSantri?.forEach((r: any) => {
    const s = Array.isArray(r.santri) ? r.santri[0] : r.santri
    if (s?.nis) mapNisToRiwayat.set(String(s.nis).trim(), r.id)
  })

  // C. Validasi & Mapping Data
  const updates = [] // ID riwayat lama untuk di-close
  const inserts = [] // Data baru untuk di-insert
  const errors = []

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const rowNum = i + 2
    
    const nis = String(row['NIS'] || row['nis']).trim()
    const targetKelasNama = String(row['TARGET KELAS'] || row['target kelas'] || '').trim()

    // Skip jika target kosong (mungkin tinggal kelas di tempat yang sama, atau belum diputuskan)
    if (!targetKelasNama) continue;

    // Validasi
    const riwayatLamaId = mapNisToRiwayat.get(nis)
    const targetKelasId = mapKelas.get(targetKelasNama.toLowerCase())

    if (!riwayatLamaId) {
      errors.push(`Baris ${rowNum}: Santri NIS ${nis} tidak ditemukan di data aktif.`)
      continue
    }
    if (!targetKelasId) {
      errors.push(`Baris ${rowNum}: Kelas tujuan '${targetKelasNama}' tidak ditemukan di database.`)
      continue
    }

    // Siapkan Data
    updates.push(riwayatLamaId)
    
    // Kita butuh santri_id untuk insert baru. Ambil dari riwayat lama (agak tricky kalau tidak query ulang)
    // Cara cepat: Kita query riwayat_pendidikan di awal harusnya include santri_id.
    // Revisi query B di atas:
  }

  // REVISI LOGIC LOOP (Biar efisien ambil santri_id)
  // Kita fetch ulang data spesifik untuk santri yang valid saja biar aman
  if (errors.length > 0) {
    return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }
  }

  // --- EKSEKUSI DATABASE ---
  
  // Karena keterbatasan Supabase JS client untuk Transaction kompleks, 
  // kita lakukan loop tapi kita pastikan data valid dulu.
  
  // 1. Ambil detail santri_id dari NIS yang valid
  const validNisList = dataExcel
    .filter(r => r['TARGET KELAS'])
    .map(r => String(r['NIS']).trim())

  const { data: sourceData } = await supabase
    .from('riwayat_pendidikan')
    .select('id, santri_id, santri(nis)')
    .in('status_riwayat', ['aktif']) // Hanya yang aktif
    
  const mapNisToFullData = new Map()
  sourceData?.forEach((d: any) => {
    const n = Array.isArray(d.santri) ? d.santri[0].nis : d.santri.nis
    mapNisToFullData.set(String(n).trim(), { riwayat_id: d.id, santri_id: d.santri_id })
  })

  const recordsToInsert = []
  const recordsToUpdateIds = []

  for (const row of dataExcel) {
    const targetName = String(row['TARGET KELAS'] || '').trim()
    if (!targetName) continue

    const nis = String(row['NIS']).trim()
    const santriData = mapNisToFullData.get(nis)
    const targetId = mapKelas.get(targetName.toLowerCase())

    if (santriData && targetId) {
      recordsToUpdateIds.push(santriData.riwayat_id)
      recordsToInsert.push({
        santri_id: santriData.santri_id,
        kelas_id: targetId,
        status_riwayat: 'aktif'
      })
    }
  }

  if (recordsToInsert.length === 0) return { error: "Tidak ada data valid untuk diproses." }

  // 1. Update Lama -> Naik
  const { error: errUpdate } = await supabase
    .from('riwayat_pendidikan')
    .update({ status_riwayat: 'naik' })
    .in('id', recordsToUpdateIds)

  if (errUpdate) return { error: "Gagal update data lama: " + errUpdate.message }

  // 2. Insert Baru
  const { error: errInsert } = await supabase
    .from('riwayat_pendidikan')
    .insert(recordsToInsert)

  if (errInsert) return { error: "Gagal insert data baru: " + errInsert.message }

  revalidatePath('/dashboard/akademik/kenaikan')
  return { success: true, count: recordsToInsert.length }
}