'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Eye, Filter, Loader2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import Pagination from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  cariSantriDenda,
  catatDendaBukuPribadi,
  getAsramaDendaList,
  getDendaBukuPribadiData,
  getDendaBukuPribadiDetail,
  getNextDendaBukuPribadi,
  hapusDendaBukuPribadi,
  tandaiDendaBukuPribadiLunas,
  type DendaBukuDetail,
  type DendaSantriSummary,
  type DendaStats,
  type SantriOption,
} from './actions'

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const emptyStats: DendaStats = {
  totalSantri: 0,
  totalKasus: 0,
  totalNominal: 0,
  totalBelumLunas: 0,
}

export default function DendaBukuPribadiPageContent() {
  const confirm = useConfirm()
  const pendingPageSizeRef = useRef<number | null>(null)
  const [rows, setRows] = useState<DendaSantriSummary[]>([])
  const [stats, setStats] = useState<DendaStats>(emptyStats)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [asramaOptions, setAsramaOptions] = useState<string[]>([])
  const [asrama, setAsrama] = useState('SEMUA')
  const [tglAwal, setTglAwal] = useState('')
  const [tglAkhir, setTglAkhir] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [santriSearch, setSantriSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<SantriOption[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null)
  const [tanggal, setTanggal] = useState(todayKey())
  const [keterangan, setKeterangan] = useState('')
  const [langsungLunas, setLangsungLunas] = useState(false)
  const [nextDenda, setNextDenda] = useState<{ kehilanganKe: number; nominal: number } | null>(null)
  const [showCatatModal, setShowCatatModal] = useState(false)
  const [modalSantri, setModalSantri] = useState<DendaSantriSummary | null>(null)
  const [details, setDetails] = useState<DendaBukuDetail[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getAsramaDendaList().then(setAsramaOptions)
  }, [])

  const loadData = async (nextPage = page, nextPageSize = pageSize, nextSearch = search, nextAsrama = asrama, nextTglAwal = tglAwal, nextTglAkhir = tglAkhir) => {
    setLoading(true)
    try {
      const data = await getDendaBukuPribadiData({
        page: nextPage,
        pageSize: nextPageSize,
        search: nextSearch,
        asrama: nextAsrama,
        tglAwal: nextTglAwal,
        tglAkhir: nextTglAkhir,
      })
      setRows(data.rows)
      setStats(data.stats)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(data.page)
      setPageSize(data.pageSize)
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = async () => {
    if (tglAwal && tglAkhir && tglAkhir < tglAwal) {
      toast.error('Tanggal akhir tidak boleh lebih kecil dari tanggal awal')
      return
    }
    pendingPageSizeRef.current = null
    const trimmedSearch = searchInput.trim()
    setSearch(trimmedSearch)
    setPage(1)
    await loadData(1, pageSize, trimmedSearch, asrama, tglAwal, tglAkhir)
  }

  const handleResetFilter = () => {
    pendingPageSizeRef.current = null
    setSearchInput('')
    setSearch('')
    setAsrama('SEMUA')
    setTglAwal('')
    setTglAkhir('')
    setPage(1)
    setPageSize(10)
    setRows([])
    setStats(emptyStats)
    setTotal(0)
    setTotalPages(1)
    setHasLoaded(false)
  }

  const handlePageChange = async (nextPage: number) => {
    const effectivePageSize = pendingPageSizeRef.current ?? pageSize
    pendingPageSizeRef.current = null
    if (!hasLoaded) return
    setPage(nextPage)
    setPageSize(effectivePageSize)
    await loadData(nextPage, effectivePageSize, search, asrama, tglAwal, tglAkhir)
  }

  const handlePageSizeChange = (nextSize: number) => {
    pendingPageSizeRef.current = nextSize
    setPageSize(nextSize)
    setPage(1)
  }

  const resetCatatForm = () => {
    setSantriSearch('')
    setHasilCari([])
    setSelectedSantri(null)
    setTanggal(todayKey())
    setKeterangan('')
    setLangsungLunas(false)
    setNextDenda(null)
  }

  const openCatatModal = () => {
    resetCatatForm()
    setShowCatatModal(true)
  }

  const closeCatatModal = () => {
    setShowCatatModal(false)
    resetCatatForm()
  }

  const handleCariSantri = async () => {
    if (santriSearch.trim().length < 2) {
      toast.warning('Ketik minimal 2 huruf nama atau NIS')
      return
    }
    const res = await cariSantriDenda(santriSearch)
    setHasilCari(res)
    if (res.length === 0) toast.info('Santri tidak ditemukan')
  }

  const pilihSantri = async (santri: SantriOption) => {
    setSelectedSantri(santri)
    setHasilCari([])
    const next = await getNextDendaBukuPribadi(santri.id)
    setNextDenda(next)
  }

  const submitDenda = () => {
    if (!selectedSantri) {
      toast.error('Pilih santri dulu')
      return
    }

    const payload = new FormData()
    payload.set('santri_id', selectedSantri.id)
    payload.set('tanggal', tanggal)
    payload.set('keterangan', keterangan)
    payload.set('langsung_lunas', langsungLunas ? '1' : '0')

    startTransition(async () => {
      const res = await catatDendaBukuPribadi(payload)
      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success(
        langsungLunas
          ? `Denda ke-${res.kehilanganKe} dicatat dan langsung lunas: ${rupiah(res.nominal)}`
          : `Denda ke-${res.kehilanganKe} dicatat: ${rupiah(res.nominal)}`
      )
      closeCatatModal()
      if (hasLoaded) await loadData(page, pageSize, search, asrama, tglAwal, tglAkhir)
    })
  }

  const openDetail = async (row: DendaSantriSummary) => {
    setModalSantri(row)
    setLoadingDetails(true)
    const data = await getDendaBukuPribadiDetail(row.santri_id)
    setDetails(data)
    setLoadingDetails(false)
  }

  const tandaiLunas = (item: DendaBukuDetail) => {
    startTransition(async () => {
      const res = await tandaiDendaBukuPribadiLunas(item.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Denda ke-${item.kehilangan_ke} ditandai lunas`)
      if (modalSantri) await openDetail(modalSantri)
      if (hasLoaded) await loadData(page, pageSize, search, asrama, tglAwal, tglAkhir)
    })
  }

  const handleDelete = async (item: DendaBukuDetail) => {
    if (!await confirm(
      `Hapus denda kehilangan ke-${item.kehilangan_ke} untuk ${modalSantri?.nama_lengkap || 'santri ini'}?\n\nUrutan denda santri ini akan disesuaikan ulang agar nominal berikutnya tetap konsisten.`,
      { confirmLabel: 'Ya, Hapus' }
    )) return

    startTransition(async () => {
      const res = await hapusDendaBukuPribadi(item.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Record denda ${res.nama} berhasil dihapus`)
      if (modalSantri) await openDetail(modalSantri)
      if (hasLoaded) await loadData(page, pageSize, search, asrama, tglAwal, tglAkhir)
    })
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Denda Buku Pribadi</h1>
          <p className="text-sm text-slate-500 mt-1">Catat kehilangan buku pribadi. Nominal otomatis naik Rp25.000 setiap kejadian.</p>
        </div>
        <button
          onClick={openCatatModal}
          className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" /> Catat Kehilangan
        </button>
      </div>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Filter className="w-4 h-4 text-rose-600" /> Filter Data
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase">Cari</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilter()}
                placeholder="Nama, NIS, atau asrama"
                className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase">Asrama</label>
            <select
              value={asrama}
              onChange={e => setAsrama(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400 bg-white"
            >
              <option value="SEMUA">Semua Asrama</option>
              {asramaOptions.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase">Tanggal Awal</label>
            <input
              type="date"
              value={tglAwal}
              onChange={e => setTglAwal(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase">Tanggal Akhir</label>
            <input
              type="date"
              value={tglAkhir}
              onChange={e => setTglAkhir(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleApplyFilter}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold px-4 py-2.5 rounded-xl text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Tampilkan
          </button>
          <button
            onClick={handleResetFilter}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Santri Tercatat" value={hasLoaded ? stats.totalSantri.toLocaleString('id-ID') : '-'} />
        <StatCard label="Total Kejadian" value={hasLoaded ? stats.totalKasus.toLocaleString('id-ID') : '-'} />
        <StatCard label="Total Denda" value={hasLoaded ? rupiah(stats.totalNominal) : '-'} />
        <StatCard label="Belum Lunas" value={hasLoaded ? rupiah(stats.totalBelumLunas) : '-'} dark />
      </div>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50">
          <h2 className="font-bold text-slate-800">Riwayat Denda</h2>
          <p className="text-sm text-slate-500">
            {!hasLoaded
              ? 'Pilih filter lalu klik tampilkan untuk memuat data.'
              : 'Satu santri tampil satu baris. Detail kehilangan dibuka dari tombol lihat.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-bold min-w-[220px]">Santri</th>
                <th className="px-4 py-3 text-left font-bold w-40">Asrama</th>
                <th className="px-4 py-3 text-center font-bold w-28">Kejadian</th>
                <th className="px-4 py-3 text-right font-bold w-36">Total</th>
                <th className="px-4 py-3 text-right font-bold w-36">Belum Lunas</th>
                <th className="px-4 py-3 text-left font-bold w-36">Terakhir</th>
                <th className="px-4 py-3 text-right font-bold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!hasLoaded ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Belum ada data ditampilkan.</td></tr>
              ) : loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Tidak ada data denda sesuai filter.</td></tr>
              ) : rows.map(row => (
                <tr key={row.santri_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{row.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{row.nis || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.asrama || '-'} / {row.kamar || '-'}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{row.total_kasus}x</td>
                  <td className="px-4 py-3 text-right font-semibold">{rupiah(row.total_nominal)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${row.total_belum_lunas > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {rupiah(row.total_belum_lunas)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.terakhir_hilang)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDetail(row)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                      <Eye className="w-3.5 h-3.5" /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasLoaded && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </section>

      {showCatatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3 bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-800">Catat Kehilangan</h2>
                <p className="text-sm text-slate-500">Pilih santri, sistem akan menghitung nominal otomatis.</p>
              </div>
              <button onClick={closeCatatModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Cari Santri</label>
                <div className="flex gap-2">
                  <input
                    value={santriSearch}
                    onChange={e => setSantriSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCariSantri()}
                    placeholder="Nama atau NIS"
                    className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                  />
                  <button onClick={handleCariSantri} className="bg-rose-600 hover:bg-rose-700 text-white px-3 rounded-xl">
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {hasilCari.length > 0 && (
                  <div className="border rounded-xl overflow-hidden bg-white">
                    {hasilCari.map(santri => (
                      <button
                        key={santri.id}
                        onClick={() => pilihSantri(santri)}
                        className="w-full text-left px-3 py-2.5 hover:bg-rose-50 border-b last:border-b-0"
                      >
                        <p className="font-bold text-sm text-slate-800">{santri.nama_lengkap}</p>
                        <p className="text-xs text-slate-500">{santri.asrama || '-'} / Kamar {santri.kamar || '-'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedSantri ? (
                <div className="border rounded-2xl p-4 bg-rose-50 border-rose-100">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-rose-500 uppercase">Santri Dipilih</p>
                      <p className="font-bold text-slate-900 mt-0.5">{selectedSantri.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{selectedSantri.asrama || '-'} / Kamar {selectedSantri.kamar || '-'}</p>
                    </div>
                    <button onClick={() => { setSelectedSantri(null); setNextDenda(null) }} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-white rounded-xl border p-3">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Hilang Ke</p>
                      <p className="text-xl font-bold text-slate-800">{nextDenda?.kehilanganKe || '-'}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-3">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Nominal</p>
                      <p className="text-xl font-bold text-rose-700">{rupiah(nextDenda?.nominal || 0)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Tanggal</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Keterangan</label>
                  <textarea
                    value={keterangan}
                    onChange={e => setKeterangan(e.target.value)}
                    rows={3}
                    placeholder="Opsional"
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                  />
                </div>
                <label className="flex items-start gap-3 border rounded-2xl p-3 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={langsungLunas}
                    onChange={e => setLangsungLunas(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-bold text-sm text-slate-800">Langsung tandai lunas</p>
                    <p className="text-xs text-slate-500">Centang ini kalau denda langsung dibayar saat dicatat.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-5 border-t bg-white">
              <button
                onClick={submitDenda}
                disabled={pending || !selectedSantri}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {langsungLunas ? 'Catat & Lunas' : 'Catat Denda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSantri && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">{modalSantri.nama_lengkap}</h2>
                <p className="text-sm text-slate-500">{modalSantri.asrama || '-'} / Kamar {modalSantri.kamar || '-'}</p>
              </div>
              <button onClick={() => setModalSantri(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {loadingDetails ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : details.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Belum ada record denda untuk santri ini.</div>
              ) : (
                <div className="space-y-3">
                  {details.map(item => (
                    <div key={item.id} className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">Kehilangan ke-{item.kehilangan_ke}</p>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {item.status === 'LUNAS' ? 'Lunas' : 'Belum Bayar'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(item.tanggal)} oleh {item.admin_nama || '-'}</p>
                        {item.keterangan ? <p className="text-sm text-slate-600 mt-2">{item.keterangan}</p> : null}
                        {item.paid_at ? <p className="text-xs text-emerald-700 mt-2">Lunas {formatDate(item.paid_at)} oleh {item.paid_by_nama || '-'}</p> : null}
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3">
                        <p className="font-bold text-lg text-slate-900">{rupiah(item.nominal)}</p>
                        <div className="flex items-center gap-2">
                          {item.status === 'BELUM_BAYAR' ? (
                            <button
                              onClick={() => tandaiLunas(item)}
                              disabled={pending}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Lunas
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={pending}
                            className="bg-red-50 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300 text-red-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-red-200"
                          >
                            <Trash2 className="w-4 h-4" /> Hapus
                          </button>
                        </div>
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
  )
}

function StatCard({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`${dark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'} border rounded-2xl p-4`}>
      <p className={`text-[11px] font-bold uppercase ${dark ? 'text-white/50' : 'text-slate-500'}`}>{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
