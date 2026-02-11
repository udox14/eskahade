'use client'

import { useState, useEffect } from 'react'
import { getDataMaster, importDataGuru, tambahGuruManual, hapusGuru, simpanJadwalBatch } from './actions'
import { UserCheck, Save, Loader2, School, Search, FileSpreadsheet, Upload, Download, List, Briefcase, Plus, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

// CDN Type
declare global { interface Window { XLSX: any; } }

export default function ManajemenGuruPage() {
  const [tab, setTab] = useState<'JADWAL' | 'MASTER'>('JADWAL')
  
  const [kelasList, setKelasList] = useState<any[]>([]) // Data asli dari DB
  const [localKelasList, setLocalKelasList] = useState<any[]>([]) // Data yang diedit di layar (State)
  
  const [guruList, setGuruList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // State Import
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // State Manual Add
  const [newGuru, setNewGuru] = useState({ nama: '', gelar: '', kode: '' })

  // Filter
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const res = await getDataMaster()
    setKelasList(res.kelasList)
    
    // Inisialisasi state lokal dengan data ID saja agar ringan
    const mappedLocal = res.kelasList.map((k: any) => ({
        id: k.id,
        nama_kelas: k.nama_kelas,
        marhalah_nama: k.marhalah?.nama,
        s: k.guru_shubuh?.id || "",
        a: k.guru_ashar?.id || "",
        m: k.guru_maghrib?.id || ""
    }))
    setLocalKelasList(mappedLocal)
    
    setGuruList(res.guruList)
    setLoading(false)
  }

  // --- LOGIC KONFLIK JADWAL ---
  // Fungsi ini mengecek: Apakah guru X sudah dipakai di sesi Y di kelas selain Z?
  const isGuruBusy = (guruId: string, session: 's'|'a'|'m', currentKelasId: string) => {
      if (!guruId) return false
      return localKelasList.some(k => k[session] == guruId && k.id !== currentKelasId)
  }

  // Handler Perubahan Dropdown
  const handleChangeLocal = (kelasId: string, session: 's'|'a'|'m', guruId: string) => {
      setLocalKelasList(prev => prev.map(k => {
          if (k.id === kelasId) {
              return { ...k, [session]: guruId }
          }
          return k
      }))
  }

  // --- HANDLER SIMPAN SEMUA (BATCH) ---
  const handleSimpanSemua = async () => {
    if (!confirm("Simpan semua perubahan jadwal dan sinkronisasi akun Wali Kelas?")) return

    setIsSavingBatch(true)
    const toastId = toast.loading("Menyimpan jadwal massal...")

    // Siapkan payload
    const payload = localKelasList.map(k => ({
        kelasId: k.id,
        shubuhId: Number(k.s) || 0,
        asharId: Number(k.a) || 0,
        maghribId: Number(k.m) || 0
    }))

    const res = await simpanJadwalBatch(payload)
    
    setIsSavingBatch(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Berhasil!", { description: `${res.count} kelas telah diperbarui.` })
        loadData() // Refresh dari server untuk memastikan sinkronisasi
    }
  }

  // --- HANDLER MANUAL GURU ---
  const handleTambahGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGuru.nama) return toast.warning("Nama wajib diisi")
    
    const toastId = toast.loading("Menambahkan...")
    const res = await tambahGuruManual(newGuru.nama, newGuru.gelar, newGuru.kode)
    toast.dismiss(toastId)

    if (res?.success) {
        toast.success("Guru ditambahkan")
        setNewGuru({ nama: '', gelar: '', kode: '' })
        loadData() // Refresh list guru
    } else {
        toast.error(res?.error)
    }
  }

  const handleHapusGuru = async (id: string, nama: string) => {
    if(!confirm(`Hapus guru ${nama}? Pastikan tidak sedang mengajar.`)) return
    
    const res = await hapusGuru(id)
    if (res?.success) {
        toast.success("Guru dihapus")
        loadData()
    } else {
        toast.error(res?.error)
    }
  }

  // --- HANDLER IMPORT GURU ---
  const handleDownloadTemplate = () => {
    if (!window.XLSX) return toast.error("Library Excel belum siap.")
    const rows = [
       { "NAMA LENGKAP": "Ahmad Fulan", "GELAR": "S.Pd.I", "KODE": "AHM" },
       { "NAMA LENGKAP": "Budi Santoso", "GELAR": "M.Ag", "KODE": "BUD" }
    ]
    const ws = window.XLSX.utils.json_to_sheet(rows)
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, "Data Guru")
    window.XLSX.writeFile(wb, "Template_Guru.xlsx")
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file || !window.XLSX) return
    const reader = new FileReader()
    reader.onload = (evt) => {
       try {
         const wb = window.XLSX.read(evt.target?.result, {type:'binary'})
         const ws = wb.Sheets[wb.SheetNames[0]]
         const rawData = window.XLSX.utils.sheet_to_json(ws)
         const cleanData = JSON.parse(JSON.stringify(rawData))
         setExcelData(cleanData)
         toast.success(`${cleanData.length} baris terbaca`)
       } catch (e) { toast.error("Gagal baca file") }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanGuru = async () => {
    if(excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading("Mengimport data guru...")
    const res = await importDataGuru(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if (res?.success) {
        toast.success(`Berhasil import ${res.count} guru`)
        setExcelData([])
        loadData()
        setTab('JADWAL')
    } else {
        toast.error("Gagal import", { description: res?.error })
    }
  }

  // Filter Table
  const filteredLocalKelas = localKelasList.filter(k => 
     k.nama_kelas.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600"/> Manajemen Guru & Jadwal
          </h1>
          <p className="text-gray-500 text-sm">Atur pengajar per kelas. Guru Malam otomatis jadi Wali Kelas.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setTab('JADWAL')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'JADWAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <School className="w-4 h-4"/> Jadwal Kelas
           </button>
           <button onClick={() => setTab('MASTER')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'MASTER' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <UserCheck className="w-4 h-4"/> Master Guru
           </button>
        </div>
      </div>

      {/* --- TAB 1: JADWAL KELAS --- */}
      {tab === 'JADWAL' && (
         <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
            <div className="flex justify-between items-end">
                {/* Search */}
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input 
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Cari kelas..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                
                {/* TOMBOL SIMPAN GLOBAL */}
                <button 
                    onClick={handleSimpanSemua}
                    disabled={isSavingBatch || loading}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                    SIMPAN SEMUA JADWAL
                </button>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
               <div className="overflow-x-auto min-h-[400px]">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-indigo-50 text-indigo-900 font-bold uppercase text-xs sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 min-w-[150px]">Kelas</th>
                            <th className="px-4 py-3 min-w-[200px]">Shubuh</th>
                            <th className="px-4 py-3 min-w-[200px]">Ashar</th>
                            <th className="px-4 py-3 min-w-[200px] bg-yellow-100 text-yellow-900 border-l border-yellow-200">
                                Maghrib (Wali Kelas)
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></td></tr>
                        ) : filteredLocalKelas.map(k => (
                            <tr key={k.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <p className="font-bold text-gray-800">{k.nama_kelas}</p>
                                    <p className="text-[10px] text-gray-400">{k.marhalah_nama}</p>
                                </td>
                                
                                {/* SHUBUH */}
                                <td className="px-4 py-2">
                                    <select 
                                        value={k.s} 
                                        onChange={e => handleChangeLocal(k.id, 's', e.target.value)} 
                                        className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">- Kosong -</option>
                                        {guruList.map((g:any) => {
                                            // FITUR AUTO DETECT BENTROK
                                            // Jika guru ini sudah dipakai di kelas lain pada sesi SHUBUH, disable/hide
                                            const isBusy = isGuruBusy(g.id, 's', k.id)
                                            if (isBusy) return null // Sembunyikan guru yg sibuk
                                            return <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                                        })}
                                    </select>
                                </td>

                                {/* ASHAR */}
                                <td className="px-4 py-2">
                                    <select 
                                        value={k.a} 
                                        onChange={e => handleChangeLocal(k.id, 'a', e.target.value)} 
                                        className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">- Kosong -</option>
                                        {guruList.map((g:any) => {
                                            const isBusy = isGuruBusy(g.id, 'a', k.id)
                                            if (isBusy) return null 
                                            return <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                                        })}
                                    </select>
                                </td>

                                {/* MAGHRIB */}
                                <td className="px-4 py-2 bg-yellow-50/30 border-l border-yellow-100">
                                    <select 
                                        value={k.m} 
                                        onChange={e => handleChangeLocal(k.id, 'm', e.target.value)} 
                                        className="w-full p-1.5 border border-yellow-300 bg-white text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-yellow-500"
                                    >
                                        <option value="">- Kosong -</option>
                                        {guruList.map((g:any) => {
                                            const isBusy = isGuruBusy(g.id, 'm', k.id)
                                            if (isBusy) return null
                                            return <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                                        })}
                                    </select>
                                    {k.m && <p className="text-[9px] text-green-600 mt-1 text-center font-bold">Auto Akun</p>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}

      {/* --- TAB 2: MASTER GURU (INPUT MANUAL + IMPORT) --- */}
      {tab === 'MASTER' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
             
             {/* FORM INPUT MANUAL */}
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <Plus className="w-5 h-5 text-green-600"/> Tambah Guru Baru (Manual)
                </h3>
                <form onSubmit={handleTambahGuru} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Lengkap</label>
                        <input value={newGuru.nama} onChange={e=>setNewGuru({...newGuru, nama: e.target.value})} className="w-full p-2 border rounded" placeholder="Contoh: Ahmad" required/>
                    </div>
                    <div className="w-full md:w-1/4">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Gelar (Opsional)</label>
                        <input value={newGuru.gelar} onChange={e=>setNewGuru({...newGuru, gelar: e.target.value})} className="w-full p-2 border rounded" placeholder="S.Pd."/>
                    </div>
                    <div className="w-full md:w-1/4">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kode (Opsional)</label>
                        <input value={newGuru.kode} onChange={e=>setNewGuru({...newGuru, kode: e.target.value})} className="w-full p-2 border rounded" placeholder="AHM"/>
                    </div>
                    <button className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 w-full md:w-auto">Simpan</button>
                </form>
             </div>

             <hr className="border-dashed"/>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Download */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center space-y-3">
                   <Download className="w-8 h-8 text-blue-600"/>
                   <h3 className="font-bold text-blue-900">1. Template Data Guru</h3>
                   <button onClick={handleDownloadTemplate} className="bg-white text-blue-700 px-4 py-2 rounded shadow-sm font-bold text-xs border hover:bg-blue-50">Download .xlsx</button>
                </div>
                {/* Upload */}
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col items-center text-center space-y-3">
                   <Upload className="w-8 h-8 text-green-600"/>
                   <h3 className="font-bold text-green-900">2. Upload Excel</h3>
                   <div className="relative">
                      <input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                      <button className="bg-green-600 text-white px-4 py-2 rounded shadow-sm font-bold text-xs hover:bg-green-700">Pilih File</button>
                   </div>
                </div>
             </div>

             {/* Preview */}
             {excelData.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><List className="w-4 h-4"/> Preview ({excelData.length})</h3>
                        <button onClick={handleSimpanGuru} disabled={isProcessing} className="bg-green-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-800 disabled:opacity-50">
                            {isProcessing ? "Menyimpan..." : "Simpan Semua Guru"}
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto border rounded">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Nama</th><th className="p-2">Gelar</th></tr></thead>
                            <tbody>{excelData.map((d,i)=><tr key={i} className="border-b"><td className="p-2">{d['NAMA LENGKAP']||d['nama']}</td><td className="p-2">{d['GELAR']||d['gelar']}</td></tr>)}</tbody>
                        </table>
                    </div>
                </div>
             )}

             {/* List Guru Existing */}
             <div className="bg-white border rounded-xl p-4 shadow-sm">
                 <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-bold text-gray-700">Daftar Guru Terdaftar ({guruList.length})</h3>
                 </div>
                 <div className="max-h-96 overflow-auto grid grid-cols-1 md:grid-cols-3 gap-3">
                    {guruList.map(g => (
                        <div key={g.id} className="p-3 bg-gray-50 border rounded-lg flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
                            <div>
                                <p className="font-bold text-sm text-gray-800 truncate">{g.nama_lengkap}</p>
                                <p className="text-xs text-gray-500">{g.gelar || '-'}</p>
                            </div>
                            <button 
                                onClick={() => handleHapusGuru(g.id, g.nama_lengkap)}
                                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Hapus Guru"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                 </div>
             </div>
         </div>
      )}

    </div>
  )
}