'use client'

import React, { useState, useEffect } from 'react'
import { getDataMaster, importGuruMassal, tambahGuruManual, hapusGuru, hapusGuruMassal, simpanJadwalBatch } from './actions'
import {
  UserCheck, Save, Loader2, School, Search, FileSpreadsheet, Upload,
  Download, List, Briefcase, Plus, Trash2, AlertCircle, CheckSquare,
  Square, Info, Filter, ArrowRight, UserPlus, UserMinus, ShieldCheck,
  CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, Database, Layers, Users
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function ManajemenGuruPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'JADWAL' | 'MASTER'>('JADWAL')

  const [kelasList, setKelasList] = useState<any[]>([])
  const [localKelasList, setLocalKelasList] = useState<any[]>([])

  const [guruList, setGuruList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedGuruIds, setSelectedGuruIds] = useState<string[]>([])
  const [guruSearch, setGuruSearch] = useState("")

  const [loading, setLoading] = useState(true)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [newGuru, setNewGuru] = useState({ nama: '', gelar: '', kode: '' })
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const res = await getDataMaster()
    setKelasList(res.kelasList)
    const mappedLocal = res.kelasList.map((k: any) => ({
      id: k.id,
      nama_kelas: k.nama_kelas,
      s: k.guru_shubuh_id?.toString() || "",
      a: k.guru_ashar_id?.toString() || "",
      m: k.guru_maghrib_id?.toString() || ""
    }))
    setLocalKelasList(mappedLocal)
    setGuruList(res.guruList)
    setSelectedGuruIds([])
    setLoading(false)
  }

  const isGuruBusy = (guruId: string, session: 's' | 'a' | 'm', currentKelasId: string) => {
    if (!guruId) return false
    return localKelasList.some(k => k[session] == guruId && k.id !== currentKelasId)
  }

  const handleChangeLocal = (kelasId: string, session: 's' | 'a' | 'm', guruId: string) => {
    setLocalKelasList(prev => prev.map(k => k.id === kelasId ? { ...k, [session]: guruId } : k))
  }

  const handleSimpanSemua = async () => {
    const changedClasses = localKelasList.filter(local => {
      const asli = kelasList.find(k => k.id === local.id)
      if (!asli) return false
      const asliS = asli.guru_shubuh_id?.toString() || ""
      const asliA = asli.guru_ashar_id?.toString() || ""
      const asliM = asli.guru_maghrib_id?.toString() || ""
      return local.s?.toString() !== asliS || local.a?.toString() !== asliA || local.m?.toString() !== asliM
    })
    if (changedClasses.length === 0) return toast.info("Tidak ada perubahan", { description: "Jadwal pengajar belum ada yang diubah." })
    if (!await confirm(`Konfirmasi Perubahan Jadwal.
    Terdapat ${changedClasses.length} kelas yang akan diperbarui jadwal pengajarnya. Simpan sekarang?`)) return
    
    setIsSavingBatch(true)
    const toastId = toast.loading(`Menyimpan ${changedClasses.length} jadwal...`)
    const payload = changedClasses.map(k => ({
      kelasId: k.id,
      shubuhId: Number(k.s) || 0,
      asharId: Number(k.a) || 0,
      maghribId: Number(k.m) || 0
    }))
    const res = await simpanJadwalBatch(payload)
    setIsSavingBatch(false)
    toast.dismiss(toastId)
    if (res && 'error' in res) {
      toast.error("Gagal", { description: (res as any).error })
    } else { 
      toast.success("Berhasil!", { description: `${(res as any).count} jadwal kelas telah diperbarui.` })
      loadData() 
    }
  }

  const handleTambahGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGuru.nama) return toast.warning("Nama wajib diisi")
    const toastId = toast.loading("Mendaftarkan guru baru...")
    const res = await tambahGuruManual(newGuru.nama, newGuru.gelar, newGuru.kode)
    toast.dismiss(toastId)
    if (res && (res as any).success) { 
      toast.success("Guru berhasil terdaftar")
      setNewGuru({ nama: '', gelar: '', kode: '' })
      loadData() 
    } else {
      toast.error((res as any).error || "Gagal mendaftarkan guru")
    }
  }

  const handleHapusGuru = async (id: string, nama: string) => {
    if (!await confirm(`Hapus permanen data guru ${nama}? Pastikan guru ini tidak sedang terikat pada jadwal mengajar.`)) return
    const res = await hapusGuru(id as any)
    if (res && (res as any).success) { 
      toast.success("Data guru dihapus")
      loadData() 
    } else {
      toast.error((res as any).error || "Gagal menghapus guru")
    }
  }

  const toggleSelectGuru = (id: string) => {
    setSelectedGuruIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const toggleSelectAllGuru = () => {
    if (selectedGuruIds.length === filteredTeachers.length) setSelectedGuruIds([])
    else setSelectedGuruIds(filteredTeachers.map(g => g.id))
  }

  const handleHapusBatch = async () => {
    if (selectedGuruIds.length === 0) return
    if (!await confirm(`Konfirmasi Hapus Massal.
    Yakin ingin menghapus ${selectedGuruIds.length} guru terpilih? Hanya guru yang tidak terikat jadwal yang akan terhapus.`)) return
    
    setIsDeletingBatch(true)
    const toastId = toast.loading("Memproses penghapusan massal...")
    const res = await hapusGuruMassal(selectedGuruIds as any)
    setIsDeletingBatch(false)
    toast.dismiss(toastId)
    if (res && (res as any).success) { 
      toast.success("Selesai!", { description: `${(res as any).count} data guru dibersihkan dari database.` })
      loadData() 
    } else {
      toast.error("Gagal", { description: (res as any).error })
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA LENGKAP": "Ahmad Fulan", "GELAR": "S.Pd.I", "KODE": "AHM" },
      { "NAMA LENGKAP": "Budi Santoso", "GELAR": "M.Ag", "KODE": "BUD" }
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data Guru")
    XLSX.writeFile(wb, "Template_Guru.xlsx")
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      setExcelData(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris data terbaca dari file Excel`)
    } catch { toast.error("File tidak valid atau rusak") }
  }

  const handleSimpanGuru = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading("Mengimport data guru massal...")
    const res = await importGuruMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if (res && 'error' in res) {
      toast.error("Gagal import", { description: (res as any).error })
    } else {
      const skippedMsg = ((res as any).skipped ?? 0) > 0 ? ` (${(res as any).skipped} duplikat diabaikan)` : ''
      toast.success(`Alhamdulillah! ${(res as any).count} guru terdaftar${skippedMsg}`)
      setExcelData([]); loadData(); setTab('JADWAL')
    }
  }

  const filteredLocalKelas = localKelasList.filter(k =>
    k.nama_kelas.toLowerCase().includes(search.toLowerCase())
  )

  const filteredForDropdown = guruSearch
    ? guruList.filter(g => g.nama_lengkap.toLowerCase().includes(guruSearch.toLowerCase()))
    : guruList

  // Pagination Logic for Teacher List in Master Tab
  const filteredTeachers = guruList.filter(g => g.nama_lengkap.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.ceil(filteredTeachers.length / pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages || 1)
  const startIndex = (safePage - 1) * pageSize
  const pagedGuruList = filteredTeachers.slice(startIndex, startIndex + pageSize)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* HEADER & TABS SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Manajemen Asatidzah</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Pengaturan Jadwal Pengajar & Wali Kelas</p>
          </div>
        </div>

        <div className="flex bg-muted/50 p-1 border rounded-2xl shadow-inner shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setTab('JADWAL'); setSearch('') }} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'JADWAL' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <School className="w-3.5 h-3.5 mr-2" /> Jadwal Pengajar
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setTab('MASTER'); setSearch('') }} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'MASTER' ? "bg-background text-emerald-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <UserCheck className="w-3.5 h-3.5 mr-2" /> Database Guru
          </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* TAB 1: JADWAL KELAS */}
      {tab === 'JADWAL' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
           
           <Alert className="bg-indigo-500/5 border-indigo-500/10 text-indigo-800 rounded-2xl shadow-sm">
             <Info className="h-4 w-4 text-indigo-600" />
             <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Mekanisme Wali Kelas</AlertTitle>
             <AlertDescription className="text-[10px] font-bold opacity-70 uppercase tracking-tight leading-relaxed">
               Pengajar yang ditempatkan pada sesi <b>MAGHRIB</b> secara otomatis akan berperan sebagai Wali Kelas 
               dan memiliki akses log-in ke dashboard asatidzah untuk monitoring santri di kelas tersebut.
             </AlertDescription>
           </Alert>

           {/* Filter & Action Bar */}
           <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cari Nama Rombel</Label>
                    <div className="relative group">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors"/>
                       <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik nama kelas..." className="h-11 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"/>
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cari Nama Pengajar</Label>
                    <div className="relative group">
                       <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors"/>
                       <Input value={guruSearch} onChange={e => setGuruSearch(e.target.value)} placeholder="Filter nama di dropdown..." className="h-11 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"/>
                    </div>
                 </div>
              </div>
              <Button 
                onClick={handleSimpanSemua} 
                disabled={isSavingBatch || loading} 
                className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-3 transition-transform active:scale-95 shrink-0"
              >
                {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                SIMPAN SEMUA JADWAL
              </Button>
           </div>

           {/* JADWAL TABLE */}
           <Card className="border-border shadow-sm overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto">
                 <Table>
                    <TableHeader className="bg-muted/30 border-b">
                       <TableRow>
                          <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Rombongan Belajar</TableHead>
                          <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest">Sesi Shubuh</TableHead>
                          <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest">Sesi Ashar</TableHead>
                          <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest bg-amber-500/5 text-amber-900 border-l border-amber-500/10">Sesi Maghrib (Wali Kelas)</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {loading ? (
                         <TableRow>
                            <TableCell colSpan={4} className="py-32 text-center">
                               <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50 mx-auto mb-3"/>
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Synchronizing Schedules...</p>
                            </TableCell>
                         </TableRow>
                       ) : filteredLocalKelas.length === 0 ? (
                         <TableRow>
                            <TableCell colSpan={4} className="py-24 text-center opacity-30">
                               <Layers className="w-12 h-12 mx-auto mb-3"/>
                               <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada kelas ditemukan</p>
                            </TableCell>
                         </TableRow>
                       ) : filteredLocalKelas.map(k => (
                         <TableRow key={k.id} className="hover:bg-indigo-500/[0.02] transition-colors border-b last:border-0">
                            <TableCell className="px-6 py-4">
                               <div className="font-black text-indigo-600 text-sm tracking-tight uppercase">{k.nama_kelas}</div>
                               <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 mt-0.5">Primary Classroom</div>
                            </TableCell>
                            <TableCell className="px-4 py-4 min-w-[220px]">
                               <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[8px] font-black text-muted-foreground/40 uppercase mb-0.5 px-1 truncate">Shubuh Session</div>
                                  <Select value={k.s} onValueChange={v => handleChangeLocal(k.id, 's', v)}>
                                     <SelectTrigger className="h-10 bg-background border-border rounded-xl font-bold text-xs">
                                        <SelectValue placeholder="— Tanpa Pengajar —" />
                                     </SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="0" className="opacity-40 italic">Tanpa Pengajar</SelectItem>
                                        {filteredForDropdown.map((g: any) => isGuruBusy(g.id, 's', k.id) ? null : (
                                          <SelectItem key={g.id} value={g.id.toString()} className="font-bold">{g.nama_lengkap}</SelectItem>
                                        ))}
                                     </SelectContent>
                                  </Select>
                               </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 min-w-[220px]">
                               <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[8px] font-black text-muted-foreground/40 uppercase mb-0.5 px-1">Ashar Session</div>
                                  <Select value={k.a} onValueChange={v => handleChangeLocal(k.id, 'a', v)}>
                                     <SelectTrigger className="h-10 bg-background border-border rounded-xl font-bold text-xs">
                                        <SelectValue placeholder="— Tanpa Pengajar —" />
                                     </SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="0" className="opacity-40 italic">Tanpa Pengajar</SelectItem>
                                        {filteredForDropdown.map((g: any) => isGuruBusy(g.id, 'a', k.id) ? null : (
                                          <SelectItem key={g.id} value={g.id.toString()} className="font-bold">{g.nama_lengkap}</SelectItem>
                                        ))}
                                     </SelectContent>
                                  </Select>
                               </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 min-w-[240px] bg-amber-500/[0.02] border-l border-amber-500/10">
                               <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[8px] font-black text-amber-700/50 uppercase mb-0.5 px-1">Maghrib (Wali Kelas)</div>
                                  <Select value={k.m} onValueChange={v => handleChangeLocal(k.id, 'm', v)}>
                                     <SelectTrigger className="h-10 bg-white border-amber-500/30 rounded-xl font-black text-xs text-indigo-900 shadow-sm focus:ring-amber-500">
                                        <SelectValue placeholder="— Belum Ditentukan —" />
                                     </SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="0" className="opacity-40 italic">Tanpa Wali Kelas</SelectItem>
                                        {filteredForDropdown.map((g: any) => isGuruBusy(g.id, 'm', k.id) ? null : (
                                          <SelectItem key={g.id} value={g.id.toString()} className="font-bold text-indigo-700">{g.nama_lengkap}</SelectItem>
                                        ))}
                                     </SelectContent>
                                  </Select>
                                  {k.m !== "" && k.m !== "0" && (
                                     <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 animate-in zoom-in-95 duration-500">
                                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600"/>
                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Akses Dashboard Wali Aktif</span>
                                     </div>
                                  )}
                               </div>
                            </TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                 </Table>
              </div>
           </Card>
        </div>
      )}

      {/* TAB 2: MASTER GURU */}
      {tab === 'MASTER' && (
        <div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
           
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Manual Input Form */}
              <div className="lg:col-span-4">
                 <Card className="border-border shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
                    <CardHeader className="bg-muted/30 border-b">
                       <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-emerald-600"/> Registrasi Guru Baru
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                       <form onSubmit={handleTambahGuru} className="space-y-4">
                          <div className="space-y-1.5">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nama Lengkap</Label>
                             <Input 
                                value={newGuru.nama} 
                                onChange={e => setNewGuru({ ...newGuru, nama: e.target.value })} 
                                placeholder="Ahmad Bin Fulan" 
                                className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-emerald-500" 
                                required 
                             />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Gelar (S.Pd, dsb)</Label>
                                <Input value={newGuru.gelar} onChange={e => setNewGuru({ ...newGuru, gelar: e.target.value })} placeholder="S.Pd.I" className="h-11 rounded-xl bg-muted/20 border-border font-bold"/>
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Kode / Inisial</Label>
                                <Input value={newGuru.kode} onChange={e => setNewGuru({ ...newGuru, kode: e.target.value })} placeholder="AHM" className="h-11 rounded-xl bg-muted/20 border-border font-bold uppercase"/>
                             </div>
                          </div>
                          <Button className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/20 gap-2 mt-2">
                             <CheckCircle2 className="w-4 h-4"/> TAMBAHKAN DATA
                          </Button>
                       </form>
                    </CardContent>
                 </Card>

                 <div className="mt-6 bg-emerald-700 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
                    <UserCheck className="w-10 h-10 mb-4 opacity-50"/>
                    <h4 className="font-black text-sm uppercase tracking-tight">Standardisasi ID Guru</h4>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1 leading-relaxed">Pastikan kode atau inisial tidak duplikat dengan guru lain untuk kemudahan identifikasi di jadwal.</p>
                 </div>
              </div>

              {/* Excel Import Prompts */}
              <div className="lg:col-span-8 space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-indigo-500/[0.02] cursor-pointer" onClick={handleDownloadTemplate}>
                       <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                             <Download className="w-7 h-7"/>
                          </div>
                          <div className="space-y-1">
                             <h3 className="font-black text-base uppercase tracking-tight text-indigo-900">1. Unduh Template</h3>
                             <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Dapatkan berkas standar .xlsx</p>
                          </div>
                       </CardContent>
                    </Card>

                    <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-emerald-500/[0.02]">
                       <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                             <Upload className="w-7 h-7"/>
                          </div>
                          <div className="space-y-1">
                             <h3 className="font-black text-base uppercase tracking-tight text-emerald-900">2. Unggah Berkas</h3>
                             <div className="relative mt-2">
                                <input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <Badge variant="outline" className="text-emerald-600 font-black text-[9px] uppercase border-emerald-500/30">Pilih Excel File</Badge>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                 </div>

                 {excelData.length > 0 && (
                    <Card className="border-emerald-500/20 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                       <CardHeader className="p-5 border-b bg-emerald-500/5 flex flex-row justify-between items-center">
                          <div className="space-y-1">
                             <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> Preview Impor ({excelData.length} Baris)
                             </CardTitle>
                             <CardDescription className="text-[9px] font-black uppercase text-emerald-700/60 tracking-wider">
                                {excelData.length - excelData.filter(d => guruList.some(g => g.nama_lengkap.toLowerCase() === String(d['NAMA LENGKAP'] || d['NAMA']).toLowerCase().trim())).length} Baru terdeteksi
                             </CardDescription>
                          </div>
                          <Button onClick={handleSimpanGuru} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-10 px-8 shadow-lg shadow-emerald-600/20 gap-2">
                             {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} SIMPAN SEMUA
                          </Button>
                       </CardHeader>
                       <div className="max-h-64 overflow-auto">
                          <Table>
                             <TableHeader className="bg-muted/10 sticky top-0 z-10 border-b">
                                <TableRow>
                                   <TableHead className="text-[10px] font-black uppercase">Nama Guru</TableHead>
                                   <TableHead className="text-[10px] font-black uppercase">Gelar</TableHead>
                                   <TableHead className="text-[10px] font-black uppercase text-center">Status</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {excelData.map((d, i) => {
                                  const nama = String(d['NAMA LENGKAP'] || d['NAMA'] || d['nama'] || '').trim()
                                  const isDuplikat = guruList.some(g => g.nama_lengkap.toLowerCase() === nama.toLowerCase())
                                  return (
                                     <TableRow key={i} className={cn(isDuplikat ? "bg-rose-500/[0.03]" : "hover:bg-muted/30")}>
                                        <TableCell className={cn("text-xs font-bold uppercase", isDuplikat ? "text-rose-500 line-through" : "text-foreground")}>{nama}</TableCell>
                                        <TableCell className="text-xs opacity-50">{d['GELAR'] || d['gelar'] || '-'}</TableCell>
                                        <TableCell className="text-center">
                                           {isDuplikat ? <Badge variant="outline" className="text-rose-600 border-rose-200 text-[9px] font-black">DUPLIKAT</Badge> : <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-600 opacity-30"/>}
                                        </TableCell>
                                     </TableRow>
                                  )
                                })}
                             </TableBody>
                          </Table>
                       </div>
                    </Card>
                 )}
              </div>
           </div>

           {/* TEACHER LIST & BULK DELETE */}
           <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                       <Database className="w-4 h-4 text-muted-foreground"/> Database Guru Terdaftar ({guruList.length})
                    </CardTitle>
                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-1">Gunakan checkbox untuk aksi penghapusan massal data pengajar.</CardDescription>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="relative group w-full sm:w-64">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors pointer-events-none"/>
                       <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Cari di database..." className="h-10 pl-9 rounded-xl border-border bg-background font-bold text-xs focus-visible:ring-emerald-500"/>
                    </div>
                    {selectedGuruIds.length > 0 && (
                       <Button onClick={handleHapusBatch} disabled={isDeletingBatch} className="h-10 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase shadow-lg shadow-rose-600/20 gap-2">
                          {isDeletingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          HAPUS ({selectedGuruIds.length})
                       </Button>
                    )}
                 </div>
              </CardHeader>
              
              <div className="p-6">
                 <div className="flex items-center gap-3 mb-6 bg-muted/20 p-3 rounded-2xl border border-dashed">
                    <button onClick={toggleSelectAllGuru} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-indigo-600 transition-colors">
                       {selectedGuruIds.length === filteredTeachers.length && filteredTeachers.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600"/> : <Square className="w-4 h-4"/>}
                       PILIH SEMUA DATA DIHALAMAN INI
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pagedGuruList.length === 0 ? (
                       <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center">
                          <Users className="w-12 h-12 mb-3"/>
                          <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada guru ditemukan</p>
                       </div>
                    ) : pagedGuruList.map(g => (
                       <Card 
                          key={g.id} 
                          onClick={() => toggleSelectGuru(g.id)}
                          className={cn(
                             "cursor-pointer group relative transition-all duration-300 border-border overflow-hidden",
                             selectedGuruIds.includes(g.id) ? "bg-rose-500/[0.03] border-rose-300 ring-1 ring-rose-500/20 shadow-rose-500/5 shadow-lg" : "hover:shadow-md hover:border-indigo-200"
                          )}
                       >
                          <CardContent className="p-4 flex items-center gap-4">
                             <div className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all",
                                selectedGuruIds.includes(g.id) ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground group-hover:bg-indigo-600 group-hover:text-white"
                             )}>
                                {g.nama_lengkap.split(' ').map((n: string)=>n[0]).slice(0,2).join('')}
                             </div>
                             <div className="min-w-0 flex-1">
                                <p className={cn("font-black text-sm tracking-tight uppercase truncate leading-none mb-1", selectedGuruIds.includes(g.id) ? "text-rose-700" : "text-foreground group-hover:text-indigo-700")}>{g.nama_lengkap}</p>
                                <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40 truncate tracking-widest leading-none">{g.gelar || '-'}</p>
                             </div>
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); handleHapusGuru(g.id, g.nama_lengkap) }} 
                                className="h-8 w-8 rounded-lg text-muted-foreground/30 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0 opacity-0 group-hover:opacity-100"
                             >
                                <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                             {selectedGuruIds.includes(g.id) && (
                                <div className="absolute top-1 right-1"><CheckSquare className="w-3 h-3 text-rose-500"/></div>
                             )}
                          </CardContent>
                       </Card>
                    ))}
                 </div>
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                 <div className="p-6 bg-muted/10 border-t flex flex-col sm:flex-row justify-between items-center gap-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                       Laman {safePage} dari {totalPages} · Total {filteredTeachers.length} Guru
                    </p>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="h-9 rounded-xl text-[10px] font-black uppercase px-4 border-border shadow-none">Prev</Button>
                       <div className="flex gap-1">
                          {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                             let pg = i + 1;
                             if (totalPages > 5 && page > 3) pg = page - 2 + i;
                             if (totalPages > 5 && page > totalPages - 2) pg = totalPages - 4 + i;
                             if (pg > totalPages) return null;
                             return (
                                <Button 
                                   key={pg} 
                                   variant={pg === page ? 'default' : 'ghost'} 
                                   onClick={() => setPage(pg)}
                                   className={cn("w-9 h-9 rounded-xl font-black text-xs", pg === page ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "")}
                                >
                                   {pg}
                                </Button>
                             )
                          })}
                       </div>
                       <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="h-9 rounded-xl text-[10px] font-black uppercase px-4 border-border shadow-none">Next</Button>
                    </div>
                 </div>
              )}
           </Card>
        </div>
      )}

    </div>
  )
}