import { Suspense } from 'react'
import { guardPage } from '@/lib/auth/guard'
import { query, queryOne } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { Plus, Home, Users } from 'lucide-react'
import { SearchInput, LimitSelector, PaginationControls, SantriFilter } from './santri-client'
import { TableSkeleton, CardListSkeleton } from '@/components/ui/skeletons'
import { SantriTable } from './santri-table'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function SantriPage(props: { searchParams: SearchParams }) {
  await guardPage('/dashboard/santri')
  const searchParams = await props.searchParams
  const session = await getSession()

  let userAsrama: string | null = null
  if (session?.role === 'pengurus_asrama') {
    userAsrama = session.asrama_binaan ?? null
  }

  // Data filter (dari cache — ringan, tidak blocking)
  const [marhalahList, kelasRaw] = await Promise.all([
    getCachedMarhalahList(),
    query<any>('SELECT id, nama_kelas, marhalah_id FROM kelas', [])
  ])
  const kelasList = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

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

  // Key untuk Suspense — kalau searchParams berubah, skeleton tampil lagi
  const dataKey = JSON.stringify({ page, limit, q, asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren })

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-700" />
            Data Santri
            {userAsrama && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full border border-orange-200 font-medium">
                <Home className="w-3 h-3 inline mr-1" />{userAsrama}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">Data induk santri Pesantren Sukahideng</p>
        </div>
        {!userAsrama && (
          <Link
            href="/dashboard/santri/input"
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm text-sm font-semibold w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Tambah Santri
          </Link>
        )}
      </div>

      {/* Filter bar — tampil langsung, tidak perlu data */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex gap-2 items-center">
          <div className="flex-1"><SearchInput /></div>
          <SantriFilter marhalahList={marhalahList} kelasList={kelasList} />
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
          userAsrama={userAsrama}
        />
      </Suspense>
    </div>
  )
}
