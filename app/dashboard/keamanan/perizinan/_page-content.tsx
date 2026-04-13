'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getPerizinanList, simpanIzin, setSudahDatang, cariSantri, hapusIzin, getAsramaList, exportDataIzin, getAnalitikIzin } from './actions'
import { Search, Plus, MapPin, Home, Clock, CheckCircle, X, User, ArrowLeft, AlertTriangle, Trash2, Filter, Download, BarChart2, List } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Pagination from '@/components/ui/pagination' 
import { useConfirm } from '@/components/ui/confirm-dialog'
import * as XLSX from 'xlsx'

const LIST_PEMBERI_IZIN = [
  "Muhammad Fakhri", "Gungun T. Aminullah", "Yusup Fallo", 
  "Ryan M. Ridwan", "M. Jihad Robbani", "Wahid Hasyim", "Abdul Halim"
]

const LIST_ALASAN = [
  "SAKIT", "BEROBAT", "KONTROL", "ACARA KELUARGA", "ACARA",
  "SURVEI SEKOLAH / KULIAH", "TEST SEKOLAH / KULIAH", 
  "MEMBUAT PERSYARATAN", "ORANGTUA MENINGGAL", "KELUARGA MENINGGAL"
]

export default function PerizinanPage() {
  const confirm = useConfirm()
  const router = useRouter()
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'DAFTAR' | 'ANALITIK'>('DAFTAR')

  // Data State
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [asramaOptions, setAsramaOptions] = useState<string[]>([])
  const [analitikData, setAnalitikData] = useState<any>(null)

  // Filters & Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [tanggal, setTanggal] = useState('')
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'BELUM_KEMBALI' | 'SUDAH_KEMBALI' | 'TERLAMBAT' | 'TEPAT_WAKTU'>('SEMUA')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Modal Input
  const [isOpenInput, setIsOpenInput] = useState(false)
  const [searchSantri, setSearchSantri] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisIzin, setJenisIzin] = useState<'PULANG' | 'KELUAR_KOMPLEK'>('KELUAR_KOMPLEK')
  const [alasanDropdown, setAlasanDropdown] = useState('SAKIT')
  
  // Modal Kembali
  const [isOpenReturn, setIsOpenReturn] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState('')
  const [waktuKembali, setWaktuKembali] = useState(new Date().toISOString().slice(0, 16))
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getAsramaList().then(setAsramaOptions)
  }, [])

  const loadData = useCallback(async (pg = page, ps = pageSize, s = search, a = asrama, t = tanggal, st = statusFilter) => {
    setLoading(true)
    try {
      const res = await getPerizinanList({ page: pg, pageSize: ps, search: s, asrama: a, tanggal: t, statusFilter: st })
      setList(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, asrama, tanggal, statusFilter])

  const loadAnalitik = useCallback(async (a = asrama) => {
    try {
      const data = await getAnalitikIzin({ asrama: a })
      setAnalitikData(data)
    } catch(e) { console.error(e) }
  }, [asrama])

  useEffect(() => {
    if (activeTab === 'DAFTAR') loadData(page, pageSize, search, asrama, tanggal, statusFilter)
    else loadAnalitik(asrama)
  }, [activeTab, page, pageSize, search, asrama, tanggal, statusFilter, loadData, loadAnalitik])

  // --- HANDLERS ---
  const handleCariSantri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchSantri.length < 3) { toast.warning("Ketik minimal 3 huruf untuk mencari."); return }
    const res = await cariSantri(searchSantri)
    setHasilCari(res)
    if (res.length === 0) toast.info("Santri tidak ditemukan.")
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) { toast.error("Mohon pilih santri terlebih dahulu!"); return }
    const loadingToast = toast.loading("Menyimpan data izin...")
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    formData.append('jenis', jenisIzin)
    formData.append('alasan_dropdown', alasanDropdown) // Ensure dropdown is caught
    const res = await simpanIzin(formData)
    toast.dismiss(loadingToast)

    if ('error' in res) {
      toast.error("Gagal menyimpan: " + (res as any).error)
    } else {
      toast.success("Data perizinan berhasil disimpan!")
      setIsOpenInput(false); setSelectedSantri(null); setSearchSantri(''); setHasilCari([]) 
      loadData(1)
    }
  }

  const handleHapus = async (item: any) => {
    if (!await confirm(`Hapus data izin ${item.nama}?`)) return
    setDeletingId(item.id)
    const res = await hapusIzin(item.id)
    setDeletingId(null)
    if ('error' in res) { toast.error('Gagal hapus', { description: (res as any).error }); return }
    toast.success('Data izin dihapus')
    loadData()
  }

  const openReturnModal = (item: any) => {
    setSelectedReturnId(item.id)
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    setWaktuKembali((new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16))
    setIsOpenReturn(true)
  }

  const handleSimpanKembali = async () => {
    const loadingToast = toast.loading("Memproses kepulangan...")
    const res = await setSudahDatang(selectedReturnId, waktuKembali)
    toast.dismiss(loadingToast)

    if ('error' in res) { toast.error((res as any).error) } 
    else {
      if ((res as any).message?.includes('Terlambat')) toast.warning("Tercatat Terlambat!", { description: "Data masuk ke antrian verifikasi/sidang." })
      else toast.success("Tepat Waktu.", { description: "Izin diselesaikan." })
      setIsOpenReturn(false); loadData()
    }
  }

  const handleExportExcel = async () => {
    const loadingToast = toast.loading("Menyiapkan data export...")
    try {
      const data = await exportDataIzin({ search, asrama, tanggal, statusFilter: statusFilter as any })
      if (!data || data.length === 0) { toast.dismiss(loadingToast); toast.info("Tidak ada data untuk diexport"); return }
      
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data_Izin")
      XLSX.writeFile(wb, `Laporan_Perizinan_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
      toast.success("Berhasil export Excel!")
    } catch(e) {
      toast.error("Gagal export data")
    } finally {
      toast.dismiss(loadingToast)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Perizinan Santri</h1>
          <p className="text-slate-500 text-sm">Monitoring santri keluar/masuk komplek dan pulang.</p>
        </div>
        <button onClick={() => setIsOpenInput(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm font-bold text-sm transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Izin Baru
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('DAFTAR')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DAFTAR' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <List className="w-4 h-4" /> Daftar Izin
        </button>
        <button onClick={() => setActiveTab('ANALITIK')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ANALITIK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <BarChart2 className="w-4 h-4" /> Analitik & Tren
        </button>
      </div>

      {/* DAFTAR TAB CONTENT */}
      {activeTab === 'DAFTAR' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          
          {/* COMPREHENSIVE FILTER BAR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[140px] flex-1 sm:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
                <select value={asrama} onChange={e => {setAsrama(e.target.value); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="min-w-[150px] flex-1 sm:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tanggal Filter</label>
                <input type="date" value={tanggal} onChange={e => {setTanggal(e.target.value); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700" title="Pilih tanggal melihat siapa yang izin beririsan pada hari tersebut" />
              </div>
              <div className="min-w-[150px] flex-1 sm:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Status</label>
                <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value as any); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  <option value="SEMUA">Semua Status</option>
                  <option value="BELUM_KEMBALI">Sedang Izin (Belum Kembali)</option>
                  <option value="SUDAH_KEMBALI">Sudah Kembali</option>
                  <option value="TERLAMBAT">Terlambat (Kembali / Belum)</option>
                  <option value="TEPAT_WAKTU">Tepat Waktu (Sudah Kembali)</option>
                </select>
              </div>
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari Santri</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Ketik Nama / NIS..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700" />
                </div>
              </form>
              
              <div className="flex gap-2 self-end w-full sm:w-auto">
                <button type="button" onClick={() => loadData(1, pageSize, searchInput, asrama, tanggal, statusFilter)} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-black transition-colors">
                  <Filter className="w-4 h-4" /> Filter
                </button>
                <button type="button" onClick={handleExportExcel} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-emerald-700 transition-colors">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>
            {(search || tanggal || asrama !== 'SEMUA' || statusFilter !== 'SEMUA') && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Filter Aktif:</span>
                <button onClick={() => {setSearchInput(''); setSearch(''); setTanggal(''); setAsrama('SEMUA'); setStatusFilter('SEMUA'); setPage(1)}} className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors">
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          {/* LIST DATA */}
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Clock className="w-6 h-6 animate-spin" /><span className="ml-2 font-medium">Memuat Data...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 flex flex-col items-center">
              <div className="bg-slate-50 p-4 rounded-full mb-3"><MapPin className="w-8 h-8 text-slate-300" /></div>
              <p className="text-slate-500 font-medium">Tidak ada data yang sesuai filter.</p>
            </div>
          ) : (
            <>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm">
                  <span>Baris:</span>
                  <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setPage(1)}} className="bg-transparent focus:outline-none text-slate-800">
                    {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <span>Total: <span className="text-slate-800">{total}</span> izin</span>
              </div>

              {/* Desktop Table (Compact View) */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Santri</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Perizinan</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Waktu</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase w-32">Status</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((item) => {
                      const tglMulai = new Date(item.tgl_mulai)
                      const tglRencana = new Date(item.tgl_selesai_rencana)
                      const isTelat = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) > tglRencana : (item.status === 'AKTIF' && new Date() > tglRencana)
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <p className="font-bold text-slate-800">{item.nama}</p>
                            <p className="text-[11px] text-slate-500">{item.nis} · {item.asrama}/{item.kamar}</p>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {item.jenis === 'PULANG' ? (
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Home className="w-3 h-3"/> Pulang</span>
                              ) : (
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin className="w-3 h-3"/> Keluar</span>
                              )}
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={item.pemberi_izin}>{item.pemberi_izin}</span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 italic max-w-xs" title={item.alasan}>"{item.alasan}"</p>
                          </td>
                          <td className="px-3 py-2">
                            <table className="text-[11px] text-slate-600">
                              <tbody>
                                <tr><td className="pr-2 text-slate-400">PGI:</td><td className="font-semibold">{format(tglMulai, 'dd MMM, HH:mm', { locale: id })}</td></tr>
                                {item.tgl_kembali_aktual ? (
                                  <tr><td className="pr-2 text-slate-400">TBA:</td><td className={`font-bold ${isTelat ? 'text-orange-600' : 'text-emerald-600'}`}>{format(new Date(item.tgl_kembali_aktual), 'dd MMM, HH:mm', { locale: id })}</td></tr>
                                ) : (
                                  <tr><td className="pr-2 text-slate-400">BTS:</td><td className={`font-semibold ${isTelat ? 'text-red-500 font-bold' : ''}`}>{format(tglRencana, 'dd MMM, HH:mm', { locale: id })}</td></tr>
                                )}
                              </tbody>
                            </table>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.status === 'AKTIF' ? (
                              item.tgl_kembali_aktual ? (
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-lg flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3"/> Sidang</span>
                              ) : (
                                <button onClick={() => openReturnModal(item)} className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-[11px] font-bold w-full transition-colors">Belum Kembali</button>
                              )
                            ) : (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> Selesai {isTelat && '(Telat)'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => handleHapus(item)} disabled={deletingId === item.id} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              {deletingId === item.id ? <Clock className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (Compact View) */}
              <div className="md:hidden space-y-2">
                {list.map((item) => {
                  const tglMulai = new Date(item.tgl_mulai)
                  const tglRencana = new Date(item.tgl_selesai_rencana)
                  const isTelat = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) > tglRencana : (item.status === 'AKTIF' && new Date() > tglRencana)

                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm">{item.nama}</p>
                          <p className="text-[10px] text-slate-500">{item.nis} · {item.asrama}/{item.kamar}</p>
                        </div>
                        {item.jenis === 'PULANG' 
                          ? <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">PULANG</span>
                          : <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">KELUAR</span>}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                          <span className="text-slate-500 italic truncate mr-2">"{item.alasan}"</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-white px-1 rounded border border-slate-100">{item.pemberi_izin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span><span className="text-slate-400 text-[10px]">PGI:</span> <b>{format(tglMulai, 'dd MMM, HH:mm', { locale: id })}</b></span>
                          {item.tgl_kembali_aktual 
                            ? <span><span className="text-slate-400 text-[10px]">TBA:</span> <b className={isTelat ? 'text-orange-600' : 'text-emerald-600'}>{format(new Date(item.tgl_kembali_aktual), 'dd MMM, HH:mm', { locale: id })}</b></span>
                            : <span><span className="text-slate-400 text-[10px]">BTS:</span> <b className={isTelat ? 'text-red-500' : ''}>{format(tglRencana, 'dd MMM, HH:mm', { locale: id })}</b></span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        {item.status === 'AKTIF' ? (
                          item.tgl_kembali_aktual ? (
                            <span className="flex-1 text-center py-1.5 text-xs font-bold text-orange-700 bg-orange-100 rounded-lg border border-orange-200">Menunggu Sidang (Telat)</span>
                          ) : (
                            <button onClick={() => openReturnModal(item)} className="flex-1 py-1.5 bg-rose-50 text-rose-600 font-bold border border-rose-200 rounded-lg text-xs">Tandai Kembali</button>
                          )
                        ) : (
                          <span className="flex-1 text-center py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-center items-center gap-1"><CheckCircle className="w-3 h-3"/> Izin Selesai {isTelat && '(Telat)'}</span>
                        )}
                        <button onClick={() => handleHapus(item)} disabled={deletingId === item.id} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg border border-slate-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Component */}
              <Pagination currentPage={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
            </>
          )}

        </div>
      )}

      {/* ANALITIK TAB CONTENT */}
      {activeTab === 'ANALITIK' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Ringkasan & Tren Perizinan</h2>
              <p className="text-xs text-slate-500">Angka ini merepresentasikan seluruh data riwayat izin yang tersimpan.</p>
            </div>
            <div className="w-full sm:w-auto">
              <select value={asrama} onChange={e => setAsrama(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm text-slate-700">
                <option value="SEMUA">Keseluruhan Asrama</option>
                {asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {!analitikData ? (
            <div className="flex justify-center py-20"><Clock className="w-6 h-6 animate-spin text-slate-300"/></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Total & Tipe */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-sm font-bold text-slate-400 uppercase mb-4">Total & Distribusi Izin</p>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-5xl font-black text-slate-800 tracking-tighter">{analitikData.total}</span>
                  <span className="text-sm text-slate-500 font-medium pb-2">Izin Tercatat</span>
                </div>
                
                {analitikData.total > 0 && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-purple-700 flex items-center gap-1"><Home className="w-3 h-3"/> Izin Pulang</span>
                        <span>{analitikData.pulang} ({Math.round(analitikData.pulang/analitikData.total*100)}%)</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(analitikData.pulang/analitikData.total)*100}%`}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-blue-700 flex items-center gap-1"><MapPin className="w-3 h-3"/> Keluar Komplek</span>
                        <span>{analitikData.keluar} ({Math.round(analitikData.keluar/analitikData.total*100)}%)</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(analitikData.keluar/analitikData.total)*100}%`}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Kepatuhan Waktu */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-sm font-bold text-slate-400 uppercase mb-4">Kepatuhan Waktu Kembali</p>
                
                {analitikData.tepat + analitikData.telat > 0 ? (() => {
                  const totalKembali = analitikData.tepat + analitikData.telat
                  const percentTepat = Math.round((analitikData.tepat / totalKembali) * 100)
                  return (
                    <>
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-20 h-20 rounded-full border-8 border-emerald-500 flex items-center justify-center shrink-0" style={{ borderRightColor: percentTepat < 50 ? '#f1f5f9' : undefined, borderBottomColor: percentTepat < 75 ? '#f1f5f9' : undefined }}>
                          <span className="text-xl font-bold text-slate-800">{percentTepat}%</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-lg">Tepat Waktu</p>
                          <p className="text-xs text-slate-500 mt-1">Santri yang sudah kembali dinilai dari kepatuhannya terhadap batas izin.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-emerald-600">{analitikData.tepat}</p>
                          <p className="text-[10px] font-bold text-emerald-800 uppercase mt-1">Tepat Waktu</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-rose-600">{analitikData.telat}</p>
                          <p className="text-[10px] font-bold text-rose-800 uppercase mt-1">Terlambat</p>
                        </div>
                      </div>
                    </>
                  )
                })() : (
                  <div className="text-center py-10 flex flex-col items-center justify-center h-full text-slate-400"><AlertTriangle className="w-10 h-10 mb-2 opacity-50"/> Belum ada data kembali</div>
                )}
                
                {analitikData.aktif > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Izin Berjalan (Saat Ini)</span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">{analitikData.aktif} Santri</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* --- MODAL INPUT IZIN BARU --- */}
      {isOpenInput && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Buat Perizinan Baru</h3>
                <p className="text-xs text-slate-500 mt-0.5">Berikan akses keluar/pulang untuk santri.</p>
              </div>
              <button type="button" onClick={() => setIsOpenInput(false)} className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSimpan} className="p-5 max-h-[80vh] overflow-y-auto space-y-5">
              
              {/* Cari Santri */}
              {!selectedSantri ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Pilih Santri</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="Ketik Nama / NIS..." value={searchSantri} onChange={(e) => setSearchSantri(e.target.value)} />
                    </div>
                    <button type="button" onClick={handleCariSantri} className="bg-slate-800 text-white px-4 rounded-xl font-bold hover:bg-slate-900 transition-colors text-sm">Cari</button>
                  </div>
                  {hasilCari.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                      {hasilCari.map(s => (
                        <div key={s.id} onClick={() => setSelectedSantri(s)} className="p-3 bg-white hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400">{s.nis}</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{s.asrama} / {s.kamar}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-blue-50 p-3.5 rounded-xl flex justify-between items-center border border-blue-100 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <User className="w-5 h-5 text-blue-600"/>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{selectedSantri.nama_lengkap}</p>
                      <p className="text-[11px] font-medium text-slate-500">{selectedSantri.asrama} - {selectedSantri.kamar}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedSantri(null)} className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors">Ganti</button>
                </div>
              )}

              {/* Jenis & Waktu */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Jenis & Waktu Izin</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${jenisIzin === 'KELUAR_KOMPLEK' ? 'bg-blue-50 text-blue-700 border-blue-500 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>
                    <input type="radio" name="rad_jenis" className="hidden" checked={jenisIzin === 'KELUAR_KOMPLEK'} onChange={() => setJenisIzin('KELUAR_KOMPLEK')}/>
                    <MapPin className={`w-5 h-5 ${jenisIzin === 'KELUAR_KOMPLEK' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold">KELUAR KOMPLEK</span>
                  </label>
                  <label className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${jenisIzin === 'PULANG' ? 'bg-purple-50 text-purple-700 border-purple-500 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>
                    <input type="radio" name="rad_jenis" className="hidden" checked={jenisIzin === 'PULANG'} onChange={() => setJenisIzin('PULANG')}/>
                    <Home className={`w-5 h-5 ${jenisIzin === 'PULANG' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold">IZIN PULANG</span>
                  </label>
                </div>

                {jenisIzin === 'PULANG' ? (
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Tanggal Pulang</span>
                      <input type="date" name="date_start" required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-purple-500 font-medium"/>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Batas Kembali</span>
                      <input type="date" name="date_end" required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-purple-500 font-medium"/>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Tanggal Izin</span>
                      <input type="date" name="date_single" required defaultValue={new Date().toLocaleDateString('en-CA')} className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Berangkat Pukul</span>
                        <input type="time" name="time_start" required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Batas Kembali Pukul</span>
                        <input type="time" name="time_end" required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Alasan Baru */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Keperluan Dasar</label>
                  <select value={alasanDropdown} onChange={e => setAlasanDropdown(e.target.value)} required className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700">
                    {LIST_ALASAN.map(nama => (
                      <option key={nama} value={nama}>{nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Deskripsi Detail <span className="text-slate-400 font-normal lowercase">(Opsional)</span></label>
                  <textarea name="deskripsi" rows={2} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-700" placeholder="Contoh: Mengambil ijazah ke SMP asal..."></textarea>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Pemberi Izin (ACC)</label>
                <select name="pemberi_izin" required className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  <option value="">-- Pilih Ustadz Pengurus --</option>
                  {LIST_PEMBERI_IZIN.map(nama => (
                    <option key={nama} value={nama}>{nama}</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={!selectedSantri} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-sm shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" /> REKAM PERIZINAN BARU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PENGEMBALIAN --- */}
      {isOpenReturn && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-500 p-6 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-white"/>
              </div>
              <h3 className="text-xl font-bold text-white">Konfirmasi Tiba</h3>
              <p className="text-sm text-emerald-100 text-center mt-1">Data kepatuhan waktu santri diukur dari kedatangan ini.</p>
            </div>
            
            <div className="p-6">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-2 block text-center">Waktu Aktual Tiba</label>
              <input 
                type="datetime-local" 
                value={waktuKembali}
                onChange={(e) => setWaktuKembali(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 focus:border-emerald-500 rounded-xl text-center font-bold text-slate-800 mb-6 outline-none transition-colors"
                title="Waktu kepulangan bisa Anda sesuaikan jika telat input"
              />

              <div className="flex gap-3">
                <button type="button" onClick={() => setIsOpenReturn(false)} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">Batal</button>
                <button type="button" onClick={handleSimpanKembali} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">Simpan Final</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}