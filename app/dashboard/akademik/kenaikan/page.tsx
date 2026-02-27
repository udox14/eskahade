'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getKelasByMarhalah, getSantriForKenaikan, importKenaikanKelas } from './actions'
import { FileSpreadsheet, Upload, Save, Loader2, CheckCircle, AlertTriangle, Download, X, HelpCircle, LayoutList, CheckSquare, Square, Users, GraduationCap } from 'lucide-react'
import { toast } from 'sonner' 

// Definisi Window Type untuk CDN SheetJS
declare global {
  interface Window {
    XLSX: any;
  }
}

export default function KenaikanKelasPage() {
  const [mode, setMode] = useState<'EXCEL' | 'MANUAL'>('MANUAL')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  
  // State Filter Asal
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  
  // State Excel Mode
  const [excelData, setExcelData] = useState<any[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // State Manual Mode
  const [manualSantri, setManualSantri] = useState<any[]>([])
  const [isLoadingManual, setIsLoadingManual] = useState(false)
  
  // State Target (Tujuan) untuk Manual Mode
  const [targetMarhalah, setTargetMarhalah] = useState('')
  const [targetKelasList, setTargetKelasList] = useState<any[]>([])
  const [bulkTargetKelas, setBulkTargetKelas] = useState('')
  
  // State Penempatan & Seleksi (Manual Mode)
  const [placements, setPlacements] = useState<Record<string, string>>({}) // key: NIS, value: nama_kelas target
  const [selectedNis, setSelectedNis] = useState<string[]>([])

  // 1. Load Referensi Marhalah (Awal)
  useEffect(() => {
    getMarhalahList().then(setMarhalahList)
  }, [])

  // 2. Load Referensi Kelas Asal jika Marhalah Asal berubah
  useEffect(() => {
    if (selectedMarhalah) {
      getKelasByMarhalah(selectedMarhalah).then(setKelasList)
      setSelectedKelas('') 
    } else {
      setKelasList([])
    }
  }, [selectedMarhalah])

  // 3. Load Referensi Kelas Target jika Marhalah Target berubah (Khusus Manual Mode)
  useEffect(() => {
    if (targetMarhalah) {
      getKelasByMarhalah(targetMarhalah).then(setTargetKelasList)
      setBulkTargetKelas('')
    } else {
      setTargetKelasList([])
    }
  }, [targetMarhalah])


  // --- HELPER UNTUK LOAD EXCEL CDN (SHEETJS) ---
  const loadSheetJS = async () => {
      if (window.XLSX) return window.XLSX;
      return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
          script.onload = () => resolve(window.XLSX);
          script.onerror = reject;
          document.body.appendChild(script);
      });
  };

  // ==========================================
  // LOGIKA MODE EXCEL
  // ==========================================
  const handleDownload = async () => {
    if (!selectedMarhalah) return toast.warning("Pilih Tingkat (Marhalah) Asal terlebih dahulu.")
    
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan data santri...")

    try {
      const dataSantri = await getSantriForKenaikan(selectedMarhalah, selectedKelas)
      if (dataSantri.length === 0) {
        toast.dismiss(loadToast)
        toast.error("Tidak ada data", { description: "Tidak ada santri aktif di pilihan ini." })
        setIsDownloading(false)
        return
      }

      const XLSX = await loadSheetJS()
      const rows = dataSantri.map(s => ({
        NIS: s.nis,
        "NAMA SANTRI": s.nama,
        "KELAS SEKARANG": s.kelas_sekarang,
        "HASIL GRADING": s.grade_lanjutan,
        "RATA-RATA ILMU ALAT": s.rata_rata,
        "TARGET KELAS": "" 
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = [{wch:15}, {wch:35}, {wch:20}, {wch:20}, {wch:20}, {wch:20}]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kenaikan")
      
      const namaMarhalah = marhalahList.find(m => m.id == selectedMarhalah)?.nama || 'Semua'
      const namaKelas = kelasList.find(k => k.id == selectedKelas)?.nama_kelas || 'Semua_Kelas'
      
      XLSX.writeFile(workbook, `Kenaikan_${namaMarhalah}_${namaKelas}.xlsx`)
      toast.dismiss(loadToast)
      toast.success("Template berhasil didownload")
    } catch (error) {
      toast.dismiss(loadToast)
      toast.error("Gagal membuat file Excel")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const loadToast = toast.loading("Membaca file Excel...")

    try {
      const XLSX = await loadSheetJS()
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const dataArray = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(dataArray, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws)
          setExcelData(data)
          toast.dismiss(loadToast)
          toast.success(`Berhasil membaca ${data.length} baris data`)
        } catch (err) {
          toast.dismiss(loadToast)
          toast.error("Format file tidak valid")
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      toast.dismiss(loadToast)
      toast.error("Gagal memuat sistem Excel.")
    }
  }


  // ==========================================
  // LOGIKA MODE MANUAL (INTERFACE)
  // ==========================================
  const handleLoadManualSantri = async () => {
    if (!selectedMarhalah) return toast.warning("Pilih Tingkat (Marhalah) Asal terlebih dahulu.")
    
    setIsLoadingManual(true)
    setPlacements({})
    setSelectedNis([])

    try {
      const dataSantri = await getSantriForKenaikan(selectedMarhalah, selectedKelas)
      if (dataSantri.length === 0) {
         toast.error("Tidak ada santri aktif di pilihan ini.")
      }
      setManualSantri(dataSantri)
    } catch (error) {
      toast.error("Gagal memuat data santri.")
    } finally {
      setIsLoadingManual(false)
    }
  }

  const toggleSelectNis = (nis: string) => {
    setSelectedNis(prev => prev.includes(nis) ? prev.filter(n => n !== nis) : [...prev, nis])
  }

  const toggleSelectAll = () => {
    if (selectedNis.length === manualSantri.length) {
      setSelectedNis([])
    } else {
      setSelectedNis(manualSantri.map(s => s.nis))
    }
  }

  const applyBulkPlacement = () => {
    if (selectedNis.length === 0) return toast.warning("Pilih minimal satu santri (ceklis).")
    if (!bulkTargetKelas) return toast.warning("Pilih kelas tujuan terlebih dahulu.")

    const newPlacements = { ...placements }
    selectedNis.forEach(nis => {
      newPlacements[nis] = bulkTargetKelas
    })
    
    setPlacements(newPlacements)
    setSelectedNis([]) // Bersihkan seleksi setelah diterapkan
    toast.success(`Berhasil menerapkan kelas ke ${selectedNis.length} santri.`)
  }

  const handleIndividualPlacement = (nis: string, targetKelasNama: string) => {
    setPlacements(prev => ({ ...prev, [nis]: targetKelasNama }))
  }


  // ==========================================
  // EKSEKUSI PENYIMPANAN (SHARED)
  // ==========================================
  const executeProcess = async (payload: any[]) => {
    setIsProcessing(true)
    const loadToast = toast.loading("Memproses pemindahan kelas...")

    const res = await importKenaikanKelas(payload)
    
    setIsProcessing(false)
    toast.dismiss(loadToast)

    if (res?.error) {
      toast.error("Terjadi Masalah", { description: res.error, duration: 8000 })
    } else {
      toast.success("Kenaikan Kelas Berhasil!", { description: `Sukses memindahkan ${res.count} santri ke kelas baru.` })
      
      // Reset State
      setExcelData([])
      setPlacements({})
      setManualSantri([])
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
  }

  // Handler untuk Excel
  const handleProcessExcel = () => {
    setShowConfirm(false)
    executeProcess(excelData)
  }

  // Handler untuk Manual
  const handleProcessManual = () => {
    // Ubah format objek ke format array yang diharapkan server action
    const payload = Object.entries(placements)
      .filter(([nis, target]) => target && target !== '')
      .map(([nis, target]) => ({
        'NIS': nis,
        'TARGET KELAS': target
      }))

    if (payload.length === 0) {
      return toast.error("Belum ada satupun santri yang ditentukan kelas tujuannya.")
    }

    if (confirm(`Yakin ingin memproses kenaikan ${payload.length} santri ke kelas baru?`)) {
      executeProcess(payload)
    }
  }

  // Trigger Konfirmasi Excel (Fungsi yang terhapus)
  const triggerProcess = () => {
    if (excelData.length === 0) {
      toast.warning("Belum ada data Excel yang diupload.")
      return
    }
    setShowConfirm(true)
  }

  const totalPlacementsReady = Object.keys(placements).filter(k => placements[k] !== '').length

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      
      {/* HEADER & TOGGLE MODE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proses Kenaikan Kelas</h1>
          <p className="text-gray-500 text-sm">Gunakan hasil Grading dari Wali Kelas sebagai acuan penempatan kelas baru.</p>
        </div>

        {/* Custom Toggle Switch */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
           <button 
             onClick={() => setMode('MANUAL')} 
             className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'MANUAL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <LayoutList className="w-4 h-4"/> Interface
           </button>
           <button 
             onClick={() => setMode('EXCEL')} 
             className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'EXCEL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <FileSpreadsheet className="w-4 h-4"/> Excel
           </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODE MANUAL (INTERFACE / UI) */}
      {/* ================================================================= */}
      {mode === 'MANUAL' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
          
          {/* STEP 1: PILIH ASAL */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-2/5">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tingkat / Marhalah Asal</label>
              <select 
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium text-sm outline-none transition-all"
                value={selectedMarhalah}
                onChange={(e) => setSelectedMarhalah(e.target.value)}
              >
                <option value="">-- Pilih Marhalah --</option>
                {marhalahList.map(m => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-2/5">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas Asal (Opsional)</label>
              <select 
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium text-sm outline-none transition-all disabled:opacity-50"
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                disabled={!selectedMarhalah}
              >
                <option value="">Semua Kelas</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={handleLoadManualSantri}
              disabled={!selectedMarhalah || isLoadingManual}
              className="w-full md:w-1/5 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoadingManual ? <Loader2 className="w-5 h-5 animate-spin"/> : <Users className="w-5 h-5"/>}
              Tampilkan
            </button>
          </div>

          {/* STEP 2: LIST SANTRI & BULK ACTIONS */}
          {manualSantri.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* Toolbar Bulk Action */}
              <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                   <h3 className="font-bold text-indigo-900">Penempatan Kelas Tujuan</h3>
                   <p className="text-xs text-indigo-700/70 font-medium mt-0.5">Tandai santri untuk memindahkan mereka secara massal.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto bg-white p-2 rounded-xl border border-indigo-100 shadow-sm">
                  <select 
                    className="w-full sm:w-auto p-2 text-sm border-r border-gray-200 outline-none text-gray-700 font-medium bg-transparent"
                    value={targetMarhalah}
                    onChange={(e) => setTargetMarhalah(e.target.value)}
                  >
                    <option value="">1. Pilih Marhalah Baru</option>
                    {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>

                  <select 
                    className="w-full sm:w-auto p-2 text-sm outline-none text-indigo-700 font-bold bg-transparent disabled:opacity-50"
                    value={bulkTargetKelas}
                    onChange={(e) => setBulkTargetKelas(e.target.value)}
                    disabled={!targetMarhalah}
                  >
                    <option value="">2. Pilih Kelas Baru</option>
                    {targetKelasList.map(k => <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>)}
                  </select>

                  <button 
                    onClick={applyBulkPlacement}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors active:scale-95"
                  >
                    Terapkan
                  </button>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600 transition-colors">
                          {selectedNis.length === manualSantri.length && manualSantri.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600"/> : <Square className="w-5 h-5"/>}
                        </button>
                      </th>
                      <th className="p-4">Nama & NIS</th>
                      <th className="p-4 text-center">Kelas Asal</th>
                      <th className="p-4 text-center">Grade Rekomendasi<br/><span className="text-[9px] text-gray-400 normal-case">(Dari Wali Kelas)</span></th>
                      <th className="p-4 bg-indigo-50 border-l border-indigo-100 w-64">Target Kelas Baru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {manualSantri.map(s => (
                      <tr key={s.nis} className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedNis.includes(s.nis) ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleSelectNis(s.nis)}>
                        <td className="p-4 text-center">
                          {selectedNis.includes(s.nis) ? <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto"/> : <Square className="w-5 h-5 text-gray-300 mx-auto"/>}
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-gray-800 text-base">{s.nama}</p>
                          <p className="text-gray-500 font-mono text-xs">{s.nis}</p>
                        </td>
                        <td className="p-4 text-center text-gray-600 font-medium">
                          {s.kelas_sekarang}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                            String(s.grade_lanjutan).includes('A') ? 'bg-green-50 text-green-700 border-green-200' :
                            String(s.grade_lanjutan).includes('B') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            String(s.grade_lanjutan).includes('C') ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            {s.grade_lanjutan || '-'}
                          </span>
                        </td>
                        <td className="p-4 bg-indigo-50/20 border-l border-indigo-50" onClick={e => e.stopPropagation()}>
                           {/* Individual Dropdown (Opsional, mengambil list dari targetKelasList yang sedang aktif di toolbar) */}
                           {targetKelasList.length > 0 ? (
                             <select 
                               className={`w-full p-2.5 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                                 placements[s.nis] ? 'border-indigo-300 bg-indigo-50 text-indigo-800 shadow-inner' : 'border-gray-300 bg-white text-gray-700'
                               }`}
                               value={placements[s.nis] || ''}
                               onChange={(e) => handleIndividualPlacement(s.nis, e.target.value)}
                             >
                               <option value="">- Belum Ditentukan -</option>
                               {targetKelasList.map(k => <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>)}
                             </select>
                           ) : (
                             <div className="text-xs text-gray-400 italic bg-white p-2.5 border rounded-lg text-center">
                               {placements[s.nis] ? <span className="font-bold text-indigo-700 not-italic">{placements[s.nis]}</span> : "Pilih Marhalah Baru di atas"}
                             </div>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FLOATING ACTION BAR MANUAL MODE */}
          {totalPlacementsReady > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[400px] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm">
                  {totalPlacementsReady}
                </div>
                <span className="font-semibold text-sm">Santri siap dinaikkan</span>
              </div>
              <button 
                onClick={handleProcessManual}
                disabled={isProcessing}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-emerald-500/20"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
                <span>Simpan Kenaikan</span>
              </button>
            </div>
          )}

        </div>
      )}

      {/* ================================================================= */}
      {/* MODE EXCEL (LEGACY YANG SUDAH DIUPGRADE) */}
      {/* ================================================================= */}
      {mode === 'EXCEL' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LANGKAH 1: DOWNLOAD */}
            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-4">
              <div className="flex items-center gap-3 text-emerald-800 font-bold text-lg mb-2">
                <span className="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">1</span>
                Download Template Excel
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Marhalah (Wajib)</label>
                  <select 
                    className="w-full p-3 border border-emerald-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
                    value={selectedMarhalah}
                    onChange={(e) => setSelectedMarhalah(e.target.value)}
                  >
                    <option value="">-- Pilih Marhalah --</option>
                    {marhalahList.map(m => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Kelas (Opsional)</label>
                  <select 
                    className="w-full p-3 border border-emerald-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm disabled:bg-gray-100 disabled:opacity-50"
                    value={selectedKelas}
                    onChange={(e) => setSelectedKelas(e.target.value)}
                    disabled={!selectedMarhalah}
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleDownload}
                disabled={!selectedMarhalah || isDownloading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] font-bold mt-2"
              >
                {isDownloading ? <Loader2 className="animate-spin w-5 h-5"/> : <Download className="w-5 h-5"/>}
                Download Data Santri (.xlsx)
              </button>
            </div>

            {/* LANGKAH 2: UPLOAD */}
            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
              <div className="flex items-center gap-3 text-blue-800 font-bold text-lg mb-2">
                <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">2</span>
                Upload Hasil Penempatan
              </div>

              <div className="border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center bg-white hover:bg-blue-50 transition-colors relative h-36 flex flex-col justify-center items-center group">
                <input 
                  id="file-upload"
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-blue-500 mb-2 group-hover:scale-110 transition-transform"/>
                <p className="text-sm text-blue-800 font-bold">Klik / Drag file Excel ke sini</p>
              </div>

              {excelData.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-blue-200 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
                  <div className="flex justify-between items-center mb-3 border-b border-blue-50 pb-2">
                    <span className="text-sm font-bold text-gray-700">Preview: {excelData.length} Baris Terbaca</span>
                    <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Siap diproses</span>
                  </div>
                  
                  <button 
                    onClick={triggerProcess}
                    disabled={isProcessing}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 font-bold shadow-md transition-transform active:scale-[0.98]"
                  >
                    {isProcessing ? "Memproses..." : <><CheckCircle className="w-5 h-5"/> Eksekusi Kenaikan Kelas</>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* PREVIEW TABLE EXCEL */}
          {excelData.length > 0 && (
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm mt-8 animate-in fade-in">
              <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600"/> Preview Keputusan Kenaikan (Excel)
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 font-semibold text-gray-600 border-b">NIS</th>
                      <th className="p-4 font-semibold text-gray-600 border-b">Nama Santri</th>
                      <th className="p-4 font-semibold text-gray-600 border-b">Kelas Asal</th>
                      <th className="p-4 font-semibold text-gray-600 border-b text-center">Grade<br/>Wali Kelas</th>
                      <th className="p-4 bg-indigo-50 text-center border-b border-l border-indigo-100 font-bold text-indigo-900">Target Kelas Baru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {excelData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-xs text-gray-500">{row['NIS'] || row['nis']}</td>
                        <td className="p-4 font-bold text-gray-800">{row['NAMA SANTRI']}</td>
                        <td className="p-4 text-gray-600 text-sm font-medium">{row['KELAS SEKARANG']}</td>
                        
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            String(row['HASIL GRADING']).includes('A') ? 'bg-green-100 text-green-700' :
                            String(row['HASIL GRADING']).includes('B') ? 'bg-blue-100 text-blue-700' :
                            String(row['HASIL GRADING']).includes('C') ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {row['HASIL GRADING'] || '-'}
                          </span>
                        </td>

                        <td className="p-4 text-center font-black text-indigo-700 bg-indigo-50/30 border-l border-indigo-100">
                          {row['TARGET KELAS'] || <span className="text-red-400 italic font-medium text-xs normal-case">Tidak Diproses</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelData.length > 50 && (
                  <div className="p-4 text-center text-xs font-bold text-gray-500 bg-gray-50 border-t shadow-inner">
                    ... dan {excelData.length - 50} santri lainnya
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- CUSTOM MODAL CONFIRMATION (EXCEL) --- */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <AlertTriangle className="w-10 h-10"/>
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">Konfirmasi Finalisasi</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Sistem akan memproses kenaikan kelas untuk <b>{excelData.length} santri</b>. <br/><br/>
                Data riwayat akademik di kelas lama akan <b className="text-amber-600">diarsipkan secara permanen</b> dan santri akan dipindahkan ke kelas target.
                <br/><br/>
                <span className="font-bold text-red-500">Apakah Anda sudah yakin?</span>
              </p>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleProcessExcel}
                  className="py-3 px-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  Ya, Eksekusi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}