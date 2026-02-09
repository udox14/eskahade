'use client'

import { useState, useEffect } from 'react'
import { cariSantriAsrama, simpanAbsenSakit, getListSakitMingguan, hapusAbsenSakit, getAsramaRestrictionClient } from './actions'
import { Search, Trash2, Home, FileText, Loader2, Lock, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner' // IMPORT WAJIB

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function AbsenSakitPage() {
  const [selectedAsrama, setSelectedAsrama] = useState(ASRAMA_LIST[0])
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [listSakit, setListSakit] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)

  // State Modal Konfirmasi
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    description: string;
    type: 'save' | 'delete';
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    description: '',
    type: 'save',
    onConfirm: () => {}
  })
  
  // 1. Cek Permission
  useEffect(() => {
    getAsramaRestrictionClient().then(asrama => {
      if (asrama) {
        setUserAsrama(asrama)
        setSelectedAsrama(asrama)
      }
    })
  }, [])

  // 2. Load Data
  useEffect(() => {
    loadList()
  }, [selectedAsrama])

  const loadList = async () => {
    setLoadingList(true)
    const res = await getListSakitMingguan(selectedAsrama)
    setListSakit(res)
    setLoadingList(false)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) {
      toast.warning("Ketik minimal 3 huruf untuk mencari.")
      return
    }
    
    const loadingToast = toast.loading("Mencari santri...")
    const res = await cariSantriAsrama(search, selectedAsrama)
    toast.dismiss(loadingToast)
    
    setHasilCari(res)
    if (res.length === 0) {
      toast.info("Santri tidak ditemukan", { description: "Coba kata kunci lain atau pastikan asrama benar." })
    }
  }

  // Wrapper untuk memicu Modal Konfirmasi Simpan
  const triggerSimpan = (santri: any, ket: 'BELI_SURAT' | 'TIDAK_BELI') => {
    const desc = ket === 'BELI_SURAT' ? "Status: Beli Surat Dokter" : "Status: Izin Biasa (Tanpa Surat)"
    
    setConfirmState({
      isOpen: true,
      type: 'save',
      message: `Catat sakit untuk ${santri.nama_lengkap}?`,
      description: desc,
      onConfirm: async () => {
        // Logic Simpan
        const loadingToast = toast.loading("Menyimpan data...")
        const res = await simpanAbsenSakit(santri.id, ket)
        toast.dismiss(loadingToast)

        if (res?.error) {
          toast.error("Gagal menyimpan", { description: res.error })
        } else {
          toast.success("Berhasil dicatat", { description: `${santri.nama_lengkap} telah ditambahkan ke daftar sakit.` })
          setSearch('')
          setHasilCari([])
          loadList()
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  // Wrapper untuk memicu Modal Konfirmasi Hapus
  const triggerHapus = (item: any) => {
    setConfirmState({
      isOpen: true,
      type: 'delete',
      message: "Hapus data sakit ini?",
      description: `${item.santri?.nama_lengkap} - ${format(new Date(item.tanggal), 'dd MMM yyyy')}`,
      onConfirm: async () => {
        // Logic Hapus
        const loadingToast = toast.loading("Menghapus data...")
        await hapusAbsenSakit(item.id)
        toast.dismiss(loadingToast)
        
        toast.success("Data dihapus")
        loadList()
        setConfirmState(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Absen Sakit Pagi</h1>
        <p className="text-gray-500 text-sm">Input data santri sakit & status surat dokter.</p>
        
        {/* Dropdown Asrama */}
        <div className={`p-2 rounded-lg border inline-flex items-center gap-2 w-fit mt-2 ${userAsrama ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
          {userAsrama ? <Lock className="w-4 h-4 text-green-600"/> : <Home className="w-4 h-4 text-blue-600"/>}
          <select 
            value={selectedAsrama}
            onChange={(e) => { setSelectedAsrama(e.target.value); setSearch(''); setHasilCari([]); }}
            disabled={!!userAsrama}
            className={`bg-transparent text-sm font-bold text-gray-700 outline-none ${userAsrama ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
          >
            {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* FORM INPUT */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
        <label className="text-xs font-bold text-gray-500 uppercase">Input Santri Sakit Hari Ini</label>
        
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Cari nama santri..." 
            className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Search className="w-5 h-5"/>
          </button>
        </form>

        {hasilCari.length > 0 && (
          <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-2">
            {hasilCari.map(s => (
              <div key={s.id} className="p-3 border rounded-lg bg-blue-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-gray-800">{s.nama_lengkap}</p>
                  <p className="text-xs text-gray-500">Kamar {s.kamar}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => triggerSimpan(s, 'TIDAK_BELI')}
                    className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-md text-xs font-bold hover:bg-yellow-200 transition-colors"
                  >
                    Tanpa Surat
                  </button>
                  <button 
                    onClick={() => triggerSimpan(s, 'BELI_SURAT')}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-bold hover:bg-red-700 flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3 h-3"/> Beli Surat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIST SAKIT MINGGUAN */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-sm">Daftar Sakit Minggu Ini</h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Reset tiap Senin</span>
        </div>

        {loadingList ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
        ) : listSakit.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400 text-sm">
            Belum ada data sakit minggu ini.
          </div>
        ) : (
          listSakit.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border flex justify-between items-center group hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                  item.keterangan === 'BELI_SURAT' ? 'bg-red-500' : 'bg-yellow-500'
                }`}>
                  {item.santri?.kamar}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{item.santri?.nama_lengkap}</p>
                  <div className="flex items-center gap-2 text-xs mt-0.5">
                    <span className="text-gray-500">{format(new Date(item.tanggal), 'EEEE, dd MMM', { locale: id })}</span>
                    {item.keterangan === 'BELI_SURAT' ? (
                      <span className="text-red-600 font-bold bg-red-50 px-1.5 rounded flex items-center gap-1">
                        <FileText className="w-3 h-3"/> Beli Surat
                      </span>
                    ) : (
                      <span className="text-yellow-600 font-bold bg-yellow-50 px-1.5 rounded">
                        Izin Biasa
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => triggerHapus(item)}
                className="text-gray-300 hover:text-red-500 p-2 transition-colors rounded-full hover:bg-red-50"
                title="Hapus Data"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL KONFIRMASI CUSTOM --- */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                confirmState.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {confirmState.type === 'delete' ? <Trash2 className="w-8 h-8"/> : <AlertTriangle className="w-8 h-8"/>}
              </div>
              
              <h3 className="text-lg font-bold text-gray-800 mb-1">{confirmState.message}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmState.description}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                  className="py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmState.onConfirm}
                  className={`py-2.5 rounded-xl text-white font-bold shadow-md transition-colors ${
                    confirmState.type === 'delete' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {confirmState.type === 'delete' ? 'Hapus' : 'Ya, Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}