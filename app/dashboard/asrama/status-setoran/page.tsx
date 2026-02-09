'use client'

import { useState, useEffect } from 'react'
import { getStatusSetoranSaya } from './actions'
import { Loader2, CheckCircle, XCircle, Calendar, Home, AlertCircle } from 'lucide-react'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function StatusSetoranPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [statusData, setStatusData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [tahun])

  const loadData = async () => {
    setLoading(true)
    const res = await getStatusSetoranSaya(tahun)
    setStatusData(res)
    setLoading(false)
  }

  const currentMonth = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Home className="w-6 h-6 text-indigo-600"/> Status Setoran Asrama
           </h1>
           <p className="text-gray-500 text-sm">
             Rekapitulasi setoran SPP {statusData?.asrama ? `Asrama ${statusData.asrama}` : ''} ke Pusat.
           </p>
        </div>

        <div className="flex items-center gap-2 bg-white border rounded-lg p-1 shadow-sm">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">-</button>
            <span className="px-2 font-mono font-bold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4"/> {tahun}
            </span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">+</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
      ) : statusData?.error ? (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-8 h-8 mx-auto mb-2"/>
          {statusData.error}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {BULAN_LIST.map((namaBulan, idx) => {
            const bulanIndex = idx + 1
            const info = statusData.data[bulanIndex]
            const isLunas = !!info
            const isPast = (tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonth)
            
            return (
              <div key={bulanIndex} className={`p-5 rounded-xl border-2 flex flex-col justify-between h-32 transition-all ${
                isLunas ? 'bg-green-50 border-green-200' : 
                isPast ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'
              }`}>
                <div className="flex justify-between items-start">
                  <span className={`font-bold text-lg ${isLunas ? 'text-green-800' : isPast ? 'text-red-800' : 'text-slate-700'}`}>
                    {namaBulan}
                  </span>
                  {isLunas ? <CheckCircle className="w-6 h-6 text-green-600"/> : isPast ? <XCircle className="w-6 h-6 text-red-400"/> : null}
                </div>

                <div className="text-xs mt-2">
                  {isLunas ? (
                    <>
                      <p className="font-bold text-green-700 uppercase tracking-wider mb-1">SUDAH DISETOR</p>
                      <p className="text-green-600 opacity-80">Diterima: {new Date(info.tanggal).toLocaleDateString('id-ID')}</p>
                      <p className="text-green-600 opacity-80">Oleh: {info.penerima}</p>
                    </>
                  ) : (
                    <>
                      <p className={`font-bold uppercase tracking-wider mb-1 ${isPast ? 'text-red-700' : 'text-slate-400'}`}>
                        {isPast ? 'BELUM SETOR' : 'BELUM JATUH TEMPO'}
                      </p>
                      {isPast && <p className="text-red-600 opacity-80">Segera hubungi Dewan Santri</p>}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}