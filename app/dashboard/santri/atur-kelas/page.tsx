import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'
import { FormAturKelas } from './form-atur-kelas'

export const dynamic = "force-dynamic";

export default async function AturKelasPage() {
  const supabase = await createClient()

  // 1. Ambil Daftar Kelas Aktif
  const { data: kelasList } = await supabase
    .from('kelas')
    .select('id, nama_kelas, marhalah(nama)')
    .order('nama_kelas')

  // 2. Ambil Santri Aktif BESERTA Hasil Tes Klasifikasi
  const { data: santriList } = await supabase
    .from('santri')
    .select(`
      id, nis, nama_lengkap, 
      hasil_tes_klasifikasi (
        rekomendasi_marhalah, 
        catatan_grade
      )
    `)
    .eq('status_global', 'aktif')
    .order('nama_lengkap')
    .limit(1000) // Naikkan limit agar semua santri baru termuat

  // 3. Cek siapa yang sudah punya kelas (Untuk filter)
  const { data: riwayatAda } = await supabase
    .from('riwayat_pendidikan')
    .select('santri_id')
    .eq('status_riwayat', 'aktif')

  // Filter santri: Hanya tampilkan yang BELUM punya kelas
  const santriBelumDapatKelas = santriList?.filter(s => 
    !riwayatAda?.some((r: any) => r.santri_id === s.id)
  ).map((s: any) => {
    // Ratakan objek hasil tes (karena bisa array/null tergantung query)
    const hasil = Array.isArray(s.hasil_tes_klasifikasi) ? s.hasil_tes_klasifikasi[0] : s.hasil_tes_klasifikasi
    return {
      ...s,
      rekomendasi: hasil ? `${hasil.rekomendasi_marhalah} (${hasil.catatan_grade})` : null
    }
  }) || []

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Penempatan Kelas Santri</h1>
        <p className="text-gray-500 text-sm">Realisasi hasil tes klasifikasi ke dalam kelas yang sebenarnya.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
          <FileText className="w-5 h-5" />
          <div className="text-sm">
            <p className="font-semibold">Menampilkan {santriBelumDapatKelas.length} Santri Belum Dapat Kelas</p>
            <p>Gunakan label rekomendasi (berwarna) sebagai acuan untuk memilih kelas tujuan.</p>
          </div>
        </div>

        {/* Form Client Component */}
        <FormAturKelas 
          kelasList={kelasList || []} 
          santriList={santriBelumDapatKelas} 
        />
      </div>
    </div>
  )
}