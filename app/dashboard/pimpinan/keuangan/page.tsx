import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedKeuanganMonitoring } from '@/lib/pimpinan/cache'
import { rupiah, rupiahCompact, labelBulan } from '@/lib/pimpinan/helpers'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
  MonthSelect,
  FilterBar,
} from '../_components/pimpinan-ui'
import { usePageNav } from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

export default async function PimpinanKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await guardPage('/dashboard/pimpinan/keuangan')
  const params = await searchParams
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedKeuanganMonitoring(scope, params.month)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Keuangan"
        description={`Rekap keuangan ${labelBulan(data.period.month)}. Data bersifat baca saja.`}
        actions={<PrintButton />}
      />

      <MonthFilter month={data.period.month} />

      <div className="print-area space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Saldo Kas" value={rupiahCompact(data.totalSaldo)} sub={rupiah(data.totalSaldo)} />
          <KpiCard
            label="Pemasukan Bulan Ini"
            value={rupiahCompact(data.arusKasBulan.masuk)}
            sub={rupiah(data.arusKasBulan.masuk)}
            tone="good"
          />
          <KpiCard
            label="Pengeluaran Bulan Ini"
            value={rupiahCompact(data.arusKasBulan.keluar)}
            sub={rupiah(data.arusKasBulan.keluar)}
            tone={data.arusKasBulan.keluar > data.arusKasBulan.masuk ? 'bad' : 'warn'}
          />
          <KpiCard
            label="SPP Belum Lunas"
            value={data.spp.santri_belum_lunas}
            sub={`estimasi ${rupiahCompact(data.spp.estimasi_nominal)}`}
            tone={data.spp.santri_belum_lunas > 0 ? 'warn' : 'good'}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Saldo per Akun" subtitle="Saldo aktif akun kas dan rekening.">
            {data.saldoAkun.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Belum ada data akun.</p>
            ) : (
              <DataTable
                columns={[
                  { label: 'Kode' },
                  { label: 'Akun' },
                  { label: 'Saldo', align: 'right' },
                ]}
              >
                {data.saldoAkun.map(account => (
                  <tr key={account.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-slate-400">{account.code}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{account.name}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-800">{rupiah(account.balance_rupiah)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          <SectionCard title="Perhatian" subtitle="Alert yang membutuhkan review.">
            {data.alert.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Tidak ada alert keuangan.</p>
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
        </div>

        <SectionCard
          title="SPP Bulan Ini"
          subtitle="Pembayaran SPP dan estimasi tunggakan."
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Transaksi SPP" value={data.spp.transaksi_bulan} sub="pembayaran tercatat" />
            <KpiCard label="Nominal SPP" value={rupiah(data.spp.nominal_spp)} sub="per santri" />
            <KpiCard
              label="Santri Belum Bayar"
              value={data.spp.santri_belum_lunas}
              tone={data.spp.santri_belum_lunas > 0 ? 'warn' : 'good'}
            />
            <KpiCard label="Total Bayar" value={rupiahCompact(data.spp.total_bayar_bulan)} sub={rupiah(data.spp.total_bayar_bulan)} tone="good" />
          </div>
        </SectionCard>

        <SectionCard title="Pembayaran PSB Bulan Ini" subtitle="Pemasukan dari pembayaran tahunan santri baru.">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Transaksi PSB" value={data.psbBulan.transaksi} />
            <KpiCard label="Total Pembayaran" value={rupiahCompact(data.psbBulan.total_bayar)} sub={rupiah(data.psbBulan.total_bayar)} tone="good" />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function MonthFilter({ month }: { month: string }) {
  const navigate = usePageNav()
  return (
    <FilterBar>
      <MonthSelect value={month} onChange={value => navigate({ month: value })} />
    </FilterBar>
  )
}
