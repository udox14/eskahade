import { guardPage } from '@/lib/auth/guard'
import { query } from '@/lib/db'
import { FileText } from 'lucide-react'
import { FormAturKelas } from './form-atur-kelas'

export const dynamic = 'force-dynamic'

export default async function AturKelasPage() {
  await guardPage('/dashboard/santri/atur-kelas')
  const kelasRaw = await query<any>(
    'SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama FROM kelas k LEFT JOIN marhalah m ON m.id = k.marhalah_id', []
  )
  const kelasList = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  const santriRaw = await query<any>(`
    SELECT s.id, s.nis, s.nama_lengkap,
           htk.rekomendasi_marhalah, htk.catatan_grade
    FROM santri s
    LEFT JOIN hasil_tes_klasifikasi htk ON htk.santri_id = s.id
    WHERE s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
    LIMIT 1000
  `, [])

  const riwayatAda = await query<{ santri_id: string }>(
    "SELECT santri_id FROM riwayat_pendidikan WHERE status_riwayat = 'aktif'", []
  )
  const sudahAdaKelas = new Set(riwayatAda.map(r => r.santri_id))

  const santriBelumDapatKelas = santriRaw
    .filter((s: any) => !sudahAdaKelas.has(s.id))
    .map((s: any) => ({
      ...s,
      rekomendasi: s.rekomendasi_marhalah
        ? `${s.rekomendasi_marhalah} (${s.catatan_grade})`
        : null,
    }))

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
        <FormAturKelas kelasList={kelasList} santriList={santriBelumDapatKelas} />
      </div>
    </div>
  )
}