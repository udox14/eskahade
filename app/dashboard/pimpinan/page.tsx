import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedRingkasanPimpinan } from '@/lib/pimpinan/cache'
import { rupiah, rupiahCompact, labelBulan, currentMonthWib } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
} from './_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanRingkasanPage() {
  const session = await guardPage('/dashboard/pimpinan')
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedRingkasanPimpinan(scope)
  const bulanLabel = labelBulan(currentMonthWib())

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ringkasan Pimpinan"
        description={`Pantauan ringkas seluruh bidang pada ${bulanLabel}. Data bersifat baca saja.`}
        actions={<PrintButton />}
      />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Santri Aktif" value={data.santriAktif} sub="seluruh asrama" />
          <KpiCard label="Total Guru" value={data.guruTotal} sub="data guru terdaftar" />
          <KpiCard
            label="Saldo Kas"
            value={rupiahCompact(data.keuangan.totalSaldo)}
            sub={rupiah(data.keuangan.totalSaldo)}
          />
          <KpiCard
            label="Santri Sakit Hari Ini"
            value={data.kesehatan.sakitHariIni}
            tone={data.kesehatan.sakitHariIni > 0 ? 'warn' : 'good'}
            sub="episode sakit aktif"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Kehadiran Pengajian"
            value={`${data.absensi.pctPengajian}%`}
            sub={`alfa ${data.absensi.alfaPengajian} sesi`}
            tone={data.absensi.pctPengajian >= 90 ? 'good' : data.absensi.pctPengajian >= 75 ? 'warn' : 'bad'}
          />
          <KpiCard
            label="Kehadiran Berjamaah"
            value={`${data.absensi.pctBerjamaah}%`}
            sub="bulan berjalan"
            tone={data.absensi.pctBerjamaah >= 90 ? 'good' : data.absensi.pctBerjamaah >= 75 ? 'warn' : 'bad'}
          />
          <KpiCard
            label="Kehadiran Guru"
            value={`${data.absensi.pctGuru}%`}
            sub="hadir + badal"
            tone={data.absensi.pctGuru >= 90 ? 'good' : data.absensi.pctGuru >= 75 ? 'warn' : 'bad'}
          />
          <KpiCard
            label="SPP Belum Lunas"
            value={data.keuangan.sppBelumLunas}
            tone={data.keuangan.sppBelumLunas > 0 ? 'warn' : 'good'}
            sub={`estimasi ${rupiahCompact(data.keuangan.estimasiSpp)}`}
          />
        </div>

        <SectionCard
          title="Arus Kas 30 Hari Terakhir"
          subtitle="Pemasukan dan pengeluaran dari jurnal keuangan terpusat."
        >
          {data.cashTrend.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Belum ada transaksi dalam 30 hari terakhir.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {data.cashTrend.slice(-16).map(row => (
                <div key={row.day} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-bold text-slate-400">{row.day.slice(8)}</p>
                  <p className="mt-1 text-sm font-black text-emerald-700">+{rupiahCompact(row.masuk)}</p>
                  <p className="text-sm font-black text-red-700">-{rupiahCompact(row.keluar)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Perhatian Perlu Tindak Lanjut" subtitle="Alert keuangan dan indikator yang menonjol.">
            {data.alert.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Tidak ada alert keuangan yang perlu perhatian.</p>
            ) : (
              <div className="space-y-2">
                {data.alert.map(alert => (
                  <div key={alert.kind} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-amber-900">{alert.label}</p>
                      <p className="text-xs text-amber-700">{alert.count} kejadian</p>
                    </div>
                    <Badge tone="warn">{rupiahCompact(alert.amount_rupiah)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Rekap Bulanan Paling Atas" subtitle={`Data ${bulanLabel} yang paling sering dicek pimpinan.`}>
            <DataTable
              columns={[
                { label: 'Indikator' },
                { label: 'Nilai', align: 'right' },
              ]}
            >
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">Pemasukan kas bulan ini</td>
                <td className="px-4 py-3 text-right font-black text-emerald-700">{rupiah(data.keuangan.masukBulan)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">Pengeluaran kas bulan ini</td>
                <td className="px-4 py-3 text-right font-black text-red-700">{rupiah(data.keuangan.keluarBulan)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">Alfa pengajian bulan ini</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{data.absensi.alfaPengajian} sesi</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">SPP belum dibayar</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{data.keuangan.sppBelumLunas} santri</td>
              </tr>
            </DataTable>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
