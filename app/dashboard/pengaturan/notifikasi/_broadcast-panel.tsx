'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Megaphone, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABEL } from '@/lib/menu/role-label'
import type { BroadcastAudience } from '@/lib/notifications/broadcast'
import type { NotifChannel } from '@/lib/notifications/types'
import {
  cancelBroadcastAction, estimateBroadcastAudience, listBroadcasts, sendBroadcast,
  type BroadcastRow, type NotificationSettingsData,
} from './actions'

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
const STAFF_ROLES = ['admin', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'pimpinan', 'sekpen', 'keamanan',
  'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'guru', 'poskestren']
type Kind = BroadcastAudience['kind']

const STATUS_LABEL: Record<BroadcastRow['status'], string> = {
  DRAFT: 'Draf', SCHEDULED: 'Terjadwal', SENDING: 'Sedang dikirim', SENT: 'Terkirim', CANCELLED: 'Dibatalkan',
}
const STATUS_TONE: Record<BroadcastRow['status'], string> = {
  DRAFT: 'text-slate-500', SCHEDULED: 'text-sky-700', SENDING: 'text-amber-700', SENT: 'text-emerald-700', CANCELLED: 'text-slate-400',
}

function audienceText(a: BroadcastAudience | null, users: NotificationSettingsData['users']) {
  if (!a) return '-'
  switch (a.kind) {
    case 'PARENTS_ALL': return 'Semua wali santri aktif'
    case 'PARENTS_ASRAMA': return `Wali santri ${a.asrama.join(', ')}`
    case 'STAFF_ROLES': return `Pegawai: ${a.roles.map(r => ROLE_LABEL[r] ?? r).join(', ')}`
    case 'STAFF_USERS': {
      const byId = new Map(users.map(u => [u.id, u.full_name]))
      const names = a.userIds.map(id => byId.get(id) ?? 'pengguna')
      return `Pegawai: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`
    }
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
}

export function BroadcastPanel({ users }: { users: NotificationSettingsData['users'] }) {
  const [rows, setRows] = useState<BroadcastRow[] | null>(null)
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kind, setKind] = useState<Kind>('PARENTS_ALL')
  const [asrama, setAsrama] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [userIds, setUserIds] = useState<string[]>([])
  const [userTerm, setUserTerm] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [push, setPush] = useState(true)
  const [schedule, setSchedule] = useState('')
  const [estimate, setEstimate] = useState<number | null>(null)
  const [busy, setBusy] = useState<'send' | 'estimate' | null>(null)

  const reload = useCallback(async () => {
    const res = await listBroadcasts()
    if (!res.ok) { toast.error(res.error); setRows([]); return }
    setRows(res.data.rows)
    setAsramaList(res.data.asrama)
  }, [])
  useEffect(() => { const t = window.setTimeout(reload, 0); return () => window.clearTimeout(t) }, [reload])

  const audience = useMemo<BroadcastAudience>(() => {
    if (kind === 'PARENTS_ASRAMA') return { kind, asrama }
    if (kind === 'STAFF_ROLES') return { kind, roles }
    if (kind === 'STAFF_USERS') return { kind, userIds }
    return { kind: 'PARENTS_ALL' }
  }, [kind, asrama, roles, userIds])
  useEffect(() => { const t = window.setTimeout(() => setEstimate(null), 0); return () => window.clearTimeout(t) }, [audience])

  const matches = useMemo(() => {
    const t = userTerm.trim().toLocaleLowerCase('id')
    return t.length < 2 ? [] : users.filter(u => !userIds.includes(u.id) && u.full_name.toLocaleLowerCase('id').includes(t)).slice(0, 6)
  }, [userTerm, users, userIds])

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter(x => x !== value) : [...list, value])

  async function checkAudience() {
    setBusy('estimate')
    const res = await estimateBroadcastAudience(audience)
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    setEstimate(res.data)
  }

  async function submit() {
    const when = schedule ? new Date(schedule) : null
    const confirmText = `${when ? `Jadwalkan pengumuman pada ${formatWhen(when.toISOString())}` : 'Kirim pengumuman sekarang'} ke ${audienceText(audience, users)}?`
    if (!window.confirm(confirmText)) return
    setBusy('send')
    const channels: NotifChannel[] = push ? ['in_app', 'webpush', 'fcm'] : ['in_app']
    const res = await sendBroadcast({ title, body, link: link || null, audience, channels, scheduledAt: when ? when.toISOString() : null })
    setBusy(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`Pengumuman ${when ? 'dijadwalkan' : 'sedang dikirim'} ke ${res.data.recipients.toLocaleString('id-ID')} penerima.`)
    setTitle(''); setBody(''); setLink(''); setSchedule(''); setEstimate(null)
    reload()
  }

  async function cancel(id: string) {
    if (!window.confirm('Batalkan pengumuman terjadwal ini?')) return
    const res = await cancelBroadcastAction(id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Pengumuman dibatalkan.')
    reload()
  }

  const kindButton = (value: Kind, label: string) => (
    <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value}
      className={cn('rounded-lg border px-3 py-2 text-left text-sm', kind === value ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
      {label}
    </button>
  )
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on}
      className={cn('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
      {label}
    </button>
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <header className="flex items-start gap-3 border-b border-slate-100 pb-4">
          <Megaphone className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Buat pengumuman</h2>
            <p className="text-sm text-slate-500">Dikirim ke kotak masuk penerima dan, bila diaktifkan, ke HP mereka.</p>
          </div>
        </header>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Penerima</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {kindButton('PARENTS_ALL', 'Semua wali santri')}
            {kindButton('PARENTS_ASRAMA', 'Wali santri per asrama')}
            {kindButton('STAFF_ROLES', 'Pegawai per role')}
            {kindButton('STAFF_USERS', 'Pegawai tertentu')}
          </div>
          {kind === 'PARENTS_ASRAMA' && (
            <div className="mt-3 flex flex-wrap gap-1.5">{asramaList.map(a => chip(asrama.includes(a), a, () => toggle(asrama, setAsrama, a)))}</div>
          )}
          {kind === 'STAFF_ROLES' && (
            <div className="mt-3 flex flex-wrap gap-1.5">{STAFF_ROLES.map(r => chip(roles.includes(r), ROLE_LABEL[r] ?? r, () => toggle(roles, setRoles, r)))}</div>
          )}
          {kind === 'STAFF_USERS' && (
            <div className="mt-3 space-y-2">
              {userIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {userIds.map(id => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs text-slate-700">
                      {users.find(u => u.id === id)?.full_name ?? 'Pengguna'}
                      <button type="button" aria-label="Hapus" onClick={() => setUserIds(userIds.filter(x => x !== id))} className="rounded-full p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input value={userTerm} onChange={e => setUserTerm(e.target.value)} placeholder="Ketik minimal 2 huruf nama pegawai" className={inputCls} />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {matches.map(u => (
                      <li key={u.id}><button type="button" onClick={() => { setUserIds([...userIds, u.id]); setUserTerm('') }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                        {u.full_name} <span className="text-xs text-slate-500">· {ROLE_LABEL[u.role] ?? u.role}</span></button></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <button type="button" onClick={checkAudience} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
              {busy === 'estimate' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Hitung penerima
            </button>
            {estimate !== null && <span><b className="text-slate-900">{estimate.toLocaleString('id-ID')}</b> penerima</span>}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Judul</span>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Mis. Libur akhir semester" className={cn(inputCls, 'mt-1')} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Isi pengumuman</span>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={500} rows={4} className={cn(inputCls, 'mt-1')} />
          <span className="mt-1 block text-right text-[11px] text-slate-400">{body.length}/500</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Tautan (opsional)</span>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="/portal-ortu/tagihan" className={cn(inputCls, 'mt-1 font-mono')} />
            <span className="mt-1 block text-xs text-slate-500">Halaman di dalam aplikasi yang dibuka saat diketuk.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Jadwal kirim (opsional)</span>
            <input type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} className={cn(inputCls, 'mt-1')} />
            <span className="mt-1 block text-xs text-slate-500">Kosongkan untuk kirim sekarang. Waktu mengikuti perangkat Anda.</span>
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={push} onChange={e => setPush(e.target.checked)} />
          <span>Kirim juga sebagai notifikasi HP (push)<span className="block text-xs text-slate-500">Isi pengumuman tampil apa adanya di layar kunci.</span></span>
        </label>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="button" onClick={submit} disabled={busy !== null || title.trim().length < 3 || body.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {schedule ? 'Jadwalkan' : 'Kirim sekarang'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Riwayat pengumuman</h2>
        {rows === null && <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>}
        {rows?.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">Belum ada pengumuman.</p>}
        <ul className="max-h-[40rem] divide-y divide-slate-100 overflow-y-auto">
          {rows?.map(r => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                <span className={cn('shrink-0 text-[11px] font-semibold', STATUS_TONE[r.status])}>{STATUS_LABEL[r.status]}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{r.body}</p>
              <p className="mt-1 text-[11px] text-slate-500">{audienceText(r.audience, users)} · {formatWhen(r.scheduled_at)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {r.recipient_count.toLocaleString('id-ID')} penerima · {r.read_count.toLocaleString('id-ID')} dibaca · {r.push_sent.toLocaleString('id-ID')} push terkirim
                {r.created_by_name ? ` · oleh ${r.created_by_name}` : ''}
              </p>
              {(r.status === 'SCHEDULED' || r.status === 'DRAFT') && (
                <button type="button" onClick={() => cancel(r.id)} className="mt-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700">Batalkan</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
