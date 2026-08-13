'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, ShieldWarning } from '@phosphor-icons/react'
import {
  EmptyState, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { closeIncidentAction, openIncidentAction, recordIncidentTopupAction } from './actions'

const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const TOUR: TourStep[] = [
  { target: '[data-tour="status"]', title: 'Incident mode adalah jalur darurat', body: 'Dipakai hanya saat gateway pembayaran terganggu. Selama aktif, penerimaan tunai atau transfer darurat boleh dicatat manual.' },
  { target: '[data-tour="activate"]', title: 'Butuh dua orang', body: 'Pengusul harus Bendahara, penyetujunya orang lain yang sedang login. Durasi maksimal 24 jam dan tidak boleh tumpang tindih dengan incident lain.' },
  { target: '[data-tour="record"]', title: 'Catat setiap penerimaan', body: 'Nomor referensi harus unik per penerimaan. Uang tunai wajib terkait shift kas yang terbuka; transfer darurat wajib punya referensi bank.' },
  { target: '[data-tour="receipts"]', title: 'Setiap bukti masuk ledger', body: 'Nomor bukti yang terbit menjadi jejak audit dan saldonya langsung menambah dompet Titipan santri.' },
]

export function IncidentClient({ data }: { data: any }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [channel, setChannel] = useState<'CASH' | 'EMERGENCY_TRANSFER'>('CASH')
  const [incidentId, setIncidentId] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)
  const tour = useFinanceTour('insiden')
  const now = Number(data.nowMs)
  const active = data.incidents.filter((row: any) => row.status === 'ACTIVE' && new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() > now)
  const selectedIncident = active.find((row: any) => row.id === incidentId)
  const allowedChannels = selectedIncident ? JSON.parse(selectedIncident.allowed_channels_json) as Array<'CASH' | 'EMERGENCY_TRANSFER'> : []
  const totalReceived = data.receipts.reduce((sum: number, row: any) => sum + Number(row.amount_rupiah), 0)

  function mutate(work: () => Promise<any>, success: string | ((outcome: any) => string)) {
    startTransition(async () => {
      try {
        const outcome = await work()
        if (!outcome?.success) {
          const message = outcome?.error || 'Tindakan tidak dapat diproses.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        const message = typeof success === 'function' ? success(outcome) : success
        if (outcome.duplicate) {
          // Uang darurat sering diterima fisik lebih dulu. Kiriman ulang tidak
          // boleh terlihat sebagai penerimaan kedua.
          setResult({
            tone: 'duplicate',
            message: 'Penerimaan dengan isi yang sama persis sudah pernah dicatat.',
            detail: 'Tidak ada saldo baru yang ditambahkan. Periksa daftar bukti di bawah sebelum mencatat ulang.',
          })
          toast.info('Penerimaan duplikat, tidak dicatat ulang.')
        } else {
          setResult({ tone: 'success', message })
          toast.success(message)
        }
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tindakan tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <section data-tour="status" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Incident aktif" value={String(active.length)} detail="Aktif pada waktu saat ini" icon="listChecks" tone={active.length ? 'amber' : 'emerald'} />
      <MetricCard label="Penerimaan dicatat" value={String(data.receipts.length)} detail="150 bukti terbaru sesuai scope" icon="receipt" tone="blue" />
      <MetricCard label="Dana darurat" value={rupiah(totalReceived)} detail="Total bukti yang sedang dimuat" icon="wallet" tone="slate" />
      <MetricCard label="Shift kas terbuka" value={String(data.openShifts.length)} detail="Dapat dipakai channel cash" icon="lock" tone={data.openShifts.length ? 'emerald' : 'slate'} />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <section className="grid gap-4 xl:grid-cols-2">
      {data.canApprove ? <SectionPanel title="Aktifkan incident mode" description="Penyetuju yang sedang login mencatat pengusul Bendahara yang berbeda; durasi maksimal 24 jam.">
        <form data-tour="activate" action={form => mutate(() => openIncidentAction(form), 'Incident mode berhasil diaktifkan.')} className="grid gap-3 p-4">
          <label className="text-xs font-bold">Pengusul / pembuka<select name="openedBy" required defaultValue="" className={`mt-1.5 ${field}`}><option value="" disabled>Pilih Bendahara pengusul</option>{data.proposers.map((row: any) => <option key={row.id} value={row.id}>{row.full_name || row.email}</option>)}</select></label>
          <label className="text-xs font-bold">Alasan insiden<textarea name="reason" required minLength={15} rows={3} placeholder="Gangguan dan alasan jalur darurat diperlukan" className={`mt-1.5 ${field} py-2`} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Mulai<input name="startsAt" type="datetime-local" required className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Berakhir<input name="endsAt" type="datetime-local" required className={`mt-1.5 ${field}`} /></label></div>
          <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-bold">Channel yang diizinkan</legend><div className="flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" name="channels" value="CASH" className="h-4 w-4 accent-emerald-700" />Cash</label><label className="flex items-center gap-2"><input type="checkbox" name="channels" value="EMERGENCY_TRANSFER" className="h-4 w-4 accent-emerald-700" />Transfer darurat</label></div></fieldset>
          <button disabled={pending} className="min-h-11 rounded-lg bg-amber-600 text-sm font-bold text-white disabled:opacity-50">Setujui & aktifkan incident</button>
        </form>
      </SectionPanel> : <SectionPanel title="Aktivasi incident" description="Aktivasi hanya dilakukan checker Dewan Santri."><div className="p-8 text-center text-sm text-slate-500"><ShieldWarning className="mx-auto mb-2 h-8 w-8 text-slate-300" />Anda dapat memantau incident, tetapi tidak memiliki kewenangan untuk mengaktifkannya.</div></SectionPanel>}

      {data.canCreate ? <SectionPanel title="Catat top-up darurat" description="Hanya incident yang sedang aktif dan channel yang disetujui dapat digunakan.">
        <form data-tour="record" action={form => mutate(() => recordIncidentTopupAction(form), outcome => `Penerimaan dicatat dengan nomor bukti ${outcome.receiptNumber}.`)} className="grid gap-3 p-4">
          <label className="text-xs font-bold">Incident aktif<select name="incidentId" required value={incidentId} onChange={event => { const id = event.target.value; setIncidentId(id); const incident = active.find((row: any) => row.id === id); const channels = incident ? JSON.parse(incident.allowed_channels_json) as Array<'CASH' | 'EMERGENCY_TRANSFER'> : []; if (channels.length) setChannel(channels[0]) }} className={`mt-1.5 ${field}`}><option value="" disabled>Pilih incident</option>{active.map((row: any) => <option key={row.id} value={row.id}>{row.reason} · sampai {row.ends_at}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">NIS santri<input name="nis" required className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Nominal<input name="amountRupiah" type="number" required min={1} className={`mt-1.5 ${field}`} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Channel<select name="channel" value={channel} disabled={!allowedChannels.length} onChange={event => setChannel(event.target.value as typeof channel)} className={`mt-1.5 ${field}`}><option value="" disabled>Pilih incident dahulu</option>{allowedChannels.includes('CASH') ? <option value="CASH">Cash</option> : null}{allowedChannels.includes('EMERGENCY_TRANSFER') ? <option value="EMERGENCY_TRANSFER">Transfer darurat</option> : null}</select></label><label className="text-xs font-bold">Referensi penerimaan<input name="receiptReference" required minLength={3} placeholder="Nomor unik per penerimaan" className={`mt-1.5 ${field}`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Nomor berbeda untuk tiap penerimaan. Nomor yang sama dengan nominal sama dianggap kiriman ulang.</span></label></div>
          {channel === 'CASH' ? <label className="text-xs font-bold">Shift kas terbuka<select name="shiftId" required defaultValue="" className={`mt-1.5 ${field}`}><option value="" disabled>Pilih shift</option>{data.openShifts.map((row: any) => <option key={row.id} value={row.id}>{row.unit_name} · {row.operator_name} · {row.terminal_id}</option>)}</select></label> : <label className="text-xs font-bold">Referensi bank<input name="bankReference" required placeholder="Nomor referensi transfer" className={`mt-1.5 ${field}`} /></label>}
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">Catat hanya setelah uang benar-benar diterima. Saldo langsung masuk ke dompet Titipan santri dan tidak dapat dihapus — koreksi hanya lewat jurnal.</p>
          <button disabled={pending || !active.length} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-50">Catat &amp; terbitkan bukti</button>
          {!active.length ? <p className="text-[11px] text-slate-500">Tidak ada incident yang sedang aktif, sehingga penerimaan darurat belum boleh dicatat.</p> : null}
        </form>
      </SectionPanel> : null}
    </section>

    <SectionPanel title="Riwayat incident mode" description="Alasan, persetujuan, masa aktif, jumlah bukti, dan penutupan incident.">
      <div className="divide-y divide-slate-100">{data.incidents.length ? data.incidents.map((row: any) => {
        const expired = row.status === 'ACTIVE' && new Date(row.ends_at).getTime() <= now
        return <details key={row.id}>
          <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[1fr_170px_140px_110px] sm:items-center"><span className="min-w-0"><strong className="block truncate text-slate-800">{row.reason}</strong><span className="text-slate-500">{row.starts_at} — {row.ends_at}</span></span><span>{row.opened_by_name}<small className="block text-slate-400">Disetujui {row.approved_by_name}</small></span><strong className="tabular-nums sm:text-right">{rupiah(row.received_rupiah)}<small className="block font-normal text-slate-400">{row.receipt_count} bukti</small></strong><span className="sm:text-right"><StatusBadge tone={row.status === 'ENDED' ? 'slate' : expired ? 'amber' : 'red'}>{expired ? 'EXPIRED' : row.status}</StatusBadge></span></summary>
          <div className="border-t border-slate-100 bg-slate-50/60 p-4"><p className="text-xs text-slate-600">Channel: {(JSON.parse(row.allowed_channels_json) as string[]).join(', ')}</p>{data.canClose && row.status === 'ACTIVE' ? <form action={form => mutate(() => closeIncidentAction(form), 'Incident mode berhasil ditutup.')} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="incidentId" value={row.id} /><input name="reason" required minLength={10} placeholder="Catatan penutupan dan kondisi akhir" className={field} /><button disabled={pending} className="min-h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">Tutup incident</button></form> : null}</div>
        </details>
      }) : <EmptyState icon={CheckCircle} title="Belum ada incident mode" description="Jalur darurat belum pernah diaktifkan. Ini kondisi yang diharapkan selama pembayaran normal berjalan." />}</div>
    </SectionPanel>

    <SectionPanel title="Bukti penerimaan darurat" description="Jejak bukti top-up yang diposting ke jurnal dan dompet Titipan.">
      <div data-tour="receipts" className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Bukti</th><th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">Channel</th><th className="px-4 py-2.5">Unit / referensi</th><th className="px-4 py-2.5 text-right">Nominal</th><th className="px-4 py-2.5">Penerima</th></tr></thead><tbody className="divide-y divide-slate-100">{data.receipts.length ? data.receipts.map((row: any) => <tr key={row.id}><td className="px-4 py-3"><strong>{row.receipt_number}</strong><span className="block text-slate-400">{row.created_at}</span></td><td className="px-4 py-3"><strong>{row.student_name}</strong><span className="block text-slate-500">{row.nis} · {row.asrama}</span></td><td className="px-4 py-3"><StatusBadge tone={row.channel === 'CASH' ? 'amber' : 'blue'}>{row.channel}</StatusBadge></td><td className="px-4 py-3">{row.cash_unit_name || row.bank_reference || '—'}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(row.amount_rupiah)}</td><td className="px-4 py-3">{row.received_by_name}</td></tr>) : <tr><td colSpan={6} className="p-10 text-center text-slate-500">Belum ada penerimaan darurat.</td></tr>}</tbody></table></div>
    </SectionPanel>
  </div>
}
