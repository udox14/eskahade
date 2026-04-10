'use client'

import { useState, useEffect } from 'react'
import { getSessionBerjamaah, getKamarsBerjamaah, getDataAbsenBerjamaahKamar, batchSaveAbsenBerjamaah } from './actions'
import { Sun, ChevronLeft, ChevronRight, Loader2, Lock, Save, CheckCircle, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const WAKTU = ['shubuh', 'ashar', 'maghrib', 'isya'] as const
type Waktu = typeof WAKTU[number]
type Status = null | 'A' | 'S' | 'H' | 'P'

const STATUS_OPTS: { val: Status; label: string; color: string; bg: string }[] = [
  { val: null, label: 'Hadir', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-800' },
  { val: 'A',  label: 'Alfa',  color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-800' },
  { val: 'S',  label: 'Sakit', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-800' },
  { val: 'H',  label: 'Haid',  color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 border-purple-300 dark:bg-purple-900/40 dark:border-purple-800' },
  { val: 'P',  label: 'Pulang',color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-800' },
]

const WAKTU_META = {
  shubuh:  { label: 'Shubuh',  icon: '🌙' },
  ashar:   { label: 'Ashar',   icon: '☀️' },
  maghrib: { label: 'Maghrib', icon: '🌅' },
  isya:    { label: 'Isya',    icon: '🌃' },
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

  // Daftar kamar (ringan)
  const [kamars, setKamars] = useState<string[]>([])
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [kamarIdx, setKamarIdx] = useState(0)

  // Data santri kamar aktif (lazy, dengan cache)
  const [santriKamar, setSantriKamar] = useState<SantriRow[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  // Cache key: `${kamar}__${tanggal}`
  const [kamarCache, setKamarCache] = useState<Record<string, SantriRow[]>>({})

  const [localData, setLocalData] = useState<Record<string, Record<Waktu, Status>>>({})
  const [saving, setSaving] = useState(false)
  const [savedKamars, setSavedKamars] = useState<Set<string>>(new Set())

  useEffect(() => {
    getSessionBerjamaah().then(s => {
      setSessionInfo(s)
      if (s?.asrama_binaan) setAsrama(s.asrama_binaan)
      else if (s?.role === 'admin') setAsrama(ASRAMA_PUTRI[0])
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
    getKamarsBerjamaah(asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama, tanggal])

  // Load santri kamar aktif — lazy, dengan cache
  useEffect(() => {
    if (!kamars.length || !asrama) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    const cacheKey = `${kamar}__${tanggal}`
    if (kamarCache[cacheKey]) {
      const cached = kamarCache[cacheKey]
      setSantriKamar(cached)
      const map: Record<string, Record<Waktu, Status>> = {}
      cached.forEach(s => { map[s.id] = { shubuh: s.shubuh, ashar: s.ashar, maghrib: s.maghrib, isya: s.isya } })
      setLocalData(prev => ({ ...prev, ...map }))
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDataAbsenBerjamaahKamar(asrama, kamar, tanggal).then(res => {
      setSantriKamar(res as SantriRow[])
      setKamarCache(prev => ({ ...prev, [cacheKey]: res as SantriRow[] }))
      const map: Record<string, Record<Waktu, Status>> = {}
      res.forEach((s: any) => { map[s.id] = { shubuh: s.shubuh, ashar: s.ashar, maghrib: s.maghrib, isya: s.isya } })
      setLocalData(prev => ({ ...prev, ...map }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars, tanggal])

  const activeKamar = kamars[kamarIdx] ?? ''

  const setStatus = (santriId: string, waktu: Waktu, val: Status) => {
    setLocalData(prev => ({ ...prev, [santriId]: { ...(prev[santriId] || { shubuh: null, ashar: null, maghrib: null, isya: null }), [waktu]: val } }))
    setSavedKamars(prev => { const n = new Set(prev); n.delete(activeKamar); return n })
  }

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
      shubuh:  localData[s.id]?.shubuh  ?? null,
      ashar:   localData[s.id]?.ashar   ?? null,
      maghrib: localData[s.id]?.maghrib ?? null,
      isya:    localData[s.id]?.isya    ?? null,
    }))
    const res = await batchSaveAbsenBerjamaah(records, tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    setSavedKamars(prev => new Set([...prev, activeKamar]))
    // Update cache setelah save
    const cacheKey = `${activeKamar}__${tanggal}`
    setKamarCache(prev => ({
      ...prev,
      [cacheKey]: santriKamar.map(s => ({
        ...s,
        shubuh:  localData[s.id]?.shubuh  ?? null,
        ashar:   localData[s.id]?.ashar   ?? null,
        maghrib: localData[s.id]?.maghrib ?? null,
        isya:    localData[s.id]?.isya    ?? null,
      }))
    }))
    toast.success(`Kamar ${activeKamar} tersimpan`)
    const nextIdx = kamars.findIndex((k, i) => i > kamarIdx && !savedKamars.has(k))
    if (nextIdx !== -1) setTimeout(() => setKamarIdx(nextIdx), 300)
  }

  // Statistik kamar aktif saja (murni dari localData, zero row reads)
  const countStatus = (waktu: Waktu, val: Status) =>
    santriKamar.filter(s => (localData[s.id]?.[waktu] ?? null) === val).length
  const totalKamar = santriKamar.length

  if (sessionInfo === 'loading') return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-teal-500"/>
    </div>
  )

  if (!sessionInfo) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 p-8 text-center bg-background text-muted-foreground animate-in fade-in">
      <ShieldOff className="w-16 h-16 opacity-30"/>
      <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
      <p className="text-sm">Fitur ini hanya untuk Pengurus Asrama ASY-SYIFA 1–4.</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto pb-32 select-none animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER HERO */}
      <div className="relative bg-teal-950 border border-teal-900/50 text-teal-50 px-5 pt-5 pb-6 rounded-[2rem] rounded-t-none shadow-xl shadow-teal-900/20 overflow-hidden mb-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/20 rounded-full blur-[40px] pointer-events-none"/>
        <div className="absolute bottom-10 -left-10 w-32 h-32 bg-teal-500/30 rounded-full blur-3xl pointer-events-none"/>
        
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-black flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-400"/> Absen Berjamaah
            </h1>
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", sessionInfo.asrama_binaan ? 'bg-teal-800/50 text-teal-200 border-teal-500/30' : 'bg-white/5 border-white/10')}>
              <Lock className="w-3.5 h-3.5 text-teal-100 opacity-70"/>
              {sessionInfo.asrama_binaan
                ? <span>{sessionInfo.asrama_binaan}</span>
                : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                    className="bg-transparent text-teal-50 font-bold outline-none cursor-pointer appearance-none">
                    {ASRAMA_PUTRI.map(a => <option key={a} value={a} className="text-primary">{a}</option>)}
                  </select>
              }
            </div>
          </div>

          <Input 
            type="date" 
            value={tanggal} 
            onChange={e => setTanggal(e.target.value)}
            className="bg-white/10 border-white/20 text-white rounded-xl focus-visible:ring-amber-500 shadow-sm"
          />

          {/* Statistik kamar aktif saja */}
          <div className="grid grid-cols-4 gap-2">
            {WAKTU.map(w => {
              const alfa  = countStatus(w, 'A')
              const sakit = countStatus(w, 'S')
              const hadir = totalKamar > 0 ? (totalKamar - (santriKamar.filter(s => (localData[s.id]?.[w] ?? null) !== null).length)) : 0
              return (
                <div key={w} className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-2.5 text-center flex flex-col justify-between items-center h-[90px]">
                  <p className="text-base leading-none mb-1">{WAKTU_META[w].icon}</p>
                  <p className="text-[9px] font-black tracking-widest text-teal-200/70 uppercase leading-none">{WAKTU_META[w].label}</p>
                  <p className="text-sm font-black text-white tabular-nums">{hadir}/{totalKamar}</p>
                  <div className="h-4 flex items-center justify-center">
                    {(alfa > 0 || sakit > 0) && (
                      <span className="text-[9px] text-amber-300 font-bold bg-amber-900/30 px-1 rounded">A:{alfa} S:{sakit}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* KAMAR NAV */}
      {loadingKamars ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setKamarIdx(i => Math.max(0, i - 1))} 
            disabled={kamarIdx === 0}
            className="rounded-xl h-12 w-12 border-border shadow-sm disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6"/>
          </Button>
          
          <div className="flex-1">
             <Select value={String(kamarIdx)} onValueChange={(val) => { if(val) setKamarIdx(Number(val)) }}>
               <SelectTrigger className="w-full h-12 rounded-xl border-border shadow-sm bg-card text-center flex flex-col items-center justify-center py-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">Pilih Kamar</span>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {kamars.map((k, i) => (
                   <SelectItem key={k} value={String(i)} className="font-bold">
                     {savedKamars.has(k) ? '✓ ' : ''}Kamar {k} ({kamarCache[`${k}__${tanggal}`]?.length ?? '?'} santri)
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} 
            disabled={kamarIdx === kamars.length - 1}
            className="rounded-xl h-12 w-12 border-border shadow-sm disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6"/>
          </Button>
        </div>
      )}

      {/* CONTENT */}
      {loadingKamar ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground"/></div>
      ) : kamars.length === 0 && !loadingKamars ? (
        <div className="mx-4 py-16 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border/60 text-muted-foreground text-sm font-medium">
          Tidak ada santri di asrama ini.
        </div>
      ) : santriKamar.length === 0 && !loadingKamar && activeKamar ? (
        <div className="mx-4 py-16 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border/60 text-muted-foreground text-sm font-medium">
          Pilih kamar untuk memuat data.
        </div>
      ) : santriKamar.length > 0 && (
        <Card className="mx-4 rounded-2xl shadow-sm border overflow-hidden bg-card" key={activeKamar}>
          <div className="bg-muted px-4 py-3 flex justify-between items-center border-b h-12">
            <span className="font-black text-sm text-muted-foreground tracking-wider uppercase">KAMAR {activeKamar}</span>
            <div className="flex items-center gap-2">
              {savedKamars.has(activeKamar) && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 py-0.5 gap-1 shadow-none font-bold">
                  <CheckCircle className="w-3 h-3"/> Tersimpan
                </Badge>
              )}
              <span className="text-xs text-muted-foreground font-medium">{santriKamar.length} santri</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-3 py-2 bg-muted/50 border-b">
            <div className="text-[10px] text-muted-foreground font-black tracking-widest uppercase">Nama Santri</div>
            {WAKTU.map(w => (
              <div key={w} className="text-[9px] text-muted-foreground font-bold text-center leading-none tracking-widest uppercase flex flex-col items-center justify-end">
                <span className="text-[14px] mb-0.5">{WAKTU_META[w].icon}</span>
                {WAKTU_META[w].label}
              </div>
            ))}
          </div>

          {/* Santri rows */}
          <div className="divide-y divide-border/60">
            {santriKamar.map((s: SantriRow) => (
              <div key={s.id} className="grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-3 py-2.5 items-center hover:bg-muted/40 transition-colors">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-bold text-foreground truncate">{s.nama_lengkap}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.nis}</p>
                </div>
                {WAKTU.map(w => {
                  const val = localData[s.id]?.[w] ?? null
                  const opt = STATUS_OPTS.find(o => o.val === val) || STATUS_OPTS[0]
                  return (
                    <button key={w} onClick={() => cycleStatus(s.id, w)}
                      className={cn(
                        "w-[40px] h-10 rounded-xl border-2 text-sm font-black transition-all active:scale-90 shadow-sm mx-auto flex items-center justify-center select-none outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        opt.bg, 
                        opt.color
                      )}>
                      {val === null ? '✓' : val}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap items-center gap-2">
            {STATUS_OPTS.map(o => (
              <Badge key={String(o.val)} variant="outline" className={cn("text-[9px] font-black px-1.5 py-0 shadow-none gap-1 uppercase tracking-wider border", o.bg, o.color)}>
                <span className="text-[11px] leading-none mb-px">{o.val === null ? '✓' : o.val}</span> {o.label}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground ml-auto hidden sm:block italic font-medium">Tap kotak untuk ubah</span>
          </div>
        </Card>
      )}

      {/* FIXED BOTTOM */}
      {kamars.length > 0 && santriKamar.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-3 bg-background/80 backdrop-blur-md border-t border-border/50 z-40">
           <div className="max-w-lg mx-auto flex gap-3 mb-2 sm:mb-4">
             <Button 
               variant="outline" 
               size="icon" 
               onClick={() => setKamarIdx(i => Math.max(0, i - 1))} 
               disabled={kamarIdx === 0}
               className="h-14 w-14 rounded-2xl shadow-sm border-border"
             >
               <ChevronLeft className="w-6 h-6"/>
             </Button>
             
             <Button 
               onClick={saveKamar} 
               disabled={saving}
               className={cn(
                 "flex-1 h-14 rounded-2xl font-black text-sm shadow-sm transition-all shadow-primary/20",
                 savedKamars.has(activeKamar) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
               )}
             >
               {saving
                 ? <Loader2 className="w-5 h-5 animate-spin mr-2"/>
                 : savedKamars.has(activeKamar)
                   ? <CheckCircle className="w-5 h-5 mr-2"/>
                   : <Save className="w-5 h-5 mr-2"/>
               }
               {saving
                 ? "MENYIMPAN..."
                 : savedKamars.has(activeKamar)
                   ? "TERSIMPAN"
                   : `SIMPAN KAMAR ${activeKamar}`
               }
             </Button>
 
             <Button 
               variant="outline" 
               size="icon" 
               onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} 
               disabled={kamarIdx === kamars.length - 1}
               className="h-14 w-14 rounded-2xl shadow-sm border-border"
             >
               <ChevronRight className="w-6 h-6"/>
             </Button>
           </div>
        </div>
      )}
    </div>
  )
}