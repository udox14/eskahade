import { query, queryOne } from '@/lib/db'
import Link from 'next/link'
import { PencilSimple, CaretRight, Users, House, BookOpen } from '@phosphor-icons/react/dist/ssr'
import { PaginationControls, SantriActionMenu } from './santri-client'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'

interface Props {
  page: number
  limit: number
  q: string
  asrama: string
  kamar: string
  sekolah: string
  kelasSekolah: string
  kategoriSantri: string
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
  isPengurusAsrama: boolean
  kelasIds: string[] | null
  canUpdate: boolean
}

interface SantriRow {
  id: number
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  kategori_santri: string | null
  foto_url: string | null
  kategori_efektif: string | null
  status_global: string | null
  kelas_pesantren: string | null
}

function getStatusBadge(status: string | null) {
  const s = status || 'aktif'
  if (s === 'aktif') {
    return {
      label: 'Aktif',
      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    }
  }
  if (s === 'nonaktif_sementara') {
    return {
      label: 'Nonaktif',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    }
  }
  if (s === 'lulus') {
    return {
      label: 'Lulus',
      className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
    }
  }
  if (s === 'keluar') {
    return {
      label: 'Keluar',
      className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    }
  }
  return {
    label: s.toUpperCase(),
    className: 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20',
  }
}

export async function SantriTable({
  page,
  limit,
  q,
  asrama,
  kamar,
  sekolah,
  kelasSekolah,
  kategoriSantri,
  marhalah,
  kelasPesantren,
  status,
  jenisKelamin,
  golDarah,
  tahunMasuk,
  provinsi,
  kabKota,
  kecamatan,
  jemaah,
  alamat,
  userAsrama,
  isPengurusAsrama,
  kelasIds,
  canUpdate,
}: Props) {
  const offset = (page - 1) * limit
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')

  const whereClauses: string[] = []
  const params: (string | number)[] = []

  // Guru/wali_kelas: hanya santri dari kelas yang ia ajar (read-only)
  const isScopedGuru = kelasIds !== null
  if (isScopedGuru) {
    if (kelasIds.length === 0) {
      whereClauses.push('1 = 0')
    } else {
      const ph = kelasIds.map(() => '?').join(',')
      whereClauses.push(
        `s.id IN (SELECT rp2.santri_id FROM riwayat_pendidikan rp2 WHERE rp2.kelas_id IN (${ph}) AND lower(trim(COALESCE(rp2.status_riwayat, 'aktif'))) IN ('aktif', 'active', ''))`
      )
      params.push(...kelasIds)
    }
  }

  const joinClause =
    "LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif' LEFT JOIN kelas k ON k.id = rp.kelas_id"
  if (kelasPesantren) {
    whereClauses.push('rp.kelas_id = ?')
    params.push(kelasPesantren)
  } else if (marhalah) {
    whereClauses.push('k.marhalah_id = ?')
    params.push(marhalah)
  }

  if (status && status !== 'all') {
    whereClauses.push('s.status_global = ?')
    params.push(status)
  }
  if (q) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (asrama) {
    whereClauses.push('s.asrama = ?')
    params.push(asrama)
  }
  if (kamar) {
    whereClauses.push('s.kamar = ?')
    params.push(kamar)
  }
  if (kategoriSantri) {
    whereClauses.push(`${kategoriEfektifSql} = ?`)
    params.push(kategoriSantri)
  }
  if (sekolah) {
    whereClauses.push('s.sekolah = ?')
    params.push(sekolah)
  }
  if (kelasSekolah) {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(kelasSekolah)
  }
  if (jenisKelamin) {
    whereClauses.push('s.jenis_kelamin = ?')
    params.push(jenisKelamin)
  }
  if (golDarah) {
    whereClauses.push('s.gol_darah = ?')
    params.push(golDarah)
  }
  if (tahunMasuk) {
    whereClauses.push(
      "COALESCE(s.tahun_masuk, CAST(SUBSTR(NULLIF(s.tanggal_masuk, ''), 1, 4) AS INTEGER)) = ?"
    )
    params.push(Number(tahunMasuk))
  }
  if (provinsi) {
    whereClauses.push('s.provinsi = ?')
    params.push(provinsi)
  }
  if (kabKota) {
    whereClauses.push('s.kab_kota = ?')
    params.push(kabKota)
  }
  if (kecamatan) {
    whereClauses.push('s.kecamatan = ?')
    params.push(kecamatan)
  }
  if (jemaah) {
    whereClauses.push('s.jemaah = ?')
    params.push(jemaah)
  }
  if (alamat) {
    whereClauses.push('(s.alamat LIKE ? OR s.alamat_lengkap LIKE ?)')
    params.push(`%${alamat}%`, `%${alamat}%`)
  }

  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const [countRow, santriList] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri s ${joinClause} ${whereStr}`,
      params
    ),
    query<SantriRow>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.kategori_santri, s.foto_url, ${kategoriEfektifSql} AS kategori_efektif, s.status_global,
              k.nama_kelas AS kelas_pesantren
       FROM santri s ${joinClause} ${whereStr}
       ORDER BY s.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
  ])

  const count = countRow?.total || 0
  const canViewDetail = (santriAsrama: string | null) =>
    !isPengurusAsrama || Boolean(userAsrama && santriAsrama === userAsrama)

  if (santriList.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-14 px-4 text-center shadow-sm">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" weight="duotone" />
        <p className="text-slate-700 font-semibold text-sm">Santri tidak ditemukan</p>
        <p className="text-slate-400 text-xs mt-1">Coba sesuaikan kata kunci pencarian atau reset filter</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Counter Ringkas */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500 font-medium">
          Ditemukan <span className="font-semibold text-slate-800">{count}</span> santri
        </p>
      </div>

      {/* Mobile: Card list (3-Baris Identitas + 3-Dots Menu) */}
      <div className="md:hidden space-y-2.5">
        {santriList.map((santri) => {
          const statusBadge = getStatusBadge(santri.status_global)
          const isViewable = canViewDetail(santri.asrama)
          const canEdit = !isPengurusAsrama && !isScopedGuru && canUpdate

          const pendidikanStr =
            santri.kategori_santri === 'SADESA'
              ? santri.kelas_pesantren || 'SADESA (Tanpa formal)'
              : [
                  santri.kelas_pesantren,
                  santri.sekolah
                    ? `${santri.sekolah}${santri.kelas_sekolah ? ` Kls ${santri.kelas_sekolah}` : ''}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'

          return (
            <div
              key={santri.id}
              className="relative bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 shadow-sm transition-all"
            >
              {/* Clickable link ke halaman detail menutupi area kartu */}
              {isViewable && (
                <Link
                  href={`/dashboard/santri/${santri.id}`}
                  className="absolute inset-0 z-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  aria-label={`Buka detail ${santri.nama_lengkap}`}
                />
              )}

              {/* Card Container */}
              <div className="relative z-1 pointer-events-none">
                {/* Bagian Atas: Avatar, Identitas, Action Menu */}
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 pt-0.5">
                    <SantriPhotoAvatar
                      src={santri.foto_url}
                      alt={santri.nama_lengkap}
                      name={santri.nama_lengkap}
                      size="md"
                    />
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    {/* Baris 1: Nama Santri + Badges */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm truncate">
                        {santri.nama_lengkap}
                      </h3>
                      {santri.kategori_efektif === 'BARU' && (
                        <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-500/20">
                          BARU
                        </span>
                      )}
                      {santri.kategori_santri === 'SADESA' && (
                        <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 ring-1 ring-inset ring-purple-500/20">
                          SADESA
                        </span>
                      )}
                    </div>

                    {/* Baris 2: Asrama & Kamar */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 truncate">
                      <House className="w-3.5 h-3.5 text-slate-400 shrink-0" weight="duotone" />
                      <span className="truncate">
                        {santri.asrama ? `${santri.asrama} · Kmr ${santri.kamar || '-'}` : 'Non-Asrama'}
                      </span>
                    </div>

                    {/* Baris 3: Pendidikan & Kelas */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" weight="duotone" />
                      <span className="truncate">{pendidikanStr}</span>
                    </div>
                  </div>

                  {/* 3-Dots Action Menu */}
                  {(canEdit || isViewable) && (
                    <div className="pointer-events-auto shrink-0 relative z-10 -mr-1 -mt-1">
                      <SantriActionMenu
                        santriId={santri.id}
                        santriNama={santri.nama_lengkap}
                        canUpdate={canEdit}
                        canViewDetail={isViewable}
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Strip: NIS & Status Badge */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-slate-400">
                    NIS: {santri.nis || '-'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!isViewable && (
                      <span className="text-[10px] text-slate-400 italic">Di luar binaan</span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: Tabel Rapi */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Nama Lengkap</th>
                <th className="px-5 py-3.5">NIS</th>
                <th className="px-5 py-3.5">Asrama / Kamar</th>
                <th className="px-5 py-3.5">Pendidikan</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {santriList.map((santri) => {
                const statusBadge = getStatusBadge(santri.status_global)
                const isViewable = canViewDetail(santri.asrama)
                const canEdit = !isPengurusAsrama && !isScopedGuru && canUpdate

                return (
                  <tr key={santri.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <SantriPhotoAvatar
                          src={santri.foto_url}
                          alt={santri.nama_lengkap}
                          name={santri.nama_lengkap}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate">
                              {santri.nama_lengkap}
                            </span>
                            {santri.kategori_efektif === 'BARU' && (
                              <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-500/20">
                                BARU
                              </span>
                            )}
                            {santri.kategori_santri === 'SADESA' && (
                              <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 ring-1 ring-inset ring-purple-500/20">
                                SADESA
                              </span>
                            )}
                          </div>
                          {santri.kategori_santri === 'SADESA' && (
                            <p className="mt-0.5 text-[10px] font-medium text-purple-600">Santri SADESA</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{santri.nis || '-'}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-800 font-medium text-xs">{santri.asrama || '-'}</p>
                      <p className="text-slate-400 text-xs">Kamar {santri.kamar || '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-800 font-medium text-xs">
                        {santri.kategori_santri === 'SADESA'
                          ? santri.kelas_pesantren || 'SADESA'
                          : santri.kelas_pesantren || santri.sekolah || '-'}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {santri.kategori_santri === 'SADESA'
                          ? 'Tanpa sekolah formal'
                          : santri.sekolah
                            ? `${santri.sekolah}${santri.kelas_sekolah ? ` Kls ${santri.kelas_sekolah}` : ''}`
                            : '-'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <Link
                            href={`/dashboard/santri/${santri.id}/edit`}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors"
                            title="Edit Data Santri"
                          >
                            <PencilSimple className="w-3.5 h-3.5 text-slate-500" weight="bold" /> Edit
                          </Link>
                        )}
                        {isViewable ? (
                          <Link
                            href={`/dashboard/santri/${santri.id}`}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors"
                            title="Lihat Detail Santri"
                          >
                            Detail <CaretRight className="w-3.5 h-3.5" weight="bold" />
                          </Link>
                        ) : (
                          <span
                            className="inline-flex items-center text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg font-medium text-xs"
                            title="Detail hanya tersedia untuk santri asrama binaan Anda"
                          >
                            Di luar binaan
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {count > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <PaginationControls total={count} limit={limit} page={page} />
        </div>
      )}
    </div>
  )
}
