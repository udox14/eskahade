'use client'

import { useState, useEffect } from 'react'
import { getSantriBaru, simpanTes } from './actions'
import { Search, Save, CheckCircle, Clock, AlertCircle, User, RefreshCw, X } from 'lucide-react'

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
      alert("Hasil tes berhasil disimpan!")
      setIsModalOpen(false)
      loadData()
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tes Klasifikasi Santri Baru</h1>
          <p className="text-gray-500 text-sm">Penentuan marhalah awal berdasarkan kemampuan dasar.</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium border border-blue-100">
          Total Santri Baru: {dataSantri.length}
        </div>
      </div>

      {/* ERROR MESSAGE ALERT */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5"/>
          <div>
            <p className="font-bold">Terjadi Kesalahan</p>
            <p className="text-sm">{errorMsg}</p>
          </div>
          <button onClick={loadData} className="ml-auto bg-red-100 hover:bg-red-200 p-2 rounded-full">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari nama santri baru..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
          />
        </div>
        <button onClick={() => loadData()} className="bg-gray-800 text-white px-4 py-2 rounded-lg">Cari</button>
      </div>

      {/* TABEL SANTRI BARU */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b font-semibold text-gray-600">
            <tr>
              <th className="px-6 py-3">Nama Santri</th>
              <th className="px-6 py-3">NIS</th>
              <th className="px-6 py-3 text-center">Status Tes</th>
              <th className="px-6 py-3">Hasil Rekomendasi</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat data...</td></tr>
            ) : dataSantri.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                <span className="text-lg font-medium mb-1">Tidak ada data santri baru.</span>
                <span className="text-sm">Semua santri sudah memiliki kelas atau belum ditambahkan.</span>
              </td></tr>
            ) : (
              dataSantri.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{s.nama}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{s.nis}</td>
                  <td className="px-6 py-3 text-center">
                    {s.status_tes === 'SUDAH' ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                        <CheckCircle className="w-3 h-3"/> SUDAH
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-bold">
                        <Clock className="w-3 h-3"/> BELUM
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {s.hasil ? (
                      <div>
                        <div className="font-bold text-gray-800">{s.hasil.rekomendasi_marhalah}</div>
                        <div className="text-xs text-gray-500">{s.hasil.catatan_grade}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">- Belum dinilai -</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button 
                      onClick={() => handleOpenForm(s)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        s.status_tes === 'SUDAH' 
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      }`}
                    >
                      {s.status_tes === 'SUDAH' ? 'Edit Nilai' : 'Input Tes'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM PENILAIAN (FULL BUTTONS) */}
      {isModalOpen && selectedSantri && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSimpan}>
              
              {/* Header Modal */}
              <div className="p-6 border-b flex justify-between items-start bg-gray-50 sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Formulir Tes Klasifikasi</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <User className="w-4 h-4"/> 
                    <span className="font-semibold">{selectedSantri.nama}</span> 
                    <span className="bg-gray-200 px-1.5 rounded text-xs font-mono">{selectedSantri.nis}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full">
                  <X className="w-6 h-6"/>
                </button>
              </div>

              <div className="p-6 space-y-8">
                
                {/* 1. Kemampuan Menulis */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-800 border-l-4 border-green-600 pl-3 text-sm uppercase tracking-wide">
                    A. Kemampuan Menulis (Kitabah)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {['BAIK', 'KURANG', 'TIDAK_BISA'].map(opt => (
                      <label key={opt} className="cursor-pointer group">
                        <input type="radio" name="tulis_arab" value={opt} defaultChecked={selectedSantri.hasil?.tulis_arab === opt} required className="peer sr-only"/>
                        <div className="p-3 rounded-lg border-2 border-gray-200 text-center peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-800 transition-all hover:border-green-300">
                          <span className="block text-sm font-bold">{opt.replace('_', ' ')}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Kemampuan Membaca */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-800 border-l-4 border-blue-600 pl-3 text-sm uppercase tracking-wide">
                    B. Kemampuan Membaca Al-Qur'an
                  </h4>
                  
                  {/* Kelancaran */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-3 uppercase">1. Kelancaran Membaca</p>
                    <div className="grid grid-cols-3 gap-3">
                      {['LANCAR', 'TIDAK_LANCAR', 'TIDAK_BISA'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_kelancaran" value={opt} defaultChecked={selectedSantri.hasil?.baca_kelancaran === opt} required className="peer sr-only"/>
                          <div className="p-3 rounded-lg border-2 border-white bg-white shadow-sm text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-800 transition-all hover:border-blue-300">
                            <span className="block text-sm font-bold">{opt.replace('_', ' ')}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tajwid */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-3 uppercase">2. Kualitas Tajwid</p>
                    <div className="grid grid-cols-3 gap-3">
                      {['BAIK', 'KURANG', 'BURUK'].map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="baca_tajwid" value={opt} defaultChecked={selectedSantri.hasil?.baca_tajwid === opt} required className="peer sr-only"/>
                          <div className="p-3 rounded-lg border-2 border-white bg-white shadow-sm text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-800 transition-all hover:border-blue-300">
                            <span className="block text-sm font-bold">{opt}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Hafalan */}
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase flex-1">3. Jumlah Hafalan (Juz)</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        name="hafalan_juz" 
                        defaultValue={selectedSantri.hasil?.hafalan_juz} 
                        placeholder="0" 
                        min="0"
                        max="30"
                        className="w-24 p-2 border-2 border-gray-200 rounded-lg text-center font-bold text-lg focus:border-blue-500 outline-none" 
                      />
                      <span className="text-sm font-medium text-gray-600">Juz</span>
                    </div>
                  </div>
                </div>

                {/* 3. Nahwu */}
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-800 border-l-4 border-yellow-500 pl-3 text-sm uppercase tracking-wide">
                    C. Pengalaman Belajar Nahwu
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="on" defaultChecked={selectedSantri.hasil?.nahwu_pengalaman === true} className="peer sr-only"/>
                      <div className="p-4 rounded-lg border-2 border-gray-200 text-center peer-checked:border-yellow-500 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 transition-all hover:border-yellow-300">
                        <span className="block text-base font-bold">SUDAH PERNAH</span>
                        <span className="text-xs text-gray-500">Direkomendasikan tes lanjutan</span>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="nahwu_pengalaman" value="off" defaultChecked={!selectedSantri.hasil?.nahwu_pengalaman} className="peer sr-only"/>
                      <div className="p-4 rounded-lg border-2 border-gray-200 text-center peer-checked:border-gray-500 peer-checked:bg-gray-100 peer-checked:text-gray-800 transition-all hover:border-gray-300">
                        <span className="block text-base font-bold">BELUM PERNAH</span>
                        <span className="text-xs text-gray-500">Masuk kelas dasar</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0 z-10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="bg-green-700 text-white px-8 py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 font-bold shadow-lg shadow-green-900/10">
                  {saving ? "Menghitung..." : <><Save className="w-5 h-5"/> Simpan & Hitung</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}