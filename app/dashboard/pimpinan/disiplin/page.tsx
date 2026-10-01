import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedDisiplinMonitoring } from '@/lib/pimpinan/cache'
import { labelBulan } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
  MonthPeriodFilter,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanDisiplinPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/disiplin')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedDisiplinMonitoring(scope, params.month)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Disiplin Santri"
        description={`Rekap jumlah kejadian ${labelBulan(data.period.month)}. Data bersifat baca saja.`}
      />

      <MonthPeriodFilter month={data.period.month} />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Jumlah Kejadian" value={data.total.total} sub={labelBulan(data.period.month)} />
          <KpiCard label="Santri Terlibat" value={data.total.santri} />
          <KpiCard label="Perlu Verifikasi" value={data.total.pending} sub="histori belum pasti periodenya" tone={data.total.pending > 0 ? 'warn' : 'good'} />
          <KpiCard label="Jenis Surat Perjanjian" value={data.suratPerjanjian.reduce((sum, row) => sum + row.total, 0)} sub="surat terbit" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Pelanggaran per Asrama" subtitle="Jumlah kejadian terkonfirmasi dan santri.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Pelanggaran', align: 'right' },
                { label: 'Santri', align: 'right' },
              ]}
              empty={data.perAsrama.length === 0}
            >
              {data.perAsrama.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-black text-red-700">{row.total}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>

          <SectionCard title="Jenis Pelanggaran Terbanyak" subtitle="15 jenis pelanggaran paling sering.">
            <DataTable
              columns={[
                { label: 'Jenis' },
                { label: 'Jumlah', align: 'right' },
              ]}
              empty={data.perJenis.length === 0}
            >
              {data.perJenis.map(row => (
                <tr key={row.jenis} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.jenis}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">{row.total}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </div>

        <SectionCard title="Surat Perjanjian per Level" subtitle="Distribusi surat perjanjian yang terbit.">
          <DataTable
            columns={[
              { label: 'Level' },
              { label: 'Jumlah', align: 'right' },
            ]}
            empty={data.suratPerjanjian.length === 0}
          >
            {data.suratPerjanjian.map(row => (
              <tr key={row.level} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Badge tone={row.level === 'SP3' || row.level === 'SK' ? 'bad' : row.level === 'SP2' ? 'warn' : 'default'}>
                    {row.level}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{row.total}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </div>
  )
}
