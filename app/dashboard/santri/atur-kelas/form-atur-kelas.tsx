'use client'

import { useState } from 'react'
import { simpanSantriKeKelas, simpanPenempatanBatch } from './actions'
import { Save, Search, CheckSquare, FileSpreadsheet, Upload, AlertCircle, CheckCircle, Download, Loader2, AlertTriangle, ChevronRight, User } from 'lucide-react'
import { toast } from 'sonner' 
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'

export function FormAturKelas({ kelasList, santriList }: { kelasList: any[], santriList: any[] }) {
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')

  // --- STATE MANUAL ---
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSantri, setSelectedSantri] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // --- STATE EXCEL ---
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [showConfirmExcel, setShowConfirmExcel] = useState(false)

  // LOGIC MANUAL
  const filteredSantri = santriList.filter(s => 
    s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || 
    s.nis.includes(search) ||
    (s.rekomendasi && s.rekomendasi.toLowerCase().includes(search.toLowerCase()))
  )

  const handleToggle = (id: string) => {
    if (selectedSantri.includes(id)) {
      setSelectedSantri(selectedSantri.filter(x => x !== id))
    } else {
      setSelectedSantri([...selectedSantri, id])
    }
  }

  const handleSelectAll = () => {
    const ids = filteredSantri.map(s => s.id)
    const allSelected = ids.every(id => selectedSantri.includes(id))
    if (allSelected) {
      setSelectedSantri(selectedSantri.filter(id => !ids.includes(id)))
    } else {
      setSelectedSantri([...new Set([...selectedSantri, ...ids])])
    }
  }

  const handleSimpanManual = async () => {
    if (!selectedKelas) {
      toast.warning("Pilih kelas tujuan dulu!")
      return
    }
    if (selectedSantri.length === 0) {
      toast.warning("Pilih minimal satu santri!")
      return
    }

    setLoading(true)
    const toastId = toast.loading("Menyimpan data kelas...")

    const res = await simpanSantriKeKelas(selectedKelas, selectedSantri)
    
    setLoading(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Berhasil!", { description: `${selectedSantri.length} santri berhasil dimasukkan ke kelas.` })
      setSelectedSantri([]) 
    }
  }

  // LOGIC EXCEL (DYNAMIC IMPORT)
  const handleDownloadTemplate = async () => {
    if (santriList.length === 0) {
      toast.info("Tidak ada data santri yang perlu ditempatkan.")
      return
    }

    const loadToast = toast.loading("Menyiapkan template...")
    
    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const rows = santriList.map(s => ({
      NIS: s.nis,
      "NAMA SANTRI": s.nama_lengkap,
      "REKOMENDASI TES": s.rekomendasi || "Belum Tes",
      "TARGET KELAS": "" 
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:30}, {wch:30}, {wch:20}]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Penempatan Kelas")
    XLSX.writeFile(workbook, "Template_Penempatan_Kelas_Rekomendasi.xlsx")
    
    toast.dismiss(loadToast)
    toast.success("Template Excel berhasil didownload")
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading("Membaca file...")
    
    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(ws)
        
        const mappedData = rawData.map((row: any) => {
          const nis = String(row['NIS'] || row['nis']).trim()
          const namaKelas = String(row['TARGET KELAS'] || row['target kelas']).trim()

          const santri = santriList.find(s => s.nis === nis)
          const kelas = kelasList.find(k => k.nama_kelas.toLowerCase() === namaKelas.toLowerCase())

          return {
            nis,
            nama: row['NAMA SANTRI'],
            rekomendasi: row['REKOMENDASI TES'],
            target_kelas_nama: namaKelas,
            santri_id: santri?.id,
            kelas_id: kelas?.id,
            isValid: !!santri?.id && !!kelas?.id
          }
        })

        setExcelData(mappedData)
        toast.dismiss(toastId)
        toast.success(`Berhasil membaca ${mappedData.length} baris data`)
      } catch (err) {
        toast.dismiss(toastId)
        toast.error("File Excel tidak valid")
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanExcel = async () => {
    setShowConfirmExcel(false) // Close modal
    setIsProcessingExcel(true)
    const toastId = toast.loading("Memproses penempatan massal...")
    
    const validData = excelData.filter(d => d.isValid).map(d => ({
      santri_id: d.santri_id,
      kelas_id: d.kelas_id
    }))

    const res = await simpanPenempatanBatch(validData)
    
    setIsProcessingExcel(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Import Berhasil", { description: `${res.count} santri telah ditempatkan di kelas baru.` })
      setExcelData([])
    }
  }

  const triggerSimpanExcel = () => {
    const validCount = excelData.filter(d => d.isValid).length
    if (validCount === 0) {
      toast.warning("Tidak ada data valid untuk disimpan.")
      return
    }
    setShowConfirmExcel(true)
  }

  return (
    <div className="space-y-6">
      
      {/* TAB SWITCHER */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'excel')} className="w-full">
        <TabsList className="w-full grid grid-cols-2 p-1 bg-muted/60 rounded-xl h-11 mb-6 border border-border">
          <TabsTrigger value="manual" className="font-black rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CheckSquare className="w-4 h-4"/> Manual
          </TabsTrigger>
          <TabsTrigger value="excel" className="font-black rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileSpreadsheet className="w-4 h-4"/> Import Excel
          </TabsTrigger>
        </TabsList>

        {/* --- MODE MANUAL --- */}
        <TabsContent value="manual" className="space-y-6 mt-2 outline-none animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Pilih Kelas */}
            <div className="bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10 space-y-3">
              <label className="text-[10px] font-black text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-[0.2em] block">
                Langkah 1: Pilih Kelas Tujuan
              </label>
              <Select value={selectedKelas} onValueChange={(v) => setSelectedKelas(v ?? '')}>
                <SelectTrigger className="w-full h-11 bg-background border-border rounded-xl font-bold focus:ring-indigo-500">
                  <SelectValue placeholder="Pilih Kelas Tujuan"/>
                </SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={k.id} className="font-bold">{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Ringkasan */}
            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 flex flex-col justify-center">
              <label className="text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-[0.2em] block mb-2">
                Ringkasan Penempatan
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-foreground tabular-nums">{selectedSantri.length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Santri Terpilih</p>
                </div>
                <Button
                  onClick={handleSimpanManual}
                  disabled={loading || selectedSantri.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 h-11 rounded-xl shadow-lg shadow-indigo-500/20 gap-2 transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                  Simpan Data
                </Button>
              </div>
            </div>
          </div>

          {/* List Pemilihan Santri */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Langkah 2: Pilih Santri dari Daftar
              </label>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline"
                  onClick={handleSelectAll}
                  className="h-10 text-xs font-black rounded-xl border-border px-4 shadow-sm"
                >
                  Pilih Semua
                </Button>

                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Cari nama atau grade..." 
                    className="pl-9 h-10 text-sm border-border rounded-xl focus:ring-indigo-500 w-full sm:w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSantri.length === 0 ? (
                <div className="col-span-full py-20 text-center text-muted-foreground italic bg-muted/20 border border-dashed rounded-2xl">
                  Tidak ada santri yang cocok dengan pencarian.
                </div>
              ) : (
                filteredSantri.map((s) => (
                  <Card 
                    key={s.id} 
                    onClick={() => handleToggle(s.id)}
                    className={cn(
                      "group p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-200 active:scale-[0.98] shadow-sm",
                      selectedSantri.includes(s.id) 
                        ? 'bg-indigo-500/5 border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10' 
                        : 'bg-card border-border hover:border-indigo-400/50 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0",
                        selectedSantri.includes(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-border bg-muted/50'
                      )}>
                        {selectedSantri.includes(s.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{s.nama_lengkap}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.nis}</p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {s.rekomendasi ? (
                        <Badge variant="outline" className={cn(
                          'text-[9px] font-black border-transparent shadow-none px-2 h-5 rounded-lg',
                          s.rekomendasi.includes('Grade A') ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400' :
                          s.rekomendasi.includes('Tamhidiyyah') ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400' :
                          'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                        )}>
                          {s.rekomendasi}
                        </Badge>
                      ) : (
                        <span className="text-[9px] text-muted-foreground/40 italic font-medium">No Grade</span>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* --- MODE EXCEL --- */}
        <TabsContent value="excel" className="space-y-6 mt-2 outline-none animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STEP 1 */}
            <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10 space-y-4">
              <h3 className="font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                <Download className="w-5 h-5"/> 1. Download Template
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                File Excel berisi daftar santri (NIS & Nama) yang belum mendapatkan penempatan kelas.
              </p>
              <Button 
                variant="outline"
                onClick={handleDownloadTemplate}
                className="w-full h-11 bg-background border-border text-foreground font-black hover:bg-indigo-500/10 hover:text-indigo-600 rounded-xl gap-2 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4"/> Download Template Excel
              </Button>
            </div>

            {/* STEP 2 */}
            <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10 space-y-4">
              <h3 className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Upload className="w-5 h-5"/> 2. Upload & Proses
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Isi kolom <b>"TARGET KELAS"</b>. Pastikan nama kelas sesuai dengan data Master Kelas.
              </p>
              <div className="border-2 border-dashed border-emerald-500/30 bg-background rounded-xl p-3 text-center relative hover:bg-emerald-500/5 transition-colors group">
                <input 
                  type="file" 
                  accept=".xlsx"
                  onChange={handleUploadExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <span className="text-sm text-emerald-600 font-black group-hover:scale-105 transition-transform block">
                  Pilih File Excel Anda
                </span>
              </div>
            </div>
          </div>

          {/* STEP 3 */}
          {excelData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500"/> 
                  Pratinjau Impor ({excelData.filter(d => d.isValid).length} Valid)
                </h3>
                <Button 
                  onClick={triggerSimpanExcel}
                  disabled={isProcessingExcel}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 h-10 rounded-xl gap-2 shadow-lg shadow-indigo-500/20"
                >
                  {isProcessingExcel ? "Memproses..." : <><Save className="w-4 h-4" /> Eksekusi Simpan</>}
                </Button>
              </div>
              
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted text-foreground text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 border-b border-border font-black text-muted-foreground">NIS</th>
                      <th className="px-5 py-3 border-b border-border font-black text-muted-foreground">Nama Santri</th>
                      <th className="px-5 py-3 border-b border-border font-black text-muted-foreground">Grade</th>
                      <th className="px-5 py-3 border-b border-border font-black text-muted-foreground">Target Kelas</th>
                      <th className="px-5 py-3 border-b border-border font-black text-muted-foreground text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {excelData.map((row, i) => (
                      <tr key={i} className={cn('hover:bg-muted/30 transition-colors', !row.isValid && 'bg-rose-500/[0.03]')}>
                        <td className="px-5 py-3 font-mono text-xs tabular-nums">{row.nis}</td>
                        <td className="px-5 py-3 font-bold text-foreground">{row.nama}</td>
                        <td className="px-5 py-3 text-xs font-semibold text-purple-600">{row.rekomendasi}</td>
                        <td className="px-5 py-3 font-black text-indigo-600">{row.target_kelas_nama}</td>
                        <td className="px-5 py-3 text-center">
                          {row.isValid ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent font-black text-[10px]">SIAP</Badge>
                          ) : (
                            <Badge variant="destructive" className="font-black text-[10px] gap-1">
                              <AlertCircle className="w-3 h-3"/> 
                              {!row.santri_id ? "SANTRI TIDAK ADA" : "KELAS SALAH"}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- MODAL CONFIRM EXCEL --- */}
      <Dialog open={showConfirmExcel} onOpenChange={setShowConfirmExcel}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-indigo-500/5">
               <AlertTriangle className="w-10 h-10 text-indigo-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-foreground">Konfirmasi Penempatan</h3>
              <p className="text-sm text-muted-foreground font-medium px-4">
                Anda akan menempatkan <span className="text-foreground font-black">{excelData.filter(d => d.isValid).length} santri</span> ke kelas baru secara massal. Pastikan data sudah benar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
               <Button variant="outline" onClick={() => setShowConfirmExcel(false)} className="h-12 rounded-xl font-black border-border shadow-sm">Batal</Button>
               <Button onClick={handleSimpanExcel} className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-500/20">Ya, Simpan!</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}