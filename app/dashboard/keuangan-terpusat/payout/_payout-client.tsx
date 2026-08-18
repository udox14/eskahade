'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bank, CheckCircle, Clock, FileXls, PaperPlaneTilt, UserPlus } from '@phosphor-icons/react'
import {
  approvePayoutAction, approvePayoutsAction, createPayoutAction, payApiPayoutAction, payPayoutAction,
  importPayoutsAction, importRecipientsAction,
  registerRecipientAction, verifyRecipientAction,
} from './actions'
import type { PayoutImportRow, RecipientImportRow } from './actions'
import { BulkImport, asInteger, asText } from '../_components/bulk-import'
import { BulkActionBar, RupiahInput } from '../_components/finance-inputs'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { accountNumberProblem, bankCodeProblem, BANK_CODES, BANK_CODE_OTHER } from '@/lib/finance/banks'

const field = FINANCE_FIELD_CLASS
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

type Capabilities = { view: boolean; create: boolean; check: boolean; configure: boolean; audit: boolean }

/**
 * Alur payout adalah rantai empat tahap dengan pemisahan tugas. Urutan dan
 * pemilik tahapnya ditulis eksplisit di sini supaya UI dapat menunjukkan
 * posisi tiap payout, bukan sekadar menampilkan kode status.
 */
const STAGES = [
  { status: 'DIAJUKAN', label: 'Menunggu persetujuan', owner: 'Checker', tone: 'amber' as const, next: 'Checker memeriksa lalu menyetujui.' },
  { status: 'DISETUJUI', label: 'Siap dibayar', owner: 'Checker', tone: 'blue' as const, next: 'Checker mengirim dana lalu mencatat buktinya.' },
  { status: 'DIPROSES', label: 'Sedang dikirim provider', owner: 'Provider', tone: 'blue' as const, next: 'Menunggu konfirmasi provider.' },
  { status: 'DIBAYAR', label: 'Selesai dibayar', owner: '—', tone: 'emerald' as const, next: 'Tidak ada tindakan lanjutan.' },
  { status: 'GAGAL', label: 'Gagal', owner: 'Maker', tone: 'red' as const, next: 'Periksa alasan kegagalan lalu ajukan ulang.' },
  { status: 'DIBATALKAN', label: 'Dibatalkan', owner: '—', tone: 'slate' as const, next: 'Tidak ada tindakan lanjutan.' },
] as const

const stageOf = (status: string) => STAGES.find(item => item.status === status)

/** Label yang lazim ditulis bendahara di Excel, dipetakan ke nilai yang diterima database. */
const RECIPIENT_TYPES: Record<string, 'MEAL_MANAGER'|'LAUNDRY_MANAGER'|'TEACHER'|'OTHER'> = {
  'pengelola makan': 'MEAL_MANAGER', 'meal_manager': 'MEAL_MANAGER', 'makan': 'MEAL_MANAGER',
  'pengelola laundry': 'LAUNDRY_MANAGER', 'laundry_manager': 'LAUNDRY_MANAGER', 'laundry': 'LAUNDRY_MANAGER',
  'guru': 'TEACHER', 'teacher': 'TEACHER',
  'lainnya': 'OTHER', 'other': 'OTHER',
}
const PAYOUT_TYPES: Record<string, 'MEAL'|'LAUNDRY'|'PAYROLL'|'REFUND'|'OTHER'> = {
  'uang makan': 'MEAL', 'makan': 'MEAL', 'meal': 'MEAL',
  'laundry': 'LAUNDRY',
  'payroll': 'PAYROLL', 'gaji': 'PAYROLL',
  'refund': 'REFUND', 'pengembalian': 'REFUND',
  'lainnya': 'OTHER', 'other': 'OTHER',
}
const PAYOUT_METHODS: Record<string, 'API'|'MANUAL_TRANSFER'|'CASH'> = {
  'api': 'API', 'duitku': 'API', 'duitku api': 'API', 'bi-fast': 'API',
  'transfer manual': 'MANUAL_TRANSFER', 'manual': 'MANUAL_TRANSFER', 'manual_transfer': 'MANUAL_TRANSFER',
  'tunai': 'CASH', 'cash': 'CASH',
}

type RecipientDraft = { bank: string; manualBank: string; account: string; repeat: string }
const emptyRecipientDraft: RecipientDraft = { bank: BANK_CODES[0].code, manualBank: '', account: '', repeat: '' }

const TOUR: TourStep[] = [
  { target: '[data-tour="stages"]', title: 'Payout melewati empat tahap', body: 'Diajukan, diperiksa, dieksekusi, lalu direkonsiliasi. Pembuat, pemeriksa, dan pelaksana wajib tiga orang berbeda — database menolak bila sama.' },
  { target: '[data-tour="recipients"]', title: 'Daftarkan rekening lebih dulu', body: 'Rekening baru wajib diverifikasi petugas lain sebelum bisa menerima transfer. Yang mendaftarkan tidak boleh jadi yang memverifikasi.' },
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
  /**
   * Nomor rekening hanya tampil tersamar setelah tersimpan, jadi salah ketik
   * tidak akan terlihat lagi belakangan. Karena itu nomornya diketik dua kali
   * dan kode banknya dipilih, bukan dihafal.
   */
  const [recipientDraft, setRecipientDraft] = useState(emptyRecipientDraft)
  const [importMode, setImportMode] = useState<'recipients' | 'payouts' | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const tour = useFinanceTour('payout')

  const bankCode = recipientDraft.bank === BANK_CODE_OTHER ? recipientDraft.manualBank : recipientDraft.bank
  const bankProblem = bankCodeProblem(bankCode)
  const accountProblem = accountNumberProblem(recipientDraft.account)
  const repeatProblem = !recipientDraft.repeat
    ? 'Ketik ulang nomor rekening untuk memastikan tidak ada salah ketik.'
    : recipientDraft.repeat.replace(/\s/g, '') !== recipientDraft.account.replace(/\s/g, '')
      ? 'Kedua nomor rekening belum sama. Periksa lagi buku tabungan penerima.'
      : null
  const recipientReady = !bankProblem && !accountProblem && !repeatProblem

  function closeRecipientForm() {
    setShowRecipient(false)
    setRecipientDraft(emptyRecipientDraft)
  }

  const fee = method === 'API' ? apiFeeRupiah : 0
  const activeRecipients = recipients.filter(row => row.status === 'ACTIVE')
  // Rekening siap dipakai begitu diverifikasi petugas lain; masa tenang 24 jam dihapus.
  const readyRecipients = activeRecipients

  const visiblePayouts = useMemo(() => statusFilter === 'ALL'
    ? payouts
    : payouts.filter(row => !['DIBAYAR', 'DIBATALKAN'].includes(row.status)), [payouts, statusFilter])

  const counts = useMemo(() => ({
    submitted: payouts.filter(row => row.status === 'DIAJUKAN').length,
    checked: payouts.filter(row => row.status === 'DISETUJUI').length,
    inflight: payouts.filter(row => row.status === 'DIPROSES').length,
    failed: payouts.filter(row => row.status === 'GAGAL').length,
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

  /**
   * Aksi massal hanya untuk tahap yang memang menunggu satu keputusan berulang:
   * meloloskan pemeriksaan dan menandai rekonsiliasi. Eksekusi pengiriman dana
   * sengaja TIDAK dimassalkan — tiap transfer tetap dikonfirmasi satu per satu.
   */
  const selectableCheck = visiblePayouts.filter(row => row.status === 'DIAJUKAN')
  const selectableReconcile: any[] = []
  const chosenCheck = selectableCheck.filter(row => selected.has(row.id))
  const chosenReconcile = selectableReconcile.filter(row => selected.has(row.id))
  const canSelect = (row: any) => (row.status === 'DIAJUKAN' && capabilities.check) || (row.status === 'PROVIDER_SUCCESS' && capabilities.configure)

  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function runBatch(work: () => Promise<any>, verb: string) {
    start(async () => {
      const outcome = await work()
      setSelected(new Set())
      if (!outcome?.success) {
        const message = outcome?.error || 'Tindakan massal tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
        return
      }
      const failed = outcome.rejected?.length ?? 0
      setResult({
        tone: outcome.created ? 'success' : 'error',
        message: outcome.created ? `${outcome.created} payout ${verb}.` : `Tidak ada payout yang ${verb}.`,
        detail: failed ? `${failed} ditolak: ${outcome.rejected.map((item: any) => item.reason).join(' · ')}` : undefined,
      })
      if (outcome.created) toast.success(`${outcome.created} payout ${verb}.`)
      else toast.error('Tidak ada yang berubah.')
      router.refresh()
    })
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
      <SectionPanel
        title="Ajukan payout"
        description="Anda berperan sebagai maker. Pemeriksa dan pelaksana harus orang lain."
        action={capabilities.create ? <button type="button" onClick={() => setImportMode(mode => mode === 'payouts' ? null : 'payouts')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />{importMode === 'payouts' ? 'Tutup impor' : 'Impor Excel'}</button> : null}
      >
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
                : 'Belum ada rekening yang siap. Daftarkan lalu minta petugas lain memverifikasinya.'}
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
            <div className="mt-1"><RupiahInput name="amount" value={amount} onValueChange={setAmount} min={1} /></div>
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
        description="Rekening baru wajib diverifikasi petugas lain sebelum bisa menerima transfer."
        action={capabilities.configure ? <div className="flex flex-wrap gap-2">
          <button onClick={() => showRecipient ? closeRecipientForm() : setShowRecipient(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus className="h-4 w-4" />{showRecipient ? 'Tutup' : 'Tambah'}</button>
          <button type="button" onClick={() => setImportMode(mode => mode === 'recipients' ? null : 'recipients')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls className="h-4 w-4" />{importMode === 'recipients' ? 'Tutup impor' : 'Impor Excel'}</button>
        </div> : null}
      >
        <div data-tour="recipients">
          {showRecipient ? <form className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4" action={form => {
            const account = recipientDraft.account.replace(/\s/g, '')
            closeRecipientForm()
            act(() => registerRecipientAction({
              recipientType: String(form.get('recipientType')) as any,
              name: String(form.get('name')),
              bankCode: bankCode.trim(),
              accountNumber: account,
              accountHolderName: String(form.get('accountHolder')),
            }), 'Rekening didaftarkan. Menunggu verifikasi petugas lain.')
          }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-800">Jenis penerima<select name="recipientType" className={`mt-1 ${field}`}><option value="MEAL_MANAGER">Pengelola makan</option><option value="LAUNDRY_MANAGER">Pengelola laundry</option><option value="TEACHER">Guru</option><option value="OTHER">Lainnya</option></select></label>
              <label className="text-xs font-bold text-slate-800">Nama penerima<input name="name" required placeholder="Nama untuk ditampilkan" className={`mt-1 ${field}`} /></label>
              <label className="text-xs font-bold text-slate-800">Bank
                <select value={recipientDraft.bank} onChange={event => setRecipientDraft(draft => ({ ...draft, bank: event.target.value, manualBank: '' }))} className={`mt-1 ${field}`}>
                  {BANK_CODES.map(item => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}
                  <option value={BANK_CODE_OTHER}>Bank lain — isi kode manual</option>
                </select>
                {recipientDraft.bank === BANK_CODE_OTHER ? <>
                  <input value={recipientDraft.manualBank} onChange={event => setRecipientDraft(draft => ({ ...draft, manualBank: event.target.value.replace(/\D/g, '').slice(0, 3) }))} inputMode="numeric" placeholder="3 angka, lihat di buku tabungan" className={`mt-1.5 ${field} tabular-nums`} />
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">Kode bank tercetak di buku tabungan atau tampil di aplikasi mBanking penerima.</span>
                </> : null}
              </label>
              <label className="text-xs font-bold text-slate-800">Nomor rekening
                <input value={recipientDraft.account} onChange={event => setRecipientDraft(draft => ({ ...draft, account: event.target.value.replace(/[^\d\s]/g, '') }))} inputMode="numeric" placeholder="6–24 angka" className={`mt-1 ${field} tabular-nums`} />
                {accountProblem && recipientDraft.account ? <span className="mt-1 block text-[11px] font-semibold text-red-700">{accountProblem}</span> : null}
              </label>
              <label className="text-xs font-bold text-slate-800">Ketik ulang nomor rekening
                {/* Tempel disengaja diblokir: menempel angka yang sama dua kali tidak membuktikan apa pun. */}
                <input value={recipientDraft.repeat} onChange={event => setRecipientDraft(draft => ({ ...draft, repeat: event.target.value.replace(/[^\d\s]/g, '') }))} onPaste={event => event.preventDefault()} inputMode="numeric" placeholder="Ketik lagi, jangan disalin" className={`mt-1 ${field} tabular-nums`} />
                {recipientDraft.repeat && repeatProblem ? <span className="mt-1 block text-[11px] font-semibold text-red-700">{repeatProblem}</span>
                  : recipientDraft.repeat ? <span className="mt-1 block text-[11px] font-semibold text-emerald-700">Kedua nomor sudah sama.</span>
                    : <span className="mt-1 block text-[11px] font-normal text-slate-500">Ketik manual dari buku tabungan, bukan disalin dari kolom sebelumnya.</span>}
              </label>
              <label className="text-xs font-bold text-slate-800 sm:col-span-2">Nama pemilik rekening<input name="accountHolder" required placeholder="Persis seperti tercetak di buku tabungan" className={`mt-1 ${field}`} /></label>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">Nomor rekening disimpan terenkripsi dan hanya ditampilkan tersamar. Setelah tersimpan, salah ketik tidak akan terlihat lagi — dana akan terkirim ke orang lain.</p>
            <button disabled={pending || !recipientReady} className="min-h-11 rounded-lg border border-emerald-700 px-3 text-sm font-bold text-emerald-800 disabled:border-slate-200 disabled:text-slate-400">Daftarkan rekening</button>
          </form> : null}
          <div className="divide-y divide-slate-100">
            {recipients.length ? recipients.map(row => {
              return <article key={row.id} className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="block break-words text-slate-800">{row.name}</strong>
                  <span className="block font-mono text-[11px] text-slate-500">{row.account_number_masked || 'Tanpa rekening'}</span>
                  <span className="text-[11px] text-slate-400">{row.recipient_type}{row.asrama_scope ? ` · ${row.asrama_scope}` : ''}</span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {<StatusBadge tone={row.status === 'ACTIVE' ? 'emerald' : row.status === 'PENDING_VERIFICATION' ? 'amber' : 'slate'}>
                      {row.status === 'ACTIVE' ? 'Siap dipakai' : row.status === 'PENDING_VERIFICATION' ? 'Belum diverifikasi' : row.status}
                    </StatusBadge>}
                  {row.status === 'PENDING_VERIFICATION' ? <button disabled={!capabilities.check || pending} onClick={() => act(() => verifyRecipientAction(row.id), 'Rekening diverifikasi dan siap dipakai.')} className="min-h-9 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-50">Verifikasi</button> : null}
                </div>
              </article>
            }) : <EmptyState icon={Bank} title="Belum ada rekening penerima" description="Daftarkan rekening pengelola makan, laundry, atau guru sebelum mengajukan payout." />}
          </div>
        </div>
      </SectionPanel>
    </div>

    {importMode === 'recipients' ? <BulkImport<Omit<RecipientImportRow, 'row'>>
      title="Impor massal rekening penerima"
      description="Daftarkan banyak rekening sekaligus. Setiap rekening tetap wajib diverifikasi petugas lain sebelum bisa dipakai."
      templateName="Template_Rekening_Penerima"
      sheetName="Penerima"
      disabled={!capabilities.configure}
      columns={[
        { key: 'jenis', label: 'Jenis penerima', example: 'Pengelola makan' },
        { key: 'nama', label: 'Nama penerima', example: 'Dapur Pusat' },
        { key: 'kodebank', label: 'Kode bank', example: '014' },
        { key: 'norekening', label: 'Nomor rekening', example: '1234567890' },
        { key: 'pemilik', label: 'Nama pemilik rekening', example: 'H. Ahmad Sopandi' },
      ]}
      note={<>
        <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Jenis penerima boleh ditulis <strong>Pengelola makan</strong>, <strong>Pengelola laundry</strong>, <strong>Guru</strong>, atau <strong>Lainnya</strong>.</li>
          <li>Format kolom kode bank dan nomor rekening sebagai <strong>Teks</strong> di Excel, supaya angka nol di depan tidak hilang. Kode 2 digit otomatis dilengkapi jadi 3 digit.</li>
          <li>Impor tidak melewati pengaman: rekening masuk berstatus belum diverifikasi dan belum bisa menerima transfer sampai ada petugas lain yang memverifikasinya.</li>
        </ul>
      </>}
      parseRow={get => {
        const jenis = RECIPIENT_TYPES[asText(get('jenis')).toLowerCase()]
        if (!jenis) return { error: `Jenis penerima "${asText(get('jenis')) || '(kosong)'}" tidak dikenal.` }
        const nama = asText(get('nama'))
        if (nama.length < 2) return { error: 'Nama penerima wajib diisi.' }
        const bankCode = asText(get('kodebank')).replace(/\D/g, '').padStart(3, '0')
        const bankProblem = bankCodeProblem(bankCode)
        if (bankProblem) return { error: bankProblem }
        const accountNumber = asText(get('norekening')).replace(/\s/g, '')
        const accountProblem = accountNumberProblem(accountNumber)
        if (accountProblem) return { error: accountProblem }
        const accountHolderName = asText(get('pemilik'))
        if (accountHolderName.length < 2) return { error: 'Nama pemilik rekening wajib diisi persis seperti di buku tabungan.' }
        return { value: { recipientType: jenis, name: nama, bankCode, accountNumber, accountHolderName } }
      }}
      onSubmit={values => importRecipientsAction(values)}
    /> : null}

    {importMode === 'payouts' ? <BulkImport<Omit<PayoutImportRow, 'row'>>
      title="Impor massal pengajuan payout"
      description="Ajukan banyak payout sekaligus. Anda tetap tercatat sebagai maker; pemeriksa dan pelaksana tetap harus orang lain."
      templateName="Template_Pengajuan_Payout"
      sheetName="Payout"
      disabled={!capabilities.create || !readyRecipients.length}
      disabledReason={!readyRecipients.length ? 'Belum ada rekening penerima yang siap dipakai. Daftarkan lalu minta petugas lain memverifikasinya.' : undefined}
      columns={[
        { key: 'penerima', label: 'Nama penerima', example: readyRecipients[0]?.name ?? 'Dapur Pusat' },
        { key: 'akhirrekening', label: '4 angka akhir rekening', example: (readyRecipients[0]?.account_number_masked ?? '7890').slice(-4) },
        { key: 'jenis', label: 'Jenis payout', example: 'Uang makan' },
        { key: 'nominal', label: 'Nominal diterima penerima', example: 2_500_000 },
        { key: 'metode', label: 'Metode', example: 'Transfer manual' },
      ]}
      note={<>
        <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Penerima dicocokkan dari nama <em>dan</em> 4 angka akhir rekening. Bila dua rekening cocok keduanya, barisnya ditolak agar dana tidak salah alamat.</li>
          <li>Nominal adalah jumlah yang <strong>diterima penerima</strong>. Biaya transfer API {rupiah(apiFeeRupiah)} ditambahkan sistem di atasnya.</li>
          <li>Berkas yang sama diunggah dua kali pada hari yang sama terdeteksi sebagai kiriman ulang dan tidak menghasilkan payout kedua.</li>
        </ul>
      </>}
      parseRow={get => {
        const nameText = asText(get('penerima')).toLowerCase()
        const last4 = asText(get('akhirrekening')).replace(/\D/g, '').slice(-4)
        if (!nameText) return { error: 'Nama penerima wajib diisi.' }
        const matches = readyRecipients.filter(item => String(item.name).toLowerCase() === nameText
          && (!last4 || String(item.account_number_masked || '').slice(-4) === last4))
        if (!matches.length) return { error: `Tidak ada rekening siap dipakai bernama "${asText(get('penerima'))}"${last4 ? ` dengan akhiran ${last4}` : ''}.` }
        if (matches.length > 1) return { error: `Ada ${matches.length} rekening cocok untuk "${asText(get('penerima'))}". Isi 4 angka akhir rekening agar tidak ambigu.` }
        const payoutType = PAYOUT_TYPES[asText(get('jenis')).toLowerCase()]
        if (!payoutType) return { error: `Jenis payout "${asText(get('jenis')) || '(kosong)'}" tidak dikenal.` }
        const method = PAYOUT_METHODS[asText(get('metode')).toLowerCase()]
        if (!method) return { error: `Metode "${asText(get('metode')) || '(kosong)'}" tidak dikenal. Pakai API, Transfer manual, atau Tunai.` }
        const amountRupiah = asInteger(get('nominal'))
        if (!amountRupiah || amountRupiah < 1) return { error: 'Nominal harus angka bulat lebih dari nol.' }
        return { value: { recipientId: matches[0].id, payoutType, amountRupiah, method } }
      }}
      onSubmit={values => importPayoutsAction(values)}
    /> : null}

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
          return <article key={row.id} className="grid gap-3 p-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            {canSelect(row)
              ? <input type="checkbox" aria-label={`Pilih payout ${row.recipient_name} ${rupiah(row.amount_rupiah)}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} className="h-5 w-5 shrink-0 accent-emerald-700" />
              : <span aria-hidden className="hidden h-5 w-5 lg:block" />}
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
              {row.provider_reference ? <p className="mt-1 break-all font-mono text-xs text-slate-400">Ref {row.provider_reference}</p> : null}
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
              {row.status === 'DIAJUKAN' ? <button disabled={!capabilities.check || pending} onClick={() => act(() => approvePayoutAction(row.id), 'Pencairan disetujui dan siap dibayar.')} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:opacity-50">Setujui</button> : null}
              {row.status === 'DISETUJUI' && row.method === 'API' ? <button disabled={!capabilities.check || pending} onClick={() => setConfirmApi(row)} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Kirim via API</button> : null}
              {row.status === 'DISETUJUI' && row.method !== 'API' ? <button disabled={!capabilities.check || pending} onClick={() => setExecuteTarget({ id: row.id, reference: '', name: row.recipient_name, amount: total })} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Catat pembayaran</button> : null}
            </div>
          </article>
        }) : <EmptyState icon={PaperPlaneTilt} title={statusFilter === 'ACTIVE' ? 'Tidak ada payout berjalan' : 'Belum ada payout'} description={statusFilter === 'ACTIVE' ? 'Semua pencairan sudah dibayar atau dibatalkan.' : 'Ajukan payout pertama lewat formulir di atas.'} />}
      </div>
      {selectableCheck.length > 1 && capabilities.check
        ? <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
          <button type="button" onClick={() => setSelected(new Set(selectableCheck.filter(canSelect).map(row => row.id)))} className="font-bold text-blue-700 underline">Pilih semua yang bisa disetujui</button>
          <span>Centang beberapa pencairan untuk menyetujuinya sekaligus.</span>
        </div>
        : null}
    </SectionPanel>

    <BulkActionBar count={chosenCheck.length} noun="pencairan" onClear={() => setSelected(new Set())}>
      {chosenCheck.length ? <button type="button" disabled={pending} onClick={() => runBatch(() => approvePayoutsAction(chosenCheck.map(row => row.id)), 'disetujui')}
        className="min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-slate-900 disabled:opacity-50">Setujui {chosenCheck.length}</button> : null}
    </BulkActionBar>

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
            act(() => payPayoutAction({ id: target.id, reference: target.reference.trim() }), 'Pembayaran pencairan tercatat dan jurnal diposting.')
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
        act(() => payApiPayoutAction(target.id), 'Perintah transfer dikirim ke provider.')
      }}
    />

    {payouts.some(row => row.status === 'PROVIDER_SUCCESS') ? <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      Sukses di provider belum berarti selesai. Cocokkan dulu dengan mutasi rekening di halaman Operasi, baru tandai direkonsiliasi.
    </p> : null}
  </div>
}
