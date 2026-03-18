'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getNominalSPP, getStatusSPP, bayarSPP, getKamarsSPP, getDashboardSPPKamar, getClientRestriction, simpanSppBatch } from './actions'
import { Search, CreditCard, User, CheckCircle, AlertCircle, Loader2, ArrowLeft, Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

type FilterStatus = 'SEMUA' | 'SUDAH_BAYAR_INI' | 'NUNGGAK' | 'AMAN'

export default function SPPPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  // Daftar kamar (ringan, hanya nama kamar)
  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  // Data santri kamar aktif (lazy)
  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  // Cache: kamar → santri[], supaya tidak re-fetch kamar yang sudah pernah dibuka
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // Payment view
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])

  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  // Init
  useEffect(() => {
    getNominalSPP().then(setNominal)
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res) }
    })
  }, [])

  // Load daftar kamar saat asrama/tahun berubah — ringan, hanya distinct kamar
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

  // Load santri kamar aktif — lazy, dengan cache
  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    // Kalau sudah di-cache, pakai cache
    if (kamarCache[kamar]) {
      setSantriKamar(kamarCache[kamar])
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDashboardSPPKamar(tahun, asrama, kamar).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [kamar]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars])

  // Invalidate cache kamar tertentu setelah simpan batch
  const invalidateKamar = async (kamar: string) => {
    setKamarCache(prev => { const n = { ...prev }; delete n[kamar]; return n })
  }

  // Back button
  useEffect(() => {
    if (view === 'PAYMENT') window.history.pushState({ view: 'PAYMENT' }, '')
  }, [view])
  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'PAYMENT') {
        setView('LIST')
        setSelectedSantri(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Payment
  useEffect(() => {
    if (view === 'PAYMENT' && selectedSantri) {
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }, [view, selectedSantri, tahun])

  const handleSelectSantri = async (santri: any) => {
    setSelectedSantri(santri)
    setView('PAYMENT')
  }

  const handleBayar = async () => {
    if (selectedMonths.length === 0) return
    if (!await confirm(`Bayar SPP ${selectedMonths.length} bulan? Total: Rp ${(selectedMonths.length * nominal).toLocaleString('id-ID')}`)) return
    const toastId = toast.loading('Memproses...')
    const res = await bayarSPP(selectedSantri.id, tahun, selectedMonths, nominal)
    toast.dismiss(toastId)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success('Pembayaran Berhasil!')
      // Invalidate cache kamar santri ini supaya refresh saat kembali
      invalidateKamar(selectedSantri.kamar)
      getStatusSPP(selectedSantri.id, tahun).then(data => {
        setRiwayatBayar(data)
        setSelectedMonths([])
      })
    }
  }

  const toggleDraft = async (e: React.MouseEvent, santri: any) => {
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
    if (!await confirm(`Simpan pembayaran untuk ${listPayload.length} santri?`)) return
    setIsSavingBatch(true)
    const res = await simpanSppBatch(listPayload)
    setIsSavingBatch(false)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success(`Sukses menyimpan ${(res as any).count} pembayaran!`)
      // Invalidate cache kamar aktif
      invalidateKamar(kamars[kamarIdx])
      setDrafts({})
    }
  }

  const toggleBulan = async (idx: number) => {
    if (riwayatBayar.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

  const handleBackToList = async () => { window.history.back() }

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

  // ── VIEW: LIST ──────────────────────────────────────────────────────────
  if (view === 'LIST') return (
    <div className="space-y-6 max-w-5xl mx-auto pb-32">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600"/> Dashboard SPP
          </h1>
          <p className="text-slate-500 text-sm">Monitoring pembayaran santri per kamar.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">-</button>
            <span className="px-2 font-mono font-bold text-slate-700">{tahun}</span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">+</button>
          </div>
          <div className={`p-2 rounded-lg border flex items-center gap-2 ${userAsrama ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
            {userAsrama ? <Lock className="w-3 h-3 text-orange-600"/> : <Home className="w-4 h-4 text-slate-400"/>}
            <select
              value={asrama}
              onChange={e => setAsrama(e.target.value)}
              disabled={!!userAsrama}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5"/>
          <input
            type="text"
            placeholder="Cari nama santri..."
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0"/>
          {(['SEMUA', 'SUDAH_BAYAR_INI', 'NUNGGAK', 'AMAN'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === f
                  ? f === 'SUDAH_BAYAR_INI' ? 'bg-green-100 text-green-700 shadow-sm'
                  : f === 'NUNGGAK' ? 'bg-red-100 text-red-700 shadow-sm'
                  : 'bg-white shadow text-slate-800'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}>
              {f === 'SEMUA' ? 'Semua' : f === 'SUDAH_BAYAR_INI' ? `Lunas ${BULAN_LIST[currentMonthIdx - 1]}` : f === 'NUNGGAK' ? 'Menunggak' : 'Aman'}
            </button>
          ))}
        </div>
      </div>

      {/* KAMAR NAVIGATOR */}
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronLeft className="w-6 h-6"/>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Kamar Saat Ini</span>
            <select value={kamarIdx} onChange={e => setKamarIdx(Number(e.target.value))}
              className="font-bold text-lg text-slate-800 text-center outline-none bg-transparent cursor-pointer">
              {kamars.map((k, idx) => <option key={k} value={idx}>{k}</option>)}
            </select>
          </div>
          <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronRight className="w-6 h-6"/>
          </button>
        </div>
      )}

      {/* SANTRI LIST */}
      {loadingKamar ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
      ) : !activeKamar ? null : filteredSantri.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">
          {santriKamar.length === 0 ? 'Tidak ada santri di kamar ini.' : 'Tidak ada santri yang cocok dengan filter.'}
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b font-bold text-slate-700 text-sm flex justify-between items-center">
            <span className="text-lg">KAMAR {activeKamar}</span>
            <span className="text-xs bg-white border px-2 py-1 rounded font-normal text-slate-500">{filteredSantri.length} Santri</span>
          </div>
          <div className="divide-y">
            {filteredSantri.map((s: any) => {
              const isPaid = s.bulan_ini_lunas
              const isDraft = !!drafts[s.id]
              return (
                <div key={s.id} onClick={() => handleSelectSantri(s)}
                  className={`p-4 flex items-center justify-between transition-colors cursor-pointer group ${isDraft ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600 group-hover:bg-white group-hover:text-emerald-600 border flex-shrink-0">
                      {s.nis.slice(-2)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.nama_lengkap}</p>
                      <div className="flex gap-2 text-xs text-slate-400 items-center">
                        <span>{s.nis}</span>
                        {s.jumlah_tunggakan > 0 && <span className="text-red-500 font-bold bg-red-50 px-1 rounded">-{s.jumlah_tunggakan} Bln</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {isCurrentYear && !isPaid ? (
                      <button onClick={(e) => toggleDraft(e, s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                          isDraft ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 hover:border-emerald-500 hover:text-emerald-600'
                        }`}>
                        {isDraft ? <><CheckCircle className="w-3 h-3"/> Siap Bayar</> : <><PlusCircle className="w-3 h-3"/> Bayar {BULAN_LIST[currentMonthIdx - 1]}</>}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                        <CheckCircle className="w-3 h-3"/> Lunas
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
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95 disabled:opacity-70">
            <div className="text-left">
              <p className="text-xs text-slate-400">{totalDraft} Santri Dipilih</p>
              <p className="text-xl font-bold text-emerald-400">Total: Rp {totalNominalDraft.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
              {isSavingBatch ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
              {isSavingBatch ? 'Menyimpan...' : 'SIMPAN'}
            </div>
          </button>
        </div>
      )}
    </div>
  )

  // ── VIEW: PAYMENT ───────────────────────────────────────────────────────
  if (view === 'PAYMENT') return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in slide-in-from-right-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleBackToList} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600"/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Input Pembayaran</h1>
          <p className="text-sm text-slate-500">Membayar untuk: <span className="font-bold text-emerald-600">{selectedSantri.nama_lengkap}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {BULAN_LIST.map((namaBulan, idx) => {
          const bulanIndex = idx + 1
          const dataBayar = riwayatBayar.find(r => r.bulan === bulanIndex)
          const isSelected = selectedMonths.includes(bulanIndex)
          let style = 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
          if (dataBayar) style = 'bg-green-100 border-green-500 text-green-800 cursor-default'
          else if (isSelected) style = 'bg-emerald-600 text-white border-emerald-600 shadow-sm transform scale-105'
          else if ((tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonthIdx)) {
            style = 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          }
          return (
            <div key={bulanIndex} onClick={() => toggleBulan(bulanIndex)}
              className={`p-4 rounded-xl border-2 flex flex-col justify-between h-32 transition-all cursor-pointer ${style}`}>
              <div className="flex justify-between items-start">
                <span className="font-bold text-lg">{namaBulan}</span>
                {dataBayar && <CheckCircle className="w-5 h-5"/>}
                {!dataBayar && isSelected && <CheckCircle className="w-5 h-5 text-white/50"/>}
              </div>
              <div className="text-xs mt-2">
                {dataBayar ? (
                  <>
                    <p className="font-medium opacity-80">LUNAS</p>
                    <p className="opacity-60">{format(new Date(dataBayar.tanggal_bayar), 'dd/MM/yy', { locale: id })}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium opacity-80">Tagihan</p>
                    <p className="font-bold text-lg">Rp {nominal.toLocaleString('id-ID')}</p>
                    {style.includes('bg-red-50') && <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 inline-block">NUNGGAK</span>}
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
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95">
            <div className="text-left">
              <p className="text-xs text-slate-400">Total Bayar ({selectedMonths.length} Bulan)</p>
              <p className="text-xl font-bold text-green-400">Rp {(selectedMonths.length * nominal).toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
              BAYAR SEKARANG <CreditCard className="w-5 h-5"/>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}