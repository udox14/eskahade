'use client'

import { useState, useEffect } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, School, GraduationCap, ArrowRightLeft, Loader2, BookOpen, Bed } from 'lucide-react'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [asrama])

  const loadData = async () => {
    setLoading(true)
    const res = await getSensusData(asrama)
    setData(res)
    setLoading(false)
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>

  // Sort Asrama Keys
  const asramaKeys = data?.distribusi_kamar ? Object.keys(data.distribusi_kamar).sort() : []

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
         <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <BarChart3 className="w-8 h-8 text-blue-600"/> Sensus Penduduk
            </h1>
            <p className="text-gray-500 text-sm">Statistik demografi santri {asrama !== 'SEMUA' ? `Asrama ${asrama}` : 'Se-Pesantren'}.</p>
         </div>
         
         <div className="bg-white p-1 rounded-lg border shadow-sm flex items-center gap-2">
            <Home className="w-4 h-4 ml-2 text-gray-400"/>
            <select 
               value={asrama} 
               onChange={(e) => setAsrama(e.target.value)}
               className="bg-transparent font-bold text-sm text-gray-700 p-2 outline-none cursor-pointer"
            >
               {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
         </div>
      </div>

      {/* 1. RINGKASAN UTAMA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <StatCard label="Total Penduduk" value={data.total} icon={Users} color="bg-blue-600" />
         <StatCard label="Santri Baru (Bln Ini)" value={data.masuk_bulan_ini} icon={ArrowRightLeft} color="bg-green-600" />
         <StatCard label="Santri Keluar (Bln Ini)" value={data.keluar_bulan_ini} icon={ArrowRightLeft} color="bg-red-600" />
         <StatCard label="Mahasiswa" value={data.jenjang.KULIAH} icon={GraduationCap} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* 2. STATISTIK JENJANG SEKOLAH */}
         <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                <School className="w-5 h-5 text-blue-500"/> Jenjang Pendidikan Formal
            </h3>
            <div className="space-y-5">
               <ProgressBar label="SLTP (MTS/SMP)" value={data.jenjang.SLTP} total={data.total} color="bg-blue-500" />
               <ProgressBar label="SLTA (MA/SMA/SMK)" value={data.jenjang.SLTA} total={data.total} color="bg-indigo-500" />
               <ProgressBar label="Perguruan Tinggi" value={data.jenjang.KULIAH} total={data.total} color="bg-purple-500" />
               <ProgressBar label="Tidak Sekolah / Lainnya" value={data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA} total={data.total} color="bg-gray-400" />
            </div>
            
            <div className="mt-8 pt-4 border-t border-dashed">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Rincian Sekolah:</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(data.jenjang.detail).map(([key, val]: any) => (
                        <span key={key} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border">
                            {key}: <b>{val}</b>
                        </span>
                    ))}
                </div>
            </div>
         </div>

         {/* 3. STATISTIK KELAS & MARHALAH */}
         <div className="space-y-6">
            
            {/* Marhalah */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <BookOpen className="w-5 h-5 text-green-600"/> Sebaran Marhalah (Diniyah)
               </h3>
               <div className="grid grid-cols-2 gap-3">
                  {Object.entries(data.marhalah).map(([key, val]: any) => (
                     <div key={key} className="bg-green-50 text-green-800 px-4 py-3 rounded-lg border border-green-100 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase">{key}</span>
                        <span className="font-extrabold text-lg">{val}</span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Kelas Sekolah */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <GraduationCap className="w-5 h-5 text-orange-600"/> Detail Kelas Sekolah
               </h3>
               <div className="grid grid-cols-4 gap-2">
                  {Object.entries(data.kelas_sekolah).sort().map(([key, val]: any) => (
                     <div key={key} className="text-center p-2 rounded bg-slate-50 border border-slate-100">
                        <span className="block text-[10px] text-slate-500 font-bold">KLS {key}</span>
                        <span className="font-bold text-slate-800 text-lg">{val}</span>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      </div>

      {/* 4. STATISTIK PER KAMAR (BARU) */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
         <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
            <Bed className="w-5 h-5 text-indigo-500"/> Kepadatan Penduduk per Kamar
         </h3>
         
         <div className="space-y-8">
            {asramaKeys.map(namaAsrama => {
                const kamarData = data.distribusi_kamar[namaAsrama]
                const sortedKamars = Object.keys(kamarData).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
                
                return (
                    <div key={namaAsrama} className="border-b last:border-0 pb-6 last:pb-0">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Home className="w-4 h-4"/> Asrama {namaAsrama}
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {sortedKamars.map(kamar => (
                                <div key={kamar} className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center hover:bg-indigo-100 transition-colors">
                                    <span className="block text-[10px] text-indigo-400 font-bold mb-1">KAMAR {kamar}</span>
                                    <span className="block text-xl font-extrabold text-indigo-700">{kamarData[kamar]}</span>
                                    <span className="block text-[9px] text-indigo-400">Jiwa</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
         </div>
      </div>

    </div>
  )
}

// --- SUB COMPONENTS ---

function StatCard({ label, value, icon: Icon, color }: any) {
   return (
      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
         <div className={`p-3 rounded-full text-white shadow-sm ${color}`}><Icon className="w-5 h-5"/></div>
         <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-extrabold text-gray-800">{value}</p>
         </div>
      </div>
   )
}

function ProgressBar({ label, value, total, color }: any) {
   const percent = total > 0 ? Math.round((value / total) * 100) : 0
   return (
      <div>
         <div className="flex justify-between text-sm mb-1">
            <span className="font-bold text-gray-700">{label}</span>
            <span className="font-bold text-gray-900">{value} <span className="text-xs text-gray-400 font-normal">({percent}%)</span></span>
         </div>
         <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
         </div>
      </div>
   )
}