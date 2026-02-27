'use client'

import { useState, useRef } from 'react'
import { getRekapAlfaMingguan } from './actions'
import { PemanggilanView } from './pemanggilan-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, Search, Loader2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CetakPemanggilanPage() {
  const router = useRouter()
  const [tglRef, setTglRef] = useState(new Date().toISOString().split('T')[0])
  const [tglPanggil, setTglPanggil] = useState(new Date().toISOString().split('T')[0])
  
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [periode, setPeriode] = useState<{start:Date, end:Date} | null>(null)

  const printRef = useRef(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef, 
    documentTitle: `Pemanggilan_Alfa_${tglRef}`,
  })

  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = (day < 3 ? day + 7 : day) - 3;
    d.setDate(d.getDate() - diff);
    const start = new Date(d);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }

  const handleLoad = async () => {
    setLoading(true)
    const res = await getRekapAlfaMingguan(tglRef)
    setData(res)
    setPeriode(getWeekRange(new Date(tglRef)))
    setLoading(false)
  }

  const groupedData = data.reduce((groups, item) => {
    const asrama = item.asrama || 'NON-ASRAMA';
    if (!groups[asrama]) groups[asrama] = [];
    groups[asrama].push(item);
    return groups;
  }, {} as Record<string, any[]>);

  const sortedAsramaKeys = Object.keys(groupedData).sort();

  return (
    <div className="space-y-6">
      {/* HEADER NO-PRINT */}
      <div className="flex items-center gap-4 print:hidden">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cetak Pemanggilan Alfa</h1>
          <p className="text-gray-500 text-sm">Rekap santri yang alfa dalam satu pekan pengajian.</p>
        </div>
      </div>

      {/* FILTER BAR NO-PRINT */}
      <div className="bg-white p-6 rounded-xl border flex flex-col md:flex-row gap-6 items-end shadow-sm print:hidden">
        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-gray-700 block mb-1">1. Pilih Minggu (Tanggal Salah Satu Hari)</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-lg"
            value={tglRef}
            onChange={(e) => setTglRef(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Otomatis deteksi periode Rabu - Selasa</p>
        </div>

        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-gray-700 block mb-1">2. Tanggal Eksekusi / Pemanggilan</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-lg"
            value={tglPanggil}
            onChange={(e) => setTglPanggil(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Tanggal ini akan muncul di surat</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleLoad}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tampilkan Data
          </button>
          
          {data.length > 0 && (
            <button 
              onClick={() => handlePrint()}
              className="bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800"
            >
              <Printer className="w-4 h-4"/> Cetak PDF
            </button>
          )}
        </div>
      </div>

      {/* PREVIEW AREA */}
      <div className="bg-gray-100 p-8 rounded-xl border overflow-auto min-h-[500px] flex justify-center">
        {!periode ? (
          <div className="text-center text-gray-400 py-20">Silakan pilih tanggal dan klik Tampilkan.</div>
        ) : data.length === 0 ? (
           <div className="text-center text-gray-400 py-20">Tidak ada data alfa pada periode ini.</div>
        ) : (
          <div ref={printRef}>
            {sortedAsramaKeys.map((asrama) => (
              <div key={asrama} style={{ pageBreakAfter: 'always' }} className="mb-8 last:mb-0 print:mb-0">
                <PemanggilanView 
                  data={groupedData[asrama]} 
                  periode={periode} 
                  tglPanggil={new Date(tglPanggil)}
                  namaAsrama={asrama}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}