'use client'

import React from 'react'

import { useState } from 'react'
import { Upload, Download, Save, AlertTriangle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importPenempatanKelas } from './actions'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { Button, ActionIcon } from '@mantine/core'

export default function ImportKelasPage() {
  const confirm = useConfirm()
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
    if (!await confirm(`Yakin memproses penempatan untuk ${excelData.length} santri?`)) return

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
    <div className="space-y-6 pb-20">
      <div className="flex items-start gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <ActionIcon onClick={() => router.back()} variant="subtle" color="gray" size="lg">
          <ArrowLeft className="w-5 h-5" />
        </ActionIcon>
        <DashboardPageHeader
          title="Import Batch Penempatan Kelas"
          description="Upload hasil rapat pembagian kelas dari Excel."
          className="flex-1"
        />
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        {/* Step 1 */}
        <div className="mb-6 bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-100">
          <div>
            <h3 className="font-semibold text-blue-900">1. Download Template</h3>
            <p className="text-sm text-blue-700">Hanya butuh 2 kolom: NIS dan Nama Kelas.</p>
          </div>
          <Button onClick={downloadTemplate} variant="default" size="xs" leftSection={<Download className="w-4 h-4" />}>
            Template.xlsx
          </Button>
        </div>

        {/* Step 2 */}
        <div className="mb-6 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center relative hover:bg-slate-50 transition-colors">
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-600">Klik untuk upload Excel hasil rapat</p>
        </div>

        {/* Step 3: Preview */}
        {excelData.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600"/> Preview ({excelData.length} Data)
              </h3>
              <Button onClick={handleSimpan} loading={isProcessing} color="green" leftSection={!isProcessing ? <Save className="w-4 h-4"/> : undefined}>
                Eksekusi Penempatan
              </Button>
            </div>
            <div className="bg-slate-50 p-0 rounded-lg h-64 overflow-y-auto border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                  <tr><th className="py-2 px-4 border-b">NIS</th><th className="py-2 px-4 border-b">Target Kelas</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {excelData.map((row, i) => (
                    <tr key={i} className="bg-white hover:bg-slate-50">
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
