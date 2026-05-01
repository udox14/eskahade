'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  getPerizinanList, simpanIzin, setSudahDatang, cariSantri, hapusIzin, 
  getAsramaList, exportDataIzin, getAnalitikIzin, getTopSantriIzin, updateIzin,
  getAlasanIzinList, simpanAlasanIzinList
} from './actions'
import { 
  Search, Plus, MapPin, Home, Clock, CheckCircle, X, User, ArrowLeft, 
  AlertTriangle, Trash2, Filter, Download, BarChart2, List, Edit2, TrendingUp, Settings, Save
} from 'lucide-react'
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

const DEFAULT_LIST_ALASAN = [
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
  const [alasanOptions, setAlasanOptions] = useState<string[]>(DEFAULT_LIST_ALASAN)
  const [analitikData, setAnalitikData] = useState<any>(null)
  const [topSantri, setTopSantri] = useState<any[]>([])

  // Filters & Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [tglAwal, setTglAwal] = useState('')
  const [tglAkhir, setTglAkhir] = useState('')
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'BELUM_KEMBALI' | 'SUDAH_KEMBALI' | 'TERLAMBAT' | 'TEPAT_WAKTU'>('SEMUA')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Modal Input & Edit
  const [isOpenInput, setIsOpenInput] = useState(false)
  const [isOpenEdit, setIsOpenEdit] = useState(false)
  const [isOpenAlasan, setIsOpenAlasan] = useState(false)
  const [editData, setEditData] = useState<any>(null)

  const [searchSantri, setSearchSantri] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisIzin, setJenisIzin] = useState<'PULANG' | 'KELUAR_KOMPLEK'>('KELUAR_KOMPLEK')
  const [alasanDropdown, setAlasanDropdown] = useState('SAKIT')
  const [deskripsiIzin, setDeskripsiIzin] = useState('')
  const [pemberiIzin, setPemberiIzin] = useState('')
  
  // Date states for forms
  const [formDateSingle, setFormDateSingle] = useState('')
  const [formTimeStart, setFormTimeStart] = useState('')
  const [formTimeEnd, setFormTimeEnd] = useState('')
  const [formDateStart, setFormDateStart] = useState('')
  const [formDateEnd, setFormDateEnd] = useState('')

  // Modal Kembali
  const [isOpenReturn, setIsOpenReturn] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState('')
  const [waktuKembali, setWaktuKembali] = useState(new Date().toISOString().slice(0, 16))
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [draftAlasan, setDraftAlasan] = useState<string[]>(DEFAULT_LIST_ALASAN)
  const [newAlasan, setNewAlasan] = useState('')
  const [savingAlasan, setSavingAlasan] = useState(false)

  useEffect(() => {
    getAsramaList().then(setAsramaOptions)
    getAlasanIzinList().then(rows => {
      setAlasanOptions(rows)
      setDraftAlasan(rows)
      if (rows.length > 0) setAlasanDropdown(rows[0])
    })
  }, [])

  const loadData = useCallback(async (pg = page, ps = pageSize, s = search, a = asrama, ta = tglAwal, tk = tglAkhir, st = statusFilter) => {
    setLoading(true)
    try {
      const res = await getPerizinanList({ page: pg, pageSize: ps, search: s, asrama: a, tglAwal: ta, tglAkhir: tk, statusFilter: st })
      setList(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, asrama, tglAwal, tglAkhir, statusFilter])

  const loadAnalitik = useCallback(async (a = asrama, ta = tglAwal, tk = tglAkhir) => {
    try {
      const data = await getAnalitikIzin({ asrama: a, tglAwal: ta, tglAkhir: tk })
      setAnalitikData(data)
      const top = await getTopSantriIzin({ asrama: a, tglAwal: ta, tglAkhir: tk })
      setTopSantri(top)
    } catch(e) { console.error(e) }
  }, [asrama, tglAwal, tglAkhir])

  useEffect(() => {
    if (activeTab === 'DAFTAR') loadData(page, pageSize, search, asrama, tglAwal, tglAkhir, statusFilter)
    else loadAnalitik(asrama, tglAwal, tglAkhir)
  }, [activeTab, page, pageSize, search, asrama, tglAwal, tglAkhir, statusFilter, loadData, loadAnalitik])

  // --- HANDLERS ---
  const handleCariSantri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchSantri.length < 3) { toast.warning("Ketik minimal 3 huruf untuk mencari."); return }
    const res = await cariSantri(searchSantri)
    setHasilCari(res)
    if (res.length === 0) toast.info("Santri tidak ditemukan.")
  }

  const resetFormState = () => {
    setJenisIzin('KELUAR_KOMPLEK')
    setAlasanDropdown(alasanOptions[0] || 'SAKIT')
    setDeskripsiIzin('')
    setPemberiIzin('')
    setFormDateSingle(new Date().toLocaleDateString('en-CA'))
    setFormTimeStart('')
    setFormTimeEnd('')
    setFormDateStart('')
    setFormDateEnd('')
  }

  const openTambahModal = () => {
    resetFormState()
    setSelectedSantri(null)
    setSearchSantri('')
    setHasilCari([])
    setIsOpenInput(true)
  }

  const openEditModal = (item: any) => {
    resetFormState()
    setEditData(item)
    setSelectedSantri({ id: item.santri_id, nama_lengkap: item.nama, nis: item.nis, asrama: item.asrama, kamar: item.kamar })
    setJenisIzin(item.jenis as 'PULANG' | 'KELUAR_KOMPLEK')
    
    // Parse Alasan
    const parsedAlasan = item.alasan || ''
    let dAlasan = alasanOptions[0] || DEFAULT_LIST_ALASAN[0]
    let dDesk = ''
    
    const matchedPrefix = alasanOptions.find(a => parsedAlasan.startsWith(a + " - "))
    if (matchedPrefix) {
      dAlasan = matchedPrefix
      dDesk = parsedAlasan.replace(matchedPrefix + " - ", "")
    } else if (alasanOptions.includes(parsedAlasan)) {
      dAlasan = parsedAlasan
    } else {
      dDesk = parsedAlasan
    }
    setAlasanDropdown(dAlasan)
    setDeskripsiIzin(dDesk)
    setPemberiIzin(item.pemberi_izin || '')

    // Parse Dates (Assuming +07:00 was saved, taking substring to fit input)
    // Tgl Mulai: 2023-12-12T08:00:00.000Z representing UTC, but we want local time.
    // If we create new Date(), it parses into browser local time.
    const tStart = new Date(item.tgl_mulai)
    const tEnd = new Date(item.tgl_selesai_rencana)

    if (item.jenis === 'PULANG') {
      setFormDateStart(format(tStart, "yyyy-MM-dd"))
      setFormDateEnd(format(tEnd, "yyyy-MM-dd"))
    } else {
      setFormDateSingle(format(tStart, "yyyy-MM-dd"))
      setFormTimeStart(format(tStart, "HH:mm"))
      setFormTimeEnd(format(tEnd, "HH:mm"))
    }

    setIsOpenEdit(true)
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri && !isOpenEdit) { toast.error("Mohon pilih santri terlebih dahulu!"); return }
    const loadingToast = toast.loading("Menyimpan data izin...")

    try {
      const formData = new FormData(e.currentTarget)
      if (!isOpenEdit && selectedSantri) formData.append('santri_id', selectedSantri.id)
      formData.append('jenis', jenisIzin)
      formData.append('alasan_dropdown', alasanDropdown)

      const res = isOpenEdit
        ? await updateIzin(editData.id, formData)
        : await simpanIzin(formData)

      if ('error' in res) {
        toast.error("Gagal menyimpan: " + (res as any).error)
      } else {
        toast.success(isOpenEdit ? "Perubahan izin berhasil disimpan!" : "Data perizinan berhasil disimpan!")
        setIsOpenInput(false)
        setIsOpenEdit(false)
        loadData(1) // Return to page 1
      }
    } catch (error: any) {
      console.error('Gagal menyimpan data izin:', error)
      toast.error('Gagal menyimpan data izin.', {
        description: error?.message || 'Terjadi kesalahan saat memproses permintaan.',
      })
    } finally {
      toast.dismiss(loadingToast)
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
      const data = await exportDataIzin({ search, asrama, tglAwal, tglAkhir, statusFilter })
      if (!data || data.length === 0) { toast.dismiss(loadingToast); toast.info("Tidak ada data untuk diexport"); return }
      
      // Remapping columns manually to ensure clean ID headers and avoid SQLite alias errors
      const remappedData = data.map((d: any) => ({
        "Nama Lengkap": d.nama_lengkap,
        "NIS": d.nis,
        "Asrama": d.asrama,
        "Kamar": d.kamar,
        "Jenis Izin": d.jenis === 'PULANG' ? 'Izin Pulang' : 'Keluar Komplek',
        "Alasan / Keperluan": d.alasan,
        "Pemberi Izin": d.pemberi_izin,
        "Status Izin": d.status,
        "Keberangkatan": format(new Date(d.tgl_mulai), 'dd MMM yyyy HH:mm', { locale: id }),
        "Batas Rencana Kembali": format(new Date(d.tgl_selesai_rencana), 'dd MMM yyyy HH:mm', { locale: id }),
        "Waktu Tiba Aktual": d.tgl_kembali_aktual ? format(new Date(d.tgl_kembali_aktual), 'dd MMM yyyy HH:mm', { locale: id }) : 'Belum Kembali'
      }))

      const ws = XLSX.utils.json_to_sheet(remappedData)
      
      // Adjust column widths automatically
      const colWidths = [
         {wch: 25}, {wch: 15}, {wch: 15}, {wch: 10},
         {wch: 18}, {wch: 35}, {wch: 22}, {wch: 15},
         {wch: 22}, {wch: 22}, {wch: 22}
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data Perizinan")
      XLSX.writeFile(wb, `Laporan_Perizinan_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
      toast.success("Berhasil export Excel!")
    } catch(e) {
      toast.error("Gagal export data")
    } finally {
      toast.dismiss(loadingToast)
    }
  }

  const openAlasanModal = () => {
    setDraftAlasan(alasanOptions)
    setNewAlasan('')
    setIsOpenAlasan(true)
  }

  const handleTambahAlasan = () => {
    const normalized = newAlasan.trim().toUpperCase()
    if (!normalized) return
    if (draftAlasan.includes(normalized)) {
      toast.info('Alasan itu sudah ada.')
      setNewAlasan('')
      return
    }
    setDraftAlasan(prev => [...prev, normalized])
    setNewAlasan('')
  }

  const handleHapusAlasan = (nama: string) => {
    if (draftAlasan.length <= 1) {
      toast.warning('Minimal harus ada 1 alasan izin.')
      return
    }
    setDraftAlasan(prev => prev.filter(item => item !== nama))
  }

  const handleSimpanAlasan = async () => {
    setSavingAlasan(true)
    const res = await simpanAlasanIzinList(draftAlasan)
    setSavingAlasan(false)

    if ('error' in res) {
      toast.error('Gagal menyimpan alasan', { description: (res as any).error })
      return
    }

    const rows = (res as any).rows as string[]
    setAlasanOptions(rows)
    if (!rows.includes(alasanDropdown)) setAlasanDropdown(rows[0])
    setIsOpenAlasan(false)
    toast.success('Alasan izin diperbarui')
  }

  // Common Form Fields for Tambah & Edit Modal
  const renderFormFields = () => (
    <>
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
              <input type="date" name="date_start" value={formDateStart} onChange={e => setFormDateStart(e.target.value)} required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-purple-500 font-medium"/>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Batas Kembali</span>
              <input type="date" name="date_end" value={formDateEnd} onChange={e => setFormDateEnd(e.target.value)} required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-purple-500 font-medium"/>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Tanggal Izin</span>
              <input type="date" name="date_single" value={formDateSingle} onChange={e => setFormDateSingle(e.target.value)} required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Berangkat Pukul</span>
                <input type="time" name="time_start" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Batas Kembali Pukul</span>
                <input type="time" name="time_end" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} required className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-blue-500 font-medium"/>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Keperluan Dasar</label>
          <select value={alasanDropdown} onChange={e => setAlasanDropdown(e.target.value)} required className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700">
            {alasanOptions.map(nama => <option key={nama} value={nama}>{nama}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Deskripsi Detail <span className="text-slate-400 font-normal lowercase">(Opsional)</span></label>
          <textarea name="deskripsi" value={deskripsiIzin} onChange={e => setDeskripsiIzin(e.target.value)} rows={2} className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-700" placeholder="Contoh: Mengambil ijazah ke SMP asal..."></textarea>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Pemberi Izin (ACC)</label>
        <select name="pemberi_izin" value={pemberiIzin} onChange={e => setPemberiIzin(e.target.value)} required className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
          <option value="">-- Pilih Ustadz Pengurus --</option>
          {LIST_PEMBERI_IZIN.map(nama => <option key={nama} value={nama}>{nama}</option>)}
        </select>
      </div>
    </>
  )

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
        <div className="flex gap-2">
          <button onClick={openAlasanModal} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl flex items-center gap-2 shadow-sm font-bold text-sm transition-all active:scale-95">
            <Settings className="w-4 h-4" /> Alasan
          </button>
          <button onClick={openTambahModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm font-bold text-sm transition-all active:scale-95">
            <Plus className="w-4 h-4" /> Izin Baru
          </button>
        </div>
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
              <div className="min-w-[130px] flex-1 sm:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Dari Tanggal</label>
                <input type="date" value={tglAwal} onChange={e => {setTglAwal(e.target.value); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700" />
              </div>
              <div className="min-w-[130px] flex-1 sm:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">S/D Tanggal</label>
                <input type="date" value={tglAkhir} onChange={e => {setTglAkhir(e.target.value); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700" />
              </div>
              <div className="min-w-[150px] flex-1 xl:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Filter Status</label>
                <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value as any); setPage(1)}} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  <option value="SEMUA">- Semua Status -</option>
                  <option value="BELUM_KEMBALI">Sedang di Luar (Belum Tiba)</option>
                  <option value="SUDAH_KEMBALI">Selesai (Sudah Tiba)</option>
                  <option value="TERLAMBAT">Melewati Batas Waktu (Telat)</option>
                  <option value="TEPAT_WAKTU">Kembali Tepat Waktu</option>
                </select>
              </div>
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari Santri</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Ketik Nama / NIS..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700" />
                </div>
              </form>
              
              <div className="flex gap-2 self-end w-full sm:w-auto mt-2 sm:mt-0">
                <button type="button" onClick={() => loadData(1, pageSize, searchInput, asrama, tglAwal, tglAkhir, statusFilter)} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-black transition-colors">
                  <Filter className="w-4 h-4" /> Terapkan
                </button>
                <button type="button" onClick={handleExportExcel} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:bg-emerald-700 transition-colors">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>
            {(search || tglAwal || tglAkhir || asrama !== 'SEMUA' || statusFilter !== 'SEMUA') && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Filter Aktif:</span>
                <button onClick={() => {setSearchInput(''); setSearch(''); setTglAwal(''); setTglAkhir(''); setAsrama('SEMUA'); setStatusFilter('SEMUA'); setPage(1)}} className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg transition-colors">
                  Kosongkan Filter
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
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <span>Tampilkan Baris:</span>
                  <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setPage(1)}} className="bg-transparent focus:outline-none text-slate-800 border-none font-bold">
                    {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <span>Total: <span className="text-slate-800">{total}</span> catatan</span>
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
                      <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((item) => {
                      const tglMulai = new Date(item.tgl_mulai)
                      const tglRencana = new Date(item.tgl_selesai_rencana)
                      const isTelat = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) > tglRencana : (item.status === 'AKTIF' && new Date() > tglRencana)
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2 focus:outline-none">
                            <p className="font-bold text-slate-800">{item.nama}</p>
                            <p className="text-[11px] text-slate-500">{item.nis} · {item.asrama}/{item.kamar}</p>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              {item.jenis === 'PULANG' ? (
                                <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1 border border-purple-100"><Home className="w-3 h-3"/> Pulang</span>
                              ) : (
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1 border border-blue-100"><MapPin className="w-3 h-3"/> Keluar</span>
                              )}
                              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={item.pemberi_izin}>{item.pemberi_izin}</span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 italic max-w-xs leading-tight" title={item.alasan}>"{item.alasan}"</p>
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
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg border border-orange-200 flex items-center justify-center gap-1 shadow-sm"><AlertTriangle className="w-3 h-3"/> Sidang</span>
                              ) : (
                                <button onClick={() => openReturnModal(item)} className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg text-[11px] font-bold w-full transition-colors shadow-sm">Tandai Tiba</button>
                              )
                            ) : (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> Selesai {isTelat && '(Telat)'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'AKTIF' && !item.tgl_kembali_aktual && (
                                <button onClick={() => openEditModal(item)} title="Edit Izin" className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-100">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => handleHapus(item)} disabled={deletingId === item.id} title="Hapus Izin" className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors border border-slate-100 disabled:opacity-50">
                                {deletingId === item.id ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (Compact View) */}
              <div className="md:hidden space-y-2.5">
                {list.map((item) => {
                  const tglMulai = new Date(item.tgl_mulai)
                  const tglRencana = new Date(item.tgl_selesai_rencana)
                  const isTelat = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) > tglRencana : (item.status === 'AKTIF' && new Date() > tglRencana)

                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                      {/* Left color bar indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        item.status !== 'AKTIF' ? 'bg-emerald-400'
                        : item.tgl_kembali_aktual ? 'bg-orange-400' : 'bg-rose-400'
                      }`} />
                      
                      <div className="p-3.5 pl-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-900 text-sm leading-tight">{item.nama}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.nis} · {item.asrama}/{item.kamar}</p>
                          </div>
                          <div className="shrink-0 flex gap-1">
                            {item.status === 'AKTIF' && !item.tgl_kembali_aktual && (
                              <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg border border-slate-100"><Edit2 className="w-3.5 h-3.5"/></button>
                            )}
                            <button onClick={() => handleHapus(item)} disabled={deletingId === item.id} className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-lg border border-slate-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.jenis === 'PULANG' 
                            ? <span className="bg-purple-50 border border-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold"><Home className="w-3 h-3 inline mr-1"/>PULANG</span>
                            : <span className="bg-blue-50 border border-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold"><MapPin className="w-3 h-3 inline mr-1"/>KELUAR</span>}
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Via {item.pemberi_izin}</span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 mt-0.5 space-y-2 border border-slate-100">
                          <p className="italic text-slate-500 leading-tight">"{item.alasan}"</p>
                          <div className="flex justify-between border-t border-slate-200 pt-2">
                            <span><span className="text-[10px] text-slate-400 font-bold block mb-0.5">Berangkat</span> <span className="font-semibold">{format(tglMulai, 'dd MMM, HH:mm', { locale: id })}</span></span>
                            {item.tgl_kembali_aktual 
                              ? <span className="text-right"><span className="text-[10px] text-slate-400 font-bold block mb-0.5">Tiba Aktual</span> <span className={`font-bold ${isTelat ? 'text-orange-600' : 'text-emerald-600'}`}>{format(new Date(item.tgl_kembali_aktual), 'dd MMM, HH:mm', { locale: id })}</span></span>
                              : <span className="text-right"><span className="text-[10px] text-slate-400 font-bold block mb-0.5">Batas Kembali</span> <span className={`font-semibold ${isTelat ? 'text-red-500' : ''}`}>{format(tglRencana, 'dd MMM, HH:mm', { locale: id })}</span></span>}
                          </div>
                        </div>

                        <div className="mt-1">
                          {item.status === 'AKTIF' ? (
                            item.tgl_kembali_aktual ? (
                              <span className="w-full text-center py-2 text-xs font-bold text-orange-700 bg-orange-50 rounded-xl border border-orange-200 flex items-center justify-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Menunggu Sidang (Telat)</span>
                            ) : (
                              <button onClick={() => openReturnModal(item)} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold border border-rose-200 shadow-sm rounded-xl text-xs transition-colors">Tandai Santri Tiba</button>
                            )
                          ) : (
                            <span className="w-full text-center py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-center items-center gap-1.5"><CheckCircle className="w-4 h-4"/> Izin Selesai {isTelat && '(Terlambat)'}</span>
                          )}
                        </div>
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

      {/* ANALITIK TAB CONTENT - BENTO GRID DESIGN */}
      {activeTab === 'ANALITIK' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
          
          {/* HEADER ANALITIK */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600"/> Dasbor Analisis Perizinan</h2>
              <p className="text-xs text-slate-500 mt-1">Laporan tren izin keluar berdasarkan filter di bawah ini.</p>
            </div>
            <div className="w-full md:w-auto flex flex-wrap gap-2">
               <input type="date" value={tglAwal} onChange={e => {setTglAwal(e.target.value);}} className="flex-1 min-w-[120px] border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs text-slate-700" title="Awal Periode"/>
               <input type="date" value={tglAkhir} onChange={e => {setTglAkhir(e.target.value);}} className="flex-1 min-w-[120px] border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs text-slate-700" title="Akhir Periode"/>
               <select value={asrama} onChange={e => setAsrama(e.target.value)} className="w-full md:w-auto border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs text-slate-800">
                <option value="SEMUA">Semua Asrama</option>
                {asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {!analitikData ? (
            <div className="flex justify-center py-20"><Clock className="w-6 h-6 animate-spin text-slate-300"/></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* TOP CARDS: TOTALS */}
              <div className="col-span-1 border border-slate-200 md:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-sm text-white flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Permohonan Izin</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black tracking-tighter">{analitikData.total}</span>
                    <span className="text-sm font-medium text-slate-300">Data</span>
                  </div>
                </div>
                {analitikData.total > 0 && (
                  <div className="mt-8 space-y-4 relative z-10">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5"><span className="text-slate-300 flex items-center gap-1.5"><Home className="w-3.5 h-3.5"/> Izin Pulang</span><span className="text-white">{analitikData.pulang}</span></div>
                      <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${(analitikData.pulang/analitikData.total)*100}%`}}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5"><span className="text-slate-300 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Keluar Komplek</span><span className="text-white">{analitikData.keluar}</span></div>
                      <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${(analitikData.keluar/analitikData.total)*100}%`}}></div></div>
                    </div>
                  </div>
                )}
                <MapPin className="absolute -right-6 -bottom-6 w-32 h-32 text-slate-700/30 -rotate-12 pointer-events-none" />
              </div>

              {/* MIDDLE CARDS: KEPATUHAN & AKTIF */}
              <div className="col-span-1 md:col-span-4 flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Indeks Kepatuhan</p>
                  {analitikData.tepat + analitikData.telat > 0 ? (() => {
                    const totalKembali = analitikData.tepat + analitikData.telat
                    const percentTepat = Math.round((analitikData.tepat / totalKembali) * 100)
                    return (
                      <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-full border-[6px] border-emerald-500 flex items-center justify-center shrink-0 shadow-sm" style={{ borderRightColor: percentTepat < 50 ? '#f1f5f9' : undefined, borderBottomColor: percentTepat < 75 ? '#f1f5f9' : undefined }}>
                          <span className="text-xl font-black text-slate-800">{percentTepat}%</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-xl font-bold text-emerald-600 flex items-baseline gap-1">{analitikData.tepat} <span className="text-[10px] text-slate-400 uppercase">Tepat</span></p>
                          </div>
                          <div>
                           <p className="text-lg font-bold text-rose-500 flex items-baseline gap-1">{analitikData.telat} <span className="text-[10px] text-slate-400 uppercase">Telat</span></p>
                          </div>
                        </div>
                      </div>
                    )
                  })() : (
                    <div className="text-center text-slate-400 py-4"><CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30"/> <span className="text-xs font-medium">Belum ada data kedatangan</span></div>
                  )}
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-bold text-blue-900 text-sm">Santri Sedang Izin</p>
                    <p className="text-[10px] text-blue-700 font-medium mt-0.5">Belum melapor tiba di komplek.</p>
                  </div>
                  <div className="bg-white border border-blue-200 px-4 py-2 rounded-xl text-2xl font-black text-blue-600 shadow-sm">{analitikData.aktif}</div>
                </div>
              </div>

              {/* RIGHT CARD: TOP SANTRI SERING IZIN */}
              <div className="col-span-1 md:col-span-4 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-orange-500"/> Santri Paling Sering Izin (Top 5)</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {topSantri.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[150px] text-xs text-slate-400 font-medium italic">Tidak ada catatan perizinan.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 p-2">
                      {topSantri.map((s, idx) => (
                        <div key={s.id} className="p-3 flex items-center gap-3">
                          <div className={`w-6 h-6 shrink-0 rounded-full flex justify-center items-center text-[10px] font-bold ${idx===0 ? 'bg-orange-100 text-orange-700': idx===1 ? 'bg-slate-200 text-slate-700' : idx===2? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
                            #{idx+1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-500">{s.asrama} / {s.kamar}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-slate-700">{s.total_izin}x</p>
                            {s.total_telat > 0 && <p className="text-[9px] font-bold text-rose-500 mt-0.5">{s.total_telat}x Telat</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}


      {/* --- MODAL PENGATURAN ALASAN --- */}
      {isOpenAlasan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Atur Alasan Izin</h3>
                <p className="text-xs text-slate-500 mt-0.5">Daftar ini dipakai di pilihan keperluan dasar.</p>
              </div>
              <button type="button" onClick={() => setIsOpenAlasan(false)} className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors border border-slate-200"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
              <div className="flex gap-2">
                <input
                  value={newAlasan}
                  onChange={e => setNewAlasan(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleTambahAlasan()
                    }
                  }}
                  placeholder="Tulis alasan baru..."
                  className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                />
                <button type="button" onClick={handleTambahAlasan} className="bg-slate-900 hover:bg-black text-white px-4 rounded-xl font-bold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>

              <div className="space-y-2">
                {draftAlasan.map(alasan => (
                  <div key={alasan} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    <span className="text-sm font-bold text-slate-700">{alasan}</span>
                    <button
                      type="button"
                      onClick={() => handleHapusAlasan(alasan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus alasan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex gap-3">
              <button type="button" onClick={() => setIsOpenAlasan(false)} className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                Batal
              </button>
              <button type="button" onClick={handleSimpanAlasan} disabled={savingAlasan} className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {savingAlasan ? 'Menyimpan...' : 'Simpan Alasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL INPUT & EDIT IZIN --- */}
      {(isOpenInput || isOpenEdit) && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{isOpenEdit ? 'Ubah Perizinan' : 'Buat Perizinan Baru'}</h3>
                {!isOpenEdit && <p className="text-xs text-slate-500 mt-0.5">Berikan akses keluar/pulang untuk santri.</p>}
              </div>
              <button type="button" onClick={() => {setIsOpenInput(false); setIsOpenEdit(false)}} className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors border border-slate-200"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSimpan} className="p-5 max-h-[80vh] overflow-y-auto space-y-5">
              
              {/* Cari Santri */}
              {!selectedSantri ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Pilih Santri</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="Ketik Nama / NIS..." value={searchSantri} onChange={(e) => setSearchSantri(e.target.value)} autoFocus={!isOpenEdit} />
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
                      <p className="text-[11px] font-medium text-slate-500">{selectedSantri.nis} · {selectedSantri.asrama} - {selectedSantri.kamar}</p>
                    </div>
                  </div>
                  {!isOpenEdit && <button type="button" onClick={() => setSelectedSantri(null)} className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg hover:bg-rose-100 transition-colors">Ganti Tgt</button>}
                </div>
              )}

              {/* RENDER DYNAMIC FORM FIELDS */}
              {selectedSantri && renderFormFields()}
              
              {selectedSantri && (
                <div className="pt-2">
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-sm shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isOpenEdit ? <><CheckCircle className="w-5 h-5" /> SIMPAN PERUBAHAN EDIT</> : <><CheckCircle className="w-5 h-5" /> REKAM PERIZINAN BARU</>}
                  </button>
                </div>
              )}
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
