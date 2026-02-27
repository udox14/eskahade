'use client'

import { useState, useEffect } from 'react'
import { getPerizinanList, simpanIzin, setSudahDatang, cariSantri } from './actions'
import { Search, Plus, MapPin, Home, Clock, CheckCircle, X, User, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner' 

const LIST_PEMBERI_IZIN = [
  "Muhammad Fakhri", "Gungun T. Aminullah", "Yusup Fallo", 
  "Ryan M. Ridwan", "M. Jihad Robbani", "Wahid Hasyim", "Abdul Halim"
]

export default function PerizinanPage() {
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [filterWaktu, setFilterWaktu] = useState<'HARI' | 'MINGGU' | 'BULAN'>('HARI')
  const [loading, setLoading] = useState(true)

  // State Modal Input
  const [isOpenInput, setIsOpenInput] = useState(false)
  const [searchSantri, setSearchSantri] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisIzin, setJenisIzin] = useState<'PULANG' | 'KELUAR_KOMPLEK'>('KELUAR_KOMPLEK')
  
  // State Modal Kembali
  const [isOpenReturn, setIsOpenReturn] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState('')
  const [waktuKembali, setWaktuKembali] = useState(new Date().toISOString().slice(0, 16))

  useEffect(() => {
    loadData()
  }, [filterWaktu])

  const loadData = async () => {
    setLoading(true)
    const res = await getPerizinanList(filterWaktu)
    setList(res)
    setLoading(false)
  }

  // --- HANDLERS ---
  const handleCariSantri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchSantri.length < 3) {
        toast.warning("Ketik minimal 3 huruf untuk mencari.")
        return 
    }
    const res = await cariSantri(searchSantri)
    setHasilCari(res)
    if (res.length === 0) toast.info("Santri tidak ditemukan.")
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) {
        toast.error("Mohon pilih santri terlebih dahulu!")
        return 
    }
    
    const loadingToast = toast.loading("Menyimpan data izin...")
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    formData.append('jenis', jenisIzin)
    
    const res = await simpanIzin(formData)
    toast.dismiss(loadingToast)

    if (res?.error) {
      toast.error("Gagal menyimpan: " + res.error)
    } else {
      toast.success("Data perizinan berhasil disimpan!")
      setIsOpenInput(false)
      setSelectedSantri(null)
      setSearchSantri('')
      setHasilCari([]) 
      loadData()
    }
  }

  const openReturnModal = (item: any) => {
    setSelectedReturnId(item.id)
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16)
    setWaktuKembali(localISOTime)
    setIsOpenReturn(true)
  }

  const handleSimpanKembali = async () => {
    const loadingToast = toast.loading("Memproses kepulangan...")
    const res = await setSudahDatang(selectedReturnId, waktuKembali)
    toast.dismiss(loadingToast)

    if (res?.error) {
      toast.error(res.error)
    } else {
      if (res.message?.includes('Terlambat')) {
        toast.warning("Tercatat Terlambat!", { description: "Data masuk ke antrian verifikasi/sidang." })
      } else {
        toast.success("Tepat Waktu.", { description: "Izin diselesaikan." })
      }
      setIsOpenReturn(false)
      loadData()
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex items-center gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Perizinan Santri</h1>
          <p className="text-gray-500 text-sm">Monitoring santri keluar/masuk komplek.</p>
        </div>
        <button 
          onClick={() => setIsOpenInput(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Izin Baru
        </button>
      </div>

      {/* FILTER WAKTU */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(['HARI', 'MINGGU', 'BULAN'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterWaktu(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterWaktu === f ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f === 'HARI' ? 'Hari Ini' : f === 'MINGGU' ? 'Minggu Ini' : 'Bulan Ini'}
          </button>
        ))}
      </div>

      {/* TABEL LIST */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Jenis & Alasan</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400"><Clock className="w-6 h-6 animate-spin mx-auto mb-2"/>Memuat...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400">Tidak ada data perizinan untuk periode ini.</td></tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {/* 1. SANTRI */}
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-800">{item.nama}</p>
                      <p className="text-xs text-gray-500">{item.asrama} • {item.kelas}</p>
                    </td>

                    {/* 2. JENIS & ALASAN */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        {item.jenis === 'PULANG' 
                          ? <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200"><Home className="w-3 h-3"/> PULANG</span>
                          : <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200"><MapPin className="w-3 h-3"/> KELUAR KOMPLEK</span>
                        }
                        <span className="text-xs text-gray-500">via {item.pemberi_izin}</span>
                      </div>
                      <p className="text-xs text-gray-600 italic">"{item.alasan}"</p>
                    </td>

                    {/* 3. WAKTU */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                          Pergi: <span className="font-medium text-gray-900">{format(new Date(item.tgl_mulai), 'dd/MM HH:mm')}</span>
                        </span>
                        {item.tgl_kembali_aktual ? (
                          <span className={`flex items-center gap-1 font-bold mt-1 ${item.status === 'AKTIF' ? 'text-orange-600' : 'text-green-600'}`}>
                            Tiba: {format(new Date(item.tgl_kembali_aktual), 'dd/MM HH:mm')}
                            {item.status === 'AKTIF' && ' (Telat)'}
                          </span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1 mt-1">
                            Batas: {format(new Date(item.tgl_selesai_rencana), 'dd/MM HH:mm')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. AKSI */}
                    <td className="px-4 py-3 text-center">
                      {item.status === 'AKTIF' ? (
                        item.tgl_kembali_aktual ? (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold border border-orange-200">
                              <AlertTriangle className="w-3 h-3"/> MENUNGGU SIDANG
                            </span>
                            <span className="text-[10px] text-orange-600 mt-1">Terlambat Kembali</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => openReturnModal(item)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm active:scale-95"
                          >
                            BELUM KEMBALI
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-200">
                          <CheckCircle className="w-3 h-3"/> SELESAI
                        </span>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL INPUT IZIN BARU --- */}
      {isOpenInput && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Buat Perizinan Baru</h3>
              <button onClick={() => setIsOpenInput(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSimpan} className="p-5 space-y-4">
              
              {/* Cari Santri */}
              {!selectedSantri ? (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cari Santri</label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nama / NIS..."
                      value={searchSantri}
                      onChange={(e) => setSearchSantri(e.target.value)}
                    />
                    <button type="button" onClick={handleCariSantri} className="bg-gray-800 text-white px-3 rounded-lg hover:bg-black"><Search className="w-4 h-4"/></button>
                  </div>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {hasilCari.map(s => (
                      <div key={s.id} onClick={() => setSelectedSantri(s)} className="p-2 border rounded hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm">
                        <span>{s.nama_lengkap}</span>
                        <span className="text-xs text-gray-500">{s.asrama}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-100">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600"/>
                    <div>
                      <p className="font-bold text-sm text-blue-900">{selectedSantri.nama_lengkap}</p>
                      <p className="text-xs text-blue-700">{selectedSantri.asrama} - {selectedSantri.kamar}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedSantri(null)} className="text-xs text-blue-600 underline">Ganti</button>
                </div>
              )}

              {/* Jenis & Waktu */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Jenis Izin</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className={`cursor-pointer p-3 rounded-lg border text-center text-sm font-bold transition-all ${jenisIzin === 'KELUAR_KOMPLEK' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name="rad_jenis" className="hidden" checked={jenisIzin === 'KELUAR_KOMPLEK'} onChange={() => setJenisIzin('KELUAR_KOMPLEK')}/>
                    KELUAR KOMPLEK
                  </label>
                  <label className={`cursor-pointer p-3 rounded-lg border text-center text-sm font-bold transition-all ${jenisIzin === 'PULANG' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name="rad_jenis" className="hidden" checked={jenisIzin === 'PULANG'} onChange={() => setJenisIzin('PULANG')}/>
                    IZIN PULANG
                  </label>
                </div>

                {jenisIzin === 'PULANG' ? (
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="text-xs text-gray-500">Dari Tanggal</span>
                      <input type="date" name="date_start" required className="w-full p-2 border rounded bg-white text-sm outline-none focus:border-purple-500"/>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Sampai Tanggal</span>
                      <input type="date" name="date_end" required className="w-full p-2 border rounded bg-white text-sm outline-none focus:border-purple-500"/>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Tanggal Izin</span>
                      <input type="date" name="date_single" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded bg-white text-sm outline-none focus:border-blue-500"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-gray-500">Jam Keluar</span>
                        <input type="time" name="time_start" required className="w-full p-2 border rounded bg-white text-sm outline-none focus:border-blue-500"/>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Jam Kembali</span>
                        <input type="time" name="time_end" required className="w-full p-2 border rounded bg-white text-sm outline-none focus:border-blue-500"/>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Keperluan / Alasan</label>
                <textarea name="alasan" required rows={2} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Membeli buku, Sakit..."></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pemberi Izin</label>
                <select name="pemberi_izin" required className="w-full p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Pilih Ustadz --</option>
                  {LIST_PEMBERI_IZIN.map(nama => (
                    <option key={nama} value={nama}>{nama}</option>
                  ))}
                </select>
              </div>

              <button className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-bold shadow-md active:scale-95 transition-transform">
                IZINKAN
              </button>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PENGEMBALIAN --- */}
      {isOpenReturn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600"/>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Konfirmasi Kedatangan</h3>
            <p className="text-sm text-gray-500 mb-6">
              Kapan santri ini tiba di pondok? <br/>
              <span className="text-xs">(Silakan ubah jika data ini input susulan)</span>
            </p>
            
            <input 
              type="datetime-local" 
              value={waktuKembali}
              onChange={(e) => setWaktuKembali(e.target.value)}
              className="w-full p-3 border-2 border-green-200 rounded-lg text-center font-bold text-gray-700 mb-6 focus:border-green-500 outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsOpenReturn(false)} className="py-2 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50">Batal</button>
              <button onClick={handleSimpanKembali} className="py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">SIMPAN</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}