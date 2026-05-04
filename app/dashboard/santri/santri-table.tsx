import { query, queryOne } from '@/lib/db'
import Link from 'next/link'
import { Pencil, ChevronRight, Users, Home, BookOpen } from 'lucide-react'
import { PaginationControls } from './santri-client'

interface Props {
  page: number
  limit: number
  q: string
  asrama: string
  kamar: string
  sekolah: string
  kelasSekolah: string
  marhalah: string
  kelasPesantren: string
  status: string
  jenisKelamin: string
  golDarah: string
  tahunMasuk: string
  provinsi: string
  kabKota: string
  kecamatan: string
  jemaah: string
  alamat: string
  userAsrama: string | null
  canUpdate: boolean
}

export async function SantriTable({
  page, limit, q, asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren,
  status, jenisKelamin, golDarah, tahunMasuk, provinsi, kabKota, kecamatan, jemaah, alamat,
  userAsrama,
  canUpdate
}: Props) {
  const offset = (page - 1) * limit

  let whereClauses: string[] = []
  const params: any[] = []

  let joinClause = "LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif' LEFT JOIN kelas k ON k.id = rp.kelas_id"
  if (kelasPesantren) {
    whereClauses.push('rp.kelas_id = ?')
    params.push(kelasPesantren)
  } else if (marhalah) {
    whereClauses.push('k.marhalah_id = ?')
    params.push(marhalah)
  }

  if (status && status !== 'all') { whereClauses.push('s.status_global = ?'); params.push(status) }
  if (q)             { whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (asrama)        { whereClauses.push('s.asrama = ?');           params.push(asrama) }
  if (kamar)         { whereClauses.push('s.kamar = ?');            params.push(kamar) }
  if (sekolah)       { whereClauses.push('s.sekolah = ?');          params.push(sekolah) }
  if (kelasSekolah)  { whereClauses.push('s.kelas_sekolah = ?');    params.push(kelasSekolah) }
  if (jenisKelamin)  { whereClauses.push('s.jenis_kelamin = ?');    params.push(jenisKelamin) }
  if (golDarah)      { whereClauses.push('s.gol_darah = ?');        params.push(golDarah) }
  if (tahunMasuk)    { whereClauses.push("COALESCE(s.tahun_masuk, CAST(SUBSTR(NULLIF(s.tanggal_masuk, ''), 1, 4) AS INTEGER)) = ?"); params.push(Number(tahunMasuk)) }
  if (provinsi)      { whereClauses.push('s.provinsi = ?');         params.push(provinsi) }
  if (kabKota)       { whereClauses.push('s.kab_kota = ?');         params.push(kabKota) }
  if (kecamatan)     { whereClauses.push('s.kecamatan = ?');        params.push(kecamatan) }
  if (jemaah)        { whereClauses.push('s.jemaah = ?');           params.push(jemaah) }
  if (alamat)        {
    whereClauses.push('(s.alamat LIKE ? OR s.alamat_lengkap LIKE ?)')
    params.push(`%${alamat}%`, `%${alamat}%`)
  }

  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const [countRow, santriList] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri s ${joinClause} ${whereStr}`, params
    ),
    query<any>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.status_global,
              k.nama_kelas AS kelas_pesantren
       FROM santri s ${joinClause} ${whereStr}
       ORDER BY s.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ])

  const count = countRow?.total || 0

  if (santriList.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Data tidak ditemukan</p>
        <p className="text-gray-400 text-sm mt-1">Coba ubah kata kunci atau filter</p>
      </div>
    )
  }

  return (
    <>
      {/* Counter */}
      <p className="text-xs text-gray-500 px-1">{count} santri ditemukan</p>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-2">
        {santriList.map((santri: any) => (
          <div key={santri.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{santri.nama_lengkap}</p>
                <p className="text-xs text-gray-400 mt-0.5">{santri.kelas_pesantren || '-'}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                santri.status_global === 'aktif' ? 'bg-green-100 text-green-700'
                : santri.status_global === 'nonaktif_sementara' ? 'bg-amber-100 text-amber-700'
                : santri.status_global === 'lulus' ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {santri.status_global === 'nonaktif_sementara' ? 'NONAKTIF SEMENTARA' : santri.status_global?.toUpperCase()}
              </span>
            </div>
            <div className="mt-3 flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Home className="w-3 h-3 shrink-0" />
                <span className="truncate">{santri.asrama || '-'} · Kmr {santri.kamar || '-'}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <BookOpen className="w-3 h-3" />
                {santri.sekolah || '-'} {santri.kelas_sekolah ? `Kls ${santri.kelas_sekolah}` : ''}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {!userAsrama && canUpdate && (
                <Link
                  href={`/dashboard/santri/${santri.id}/edit`}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </Link>
              )}
              <Link
                href={`/dashboard/santri/${santri.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg transition-colors"
              >
                Detail <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabel */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Nama Lengkap</th>
                <th className="px-5 py-3.5">NIS</th>
                <th className="px-5 py-3.5">Asrama / Kamar</th>
                <th className="px-5 py-3.5">Sekolah</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {santriList.map((santri: any) => (
                <tr key={santri.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{santri.nama_lengkap}</td>
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{santri.nis}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-gray-800 font-medium text-xs">{santri.asrama || '-'}</p>
                    <p className="text-gray-400 text-xs">Kamar {santri.kamar || '-'}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-blue-700 font-medium text-xs">{santri.sekolah || '-'}</p>
                    <p className="text-gray-400 text-xs">{santri.kelas_sekolah ? `Kelas ${santri.kelas_sekolah}` : '-'}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      santri.status_global === 'aktif' ? 'bg-green-100 text-green-700'
                      : santri.status_global === 'nonaktif_sementara' ? 'bg-amber-100 text-amber-700'
                      : santri.status_global === 'lulus' ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {santri.status_global === 'nonaktif_sementara' ? 'NONAKTIF SEMENTARA' : santri.status_global?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!userAsrama && canUpdate && (
                        <Link
                          href={`/dashboard/santri/${santri.id}/edit`}
                          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/santri/${santri.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors"
                      >
                        Detail <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {count > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <PaginationControls total={count} limit={limit} page={page} />
        </div>
      )}
    </>
  )
}
