'use client'

import { useState, useEffect } from 'react'
import { getSantriBaru, simpanTes } from './actions'
import { Search, Save, CheckCircle, Clock, AlertCircle, User, RefreshCw, X, FileText, BookOpen, Hash, GraduationCap } from 'lucide-react'

export default function TesKlasifikasiPage() {
  const [dataSantri, setDataSantri] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  // State Modal Form
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load Data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setErrorMsg('') 
    
    try {
      const res = await getSantriBaru(search)
      setDataSantri(res)
    } catch (error: any) {
      console.error("Error Loading Data:", error)
      setErrorMsg("Gagal memuat data. Pastikan tabel 'hasil_tes_klasifikasi' sudah dibuat.")
    } finally {
      setLoading(false) 
    }
  }

  const handleOpenForm = (santri: any) => {
    setSelectedSantri(santri)
    setIsModalOpen(true)
    // Cegah body scroll saat modal HP terbuka
    document.body.style.overflow = 'hidden'
  }

  const handleCloseForm = () => {
    setIsModalOpen(false)
    setSelectedSantri(null)
    document.body.style.overflow = 'unset'
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    
    const res = await simpanTes(formData)
    setSaving(false)

    if (res?.error) {
      alert("Gagal: " + res.error)
    } else {
      // Custom toast success bisa ditaruh di sini
      handleCloseForm()
      loadData()
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pb-24 md:pb-10">
      
      {/* HEADER (Mobile Friendly) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tes Klasifikasi</h1>
          <p className="text-gray-500 text-sm">Penentuan marhalah awal santri baru.</p>
        </div>
        <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm font-bold border border-blue-100 w-full md:w-auto text-center shadow-sm">
          Total Santri Baru: {dataSantri.length}
        </div>
      </div>

      {/* ERROR MESSAGE ALERT */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start md:items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 md:mt-0"/>
          <div className="flex-1">
            <p className="font-bold">Terjadi Kesalahan</p>
            <p className="text-sm">{errorMsg}</p>
          </div>
          <button onClick={loadData} className="bg-red-100 hover:bg-red-200 p-2 rounded-full transition-colors">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 shadow-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari nama santri baru..." 
            className="w-full pl-11 pr-4 py-3 md:py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm md:text-base transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
          />
        </div>
        <button onClick={() => loadData()} className="bg-slate-800 text-white px-6 py-3 md:py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-700 transition-colors active:scale-95">
          Cari
        </button>
      </div>

      {/* TAMPILAN DATA (RESPONSIVE: CARD UNTUK HP, TABEL UNTUK DESKTOP) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
           <Loader2 className="w-8 h-8 animate-spin mb-3 text-green-600"/>
           <p className="font-medium">Memuat data santri...</p>
        </div>
      ) : dataSantri.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400 flex flex-col items-center justify-center">
          <CheckCircle className="w-12 h-12 text-gray-300 mb-3"/>
          <span className="text-lg font-bold text-gray-600 mb-1">Tidak ada santri baru.</span>
          <span className="text-sm">Semua santri sudah dinilai atau belum ditambahkan.</span>
        </div>
      ) : (
        <>
          {/* 1. VERSI MOBILE (CARDS) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {dataSantri.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
                {/* Indikator Garis Samping */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${s.status_tes === 'SUDAH' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                
                <div className="flex justify-between items-start pl-2 mb-3">
                  <div className="pr-2">
                    <h3 className="font-bold text-gray-900 text-base leading-tight">{s.nama}</h3>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                      {s.asrama || 'Belum ada asrama'} / {s.kamar || '-'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {s.status_tes === 'SUDAH' ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle className="w-3.5 h-3.5"/> SUDAH
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5"/> BELUM
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100 ml-2">
                  {s.hasil ? (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rekomendasi Kelas</p>
                      <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-blue-600"/> {s.hasil.rekomendasi_marhalah}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{s.hasil.catatan_grade}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">- Menunggu Penilaian -</p>
                  )}
                </div>

                <button 
                  onClick={() => handleOpenForm(s)}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ml-1 ${
                    s.status_tes === 'SUDAH' 
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                      : 'bg-blue-600 text-white shadow-md hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  {s.status_tes === 'SUDAH' ? 'Edit Penilaian' : 'Mulai Input Tes'}
                </button>
              </div>
            ))}
          </div>

          {/* 2. VERSI DESKTOP (TABLE) */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nama Santri & Tempat Tinggal</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4">Hasil Rekomendasi</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataSantri.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 text-base">{s.nama}</p>
                      <p className="text-gray-500 font-medium text-xs mt-0.5">
                        {s.asrama || 'Belum ada asrama'} / {s.kamar || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.status_tes === 'SUDAH' ? (
                        <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                          <CheckCircle className="w-3.5 h-3.5"/> SUDAH DITES
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                          <Clock className="w-3.5 h-3.5"/> BELUM
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.hasil ? (
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 inline-block">
                          <div className="font-bold text-blue-900 flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-blue-600"/> {s.hasil.rekomendasi_marhalah}
                          </div>
                          <div className="text-xs text-blue-600/70 font-medium mt-0.5">{s.hasil.catatan_grade}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">- Belum dinilai -</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenForm(s)}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                          s.status_tes === 'SUDAH' 
                            ? 'bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                        }`}
                      >
                        {s.status_tes === 'SUDAH' ? 'Edit Nilai' : 'Input Tes'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL FORM PENILAIAN (MOBILE FIRST FULLSCREEN, DESKTOP CENTERED) */}
      {isModalOpen && selectedSantri && (
        <div className="fixed inset-0 bg-slate-900/60 flex flex-col md:items-center md:justify-center z-50 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 md:zoom-in-95">
            <form onSubmit={handleSimpan} className="flex flex-col h-full">
              
              {/* Header Modal (Sticky) */}
              <div className="p-4 md:p-6 border-b flex justify-between items-center bg-white sticky top-0 z-20 shrink-0 shadow-sm">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800 leading-tight">Form Klasifikasi</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs md:text-sm text-slate-600">
                    <User className="w-3.5 h-3.5"/> 
                    <span className="font-bold truncate max-w-[180px] sm:max-w-[300px]">{selectedSantri.nama}</span> 
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] md:text-xs font-medium border border-slate-200">
                      {selectedSantri.asrama || 'Belum ada asrama'} / {selectedSantri.kamar || '-'}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={handleCloseForm} className="text-slate-400 hover:text-rose-500 p-2 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors">
                  <X className="w-5 h-5"/>
                </button>
              </div>

              {/* Body Modal (Scrollable) */}
              <div className="p-4 md:p-6 space-y-8 overflow-y-auto flex-1 bg-slate-50/50">
                
                {/* 1. Kemampuan Menulis */}
                <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm md:text-base">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><FileText className="w-4 h-4"/></div>
                    A. Kemampuan Menulis (Kitabah)
                  </h4>
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                    {['BAIK', 'KURANG', 'TIDAK_BISA'].map(opt => (
                      <label key={opt} className="cursor-pointer group">
                        <input type="radio" name="tulis_arab" value={opt} defaultChecked={selectedSantri.hasil?.tulis_arab === opt} required className="peer sr-only"/>
                        <div className="py-3 px-1 rounded-xl border-2 border-slate-200 text-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 transition-all hover:border-emerald-200 active:scale-95 flex items-center justify-center min-h-[3rem]">
                          <span className="block text-[10px] sm:text-xs md:text-sm font-bold uppercase">{opt.replace('_', ' ')}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Kemampuan Membaca */}
                <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm md:text-base">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><BookOpen className="w-4 h-4"/></div>
                    B. Kemampuan Membaca Qur'an
                  </h4>
                  
                  {/* Kelancaran */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 ml-1">1. Kelancaran Membaca</p>
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {['LANCAR', 'TIDAK_LANCAR', 'TIDAK_BISA'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_kelancaran" value={opt} defaultChecked={selectedSantri.hasil?.baca_kelancaran === opt} required className="peer sr-only"/>
                          <div className="py-3 px-1 rounded-xl border-2 border-slate-200 bg-slate-50 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 transition-all hover:border-blue-200 active:scale-95 flex items-center justify-center min-h-[3rem]">
                            <span className="block text-[10px] sm:text-xs md:text-sm font-bold uppercase">{opt.replace('_', ' ')}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tajwid */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 ml-1">2. Kualitas Tajwid</p>
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {['BAIK', 'KURANG', 'BURUK'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_tajwid" value={opt} defaultChecked={selectedSantri.hasil?.baca_tajwid === opt} required className="peer sr-only"/>
                          <div className="py-3 px-1 rounded-xl border-2 border-slate-200 bg-slate-50 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 transition-all hover:border-blue-200 active:scale-95 flex items-center justify-center min-h-[3rem]">
                            <span className="block text-[10px] sm:text-xs md:text-sm font-bold uppercase">{opt}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Hafalan */}
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400"/>
                        <p className="text-xs md:text-sm font-bold text-slate-700 uppercase">3. Hafalan (Juz)</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                      <input 
                        type="number" 
                        name="hafalan_juz" 
                        defaultValue={selectedSantri.hasil?.hafalan_juz} 
                        placeholder="0" 
                        min="0"
                        max="30"
                        className="w-14 text-center font-black text-xl text-blue-700 outline-none bg-transparent" 
                      />
                      <span className="text-xs font-bold text-slate-400 pr-1">Juz</span>
                    </div>
                  </div>
                </div>

                {/* 3. Nahwu */}
                <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm md:text-base">
                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><BookOpen className="w-4 h-4"/></div>
                    C. Pengalaman Belajar Nahwu
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="on" defaultChecked={selectedSantri.hasil?.nahwu_pengalaman === true} className="peer sr-only"/>
                      <div className="p-4 rounded-xl border-2 border-slate-200 text-center peer-checked:border-amber-500 peer-checked:bg-amber-50 transition-all hover:border-amber-200 active:scale-95">
                        <span className="block text-sm md:text-base font-black text-slate-800 peer-checked:text-amber-800 mb-1">SUDAH PERNAH</span>
                        <span className="text-[10px] md:text-xs text-slate-500 font-medium">Lanjut Tes Spesifik</span>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="off" defaultChecked={!selectedSantri.hasil?.nahwu_pengalaman} className="peer sr-only"/>
                      <div className="p-4 rounded-xl border-2 border-slate-200 text-center peer-checked:border-slate-500 peer-checked:bg-slate-100 transition-all hover:border-slate-300 active:scale-95">
                        <span className="block text-sm md:text-base font-black text-slate-800 mb-1">BELUM PERNAH</span>
                        <span className="text-[10px] md:text-xs text-slate-500 font-medium">Masuk Kelas Dasar</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Footer Modal (Sticky) */}
              <div className="p-4 md:p-6 border-t bg-white flex flex-col-reverse sm:flex-row justify-end gap-3 sticky bottom-0 z-20 shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] md:rounded-b-3xl">
                <button type="button" onClick={handleCloseForm} className="w-full sm:w-auto px-6 py-3.5 md:py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="w-full sm:w-auto bg-green-600 text-white px-8 py-3.5 md:py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-black shadow-lg shadow-green-600/20 transition-all active:scale-[0.98]">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                  {saving ? "Menyimpan..." : "Simpan & Hitung Hasil"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
    </svg>
  )
}