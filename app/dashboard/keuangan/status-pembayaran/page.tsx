import { guardPage, guardRole } from '@/lib/auth/guard'
import {
  getStatusPembayaranData,
  getStatusPembayaranFilterOptions,
  type TabType,
} from './actions'
import StatusPembayaranContent from './_page-content'

export const dynamic = 'force-dynamic'

const VALID_TABS: readonly TabType[] = ['RINGKASAN', 'BULANAN', 'TAHUNAN', 'USPP', 'TUNGGAKAN']

function parseInitialTab(rawTab?: string): TabType {
  if (!rawTab) return 'RINGKASAN'
  const upper = rawTab.toUpperCase() as TabType
  return VALID_TABS.includes(upper) ? upper : 'RINGKASAN'
}

export default async function StatusPembayaranPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  // 1. Otorisasi rute untuk admin, bendahara, dan pimpinan
  try {
    await guardPage('/dashboard/keuangan/status-pembayaran')
  } catch {
    await guardRole(['admin', 'bendahara', 'pimpinan'])
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialTab = parseInitialTab(resolvedSearchParams?.tab)

  // 2. Ambil opsi filter awal dan dataset default secara paralel
  const [filterOptions, initialData] = await Promise.all([
    getStatusPembayaranFilterOptions(),
    getStatusPembayaranData({
      tab: initialTab,
      period: initialTab === 'TUNGGAKAN' ? 'ALL' : undefined,
      pageSize: 50,
      page: 1,
    }),
  ])

  return (
    <StatusPembayaranContent
      initialData={initialData}
      filterOptions={filterOptions}
    />
  )
}
