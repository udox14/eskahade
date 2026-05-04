'use client'

import { useState } from 'react'
import { getLaporanKeuangan } from './actions'
import { FileText, Calendar, Download, Loader2, TrendingUp, Building2, HeartPulse, BookOpen, Trophy, AlertCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function LaporanKeuanganPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetchedTahun, setFetchedTahun] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const loadData = async () => {
    setLoading(true)
    const res = await getLaporanKeuangan(tahun)
    setData(res)
    setFetchedTahun(tahun)
    setPage(1)
    setLoading(false)
  }

  const isDirty = tahun !== fetchedTahun

  const getPaginatedData = () => {
    if (!data?.list) return []
    return data.list.slice((page - 1) * limit, page * limit)
  }

  const totalItems = data?.list?.length || 0
  const totalPages = Math.ceil(totalItems / limit)

  const handleExport = async () => {
    if (!data || data.list.length === 0) return toast.warning('Data kosong')
    const XLSX = await import('xlsx')
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
      Keterangan: item.keterangan,
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:5},{wch:20},{wch:30},{wch:15},{wch:15},{wch:15},{wch:10},{wch:15},{wch:20},{wch:30}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Laporan ${tahun}`)
    XLSX.writeFile(workbook, `Laporan_Keuangan_${tahun}.xlsx`)
    toast.success('Laporan berhasil didownload')
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">

      {/* HEADER */}
      <DashboardPageHeader
        title="Laporan Keuangan"
        description="Rekapitulasi arus kas dan monitoring tagihan."
        className="border-b pb-4"
        action={(
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold text-slate-600">-</button>
              <span className="px-2 font-mono font-bold text-emerald-700 flex items-center gap-2">
                <Calendar className="w-4 h-4"/> {tahun}
              </span>
              <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold text-slate-600">+</button>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 ${
                isDirty || !data
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin"/> Memuat...</>
                : <><Search className="w-4 h-4"/> {data ? (isDirty ? 'Perbarui' : 'Muat Ulang') : 'Tampilkan'}</>
              }
            </button>

            <button
              onClick={handleExport}
              disabled={!data?.list?.length}
              className="bg-white border text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold text-sm transition-colors disabled:opacity-40 hover:bg-slate-50"
            >
              <Download className="w-4 h-4"/> Export Excel
            </button>
          </div>
        )}
      />

      {/* EMPTY STATE */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <FileText className="w-10 h-10 text-emerald-300"/>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-500">Laporan belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih tahun lalu tekan <strong>Tampilkan</strong> untuk memuat laporan keuangan.</p>
          </div>
          <button onClick={loadData}
            className="mt-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow">
            Tampilkan Laporan {tahun}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500"/>
          <p className="text-sm text-slate-500">Memuat laporan tahun {tahun}...</p>
        </div>
      )}

      {/* HASIL */}
      {data && !loading && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

          {/* CASH FLOW */}
          <div>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <TrendingUp className="w-4 h-4"/> Arus Kas Masuk (Cash Flow)
            </h3>
            <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <div>
                <p className="text-sm text-emerald-600 font-bold mb-1">TOTAL TERIMA TAHUN {fetchedTahun}</p>
                <p className="text-4xl font-extrabold text-emerald-800">Rp {data.cashFlow.TOTAL.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                <TrendingUp className="w-8 h-8"/>
              </div>
            </div>
          </div>

          {/* ANALISA TARGET */}
          <div>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <Building2 className="w-4 h-4"/> Analisa Tagihan & Piutang
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Uang Bangunan" icon={Building2} color="bg-indigo-50" textColor="text-indigo-600" stats={data.targets.BANGUNAN} info="Akumulasi Sepanjang Masa"/>
              <StatCard label="Kesehatan" icon={HeartPulse} color="bg-rose-50" textColor="text-rose-600" stats={data.targets.KESEHATAN} info={`Tagihan Tahun ${fetchedTahun}`}/>
              <StatCard label="EHB (Ujian)" icon={BookOpen} color="bg-blue-50" textColor="text-blue-600" stats={data.targets.EHB} info={`Tagihan Tahun ${fetchedTahun}`}/>
              <StatCard label="Ekstrakurikuler" icon={Trophy} color="bg-orange-50" textColor="text-orange-600" stats={data.targets.EKSKUL} info={`Tagihan Tahun ${fetchedTahun}`}/>
            </div>
          </div>

          {/* TABEL RINCIAN */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b text-xs font-bold text-slate-500 uppercase flex flex-col md:flex-row justify-between items-center gap-2">
              <span>Rincian Transaksi (Total: {totalItems})</span>
              <div className="flex items-center gap-2">
                <span>Tampilkan:</span>
                <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-600 font-bold sticky top-0 shadow-sm z-10">
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
                    <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada transaksi.</td></tr>
                  ) : getPaginatedData().map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                        {format(new Date(item.tanggal_bayar), 'dd MMM yyyy HH:mm', { locale: id })}
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-bold text-slate-800">{item.santri?.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400">{item.santri?.asrama} ({item.santri?.nis})</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                          item.jenis_biaya === 'BANGUNAN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {item.jenis_biaya} {item.tahun_tagihan ? `(${item.tahun_tagihan})` : ''}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">
                        Rp {item.nominal_bayar.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {item.penerima?.full_name?.split(' ')[0]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalItems > limit && (
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500">Hal {page} dari {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50">
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-[10px] text-slate-300 mt-0.5">{info}</p>
        </div>
        <div className={`p-2 rounded-full ${color} ${textColor}`}>
          <Icon className="w-5 h-5"/>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-end mb-1">
          <span className={`text-xl font-extrabold ${textColor}`}>
            {percent}% <span className="text-xs font-normal text-slate-400">Lunas</span>
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%`, backgroundColor: 'currentColor' }}/>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Target:</span>
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
