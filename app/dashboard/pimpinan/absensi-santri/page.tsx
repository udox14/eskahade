import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedAbsensiSantriMonitoring } from '@/lib/pimpinan/cache'
import { getAsramaOptions, labelBulan, pct } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
  MonthSelect,
  AsramaSelect,
  FilterBar,
  usePageNav,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanAbsensiSantriPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; asrama?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/absensi-santri')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const asramaOptions = await getAsramaOptions()
  const data = await getCachedAbsensiSantriMonitoring(scope, params.month, params.asrama)

  const totalPengajianAlfa = data.pengajian.reduce((sum, row) => sum + row.alfa, 0)
  const totalBerjamaahAlfa = data.berjamaah.reduce((sum, row) => sum + row.alfa, 0)
  const totalMalamAlfa = data.malam.reduce((sum, row) => sum + row.alfa, 0)
  const hadirPengajian = Math.max(data.totalWajibSesi - totalPengajianAlfa, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Absensi Santri"
        description={`Rekap absensi santri ${labelBulan(data.period.month)}. Data bersifat baca saja.`}
        actions={<PrintButton />}
      />

      <AbsensiSantriFilter
        month={data.period.month}
        asrama={params.asrama || ''}
        asramaOptions={asramaOptions}
      />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Sesi Wajib" value={data.totalWajibSesi} sub={`${labelBulan(data.period.month)}`} />
          <KpiCard
            label="Kehadiran Pengajian"
            value={`${pct(hadirPengajian, data.totalWajibSesi)}%`}
            tone={pct(hadirPengajian, data.totalWajibSesi) >= 90 ? 'good' : pct(hadirPengajian, data.totalWajibSesi) >= 75 ? 'warn' : 'bad'}
          />
          <KpiCard
            label="Alfa Berjamaah"
            value={totalBerjamaahAlfa}
            tone={totalBerjamaahAlfa > 0 ? 'warn' : 'good'}
            sub="catatan alfa shalat"
          />
          <KpiCard
            label="Alfa Malam"
            value={totalMalamAlfa}
            tone={totalMalamAlfa > 0 ? 'warn' : 'good'}
            sub="absen malam"
          />
        </div>

        <SectionCard title="Alfa Pengajian per Asrama" subtitle="Jumlah sesi alfa, izin, dan sakit.">
          <DataTable
            columns={[
              { label: 'Asrama' },
              { label: 'Alfa', align: 'right' },
              { label: 'Izin', align: 'right' },
              { label: 'Sakit', align: 'right' },
              { label: 'Santri Alfa', align: 'right' },
            ]}
            empty={data.pengajian.length === 0}
          >
            {data.pengajian.map(row => (
              <tr key={row.asrama} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                <td className="px-4 py-3 text-right font-black text-red-700">{row.alfa}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-700">{row.izin}</td>
                <td className="px-4 py-3 text-right font-bold text-sky-700">{row.sakit}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri_alfa}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Alfa Berjamaah per Asrama" subtitle="Jumlah catatan alfa shalat berjamaah.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Alfa', align: 'right' },
                { label: 'Santri', align: 'right' },
              ]}
              empty={data.berjamaah.length === 0}
            >
              {data.berjamaah.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-black text-red-700">{row.alfa}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>

          <SectionCard title="Alfa Absen Malam per Asrama" subtitle="Jumlah catatan alfa apel malam.">
            <DataTable
              columns={[
                { label: 'Asrama' },
                { label: 'Alfa', align: 'right' },
                { label: 'Santri', align: 'right' },
              ]}
              empty={data.malam.length === 0}
            >
              {data.malam.map(row => (
                <tr key={row.asrama} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.asrama}</td>
                  <td className="px-4 py-3 text-right font-black text-red-700">{row.alfa}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </div>

        <SectionCard title="Santri dengan Alfa Terbanyak" subtitle="30 santri dengan catatan alfa pengajian tertinggi.">
          <DataTable
            columns={[
              { label: 'Nama' },
              { label: 'NIS' },
              { label: 'Asrama / Kamar' },
              { label: 'Alfa', align: 'right' },
            ]}
            empty={data.topAlfa.length === 0}
          >
            {data.topAlfa.map(row => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-800">{row.nama_lengkap}</td>
                <td className="px-4 py-3 text-slate-500">{row.nis || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{row.asrama || '-'} · {row.kamar || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <Badge tone={row.alfa > 5 ? 'bad' : 'warn'}>{row.alfa} sesi</Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </div>
  )
}

function AbsensiSantriFilter({
  month,
  asrama,
  asramaOptions,
}: {
  month: string
  asrama: string
  asramaOptions: string[]
}) {
  const navigate = usePageNav()
  return (
    <FilterBar>
      <MonthSelect value={month} onChange={value => navigate({ month: value, asrama })} />
      <AsramaSelect value={asrama} onChange={value => navigate({ month, asrama: value })} options={asramaOptions} />
    </FilterBar>
  )
}
