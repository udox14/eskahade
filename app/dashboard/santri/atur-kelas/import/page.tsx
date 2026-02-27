'use client'

import { useState } from 'react'
import { Upload, Download, Save, AlertTriangle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importPenempatanKelas } from './actions'
import { toast } from 'sonner'

export default function ImportKelasPage() {
  const router = useRouter()
  const [excelData, setExcelData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const downloadTemplate = async () => {
    const loadToast = toast.loading("Menyiapkan template...")
    const XLSX = await import('xlsx')

    const headers = [
      { nis: "12345", nama_kelas: "1-A" },
      { nis: "12346", nama_kelas: "1-B" }
    ]
    const worksheet = XLSX.utils.json_to_sheet(headers)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Kelas")
    XLSX.writeFile(workbook, "Template_Penempatan_Kelas.xlsx")

    toast.dismiss(loadToast)
    toast.success("Template berhasil didownload")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const loadToast = toast.loading("Membaca file...")
    const XLSX = await import('xlsx')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        setExcelData(XLSX.utils.sheet_to_json(ws))
        toast.dismiss(loadToast)
        toast.success("File berhasil dibaca")
      } catch (error) {
        toast.dismiss(loadToast)
        toast.error("File Excel tidak valid")
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpan = async () => {
    if (excelData.length === 0) return
    if (!confirm(`Yakin memproses penempatan untuk ${excelData.length} santri?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses penempatan...")
    
    const res = await importPenempatanKelas(excelData)
    
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Sukses!", { description: `Berhasil menempatkan ${res.count} santri ke kelasnya.` })
      setExcelData([])
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Import Batch Penempatan Kelas</h1>
          <p className="text-gray-500 text-sm">Upload hasil rapat pembagian kelas (Excel).</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        {/* Step 1 */}
        <div className="mb-6 bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-100">
          <div>
            <h3 className="font-semibold text-blue-900">1. Download Template</h3>
            <p className="text-sm text-blue-700">Hanya butuh 2 kolom: NIS dan Nama Kelas.</p>
          </div>
          <button onClick={downloadTemplate} className="bg-white text-blue-700 px-3 py-2 rounded border border-blue-200 text-sm font-medium flex items-center gap-2 hover:bg-blue-50 transition-colors">
            <Download className="w-4 h-4" /> Template.xlsx
          </button>
        </div>

        {/* Step 2 */}
        <div className="mb-6 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative hover:bg-gray-50 transition-colors">
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Klik untuk upload Excel hasil rapat</p>
        </div>

        {/* Step 3: Preview */}
        {excelData.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600"/> Preview ({excelData.length} Data)
              </h3>
              <button onClick={handleSimpan} disabled={isProcessing} className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 font-bold shadow-sm">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                {isProcessing ? "Memproses..." : "Eksekusi Penempatan"}
              </button>
            </div>
            <div className="bg-gray-50 p-0 rounded-lg h-64 overflow-y-auto border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                  <tr><th className="py-2 px-4 border-b">NIS</th><th className="py-2 px-4 border-b">Target Kelas</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {excelData.map((row, i) => (
                    <tr key={i} className="bg-white hover:bg-gray-50">
                      <td className="py-2 px-4 font-mono text-xs">{row.nis}</td>
                      <td className="py-2 px-4 font-medium">{row.nama_kelas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}