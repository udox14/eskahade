import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { Plus, Pencil, Home } from 'lucide-react'
import { SearchInput, LimitSelector, PaginationControls, SantriFilter } from './santri-client'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function SantriPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams
  const session = await getSession()

  let userAsrama: string | null = null
  if (session?.role === 'pengurus_asrama') {
    userAsrama = session.asrama_binaan ?? null
  }

  const marhalahList = await query<any>('SELECT id, nama FROM marhalah ORDER BY urutan', [])
  const kelasRaw = await query<any>('SELECT id, nama_kelas, marhalah_id FROM kelas', [])
  const kelasList = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  const page = Number(searchParams.page) || 1
  const limit = Number(searchParams.limit) || 10
  const q = (searchParams.q as string) || ''
  const asrama = userAsrama || (searchParams.asrama as string) || ''
  const kamar = (searchParams.kamar as string) || ''
  const sekolah = (searchParams.sekolah as string) || ''
  const kelasSekolah = (searchParams.kelas_sekolah as string) || ''
  const marhalah = (searchParams.marhalah as string) || ''
  const kelasPesantren = (searchParams.kelas as string) || ''
  const offset = (page - 1) * limit

  let whereClauses: string[] = ["s.status_global = 'aktif'"]
  const params: any[] = []

  // Join untuk filter marhalah / kelas pesantren
  let joinClause = ''
  if (kelasPesantren) {
    joinClause = "JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'"
    whereClauses.push('rp.kelas_id = ?')
    params.push(kelasPesantren)
  } else if (marhalah) {
    joinClause = "JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif' JOIN kelas k ON k.id = rp.kelas_id"
    whereClauses.push('k.marhalah_id = ?')
    params.push(marhalah)
  }

  if (q) { whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (asrama) { whereClauses.push('s.asrama = ?'); params.push(asrama) }
  if (kamar) { whereClauses.push('s.kamar = ?'); params.push(kamar) }
  if (sekolah) { whereClauses.push('s.sekolah = ?'); params.push(sekolah) }
  if (kelasSekolah) { whereClauses.push('s.kelas_sekolah LIKE ?'); params.push(`%${kelasSekolah}%`) }

  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s ${joinClause} ${whereStr}`, params
  )
  const count = countRow?.total || 0

  const santriList = await query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.status_global
     FROM santri s ${joinClause} ${whereStr}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Data Santri
            {userAsrama && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full border border-orange-200">
                <Home className="w-3 h-3 inline mr-1"/>Asrama: {userAsrama}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm">Kelola data induk santri Pesantren Sukahideng</p>
        </div>
        {!userAsrama && (
          <Link href="/dashboard/santri/input" className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /><span>Tambah Santri Baru</span>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-1/3"><SearchInput /></div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <SantriFilter marhalahList={marhalahList} kelasList={kelasList} />
            <LimitSelector />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">NIS</th>
                <th className="px-6 py-4">Asrama / Kamar</th>
                <th className="px-6 py-4">Sekolah Formal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {santriList.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400"><p>Data tidak ditemukan.</p></td></tr>
              ) : (
                santriList.map((santri: any) => (
                  <tr key={santri.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{santri.nama_lengkap}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono">{santri.nis}</td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">{santri.asrama || '-'}</div>
                      <div className="text-xs text-gray-500">Kamar {santri.kamar || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-blue-700 font-medium">{santri.sekolah || '-'}</div>
                      <div className="text-xs text-gray-500">{santri.kelas_sekolah || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${santri.status_global === 'aktif' ? 'bg-green-100 text-green-700' : santri.status_global === 'lulus' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {santri.status_global?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!userAsrama && (
                        <Link href={`/dashboard/santri/${santri.id}/edit`} className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-md font-medium text-xs transition-colors">
                          <Pencil className="w-3 h-3" /> Edit
                        </Link>
                      )}
                      <Link href={`/dashboard/santri/${santri.id}`} className="inline-block text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium text-xs transition-colors">
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <PaginationControls total={count} limit={limit} page={page} />
        </div>
      </div>
    </div>
  )
}