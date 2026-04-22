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
  
  const [onlyMangkir, setOnlyMangkir] = useState(false)
  
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
    const res = await getRekapAlfaMingguan(tglRef, onlyMangkir)
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-white border border-slate-100 shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cetak Pemanggilan</h1>
            <p className="text-slate-500 font-medium">Rekap santri untuk sidang pemanggilan alfa</p>
          </div>
        </div>

        {data.length > 0 && (
          <button 
            onClick={() => handlePrint()}
            className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] font-bold"
          >
            <Printer className="w-5 h-5"/> Cetak Surat (PDF)
          </button>
        )}
      </div>

      {/* FILTER BAR - PREMIUM DESIGN */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative group">
            <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-blue-600 transition-colors">1. Pilih Pekan</label>
            <input 
              type="date" 
              className="w-full pl-3 pr-3 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 font-bold transition-all hover:border-slate-300"
              value={tglRef}
              onChange={(e) => setTglRef(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1 italic">* Otomatis deteksi periode Rabu - Selasa</p>
          </div>

          <div className="relative group">
            <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-blue-600 transition-colors">2. Tanggal Panggil</label>
            <input 
              type="date" 
              className="w-full pl-3 pr-3 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 font-bold transition-all hover:border-slate-300"
              value={tglPanggil}
              onChange={(e) => setTglPanggil(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1 italic">* Tanggal ini akan muncul di surat</p>
          </div>

          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={onlyMangkir}
                  onChange={(e) => setOnlyMangkir(e.target.checked)}
                />
                <div className={`w-12 h-6 rounded-full transition-colors ${onlyMangkir ? 'bg-orange-500' : 'bg-slate-200'}`}></div>
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${onlyMangkir ? 'translate-x-6' : ''}`}></div>
              </div>
              <span className={`text-sm font-bold transition-colors ${onlyMangkir ? 'text-orange-600' : 'text-slate-500'}`}>Hanya Santri Mangkir</span>
            </label>
            <p className="text-[10px] text-slate-400 mt-1">Cetak yang tidak hadir sidang sebelumnya</p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button 
            onClick={handleLoad}
            disabled={loading}
            className="bg-slate-900 text-white px-10 py-3.5 rounded-2xl flex items-center gap-2 hover:bg-black disabled:opacity-50 transition-all active:scale-[0.98] font-bold shadow-lg shadow-slate-200"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
            Tampilkan Data
          </button>
        </div>
      </div>

      {/* PREVIEW AREA */}
      <div className="bg-slate-100 p-8 rounded-xl border overflow-auto min-h-[500px] flex justify-center">
        {!periode ? (
          <div className="text-center text-slate-400 py-20">Silakan pilih tanggal dan klik Tampilkan.</div>
        ) : data.length === 0 ? (
           <div className="text-center text-slate-400 py-20">Tidak ada data alfa pada periode ini.</div>
        ) : (
          <div ref={printRef}>
            {sortedAsramaKeys.map((asrama) => (
              <div key={asrama} style={{ pageBreakAfter: 'always' }} className="mb-8 last:mb-0 print:mb-0">
                <PemanggilanView 
                  data={groupedData[asrama]} 
                  periode={periode} 
                  tglPanggil={new Date(tglPanggil)}
                  namaAsrama={asrama}
                  isMangkir={onlyMangkir}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}