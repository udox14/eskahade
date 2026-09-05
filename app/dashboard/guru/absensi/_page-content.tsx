'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarCheck, CheckCircle2, ClipboardList, Loader2, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getAbsensiPengajarInitialData,
  getAbsensiPengajarRecapPage,
  getAbsensiPengajarStats,
  openOrCreateAbsensiPengajarSession,
  saveAbsensiPengajarChanges,
  type AbsensiPengajarSession,
  type AbsensiPengajarStats,
  type AbsensiPengajarStudent,
  type StatusAbsensiPengajar,
  type WaktuPengajian,
} from './actions'

type TabKey = 'input' | 'rekap'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type KelasOption = { id: string; nama_kelas: string }

const STATUS: StatusAbsensiPengajar[] = ['H', 'S', 'I', 'A']
const STATUS_LABEL: Record<StatusAbsensiPengajar, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alfa' }
const STATUS_CLASS: Record<StatusAbsensiPengajar, string> = {
  H: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  S: 'border-amber-200 bg-amber-50 text-amber-700',
  I: 'border-sky-200 bg-sky-50 text-sky-700',
  A: 'border-rose-200 bg-rose-50 text-rose-700',
}
const WAKTU_LABEL: Record<WaktuPengajian, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }

function formatDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(`${date}T00:00:00+07:00`))
}

function studentMeta(student: AbsensiPengajarStudent) {
  return [student.nis, [student.asrama, student.kamar].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') || '-'
}

export default function AbsensiPengajarContent() {
  const [tab, setTab] = useState<TabKey>('input')
  const [kelasList, setKelasList] = useState<KelasOption[]>([])
  const [kelasId, setKelasId] = useState('')
  const [canViewAll, setCanViewAll] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [waktu, setWaktu] = useState<WaktuPengajian | null>(null)
  const [opening, setOpening] = useState(false)
  const [activeSession, setActiveSession] = useState<AbsensiPengajarSession | null>(null)
  const [inputStudents, setInputStudents] = useState<AbsensiPengajarStudent[]>([])
  const [inputStatuses, setInputStatuses] = useState<Record<string, StatusAbsensiPengajar>>({})
  const [search, setSearch] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [rekapRequested, setRekapRequested] = useState(false)
  const [rekapLoading, setRekapLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sessions, setSessions] = useState<AbsensiPengajarSession[]>([])
  const [rekapStudents, setRekapStudents] = useState<AbsensiPengajarStudent[]>([])
  const [statusBySession, setStatusBySession] = useState<Record<string, Record<string, StatusAbsensiPengajar>>>({})
  const [stats, setStats] = useState<AbsensiPengajarStats | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const pendingRef = useRef(new Map<string, Map<string, StatusAbsensiPengajar>>())
  const pendingKelasRef = useRef(new Map<string, string>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inFlightRef = useRef(new Set<string>())
  const kelasRef = useRef(kelasId)
  const rekapSeqRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  kelasRef.current = kelasId

  useEffect(() => {
    getAbsensiPengajarInitialData().then(data => {
      setKelasList(data.kelas)
      setCanViewAll(data.canViewAll)
      if (data.kelas.length === 1) setKelasId(String(data.kelas[0].id))
    }).catch(() => toast.error('Daftar kelas gagal dimuat.')).finally(() => setInitialLoading(false))
  }, [])

  useEffect(() => {
    setWaktu(null)
    setActiveSession(null)
    setInputStudents([])
    setInputStatuses({})
    setSearch('')
    setRekapRequested(false)
    setSessions([])
    setRekapStudents([])
    setStatusBySession({})
    setStats(null)
    setNextCursor(null)
    setHasMore(false)
    rekapSeqRef.current++
  }, [kelasId])

  const refreshStats = useCallback(async () => {
    const targetKelas = kelasRef.current
    if (!targetKelas) return
    const result = await getAbsensiPengajarStats(targetKelas)
    if (kelasRef.current === targetKelas && !('error' in result)) setStats(result)
  }, [])

  const flush = useCallback(async (sesiId: string) => {
    const pending = pendingRef.current.get(sesiId)
    if (!pending?.size || inFlightRef.current.has(sesiId)) return
    const targetKelas = kelasRef.current
    const snapshot = new Map(pending)
    inFlightRef.current.add(sesiId)
    setSaveState('saving')
    try {
      const result = await saveAbsensiPengajarChanges({
        sesiId, kelasId: targetKelas,
        changes: [...snapshot].map(([riwayatId, status]) => ({ riwayatId, status })),
      })
      if ('error' in result) throw new Error(result.error)
      const latest = pendingRef.current.get(sesiId)
      for (const [id, status] of snapshot) if (latest?.get(id) === status) latest.delete(id)
      if (!latest?.size) pendingRef.current.delete(sesiId)
      if (!latest?.size) pendingKelasRef.current.delete(sesiId)
      setSaveState('saved')
      if (rekapRequested) void refreshStats()
      if (latest?.size) timersRef.current.set(sesiId, setTimeout(() => void flush(sesiId), 0))
    } catch (error) {
      console.error('[absensi-pengajar] autosave gagal', error)
      setSaveState('error')
    } finally {
      inFlightRef.current.delete(sesiId)
    }
  }, [rekapRequested, refreshStats])

  const queueSave = useCallback((sesiId: string, riwayatId: string, status: StatusAbsensiPengajar) => {
    let pending = pendingRef.current.get(sesiId)
    if (!pending) {
      pending = new Map()
      pendingRef.current.set(sesiId, pending)
    }
    pending.set(riwayatId, status)
    pendingKelasRef.current.set(sesiId, kelasRef.current)
    const oldTimer = timersRef.current.get(sesiId)
    if (oldTimer) clearTimeout(oldTimer)
    setSaveState('saving')
    timersRef.current.set(sesiId, setTimeout(() => {
      timersRef.current.delete(sesiId)
      void flush(sesiId)
    }, 700))
  }, [flush])

  const openSession = async () => {
    if (!kelasId || !waktu) return
    setOpening(true)
    try {
      const result = await openOrCreateAbsensiPengajarSession(kelasId, waktu)
      if ('error' in result) throw new Error(result.error)
      setActiveSession(result.session)
      setInputStudents(result.students)
      setInputStatuses(result.statuses)
      setSaveState('idle')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sesi absensi gagal dibuka.')
    } finally {
      setOpening(false)
    }
  }

  const loadRecap = useCallback(async (append = false) => {
    const targetKelas = kelasRef.current
    if (!targetKelas) return
    const seq = ++rekapSeqRef.current
    if (append) setLoadingMore(true)
    else setRekapLoading(true)
    try {
      const [page, summary] = await Promise.all([
        getAbsensiPengajarRecapPage(targetKelas, append ? nextCursor : null, 8),
        append ? Promise.resolve(null) : getAbsensiPengajarStats(targetKelas),
      ])
      if (seq !== rekapSeqRef.current || targetKelas !== kelasRef.current) return
      if ('error' in page) throw new Error(page.error)
      if (summary && !('error' in summary)) setStats(summary)
      setSessions(previous => append ? [...previous, ...page.sessions] : page.sessions)
      setRekapStudents(previous => {
        const map = new Map((append ? previous : []).map(student => [student.riwayat_id, student]))
        page.students.forEach(student => map.set(student.riwayat_id, student))
        return [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      })
      setStatusBySession(previous => append ? { ...previous, ...page.statusBySession } : page.statusBySession)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setRekapRequested(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rekap gagal dimuat.')
    } finally {
      setRekapLoading(false)
      setLoadingMore(false)
    }
  }, [nextCursor])

  useEffect(() => {
    if (!rekapRequested || !hasMore || !sentinelRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !loadingMore) void loadRecap(true)
    }, { root: scrollRef.current, rootMargin: '0px 240px 0px 0px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadRecap, loadingMore, rekapRequested])

  const filteredInput = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? inputStudents.filter(student => `${student.nama} ${student.nis || ''}`.toLowerCase().includes(term)) : inputStudents
  }, [inputStudents, search])

  const selectInputStatus = (studentId: string, status: StatusAbsensiPengajar) => {
    if (!activeSession?.editable) return
    setInputStatuses(previous => ({ ...previous, [studentId]: status }))
    queueSave(activeSession.id, studentId, status)
  }

  const cycleRecapStatus = (sesi: AbsensiPengajarSession, studentId: string) => {
    if (!sesi.editable) return
    const current = statusBySession[sesi.id]?.[studentId]
    if (!current) return
    const next = STATUS[(STATUS.indexOf(current) + 1) % STATUS.length]
    setStatusBySession(previous => ({ ...previous, [sesi.id]: { ...previous[sesi.id], [studentId]: next } }))
    queueSave(sesi.id, studentId, next)
  }

  return (
    <div className="space-y-4 pb-24 sm:space-y-6">
      <DashboardPageHeader title="Absensi Pengajar" description="Catatan kehadiran pribadi untuk pegangan pengajar." />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Bukan absensi resmi.</b> Absensi resmi tetap berada di modul Absensi Pengajian.</p></div>
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <TabButton active={tab === 'input'} onClick={() => setTab('input')} icon={CalendarCheck}>Input Absensi</TabButton>
        <TabButton active={tab === 'rekap'} onClick={() => setTab('rekap')} icon={ClipboardList}>Rekap</TabButton>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Kelas Pengajian</label>
        {initialLoading ? <div className="h-11 animate-pulse rounded-xl bg-slate-100" /> : kelasList.length ? (
          <select value={kelasId} onChange={event => setKelasId(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">
            {kelasList.length > 1 && <option value="">Pilih kelas dahulu</option>}
            {kelasList.map(kelas => <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>)}
          </select>
        ) : <p className="text-sm text-slate-500">Tidak ada kelas aktif yang dapat diakses.</p>}
      </section>

      {tab === 'input' ? (
        <div className="space-y-4">
          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
            <p className="mb-3 text-sm font-bold text-slate-800">Pilih waktu pengajian</p>
            <div className="grid grid-cols-3 gap-2">
              {(['shubuh', 'ashar', 'maghrib'] as WaktuPengajian[]).map(item => (
                <button key={item} type="button" disabled={!kelasId} onClick={() => { setWaktu(item); setActiveSession(null) }}
                  className={`min-h-11 rounded-xl border px-2 text-sm font-bold transition ${waktu === item ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'} disabled:opacity-40`}>
                  {WAKTU_LABEL[item]}
                </button>
              ))}
            </div>
            <button type="button" onClick={openSession} disabled={!kelasId || !waktu || opening}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-40">
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              {opening ? 'Membuka sesi...' : 'Input Absensi'}
            </button>
          </section>

          {activeSession && (
            <section className="space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-black text-slate-900">{WAKTU_LABEL[activeSession.waktu]} · {formatDate(activeSession.tanggal)}</p>
                  <p className="text-xs text-slate-500">Semua santri otomatis Hadir. Tandai hanya yang Sakit, Izin, atau Alfa.</p></div>
                <SaveIndicator state={saveState} onRetry={() => void flush(activeSession.id)} />
              </div>
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari santri..."
                  className="h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></div>
              <div className="space-y-2">
                {filteredInput.map(student => (
                  <div key={student.riwayat_id} className="rounded-2xl border bg-white p-3 shadow-sm">
                    <p className="font-bold text-slate-900">{student.nama}</p><p className="mb-3 text-xs text-slate-400">{studentMeta(student)}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {STATUS.map(status => <StatusButton key={status} status={status} active={inputStatuses[student.riwayat_id] === status}
                        disabled={!activeSession.editable} onClick={() => selectInputStatus(student.riwayat_id, status)} />)}
                    </div>
                  </div>
                ))}
                {!filteredInput.length && <Empty text="Tidak ada santri untuk ditampilkan." />}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button type="button" disabled={!kelasId || rekapLoading} onClick={() => void loadRecap(false)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-bold text-white disabled:opacity-40">
            {rekapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {rekapLoading ? 'Memuat rekap...' : 'Tampilkan Rekap'}
          </button>

          {!rekapRequested && !rekapLoading && <Empty text={kelasId ? 'Klik Tampilkan Rekap untuk memuat data.' : 'Pilih kelas terlebih dahulu.'} />}
          {rekapRequested && stats && <StatsCards stats={stats} />}
          {rekapRequested && sessions.length === 0 && <Empty text="Belum ada sesi absensi pada kelas ini." />}
          {rekapRequested && sessions.length > 0 && (
            <>
              <div ref={scrollRef} className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                <table className="border-separate border-spacing-0 text-xs">
                  <thead><tr>
                    <th className="sticky left-0 z-20 min-w-[168px] border-b border-r bg-slate-100 p-3 text-left">Santri</th>
                    {sessions.map(sesi => <th key={sesi.id} className="min-w-[96px] border-b border-r bg-slate-100 p-2 text-center">
                      <span className="block font-black text-slate-800">{WAKTU_LABEL[sesi.waktu]}</span>
                      <span className="block text-[10px] text-slate-500">{formatDate(sesi.tanggal)}</span>
                      {canViewAll && <span className="mt-1 block max-w-[90px] truncate text-[9px] font-medium text-indigo-600" title={sesi.creator_name}>{sesi.creator_name}</span>}
                    </th>)}
                    <th className="w-1 p-0"><div ref={sentinelRef} className="h-8 w-1" /></th>
                  </tr></thead>
                  <tbody>{rekapStudents.map(student => <tr key={student.riwayat_id}>
                    <td className="sticky left-0 z-10 border-b border-r bg-white p-3"><p className="font-bold text-slate-900">{student.nama}</p><p className="max-w-[150px] truncate text-[10px] text-slate-400">{studentMeta(student)}</p></td>
                    {sessions.map(sesi => {
                      const status = statusBySession[sesi.id]?.[student.riwayat_id]
                      return <td key={sesi.id} className="border-b border-r p-2 text-center">
                        {status ? <button type="button" disabled={!sesi.editable} onClick={() => cycleRecapStatus(sesi, student.riwayat_id)}
                          title={sesi.editable ? 'Ketuk untuk mengubah status' : 'Hanya dapat dibaca'}
                          className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-black ${STATUS_CLASS[status]} disabled:cursor-default disabled:opacity-70`}>
                          {status}<span className="sr-only">{STATUS_LABEL[status]}</span></button> : <span className="text-slate-300">—</span>}
                      </td>
                    })}<td /></tr>)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <SaveIndicator state={saveState} onRetry={() => sessions.forEach(sesi => void flush(sesi.id))} />
                {loadingMore ? <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat sesi lama...</span>
                  : hasMore ? <button type="button" onClick={() => void loadRecap(true)} className="min-h-10 rounded-lg border px-3 font-bold">Muat lebih lama</button>
                    : <span>Semua sesi sudah dimuat</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof CalendarCheck; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold ${active ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
    <Icon className="h-4 w-4" />{children}</button>
}

function StatusButton({ status, active, disabled, onClick }: { status: StatusAbsensiPengajar; active: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className={`min-h-11 rounded-xl border text-xs font-black ${active ? STATUS_CLASS[status] : 'border-slate-200 bg-white text-slate-400'} disabled:opacity-60`}>
    <span className="block text-sm">{status}</span><span className="text-[9px] font-semibold">{STATUS_LABEL[status]}</span>
  </button>
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return <span className="text-xs text-slate-400">Tersimpan otomatis</span>
  if (state === 'saving') return <span className="flex items-center gap-1 text-xs font-semibold text-sky-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan...</span>
  if (state === 'saved') return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan</span>
  return <button type="button" onClick={onRetry} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-rose-600"><AlertCircle className="h-3.5 w-3.5" /> Gagal — coba lagi</button>
}

function StatsCards({ stats }: { stats: AbsensiPengajarStats }) {
  const items = [
    ['Total Sesi', stats.totalSesi, 'text-slate-800'], ['Hadir', stats.hadir, 'text-emerald-700'],
    ['Sakit', stats.sakit, 'text-amber-700'], ['Izin', stats.izin, 'text-sky-700'],
    ['Alfa', stats.alfa, 'text-rose-700'], ['Kehadiran', `${stats.persentaseHadir}%`, 'text-violet-700'],
  ]
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{items.map(([label, value, tone]) =>
    <div key={String(label)} className="rounded-xl border bg-white p-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${tone}`}>{value}</p></div>)}</div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-white px-4 py-12 text-center text-sm text-slate-400"><Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />{text}</div>
}
