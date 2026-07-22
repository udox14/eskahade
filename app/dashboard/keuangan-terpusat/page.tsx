import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Landmark, Layers3, ListChecks, WalletCards } from 'lucide-react'
import { guardPage } from '@/lib/auth/guard'
import { financeAsramaScope, requireFinanceAccess } from '@/lib/finance/access'
import { getFinanceDashboard } from '@/lib/finance/dashboard'
import { FinanceGuide, FinanceNav, FinancePageHeader, MetricCard, SectionPanel, StatusBadge } from './_components/finance-ui'

export const dynamic = 'force-dynamic'

type DashboardData = Awaited<ReturnType<typeof getFinanceDashboard>>

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const alertLabel: Record<string, string> = { LATE_TOPUP: 'Top-up terlambat', UNMATCHED_BANK: 'Mutasi belum cocok', PAYOUT_FAILED: 'Payout gagal' }

function CashTrendPanel({ data, maxTrend }: { data: DashboardData; maxTrend: number }) {
  return <SectionPanel title="Tren arus kas 30 hari" description="Debit dan kredit pada rekening bank/clearing; untuk membaca pola, bukan menggantikan rekonsiliasi.">
    <div className="p-4">
      {data.cashTrend.length ? <>
        <div className="mb-3 flex gap-4 text-[10px] sm:text-xs"><span className="flex items-center gap-1 text-emerald-700"><ArrowDownToLine className="h-3.5 w-3.5" />Dana masuk</span><span className="flex items-center gap-1 text-blue-700"><ArrowUpFromLine className="h-3.5 w-3.5" />Dana keluar</span></div>
        <div className="flex h-32 items-end gap-0.5 border-b border-slate-200 sm:h-44 sm:gap-1">
          {data.cashTrend.map(row => <div key={row.day} title={`${row.day}: masuk ${rupiah(Number(row.inflow_rupiah))}, keluar ${rupiah(Number(row.outflow_rupiah))}`} className="group flex min-w-0 flex-1 items-end justify-center gap-px">
            <span className="w-1.5 max-w-[42%] rounded-t bg-emerald-500 sm:w-2" style={{ height: `${Math.max(3, Number(row.inflow_rupiah) / maxTrend * 100)}%` }} />
            <span className="w-1.5 max-w-[42%] rounded-t bg-blue-400 sm:w-2" style={{ height: `${Math.max(3, Number(row.outflow_rupiah) / maxTrend * 100)}%` }} />
          </div>)}
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-slate-400 sm:text-[10px]"><span>{data.cashTrend[0]?.day}</span><span>{data.cashTrend.at(-1)?.day}</span></div>
      </> : <div className="grid h-32 place-items-center text-center text-sm text-slate-500 sm:h-44"><p>Belum ada arus kas terposting dalam 30 hari terakhir.<small className="mt-1 block">Grafik akan terisi otomatis setelah transaksi pertama.</small></p></div>}
    </div>
  </SectionPanel>
}

function AlertPanel({ data }: { data: DashboardData }) {
  return <SectionPanel title="Pengecualian butuh tindakan" description="Kerjakan dari dampak tertinggi; jangan menyembunyikan selisih.">
    <div className="divide-y divide-slate-100">
      {data.alerts.map(row => <div key={row.kind} className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:gap-4 sm:text-sm">
        <div className="flex min-w-0 items-center gap-2"><AlertTriangle className={Number(row.count) ? 'h-4 w-4 shrink-0 text-amber-600' : 'h-4 w-4 shrink-0 text-slate-300'} /><span className="font-medium text-slate-700">{alertLabel[row.kind] || row.kind}</span></div>
        <div className="shrink-0 text-right"><StatusBadge tone={Number(row.count) ? 'amber' : 'emerald'}>{row.count} kasus</StatusBadge><p className="mt-1 text-[10px] tabular-nums text-slate-500 sm:text-xs">{rupiah(Number(row.amount_rupiah))}</p></div>
      </div>)}
    </div>
  </SectionPanel>
}

function ActivityPanel({ data }: { data: DashboardData }) {
  return <SectionPanel title="Aktivitas jurnal terbaru" description="Urutan transaksi berdasarkan waktu posting paling baru.">
    <div className="divide-y divide-slate-100 sm:hidden">
      {data.recentTransactions.length ? data.recentTransactions.map(row => <article key={row.id} className="space-y-2 px-4 py-3 text-xs">
        <div className="flex items-start justify-between gap-3"><p className="min-w-0 font-semibold text-slate-800">{row.description}</p><span className="shrink-0 tabular-nums text-slate-500">{row.effective_date}</span></div>
        <div className="flex items-end justify-between gap-3"><StatusBadge>{row.source_type}</StatusBadge><span className="min-w-0 break-all text-right font-mono text-[10px] text-slate-400">{row.external_reference || '—'}</span></div>
      </article>) : <p className="px-4 py-10 text-center text-sm text-slate-500">Belum ada jurnal terposting.</p>}
    </div>
    <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[560px] text-xs">
      <thead className="bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Tanggal</th><th className="px-4 py-2.5">Keterangan</th><th className="px-4 py-2.5">Sumber</th><th className="px-4 py-2.5">Referensi</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{data.recentTransactions.length ? data.recentTransactions.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">{row.effective_date}</td><td className="px-4 py-3 font-medium text-slate-800">{row.description}</td><td className="px-4 py-3"><StatusBadge>{row.source_type}</StatusBadge></td><td className="px-4 py-3 font-mono text-slate-500">{row.external_reference || '—'}</td></tr>) : <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">Belum ada jurnal terposting.</td></tr>}</tbody>
    </table></div>
  </SectionPanel>
}

function AccountsPanel({ data }: { data: DashboardData }) {
  return <details className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-xs font-bold text-slate-800 sm:min-h-0 sm:text-sm">Chart of accounts <span className="ml-1 font-normal text-slate-500">({data.accountBalances.length} akun)</span></summary>
    <div className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden">{data.accountBalances.map(row => <article key={row.code} className="flex items-start justify-between gap-3 px-4 py-3 text-xs"><div className="min-w-0"><p className="font-mono text-[9px] text-slate-400">{row.code} · {row.account_type}</p><p className="mt-0.5 font-semibold text-slate-800">{row.name}</p></div><strong className="shrink-0 text-right tabular-nums text-slate-900">{rupiah(Number(row.balance_rupiah))}</strong></article>)}</div>
    <div className="hidden overflow-x-auto border-t border-slate-100 sm:block"><table className="w-full min-w-[620px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Kode</th><th className="px-4 py-2.5">Akun</th><th className="px-4 py-2.5">Jenis</th><th className="px-4 py-2.5 text-right">Saldo natural</th></tr></thead><tbody className="divide-y divide-slate-100">{data.accountBalances.map(row => <tr key={row.code}><td className="px-4 py-3 font-mono">{row.code}</td><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3 text-slate-500">{row.account_type}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(Number(row.balance_rupiah))}</td></tr>)}</tbody></table></div>
  </details>
}

export default async function CentralFinancePage() {
  await guardPage('/dashboard/keuangan-terpusat')
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const data = await getFinanceDashboard(scope)
  const account = (code: string) => Number(data.accountBalances.find(row => row.code === code)?.balance_rupiah || 0)
  const bankPosition = account('1101') + account('1102')
  const guardianFloat = account('2101')
  const walletTotal = data.walletTotals.reduce((sum, row) => sum + Number(row.balance_rupiah), 0)
  const totalAlerts = data.alerts.reduce((sum, row) => sum + Number(row.count), 0)
  const maxWallet = Math.max(...data.walletTotals.map(row => Number(row.balance_rupiah)), 1)
  const maxTrend = Math.max(...data.cashTrend.flatMap(row => [Number(row.inflow_rupiah), Number(row.outflow_rupiah)]), 1)
  const scopeLabel = scope ? `Scope asrama: ${scope}` : 'Scope global'

  return <main>
    <div className="space-y-6 sm:hidden">
      <FinancePageHeader title="Keuangan Terpusat" description="Pantau posisi dana, alokasi santri, dan pekerjaan yang perlu ditindaklanjuti." eyebrow={scopeLabel} meta="Pembaruan terakhir berdasarkan jurnal terposting" />
      <FinanceNav />
      <FinanceGuide title="Cara menggunakan" purpose="Memberi gambaran cepat tentang posisi keuangan dan mengarahkan bendahara ke pekerjaan yang paling mendesak." prerequisites={["Pastikan settlement gateway dan mutasi bank sudah diimpor."]} steps={["Periksa kartu ringkasan.", "Tindak lanjuti mutasi bermasalah.", "Gunakan jurnal untuk penelusuran."]} notes={["Angka hanya berasal dari jurnal terposting."]} />

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Posisi bank & clearing" value={rupiah(bankPosition)} detail="Rekening utama + settlement" icon={Landmark} />
        <MetricCard label="Titipan wali" value={rupiah(guardianFloat)} detail="Dana belum dialokasikan" icon={WalletCards} tone="blue" />
        <MetricCard label="Butuh tindakan" value={String(totalAlerts)} detail="Pengecualian menunggu" icon={ListChecks} tone={totalAlerts ? 'amber' : 'emerald'} />
      </section>

      <CashTrendPanel data={data} maxTrend={maxTrend} />
      <AlertPanel data={data} />
      <ActivityPanel data={data} />
      <AccountsPanel data={data} />
    </div>

    <div className="hidden space-y-5 sm:block">
      <FinancePageHeader title="Keuangan Terpusat" description="Pantau posisi dana, alokasi santri, dan pekerjaan yang perlu ditindaklanjuti." eyebrow="Ledger terpisah dari legacy" meta={`${scopeLabel} · pembaruan terakhir berdasarkan jurnal terposting`} />
      <FinanceNav />
      <FinanceGuide purpose="Memberi gambaran cepat tentang posisi keuangan dan mengarahkan bendahara ke pekerjaan yang paling mendesak." prerequisites={["Pastikan settlement gateway dan mutasi bank sudah diimpor.", "Perhatikan scope global atau asrama yang tampil di header."]} steps={["Periksa kartu ringkasan dan antrean pengecualian.", "Tindak lanjuti mutasi, top-up, atau payout bermasalah.", "Gunakan jurnal dan chart of accounts untuk penelusuran audit."]} notes={["Angka hanya berasal dari jurnal terposting.", "Jurnal posted tidak dihapus; koreksi memakai reversal."]} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Posisi bank & clearing" value={rupiah(bankPosition)} detail="Rekening utama + dana dalam settlement" icon={Landmark} />
        <MetricCard label="Titipan wali" value={rupiah(guardianFloat)} detail="Dana belum dialokasikan oleh wali" icon={WalletCards} tone="blue" />
        <MetricCard label="Saldo wallet santri" value={rupiah(walletTotal)} detail={`${data.walletTotals.length} jenis wallet terisi`} icon={Layers3} tone="slate" />
        <MetricCard label="Butuh tindakan" value={String(totalAlerts)} detail="Pengecualian belum diselesaikan" icon={ListChecks} tone={totalAlerts ? 'amber' : 'emerald'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_.9fr]">
        <CashTrendPanel data={data} maxTrend={maxTrend} />
        <SectionPanel title="Komposisi alokasi wallet" description="Membantu melihat konsentrasi dana santri per kebutuhan.">
          <div className="space-y-3 p-4">{data.walletTotals.length ? data.walletTotals.map(row => <div key={row.wallet_kind}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{row.wallet_kind}</span><span className="font-bold tabular-nums">{rupiah(Number(row.balance_rupiah))}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Number(row.balance_rupiah) / maxWallet * 100}%` }} /></div></div>) : <p className="py-16 text-center text-sm text-slate-500">Belum ada dana yang dialokasikan.</p>}</div>
        </SectionPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]"><AlertPanel data={data} /><ActivityPanel data={data} /></section>
      <AccountsPanel data={data} />
    </div>
  </main>
}
