'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getRekapKinerjaGuru } from './actions'
import { Filter, Search, Loader2, Briefcase, UserX, UserCheck, Calendar, ArrowLeft } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

export default function RekapAbsensiGuruPage() {
  // State Filter
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  
  // OPSI BADAL: true = Hadir, false = Kosong
  const [badalAsHadir, setBadalAsHadir] = useState(true)

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Init Data (Client Side Only untuk menghindari mismatch server/client date)
  useEffect(() => {
    // Set default date hari ini
    const now = new Date()
    setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    
    // Load marhalah
    getMarhalahList().then(setMarhalahList)
  }, [])

  const handleCari = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getRekapKinerjaGuru(startDate, endDate, selectedMarhalah, badalAsHadir)
    setData(res)
    setLoading(false)
  }

  // Shortcut Tanggal
  const setRange = (type: 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date()
    if (type === 'THIS_MONTH') {
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
        setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else {
        setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'))
        setEndDate(format(now, 'yyyy-MM-dd'))
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
           <Link href="/dashboard/akademik/absensi-guru" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600"/>
           </Link>
           <div>
             <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <Briefcase className="w-6 h-6 text-indigo-600"/> Rekap Kinerja Guru
             </h1>
             <p className="text-gray-500 text-sm">Evaluasi kehadiran pengajar berdasarkan jadwal kelas.</p>
           </div>
        </div>
        
        {/* Shortcut Buttons */}
        <div className="flex gap-2">
            <button onClick={() => setRange('THIS_WEEK')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100">7 Hari Terakhir</button>
            <button onClick={() => setRange('THIS_MONTH')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100">Bulan Ini</button>
        </div>
      </div>

      {/* FILTER BAR KOMPLEKS */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* TANGGAL */}
            <div className="md:col-span-2 flex gap-2 items-end">
                <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Dari</label>
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Sampai</label>
                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
                </div>
            </div>

            {/* MARHALAH */}
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filter Tingkat</label>
                <select value={selectedMarhalah} onChange={e=>setSelectedMarhalah(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white">
                    <option value="">Semua Tingkat</option>
                    {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
            </div>

            {/* TOMBOL CARI */}
            <div className="flex items-end">
                <button 
                    onClick={handleCari}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 h-[38px]"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} 
                    Tampilkan Rekap
                </button>
            </div>
         </div>

         {/* OPSI BADAL (TOGGLE) */}
         <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
             <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><Filter className="w-4 h-4"/> Opsi Perhitungan:</span>
             
             <div className="flex gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="radio" 
                        name="badalOpt" 
                        checked={badalAsHadir === true} 
                        onChange={() => setBadalAsHadir(true)}
                        className="accent-indigo-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">Badal = <b className="text-green-600">Terisi (Hadir)</b></span>
                 </label>
                 
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="radio" 
                        name="badalOpt" 
                        checked={badalAsHadir === false} 
                        onChange={() => setBadalAsHadir(false)}
                        className="accent-red-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">Badal = <b className="text-red-600">Kosong (Alfa)</b></span>
                 </label>
             </div>
         </div>
      </div>

      {/* TABEL HASIL */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {!hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full py-32 text-gray-400">
                <Search className="w-16 h-16 mb-4 text-gray-200"/>
                <p>Silakan atur filter dan klik <b>Tampilkan Rekap</b>.</p>
            </div>
        ) : loading ? (
             <div className="py-32 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
        ) : data.length === 0 ? (
             <div className="py-32 text-center text-gray-400">Tidak ada data jadwal/absensi pada periode ini.</div>
        ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-indigo-900 text-white font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4 rounded-tl-xl">Nama Guru</th>
                            <th className="px-6 py-4">Jadwal (Kelas & Sesi)</th>
                            <th className="px-6 py-4 text-center">Wajib</th>
                            <th className="px-6 py-4 text-center bg-green-700/50">Hadir</th>
                            <th className="px-6 py-4 text-center bg-yellow-600/50">Badal</th>
                            <th className="px-6 py-4 text-center bg-red-700/50">Kosong</th>
                            <th className="px-6 py-4 text-right rounded-tr-xl w-48">Performa</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row) => (
                            <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-800 text-base">{row.nama}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-[10px] text-gray-500 leading-relaxed max-w-xs">{row.kelas_ajar}</p>
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-gray-700">{row.total_wajib}</td>
                                <td className="px-6 py-4 text-center font-bold text-green-600 bg-green-50/30">{row.hadir}</td>
                                <td className="px-6 py-4 text-center font-bold text-yellow-600 bg-yellow-50/30">{row.badal}</td>
                                <td className="px-6 py-4 text-center font-bold text-red-600 bg-red-50/30">{row.kosong}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-lg font-extrabold ${
                                            row.persentase >= 90 ? 'text-green-600' :
                                            row.persentase >= 75 ? 'text-blue-600' :
                                            row.persentase >= 50 ? 'text-orange-500' : 'text-red-600'
                                        }`}>
                                            {row.persentase}%
                                        </span>
                                        {/* Progress Bar Visual */}
                                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${
                                                    row.persentase >= 90 ? 'bg-green-500' :
                                                    row.persentase >= 75 ? 'bg-blue-500' :
                                                    row.persentase >= 50 ? 'bg-orange-500' : 'bg-red-500'
                                                }`} 
                                                style={{width: `${row.persentase}%`}}
                                            />
                                        </div>
                                    </div>
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