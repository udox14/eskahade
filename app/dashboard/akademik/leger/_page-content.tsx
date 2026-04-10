'use client'

import { useState, useEffect } from 'react'
import { getKelasListForLeger, getLegerData, hitungDanSimpanLeger } from './actions'
import { FileSpreadsheet, Loader2, Search, Trophy, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function LegerNilaiPage() {
  const confirm = useConfirm()
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [dataLeger, setDataLeger] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    getKelasListForLeger().then(data => {
      setKelasList(data)
      if (data.length > 0) setSelectedKelas(String(data[0].id))
    })
  }, [])

  useEffect(() => { if (selectedKelas) loadData() }, [selectedKelas, selectedSemester])

  const loadData = async () => {
    setLoading(true)
    const res = await getLegerData(selectedKelas, Number(selectedSemester))
    setDataLeger(res)
    setLoading(false)
  }

  const handleHitung = async () => {
    if (!dataLeger || dataLeger.siswa.length === 0) return
    if (!await confirm("Hitung ulang Jumlah, Rata-rata, dan Ranking seluruh siswa di kelas ini?")) return
    setIsCalculating(true)
    const toastId = toast.loading("Mengkalkulasi nilai...")
    const res = await hitungDanSimpanLeger(selectedKelas, Number(selectedSemester))
    setIsCalculating(false); toast.dismiss(toastId)
    if (res?.error) toast.error("Gagal Hitung", { description: res.error })
    else { toast.success("Selesai!", { description: "Data berhasil diperbarui dan diurutkan." }); loadData() }
  }

  const handleExport = async () => {
    if (!dataLeger || dataLeger.siswa.length === 0) return
    setIsExporting(true)
    const toastId = toast.loading("Download Excel...")
    try {
      const XLSX = await import('xlsx')
      const headers = ["No", "NIS", "Nama Santri", ...dataLeger.mapel.map((m: any) => m.nama), "JUMLAH", "RATA-RATA", "RANKING"]
      const rows = dataLeger.siswa.map((s: any, idx: number) => {
        const rowData: any[] = [idx + 1, s.nis, s.nama]
        dataLeger.mapel.forEach((m: any) => rowData.push(s.nilai[m.id]))
        rowData.push(s.jumlah, s.rata, s.rank)
        return rowData
      })
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new()
      const namaKelas = kelasList.find(k => k.id == selectedKelas)?.nama_kelas || "Kelas"
      XLSX.utils.book_append_sheet(wb, ws, `Leger ${namaKelas}`)
      XLSX.writeFile(wb, `Leger_${namaKelas}.xlsx`)
      toast.success("Berhasil")
    } catch { toast.error("Gagal export") }
    finally { setIsExporting(false); toast.dismiss(toastId) }
  }

  return (
    <div className="space-y-5 max-w-[95vw] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600"><Trophy className="w-5 h-5"/></div>
            Leger Nilai
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Rekapitulasi nilai per kelas (Matrix View).</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleHitung} disabled={isCalculating || !dataLeger} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl gap-2 shadow-sm">
            {isCalculating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Calculator className="w-4 h-4"/>}
            Hitung & Urutkan
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !dataLeger} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl gap-2 shadow-sm">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>}
            Excel
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1.5 w-full md:w-64">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kelas</label>
            <Select value={selectedKelas} onValueChange={(v) => { if (v) setSelectedKelas(v) }}>
              <SelectTrigger className="h-10 shadow-none focus:ring-indigo-500 bg-muted/20 font-bold">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                {kelasList.map(k => <SelectItem key={k.id} value={String(k.id)} className="font-medium">{k.nama_kelas}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full md:w-36">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Semester</label>
            <Select value={selectedSemester} onValueChange={(v) => { if (v) setSelectedSemester(v) }}>
              <SelectTrigger className="h-10 shadow-none focus:ring-indigo-500 bg-muted/20 font-bold">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="font-medium">Ganjil</SelectItem>
                <SelectItem value="2" className="font-medium">Genap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadData} disabled={loading} className="h-10 rounded-xl font-bold shadow-sm">
            <Search className="w-4 h-4 mr-2"/> Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-400"/></div>
        ) : !dataLeger || dataLeger.siswa.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground italic">Data kosong.</div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-foreground text-background font-bold sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-2 border border-white/20 w-10 text-center sticky left-0 bg-foreground z-30 text-xs">No</th>
                  <th className="p-2 border border-white/20 w-24 sticky left-10 bg-foreground z-30 text-xs">NIS</th>
                  <th className="p-2 border border-white/20 w-64 sticky left-[8.5rem] bg-foreground z-30 shadow-[2px_0_5px_rgba(0,0,0,0.3)] text-xs">Nama Santri</th>
                  {dataLeger.mapel.map((m: any) => (
                    <th key={m.id} className="border border-white/20 w-12 relative h-36 align-bottom pb-2 hover:bg-white/10 transition-colors">
                      <div className="w-full h-full flex items-end justify-center">
                        <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[10px] tracking-wide">{m.nama}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 border border-white/20 text-center bg-orange-700 w-16 text-xs">JML</th>
                  <th className="p-2 border border-white/20 text-center bg-blue-700 w-16 text-xs">RATA</th>
                  <th className="p-2 border border-white/20 text-center bg-emerald-700 w-16 text-xs">RANK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dataLeger.siswa.map((s: any, idx: number) => (
                  <tr key={s.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/5 transition-colors group">
                    <td className="p-2 border border-border/30 text-center sticky left-0 bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-900/5 z-10 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 border border-border/30 font-mono text-xs sticky left-10 bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-900/5 z-10 text-muted-foreground">{s.nis}</td>
                    <td className="p-2 border border-border/30 font-bold text-foreground sticky left-[8.5rem] bg-background group-hover:bg-amber-50/50 dark:group-hover:bg-amber-900/5 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.06)] truncate max-w-xs text-xs">{s.nama}</td>
                    {dataLeger.mapel.map((m: any) => {
                      const nilai = s.nilai[m.id]
                      const isFail = nilai < 60 && nilai !== 0
                      return (
                        <td key={m.id} className={cn('p-2 border border-border/30 text-center font-mono text-xs', isFail ? 'text-destructive font-black bg-destructive/5' : '')}>
                          {nilai || '—'}
                        </td>
                      )
                    })}
                    <td className="p-2 border border-border/30 text-center font-black bg-orange-50 text-orange-900 dark:bg-orange-900/10 dark:text-orange-400 text-xs">{s.jumlah}</td>
                    <td className="p-2 border border-border/30 text-center font-black bg-blue-50 text-blue-900 dark:bg-blue-900/10 dark:text-blue-400 text-xs">{s.rata}</td>
                    <td className="p-2 border border-border/30 text-center font-black bg-emerald-50 text-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-400 text-xs">
                      {s.rank <= 3 && <Trophy className="w-3 h-3 inline mr-1 text-amber-500"/>}
                      {s.rank}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}