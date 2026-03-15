'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import {
  getNominalSPP, getStatusSPP, bayarSPP, getKamarsSPP, getDashboardSPPKamar,
  getClientRestriction, simpanSppBatch, setorkanSPP, getPreviewSetoran,
  getStatusSetoran, getTanggalTutupBuku
} from './actions'
import {
  Search, CreditCard, CheckCircle, AlertCircle, Loader2, ArrowLeft,
  Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle,
  SendHorizonal, RefreshCw, BadgeCheck, Clock, ChevronDown, ChevronUp,
  Banknote, Users, X
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

type FilterStatus = 'SEMUA' | 'SUDAH_BAYAR_INI' | 'NUNGGAK' | 'AMAN'

function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

// ── Section SETORKAN SPP ──────────────────────────────────────────────────
function SetorkanSection({ asrama, tahun }: { asrama: string; tahun: number }) {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const [expanded, setExpanded] = useState(false)
  const [bulan, setBulan] = useState(currentMonth)
  const [namaPenyetor, setNamaPenyetor] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [statusSetoran, setStatusSetoran] = useState<any>(null)
  const [tanggalTutup, setTanggalTutup] = useState(10)
  const [isSetoring, setIsSetoring] = useState(false)

  const tanggalHari = now.getDate()
  const sudahTutupBuku = tanggalHari >= tanggalTutup

  useEffect(() => {
    if (!expanded) return
    getTanggalTutupBuku(tahun).then(setTanggalTutup)
    loadStatus()
    loadPreview()
  }, [expanded, asrama, tahun, bulan])

  const loadStatus = async () => {
    const s = await getStatusSetoran(asrama, tahun, bulan)
    setStatusSetoran(s)
  }

  const loadPreview = async () => {
    setLoadingPreview(true)
    try {
      const p = await getPreviewSetoran(asrama, tahun, bulan)
      setPreview(p)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSetor = async () => {
    if (!namaPenyetor.trim()) return toast.error('Isi nama penyetor dulu')
    if (!preview || (preview.orang_bulan_ini === 0 && preview.orang_tunggakan === 0)) {
      return toast.error('Tidak ada data pembayaran untuk disetorkan')
    }
    if (!confirm(`Setorkan SPP ${BULAN_LIST[bulan - 1]} ${tahun} untuk asrama ${asrama}?`)) return

    setIsSetoring(true)
    try {
      const res = await setorkanSPP(asrama, tahun, bulan, namaPenyetor)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Setoran berhasil dikirim ke dewan santri!')
      loadStatus()
      loadPreview()
    } finally {
      setIsSetoring(false)
    }
  }

  const sudahSetor = statusSetoran?.status === 'terkirim' || statusSetoran?.status === 'dikonfirmasi'
  const sudahKonfirmasi = statusSetoran?.status === 'dikonfirmasi'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header tombol expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${sudahSetor ? 'bg-emerald-100' : sudahTutupBuku ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <SendHorizonal className={`w-5 h-5 ${sudahSetor ? 'text-emerald-600' : sudahTutupBuku ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-800">SETORKAN SPP</div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              {sudahSetor ? (
                <><BadgeCheck className="w-3 h-3 text-emerald-500" /> Sudah disetor {BULAN_LIST[bulan - 1]}</>
              ) : sudahTutupBuku ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Siap setor — lewat tgl {tanggalTutup}</>
              ) : (
                <><Clock className="w-3 h-3 text-amber-500" /> Tutup buku tgl {tanggalTutup} bulan ini</>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Panel expandable */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Status tutup buku */}
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
            sudahTutupBuku ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {sudahTutupBuku
              ? `Sudah melewati tanggal tutup buku (tgl ${tanggalTutup}). Siap untuk disetor.`
              : `Batas bayar santri adalah tanggal ${tanggalTutup}. Masih ${tanggalTutup - tanggalHari} hari lagi.`
            }
          </div>

          {/* Pilih bulan */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Bulan Setoran</label>
            <select
              value={bulan}
              onChange={e => setBulan(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {BULAN_LIST.map((b, i) => (
                <option key={i + 1} value={i + 1}>{b} {tahun}</option>
              ))}
            </select>
          </div>

          {/* Preview data */}
          {loadingPreview ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Menghitung...
            </div>
          ) : preview && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3">
                <div className="text-xs font-bold text-emerald-700 mb-1">SPP Bulan Ini</div>
                <div className="text-xl font-bold text-slate-800">{preview.orang_bulan_ini} <span className="text-sm font-normal text-slate-500">orang</span></div>
                <div className="text-sm font-semibold text-emerald-700 mt-0.5">{fmtRp(preview.nominal_bulan_ini)}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-xs font-bold text-amber-700 mb-1">Bayar Tunggakan</div>
                <div className="text-xl font-bold text-slate-800">{preview.orang_tunggakan} <span className="text-sm font-normal text-slate-500">orang</span></div>
                <div className="text-sm font-semibold text-amber-700 mt-0.5">{fmtRp(preview.nominal_tunggakan)}</div>
              </div>
              <div className="col-span-2 bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Setoran</span>
                <span className="font-bold text-slate-800">{fmtRp(preview.nominal_bulan_ini + preview.nominal_tunggakan)}</span>
              </div>
            </div>
          )}

          {/* Status setoran yang sudah ada */}
          {sudahSetor && (
            <div className={`rounded-xl p-3 flex items-start gap-2 ${sudahKonfirmasi ? 'bg-emerald-50' : 'bg-blue-50'}`}>
              <BadgeCheck className={`w-4 h-4 shrink-0 mt-0.5 ${sudahKonfirmasi ? 'text-emerald-600' : 'text-blue-600'}`} />
              <div className="text-xs">
                <div className={`font-bold ${sudahKonfirmasi ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {sudahKonfirmasi ? 'Setoran sudah dikonfirmasi dewan santri' : 'Setoran sudah dikirim, menunggu konfirmasi'}
                </div>
                {statusSetoran?.tanggal_setor && (
                  <div className="text-slate-500 mt-0.5">
                    Disetor: {format(new Date(statusSetoran.tanggal_setor), 'd MMM yyyy HH:mm', { locale: id })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form nama penyetor + tombol */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nama Penyetor</label>
            <input
              type="text"
              placeholder="Nama pengurus yang menyetor..."
              value={namaPenyetor}
              onChange={e => setNamaPenyetor(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleSetor}
            disabled={isSetoring || !preview || (preview.orang_bulan_ini === 0 && preview.orang_tunggakan === 0)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
              sudahSetor
                ? 'bg-slate-700 text-white hover:bg-slate-800'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-emerald-200'
            }`}
          >
            {isSetoring
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              : sudahSetor
                ? <><RefreshCw className="w-4 h-4" /> Setorkan Ulang</>
                : <><SendHorizonal className="w-4 h-4" /> Setorkan SPP</>
            }
          </button>
        </div>
      )}
    </div>
  )
}

export default function SPPPage() {
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])

  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  useEffect(() => {
    getNominalSPP().then(setNominal)
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res) }
    })
  }, [])

  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setSantriKamar([])
    setKamarCache({})
    setKamarIdx(0)
    setDrafts({})
    getKamarsSPP(tahun, asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama, tahun])

  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return
    if (kamarCache[kamar]) { setSantriKamar(kamarCache[kamar]); return }
    setLoadingKamar(true)
    setSantriKamar([])
    getDashboardSPPKamar(tahun, asrama, kamar).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [kamar]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars])

  const invalidateKamar = (kamar: string) => {
    setKamarCache(prev => { const n = { ...prev }; delete n[kamar]; return n })
  }

  useEffect(() => {
    if (view === 'PAYMENT') window.history.pushState({ view: 'PAYMENT' }, '')
  }, [view])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'PAYMENT') { setView('LIST'); setSelectedSantri(null) }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (view === 'PAYMENT' && selectedSantri) {
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }, [view, selectedSantri, tahun])

  const handleSelectSantri = (santri: any) => { setSelectedSantri(santri); setView('PAYMENT') }

  const handleBayar = async () => {
    if (selectedMonths.length === 0) return
    if (!confirm(`Bayar SPP ${selectedMonths.length} bulan? Total: ${fmtRp(selectedMonths.length * nominal)}`)) return
    const toastId = toast.loading('Memproses...')
    const res = await bayarSPP(selectedSantri.id, tahun, selectedMonths, nominal)
    toast.dismiss(toastId)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success('Pembayaran Berhasil!')
      invalidateKamar(selectedSantri.kamar)
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }

  const toggleDraft = (e: React.MouseEvent, santri: any) => {
    e.stopPropagation()
    setDrafts(prev => {
      const next = { ...prev }
      if (next[santri.id]) { delete next[santri.id] }
      else { next[santri.id] = { nominal, bulan: currentMonthIdx, nama: santri.nama_lengkap } }
      return next
    })
  }

  const handleSimpanBatch = async () => {
    const listPayload = Object.keys(drafts).map(id => ({
      santriId: id, bulan: drafts[id].bulan, tahun, nominal: drafts[id].nominal,
    }))
    if (!listPayload.length) return
    if (!confirm(`Simpan pembayaran untuk ${listPayload.length} santri?`)) return
    setIsSavingBatch(true)
    const res = await simpanSppBatch(listPayload)
    setIsSavingBatch(false)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success(`Sukses menyimpan ${(res as any).count} pembayaran!`)
      invalidateKamar(kamars[kamarIdx])
      setDrafts({})
    }
  }

  const toggleBulan = (idx: number) => {
    if (riwayatBayar.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

  const activeKamar = kamars[kamarIdx] ?? ''
  const filteredSantri = santriKamar.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false
    if (filterStatus === 'SUDAH_BAYAR_INI') return s.bulan_ini_lunas
    if (filterStatus === 'NUNGGAK') return s.jumlah_tunggakan > 0
    if (filterStatus === 'AMAN') return s.jumlah_tunggakan === 0
    return true
  })

  const totalDraft = Object.keys(drafts).length
  const totalNominalDraft = Object.values(drafts).reduce((a: number, b: any) => a + b.nominal, 0)

  // ── VIEW: LIST ────────────────────────────────────────────────────────
  if (view === 'LIST') return (
    <div className="space-y-5 max-w-5xl mx-auto pb-32">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600" /> Pembayaran SPP
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Monitoring pembayaran santri per kamar</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-sm font-bold text-slate-600">−</button>
            <span className="px-3 font-bold text-slate-800">{tahun}</span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-sm font-bold text-slate-600">+</button>
          </div>
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${userAsrama ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
            {userAsrama ? <Lock className="w-3.5 h-3.5 text-orange-500" /> : <Home className="w-3.5 h-3.5 text-slate-400" />}
            <select value={asrama} onChange={e => setAsrama(e.target.value)} disabled={!!userAsrama}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer disabled:cursor-not-allowed">
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION SETORKAN SPP */}
      <SetorkanSection asrama={asrama} tahun={tahun} />

      {/* SEARCH & FILTER */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input type="text" placeholder="Cari nama santri..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {(['SEMUA', 'SUDAH_BAYAR_INI', 'NUNGGAK', 'AMAN'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === f
                  ? f === 'SUDAH_BAYAR_INI' ? 'bg-white text-emerald-700 shadow-sm'
                  : f === 'NUNGGAK' ? 'bg-white text-red-700 shadow-sm'
                  : 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}>
              {f === 'SEMUA' ? 'Semua' : f === 'SUDAH_BAYAR_INI' ? `Lunas ${BULAN_LIST[currentMonthIdx - 1]}` : f === 'NUNGGAK' ? 'Menunggak' : 'Aman'}
            </button>
          ))}
        </div>
      </div>

      {/* KAMAR NAVIGATOR */}
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Kamar</span>
            <select value={kamarIdx} onChange={e => setKamarIdx(Number(e.target.value))}
              className="font-bold text-xl text-slate-800 text-center outline-none bg-transparent cursor-pointer">
              {kamars.map((k, idx) => <option key={k} value={idx}>{k}</option>)}
            </select>
          </div>
          <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* SANTRI LIST */}
      {loadingKamar ? (
        <div className="text-center py-12"><Loader2 className="w-7 h-7 animate-spin mx-auto text-slate-300" /></div>
      ) : !activeKamar ? null : filteredSantri.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl text-sm">
          {santriKamar.length === 0 ? 'Tidak ada santri di kamar ini.' : 'Tidak ada santri yang cocok.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <span className="font-bold text-slate-700">KAMAR {activeKamar}</span>
            <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg font-medium text-slate-500">{filteredSantri.length} Santri</span>
          </div>
          <div className="divide-y divide-slate-50">
            {filteredSantri.map((s: any) => {
              const isPaid = s.bulan_ini_lunas
              const isDraft = !!drafts[s.id]
              return (
                <div key={s.id} onClick={() => handleSelectSantri(s)}
                  className={`p-4 flex items-center justify-between transition-colors cursor-pointer group ${isDraft ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 border group-hover:bg-white flex-shrink-0">
                      {s.nis.slice(-2)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{s.nama_lengkap}</p>
                      <div className="flex gap-2 text-xs text-slate-400 items-center">
                        <span>{s.nis}</span>
                        {s.jumlah_tunggakan > 0 && (
                          <span className="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-md">
                            -{s.jumlah_tunggakan} Bln
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {isCurrentYear && !isPaid ? (
                      <button onClick={(e) => toggleDraft(e, s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                          isDraft
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : 'bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                        }`}>
                        {isDraft ? <><CheckCircle className="w-3 h-3" /> Siap Bayar</> : <><PlusCircle className="w-3 h-3" /> Bayar {BULAN_LIST[currentMonthIdx - 1]}</>}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                        <CheckCircle className="w-3 h-3" /> Lunas
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FLOATING SAVE */}
      {totalDraft > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
          <button onClick={handleSimpanBatch} disabled={isSavingBatch}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-all active:scale-95 disabled:opacity-70">
            <div className="text-left">
              <p className="text-xs text-slate-400">{totalDraft} Santri Dipilih</p>
              <p className="text-xl font-bold text-emerald-400">{fmtRp(totalNominalDraft)}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-xl">
              {isSavingBatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSavingBatch ? 'Menyimpan...' : 'SIMPAN'}
            </div>
          </button>
        </div>
      )}
    </div>
  )

  // ── VIEW: PAYMENT ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-20 animate-in slide-in-from-right-4">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Input Pembayaran</h1>
          <p className="text-sm text-slate-500">Untuk: <span className="font-bold text-emerald-600">{selectedSantri?.nama_lengkap}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {BULAN_LIST.map((namaBulan, idx) => {
          const bulanIndex = idx + 1
          const dataBayar = riwayatBayar.find(r => r.bulan === bulanIndex)
          const isSelected = selectedMonths.includes(bulanIndex)
          let cls = 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
          if (dataBayar) cls = 'bg-emerald-50 border-emerald-400 text-emerald-800 cursor-default'
          else if (isSelected) cls = 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105'
          else if ((tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonthIdx)) {
            cls = 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          }
          return (
            <div key={bulanIndex} onClick={() => toggleBulan(bulanIndex)}
              className={`p-4 rounded-2xl border-2 flex flex-col justify-between h-28 transition-all cursor-pointer ${cls}`}>
              <div className="flex justify-between items-start">
                <span className="font-bold">{namaBulan}</span>
                {dataBayar && <CheckCircle className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                {dataBayar ? (
                  <>
                    <p className="font-semibold opacity-80">LUNAS</p>
                    <p className="opacity-60">{format(new Date(dataBayar.tanggal_bayar), 'dd/MM/yy', { locale: id })}</p>
                  </>
                ) : (
                  <>
                    <p className="opacity-70">Tagihan</p>
                    <p className="font-bold text-base">{fmtRp(nominal)}</p>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedMonths.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
          <button onClick={handleBayar}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-all active:scale-95">
            <div className="text-left">
              <p className="text-xs text-slate-400">Total ({selectedMonths.length} Bulan)</p>
              <p className="text-xl font-bold text-emerald-400">{fmtRp(selectedMonths.length * nominal)}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-xl">
              BAYAR <CreditCard className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
