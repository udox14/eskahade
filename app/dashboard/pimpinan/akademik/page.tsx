import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedAkademikMonitoring } from '@/lib/pimpinan/cache'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanAkademikPage() {
  const session = await guardPage('/dashboard/pimpinan/akademik')
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedAkademikMonitoring(scope)

  const totalKelas = data.perMarhalah.reduce((sum, row) => sum + row.kelas, 0)
  const totalSantri = data.perMarhalah.reduce((sum, row) => sum + row.santri, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Akademik"
        description="Struktur kelas, nilai rata-rata, dan papan ranking kelas."
        actions={<PrintButton />}
      />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Kelas" value={totalKelas} sub="tahun ajaran aktif" />
          <KpiCard label="Santri Terdaftar" value={totalSantri} />
          <KpiCard label="Marhalah" value={data.perMarhalah.length} />
          <KpiCard
            label="Semester Nilai"
            value={data.semester ?? '-'}
            sub={data.semester == null ? 'belum ada nilai' : 'semester terakhir'}
          />
        </div>

        <SectionCard title="Santri per Marhalah" subtitle="Jumlah kelas dan santri aktif per jenjang.">
          <DataTable
            columns={[
              { label: 'Marhalah' },
              { label: 'Kelas', align: 'right' },
              { label: 'Santri', align: 'right' },
              { label: 'Rata-rata Nilai', align: 'right' },
            ]}
            empty={data.perMarhalah.length === 0}
          >
            {data.perMarhalah.map(row => (
              <tr key={row.marhalah} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{row.marhalah}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{row.kelas}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-700">{row.santri}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600">
                  {row.rata_rata > 0 ? row.rata_rata : '-'}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <SectionCard
          title="Papan Ranking per Kelas"
          subtitle="Tiga besar per kelas berdasarkan semester terakhir."
        >
          <DataTable
            columns={[
              { label: 'Kelas' },
              { label: 'Marhalah' },
              { label: 'Juara 1' },
              { label: 'Juara 2' },
              { label: 'Juara 3' },
            ]}
            empty={data.ranking.length === 0}
            emptyText="Belum ada data ranking untuk semester terakhir."
          >
            {data.ranking.map(row => (
              <tr key={`${row.kelas}-${row.marhalah}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-800">{row.kelas}</td>
                <td className="px-4 py-3 text-slate-500">{row.marhalah}</td>
                <td className="px-4 py-3">
                  {row.rank1 ? <RankCell nama={row.rank1.nama} rata={row.rank1.rata} tone="good" /> : '-'}
                </td>
                <td className="px-4 py-3">
                  {row.rank2 ? <RankCell nama={row.rank2.nama} rata={row.rank2.rata} tone="warn" /> : '-'}
                </td>
                <td className="px-4 py-3">
                  {row.rank3 ? <RankCell nama={row.rank3.nama} rata={row.rank3.rata} /> : '-'}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </div>
  )
}

function RankCell({ nama, rata, tone }: { nama: string; rata: number; tone?: 'good' | 'warn' | 'default' }) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone ?? 'default'}>{rata}</Badge>
      <span className="font-bold text-slate-700">{nama}</span>
    </div>
  )
}
