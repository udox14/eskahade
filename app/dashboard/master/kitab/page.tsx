'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getMapelList, getKitabList, tambahKitab, hapusKitab, importKitabMassal, updateHargaKitab } from './actions'
// PERBAIKAN: Menambahkan 'List' ke dalam import
import { Book, Plus, Trash2, Save, FileSpreadsheet, Download, Upload, CheckCircle, Loader2, Edit, List } from 'lucide-react'
import { toast } from 'sonner'

// CDN Type
declare global { interface Window { XLSX: any; } }

export default function MasterKitabPage() {
  const [tab, setTab] = useState<'LIST' | 'IMPORT'>('LIST')
  
  // Data
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [kitabList, setKitabList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter List
  const [filterMarhalah, setFilterMarhalah] = useState('')

  // State Import
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // State Edit Harga
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState('')

  useEffect(() => {
    initData()
  }, [])

  useEffect(() => {
    loadKitab()
  }, [filterMarhalah]) 

  const initData = async () => {
    const [m, mp] = await Promise.all([getMarhalahList(), getMapelList()])
    setMarhalahList(m)
    setMapelList(mp)
  }

  const loadKitab = async () => {
    setLoading(true)
    const res = await getKitabList(filterMarhalah)
    setKitabList(res)
    setLoading(false)
  }

  // --- HANDLER MANUAL ---
  const handleTambah = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const toastId = toast.loading("Menambahkan...")
    
    const res = await tambahKitab(formData)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error(res.error)
    } else {
        toast.success("Kitab ditambahkan")
        loadKitab()
        e.currentTarget.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if(!confirm("Hapus kitab ini?")) return
    await hapusKitab(id)
    toast.success("Dihapus")
    loadKitab()
  }

  const handleUpdateHarga = async (id: string) => {
    const harga = parseInt(editHarga)
    if (isNaN(harga)) return toast.warning("Harga tidak valid")
    
    const res = await updateHargaKitab(id, harga)
    if (res?.success) {
        toast.success("Harga diupdate")
        setEditingId(null)
        loadKitab()
    } else {
        toast.error(res?.error)
    }
  }

  // --- HANDLER EXCEL ---
  const downloadTemplate = () => {
    if (!window.XLSX) return toast.error("Excel belum siap")
    const rows = [
       { "NAMA KITAB": "Jurumiyah", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Nahwu", "HARGA": 15000 },
       { "NAMA KITAB": "Kailani", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Shorof", "HARGA": 12000 }
    ]
    const ws = window.XLSX.utils.json_to_sheet(rows)
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, "Master Kitab")
    window.XLSX.writeFile(wb, "Template_Kitab.xlsx")
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !window.XLSX) return
    const reader = new FileReader()
    reader.onload = (evt) => {
       const wb = window.XLSX.read(evt.target?.result, {type:'binary'})
       const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
       // Bersihkan data
       setExcelData(JSON.parse(JSON.stringify(data)))
       toast.success(`${data.length} baris terbaca`)
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanImport = async () => {
    if(excelData.length === 0) return
    setIsProcessing(true)
    const res = await importKitabMassal(excelData)
    setIsProcessing(false)
    
    if (res?.success) {
        toast.success(`Berhasil import ${res.count} kitab`)
        setExcelData([])
        setTab('LIST')
        loadKitab()
    } else {
        toast.error(res?.error)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Book className="w-6 h-6 text-emerald-600"/> Manajemen Kitab & Harga
           </h1>
           <p className="text-gray-500 text-sm">Database kitab kuning dan harga jual (UPK).</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setTab('LIST')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'LIST' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <List className="w-4 h-4"/> Daftar Kitab
           </button>
           <button onClick={() => setTab('IMPORT')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'IMPORT' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <FileSpreadsheet className="w-4 h-4"/> Import Excel
           </button>
        </div>
      </div>

      {/* --- TAB LIST & INPUT MANUAL --- */}
      {tab === 'LIST' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-left-2">
            
            {/* FORM INPUT */}
            <div className="md:col-span-1">
                <div className="bg-white p-5 rounded-xl border shadow-sm sticky top-4">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> Tambah Kitab</h3>
                    <form onSubmit={handleTambah} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Nama Kitab</label>
                            <input name="nama_kitab" required className="w-full p-2 border rounded-lg text-sm" placeholder="Contoh: Jurumiyah"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Tingkat (Marhalah)</label>
                            <select name="marhalah_id" required className="w-full p-2 border rounded-lg text-sm bg-white">
                                <option value="">-- Pilih --</option>
                                {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Mata Pelajaran</label>
                            <select name="mapel_id" required className="w-full p-2 border rounded-lg text-sm bg-white">
                                <option value="">-- Pilih --</option>
                                {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Harga (Rp)</label>
                            <input name="harga" type="number" required className="w-full p-2 border rounded-lg text-sm" placeholder="0"/>
                        </div>
                        <button className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold shadow hover:bg-emerald-700">Simpan</button>
                    </form>
                </div>
            </div>

            {/* TABEL LIST */}
            <div className="md:col-span-2 space-y-4">
                {/* Filter */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                    <span className="text-xs font-bold text-gray-500 ml-2">Filter:</span>
                    <select 
                        value={filterMarhalah} 
                        onChange={(e) => setFilterMarhalah(e.target.value)}
                        className="flex-1 bg-transparent text-sm font-bold text-gray-700 outline-none"
                    >
                        <option value="">Semua Marhalah</option>
                        {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                    </select>
                </div>

                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                            <tr>
                                <th className="px-4 py-3">Nama Kitab</th>
                                <th className="px-4 py-3 text-right">Harga</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan={3} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></td></tr>
                            ) : kitabList.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-10 text-gray-400">Belum ada data.</td></tr>
                            ) : (
                                kitabList.map(k => (
                                    <tr key={k.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-800">{k.nama_kitab}</p>
                                            <p className="text-xs text-gray-500">{k.marhalah?.nama} • {k.mapel?.nama}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">
                                            {editingId === k.id ? (
                                                <input 
                                                    autoFocus
                                                    className="w-20 border rounded px-1 py-0.5 text-right text-sm"
                                                    value={editHarga}
                                                    onChange={e => setEditHarga(e.target.value)}
                                                    onKeyDown={e => {
                                                        if(e.key === 'Enter') handleUpdateHarga(k.id)
                                                        if(e.key === 'Escape') setEditingId(null)
                                                    }}
                                                    onBlur={() => setEditingId(null)}
                                                />
                                            ) : (
                                                `Rp ${k.harga.toLocaleString()}`
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => { setEditingId(k.id); setEditHarga(k.harga.toString()); }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" 
                                                    title="Edit Harga"
                                                >
                                                    <Edit className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => handleHapus(k.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

         </div>
      )}

      {/* --- TAB 2: IMPORT EXCEL --- */}
      {tab === 'IMPORT' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center space-y-3">
                   <Download className="w-8 h-8 text-blue-600"/>
                   <h3 className="font-bold text-blue-900">1. Template Data Kitab</h3>
                   <button onClick={downloadTemplate} className="bg-white text-blue-700 px-4 py-2 rounded shadow-sm font-bold text-xs border hover:bg-blue-50">Download .xlsx</button>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col items-center text-center space-y-3">
                   <Upload className="w-8 h-8 text-green-600"/>
                   <h3 className="font-bold text-green-900">2. Upload Excel</h3>
                   <div className="relative">
                      <input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                      <button className="bg-green-600 text-white px-4 py-2 rounded shadow-sm font-bold text-xs hover:bg-green-700">Pilih File</button>
                   </div>
                </div>
             </div>

             {excelData.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500"/> Preview ({excelData.length})</h3>
                        <button onClick={handleSimpanImport} disabled={isProcessing} className="bg-green-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-800 disabled:opacity-50">
                            {isProcessing ? "Menyimpan..." : "Simpan Semua"}
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto border rounded">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr><th className="p-2">Kitab</th><th className="p-2">Marhalah</th><th className="p-2">Harga</th></tr>
                            </thead>
                            <tbody>
                                {excelData.map((d,i)=>(
                                    <tr key={i} className="border-b">
                                        <td className="p-2">{d['NAMA KITAB']||d['nama kitab']}</td>
                                        <td className="p-2">{d['MARHALAH']||d['marhalah']}</td>
                                        <td className="p-2 font-mono">{d['HARGA']||d['harga']}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
         </div>
      )}

    </div>
  )
}