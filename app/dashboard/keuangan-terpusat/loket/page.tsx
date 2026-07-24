/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { guardPage } from '@/lib/auth/guard'
import { getEffectiveRoles } from '@/lib/auth/session'
import { getCashierBootstrap } from './actions'
import { CashierClient } from './_cashier-client'
import { FinanceGuide, FinanceNav, FinancePageHeader, SectionPanel, StatusBadge } from '../_components/finance-ui'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  const session = await guardPage('/dashboard/keuangan-terpusat/loket')
  const roles = getEffectiveRoles(session)
  const isOperator = roles.includes('operator_loket')

  if (!isOperator) return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Loket Pencairan" description="Layani pencairan uang jajan melalui shift kas yang terkontrol." eyebrow="Role operator wajib" meta="Akun ini belum dapat menjalankan transaksi loket" />
    <FinanceNav showCashUnits={roles.includes('bendahara')} />
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-bold">Tambahkan role Operator Loket terlebih dahulu</h2>
      <p className="mt-1 max-w-2xl leading-6">Role bendahara memberi akses pengaturan, tetapi transaksi kas tetap membutuhkan role <strong>Operator Loket</strong> dan penugasan pada Unit Kas tertentu.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/pengaturan/users" className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white">Atur role pengguna</Link><Link href="/dashboard/keuangan-terpusat/unit-kas" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold">Buka Unit Kas</Link></div>
    </section>
  </main>

  const data = await getCashierBootstrap()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Loket Pencairan" description="Buka shift, verifikasi santri, cairkan uang, lalu tutup dan cocokkan kas." eyebrow="Online · PIN wajib" meta={data.shift ? `${data.shift.unit_name} sedang aktif` : 'Buka shift sebelum melayani santri'} />
    <FinanceNav cashierOnly={!data.capabilities.canConfigure} showCashUnits={data.capabilities.canConfigure} />
    <FinanceGuide purpose="Memastikan uang hanya dicairkan kepada santri yang benar dan setiap rupiah tercatat pada shift kas." prerequisites={["Pastikan Anda sudah ditugaskan ke Unit Kas.","Hitung uang fisik sebelum membuka shift.","Siapkan scanner RFID/QR dan keypad PIN."]} steps={["Pilih Unit Kas dan buka shift.","Scan, cocokkan identitas, lalu proses pencairan.","Hitung ulang kas dan tutup shift."]} notes={["PIN dan konfirmasi identitas tidak dapat dilewati.","Scope santri mengikuti Unit Kas aktif.","Selisih penutupan otomatis masuk review bendahara."]} />
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm"><span className="font-bold text-slate-700">Status loket</span><StatusBadge tone={data.shift ? 'emerald' : 'amber'}>{data.shift ? 'Shift aktif' : 'Shift belum dibuka'}</StatusBadge><span className="text-slate-500">{data.shift ? `${data.shift.unit_name} · ${data.operator.name}` : `${data.units.length} Unit Kas ditugaskan`}</span></div>
    <CashierClient units={data.units} shift={data.shift} operatorName={data.operator.name} canConfigure={data.capabilities.canConfigure} />
    <SectionPanel title={data.shift ? 'Transaksi shift berjalan' : 'Riwayat shift'} description={data.shift ? 'Daftar ini hanya berisi pencairan pada shift yang sedang aktif.' : 'Buka shift untuk mulai mencatat transaksi.'}>
      <div className="divide-y divide-slate-100 sm:hidden">{data.history.length ? data.history.map((row: any) => <article key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs"><div className="min-w-0"><p className="break-words font-semibold text-slate-800">{row.nama_lengkap}</p><p className="mt-1 text-slate-500">NIS {row.nis}</p></div><strong className="shrink-0 text-right tabular-nums">Rp {Number(row.amount_rupiah).toLocaleString('id-ID')}</strong></article>) : <p className="px-4 py-10 text-center text-sm text-slate-500">{data.shift ? 'Belum ada pencairan pada shift ini.' : 'Belum ada shift aktif.'}</p>}</div>
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[520px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">NIS</th><th className="px-4 py-2.5 text-right">Nominal</th><th className="px-4 py-2.5">Waktu</th></tr></thead><tbody className="divide-y divide-slate-100">{data.history.length ? data.history.map((row: any) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.nama_lengkap}</td><td className="px-4 py-3 text-slate-500">{row.nis}</td><td className="px-4 py-3 text-right font-bold tabular-nums">Rp {Number(row.amount_rupiah).toLocaleString('id-ID')}</td><td className="px-4 py-3 text-slate-500">{row.created_at}</td></tr>) : <tr><td colSpan={4} className="p-10 text-center text-sm text-slate-500">{data.shift ? 'Belum ada pencairan pada shift ini.' : 'Belum ada shift aktif.'}</td></tr>}</tbody></table></div>
    </SectionPanel>
  </main>
}
