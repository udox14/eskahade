'use client'

import { useState, useEffect } from 'react'
import { cariSantriKeuangan, getInfoTagihan, bayarTagihan, getMonitoringPembayaran, bayarLunasSetahun } from './actions'
import { Search, Wallet, Building2, Calendar, CheckCircle, Clock, Loader2, Coins, Home, User, Zap, Filter, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function LoketPembayaranPage() {
  // --- STATE UTAMA ---
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  
  // --- STATE MONITORING (TABEL) ---
  const [tahunTagihan, setTahunTagihan] = useState(new Date().getFullYear())
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [dataList, setDataList] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // --- STATE PAYMENT FORM ---
  const [infoTagihan, setInfoTagihan] = useState<any>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [nominalCicil, setNominalCicil] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // 1. LOAD MONITORING DATA
  const loadMonitoring = async () => {
    setLoadingList(true)
    const res = await getMonitoringPembayaran(filterAsrama, filterKamar, searchQuery, tahunTagihan)
    setDataList(res)
    setLoadingList(false)
    setHasLoaded(true)
  }

  // 2. LOAD INFO DETAIL SANTRI
  useEffect(() => {
    if (selectedSantri) {
      loadInfo()
    }
  }, [selectedSantri, tahunTagihan])

  const loadInfo = async () => {
    setLoadingInfo(true)
    const res = await getInfoTagihan(selectedSantri.id, selectedSantri.tahun_masuk_fix, tahunTagihan)
    setInfoTagihan(res)
    setLoadingInfo(false)
  }

  // ============================================================
  // FIX TOMBOL BACK HP: Sync view ke browser history
  // ============================================================
  useEffect(() => {
    if (selectedSantri) {
      // Saat santri dipilih (masuk view detail), push state baru ke history browser
      window.history.pushState({ view: 'DETAIL' }, '')
    }
  }, [selectedSantri])

  useEffect(() => {
    // Tangkap event tombol back HP/browser
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'DETAIL') {
        // Kembali ke list
        setSelectedSantri(null)
        setInfoTagihan(null)
        setNominalCicil('')
        loadMonitoring()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  // ============================================================

  // --- HANDLERS ---

  const handleSelect = (s: any) => {
    setSelectedSantri(s)
    setNominalCicil('')
  }

  // Bayar Lunas Tahunan (EHB, KES, EKS)
  const handleLunasTahunanSemua = async () => {
    if (!infoTagihan) return
    if(!confirm(`Lunasi seluruh tagihan tahunan (EHB, Kesehatan, Ekskul) untuk ${selectedSantri.nama_lengkap}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan...")
    const res = await bayarLunasSetahun(selectedSantri.id, tahunTagihan, selectedSantri.tahun_masuk_fix)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.warning(res.error)
    } else {
        toast.success("Lunas Berhasil!", { description: `Total Rp ${res.total?.toLocaleString()} diterima.` })
        loadInfo()
    }
  }

  // Bayar Lunas Bangunan (Sisa)
  const handleLunasBangunan = async () => {
    const sisa = infoTagihan.bangunan.sisa
    if (sisa <= 0) return toast.info("Sudah lunas.")
    
    if (!confirm(`Lunasi sisa Uang Bangunan sebesar Rp ${sisa.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan bangunan...")
    
    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', sisa, null, 'Pelunasan Bangunan')
    
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Bangunan Lunas!", { description: "Terima kasih." })
        loadInfo()
    }
  }

  // Bayar Bangunan (Cicilan Manual)
  const handleBayarBangunan = async () => {
    const bayar = parseInt(nominalCicil.replace(/\./g, ''))
    if (!bayar || bayar <= 0) return toast.warning("Nominal tidak valid")
    if (bayar > infoTagihan.bangunan.sisa) return toast.warning("Nominal melebihi sisa tagihan!")

    if (!confirm(`Terima pembayaran Uang Bangunan Rp ${bayar.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', bayar, null, 'Cicilan Bangunan')
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Berhasil!", { description: "Pembayaran cicilan diterima." })
        setNominalCicil('')
        loadInfo()
    }
  }

  // Bayar Tahunan (Per Item)
  const handleBayarTahunan = async (jenis: string, nominal: number) => {
    if (nominal <= 0) return toast.error("Tarif belum diatur untuk angkatan ini.")
    if (!confirm(`Terima pembayaran ${jenis} Tahun ${tahunTagihan} sebesar Rp ${nominal.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, jenis, nominal, tahunTagihan, `Bayar ${jenis} ${tahunTagihan}`)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Lunas!", { description: `${jenis} tahun ${tahunTagihan} berhasil dibayar.` })
        loadInfo()
    }
  }

  const handleBackToList = () => {
    // Gunakan history.back() agar konsisten dengan tombol back HP
    window.history.back()
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      
      {/* HEADER GLOBAL */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-700"><Coins className="w-6 h-6"/></div>
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Loket Keuangan Pusat</h1>
                <p className="text-gray-500 text-sm">Penerimaan Uang Bangunan & Tagihan Tahunan.</p>
            </div>
        </div>
        
        {/* TAHUN SELECTOR GLOBAL */}
        <div className="flex items-center gap-2 bg-white border p-1 rounded-lg shadow-sm">
            <button onClick={() => setTahunTagihan(t => t - 1)} className="px-3 py-1 hover:bg-gray-100 rounded font-bold text-gray-600">-</button>
            <span className="font-mono font-bold text-indigo-700 px-2">{tahunTagihan}</span>
            <button onClick={() => setTahunTagihan(t => t + 1)} className="px-3 py-1 hover:bg-gray-100 rounded font-bold text-gray-600">+</button>
        </div>
      </div>

      {/* VIEW 1: TABEL MONITORING & PENCARIAN */}
      {!selectedSantri ? (
         <div className="space-y-6">
            
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cari Nama / NIS</label>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                            className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            placeholder="Ketik nama santri..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadMonitoring()}
                        />
                    </div>
                </div>

                <div className="w-full md:w-1/4">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Asrama</label>
                    <select 
                        className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filterAsrama}
                        onChange={e => { setFilterAsrama(e.target.value); setFilterKamar('SEMUA') }}
                    >
                        <option value="SEMUA">Semua Asrama</option>
                        {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <div className="w-full md:w-1/6">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kamar</label>
                    <select 
                        className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filterKamar}
                        onChange={e => setFilterKamar(e.target.value)}
                    >
                        <option value="SEMUA">Semua</option>
                        {Array.from({length: 30}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>

                <button 
                    onClick={loadMonitoring}
                    disabled={loadingList}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 h-[38px]"
                >
                    {loadingList ? <Loader2 className="w-4 h-4 animate-spin"/> : "Tampilkan"}
                </button>
            </div>

            {/* Tabel Santri */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {!hasLoaded ? (
                    <div className="py-20 text-center text-gray-400">
                        <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300"/>
                        <p>Silakan gunakan filter di atas untuk menampilkan data.</p>
                    </div>
                ) : dataList.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">Data tidak ditemukan.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                            <tr>
                                <th className="px-6 py-3">Nama Santri</th>
                                <th className="px-6 py-3 text-center">Bangunan</th>
                                <th className="px-6 py-3 text-center">Tahunan {tahunTagihan}</th>
                                <th className="px-6 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {dataList.map((s) => (
                                <tr key={s.id} onClick={() => handleSelect(s)} className="hover:bg-indigo-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-3">
                                        <p className="font-bold text-gray-800">{s.nama_lengkap}</p>
                                        <p className="text-xs text-gray-500">{s.asrama} - Kamar {s.kamar}</p>
                                    </td>
                                    
                                    {/* STATUS BANGUNAN */}
                                    <td className="px-6 py-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                            s.status_bangunan === 'LUNAS' ? 'bg-green-100 text-green-700 border-green-200' :
                                            s.status_bangunan === 'CICIL' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                            'bg-gray-100 text-gray-500 border-gray-200'
                                        }`}>
                                            {s.status_bangunan}
                                        </span>
                                    </td>

                                    {/* STATUS TAHUNAN */}
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <BadgeItem label="EHB" active={s.lunas_ehb} />
                                            <BadgeItem label="KES" active={s.lunas_kesehatan} />
                                            <BadgeItem label="EKS" active={s.lunas_ekskul} />
                                        </div>
                                    </td>

                                    <td className="px-6 py-3 text-right">
                                        <span className="text-indigo-600 font-bold text-xs flex items-center justify-end gap-1 group-hover:underline">
                                            Bayar <ArrowLeft className="w-3 h-3 rotate-180"/>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
         </div>
      ) : (
         /* VIEW 2: FORM PEMBAYARAN DETAIL */
         <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            
            {/* Tombol Kembali */}
            <button onClick={handleBackToList} className="text-gray-500 hover:text-indigo-600 flex items-center gap-2 text-sm font-bold mb-4">
                <ArrowLeft className="w-4 h-4"/> Kembali ke Daftar
            </button>

            {/* INFO SANTRI */}
            <div className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><User className="w-6 h-6"/></div>
                    <div>
                        <h2 className="font-bold text-xl text-gray-800">{selectedSantri.nama_lengkap}</h2>
                        <div className="flex gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Angkatan {selectedSantri.tahun_masuk_fix}</span>
                            <span className="flex items-center gap-1"><Home className="w-3 h-3"/> {selectedSantri.asrama}</span>
                        </div>
                    </div>
                </div>
            </div>

            {loadingInfo ? (
                <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
            ) : infoTagihan && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* KIRI: UANG BANGUNAN (CICILAN) */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                <Building2 className="w-5 h-5"/> Uang Bangunan
                            </h3>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${infoTagihan.bangunan.status === 'LUNAS' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                {infoTagihan.bangunan.status}
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-500">Terbayar</span>
                                    <span className="font-bold text-gray-800">
                                        {Math.round((infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div className="bg-indigo-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100}%` }}></div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between text-sm mb-6 border-b pb-4">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase">Total Wajib</p>
                                    <p className="font-bold">Rp {infoTagihan.bangunan.total_wajib.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 text-xs uppercase">Sisa Tagihan</p>
                                    <p className="font-bold text-red-600">Rp {infoTagihan.bangunan.sisa.toLocaleString()}</p>
                                </div>
                            </div>

                            {infoTagihan.bangunan.sisa > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            placeholder="Nominal Cicilan..." 
                                            className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={nominalCicil}
                                            onChange={e => setNominalCicil(e.target.value)}
                                        />
                                        <button 
                                            onClick={handleBayarBangunan}
                                            disabled={isProcessing}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 text-sm"
                                        >
                                            Bayar
                                        </button>
                                    </div>
                                    
                                    <button 
                                        onClick={handleLunasBangunan}
                                        disabled={isProcessing}
                                        className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-4 h-4 text-yellow-300"/> LUNASI SEKARANG (100%)
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-green-50 text-green-700 rounded-lg font-bold border border-green-100">
                                    LUNAS
                                </div>
                            )}
                        </div>
                    </div>

                    {/* KANAN: TAGIHAN TAHUNAN */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-emerald-50 p-4 border-b border-emerald-100">
                            <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5"/> Tagihan Tahunan ({tahunTagihan})
                            </h3>
                        </div>
                        <div className="divide-y flex-1">
                            {['KESEHATAN', 'EHB', 'EKSKUL'].map(jenis => {
                                const data = infoTagihan.tahunan[jenis]
                                return (
                                    <div key={jenis} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="font-bold text-gray-700">{jenis === 'EHB' ? 'EHB (Ujian)' : jenis}</p>
                                            <p className="text-xs text-gray-500">Tarif: Rp {data.nominal.toLocaleString()}</p>
                                        </div>
                                        
                                        {data.lunas ? (
                                            <span className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                                <CheckCircle className="w-4 h-4"/> LUNAS
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={() => handleBayarTahunan(jenis, data.nominal)}
                                                disabled={isProcessing || data.nominal === 0}
                                                className="bg-white border border-red-200 text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 shadow-sm flex items-center gap-1"
                                            >
                                                <Clock className="w-3 h-3"/> BAYAR
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        
                        {/* FOOTER: LUNAS SEMUA TAHUNAN */}
                        {(!infoTagihan.tahunan.EHB.lunas || !infoTagihan.tahunan.KESEHATAN.lunas || !infoTagihan.tahunan.EKSKUL.lunas) && (
                            <div className="p-4 bg-emerald-50 border-t border-emerald-100 mt-auto">
                                <button 
                                    onClick={handleLunasTahunanSemua}
                                    disabled={isProcessing}
                                    className="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-md"
                                >
                                    <Zap className="w-4 h-4 text-yellow-300"/> BAYAR LUNAS SEMUA (TAHUNAN)
                                </button>
                            </div>
                        )}

                        {Object.values(infoTagihan.tahunan).some((x: any) => x.nominal === 0) && (
                            <div className="p-3 bg-yellow-50 text-yellow-700 text-xs text-center border-t border-yellow-100">
                                *Jika tarif Rp 0, artinya belum diatur di menu Pengaturan Tarif untuk angkatan ini.
                            </div>
                        )}
                    </div>

                </div>
            )}

         </div>
      )}

    </div>
  )
}

function BadgeItem({ label, active }: { label: string, active: boolean }) {
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
            {label}
        </span>
    )
}