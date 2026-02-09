'use client'

import { useState, useEffect } from 'react'
// HAPUS IMPORT XLSX STATIS
import { getMarhalahList, getSantriByMarhalah, importKenaikanKelas } from './actions'
import { FileSpreadsheet, Upload, Save, Loader2, CheckCircle, AlertTriangle, Download, X, HelpCircle } from 'lucide-react'
import { toast } from 'sonner' 

export default function KenaikanKelasPage() {
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  
  const [excelData, setExcelData] = useState<any[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // State Modal Konfirmasi
  const [showConfirm, setShowConfirm] = useState(false)

  // Load Referensi Marhalah
  useEffect(() => {
    getMarhalahList().then(setMarhalahList)
  }, [])

  // FUNGSI 1: Download Template Santri per Marhalah
  const handleDownload = async () => {
    if (!selectedMarhalah) {
      toast.warning("Pilih Tingkat (Marhalah) terlebih dahulu.")
      return
    }
    
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan data santri...")

    const dataSantri = await getSantriByMarhalah(selectedMarhalah)
    
    if (dataSantri.length === 0) {
      toast.dismiss(loadToast)
      toast.error("Gagal Download", { description: "Tidak ada santri aktif di marhalah ini." })
      setIsDownloading(false)
      return
    }

    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    // Buat Struktur Excel
    const rows = dataSantri.map(s => ({
      NIS: s.nis,
      "NAMA SANTRI": s.nama,
      "KELAS SEKARANG": s.kelas_sekarang,
      "RATA-RATA": s.rata_rata,
      "PREDIKAT": s.predikat,
      "TARGET KELAS": "" // Kosong, wajib diisi admin (Misal: 2-A, 2-B)
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    // Lebarkan kolom
    worksheet['!cols'] = [{wch:15}, {wch:30}, {wch:15}, {wch:10}, {wch:15}, {wch:20}]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kenaikan")
    
    // Cari nama marhalah untuk nama file
    const namaMarhalah = marhalahList.find(m => m.id == selectedMarhalah)?.nama
    XLSX.writeFile(workbook, `Template_Kenaikan_${namaMarhalah}.xlsx`)
    
    toast.dismiss(loadToast)
    toast.success("Template berhasil didownload")
    setIsDownloading(false)
  }

  // FUNGSI 2: Upload Excel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const loadToast = toast.loading("Membaca file Excel...")

    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
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
    reader.readAsBinaryString(file)
  }

  // FUNGSI 3: Trigger Konfirmasi
  const triggerProcess = () => {
    if (excelData.length === 0) {
      toast.warning("Belum ada data Excel yang diupload.")
      return
    }
    setShowConfirm(true) // Tampilkan modal konfirmasi custom
  }

  // FUNGSI 4: Eksekusi Final
  const handleProcess = async () => {
    setShowConfirm(false)
    setIsProcessing(true)
    const loadToast = toast.loading("Memproses pemindahan kelas...")

    const res = await importKenaikanKelas(excelData)
    
    setIsProcessing(false)
    toast.dismiss(loadToast)

    if (res?.error) {
      toast.error("Terjadi Masalah", {
        description: res.error,
        duration: 8000 // Tampil lama biar terbaca
      })
    } else {
      toast.success("Kenaikan Kelas Berhasil!", {
        description: `Sukses memindahkan ${res.count} santri ke kelas baru.`
      })
      setExcelData([]) // Reset
      // Reset input file
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Proses Kenaikan Kelas (Per Marhalah)</h1>
        <p className="text-gray-500 text-sm">Download data santri satu angkatan, tentukan kelas tujuan di Excel, lalu upload kembali.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LANGKAH 1: DOWNLOAD */}
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
          <div className="flex items-center gap-2 text-blue-800 font-bold text-lg">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
            Download Template
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Tingkat Saat Ini (Asal)</label>
            <select 
              className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMarhalah}
              onChange={(e) => setSelectedMarhalah(e.target.value)}
            >
              <option value="">-- Pilih Marhalah --</option>
              {marhalahList.map(m => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleDownload}
            disabled={!selectedMarhalah || isDownloading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isDownloading ? <Loader2 className="animate-spin w-5 h-5"/> : <FileSpreadsheet className="w-5 h-5"/>}
            Download Data Santri (.xlsx)
          </button>
          
          <p className="text-xs text-blue-600 mt-2 bg-blue-100/50 p-2 rounded">
            * File Excel berisi: NIS, Nama, Kelas Sekarang, Nilai Rata-rata. <br/>
            * Tugas Anda: Isi kolom <b>"TARGET KELAS"</b> (Contoh: 2-A, 2-B).
          </p>
        </div>

        {/* LANGKAH 2: UPLOAD */}
        <div className="bg-green-50 p-6 rounded-xl border border-green-100 space-y-4">
          <div className="flex items-center gap-2 text-green-800 font-bold text-lg">
            <span className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
            Upload Hasil Penempatan
          </div>

          <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center bg-white hover:bg-green-50 transition-colors relative h-32 flex flex-col justify-center items-center group">
            <input 
              id="file-upload"
              type="file" 
              accept=".xlsx"
              onChange={handleUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-green-500 mb-2 group-hover:scale-110 transition-transform"/>
            <p className="text-sm text-gray-600 font-medium">Klik / Drag file Excel ke sini</p>
          </div>

          {excelData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-green-200 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">Preview: {excelData.length} Baris</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">Siap diproses</span>
              </div>
              
              <button 
                onClick={triggerProcess}
                disabled={isProcessing}
                className="w-full bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 font-bold shadow transition-transform active:scale-95"
              >
                {isProcessing ? "Memproses..." : <><CheckCircle className="w-4 h-4"/> Eksekusi Kenaikan</>}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* PREVIEW TABLE */}
      {excelData.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm mt-8 animate-in fade-in">
          <div className="p-4 bg-gray-50 border-b font-bold text-gray-700 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4"/> Preview Data Excel
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-3 font-semibold text-gray-600 border-b">NIS</th>
                  <th className="p-3 font-semibold text-gray-600 border-b">Nama Santri</th>
                  <th className="p-3 font-semibold text-gray-600 border-b">Kelas Asal</th>
                  <th className="p-3 bg-yellow-50 text-center border-b border-l border-yellow-200 font-bold text-yellow-800">Target Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {excelData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">{row['NIS'] || row['nis']}</td>
                    <td className="p-3 font-medium">{row['NAMA SANTRI']}</td>
                    <td className="p-3 text-gray-500">{row['KELAS SEKARANG']}</td>
                    <td className="p-3 text-center font-bold text-blue-700 bg-yellow-50/30 border-l border-yellow-100">
                      {row['TARGET KELAS'] || <span className="text-red-400 italic font-normal text-xs">Tidak Ada</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {excelData.length > 50 && (
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t">
                ... dan {excelData.length - 50} data lainnya
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CUSTOM MODAL CONFIRMATION (Pengganti window.confirm) --- */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8"/>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Konfirmasi Kenaikan</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Anda akan memproses kenaikan kelas untuk <b>{excelData.length} santri</b>. 
                Data riwayat lama akan diarsipkan dan santri akan masuk ke kelas baru sesuai Excel.
                <br/><br/>
                <span className="font-bold text-red-500">Tindakan ini tidak dapat dibatalkan dengan mudah.</span>
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleProcess}
                  className="py-2.5 px-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  Ya, Proses Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}