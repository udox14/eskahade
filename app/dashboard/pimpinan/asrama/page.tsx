import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedAsramaMonitoring } from '@/lib/pimpinan/cache'
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

export default async function PimpinanAsramaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/asrama')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedAsramaMonitoring(scope, params.month)

  const totalSantri = data.perAsrama.reduce((sum, row) => sum + row.total_santri, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Asrama & Perizinan"
        description={`Kondisi asrama dan perizinan ${labelBulan(data.period.month)}. Data bersifat baca saja.`}
      />

      <MonthPeriodFilter month={data.period.month} />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Santri Aktif" value={totalSantri} sub="seluruh asrama" />
          <KpiCard
            label="Izin Belum Kembali"
            value={data.perizinan.aktif}
            tone={data.perizinan.aktif > 0 ? 'warn' : 'good'}
            sub="masih berjalan"
          />
          <KpiCard label="Izin Bulan Ini" value={data.perizinan.total} sub={labelBulan(data.period.month)} />
          <KpiCard
            label="Telat Kembali"
            value={data.perizinan.telat}
            tone={data.perizinan.telat > 0 ? 'bad' : 'good'}
            sub="terlambat dari rencana"
          />
        </div>

        <SectionCard title="Kondisi per Asrama" subtitle="Santri, kamar terisi, izin, dan status perpulangan.">
          <DataTable
            columns={[
              { label: 'Asrama' },
              { label: 'Santri', align: 'right' },
              { label: 'Kamar Terisi', align: 'right' },
              { label: 'Izin Bulan Ini', align: 'right' },
              { label: 'Belum Kembali', align: 'right' },
              { label: 'Perpulangan', align: 'right' },
            ]}
            empty={data.perAsrama.length === 0}
          >
            {data.perAsrama.map(row => (
              <tr key={row.asrama} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{row.total_santri}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600">{row.kamar_terisi}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600">{row.izin_bulan}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-700">{row.izin_aktif}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600">
                  {row.sudah_datang} / {row.total_perpulangan}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Perizinan" subtitle="Rekap izin pulang santri.">
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Izin Pulang" value={data.perizinan.pulang} />
              <KpiCard label="Tepat Waktu" value={data.perizinan.tepat} tone="good" />
              <KpiCard label="Telat Kembali" value={data.perizinan.telat} tone={data.perizinan.telat > 0 ? 'bad' : 'good'} />
            </div>
          </SectionCard>

          <SectionCard title="Perpulangan Periode Terakhir" subtitle="Progres izin pulang periode berjalan.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Sudah Pulang', align: 'right' },
                { label: 'Sudah Datang', align: 'right' },
              ]}
              empty={data.perpulangan.length === 0}
            >
              {data.perpulangan.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{row.sudah_pulang} / {row.total}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={row.sudah_datang >= row.total ? 'good' : 'warn'}>
                      {row.sudah_datang} / {row.total}
                    </Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
