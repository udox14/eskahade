'use client'

import { useState, useRef } from 'react'
import { getRekapAlfaMingguan } from './actions'
import { PemanggilanView } from './pemanggilan-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, Search, Loader2 } from 'lucide-react'

export default function CetakPemanggilanPage() {
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
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cetak Pemanggilan</h1>
          <p className="text-slate-500 text-sm">Rekap santri untuk sidang pemanggilan alfa</p>
        </div>

        {data.length > 0 && (
          <button 
            onClick={() => handlePrint()}
            className="bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 transition-all font-bold"
          >
            <Printer className="w-4 h-4"/> Cetak PDF
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col gap-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">1. Pilih Pekan</label>
            <input 
              type="date" 
              className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-bold"
              value={tglRef}
              onChange={(e) => setTglRef(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1 italic">Otomatis deteksi periode Rabu - Selasa</p>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1">2. Tanggal Panggil</label>
            <input 
              type="date" 
              className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-bold"
              value={tglPanggil}
              onChange={(e) => setTglPanggil(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1 italic">Tanggal ini akan muncul di surat</p>
          </div>

          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer group w-fit">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                checked={onlyMangkir}
                onChange={(e) => setOnlyMangkir(e.target.checked)}
              />
              <span className={`text-sm font-bold ${onlyMangkir ? 'text-blue-600' : 'text-slate-700'}`}>Hanya Santri Mangkir</span>
            </label>
            <p className="text-xs text-slate-500 mt-1">Cetak santri yang tidak hadir sidang sebelumnya</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button 
            onClick={handleLoad}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
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
