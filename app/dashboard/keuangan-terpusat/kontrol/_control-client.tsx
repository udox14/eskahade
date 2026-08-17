'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowClockwise, CheckCircle, MagnifyingGlass, ShieldCheck, Warning } from '@phosphor-icons/react'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { ExportButton, RupiahInput } from '../_components/finance-inputs'
import { retryOutboxAction, revokeFinanceSessionAction, updateFinanceSettingAction } from './actions'

const field = FINANCE_FIELD_CLASS

const settingLabels: Record<string, string> = {
  finance_payment_intent_ttl_hours: 'Masa berlaku instruksi top-up',
  finance_soft_alerts: 'Ambang peringatan lunak',
  finance_meal_cutoff: 'Batas waktu pengembalian alokasi makan',
  finance_laundry_cutoff: 'Batas waktu pengembalian alokasi laundry',
  finance_payout_api_fee_rupiah: 'Biaya transfer payout API',
}
/** Penjelasan singkat tiap pengaturan; tanpa ini nilainya sekadar angka tanpa konteks. */
const settingHints: Record<string, string> = {
  finance_payment_intent_ttl_hours: 'Berapa lama instruksi pembayaran wali tetap berlaku sebelum kedaluwarsa. Semakin panjang, semakin banyak pembayaran terlambat yang perlu direview manual.',
  finance_soft_alerts: 'Ambang yang memunculkan indikator di halaman Ringkasan. Bukan penolakan transaksi — hanya penanda untuk diperiksa.',
  finance_meal_cutoff: 'Tanggal dan jam tiap bulan sebagai batas terakhir alokasi makan dapat dikembalikan ke Titipan.',
  finance_laundry_cutoff: 'Batas terakhir alokasi laundry dapat dikembalikan ke Titipan.',
  finance_payout_api_fee_rupiah: 'Biaya yang dibebankan tiap transfer payout via API. Ditampilkan ke maker sebelum pengajuan.',
}

const prettyJson = (value: string) => { try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value } }
const compactJson = (value: string | null) => { if (!value) return '' ; try { return JSON.stringify(JSON.parse(value)) } catch { return value } }

function parseJson<T>(raw: string, fallback: T): T {
  try { return { ...fallback, ...(JSON.parse(raw) as object) } } catch { return fallback }
}

/**
 * `created_at` audit disimpan UTC tanpa penanda zona. Tanggalnya dihitung di
 * Asia/Jakarta memakai konvensi yang sama dengan agregat authTrend di server
 * (`date(created_at,'+7 hours')`), supaya "hari ini" di filter berarti hari ini
 * menurut jam pesantren, bukan menurut UTC.
 */
function jakartaDay(value: string): string {
  const utc = new Date(`${String(value || '').trim().replace(' ', 'T')}Z`)
  if (Number.isNaN(utc.getTime())) return ''
  return new Date(utc.getTime() + 7 * 3_600_000).toISOString().slice(0, 10)
}

const RANGES = [
  { id: 'ALL', label: 'Semua' },
  { id: 'TODAY', label: 'Hari ini' },
  { id: '7', label: '7 hari' },
  { id: '30', label: '30 hari' },
  { id: 'CUSTOM', label: 'Kustom' },
] as const
type RangeId = typeof RANGES[number]['id']

const TOUR: TourStep[] = [
  { target: '[data-tour="settings"]', title: 'Pengaturan runtime', body: 'Nilai di sini mengubah perilaku seluruh modul keuangan tanpa perlu deploy. Setiap kolom sudah berbentuk sesuai isinya — angka, rupiah, tanggal, atau jam — dan perubahannya tercatat di audit log.' },
  { target: '[data-tour="outbox"]', title: 'Antrean event', body: 'Notifikasi dan integrasi dikirim lewat antrean ini. Event berstatus FAILED bisa dicoba ulang; retry hanya mengembalikannya ke antrean, tidak mengubah transaksinya.' },
  { target: '[data-tour="sessions"]', title: 'Sesi dan MFA staf', body: 'Cabut sesi bila ada perangkat yang hilang atau akses mencurigakan. Pencabutan berlaku langsung dan diminta konfirmasi lebih dulu.' },
  { target: '[data-tour="audit"]', title: 'Audit trail', body: 'Saring dengan rentang waktu, pelaku, tindakan, dan jenis entitas — tidak perlu mengetik kata kunci menebak-nebak. Hasil yang tersaring bisa diunduh sebagai Excel.' },
]

type Mutate = (work: () => Promise<any>, success: string) => void

export function FinanceControlClient({ data }: { data: any }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<any>(null)
  const tour = useFinanceTour('kontrol')
  const now = Number(data.nowMs)
  const failedOutbox = data.outbox.filter((row: any) => row.status === 'FAILED')
  const activeSessions = data.sessions.filter((row: any) => !row.revoked_at && new Date(row.expires_at).getTime() > now)
  const failedAuth = data.authTrend.reduce((sum: number, row: any) => sum + Number(row.failed), 0)

  const act: Mutate = (work, success) => startTransition(async () => {
    try {
      const outcome = await work()
      if (!outcome?.success) {
        const message = outcome?.error || 'Tindakan gagal.'
        setResult({ tone: 'error', message })
        toast.error(message)
        return
      }
      setResult({ tone: 'success', message: success })
      toast.success(success)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tindakan gagal.'
      setResult({ tone: 'error', message })
      toast.error(message)
    }
  })

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Audit dimuat" value={String(data.audit.length)} detail={data.canAudit ? '500 aktivitas terbaru' : 'Khusus checker/auditor'} icon="fileSpreadsheet" tone="blue" />
      <MetricCard label="Outbox gagal" value={String(failedOutbox.length)} detail={`${data.outbox.filter((row: any) => row.status === 'PENDING').length} event pending`} icon="listChecks" tone={failedOutbox.length ? 'amber' : 'emerald'} />
      <MetricCard label="Sesi finance aktif" value={String(activeSessions.length)} detail={`${data.mfa.length} staf memiliki MFA`} icon="lock" tone="slate" />
      <MetricCard label="Login gagal 14 hari" value={String(failedAuth)} detail="Agregat finance auth attempts" icon="checkCircle" tone={failedAuth ? 'amber' : 'emerald'} />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <section className="grid gap-4 xl:grid-cols-2">
      <SettingsPanel data={data} act={act} pending={pending} />
      <OutboxPanel data={data} act={act} pending={pending} />
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <SessionsPanel data={data} now={now} pending={pending} onRevoke={setConfirmRevoke} />
      <AuthTrendPanel data={data} />
    </section>

    {data.canAudit
      ? <AuditPanel data={data} now={now} />
      : <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Warning className="mr-2 inline h-5 w-5" />Audit trail terperinci hanya tersedia untuk checker Dewan Santri.</div>}

    <ConfirmAction
      open={Boolean(confirmRevoke)}
      tone="red"
      title={`Cabut sesi keuangan ${confirmRevoke?.user_name ?? ''}?`}
      description="Sesi berakhir seketika di seluruh perangkat yang memakainya."
      impact={[
        'Pekerjaan yang belum disimpan di perangkat tersebut akan hilang.',
        'Staf harus masuk ulang beserta verifikasi tambahan sebelum bisa melanjutkan.',
        'Pencabutan tercatat di audit log dengan nama Anda dan tidak dapat dibatalkan.',
      ]}
      confirmLabel="Cabut sesi"
      pending={pending}
      onCancel={() => setConfirmRevoke(null)}
      onConfirm={() => {
        const target = confirmRevoke
        setConfirmRevoke(null)
        act(() => revokeFinanceSessionAction(target.id), 'Sesi finance dicabut.')
      }}
    />
  </div>
}

function SettingsPanel({ data, act, pending }: { data: any; act: Mutate; pending: boolean }) {
  return <SectionPanel title="Pengaturan runtime" description="Setiap nilai punya kolomnya sendiri; JSON dirakit otomatis dan tetap divalidasi ulang di server.">
    <div data-tour="settings" className="divide-y divide-slate-100">
      {data.settings.map((row: any) => <SettingForm key={row.key} row={row} canConfigure={data.canConfigure} act={act} pending={pending} />)}
    </div>
    {!data.canConfigure ? <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Anda dapat melihat pengaturan, tetapi hanya bendahara pusat yang dapat mengubahnya.</p> : null}
  </SectionPanel>
}

/**
 * Satu pengaturan, satu formulir. Kolomnya dibentuk sesuai isi nilainya —
 * sebelumnya semua JSON diedit sebagai teks mentah, sehingga satu koma keliru
 * membuat penyimpanan gagal dan bendahara tidak tahu bagian mana yang salah.
 */
function SettingForm({ row, canConfigure, act, pending }: { row: any; canConfigure: boolean; act: Mutate; pending: boolean }) {
  const label = settingLabels[row.key] || row.key
  const hint = settingHints[row.key]

  const [hours, setHours] = useState(() => Number(row.value) || 24)
  const [fee, setFee] = useState(() => Number(row.value) || 0)
  const [alerts, setAlerts] = useState(() => parseJson(row.value, { topup_rupiah: 0, student_balance_rupiah: 0, aggregate_float_rupiah: 0 }))
  const [cutoff, setCutoff] = useState(() => parseJson(row.value, { day: 25, time: '23:59' }))
  const [raw, setRaw] = useState(() => (row.value.trim().startsWith('{') ? prettyJson(row.value) : row.value))

  let value = raw
  let problem: string | null = null
  let fields: React.ReactNode

  if (row.key === 'finance_payment_intent_ttl_hours') {
    value = String(hours)
    problem = Number.isSafeInteger(hours) && hours >= 1 && hours <= 168 ? null : 'Isi 1–168 jam.'
    fields = <label className="grid gap-1 text-xs font-semibold text-slate-700">Jam
      <div className="flex items-center gap-2">
        <input type="number" min={1} max={168} value={hours} disabled={!canConfigure} onChange={event => setHours(Number(event.target.value))} className={`${field} tabular-nums sm:w-32`} />
        <span className="text-xs text-slate-500">jam ({(hours / 24).toFixed(hours % 24 ? 1 : 0)} hari)</span>
      </div>
    </label>
  } else if (row.key === 'finance_payout_api_fee_rupiah') {
    value = String(fee)
    problem = Number.isSafeInteger(fee) && fee >= 0 && fee <= 100_000 ? null : 'Isi rupiah bulat 0–100.000.'
    fields = <div className="sm:max-w-xs"><RupiahInput value={fee} onValueChange={setFee} min={0} max={100_000} hint="Biaya per transfer, bukan per batch." /></div>
  } else if (row.key === 'finance_soft_alerts') {
    value = JSON.stringify(alerts)
    problem = Object.values(alerts).every(item => Number.isSafeInteger(item) && Number(item) >= 0) ? null : 'Semua ambang harus rupiah bulat non-negatif.'
    fields = <div className="grid gap-3 sm:grid-cols-3">
      {([
        ['topup_rupiah', 'Top-up besar', 'Satu top-up di atas nilai ini ditandai.'],
        ['student_balance_rupiah', 'Saldo santri tinggi', 'Dompet santri di atas nilai ini ditandai.'],
        ['aggregate_float_rupiah', 'Float wali tinggi', 'Total Titipan seluruh wali di atas nilai ini ditandai.'],
      ] as const).map(([key, caption, help]) => <label key={key} className="grid gap-1 text-xs font-semibold text-slate-700">{caption}
        <RupiahInput value={Number(alerts[key])} onValueChange={next => setAlerts(current => ({ ...current, [key]: next }))} min={0} hint={help} />
      </label>)}
    </div>
  } else if (row.key === 'finance_meal_cutoff' || row.key === 'finance_laundry_cutoff') {
    value = JSON.stringify({ day: Number(cutoff.day), time: cutoff.time })
    problem = Number.isSafeInteger(Number(cutoff.day)) && Number(cutoff.day) >= 1 && Number(cutoff.day) <= 31 && /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff.time)
      ? null : 'Tanggal 1–31 dan jam HH:mm.'
    fields = <div className="grid gap-3 sm:grid-cols-2 sm:max-w-sm">
      <label className="grid gap-1 text-xs font-semibold text-slate-700">Tanggal tiap bulan
        <input type="number" min={1} max={31} value={cutoff.day} disabled={!canConfigure} onChange={event => setCutoff(current => ({ ...current, day: Number(event.target.value) }))} className={`${field} tabular-nums`} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-700">Jam
        <input type="time" value={cutoff.time} disabled={!canConfigure} onChange={event => setCutoff(current => ({ ...current, time: event.target.value }))} className={`${field} tabular-nums`} />
      </label>
      <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2">Setelah tanggal {cutoff.day} pukul {cutoff.time}, wali tidak dapat lagi menarik alokasi bulan itu kembali ke Titipan.</p>
    </div>
  } else {
    // Pengaturan yang belum punya editor khusus tetap dapat disunting apa adanya,
    // supaya key baru di database tidak terkunci hanya karena UI belum menyusul.
    fields = row.value.trim().startsWith('{')
      ? <textarea rows={3} value={raw} readOnly={!canConfigure} onChange={event => setRaw(event.target.value)} className={`${field} py-2 font-mono text-xs`} />
      : <input value={raw} readOnly={!canConfigure} onChange={event => setRaw(event.target.value)} className={field} />
  }

  return <form action={form => act(() => updateFinanceSettingAction(form), `${label} diperbarui.`)} className="grid gap-2 p-4">
    <input type="hidden" name="key" value={row.key} />
    <input type="hidden" name="value" value={value} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-bold text-slate-800">{label}</span>
      <span className="text-[11px] text-slate-400">Diubah {row.updated_at}</span>
    </div>
    {hint ? <p className="text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    {fields}
    {problem ? <p className="text-[11px] font-semibold text-red-700">{problem}</p> : null}
    {canConfigure ? <button disabled={pending || Boolean(problem)} className="min-h-10 justify-self-end rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">Simpan</button> : null}
  </form>
}

function OutboxPanel({ data, act, pending }: { data: any; act: Mutate; pending: boolean }) {
  return <SectionPanel title="Antrean event" description="Notifikasi dan integrasi dikirim lewat antrean ini; retry hanya mengembalikan event gagal ke antrean.">
    <div data-tour="outbox" className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
      {data.outbox.length ? data.outbox.map((row: any) => <article key={row.id} className="space-y-2 px-4 py-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div><strong>{row.event_type}</strong><p className="text-slate-500">{row.aggregate_type} · {row.aggregate_id}</p></div>
          <StatusBadge tone={row.status === 'FAILED' ? 'red' : row.status === 'SENT' ? 'emerald' : row.status === 'PENDING' ? 'amber' : 'blue'}>{row.status}</StatusBadge>
        </div>
        <p className="text-slate-500">{row.created_at} · {row.attempts} percobaan</p>
        {row.last_error ? <p className="rounded bg-red-50 p-2 text-red-700">{row.last_error}</p> : null}
        {data.canExecute && row.status === 'FAILED' ? <button disabled={pending} onClick={() => act(() => retryOutboxAction(row.id), 'Event dikembalikan ke antrean.')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 font-bold text-amber-800 disabled:opacity-50"><ArrowClockwise />Coba kirim ulang</button> : null}
      </article>) : <EmptyState icon={CheckCircle} title="Belum ada event" description="Antrean terisi otomatis saat transaksi keuangan terjadi. Kosong berarti belum ada yang perlu dikirim." />}
    </div>
  </SectionPanel>
}

function SessionsPanel({ data, now, pending, onRevoke }: { data: any; now: number; pending: boolean; onRevoke: (row: any) => void }) {
  return <SectionPanel title="MFA &amp; sesi staf" description="Kunci MFA tidak pernah dikirim ke layar; bendahara dapat mencabut sesi yang masih aktif.">
    <div className="border-b border-slate-100 p-4">
      <h3 className="text-xs font-bold">Cakupan MFA</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.mfa.length ? data.mfa.map((row: any) => <span key={row.user_id} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800"><strong>{row.user_name}</strong> · {row.method}</span>)
          : <span className="text-xs text-amber-700">Belum ada staf finance dengan MFA tercatat.</span>}
      </div>
    </div>
    <div data-tour="sessions" className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
      {data.sessions.length ? data.sessions.map((row: any) => {
        const active = !row.revoked_at && new Date(row.expires_at).getTime() > now
        return <article key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs">
          <div className="min-w-0">
            <strong>{row.user_name}</strong>
            <p className="text-slate-500">{row.created_at} — {row.expires_at}</p>
            <p className="mt-1 max-w-md truncate text-[11px] text-slate-400">{row.user_agent || 'User agent tidak tersedia'}</p>
          </div>
          <div className="shrink-0 text-right">
            <StatusBadge tone={active ? 'emerald' : 'slate'}>{active ? 'AKTIF' : row.revoked_at ? 'DICABUT' : 'BERAKHIR'}</StatusBadge>
            {data.canConfigure && active ? <button disabled={pending} onClick={() => onRevoke(row)} className="mt-2 block min-h-9 rounded-lg border border-red-200 px-3 font-bold text-red-700 disabled:opacity-50">Cabut</button> : null}
          </div>
        </article>
      }) : <EmptyState icon={ShieldCheck} title="Belum ada sesi khusus keuangan" description="Sesi tercatat di sini saat staf masuk ke modul keuangan dengan verifikasi tambahan." />}
    </div>
  </SectionPanel>
}

function AuthTrendPanel({ data }: { data: any }) {
  return <SectionPanel title="Percobaan autentikasi 14 hari" description="Agregat sukses/gagal tanpa mengekspos identity hash atau IP hash.">
    <div className="divide-y divide-slate-100">
      {data.authTrend.length ? data.authTrend.map((row: any) => <div key={row.day} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 text-xs">
        <strong>{row.day}</strong>
        <span className="text-emerald-700">{row.succeeded} sukses</span>
        <span className={Number(row.failed) ? 'font-bold text-red-700' : 'text-slate-400'}>{row.failed} gagal</span>
      </div>) : <div className="p-10 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Belum ada percobaan autentikasi finance.</div>}
    </div>
  </SectionPanel>
}

/**
 * Penelusuran audit. Panduan halaman ini menyuruh menyiapkan tanggal dan nama
 * pelaku, tetapi sebelumnya satu-satunya alat adalah kotak teks bebas — nama
 * dan tanggal harus diketik menebak-nebak. Kini semuanya dipilih dari data yang
 * memang sedang dimuat.
 */
function AuditPanel({ data, now }: { data: any; now: number }) {
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('ALL')
  const [actor, setActor] = useState('ALL')
  const [action, setAction] = useState('ALL')
  const [range, setRange] = useState<RangeId>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const entities = useMemo(() => [...new Set<string>(data.audit.map((row: any) => row.entity_type))].sort(), [data.audit])
  const actors = useMemo(() => [...new Set<string>(data.audit.map((row: any) => String(row.actor_name || '—')))].sort(), [data.audit])
  const actions = useMemo(() => [...new Set<string>(data.audit.map((row: any) => row.action))].sort(), [data.audit])

  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(now)), [now])
  const bounds = useMemo(() => {
    if (range === 'ALL') return null
    if (range === 'CUSTOM') return { from: from || '0000-01-01', to: to || '9999-12-31' }
    const days = range === 'TODAY' ? 0 : Number(range) - 1
    const start = new Date(`${today}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - days)
    return { from: start.toISOString().slice(0, 10), to: today }
  }, [range, from, to, today])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return data.audit.filter((row: any) => {
      if (entity !== 'ALL' && row.entity_type !== entity) return false
      if (actor !== 'ALL' && String(row.actor_name || '—') !== actor) return false
      if (action !== 'ALL' && row.action !== action) return false
      if (bounds) {
        const day = jakartaDay(row.created_at)
        if (!day || day < bounds.from || day > bounds.to) return false
      }
      return !needle || [row.actor_name, row.action, row.entity_type, row.entity_id].some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [action, actor, bounds, data.audit, entity, search])

  const narrowed = filtered.length !== data.audit.length
  const reset = () => { setSearch(''); setEntity('ALL'); setActor('ALL'); setAction('ALL'); setRange('ALL'); setFrom(''); setTo('') }

  return <SectionPanel
    title="Audit trail keuangan"
    description="Saring dengan rentang waktu, pelaku, tindakan, atau jenis entitas; buka satu baris untuk melihat kondisi sebelum dan sesudahnya."
    action={<ExportButton
      filename={`audit-keuangan-${today}`}
      sheetName="Audit"
      label={`Unduh ${filtered.length} baris`}
      disabled={!filtered.length}
      rows={() => filtered.map((row: any) => ({
        Waktu: row.created_at,
        Pelaku: row.actor_name || row.actor_type,
        Tindakan: row.action,
        Entitas: row.entity_type,
        'ID entitas': row.entity_id || '',
        Sebelum: compactJson(row.before_json),
        Sesudah: compactJson(row.after_json),
      }))}
    />}
  >
    <div data-tour="audit" className="space-y-2 border-b border-slate-100 p-3">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
        {RANGES.map(item => <button key={item.id} type="button" onClick={() => setRange(item.id)}
          className={`min-h-9 rounded-md px-3 ${range === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {item.label}
        </button>)}
      </div>
      {range === 'CUSTOM' ? <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600">Dari tanggal<input type="date" value={from} max={to || today} onChange={event => setFrom(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600">Sampai tanggal<input type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} className={field} /></label>
      </div> : null}
      <div className="grid gap-2 lg:grid-cols-[1fr_180px_180px_180px]">
        <label className="relative"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari ID entitas atau kata kunci" className={`${field} pl-9`} /></label>
        <select aria-label="Pelaku" value={actor} onChange={event => setActor(event.target.value)} className={field}><option value="ALL">Semua pelaku</option>{actors.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Tindakan" value={action} onChange={event => setAction(event.target.value)} className={field}><option value="ALL">Semua tindakan</option>{actions.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Jenis entitas" value={entity} onChange={event => setEntity(event.target.value)} className={field}><option value="ALL">Semua entitas</option>{entities.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        Menampilkan <strong className="tabular-nums text-slate-700">{filtered.length}</strong> dari {data.audit.length} aktivitas yang dimuat.
        {narrowed ? <button type="button" onClick={reset} className="font-bold text-blue-700 underline">Bersihkan filter</button> : null}
      </p>
    </div>
    <div className="divide-y divide-slate-100">
      {filtered.length ? filtered.map((row: any) => <details key={row.id}>
        <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[150px_170px_150px_1fr] sm:items-center">
          <span className="tabular-nums text-slate-500">{row.created_at}</span>
          <strong>{row.actor_name}</strong>
          <StatusBadge tone="blue">{row.action}</StatusBadge>
          <span className="truncate">{row.entity_type} · {row.entity_id || '—'}</span>
        </summary>
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2">
          <div><p className="mb-1 text-[11px] font-bold uppercase text-slate-500">Sebelum</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-3 text-[11px]">{row.before_json ? prettyJson(row.before_json) : '—'}</pre></div>
          <div><p className="mb-1 text-[11px] font-bold uppercase text-slate-500">Sesudah</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-3 text-[11px]">{row.after_json ? prettyJson(row.after_json) : '—'}</pre></div>
        </div>
      </details>) : <EmptyState icon={CheckCircle} title="Tidak ada aktivitas yang sesuai filter" description="Longgarkan rentang waktu, atau kembalikan pilihan pelaku dan tindakan ke Semua." action={<button type="button" onClick={reset} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold">Bersihkan filter</button>} />}
    </div>
  </SectionPanel>
}
