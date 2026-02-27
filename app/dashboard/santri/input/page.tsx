'use client'

import { useState, useEffect } from 'react'
import { Upload, Download, Save, CheckCircle, ArrowLeft, Loader2, UserPlus, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importSantriMassal, tambahSantriSatuSatu, getKelasList } from './actions'
import { toast } from 'sonner'

declare global { interface Window { XLSX: any; } }

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "SADESA", "LAINNYA"]

const FORM_INIT = {
  nis: '', nama_lengkap: '', nik: '',
  jenis_kelamin: 'L' as 'L' | 'P',
  tempat_lahir: '', tanggal_lahir: '',
  nama_ayah: '', nama_ibu: '', alamat: '',
  sekolah: '', kelas_sekolah: '',
  asrama: '', kamar: '',
  kelas_pesantren: ''
}

export default function InputSantriPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'FORM' | 'EXCEL'>('FORM')

  // ── TAB FORM ──
  const [form, setForm] = useState(FORM_INIT)
  const [isSavingForm, setIsSavingForm] = useState(false)
  const [kelasList, setKelasList] = useState<{ id: string, nama_kelas: string }[]>([])

  // ── TAB EXCEL ──
  const [excelData, setExcelData] = useState<any[]>([])
  const [isSavingExcel, setIsSavingExcel] = useState(false)

  useEffect(() => {
    getKelasList().then(setKelasList)
  }, [])

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  // ── HANDLER FORM ──
  const handleSimpanForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nis || !form.nama_lengkap) return toast.warning("NIS dan Nama wajib diisi")
    setIsSavingForm(true)
    const toastId = toast.loading("Menyimpan...")
    const res = await tambahSantriSatuSatu(form)
    toast.dismiss(toastId)
    setIsSavingForm(false)
    if (res?.error) { toast.error("Gagal", { description: res.error }); return }
    toast.success("Santri berhasil ditambahkan!")
    setForm(FORM_INIT)
  }

  // ── HANDLER EXCEL ──
  const downloadTemplate = () => {
    if (!window.XLSX) return toast.error("Fitur Excel belum siap.")
    const headers = [{ nis: "12345", nama_lengkap: "Ahmad Fulan", nik: "3201", jenis_kelamin: "L", tempat_lahir: "Tasik", tanggal_lahir: "2010-01-01", nama_ayah: "Budi", alamat: "Sukarame", sekolah: "MTSN", kelas_sekolah: "7", asrama: "BAHAGIA", kamar: "1", kelas_pesantren: "1-A" }]
    const ws = window.XLSX.utils.json_to_sheet(headers)
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 15 }]
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, "Data")
    window.XLSX.writeFile(wb, "Template_Santri_Migrasi.xlsx")
    toast.success("Template didownload")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.XLSX) return toast.error("Fitur Excel belum siap.")
    const id = toast.loading("Membaca file...")
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = window.XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = window.XLSX.utils.sheet_to_json(ws)
        const clean = JSON.parse(JSON.stringify(raw)).map((row: any) => ({
          ...row, kelas_pesantren: row.kelas_pesantren || row['KELAS PESANTREN'] || row['kelas pesantren']
        }))
        setExcelData(clean)
        toast.dismiss(id)
        toast.success(`Berhasil membaca ${clean.length} baris data`)
      } catch { toast.dismiss(id); toast.error("Format file salah") }
    }
    reader.readAsBinaryString(file)
  }

  const handleSaveExcel = async () => {
    if (excelData.length === 0) return toast.warning("Data kosong")
    if (!confirm(`Import ${excelData.length} santri beserta kelasnya?`)) return
    setIsSavingExcel(true)
    const id = toast.loading("Menyimpan data...")
    const result = await importSantriMassal(excelData)
    setIsSavingExcel(false)
    toast.dismiss(id)
    if (result?.error) toast.error("Gagal", { description: result.error })
    else { toast.success("Berhasil!", { description: `Sukses import ${result.count} santri.` }); router.push('/dashboard/santri') }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Tambah Data Santri</h1>
          <p className="text-gray-500 text-sm">Input satu per satu atau sekaligus via Excel.</p>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('FORM')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'FORM' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <UserPlus className="w-4 h-4" /> Form Satu-Satu
        </button>
        <button onClick={() => setTab('EXCEL')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'EXCEL' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <FileSpreadsheet className="w-4 h-4" /> Import Excel (Massal)
        </button>
      </div>

      {/* ══ TAB FORM ══ */}
      {tab === 'FORM' && (
        <form onSubmit={handleSimpanForm} className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-left-2">

          {/* SEKSI: IDENTITAS */}
          <div className="px-6 pt-6 pb-4 border-b bg-blue-50/40">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide text-blue-800">Identitas Santri</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            {/* NIS */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">NIS <span className="text-red-500">*</span></label>
              <input value={form.nis} onChange={e => set('nis', e.target.value)} placeholder="Nomor Induk Santri" required className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Nama */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Lengkap <span className="text-red-500">*</span></label>
              <input value={form.nama_lengkap} onChange={e => set('nama_lengkap', e.target.value)} placeholder="Nama lengkap santri" required className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* NIK */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">NIK</label>
              <input value={form.nik} onChange={e => set('nik', e.target.value)} placeholder="Nomor Induk Kependudukan" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Jenis Kelamin */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Jenis Kelamin <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                {(['L', 'P'] as const).map(jk => (
                  <button type="button" key={jk} onClick={() => set('jenis_kelamin', jk)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${form.jenis_kelamin === jk ? (jk === 'L' ? 'bg-blue-600 text-white border-blue-600' : 'bg-pink-500 text-white border-pink-500') : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                    {jk === 'L' ? '👦 Laki-laki' : '👧 Perempuan'}
                  </button>
                ))}
              </div>
            </div>
            {/* Tempat Lahir */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tempat Lahir</label>
              <input value={form.tempat_lahir} onChange={e => set('tempat_lahir', e.target.value)} placeholder="Kota/Kabupaten" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Tanggal Lahir */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tanggal Lahir</label>
              <input type="date" value={form.tanggal_lahir} onChange={e => set('tanggal_lahir', e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Nama Ayah */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Ayah</label>
              <input value={form.nama_ayah} onChange={e => set('nama_ayah', e.target.value)} placeholder="Nama ayah kandung" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Nama Ibu */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Ibu</label>
              <input value={form.nama_ibu} onChange={e => set('nama_ibu', e.target.value)} placeholder="Nama ibu kandung" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {/* Alamat */}
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Alamat</label>
              <textarea value={form.alamat} onChange={e => set('alamat', e.target.value)} placeholder="Alamat lengkap" rows={2} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
          </div>

          {/* SEKSI: SEKOLAH */}
          <div className="px-6 pt-5 pb-4 border-b bg-green-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-green-800">Info Sekolah</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Sekolah</label>
              <select value={form.sekolah} onChange={e => set('sekolah', e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-400">
                <option value="">-- Pilih Sekolah --</option>
                {SEKOLAH_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kelas Sekolah</label>
              <input value={form.kelas_sekolah} onChange={e => set('kelas_sekolah', e.target.value)} placeholder="Contoh: 7A, 8B" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          {/* SEKSI: ASRAMA & PESANTREN */}
          <div className="px-6 pt-5 pb-4 border-b bg-purple-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-purple-800">Asrama & Kelas Pesantren</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Asrama</label>
              <select value={form.asrama} onChange={e => set('asrama', e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">-- Pilih Asrama --</option>
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kamar</label>
              <input value={form.kamar} onChange={e => set('kamar', e.target.value)} placeholder="Nomor kamar" className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kelas Pesantren</label>
              <select value={form.kelas_pesantren} onChange={e => set('kelas_pesantren', e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">-- Pilih Kelas --</option>
                {kelasList.map(k => <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>)}
              </select>
            </div>
          </div>

          {/* FOOTER TOMBOL */}
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button type="button" onClick={() => setForm(FORM_INIT)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
              Reset Form
            </button>
            <button type="submit" disabled={isSavingForm} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 shadow-sm">
              {isSavingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Santri
            </button>
          </div>
        </form>
      )}

      {/* ══ TAB EXCEL ══ */}
      {tab === 'EXCEL' && (
        <div className="bg-white border rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-right-2">
          {/* DOWNLOAD */}
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div>
              <p className="font-bold text-blue-900 text-sm">Langkah 1: Download Template</p>
              <p className="text-xs text-blue-600">Gunakan template ini untuk mengisi data santri + kelas.</p>
            </div>
            <button onClick={downloadTemplate} className="text-blue-600 bg-white border border-blue-200 px-4 py-2 rounded text-sm font-bold flex gap-2 hover:bg-blue-50">
              <Download className="w-4 h-4" /> Template Excel
            </button>
          </div>

          {/* UPLOAD */}
          <div className="border-2 border-dashed p-8 text-center relative hover:bg-gray-50 transition-colors rounded-lg">
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600 font-medium">Klik untuk upload Excel</p>
            <p className="text-xs text-gray-400 mt-1">Format .xlsx sesuai template</p>
          </div>

          {/* PREVIEW */}
          {excelData.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Preview Data ({excelData.length} baris)</h3>
                <button onClick={handleSaveExcel} disabled={isSavingExcel} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">
                  {isSavingExcel ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Simpan Semua
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
                        <td className="p-3 font-bold text-green-700 bg-green-50/30">{r.kelas_pesantren || <span className="text-gray-400 font-normal italic">Kosong</span>}</td>
                        <td className="p-3 text-gray-500">{r.asrama}</td>
                        <td className="p-3 text-blue-600">{r.sekolah}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelData.length > 50 && <p className="text-xs text-center text-gray-400">Menampilkan 50 baris pertama dari {excelData.length} total.</p>}
            </div>
          )}
        </div>
      )}

    </div>
  )
}