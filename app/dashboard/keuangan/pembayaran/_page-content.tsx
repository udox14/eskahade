'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cariSantriKeuangan, getInfoTagihan, bayarTagihan, getMonitoringPembayaran, bayarLunasSetahun } from './actions'
import { Search, Wallet, Building2, Calendar, CheckCircle, Clock, Loader2, Coins, Home, User, Zap, Filter, ArrowLeft, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function LoketPembayaranPage() {
  const confirm = useConfirm()
  
  // --- STATE UTAMA ---
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  
  // --- STATE MONITORING (TABEL) ---
  const [tahunTagihan, setTahunTagihan] = useState(new Date().getFullYear())
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [dataList, setDataList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loadingList, setLoadingList] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // --- STATE PAYMENT FORM ---
  const [infoTagihan, setInfoTagihan] = useState<any>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [nominalCicil, setNominalCicil] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // 1. LOAD MONITORING DATA
  const loadMonitoring = async () => {
    setLoadingList(true)
    const res = await getMonitoringPembayaran(filterAsrama, filterKamar, searchQuery, tahunTagihan)
    setDataList(res)
    setLoadingList(false)
    setHasLoaded(true)
  }

  // 2. LOAD INFO DETAIL SANTRI
  useEffect(() => {
    if (selectedSantri) {
      loadInfo()
    }
  }, [selectedSantri, tahunTagihan])

  const loadInfo = async () => {
    setLoadingInfo(true)
    const res = await getInfoTagihan(selectedSantri.id, selectedSantri.tahun_masuk_fix, tahunTagihan)
    setInfoTagihan(res)
    setLoadingInfo(false)
  }

  // ============================================================
  // FIX TOMBOL BACK HP: Sync view ke browser history
  // ============================================================
  useEffect(() => {
    if (selectedSantri) {
      window.history.pushState({ view: 'DETAIL' }, '')
    }
  }, [selectedSantri])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'DETAIL') {
        setSelectedSantri(null)
        setInfoTagihan(null)
        setNominalCicil('')
        loadMonitoring()
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // --- HANDLERS ---
  const handleSelect = (s: any) => {
    setSelectedSantri(s)
    setNominalCicil('')
  }

  const handleLunasTahunanSemua = async () => {
    if (!infoTagihan) return
    if(!await confirm(`Lunasi seluruh tagihan tahunan (EHB, Kesehatan, Ekskul) untuk ${selectedSantri.nama_lengkap}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan...")
    const res = await bayarLunasSetahun(selectedSantri.id, tahunTagihan, selectedSantri.tahun_masuk_fix)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.warning(res.error)
    } else {
        toast.success("Lunas Berhasil!", { description: `Total Rp ${res.total?.toLocaleString()} diterima.` })
        loadInfo()
    }
  }

  const handleLunasBangunan = async () => {
    const sisa = infoTagihan.bangunan.sisa
    if (sisa <= 0) return toast.info("Sudah lunas.")
    if (!await confirm(`Lunasi sisa Uang Bangunan sebesar Rp ${sisa.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan bangunan...")
    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', sisa, null, 'Pelunasan Bangunan')
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Bangunan Lunas!", { description: "Terima kasih." })
        loadInfo()
    }
  }

  const handleBayarBangunan = async () => {
    const bayar = parseInt(nominalCicil.replace(/\./g, ''))
    if (!bayar || bayar <= 0) return toast.warning("Nominal tidak valid")
    if (bayar > infoTagihan.bangunan.sisa) return toast.warning("Nominal melebihi sisa tagihan!")
    if (!await confirm(`Terima pembayaran Uang Bangunan Rp ${bayar.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', bayar, null, 'Cicilan Bangunan')
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Berhasil!", { description: "Pembayaran cicilan diterima." })
        setNominalCicil('')
        loadInfo()
    }
  }

  const handleBayarTahunan = async (jenis: string, nominal: number) => {
    if (nominal <= 0) return toast.error("Tarif belum diatur untuk angkatan ini.")
    if (!await confirm(`Terima pembayaran ${jenis} Tahun ${tahunTagihan} sebesar Rp ${nominal.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, jenis, nominal, tahunTagihan, `Bayar ${jenis} ${tahunTagihan}`)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Lunas!", { description: `${jenis} tahun ${tahunTagihan} berhasil dibayar.` })
        loadInfo()
    }
  }

  const handleBackToList = () => {
    window.history.back()
  }

  // --- Pagination Logic ---
  const totalPages = Math.ceil(dataList.length / pageSize)
  const safePage = Math.min(page, totalPages || 1)
  const pagedList = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return dataList.slice(start, start + pageSize)
  }, [dataList, safePage, pageSize])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
            <Coins className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Loket Keuangan Pusat</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Penerimaan Uang Bangunan & Tagihan Tahunan</p>
          </div>
        </div>
        
        {/* Tahun Selector */}
        <div className="flex items-center gap-1 bg-muted/50 border p-1 rounded-2xl shadow-inner">
          <Button variant="ghost" size="icon" onClick={() => setTahunTagihan(t => t - 1)} className="h-9 w-9 rounded-xl hover:bg-background">
            <ChevronLeft className="w-4 h-4"/>
          </Button>
          <div className="px-4 py-1.5 bg-background rounded-xl shadow-sm border border-border">
            <span className="font-black text-emerald-600 tabular-nums">{tahunTagihan}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTahunTagihan(t => t + 1)} className="h-9 w-9 rounded-xl hover:bg-background">
            <ChevronRight className="w-4 h-4"/>
          </Button>
        </div>
      </div>

      {!selectedSantri ? (
        /* MONITORING VIEW */
        <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Filter Card */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block px-1">Cari Nama / NIS</label>
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-emerald-500 transition-colors"/>
                  <Input 
                    placeholder="Ketik nama santri..." 
                    className="pl-10 h-11 bg-muted/20 border-border focus-visible:ring-emerald-500 rounded-xl font-bold"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadMonitoring()}
                  />
                </div>
              </div>

              <div className="w-full md:w-56 space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block px-1">Asrama</label>
                <Select value={filterAsrama} onValueChange={(v) => { setFilterAsrama(v ?? 'SEMUA'); setFilterKamar('SEMUA') }}>
                  <SelectTrigger className="h-11 bg-muted/20 border-border focus:ring-emerald-500 rounded-xl font-bold">
                    <SelectValue placeholder="Asrama"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEMUA" className="font-bold">Semua Asrama</SelectItem>
                    {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-32 space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block px-1">Kamar</label>
                <Select value={filterKamar} onValueChange={(v) => setFilterKamar(v ?? '')}>
                  <SelectTrigger className="h-11 bg-muted/20 border-border focus:ring-emerald-500 rounded-xl font-bold">
                    <SelectValue placeholder="Kamar"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEMUA" className="font-bold">Semua</SelectItem>
                    {Array.from({length: 30}, (_, i) => String(i + 1)).map(n => <SelectItem key={n} value={n} className="font-bold">{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={loadMonitoring} 
                disabled={loadingList}
                className="h-11 px-8 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 w-full md:w-auto"
              >
                {loadingList ? <Loader2 className="w-4 h-4 animate-spin"/> : <Filter className="w-4 h-4"/>}
                Tampilkan
              </Button>
            </CardContent>
          </Card>

          {/* Table Card */}
          <Card className="border-border shadow-sm overflow-hidden">
            {!hasLoaded ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-muted-foreground/30">
                  <Filter className="w-8 h-8 text-muted-foreground/30"/>
                </div>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Silakan gunakan filter di atas</p>
              </div>
            ) : dataList.length === 0 ? (
              <div className="py-24 text-center">
                <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20"/>
                <p className="text-muted-foreground font-bold">Data santri tidak ditemukan.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase tracking-wider h-12">Nama Santri</TableHead>
                        <TableHead className="text-center font-black text-[10px] uppercase tracking-wider h-12">Bangunan</TableHead>
                        <TableHead className="text-center font-black text-[10px] uppercase tracking-wider h-12">Tahunan {tahunTagihan}</TableHead>
                        <TableHead className="text-right font-black text-[10px] uppercase tracking-wider h-12">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedList.map((s) => (
                        <TableRow 
                          key={s.id} 
                          onClick={() => handleSelect(s)} 
                          className="cursor-pointer hover:bg-emerald-500/5 transition-colors group"
                        >
                          <TableCell className="py-4">
                            <div className="font-bold text-foreground text-sm">{s.nama_lengkap}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{s.asrama} - Kamar {s.kamar}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={s.status_bangunan} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1.5">
                              <BadgeSmall label="EHB" active={s.lunas_ehb} />
                              <BadgeSmall label="KES" active={s.lunas_kesehatan} />
                              <BadgeSmall label="EKS" active={s.lunas_ekskul} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-emerald-600 font-black text-[10px] uppercase group-hover:bg-emerald-500/10 transition-all">
                               Bayar <ChevronRight className="w-3.5 h-3.5"/>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Showing {Math.min(dataList.length, (safePage-1)*pageSize + 1)} - {Math.min(dataList.length, safePage*pageSize)} of {dataList.length}
                  </div>
                  <div className="flex items-center gap-2">
                     <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={safePage === 1} 
                        onClick={() => setPage(p => p - 1)}
                        className="rounded-xl font-bold h-9 shadow-none border-border"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1"/> Prev
                      </Button>
                      <div className="flex gap-1">
                        {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                          let pNum = i + 1;
                          if (totalPages > 5) {
                            if (safePage > 3) pNum = safePage - 2 + i;
                            if (safePage > totalPages - 2) pNum = totalPages - 4 + i;
                          }
                          if (pNum > totalPages) return null;
                          return (
                            <Button
                              key={pNum}
                              variant={safePage === pNum ? 'default' : 'ghost'}
                              size="sm"
                              className={cn('w-9 h-9 rounded-xl font-black text-xs', safePage === pNum ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
                              onClick={() => setPage(pNum)}
                            >
                              {pNum}
                            </Button>
                          )
                        })}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={safePage === totalPages} 
                        onClick={() => setPage(p => p + 1)}
                        className="rounded-xl font-bold h-9 shadow-none border-border"
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1"/>
                      </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : (
        /* DETAIL / PAYMENT VIEW */
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
          
          <Button 
            variant="ghost" 
            onClick={handleBackToList} 
            className="group gap-2 text-muted-foreground hover:text-emerald-600 font-black text-xs uppercase transition-all"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform"/>
            Kembali ke Daftar
          </Button>

          {/* Quick Stats / Info Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-3 border-border bg-emerald-600 text-white shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"/>
              <CardContent className="p-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner backdrop-blur-sm border border-white/10">
                    <User className="w-8 h-8"/>
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-2xl font-black tracking-tight">{selectedSantri.nama_lengkap}</h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-1 opacity-90">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest"><Calendar className="w-3.5 h-3.5"/> Angkatan {selectedSantri.tahun_masuk_fix}</div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest"><Home className="w-3.5 h-3.5"/> {selectedSantri.asrama}</div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest"><Wallet className="w-3.5 h-3.5 uppercase"/> {selectedSantri.nis}</div>
                    </div>
                  </div>
                </div>
                {infoTagihan && (
                   <div className="flex gap-3">
                     <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 text-center min-w-[120px]">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Sisa Bangunan</p>
                       <p className="text-xl font-black">Rp {infoTagihan.bangunan.sisa.toLocaleString()}</p>
                     </div>
                   </div>
                )}
              </CardContent>
            </Card>

            {loadingInfo ? (
              <div className="lg:col-span-3 py-32 text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500 opacity-50"/>
                <p className="mt-4 text-muted-foreground font-bold uppercase tracking-widest text-xs">Menyiapkan Info Tagihan...</p>
              </div>
            ) : infoTagihan && (
              <>
                {/* UANG BANGUNAN CARD */}
                <Card className="border-border shadow-sm overflow-hidden flex flex-col">
                  <CardHeader className="bg-indigo-500/5 border-b border-border/60 pb-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-500"/> Uang Bangunan
                      </CardTitle>
                      <StatusBadge status={infoTagihan.bangunan.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Progress Bayar</p>
                          <p className="text-2xl font-black tabular-nums">
                            {Math.round((infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Status</p>
                          <p className="text-xs font-black text-indigo-600">
                            {infoTagihan.bangunan.status === 'LUNAS' ? 'Sudah Lunas' : 'Belum Lunas'}
                          </p>
                        </div>
                      </div>
                      <Progress 
                        value={(infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100} 
                        className="h-3 bg-muted rounded-full overflow-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/60">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Total Wajib</p>
                        <p className="text-sm font-black tabular-nums">Rp {infoTagihan.bangunan.total_wajib.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Sisa Tagihan</p>
                        <p className="text-sm font-black text-rose-600 tabular-nums">Rp {infoTagihan.bangunan.sisa.toLocaleString()}</p>
                      </div>
                    </div>

                    {infoTagihan.bangunan.sisa > 0 ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">RP</span>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              className="pl-9 font-black bg-muted/20 border-border rounded-xl focus-visible:ring-indigo-500"
                              value={nominalCicil}
                              onChange={e => setNominalCicil(e.target.value)}
                            />
                          </div>
                          <Button 
                            onClick={handleBayarBangunan}
                            disabled={isProcessing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl"
                          >
                             Bayar
                          </Button>
                        </div>
                        <Button 
                          variant="outline"
                          onClick={handleLunasBangunan}
                          disabled={isProcessing}
                          className="w-full border-indigo-500/30 text-indigo-700 font-black rounded-xl gap-2 hover:bg-indigo-50"
                        >
                          <Zap className="w-4 h-4 text-amber-500 fill-amber-500"/> 
                          LUNASI SEMUA (100%)
                        </Button>
                      </div>
                    ) : (
                      <div className="py-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center">
                        <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2"/>
                        <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Tagihan Lunas</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* TAGIHAN TAHUNAN CARD */}
                <Card className="lg:col-span-2 border-border shadow-sm overflow-hidden flex flex-col">
                  <CardHeader className="bg-emerald-500/5 border-b border-border/60">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500"/> Tagihan Tahunan ({tahunTagihan})
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pembayaran per item untuk tahun operasional berjalan</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="divide-y border-b flex-1">
                      {['KESEHATAN', 'EHB', 'EKSKUL'].map(jenis => {
                        const data = infoTagihan.tahunan[jenis]
                        return (
                          <div key={jenis} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-muted/30">
                            <div className="flex gap-4 items-center">
                              <div className={cn('p-3 rounded-2xl shadow-sm border', data.lunas ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10' : 'bg-muted text-muted-foreground border-border')}>
                                {jenis === 'EHB' ? <Building2 className="w-5 h-5"/> : jenis === 'KES' ? <Info className="w-5 h-5"/> : <Zap className="w-5 h-5"/>}
                              </div>
                              <div>
                                <p className="font-black text-foreground text-sm tracking-tight">{jenis === 'EHB' ? 'EHB (Ujian)' : jenis}</p>
                                <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-widest">Tarif: Rp {data.nominal.toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="w-full sm:w-auto">
                              {data.lunas ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-black text-xs px-4 py-1.5 rounded-full shadow-sm gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5"/> LUNAS
                                </Badge>
                              ) : (
                                <Button 
                                  onClick={() => handleBayarTahunan(jenis, data.nominal)}
                                  disabled={isProcessing || data.nominal === 0}
                                  variant="outline"
                                  className="w-full sm:w-auto border-emerald-500/30 text-emerald-700 font-black rounded-xl hover:bg-emerald-50 h-10 gap-2"
                                >
                                  <Clock className="w-4 h-4"/> BAYAR Rp {data.nominal.toLocaleString()}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Bulk Action Footer */}
                    <div className="p-6 bg-emerald-500/5 space-y-4">
                      {(!infoTagihan.tahunan.EHB.lunas || !infoTagihan.tahunan.KESEHATAN.lunas || !infoTagihan.tahunan.EKSKUL.lunas) ? (
                        <Button 
                          onClick={handleLunasTahunanSemua}
                          disabled={isProcessing}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-14 text-sm shadow-lg shadow-emerald-500/20 gap-3"
                        >
                          <Zap className="w-5 h-5 text-amber-400 fill-amber-400"/>
                          LUNASI SEMUA TABUNGAN TAHUNAN
                        </Button>
                      ) : (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                          Seluruh Tagihan Tahunan {tahunTagihan} Telah Lunas
                        </div>
                      )}

                      {Object.values(infoTagihan.tahunan).some((x: any) => x.nominal === 0) && (
                        <div className="flex gap-2 items-center text-[9px] font-bold text-muted-foreground italic bg-muted/50 p-2 rounded-lg">
                          <Info className="w-3 h-3 shrink-0"/>
                          Tarif Rp 0 jika belum diatur di menu Pengaturan Tarif untuk angkatan ini.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isLunas = status === 'LUNAS'
  const isCicil = status === 'CICIL'
  return (
    <Badge variant="outline" className={cn(
      'font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md border text-center whitespace-nowrap',
      isLunas ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' :
      isCicil ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
      'bg-slate-100 text-slate-500 border-border opacity-50'
    )}>
      {status || 'NONE'}
    </Badge>
  )
}

function BadgeSmall({ label, active }: { label: string, active: boolean }) {
  return (
    <span className={cn(
      'text-[9px] font-black px-1.5 py-0.5 rounded-sm border uppercase transition-all duration-300',
      active ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-muted text-muted-foreground/30 border-border'
    )}>
      {label}
    </span>
  )
}