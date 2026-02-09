'use client'

import { useState } from 'react'
import { Upload, Download, Save, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { importSantriMassal } from './actions'
import { toast } from 'sonner' 

declare global { interface Window { XLSX: any; } }

export default function InputSantriPage() {
  const router = useRouter()
  const [excelData, setExcelData] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  const downloadTemplate = () => {
    if (!window.XLSX) return toast.error("Fitur Excel belum siap.")

    const headers = [
      { 
        nis: "12345", 
        nama_lengkap: "Ahmad Fulan", 
        nik: "3201", 
        jenis_kelamin: "L", 
        tempat_lahir: "Tasik", 
        tanggal_lahir: "2010-01-01", 
        nama_ayah: "Budi", 
        alamat: "Sukarame", 
        sekolah: "MTSN", 
        kelas_sekolah: "7", 
        asrama: "BAHAGIA", 
        kamar: "1",
        // KOLOM BARU
        kelas_pesantren: "1-A" 
      }
    ]
    const worksheet = window.XLSX.utils.json_to_sheet(headers)
    
    // Atur lebar
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 5 }, { wch: 10 }, 
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, 
      { wch: 15 }, { wch: 8 }, { wch: 15 }
    ];

    const workbook = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
    window.XLSX.writeFile(workbook, "Template_Santri_Migrasi.xlsx")
    toast.success("Template didownload")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.XLSX) return toast.error("Fitur Excel belum siap.")

    const loadingToast = toast.loading("Membaca file...")
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = window.XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = window.XLSX.utils.sheet_to_json(ws)
        
        // Normalisasi key (bisa jadi user nulis "KELAS PESANTREN" pake spasi)
        const cleanData = JSON.parse(JSON.stringify(rawData)).map((row: any) => ({
            ...row,
            kelas_pesantren: row.kelas_pesantren || row['KELAS PESANTREN'] || row['kelas pesantren']
        }))
        
        setExcelData(cleanData)
        toast.dismiss(loadingToast)
        toast.success(`Berhasil membaca ${cleanData.length} baris data`)
      } catch (err) { 
        toast.dismiss(loadingToast)
        toast.error("Format file salah") 
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSave = async () => {
    if (excelData.length === 0) return toast.warning("Data kosong")
    
    if (!confirm(`Import ${excelData.length} santri beserta kelasnya?`)) return

    setIsSaving(true)
    const loadingToast = toast.loading("Menyimpan data...")
    
    const result = await importSantriMassal(excelData)
    
    setIsSaving(false)
    toast.dismiss(loadingToast)

    if (result?.error) toast.error("Gagal", { description: result.error })
    else {
      toast.success("Berhasil!", { description: `Sukses import ${result.count} santri.` })
      router.push('/dashboard/santri')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/santri" className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-6 h-6"/></Link>
        <div>
           <h1 className="text-2xl font-bold">Import Data Santri (Migrasi)</h1>
           <p className="text-gray-500 text-sm">Upload data santri lengkap beserta kelas pesantrennya.</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        {/* DOWNLOAD */}
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
           <div>
              <p className="font-bold text-blue-900 text-sm">Langkah 1: Download Template</p>
              <p className="text-xs text-blue-600">Gunakan template ini untuk mengisi data santri + kelas.</p>
           </div>
           <button onClick={downloadTemplate} className="text-blue-600 bg-white border border-blue-200 px-4 py-2 rounded text-sm font-bold flex gap-2 hover:bg-blue-50">
             <Download className="w-4 h-4"/> Template Excel
           </button>
        </div>

        {/* UPLOAD */}
        <div className="border-2 border-dashed p-8 text-center relative hover:bg-gray-50 transition-colors">
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2"/>
            <p className="text-gray-600 font-medium">Klik untuk upload Excel</p>
        </div>

        {/* PREVIEW */}
        {excelData.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                   <h3 className="font-bold text-gray-700 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600"/> Preview Data</h3>
                   <button onClick={handleSave} disabled={isSaving} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">
                      {isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>} Simpan Semua
                   </button>
                </div>
                
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 sticky top-0 font-bold text-gray-600">
                            <tr>
                                <th className="p-3 border-b">NIS</th>
                                <th className="p-3 border-b">Nama</th>
                                <th className="p-3 border-b bg-green-50 text-green-800">Kelas Pesantren</th>
                                <th className="p-3 border-b">Asrama</th>
                                <th className="p-3 border-b">Sekolah</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {excelData.slice(0, 50).map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono text-xs">{r.nis}</td>
                                    <td className="p-3 font-medium">{r.nama_lengkap}</td>
                                    <td className="p-3 font-bold text-green-700 bg-green-50/30">
                                        {r.kelas_pesantren || <span className="text-gray-400 font-normal italic">Kosong</span>}
                                    </td>
                                    <td className="p-3 text-gray-500">{r.asrama}</td>
                                    <td className="p-3 text-blue-600">{r.sekolah}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-center text-gray-400">Menampilkan 50 baris pertama.</p>
            </div>
        )}
      </div>
    </div>
  )
}