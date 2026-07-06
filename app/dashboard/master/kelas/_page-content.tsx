'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getKelasList, tambahKelas, hapusKelas, importKelasMassal, getTahunAjaranAktif, getTahunAjaranList, copyKelasFromTahunAjaran, updateKelasRuanganFields } from './actions'
import { Trash2, Plus, FileSpreadsheet, Upload, Save, Download, List, Loader2, CalendarDays, AlertTriangle, Printer, Copy, X, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function MasterKelasPage() {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState<number | ''>('')
  const [isCopying, setIsCopying] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Record<string, { tempat: string; grade: string; baru_lama: string; jenis_kelamin: string }>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, k, ta, tal] = await Promise.all([getMarhalahList(), getKelasList(), getTahunAjaranAktif(), getTahunAjaranList()])
    setMarhalahList(m)
    setKelasList(k)
    setTahunAktif(ta)
    setTahunAjaranList(tal)
    setLoading(false)
  }

  const enterEditMode = () => {
    const init: Record<string, { tempat: string; grade: string; baru_lama: string; jenis_kelamin: string }> = {}
    kelasList.forEach((k: any) => {
      init[k.id] = { tempat: k.tempat || '', grade: k.grade || '', baru_lama: k.baru_lama || '', jenis_kelamin: k.jenis_kelamin || 'L' }
    })
    setEditData(init)
    setDirtyIds(new Set())
    setEditMode(true)
  }

  const cancelEditMode = () => {
    setEditMode(false)
    setEditData({})
    setDirtyIds(new Set())
  }

  const handleFieldChange = (kelasId: string, field: string, value: string) => {
    setEditData(prev => ({ ...prev, [kelasId]: { ...prev[kelasId], [field]: value } }))
    setDirtyIds(prev => new Set(prev).add(kelasId))
  }

  const handleSaveChanges = async () => {
    if (dirtyIds.size === 0) { setEditMode(false); return }
    setIsSaving(true)
    const toastId = toast.loading(`Menyimpan ${dirtyIds.size} perubahan...`)
    const results = await Promise.all(
      Array.from(dirtyIds).map(id => updateKelasRuanganFields(id, editData[id]))
    )
    toast.dismiss(toastId)
    const errors = results.filter((r: any) => 'error' in r)
    if (errors.length > 0) {
      toast.error(`${errors.length} data gagal disimpan`)
    } else {
      toast.success(`${dirtyIds.size} kelas berhasil diperbarui`)
    }
    setIsSaving(false)
    setEditMode(false)
    setDirtyIds(new Set())
    loadData()
  }

  const handleCopyKelas = async () => {
    if (copySourceId === '') return toast.error('Pilih tahun ajaran sumber terlebih dahulu')
    setIsCopying(true)
    const res = await copyKelasFromTahunAjaran(copySourceId as number)
    setIsCopying(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.count} kelas disalin${res.skipped > 0 ? `, ${res.skipped} dilewati (sudah ada)` : ''}`)
    setCopyModalOpen(false)
    setCopySourceId('')
    loadData()
  }

  const handleTambahManual = async (formData: FormData) => {
    const toastId = toast.loading("Menambahkan kelas...")
    const res = await tambahKelas(formData)
    toast.dismiss(toastId)
    if ('error' in res) toast.error(res.error)
    else {
      toast.success("Kelas berhasil ditambahkan")
      loadData()
      const form = document.getElementById('form-manual') as HTMLFormElement
      if (form) form.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if(!await confirm("Hapus kelas ini?")) return
    const toastId = toast.loading("Menghapus...")
    const res = await hapusKelas(id)
    toast.dismiss(toastId)
    if ('error' in res) toast.error("Gagal", { description: res.error })
    else {
      toast.success("Kelas dihapus")
      loadData()
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA KELAS": "1-A", "MARHALAH": "Ibtidaiyyah 1", "TEMPAT": "Gedung Barat", "GRADE": "A", "B/L": "BARU", "JENIS KELAMIN": "L" },
      { "NAMA KELAS": "1-B", "MARHALAH": "Ibtidaiyyah 1", "TEMPAT": "Gedung Timur", "GRADE": "B", "B/L": "LAMA", "JENIS KELAMIN": "P" },
      { "NAMA KELAS": "2-A", "MARHALAH": "Ibtidaiyyah 2", "TEMPAT": "Aula Lama", "GRADE": "AB", "B/L": "BARU DAN LAMA (CAMPURAN)", "JENIS KELAMIN": "C" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:20}, {wch:20}, {wch:10}, {wch:10}, {wch:10}]
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
    if ('error' in res) toast.error("Gagal Import", { description: res.error })
    else {
      toast.success(`Sukses! ${(res as any).count} kelas ditambahkan.`)
      setExcelData([])
      loadData()
      setMode('manual')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Manajemen Kelas & Ruangan"
          description="Atur struktur kelas per tahun ajaran."
          action={(
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCopyModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                Copy dari Tahun Lalu
              </button>
              <Link
                href="/dashboard/master/kelas/tempelan"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Cetak Tempelan
              </Link>
            </div>
          )}
          className="flex-1"
        />
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             <List className="w-4 h-4"/> Daftar & Manual
           </button>
           <button onClick={() => setMode('excel')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'excel' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             <FileSpreadsheet className="w-4 h-4"/> Import Excel
           </button>
        </div>
      </div>

      {/* BANNER TAHUN AJARAN */}
      {!loading && (tahunAktif ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">
            Tahun ajaran aktif: <span className="font-bold">{tahunAktif.nama}</span>
            <span className="text-green-600"> — Kelas baru otomatis masuk ke tahun ini.</span>
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Belum ada tahun ajaran aktif!</p>
            <p className="text-xs text-amber-700 mt-0.5">Kelas tidak bisa ditambahkan sebelum tahun ajaran diaktifkan.</p>
            <Link href="/dashboard/pengaturan/tahun-ajaran" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-800 underline hover:text-amber-900">
              <CalendarDays className="w-3.5 h-3.5" /> Atur Tahun Ajaran →
            </Link>
          </div>
        </div>
      ))}

      {mode === 'manual' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">Tambah Kelas Satuan</h3>
            <form id="form-manual" action={handleTambahManual} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tingkat (Marhalah)</label>
                <select name="marhalah_id" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {marhalahList?.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nama Kelas (Ex: 1-B)</label>
                <input type="text" name="nama_kelas" required placeholder="Contoh: 1-14" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tempat</label>
                <input type="text" name="tempat" placeholder="Contoh: Gedung Barat" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Grade (Komposisi)</label>
                <select name="grade" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="">- Pilih -</option>
                  <option value="A">A (hanya A)</option>
                  <option value="AB">AB (A & B)</option>
                  <option value="ABC">ABC (campur semua)</option>
                  <option value="B">B (hanya B)</option>
                  <option value="BC">BC (B & C)</option>
                  <option value="C">C (hanya C)</option>
                </select>
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">B/L (Baru/Lama)</label>
                <select name="baru_lama" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="">- Pilih -</option>
                  <option value="BARU">BARU</option>
                  <option value="LAMA">LAMA</option>
                  <option value="BARU DAN LAMA (CAMPURAN)">BARU DAN LAMA (CAMPURAN)</option>
                </select>
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Jenis Kelamin</label>
                <select name="jenis_kelamin" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="L">Putra (L)</option><option value="P">Putri (P)</option><option value="C">Campuran (L & P)</option>
                </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold text-sm shadow-sm">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span>Daftar Kelas Tersedia</span>
                <span className="bg-white border px-2 py-0.5 rounded text-slate-600">{kelasList.length} Rombel</span>
              </div>
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    {dirtyIds.size > 0 && (
                      <span className="text-amber-600 normal-case font-medium">{dirtyIds.size} perubahan</span>
                    )}
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 normal-case"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Simpan
                    </button>
                    <button
                      onClick={cancelEditMode}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 normal-case"
                    >
                      <X className="w-3.5 h-3.5" /> Batal
                    </button>
                  </>
                ) : (
                  <button
                    onClick={enterEditMode}
                    className="inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 normal-case"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Ruangan
                  </button>
                )}
              </div>
            </div>
            {editMode && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-700 flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
                Mode edit aktif — Tempat, Grade, B/L, dan L/P bisa diedit langsung di tabel.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm text-left">
                <thead className="bg-white text-slate-600 font-bold border-b">
                  <tr><th className="px-6 py-3">Nama Kelas</th><th className="px-6 py-3">Tingkat</th><th className="px-6 py-3">Tempat</th><th className="px-6 py-3">Grade</th><th className="px-6 py-3">B/L</th><th className="px-6 py-3">L/P</th><th className="px-6 py-3 text-right">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kelasList?.map((k) => {
                    const row = editData[k.id]
                    const isDirty = dirtyIds.has(k.id)
                    return (
                      <tr key={k.id} className={`transition-colors ${isDirty ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-3 font-medium text-slate-800">{k.nama_kelas}</td>
                        <td className="px-6 py-3 text-slate-500">{k.marhalah_nama || '-'}</td>
                        <td className="px-4 py-2">
                          {editMode && row ? (
                            <input
                              type="text"
                              value={row.tempat}
                              onChange={e => handleFieldChange(k.id, 'tempat', e.target.value)}
                              placeholder="Tempat..."
                              className="w-full min-w-[120px] px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                          ) : (
                            <span className="text-slate-500">{k.tempat || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editMode && row ? (
                            <select
                              value={row.grade}
                              onChange={e => handleFieldChange(k.id, 'grade', e.target.value)}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                            >
                              <option value="">-</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="AB">AB</option>
                              <option value="BC">BC</option>
                              <option value="ABC">ABC</option>
                            </select>
                          ) : (
                            <span className="text-slate-500 font-semibold">{k.grade || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editMode && row ? (
                            <select
                              value={row.baru_lama}
                              onChange={e => handleFieldChange(k.id, 'baru_lama', e.target.value)}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                            >
                              <option value="">-</option>
                              <option value="BARU">BARU</option>
                              <option value="LAMA">LAMA</option>
                              <option value="BARU DAN LAMA (CAMPURAN)">BARU DAN LAMA (CAMPURAN)</option>
                            </select>
                          ) : (
                            <span className="text-slate-500 font-semibold">{k.baru_lama || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editMode && row ? (
                            <select
                              value={row.jenis_kelamin}
                              onChange={e => handleFieldChange(k.id, 'jenis_kelamin', e.target.value)}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                            >
                              <option value="L">L (Putra)</option>
                              <option value="P">P (Putri)</option>
                              <option value="C">C (Campur)</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${k.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : k.jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>{k.jenis_kelamin === 'C' ? 'CAMPURAN' : k.jenis_kelamin === 'L' ? 'PUTRA' : 'PUTRI'}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {!editMode && (
                            <button onClick={() => handleHapus(k.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
                   <div className="relative"><input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/><button className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-green-700">Pilih File Excel</button></div>
                </div>
            </div>
            {excelData.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Preview ({excelData.length} Kelas)</h3>
                        <button onClick={handleSimpanExcel} disabled={isProcessing} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-green-800 disabled:opacity-50 flex items-center gap-2">
                           {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Simpan Semua
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto">
                        <table className="min-w-[720px] w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600 font-bold sticky top-0"><tr><th className="px-4 py-2">Nama Kelas</th><th className="px-4 py-2">Marhalah</th><th className="px-4 py-2">Tempat</th><th className="px-4 py-2">Grade</th><th className="px-4 py-2">B/L</th><th className="px-4 py-2">L/P</th></tr></thead><tbody className="divide-y">{excelData.map((row, i) => (<tr key={i}><td className="px-4 py-2">{row['NAMA KELAS'] || row['nama kelas']}</td><td className="px-4 py-2">{row['MARHALAH'] || row['marhalah']}</td><td className="px-4 py-2">{row['TEMPAT'] || row['tempat'] || '-'}</td><td className="px-4 py-2 font-semibold">{row['GRADE'] || row['grade'] || '-'}</td><td className="px-4 py-2 font-semibold">{row['B/L'] || row['BARU/LAMA'] || row['baru/lama'] || row['baru_lama'] || '-'}</td><td className="px-4 py-2">{row['JENIS KELAMIN'] || row['jenis kelamin']}</td></tr>))}</tbody></table>
                    </div>
                </div>
            )}
         </div>
      )}

      {copyModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Copy Kelas dari Tahun Lalu</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kelas yang namanya sudah ada di tahun ini akan dilewati.</p>
              </div>
              <button onClick={() => setCopyModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Pilih Tahun Ajaran Sumber</label>
                <select
                  value={copySourceId}
                  onChange={e => setCopySourceId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-blue-500"
                >
                  <option value="">-- Pilih Tahun Ajaran --</option>
                  {tahunAjaranList.filter((t: any) => t.id !== tahunAktif?.id).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.nama}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setCopyModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <button onClick={handleCopyKelas} disabled={isCopying} className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {isCopying ? <Loader2 className="w-4 h-4 animate-spin"/> : <Copy className="w-4 h-4"/>} Copy Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
