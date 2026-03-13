'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSessionInfo, getDataAbsenMalam, batchSaveAbsenMalam } from './actions'
import { Moon, Home, ChevronLeft, ChevronRight, Loader2, Lock, Save, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AbsenMalamPage() {
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [asramaBinaan, setAsramaBinaan] = useState<string | null>(null)
  const [tanggal, setTanggal] = useState(todayStr())
  const [santriList, setSantriList] = useState<any[]>([])
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedKamars, setSavedKamars] = useState<Set<string>>(new Set())
  const [kamarIdx, setKamarIdx] = useState(0)

  useEffect(() => {
    getSessionInfo().then(s => {
      if (s?.asrama_binaan) { setAsramaBinaan(s.asrama_binaan); setAsrama(s.asrama_binaan) }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getDataAbsenMalam(asrama, tanggal)
    setSantriList(res)
    const map: Record<string, string> = {}
    res.forEach((s: any) => { map[s.id] = s.status })
    setLocalStatus(map)
    setSavedKamars(new Set())
    setKamarIdx(0)
    setLoading(false)
  }, [asrama, tanggal])

  useEffect(() => { load() }, [load])

  const grouped = santriList.reduce((acc, s) => {
    const k = s.kamar || 'Tanpa Kamar'
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {} as Record<string, any[]>)

  const kamars = Object.keys(grouped).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const activeKamar = kamars[kamarIdx]
  const santriKamar: any[] = activeKamar ? grouped[activeKamar] : []

  const hadir = Object.values(localStatus).filter(v => v === 'HADIR').length
  const alfa = Object.values(localStatus).filter(v => v === 'ALFA').length
  const izin = Object.values(localStatus).filter(v => v === 'IZIN').length

  const toggle = (id: string) => {
    if (santriList.find(s => s.id === id)?.is_izin) return
    setLocalStatus(prev => ({ ...prev, [id]: prev[id] === 'ALFA' ? 'HADIR' : 'ALFA' }))
    // Mark kamar unsaved when changed
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
  }

  const saveKamar = async () => {
    setSaving(true)
    const records = santriKamar
      .filter(s => !s.is_izin)
      .map(s => ({ santri_id: s.id, status: localStatus[s.id] || 'HADIR' }))
    const res = await batchSaveAbsenMalam(records, tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    setSavedKamars(prev => new Set([...prev, activeKamar]))
    toast.success(`Kamar ${activeKamar} tersimpan`)
    // Auto advance to next unsaved kamar
    const nextIdx = kamars.findIndex((k, i) => i > kamarIdx && !savedKamars.has(k))
    if (nextIdx !== -1) setKamarIdx(nextIdx)
  }

  return (
    <div className="max-w-lg mx-auto pb-32 select-none">

      {/* HEADER */}
      <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-xl mb-4 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Moon className="w-5 h-5 text-yellow-300"/> Absen Malam
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-sm font-bold ${asramaBinaan ? 'bg-green-800/60 text-green-300' : 'bg-white/10'}`}>
              {asramaBinaan ? <Lock className="w-3 h-3"/> : <Home className="w-3.5 h-3.5 text-slate-400"/>}
              {asramaBinaan
                ? <span>{asramaBinaan}</span>
                : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                    className="bg-transparent text-white text-sm outline-none cursor-pointer">
                    {ASRAMA_LIST.map(a => <option key={a} value={a} className="text-black">{a}</option>)}
                  </select>
              }
            </div>
          </div>

          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl outline-none border border-white/20 w-full cursor-pointer"/>

          <div className="flex gap-3">
            <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black">{hadir}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Hadir</p>
            </div>
            <div className="flex-1 bg-red-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-red-300">{alfa}</p>
              <p className="text-[10px] text-red-400 font-bold uppercase">Alfa</p>
            </div>
            <div className="flex-1 bg-blue-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-300">{izin}</p>
              <p className="text-[10px] text-blue-400 font-bold uppercase">Izin</p>
            </div>
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
                {savedKamars.has(k) ? '✓ ' : ''}Kamar {k} ({grouped[k]?.length || 0} santri)
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
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
      ) : kamars.length === 0 ? (
        <div className="mx-4 py-16 text-center bg-white rounded-2xl border border-dashed text-slate-400">
          Tidak ada santri di asrama ini.
        </div>
      ) : (
        <div className="mx-4 bg-white rounded-2xl shadow border overflow-hidden" key={activeKamar}>
          {/* Kamar header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-base">KAMAR {activeKamar}</span>
            <div className="flex items-center gap-2">
              {savedKamars.has(activeKamar) && (
                <span className="text-[10px] bg-green-500/30 text-green-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3"/> Tersimpan
                </span>
              )}
              <span className="text-xs text-slate-400">{santriKamar.length} santri</span>
            </div>
          </div>

          {/* Santri list */}
          <div className="divide-y divide-slate-100">
            {santriKamar.map((s: any) => {
              const st = localStatus[s.id] || 'HADIR'
              const isAlfa = st === 'ALFA'
              const isIzin = s.is_izin
              return (
                <button key={s.id} disabled={isIzin}
                  onClick={() => toggle(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.98] text-left ${
                    isAlfa ? 'bg-red-50' : isIzin ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 ${
                    isAlfa ? 'bg-red-500 text-white border-red-400' :
                    isIzin ? 'bg-blue-100 text-blue-600 border-blue-200' :
                    'bg-green-100 text-green-700 border-green-200'
                  }`}>{s.nis?.slice(-2) || '??'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{s.nis}</p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${
                    isAlfa ? 'bg-red-500 text-white' :
                    isIzin ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {isIzin ? 'IZIN' : isAlfa ? 'ALFA' : 'HADIR'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* FIXED BOTTOM: SAVE + NAV */}
      {!loading && kamars.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-slate-100 to-transparent z-40">
          <div className="max-w-lg mx-auto flex gap-3">
            <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
              className="p-3.5 bg-white border rounded-2xl shadow disabled:opacity-30 active:scale-90">
              <ChevronLeft className="w-5 h-5 text-slate-600"/>
            </button>
            <button onClick={saveKamar} disabled={saving}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${
                savedKamars.has(activeKamar)
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-900 text-white'
              }`}>
              {saving
                ? <Loader2 className="w-5 h-5 animate-spin"/>
                : savedKamars.has(activeKamar)
                  ? <><CheckCircle className="w-5 h-5"/> TERSIMPAN</>
                  : <><Save className="w-5 h-5"/> SIMPAN KAMAR {activeKamar}</>
              }
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