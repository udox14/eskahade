'use client'

import { useState, useEffect } from 'react'
import { getLaporanKeuangan } from './actions'
import { FileText, Calendar, Download, Loader2, TrendingUp, Building2, HeartPulse, BookOpen, Trophy, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

declare global {
  interface Window {
    XLSX: any;
  }
}

export default function LaporanKeuanganPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // State Pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10) // Default 10

  useEffect(() => {
    loadData()
  }, [tahun])

  const loadData = async () => {
    setLoading(true)
    const res = await getLaporanKeuangan(tahun)
    setData(res)
    setPage(1) // Reset ke halaman 1 saat ganti tahun
    setLoading(false)
  }

  // Helper Pagination
  const getPaginatedData = () => {
    if (!data?.list) return []
    const start = (page - 1) * limit
    const end = start + limit
    return data.list.slice(start, end)
  }

  const totalItems = data?.list?.length || 0
  const totalPages = Math.ceil(totalItems / limit)

  // Helper Export
  const handleExport = () => {
    if (!data || data.list.length === 0) return toast.warning("Data kosong")
    if (!window.XLSX) return toast.error("Fitur Excel belum siap. Refresh halaman.")

    const rows = data.list.map((item: any, idx: number) => ({
      No: idx + 1,
      Tanggal: format(new Date(item.tanggal_bayar), 'dd/MM/yyyy HH:mm'),
      Santri: item.santri?.nama_lengkap,
      NIS: item.santri?.nis,
      Asrama: item.santri?.asrama,
      Jenis: item.jenis_biaya,
      Tahun_Tagihan: item.tahun_tagihan || '-',
      Nominal: item.nominal_bayar,
      Penerima: item.penerima?.full_name || 'Sistem',
      Keterangan: item.keterangan
    }))

    const worksheet = window.XLSX.utils.json_to_sheet(rows)
    const wscols = [{wch:5}, {wch:20}, {wch:30}, {wch:15}, {wch:15}, {wch:15}, {wch:10}, {wch:15}, {wch:20}, {wch:30}]
    worksheet['!cols'] = wscols

    const workbook = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(workbook, worksheet, `Laporan ${tahun}`)
    window.XLSX.writeFile(workbook, `Laporan_Keuangan_${tahun}.xlsx`)
    toast.success("Laporan berhasil didownload")
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <FileText className="w-6 h-6 text-emerald-600"/> Laporan Keuangan
           </h1>
           <p className="text-gray-500 text-sm">Rekapitulasi Arus Kas & Monitoring Tagihan.</p>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border rounded-lg p-1 shadow-sm">
                <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold text-gray-600">-</button>
                <span className="px-2 font-mono font-bold text-emerald-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4"/> {tahun}
                </span>
                <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold text-gray-600">+</button>
            </div>
            
            <button 
              onClick={handleExport}
              disabled={loading || !data?.list.length}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold text-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4"/> Export Excel
            </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500"/></div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* 1. RINGKASAN CASH FLOW */}
            <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <TrendingUp className="w-4 h-4"/> Arus Kas Masuk (Cash Flow)
                </h3>
                <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                    <div>
                        <p className="text-sm text-emerald-600 font-bold mb-1">TOTAL TERIMA TAHUN {tahun}</p>
                        <p className="text-4xl font-extrabold text-emerald-800">Rp {data.cashFlow.TOTAL.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                        <TrendingUp className="w-8 h-8"/>
                    </div>
                </div>
            </div>

            {/* 2. ANALISA TARGET */}
            <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Building2 className="w-4 h-4"/> Analisa Tagihan & Piutang
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        label="Uang Bangunan" 
                        icon={Building2} 
                        color="bg-indigo-50" 
                        textColor="text-indigo-600" 
                        stats={data.targets.BANGUNAN}
                        info="Akumulasi Sepanjang Masa"
                    />
                    <StatCard 
                        label="Kesehatan" 
                        icon={HeartPulse} 
                        color="bg-rose-50" 
                        textColor="text-rose-600" 
                        stats={data.targets.KESEHATAN}
                        info={`Tagihan Tahun ${tahun}`}
                    />
                    <StatCard 
                        label="EHB (Ujian)" 
                        icon={BookOpen} 
                        color="bg-blue-50" 
                        textColor="text-blue-600" 
                        stats={data.targets.EHB}
                        info={`Tagihan Tahun ${tahun}`}
                    />
                    <StatCard 
                        label="Ekstrakurikuler" 
                        icon={Trophy} 
                        color="bg-orange-50" 
                        textColor="text-orange-600" 
                        stats={data.targets.EKSKUL}
                        info={`Tagihan Tahun ${tahun}`}
                    />
                </div>
            </div>

            {/* 3. TABEL RINCIAN (DENGAN PAGINATION) */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b text-xs font-bold text-gray-500 uppercase flex flex-col md:flex-row justify-between items-center gap-2">
                    <span>Rincian Transaksi (Total: {totalItems})</span>
                    
                    {/* LIMIT SELECTOR */}
                    <div className="flex items-center gap-2">
                        <span>Tampilkan:</span>
                        <select 
                            value={limit}
                            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-600 font-bold sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-3 border-b">Tanggal</th>
                                <th className="px-6 py-3 border-b">Nama Santri</th>
                                <th className="px-6 py-3 border-b">Jenis Biaya</th>
                                <th className="px-6 py-3 border-b text-right">Nominal</th>
                                <th className="px-6 py-3 border-b">Penerima</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData().length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Belum ada transaksi di halaman ini.</td></tr>
                            ) : (
                                getPaginatedData().map((item: any) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                                            {format(new Date(item.tanggal_bayar), 'dd MMM yyyy HH:mm', {locale: id})}
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="font-bold text-gray-800">{item.santri?.nama_lengkap}</p>
                                            <p className="text-[10px] text-gray-400">{item.santri?.asrama} ({item.santri?.nis})</p>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                                item.jenis_biaya === 'BANGUNAN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                                'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                                {item.jenis_biaya} {item.tahun_tagihan ? `(${item.tahun_tagihan})` : ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-700">
                                            Rp {item.nominal_bayar.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-3 text-xs text-gray-500">
                                            {item.penerima?.full_name?.split(' ')[0]}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION CONTROLS */}
                {totalItems > limit && (
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                            Hal {page} dari {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4"/>
                            </button>
                            <button 
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, icon: Icon, color, textColor, stats, info }: any) {
    const percent = stats.target > 0 ? Math.round((stats.terima / stats.target) * 100) : 0
    
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{info}</p>
                </div>
                <div className={`p-2 rounded-full ${color} ${textColor}`}>
                    <Icon className="w-5 h-5"/>
                </div>
            </div>
            
            <div>
                <div className="flex justify-between items-end mb-1">
                    <span className={`text-xl font-extrabold ${textColor}`}>
                        {percent}% <span className="text-xs font-normal text-gray-400">Lunas</span>
                    </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div className={`h-2 rounded-full ${color.replace('bg-', 'bg-')}`} style={{ width: `${percent}%`, backgroundColor: 'currentColor' }}></div>
                </div>

                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Target:</span>
                        <span className="font-mono font-bold">Rp {stats.target.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                        <span className="font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Kurang:</span>
                        <span className="font-mono font-bold">Rp {stats.kurang.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}