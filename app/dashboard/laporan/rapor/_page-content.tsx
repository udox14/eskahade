'use client'

import { useState, useEffect, useRef } from 'react'
import { getKelasList, getDataRapor } from './actions'
import { Printer, Loader2, Search, FileText } from 'lucide-react'
import { RaporSatuHalaman } from './rapor-view'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner' 

export default function CetakRaporPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  
  const [dataRapor, setDataRapor] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Ref untuk area yang akan diprint
  const printRef = useRef(null)

  // Hook Print
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

  // Load Kelas
  useEffect(() => {
    getKelasList().then(setKelasList)
  }, [])

  // Load Data
  const handleLoad = async () => {
    if (!selectedKelas) {
      toast.warning("Mohon pilih Kelas terlebih dahulu.")
      return
    }

    setLoading(true)
    const loadToast = toast.loading("Mengambil data nilai dan ranking...")
    
    // Reset data lama biar kerasa refreshnya
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
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      {/* HEADER NO-PRINT */}
      <div className="flex justify-between items-center print:hidden flex-none">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cetak Rapor Santri</h1>
          <p className="text-gray-500 text-sm">Preview dan cetak rapor hasil belajar (Format A4).</p>
        </div>
      </div>

      {/* FILTER BAR NO-PRINT */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end print:hidden flex-none">
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium text-gray-700 block mb-1">Kelas</label>
          <select 
            className="p-2 border rounded-md w-full md:w-48 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Pilih --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium text-gray-700 block mb-1">Semester</label>
          <select 
            className="p-2 border rounded-md w-full md:w-32 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Ganjil</option>
            <option value="2">Genap</option>
          </select>
        </div>
        
        <button 
          onClick={handleLoad}
          disabled={!selectedKelas || loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 font-medium transition-all active:scale-95 w-full md:w-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
          Tampilkan
        </button>
        
        {dataRapor.length > 0 && (
          <button 
            onClick={triggerPrint}
            className="bg-green-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-800 ml-auto font-bold shadow-md transition-all active:scale-95 w-full md:w-auto"
          >
            <Printer className="w-4 h-4"/> Cetak PDF (Semua)
          </button>
        )}
      </div>

      {/* AREA PREVIEW & PRINT (Scrollable) */}
      <div className="bg-slate-100 p-8 rounded-xl border flex-1 overflow-y-auto overflow-x-hidden flex justify-center relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-500"/>
            <p>Sedang menyusun rapor...</p>
          </div>
        ) : dataRapor.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-3 text-gray-300"/>
            <p className="font-medium">Belum ada data ditampilkan.</p>
            <p className="text-sm">Silakan pilih kelas dan klik tombol Tampilkan.</p>
          </div>
        ) : (
          /* DIV INI YANG AKAN DIPRINT */
          <div ref={printRef} className="w-fit bg-white shadow-2xl print:shadow-none">
             {/* Print Wrapper */}
             <div className="print:block">
                {dataRapor.map((siswa, idx) => (
                  <div key={siswa.id} className="mb-10 last:mb-0 print:mb-0 break-after-page">
                    <RaporSatuHalaman 
                      data={siswa} 
                      semester={Number(selectedSemester)} 
                    />
                    {/* Pembatas Visual di Layar (Tidak ikut diprint) */}
                    <div className="h-4 bg-slate-100 w-full print:hidden border-y border-dashed border-gray-300 relative top-5 flex items-center justify-center">
                        <span className="bg-slate-100 px-2 text-[10px] text-gray-400">Halaman Berikutnya</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  )
}