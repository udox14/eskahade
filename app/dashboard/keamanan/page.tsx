import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, AlertTriangle, Trash2, Search, ChevronDown } from 'lucide-react'
import { getDaftarPelanggaran, hapusPelanggaran } from './actions'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export default async function KeamananPage() {
  const pelanggaranList = await getDaftarPelanggaran()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Disiplin & Keamanan</h1>
          <p className="text-gray-500 text-sm">Catatan pelanggaran santri dan poin kedisiplinan.</p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/dashboard/keamanan/perizinan" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
          >
            Perizinan Santri
          </Link>
          <Link 
            href="/dashboard/keamanan/input" 
            className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Catat Pelanggaran
          </Link>
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-gray-700">Riwayat Pelanggaran Terbaru</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 border-b">
              <tr>
                <th className="px-6 py-3">Tanggal</th>
                <th className="px-6 py-3">Nama Santri</th>
                <th className="px-6 py-3">Jenis</th>
                <th className="px-6 py-3 w-1/3">Deskripsi</th>
                <th className="px-6 py-3 text-center">Poin</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pelanggaranList.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    Belum ada data pelanggaran tercatat.
                  </td>
                </tr>
              )}

              {pelanggaranList.map((p: any) => {
                // Parsing Deskripsi: Cek apakah ada separator "Detail:"
                // Format: "Judul.... \nDetail: Isi detail..."
                // Kita split berdasarkan '\nDetail:' atau '\n' saja jika format lama
                const hasDetail = p.deskripsi.includes('Detail:')
                const [judul, detail] = hasDetail 
                  ? p.deskripsi.split(/\\n?Detail:/) // Regex untuk menangkap \nDetail: atau Detail:
                  : [p.deskripsi, null]

                return (
                  <tr key={p.id} className="hover:bg-gray-50 group align-top">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500">
                      {format(new Date(p.tanggal), 'dd MMMM yyyy', { locale: id })}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {p.santri?.nama_lengkap}
                      <div className="text-xs text-gray-400 font-normal">{p.santri?.nis}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        p.jenis === 'BERAT' ? 'bg-red-100 text-red-700' :
                        p.jenis === 'SEDANG' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.jenis.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {detail ? (
                        <details className="group/details cursor-pointer">
                          <summary className="list-none font-medium flex items-center gap-1 text-slate-700 hover:text-blue-600">
                            <span>{judul}</span>
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 group-open/details:bg-blue-100 group-open/details:text-blue-700">
                              Lihat Detail
                            </span>
                          </summary>
                          <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-200 text-slate-500 leading-relaxed animate-in slide-in-from-top-1">
                            {detail}
                          </div>
                        </details>
                      ) : (
                        <span>{p.deskripsi}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-red-600">
                      +{p.poin}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={async () => {
                        'use server'
                        await hapusPelanggaran(p.id)
                      }}>
                        <button className="text-gray-300 hover:text-red-600 transition-colors" title="Hapus Data">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}