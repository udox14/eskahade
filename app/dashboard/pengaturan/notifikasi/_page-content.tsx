'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RotateCcw, Save, Search, Send } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { cn } from '@/lib/utils'
import { NOTIF_CATEGORIES, NOTIF_MODULES, samplePayload } from '@/lib/notifications/catalog'
import { validateConfigInput } from '@/lib/notifications/config'
import { renderNotification } from '@/lib/notifications/render'
import { ROLE_LABEL } from '@/lib/menu/role-label'
import type { NotifChannel, PushPrivacy, StaffRecipientRule, StaffScope } from '@/lib/notifications/types'
import {
  resetNotificationEvent, saveNotificationEvent, sendNotificationTest, setArrearsReminderDay, setNotificationsEnabled, setPushEnabled,
  type ChannelStatus, type EventConfigView, type NotificationSettingsData,
} from './actions'
import { BroadcastPanel } from './_broadcast-panel'
import { LogPanel } from './_log-panel'

const RULE_ROLES = ['admin', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'pimpinan', 'sekpen', 'keamanan',
  'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'guru', 'poskestren']

const SCOPE_LABEL: Record<StaffScope, string> = {
  ALL: 'Semua pengguna dengan role terpilih',
  TRANSFER_VERIFIER: 'Sesuai cakupan asrama petugas verifikasi transfer',
  ASRAMA_BINAAN: 'Hanya pengurus asrama santri terkait (admin selalu menerima)',
}

const CHANNEL_LABEL: Record<NotifChannel, string> = {
  in_app: 'Di aplikasi',
  webpush: 'Push browser / iPhone',
  fcm: 'Push aplikasi Android',
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'

export default function PageContent({ data }: { data: NotificationSettingsData | null }) {
  if (!data) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Pengaturan Notifikasi" description="Atur jenis, redaksi, dan penerima notifikasi." />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Data notifikasi belum dapat dimuat. Pastikan migration 0202 (notifikasi) sudah diterapkan.
        </div>
      </div>
    )
  }
  return <Workspace data={data} />
}

function Workspace({ data }: { data: NotificationSettingsData }) {
  const router = useRouter()
  const [audience, setAudience] = useState<'PARENT' | 'STAFF'>('PARENT')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string>(data.events.find(e => e.definition.audience === 'PARENT')?.definition.code ?? '')
  const [enabled, setEnabled] = useState(data.enabled)
  const [toggling, setToggling] = useState(false)
  const [tab, setTab] = useState<'events' | 'broadcast' | 'log'>('events')

  const list = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('id')
    return data.events.filter(e => e.definition.audience === audience
      && (!term || `${e.definition.label} ${e.definition.description}`.toLocaleLowerCase('id').includes(term)))
  }, [data.events, audience, search])

  const current = data.events.find(e => e.definition.code === selected) ?? null

  async function toggleDispatch() {
    setToggling(true)
    const res = await setNotificationsEnabled(!enabled)
    setToggling(false)
    if (!res.ok) { toast.error(res.error); return }
    setEnabled(res.data)
    toast.success(res.data ? 'Pengiriman notifikasi dilanjutkan.' : 'Pengiriman notifikasi dijeda.')
  }

  function switchAudience(next: 'PARENT' | 'STAFF') {
    setAudience(next)
    setSelected(data.events.find(e => e.definition.audience === next)?.definition.code ?? '')
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Pengaturan Notifikasi"
        description="Atur jenis notifikasi, redaksi pesan, privasi layar kunci, dan siapa yang menerima."
      />

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <span className={cn('h-2.5 w-2.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden="true" />
            Pengiriman {enabled ? 'aktif' : 'dijeda'}
          </span>
          <Stat label="Menunggu kirim" value={data.outbox.pending} />
          <Stat label="Gagal" value={data.outbox.failed} tone={data.outbox.failed > 0 ? 'danger' : undefined} />
          <Stat label="Terkirim 7 hari" value={data.outbox.done7d} />
        </div>
        <button
          type="button"
          onClick={toggleDispatch}
          disabled={toggling}
          className={cn('inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60',
            enabled ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700')}
        >
          {toggling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {enabled ? 'Jeda pengiriman' : 'Lanjutkan pengiriman'}
        </button>
      </section>

      <ChannelPanel channels={data.channels} initialPushEnabled={data.pushEnabled} />

      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Bagian pengaturan notifikasi">
        {([['events', 'Jenis Notifikasi'], ['broadcast', 'Pengumuman'], ['log', 'Log Pengiriman']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={cn('-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === value ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'broadcast' && <BroadcastPanel users={data.users} />}
      {tab === 'log' && <LogPanel />}

      {tab === 'events' && <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-100 p-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Penerima">
              {(['PARENT', 'STAFF'] as const).map(a => (
                <button key={a} type="button" role="tab" aria-selected={audience === a} onClick={() => switchAudience(a)}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', audience === a ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}>
                  {a === 'PARENT' ? 'Wali Santri' : 'Pegawai'}
                </button>
              ))}
            </div>
            <label className="relative block">
              <span className="sr-only">Cari jenis notifikasi</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari jenis notifikasi" className={cn(inputCls, 'pl-9')} />
            </label>
          </div>
          <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto">
            {list.map(e => (
              <li key={e.definition.code}>
                <button type="button" onClick={() => setSelected(e.definition.code)}
                  className={cn('w-full px-4 py-3 text-left transition-colors', selected === e.definition.code ? 'bg-emerald-50' : 'hover:bg-slate-50')}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{e.definition.label}</span>
                    <span className={cn('shrink-0 text-[11px] font-semibold', e.enabled ? 'text-emerald-700' : 'text-slate-400')}>
                      {e.enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {NOTIF_MODULES[e.definition.module] ?? e.definition.module} · {NOTIF_CATEGORIES[e.definition.category] ?? e.definition.category}
                    {!e.definition.wired && ' · belum terhubung'}
                    {e.overridden && ' · diubah'}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada jenis notifikasi yang cocok.</li>}
          </ul>
        </aside>

        {current
          ? <EventEditor key={`${current.definition.code}:${current.updatedAt ?? ''}`} event={current} users={data.users} arrearsDay={data.arrearsDay} onSaved={() => router.refresh()} />
          : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Pilih jenis notifikasi.</div>}
      </div>}
    </div>
  )
}

function ChannelPanel({ channels, initialPushEnabled }: { channels: ChannelStatus; initialPushEnabled: boolean }) {
  const [pushEnabled, setPush] = useState(initialPushEnabled)
  const [busy, setBusy] = useState(false)
  const active = pushEnabled && (channels.webpushConfigured || channels.fcmConfigured)

  async function toggle() {
    setBusy(true)
    const res = await setPushEnabled(!pushEnabled)
    setBusy(false)
    if (!res.ok) { toast.error(res.error); return }
    setPush(res.data)
    toast.success(res.data ? 'Notifikasi push diaktifkan.' : 'Notifikasi push dimatikan.')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="channel-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="channel-heading" className="text-sm font-semibold text-slate-900">Perangkat & Kanal Push</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Push browser/iPhone (Web Push):{' '}
            {channels.webpushConfigured
              ? <>kunci terpasang <span className="font-mono">{channels.webpushKeyHint}…</span></>
              : <span className="font-semibold text-amber-700">kunci VAPID belum dipasang di server</span>}
            {' · '}Push aplikasi Android (FCM):{' '}
            {channels.fcmConfigured
              ? <>project <span className="font-mono">{channels.fcmProjectId}</span></>
              : <span className="font-semibold text-amber-700">kredensial Firebase belum dipasang di server</span>}
          </p>
        </div>
        <button type="button" onClick={toggle} disabled={busy || (!pushEnabled && !channels.webpushConfigured && !channels.fcmConfigured)}
          className={cn('inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50',
            pushEnabled ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700')}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pushEnabled ? 'Matikan push' : 'Aktifkan push'}
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Metric label="Perangkat wali" value={channels.devices.webpushParent + channels.devices.fcmParent} />
        <Metric label="Perangkat pegawai" value={channels.devices.webpushStaff + channels.devices.fcmStaff} />
        <Metric label="Push terkirim 7 hari" value={channels.deliveries7d.sent} />
        <Metric label="Gagal / kedaluwarsa 7 hari" value={channels.deliveries7d.failed + channels.deliveries7d.expired} />
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        {active
          ? 'Push aktif. Pengguna mengaktifkan notifikasi dari halaman Notifikasi atau Akun di perangkatnya masing-masing.'
          : 'Push nonaktif: notifikasi tetap tersimpan di aplikasi, tetapi tidak dikirim ke HP.'}
        {channels.deliveries7d.pending > 0 && ` ${channels.deliveries7d.pending} push menunggu dikirim ulang.`}
      </p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value.toLocaleString('id-ID')}</dd>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <span className="text-xs text-slate-500">
      {label} <span className={cn('ml-1 font-semibold tabular-nums', tone === 'danger' ? 'text-rose-600' : 'text-slate-900')}>{value.toLocaleString('id-ID')}</span>
    </span>
  )
}

function EventEditor({ event, users, arrearsDay, onSaved }: { event: EventConfigView; users: NotificationSettingsData['users']; arrearsDay: number; onSaved: () => void }) {
  const def = event.definition
  const [enabled, setEnabled] = useState(event.enabled)
  const [mandatory, setMandatory] = useState(event.mandatory)
  const [channels, setChannels] = useState<NotifChannel[]>(event.channels)
  const [privacy, setPrivacy] = useState<PushPrivacy>(event.pushPrivacy)
  const [title, setTitle] = useState(event.title)
  const [inApp, setInApp] = useState(event.inApp)
  const [push, setPush] = useState(event.push)
  const [rule, setRule] = useState<StaffRecipientRule | null>(event.recipients)
  const [busy, setBusy] = useState<'save' | 'reset' | 'test' | null>(null)
  const focused = useRef<{ field: 'title' | 'inApp' | 'push'; el: HTMLInputElement | HTMLTextAreaElement } | null>(null)

  const input = { enabled, mandatory, channels, title, inApp, push, pushPrivacy: privacy, recipients: rule }
  const errors = validateConfigInput(def, input)
  const preview = renderNotification(def, input, samplePayload(def))

  function insertPlaceholder(key: string) {
    const target = focused.current
    const token = `{${key}}`
    if (!target) { setInApp(v => `${v}${v.endsWith(' ') || !v ? '' : ' '}${token}`); return }
    const { el, field } = target
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    ;({ title: setTitle, inApp: setInApp, push: setPush })[field](next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  async function save() {
    if (errors.length) { toast.error(errors[0]); return }
    setBusy('save')
    const res = await saveNotificationEvent(def.code, input)
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Pengaturan notifikasi tersimpan.')
    onSaved()
  }

  async function reset() {
    if (!window.confirm('Kembalikan redaksi, kanal, dan penerima ke pengaturan bawaan?')) return
    setBusy('reset')
    const res = await resetNotificationEvent(def.code)
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Dikembalikan ke pengaturan bawaan.')
    onSaved()
  }

  async function test() {
    setBusy('test')
    const res = await sendNotificationTest(def.code)
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Notifikasi uji dikirim ke kotak masuk dan perangkat Anda yang aktif. Simpan dulu bila redaksi baru belum disimpan.')
  }

  const fieldProps = (field: 'title' | 'inApp' | 'push') => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { focused.current = { field, el: e.currentTarget } },
  })

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <header className="flex flex-col gap-1 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">{def.label}</h2>
          {!def.wired && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Belum terhubung ke modul</span>}
        </div>
        <p className="text-sm text-slate-500">{def.description}</p>
        {!event.linkRegistered && (
          <p className="text-xs text-amber-700">Tautan {def.link} belum terdaftar aktif di Fitur Akses; penerima berbasis role tidak akan menerima notifikasi ini.</p>
        )}
      </header>

      {def.code === 'PORTAL_PENGINGAT_TUNGGAKAN' && <ArrearsDayField initial={arrearsDay} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Toggle label="Aktif" hint="Nonaktif = event tidak membuat notifikasi." checked={enabled} onChange={setEnabled} />
        <Toggle label="Wajib" hint="Tetap dikirim walau penerima mematikan kategori ini." checked={mandatory} onChange={setMandatory} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">Kanal</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(CHANNEL_LABEL) as NotifChannel[]).map(c => {
            const on = channels.includes(c)
            return (
              <label key={c} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                on ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600', c === 'in_app' && 'cursor-not-allowed opacity-80')}>
                <input type="checkbox" className="accent-emerald-600" checked={on} disabled={c === 'in_app'}
                  onChange={() => setChannels(prev => on ? prev.filter(x => x !== c) : [...prev, c])} />
                {CHANNEL_LABEL[c]}
              </label>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Riwayat di aplikasi selalu disimpan. Push HP terkirim setelah kanal push dikonfigurasi.</p>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">Isi push di layar kunci</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([['MASKED', 'Disamarkan', 'Push memakai redaksi ringkas tanpa nominal/alasan.'], ['FULL', 'Tampilkan lengkap', 'Push sama dengan isi notifikasi di aplikasi.']] as const).map(([value, label, hint]) => (
            <label key={value} className={cn('cursor-pointer rounded-lg border p-3', privacy === value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200')}>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <input type="radio" name={`privacy-${def.code}`} className="accent-emerald-600" checked={privacy === value} onChange={() => setPrivacy(value)} />
                {label}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Placeholder</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {def.placeholders.map(p => (
                <button key={p.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insertPlaceholder(p.key)}
                  title={p.label}
                  className={cn('rounded-md border px-2 py-1 font-mono text-[11px]', p.sensitive ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100')}>
                  {`{${p.key}}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Kuning = data sensitif, tidak boleh dipakai di judul/isi push saat disamarkan.</p>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Judul</span>
            <input value={title} onChange={e => setTitle(e.target.value)} {...fieldProps('title')} maxLength={120} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Isi notifikasi di aplikasi</span>
            <textarea value={inApp} onChange={e => setInApp(e.target.value)} {...fieldProps('inApp')} rows={3} maxLength={500} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Isi push (disamarkan)</span>
            <textarea value={push} onChange={e => setPush(e.target.value)} {...fieldProps('push')} rows={2} maxLength={500}
              className={cn(inputCls, 'mt-1', privacy === 'FULL' && 'bg-slate-50 text-slate-500')} />
            {privacy === 'FULL' && <span className="mt-1 block text-xs text-slate-500">Tidak dipakai selama mode “Tampilkan lengkap”.</span>}
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Pratinjau</p>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Di aplikasi</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">{preview.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{preview.body}</p>
          </div>
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Layar kunci</p>
            <p className="mt-1.5 text-sm font-semibold">{preview.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{preview.pushBody}</p>
          </div>
          <p className="text-xs text-slate-500">Memakai data contoh. Tautan: <span className="font-mono">{def.link}</span></p>
        </div>
      </div>

      {def.audience === 'STAFF' && rule && <RecipientEditor rule={rule} onChange={setRule} users={users} />}

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {errors.map(e => <li key={e}>{e}</li>)}
        </ul>
      )}

      <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={reset} disabled={busy !== null || !event.overridden}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Kembalikan bawaan
        </button>
        <button type="button" onClick={test} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim uji ke saya
        </button>
        <button type="button" onClick={save} disabled={busy !== null || errors.length > 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
        </button>
      </footer>
    </section>
  )
}

function ArrearsDayField({ initial }: { initial: number }) {
  const [day, setDay] = useState(initial)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const res = await setArrearsReminderDay(day)
    setBusy(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`Pengingat tunggakan dikirim mulai tanggal ${res.data} setiap bulan.`)
  }
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Dikirim mulai tanggal</span>
        <input type="number" min={1} max={28} value={day} onChange={e => setDay(Number(e.target.value))} className={cn(inputCls, 'mt-1 w-24')} />
      </label>
      <button type="button" onClick={save} disabled={busy || day === initial}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Simpan tanggal
      </button>
      <p className="basis-full text-xs text-slate-500">Sekali per santri per bulan, pukul 08.00 WIB ke atas, untuk tagihan SPP/makan/cuci bulan-bulan sebelumnya yang belum lunas.</p>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-emerald-600' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

function RecipientEditor({ rule, onChange, users }: { rule: StaffRecipientRule; onChange: (r: StaffRecipientRule) => void; users: NotificationSettingsData['users'] }) {
  const set = (patch: Partial<StaffRecipientRule>) => onChange({ ...rule, ...patch })
  const toggleRole = (role: string) => set({ roles: rule.roles.includes(role) ? rule.roles.filter(r => r !== role) : [...rule.roles, role] })

  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">Penerima</legend>
      <div>
        <p className="text-xs font-semibold text-slate-700">Role</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RULE_ROLES.map(role => {
            const on = rule.roles.includes(role)
            return (
              <button key={role} type="button" onClick={() => toggleRole(role)} aria-pressed={on}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                {ROLE_LABEL[role] ?? role}
              </button>
            )
          })}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-slate-700">Cakupan</span>
        <select value={rule.scope} onChange={e => set({ scope: e.target.value as StaffScope })} className={cn(inputCls, 'mt-1')}>
          {(Object.keys(SCOPE_LABEL) as StaffScope[]).map(s => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={rule.notifyActor} onChange={e => set({ notifyActor: e.target.checked })} />
          <span>Kirim ke pengaju/pelaku aksi<span className="block text-xs text-slate-500">Untuk hasil persetujuan.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={rule.excludeActor} onChange={e => set({ excludeActor: e.target.checked })} />
          <span>Jangan kirim ke pelaku aksi sendiri<span className="block text-xs text-slate-500">Petugas yang menekan tombol tidak diberi notifikasi.</span></span>
        </label>
      </div>
      <UserPicker label="Pengguna tambahan" users={users} value={rule.includeUserIds} onChange={ids => set({ includeUserIds: ids })} />
      <UserPicker label="Pengguna dikecualikan" users={users} value={rule.excludeUserIds} onChange={ids => set({ excludeUserIds: ids })} />
    </fieldset>
  )
}

function UserPicker({ label, users, value, onChange }: { label: string; users: NotificationSettingsData['users']; value: string[]; onChange: (ids: string[]) => void }) {
  const [term, setTerm] = useState('')
  const byId = useMemo(() => new Map(users.map(u => [u.id, u])), [users])
  const matches = useMemo(() => {
    const t = term.trim().toLocaleLowerCase('id')
    if (t.length < 2) return []
    return users.filter(u => !value.includes(u.id) && u.full_name.toLocaleLowerCase('id').includes(t)).slice(0, 6)
  }, [term, users, value])

  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs text-slate-700">
              {byId.get(id)?.full_name ?? 'Pengguna terhapus'}
              <button type="button" onClick={() => onChange(value.filter(v => v !== id))} aria-label="Hapus" className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative mt-2">
        <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Ketik minimal 2 huruf nama" className={inputCls} />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map(u => (
              <li key={u.id}>
                <button type="button" onClick={() => { onChange([...value, u.id]); setTerm('') }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                  {u.full_name} <span className="text-xs text-slate-500">· {ROLE_LABEL[u.role] ?? u.role}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
