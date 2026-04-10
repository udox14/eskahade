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

    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">
      {/* Header Hero */}
      <div className="relative bg-indigo-950 border border-indigo-900/50 text-indigo-50 px-5 pt-5 pb-6 rounded-[2rem] shadow-xl shadow-indigo-900/10 overflow-hidden mb-2">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <h1 className="text-xl font-black flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-indigo-400"/> Penempatan Kelas
        </h1>
        <p className="text-indigo-200/70 text-xs font-medium">Realisasi hasil tes klasifikasi ke dalam kelas yang sebenarnya.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm p-5 md:p-6">
        <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
          <FileText className="w-5 h-5" />
          <div className="text-xs">
            <p className="font-black uppercase tracking-widest mb-0.5">Menampilkan {santriBelumDapatKelas.length} Santri Belum Dapat Kelas</p>
            <p className="opacity-80 font-medium">Gunakan label rekomendasi sebagai acuan untuk memilih kelas tujuan yang sesuai.</p>
          </div>
        </div>
        <FormAturKelas kelasList={kelasList} santriList={santriBelumDapatKelas} />
      </div>
    </div>
}