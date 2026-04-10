'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { cariSantriAsrama, simpanAbsenSakit, getListSakitMingguan, hapusAbsenSakit, getAsramaRestrictionClient } from './actions'
import { Search, Trash2, Home, FileText, Loader2, Lock, AlertTriangle, Syringe, Pill } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function AbsenSakitPage() {
  const [selectedAsrama, setSelectedAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [listSakit, setListSakit] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // State Modal Konfirmasi
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    description: string;
    type: 'save' | 'delete';
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    description: '',
    type: 'save',
    onConfirm: () => {}
  })
  
  // 1. Cek Permission
  useEffect(() => {
    getAsramaRestrictionClient().then(asrama => {
      if (asrama) {
        setUserAsrama(asrama)
        setSelectedAsrama(asrama)
      }
    })
  }, [])

  // 2. Load Data
  useEffect(() => {
    loadList()
  }, [selectedAsrama])

  const loadList = async () => {
    setLoadingList(true)
    const res = await getListSakitMingguan(selectedAsrama)
    setListSakit(res)
    setLoadingList(false)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) {
      toast.warning("Ketik minimal 3 huruf untuk mencari.")
      return
    }
    
    setIsSearching(true)
    const loadingToast = toast.loading("Mencari santri...")
    const res = await cariSantriAsrama(search, selectedAsrama)
    toast.dismiss(loadingToast)
    setIsSearching(false)

    setHasilCari(res)
    if (res.length === 0) {
      toast.info("Santri tidak ditemukan", { description: "Coba kata kunci lain atau pastikan asrama benar." })
    }
  }

  // Wrapper untuk memicu Modal Konfirmasi Simpan
  const triggerSimpan = (santri: any, ket: 'BELI_SURAT' | 'TIDAK_BELI') => {
    const desc = ket === 'BELI_SURAT' ? "Status: Beli Surat Dokter (Klinik)" : "Status: Izin Sakit Biasa"
    
    setConfirmState({
      isOpen: true,
      type: 'save',
      message: `Catat sakit: ${santri.nama_lengkap}?`,
      description: desc,
      onConfirm: async () => {
        const loadingToast = toast.loading("Menyimpan data...")
        const res = await simpanAbsenSakit(santri.id, ket)
        toast.dismiss(loadingToast)

        if (res?.error) {
          toast.error("Gagal menyimpan", { description: res.error })
        } else {
          toast.success("Berhasil dicatat", { description: `${santri.nama_lengkap} telah ditambahkan ke daftar sakit.` })
          setSearch('')
          setHasilCari([])
          loadList()
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  // Wrapper untuk memicu Modal Konfirmasi Hapus
  const triggerHapus = (item: any) => {
    setConfirmState({
      isOpen: true,
      type: 'delete',
      message: "Hapus data sakit ini?",
      description: `${item.santri?.nama_lengkap} - ${format(new Date(item.tanggal), 'dd MMM yyyy')}`,
      onConfirm: async () => {
        const loadingToast = toast.loading("Menghapus data...")
        await hapusAbsenSakit(item.id)
        toast.dismiss(loadingToast)
        
        toast.success("Data dihapus")
        loadList()
        setConfirmState(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER HERO */}
      <div className="relative bg-rose-950 border border-rose-900/50 text-rose-50 px-5 pt-5 pb-6 rounded-[2rem] shadow-xl shadow-rose-900/10 overflow-hidden mb-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <div className="absolute top-10 -left-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"/>
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-black flex items-center gap-2 mb-1.5">
               <Syringe className="w-5 h-5 text-rose-400"/> Absen Sakit
              </h1>
              <p className="text-rose-200/70 text-xs font-medium max-w-sm leading-relaxed">
                Input data santri sakit & status surat dokter mingguan.
              </p>
            </div>
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", userAsrama ? 'bg-rose-800/30 text-rose-200 border-rose-500/30' : 'bg-white/5 border-white/10')}>
              {userAsrama ? <Lock className="w-3.5 h-3.5 text-rose-400"/> : <Home className="w-3.5 h-3.5 text-rose-200"/>}
              {userAsrama
                ? <span>{userAsrama}</span>
                : <Select value={selectedAsrama} onValueChange={(val) => { if(val){ setSelectedAsrama(val); setSearch(''); setHasilCari([]); } }}>
                    <SelectTrigger className="h-4 border-none bg-transparent shadow-none focus:ring-0 p-0 text-xs font-bold gap-1 focus-visible:ring-0 appearance-none text-rose-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
              }
            </div>
          </div>
        </div>
      </div>

      {/* FORM INPUT PENCARIAN */}
      <Card className="shadow-sm border-border overflow-hidden bg-card">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Input Santri Sakit</CardTitle>
          <CardDescription className="text-xs">Cari nama santri untuk mencatat absen sakit hari ini.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <Input 
              type="text" 
              placeholder="Cari nama santri..." 
              className="flex-1 pl-9 pr-4 h-12 rounded-xl text-sm border-border bg-background shadow-sm focus-visible:ring-rose-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" disabled={isSearching} className="h-12 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm">
               {isSearching ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Cari'}
            </Button>
          </form>

          {hasilCari.length > 0 && (
            <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2">
              {hasilCari.map(s => (
                <div key={s.id} className="p-3 border border-border/60 rounded-xl bg-muted/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-left w-full sm:w-auto">
                    <p className="font-bold text-foreground leading-tight mb-1">{s.nama_lengkap}</p>
                    <p className="text-xs text-muted-foreground font-medium">Kamar {s.kamar}</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSimpan(s, 'TIDAK_BELI')}
                      className="flex-1 sm:flex-none h-9 text-[11px] font-black tracking-wider uppercase text-amber-600 border-amber-500/30 hover:bg-amber-500/10 dark:text-amber-500 shadow-none"
                    >
                       <Pill className="w-3.5 h-3.5 mr-1.5"/> Izin Biasa
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => triggerSimpan(s, 'BELI_SURAT')}
                      className="flex-1 sm:flex-none h-9 text-[11px] font-black tracking-wider uppercase bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5"/> Beli Surat
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LIST SAKIT MINGGUAN */}
      <div className="space-y-3 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <h3 className="font-black text-foreground uppercase tracking-wider text-xs">Daftar Sakit Minggu Ini</h3>
          <Badge variant="outline" className="text-[10px] w-fit shadow-none">Reset otomatis tiap Senin</Badge>
        </div>

        {loadingList ? (
          <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>
        ) : listSakit.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border/60 bg-muted/20 rounded-2xl text-muted-foreground text-sm font-medium">
            Belum ada santri sakit minggu ini.
          </div>
        ) : (
          <div className="grid gap-2">
            {listSakit.map((item) => (
              <Card key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:shadow-sm transition-shadow rounded-2xl overflow-hidden bg-card border-border/60">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm",
                    item.keterangan === 'BELI_SURAT' ? 'bg-rose-500' : 'bg-amber-500'
                  )}>
                    {item.santri?.kamar}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm leading-tight mb-1">
                      {item.santri?.nama_lengkap}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground font-medium">
                         {format(new Date(item.tanggal), 'EEEE, dd MMM', { locale: id })}
                      </span>
                      <span className="text-muted-foreground mx-1">•</span>
                      {item.keterangan === 'BELI_SURAT' ? (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-1 dark:text-rose-400">
                          <FileText className="w-3 h-3"/> Surat Dokter
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded tracking-wider uppercase dark:text-amber-500">
                          Izin Biasa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => triggerHapus(item)}
                  className="absolute sm:relative top-3 right-3 sm:top-0 sm:right-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity"
                  title="Hapus Data"
                >
                  <Trash2 className="w-4 h-4"/>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* --- SHADCN DIALOG KONFIRMASI CUSTOM --- */}
      <Dialog open={confirmState.isOpen} onOpenChange={(open) => setConfirmState(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background rounded-2xl gap-0 border-none shadow-2xl">
          <div className={cn(
             "h-1.5 w-full",
             confirmState.type === 'delete' ? 'bg-destructive' : 'bg-primary'
          )}/>
          <div className="p-6 text-center">
            <div className={cn(
               "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-muted/50",
               confirmState.type === 'delete' ? 'text-destructive' : 'text-primary'
            )}>
              {confirmState.type === 'delete' ? <Trash2 className="w-8 h-8"/> : <AlertTriangle className="w-8 h-8"/>}
            </div>
            
            <DialogTitle className="text-xl font-black text-foreground mb-2">{confirmState.message}</DialogTitle>
            <DialogDescription className="text-sm font-medium mb-6">{confirmState.description}</DialogDescription>
            
            <div className="grid grid-cols-2 gap-3">
              <DialogClose className="h-12 rounded-xl font-bold border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center">
                Batal
              </DialogClose>
              <Button 
                onClick={confirmState.onConfirm}
                variant={confirmState.type === 'delete' ? "destructive" : "default"}
                className={cn("h-12 rounded-xl font-bold shadow-sm", confirmState.type === 'save' && "bg-primary text-primary-foreground")}
              >
                {confirmState.type === 'delete' ? 'Hapus' : 'Ya, Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}