'use client'

import { useState, useEffect } from 'react'
import { getSessionInfo, getKamarsMalam, getDataAbsenMalamKamar, batchSaveAbsenMalam } from './actions'
import { Moon, Home, ChevronLeft, ChevronRight, Loader2, Lock, Save, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AbsenMalamPage() {
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
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
  const [saving, setSaving] = useState(false)
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
      cached.forEach((s: any) => { map[s.id] = s.status })
      setLocalStatus(prev => ({ ...prev, ...map }))
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDataAbsenMalamKamar(asrama, kamar, tanggal).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [`${kamar}__${tanggal}`]: res }))
      const map: Record<string, string> = {}
      res.forEach((s: any) => { map[s.id] = s.status })
      setLocalStatus(prev => ({ ...prev, ...map }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars, tanggal])

  const activeKamar = kamars[kamarIdx] ?? ''

  const hadir = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'HADIR').length
  const alfa  = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'ALFA').length
  const izin  = santriKamar.filter(s => (localStatus[s.id] ?? 'HADIR') === 'IZIN').length

  const toggle = (id: string) => {
    if (santriKamar.find(s => s.id === id)?.is_izin) return
    setLocalStatus(prev => ({ ...prev, [id]: prev[id] === 'ALFA' ? 'HADIR' : 'ALFA' }))
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
    // Update cache setelah save
    const cacheKey = `${activeKamar}__${tanggal}`
    setKamarCache(prev => ({
      ...prev,
      [cacheKey]: santriKamar.map(s => ({ ...s, status: localStatus[s.id] || 'HADIR' }))
    }))
    toast.success(`Kamar ${activeKamar} tersimpan`)
    const nextIdx = kamars.findIndex((k, i) => i > kamarIdx && !savedKamars.has(k))
    if (nextIdx !== -1) setKamarIdx(nextIdx)
  }

  return (
    <div className="max-w-lg mx-auto pb-32 select-none">

      {/* HEADER HERO CARD */}
      <div className="relative bg-slate-900 border-x border-b border-border/10 text-white px-5 pt-5 pb-6 rounded-b-[2rem] shadow-xl shadow-amber-900/10 mb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/20 rounded-full blur-[40px] pointer-events-none"/>
        <div className="absolute bottom-0 left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"/>
        
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Moon className="w-5 h-5 text-amber-300"/> Absen Malam
            </h1>
            <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", asramaBinaan ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/10 border-white/10')}>
              {asramaBinaan ? <Lock className="w-3.5 h-3.5"/> : <Home className="w-3.5 h-3.5 text-slate-300"/>}
              {asramaBinaan
                ? <span>{asramaBinaan}</span>
                : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                    className="bg-transparent text-white text-xs outline-none cursor-pointer appearance-none">
                    {ASRAMA_LIST.map(a => <option key={a} value={a} className="text-foreground">{a}</option>)}
                  </select>
              }
            </div>
          </div>

          <Input 
            type="date" 
            value={tanggal} 
            onChange={e => setTanggal(e.target.value)}
            className="bg-white/10 border-white/20 text-white rounded-xl focus-visible:ring-amber-500" 
          />

          {/* Statistik kamar aktif saja */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white/10 rounded-xl p-3 text-center border border-white/5 backdrop-blur-sm">
              <p className="text-2xl font-black">{hadir}</p>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">Hadir</p>
            </div>
            <div className="flex-1 bg-red-500/20 rounded-xl p-3 text-center border border-red-500/20 backdrop-blur-sm">
              <p className="text-2xl font-black text-red-300">{alfa}</p>
              <p className="text-[10px] text-red-300 font-bold uppercase tracking-wider mt-0.5">Alfa</p>
            </div>
            <div className="flex-1 bg-blue-500/20 rounded-xl p-3 text-center border border-blue-500/20 backdrop-blur-sm">
              <p className="text-2xl font-black text-blue-300">{izin}</p>
              <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider mt-0.5">Izin</p>
            </div>
          </div>
        </div>
      </div>

      {/* KAMAR NAV */}
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setKamarIdx(i => Math.max(0, i - 1))} 
            disabled={kamarIdx === 0}
            className="rounded-xl shadow-sm h-10 w-10 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5"/>
          </Button>
          
          <div className="flex-1">
             <Select value={String(kamarIdx)} onValueChange={(val) => { if(val) setKamarIdx(Number(val)) }}>
               <SelectTrigger className="w-full h-10 rounded-xl font-bold shadow-sm bg-card border-border">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {kamars.map((k, i) => (
                   <SelectItem key={k} value={String(i)} className="font-medium">
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
            className="rounded-xl shadow-sm h-10 w-10 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5"/>
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
        <Card className="mx-4 rounded-2xl shadow-sm border overflow-hidden" key={activeKamar}>
          <div className="bg-muted px-4 py-3 flex justify-between items-center border-b">
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

          <div className="divide-y divide-border/60">
            {santriKamar.map((s: any) => {
              const st = localStatus[s.id] || 'HADIR'
              const isAlfa = st === 'ALFA'
              const isIzin = s.is_izin
              return (
                <button key={s.id} disabled={isIzin} onClick={() => toggle(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors active:scale-[0.98] text-left outline-none focus-visible:bg-muted/50",
                    isAlfa ? 'bg-red-500/5 dark:bg-red-500/10 hover:bg-red-500/10' : 
                    isIzin ? 'bg-blue-500/5 dark:bg-blue-500/10' : 
                    'hover:bg-muted/40'
                  )}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 shadow-sm transition-colors",
                    isAlfa ? 'bg-red-500 text-white border-red-500' :
                    isIzin ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' :
                    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
                  )}>
                    {s.nis?.slice(-2) || '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", isAlfa ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>{s.nama_lengkap}</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{s.nis}</p>
                  </div>
                  <Badge variant={isIzin ? "secondary" : isAlfa ? "destructive" : "default"} className={cn(
                    "text-[10px] font-black px-2 py-0.5 h-6 uppercase tracking-wider shadow-none border", 
                    !isAlfa && !isIzin && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 dark:text-emerald-400",
                    isIzin && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20 dark:text-blue-400"
                  )}>
                    {isIzin ? 'IZIN' : isAlfa ? 'ALFA' : 'HADIR'}
                  </Badge>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* FIXED BOTTOM COMPONENT - SAFE AREA COMPATIBLE */}
      {kamars.length > 0 && santriKamar.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-3 bg-background/80 backdrop-blur-md border-t border-border/50 z-40">
          {/* We add a spacer to prevent covering nav if we want, pb-safe adds margin */}
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