'use client'

import { useState, useEffect } from 'react'
import { getNominalSPP, getStatusSPP, bayarSPP, getDashboardSPP, getClientRestriction, simpanSppBatch } from './actions'
import { Search, CreditCard, User, CheckCircle, AlertCircle, Loader2, ArrowLeft, Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

type FilterStatus = 'SEMUA' | 'SUDAH_BAYAR_INI' | 'NUNGGAK' | 'AMAN';

export default function SPPPage() {
  // --- STATE UMUM ---
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  // --- STATE LIST MONITORING ---
  const [dataMonitoring, setDataMonitoring] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentKamarIndex, setCurrentKamarIndex] = useState(0)
  
  // STATE FILTER BARU
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')

  // STATE BATCH DRAFT (NEW FEATURE)
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // --- STATE PAYMENT FORM ---
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  
  // INIT
  useEffect(() => {
    getNominalSPP().then(setNominal)
    getClientRestriction().then(res => {
      if (res) {
        setUserAsrama(res)
        setAsrama(res)
      }
    })
  }, [])

  // LOAD MONITORING DATA
  // Efek ini jalan saat ganti Asrama, Tahun, atau View
  useEffect(() => {
    if (view === 'LIST') {
      // Jika ganti asrama/tahun, reset kamar (false)
      // Jika kembali dari view payment, idealnya pertahankan, tapi biar konsisten kita reset dulu kecuali ada logic khusus
      loadMonitoring(false)
    }
  }, [view, asrama, tahun])

  // UPDATE: Tambah parameter preserveKamar
  const loadMonitoring = async (preserveKamar = false) => {
    setLoadingList(true)
    const res = await getDashboardSPP(tahun, asrama)
    setDataMonitoring(res)
    setDrafts({}) // Reset draft
    setLoadingList(false)
    
    // Hanya reset kamar jika TIDAK diminta untuk mempertahankan
    if (!preserveKamar) {
        setCurrentKamarIndex(0) 
    }
  }

  // LOAD PAYMENT DATA
  useEffect(() => {
    if (view === 'PAYMENT' && selectedSantri) {
      loadStatusSantri()
    }
  }, [view, selectedSantri, tahun])

  const loadStatusSantri = async () => {
    const data = await getStatusSPP(selectedSantri.id, tahun)
    setRiwayatBayar(data)
    setSelectedMonths([]) 
  }

  // --- ACTIONS ---

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri)
    setView('PAYMENT')
  }

  const handleBayar = async () => {
    if (selectedMonths.length === 0) return
    if (!confirm(`Bayar SPP ${selectedMonths.length} bulan? Total: Rp ${(selectedMonths.length * nominal).toLocaleString('id-ID')}`)) return

    const toastId = toast.loading("Memproses...")
    const res = await bayarSPP(selectedSantri.id, tahun, selectedMonths, nominal)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("Pembayaran Berhasil!")
      loadStatusSantri() 
    }
  }

  // BATCH ACTIONS
  const toggleDraft = (e: React.MouseEvent, santri: any) => {
    e.stopPropagation() // Biar gak masuk ke detail
    setDrafts(prev => {
        const next = { ...prev }
        if (next[santri.id]) {
            delete next[santri.id]
        } else {
            next[santri.id] = { nominal, bulan: currentMonthIdx, nama: santri.nama_lengkap }
        }
        return next
    })
  }

  const handleSimpanBatch = async () => {
    const listPayload = Object.keys(drafts).map(id => ({
        santriId: id,
        bulan: drafts[id].bulan,
        tahun: tahun,
        nominal: drafts[id].nominal
    }))

    if (listPayload.length === 0) return
    if (!confirm(`Simpan pembayaran untuk ${listPayload.length} santri?`)) return

    setIsSavingBatch(true)
    const res = await simpanSppBatch(listPayload)
    setIsSavingBatch(false)

    if (res?.error) {
        toast.error(res.error)
    } else {
        toast.success(`Sukses menyimpan ${res.count} pembayaran!`)
        // FIX: Panggil loadMonitoring dengan true agar tidak reset kamar
        loadMonitoring(true)
    }
  }

  const toggleBulan = (idx: number) => {
    if (riwayatBayar.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

  const handleBackToList = () => {
    setView('LIST')
    setSelectedSantri(null)
    // Saat kembali dari detail, kita refresh data tapi pertahankan kamar (opsional, tapi di sini saya buat true biar nyaman)
    loadMonitoring(true) 
  }

  // --- RENDER HELPERS ---
  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  // Grouping & Filtering untuk List View
  const filteredData = dataMonitoring.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false

    // Logic Filter Status
    if (filterStatus === 'SUDAH_BAYAR_INI') return s.bulan_ini_lunas
    if (filterStatus === 'NUNGGAK') return s.jumlah_tunggakan > 0
    if (filterStatus === 'AMAN') return s.jumlah_tunggakan === 0

    return true
  })
  
  const groupedData = filteredData.reduce((acc, s) => {
    const k = s.kamar || "Tanpa Kamar"
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {})
  
  // Sort Kamar by Number
  const sortedKamars = Object.keys(groupedData).sort((a, b) => (parseInt(a)||999) - (parseInt(b)||999))

  // Safety check index
  const safeIndex = currentKamarIndex >= sortedKamars.length ? 0 : currentKamarIndex
  const activeKamar = sortedKamars[safeIndex]
  const santriInKamar = activeKamar ? groupedData[activeKamar] : []

  // Handler Navigasi Kamar
  const prevKamar = () => { if (safeIndex > 0) setCurrentKamarIndex(prev => prev - 1) }
  const nextKamar = () => { if (safeIndex < sortedKamars.length - 1) setCurrentKamarIndex(prev => prev + 1) }

  // Draft Stats
  const totalDraft = Object.keys(drafts).length
  const totalNominalDraft = Object.values(drafts).reduce((a: any, b: any) => a + b.nominal, 0)


  // --- VIEW: LIST MONITORING ---
  if (view === 'LIST') return (
    <div className="space-y-6 max-w-5xl mx-auto pb-32">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <CreditCard className="w-6 h-6 text-emerald-600"/> Dashboard SPP
           </h1>
           <p className="text-gray-500 text-sm">Monitoring pembayaran santri per kamar.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            {/* Tahun Selector */}
            <div className="flex items-center bg-white border rounded-lg p-1">
                <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">-</button>
                <span className="px-2 font-mono font-bold text-gray-700">{tahun}</span>
                <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">+</button>
            </div>
            
            {/* Asrama Selector */}
            <div className={`p-2 rounded-lg border flex items-center gap-2 ${userAsrama ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                {userAsrama ? <Lock className="w-3 h-3 text-orange-600"/> : <Home className="w-4 h-4 text-gray-400"/>}
                <select 
                  value={asrama} 
                  onChange={e => setAsrama(e.target.value)} 
                  disabled={!!userAsrama}
                  className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer disabled:cursor-not-allowed"
                >
                    {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* SEARCH & FILTER STATUS */}
      <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
            <input 
                type="text" 
                placeholder="Cari nama santri..." 
                className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto scrollbar-hide">
              <Filter className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0"/>
              <button 
                onClick={() => setFilterStatus('SEMUA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterStatus === 'SEMUA' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Semua
              </button>
              <button 
                onClick={() => setFilterStatus('SUDAH_BAYAR_INI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterStatus === 'SUDAH_BAYAR_INI' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Lunas {BULAN_LIST[currentMonthIdx - 1]}
              </button>
              <button 
                onClick={() => setFilterStatus('NUNGGAK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterStatus === 'NUNGGAK' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Menunggak
              </button>
          </div>
      </div>

      {/* NAVIGATION CONTROLS (ATAS) */}
      {!loadingList && sortedKamars.length > 0 && (
         <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border">
            <button onClick={prevKamar} disabled={safeIndex === 0} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600">
                <ChevronLeft className="w-6 h-6"/>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Kamar Saat Ini</span>
                <select value={safeIndex} onChange={(e) => setCurrentKamarIndex(Number(e.target.value))} className="font-bold text-lg text-gray-800 text-center outline-none bg-transparent cursor-pointer">
                    {sortedKamars.map((k, idx) => <option key={k} value={idx}>{k}</option>)}
                </select>
            </div>
            <button onClick={nextKamar} disabled={safeIndex === sortedKamars.length - 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600">
                <ChevronRight className="w-6 h-6"/>
            </button>
         </div>
      )}

      {/* LIST DATA PER KAMAR (SINGLE VIEW) */}
      {loadingList ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
      ) : sortedKamars.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">Data tidak ditemukan untuk filter ini.</div>
      ) : (
        <div className="space-y-6">
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700 text-sm flex justify-between items-center">
                    <span className="text-lg">KAMAR {activeKamar}</span>
                    <span className="text-xs bg-white border px-2 py-1 rounded font-normal text-gray-500">{santriInKamar?.length || 0} Santri</span>
                </div>
                <div className="divide-y">
                    {santriInKamar?.map((s: any) => {
                        const isPaid = s.status_bayar === 'LUNAS' || s.bulan_ini_lunas // Handle different field names from action
                        const isDraft = !!drafts[s.id]
                        
                        return (
                            <div 
                                key={s.id} 
                                onClick={() => handleSelectSantri(s)}
                                className={`p-4 flex items-center justify-between transition-colors cursor-pointer group ${isDraft ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600 group-hover:bg-white group-hover:text-emerald-600 border flex-shrink-0">
                                        {s.nis.slice(-2)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{s.nama_lengkap}</p>
                                        <div className="flex gap-2 text-xs text-gray-400 items-center">
                                            <span>{s.nis}</span>
                                            {s.jumlah_tunggakan > 0 && <span className="text-red-500 font-bold bg-red-50 px-1 rounded">-{s.jumlah_tunggakan} Bln</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    {isCurrentYear && !isPaid ? (
                                        <button 
                                            onClick={(e) => toggleDraft(e, s)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                                                isDraft 
                                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                                                  : 'bg-white text-gray-500 hover:border-emerald-500 hover:text-emerald-600'
                                            }`}
                                        >
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
        </div>
      )}

      {/* FLOATING SAVE BUTTON */}
      {totalDraft > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
            <button 
                onClick={handleSimpanBatch}
                disabled={isSavingBatch}
                className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95 disabled:opacity-70"
            >
                <div className="text-left">
                    <p className="text-xs text-slate-400">{totalDraft} Santri Dipilih</p>
                    <p className="text-xl font-bold text-emerald-400">Total: Rp {totalNominalDraft.toLocaleString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
                    {isSavingBatch ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                    {isSavingBatch ? "Menyimpan..." : "SIMPAN"}
                </div>
            </button>
        </div>
      )}

    </div>
  )

  // --- VIEW: PAYMENT FORM (DETAIL) ---
  if (view === 'PAYMENT') return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in slide-in-from-right-4">
       <div className="flex items-center gap-4 mb-6">
         <button onClick={handleBackToList} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-gray-600"/></button>
         <div>
            <h1 className="text-xl font-bold text-gray-800">Input Pembayaran</h1>
            <p className="text-sm text-gray-500">Membayar untuk: <span className="font-bold text-emerald-600">{selectedSantri.nama_lengkap}</span></p>
         </div>
       </div>

       {/* GRID BULAN */}
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {BULAN_LIST.map((namaBulan, idx) => {
                const bulanIndex = idx + 1
                const dataBayar = riwayatBayar.find(r => r.bulan === bulanIndex)
                const isSelected = selectedMonths.includes(bulanIndex)
                
                // Logic Warna
                let style = "bg-white border-gray-200 text-gray-500 hover:border-emerald-300"
                if (dataBayar) style = "bg-green-100 border-green-500 text-green-800 cursor-default"
                else if (isSelected) style = "bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105"
                else if ((tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonthIdx)) {
                    style = "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" // Nunggak
                }

                return (
                <div 
                    key={bulanIndex}
                    onClick={() => toggleBulan(bulanIndex)}
                    className={`p-4 rounded-xl border-2 flex flex-col justify-between h-32 transition-all cursor-pointer ${style}`}
                >
                    <div className="flex justify-between items-start">
                    <span className="font-bold text-lg">{namaBulan}</span>
                    {dataBayar && <CheckCircle className="w-5 h-5"/>}
                    {!dataBayar && isSelected && <CheckCircle className="w-5 h-5 text-white/50"/>}
                    </div>
                    
                    <div className="text-xs mt-2">
                    {dataBayar ? (
                        <>
                        <p className="font-medium opacity-80">LUNAS</p>
                        <p className="opacity-60">{format(new Date(dataBayar.tanggal_bayar), 'dd/MM/yy', {locale:id})}</p>
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

       {/* FOOTER BAYAR DETAIL */}
       {selectedMonths.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
            <button 
            onClick={handleBayar}
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95"
            >
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