'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getKelasList, getDataGrading, simpanGradingBatch } from './actions'
import { Loader2, Save, Filter, BookOpen, AlertCircle, TrendingUp, AlertTriangle, Download, UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<string, string> = {
  'Grade A': 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30',
  'Grade B': 'bg-blue-500/10 text-blue-700 border-blue-400/30',
  'Grade C': 'bg-amber-500/10 text-amber-700 border-amber-400/30',
}

export default function GradingKelasPage() {
  const confirm = useConfirm()
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  const [dataGrading, setDataGrading] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getKelasList().then(res => {
      const sortedKelas = res.sort((a, b) =>
        a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
      )
      setKelasList(sortedKelas)
      if (sortedKelas.length === 1) setSelectedKelas(sortedKelas[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedKelas) loadGradingData(selectedKelas)
    else { setDataGrading([]); setPendingChanges({}) }
  }, [selectedKelas])

  const loadGradingData = async (kelasId: string) => {
    setLoading(true); setPendingChanges({})
    try { const res = await getDataGrading(kelasId); setDataGrading(res) }
    catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  const handleGradeChange = (riwayatId: string, newGrade: string) => {
    setPendingChanges(prev => ({ ...prev, [riwayatId]: newGrade }))
  }

  const handleSimpanBatch = async () => {
    const totalChanges = Object.keys(pendingChanges).length
    if (totalChanges === 0) { toast.warning("Belum ada perubahan yang perlu disimpan."); return }
    if (!await confirm(`Simpan keputusan grading untuk ${totalChanges} santri?`)) return
    setIsSaving(true)
    try {
      const payload = Object.entries(pendingChanges).map(([id, grade]) => ({ riwayat_id: id, grade: grade as string }))
      await simpanGradingBatch(payload)
      toast.success(`Berhasil menyimpan ${totalChanges} grading!`)
      setDataGrading(prev => prev.map(item => pendingChanges[item.riwayat_id] ? { ...item, grade_final: pendingChanges[item.riwayat_id] } : item))
      setPendingChanges({})
    } catch { toast.error("Terjadi kesalahan saat menyimpan data.") }
    finally { setIsSaving(false) }
  }

  const handleDownloadTemplate = async () => {
    if (dataGrading.length === 0) { toast.warning("Belum ada data santri untuk diunduh."); return }
    setIsProcessingExcel(true)
    try {
      const XLSX = await import('xlsx')
      const dataTemplate = dataGrading.map(s => ({
        "ID_SYSTEM_JANGAN_DIUBAH": s.riwayat_id, "NIS": s.nis, "Nama Lengkap": s.nama,
        "Rata-Rata Nilai": s.rata_rata, "Rekomendasi Sistem": s.rekomendasi,
        "Grade Final (Ketik: Grade A / Grade B / Grade C)": getDisplayGrade(s.riwayat_id, s.grade_final)
      }))
      const ws = XLSX.utils.json_to_sheet(dataTemplate)
      ws['!cols'] = [{ hidden: true }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 45 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Grading Kelas")
      const namaKelas = kelasList.find(k => k.id === selectedKelas)?.nama_kelas || "Kelas"
      XLSX.writeFile(wb, `Template_Grading_${namaKelas.replace(/ /g, "_")}.xlsx`)
    } catch { toast.error("Gagal membuat template Excel.") }
    finally { setIsProcessingExcel(false) }
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setIsProcessingExcel(true)
    try {
      const XLSX = await import('xlsx')
      const data = new Uint8Array(await file.arrayBuffer())
      const workbook = XLSX.read(data, { type: 'array' })
      const jsonData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
      let validChanges = 0
      const newPendingObj = { ...pendingChanges }
      jsonData.forEach(row => {
        const id = row["ID_SYSTEM_JANGAN_DIUBAH"]
        let rawGrade = row["Grade Final (Ketik: Grade A / Grade B / Grade C)"]
        if (id && rawGrade) {
          let finalGrade = String(rawGrade).trim().toUpperCase()
          if (finalGrade === 'A' || finalGrade.includes('GRADE A')) finalGrade = 'Grade A'
          else if (finalGrade === 'B' || finalGrade.includes('GRADE B')) finalGrade = 'Grade B'
          else if (finalGrade === 'C' || finalGrade.includes('GRADE C')) finalGrade = 'Grade C'
          else return
          const santri = dataGrading.find(s => s.riwayat_id === id)
          if (santri && santri.grade_final !== finalGrade) { newPendingObj[id] = finalGrade; validChanges++ }
        }
      })
      setPendingChanges(newPendingObj)
      if (validChanges > 0) toast.success(`${validChanges} perubahan diimpor! Silakan review dan klik Simpan.`)
      else toast.info("Tidak ada perubahan baru yang terdeteksi dari file Excel.")
    } catch { toast.error("Gagal memproses data Excel. Pastikan format kolom tidak diubah.") }
    finally { setIsProcessingExcel(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }

  const getDisplayGrade = (riwayatId: string, originalGrade: string) =>
    pendingChanges[riwayatId] !== undefined ? pendingChanges[riwayatId] : originalGrade

  const totalPerubahan = Object.keys(pendingChanges).length

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600"><TrendingUp className="w-5 h-5"/></div>
          Grading Nahwu & Sharaf
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ml-[3.25rem]">Sistem rekomendasi penentuan Grade A / B / C per santri.</p>
      </div>

      {/* Filter Kelas */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1.5 flex-1 md:max-w-xs">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pilih Kelas</label>
              <Select value={selectedKelas} onValueChange={(v) => { if (v) setSelectedKelas(v) }}>
                <SelectTrigger className="h-11 shadow-none focus:ring-indigo-500 bg-muted/20 font-bold">
                  <SelectValue placeholder="-- Pilih Kelas --"/>
                </SelectTrigger>
                <SelectContent>
                  {kelasList.map(k => <SelectItem key={k.id} value={k.id} className="font-medium">{k.nama_kelas}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedKelas && dataGrading.length > 0 && (
              <div className="flex gap-2 items-center border-l border-border pl-4">
                <div className="flex items-center gap-1.5 mr-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
                  <span className="text-xs font-black text-muted-foreground">Excel Mode</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={isProcessingExcel} className="rounded-xl font-bold shadow-none gap-2">
                  {isProcessingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Download className="w-3.5 h-3.5"/>}
                  Download
                </Button>
                <label htmlFor="upload-grading" className={cn('cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 h-9 text-sm font-bold rounded-xl border border-emerald-400/50 text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors', isProcessingExcel && 'opacity-50 pointer-events-none')}>
                  <UploadCloud className="w-3.5 h-3.5"/> Upload
                </label>
                <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleUploadExcel} className="hidden" id="upload-grading"/>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {!selectedKelas ? (
        <div className="flex flex-col items-center py-20 gap-3 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10 text-center">
          <Filter className="w-12 h-12 text-muted-foreground/20"/>
          <p className="text-base font-black text-foreground">Pilih kelas untuk mulai melakukan grading</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600"/>
          <p className="font-bold text-muted-foreground">Mengkalkulasi rata-rata 2 semester...</p>
        </div>
      ) : dataGrading.length === 0 ? (
        <Card className="py-20 text-center border-border shadow-sm">
          <p className="text-muted-foreground font-medium">Tidak ada data santri aktif di kelas ini.</p>
        </Card>
      ) : (
        <div className="space-y-4">

          {/* Info Panduan */}
          <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5"/>
            <div className="text-sm">
              <p className="font-black text-indigo-800 dark:text-indigo-400 mb-1">Panduan Grading Otomatis:</p>
              <ul className="space-y-0.5 text-indigo-700/80 dark:text-indigo-400/80 text-xs font-medium">
                <li>• <span className="font-black">Grade A:</span> Rata-rata ≥ 70</li>
                <li>• <span className="font-black">Grade B:</span> 50 ≤ Rata-rata &lt; 70</li>
                <li>• <span className="font-black">Grade C:</span> Rata-rata &lt; 50</li>
              </ul>
            </div>
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block shadow-sm border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60">
                <tr>
                  {['Nama Santri & NIS', 'Rata-rata', 'Rekomendasi Sistem', 'Keputusan Final Wali Kelas'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dataGrading.map(s => {
                  const currentGrade = getDisplayGrade(s.riwayat_id, s.grade_final)
                  const isOverridden = currentGrade !== s.rekomendasi && s.rekomendasi !== '-'
                  const isPending = !!pendingChanges[s.riwayat_id]
                  return (
                    <tr key={s.riwayat_id} className={cn('transition-colors', isPending ? 'bg-amber-50/40 dark:bg-amber-900/10' : 'hover:bg-muted/20')}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {isPending && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"/>}
                          <div>
                            <p className="font-black text-foreground">{s.nama}</p>
                            <p className="text-muted-foreground font-mono text-xs mt-0.5">{s.nis}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <p className="font-black text-lg text-indigo-600 tabular-nums">{s.rata_rata}</p>
                        <p className="text-[10px] text-muted-foreground">{s.jumlah_komponen_nilai} nilai</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {s.rekomendasi === '-'
                          ? <span className="text-xs text-muted-foreground italic">Nilai Kosong</span>
                          : <Badge variant="outline" className={cn('font-black text-xs', GRADE_COLOR[s.rekomendasi])}>{s.rekomendasi}</Badge>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <select
                            className={cn('p-2.5 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none transition-all cursor-pointer',
                              isPending ? 'border-amber-400 ring-2 ring-amber-400/20 text-amber-900 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'
                              : 'border-border focus:border-indigo-500 focus:ring-indigo-200 text-foreground bg-background'
                            )}
                            value={currentGrade}
                            onChange={e => handleGradeChange(s.riwayat_id, e.target.value)}
                          >
                            <option value="Grade A">Grade A</option>
                            <option value="Grade B">Grade B</option>
                            <option value="Grade C">Grade C</option>
                          </select>
                          {isOverridden && (
                            <Badge variant="outline" className="text-[10px] font-black border-purple-400/40 bg-purple-500/10 text-purple-700 gap-1">
                              <AlertTriangle className="w-3 h-3"/> VETO
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {dataGrading.map(s => {
              const currentGrade = getDisplayGrade(s.riwayat_id, s.grade_final)
              const isOverridden = currentGrade !== s.rekomendasi && s.rekomendasi !== '-'
              const isPending = !!pendingChanges[s.riwayat_id]
              return (
                <Card key={s.riwayat_id} className={cn('shadow-sm relative overflow-hidden', isPending ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-border')}>
                  {isPending && <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"/>}
                  <CardContent className="p-4 space-y-3">
                    <div className="border-b border-border/60 pb-3">
                      <p className="font-black text-foreground text-base pr-4">{s.nama}</p>
                      <Badge variant="outline" className="font-mono text-[10px] mt-1 border-muted text-muted-foreground">{s.nis}</Badge>
                    </div>
                    <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-400/20 p-3 rounded-xl">
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Rata-rata</p>
                        <p className="font-black text-xl text-indigo-600 tabular-nums">{s.rata_rata}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-0.5">Sistem</p>
                        {s.rekomendasi === '-'
                          ? <span className="text-xs text-muted-foreground italic">Kosong</span>
                          : <Badge variant="outline" className={cn('font-black text-[10px]', GRADE_COLOR[s.rekomendasi])}>{s.rekomendasi}</Badge>
                        }
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-black text-foreground">Keputusan Final:</label>
                        {isOverridden && <Badge variant="outline" className="text-[9px] font-black border-purple-400/40 bg-purple-500/10 text-purple-700">VETO</Badge>}
                      </div>
                      <select
                        className={cn('w-full p-3 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none cursor-pointer',
                          isPending ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300' : 'border-border bg-background text-foreground'
                        )}
                        value={currentGrade}
                        onChange={e => handleGradeChange(s.riwayat_id, e.target.value)}
                      >
                        <option value="Grade A">Grade A</option>
                        <option value="Grade B">Grade B</option>
                        <option value="Grade C">Grade C</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Floating Save Bar */}
      {totalPerubahan > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[400px] bg-foreground text-background px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center font-black text-foreground text-sm shrink-0">
              {totalPerubahan}
            </div>
            <span className="font-bold text-sm">Draft belum disimpan</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setPendingChanges({})} disabled={isSaving}
              className="text-background/70 hover:text-background hover:bg-white/10 text-sm font-bold h-9 rounded-xl">
              Batal
            </Button>
            <Button onClick={handleSimpanBatch} disabled={isSaving}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-xl gap-2 h-9 shadow-sm">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
              Simpan Data
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}