'use client'

import React, { useState, useCallback } from 'react'
import { getSantriBaru, simpanTes, getAsramaList } from './actions'
import {
  Search, Save, CheckCircle, Clock, GraduationCap,
  RefreshCw, X, FileText, BookOpen, Hash, User,
  ChevronLeft, ChevronRight, Filter, AlertCircle, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

type FilterStatus = 'SEMUA' | 'SUDAH' | 'BELUM'

type Santri = {
  id: string; nis: string; nama: string; jk: string
  asrama: string; kamar: string; status_tes: 'SUDAH' | 'BELUM'
  hasil: {
    id: string; rekomendasi_marhalah: string; catatan_grade: string
    hari_tes: string; sesi_tes: string; tulis_arab: string
    baca_kelancaran: string; baca_tajwid: string
    hafalan_juz: number; nahwu_pengalaman: number
  } | null
}

export default function TesKlasifikasiPage() {
  const [rows, setRows]           = useState<Santri[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [asramaList, setAsramaList] = useState<string[]>([])

  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null)
  const [saving, setSaving] = useState(false)

  function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }

  // Load asrama list sekali saat mount
  React.useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  const loadData = useCallback(async (pg = 1, s = search, f = filterStatus, a = filterAsrama) => {
    setLoading(true)
    try {
      const res = await getSantriBaru({ search: s, page: pg, filterStatus: f, asrama: a !== 'SEMUA' ? a : undefined })
      setRows(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
      setHasLoaded(true)
    } catch (err: any) {
      toast.error('Gagal memuat data', { description: err?.message })
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    loadData(1, searchInput, filterStatus, filterAsrama)
  }

  const handleFilterStatus = (f: FilterStatus) => {
    setFilterStatus(f)
    if (hasLoaded) loadData(1, search, f, filterAsrama)
  }

  const handleFilterAsrama = (a: string) => {
    setFilterAsrama(a)
    if (hasLoaded) loadData(1, search, filterStatus, a)
  }

  const handleOpenForm = (santri: Santri) => {
    setSelectedSantri(santri)
    document.body.style.overflow = 'hidden'
  }

  const handleCloseForm = () => {
    setSelectedSantri(null)
    document.body.style.overflow = 'unset'
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    const res = await simpanTes(formData)
    setSaving(false)
    if ('error' in res) {
      toast.error('Gagal menyimpan', { description: (res as any).error })
    } else {
      toast.success('Hasil tes berhasil disimpan!')
      handleCloseForm()
      loadData(page)
    }
  }

  const sudah  = rows.filter(r => r.status_tes === 'SUDAH').length
  const belum  = rows.filter(r => r.status_tes === 'BELUM').length

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tes Klasifikasi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Penentuan marhalah awal santri baru</p>
        </div>
        {hasLoaded && (
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold">
              ✓ {fmtNum(sudah)} sudah dites
            </span>
            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl font-semibold">
              {fmtNum(total)} total
            </span>
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari Santri</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nama atau NIS..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </form>

          {/* Filter asrama */}
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={filterAsrama} onChange={e => handleFilterAsrama(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Filter status */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Status Tes</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['SEMUA', 'BELUM', 'SUDAH'] as FilterStatus[]).map(f => (
                <button key={f} onClick={() => handleFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === f
                      ? f === 'SUDAH' ? 'bg-white text-emerald-700 shadow-sm'
                      : f === 'BELUM' ? 'bg-white text-amber-700 shadow-sm'
                      : 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {f === 'SEMUA' ? 'Semua' : f === 'SUDAH' ? 'Sudah Dites' : 'Belum Dites'}
                </button>
              ))}
            </div>
          </div>

          {/* Tombol tampilkan */}
          <button
            onClick={() => { setSearch(searchInput); loadData(1, searchInput, filterStatus, filterAsrama) }}
            disabled={loading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 self-end"
          >
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
        </div>
      </div>

      {/* ── Konten ── */}
      {!hasLoaded ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Data belum dimuat</p>
          <p className="text-sm text-slate-400">Tekan <strong>Tampilkan</strong> untuk melihat daftar santri baru</p>
          <button onClick={() => loadData(1)}
            className="mt-1 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700">
            Tampilkan Sekarang
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-2 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle className="w-10 h-10 text-emerald-300" />
          <p className="font-semibold text-slate-600">Tidak ada santri yang cocok</p>
          <p className="text-sm text-slate-400">Coba ubah filter atau kata pencarian</p>
        </div>
      ) : (
        <>
          {/* Info */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              <strong className="text-slate-700">{fmtNum(rows.length)}</strong> dari <strong className="text-slate-700">{fmtNum(total)}</strong> santri baru
            </span>
            <span className="text-xs">Hal {page}/{totalPages}</span>
          </div>

          {/* ── Mobile: Cards ── */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Indikator garis samping */}
                <div className={`h-1 w-full ${s.status_tes === 'SUDAH' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{s.nama}</h3>
                      <span className="text-xs text-slate-400">{s.asrama || '—'} / {s.kamar || '—'}</span>
                    </div>
                    {s.status_tes === 'SUDAH'
                      ? <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3" /> SUDAH
                        </span>
                      : <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          <Clock className="w-3 h-3" /> BELUM
                        </span>
                    }
                  </div>

                  {s.hasil ? (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Rekomendasi</p>
                      <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-blue-600" /> {s.hasil.rekomendasi_marhalah}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.hasil.catatan_grade}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-400 italic">Menunggu penilaian</p>
                    </div>
                  )}

                  <button onClick={() => handleOpenForm(s)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                      s.status_tes === 'SUDAH'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}>
                    {s.status_tes === 'SUDAH' ? 'Edit Penilaian' : 'Mulai Input Tes'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: Tabel ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8">No</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Santri</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asrama / Kamar</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hasil Rekomendasi</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-300">{(page - 1) * 30 + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{s.nama}</div>
                      <div className="text-xs text-slate-400">{s.nis}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {s.asrama || '—'} / <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded-lg">{s.kamar || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status_tes === 'SUDAH'
                        ? <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Sudah Dites
                          </span>
                        : <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200">
                            <Clock className="w-3 h-3" /> Belum
                          </span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {s.hasil ? (
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-100">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div>
                            <div className="font-bold text-xs">{s.hasil.rekomendasi_marhalah}</div>
                            <div className="text-[10px] text-blue-500">{s.hasil.catatan_grade}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">— Belum dinilai —</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleOpenForm(s)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          s.status_tes === 'SUDAH'
                            ? 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}>
                        {s.status_tes === 'SUDAH' ? 'Edit Nilai' : 'Input Tes'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => loadData(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button key={pg} onClick={() => loadData(pg)} disabled={loading}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                        pg === page ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={() => loadData(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modal Form Penilaian ── */}
      {selectedSantri && (
        <div className="fixed inset-0 bg-slate-900/60 flex flex-col md:items-center md:justify-center z-50 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 md:zoom-in-95">
            <form onSubmit={handleSimpan} className="flex flex-col h-full">

              {/* Header Modal */}
              <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800">Form Tes Klasifikasi</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <User className="w-3 h-3" />
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]">{selectedSantri.nama}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-medium border border-slate-200">
                      {selectedSantri.asrama || '—'} / {selectedSantri.kamar || '—'}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={handleCloseForm}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-4 md:p-5 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">

                {/* A. Menulis */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><FileText className="w-3.5 h-3.5" /></span>
                    A. Kemampuan Menulis Arab
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['BAIK', 'KURANG', 'TIDAK_BISA'].map(opt => (
                      <label key={opt} className="cursor-pointer">
                        <input type="radio" name="tulis_arab" value={opt}
                          defaultChecked={selectedSantri.hasil?.tulis_arab === opt} required className="peer sr-only" />
                        <div className="py-2.5 px-1 rounded-xl border-2 border-slate-200 text-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 transition-all hover:border-emerald-200 active:scale-95 text-xs font-bold">
                          {opt.replace('_', ' ')}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* B. Membaca */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><BookOpen className="w-3.5 h-3.5" /></span>
                    B. Kemampuan Membaca Qur'an
                  </h4>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">1. Kelancaran</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['LANCAR', 'TIDAK_LANCAR', 'TIDAK_BISA'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_kelancaran" value={opt}
                            defaultChecked={selectedSantri.hasil?.baca_kelancaran === opt} required className="peer sr-only" />
                          <div className="py-2.5 px-1 rounded-xl border-2 border-slate-200 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 transition-all hover:border-blue-200 active:scale-95 text-xs font-bold">
                            {opt.replace('_', ' ')}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">2. Tajwid</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['BAIK', 'KURANG', 'BURUK'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_tajwid" value={opt}
                            defaultChecked={selectedSantri.hasil?.baca_tajwid === opt} required className="peer sr-only" />
                          <div className="py-2.5 px-1 rounded-xl border-2 border-slate-200 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 transition-all hover:border-blue-200 active:scale-95 text-xs font-bold">
                            {opt}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Hash className="w-3.5 h-3.5 text-slate-400" /> 3. Hafalan (Juz)
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                      <input type="number" name="hafalan_juz"
                        defaultValue={selectedSantri.hasil?.hafalan_juz ?? 0}
                        placeholder="0" min="0" max="30"
                        className="w-12 text-center font-bold text-lg text-blue-700 outline-none bg-transparent" />
                      <span className="text-xs text-slate-400 font-medium">Juz</span>
                    </div>
                  </div>
                </div>

                {/* C. Nahwu */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><BookOpen className="w-3.5 h-3.5" /></span>
                    C. Pengalaman Belajar Nahwu
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="on"
                        defaultChecked={!!selectedSantri.hasil?.nahwu_pengalaman} className="peer sr-only" />
                      <div className="p-3 rounded-xl border-2 border-slate-200 text-center peer-checked:border-amber-500 peer-checked:bg-amber-50 transition-all hover:border-amber-200 active:scale-95">
                        <span className="block text-sm font-black text-slate-800">SUDAH PERNAH</span>
                        <span className="text-[10px] text-slate-500">→ Lanjut tes spesifik</span>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="off"
                        defaultChecked={!selectedSantri.hasil?.nahwu_pengalaman} className="peer sr-only" />
                      <div className="p-3 rounded-xl border-2 border-slate-200 text-center peer-checked:border-slate-500 peer-checked:bg-slate-100 transition-all hover:border-slate-300 active:scale-95">
                        <span className="block text-sm font-black text-slate-800">BELUM PERNAH</span>
                        <span className="text-[10px] text-slate-500">→ Masuk kelas dasar</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="p-4 md:p-5 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-2 sticky bottom-0 shrink-0">
                <button type="button" onClick={handleCloseForm}
                  className="w-full sm:w-auto px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition-all active:scale-[0.98]">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan & Hitung Hasil</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}
