'use client'

import React, { useState, useEffect } from 'react'
import { getMarhalahList, getKelasByMarhalah, getSantriForKenaikan, importKenaikanKelas } from './actions'
import { FileSpreadsheet, Upload, Loader2, CheckCircle, AlertTriangle, Download, LayoutList, CheckSquare, Square, Users, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30',
  B: 'bg-blue-500/10 text-blue-700 border-blue-400/30',
  C: 'bg-amber-500/10 text-amber-700 border-amber-400/30',
}

export default function KenaikanKelasPage() {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'EXCEL' | 'MANUAL'>('MANUAL')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [excelData, setExcelData] = useState<any[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [manualSantri, setManualSantri] = useState<any[]>([])
  const [isLoadingManual, setIsLoadingManual] = useState(false)
  const [targetMarhalah, setTargetMarhalah] = useState('')
  const [targetKelasList, setTargetKelasList] = useState<any[]>([])
  const [bulkTargetKelas, setBulkTargetKelas] = useState('')
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [selectedNis, setSelectedNis] = useState<string[]>([])

  useEffect(() => { getMarhalahList().then(setMarhalahList) }, [])
  useEffect(() => {
    if (selectedMarhalah) { getKelasByMarhalah(selectedMarhalah).then(setKelasList); setSelectedKelas('') }
    else setKelasList([])
  }, [selectedMarhalah])
  useEffect(() => {
    if (targetMarhalah) { getKelasByMarhalah(targetMarhalah).then(setTargetKelasList); setBulkTargetKelas('') }
    else setTargetKelasList([])
  }, [targetMarhalah])

  const handleDownload = async () => {
    if (!selectedMarhalah) return toast.warning("Pilih Tingkat (Marhalah) Asal terlebih dahulu.")
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan data santri...")
    try {
      const dataSantri = await getSantriForKenaikan(selectedMarhalah, selectedKelas)
      if (dataSantri.length === 0) { toast.dismiss(loadToast); toast.error("Tidak ada data", { description: "Tidak ada santri aktif di pilihan ini." }); setIsDownloading(false); return }
      const XLSX = await import('xlsx')
      const rows = dataSantri.map(s => ({ NIS: s.nis, "NAMA SANTRI": s.nama, "KELAS SEKARANG": s.kelas_sekarang, "HASIL GRADING": s.grade_lanjutan, "RATA-RATA ILMU ALAT": s.rata_rata, "TARGET KELAS": "" }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kenaikan")
      const namaMarhalah = marhalahList.find(m => m.id == selectedMarhalah)?.nama || 'Semua'
      const namaKelas = kelasList.find(k => k.id == selectedKelas)?.nama_kelas || 'Semua_Kelas'
      XLSX.writeFile(workbook, `Kenaikan_${namaMarhalah}_${namaKelas}.xlsx`)
      toast.dismiss(loadToast); toast.success("Template berhasil didownload")
    } catch { toast.dismiss(loadToast); toast.error("Gagal membuat file Excel") }
    finally { setIsDownloading(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const loadToast = toast.loading("Membaca file Excel...")
    try {
      const XLSX = await import('xlsx')
      const data = new Uint8Array(await file.arrayBuffer())
      const wb = XLSX.read(data, { type: 'array' })
      const parsed = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setExcelData(parsed); toast.dismiss(loadToast); toast.success(`Berhasil membaca ${parsed.length} baris data`)
    } catch { toast.dismiss(loadToast); toast.error("Format file tidak valid atau gagal membaca.") }
  }

  const handleLoadManualSantri = async () => {
    if (!selectedMarhalah) return toast.warning("Pilih Tingkat (Marhalah) Asal terlebih dahulu.")
    setIsLoadingManual(true); setPlacements({}); setSelectedNis([])
    try {
      const dataSantri = await getSantriForKenaikan(selectedMarhalah, selectedKelas)
      if (dataSantri.length === 0) toast.error("Tidak ada santri aktif di pilihan ini.")
      setManualSantri(dataSantri)
    } catch { toast.error("Gagal memuat data santri.") }
    finally { setIsLoadingManual(false) }
  }

  const toggleSelectNis = (nis: string) => setSelectedNis(prev => prev.includes(nis) ? prev.filter(n => n !== nis) : [...prev, nis])
  const toggleSelectAll = () => setSelectedNis(selectedNis.length === manualSantri.length ? [] : manualSantri.map(s => s.nis))

  const applyBulkPlacement = () => {
    if (selectedNis.length === 0) return toast.warning("Pilih minimal satu santri (ceklis).")
    if (!bulkTargetKelas) return toast.warning("Pilih kelas tujuan terlebih dahulu.")
    const newPlacements = { ...placements }
    selectedNis.forEach(nis => { newPlacements[nis] = bulkTargetKelas })
    setPlacements(newPlacements); setSelectedNis([])
    toast.success(`Berhasil menerapkan kelas ke ${selectedNis.length} santri.`)
  }

  const executeProcess = async (payload: any[]) => {
    setIsProcessing(true)
    const loadToast = toast.loading("Memproses pemindahan kelas...")
    const res = await importKenaikanKelas(payload)
    setIsProcessing(false); toast.dismiss(loadToast)
    if (res?.error) {
      toast.error("Terjadi Masalah", { description: res.error, duration: 8000 })
    } else {
      toast.success("Kenaikan Kelas Berhasil!", { description: `Sukses memindahkan ${res.count} santri ke kelas baru.` })
      setExcelData([]); setPlacements({}); setManualSantri([])
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
  }

  const handleProcessManual = async () => {
    const payload = Object.entries(placements).filter(([, target]) => target && target !== '').map(([nis, target]) => ({ 'NIS': nis, 'TARGET KELAS': target }))
    if (payload.length === 0) return toast.error("Belum ada satupun santri yang ditentukan kelas tujuannya.")
    if (await confirm(`Yakin ingin memproses kenaikan ${payload.length} santri ke kelas baru?`)) executeProcess(payload)
  }

  const totalPlacementsReady = Object.keys(placements).filter(k => placements[k] !== '').length

  const MARHALAH_OPTS = [
    <SelectItem key="__NONE__" value="__NONE__" className="font-medium">-- Pilih Marhalah --</SelectItem>,
    ...marhalahList.map(m => <SelectItem key={m.id} value={String(m.id)} className="font-medium">{m.nama}</SelectItem>)
  ]

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4">

      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-violet-500/10 rounded-xl text-violet-600"><GraduationCap className="w-5 h-5"/></div>
            Proses Kenaikan Kelas
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Gunakan hasil Grading sebagai acuan penempatan kelas baru.</p>
        </div>
        <div className="flex gap-1 bg-muted/60 border border-border p-1.5 rounded-2xl">
          <button onClick={() => setMode('MANUAL')}
            className={cn('px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all', mode === 'MANUAL' ? 'bg-background shadow-sm text-indigo-700' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutList className="w-4 h-4"/> Interface
          </button>
          <button onClick={() => setMode('EXCEL')}
            className={cn('px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all', mode === 'EXCEL' ? 'bg-background shadow-sm text-emerald-700' : 'text-muted-foreground hover:text-foreground')}>
            <FileSpreadsheet className="w-4 h-4"/> Excel
          </button>
        </div>
      </div>

      {/* ==================== MANUAL MODE ==================== */}
      {mode === 'MANUAL' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-left-2">

          {/* Step 1: Pilih Asal */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 flex flex-col md:flex-row items-end gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Tingkat / Marhalah Asal</label>
                <Select value={selectedMarhalah || '__NONE__'} onValueChange={(v) => setSelectedMarhalah(v === '__NONE__' || !v ? '' : v)}>
                  <SelectTrigger className="h-11 shadow-none bg-muted/20 font-bold focus:ring-indigo-500"><SelectValue/></SelectTrigger>
                  <SelectContent>{MARHALAH_OPTS}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kelas Asal (Opsional)</label>
                <Select value={selectedKelas || '__ALL__'} onValueChange={(v) => setSelectedKelas(v === '__ALL__' || !v ? '' : v)} disabled={!selectedMarhalah}>
                  <SelectTrigger className="h-11 shadow-none bg-muted/20 font-bold focus:ring-indigo-500 disabled:opacity-50"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__" className="font-medium">Semua Kelas</SelectItem>
                    {kelasList.map(k => <SelectItem key={k.id} value={String(k.id)} className="font-medium">{k.nama_kelas}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoadManualSantri} disabled={!selectedMarhalah || isLoadingManual} className="h-11 font-black rounded-xl gap-2 shadow-sm">
                {isLoadingManual ? <Loader2 className="w-4 h-4 animate-spin"/> : <Users className="w-4 h-4"/>}
                Tampilkan
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Daftar Santri */}
          {manualSantri.length > 0 && (
            <Card className="border-border shadow-sm overflow-hidden">
              {/* Toolbar */}
              <div className="bg-indigo-500/10 border-b border-indigo-400/20 p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h3 className="font-black text-foreground text-sm">Penempatan Kelas Tujuan</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Ceklis santri untuk memindahkan mereka secara massal.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto bg-background border border-border rounded-xl p-1.5 shadow-sm">
                  <Select value={targetMarhalah || '__NONE__'} onValueChange={(v) => setTargetMarhalah(v === '__NONE__' || !v ? '' : v)}>
                    <SelectTrigger className="w-full sm:w-44 h-9 shadow-none border-0 bg-transparent font-bold text-xs focus:ring-0"><SelectValue placeholder="1. Marhalah Baru"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__" className="font-medium">1. Pilih Marhalah Baru</SelectItem>
                      {marhalahList.map(m => <SelectItem key={m.id} value={String(m.id)} className="font-medium">{m.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={bulkTargetKelas || '__NONE__'} onValueChange={(v) => setBulkTargetKelas(v === '__NONE__' || !v ? '' : v)} disabled={!targetMarhalah}>
                    <SelectTrigger className="w-full sm:w-44 h-9 shadow-none border-0 bg-transparent font-bold text-xs focus:ring-0 disabled:opacity-50"><SelectValue placeholder="2. Kelas Baru"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__" className="font-medium">2. Pilih Kelas Baru</SelectItem>
                      {targetKelasList.map(k => <SelectItem key={k.id} value={k.nama_kelas} className="font-medium">{k.nama_kelas}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={applyBulkPlacement} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg shadow-sm">Terapkan</Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto" style={{ maxHeight: '550px' }}>
                <table className="w-full text-sm relative">
                  <thead className="bg-muted/50 border-b border-border/60 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-indigo-600 transition-colors">
                          {selectedNis.length === manualSantri.length && manualSantri.length > 0
                            ? <CheckSquare className="w-5 h-5 text-indigo-600"/>
                            : <Square className="w-5 h-5"/>}
                        </button>
                      </th>
                      {['Nama & NIS', 'Kelas Asal', 'Grade', 'Target Kelas Baru'].map(h => (
                        <th key={h} className="p-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {manualSantri.map(s => {
                      const gradeKey = String(s.grade_lanjutan || '').includes('A') ? 'A' : String(s.grade_lanjutan || '').includes('B') ? 'B' : String(s.grade_lanjutan || '').includes('C') ? 'C' : ''
                      return (
                        <tr key={s.nis} onClick={() => toggleSelectNis(s.nis)}
                          className={cn('cursor-pointer transition-colors', selectedNis.includes(s.nis) ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'hover:bg-muted/20')}>
                          <td className="p-4 text-center">
                            {selectedNis.includes(s.nis) ? <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto"/> : <Square className="w-5 h-5 text-muted-foreground/30 mx-auto"/>}
                          </td>
                          <td className="p-4">
                            <p className="font-black text-foreground">{s.nama}</p>
                            <p className="text-muted-foreground font-mono text-xs">{s.nis}</p>
                          </td>
                          <td className="p-4 text-foreground font-bold text-sm">{s.kelas_sekarang}</td>
                          <td className="p-4 text-center">
                            {gradeKey
                              ? <Badge variant="outline" className={cn('font-black text-xs', GRADE_BADGE[gradeKey])}>{s.grade_lanjutan}</Badge>
                              : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            {targetKelasList.length > 0 ? (
                              <select
                                className={cn('w-full p-2.5 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all',
                                  placements[s.nis] ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300' : 'border-border bg-background text-foreground')}
                                value={placements[s.nis] || ''}
                                onChange={(e) => setPlacements(prev => ({ ...prev, [s.nis]: e.target.value }))}
                              >
                                <option value="">- Belum Ditentukan -</option>
                                {targetKelasList.map(k => <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>)}
                              </select>
                            ) : (
                              <div className={cn('text-xs p-2.5 border border-border rounded-xl text-center font-medium', placements[s.nis] ? 'text-indigo-700 font-black' : 'text-muted-foreground italic')}>
                                {placements[s.nis] || 'Pilih Marhalah Baru di atas'}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Floating Save Bar */}
          {totalPlacementsReady > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[400px] bg-foreground text-background px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center font-black text-sm shrink-0">{totalPlacementsReady}</div>
                <span className="font-bold text-sm">Santri siap dinaikkan</span>
              </div>
              <Button onClick={handleProcessManual} disabled={isProcessing} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-xl gap-2 shadow-sm">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <GraduationCap className="w-4 h-4"/>}
                Simpan Kenaikan
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ==================== EXCEL MODE ==================== */}
      {mode === 'EXCEL' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Step 1: Download */}
            <Card className="border-emerald-400/30 bg-emerald-500/5 shadow-sm">
              <CardHeader className="p-4 border-b border-emerald-400/20">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">1</span>
                  <h3 className="font-black text-emerald-800 dark:text-emerald-400">Download Template Excel</h3>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pilih Marhalah (Wajib)</label>
                  <Select value={selectedMarhalah || '__NONE__'} onValueChange={(v) => setSelectedMarhalah(v === '__NONE__' || !v ? '' : v)}>
                    <SelectTrigger className="h-11 shadow-none bg-background font-bold focus:ring-emerald-500"><SelectValue placeholder="-- Pilih Marhalah --"/></SelectTrigger>
                    <SelectContent>{MARHALAH_OPTS}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pilih Kelas (Opsional)</label>
                  <Select value={selectedKelas || '__ALL__'} onValueChange={(v) => setSelectedKelas(v === '__ALL__' || !v ? '' : v)} disabled={!selectedMarhalah}>
                    <SelectTrigger className="h-11 shadow-none bg-background font-bold focus:ring-emerald-500 disabled:opacity-50"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__" className="font-medium">Semua Kelas</SelectItem>
                      {kelasList.map(k => <SelectItem key={k.id} value={String(k.id)} className="font-medium">{k.nama_kelas}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleDownload} disabled={!selectedMarhalah || isDownloading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-11 gap-2 shadow-sm">
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                  Download Data Santri (.xlsx)
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Upload */}
            <Card className="border-blue-400/30 bg-blue-500/5 shadow-sm">
              <CardHeader className="p-4 border-b border-blue-400/20">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">2</span>
                  <h3 className="font-black text-blue-800 dark:text-blue-400">Upload Hasil Penempatan</h3>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="border-2 border-dashed border-blue-400/40 rounded-xl p-8 text-center hover:bg-blue-500/10 transition-colors relative flex flex-col justify-center items-center gap-2 min-h-[120px]">
                  <input id="file-upload" type="file" accept=".xlsx,.xls" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  <Upload className="w-10 h-10 text-blue-500"/>
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-bold">Klik / Drag file Excel ke sini</p>
                </div>
                {excelData.length > 0 && (
                  <div className="bg-background border border-blue-400/30 p-3 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-400/30 font-black border gap-1">
                        <CheckCircle className="w-3.5 h-3.5"/> {excelData.length} Santri Terbaca
                      </Badge>
                    </div>
                    <Button onClick={() => setShowConfirm(true)} disabled={isProcessing} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl h-11 gap-2 shadow-sm">
                      <CheckCircle className="w-4 h-4"/> Eksekusi Kenaikan Kelas
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Table */}
          {excelData.length > 0 && (
            <Card className="border-border shadow-sm overflow-hidden">
              <div className="p-4 bg-muted/30 border-b border-border/60 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600"/>
                <span className="font-black text-foreground text-sm">Preview Keputusan Kenaikan (Excel)</span>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {['NIS', 'Nama Santri', 'Kelas Asal', 'Grade', 'Target Kelas Baru'].map(h => (
                        <th key={h} className={cn('p-3 text-left font-black text-muted-foreground uppercase tracking-widest', h === 'Target Kelas Baru' ? 'text-indigo-600 border-l border-border/40' : '')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {excelData.slice(0, 50).map((row, i) => {
                      const grKey = String(row['HASIL GRADING'] || '').includes('A') ? 'A' : String(row['HASIL GRADING'] || '').includes('B') ? 'B' : String(row['HASIL GRADING'] || '').includes('C') ? 'C' : ''
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="p-3 font-mono text-muted-foreground">{row['NIS'] || row['nis']}</td>
                          <td className="p-3 font-black text-foreground">{row['NAMA SANTRI']}</td>
                          <td className="p-3 text-foreground font-medium">{row['KELAS SEKARANG']}</td>
                          <td className="p-3 text-center">
                            {grKey ? <Badge variant="outline" className={cn('font-black text-[10px]', GRADE_BADGE[grKey])}>{row['HASIL GRADING']}</Badge> : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className={cn('p-3 font-black border-l border-border/30', row['TARGET KELAS'] ? 'text-indigo-600' : 'text-destructive/50 italic font-medium')}>
                            {row['TARGET KELAS'] || 'Tidak Diproses'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {excelData.length > 50 && (
                  <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                    ... dan {excelData.length - 50} santri lainnya
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Confirm Dialog Excel */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm p-0 rounded-2xl overflow-hidden bg-background border-none shadow-2xl text-center">
          <div className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-400/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-amber-600"/>
            </div>
            <DialogTitle className="text-xl font-black text-foreground">Konfirmasi Finalisasi</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              Sistem akan memproses kenaikan kelas untuk <strong>{excelData.length} santri</strong>.
              Data riwayat akademik di kelas lama akan <strong className="text-amber-600">diarsipkan secara permanen</strong>.
              <br/><br/>
              <span className="font-black text-destructive">Apakah Anda sudah yakin?</span>
            </DialogDescription>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-xl font-bold shadow-none">Batal</Button>
              <Button onClick={() => { setShowConfirm(false); executeProcess(excelData) }} className="rounded-xl font-black bg-blue-600 hover:bg-blue-700 shadow-sm">Ya, Eksekusi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}