'use client'

import { useState } from 'react'
// HAPUS IMPORT XLSX STATIS
import { Upload, Download, Save, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { importSantriMassal } from './actions'
import { toast } from 'sonner' 

export default function InputSantriPage() {
  const router = useRouter()
  const [excelData, setExcelData] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  const downloadTemplate = async () => {
    // DYNAMIC IMPORT: Load library hanya saat tombol diklik
    const XLSX = await import('xlsx')
    
    const headers = [
      { 
        nis: "12345", 
        nama_lengkap: "Ahmad Fulan", 
        nik: "3201012010100001", 
        jenis_kelamin: "L", 
        tempat_lahir: "Tasikmalaya", 
        tanggal_lahir: "2010-01-01", 
        nama_ayah: "H. Budi", 
        nama_ibu: "Siti Aminah", 
        alamat: "Kp. Sukahideng RT 01/02",
        sekolah: "MTSU", 
        kelas_sekolah: "7 A",
        asrama: "AL-FALAH", 
        kamar: "12"
      }
    ]
    const worksheet = XLSX.utils.json_to_sheet(headers)
    
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 5 }, { wch: 15 }, 
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, 
      { wch: 10 }, { wch: 15 }, { wch: 8 }
    ];

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Data Santri")
    XLSX.writeFile(workbook, "Template_Santri_Full.xlsx")
    
    toast.success("Template berhasil didownload")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const loadingToast = toast.loading("Membaca file Excel...")
    
    // DYNAMIC IMPORT
    const XLSX = await import('xlsx')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        
        const rawData = XLSX.utils.sheet_to_json(ws)
        const cleanData = JSON.parse(JSON.stringify(rawData))
        
        setExcelData(cleanData)
        toast.dismiss(loadingToast)
        toast.success(`Berhasil membaca ${cleanData.length} baris data`)
      } catch (err) {
        toast.dismiss(loadingToast)
        toast.error("Gagal membaca file Excel. Pastikan format benar.")
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSave = async () => {
    if (excelData.length === 0) {
        toast.warning("Data kosong, silakan upload Excel dulu.")
        return
    }

    const loadingToast = toast.loading("Sedang menyimpan data santri...")
    setIsSaving(true)

    const result = await importSantriMassal(excelData)

    setIsSaving(false)
    toast.dismiss(loadingToast)

    if (result?.error) {
      toast.error("Gagal menyimpan data", {
        description: result.error,
        duration: 5000 
      })
    } else {
      toast.success("Alhamdulillah!", {
        description: "Data santri berhasil diimport ke database."
      })
      router.push('/dashboard/santri')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      <div className="flex items-center gap-4">
        <Link href="/dashboard/santri" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Import Data Santri</h1>
          <p className="text-gray-500 text-sm">Termasuk data Sekolah, Asrama, dan Kamar.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        
        {/* STEP 1 */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-full">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Langkah 1: Download Template Lengkap</h3>
            <p className="text-sm text-blue-700 mb-3">
              Format telah disesuaikan (Termasuk Asrama & Kamar).
            </p>
            <button 
              onClick={downloadTemplate}
              className="text-sm bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors font-medium shadow-sm"
            >
              Download Template.xlsx
            </button>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Langkah 2: Upload File Excel
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors relative group">
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center group-hover:scale-105 transition-transform">
              <Upload className="w-10 h-10 text-gray-400 mb-3 group-hover:text-blue-500" />
              <p className="text-sm text-gray-600 font-medium">Klik untuk upload file Excel</p>
              <p className="text-xs text-gray-400 mt-1">Format: .xlsx</p>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        {excelData.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Preview Data ({excelData.length} Santri)
              </h3>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> <span>Simpan Semua</span>
                  </>
                )}
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 border-b">NIS</th>
                      <th className="px-4 py-3 border-b">Nama Lengkap</th>
                      <th className="px-4 py-3 border-b">L/P</th>
                      <th className="px-4 py-3 border-b">Sekolah</th>
                      <th className="px-4 py-3 border-b">Asrama</th>
                      <th className="px-4 py-3 border-b">Kamar</th>
                      <th className="px-4 py-3 border-b">Ayah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {excelData.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.nis}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{row.nama_lengkap}</td>
                        <td className="px-4 py-2 text-center">{row.jenis_kelamin}</td>
                        <td className="px-4 py-2 font-bold text-blue-700">{row.sekolah} - {row.kelas_sekolah}</td>
                        <td className="px-4 py-2 text-center bg-green-50 text-green-800 font-medium">{row.asrama}</td>
                        <td className="px-4 py-2 text-center bg-green-50 text-green-800 font-bold">{row.kamar}</td>
                        <td className="px-4 py-2">{row.nama_ayah}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelData.length > 50 && (
                <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t sticky bottom-0">
                  ... dan {excelData.length - 50} data lainnya
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}