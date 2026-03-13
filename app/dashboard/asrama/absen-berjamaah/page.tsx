'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSessionBerjamaah, getDataAbsenBerjamaah, batchSaveAbsenBerjamaah } from './actions'
import { Sun, ChevronLeft, ChevronRight, Loader2, Lock, Save, CheckCircle, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const WAKTU = ['shubuh', 'ashar', 'maghrib', 'isya'] as const
type Waktu = typeof WAKTU[number]
type Status = null | 'A' | 'S' | 'H' | 'P'

const STATUS_OPTS: { val: Status; label: string; color: string; bg: string }[] = [
  { val: null, label: 'Hadir', color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
  { val: 'A',  label: 'Alfa',  color: 'text-red-700',   bg: 'bg-red-100 border-red-300' },
  { val: 'S',  label: 'Sakit', color: 'text-orange-700',bg: 'bg-orange-100 border-orange-300' },
  { val: 'H',  label: 'Haid',  color: 'text-purple-700',bg: 'bg-purple-100 border-purple-300' },
  { val: 'P',  label: 'Pulang',color: 'text-blue-700',  bg: 'bg-blue-100 border-blue-300' },
]

const WAKTU_META = {
  shubuh:  { label: 'Shubuh',  icon: '🌙', color: 'from-indigo-900 to-slate-900' },
  ashar:   { label: 'Ashar',   icon: '☀️', color: 'from-orange-700 to-amber-800' },
  maghrib: { label: 'Maghrib', icon: '🌅', color: 'from-rose-800 to-orange-900' },
  isya:    { label: 'Isya',    icon: '🌃', color: 'from-slate-800 to-indigo-950' },
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

type SantriRow = {
  id: string; nama_lengkap: string; nis: string; kamar: string
  shubuh: Status; ashar: Status; maghrib: Status; isya: Status
}

export default function AbsenBerjamaahPage() {
  const [sessionInfo, setSessionInfo] = useState<{ role: string; asrama_binaan: string | null } | null | 'loading'>('loading')
  const [asrama, setAsrama] = useState('')
  const [tanggal, setTanggal] = useState(todayStr())
  const [santriList, setSantriList] = useState<SantriRow[]>([])
  const [localData, setLocalData] = useState<Record<string, Record<Waktu, Status>>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedKamars, setSavedKamars] = useState<Set<string>>(new Set())
  const [kamarIdx, setKamarIdx] = useState(0)

  useEffect(() => {
    getSessionBerjamaah().then(s => {
      setSessionInfo(s)
      if (s?.asrama_binaan) setAsrama(s.asrama_binaan)
      else if (s?.role === 'admin') setAsrama(ASRAMA_PUTRI[0])
    })
  }, [])

  const load = useCallback(async () => {
    if (!asrama) return
    setLoading(true)
    const res = await getDataAbsenBerjamaah(asrama, tanggal)
    setSantriList(res as SantriRow[])
    const map: Record<string, Record<Waktu, Status>> = {}
    res.forEach((s: any) => {
      map[s.id] = { shubuh: s.shubuh, ashar: s.ashar, maghrib: s.maghrib, isya: s.isya }
    })
    setLocalData(map)
    setSavedKamars(new Set())
    setKamarIdx(0)
    setLoading(false)
  }, [asrama, tanggal])

  useEffect(() => { if (asrama) load() }, [load, asrama])

  const grouped = santriList.reduce((acc, s) => {
    const k = s.kamar || 'Tanpa Kamar'
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {} as Record<string, SantriRow[]>)

  const kamars = Object.keys(grouped).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const activeKamar = kamars[kamarIdx]
  const santriKamar = activeKamar ? grouped[activeKamar] : []

  const setStatus = (santriId: string, waktu: Waktu, val: Status) => {
    setLocalData(prev => ({ ...prev, [santriId]: { ...(prev[santriId] || { shubuh: null, ashar: null, maghrib: null, isya: null }), [waktu]: val } }))
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
  }

  // Cycle through status on tap
  const cycleStatus = (santriId: string, waktu: Waktu) => {
    const curr = localData[santriId]?.[waktu] ?? null
    const opts = STATUS_OPTS.map(o => o.val)
    const next = opts[(opts.indexOf(curr) + 1) % opts.length]
    setStatus(santriId, waktu, next)
  }

  const saveKamar = async () => {
    setSaving(true)
    const records = santriKamar.map(s => ({
      santri_id: s.id,
      shubuh: localData[s.id]?.shubuh ?? null,
      ashar: localData[s.id]?.ashar ?? null,
      maghrib: localData[s.id]?.maghrib ?? null,
      isya: localData[s.id]?.isya ?? null,
    }))
    const res = await batchSaveAbsenBerjamaah(records, tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    setSavedKamars(prev => new Set([...prev, activeKamar]))
    toast.success(`Kamar ${activeKamar} tersimpan`)
    const nextIdx = kamars.findIndex((k, i) => i > kamarIdx && !savedKamars.has(k))
    if (nextIdx !== -1) setTimeout(() => setKamarIdx(nextIdx), 300)
  }

  // Stats
  const countStatus = (waktu: Waktu, val: Status) =>
    santriList.filter(s => (localData[s.id]?.[waktu] ?? null) === val).length
  const totalSantri = santriList.length

  if (sessionInfo === 'loading') return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500"/>
    </div>
  )

  if (!sessionInfo) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 p-8 text-center">
      <ShieldOff className="w-16 h-16 text-gray-300"/>
      <h2 className="text-xl font-bold text-gray-500">Akses Ditolak</h2>
      <p className="text-sm text-gray-400">Fitur ini hanya untuk Pengurus Asrama ASY-SYIFA 1–4.</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto pb-32 select-none">

      {/* HEADER */}
      <div className={`bg-gradient-to-br from-emerald-900 to-teal-900 text-white p-5 rounded-b-3xl shadow-xl mb-4 relative overflow-hidden`}>
        <div className="relative z-10 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-300"/> Absen Berjamaah
            </h1>
            {sessionInfo.asrama_binaan
              ? <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-sm font-bold">
                  <Lock className="w-3 h-3"/> {sessionInfo.asrama_binaan}
                </div>
              : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                  className="bg-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-xl outline-none border border-white/20 cursor-pointer">
                  {ASRAMA_PUTRI.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
                </select>
            }
          </div>

          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl outline-none border border-white/20 w-full cursor-pointer"/>

          {/* Ringkasan 4 waktu */}
          <div className="grid grid-cols-4 gap-1.5">
            {WAKTU.map(w => {
              const alfa = countStatus(w, 'A')
              const sakit = countStatus(w, 'S')
              const hadir = totalSantri - (santriList.filter(s => (localData[s.id]?.[w] ?? null) !== null).length)
              return (
                <div key={w} className="bg-white/10 rounded-xl p-2 text-center">
                  <p className="text-base">{WAKTU_META[w].icon}</p>
                  <p className="text-[10px] font-bold text-white/80 uppercase">{WAKTU_META[w].label}</p>
                  <p className="text-sm font-black text-white tabular-nums">{hadir}/{totalSantri}</p>
                  {(alfa > 0 || sakit > 0) && (
                    <p className="text-[9px] text-red-300 font-bold">A:{alfa} S:{sakit}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl"/>
      </div>

      {/* KAMAR NAV */}
      {!loading && kamars.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-3">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="p-2 bg-white rounded-xl shadow border disabled:opacity-30 active:scale-90">
            <ChevronLeft className="w-5 h-5 text-slate-700"/>
          </button>
          <select value={kamarIdx} onChange={e => setKamarIdx(Number(e.target.value))}
            className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm font-bold text-center outline-none shadow cursor-pointer">
            {kamars.map((k, i) => (
              <option key={k} value={i}>
                {savedKamars.has(k) ? '✓ ' : ''}Kamar {k} ({grouped[k]?.length || 0})
              </option>
            ))}
          </select>
          <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
            className="p-2 bg-white rounded-xl shadow border disabled:opacity-30 active:scale-90">
            <ChevronRight className="w-5 h-5 text-slate-700"/>
          </button>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-400"/></div>
      ) : kamars.length === 0 ? (
        <div className="mx-4 py-16 text-center bg-white rounded-2xl border border-dashed text-slate-400">
          Tidak ada santri di asrama ini.
        </div>
      ) : (
        <div className="mx-4 bg-white rounded-2xl shadow border overflow-hidden" key={activeKamar}>
          {/* Kamar header */}
          <div className="bg-teal-900 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-base">KAMAR {activeKamar}</span>
            <div className="flex items-center gap-2">
              {savedKamars.has(activeKamar) && (
                <span className="text-[10px] bg-green-500/30 text-green-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3"/> Tersimpan
                </span>
              )}
              <span className="text-xs text-teal-300">{santriKamar.length} santri</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-3 py-2 bg-slate-50 border-b">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Nama</div>
            {WAKTU.map(w => (
              <div key={w} className="text-[10px] text-slate-500 font-bold text-center leading-tight">
                {WAKTU_META[w].icon}<br/>{WAKTU_META[w].label}
              </div>
            ))}
          </div>

          {/* Santri rows */}
          <div className="divide-y divide-slate-100">
            {santriKamar.map((s: SantriRow) => (
              <div key={s.id} className="grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-3 py-2.5 items-center hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{s.nama_lengkap}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{s.nis}</p>
                </div>
                {WAKTU.map(w => {
                  const val = localData[s.id]?.[w] ?? null
                  const opt = STATUS_OPTS.find(o => o.val === val) || STATUS_OPTS[0]
                  return (
                    <button key={w} onClick={() => cycleStatus(s.id, w)}
                      className={`w-10 h-10 rounded-xl border-2 text-xs font-black transition-all active:scale-90 ${opt.bg} ${opt.color}`}>
                      {val === null ? '✓' : val}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 bg-slate-50 border-t flex flex-wrap gap-2">
            {STATUS_OPTS.map(o => (
              <span key={String(o.val)} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${o.bg} ${o.color}`}>
                {o.val === null ? '✓' : o.val} = {o.label}
              </span>
            ))}
            <span className="text-[10px] text-slate-400 ml-auto">Tap untuk ganti status</span>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM */}
      {!loading && kamars.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-slate-100 to-transparent z-40">
          <div className="max-w-lg mx-auto flex gap-3">
            <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
              className="p-3.5 bg-white border rounded-2xl shadow disabled:opacity-30 active:scale-90">
              <ChevronLeft className="w-5 h-5 text-slate-600"/>
            </button>
            <button onClick={saveKamar} disabled={saving}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${
                savedKamars.has(activeKamar) ? 'bg-green-600 text-white' : 'bg-teal-900 text-white'
              }`}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin"/>
                : savedKamars.has(activeKamar) ? <><CheckCircle className="w-5 h-5"/> TERSIMPAN</>
                : <><Save className="w-5 h-5"/> SIMPAN KAMAR {activeKamar}</>}
            </button>
            <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
              className="p-3.5 bg-white border rounded-2xl shadow disabled:opacity-30 active:scale-90">
              <ChevronRight className="w-5 h-5 text-slate-600"/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
