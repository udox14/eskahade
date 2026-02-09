import { getProfilSantri } from './actions'
import { SantriProfileView } from './profile-view'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

// Definisi tipe params sebagai Promise (Standar Next.js 15)
type Params = Promise<{ id: string }>

export default async function SantriDetailPage(props: { params: Params }) {
  // 1. Await params untuk mendapatkan ID yang valid
  const params = await props.params;
  const id = params.id;

  // 2. Ambil data dasar di server
  const { data: santri, error } = await getProfilSantri(id)

  if (error || !santri) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-red-700 mb-2">Gagal Memuat Data Santri</h2>
          <p className="text-red-600 mb-4">Sistem tidak dapat menemukan data dengan detail berikut:</p>
          
          <div className="bg-white p-3 rounded border border-red-100 text-left text-sm font-mono text-gray-700 mb-6 overflow-auto">
            <p><strong>Requested ID:</strong> {id}</p>
            <p><strong>Database Error:</strong> {error?.message || "Data kosong (Null)"}</p>
            <p><strong>Error Code:</strong> {error?.code || "-"}</p>
          </div>

          <Link 
            href="/dashboard/santri" 
            className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            &larr; Kembali ke Daftar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/santri" 
            className="p-2 bg-white border hover:bg-gray-50 rounded-full transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Profil Lengkap Santri</h1>
            <p className="text-slate-500 text-sm">Overview data akademik, disiplin, dan administratif.</p>
          </div>
        </div>

        {/* Tombol Edit Langsung dari Halaman Detail */}
        <Link 
          href={`/dashboard/santri/${santri.id}/edit`}
          className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Edit Data Santri
        </Link>
      </div>

      {/* Komponen Interaktif (Tabs & Data) */}
      <SantriProfileView santri={santri} />
    </div>
  )
}