import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedAbsensiGuruMonitoring } from '@/lib/pimpinan/cache'
import { monthPeriod, pct } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
  FilterBar,
  DateRangeFilter,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function PimpinanAbsensiGuruPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/absensi-guru')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const period = monthPeriod()
  const from = params.from && DATE_RE.test(params.from) ? params.from : period.from
  const to = params.to && DATE_RE.test(params.to) ? params.to : period.to
  const data = await getCachedAbsensiGuruMonitoring(scope, from, to)

  const totalSesi = data.total.hadir + data.total.badal + data.total.kosong
  const totalTerisi = data.total.hadir + data.total.badal

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Absensi Guru"
        description={`Rekap kehadiran guru ${data.from} s.d. ${data.to}. Data bersifat baca saja.`}
      />

      <GuruFilter from={data.from} to={data.to} />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Guru" value={data.totalGuru} sub="data guru terdaftar" />
          <KpiCard
            label="Kehadiran Terisi"
            value={`${pct(totalTerisi, totalSesi)}%`}
            tone={pct(totalTerisi, totalSesi) >= 90 ? 'good' : pct(totalTerisi, totalSesi) >= 75 ? 'warn' : 'bad'}
            sub="hadir + badal"
          />
          <KpiCard
            label="Kosong / Alfa"
            value={data.total.kosong}
            tone={data.total.kosong > 0 ? 'warn' : 'good'}
            sub="sesi tidak terisi"
          />
          <KpiCard label="Badal" value={data.total.badal} sub="sesi diisi pengganti" />
        </div>

        <SectionCard title="Kinerja Kehadiran per Guru" subtitle="Diurutkan dari performa terendah.">
          <DataTable
            columns={[
              { label: 'Guru' },
              { label: 'Hadir', align: 'right' },
              { label: 'Badal', align: 'right' },
              { label: 'Kosong', align: 'right' },
              { label: 'Wajib', align: 'right' },
              { label: 'Performa', align: 'right' },
            ]}
            empty={data.breakdown.length === 0}
          >
            {data.breakdown.map(row => (
              <tr key={row.nama} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-800">{row.nama}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{row.hadir}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-700">{row.badal}</td>
                <td className="px-4 py-3 text-right font-bold text-red-700">{row.kosong}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600">{row.total}</td>
                <td className="px-4 py-3 text-right">
                  <Badge tone={row.persentase >= 90 ? 'good' : row.persentase >= 75 ? 'warn' : 'bad'}>
                    {row.persentase}%
                  </Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </div>
  )
}

function GuruFilter({ from, to }: { from: string; to: string }) {
  return (
    <FilterBar>
      <DateRangeFilter from={from} to={to} />
    </FilterBar>
  )
}
