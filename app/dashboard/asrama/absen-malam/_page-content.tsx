'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSessionInfo, getKamarsMalam, getDataAbsenMalamKamar, batchSaveAbsenMalam, tandaiSantriKembaliDariAbsenMalam } from './actions'
import { Moon, Home, ChevronLeft, ChevronRight, Loader2, Lock, Save, CheckCircle, LogIn, MessageSquareText } from 'lucide-react'
import { toast } from '@/lib/toast'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AbsenMalamPage() {
  const [asrama, setAsrama] = useState<string>(ASRAMA_LIST[0] || '')
  const [asramaBinaan, setAsramaBinaan] = useState<string | null>(null)
  const [tanggal, setTanggal] = useState(todayStr())

  // Daftar kamar (ringan)
  const [kamars, setKamars] = useState<string[]>([])
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [kamarIdx, setKamarIdx] = useState(0)

  // Data santri kamar aktif (lazy, dengan cache)
  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [localStatus, setLocalStatus] = useState<Record<string, string>>({})
  const [localKeterangan, setLocalKeterangan] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [returningId, setReturningId] = useState<string | null>(null)
  const [savedKamars, setSavedKamars] = useState<Set<string>>(new Set())

  useEffect(() => {
    getSessionInfo().then(s => {
      if (s?.asrama_binaan) { setAsramaBinaan(s.asrama_binaan); setAsrama(s.asrama_binaan) }
    })
  }, [])

  // Load daftar kamar saat asrama/tanggal berubah
  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setSantriKamar([])
    setKamarCache({})
    setKamarIdx(0)
    setSavedKamars(new Set())
    getKamarsMalam(asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama, tanggal])

  // Load santri kamar aktif — lazy, dengan cache per kamar+tanggal
  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    const cacheKey = `${kamar}__${tanggal}`
    if (kamarCache[cacheKey]) {
      const cached = kamarCache[cacheKey]
      setSantriKamar(cached)
      // Restore localStatus dari cache
      const map: Record<string, string> = {}
      const ketMap: Record<string, string> = {}
      cached.forEach((s: any) => { map[s.id] = s.status })
      cached.forEach((s: any) => { ketMap[s.id] = s.keterangan || '' })
      setLocalStatus(prev => ({ ...prev, ...map }))
      setLocalKeterangan(prev => ({ ...prev, ...ketMap }))
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDataAbsenMalamKamar(asrama, kamar, tanggal).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [`${kamar}__${tanggal}`]: res }))
      const map: Record<string, string> = {}
      const ketMap: Record<string, string> = {}
      res.forEach((s: any) => { map[s.id] = s.status })
      res.forEach((s: any) => { ketMap[s.id] = s.keterangan || '' })
      setLocalStatus(prev => ({ ...prev, ...map }))
      setLocalKeterangan(prev => ({ ...prev, ...ketMap }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars, tanggal])

  const activeKamar = kamars[kamarIdx] ?? ''
  const roomFeatureBlocked = isAsramaTanpaKamar(asramaBinaan ?? asrama)

  const hadir = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'HADIR').length
  const alfa  = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'ALFA').length
  const izin  = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'IZIN').length

  const toggle = (id: string) => {
    if (santriKamar.find(s => s.id === id)?.is_izin) return
    setLocalStatus(prev => ({ ...prev, [id]: prev[id] === 'ALFA' ? 'HADIR' : 'ALFA' }))
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
  }

  const updateKeterangan = (id: string, value: string) => {
    setLocalKeterangan(prev => ({ ...prev, [id]: value }))
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
  }

  const markReturned = async (santriId: string) => {
    const santri = santriKamar.find(s => s.id === santriId)
    if (!santri?.is_izin) return

    setReturningId(santriId)
    const res = await tandaiSantriKembaliDariAbsenMalam(santriId, tanggal)
    setReturningId(null)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    const updated = santriKamar.map(s => (
      s.id === santriId
        ? { ...s, status: 'HADIR', is_izin: false, izin_id: null, izin_jenis: null, izin_alasan: null, izin_batas: null }
        : s
    ))

    setSantriKamar(updated)
    setLocalStatus(prev => ({ ...prev, [santriId]: 'HADIR' }))
    setKamarCache(prev => ({ ...prev, [`${activeKamar}__${tanggal}`]: updated }))
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
    toast.success(res.message)
  }

  const saveKamar = async () => {
    setSaving(true)
    const records = santriKamar
      .filter(s => !s.is_izin)
      .map(s => ({
        santri_id: s.id,
        status: localStatus[s.id] || 'HADIR',
        keterangan: localKeterangan[s.id] || '',
      }))
    const res = await batchSaveAbsenMalam(records, tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    setSavedKamars(prev => new Set([...prev, activeKamar]))
    // Update cache setelah save
    const cacheKey = `${activeKamar}__${tanggal}`
    setKamarCache(prev => ({
      ...prev,
      [cacheKey]: santriKamar.map(s => ({
        ...s,
        status: localStatus[s.id] || 'HADIR',
        keterangan: localKeterangan[s.id] || '',
      }))
    }))
    toast.success(`Kamar ${activeKamar} tersimpan`)
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

          {/* Statistik kamar aktif saja */}
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
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-3">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="p-2 bg-white rounded-xl shadow border disabled:opacity-30 active:scale-90">
            <ChevronLeft className="w-5 h-5 text-slate-700"/>
          </button>
          <select value={kamarIdx} onChange={e => setKamarIdx(Number(e.target.value))}
            className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm font-bold text-center outline-none shadow cursor-pointer">
            {kamars.map((k, i) => (
              <option key={k} value={i}>
                {savedKamars.has(k) ? '✓ ' : ''}Kamar {k} ({/* jumlah tidak diketahui sebelum dibuka */}
                {kamarCache[`${k}__${tanggal}`]?.length ?? '?'} santri)
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
      {loadingKamar ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
      ) : roomFeatureBlocked ? (
        <div className="mx-4 py-16 text-center bg-white rounded-2xl border border-dashed text-slate-400">
          Asrama ini tidak memakai kamar, jadi tidak ikut fitur absen malam.
        </div>
      ) : kamars.length === 0 && !loadingKamars ? (
        <div className="mx-4 py-16 text-center bg-white rounded-2xl border border-dashed text-slate-400">
          Tidak ada santri di asrama ini.
        </div>
      ) : santriKamar.length === 0 && !loadingKamar && activeKamar ? (
        <div className="mx-4 py-16 text-center bg-white rounded-2xl border border-dashed text-slate-400">
          Pilih kamar untuk memuat data.
        </div>
      ) : santriKamar.length > 0 && (
        <div className="mx-4 bg-white rounded-2xl shadow border overflow-hidden" key={activeKamar}>
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

          <div className="divide-y divide-slate-100">
            {santriKamar.map((s: any) => {
              const st = localStatus[s.id] || 'HADIR'
              const keterangan = localKeterangan[s.id] || ''
              const isAlfa = st === 'ALFA'
              const isIzin = s.is_izin
              const canMarkReturned = isIzin && s.izin_jenis === 'PULANG'
              return (
                <div key={s.id} role={isIzin ? undefined : 'button'} tabIndex={isIzin ? undefined : 0} onClick={() => !isIzin && toggle(s.id)}
                  className={`w-full grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3.5 transition-colors active:scale-[0.98] text-left ${
                    isAlfa ? 'bg-red-50' : isIzin ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}>
                  <SantriPhotoAvatar
                    src={s.foto_url}
                    name={s.nama_lengkap}
                    alt={`Foto ${s.nama_lengkap}`}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 whitespace-normal break-words leading-snug">{s.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{s.nis}</p>
                    {isIzin && s.izin_alasan ? (
                      <p className="text-[10px] text-blue-500 font-semibold truncate mt-0.5">{s.izin_alasan}</p>
                    ) : null}
                    {!isIzin ? (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                        <MessageSquareText className={`w-4 h-4 shrink-0 ${keterangan ? 'text-amber-500' : 'text-slate-300'}`} />
                        <input
                          value={keterangan}
                          onClick={event => event.stopPropagation()}
                          onKeyDown={event => event.stopPropagation()}
                          onChange={event => updateKeterangan(s.id, event.target.value)}
                          placeholder="Keterangan opsional"
                          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-300"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                      isAlfa ? 'bg-red-500 text-white' :
                      isIzin ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {isIzin ? 'IZIN' : isAlfa ? 'ALFA' : 'HADIR'}
                    </span>
                    {canMarkReturned ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          markReturned(s.id)
                        }}
                        disabled={returningId === s.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
                      >
                        {returningId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                        Kembali
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FIXED BOTTOM */}
      {kamars.length > 0 && santriKamar.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-slate-100 to-transparent z-40">
          <div className="max-w-lg mx-auto flex gap-3">
            <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
              className="p-3.5 bg-white border rounded-2xl shadow disabled:opacity-30 active:scale-90">
              <ChevronLeft className="w-5 h-5 text-slate-600"/>
            </button>
            <button onClick={saveKamar} disabled={saving}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm shadow-sm transition-all active:scale-95 ${
                savedKamars.has(activeKamar) ? 'bg-green-600 text-white' : 'bg-slate-900 text-white'
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
