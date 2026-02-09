'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Ambil item yang PERLU diverifikasi
export async function getAntrianVerifikasi() {
  const supabase = await createClient()
  
  const { data: rawData } = await supabase
    .from('absensi_harian')
    .select(`
      id, tanggal, 
      shubuh, ashar, maghrib,
      verif_shubuh, verif_ashar, verif_maghrib,
      riwayat:riwayat_pendidikan_id (
        santri (id, nama_lengkap, nis, asrama, kamar)
      )
    `)
    .or('shubuh.eq.A,ashar.eq.A,maghrib.eq.A')
    .order('tanggal', { ascending: false })

  if (!rawData) return []

  const groupedMap = new Map<string, any>()

  rawData.forEach((row: any) => {
    const sRaw = row.riwayat?.santri
    const s = Array.isArray(sRaw) ? sRaw[0] : sRaw
    
    if (!s) return 

    const sessions = ['shubuh', 'ashar', 'maghrib']

    sessions.forEach(sess => {
      if (row[sess] === 'A' && row[`verif_${sess}`] !== 'OK') {
        if (!groupedMap.has(s.id)) {
          groupedMap.set(s.id, {
            santri_id: s.id,
            nama: s.nama_lengkap,
            nis: s.nis,
            info: `${s.asrama || '-'} / ${s.kamar || '-'}`,
            items: []
          })
        }
        groupedMap.get(s.id).items.push({
          absen_id: row.id,
          tanggal: row.tanggal,
          sesi: sess,
          status_verif: row[`verif_${sess}`]
        })
      }
    })
  })

  return Array.from(groupedMap.values())
}

// Tipe Data untuk Payload Massal
type VonisItem = {
  santriId: string,
  items: { absen_id: string, sesi: string, tanggal: string }[],
  vonis: 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
}

// EKSEKUSI VONIS MASSAL (DENGAN AGREGASI)
export async function simpanVerifikasiMassal(daftarVonis: VonisItem[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!daftarVonis || daftarVonis.length === 0) return { error: "Tidak ada data untuk disimpan" }

  const violationsToInsert: any[] = []

  await Promise.all(daftarVonis.map(async (data) => {
    const { santriId, items, vonis } = data

    if (vonis === 'ALFA_MURNI') {
      // --- PERUBAHAN UTAMA: AGREGASI MENJADI SATU PELANGGARAN ---
      
      const totalSesi = items.length
      const totalPoin = totalSesi * 10 // Poin tetap dikalikan 10
      
      // Buat deskripsi yang merangkum detail
      const detailString = items
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
        .map(i => {
          const tgl = new Date(i.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          return `${tgl} (${i.sesi})`
        })
        .join(', ')

      // UPDATE: Tambahkan \n sebelum kata Detail agar mudah diparsing di frontend
      const deskripsiFinal = `Akumulasi Alfa Pengajian (${totalSesi} Sesi).\nDetail: ${detailString}`

      // 1. Insert HANYA SATU record ke tabel Pelanggaran
      violationsToInsert.push({
        santri_id: santriId,
        tanggal: new Date().toISOString(), // Tanggal pelanggaran = Tanggal Sidang
        jenis: 'ALFA_PENGAJIAN',
        deskripsi: deskripsiFinal,
        poin: totalPoin,
        penindak_id: user?.id
      })

      // 2. Tandai semua item absensi sebagai 'OK' (Selesai)
      for (const item of items) {
        await supabase
          .from('absensi_harian')
          .update({ [`verif_${item.sesi}`]: 'OK' })
          .eq('id', item.absen_id)
      }

    } else if (vonis === 'BELUM') {
      // Tandai 'BELUM' (Hutang Sidang)
      for (const item of items) {
        await supabase
          .from('absensi_harian')
          .update({ [`verif_${item.sesi}`]: 'BELUM' })
          .eq('id', item.absen_id)
      }
    
    } else {
      // Ubah Status Utama (A -> S / I / H) dan Reset Verifikasi
      const newStatus = vonis === 'SAKIT' ? 'S' : vonis === 'IZIN' ? 'I' : 'H'
      
      for (const item of items) {
        await supabase
          .from('absensi_harian')
          .update({ 
            [item.sesi]: newStatus,
            [`verif_${item.sesi}`]: null 
          })
          .eq('id', item.absen_id)
      }
    }
  }))

  // Eksekusi Insert Pelanggaran (Batch)
  if (violationsToInsert.length > 0) {
    const { error } = await supabase.from('pelanggaran').insert(violationsToInsert)
    if (error) console.error("Gagal insert pelanggaran batch:", error)
  }

  revalidatePath('/dashboard/akademik/absensi/verifikasi')
  // Revalidate juga halaman keamanan agar data pelanggaran baru langsung muncul
  revalidatePath('/dashboard/keamanan') 
  
  return { success: true, count: daftarVonis.length }
}