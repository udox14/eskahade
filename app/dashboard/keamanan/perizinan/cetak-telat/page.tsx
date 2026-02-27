'use client'

import { useState, useRef } from 'react'
import { getSantriTelat } from './actions'
import { PemanggilanTelatView } from './pemanggilan-telat-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, ArrowLeft, Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function CetakTelatPage() {
  const router = useRouter()
  const [tglRef, setTglRef] = useState(new Date().toISOString().split('T')[0])
  const [tglPanggil, setTglPanggil] = useState(new Date().toISOString().split('T')[0])
  
  const [data, setData] = useState<Record<string, any[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const printRef = useRef(null)
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Pemanggilan_Telat_${tglRef}`,
    onAfterPrint: () => toast.success("Dokumen dikirim ke printer")
  })

  const handleLoad = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getSantriTelat(tglRef)
    setData(res)
    setLoading(false)

    if (res) {
      const count = Object.values(res).reduce((acc: number, curr: any) => acc + curr.length, 0)
      toast.success(`Ditemukan ${count} santri terlambat pada periode ini.`)
    } else {
      toast.info("Tidak ada data santri terlambat pada minggu ini.")
    }
  }

  const totalSantri = data ? Object.values(data).reduce((acc, curr) => acc + curr.length, 0) : 0

  return (
    <div className="space-y-6">
      {/* HEADER NO-PRINT */}
      <div className="flex items-center gap-4 print:hidden">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cetak Santri Terlambat</h1>
          <p className="text-gray-500 text-sm">Daftar santri yang belum kembali melebihi batas izin (Per Minggu).</p>
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="bg-white p-6 rounded-xl border flex flex-col md:flex-row gap-6 items-end shadow-sm print:hidden">
        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-gray-700 block mb-1">1. Pilih Minggu (Tanggal Referensi)</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={tglRef}
            onChange={(e) => setTglRef(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Sistem otomatis mendeteksi periode Rabu - Selasa.</p>
        </div>

        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-gray-700 block mb-1">2. Tanggal Pemanggilan (Sidang)</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={tglPanggil}
            onChange={(e) => setTglPanggil(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Tanggal ini akan tertulis di surat.</p>
        </div>

        <div className="flex gap-2 items-center flex-1 justify-end">
          <button 
            onClick={handleLoad}
            disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tampilkan Data
          </button>
          
          {totalSantri > 0 && (
            <button 
              onClick={() => handlePrint()}
              className="bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 font-bold shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4"/> Cetak PDF
            </button>
          )}
        </div>
      </div>

      {/* PREVIEW AREA */}
      <div className="bg-gray-100 p-8 rounded-xl border overflow-auto min-h-[500px] flex justify-center items-start">
        {!hasSearched ? (
          <div className="text-center text-gray-400 py-32 flex flex-col items-center">
            <Search className="w-12 h-12 mb-3 text-gray-300"/>
            <p className="font-medium">Siap Mencari Data</p>
            <p className="text-sm">Silakan pilih tanggal dan klik tombol "Tampilkan Data".</p>
          </div>
        ) : loading ? (
          <div className="text-center py-32"><Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto"/></div>
        ) : !data || totalSantri === 0 ? (
          <div className="text-center text-gray-400 py-32 flex flex-col items-center bg-white p-10 rounded-xl border border-dashed">
            <p className="font-bold text-gray-600">Tidak Ada Data</p>
            <p className="text-sm">Tidak ditemukan santri terlambat pada periode minggu tersebut.</p>
          </div>
        ) : (
          /* AREA CETAK */
          <div ref={printRef}>
            <PemanggilanTelatView 
              dataPerAsrama={data}
              tglPanggil={new Date(tglPanggil)} 
            />
          </div>
        )}
      </div>
    </div>
  )
}