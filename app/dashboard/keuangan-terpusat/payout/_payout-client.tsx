'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bank, CheckCircle, Clock, PaperPlaneTilt, UserPlus } from '@phosphor-icons/react'
import {
  checkPayoutAction, createPayoutAction, executeApiPayoutAction, executePayoutAction,
  reconcilePayoutAction, registerRecipientAction, verifyRecipientAction,
} from './actions'
import {
  ConfirmAction, EmptyState, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'

const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

type Capabilities = { view: boolean; create: boolean; check: boolean; execute: boolean; configure: boolean; audit: boolean }

/**
 * Alur payout adalah rantai empat tahap dengan pemisahan tugas. Urutan dan
 * pemilik tahapnya ditulis eksplisit di sini supaya UI dapat menunjukkan
 * posisi tiap payout, bukan sekadar menampilkan kode status.
 */
const STAGES = [
  { status: 'SUBMITTED', label: 'Menunggu pemeriksaan', owner: 'Checker', tone: 'amber' as const, next: 'Checker memeriksa penerima dan nominal.' },
  { status: 'CHECKED', label: 'Siap dieksekusi', owner: 'Executor', tone: 'blue' as const, next: 'Executor mengirim dana; harus orang ketiga.' },
  { status: 'EXECUTING', label: 'Sedang dikirim', owner: 'Provider', tone: 'blue' as const, next: 'Menunggu konfirmasi provider.' },
  { status: 'PROVIDER_SUCCESS', label: 'Sukses di provider', owner: 'Executor', tone: 'blue' as const, next: 'Cocokkan dengan mutasi bank, lalu rekonsiliasi.' },
  { status: 'RECONCILED', label: 'Selesai', owner: '—', tone: 'emerald' as const, next: 'Sudah cocok dengan mutasi rekening.' },
  { status: 'FAILED', label: 'Gagal', owner: 'Maker', tone: 'red' as const, next: 'Periksa alasan kegagalan lalu ajukan ulang bila perlu.' },
  { status: 'CANCELLED', label: 'Dibatalkan', owner: '—', tone: 'slate' as const, next: 'Tidak ada tindakan lanjutan.' },
] as const

const stageOf = (status: string) => STAGES.find(item => item.status === status)

const TOUR: TourStep[] = [
  { target: '[data-tour="stages"]', title: 'Payout melewati empat tahap', body: 'Diajukan, diperiksa, dieksekusi, lalu direkonsiliasi. Pembuat, pemeriksa, dan pelaksana wajib tiga orang berbeda — database menolak bila sama.' },
  { target: '[data-tour="recipients"]', title: 'Daftarkan rekening lebih dulu', body: 'Rekening baru wajib diverifikasi petugas lain dan menunggu masa tenang 24 jam sebelum bisa menerima transfer API.' },
  { target: '[data-tour="create"]', title: 'Ajukan payout', body: 'Pilih penerima aktif, jenis, dan metode. Biaya transfer API ditampilkan sebelum Anda mengajukan, supaya checker menyetujui angka yang sama dengan yang dibukukan.' },
  { target: '[data-tour="board"]', title: 'Pantau antrean', body: 'Setiap kartu menunjukkan tahap saat ini, siapa pemiliknya, dan tindakan berikutnya. Sukses di provider belum berarti selesai.' },
]

export function PayoutClient({ payouts, recipients, apiFeeRupiah, capabilities, nowMs }: {
  payouts: any[]; recipients: any[]; apiFeeRupiah: number; capabilities: Capabilities; nowMs: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [showRecipient, setShowRecipient] = useState(false)
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [method, setMethod] = useState<'API' | 'MANUAL_TRANSFER' | 'CASH'>('API')
  const [amount, setAmount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE')
  const [executeTarget, setExecuteTarget] = useState<{ id: string; reference: string; name: string; amount: number } | null>(null)
  const [confirmApi, setConfirmApi] = useState<any>(null)
  const tour = useFinanceTour('payout')

  const fee = method === 'API' ? apiFeeRupiah : 0
  const activeRecipients = recipients.filter(row => row.status === 'ACTIVE')
  /** Rekening masih dalam masa tenang bila `usable_after` belum terlewati. */
  const coolingLeft = (row: any) => {
    const until = new Date(row.usable_after || 0).getTime()
    return Number.isFinite(until) && until > nowMs ? until - nowMs : 0
  }
  const readyRecipients = activeRecipients.filter(row => coolingLeft(row) === 0)

  const visiblePayouts = useMemo(() => statusFilter === 'ALL'
    ? payouts
    : payouts.filter(row => !['RECONCILED', 'CANCELLED'].includes(row.status)), [payouts, statusFilter])

  const counts = useMemo(() => ({
    submitted: payouts.filter(row => row.status === 'SUBMITTED').length,
    checked: payouts.filter(row => row.status === 'CHECKED').length,
    inflight: payouts.filter(row => ['EXECUTING', 'PROVIDER_SUCCESS'].includes(row.status)).length,
    failed: payouts.filter(row => row.status === 'FAILED').length,
  }), [payouts])

  function act(work: () => Promise<any>, success: string, duplicateMessage?: string) {
    start(async () => {
      const outcome = await work()
      if (!outcome || 'error' in outcome) {
        const message = outcome?.error || 'Tindakan tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
        return
      }
      if (outcome.duplicate) {
        const message = duplicateMessage || 'Permintaan yang sama sudah pernah diproses — tidak ada yang baru dibuat.'
        setResult({ tone: 'duplicate', message })
        toast.info(message)
      } else {
        setResult({ tone: 'success', message: success })
        toast.success(success)
      }
      router.refresh()
    })
  }

  function hoursLeft(ms: number) {
    const hours = Math.ceil(ms / 3600_000)
    return hours > 1 ? `${hours} jam lagi` : 'kurang dari 1 jam lagi'
  }

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />

    <section data-tour="stages" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Menunggu pemeriksaan" value={String(counts.submitted)} detail="Perlu tindakan checker" icon="listChecks" tone={counts.submitted ? 'amber' : 'emerald'} />
      <MetricCard label="Siap dieksekusi" value={String(counts.checked)} detail="Sudah diperiksa, belum dikirim" icon="wallet" tone={counts.checked ? 'blue' : 'slate'} />
      <MetricCard label="Dalam perjalanan" value={String(counts.inflight)} detail="Belum cocok dengan mutasi bank" icon="landmark" tone={counts.inflight ? 'blue' : 'slate'} />
      <MetricCard label="Gagal" value={String(counts.failed)} detail="Periksa alasan lalu ajukan ulang" icon="checkCircle" tone={counts.failed ? 'amber' : 'emerald'} />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel title="Ajukan payout" description="Anda berperan sebagai maker. Pemeriksa dan pelaksana harus orang lain.">
        <form data-tour="create" className="grid gap-3 p-4" action={form => {
          setAmount(0)
          act(() => createPayoutAction({
            recipientId: String(form.get('recipient')),
            payoutType: String(form.get('type')) as any,
            amountRupiah: Number(form.get('amount')),
            method: String(form.get('method')) as any,
            requestKey: crypto.randomUUID(),
          }), 'Payout diajukan dan menunggu pemeriksaan checker.')
        }}>
          <label className="text-xs font-bold text-slate-800">Penerima
            <select name="recipient" required defaultValue="" className={`mt-1 ${field}`}>
              <option value="" disabled>Pilih rekening penerima</option>
              {readyRecipients.map(row => <option key={row.id} value={row.id}>{row.name} · {row.account_number_masked}</option>)}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              {readyRecipients.length
                ? `${readyRecipients.length} rekening siap dipakai.`
                : 'Belum ada rekening yang siap. Daftarkan dan verifikasi rekening, lalu tunggu masa tenang 24 jam.'}
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-800">Jenis payout
              <select name="type" className={`mt-1 ${field}`}>
                <option value="MEAL">Uang makan</option><option value="LAUNDRY">Laundry</option>
                <option value="PAYROLL">Payroll</option><option value="REFUND">Refund</option><option value="OTHER">Lainnya</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-800">Metode pengiriman
              <select name="method" value={method} onChange={event => setMethod(event.target.value as any)} className={`mt-1 ${field}`}>
                <option value="API">Duitku API (BI-Fast)</option>
                <option value="MANUAL_TRANSFER">Transfer manual</option>
                <option value="CASH">Tunai</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-bold text-slate-800">Nominal diterima penerima
            <input name="amount" type="number" inputMode="numeric" min={1} required value={amount || ''} onChange={event => setAmount(Number(event.target.value))} placeholder="0" className={`mt-1 ${field} tabular-nums`} />
          </label>
          {/* Biaya ditampilkan sebelum diajukan supaya checker menyetujui total yang sama dengan yang dibukukan. */}
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            <div className="flex justify-between px-3 py-2"><dt className="text-slate-500">Diterima penerima</dt><dd className="font-semibold tabular-nums">{rupiah(amount)}</dd></div>
            <div className="flex justify-between px-3 py-2"><dt className="text-slate-500">Biaya transfer{method === 'API' ? ' (API)' : ''}</dt><dd className="font-semibold tabular-nums">{fee ? `+ ${rupiah(fee)}` : 'Tidak ada'}</dd></div>
            <div className="flex justify-between bg-slate-50 px-3 py-2"><dt className="font-bold text-slate-700">Total keluar dari kas</dt><dd className="font-bold tabular-nums">{rupiah(amount + fee)}</dd></div>
          </dl>
          <button disabled={!capabilities.create || pending || !readyRecipients.length} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Ajukan payout</button>
          {!capabilities.create ? <p className="text-[11px] text-slate-500">Akun Anda tidak memiliki kewenangan mengajukan payout.</p> : null}
        </form>
      </SectionPanel>

      <SectionPanel
        title="Rekening penerima"
        description="Rekening baru wajib diverifikasi orang lain dan menunggu masa tenang 24 jam."
        action={capabilities.configure ? <button onClick={() => setShowRecipient(!showRecipient)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus className="h-4 w-4" />{showRecipient ? 'Tutup' : 'Tambah'}</button> : null}
      >
        <div data-tour="recipients">
          {showRecipient ? <form className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4" action={form => {
            setShowRecipient(false)
            act(() => registerRecipientAction({
              recipientType: String(form.get('recipientType')) as any,
              name: String(form.get('name')),
              bankCode: String(form.get('bankCode')),
              accountNumber: String(form.get('accountNumber')),
              accountHolderName: String(form.get('accountHolder')),
            }), 'Rekening didaftarkan. Menunggu verifikasi petugas lain dan masa tenang 24 jam.')
          }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-800">Jenis penerima<select name="recipientType" className={`mt-1 ${field}`}><option value="MEAL_MANAGER">Pengelola makan</option><option value="LAUNDRY_MANAGER">Pengelola laundry</option><option value="TEACHER">Guru</option><option value="OTHER">Lainnya</option></select></label>
              <label className="text-xs font-bold text-slate-800">Nama penerima<input name="name" required placeholder="Nama untuk ditampilkan" className={`mt-1 ${field}`} /></label>
              <label className="text-xs font-bold text-slate-800">Kode bank<input name="bankCode" required inputMode="numeric" placeholder="3 digit, contoh 014" className={`mt-1 ${field}`} /></label>
              <label className="text-xs font-bold text-slate-800">Nomor rekening<input name="accountNumber" required inputMode="numeric" placeholder="6–24 digit" className={`mt-1 ${field} tabular-nums`} /></label>
              <label className="text-xs font-bold text-slate-800 sm:col-span-2">Nama pemilik rekening<input name="accountHolder" required placeholder="Persis seperti tercetak di buku tabungan" className={`mt-1 ${field}`} /></label>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">Nomor rekening disimpan terenkripsi dan hanya ditampilkan tersamar. Pastikan digitnya benar — kesalahan ketik berarti dana terkirim ke orang lain.</p>
            <button className="min-h-11 rounded-lg border border-emerald-700 px-3 text-sm font-bold text-emerald-800">Daftarkan rekening</button>
          </form> : null}
          <div className="divide-y divide-slate-100">
            {recipients.length ? recipients.map(row => {
              const cooling = coolingLeft(row)
              return <article key={row.id} className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="block break-words text-slate-800">{row.name}</strong>
                  <span className="block font-mono text-[11px] text-slate-500">{row.account_number_masked || 'Tanpa rekening'}</span>
                  <span className="text-[11px] text-slate-400">{row.recipient_type}{row.asrama_scope ? ` · ${row.asrama_scope}` : ''}</span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {row.status === 'ACTIVE' && cooling > 0
                    ? <StatusBadge tone="amber">Masa tenang · {hoursLeft(cooling)}</StatusBadge>
                    : <StatusBadge tone={row.status === 'ACTIVE' ? 'emerald' : row.status === 'PENDING_VERIFICATION' ? 'amber' : 'slate'}>
                      {row.status === 'ACTIVE' ? 'Siap dipakai' : row.status === 'PENDING_VERIFICATION' ? 'Belum diverifikasi' : row.status}
                    </StatusBadge>}
                  {row.status === 'PENDING_VERIFICATION' ? <button disabled={!capabilities.check || pending} onClick={() => act(() => verifyRecipientAction(row.id), 'Rekening diverifikasi. Masa tenang 24 jam tetap berlaku.')} className="min-h-9 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-50">Verifikasi</button> : null}
                </div>
              </article>
            }) : <EmptyState icon={Bank} title="Belum ada rekening penerima" description="Daftarkan rekening pengelola makan, laundry, atau guru sebelum mengajukan payout." />}
          </div>
        </div>
      </SectionPanel>
    </div>

    <SectionPanel
      title="Antrean payout"
      description="Setiap kartu menunjukkan tahap saat ini dan tindakan yang menunggu."
      action={<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
        <button onClick={() => setStatusFilter('ACTIVE')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Berjalan</button>
        <button onClick={() => setStatusFilter('ALL')} className={`min-h-9 rounded-md px-3 ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Semua ({payouts.length})</button>
      </div>}
    >
      <div data-tour="board" className="divide-y divide-slate-100">
        {visiblePayouts.length ? visiblePayouts.map(row => {
          const stage = stageOf(row.status)
          const total = Number(row.amount_rupiah) + Number(row.fee_rupiah || 0)
          return <article key={row.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="break-words text-sm text-slate-900">{row.recipient_name}</strong>
                <StatusBadge tone={stage?.tone || 'slate'}>{stage?.label || row.status}</StatusBadge>
                {stage && stage.owner !== '—' ? <span className="text-[11px] text-slate-500">Menunggu {stage.owner}</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                <strong className="tabular-nums">{rupiah(row.amount_rupiah)}</strong>
                {Number(row.fee_rupiah) ? <span className="text-slate-500"> + biaya {rupiah(row.fee_rupiah)} = {rupiah(total)}</span> : null}
                <span className="text-slate-500"> · {row.payout_type} · {row.method === 'API' ? 'Duitku API' : row.method === 'CASH' ? 'Tunai' : 'Transfer manual'}</span>
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{stage?.next}</p>
              {row.failure_reason ? <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{row.failure_reason}</p> : null}
              {row.provider_reference ? <p className="mt-1 break-all font-mono text-[10px] text-slate-400">Ref {row.provider_reference}</p> : null}
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
              {row.status === 'SUBMITTED' ? <button disabled={!capabilities.check || pending} onClick={() => act(() => checkPayoutAction(row.id), 'Payout lolos pemeriksaan dan siap dieksekusi.')} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:opacity-50">Periksa payout</button> : null}
              {row.status === 'CHECKED' && row.method === 'API' ? <button disabled={!capabilities.execute || pending} onClick={() => setConfirmApi(row)} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Kirim via API</button> : null}
              {row.status === 'CHECKED' && row.method !== 'API' ? <button disabled={!capabilities.execute || pending} onClick={() => setExecuteTarget({ id: row.id, reference: '', name: row.recipient_name, amount: total })} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Catat eksekusi</button> : null}
              {row.status === 'PROVIDER_SUCCESS' ? <button disabled={!capabilities.execute || pending} onClick={() => act(() => reconcilePayoutAction(row.id), 'Payout ditandai cocok dengan mutasi bank.')} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:opacity-50">Tandai direkonsiliasi</button> : null}
            </div>
          </article>
        }) : <EmptyState icon={PaperPlaneTilt} title={statusFilter === 'ACTIVE' ? 'Tidak ada payout berjalan' : 'Belum ada payout'} description={statusFilter === 'ACTIVE' ? 'Semua payout sudah direkonsiliasi atau dibatalkan.' : 'Ajukan payout pertama lewat formulir di atas.'} />}
      </div>
    </SectionPanel>

    {/* Eksekusi manual butuh nomor bukti; dulu diminta lewat window.prompt yang tidak dapat divalidasi. */}
    {executeTarget ? <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" onClick={() => setExecuteTarget(null)}>
      <section role="dialog" aria-modal="true" aria-label="Catat eksekusi payout" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Clock className="h-5 w-5" /></span>
          <div><h2 className="font-bold text-slate-900">Catat eksekusi payout</h2><p className="mt-1 text-sm leading-5 text-slate-600">Isi hanya setelah dana benar-benar dikirim ke {executeTarget.name} sebesar {rupiah(executeTarget.amount)}.</p></div>
        </div>
        <label className="mt-4 block text-xs font-bold text-slate-800">Nomor referensi transfer atau kuitansi
          <input autoFocus value={executeTarget.reference} onChange={event => setExecuteTarget({ ...executeTarget, reference: event.target.value })} placeholder="Contoh: TRF20260813001" className={`mt-1.5 ${field}`} />
          <span className="mt-1 block text-[11px] font-normal text-slate-500">Nomor ini dipakai untuk mencocokkan payout dengan mutasi rekening nanti.</span>
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setExecuteTarget(null)} className="min-h-11 rounded-lg border border-slate-200 text-sm font-bold text-slate-700">Batal</button>
          <button disabled={pending || executeTarget.reference.trim().length < 3} onClick={() => {
            const target = executeTarget
            setExecuteTarget(null)
            act(() => executePayoutAction({ id: target.id, reference: target.reference.trim() }), 'Eksekusi payout tercatat dan jurnal diposting.')
          }} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Simpan eksekusi</button>
        </div>
      </section>
    </div> : null}

    <ConfirmAction
      open={Boolean(confirmApi)}
      title="Kirim dana lewat Duitku API?"
      description={confirmApi ? `${rupiah(Number(confirmApi.amount_rupiah))} akan ditransfer ke ${confirmApi.recipient_name}.` : ''}
      impact={[
        'Transfer BI-Fast berjalan langsung dan tidak dapat dibatalkan dari aplikasi.',
        confirmApi ? `Total keluar dari kas ${rupiah(Number(confirmApi.amount_rupiah) + Number(confirmApi.fee_rupiah || 0))} termasuk biaya.` : '',
        'Pastikan nomor rekening penerima sudah dicek ulang ke pemiliknya.',
      ].filter(Boolean)}
      confirmLabel="Kirim sekarang"
      confirmPhrase="KIRIM"
      pending={pending}
      onCancel={() => setConfirmApi(null)}
      onConfirm={() => {
        const target = confirmApi
        setConfirmApi(null)
        act(() => executeApiPayoutAction(target.id), 'Perintah transfer dikirim ke provider.')
      }}
    />

    {payouts.some(row => row.status === 'PROVIDER_SUCCESS') ? <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      Sukses di provider belum berarti selesai. Cocokkan dulu dengan mutasi rekening di halaman Operasi, baru tandai direkonsiliasi.
    </p> : null}
  </div>
}
