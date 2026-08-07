import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedKesehatanMonitoring } from '@/lib/pimpinan/cache'
import { labelBulan } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  MonthSelect,
  FilterBar,
  usePageNav,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanKesehatanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/kesehatan')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedKesehatanMonitoring(scope, params.month)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Kesehatan & Sakit"
        description={`Data sakit santri dan kunjungan POSKESTREN ${labelBulan(data.period.month)}. Data bersifat baca saja.`}
        actions={<PrintButton />}
      />

      <KesehatanFilter month={data.period.month} />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Sakit Hari Ini"
            value={data.totalSakitHariIni}
            tone={data.totalSakitHariIni > 0 ? 'warn' : 'good'}
            sub="episode sakit aktif"
          />
          <KpiCard
            label="Catatan Sakit Bulan Ini"
            value={data.totalSakitBulan}
            sub={labelBulan(data.period.month)}
          />
          <KpiCard label="Kunjungan POSKESTREN" value={data.poskestren.kunjungan} sub="bulan berjalan" />
          <KpiCard label="Pasien Rujukan" value={data.poskestren.dirujuk} sub="dirujuk keluar" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Sakit Aktif Hari Ini per Asrama" subtitle="Episode sakit yang masih berjalan.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Santri Sakit', align: 'right' },
              ]}
              empty={data.sakitHariIni.length === 0}
              emptyText="Tidak ada santri sakit aktif hari ini."
            >
              {data.sakitHariIni.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-black text-red-700">{row.aktif}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>

          <SectionCard title="Rekap Sakit Bulan Ini per Asrama" subtitle="Total catatan sakit dan surat sakit.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Catatan', align: 'right' },
                { label: 'Santri', align: 'right' },
                { label: 'Surat', align: 'right' },
              ]}
              empty={data.sakitBulan.length === 0}
            >
              {data.sakitBulan.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-black text-red-700">{row.total}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-600">{row.beli_surat}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </div>

        <SectionCard title="Kunjungan POSKESTREN" subtitle="Ringkasan layanan kesehatan santri.">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Kunjungan" value={data.poskestren.kunjungan} />
            <KpiCard label="Pasien Unik" value={data.poskestren.pasien} />
            <KpiCard label="Dirujuk" value={data.poskestren.dirujuk} tone={data.poskestren.dirujuk > 0 ? 'warn' : 'good'} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function KesehatanFilter({ month }: { month: string }) {
  const navigate = usePageNav()
  return (
    <FilterBar>
      <MonthSelect value={month} onChange={value => navigate({ month: value })} />
    </FilterBar>
  )
}
