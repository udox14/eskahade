'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, Eye, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  cariSantriDenda,
  catatDendaBukuPribadi,
  getDendaBukuPribadiData,
  getDendaBukuPribadiDetail,
  getNextDendaBukuPribadi,
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

export default function DendaBukuPribadiPageContent() {
  const [rows, setRows] = useState<DendaSantriSummary[]>([])
  const [stats, setStats] = useState<DendaStats>({ totalSantri: 0, totalKasus: 0, totalNominal: 0, totalBelumLunas: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [santriSearch, setSantriSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<SantriOption[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null)
  const [tanggal, setTanggal] = useState(todayKey())
  const [keterangan, setKeterangan] = useState('')
  const [nextDenda, setNextDenda] = useState<{ kehilanganKe: number; nominal: number } | null>(null)
  const [showCatatModal, setShowCatatModal] = useState(false)
  const [modalSantri, setModalSantri] = useState<DendaSantriSummary | null>(null)
  const [details, setDetails] = useState<DendaBukuDetail[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [pending, startTransition] = useTransition()

  const loadData = async () => {
    setLoading(true)
    const data = await getDendaBukuPribadiData()
    setRows(data.rows)
    setStats(data.stats)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  const filteredRows = useMemo(() => {
    const clean = search.trim().toLowerCase()
    if (!clean) return rows
    return rows.filter(row =>
      row.nama_lengkap.toLowerCase().includes(clean) ||
      (row.nis || '').toLowerCase().includes(clean) ||
      (row.asrama || '').toLowerCase().includes(clean)
    )
  }, [rows, search])

  const resetCatatForm = () => {
    setSantriSearch('')
    setHasilCari([])
    setSelectedSantri(null)
    setTanggal(todayKey())
    setKeterangan('')
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

    startTransition(async () => {
      const res = await catatDendaBukuPribadi(payload)
      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success(`Denda ke-${res.kehilanganKe} dicatat: ${rupiah(res.nominal)}`)
      closeCatatModal()
      await loadData()
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
      await loadData()
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Santri Tercatat" value={stats.totalSantri.toLocaleString('id-ID')} />
        <StatCard label="Total Kejadian" value={stats.totalKasus.toLocaleString('id-ID')} />
        <StatCard label="Total Denda" value={rupiah(stats.totalNominal)} />
        <StatCard label="Belum Lunas" value={rupiah(stats.totalBelumLunas)} dark />
      </div>

      <div>
        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800">Riwayat Denda</h2>
              <p className="text-sm text-slate-500">Satu santri tampil satu baris. Detail kehilangan dibuka dari tombol lihat.</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter tabel"
                className="pl-9 pr-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
              />
            </div>
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
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">Belum ada denda buku pribadi.</td></tr>
                ) : filteredRows.map(row => (
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
        </section>
      </div>

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
              </div>
            </div>

            <div className="p-5 border-t bg-white">
              <button
                onClick={submitDenda}
                disabled={pending || !selectedSantri}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Catat Denda
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
                        {item.status === 'BELUM_BAYAR' ? (
                          <button
                            onClick={() => tandaiLunas(item)}
                            disabled={pending}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Lunas
                          </button>
                        ) : null}
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
