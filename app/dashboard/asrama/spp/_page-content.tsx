'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getNominalSPP, getStatusSPP, bayarSPP, getKamarsSPP, getDashboardSPPKamar, getClientRestriction, simpanSppBatch } from './actions'
import { Search, CreditCard, User, CheckCircle, AlertCircle, Loader2, ArrowLeft, Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

type FilterStatus = 'SEMUA' | 'SUDAH_BAYAR_INI' | 'NUNGGAK' | 'AMAN'

export default function SPPPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  // Daftar kamar (ringan, hanya nama kamar)
  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  // Data santri kamar aktif (lazy)
  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  // Cache: kamar → santri[], supaya tidak re-fetch kamar yang sudah pernah dibuka
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // Payment view
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])

  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  // Init
  useEffect(() => {
    getNominalSPP().then(setNominal)
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res) }
    })
  }, [])

  // Load daftar kamar saat asrama/tahun berubah — ringan, hanya distinct kamar
  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setSantriKamar([])
    setKamarCache({})
    setKamarIdx(0)
    setDrafts({})
    getKamarsSPP(tahun, asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama, tahun])

  // Load santri kamar aktif — lazy, dengan cache
  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    // Kalau sudah di-cache, pakai cache
    if (kamarCache[kamar]) {
      setSantriKamar(kamarCache[kamar])
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDashboardSPPKamar(tahun, asrama, kamar).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [kamar]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars])

  // Invalidate cache kamar tertentu setelah simpan batch
  const invalidateKamar = (kamar: string) => {
    setKamarCache(prev => { const n = { ...prev }; delete n[kamar]; return n })
  }

  // Back button
  useEffect(() => {
    if (view === 'PAYMENT') window.history.pushState({ view: 'PAYMENT' }, '')
  }, [view])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'PAYMENT') {
        setView('LIST')
        setSelectedSantri(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Payment
  useEffect(() => {
    if (view === 'PAYMENT' && selectedSantri) {
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }, [view, selectedSantri, tahun])

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri)
    setView('PAYMENT')
  }

  const handleBayar = async () => {
    if (selectedMonths.length === 0) return
    if (!await confirm(`Bayar SPP ${selectedMonths.length} bulan? Total: Rp ${(selectedMonths.length * nominal).toLocaleString('id-ID')}`)) return
    const toastId = toast.loading('Memproses...')
    const res = await bayarSPP(selectedSantri.id, tahun, selectedMonths, nominal)
    toast.dismiss(toastId)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success('Pembayaran Berhasil!')
      // Invalidate cache kamar santri ini supaya refresh saat kembali
      invalidateKamar(selectedSantri.kamar)
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }

  const toggleDraft = (e: React.MouseEvent, santri: any) => {
    e.stopPropagation()
    setDrafts(prev => {
      const next = { ...prev }
      if (next[santri.id]) { delete next[santri.id] }
      else { next[santri.id] = { nominal, bulan: currentMonthIdx, nama: santri.nama_lengkap } }
      return next
    })
  }

  const handleSimpanBatch = async () => {
    const listPayload = Object.keys(drafts).map(id => ({
      santriId: id, bulan: drafts[id].bulan, tahun, nominal: drafts[id].nominal,
    }))
    if (!listPayload.length) return
    if (!await confirm(`Simpan pembayaran untuk ${listPayload.length} santri?`)) return
    setIsSavingBatch(true)
    const res = await simpanSppBatch(listPayload)
    setIsSavingBatch(false)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success(`Sukses menyimpan ${(res as any).count} pembayaran!`)
      // Invalidate cache kamar aktif
      invalidateKamar(kamars[kamarIdx])
      setDrafts({})
    }
  }

  const toggleBulan = (idx: number) => {
    if (riwayatBayar.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

  const handleBackToList = () => { window.history.back() }

  const activeKamar = kamars[kamarIdx] ?? ''

  const filteredSantri = santriKamar.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false
    if (filterStatus === 'SUDAH_BAYAR_INI') return s.bulan_ini_lunas
    if (filterStatus === 'NUNGGAK') return s.jumlah_tunggakan > 0
    if (filterStatus === 'AMAN') return s.jumlah_tunggakan === 0
    return true
  })

  const totalDraft = Object.keys(drafts).length
  const totalNominalDraft = Object.values(drafts).reduce((a: number, b: any) => a + b.nominal, 0)

  // ── VIEW: LIST ──────────────────────────────────────────────────────────
  if (view === 'LIST') return (
    <div className="space-y-6 max-w-5xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400"/>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard SPP</h1>
            <p className="text-muted-foreground text-sm">Monitoring pembayaran santri per kamar.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto mt-2 md:mt-0">
          <div className="flex items-center bg-card border rounded-xl p-0.5 shadow-sm">
            <Button variant="ghost" size="icon-sm" onClick={() => setTahun(t => t - 1)} className="rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4"/></Button>
            <span className="px-3 font-mono font-bold text-foreground text-sm">{tahun}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setTahun(t => t + 1)} className="rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4"/></Button>
          </div>

          <div className={cn("flex-1 md:flex-none p-1 rounded-xl border flex items-center gap-2 pr-1 shadow-sm", userAsrama ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card')}>
             <div className="pl-3 py-1 flex items-center gap-2">
               {userAsrama ? <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"/> : <Home className="w-4 h-4 text-muted-foreground"/>}
               <Select value={asrama} disabled={!!userAsrama} onValueChange={(val) => { if(val) setAsrama(val) }}>
                 <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 p-0 text-sm font-bold gap-2 focus-visible:ring-0 appearance-none min-w-[120px]">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"/>
          <Input
            type="text"
            placeholder="Cari nama santri..."
            className="w-full pl-10 h-11 bg-card rounded-xl shadow-sm border-border focus-visible:ring-emerald-500"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border overflow-x-auto scrollbar-none w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground ml-2 flex-shrink-0 hidden sm:block"/>
          {(['SEMUA', 'SUDAH_BAYAR_INI', 'NUNGGAK', 'AMAN'] as FilterStatus[]).map(f => (
            <Button 
               key={f} 
               variant={filterStatus === f ? "default" : "ghost"}
               onClick={() => setFilterStatus(f)}
               className={cn(
                 "rounded-lg h-8 px-3 text-xs font-bold transition-all whitespace-nowrap shadow-none border-none",
                 filterStatus === f && f === 'SUDAH_BAYAR_INI' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm' :
                 filterStatus === f && f === 'NUNGGAK' ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' :
                 filterStatus === f ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted'
               )}
            >
              {f === 'SEMUA' ? 'Semua' : f === 'SUDAH_BAYAR_INI' ? `Lunas ${BULAN_LIST[currentMonthIdx - 1]}` : f === 'NUNGGAK' ? 'Menunggak' : 'Aman'}
            </Button>
          ))}
        </div>
      </div>

      {/* KAMAR NAVIGATOR */}
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center justify-between bg-card p-2 rounded-2xl shadow-sm border border-border md:w-80 mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setKamarIdx(i => Math.max(0, i - 1))} 
            disabled={kamarIdx === 0}
            className="rounded-xl disabled:opacity-30 h-12 w-12"
          >
            <ChevronLeft className="w-6 h-6"/>
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Kamar Saat Ini</span>
            <Select value={String(kamarIdx)} onValueChange={(val) => { if(val) setKamarIdx(Number(val)) }}>
               <SelectTrigger className="font-bold text-xl h-auto py-1 shadow-none bg-transparent border-none focus:ring-0 focus-visible:ring-0 p-0 hover:bg-muted/50 rounded-lg px-2">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {kamars.map((k, idx) => (
                   <SelectItem key={k} value={String(idx)} className="font-bold text-base">
                     Kamar {k}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} 
            disabled={kamarIdx === kamars.length - 1}
            className="rounded-xl disabled:opacity-30 h-12 w-12"
          >
            <ChevronRight className="w-6 h-6"/>
          </Button>
        </div>
      )}

      {/* SANTRI LIST */}
      {loadingKamar ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground"/></div>
      ) : !activeKamar ? null : filteredSantri.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border/60 bg-muted/30 rounded-2xl text-sm font-medium">
          {santriKamar.length === 0 ? 'Tidak ada santri di kamar ini.' : 'Tidak ada santri yang cocok dengan filter.'}
        </div>
      ) : (
        <Card className="rounded-2xl shadow-sm overflow-hidden border-border bg-card">
          <div className="bg-muted/50 px-4 py-3 border-b font-black tracking-wider uppercase text-muted-foreground text-xs flex justify-between items-center h-12">
            <span>KAMAR {activeKamar}</span>
            <Badge variant="outline" className="text-[10px] font-bold shadow-none bg-background">{filteredSantri.length} Santri</Badge>
          </div>
          <div className="divide-y divide-border/60">
            {filteredSantri.map((s: any) => {
              const isPaid = s.bulan_ini_lunas
              const isDraft = !!drafts[s.id]
              return (
                <div key={s.id} onClick={() => handleSelectSantri(s)}
                  className={cn(
                    "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer group hover:bg-muted/40",
                    isDraft && "bg-emerald-500/5 dark:bg-emerald-500/10"
                  )}>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground border shadow-sm group-hover:bg-background group-hover:border-emerald-500/30 transition-all shrink-0">
                      {s.nis.slice(-2)}
                    </div>
                    <div>
                      <p className="font-bold text-foreground leading-none mb-1.5">{s.nama_lengkap}</p>
                      <div className="flex flex-wrap gap-2 text-xs items-center">
                        <span className="text-muted-foreground font-mono">{s.nis}</span>
                        {s.jumlah_tunggakan > 0 && <Badge variant="destructive" className="h-5 px-1.5 py-0 text-[10px] shadow-none uppercase">-{s.jumlah_tunggakan} Bln Nunggak</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex sm:justify-end">
                    {isCurrentYear && !isPaid ? (
                      <Button 
                        onClick={(e) => toggleDraft(e, s)}
                        variant={isDraft ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "w-full sm:w-auto h-8 rounded-lg text-xs font-bold transition-all",
                          isDraft ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-muted-foreground hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500/5"
                        )}>
                        {isDraft ? <CheckCircle className="w-3.5 h-3.5 mr-1"/> : <PlusCircle className="w-3.5 h-3.5 mr-1"/>}
                        {isDraft ? 'Siap Bayar' : `Bayar ${BULAN_LIST[currentMonthIdx - 1]}`}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs shadow-none gap-1 font-bold dark:text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5"/> Lunas
                      </Badge>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* FLOATING SAVE */}
      {totalDraft > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-50">
          <div className="max-w-md mx-auto mb-2 sm:mb-4">
             <Button 
               onClick={handleSimpanBatch} 
               disabled={isSavingBatch}
               className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-between px-6 transition-all active:scale-95 disabled:opacity-70"
             >
               <div className="text-left flex flex-col">
                 <span className="text-[10px] text-emerald-100 uppercase tracking-widest font-black leading-none">{totalDraft} Santri Dipilih</span>
                 <span className="text-xl font-bold mt-1 leading-none">Rp {totalNominalDraft.toLocaleString('id-ID')}</span>
               </div>
               <div className="flex items-center gap-2 font-black bg-black/20 px-4 py-2 rounded-xl text-sm leading-none">
                 {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                 {isSavingBatch ? 'MENYIMPAN...' : 'SIMPAN'}
               </div>
             </Button>
          </div>
        </div>
      )}
    </div>
  )

  // ── VIEW: PAYMENT ───────────────────────────────────────────────────────
  if (view === 'PAYMENT') return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 animate-in slide-in-from-right-4 slide-in-from-bottom-2">
      <div className="flex items-center gap-4 border-b border-border/50 pb-5">
        <Button variant="outline" size="icon" onClick={handleBackToList} className="rounded-full shadow-sm hover:bg-muted shrink-0 w-10 h-10">
          <ArrowLeft className="w-5 h-5"/>
        </Button>
        <div>
           <Badge variant="outline" className="mb-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-mono tracking-widest text-[10px]">SPP MANUAL INPUT</Badge>
           <h1 className="text-2xl font-black text-foreground leading-none mb-1.5">{selectedSantri.nama_lengkap}</h1>
           <p className="text-xs text-muted-foreground font-medium">Nis: {selectedSantri.nis} • Kelas {selectedSantri.kelas_sekolah || '?'} • Kamar {selectedSantri.kamar}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {BULAN_LIST.map((namaBulan, idx) => {
          const bulanIndex = idx + 1
          const dataBayar = riwayatBayar.find(r => r.bulan === bulanIndex)
          const isSelected = selectedMonths.includes(bulanIndex)
          
          let cardClasses = 'bg-card border-border hover:border-emerald-400 dark:hover:border-emerald-600'
          let isNunggak = false;

          if (dataBayar) {
             cardClasses = 'bg-emerald-500/10 border-emerald-500/30 cursor-default opacity-80'
          } else if (isSelected) {
             cardClasses = 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-105 shadow-emerald-500/20 z-10'
          } else if ((tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonthIdx)) {
             cardClasses = 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
             isNunggak = true;
          }

          return (
            <div key={bulanIndex} onClick={() => toggleBulan(bulanIndex)}
              className={cn("p-4 rounded-2xl border-2 flex flex-col justify-between h-[120px] sm:h-32 transition-all cursor-pointer select-none", cardClasses)}>
              <div className="flex justify-between items-start">
                <span className={cn("font-bold text-sm sm:text-base", isSelected ? "text-white" : "text-foreground")}>{namaBulan}</span>
                {dataBayar && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"/>}
                {!dataBayar && isSelected && <CheckCircle className="w-5 h-5 text-white/70 shrink-0"/>}
              </div>
              
              <div className="text-[11px] sm:text-xs">
                {dataBayar ? (
                  <div className="text-emerald-700 dark:text-emerald-400">
                    <p className="font-black uppercase tracking-wider mb-0.5">LUNAS</p>
                    <p className="opacity-80 font-medium">{format(new Date(dataBayar.tanggal_bayar), 'dd MMM yy', { locale: id })}</p>
                  </div>
                ) : (
                  <div className={cn(isSelected ? "text-emerald-100" : "text-muted-foreground")}>
                    <p className="font-medium opacity-80 mb-0.5">Tagihan</p>
                    <p className={cn("font-black text-sm sm:text-base", isSelected ? "text-white" : "text-foreground")}>
                       Rp {nominal.toLocaleString('id-ID')}
                    </p>
                    {isNunggak && !isSelected && <Badge variant="destructive" className="px-1.5 py-0 h-4 text-[9px] uppercase tracking-wider mt-1.5 absolute top-3 right-3 shadow-none">NUNGGAK</Badge>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedMonths.length > 0 && (
         <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-50">
            <div className="max-w-md mx-auto mb-2 sm:mb-4">
              <Button 
                 onClick={handleBayar}
                 className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-between px-6 transition-all active:scale-95"
              >
                 <div className="text-left flex flex-col">
                   <span className="text-[10px] text-emerald-100 uppercase tracking-widest font-black leading-none">{selectedMonths.length} Bulan Dipilih</span>
                   <span className="text-xl font-bold mt-1 leading-none">Rp {(selectedMonths.length * nominal).toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex items-center gap-2 font-black bg-black/20 px-4 py-2 rounded-xl text-sm leading-none">
                   BAYAR <CreditCard className="w-4 h-4 ml-1"/>
                 </div>
              </Button>
            </div>
         </div>
      )}
    </div>
  )
}