import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedEhbMonitoring } from '@/lib/pimpinan/cache'
import { rupiah } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  EmptyState,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanEhbPage() {
  const session = await guardPage('/dashboard/pimpinan/ehb')
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedEhbMonitoring(scope)

  if (!data.event) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Monitoring EHB"
          description="RAB dan realisasi keuangan ujian EHB."
          actions={<PrintButton />}
        />
        <EmptyState
          title="Belum ada event EHB aktif"
          description="Data RAB dan keuangan EHB akan tampil di sini setelah event EHB dibuat dan diaktifkan."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring EHB"
        description={`${data.event.nama} · Semester ${data.event.semester} · ${data.event.tahun_ajaran_nama}`}
        actions={<PrintButton />}
      />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total RAB" value={rupiah(data.rab.total_anggaran)} sub={`${data.rab.total_item} item anggaran`} />
          <KpiCard
            label="Realisasi Masuk"
            value={rupiah(data.transaksi.pemasukan)}
            tone="good"
          />
          <KpiCard
            label="Realisasi Keluar"
            value={rupiah(data.transaksi.pengeluaran)}
            tone={data.transaksi.pengeluaran > data.transaksi.pemasukan ? 'bad' : 'warn'}
          />
          <KpiCard
            label="Sisa Kas"
            value={rupiah(data.transaksi.saldo)}
            tone={data.transaksi.saldo < 0 ? 'bad' : 'good'}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="RAB per Kategori" subtitle="Anggaran menurut kategori item.">
            <DataTable
              columns={[
                { label: 'Kategori' },
                { label: 'Item', align: 'right' },
                { label: 'Anggaran', align: 'right' },
              ]}
              empty={data.rab.perKategori.length === 0}
            >
              {data.rab.perKategori.map(row => (
                <tr key={row.kategori} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{row.kategori}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-600">{row.items}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">{rupiah(row.total)}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>

          <SectionCard title="Informasi Event" subtitle="Ringkasan kepanitiaan EHB.">
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Nama Event" value={data.event.nama} />
              <KpiCard label="Semester" value={data.event.semester} />
              <KpiCard label="Tahun Ajaran" value={data.event.tahun_ajaran_nama} />
              <KpiCard label="Panitia" value={data.panitia} sub="anggota terdaftar" />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
