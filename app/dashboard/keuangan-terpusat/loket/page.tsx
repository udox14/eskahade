import { guardPage } from '@/lib/auth/guard'
import { getCashierBootstrap } from './actions'
import { CashierClient } from './_cashier-client'
import { FinanceGuide, FinanceNav, FinancePageHeader, SectionPanel, StatusBadge } from '../_components/finance-ui'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  await guardPage('/dashboard/keuangan-terpusat/loket')
  const data = await getCashierBootstrap()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Loket Pencairan" description="Layani pencairan uang jajan dengan verifikasi kartu, foto, PIN, dan limit dalam satu alur." eyebrow="Online only · PIN wajib" meta={data.shift ? 'Shift kas sedang aktif' : 'Buka shift sebelum melayani santri'} />
    <FinanceNav />
    <FinanceGuide purpose="Memastikan uang hanya dicairkan kepada santri yang benar dan setiap rupiah tercatat pada shift kas." prerequisites={["Hitung kas fisik dan pilih unit kas.","Pastikan reader RFID atau scanner QR terhubung.","Gunakan keypad privat untuk PIN."]} steps={["Buka shift dan scan credential.","Cocokkan foto serta identitas santri.","Masukkan nominal, minta PIN, lalu konfirmasi pencairan."]} notes={["Operator biasa tidak boleh melewati PIN.","Jika limit tercapai, wali harus mengubah limit.","Selisih kas saat tutup shift masuk review supervisor."]} />
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm"><span className="font-bold text-slate-700">Status loket</span><StatusBadge tone={data.shift?'emerald':'amber'}>{data.shift?'Shift aktif':'Shift belum dibuka'}</StatusBadge><span className="text-slate-500">{data.shift ? `Terminal ${data.shift.terminal_id}` : `${data.units.length} unit kas tersedia`}</span></div>
    <CashierClient units={data.units} shift={data.shift} />
    <SectionPanel title="20 transaksi terakhir operator" description="Gunakan daftar ini untuk pengecekan cepat terhadap kas fisik pada shift berjalan.">
      <div className="divide-y divide-slate-100 sm:hidden">{data.history.length ? data.history.map((row: any) => <article key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs"><div className="min-w-0"><p className="break-words font-semibold text-slate-800">{row.nama_lengkap}</p><p className="mt-1 text-slate-500">NIS {row.nis}</p></div><strong className="shrink-0 text-right tabular-nums">Rp {Number(row.amount_rupiah).toLocaleString('id-ID')}</strong></article>) : <p className="px-4 py-10 text-center text-sm text-slate-500">Belum ada pencairan pada operator ini.</p>}</div>
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[520px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">NIS</th><th className="px-4 py-2.5 text-right">Nominal</th></tr></thead><tbody className="divide-y divide-slate-100">{data.history.length ? data.history.map((row: any) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.nama_lengkap}</td><td className="px-4 py-3 text-slate-500">{row.nis}</td><td className="px-4 py-3 text-right font-bold tabular-nums">Rp {Number(row.amount_rupiah).toLocaleString('id-ID')}</td></tr>) : <tr><td colSpan={3} className="p-10 text-center text-sm text-slate-500">Belum ada pencairan pada operator ini.</td></tr>}</tbody></table></div>
    </SectionPanel>
  </main>
}
