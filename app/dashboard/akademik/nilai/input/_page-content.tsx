'use client'

import React, { useState, useEffect } from 'react'
import { 
  Upload, 
  Download, 
  Save, 
  AlertCircle, 
  FileSpreadsheet, 
  ArrowLeft, 
  CheckCircle, 
  Loader2, 
  UserCircle, 
  MessageSquare,
  BookOpen,
  LayoutGrid,
  FileText,
  X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { 
  getReferensiData, 
  getDataSantriPerKelas, 
  getDataNilaiPerMapel,
  getJudulKitabNilai,
  simpanNilaiPerMapel,
  simpanNilaiExcelMenyeluruh,
  getDataKepribadian,
  simpanKepribadian,
  getDataCatatanWali,
  simpanCatatanWali,
} from './actions'
import { KEPRIBADIAN_FIELDS } from './constants'
import { toast } from 'sonner'

type TabType = 'akademik' | 'kepribadian' | 'catatan'

export default function InputNilaiPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('akademik')
  
  const [refData, setRefData] = useState<{ mapel: any[], kelas: any[], marhalah: any[] }>({ mapel: [], kelas: [], marhalah: [] })
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedMapel, setSelectedMapel] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)

  // Data States (Lazy Loaded)
  const [akademikData, setAkademikData] = useState<any[]>([])
  const [kepribadianData, setKepribadianData] = useState<any[]>([])
  const [catatanData, setCatatanData] = useState<any[]>([])
  const [excelPreview, setExcelPreview] = useState<any[]>([])
  const [selectedKitabTitle, setSelectedKitabTitle] = useState('')
  const selectedMapelData = refData.mapel.find(m => m.id == selectedMapel)
  const selectedMapelTitle = selectedMapelData
    ? `${selectedMapelData.nama}${selectedKitabTitle ? ` - ${selectedKitabTitle}` : ''}`
    : ''

  const fetchRef = async () => {
    setIsInitializing(true)
    try {
      const data = await getReferensiData() as any
      if (data?.error) {
        throw new Error(data.error)
      }
      console.log('[InputNilai] refData received:', JSON.stringify({ mapelCount: data?.mapel?.length, kelasCount: data?.kelas?.length, marhalahCount: data?.marhalah?.length }))
      setRefData(data ?? { mapel: [], kelas: [], marhalah: [] })
    } catch (err: any) {
      console.error("Gagal memuat data referensi:", err)
      toast.error("Gagal memuat data referensi: " + (err?.message || 'Unknown error'))
      setRefData({ mapel: [], kelas: [], marhalah: [] })
    } finally {
      setIsInitializing(false)
    }
  }

  // Initial load referensi
  useEffect(() => {
    fetchRef()
  }, [])

  // Lazy Load Logic
  useEffect(() => {
    if (!selectedKelas) {
      setSelectedKitabTitle('')
      return
    }

    if (activeTab === 'akademik' && selectedMapel) {
      setLoading(true)
      setSelectedKitabTitle('')
      Promise.all([
        getDataNilaiPerMapel(selectedKelas, Number(selectedMapel), Number(selectedSemester)),
        getJudulKitabNilai(selectedKelas, Number(selectedMapel)),
      ])
        .then(([nilai, kitab]) => {
          setAkademikData(nilai)
          setSelectedKitabTitle(kitab)
        })
        .finally(() => setLoading(false))
    } else if (activeTab === 'kepribadian') {
      setSelectedKitabTitle('')
      setLoading(true)
      getDataKepribadian(selectedKelas, Number(selectedSemester))
        .then(setKepribadianData)
        .finally(() => setLoading(false))
    } else if (activeTab === 'catatan') {
      setSelectedKitabTitle('')
      setLoading(true)
      getDataCatatanWali(selectedKelas, Number(selectedSemester))
        .then(setCatatanData)
        .finally(() => setLoading(false))
    } else {
      setSelectedKitabTitle('')
    }
  }, [selectedKelas, selectedSemester, activeTab, selectedMapel])

  // --- EXCEL HANDLERS ---
  const handleDownloadTemplate = async () => {
    if (!selectedKelas) return toast.warning("Pilih Kelas terlebih dahulu.")
    
    setIsDownloading(true)
    const loadToast = toast.loading("Menyiapkan template komprehensif...")

    try {
      const santriList = await getDataSantriPerKelas(selectedKelas)
      if (santriList.length === 0) throw new Error("Kelas belum memiliki santri.")

      const namaKelas = refData.kelas.find(k => k.id == selectedKelas)?.nama_kelas

      const dataRows = santriList.map(s => {
        const row: any = { NIS: s.nis, "NAMA SANTRI": s.nama }
        // Kolom Mapel
        refData.mapel.forEach(m => { row[m.nama.toUpperCase()] = "" })
        // Kolom Kepribadian
        KEPRIBADIAN_FIELDS.forEach(f => { row[f.label.toUpperCase()] = "80" })
        // Kolom Catatan
        row["CATATAN WALI KELAS"] = ""
        return row
      })

      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(dataRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template Nilai")
      XLSX.writeFile(workbook, `Template_Lengkap_${namaKelas}.xlsx`)
      toast.success("Template komprehensif berhasil didownload")
    } catch (err: any) {
      toast.error(err.message || "Gagal download")
    } finally {
      toast.dismiss(loadToast)
      setIsDownloading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const loadToast = toast.loading("Membaca data Excel...")
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setExcelPreview(data)
      toast.success(`Berhasil memuat ${data.length} baris data`)
    } catch {
      toast.error("Format file tidak valid")
    } finally {
      toast.dismiss(loadToast)
    }
  }

  const handleSimpanExcel = async () => {
    setLoading(true)
    const t = toast.loading("Memproses penyimpanan massal...")
    const res = await simpanNilaiExcelMenyeluruh(selectedKelas, Number(selectedSemester), excelPreview, refData.mapel)
    setLoading(false)
    toast.dismiss(t)

    if (res.success) {
      toast.success("Data berhasil diimpor sepenuhnya")
      closeExcelModal()
    } else {
      toast.error(res.error || "Gagal simpan")
    }
  }

  // --- DIRECT INPUT HANDLERS ---
  const updateField = (setter: any, data: any[], idx: number, field: string, val: any) => {
    const newData = [...data]
    newData[idx] = { ...newData[idx], [field]: val }
    setter(newData)
  }

  const handleSimpanDirectAkademik = async () => {
    setLoading(true)
    const t = toast.loading("Menyimpan nilai mapel...")
    const res = await simpanNilaiPerMapel(Number(selectedSemester), Number(selectedMapel), akademikData)
    setLoading(false)
    toast.dismiss(t)
    if (res.success) toast.success("Nilai berhasil disimpan")
    else toast.error(res.error || "Gagal simpan")
  }

  const handleSimpanKepribadian = async () => {
    setLoading(true)
    const t = toast.loading("Menyimpan data kepribadian...")
    const res = await simpanKepribadian(Number(selectedSemester), kepribadianData)
    setLoading(false)
    toast.dismiss(t)
    if (res.success) toast.success("Kepribadian berhasil disimpan")
    else toast.error(res.error || "Gagal simpan")
  }

  const handleSimpanCatatan = async () => {
    setLoading(true)
    const t = toast.loading("Menyimpan catatan...")
    const formatted = catatanData.map(d => ({ riwayat_id: d.riwayat_id, catatan: d.catatan_wali_kelas }))
    const res = await simpanCatatanWali(Number(selectedSemester), formatted)
    setLoading(false)
    toast.dismiss(t)
    if (res.success) toast.success("Catatan berhasil disimpan")
    else toast.error(res.error || "Gagal simpan")
  }

  const closeExcelModal = () => {
    setIsExcelModalOpen(false)
    setExcelPreview([])
  }

  const handleAkademikNilaiChange = (idx: number, value: string) => {
    if (value === '') {
      updateField(setAkademikData, akademikData, idx, 'nilai', '')
      return
    }

    updateField(setAkademikData, akademikData, idx, 'nilai', Math.min(100, Math.max(0, parseInt(value) || 0)))
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-20 px-4">
      {/* HEADER & TABS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">Manajemen Nilai Terpadu</h1>
            <p className="text-slate-500 text-xs md:text-sm">Akademik, Kepribadian, & Catatan Wali Kelas dalam satu pintu.</p>
          </div>
        </div>

        <div className="bg-slate-100 p-1.5 rounded-xl flex flex-wrap gap-1">
          {[
            { id: 'akademik', icon: BookOpen, label: 'Akademik' },
            { id: 'kepribadian', icon: UserCircle, label: 'Kepribadian' },
            { id: 'catatan', icon: MessageSquare, label: 'Catatan' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <tab.icon className="w-4 h-4"/> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm uppercase tracking-wider">
            <LayoutGrid className="w-4 h-4 text-blue-500"/> Filter Konteks
          </div>
          <button 
            onClick={fetchRef} 
            disabled={isInitializing}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-colors"
            title="Refresh Data"
          >
            <Loader2 className={`w-3.5 h-3.5 ${isInitializing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Semester</label>
            <select 
              className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 font-medium text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="1">Ganjil (1)</option>
              <option value="2">Genap (2)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Kelas</label>
            <select 
              className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white font-medium text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              disabled={isInitializing}
            >
              <option value="">{isInitializing ? "-- Memuat data... --" : "-- Pilih Kelas --"}</option>
              {!isInitializing && refData.kelas.map((k: any) => (
                <option key={k.id} value={k.id}>{k.nama_kelas}</option>
              ))}
            </select>
            {refData.kelas.length === 0 && !isInitializing && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3"/> Data kelas belum tersedia di database.
              </p>
            )}
          </div>

          {activeTab === 'akademik' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Mata Pelajaran</label>
              <select 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white font-medium text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={selectedMapel}
                onChange={(e) => setSelectedMapel(e.target.value)}
              >
                <option value="">-- Pilih Mapel --</option>
                {refData.mapel.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'akademik' && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Upload Excel Global
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {activeTab === 'akademik' && (
          <div className="space-y-5">
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-800">Daftar Nilai {selectedMapel ? selectedMapelTitle : ''}</h3>
                  </div>
                  {selectedMapel && (
                    <button onClick={handleSimpanDirectAkademik} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Batch
                    </button>
                  )}
                </div>
                <div className="min-h-[260px]">
                  {!selectedKelas || !selectedMapel ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-slate-400">
                      <div className="rounded-full border border-slate-100 bg-slate-50 p-3">
                        <AlertCircle className="h-8 w-8 opacity-30" />
                      </div>
                      <p className="max-w-[240px] text-sm font-medium italic leading-6 sm:max-w-sm">
                        Pilih kelas dan mata pelajaran untuk mulai mengisi nilai.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-3 py-2.5 text-center w-14 text-xs font-semibold">No</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold">Santri</th>
                          <th className="px-3 py-2.5 text-center w-32 text-xs font-semibold">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {akademikData.map((row, idx) => (
                          <tr key={row.riwayat_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-sm text-slate-800 uppercase tracking-tight leading-tight">{row.nama}</div>
                              <div className="text-[10px] text-slate-400 font-mono tracking-wide">{row.nis}</div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={row.nilai ?? ''}
                                onChange={(e) => handleAkademikNilaiChange(idx, e.target.value)}
                                className="w-full h-10 text-center px-2 border border-slate-200 rounded-lg font-bold text-base text-blue-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}

        {activeTab === 'kepribadian' && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-6">
            <div className="px-4 py-3 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3 text-blue-600">
                <UserCircle className="w-6 h-6" />
                <h3 className="font-bold text-slate-800">Penilaian Karakter & Kepribadian</h3>
              </div>
              {selectedKelas && (
                <button onClick={handleSimpanKepribadian} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all active:scale-95">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Batch
                </button>
              )}
            </div>
            <div className="overflow-x-auto min-h-[320px]">
              {!selectedKelas ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
                  <UserCircle className="w-16 h-16 opacity-10" />
                  <p className="font-medium italic">Silakan pilih kelas terlebih dahulu</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-12">No</th>
                      <th className="px-3 py-2.5 text-left min-w-[180px]">Nama Lengkap</th>
                      {KEPRIBADIAN_FIELDS.map(f => <th key={f.key} className="px-2 py-2.5 text-center border-l w-24">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {kepribadianData.map((row, idx) => (
                      <tr key={row.riwayat_id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-700 uppercase tracking-tight">{row.nama}</td>
                        {KEPRIBADIAN_FIELDS.map(f => (
                          <td key={f.key} className="px-2 py-2 border-l">
                            <input
                              type="number"
                              value={row[f.key]}
                              onChange={(e) => updateField(setKepribadianData, kepribadianData, idx, f.key, parseInt(e.target.value) || 0)}
                              className="w-full h-9 text-center px-1 border border-slate-200 rounded-lg focus:border-blue-300 outline-none font-bold text-slate-600 transition-all"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'catatan' && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-6">
            <div className="px-4 py-3 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3 text-indigo-600">
                <MessageSquare className="w-6 h-6" />
                <h3 className="font-bold text-slate-800">Evaluasi & Catatan Wali Kelas</h3>
              </div>
              {selectedKelas && (
                <button onClick={handleSimpanCatatan} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Semua Catatan
                </button>
              )}
            </div>
            <div className="p-4 space-y-4">
              {!selectedKelas ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
                  <FileText className="w-16 h-16 opacity-10" />
                  <p className="font-medium italic">Silakan pilih kelas terlebih dahulu</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {catatanData.map((row, idx) => (
                    <div key={row.riwayat_id} className="p-4 border border-slate-200 bg-slate-50/30 rounded-2xl flex flex-col md:flex-row gap-4 transition-all hover:border-indigo-100 hover:bg-white hover:shadow-sm group">
                      <div className="md:w-1/4">
                        <div className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{row.nama}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{row.nis}</div>
                      </div>
                      <div className="md:w-3/4">
                        <textarea
                          value={row.catatan_wali_kelas}
                          onChange={(e) => updateField(setCatatanData, catatanData, idx, 'catatan_wali_kelas', e.target.value)}
                          placeholder="Contoh: Pertahankan kedisiplinan dan tingkatkan hafalan juz 30..."
                          className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none text-sm min-h-[88px] bg-white transition-all shadow-sm font-medium text-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b bg-slate-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Upload Excel Global</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeExcelModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloading || !selectedKelas}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 md:w-auto"
                >
                  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Template
                </button>
                <div className="hidden md:block" />
              </div>

              <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/30">
                <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 cursor-pointer opacity-0" />
                <Upload className="mx-auto mb-3 h-10 w-10 text-emerald-600 opacity-80" />
                <h3 className="text-base font-bold text-slate-700">Pilih File Excel</h3>
              </div>

              {excelPreview.length > 0 && (
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm animate-in zoom-in-95">
                  <div className="flex flex-col gap-3 bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <span className="font-bold">Preview: {excelPreview.length} Santri Terdeteksi</span>
                    </div>
                    <button onClick={handleSimpanExcel} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-5 py-2 text-sm font-bold shadow-lg transition-all hover:bg-green-600 disabled:opacity-50 active:scale-95">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Massal
                    </button>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr>
                          <th className="border-b p-3 text-left">Santri</th>
                          {refData.mapel.slice(0, 5).map(m => <th key={m.id} className="border-b p-3 text-center">{m.nama}</th>)}
                          <th className="border-b bg-blue-50 p-3 text-center">Akhlak</th>
                          <th className="border-b bg-indigo-50 p-3 text-left">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {excelPreview.slice(0, 20).map((row: any, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-700">{row['NAMA SANTRI']}</td>
                            {refData.mapel.slice(0, 5).map(m => (
                              <td key={m.id} className="p-3 text-center font-mono text-slate-500">{row[m.nama.toUpperCase()] || '-'}</td>
                            ))}
                            <td className="bg-blue-50/50 p-3 text-center font-bold text-blue-600">{row['KEDISIPLINAN'] || '-'}</td>
                            <td className="max-w-[200px] truncate bg-indigo-50/50 p-3 italic text-indigo-700">{row['CATATAN WALI KELAS'] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelPreview.length > 20 && <div className="border-t bg-slate-50 p-3 text-center text-slate-400 italic">... dan {excelPreview.length - 20} data lainnya</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
