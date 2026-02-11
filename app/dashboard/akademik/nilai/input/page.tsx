'use client'

import { useState, useEffect } from 'react'
import { Upload, Download, Save, AlertCircle, FileSpreadsheet, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getReferensiData, getDataSantriPerKelas, simpanNilaiSemuaMapel } from './actions'
import { toast } from 'sonner'

// Definisi TypeScript untuk window
declare global {
  interface Window {
    XLSX: any;
  }
}

export default function InputNilaiPage() {
  const [refData, setRefData] = useState<{ mapel: any[], kelas: any[] }>({ mapel: [], kelas: [] })
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  
  const [excelData, setExcelData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    getReferensiData().then((data) => {
      setRefData({
        mapel: data.mapel || [],
        kelas: data.kelas || []
      })
    })
  }, [])

  const handleDownloadTemplate = async () => {
    if (!selectedKelas) {
      toast.warning("Mohon pilih Kelas terlebih dahulu.")
      return
    }

    if (!window.XLSX) {
      toast.error("Library Excel belum siap.")
      return
    }
    
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan template...")

    const santriList = await getDataSantriPerKelas(selectedKelas)
    
    if (santriList.length === 0) {
      toast.dismiss(loadToast)
      toast.error("Gagal Download", { description: "Kelas ini belum memiliki santri." })
      setIsDownloading(false)
      return
    }

    const namaKelas = refData.kelas.find(k => k.id == selectedKelas)?.nama_kelas

    const dataRows = santriList.map(s => {
      const row: any = {
        NIS: s.nis,
        "NAMA SANTRI": s.nama,
      }
      refData.mapel.forEach(m => {
        row[m.nama.toUpperCase()] = "" 
      })
      return row
    })

    const worksheet = window.XLSX.utils.json_to_sheet(dataRows)
    
    const wscols = [{ wch: 15 }, { wch: 35 }]
    refData.mapel.forEach(() => wscols.push({ wch: 15 }))
    worksheet['!cols'] = wscols

    const workbook = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Nilai Lengkap")
    
    window.XLSX.writeFile(workbook, `Template_Nilai_${namaKelas}_Lengkap.xlsx`)
    
    toast.dismiss(loadToast)
    toast.success("Template berhasil didownload")
    setIsDownloading(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!window.XLSX) {
      toast.error("Library Excel belum siap.")
      return
    }

    const loadToast = toast.loading("Membaca file Excel...")

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = window.XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = window.XLSX.utils.sheet_to_json(ws)
        
        setExcelData(rawData)
        toast.dismiss(loadToast)
        toast.success(`Berhasil membaca ${rawData.length} baris data`)
      } catch (err) {
        toast.dismiss(loadToast)
        toast.error("Format file tidak valid")
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpan = async () => {
    if (!selectedKelas) {
      toast.error("Silakan pilih kelas target.")
      return
    }
    if (excelData.length === 0) {
      toast.warning("Belum ada data Excel yang diupload.")
      return
    }

    setLoading(true)
    const loadToast = toast.loading("Menyimpan nilai ke database...")
    
    const res = await simpanNilaiSemuaMapel(
      selectedKelas,
      Number(selectedSemester),
      excelData,
      refData.mapel
    )
    
    setLoading(false)
    toast.dismiss(loadToast)

    if (res?.error) {
      toast.error("Gagal Menyimpan", {
        description: res.error,
        duration: 5000 
      })
    } else {
      toast.success("Sukses!", {
        description: `Berhasil menyimpan ${res.count} nilai santri.`
      })
      setExcelData([])
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/akademik" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Input Nilai Akademik</h1>
          <p className="text-gray-500 text-sm">Download template per kelas, isi nilai, lalu upload kembali.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800 border-b pb-2">1. Pilih Konteks</h3>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Semester</label>
              <select 
                className="w-full p-2 border rounded-md bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Kelas</label>
              <select 
                className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
              >
                <option value="">-- Pilih Kelas --</option>
                {refData.kelas.map((k: any) => (
                  <option key={k.id} value={k.id}>{k.nama_kelas} ({k.marhalah?.nama})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2">2. Download Template</h3>
            <p className="text-xs text-blue-700 mb-4">
              File Excel akan otomatis memiliki kolom: <b>{refData.mapel.slice(0, 3).map(m => m.nama).join(', ')}, dll.</b>
            </p>
            <button 
              onClick={handleDownloadTemplate}
              disabled={isDownloading || !selectedKelas}
              className="w-full bg-white text-blue-700 border border-blue-200 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-100 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4" />}
              {isDownloading ? "Generating..." : "Download Excel Lengkap"}
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
            <h3 className="font-semibold text-gray-800 mb-4 text-left">3. Upload Excel yang Sudah Diisi</h3>
            <div className={`border-2 border-dashed rounded-lg p-8 transition-colors relative ${!selectedKelas ? 'bg-gray-100 border-gray-300' : 'border-blue-300 bg-blue-50/30 hover:bg-blue-50'}`}>
              <input 
                id="file-upload"
                type="file" 
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={!selectedKelas} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${!selectedKelas ? 'text-gray-400' : 'text-blue-500'}`} />
              <p className={`font-medium ${!selectedKelas ? 'text-gray-400' : 'text-gray-700'}`}>
                {!selectedKelas ? "Pilih kelas di sebelah kiri dulu" : "Klik untuk upload file nilai"}
              </p>
            </div>
          </div>

          {excelData.length > 0 && (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Preview Data ({excelData.length} Santri)
                </h3>
                <button 
                  onClick={handleSimpan}
                  disabled={loading}
                  className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-green-800 disabled:opacity-50 shadow-sm transition-transform active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                  Simpan Semua
                </button>
              </div>
              
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 border-b">NIS</th>
                      <th className="px-4 py-2 border-b">Nama Santri</th>
                      {refData.mapel.map(m => (
                        <th key={m.id} className="px-4 py-2 border-b text-center bg-gray-100 border-l border-gray-200">{m.nama}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {excelData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{row['NIS'] || row['nis']}</td>
                        <td className="px-4 py-2 font-medium">{row['NAMA SANTRI']}</td>
                        {refData.mapel.map(m => {
                          const val = row[m.nama.toUpperCase()]
                          const isInvalid = val !== undefined && val !== "" && (isNaN(Number(val)) || Number(val) > 100 || Number(val) < 0)
                          
                          return (
                            <td key={m.id} className={`px-4 py-2 text-center border-l ${isInvalid ? 'bg-red-100 text-red-700 font-bold' : ''}`}>
                              {val !== undefined && val !== "" ? val : "-"}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelData.length > 50 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
                    ... dan {excelData.length - 50} data lainnya
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}