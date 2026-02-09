'use client'

import { useState, useEffect } from 'react'
// HAPUS IMPORT XLSX STATIS
import { getKelasListForLeger, getLegerData } from './actions'
import { FileSpreadsheet, Loader2, Search, Trophy } from 'lucide-react'
import { toast } from 'sonner'

export default function LegerNilaiPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  
  const [dataLeger, setDataLeger] = useState<{ mapel: any[], siswa: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Load Kelas saat pertama buka
  useEffect(() => {
    getKelasListForLeger().then(data => {
      setKelasList(data)
      // Auto select kelas pertama jika ada (memudahkan wali kelas)
      if (data.length > 0) setSelectedKelas(data[0].id)
    })
  }, [])

  // Load Leger saat filter berubah
  useEffect(() => {
    if (selectedKelas) loadData()
  }, [selectedKelas, selectedSemester])

  const loadData = async () => {
    setLoading(true)
    const res = await getLegerData(selectedKelas, Number(selectedSemester))
    setDataLeger(res)
    setLoading(false)
  }

  // Export Excel (Dynamic Import)
  const handleExport = async () => {
    if (!dataLeger || dataLeger.siswa.length === 0) {
        toast.warning("Data kosong")
        return
    }

    setIsExporting(true)
    const toastId = toast.loading("Menyiapkan Excel...")

    try {
        // DYNAMIC IMPORT XLSX (KUNCI OPTIMASI)
        const XLSX = await import('xlsx')
        
        // 1. Buat Header
        const headers = [
          "No", "NIS", "Nama Santri",
          ...dataLeger.mapel.map(m => m.nama),
          "JUMLAH", "RATA-RATA", "RANKING"
        ]
    
        // 2. Buat Isi
        const rows = dataLeger.siswa.map((s, idx) => {
          const rowData: any[] = [
            idx + 1, s.nis, s.nama
          ]
          // Loop Mapel
          dataLeger.mapel.forEach(m => {
            rowData.push(s.nilai[m.id])
          })
          // Statistik
          rowData.push(s.jumlah, s.rata, s.rank)
          return rowData
        })
    
        // 3. Create Workbook
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        
        // Auto width sederhana
        const wscols = [{wch:5}, {wch:15}, {wch:30}]
        dataLeger.mapel.forEach(() => wscols.push({wch:10}))
        wscols.push({wch:10}, {wch:10}, {wch:10})
        ws['!cols'] = wscols
    
        const wb = XLSX.utils.book_new()
        const namaKelas = kelasList.find(k => k.id == selectedKelas)?.nama_kelas || "Kelas"
        XLSX.utils.book_append_sheet(wb, ws, `Leger ${namaKelas}`)
        
        XLSX.writeFile(wb, `Leger_Nilai_${namaKelas}_Smt${selectedSemester}.xlsx`)
        toast.success("Leger berhasil didownload")
    } catch (error) {
        console.error(error)
        toast.error("Gagal export Excel")
    } finally {
        toast.dismiss(toastId)
        setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[95vw] mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Leger Nilai</h1>
           <p className="text-gray-500 text-sm">Rekapitulasi nilai per kelas (Matrix View).</p>
        </div>
        
        {dataLeger?.siswa && dataLeger.siswa.length > 0 && (
           <button 
             onClick={handleExport}
             disabled={isExporting}
             className="bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-green-800 transition-colors disabled:opacity-50"
           >
             {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>}
             Download Excel
           </button>
        )}
      </div>

      {/* FILTER */}
      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-end shadow-sm">
        <div className="w-full md:w-auto">
          <label className="text-sm font-bold text-gray-700 block mb-1">Pilih Kelas</label>
          <select 
            className="p-2 border rounded-md w-full md:w-64 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            {kelasList.length === 0 && <option>Memuat kelas...</option>}
            {kelasList.map(k => (
              <option key={k.id} value={k.id}>{k.nama_kelas} ({k.marhalah?.nama})</option>
            ))}
          </select>
        </div>
        
        <div className="w-full md:w-auto">
          <label className="text-sm font-bold text-gray-700 block mb-1">Semester</label>
          <select 
            className="p-2 border rounded-md w-full md:w-32 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Ganjil</option>
            <option value="2">Genap</option>
          </select>
        </div>

        <button 
          onClick={loadData}
          disabled={loading || !selectedKelas}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
          Tampilkan
        </button>
      </div>

      {/* TABEL LEGER */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
            <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500"/></div>
        ) : !dataLeger || dataLeger.siswa.length === 0 ? (
            <div className="text-center py-20 text-gray-400 italic">
                Tidak ada data nilai atau santri di kelas ini.<br/>
                <span className="text-xs">Pastikan nilai sudah diinput dan ranking sudah dihitung.</span>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-800 text-white font-bold sticky top-0 z-10">
                        <tr>
                            <th className="p-3 border border-slate-600 w-10 text-center sticky left-0 bg-slate-800 z-20">No</th>
                            <th className="p-3 border border-slate-600 w-32 sticky left-10 bg-slate-800 z-20">NIS</th>
                            <th className="p-3 border border-slate-600 w-64 sticky left-[10.5rem] bg-slate-800 z-20 shadow-xl">Nama Santri</th>
                            
                            {/* Loop Mapel Header */}
                            {dataLeger.mapel.map(m => (
                                <th key={m.id} className="p-3 border border-slate-600 text-center w-24 whitespace-nowrap">
                                    <div className="writing-vertical-lr rotate-180 h-32 flex items-center justify-center">
                                        {m.nama}
                                    </div>
                                </th>
                            ))}

                            <th className="p-3 border border-slate-600 text-center bg-orange-700 w-24">JUMLAH</th>
                            <th className="p-3 border border-slate-600 text-center bg-blue-700 w-24">RATA-RATA</th>
                            <th className="p-3 border border-slate-600 text-center bg-green-700 w-20">RANK</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {dataLeger.siswa.map((s, idx) => (
                            <tr key={s.id} className="hover:bg-yellow-50 transition-colors group">
                                <td className="p-2 border text-center sticky left-0 bg-white group-hover:bg-yellow-50 z-10">{idx + 1}</td>
                                <td className="p-2 border font-mono text-xs sticky left-10 bg-white group-hover:bg-yellow-50 z-10">{s.nis}</td>
                                <td className="p-2 border font-bold text-gray-800 sticky left-[10.5rem] bg-white group-hover:bg-yellow-50 z-10 shadow-lg border-r-2 border-r-gray-300 truncate max-w-xs">{s.nama}</td>

                                {/* Loop Nilai */}
                                {dataLeger.mapel.map(m => {
                                    const nilai = s.nilai[m.id]
                                    const isFail = nilai < 60 && nilai !== 0
                                    return (
                                        <td key={m.id} className={`p-2 border text-center font-mono ${isFail ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                                            {nilai || '-'}
                                        </td>
                                    )
                                })}

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