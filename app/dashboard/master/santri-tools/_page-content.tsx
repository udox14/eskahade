'use client'

import React, { useState, useEffect } from 'react'
import {
  previewNaikKelas, eksekusiNaikKelas,
  getSantriPembebasan, setBebas,
  catatBebasPembayaran, hapusBebasPembayaran,
  getSekolahList,
} from './actions'
import {
  ArrowUpCircle, ShieldCheck, Loader2, Search, CheckSquare,
  Square, AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp,
  GraduationCap, Banknote, RefreshCw, Users, Filter, LayoutGrid, List,
  ArrowRight, Info, HardDrive, UserPlus, UserMinus, ShieldAlert,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ['SEMUA', 'AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const JENIS_BIAYA_LIST = ['KESEHATAN', 'EHB', 'EKSKUL', 'BANGUNAN']

const STATUS_COLOR: Record<string, string> = {
  naik: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  lulus_sltp: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  lulus_slta: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  tidak_diketahui: 'bg-muted text-muted-foreground border-border',
}

const STATUS_LABEL: Record<string, string> = {
  naik: 'Naik Kelas',
  lulus_sltp: 'Lulus SLTP → SLTA',
  lulus_slta: 'Lulus SLTA (Finish)',
  tidak_diketahui: 'Format Tak Dikenali',
}

type Tab = 'naik_kelas' | 'pembebasan'

export default function SantriToolsPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('naik_kelas')

  // ── TAB NAIK KELAS ─────────────────────────────────────────────────────
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterSekolah, setFilterSekolah] = useState('SEMUA')
  const [filterKelas, setFilterKelas] = useState('')
  const [sekolahList, setSekolahList] = useState<string[]>([])
  const [preview, setPreview] = useState<any[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [eksekusiLoading, setEksekusiLoading] = useState(false)
  const [showTidakDikenal, setShowTidakDikenal] = useState(false)

  // ── TAB PEMBEBASAN ─────────────────────────────────────────────────────
  const [pbAsrama, setPbAsrama] = useState('SEMUA')
  const [pbSearch, setPbSearch] = useState('')
  const [pbHanyaBebas, setPbHanyaBebas] = useState(false)
  const [pbData, setPbData] = useState<any[]>([])
  const [pbLoading, setPbLoading] = useState(false)
  const [pbSelected, setPbSelected] = useState<Set<string>>(new Set())
  const [pbTahun, setPbTahun] = useState(new Date().getFullYear())
  const [modalSantri, setModalSantri] = useState<any | null>(null)

  useEffect(() => {
    getSekolahList().then(setSekolahList)
  }, [])

  // ── Naik Kelas Logic ───────────────────────────────────────────────────
  const handlePreview = async () => {
    setLoadingPreview(true)
    setPreview(null)
    setSelectedIds(new Set())
    const res = await previewNaikKelas({ 
      asrama: filterAsrama !== 'SEMUA' ? filterAsrama : undefined, 
      sekolah: filterSekolah !== 'SEMUA' ? filterSekolah : undefined, 
      kelasSekolah: filterKelas || undefined 
    })
    if (res && 'error' in res) { 
       toast.error(res.error as string)
       setLoadingPreview(false)
       return 
    }
    setPreview(res)
    // Auto-select semua yang bisa naik
    const autoSelect = new Set(res.filter((s: any) => s.status !== 'tidak_diketahui').map((s: any) => s.id))
    setSelectedIds(autoSelect)
    setLoadingPreview(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSelected) ids.forEach(id => n.delete(id))
      else ids.forEach(id => n.add(id))
      return n
    })
  }

  const handleEksekusi = async () => {
    if (!selectedIds.size) return
    if (!await confirm(`Konfirmasi Naik Kelas Massal.
    Tindakan ini akan menaikkan kelas ${selectedIds.size} santri terpilih. 
    Yakin ingin melanjutkan?`)) return

    setEksekusiLoading(true)
    const res = await eksekusiNaikKelas([...selectedIds])
    setEksekusiLoading(false)
    if (res && 'error' in res) { toast.error(res.error as string); return }
    toast.success(`Alhamdulillah! ${(res as any).updated} santri berhasil diperbarui datanya.`)
    setPreview(null)
    setSelectedIds(new Set())
  }

  const grouped = preview ? {
    naik: preview.filter(s => s.status === 'naik'),
    lulus_sltp: preview.filter(s => s.status === 'lulus_sltp'),
    lulus_slta: preview.filter(s => s.status === 'lulus_slta'),
    tidak_diketahui: preview.filter(s => s.status === 'tidak_diketahui'),
  } : null

  // ── Pembebasan Logic ──────────────────────────────────────────────────
  const loadPembebasan = async () => {
    setPbLoading(true)
    setPbData([])
    setPbSelected(new Set())
    const res = await getSantriPembebasan({ 
       asrama: pbAsrama !== 'SEMUA' ? pbAsrama : undefined, 
       search: pbSearch || undefined, 
       hanyaBebasSpp: pbHanyaBebas 
    })
    setPbData(res)
    setPbLoading(false)
  }

  const handleToggleBebas = async (ids: string[], bebas: boolean) => {
    const toastId = toast.loading(bebas ? "Membebaskan SPP..." : "Mengembalikan status SPP...")
    const res = await setBebas(ids, bebas)
    toast.dismiss(toastId)
    if (res && 'error' in res) { toast.error(res.error as string); return }
    toast.success(`Sukses! ${(res as any).updated} santri diperbarui.`)
    loadPembebasan()
  }

  const updateModalState = async (nis: string) => {
    const updated = await getSantriPembebasan({ search: nis })
    if (updated.length) setModalSantri(updated[0])
    loadPembebasan()
  }

  const handleCatatBebas = async (santriId: string, jenis: string) => {
    const res = await catatBebasPembayaran(santriId, jenis, pbTahun, '')
    if (res && 'error' in res) { toast.error(res.error as string); return }
    toast.success(`${jenis} ${pbTahun} dicatat BEBAS`)
    updateModalState(modalSantri.nis)
  }

  const handleHapusBebas = async (santriId: string, jenis: string) => {
    const res = await hapusBebasPembayaran(santriId, jenis, pbTahun)
    if (res && 'error' in res) { toast.error(res.error as string); return }
    toast.success(`Pembebasan ${jenis} dibatalkan`)
    updateModalState(modalSantri.nis)
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6 animate-in fade-in duration-500">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <HardDrive className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">SANTRI TOOLS</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Operasi & Manajemen Massal Data Santri</p>
          </div>
        </div>

        <div className="flex bg-muted/50 p-1 border rounded-2xl shadow-inner shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setTab('naik_kelas')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'naik_kelas' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <ArrowUpCircle className="w-3.5 h-3.5 mr-2"/> Naik Kelas
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setTab('pembebasan')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'pembebasan' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-2"/> Pembebasan
          </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* ───────────────────────────────────────────────────────────────────
          TAB 1: NAIK KELAS
      ─────────────────────────────────────────────────────────────────── */}
      {tab === 'naik_kelas' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
          
          <Alert className="bg-amber-500/5 border-amber-500/20 text-amber-800 rounded-2xl shadow-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Mekanisme Increment Kelas</AlertTitle>
            <AlertDescription className="text-[10px] font-bold opacity-70 uppercase leading-relaxed tracking-tight">
               Sistem akan menaikkan level kelas sekolah sebesar +1 unit (Ex: 7A → 8A). <br/>
               Santri kelas 12 akan dianggap LULUS dan kolom kelas akan dikosongkan. Pastikan filter akurat sebelum eksekusi.
            </AlertDescription>
          </Alert>

          {/* Filter Bar */}
          <Card className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asrama</Label>
                  <Select value={filterAsrama} onValueChange={(v) => setFilterAsrama(v || 'SEMUA')}>
                     <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                        <SelectValue placeholder="Semua Asrama" />
                     </SelectTrigger>
                     <SelectContent>
                        {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a === 'SEMUA' ? 'Seluruh Asrama' : a}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Instansi Sekolah</Label>
                  <Select value={filterSekolah} onValueChange={(v) => setFilterSekolah(v || 'SEMUA')}>
                     <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                        <SelectValue placeholder="Semua Sekolah" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="SEMUA" className="font-bold">Seluruh Sekolah</SelectItem>
                        {sekolahList.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Keyword Kelas (Opsional)</Label>
                  <Input value={filterKelas} onChange={e => setFilterKelas(e.target.value)} placeholder="mis: 7, 8A" className="h-11 rounded-xl bg-muted/20 border-border font-black placeholder:opacity-50"/>
               </div>
               <Button onClick={handlePreview} disabled={loadingPreview} className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} PREVIEW DATA
               </Button>
            </CardContent>
          </Card>

          {/* RESULTS AREA */}
          {preview && grouped ? (
            <div className="space-y-6 animate-in fade-in duration-500">
               
               {/* Summary Grid */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(grouped).map(([status, list]) => (
                    <Card key={status} className={cn("border-0 shadow-sm overflow-hidden text-center relative", STATUS_COLOR[status])}>
                       <CardContent className="p-4 flex flex-col items-center justify-center">
                          <p className="text-3xl font-black tabular-nums">{list.length}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-0.5">{STATUS_LABEL[status]}</p>
                       </CardContent>
                    </Card>
                  ))}
               </div>

               {/* Collapsible Groups */}
               {(['naik', 'lulus_sltp', 'lulus_slta'] as const).map(status => {
                 const list = grouped[status]
                 if (!list.length) return null
                 const listIds = list.map(s => s.id)
                 const allSel = listIds.every(id => selectedIds.has(id))
                 return (
                   <Card key={status} className="border-border shadow-sm overflow-hidden">
                      <div className={cn("px-5 py-3 border-b flex items-center justify-between", STATUS_COLOR[status])}>
                         <div className="flex items-center gap-3">
                            <button onClick={() => toggleAll(listIds)} className="w-5 h-5 rounded-md border border-current flex items-center justify-center hover:bg-black/5 transition-colors">
                               {allSel ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                            </button>
                            <span className="font-black text-xs uppercase tracking-widest">{STATUS_LABEL[status]} ({list.length} JIWA)</span>
                         </div>
                         <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest bg-white/20 border-white/30 text-current">{listIds.filter(id => selectedIds.has(id)).length} DIPILIH</Badge>
                      </div>
                      <ScrollArea className="h-64">
                         <div className="divide-y divide-border/50">
                            {list.map(s => (
                              <div key={s.id} onClick={() => toggleSelect(s.id)} className={cn(
                                "flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors group",
                                selectedIds.has(s.id) ? "bg-indigo-500/5" : "hover:bg-muted/30"
                              )}>
                                 <div className={cn(
                                   "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                   selectedIds.has(s.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-border text-muted-foreground/20 group-hover:border-indigo-300"
                                 )}>
                                    {selectedIds.has(s.id) && <CheckSquare className="w-4 h-4"/>}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="font-black text-foreground text-sm tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{s.nama_lengkap}</p>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40 mt-0.5 tracking-widest">{s.nis} · {s.asrama} · {s.sekolah || '—'}</p>
                                 </div>
                                 <div className="flex items-center gap-3 shrink-0">
                                    <div className="px-2.5 py-1 bg-muted rounded-lg font-black text-[10px] text-muted-foreground uppercase tracking-widest">{s.kelas_sekolah}</div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground/30"/>
                                    <div className={cn(
                                      "px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm",
                                      s.kelas_baru ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
                                    )}>
                                       {s.kelas_baru ?? 'LULUS'}
                                    </div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </ScrollArea>
                   </Card>
                 )
               })}

               {/* UNKNOWN FORMATS */}
               {grouped.tidak_diketahui.length > 0 && (
                 <Card className="border-border shadow-sm overflow-hidden opacity-60">
                    <button onClick={() => setShowTidakDikenal(!showTidakDikenal)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                       <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                          <ShieldAlert className="w-4 h-4"/> Format Tak Dikenali ({grouped.tidak_diketahui.length})
                       </div>
                       {showTidakDikenal ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                    </button>
                    {showTidakDikenal && (
                       <ScrollArea className="h-40 border-t">
                          <div className="divide-y divide-border/30">
                             {grouped.tidak_diketahui.map(s => (
                               <div key={s.id} className="px-5 py-2.5 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                  <span>{s.nama_lengkap} ({s.nis})</span>
                                  <Badge variant="secondary" className="font-mono px-2 py-0 text-[9px]">{s.kelas_sekolah}</Badge>
                               </div>
                             ))}
                          </div>
                       </ScrollArea>
                    )}
                 </Card>
               )}

               {/* BOTTOM ACTION BAR */}
               <div className={cn(
                  "sticky bottom-6 z-30 transition-all transform duration-500",
                  selectedIds.size > 0 ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
               )}>
                  <Card className="bg-indigo-600 border-0 shadow-[0_20px_50px_rgba(79,70,229,0.3)] text-white p-2 rounded-[2.5rem]">
                     <div className="flex items-center justify-between gap-4 px-6 py-3">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                              <Users className="w-6 h-6"/>
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Siap Proses</p>
                              <p className="text-2xl font-black leading-none tabular-nums">{selectedIds.size} Santri</p>
                           </div>
                        </div>
                        <Button 
                           onClick={handleEksekusi} 
                           disabled={eksekusiLoading}
                           className="h-14 px-10 rounded-3xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-sm uppercase shadow-2xl gap-3 transition-transform active:scale-95"
                        >
                           {eksekusiLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowUpCircle className="w-5 h-5"/>}
                           {eksekusiLoading ? 'PROCESSING...' : 'EKSEKUSI NAIK KELAS'}
                        </Button>
                     </div>
                  </Card>
               </div>
            </div>
          ) : !loadingPreview && (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl opacity-20">
               <GraduationCap className="w-16 h-16 mx-auto mb-4"/>
               <p className="text-[10px] font-black uppercase tracking-widest">Belum ada data untuk dipreview</p>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────
          TAB 2: PEMBEBASAN
      ─────────────────────────────────────────────────────────────────── */}
      {tab === 'pembebasan' && (
        <div className="space-y-6 animate-in slide-in-from-right-10 duration-700">
           
           {/* Filter Bar */}
           <Card className="border-border shadow-sm overflow-hidden">
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                 <div className="w-full sm:w-48 space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Asrama</Label>
                    <Select value={pbAsrama} onValueChange={(v) => setPbAsrama(v || 'SEMUA')}>
                       <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                          <SelectValue placeholder="Semua Asrama" />
                       </SelectTrigger>
                       <SelectContent>
                          {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a === 'SEMUA' ? 'Seluruh Asrama' : a}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="flex-1 min-w-[200px] space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Cari Nama / NIS</Label>
                    <div className="relative group">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors pointer-events-none"/>
                       <Input 
                          value={pbSearch} 
                          onChange={e => setPbSearch(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && loadPembebasan()}
                          placeholder="Ketik identitas santri..." 
                          className="h-11 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"
                       />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Tahun Anggaran</Label>
                    <div className="flex items-center gap-1.5 bg-muted/50 border p-1 rounded-xl shadow-inner">
                       <Button variant="ghost" size="icon" onClick={() => setPbTahun(t => t - 1)} className="h-9 w-9 rounded-lg"><ChevronLeft className="w-4 h-4"/></Button>
                       <span className="font-black text-xs tabular-nums w-12 text-center text-indigo-600">{pbTahun}</span>
                       <Button variant="ghost" size="icon" onClick={() => setPbTahun(t => t + 1)} className="h-9 w-9 rounded-lg"><ChevronRight className="w-4 h-4"/></Button>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 h-11 px-4 bg-muted/20 border rounded-xl">
                    <input type="checkbox" id="chk-bebas" checked={pbHanyaBebas} onChange={e => setPbHanyaBebas(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"/>
                    <Label htmlFor="chk-bebas" className="text-[10px] font-black uppercase tracking-widest cursor-pointer opacity-70">Hanya Bebas SPP</Label>
                 </div>
                 <Button onClick={loadPembebasan} disabled={pbLoading} className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                    {pbLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} TAMPILKAN
                 </Button>
              </CardContent>
           </Card>

           {/* Bulk Overlay */}
           {pbSelected.size > 0 && (
             <Card className="bg-indigo-600 border-0 shadow-xl text-white p-3 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-wrap items-center justify-between gap-4 px-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-lg"><CheckSquare className="w-4 h-4"/></div>
                      <span className="text-[11px] font-black uppercase tracking-widest">{pbSelected.size} Terpilih</span>
                   </div>
                   <div className="flex gap-2">
                      <Button onClick={() => handleToggleBebas([...pbSelected], true)} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg px-4 gap-2 border-0">
                         <UserPlus className="w-3 h-3"/> BEBASKAN SPP
                      </Button>
                      <Button onClick={() => handleToggleBebas([...pbSelected], false)} size="sm" className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase rounded-lg px-4 gap-2 border-0">
                         <UserMinus className="w-3 h-3"/> CABUT STATUS
                      </Button>
                      <Button onClick={() => setPbSelected(new Set())} variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"><X className="w-4 h-4"/></Button>
                   </div>
                </div>
             </Card>
           )}

           {/* Table Display */}
           <Card className="border-border shadow-sm overflow-hidden min-h-[400px]">
              {pbLoading ? (
                 <div className="py-32 flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 opacity-50"/>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scanning status pembebasan...</p>
                 </div>
              ) : pbData.length === 0 ? (
                 <div className="py-24 text-center opacity-20 flex flex-col items-center">
                    <ShieldCheck className="w-16 h-16 mb-4"/>
                    <p className="text-[10px] font-black uppercase tracking-widest">Silakan gunakan filter di atas</p>
                 </div>
              ) : (
                 <ScrollArea className="h-[600px]">
                    <Table>
                       <TableHeader className="bg-muted/30 sticky top-0 z-20">
                          <TableRow>
                             <TableHead className="w-12 text-center">
                                <button onClick={() => {
                                   const allIds = pbData.map(s => s.id)
                                   const allSel = allIds.every(id => pbSelected.has(id))
                                   setPbSelected(allSel ? new Set() : new Set(allIds))
                                }} className="hover:opacity-70">
                                   {pbData.every(s => pbSelected.has(s.id)) ? <CheckSquare className="w-4 h-4 text-indigo-600"/> : <Square className="w-4 h-4 text-muted-foreground/30"/>}
                                </button>
                             </TableHead>
                             <TableHead className="text-[10px] font-black uppercase tracking-widest px-4">Santri & NIS</TableHead>
                             <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status SPP</TableHead>
                             <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-6">Bebas Tahunan ({pbTahun})</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {pbData.map(s => (
                             <TableRow key={s.id} className={cn("hover:bg-indigo-500/[0.03] transition-colors group", pbSelected.has(s.id) ? "bg-indigo-500/5" : "")}>
                                <TableCell className="text-center">
                                   <button onClick={() => {
                                      const n = new Set(pbSelected);
                                      n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                                      setPbSelected(n);
                                   }} className="hover:opacity-70">
                                      {pbSelected.has(s.id) ? <CheckSquare className="w-4 h-4 text-indigo-600"/> : <Square className="w-4 h-4 text-muted-foreground/20 group-hover:text-indigo-300"/>}
                                   </button>
                                </TableCell>
                                <TableCell className="py-4 px-4 cursor-pointer" onClick={() => setModalSantri(s)}>
                                   <div className="font-black text-foreground text-sm tracking-tight uppercase group-hover:text-indigo-700 transition-colors">{s.nama_lengkap}</div>
                                   <div className="text-[10px] font-black text-muted-foreground uppercase opacity-40 mt-0.5">{s.nis} · {s.asrama} {s.kamar}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                   <button 
                                      onClick={() => handleToggleBebas([s.id], !s.bebas_spp)}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95",
                                        s.bebas_spp ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 shadow-sm" : "bg-muted text-muted-foreground opacity-40 border-border"
                                      )}
                                   >
                                      {s.bebas_spp ? <CheckCircle2 className="w-3 h-3"/> : <X className="w-3 h-3"/>}
                                      {s.bebas_spp ? 'BEBAS SPP' : 'BAYAR NORMAL'}
                                   </button>
                                </TableCell>
                                <TableCell className="text-right px-6">
                                   <div className="flex flex-wrap justify-end gap-1.5">
                                      {s.sudah_bayar.length > 0 ? s.sudah_bayar.map((jenis: string) => (
                                        <Badge key={jenis} variant="secondary" className="bg-indigo-500/10 text-indigo-700 border-indigo-500/20 font-black text-[9px] uppercase px-2 shadow-none">{jenis}</Badge>
                                      )) : <span className="text-[10px] font-bold text-muted-foreground opacity-20 italic">Belum Ada</span>}
                                      <Button variant="ghost" size="icon" onClick={() => setModalSantri(s)} className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/5 text-indigo-600"><Edit className="w-3 h-3"/></Button>
                                   </div>
                                </TableCell>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </ScrollArea>
              )}
           </Card>

           {/* Detail Fee Dialog */}
           <Dialog open={!!modalSantri} onOpenChange={o => !o && setModalSantri(null)}>
              <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-[2.5rem] animate-in slide-in-from-bottom-10">
                 <DialogHeader className="p-8 bg-muted/30 border-b relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><Banknote className="w-16 h-16"/></div>
                    <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3 relative z-10">
                       <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg"><Info className="w-5 h-5"/></div>
                       Detail Pembebasan
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-indigo-600/60 uppercase tracking-widest mt-2 relative z-10">
                       {modalSantri?.nama_lengkap} <br/> 
                       {modalSantri?.nis} · Anggaran {pbTahun}
                    </DialogDescription>
                 </DialogHeader>
                 
                 <div className="p-6 space-y-4">
                    {JENIS_BIAYA_LIST.map(jenis => {
                      const sudahBebas = modalSantri?.sudah_bayar.includes(jenis)
                      return (
                        <div key={jenis} className={cn(
                           "flex items-center justify-between p-4 rounded-2xl border transition-all",
                           sudahBebas ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30 border-border"
                        )}>
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl border",
                                sudahBebas ? "bg-white text-emerald-600 shadow-sm border-emerald-100" : "bg-background text-muted-foreground opacity-40"
                              )}><Banknote className="w-5 h-5"/></div>
                              <div>
                                 <p className="font-black text-xs uppercase tracking-tight">{jenis}</p>
                                 <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest">Biaya Tahunan</p>
                              </div>
                           </div>
                           <Button 
                              size="sm" 
                              variant={sudahBebas ? "ghost" : "outline"} 
                              onClick={() => sudahBebas ? handleHapusBebas(modalSantri.id, jenis) : handleCatatBebas(modalSantri.id, jenis)}
                              className={cn(
                                "h-9 rounded-xl text-[9px] font-black uppercase tracking-widest px-4 gap-2",
                                sudahBebas ? "text-rose-600 hover:bg-rose-50" : "border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/5"
                              )}
                           >
                              {sudahBebas ? <><X className="w-3.5 h-3.5"/> CABUT</> : <><ShieldCheck className="w-3.5 h-3.5"/> BEBASKAN</>}
                           </Button>
                        </div>
                      )
                    })}
                 </div>

                 <div className="p-4 bg-muted/20 border-t flex items-center justify-between px-8">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 max-w-[200px]">Recording zero-value transaction under administrative supervision.</p>
                    <Button onClick={() => setModalSantri(null)} variant="ghost" className="font-black text-xs uppercase rounded-xl tracking-widest h-10 hover:bg-white">CLOSE</Button>
                 </div>
              </DialogContent>
           </Dialog>

        </div>
      )}

    </div>
  )
}

function Edit(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z" />
    </svg>
  )
}