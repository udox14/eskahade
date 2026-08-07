'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardList,
  Loader2, Plus, RotateCcw, Search, Table2, Trash2, TrendingUp, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getNilaiHarianInitialData,
  getNilaiHarianInputData,
  getNilaiHarianMapelHome,
  getNilaiHarianRekapData,
  getNilaiHarianSesi,
  hapusNilaiHarianSesi,
  simpanNilaiHarian,
} from './actions'

const HISTORY_KEY = '__nilai_harian_step'
const NEW_SESI = '__new__'

type TabKey = 'input' | 'rekap'
type RekapView = 'sesi' | 'mapel' | 'semua'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type HistorySnapshot = {
  kelasId: string
  mapelId: number | null
  sesiId: string | null
  view: TabKey
  rekapView: RekapView
}

type PendingChange = { nilai: number | null; revision: number }

const HISTOGRAM_LABELS = ['0-49', '50-59', '60-69', '70-79', '80-89', '90-100']
const HISTOGRAM_COLORS = ['bg-rose-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-400', 'bg-teal-500']

function todayLocal() {
  return new Date().toISOString().slice(0, 10)
}

export default function NilaiHarianContent() {
  const [tab, setTab] = useState<TabKey>('input')
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kelasId, setKelasId] = useState('')
  const [mapelList, setMapelList] = useState<any[]>([])
  const [mapelId, setMapelId] = useState<number | null>(null)
  const [sesiList, setSesiList] = useState<any[]>([])
  const [sesiId, setSesiId] = useState<string | null>(null)
  const [santri, setSantri] = useState<any[]>([])
  const [santriSearch, setSantriSearch] = useState('')
  const [nilai, setNilai] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ namaSesi: 'Ulangan Harian 1', tanggal: todayLocal(), kkm: '70', deskripsi: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const [rekapView, setRekapView] = useState<RekapView>('sesi')
  const [rekapMapelFilter, setRekapMapelFilter] = useState('')
  const [rekapSesiId, setRekapSesiId] = useState('')
  const [rekapMapelId, setRekapMapelId] = useState('')
  const [rekapData, setRekapData] = useState<any>(null)
  const [rekapLoading, setRekapLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const kelasIdRef = useRef('')
  const mapelIdRef = useRef<number | null>(null)
  const sesiIdRef = useRef<string | null>(null)
  const formRef = useRef(form)
  const nilaiRef = useRef(nilai)
  const sesiListRef = useRef<any[]>([])
  const tabRef = useRef<TabKey>('input')
  const rekapViewRef = useRef<RekapView>('sesi')
  const pendingChangesRef = useRef(new Map<string, Map<string, PendingChange>>())
  const autosaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const autosaveInFlightRef = useRef(new Set<string>())
  const metadataDirtyRef = useRef(false)
  const changeRevisionRef = useRef(0)
  const historyReadyRef = useRef(false)
  const inputFetchSeqRef = useRef(0)

  kelasIdRef.current = kelasId
  mapelIdRef.current = mapelId
  sesiIdRef.current = sesiId
  formRef.current = form
  nilaiRef.current = nilai
  sesiListRef.current = sesiList
  tabRef.current = tab
  rekapViewRef.current = rekapView

  const step = !kelasId || !mapelId ? 'home' : !sesiId ? 'sesi' : 'input'
  const selectedMapel = mapelList.find((m: any) => m.id === mapelId)
  const selectedSesi = sesiList.find((s: any) => s.id === sesiId)

  const draftKey = useMemo(() => {
    if (!kelasId || !mapelId || !sesiId) return ''
    return `nilai-harian-draft:${kelasId}:${sesiId === NEW_SESI ? 'new' : sesiId}`
  }, [kelasId, mapelId, sesiId])

  const makeScope = (kelasId: string, mapelId: number | null, sesiId: string | null) => {
    if (!kelasId || !mapelId || !sesiId) return null
    const isNew = sesiId === NEW_SESI
    return {
      key: `nilai-harian:${kelasId}:${isNew ? 'new' : sesiId}`,
      kelasId,
      mapelId,
      sesiId: isNew ? null : sesiId,
      isNew,
    }
  }

  const scope = useMemo(
    () => makeScope(kelasId, mapelId, sesiId),
    [kelasId, mapelId, sesiId]
  )

  const makeSnapshot = (overrides: Partial<HistorySnapshot> = {}): HistorySnapshot => ({
    kelasId: overrides.kelasId !== undefined ? overrides.kelasId : kelasIdRef.current,
    mapelId: overrides.mapelId !== undefined ? overrides.mapelId : mapelIdRef.current,
    sesiId: overrides.sesiId !== undefined ? overrides.sesiId : sesiIdRef.current,
    view: overrides.view !== undefined ? overrides.view : tabRef.current,
    rekapView: overrides.rekapView !== undefined ? overrides.rekapView : rekapViewRef.current,
  })

  const readHistory = (): HistorySnapshot | null => {
    const raw = typeof window !== 'undefined' ? window.history.state?.[HISTORY_KEY] : null
    if (!raw || typeof raw !== 'object') return null
    return {
      kelasId: typeof raw.kelasId === 'string' ? raw.kelasId : '',
      mapelId: typeof raw.mapelId === 'number' ? raw.mapelId : null,
      sesiId: typeof raw.sesiId === 'string' ? raw.sesiId : null,
      view: raw.view === 'rekap' ? 'rekap' : 'input',
      rekapView: raw.rekapView === 'mapel' || raw.rekapView === 'semua' ? raw.rekapView : 'sesi',
    }
  }

  const writeHistory = (snapshot: HistorySnapshot, replace = false) => {
    if (typeof window === 'undefined') return
    const nextState = { ...(window.history.state || {}), [HISTORY_KEY]: snapshot }
    if (replace) window.history.replaceState(nextState, '', window.location.href)
    else window.history.pushState(nextState, '', window.location.href)
  }

  const pushHistory = (overrides: Partial<HistorySnapshot> = {}) => {
    if (!historyReadyRef.current) return
    const next = makeSnapshot(overrides)
    const previous = readHistory()
    if (previous && JSON.stringify(previous) === JSON.stringify(next)) return
    writeHistory(next)
  }

  useEffect(() => {
    getNilaiHarianInitialData().then(res => {
      setKelasList(res.kelas)
      let cachedKelasId = ''
      try { cachedKelasId = localStorage.getItem('nilai-harian-selected-kelas') || '' } catch {}
      const availableIds = res.kelas.map((k: any) => String(k.id))
      if (res.kelas.length === 1) setKelasId(String(res.kelas[0].id))
      else if (cachedKelasId && availableIds.includes(cachedKelasId)) setKelasId(cachedKelasId)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || historyReadyRef.current) return
    if (!readHistory()) {
      writeHistory({
        kelasId,
        mapelId: null,
        sesiId: null,
        view: 'input',
        rekapView: 'sesi',
      }, true)
    }
    historyReadyRef.current = true
  }, [kelasId, loading])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const raw = event.state?.[HISTORY_KEY]
      if (!raw) return
      const snapshot = readHistory()
      if (!snapshot) return
      if (snapshot.kelasId && snapshot.kelasId !== kelasIdRef.current) setKelasId(snapshot.kelasId)
      setMapelId(snapshot.mapelId)
      setSesiId(snapshot.sesiId)
      setTab(snapshot.view)
      setRekapView(snapshot.rekapView)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!kelasId || kelasList.length < 2) return
    try { localStorage.setItem('nilai-harian-selected-kelas', kelasId) } catch {}
  }, [kelasId, kelasList.length])

  useEffect(() => {
    if (!kelasId) {
      setMapelList([])
      setSesiList([])
      return
    }
    if (!mapelId) {
      getNilaiHarianMapelHome(kelasId).then(setMapelList)
    } else {
      getNilaiHarianSesi(kelasId, mapelId).then(setSesiList)
    }
  }, [kelasId, mapelId])

  const clearAutosaveTimer = (key: string) => {
    const timer = autosaveTimersRef.current.get(key)
    if (timer === undefined) return
    clearTimeout(timer)
    autosaveTimersRef.current.delete(key)
  }

  const scheduleAutosave = (target: any, delay = 1000) => {
    if (!target) return
    clearAutosaveTimer(target.key)
    const timer = setTimeout(() => {
      autosaveTimersRef.current.delete(target.key)
      void flushAutosave(target)
    }, delay)
    autosaveTimersRef.current.set(target.key, timer)
  }

  const flushAutosave = async (target: any) => {
    const pending = pendingChangesRef.current.get(target.key)
    const metaDirty = metadataDirtyRef.current
    if ((!pending || !pending.size) && !metaDirty) return
    if (autosaveInFlightRef.current.has(target.key)) return
    if (!formRef.current.namaSesi.trim()) return

    const snapshot = new Map(pending || [])
    autosaveInFlightRef.current.add(target.key)
    setSaving(true)
    setSaveStatus('saving')
    try {
      const res = await simpanNilaiHarian({
        kelasId: target.kelasId,
        mapelId: target.mapelId,
        sesiId: target.sesiId,
        tanggal: formRef.current.tanggal,
        namaSesi: formRef.current.namaSesi.trim(),
        kkm: Number(formRef.current.kkm || 0),
        deskripsi: formRef.current.deskripsi,
        nilai: Array.from(snapshot.entries()).map(([riwayatId, change]) => ({ riwayatId, nilai: change.nilai })),
      })
      if ('error' in res) throw new Error(res.error)

      if (target.isNew && res.sesiId) {
        pendingChangesRef.current.delete(target.key)
        metadataDirtyRef.current = false
        const realSesiId = res.sesiId
        try { sessionStorage.removeItem(`nilai-harian-draft:${target.kelasId}:new`) } catch {}
        setSesiId(realSesiId)
        writeHistory(makeSnapshot({ sesiId: realSesiId }), true)
        getNilaiHarianSesi(target.kelasId, target.mapelId).then(setSesiList)
        setDirty(false)
        setSaveStatus('saved')
        return
      }

      const latest = pendingChangesRef.current.get(target.key)
      for (const [riwayatId, change] of snapshot) {
        if (latest?.get(riwayatId)?.revision === change.revision) latest?.delete(riwayatId)
      }
      metadataDirtyRef.current = false

      if (!latest?.size) {
        pendingChangesRef.current.delete(target.key)
        try { sessionStorage.removeItem(`nilai-harian-draft:${target.kelasId}:${target.sesiId}`) } catch {}
        setDirty(false)
        setSaveStatus('saved')
      } else {
        setDirty(true)
        setSaveStatus('saving')
        if (!autosaveTimersRef.current.has(target.key)) scheduleAutosave(target, 0)
      }
    } catch (error) {
      console.error('[nilai-harian] autosave gagal:', error)
      setDirty(true)
      setSaveStatus('error')
    } finally {
      autosaveInFlightRef.current.delete(target.key)
      setSaving(false)
    }
  }

  const queueNilaiChange = (riwayatId: string, value: number | null, target = scope) => {
    if (!target) return
    let pending = pendingChangesRef.current.get(target.key)
    if (!pending) {
      pending = new Map()
      pendingChangesRef.current.set(target.key, pending)
    }
    pending.set(riwayatId, { nilai: value, revision: ++changeRevisionRef.current })
    setDirty(true)
    setSaveStatus('saving')
    scheduleAutosave(target)
  }

  const queueFormChange = (target = scope) => {
    if (!target) return
    metadataDirtyRef.current = true
    setDirty(true)
    setSaveStatus('saving')
    scheduleAutosave(target)
  }

  useEffect(() => {
    if (!kelasId || !mapelId || !sesiId) return
    const seq = ++inputFetchSeqRef.current
    const isNew = sesiId === NEW_SESI
    const draftKey = `nilai-harian-draft:${kelasId}:${isNew ? 'new' : sesiId}`
    getNilaiHarianInputData(kelasId, isNew ? undefined : sesiId).then(res => {
      if (seq !== inputFetchSeqRef.current) return
      setSantri(res.santri)
      const serverNilai: Record<string, number> = res.nilai || {}
      setNilai(Object.fromEntries(res.santri.map((row: any) => [row.riwayat_id, String(serverNilai[row.riwayat_id] ?? '')])))
      if (!isNew) {
        const sesi = sesiListRef.current.find((s: any) => s.id === sesiId)
        if (sesi) setForm({ namaSesi: sesi.nama_sesi, tanggal: sesi.tanggal, kkm: String(sesi.kkm || 0), deskripsi: sesi.deskripsi || '' })
      } else {
        setForm({ namaSesi: 'Ulangan Harian 1', tanggal: todayLocal(), kkm: '70', deskripsi: '' })
      }
      try {
        const raw = sessionStorage.getItem(draftKey)
        if (!raw) return
        const parsed = JSON.parse(raw)
        const target = makeScope(kelasId, mapelId, sesiId)
        if (!target) return
        if (parsed?.form && typeof parsed.form === 'object') {
          setForm({
            namaSesi: String(parsed.form.namaSesi ?? ''),
            tanggal: String(parsed.form.tanggal ?? todayLocal()),
            kkm: String(parsed.form.kkm ?? '70'),
            deskripsi: String(parsed.form.deskripsi ?? ''),
          })
          metadataDirtyRef.current = true
        }
        const draftNilai: Record<string, unknown> = parsed?.nilai || {}
        setNilai(prev => {
          const next = { ...prev }
          for (const [rid, v] of Object.entries(draftNilai)) {
            if (res.santri.some((row: any) => row.riwayat_id === rid)) next[rid] = String(v ?? '')
          }
          return next
        })
        const pending: [string, { nilai: number | null }][] = Array.isArray(parsed?.pending) ? parsed.pending : []
        for (const [rid, change] of pending) {
          if (!res.santri.some((row: any) => row.riwayat_id === rid)) continue
          queueNilaiChange(rid, change?.nilai ?? null, target)
        }
        toast.info('Draft nilai dipulihkan')
      } catch {}
    })
  }, [kelasId, mapelId, sesiId])

  useEffect(() => {
    if (!draftKey || !dirty) return
    const pending = scope ? pendingChangesRef.current.get(scope.key) : undefined
    const payload = {
      nilai: nilaiRef.current,
      form: formRef.current,
      pending: pending ? Array.from(pending.entries()).map(([rid, change]) => [rid, { nilai: change.nilai }]) : [],
      updatedAt: new Date().toISOString(),
    }
    try { sessionStorage.setItem(draftKey, JSON.stringify(payload)) } catch {}
  }, [draftKey, dirty, nilai, form, scope?.key])

  useEffect(() => {
    const timers = autosaveTimersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }, [])

  const handleNilaiChange = (riwayatId: string, raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 3)
    setNilai(prev => ({ ...prev, [riwayatId]: clean }))
    queueNilaiChange(riwayatId, clean === '' ? null : Number(clean))
  }

  const updateForm = (patch: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...patch }))
    queueFormChange()
  }

  const retryAutosave = () => {
    if (!scope) return
    setSaveStatus('saving')
    scheduleAutosave(scope, 0)
  }

  const resetAllDraft = () => {
    if (!scope || !sesiId) return
    pendingChangesRef.current.delete(scope.key)
    metadataDirtyRef.current = false
    clearAutosaveTimer(scope.key)
    inputFetchSeqRef.current++
    const isNew = sesiId === NEW_SESI
    getNilaiHarianInputData(kelasId, isNew ? undefined : sesiId).then(res => {
      setSantri(res.santri)
      const serverNilai: Record<string, number> = res.nilai || {}
      setNilai(Object.fromEntries(res.santri.map((row: any) => [row.riwayat_id, String(serverNilai[row.riwayat_id] ?? '')])))
      if (!isNew) {
        const sesi = sesiListRef.current.find((s: any) => s.id === sesiId)
        if (sesi) setForm({ namaSesi: sesi.nama_sesi, tanggal: sesi.tanggal, kkm: String(sesi.kkm || 0), deskripsi: sesi.deskripsi || '' })
      } else {
        setForm({ namaSesi: 'Ulangan Harian 1', tanggal: todayLocal(), kkm: '70', deskripsi: '' })
      }
    })
    setDirty(false)
    setSaveStatus('saved')
    try { if (draftKey) sessionStorage.removeItem(draftKey) } catch {}
  }

  const selectKelas = (nextKelasId: string) => {
    setKelasId(nextKelasId)
    setMapelId(null)
    setSesiId(null)
    setSantri([])
    setNilai({})
    setRekapData(null)
    writeHistory(makeSnapshot({ kelasId: nextKelasId, mapelId: null, sesiId: null }), true)
  }

  const selectMapel = (nextMapelId: number) => {
    setMapelId(nextMapelId)
    setSesiId(null)
    pushHistory({ mapelId: nextMapelId, sesiId: null })
  }

  const selectSesi = (nextSesiId: string) => {
    setSesiId(nextSesiId)
    pushHistory({ sesiId: nextSesiId })
  }

  const selectNewSesi = () => {
    setSesiId(NEW_SESI)
    setNilai({})
    setForm({ namaSesi: 'Ulangan Harian 1', tanggal: todayLocal(), kkm: '70', deskripsi: '' })
    pushHistory({ sesiId: NEW_SESI })
  }

  const goBack = () => {
    if (historyReadyRef.current && readHistory()) {
      window.history.back()
      return
    }
    if (step === 'input') setSesiId(null)
    else if (step === 'sesi') setMapelId(null)
  }

  const switchTab = (next: TabKey) => {
    setTab(next)
    pushHistory({ view: next })
  }

  const switchRekapView = (next: RekapView) => {
    setRekapView(next)
    setRekapSesiId('')
    setRekapMapelId('')
    if (next !== 'sesi') setRekapMapelFilter('')
    pushHistory({ rekapView: next, view: 'rekap' })
  }

  const handleDeleteSesi = async (sesi: any) => {
    setConfirmDeleteId(null)
    const res = await hapusNilaiHarianSesi(sesi.id, kelasId)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Sesi "${sesi.nama_sesi}" dihapus`)
    setSesiList(await getNilaiHarianSesi(kelasId, mapelId ?? undefined))
  }

  useEffect(() => {
    if (tab !== 'rekap' || !kelasId) return
    setRekapLoading(true)
    const filterMapel = rekapView === 'sesi' ? (rekapMapelFilter ? Number(rekapMapelFilter) : undefined) : undefined
    const selectedMapelForView = rekapView === 'mapel' ? (rekapMapelId ? Number(rekapMapelId) : undefined) : undefined
    getNilaiHarianRekapData(kelasId, rekapView, rekapSesiId || undefined, filterMapel ?? selectedMapelForView)
      .then(data => {
        setRekapData(data)
        if (data && !('error' in data)) {
          if (data.selectedSesiId) setRekapSesiId(data.selectedSesiId)
          if (data.selectedMapelId != null && rekapView === 'mapel') setRekapMapelId(String(data.selectedMapelId))
        }
      })
      .catch(() => setRekapData({ error: 'Gagal memuat rekap.' }))
      .finally(() => setRekapLoading(false))
  }, [kelasId, tab, rekapView, rekapMapelFilter, rekapSesiId, rekapMapelId])

  const filteredSantri = useMemo(() => {
    const needle = santriSearch.trim().toLowerCase()
    if (!needle) return santri
    return santri.filter((row: any) =>
      String(row.nama || '').toLowerCase().includes(needle) || String(row.nis || '').toLowerCase().includes(needle))
  }, [santri, santriSearch])

  if (loading) {
    return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-7 w-7 animate-spin" /></div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-28">
      {tab === 'input' && step === 'home' && (
        <DashboardPageHeader
          title="Nilai Harian"
          description="Pilih mapel, lalu buka atau buat sesi penilaian. Nilai tersimpan otomatis."
        />
      )}

      {tab === 'input' && step !== 'home' && (
        <div className="-mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white px-4 pb-3 pt-2 md:-mx-8 md:-mt-8 md:px-8">
          <button onClick={goBack} className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <ArrowLeft className="h-4 w-4" />
            {step === 'sesi' ? 'Daftar Mapel' : selectedMapel?.nama || 'Kembali'}
          </button>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Crumb on>{selectedMapel?.nama || ''}</Crumb>
            {step === 'input' && (
              <>
                <Sep />
                <span className="font-bold text-slate-900">{sesiId === NEW_SESI ? 'Sesi Baru' : selectedSesi?.nama_sesi || 'Sesi'}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button onClick={() => switchTab('input')} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${tab === 'input' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            Input
          </button>
          <button onClick={() => switchTab('rekap')} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${tab === 'rekap' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            Rekap
          </button>
        </div>
      </div>

      {tab === 'input' && step === 'home' && (
        <div className="mt-5 space-y-4">
          {kelasList.length > 1 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Kelas</label>
              <select value={kelasId} onChange={e => selectKelas(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Pilih kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>
          ) : kelasList.length === 1 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-emerald-600">Kelas</p>
              <p className="font-bold text-emerald-900">{kelasList[0].nama_kelas}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">
              Belum ada kelas yang bisa diakses.
            </div>
          )}

          {kelasId && (
            <div className="grid gap-3 sm:grid-cols-2">
              {mapelList.map((m: any) => (
                <button key={m.id} onClick={() => selectMapel(m.id)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><BookOpen className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-slate-900">{m.nama}</h2>
                    <p className="truncate text-xs italic text-slate-500">{m.nama_kitab}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-emerald-700">{m.total_sesi} sesi</p>
                    <ChevronRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                  </div>
                </button>
              ))}
              {mapelList.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">
                  Belum ada mapel berkitab untuk kelas ini.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'input' && step === 'sesi' && (
        <div className="space-y-3">
          <button onClick={selectNewSesi} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-left text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50">
            <div className="rounded-xl bg-emerald-100 p-2.5"><Plus className="h-5 w-5" /></div>
            <div className="flex-1">
              <h2 className="font-bold">Buat Sesi Baru</h2>
              <p className="text-xs text-emerald-600">Mulai penilaian baru untuk {selectedMapel?.nama || 'mapel ini'}</p>
            </div>
            <ChevronRight className="h-5 w-5" />
          </button>

          {sesiList.map((s: any) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {confirmDeleteId === s.id ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm font-bold text-rose-700">Hapus sesi &quot;{s.nama_sesi}&quot; beserta semua nilainya?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteSesi(s)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">Ya, hapus</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Batal</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => selectSesi(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="shrink-0 rounded-xl bg-slate-50 p-2.5 text-slate-500"><CalendarDays className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{s.nama_sesi}</p>
                      <p className="text-xs text-slate-400">{s.tanggal} · {s.mapel_nama}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">KKM {s.kkm || 0}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{s.total_nilai || 0} nilai terisi</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(s.id)} title="Hapus sesi" aria-label="Hapus sesi" className="shrink-0 rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {sesiList.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">
              Belum ada sesi penilaian untuk {selectedMapel?.nama}. Buat sesi baru untuk mulai.
            </div>
          )}
        </div>
      )}

      {tab === 'input' && step === 'input' && (
        <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><ClipboardList className="h-4 w-4 text-emerald-600" /> Detail Sesi</h2>
              <div className="space-y-3">
                <input
                  value={form.namaSesi}
                  onChange={e => updateForm({ namaSesi: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nama sesi (mis. Ulangan Harian 1)"
                />
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={e => updateForm({ tanggal: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.kkm}
                  onChange={e => updateForm({ kkm: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="KKM"
                />
                <textarea
                  value={form.deskripsi}
                  onChange={e => updateForm({ deskripsi: e.target.value })}
                  className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Deskripsi opsional"
                />
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Nilai kosong = belum dinilai. Perubahan tersimpan otomatis.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
              <h2 className="flex items-center gap-2 font-bold text-slate-800"><BookOpen className="h-4 w-4 text-emerald-600" /> Daftar Nilai</h2>
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className={saveStatus === 'error' ? 'text-rose-600' : saveStatus === 'saving' ? 'text-amber-700' : 'text-emerald-700'}>
                  {saveStatus === 'error' ? 'Gagal menyimpan' : saveStatus === 'saving' ? 'Menyimpan' : saveStatus === 'saved' ? 'Tersimpan' : ''}
                </span>
                {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                {saveStatus === 'error' && (
                  <button onClick={retryAutosave} disabled={saving} className="text-xs font-black text-rose-700 underline underline-offset-2 disabled:opacity-50">Coba lagi</button>
                )}
              </div>
            </div>

            <div className="border-b bg-white p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={santriSearch}
                  onChange={e => setSantriSearch(e.target.value)}
                  placeholder="Cari nama / NIS"
                  className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {filteredSantri.map((row: any, idx: number) => (
                <div key={row.riwayat_id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-slate-400">No. {idx + 1}</p>
                      <p className="truncate font-semibold text-slate-800">{row.nama}</p>
                      <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={nilai[row.riwayat_id] ?? ''}
                      onChange={e => handleNilaiChange(row.riwayat_id, e.target.value)}
                      placeholder="-"
                      className="h-12 w-24 shrink-0 rounded-lg border border-slate-200 text-center text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ))}
              {filteredSantri.length === 0 && <div className="py-12 text-center text-slate-400">Tidak ada santri.</div>}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-white text-xs text-slate-500">
                  <tr>
                    <th className="w-14 px-3 py-2 text-center">No</th>
                    <th className="px-3 py-2 text-left">Santri</th>
                    <th className="w-32 px-3 py-2 text-center">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSantri.map((row: any, idx: number) => (
                    <tr key={row.riwayat_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800">{row.nama}</p>
                        <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          value={nilai[row.riwayat_id] ?? ''}
                          onChange={e => handleNilaiChange(row.riwayat_id, e.target.value)}
                          placeholder="-"
                          className="h-10 w-full rounded-lg border border-slate-200 text-center font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredSantri.length === 0 && (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-400">Tidak ada santri.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="space-y-4">
          {!kelasId && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Pilih kelas untuk melihat rekap</label>
              <select value={kelasId} onChange={e => selectKelas(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Pilih kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>
          )}

          {kelasId && (
            <>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex rounded-lg bg-slate-100 p-1">
                  {([
                    { id: 'sesi', label: 'Per Sesi' },
                    { id: 'mapel', label: 'Per Mapel' },
                    { id: 'semua', label: 'Keseluruhan' },
                  ] as { id: RekapView; label: string }[]).map(item => (
                    <button key={item.id} onClick={() => switchRekapView(item.id)} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${rekapView === item.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {rekapLoading ? (
                <div className="rounded-xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : !rekapData ? null : 'error' in rekapData ? (
                <div className="rounded-xl border bg-white p-12 text-center text-sm font-semibold text-rose-500">{(rekapData as any).error}</div>
              ) : rekapData.empty ? (
                <div className="rounded-xl border border-dashed bg-white p-12 text-center text-sm font-semibold text-slate-400">
                  Belum ada sesi penilaian untuk kelas ini.
                </div>
              ) : rekapView === 'sesi' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Filter mapel</label>
                      <select
                        value={rekapMapelFilter}
                        onChange={e => { setRekapMapelFilter(e.target.value); setRekapSesiId('') }}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Semua mapel</option>
                        {rekapData.mapelList.map((m: any) => (
                          <option key={m.mapel_id} value={m.mapel_id}>{m.mapel_nama}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Pilih sesi</label>
                      <select
                        value={rekapSesiId}
                        onChange={e => setRekapSesiId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {rekapData.sesiList.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.mapel_nama} — {s.nama_sesi} ({s.tanggal})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {rekapData.selectedSesi && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                      <h2 className="font-bold text-emerald-900">{rekapData.selectedSesi.nama_sesi}</h2>
                      <span className="text-xs font-semibold text-emerald-700">{rekapData.selectedSesi.mapel_nama}</span>
                      <span className="text-xs font-semibold text-emerald-700">{rekapData.selectedSesi.tanggal}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">KKM {rekapData.selectedSesi.kkm}</span>
                      <span className="ml-auto text-xs font-bold text-emerald-800">{rekapData.stats.count} dari {rekapData.santriList.length} santri dinilai</span>
                    </div>
                  )}

                  <StatsCards stats={rekapData.stats} />
                  <Histogram histogram={rekapData.stats.histogram} />

                  <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 font-bold text-slate-800">
                      <Table2 className="h-4 w-4 text-emerald-600" /> Daftar Nilai Sesi
                    </div>
                    <div className="space-y-3 p-3 md:hidden">
                      {rekapData.santriList.map((row: any, idx: number) => (
                        <div key={row.riwayat_id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-slate-400">No. {idx + 1}</p>
                              <p className="truncate font-semibold text-slate-800">{row.nama}</p>
                              <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`text-lg font-black ${row.nilai == null ? 'text-slate-300' : row.nilai >= rekapData.selectedSesi.kkm ? 'text-emerald-600' : 'text-rose-500'}`}>{row.nilai ?? '-'}</p>
                              <p className="text-[10px] font-bold">{row.nilai == null ? 'belum dinilai' : row.nilai >= rekapData.selectedSesi.kkm ? 'Tuntas' : 'Belum'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {rekapData.santriList.length === 0 && <div className="py-10 text-center text-slate-400">Tidak ada santri.</div>}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-xs text-slate-500">
                          <tr>
                            <th className="w-14 px-3 py-2 text-center">No</th>
                            <th className="px-3 py-2 text-left">Santri</th>
                            <th className="w-32 px-3 py-2 text-center">Nilai</th>
                            <th className="w-28 px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rekapData.santriList.map((row: any, idx: number) => {
                            const tuntas = row.nilai != null && row.nilai >= rekapData.selectedSesi.kkm
                            return (
                              <tr key={row.riwayat_id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-center text-xs text-slate-400">{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-slate-800">{row.nama}</p>
                                  <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                                </td>
                                <td className="px-3 py-2 text-center font-mono font-bold">{row.nilai ?? '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  {row.nilai == null ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Belum dinilai</span>
                                  ) : tuntas ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Tuntas</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600"><XCircle className="h-3 w-3" /> Belum</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {rekapData.santriList.length === 0 && (
                            <tr><td colSpan={4} className="py-12 text-center text-slate-400">Tidak ada santri.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : rekapView === 'mapel' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Pilih mapel</label>
                    <select
                      value={rekapMapelId}
                      onChange={e => setRekapMapelId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {rekapData.mapelList.map((m: any) => (
                        <option key={m.mapel_id} value={m.mapel_id}>{m.mapel_nama}</option>
                      ))}
                    </select>
                  </div>

                  {rekapData.selectedMapel && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                      <h2 className="font-bold text-emerald-900">{rekapData.selectedMapel.mapel_nama}</h2>
                      <span className="text-xs italic text-emerald-700">{rekapData.selectedMapel.nama_kitab}</span>
                      <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">{rekapData.selectedMapel.total_sesi} sesi</span>
                    </div>
                  )}

                  <StatsCards stats={rekapData.stats} />
                  <Histogram histogram={rekapData.stats.histogram} />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 font-bold text-slate-800">
                        <CalendarDays className="h-4 w-4 text-emerald-600" /> Statistik per Sesi
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="bg-white text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Sesi</th>
                              <th className="px-3 py-2 text-center">KKM</th>
                              <th className="px-3 py-2 text-center">N</th>
                              <th className="px-3 py-2 text-center">Rata</th>
                              <th className="px-3 py-2 text-center">Min</th>
                              <th className="px-3 py-2 text-center">Max</th>
                              <th className="px-3 py-2 text-center">Tuntas</th>
                              <th className="px-3 py-2 text-center">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rekapData.perSesi.map((row: any) => (
                              <tr key={row.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-slate-800">{row.nama_sesi}</p>
                                  <p className="text-[10px] text-slate-400">{row.tanggal}</p>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{row.kkm}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count}</td>
                                <td className="px-3 py-2 text-center font-mono font-bold text-emerald-700">{row.count ? row.avg : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? row.min : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? row.max : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? `${row.tuntas}/${row.count}` : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? `${row.pctTuntas}%` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <SantriRankTable rows={rekapData.perSantri} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <StatsCards stats={rekapData.stats} />
                  <Histogram histogram={rekapData.stats.histogram} />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 font-bold text-slate-800">
                        <TrendingUp className="h-4 w-4 text-emerald-600" /> Statistik per Mapel
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="bg-white text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Mapel</th>
                              <th className="px-3 py-2 text-center">Sesi</th>
                              <th className="px-3 py-2 text-center">N</th>
                              <th className="px-3 py-2 text-center">Rata</th>
                              <th className="px-3 py-2 text-center">Min</th>
                              <th className="px-3 py-2 text-center">Max</th>
                              <th className="px-3 py-2 text-center">Tuntas</th>
                              <th className="px-3 py-2 text-center">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rekapData.perMapel.map((row: any) => (
                              <tr key={row.mapel_id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-slate-800">{row.mapel_nama}</p>
                                  <p className="truncate text-[10px] italic text-slate-400">{row.nama_kitab}</p>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{row.total_sesi}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count}</td>
                                <td className="px-3 py-2 text-center font-mono font-bold text-emerald-700">{row.count ? row.avg : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? row.min : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? row.max : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? `${row.tuntas}/${row.count}` : '-'}</td>
                                <td className="px-3 py-2 text-center font-mono">{row.count ? `${row.pctTuntas}%` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <SantriRankTable rows={rekapData.perSantri} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'input' && step === 'input' && (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-2 px-3 sm:bottom-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-lg">
            <span className={saveStatus === 'error' ? 'text-rose-600' : saveStatus === 'saving' ? 'text-amber-700' : 'text-emerald-700'}>
              {saveStatus === 'error' ? 'Gagal menyimpan' : saveStatus === 'saving' ? 'Menyimpan' : 'Tersimpan'}
            </span>
            {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
            {saveStatus === 'error' && (
              <button onClick={retryAutosave} disabled={saving} className="text-xs font-black text-rose-700 underline underline-offset-2 disabled:opacity-50">Coba lagi</button>
            )}
          </div>
          {dirty && (
            <button
              type="button"
              onClick={resetAllDraft}
              disabled={saving}
              title="Batalkan perubahan"
              aria-label="Batalkan perubahan"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Crumb({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <span className={`font-bold ${on ? 'text-slate-900' : 'text-slate-400'}`}>{children}</span>
}

function Sep() {
  return <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
}

function StatsCards({ stats }: { stats: any }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      <StatCard label="Dinilai" value={stats.count} />
      <StatCard label="Rata-rata" value={stats.count ? stats.avg : '-'} />
      <StatCard label="Tertinggi" value={stats.count ? stats.max : '-'} tone="sky" />
      <StatCard label="Terendah" value={stats.count ? stats.min : '-'} tone="amber" />
      <StatCard label="Tuntas" value={stats.tuntas} tone="emerald" />
      <StatCard label="Belum tuntas" value={stats.tidakTuntas} tone="rose" />
      <StatCard label="% Tuntas" value={stats.count ? `${stats.pctTuntas}%` : '-'} tone="violet" />
    </div>
  )
}

function StatCard({ label, value, tone = 'emerald' }: { label: string; value: React.ReactNode; tone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'slate' }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-50 text-slate-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  )
}

function Histogram({ histogram }: { histogram: number[] }) {
  const values = Array.isArray(histogram) && histogram.length === 6 ? histogram : [0, 0, 0, 0, 0, 0]
  const max = Math.max(1, ...values)
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Distribusi Nilai
      </p>
      <div className="flex h-32 items-end gap-2">
        {values.map((value, idx) => (
          <div key={idx} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500">{value}</span>
            <div className={`w-full rounded-t-md transition-all ${HISTOGRAM_COLORS[idx]}`} style={{ height: `${(value / max) * 84}px` }} />
            <span className="text-[9px] font-bold text-slate-400">{HISTOGRAM_LABELS[idx]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SantriRankTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 font-bold text-slate-800">
        <TrendingUp className="h-4 w-4 text-emerald-600" /> Rata-rata per Santri
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2 text-center">#</th>
              <th className="px-3 py-2 text-left">Santri</th>
              <th className="px-3 py-2 text-center">Nilai</th>
              <th className="px-3 py-2 text-center">Rata</th>
              <th className="px-3 py-2 text-center">Min</th>
              <th className="px-3 py-2 text-center">Max</th>
              <th className="px-3 py-2 text-center">Tuntas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row: any, idx: number) => (
              <tr key={row.riwayat_id} className="hover:bg-slate-50">
                <td className={`px-3 py-2 text-center font-black ${idx < 3 ? 'text-emerald-600' : 'text-slate-400'}`}>{idx + 1}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-800">{row.nama}</p>
                  <p className="text-[10px] text-slate-400">{row.nis || '-'}</p>
                </td>
                <td className="px-3 py-2 text-center font-mono">{row.count}</td>
                <td className="px-3 py-2 text-center font-mono font-bold text-emerald-700">{row.count ? row.avg : '-'}</td>
                <td className="px-3 py-2 text-center font-mono">{row.count ? row.min : '-'}</td>
                <td className="px-3 py-2 text-center font-mono">{row.count ? row.max : '-'}</td>
                <td className="px-3 py-2 text-center font-mono">{row.count ? `${row.tuntas}/${row.count}` : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">Belum ada nilai.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
