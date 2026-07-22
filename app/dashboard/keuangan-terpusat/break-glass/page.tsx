import { ShieldWarning as ShieldAlert } from '@phosphor-icons/react'
import { guardPage } from '@/lib/auth/guard'
import { activateBreakGlass, getBreakGlassRows } from './actions'
import { FinanceGuide, FinanceNav, FinancePageHeader, SectionPanel, StatusBadge } from '../_components/finance-ui'

export const dynamic = 'force-dynamic'

export default async function BreakGlassPage() {
  await guardPage('/dashboard/keuangan-terpusat/break-glass')
  const rows = await getBreakGlassRows()
  async function activate(formData: FormData) {
    'use server'
    await activateBreakGlass(formData)
  }

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Break-glass Keuangan" description="Akses darurat berjangka untuk admin teknis yang tidak memiliki role operasional keuangan." eyebrow="Darurat · 30 menit · selalu diaudit" meta="Admin yang juga memiliki role bendahara tidak memerlukan break-glass" />
    <FinanceNav />
    <FinanceGuide purpose="Memberi akses sementara saat insiden teknis benar-benar menghalangi operasional keuangan." prerequisites={["Pastikan masalah tidak dapat diselesaikan oleh bendahara berwenang.", "Siapkan alasan insiden yang spesifik dan dapat diaudit."]} steps={["Tuliskan alasan minimal 20 karakter.", "Aktifkan akses selama 30 menit.", "Auditor meninjau penggunaan setelah insiden."]} notes={["Aktivasi mengirim notifikasi dan masuk audit log.", "Jangan gunakan break-glass untuk pekerjaan rutin.", "Akses otomatis berakhir saat masa berlaku habis."]} />
    <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
      <form action={activate} className="rounded-xl border border-red-200 bg-red-50/70 p-4">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><h2 className="text-sm font-bold text-red-900">Aktifkan akses darurat</h2><p className="mt-1 text-xs leading-relaxed text-red-700">Tindakan ini bukan jalan pintas role. Semua aktivitas selama akses aktif tetap tercatat.</p></div></div>
        <label className="mt-4 block text-xs font-bold text-slate-700">Alasan insiden<textarea name="reason" required minLength={20} placeholder="Jelaskan insiden, dampak, dan mengapa akses teknis diperlukan..." className="mt-1.5 block min-h-28 w-full rounded-lg border border-red-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-red-500" /></label>
        <button className="mt-3 min-h-11 w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white sm:min-h-0">Aktifkan selama 30 menit</button>
      </form>
      <SectionPanel title="Riwayat akses darurat" description="Auditor wajib meninjau setiap aktivasi dan alasan yang diberikan.">
        <div className="divide-y divide-slate-100">{rows.length ? rows.map((row: any) => <div key={row.id} className="px-4 py-3 text-xs"><div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><strong className="min-w-0 break-words text-slate-800">{row.full_name || row.user_id}</strong><StatusBadge tone={row.reviewed_at ? 'emerald' : 'amber'}>{row.reviewed_at ? 'Sudah direview' : 'Menunggu review'}</StatusBadge></div><p className="mt-2 break-words text-slate-700 sm:mt-1">{row.reason}</p><p className="mt-1 break-words tabular-nums text-slate-400">{row.starts_at} – {row.expires_at}</p></div>) : <p className="p-10 text-center text-sm text-slate-500">Belum pernah ada aktivasi break-glass.</p>}</div>
      </SectionPanel>
    </div>
  </main>
}
