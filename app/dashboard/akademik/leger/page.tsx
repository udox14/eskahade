'use client'

import { useState, useEffect } from 'react'
import { getKelasListForLeger, getLegerData, hitungDanSimpanLeger } from './actions'
import { FileSpreadsheet, Loader2, Search, Trophy, Calculator } from 'lucide-react'
import { toast } from 'sonner'

declare global { interface Window { XLSX: any; } }

export default function LegerNilaiPage() {
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
      if (data.length > 0) setSelectedKelas(data[0].id)
    })
  }, [])

  useEffect(() => { if (selectedKelas) loadData() }, [selectedKelas, selectedSemester])

  const loadData = async () => {
    setLoading(true)
    const res = await getLegerData(selectedKelas, Number(selectedSemester))
    setDataLeger(res)
    setLoading(false)
  }

  // Hitung
  const handleHitung = async () => {
    if (!dataLeger || dataLeger.siswa.length === 0) return
    if (!confirm("Hitung ulang Jumlah, Rata-rata, dan Ranking seluruh siswa di kelas ini?")) return

    setIsCalculating(true)
    const toastId = toast.loading("Mengkalkulasi nilai...")
    
    const res = await hitungDanSimpanLeger(selectedKelas, Number(selectedSemester))
    
    setIsCalculating(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal Hitung", { description: res.error })
    } else {
        toast.success("Selesai!", { description: "Data berhasil diperbarui dan diurutkan." })
        loadData() // Refresh tabel
    }
  }

  // Export
  const handleExport = async () => {
    if (!dataLeger || dataLeger.siswa.length === 0) return
    if (!window.XLSX) return toast.error("Library Excel belum siap")

    setIsExporting(true)
    const toastId = toast.loading("Download Excel...")

    try {
        const headers = ["No", "NIS", "Nama Santri", ...dataLeger.mapel.map((m:any) => m.nama), "JUMLAH", "RATA-RATA", "RANKING"]
        const rows = dataLeger.siswa.map((s:any, idx:number) => {
          const rowData: any[] = [idx + 1, s.nis, s.nama]
          dataLeger.mapel.forEach((m:any) => rowData.push(s.nilai[m.id]))
          rowData.push(s.jumlah, s.rata, s.rank)
          return rowData
        })
    
        const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = window.XLSX.utils.book_new()
        const namaKelas = kelasList.find(k => k.id == selectedKelas)?.nama_kelas || "Kelas"
        window.XLSX.utils.book_append_sheet(wb, ws, `Leger ${namaKelas}`)
        window.XLSX.writeFile(wb, `Leger_${namaKelas}.xlsx`)
        toast.success("Berhasil")
    } catch (e) { toast.error("Gagal export") }
    finally { setIsExporting(false); toast.dismiss(toastId); }
  }

  return (
    <div className="space-y-6 max-w-[95vw] mx-auto pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Leger Nilai</h1>
           <p className="text-gray-500 text-sm">Rekapitulasi nilai per kelas (Matrix View).</p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={handleHitung}
                disabled={isCalculating || !dataLeger}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
                {isCalculating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Calculator className="w-4 h-4"/>}
                Hitung & Urutkan
            </button>
            <button 
                onClick={handleExport}
                disabled={isExporting || !dataLeger}
                className="bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>}
                Excel
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-end shadow-sm">
        <div className="w-full md:w-auto">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kelas</label>
          <select 
            className="p-2 border rounded-md w-64 bg-gray-50 outline-none"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Semester</label>
          <select 
            className="p-2 border rounded-md w-32 bg-gray-50 outline-none"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Ganjil</option>
            <option value="2">Genap</option>
          </select>
        </div>
        <button onClick={loadData} disabled={loading} className="bg-blue-600 text-white p-2 rounded-lg"><Search className="w-5 h-5"/></button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
            <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500"/></div>
        ) : !dataLeger || dataLeger.siswa.length === 0 ? (
            <div className="text-center py-20 text-gray-400 italic">Data kosong.</div>
        ) : (
            <div className="overflow-x-auto pb-4"> 
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-800 text-white font-bold sticky top-0 z-20 shadow-md">
                        <tr>
                            <th className="p-2 border border-slate-600 w-10 text-center sticky left-0 bg-slate-800 z-30">No</th>
                            <th className="p-2 border border-slate-600 w-24 sticky left-10 bg-slate-800 z-30">NIS</th>
                            <th className="p-2 border border-slate-600 w-64 sticky left-[8.5rem] bg-slate-800 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Nama Santri</th>
                            
                            {/* Header Mapel Vertikal */}
                            {dataLeger.mapel.map((m: any) => (
                                <th key={m.id} className="border border-slate-600 w-12 relative h-36 align-bottom pb-2 group hover:bg-slate-700 transition-colors">
                                    <div className="w-full h-full flex items-end justify-center">
                                        <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-xs tracking-wide">
                                            {m.nama}
                                        </span>
                                    </div>
                                </th>
                            ))}

                            {/* REVISI: Menghapus sticky right agar tidak menutupi nilai di HP */}
                            <th className="p-2 border border-slate-600 text-center bg-orange-700 w-16">JML</th>
                            <th className="p-2 border border-slate-600 text-center bg-blue-700 w-16">RATA</th>
                            <th className="p-2 border border-slate-600 text-center bg-green-700 w-16">RANK</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {dataLeger.siswa.map((s: any, idx: number) => (
                            <tr key={s.id} className="hover:bg-yellow-50 transition-colors group">
                                <td className="p-2 border text-center sticky left-0 bg-white group-hover:bg-yellow-50 z-10">{idx + 1}</td>
                                <td className="p-2 border font-mono text-xs sticky left-10 bg-white group-hover:bg-yellow-50 z-10">{s.nis}</td>
                                <td className="p-2 border font-bold text-gray-800 sticky left-[8.5rem] bg-white group-hover:bg-yellow-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)] truncate max-w-xs">{s.nama}</td>

                                {/* Loop Nilai */}
                                {dataLeger.mapel.map((m: any) => {
                                    const nilai = s.nilai[m.id]
                                    const isFail = nilai < 60 && nilai !== 0
                                    return (
                                        <td key={m.id} className={`p-2 border text-center font-mono text-xs ${isFail ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                                            {nilai || '-'}
                                        </td>
                                    )
                                })}

                                {/* REVISI: Menghapus sticky right */}
                                <td className="p-2 border text-center font-bold bg-orange-50 text-orange-900">{s.jumlah}</td>
                                <td className="p-2 border text-center font-bold bg-blue-50 text-blue-900">{s.rata}</td>
                                <td className="p-2 border text-center font-bold bg-green-50 text-green-900">
                                    {s.rank <= 3 && <Trophy className="w-3 h-3 inline mr-1 text-yellow-500"/>}
                                    {s.rank}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  )
}