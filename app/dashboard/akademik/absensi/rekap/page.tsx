'use client'

import { useState, useEffect } from 'react'
import { getUserScope, getRekapAbsensi, getDetailAbsensiSantri, getReferensiFilter } from './actions'
import { Search, Filter, Loader2, User, Home, BookOpen, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function RekapAbsensiPage() {
  // State Filter
  const [scope, setScope] = useState<any>(null)
  const [filterAsrama, setFilterAsrama] = useState('')
  const [filterKamar, setFilterKamar] = useState('') // FILTER BARU
  const [filterKelas, setFilterKelas] = useState('')
  const [searchName, setSearchName] = useState('')
  
  const [refKelas, setRefKelas] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const [hasSearched, setHasSearched] = useState(false)

  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detailAbsen, setDetailAbsen] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // INIT
  useEffect(() => {
    async function init() {
      const s = await getUserScope()
      setScope(s)
      
      // Set Default Filter berdasarkan Scope
      if (s.type === 'ASRAMA') setFilterAsrama(s.value)
      if (s.type === 'KELAS') setFilterKelas(s.value)

      const ref = await getReferensiFilter()
      setRefKelas(ref.kelas)
    }
    init()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setHasSearched(true)
    // Pass filterKamar ke action
    const res = await getRekapAbsensi(searchName, filterAsrama, filterKelas, filterKamar)
    setData(res)
    setLoading(false)
  }

  const handleViewDetail = async (santri: any) => {
    setSelectedSantri(santri)
    setLoadingDetail(true)
    const res = await getDetailAbsensiSantri(santri.id)
    setDetailAbsen(res)
    setLoadingDetail(false)
  }

  const closeDetail = () => {
    setSelectedSantri(null)
    setDetailAbsen([])
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Filter className="w-6 h-6 text-blue-600"/> Rekapitulasi Kehadiran
           </h1>
           <p className="text-gray-500 text-sm">Monitoring kedisiplinan pengajian santri.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
         
         {/* Filter Asrama */}
         <div className="w-full md:w-1/5">
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Asrama</label>
            <select 
              value={filterAsrama}
              onChange={(e) => { 
                  setFilterAsrama(e.target.value); 
                  setFilterKamar(''); // Reset kamar saat ganti asrama
              }}
              disabled={scope?.type === 'ASRAMA'}
              className={`w-full p-2 border rounded-lg text-sm outline-none ${scope?.type === 'ASRAMA' ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-2 focus:ring-blue-500'}`}
            >
              <option value="">Semua Asrama</option>
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
         </div>

         {/* Filter Kamar (BARU) */}
         <div className="w-full md:w-1/6">
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kamar</label>
            <select 
              value={filterKamar}
              onChange={(e) => setFilterKamar(e.target.value)}
              disabled={!filterAsrama} // Disable jika belum pilih asrama
              className="w-full p-2 border rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Semua</option>
              {/* Loop kamar 1-50 */}
              {Array.from({length: 50}, (_, i) => i + 1).map(k => (
                  <option key={k} value={k}>{k}</option>
              ))}
            </select>
         </div>

         {/* Filter Kelas */}
         <div className="w-full md:w-1/5">
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kelas</label>
            <select 
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              disabled={scope?.type === 'KELAS'}
              className={`w-full p-2 border rounded-lg text-sm outline-none ${scope?.type === 'KELAS' ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-2 focus:ring-blue-500'}`}
            >
              <option value="">Semua Kelas</option>
              {refKelas.map((k: any) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
         </div>

         {/* Search Nama */}
         <div className="w-full md:flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input 
              type="text" 
              placeholder="Cari Nama Santri..." 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
         </div>

         <button 
           onClick={loadData}
           disabled={loading}
           className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition-colors h-[38px] disabled:opacity-50 flex items-center gap-2"
         >
           {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Tampilkan"}
         </button>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {!hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full py-32 text-gray-400">
                <Search className="w-16 h-16 mb-4 text-gray-200"/>
                <p className="text-lg font-medium text-gray-500">Siap Menampilkan Data</p>
                <p className="text-sm">Silakan pilih filter dan klik tombol <b>Tampilkan</b>.</p>
            </div>
        ) : loading ? (
            <div className="text-center py-32"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500"/></div>
        ) : data.length === 0 ? (
            <div className="text-center py-32 text-gray-400">Tidak ada data ditemukan sesuai filter.</div>
        ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                     <tr>
                        <th className="px-6 py-3">Nama Santri</th>
                        <th className="px-6 py-3">Kelas / Asrama</th>
                        <th className="px-6 py-3 text-center text-red-600">Alfa</th>
                        <th className="px-6 py-3 text-center text-yellow-600">Sakit</th>
                        <th className="px-6 py-3 text-center text-blue-600">Izin</th>
                        <th className="px-6 py-3 text-right">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {data.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                           <td className="px-6 py-3 font-medium text-gray-800">{row.nama} <br/><span className="text-[10px] text-gray-400 font-mono">{row.nis}</span></td>
                           <td className="px-6 py-3 text-xs text-gray-500">
                              <div className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> {row.info_kelas}</div>
                              <div className="flex items-center gap-1 mt-1"><Home className="w-3 h-3"/> {row.info_asrama}</div>
                           </td>
                           <td className="px-6 py-3 text-center font-bold text-red-600 bg-red-50/50">{row.total_a || '-'}</td>
                           <td className="px-6 py-3 text-center font-medium text-yellow-600">{row.total_s || '-'}</td>
                           <td className="px-6 py-3 text-center font-medium text-blue-600">{row.total_i || '-'}</td>
                           <td className="px-6 py-3 text-right">
                              <button 
                                onClick={() => handleViewDetail(row)}
                                className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 hover:text-blue-600 transition-colors"
                              >
                                Lihat Detail
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
        )}
      </div>

      {/* MODAL DETAIL */}
      {selectedSantri && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
               
               {/* Header Modal */}
               <div className="p-5 border-b bg-gray-50 flex justify-between items-start">
                  <div>
                     <h3 className="font-bold text-lg text-gray-800">{selectedSantri.nama}</h3>
                     <p className="text-xs text-gray-500">{selectedSantri.info_kelas} • {selectedSantri.info_asrama}</p>
                  </div>
                  <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
               </div>

               {/* Content List */}
               <div className="p-0 overflow-y-auto flex-1">
                  {loadingDetail ? (
                     <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
                  ) : detailAbsen.length === 0 ? (
                     <div className="py-10 text-center text-gray-400 italic">Tidak ada catatan ketidakhadiran. Rajin!</div>
                  ) : (
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0">
                           <tr>
                              <th className="px-5 py-2">Tanggal</th>
                              <th className="px-5 py-2 text-center">Shubuh</th>
                              <th className="px-5 py-2 text-center">Ashar</th>
                              <th className="px-5 py-2 text-center">Maghrib</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y">
                           {detailAbsen.map((d: any) => (
                              <tr key={d.id}>
                                 <td className="px-5 py-3 font-mono text-xs text-gray-600 flex items-center gap-2">
                                    <Calendar className="w-3 h-3"/>
                                    {format(new Date(d.tanggal), 'dd MMM yyyy', {locale: id})}
                                 </td>
                                 <td className="px-5 py-3 text-center"><BadgeStatus status={d.shubuh}/></td>
                                 <td className="px-5 py-3 text-center"><BadgeStatus status={d.ashar}/></td>
                                 <td className="px-5 py-3 text-center"><BadgeStatus status={d.maghrib}/></td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  )}
               </div>

               {/* Footer */}
               <div className="p-4 border-t bg-gray-50 text-right">
                  <button onClick={closeDetail} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black">Tutup</button>
               </div>

            </div>
         </div>
      )}

    </div>
  )
}

function BadgeStatus({ status }: { status: string }) {
  if (status === 'A') return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">A</span>
  if (status === 'S') return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">S</span>
  if (status === 'I') return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">I</span>
  return <span className="text-gray-300">-</span>
}