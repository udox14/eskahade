'use client'

import { useState, useEffect } from 'react'
import { getDashboardTabungan, simpanTopup, simpanJajanMassal, getClientRestriction, getRiwayatTabunganSantri, hapusTransaksi } from './actions'
import { Wallet, TrendingUp, TrendingDown, Plus, Save, Loader2, ChevronLeft, ChevronRight, Home, Lock, AlertCircle, Edit, Trash2, History } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const JAJAN_OPTS = [5000, 10000, 15000, 20000]

export default function UangJajanPage() {
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // State Navigasi Kamar
  const [currentKamarIndex, setCurrentKamarIndex] = useState(0)

  // State Draft Jajan (Format: { santriId: nominal })
  const [draftJajan, setDraftJajan] = useState<Record<string, number>>({})
  // State Mode Manual per Santri (Format: { santriId: true/false })
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({})
  
  const [isSaving, setIsSaving] = useState(false)

  // State Modal Detail/Topup
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [topupNominal, setTopupNominal] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // 1. Init
  useEffect(() => {
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res); }
    })
  }, [])

  // 2. Load Data (Reset kamar saat ganti asrama)
  useEffect(() => {
    loadData(false) // false = Jangan pertahankan posisi kamar (reset ke 0)
  }, [asrama])

  // UPDATE: Tambah parameter preserveKamar
  const loadData = async (preserveKamar = false) => {
    setLoading(true)
    const res = await getDashboardTabungan(asrama)
    setData(res)
    setDraftJajan({}) 
    setManualMode({})
    setLoading(false)
    
    // Hanya reset ke kamar 0 jika TIDAK diminta untuk mempertahankan posisi
    if (!preserveKamar) {
        setCurrentKamarIndex(0)
    }
  }

  // --- LOGIC DISTIBUSI JAJAN ---
  const handleSelectJajan = (santriId: string, nominal: number, saldoSaatIni: number) => {
    if (nominal > saldoSaatIni) {
        toast.warning("Saldo tidak cukup!")
        return
    }
    setDraftJajan(prev => {
        if (prev[santriId] === nominal) {
            const next = { ...prev }
            delete next[santriId]
            return next
        }
        return { ...prev, [santriId]: nominal }
    })
  }

  const handleManualInput = (santriId: string, value: string, saldoSaatIni: number) => {
    const val = parseInt(value) || 0
    if (val > saldoSaatIni) {
        return 
    }
    if (val > 0) {
        setDraftJajan(prev => ({ ...prev, [santriId]: val }))
    } else {
        const next = { ...draftJajan }
        delete next[santriId]
        setDraftJajan(next)
    }
  }

  const toggleManualMode = (santriId: string) => {
    setManualMode(prev => ({...prev, [santriId]: !prev[santriId]}))
    const next = { ...draftJajan }
    delete next[santriId]
    setDraftJajan(next)
  }

  const handleSimpanJajan = async () => {
    const list = Object.entries(draftJajan).map(([id, nominal]) => ({ santriId: id, nominal }))
    if (list.length === 0) return

    // Cek Over Limit (> 20.000)
    const overLimit = list.filter(l => l.nominal > 20000)
    let warningMsg = ""
    if (overLimit.length > 0) {
        warningMsg = `\n\n⚠️ PERINGATAN: Ada ${overLimit.length} santri mengambil > 20.000 (Asumsi Akumulasi).`
    }

    if (!confirm(`Simpan jajan untuk ${list.length} santri?\nTotal Keluar: Rp ${list.reduce((a,b)=>a+b.nominal, 0).toLocaleString()}${warningMsg}`)) return

    setIsSaving(true)
    const toastId = toast.loading("Memproses transaksi...")
    
    const res = await simpanJajanMassal(list)
    
    setIsSaving(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Berhasil!", { description: "Saldo santri telah terpotong." })
        // FIX: Panggil loadData dengan true agar posisi kamar tidak kereset
        loadData(true)
    }
  }

  // --- LOGIC MODAL & TOPUP ---
  const openModal = async (santri: any) => {
    setSelectedSantri(santri)
    setIsModalOpen(true)
    setLoadingHistory(true)
    const hist = await getRiwayatTabunganSantri(santri.id)
    setHistory(hist)
    setLoadingHistory(false)
  }

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = parseInt(topupNominal.replace(/\./g, ''))
    if (!nominal || nominal <= 0) return toast.warning("Nominal tidak valid")

    setIsSaving(true)
    const toastId = toast.loading("Menambah saldo...")
    
    const res = await simpanTopup(selectedSantri.id, nominal, "Topup Manual")
    
    setIsSaving(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Topup Berhasil")
        setTopupNominal('')
        openModal(selectedSantri) 
        // FIX: Panggil loadData dengan true agar posisi kamar tidak kereset
        loadData(true)
    }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Hapus transaksi ini? Saldo akan dikembalikan.")) return
    
    const toastId = toast.loading("Menghapus...")
    const res = await hapusTransaksi(id)
    toast.dismiss(toastId)

    if (res?.success) {
        toast.success("Transaksi Dibatalkan")
        openModal(selectedSantri) 
        // FIX: Panggil loadData dengan true agar posisi kamar tidak kereset
        loadData(true)
    }
  }

  // --- HELPERS RENDER ---
  const groupedData = data?.santri.reduce((acc: any, s: any) => {
    const k = s.kamar || "Lain"
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {}) || {}

  const sortedKamars = Object.keys(groupedData).sort((a, b) => (parseInt(a)||999) - (parseInt(b)||999))
  const activeKamar = sortedKamars[currentKamarIndex]
  const santriInKamar = activeKamar ? groupedData[activeKamar] : []
  const totalJajanDraft = Object.values(draftJajan).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32">
      
      {/* HEADER & STATS */}
      <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-yellow-300"/> Uang Jajan
              </h1>
              <div className={`mt-2 p-1 rounded-lg inline-flex items-center gap-2 ${userAsrama ? 'bg-emerald-800/50 border border-emerald-700' : 'bg-white/10'}`}>
                {userAsrama ? <Lock className="w-3 h-3 text-emerald-400"/> : <Home className="w-3 h-3 text-emerald-200"/>}
                <select 
                  value={asrama} 
                  onChange={e => setAsrama(e.target.value)} 
                  disabled={!!userAsrama}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer [&>option]:text-black"
                >
                  {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-300 uppercase font-bold">Uang Fisik (Saldo)</p>
              <p className="text-2xl font-mono font-bold">Rp {(data?.stats?.uang_fisik || 0).toLocaleString('id-ID')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
             <div className="bg-white/10 p-2 rounded flex items-center justify-between">
                <span className="flex gap-1 items-center opacity-80"><TrendingUp className="w-3 h-3"/> Masuk</span>
                <span className="font-bold text-green-300">+{data?.stats?.masuk_bulan_ini.toLocaleString()}</span>
             </div>
             <div className="bg-white/10 p-2 rounded flex items-center justify-between">
                <span className="flex gap-1 items-center opacity-80"><TrendingDown className="w-3 h-3"/> Keluar</span>
                <span className="font-bold text-yellow-300">-{data?.stats?.keluar_bulan_ini.toLocaleString()}</span>
             </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION CONTROLS */}
      {!loading && sortedKamars.length > 0 && (
         <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border">
            <button onClick={() => currentKamarIndex > 0 && setCurrentKamarIndex(c => c - 1)} disabled={currentKamarIndex === 0} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600"><ChevronLeft/></button>
            <div className="text-center">
                <span className="text-xs text-gray-500 uppercase font-bold">KAMAR</span>
                <p className="font-bold text-lg text-gray-800">{activeKamar}</p>
            </div>
            <button onClick={() => currentKamarIndex < sortedKamars.length - 1 && setCurrentKamarIndex(c => c + 1)} disabled={currentKamarIndex === sortedKamars.length - 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600"><ChevronRight/></button>
         </div>
      )}

      {/* LIST SANTRI */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600"/></div>
      ) : santriInKamar.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">Kamar Kosong.</div>
      ) : (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
               <div className="divide-y">
                  {santriInKamar.map((s: any) => {
                     const draftVal = draftJajan[s.id]
                     const finalSaldo = s.saldo - (draftVal || 0)
                     const isLow = finalSaldo <= 5000
                     const isManual = manualMode[s.id]

                     return (
                        <div key={s.id} className={`p-4 ${draftVal ? 'bg-orange-50' : 'hover:bg-gray-50'} transition-colors`}>
                           {/* Info Atas */}
                           <div className="flex justify-between items-start mb-3">
                              <div>
                                 <p className="font-bold text-gray-800">{s.nama_lengkap}</p>
                                 <p className="text-xs text-gray-500 font-mono">{s.nis}</p>
                              </div>
                              <div className="text-right">
                                 <p className={`font-mono font-bold ${finalSaldo < 0 ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-emerald-700'}`}>
                                    Rp {finalSaldo.toLocaleString()}
                                 </p>
                                 <button 
                                    onClick={() => openModal(s)}
                                    className="text-[10px] text-blue-600 font-bold hover:underline flex items-center justify-end gap-1"
                                 >
                                    <Plus className="w-3 h-3"/> Detail / Isi
                                 </button>
                              </div>
                           </div>

                           {/* Tombol Jajan */}
                           <div className="flex gap-2 items-center">
                              {isManual ? (
                                <div className="flex-1 flex gap-2 items-center animate-in fade-in">
                                    <input 
                                        type="number" 
                                        placeholder="0"
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                                        autoFocus
                                        onChange={(e) => handleManualInput(s.id, e.target.value, s.saldo)}
                                    />
                                    <button onClick={() => toggleManualMode(s.id)} className="text-xs text-gray-500 underline whitespace-nowrap">Batal</button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                                      {JAJAN_OPTS.map(opt => (
                                          <button
                                              key={opt}
                                              onClick={() => handleSelectJajan(s.id, opt, s.saldo)}
                                              disabled={s.saldo < opt}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex-shrink-0 ${
                                              draftVal === opt 
                                                  ? 'bg-orange-600 text-white border-orange-600 shadow-md transform scale-105' 
                                                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 disabled:opacity-30 disabled:bg-gray-50'
                                              }`}
                                          >
                                              {opt / 1000}k
                                          </button>
                                      ))}
                                  </div>
                                  <button 
                                    onClick={() => toggleManualMode(s.id)}
                                    className="px-2 py-1.5 rounded-lg text-xs font-bold border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100"
                                  >
                                    Manual
                                  </button>
                                </>
                              )}
                           </div>
                        </div>
                     )
                  })}
               </div>
            </div>
        </div>
      )}

      {/* FOOTER AKSI */}
      {totalJajanDraft > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
            <button 
            onClick={handleSimpanJajan}
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95"
            >
            <div className="text-left">
                <p className="text-xs text-slate-400">Total Jajan Hari Ini</p>
                <p className="text-xl font-bold text-orange-400">Rp {totalJajanDraft.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
                SIMPAN <Save className="w-5 h-5"/>
            </div>
            </button>
        </div>
       )}

      {/* MODAL DETAIL, TOPUP & RIWAYAT (KOREKSI) */}
      {isModalOpen && selectedSantri && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b bg-gray-50">
                 <h3 className="text-lg font-bold text-gray-800 mb-1">{selectedSantri.nama_lengkap}</h3>
                 <p className="text-sm text-gray-500 font-mono">Saldo: Rp {selectedSantri.saldo.toLocaleString()}</p>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1 space-y-6">
                 {/* Form Topup */}
                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                        <Plus className="w-3 h-3"/> Tambah Saldo
                    </p>
                    <form onSubmit={handleTopup}>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="Nominal Rp..." 
                                className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                value={topupNominal}
                                onChange={(e) => setTopupNominal(e.target.value)}
                            />
                            <button disabled={isSaving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 text-sm">
                                {isSaving ? "..." : "Simpan"}
                            </button>
                        </div>
                    </form>
                 </div>

                 {/* Riwayat Transaksi (Untuk Koreksi) */}
                 <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <History className="w-4 h-4"/> Riwayat Terakhir
                    </h4>
                    {loadingHistory ? (
                        <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400"/></div>
                    ) : history.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center">Belum ada transaksi.</p>
                    ) : (
                        <div className="space-y-2">
                            {history.map((h) => (
                                <div key={h.id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                                    <div>
                                        <p className={`text-sm font-bold ${h.jenis === 'MASUK' ? 'text-green-600' : 'text-orange-600'}`}>
                                            {h.jenis === 'MASUK' ? '+' : '-'} Rp {h.nominal.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                            {format(new Date(h.created_at), 'dd MMM HH:mm', {locale:id})} • {h.keterangan}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteHistory(h.id)}
                                        className="text-gray-300 hover:text-red-500 p-2"
                                        title="Hapus (Koreksi Salah Ketik)"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
              </div>

              <div className="p-4 border-t bg-gray-50 text-center">
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-500 font-bold hover:text-gray-800 text-sm">Tutup</button>
              </div>
           </div>
         </div>
      )}

    </div>
  )
}