'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getKelasList, tambahKelas, hapusKelas, importKelasMassal } from './actions'
import { Trash2, Plus, FileSpreadsheet, Upload, Save, CheckCircle, Download, Database, List, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function MasterKelasPage() {
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, k] = await Promise.all([getMarhalahList(), getKelasList()])
    setMarhalahList(m)
    setKelasList(k)
    setLoading(false)
  }

  const handleTambahManual = async (formData: FormData) => {
    const toastId = toast.loading("Menambahkan kelas...")
    const res = await tambahKelas(formData)
    toast.dismiss(toastId)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("Kelas berhasil ditambahkan")
      loadData()
      const form = document.getElementById('form-manual') as HTMLFormElement
      if (form) form.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if(!confirm("Hapus kelas ini?")) return
    const toastId = toast.loading("Menghapus...")
    const res = await hapusKelas(id)
    toast.dismiss(toastId)
    if (res?.error) toast.error("Gagal", { description: res.error })
    else {
      toast.success("Kelas dihapus")
      loadData()
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA KELAS": "1-A", "MARHALAH": "Ibtidaiyyah 1", "JENIS KELAMIN": "L" },
      { "NAMA KELAS": "1-B", "MARHALAH": "Ibtidaiyyah 1", "JENIS KELAMIN": "P" },
      { "NAMA KELAS": "2-A", "MARHALAH": "Ibtidaiyyah 2", "JENIS KELAMIN": "C" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:20}, {wch:10}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Kelas")
    XLSX.writeFile(workbook, "Template_Master_Kelas.xlsx")
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      setExcelData(data)
      toast.success(`Berhasil membaca ${data.length} baris`)
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanExcel = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading("Mengimport data...")
    const res = await importKelasMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if (res?.error) toast.error("Gagal Import", { description: res.error })
    else {
      toast.success(`Sukses! ${res.count} kelas ditambahkan.`)
      setExcelData([])
      loadData()
      setMode('manual')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Manajemen Kelas & Ruangan</h1>
           <p className="text-gray-500 text-sm">Atur struktur kelas per tahun ajaran.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <List className="w-4 h-4"/> Daftar & Manual
           </button>
           <button onClick={() => setMode('excel')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'excel' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <FileSpreadsheet className="w-4 h-4"/> Import Excel
           </button>
        </div>
      </div>

      {mode === 'manual' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wide">Tambah Kelas Satuan</h3>
            <form id="form-manual" action={handleTambahManual} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tingkat (Marhalah)</label>
                <select name="marhalah_id" required className="w-full p-2.5 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {marhalahList?.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Kelas (Ex: 1-B)</label>
                <input type="text" name="nama_kelas" required placeholder="Contoh: 1-14" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Jenis Kelamin</label>
                <select name="jenis_kelamin" className="w-full p-2.5 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="L">Putra (L)</option><option value="P">Putri (P)</option><option value="C">Campuran (L & P)</option>
                </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold text-sm shadow-sm">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b text-xs font-bold text-gray-500 uppercase flex justify-between items-center">
               <span>Daftar Kelas Tersedia</span><span className="bg-white border px-2 py-0.5 rounded text-gray-600">{kelasList.length} Rombel</span>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-600 font-bold border-b">
                <tr><th className="px-6 py-3">Nama Kelas</th><th className="px-6 py-3">Tingkat</th><th className="px-6 py-3">L/P</th><th className="px-6 py-3 text-right">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kelasList?.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-800">{k.nama_kelas}</td>
                    <td className="px-6 py-3 text-gray-500">{k.marhalah?.nama}</td>
                    <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${k.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : k.jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>{k.jenis_kelamin === 'C' ? 'CAMPURAN' : k.jenis_kelamin === 'L' ? 'PUTRA' : 'PUTRI'}</span></td>
                    <td className="px-6 py-3 text-right"><button onClick={() => handleHapus(k.id)} className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'excel' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col justify-center items-center text-center space-y-4">
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Download className="w-6 h-6"/></div>
                   <div><h3 className="font-bold text-blue-900">1. Download Template</h3><p className="text-xs text-blue-600 max-w-xs mx-auto mt-1">Gunakan template ini untuk mengisi daftar kelas baru secara massal.</p></div>
                   <button onClick={handleDownloadTemplate} className="bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50">Download Excel</button>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col justify-center items-center text-center space-y-4">
                   <div className="bg-green-100 p-3 rounded-full text-green-600"><Upload className="w-6 h-6"/></div>
                   <div><h3 className="font-bold text-green-900">2. Upload File</h3><p className="text-xs text-green-600 max-w-xs mx-auto mt-1">Upload file Excel yang sudah diisi di sini.</p></div>
                   <div className="relative"><input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/><button className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-green-700">Pilih File Excel</button></div>
                </div>
            </div>
            {excelData.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Preview ({excelData.length} Kelas)</h3>
                        <button onClick={handleSimpanExcel} disabled={isProcessing} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-green-800 disabled:opacity-50 flex items-center gap-2">
                           {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Simpan Semua
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600 font-bold sticky top-0"><tr><th className="px-4 py-2">Nama Kelas</th><th className="px-4 py-2">Marhalah</th><th className="px-4 py-2">L/P</th></tr></thead><tbody className="divide-y">{excelData.map((row, i) => (<tr key={i}><td className="px-4 py-2">{row['NAMA KELAS'] || row['nama kelas']}</td><td className="px-4 py-2">{row['MARHALAH'] || row['marhalah']}</td><td className="px-4 py-2">{row['JENIS KELAMIN'] || row['jenis kelamin']}</td></tr>))}</tbody></table>
                    </div>
                </div>
            )}
         </div>
      )}
    </div>
  )
}