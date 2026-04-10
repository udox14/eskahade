'use client'

import { useState, useEffect, useRef } from 'react'
import { getKelasList, getDataRapor } from './actions'
import { Printer, Loader2, Search, FileText, BookOpen, Layers, GraduationCap } from 'lucide-react'
import { RaporSatuHalaman } from './rapor-view'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function CetakRaporPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  
  const [dataRapor, setDataRapor] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const printRef = useRef(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Rapor_Kelas_${selectedKelas}_Smt${selectedSemester}`,
    onAfterPrint: () => {
      toast.success("Dokumen dikirim ke printer.")
    },
    onPrintError: () => {
      toast.error("Gagal mencetak dokumen.")
    }
  })

  const triggerPrint = () => {
    toast.info("Menyiapkan dokumen untuk dicetak...")
    handlePrint()
  }

  useEffect(() => {
    getKelasList().then(setKelasList)
  }, [])

  const handleLoad = async () => {
    if (!selectedKelas) {
      toast.warning("Mohon pilih Kelas terlebih dahulu.")
      return
    }

    setLoading(true)
    const loadToast = toast.loading("Mengambil data nilai dan ranking...")
    setDataRapor([]) 

    try {
      const data = await getDataRapor(selectedKelas, Number(selectedSemester))
      
      if (data.length === 0) {
        toast.info("Data Kosong", { 
          description: "Belum ada santri atau nilai di kelas ini." 
        })
      } else {
        toast.success("Data Siap", { 
          description: `Berhasil memuat rapor untuk ${data.length} santri.` 
        })
      }
      
      setDataRapor(data)
    } catch (error) {
      console.error(error)
      toast.error("Terjadi Kesalahan", { description: "Gagal mengambil data dari server." })
    } finally {
      setLoading(false)
      toast.dismiss(loadToast)
    }
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Hero */}
      <div className="relative bg-slate-950 border border-slate-900/50 text-slate-50 px-6 pt-6 pb-8 rounded-[2.5rem] shadow-xl shadow-slate-900/10 overflow-hidden shrink-0 print:hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 mb-1 uppercase tracking-tight">
              <BookOpen className="w-6 h-6 text-blue-400" /> Cetak Rapor Santri
            </h1>
            <p className="text-slate-400 text-xs font-medium max-w-md">Modul pencetakan Laporan Hasil Belajar (LHB) kolektif per kelas dengan format standar A4.</p>
          </div>
          {dataRapor.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/40 border border-slate-800/50 p-2 px-4 rounded-2xl">
                 <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/80">Kesiapan Data</p>
                 <p className="font-black text-lg tabular-nums">{dataRapor.length} <span className="text-xs text-slate-500 font-medium">Santri</span></p>
              </div>
              <Button 
                onClick={triggerPrint}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest gap-2 h-12 px-6 shadow-lg shadow-blue-500/20"
              >
                <Printer className="w-4 h-4"/> CETAK KOLEKTIF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-5 rounded-[2.5rem] border-border shadow-sm bg-card print:hidden shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          <div className="md:col-span-5 space-y-2">
            <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] block ml-1">Pilih Rombongan Belajar (Kelas)</label>
            <Select value={selectedKelas} onValueChange={(v) => setSelectedKelas(v ?? '')}>
               <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-blue-500">
                  <SelectValue placeholder="Pilih Kelas..." />
               </SelectTrigger>
               <SelectContent className="rounded-2xl border-border">
                  {kelasList.map(k => <SelectItem key={k.id} value={k.id} className="font-bold uppercase text-[11px]">{k.nama_kelas}</SelectItem>)}
               </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] block ml-1">Periode Semester</label>
            <Select value={selectedSemester} onValueChange={(v) => setSelectedSemester(v ?? '')}>
               <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-blue-500">
                  <SelectValue placeholder="Pilih Semester..." />
               </SelectTrigger>
               <SelectContent className="rounded-2xl border-border">
                  <SelectItem value="1" className="font-bold text-[11px]">SEMESTER 1 (GANJIL)</SelectItem>
                  <SelectItem value="2" className="font-bold text-[11px]">SEMESTER 2 (GENAP)</SelectItem>
               </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-3">
             <Button 
              onClick={handleLoad}
              disabled={!selectedKelas || loading}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black gap-2 transition-all active:scale-[0.98] uppercase text-[11px] tracking-widest shadow-xl shadow-slate-900/10"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              MUAT DATA NILAI
            </Button>
          </div>
          
        </div>
      </Card>

      {/* Preview Area */}
      <div className="bg-muted/30 p-8 rounded-[3rem] border border-border flex-1 overflow-hidden flex flex-col items-center relative group">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 animate-pulse">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] animate-bounce">Menyusun Laporan...</p>
          </div>
        ) : dataRapor.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-5 py-20 px-10">
            <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center shadow-sm border border-border">
              <FileText className="w-12 h-12 text-muted-foreground/30"/>
            </div>
            <div className="space-y-1">
              <p className="font-black text-foreground uppercase tracking-[0.2em] text-sm">Pratinjau Rapor</p>
              <p className="text-muted-foreground text-[11px] font-medium max-w-sm">Daftar rapor akan ditampilkan di sini setelah Anda memilih kelas dan Semester yang sesuai.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="w-full h-full pr-4">
             <div ref={printRef} className="flex flex-col items-center w-full">
                {dataRapor.map((siswa, idx) => (
                  <div key={siswa.id} className="mb-12 last:mb-0 print:mb-0 break-after-page relative w-fit">
                    <Card className="shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border-none shrink-0 print:shadow-none bg-white overflow-hidden">
                      <RaporSatuHalaman 
                        data={siswa} 
                        semester={Number(selectedSemester)} 
                      />
                    </Card>
                    
                    {/* Visual Separator */}
                    <div className="mt-8 flex items-center justify-center gap-4 print:hidden">
                        <div className="h-[1px] bg-border flex-1" />
                        <Badge variant="outline" className="font-black text-[9px] tracking-[.3em] bg-muted uppercase px-3 h-6 border-transparent">HALAMAN {idx + 1}</Badge>
                        <div className="h-[1px] bg-border flex-1" />
                    </div>
                  </div>
                ))}
             </div>
          </ScrollArea>
        )}
      </div>

    </div>
  )
}