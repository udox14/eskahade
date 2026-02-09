'use client'

import { useState } from 'react'
// HAPUS IMPORT XLSX STATIS
import { simpanSantriKeKelas, simpanPenempatanBatch } from './actions'
import { Save, Search, CheckSquare, FileSpreadsheet, Upload, AlertCircle, CheckCircle, Download, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner' 

export function FormAturKelas({ kelasList, santriList }: { kelasList: any[], santriList: any[] }) {
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')

  // --- STATE MANUAL ---
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSantri, setSelectedSantri] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // --- STATE EXCEL ---
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [showConfirmExcel, setShowConfirmExcel] = useState(false)

  // LOGIC MANUAL
  const filteredSantri = santriList.filter(s => 
    s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || 
    s.nis.includes(search) ||
    (s.rekomendasi && s.rekomendasi.toLowerCase().includes(search.toLowerCase()))
  )

  const handleToggle = (id: string) => {
    if (selectedSantri.includes(id)) {
      setSelectedSantri(selectedSantri.filter(x => x !== id))
    } else {
      setSelectedSantri([...selectedSantri, id])
    }
  }

  const handleSelectAll = () => {
    const ids = filteredSantri.map(s => s.id)
    const allSelected = ids.every(id => selectedSantri.includes(id))
    if (allSelected) {
      setSelectedSantri(selectedSantri.filter(id => !ids.includes(id)))
    } else {
      setSelectedSantri([...new Set([...selectedSantri, ...ids])])
    }
  }

  const handleSimpanManual = async () => {
    if (!selectedKelas) {
      toast.warning("Pilih kelas tujuan dulu!")
      return
    }
    if (selectedSantri.length === 0) {
      toast.warning("Pilih minimal satu santri!")
      return
    }

    setLoading(true)
    const toastId = toast.loading("Menyimpan data kelas...")

    const res = await simpanSantriKeKelas(selectedKelas, selectedSantri)
    
    setLoading(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Berhasil!", { description: `${selectedSantri.length} santri berhasil dimasukkan ke kelas.` })
      setSelectedSantri([]) 
    }
  }

  // LOGIC EXCEL (DYNAMIC IMPORT)
  const handleDownloadTemplate = async () => {
    if (santriList.length === 0) {
      toast.info("Tidak ada data santri yang perlu ditempatkan.")
      return
    }

    const loadToast = toast.loading("Menyiapkan template...")
    
    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const rows = santriList.map(s => ({
      NIS: s.nis,
      "NAMA SANTRI": s.nama_lengkap,
      "REKOMENDASI TES": s.rekomendasi || "Belum Tes",
      "TARGET KELAS": "" 
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:30}, {wch:30}, {wch:20}]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Penempatan Kelas")
    XLSX.writeFile(workbook, "Template_Penempatan_Kelas_Rekomendasi.xlsx")
    
    toast.dismiss(loadToast)
    toast.success("Template Excel berhasil didownload")
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading("Membaca file...")
    
    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(ws)
        
        const mappedData = rawData.map((row: any) => {
          const nis = String(row['NIS'] || row['nis']).trim()
          const namaKelas = String(row['TARGET KELAS'] || row['target kelas']).trim()

          const santri = santriList.find(s => s.nis === nis)
          const kelas = kelasList.find(k => k.nama_kelas.toLowerCase() === namaKelas.toLowerCase())

          return {
            nis,
            nama: row['NAMA SANTRI'],
            rekomendasi: row['REKOMENDASI TES'],
            target_kelas_nama: namaKelas,
            santri_id: santri?.id,
            kelas_id: kelas?.id,
            isValid: !!santri?.id && !!kelas?.id
          }
        })

        setExcelData(mappedData)
        toast.dismiss(toastId)
        toast.success(`Berhasil membaca ${mappedData.length} baris data`)
      } catch (err) {
        toast.dismiss(toastId)
        toast.error("File Excel tidak valid")
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanExcel = async () => {
    setShowConfirmExcel(false) // Close modal
    setIsProcessingExcel(true)
    const toastId = toast.loading("Memproses penempatan massal...")
    
    const validData = excelData.filter(d => d.isValid).map(d => ({
      santri_id: d.santri_id,
      kelas_id: d.kelas_id
    }))

    const res = await simpanPenempatanBatch(validData)
    
    setIsProcessingExcel(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Import Berhasil", { description: `${res.count} santri telah ditempatkan di kelas baru.` })
      setExcelData([])
    }
  }

  const triggerSimpanExcel = () => {
    const validCount = excelData.filter(d => d.isValid).length
    if (validCount === 0) {
      toast.warning("Tidak ada data valid untuk disimpan.")
      return
    }
    setShowConfirmExcel(true)
  }

  return (
    <div className="space-y-6">
      
      {/* TAB SWITCHER */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setMode('manual')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            mode === 'manual' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckSquare className="w-4 h-4"/> Cara Manual (Satu Kelas)
        </button>
        <button
          onClick={() => setMode('excel')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            mode === 'excel' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4"/> Cara Import Excel (Banyak Kelas)
        </button>
      </div>

      {/* --- MODE MANUAL --- */}
      {mode === 'manual' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
          {/* 1. Pilih Kelas */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Langkah 1: Pilih Kelas Tujuan</label>
            <select 
              className="w-full md:w-1/2 p-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
            >
              <option value="">-- Pilih Kelas --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas} ({k.marhalah?.nama})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Pilih Santri */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Langkah 2: Pilih Santri</label>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleSelectAll}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded border transition-colors whitespace-nowrap"
                >
                  Pilih Semua Tampil
                </button>

                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Cari nama atau grade..." 
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none w-full sm:w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto bg-white p-2 grid grid-cols-1 gap-2">
              {filteredSantri.length === 0 && (
                <div className="text-center py-12 text-gray-400 italic">
                  Tidak ada santri yang cocok dengan pencarian.
                </div>
              )}

              {filteredSantri.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => handleToggle(s.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${
                    selectedSantri.includes(s.id) 
                      ? 'bg-green-50 border-green-500 ring-1 ring-green-500 shadow-sm' 
                      : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedSantri.includes(s.id) ? 'bg-green-600 border-green-600' : 'border-gray-300 bg-gray-50'
                    }`}>
                      {selectedSantri.includes(s.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{s.nama_lengkap}</p>
                      <p className="text-xs text-gray-500 font-mono">{s.nis}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {s.rekomendasi ? (
                      <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                        s.rekomendasi.includes('Grade A') ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        s.rekomendasi.includes('Tamhidiyyah') ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {s.rekomendasi}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Belum Dites</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 px-1">
              <span>* Klik nama santri untuk memilih</span>
              <span>Terpilih: <b>{selectedSantri.length}</b> santri</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSimpanManual}
              disabled={loading || selectedSantri.length === 0}
              className="bg-green-700 hover:bg-green-800 text-white px-8 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50 font-medium shadow-md transition-transform active:scale-95"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
              <span>Simpan Masuk Kelas</span>
            </button>
          </div>
        </div>
      )}

      {/* --- MODE EXCEL --- */}
      {mode === 'excel' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STEP 1 */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                <Download className="w-5 h-5"/> 1. Download Template
              </h3>
              <p className="text-sm text-blue-600 leading-relaxed">
                File Excel akan berisi daftar semua santri yang belum punya kelas, 
                lengkap dengan kolom <b>REKOMENDASI TES</b>.
              </p>
              <button 
                onClick={handleDownloadTemplate}
                className="w-full bg-white text-blue-700 border border-blue-200 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors"
              >
                Download Template Santri.xlsx
              </button>
            </div>

            {/* STEP 2 */}
            <div className="bg-green-50 p-6 rounded-xl border border-green-100 space-y-4">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                <Upload className="w-5 h-5"/> 2. Upload & Proses
              </h3>
              <p className="text-sm text-green-600 leading-relaxed">
                Isi kolom <b>"TARGET KELAS"</b> di Excel (Misal: 1-A, 1-B). Pastikan nama kelas sesuai dengan Master Kelas.
              </p>
              <div className="border-2 border-dashed border-green-300 bg-white rounded-lg p-3 text-center relative hover:bg-green-50 transition-colors">
                <input 
                  type="file" 
                  accept=".xlsx"
                  onChange={handleUploadExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="text-sm text-green-700 font-medium">Klik untuk upload file Excel</span>
              </div>
            </div>
          </div>

          {/* STEP 3 */}
          {excelData.length > 0 && (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600"/> 
                  Preview ({excelData.filter(d => d.isValid).length} Valid)
                </h3>
                <button 
                  onClick={triggerSimpanExcel}
                  disabled={isProcessingExcel}
                  className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-800 disabled:opacity-50"
                >
                  {isProcessingExcel ? "Menyimpan..." : <><Save className="w-4 h-4" /> Eksekusi Simpan</>}
                </button>
              </div>
              
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                    <tr>
                      <th className="px-4 py-2">NIS</th>
                      <th className="px-4 py-2">Nama Santri</th>
                      <th className="px-4 py-2">Rekomendasi</th>
                      <th className="px-4 py-2">Target Kelas (Excel)</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {excelData.map((row, i) => (
                      <tr key={i} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                        <td className="px-4 py-2 font-mono text-xs">{row.nis}</td>
                        <td className="px-4 py-2">{row.nama}</td>
                        <td className="px-4 py-2 text-xs font-medium text-purple-700">{row.rekomendasi}</td>
                        <td className="px-4 py-2 font-bold">{row.target_kelas_nama}</td>
                        <td className="px-4 py-2 text-center text-xs">
                          {row.isValid ? (
                            <span className="text-green-600 font-bold">Siap Masuk</span>
                          ) : (
                            <span className="text-red-600 flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3"/> 
                              {!row.santri_id ? "Santri Tidak Ada" : "Kelas Tidak Ditemukan"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* --- MODAL CONFIRM EXCEL --- */}
      {showConfirmExcel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Simpan Penempatan?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Anda akan menempatkan <b>{excelData.filter(d => d.isValid).length} santri</b> ke kelas baru sesuai Excel.
            </p>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowConfirmExcel(false)} className="py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50">Batal</button>
               <button onClick={handleSimpanExcel} className="py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md">Ya, Simpan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}