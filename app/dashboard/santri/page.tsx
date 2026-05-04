import { Suspense } from 'react'
import { guardPage } from '@/lib/auth/guard'
import { canCrud } from '@/lib/auth/crud'
import { query } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { getSession, hasRole } from '@/lib/auth/session'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { SearchInput, LimitSelector, SantriFilter } from './santri-client'
import { TableSkeleton, CardListSkeleton } from '@/components/ui/skeletons'
import { SantriTable } from './santri-table'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function SantriPage(props: { searchParams: SearchParams }) {
  await guardPage('/dashboard/santri')
  const searchParams = await props.searchParams
  const session = await getSession()
  const [canCreateSantri, canUpdateSantri] = await Promise.all([
    canCrud('/dashboard/santri', 'create'),
    canCrud('/dashboard/santri', 'update'),
  ])

  let userAsrama: string | null = null
  if (session && hasRole(session, 'pengurus_asrama')) {
    userAsrama = session.asrama_binaan ?? null
  }

  // Data filter (dari cache — ringan, tidak blocking)
  const scopedWhere = userAsrama ? 'WHERE asrama = ?' : ''
  const scopedParams = userAsrama ? [userAsrama] : []
  const appendScopedWhere = (condition: string) => `${scopedWhere ? `${scopedWhere} AND` : 'WHERE'} ${condition}`

  const [
    marhalahList,
    kelasRaw,
    asramaKamarRows,
    sekolahRows,
    kelasSekolahRows,
    statusRows,
    golDarahRows,
    tahunRows,
    provinsiRows,
    kabKotaRows,
    kecamatanRows,
    jemaahRows,
  ] = await Promise.all([
    getCachedMarhalahList(),
    query<any>(`
      SELECT k.id, k.nama_kelas, k.marhalah_id
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    `, []),
    query<{ asrama: string | null; kamar: string | null }>(
      `SELECT DISTINCT asrama, kamar FROM santri ${scopedWhere} ORDER BY asrama, CAST(kamar AS INTEGER), kamar`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT sekolah AS v FROM santri ${appendScopedWhere("sekolah IS NOT NULL AND sekolah <> ''")} ORDER BY sekolah`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT kelas_sekolah AS v FROM santri ${appendScopedWhere("kelas_sekolah IS NOT NULL AND kelas_sekolah <> ''")} ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT status_global AS v FROM santri ${appendScopedWhere("status_global IS NOT NULL AND status_global <> ''")} ORDER BY status_global`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT gol_darah AS v FROM santri ${appendScopedWhere("gol_darah IS NOT NULL AND gol_darah <> ''")} ORDER BY gol_darah`,
      scopedParams
    ),
    query<{ v: number }>(
      `SELECT DISTINCT COALESCE(tahun_masuk, CAST(SUBSTR(NULLIF(tanggal_masuk, ''), 1, 4) AS INTEGER)) AS v
       FROM santri
       ${appendScopedWhere("COALESCE(tahun_masuk, CAST(SUBSTR(NULLIF(tanggal_masuk, ''), 1, 4) AS INTEGER)) IS NOT NULL")}
       ORDER BY v DESC`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT provinsi AS v FROM santri ${appendScopedWhere("provinsi IS NOT NULL AND provinsi <> ''")} ORDER BY provinsi`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT kab_kota AS v FROM santri ${appendScopedWhere("kab_kota IS NOT NULL AND kab_kota <> ''")} ORDER BY kab_kota`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT kecamatan AS v FROM santri ${appendScopedWhere("kecamatan IS NOT NULL AND kecamatan <> ''")} ORDER BY kecamatan`,
      scopedParams
    ),
    query<{ v: string }>(
      `SELECT DISTINCT jemaah AS v FROM santri ${appendScopedWhere("jemaah IS NOT NULL AND jemaah <> ''")} ORDER BY jemaah`,
      scopedParams
    ),
  ])
  const kelasList = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
  const filterOptions = {
    asramaKamar: asramaKamarRows,
    asramaList: [...new Set(asramaKamarRows.map(row => row.asrama).filter((value): value is string => Boolean(value)))],
    sekolahList: sekolahRows.map(row => row.v),
    kelasSekolahList: kelasSekolahRows.map(row => row.v),
    statusList: statusRows.map(row => row.v),
    golDarahList: golDarahRows.map(row => row.v),
    tahunMasukList: tahunRows.map(row => row.v).filter(Boolean),
    provinsiList: provinsiRows.map(row => row.v),
    kabKotaList: kabKotaRows.map(row => row.v),
    kecamatanList: kecamatanRows.map(row => row.v),
    jemaahList: jemaahRows.map(row => row.v),
  }

  const page      = Number(searchParams.page)  || 1
  const rawLimit  = Number(searchParams.limit) || 10
  const limit     = rawLimit === 9999 ? 999999 : rawLimit
  const q             = (searchParams.q             as string) || ''
  const asrama        = userAsrama || (searchParams.asrama        as string) || ''
  const kamar         = (searchParams.kamar         as string) || ''
  const sekolah       = (searchParams.sekolah       as string) || ''
  const kelasSekolah  = (searchParams.kelas_sekolah as string) || ''
  const marhalah      = (searchParams.marhalah      as string) || ''
  const kelasPesantren = (searchParams.kelas        as string) || ''
  const status        = (searchParams.status        as string) || 'aktif'
  const jenisKelamin  = (searchParams.jenis_kelamin as string) || ''
  const golDarah      = (searchParams.gol_darah     as string) || ''
  const tahunMasuk    = (searchParams.tahun_masuk   as string) || ''
  const provinsi      = (searchParams.provinsi      as string) || ''
  const kabKota       = (searchParams.kab_kota      as string) || ''
  const kecamatan     = (searchParams.kecamatan     as string) || ''
  const jemaah        = (searchParams.jemaah        as string) || ''
  const alamat        = (searchParams.alamat        as string) || ''

  // Key untuk Suspense — kalau searchParams berubah, skeleton tampil lagi
  const dataKey = JSON.stringify({
    page, limit, q, asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren,
    status, jenisKelamin, golDarah, tahunMasuk, provinsi, kabKota, kecamatan, jemaah, alamat,
  })

  return (
    <div className="space-y-4 pb-8">
      <DashboardPageHeader
        title="Data Santri"
        description={
          userAsrama
            ? `Data induk santri Pesantren Sukahideng untuk asrama ${userAsrama}.`
            : 'Data induk santri Pesantren Sukahideng.'
        }
        action={
          !userAsrama && canCreateSantri ? (
            <Link
              href="/dashboard/santri/input"
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm text-sm font-semibold w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Tambah Santri
            </Link>
          ) : undefined
        }
      />

      {/* Filter bar — tampil langsung, tidak perlu data */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex gap-2 items-center">
          <div className="flex-1"><SearchInput /></div>
          <SantriFilter
            marhalahList={marhalahList}
            kelasList={kelasList}
            filterOptions={filterOptions}
            userAsrama={userAsrama}
          />
          <LimitSelector />
        </div>
      </div>

      {/* List — di-suspend, tampilkan skeleton sambil fetch */}
      <Suspense
        key={dataKey}
        fallback={
          <>
            <div className="md:hidden"><CardListSkeleton count={limit > 10 ? 10 : limit} /></div>
            <div className="hidden md:block"><TableSkeleton rows={limit > 10 ? 10 : limit} /></div>
          </>
        }
      >
        <SantriTable
          page={page}
          limit={limit}
          q={q}
          asrama={asrama}
          kamar={kamar}
          sekolah={sekolah}
          kelasSekolah={kelasSekolah}
          marhalah={marhalah}
          kelasPesantren={kelasPesantren}
          status={status}
          jenisKelamin={jenisKelamin}
          golDarah={golDarah}
          tahunMasuk={tahunMasuk}
          provinsi={provinsi}
          kabKota={kabKota}
          kecamatan={kecamatan}
          jemaah={jemaah}
          alamat={alamat}
          userAsrama={userAsrama}
          canUpdate={canUpdateSantri}
        />
      </Suspense>
    </div>
  )
}
