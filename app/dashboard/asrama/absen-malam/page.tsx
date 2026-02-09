'use client'

import { useState, useEffect } from 'react'
import { getDataAbsenMalam, updateAbsenMalam, getUserRestriction } from './actions'
import { Moon, Home, User, Check, X, Loader2, AlertCircle, ChevronLeft, ChevronRight, Lock } from 'lucide-react'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function AbsenMalamPage() {
  const [selectedAsrama, setSelectedAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null) // Asrama Binaan User
  
  const [dataSantri, setDataSantri] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [currentKamarIndex, setCurrentKamarIndex] = useState(0)

  // 1. Cek User Permission saat Load
  useEffect(() => {
    getUserRestriction().then(asrama => {
      if (asrama) {
        setUserAsrama(asrama)
        setSelectedAsrama(asrama) // Paksa pilih asrama binaan
      }
    })
  }, [])

  // 2. Load Data (Dependensi: selectedAsrama)
  useEffect(() => {
    loadData()
  }, [selectedAsrama])

  const loadData = async () => {
    setLoading(true)
    const res = await getDataAbsenMalam(selectedAsrama)
    setDataSantri(res)
    setLoading(false)
    setCurrentKamarIndex(0)
  }

  // Handle Klik Absen
  const handleAbsen = async (santriId: string, status: 'HADIR' | 'TIDAK') => {
    setProcessingId(santriId)
    setDataSantri(prev => prev.map(s => s.id === santriId ? { ...s, status: status } : s))
    await updateAbsenMalam(santriId, status)
    setProcessingId(null)
  }

  // Grouping & Sorting
  const groupedData = dataSantri.reduce((acc, santri) => {
    const k = santri.kamar || "Tanpa Kamar"
    if (!acc[k]) acc[k] = []
    acc[k].push(santri)
    return acc
  }, {} as Record<string, any[]>)

  const sortedKamars = Object.keys(groupedData).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))

  // Statistik Realtime
  const totalSantri = dataSantri.length
  const hadir = dataSantri.filter(s => s.status === 'HADIR').length
  const tidak = dataSantri.filter(s => s.status === 'TIDAK').length
  const izin = dataSantri.filter(s => s.is_izin).length
  
  // Data Kamar Aktif
  const activeKamar = sortedKamars[currentKamarIndex]
  const santriInKamar = activeKamar ? groupedData[activeKamar] : []

  // Navigasi
  const prevKamar = () => { if (currentKamarIndex > 0) setCurrentKamarIndex(prev => prev - 1) }
  const nextKamar = () => { if (currentKamarIndex < sortedKamars.length - 1) setCurrentKamarIndex(prev => prev + 1) }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32">
      
      {/* HEADER & FILTER */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Moon className="w-5 h-5 text-yellow-300"/> Absen Malam
              </h1>
              <p className="text-slate-400 text-xs">Pantauan per kamar.</p>
            </div>
            
            {/* Dropdown Asrama (Locked jika User Terbatas) */}
            <div className={`p-1 rounded-lg inline-flex items-center gap-2 ${userAsrama ? 'bg-green-800/50 border border-green-700' : 'bg-white/10'}`}>
                {userAsrama ? <Lock className="w-3 h-3 ml-2 text-green-400"/> : <Home className="w-4 h-4 ml-2 text-slate-300"/>}
                <select 
                  value={selectedAsrama}
                  onChange={(e) => setSelectedAsrama(e.target.value)}
                  disabled={!!userAsrama} // Disable jika user punya asrama binaan
                  className={`bg-transparent text-white font-bold text-sm outline-none p-2 w-32 ${userAsrama ? 'cursor-not-allowed opacity-90' : 'cursor-pointer [&>option]:text-black'}`}
                >
                  {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
          </div>
          
          <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400">Total Hadir</p>
                <p className="text-2xl font-bold">{hadir}<span className="text-sm text-slate-500 font-normal">/{totalSantri}</span></p>
              </div>
              <div className="flex gap-2 text-[10px] font-bold">
                 <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">ALFA: {tidak}</span>
                 <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">IZIN: {izin}</span>
              </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
      </div>

      {/* NAVIGATION CONTROLS */}
      {!loading && sortedKamars.length > 0 && (
         <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border">
            <button onClick={prevKamar} disabled={currentKamarIndex === 0} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600">
                <ChevronLeft className="w-6 h-6"/>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Kamar Saat Ini</span>
                <select value={currentKamarIndex} onChange={(e) => setCurrentKamarIndex(Number(e.target.value))} className="font-bold text-lg text-gray-800 text-center outline-none bg-transparent cursor-pointer">
                    {sortedKamars.map((k, idx) => <option key={k} value={idx}>{k}</option>)}
                </select>
            </div>
            <button onClick={nextKamar} disabled={currentKamarIndex === sortedKamars.length - 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600">
                <ChevronRight className="w-6 h-6"/>
            </button>
         </div>
      )}

      {/* LIST PER KAMAR */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
      ) : totalSantri === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed text-gray-400">
          Tidak ada santri terdaftar di asrama {selectedAsrama}.
        </div>
      ) : (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300" key={activeKamar}>
              <div className="bg-slate-50 px-5 py-3 border-b flex justify-between items-center">
                <h3 className="font-extrabold text-lg text-slate-800">KAMAR {activeKamar}</h3>
                <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{santriInKamar?.length || 0} Santri</span>
              </div>
              <div className="divide-y divide-slate-100">
                {santriInKamar?.map((santri: any) => (
                  <div key={santri.id} className="p-4 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 ${
                        santri.status === 'HADIR' ? 'bg-green-100 text-green-700 border-green-200' :
                        santri.status === 'TIDAK' ? 'bg-red-100 text-red-700 border-red-200' :
                        santri.is_izin ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>{santri.nis.slice(-2)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate leading-tight">{santri.nama_lengkap}</p>
                        {santri.is_izin ? (
                          <p className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3"/> SEDANG IZIN</p>
                        ) : (<p className="text-[10px] text-gray-400 font-mono mt-0.5">{santri.nis}</p>)}
                      </div>
                    </div>
                    {!santri.is_izin ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleAbsen(santri.id, 'TIDAK')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${santri.status === 'TIDAK' ? 'bg-red-600 text-white shadow-lg' : 'bg-red-50 text-red-300'}`}><X className="w-5 h-5"/></button>
                        <button onClick={() => handleAbsen(santri.id, 'HADIR')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${santri.status === 'HADIR' ? 'bg-green-600 text-white shadow-lg' : 'bg-green-50 text-green-300'}`}><Check className="w-5 h-5"/></button>
                      </div>
                    ) : (
                       <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold border border-blue-100">{santri.status.replace('IZIN: ', '')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}

      {/* FOOTER NAVIGATION */}
      {!loading && sortedKamars.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-40">
           <div className="bg-slate-900 text-white p-2 rounded-full shadow-2xl flex items-center gap-4 border border-slate-700">
              <button onClick={prevKamar} disabled={currentKamarIndex === 0} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-30 transition-colors"><ChevronLeft className="w-6 h-6"/></button>
              <div className="text-center px-2 min-w-[100px]"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">KAMAR</p><p className="text-lg font-bold leading-none">{activeKamar}</p></div>
              <button onClick={nextKamar} disabled={currentKamarIndex === sortedKamars.length - 1} className="p-3 bg-white text-slate-900 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors font-bold shadow-lg"><ChevronRight className="w-6 h-6"/></button>
           </div>
        </div>
      )}
    </div>
  )
}