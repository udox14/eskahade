'use client'

import React, { useState, useEffect } from 'react'
import { getMarhalahList, getKelasList, tambahKelas, hapusKelas, importKelasMassal, getTahunAjaranAktif } from './actions'
import { Trash2, Plus, FileSpreadsheet, Upload, Save, CheckCircle, Download, Database, List, Loader2, CalendarDays, AlertTriangle, Layers, Users, ChevronRight } from 'lucide-react'
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

export default function MasterKelasPage() {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, k, ta] = await Promise.all([getMarhalahList(), getKelasList(), getTahunAjaranAktif()])
    setMarhalahList(m)
    setKelasList(k)
    setTahunAktif(ta)
    setLoading(false)
  }

  const handleTambahManual = async (formData: FormData) => {
    const toastId = toast.loading("Menambahkan kelas...")
    const res = await tambahKelas(formData)
    toast.dismiss(toastId)
    if (res && 'error' in res) {
      toast.error(res.error)
    } else {
      toast.success("Kelas berhasil ditambahkan")
      loadData()
      const form = document.getElementById('form-manual') as HTMLFormElement
      if (form) form.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if(!await confirm("Hapus kelas ini? Data santri di kelas ini akan menjadi tanpa kelas.")) return
    const toastId = toast.loading("Menghapus...")
    const res = await hapusKelas(id)
    toast.dismiss(toastId)
    if (res && 'error' in res) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Kelas dihapus")
      loadData()
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA KELAS": "1-A", "MARHALAH": "Ibtidaiyyah 1", "JENIS KELAMIN": "L" },
      { "NAMA KELAS": "1-B", "MARHALAH": "Ibtidaiyyah 1", "JENIS KELAMIN": "P" },
      { "NAMA KELAS": "2-A", "MARHALAH": "Ibtidaiyyah 2", "JENIS KELAMIN": "C" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:20}, {wch:10}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Kelas")
    XLSX.writeFile(workbook, "Template_Master_Kelas.xlsx")
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      if (typeof bstr === 'string') {
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)
        setExcelData(data)
        toast.success(`Berhasil membaca ${data.length} baris`)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanExcel = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading("Mengimport data...")
    const res = await importKelasMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if (res && 'error' in res) {
      toast.error("Gagal Import", { description: res.error })
    } else {
      toast.success(`Sukses! ${(res as any).count} kelas ditambahkan.`)
      setExcelData([])
      loadData()
      setMode('manual')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <Layers className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Manajemen Kelas</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Pengelolaan Struktur Rombel & Ruangan</p>
          </div>
        </div>

        <div className="flex bg-muted/50 p-1 border rounded-2xl shadow-inner shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setMode('manual')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               mode === 'manual' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <List className="w-3.5 h-3.5 mr-2"/> Daftar & Manual
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setMode('excel')} 
            className={cn(
               "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest px-4",
               mode === 'excel' ? "bg-background text-indigo-600 shadow-sm" : "text-muted-foreground/60"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-2"/> Import Excel
          </Button>
        </div>
      </div>

      {/* BANNER TAHUN AJARAN */}
      {!loading && (tahunAktif ? (
        <Alert className="bg-emerald-500/5 border-emerald-500/20 text-emerald-800 rounded-2xl shadow-sm animate-in slide-in-from-top-2 duration-700">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Tahun Ajaran Aktif: {tahunAktif.nama}</AlertTitle>
          <AlertDescription className="text-[10px] font-bold opacity-70 uppercase tracking-tight">
            Penambahan kelas baru akan otomatis dialokasikan untuk periode akademik berjalan ini.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="bg-rose-500/5 border-rose-500/20 text-rose-800 rounded-2xl shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-black uppercase tracking-widest leading-none mb-1">Peringatan: Tidak Ada Tahun Ajaran Aktif</AlertTitle>
          <AlertDescription className="text-[10px] font-bold opacity-70 uppercase tracking-tight">
            Kelas tidak dapat ditambahkan sebelum tahun ajaran diaktifkan. <Link href="/dashboard/pengaturan/tahun-ajaran" className="underline font-black hover:text-rose-950">Atur Sekarang →</Link>
          </AlertDescription>
        </Alert>
      ))}

      {mode === 'manual' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* FORM TAMBAH */}
          <Card className="border-border shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
            <CardHeader className="bg-muted/30 border-b">
               <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600"/> Registrasi Kelas Baru
               </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
               <form id="form-manual" action={handleTambahManual} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  <div className="md:col-span-4 space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Tingkat (Marhalah)</Label>
                    <Select name="marhalah_id" required>
                       <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold focus:ring-indigo-500">
                          <SelectValue placeholder="Pilih Marhalah"/>
                       </SelectTrigger>
                       <SelectContent>
                          {marhalahList?.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.nama}</SelectItem>)}
                       </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Nama Rombel (Ex: 1-A)</Label>
                    <Input name="nama_kelas" required placeholder="Ex: 2-B" className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"/>
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Sifat Kelas</Label>
                    <Select name="jenis_kelamin" defaultValue="L">
                       <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold focus:ring-indigo-500">
                          <SelectValue placeholder="L/P/C"/>
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="L" className="font-bold">Putra (L)</SelectItem>
                          <SelectItem value="P" className="font-bold">Putri (P)</SelectItem>
                          <SelectItem value="C" className="font-bold">Campuran (C)</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={!tahunAktif} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                      <Save className="w-4 h-4"/> SIMPAN
                    </Button>
                  </div>
               </form>
            </CardContent>
          </Card>

          {/* LIST KELAS */}
          <Card className="border-border shadow-sm overflow-hidden">
             <CardHeader className="bg-muted/30 border-b flex flex-row justify-between items-center py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                   <Database className="w-4 h-4 text-muted-foreground"/> Database Rombongan Belajar
                </CardTitle>
                <Badge variant="secondary" className="bg-background border-border text-[9px] font-black uppercase px-2">{kelasList.length} TOTAL</Badge>
             </CardHeader>
             <div className="overflow-x-auto min-h-[300px]">
                {loading ? (
                   <div className="py-24 flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-50"/>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Synchronizing Class Info...</p>
                   </div>
                ) : kelasList.length === 0 ? (
                   <div className="py-24 text-center opacity-30">
                      <Layers className="w-12 h-12 mx-auto mb-3"/>
                      <p className="text-[10px] font-black uppercase tracking-widest">Belum ada kelas terdaftar</p>
                   </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Rombel</TableHead>
                        <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-center">Tingkat / Marhalah</TableHead>
                        <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-center">Sifat (Gender)</TableHead>
                        <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-right px-8">Control</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kelasList.map((k) => (
                        <TableRow key={k.id} className="hover:bg-indigo-500/[0.03] transition-colors group">
                          <TableCell className="px-6 py-4">
                             <div className="font-black text-indigo-600 text-base tabular-nums">{k.nama_kelas}</div>
                             <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">Class Identifier</div>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                             <div className="font-black text-foreground text-xs uppercase tracking-tight">{k.marhalah?.nama}</div>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                             <Badge variant="outline" className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border-0 bg-secondary/50",
                                k.jenis_kelamin === 'L' ? 'bg-blue-500/10 text-blue-700' : 
                                k.jenis_kelamin === 'P' ? 'bg-pink-500/10 text-pink-700' : 'bg-indigo-500/10 text-indigo-700'
                             )}>
                                {k.jenis_kelamin === 'C' ? 'CAMPURAN' : k.jenis_kelamin === 'L' ? 'IKHWAN (L)' : 'AKHWAT (P)'}
                             </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right pr-8">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleHapus(k.id)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                             >
                                <Trash2 className="w-4 h-4"/>
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
             </div>
          </Card>
        </div>
      ) : (
        /* EXCEL MODE */
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-700">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-indigo-500/[0.02]">
                 <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                       <Download className="w-8 h-8"/>
                    </div>
                    <div className="space-y-1">
                       <h3 className="font-black text-lg uppercase tracking-tight leading-none text-indigo-900">1. Template Data</h3>
                       <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest max-w-[200px]">Siapkan file sesuai format standar sistem</p>
                    </div>
                    <Button onClick={handleDownloadTemplate} variant="outline" className="h-11 rounded-2xl border-indigo-200 text-indigo-700 font-black text-xs uppercase hover:bg-indigo-50 px-8">
                       Download XLSX Template
                    </Button>
                 </CardContent>
              </Card>

              <Card className="border-border shadow-md hover:shadow-xl transition-all group overflow-hidden bg-emerald-500/[0.02]">
                 <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                       <Upload className="w-8 h-8"/>
                    </div>
                    <div className="space-y-1">
                       <h3 className="font-black text-lg uppercase tracking-tight leading-none text-emerald-900">2. Unggah Berkas</h3>
                       <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest max-w-[200px]">Proses massal rombel ke database aktif</p>
                    </div>
                    <div className="relative">
                       <Input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                       <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-10 shadow-lg shadow-emerald-600/10">
                          Pilih File Excel
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
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> Preview Data ({excelData.length} Baris)
                       </CardTitle>
                       <CardDescription className="text-[9px] font-bold uppercase tracking-tighter opacity-60">Pastikan data marhalah sesuai dengan master data tingkat</CardDescription>
                    </div>
                    <Button onClick={handleSimpanExcel} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-11 px-8 shadow-lg shadow-emerald-600/20 gap-2">
                       {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} SIMPAN SEMUA
                    </Button>
                 </CardHeader>
                 <div className="max-h-96 overflow-auto">
                    <Table>
                       <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
                          <TableRow>
                             <TableHead className="text-[10px] font-black uppercase">Nama Kelas</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">Marhalah</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">L/P</TableHead>
                             <TableHead className="text-[10px] font-black uppercase text-center">Status</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {excelData.map((row, i) => (
                             <TableRow key={i}>
                                <TableCell className="font-bold text-xs uppercase">{row['NAMA KELAS'] || row['nama kelas']}</TableCell>
                                <TableCell className="text-xs uppercase opacity-70">{row['MARHALAH'] || row['marhalah']}</TableCell>
                                <TableCell className="text-xs font-bold">{row['JENIS KELAMIN'] || row['jenis kelamin']}</TableCell>
                                <TableCell className="text-center opacity-30"><CheckCircle className="w-4 h-4 mx-auto"/></TableCell>
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