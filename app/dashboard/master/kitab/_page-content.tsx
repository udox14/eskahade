'use client'

import React, { useState, useEffect } from 'react'
import { getMarhalahList, getMapelList, getKitabList, tambahKitab, hapusKitab, importKitabMassal, updateHargaKitab, getTahunAjaranAktif } from './actions'
import { Book, Plus, Trash2, Save, FileSpreadsheet, Download, Upload, CheckCircle, Loader2, Edit, List, CalendarDays, AlertTriangle, Search, BookOpen, Layers, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function MasterKitabPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'LIST' | 'IMPORT'>('LIST')
  
  // Data
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [kitabList, setKitabList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filter List
  const [filterMarhalah, setFilterMarhalah] = useState('SEMUA')

  // State Import
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // State Edit Harga
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState('')

  useEffect(() => {
    initData()
  }, [])

  useEffect(() => {
    loadKitab()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMarhalah]) 

  const initData = async () => {
    const [m, mp, ta] = await Promise.all([getMarhalahList(), getMapelList(), getTahunAjaranAktif()])
    setMarhalahList(m)
    setMapelList(mp)
    setTahunAktif(ta)
  }

  const loadKitab = async () => {
    setLoading(true)
    const res = await getKitabList(filterMarhalah === 'SEMUA' ? '' : filterMarhalah)
    setKitabList(res)
    setLoading(false)
  }

  // --- HANDLER MANUAL ---
  const handleTambah = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const toastId = toast.loading("Menambahkan kitab...")
    
    const res = await tambahKitab(formData)
    toast.dismiss(toastId)

    if (res && 'error' in res) {
        toast.error(res.error)
    } else {
        toast.success("Kitab berhasil ditambahkan")
        loadKitab()
        e.currentTarget.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if(!await confirm("Hapus kitab ini? Data transaksi terkait mungkin terdampak.")) return
    const toastId = toast.loading("Menghapus...")
    await hapusKitab(id)
    toast.dismiss(toastId)
    toast.success("Data kitab dihapus")
    loadKitab()
  }

  const handleUpdateHarga = async (id: string) => {
    const harga = parseInt(editHarga)
    if (isNaN(harga)) return toast.warning("Harga tidak valid")
    
    const res = await updateHargaKitab(id, harga)
    if (res && (res as any).success) {
        toast.success("Harga berhasil diperbarui")
        setEditingId(null)
        loadKitab()
    } else {
        toast.error((res as any).error || "Gagal update harga")
    }
  }

  // --- HANDLER EXCEL ---
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
       { "NAMA KITAB": "Jurumiyah", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Nahwu", "HARGA": 15000 },
       { "NAMA KITAB": "Kailani", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Shorof", "HARGA": 12000 }
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master Kitab")
    XLSX.writeFile(wb, "Template_Kitab.xlsx")
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setExcelData(JSON.parse(JSON.stringify(data)))
      toast.success(`Berhasil memuat ${data.length} baris data`)
    } catch {
      toast.error("Format file tidak didukung atau rusak")
    }
  }

  const handleSimpanImport = async () => {
    if(excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading("Memproses import massal...")
    const res = await importKitabMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    
    if (res && (res as any).success) {
        toast.success(`Alhamdulillah! ${(res as any).count} kitab terimport`)
        setExcelData([])
        setTab('LIST')
        loadKitab()
    } else {
        toast.error((res as any).error || "Gagal import data")
    }
  }

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(kitabList.length / pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages || 1)
  const startIndex = (safePage - 1) * pageSize
  const pagedList = kitabList.slice(startIndex, startIndex + pageSize)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
            <BookOpen className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Master Kitab & UPK</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Manajemen Inventaris Kitab Kuning Pesantren</p>
          </div>
        </div>

        <div className="flex bg-muted/50 p-1 border rounded-2xl shadow-inner shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setTab('LIST')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'LIST' ? "bg-background text-emerald-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <List className="w-3.5 h-3.5 mr-2"/> Daftar Kitab
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setTab('IMPORT')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               tab === 'IMPORT' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2"/> Import Massal
          </Button>
        </div>
      </div>

      {/* BANNER TAHUN AJARAN */}
      {!loading && (tahunAktif ? (
        <Alert className="bg-emerald-500/5 border-emerald-500/20 text-emerald-800 rounded-2xl shadow-sm animate-in slide-in-from-top-2 duration-700">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Tahun Ajaran Aktif: {tahunAktif.nama}</AlertTitle>
          <AlertDescription className="text-[10px] font-bold opacity-70 uppercase tracking-tight">
            Database kitab yang ditampilkan dan ditambahkan dialirkan untuk periode akademik berjalan ini.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="bg-rose-500/5 border-rose-500/20 text-rose-800 rounded-2xl shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Peringatan: Tidak Ada Tahun Ajaran Aktif</AlertTitle>
          <AlertDescription className="text-[10px] font-bold opacity-70 uppercase tracking-tight">
            Penambahan data kitab baru tidak diizinkan sebelum tahun ajaran diaktifkan. <Link href="/dashboard/pengaturan/tahun-ajaran" className="underline font-black">Atur Sekarang →</Link>
          </AlertDescription>
        </Alert>
      ))}

      {tab === 'LIST' ? (
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-6 duration-700">
            
            {/* FORM INPUT MANUAL */}
            <div className="lg:col-span-4 lg:order-1">
               <Card className="border-border shadow-xl overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
                  <CardHeader className="bg-muted/30 border-b">
                     <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-600"/> Registrasi Kitab
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                     <form onSubmit={handleTambah} className="space-y-5">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Nama Kitab</Label>
                           <Input name="nama_kitab" required placeholder="Ex: Matan Jurumiyah" className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-emerald-500"/>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Tingkat (Marhalah)</Label>
                           <Select name="marhalah_id" required>
                              <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                                 <SelectValue placeholder="Pilih Marhalah"/>
                              </SelectTrigger>
                              <SelectContent>
                                 {marhalahList.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.nama}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Mata Pelajaran (Kategori)</Label>
                           <Select name="mapel_id" required>
                              <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                                 <SelectValue placeholder="Pilih Mapel"/>
                              </SelectTrigger>
                              <SelectContent>
                                 {mapelList.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.nama}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Harga Jual (UPK) Rp</Label>
                           <Input name="harga" type="number" required placeholder="0" className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-emerald-500"/>
                        </div>
                        <Button disabled={!tahunAktif} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/20 gap-2">
                           <Save className="w-4 h-4"/> SIMPAN DATA
                        </Button>
                     </form>
                  </CardContent>
               </Card>
            </div>

            {/* TABEL LIST */}
            <div className="lg:col-span-8 space-y-4">
                <Card className="border-border shadow-sm overflow-hidden">
                    <div className="p-4 bg-muted/30 border-b flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 group">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors pointer-events-none"/>
                           <Select value={filterMarhalah} onValueChange={(v) => setFilterMarhalah(v ?? 'SEMUA')}>
                              <SelectTrigger className="pl-10 h-10 bg-background border-border rounded-xl font-bold text-xs">
                                 <SelectValue placeholder="Filter Marhalah"/>
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="SEMUA" className="font-bold">Semua Marhalah</SelectItem>
                                 {marhalahList.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.nama}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Tampilkan</span>
                           <Select value={String(pageSize)} onValueChange={v => {setPageSize(Number(v)); setPage(1)}}>
                              <SelectTrigger className="w-20 h-10 bg-background border-border rounded-xl font-bold text-xs">
                                 <SelectValue/>
                              </SelectTrigger>
                              <SelectContent>
                                 {[10, 20, 50, 100].map(s => <SelectItem key={s} value={String(s)} className="font-bold">{s}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                    </div>

                    <div className="min-h-[400px]">
                        <Table>
                           <TableHeader className="bg-muted/10">
                              <TableRow>
                                 <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Detail Kitab</TableHead>
                                 <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-right">Harga (UPK)</TableHead>
                                 <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-right px-8">Aksi</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {loading ? (
                                 <TableRow>
                                    <TableCell colSpan={3} className="py-32 text-center">
                                       <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50 mx-auto mb-3"/>
                                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Fetching Library...</p>
                                    </TableCell>
                                 </TableRow>
                              ) : pagedList.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={3} className="py-32 text-center opacity-30">
                                       <Book className="w-12 h-12 mx-auto mb-3"/>
                                       <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada kitab di kategori ini</p>
                                    </TableCell>
                                 </TableRow>
                              ) : (
                                 pagedList.map((k) => (
                                    <TableRow key={k.id} className="hover:bg-emerald-500/[0.03] transition-colors group">
                                       <TableCell className="px-6 py-4">
                                          <div className="font-black text-foreground text-sm tracking-tight uppercase">{k.nama_kitab}</div>
                                          <div className="flex items-center gap-1.5 mt-1">
                                             <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-2 h-4 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">{k.mapel?.nama}</Badge>
                                             <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">{k.marhalah?.nama}</span>
                                          </div>
                                       </TableCell>
                                       <TableCell className="px-6 py-4 text-right">
                                           {editingId === k.id ? (
                                             <div className="flex items-center justify-end gap-1 animate-in zoom-in-95 duration-200">
                                                <Input 
                                                   autoFocus
                                                   className="h-8 w-24 text-right font-black text-xs border-indigo-500 focus-visible:ring-indigo-500"
                                                   value={editHarga}
                                                   onChange={e => setEditHarga(e.target.value)}
                                                   onKeyDown={e => {
                                                      if(e.key === 'Enter') handleUpdateHarga(k.id)
                                                      if(e.key === 'Escape') setEditingId(null)
                                                   }}
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleUpdateHarga(k.id)}><Check className="w-4 h-4"/></Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500" onClick={() => setEditingId(null)}><X className="w-4 h-4"/></Button>
                                             </div>
                                           ) : (
                                              <button 
                                                onClick={() => { setEditingId(k.id); setEditHarga(k.harga.toString()); }}
                                                className="group/btn text-right hover:scale-105 transition-transform"
                                              >
                                                <div className="text-sm font-black text-emerald-700 tabular-nums">Rp {k.harga.toLocaleString('id-ID')}</div>
                                                <div className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover/btn:opacity-50 text-indigo-600">Klik untuk ubah</div>
                                              </button>
                                           )}
                                       </TableCell>
                                       <TableCell className="px-6 py-4 text-right pr-8">
                                           <div className="flex justify-end items-center gap-1">
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  onClick={() => { setEditingId(k.id); setEditHarga(k.harga.toString()); }}
                                                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                              >
                                                  <Edit className="w-4 h-4"/>
                                              </Button>
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  onClick={() => handleHapus(k.id)}
                                                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                              >
                                                  <Trash2 className="w-4 h-4"/>
                                              </Button>
                                           </div>
                                       </TableCell>
                                    </TableRow>
                                 ))
                              )}
                           </TableBody>
                        </Table>
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                       <div className="p-4 bg-muted/20 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Showing {startIndex + 1} to {Math.min(startIndex + pageSize, kitabList.length)} of {kitabList.length} items</p>
                          <div className="flex items-center gap-2">
                             <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="h-8 rounded-lg text-[10px] font-black uppercase">Prev</Button>
                             <div className="text-[10px] font-black px-4">{page} / {totalPages}</div>
                             <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="h-8 rounded-lg text-[10px] font-black uppercase">Next</Button>
                          </div>
                       </div>
                    )}
                </Card>
            </div>
         </div>
      ) : (
         /* TAB IMPORT */
         <div className="space-y-8 animate-in slide-in-from-right-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-indigo-500/[0.02]">
                 <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                       <Download className="w-8 h-8"/>
                    </div>
                    <div className="space-y-1">
                       <h3 className="font-black text-lg uppercase tracking-tight leading-none text-indigo-900">1. Unduh Template</h3>
                       <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest max-w-[200px]">Format Excel standar untuk database kitab</p>
                    </div>
                    <Button onClick={downloadTemplate} variant="outline" className="h-11 rounded-2xl border-indigo-200 text-indigo-700 font-black text-xs uppercase hover:bg-indigo-50 px-8">
                       Get XLSX Template
                    </Button>
                 </CardContent>
              </Card>

              <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-emerald-500/[0.02]">
                 <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                       <Upload className="w-8 h-8"/>
                    </div>
                    <div className="space-y-1">
                       <h3 className="font-black text-lg uppercase tracking-tight leading-none text-emerald-900">2. Unggah Berkas</h3>
                       <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest max-w-[200px]">Impor data massal ke tahun ajaran aktif</p>
                    </div>
                    <div className="relative">
                       <input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                       <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-10 shadow-lg shadow-emerald-600/10">
                          Select Excel File
                       </Button>
                    </div>
                 </CardContent>
              </Card>
            </div>

            {excelData.length > 0 && (
                <Card className="border-emerald-500/20 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                    <CardHeader className="p-6 border-b bg-emerald-500/5 flex flex-row justify-between items-center">
                       <div>
                          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                             <CheckCircle className="w-4 h-4 text-emerald-600"/> Review Impor ({excelData.length} Kitab)
                          </CardTitle>
                          <CardDescription className="text-[9px] font-bold uppercase tracking-tighter opacity-60">Pastikan nama marhalah dan mapel sesuai referensi system</CardDescription>
                       </div>
                       <Button onClick={handleSimpanImport} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-11 px-8 shadow-lg shadow-emerald-600/20 gap-2">
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} IMPORT SEMUA
                       </Button>
                    </CardHeader>
                    <div className="max-h-[500px] overflow-auto">
                        <Table>
                           <TableHeader className="sticky top-0 bg-background z-20 shadow-sm border-b">
                              <TableRow>
                                 <TableHead className="text-[10px] font-black uppercase px-6">Nama Kitab</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase px-6">Marhalah</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase px-6 text-right">Harga (UPK)</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {excelData.map((d, i) => (
                                 <TableRow key={i}>
                                    <TableCell className="px-6 py-3 font-bold text-xs uppercase">{d['NAMA KITAB'] || d['nama kitab']}</TableCell>
                                    <TableCell className="px-6 py-3 text-xs uppercase opacity-70">{d['MARHALAH'] || d['marhalah']}</TableCell>
                                    <TableCell className="px-6 py-3 text-right font-black text-indigo-600 tabular-nums text-xs">Rp {(d['HARGA'] || d['harga'] || 0).toLocaleString('id-ID')}</TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                    </div>
                </Card>
            )}
         </div>
      )}
    </div>
  )
}