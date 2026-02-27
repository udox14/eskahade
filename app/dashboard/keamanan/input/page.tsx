'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cariSantri, simpanPelanggaran, getMasterPelanggaran } from '../actions'
import { Search, Save, User, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'

export default function InputPelanggaranPage() {
  const router = useRouter()
  
  // State Data
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  
  // State Master Data
  const [masterList, setMasterList] = useState<any[]>([])
  const [kategoriList, setKategoriList] = useState<string[]>([])
  const [selectedKategori, setSelectedKategori] = useState('')
  const [selectedMasterId, setSelectedMasterId] = useState('')
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getMasterPelanggaran().then(data => {
      setMasterList(data)
      const unik = Array.from(new Set(data.map((m: any) => m.kategori)))
      setKategoriList(unik as string[])
      if (unik.length > 0) setSelectedKategori(unik[0] as string)
    })
  }, [])

  const filteredJenis = masterList.filter(m => m.kategori === selectedKategori)
  const selectedItem = masterList.find(m => String(m.id) === selectedMasterId)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 3) return alert("Ketik minimal 3 huruf")
    const res = await cariSantri(keyword)
    setHasilCari(res)
    if (res.length === 0) alert("Santri tidak ditemukan")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) return alert("Pilih santri dulu!")
    if (!selectedMasterId) return alert("Pilih jenis pelanggaran!")
    
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    formData.append('master_id', selectedMasterId)
    
    const res = await simpanPelanggaran(formData)
    setLoading(false)

    if (res?.error) {
      alert("Gagal: " + res.error)
    } else {
      alert("Pelanggaran berhasil dicatat.")
      // FIX: Ganti router.push ke router.back()
      router.back()
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Input Pelanggaran</h1>
          <p className="text-gray-500 text-sm">Pilih jenis pelanggaran dari daftar master.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        
        {/* 1. CARI SANTRI */}
        {!selectedSantri ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">1. Cari Santri</h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ketik Nama atau NIS..." 
                className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900">
                <Search className="w-4 h-4" />
              </button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {hasilCari.map(s => (
                <div 
                  key={s.id}
                  onClick={() => { setSelectedSantri(s); setHasilCari([]); }}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center group"
                >
                  <div>
                    <p className="font-medium text-gray-900">{s.nama_lengkap}</p>
                    <p className="text-xs text-gray-500">{s.nis} • {s.asrama}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full group-hover:bg-green-200">Pilih</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full border border-blue-200">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-900 font-bold">{selectedSantri.nama_lengkap}</p>
                <p className="text-xs text-blue-700 font-mono">NIS: {selectedSantri.nis} • {selectedSantri.asrama}</p>
              </div>
            </div>
            <button onClick={() => setSelectedSantri(null)} className="text-xs text-blue-600 hover:underline font-medium">
              Ganti Santri
            </button>
          </div>
        )}

        {/* 2. FORM DETAIL */}
        {selectedSantri && (
          <form onSubmit={handleSubmit} className="space-y-5 animate-in slide-in-from-bottom-2 fade-in">
            <h3 className="font-semibold text-gray-700 border-b pb-2 pt-2">2. Detail Pelanggaran</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input 
                  type="date" 
                  name="tanggal" 
                  required 
                  defaultValue={new Date().toISOString().split('T')[0]} 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                  value={selectedKategori}
                  onChange={(e) => {
                    setSelectedKategori(e.target.value)
                    setSelectedMasterId('') 
                  }}
                >
                  {kategoriList.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Pelanggaran</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                value={selectedMasterId}
                onChange={(e) => setSelectedMasterId(e.target.value)}
                required
              >
                <option value="">-- Pilih Jenis Pelanggaran --</option>
                {filteredJenis.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama_pelanggaran} (Poin: {m.poin})
                  </option>
                ))}
              </select>
              {filteredJenis.length === 0 && (
                <div className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded border border-orange-200 flex gap-2">
                  <AlertCircle className="w-4 h-4"/>
                  Belum ada data di kategori ini. Silakan tambah di menu Master Data.
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kronologi / Detail</label>
              <textarea 
                name="deskripsi"
                required
                rows={3}
                placeholder="Ceritakan detail kejadian..."
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              ></textarea>
            </div>

            {selectedItem && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex justify-between items-center text-red-900 text-sm">
                <div className="flex gap-2 items-center">
                  <AlertCircle className="w-5 h-5"/>
                  <span>Poin Sanksi:</span>
                </div>
                <span className="font-bold text-lg">+{selectedItem.poin}</span>
              </div>
            )}

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-red-700 text-white py-3 rounded-lg hover:bg-red-800 font-bold shadow-md transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                {loading ? "Menyimpan..." : "SIMPAN LAPORAN"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}