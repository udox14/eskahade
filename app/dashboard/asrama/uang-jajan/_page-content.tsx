'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getStatsTabungan, getSantriKamarTabungan, simpanTopup, simpanJajanMassal, getClientRestriction, getRiwayatTabunganSantri, hapusTransaksi, getKamarsTabungan } from './actions'
import { Wallet, TrendingUp, TrendingDown, Plus, Save, Loader2, ChevronLeft, ChevronRight, Home, Lock, History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const JAJAN_OPTS = [5000, 10000, 15000, 20000]

export default function UangJajanPage() {
  const confirm = useConfirm()
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  // Daftar kamar (ringan)
  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  // Stats header
  const [stats, setStats] = useState<{ uang_fisik: number; masuk_bulan_ini: number; keluar_bulan_ini: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Data santri kamar aktif (lazy, dengan cache)
  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [draftJajan, setDraftJajan] = useState<Record<string, number>>({})
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Modal detail/topup
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [topupNominal, setTopupNominal] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Init
  useEffect(() => {
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res) }
    })
  }, [])

  // Load daftar kamar + stats saat asrama berubah
  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setLoadingStats(true)
    setKamars([])
    setSantriKamar([])
    setKamarCache({})
    setKamarIdx(0)
    setDraftJajan({})

    getKamarsTabungan(asrama).then(res => {
      setKamars(res.kamars)
      setLoadingKamars(false)
    })
    getStatsTabungan(asrama).then(res => {
      setStats(res)
      setLoadingStats(false)
    })
  }, [asrama])

  // Lazy load santri kamar aktif dengan cache
  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return
    if (kamarCache[kamar]) { setSantriKamar(kamarCache[kamar]); return }
    setLoadingKamar(true)
    setSantriKamar([])
    getSantriKamarTabungan(asrama, kamar).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [kamar]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars])

  const activeKamar = kamars[kamarIdx] ?? ''

  // Invalidate cache + reload stats + reload santri kamar aktif setelah mutasi
  const refreshAfterMutasi = (kamar?: string) => {
    const targetKamar = kamar || activeKamar
    // Hapus cache kamar yang dimutasi
    if (targetKamar) {
      setKamarCache(prev => { const n = { ...prev }; delete n[targetKamar]; return n })
      // Reload santri kamar aktif langsung (bukan tunggu useEffect)
      setLoadingKamar(true)
      getSantriKamarTabungan(asrama, targetKamar).then(res => {
        setSantriKamar(res)
        setKamarCache(prev => ({ ...prev, [targetKamar]: res }))
        setLoadingKamar(false)
      })
    }
    // Refresh stats header
    getStatsTabungan(asrama).then(setStats)
  }

  // ── Jajan logic ────────────────────────────────────────────────────────────

  const handleSelectJajan = (santriId: string, nominal: number, saldo: number) => {
    if (nominal > saldo) { toast.warning('Saldo tidak cukup!'); return }
    setDraftJajan(prev => {
      if (prev[santriId] === nominal) { const n = { ...prev }; delete n[santriId]; return n }
      return { ...prev, [santriId]: nominal }
    })
  }

  const handleManualInput = (santriId: string, value: string, saldo: number) => {
    const val = parseInt(value) || 0
    if (val > saldo) return
    if (val > 0) setDraftJajan(prev => ({ ...prev, [santriId]: val }))
    else setDraftJajan(prev => { const n = { ...prev }; delete n[santriId]; return n })
  }

  const toggleManualMode = (santriId: string) => {
    setManualMode(prev => ({ ...prev, [santriId]: !prev[santriId] }))
    setDraftJajan(prev => { const n = { ...prev }; delete n[santriId]; return n })
  }

  const handleSimpanJajan = async () => {
    const list = (Object.entries(draftJajan) as [string, number][]).map(([id, nominal]) => ({ santriId: id, nominal }))
    if (!list.length) return
    const overLimit = list.filter(l => l.nominal > 20000)
    const warn = overLimit.length ? `\n\n⚠️ ${overLimit.length} santri mengambil > 20.000 (akumulasi).` : ''
    if (!await confirm(`Simpan jajan untuk ${list.length} santri?\nTotal: Rp ${list.reduce((a, b) => a + b.nominal, 0).toLocaleString()}${warn}`)) return

    setIsSaving(true)
    const toastId = toast.loading('Memproses transaksi...')
    const res = await simpanJajanMassal(list)
    setIsSaving(false)
    toast.dismiss(toastId)

    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }) }
    else {
      toast.success('Berhasil!', { description: 'Saldo santri telah terpotong.' })
      setDraftJajan({})
      refreshAfterMutasi(activeKamar)
    }
  }

  // ── Modal logic ─────────────────────────────────────────────────────────────
  const openModal = async (santri: any) => {
    setSelectedSantri(santri)
    setIsModalOpen(true)
    setLoadingHistory(true)
    setHistory(await getRiwayatTabunganSantri(santri.id))
    setLoadingHistory(false)
  }

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = parseInt(topupNominal.replace(/\./g, ''))
    if (!nominal || nominal <= 0) return toast.warning('Nominal tidak valid')
    setIsSaving(true)
    const toastId = toast.loading('Menambah saldo...')
    const res = await simpanTopup(selectedSantri.id, nominal, 'Topup Manual')
    setIsSaving(false)
    toast.dismiss(toastId)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }) }
    else {
      toast.success('Topup Berhasil')
      setTopupNominal('')
      // Update saldo selectedSantri langsung di state supaya modal tampilkan angka baru
      const newSaldo = selectedSantri.saldo + nominal
      setSelectedSantri((prev: any) => ({ ...prev, saldo: newSaldo }))
      // Reload riwayat di modal
      setLoadingHistory(true)
      getRiwayatTabunganSantri(selectedSantri.id).then(h => { setHistory(h); setLoadingHistory(false) })
      refreshAfterMutasi(activeKamar)
    }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!await confirm('Hapus transaksi ini? Saldo akan dikembalikan.')) return
    const toastId = toast.loading('Menghapus...')
    const res = await hapusTransaksi(id)
    toast.dismiss(toastId)
    if (res?.success) {
      toast.success('Transaksi Dibatalkan')
      openModal(selectedSantri)
      refreshAfterMutasi(activeKamar)
    }
  }

  const totalJajanDraft = Object.values(draftJajan).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER HERO */}
      <div className="relative bg-emerald-950 border border-emerald-900/50 text-emerald-50 px-5 pt-5 pb-6 rounded-[2rem] rounded-t-none shadow-xl shadow-emerald-900/20 overflow-hidden mb-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <div className="absolute top-10 -left-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"/>
        
        <div className="relative z-10 space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-amber-400"/> Uang Jajan
              </h1>
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", userAsrama ? 'bg-emerald-800/30 text-emerald-300 border-emerald-500/30' : 'bg-white/5 border-white/10')}>
                {userAsrama ? <Lock className="w-3.5 h-3.5"/> : <Home className="w-3.5 h-3.5 text-emerald-200"/>}
                {userAsrama
                  ? <span>{userAsrama}</span>
                  : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                      className="bg-transparent text-emerald-50 text-xs font-bold outline-none cursor-pointer appearance-none">
                      {ASRAMA_LIST.map(a => <option key={a} value={a} className="text-primary">{a}</option>)}
                    </select>
                }
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-0.5">Uang Fisik (Saldo)</p>
              {loadingStats
                ? <Loader2 className="w-5 h-5 animate-spin ml-auto mt-1"/>
                : <p className="text-2xl font-mono font-black text-white">Rp {(stats?.uang_fisik || 0).toLocaleString('id-ID')}</p>
              }
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between backdrop-blur-sm">
              <span className="flex gap-1.5 items-center text-[10px] font-bold uppercase tracking-wider opacity-80"><TrendingUp className="w-3.5 h-3.5"/> Masuk</span>
              <span className="font-bold text-emerald-400 text-sm">+{((stats?.masuk_bulan_ini) || 0).toLocaleString()}</span>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between backdrop-blur-sm">
              <span className="flex gap-1.5 items-center text-[10px] font-bold uppercase tracking-wider opacity-80"><TrendingDown className="w-3.5 h-3.5"/> Keluar</span>
              <span className="font-bold text-amber-400 text-sm">-{((stats?.keluar_bulan_ini) || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KAMAR NAVIGATOR */}
      {loadingKamars ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-2">
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
             <Select value={String(kamarIdx)} onValueChange={(val) => { if (val) setKamarIdx(Number(val)) }}>
               <SelectTrigger className="w-full h-12 rounded-xl border-border shadow-sm bg-card text-center flex flex-col items-center justify-center py-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">Pilih Kamar</span>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {kamars.map((k, idx) => (
                   <SelectItem key={k} value={String(idx)} className="font-bold">
                     Kamar {k}
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

      {/* SANTRI LIST */}
      {loadingKamar ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground"/></div>
      ) : !activeKamar ? (
        null
      ) : santriKamar.length === 0 ? (
        <div className="mx-4 py-16 text-center text-muted-foreground border-2 border-dashed border-border/60 bg-muted/30 rounded-2xl text-sm font-medium">Kamar Kosong.</div>
      ) : (
        <Card className="mx-4 rounded-2xl shadow-sm border overflow-hidden bg-card">
          <div className="divide-y divide-border/60">
            {santriKamar.map((s: any) => {
              const draftVal = draftJajan[s.id]
              const finalSaldo = s.saldo - (draftVal || 0)
              const isLow = finalSaldo <= 5000
              const isManual = manualMode[s.id]

              return (
                <div key={s.id} className={cn(
                    "p-4 transition-colors",
                    draftVal ? 'bg-amber-500/5 dark:bg-amber-500/10' : 'hover:bg-muted/40'
                  )}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-foreground leading-none mb-1.5">{s.nama_lengkap}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{s.nis}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                         "font-mono font-black text-sm",
                         finalSaldo < 0 ? 'text-destructive' : isLow ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'
                      )}>
                        Rp {finalSaldo.toLocaleString('id-ID')}
                      </p>
                      <button onClick={() => openModal(s)}
                        className="text-[10px] text-primary font-bold hover:underline flex items-center justify-end gap-1 mt-0.5">
                        <Plus className="w-3 h-3"/> Detail / Isi
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {isManual ? (
                      <div className="flex-1 flex gap-2 items-center animate-in fade-in">
                        <Input 
                          type="number" 
                          placeholder="Nominal Rp"
                          className="h-10 rounded-xl font-bold bg-background text-sm focus-visible:ring-amber-500 shadow-none border-border"
                          autoFocus
                          onChange={e => handleManualInput(s.id, e.target.value, s.saldo)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => toggleManualMode(s.id)} className="h-10 text-xs hover:bg-muted text-muted-foreground">Batal</Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2 overflow-x-auto pb-1 flex-1 scrollbar-none">
                          {JAJAN_OPTS.map(opt => (
                            <Button 
                              key={opt} 
                              variant={draftVal === opt ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleSelectJajan(s.id, opt, s.saldo)}
                              disabled={s.saldo < opt}
                              className={cn(
                                "h-9 rounded-lg text-xs font-bold transition-all flex-shrink-0 shadow-none border",
                                draftVal === opt 
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm scale-105' 
                                  : 'bg-background text-foreground border-border hover:border-amber-400 disabled:opacity-40 disabled:bg-muted'
                              )}>
                              {opt / 1000}k
                            </Button>
                          ))}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleManualMode(s.id)}
                          className="h-9 px-3 rounded-lg text-xs font-bold border-dashed border-border text-muted-foreground hover:text-foreground">
                          Man
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* FLOATING SAVE */}
      {totalJajanDraft > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-40">
          <div className="max-w-md mx-auto mb-2 sm:mb-4">
             <Button 
               onClick={handleSimpanJajan} 
               disabled={isSaving}
               className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-between px-6 transition-all active:scale-95 disabled:opacity-70"
             >
               <div className="text-left flex flex-col">
                 <span className="text-[10px] text-emerald-100 uppercase tracking-widest font-black leading-none">Total Jajan Hari Ini</span>
                 <span className="text-xl font-bold mt-1 leading-none text-white">Rp {totalJajanDraft.toLocaleString('id-ID')}</span>
               </div>
               <div className="flex items-center gap-2 font-black bg-black/20 px-4 py-2 rounded-xl text-sm leading-none text-white">
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                 {isSaving ? 'PROSES...' : 'SIMPAN'}
               </div>
             </Button>
          </div>
        </div>
      )}

      {/* MODAL DETAIL & TOPUP WITH SHADCN DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background rounded-2xl gap-0">
          <DialogHeader className="p-5 border-b bg-muted/40 text-left">
            <DialogTitle className="text-lg font-black text-foreground">{selectedSantri?.nama_lengkap}</DialogTitle>
             <DialogDescription className="text-xs font-mono text-muted-foreground mt-1">Saldo: Rp {selectedSantri?.saldo?.toLocaleString('id-ID')}</DialogDescription>
          </DialogHeader>

          <div className="p-5 overflow-y-auto max-h-[60vh] space-y-6">
            {/* Topup form */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
               <p className="text-[11px] font-black tracking-wider text-emerald-700 dark:text-emerald-500 uppercase mb-3 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5"/> Tambah Saldo
               </p>
               <form onSubmit={handleTopup} className="flex gap-2">
                 <Input 
                   type="number" 
                   placeholder="Nominal Rp..."
                   className="flex-1 border-emerald-200 dark:border-emerald-800 bg-background rounded-xl focus-visible:ring-emerald-500"
                   value={topupNominal}
                   onChange={e => setTopupNominal(e.target.value)}
                 />
                 <Button disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm px-5 w-24">
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Isi'}
                 </Button>
               </form>
            </div>

            {/* History */}
            <div>
               <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5"/> Riwayat Transaksi
               </h4>
               {loadingHistory ? (
                 <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground"/></div>
               ) : history.length === 0 ? (
                 <p className="text-xs text-muted-foreground italic text-center p-4 bg-muted/30 border border-dashed rounded-xl border-border/60">Belum ada transaksi.</p>
               ) : (
                 <div className="space-y-2.5">
                   {history.map(h => (
                     <div key={h.id} className="flex justify-between items-center p-3 border border-border/50 rounded-xl bg-card hover:bg-muted/30 transition-colors shadow-sm">
                       <div>
                         <p className={cn("text-sm font-black", h.jenis === 'MASUK' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500')}>
                           {h.jenis === 'MASUK' ? '+' : '-'} Rp {h.nominal.toLocaleString('id-ID')}
                         </p>
                         <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                           {format(new Date(h.created_at), 'dd MMM HH:mm', { locale: id })} • {h.keterangan}
                         </p>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="icon-sm"
                         onClick={() => handleDeleteHistory(h.id)}
                         className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg"
                         title="Hapus (Koreksi)"
                       >
                         <Trash2 className="w-4 h-4"/>
                       </Button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}