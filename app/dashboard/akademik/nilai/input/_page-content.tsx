'use client'

import React, { useState, useEffect } from 'react'
import { Upload, Save, CheckCircle, FileSpreadsheet, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getReferensiData, getDataSantriPerKelas, simpanNilaiSemuaMapel } from './actions'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export default function InputNilaiPage() {
  const [refData, setRefData] = useState<{ mapel: any[], kelas: any[] }>({ mapel: [], kelas: [] })
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [excelData, setExcelData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    getReferensiData().then(data => setRefData({ mapel: data.mapel || [], kelas: data.kelas || [] }))
  }, [])

  const handleDownloadTemplate = async () => {
    if (!selectedKelas) { toast.warning("Mohon pilih Kelas terlebih dahulu."); return }
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan template...")
    const santriList = await getDataSantriPerKelas(selectedKelas)
    if (santriList.length === 0) {
      toast.dismiss(loadToast); toast.error("Gagal Download", { description: "Kelas ini belum memiliki santri." })
      setIsDownloading(false); return
    }
    const namaKelas = refData.kelas.find(k => k.id == selectedKelas)?.nama_kelas
    const dataRows = santriList.map(s => {
      const row: any = { NIS: s.nis, "NAMA SANTRI": s.nama }
      refData.mapel.forEach(m => { row[m.nama.toUpperCase()] = "" })
      return row
    })
    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(dataRows)
    const wscols = [{ wch: 15 }, { wch: 35 }]
    refData.mapel.forEach(() => wscols.push({ wch: 15 }))
    worksheet['!cols'] = wscols
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nilai Lengkap")
    XLSX.writeFile(workbook, `Template_Nilai_${namaKelas}_Lengkap.xlsx`)
    toast.dismiss(loadToast); toast.success("Template berhasil didownload")
    setIsDownloading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const loadToast = toast.loading("Membaca file Excel...")
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(ws)
      setExcelData(rawData)
      toast.dismiss(loadToast); toast.success(`Berhasil membaca ${rawData.length} baris data`)
    } catch { toast.dismiss(loadToast); toast.error("Format file tidak valid") }
  }

  const handleSimpan = async () => {
    if (!selectedKelas) { toast.error("Silakan pilih kelas target."); return }
    if (excelData.length === 0) { toast.warning("Belum ada data Excel yang diupload."); return }
    setLoading(true)
    const loadToast = toast.loading("Menyimpan nilai ke database...")
    const res = await simpanNilaiSemuaMapel(selectedKelas, Number(selectedSemester), excelData, refData.mapel)
    setLoading(false)
    toast.dismiss(loadToast)
    if (res?.error) {
      toast.error("Gagal Menyimpan", { description: res.error, duration: 5000 })
    } else {
      toast.success("Sukses!", { description: `Berhasil menyimpan ${res.count} nilai santri.` })
      setExcelData([])
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/akademik">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9"><ArrowLeft className="w-5 h-5"/></Button>
        </Link>
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600"><FileSpreadsheet className="w-5 h-5"/></div>
            Input Nilai Akademik
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Download template, isi nilai, lalu upload kembali.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">1. Pilih Konteks</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Semester</label>
                <Select value={selectedSemester} onValueChange={(v) => { if (v) setSelectedSemester(v) }}>
                  <SelectTrigger className="h-10 shadow-none focus:ring-blue-500 bg-muted/20">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="font-medium">Semester 1 (Ganjil)</SelectItem>
                    <SelectItem value="2" className="font-medium">Semester 2 (Genap)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kelas</label>
                <Select value={selectedKelas} onValueChange={(v) => { if (v) setSelectedKelas(v) }}>
                  <SelectTrigger className="h-10 shadow-none focus:ring-blue-500 bg-muted/20">
                    <SelectValue placeholder="-- Pilih Kelas --"/>
                  </SelectTrigger>
                  <SelectContent>
                    {refData.kelas.map((k: any) => (
                      <SelectItem key={k.id} value={k.id} className="font-medium">{k.nama_kelas}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-400/30 bg-blue-500/5 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">2. Download Template</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                Kolom mapel otomatis: <strong>{refData.mapel.slice(0, 3).map(m => m.nama).join(', ')}{refData.mapel.length > 3 ? ', dll.' : ''}</strong>
              </p>
              <Button
                onClick={handleDownloadTemplate}
                disabled={isDownloading || !selectedKelas}
                variant="outline"
                className="w-full border-blue-400/50 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold rounded-xl shadow-none h-10"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <FileSpreadsheet className="w-4 h-4 mr-2"/>}
                {isDownloading ? "Generating..." : "Download Excel Lengkap"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4">3. Upload Excel yang Sudah Diisi</p>
              <div className={`border-2 border-dashed rounded-xl p-8 transition-colors relative text-center ${!selectedKelas ? 'bg-muted/30 border-border' : 'border-blue-400/50 bg-blue-500/5 hover:bg-blue-500/10'}`}>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  disabled={!selectedKelas}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Upload className={`w-10 h-10 mx-auto mb-3 ${!selectedKelas ? 'text-muted-foreground/30' : 'text-blue-500'}`}/>
                <p className={`font-bold text-sm ${!selectedKelas ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                  {!selectedKelas ? "Pilih kelas di sebelah kiri dulu" : "Klik atau drag file .xlsx ke sini"}
                </p>
                {selectedKelas && <p className="text-xs text-muted-foreground mt-1">Format: .xlsx sesuai template yang didownload</p>}
              </div>
            </CardContent>
          </Card>

          {excelData.length > 0 && (
            <Card className="border-emerald-400/30 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 border-b border-border/60 bg-muted/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600"/>
                  <p className="font-black text-foreground text-sm">Preview Data</p>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-400/30 font-black border">{excelData.length} Santri</Badge>
                </div>
                <Button onClick={handleSimpan} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl gap-2 shadow-sm h-9">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                  Simpan Semua
                </Button>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5 font-black text-muted-foreground">NIS</th>
                      <th className="px-4 py-2.5 font-black text-muted-foreground">Nama Santri</th>
                      {refData.mapel.map(m => (
                        <th key={m.id} className="px-4 py-2.5 font-black text-muted-foreground text-center border-l border-border/40">{m.nama}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {excelData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{row['NIS'] || row['nis']}</td>
                        <td className="px-4 py-2 font-bold text-foreground">{row['NAMA SANTRI']}</td>
                        {refData.mapel.map(m => {
                          const val = row[m.nama.toUpperCase()]
                          const isInvalid = val !== undefined && val !== "" && (isNaN(Number(val)) || Number(val) > 100 || Number(val) < 0)
                          return (
                            <td key={m.id} className={`px-4 py-2 text-center border-l border-border/30 font-mono ${isInvalid ? 'bg-red-100 text-red-700 font-black dark:bg-red-900/30 dark:text-red-400' : ''}`}>
                              {val !== undefined && val !== "" ? val : "—"}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelData.length > 50 && (
                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                    ... dan {excelData.length - 50} data lainnya
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}