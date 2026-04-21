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
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { 
  getReferensiData, 
  getDataSantriPerKelas, 
  getDataNilaiPerMapel,
  simpanNilaiPerMapel,
  simpanNilaiExcelMenyeluruh,
  getDataKepribadian,
  simpanKepribadian,
  getDataCatatanWali,
  simpanCatatanWali,
  KEPRIBADIAN_FIELDS
} from './actions'
import { toast } from 'sonner'

type TabType = 'akademik' | 'kepribadian' | 'catatan'
type AkademikMode = 'direct' | 'excel'

export default function InputNilaiPage() {
  const [activeTab, setActiveTab] = useState<TabType>('akademik')
  const [akademikMode, setAkademikMode] = useState<AkademikMode>('direct')
  
  const [refData, setRefData] = useState<{ mapel: any[], kelas: any[] }>({ mapel: [], kelas: [] })
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedMapel, setSelectedMapel] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)

  // Data States (Lazy Loaded)
  const [akademikData, setAkademikData] = useState<any[]>([])
  const [kepribadianData, setKepribadianData] = useState<any[]>([])
  const [catatanData, setCatatanData] = useState<any[]>([])
  const [excelPreview, setExcelPreview] = useState<any[]>([])

  const fetchRef = async () => {
    setIsInitializing(true)
    try {
      const data = await getReferensiData()
      setRefData(data)
      if (data.kelas.length > 0) {
        toast.success(`Berhasil memuat ${data.kelas.length} kelas.`)
      }
    } catch (err) {
      toast.error("Gagal memuat data referensi.")
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
    if (!selectedKelas) return

    if (activeTab === 'akademik' && akademikMode === 'direct' && selectedMapel) {
      setLoading(true)
      getDataNilaiPerMapel(selectedKelas, Number(selectedMapel), Number(selectedSemester))
        .then(setAkademikData)
        .finally(() => setLoading(false))
    } else if (activeTab === 'kepribadian') {
      setLoading(true)
      getDataKepribadian(selectedKelas, Number(selectedSemester))
        .then(setKepribadianData)
        .finally(() => setLoading(false))
    } else if (activeTab === 'catatan') {
      setLoading(true)
      getDataCatatanWali(selectedKelas, Number(selectedSemester))
        .then(setCatatanData)
        .finally(() => setLoading(false))
    }
  }, [selectedKelas, selectedSemester, activeTab, akademikMode, selectedMapel])

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
      setExcelPreview([])
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 px-4">
      {/* HEADER & TABS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/akademik" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR: CONTEXT */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-5">
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
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Semester</label>
                <select 
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  <option value="1">Ganjil (1)</option>
                  <option value="2">Genap (2)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Kelas Target</label>
                <select 
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  disabled={isInitializing}
                >
                  <option value="">{isInitializing ? "-- Memuat data... --" : "-- Pilih Kelas --"}</option>
                  {!isInitializing && refData.kelas.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.nama_kelas} ({k.marhalah_nama})</option>
                  ))}
                </select>
                {refData.kelas.length === 0 && !isInitializing && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3"/> Data kelas belum tersedia di database.
                  </p>
                )}
              </div>

              {activeTab === 'akademik' && akademikMode === 'direct' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Mata Pelajaran</label>
                  <select 
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
            </div>
          </div>

          {activeTab === 'akademik' && akademikMode === 'excel' && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl border border-blue-400 shadow-lg text-white">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-200"/> Template Global
              </h3>
              <p className="text-xs text-blue-100 mb-5 leading-relaxed">
                Download template Excel yang sudah mencakup kolom <b>Nilai Akademik</b>, <b>Kepribadian</b>, dan <b>Catatan Wali Kelas</b>.
              </p>
              <button 
                onClick={handleDownloadTemplate}
                disabled={isDownloading || !selectedKelas}
                className="w-full bg-white text-blue-700 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 disabled:opacity-50 transition-all shadow-md font-bold text-sm active:scale-95"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                Download Template
              </button>
            </div>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* AKADEMIK TAB */}
          {activeTab === 'akademik' && (
            <div className="space-y-6">
              {/* Mode Switcher */}
              <div className="flex gap-4">
                <button 
                  onClick={() => setAkademikMode('direct')}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${akademikMode === 'direct' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <LayoutGrid className="w-6 h-6"/>
                  <span className="font-bold text-sm">Input Per Mapel</span>
                </button>
                <button 
                  onClick={() => setAkademikMode('excel')}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${akademikMode === 'excel' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <FileSpreadsheet className="w-6 h-6"/>
                  <span className="font-bold text-sm">Upload Excel (Global)</span>
                </button>
              </div>

              {/* Akademik: Direct Input */}
              {akademikMode === 'direct' && (
                <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><BookOpen className="w-4 h-4"/></div>
                      <h3 className="font-bold text-slate-800">Daftar Nilai {selectedMapel ? refData.mapel.find(m => m.id == selectedMapel)?.nama : ''}</h3>
                    </div>
                    {selectedMapel && (
                      <button onClick={handleSimpanDirectAkademik} disabled={loading} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Simpan Batch
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto min-h-[300px]">
                    {!selectedKelas || !selectedMapel ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <AlertCircle className="w-12 h-12 opacity-10"/>
                        <p className="font-medium italic">Pilih Kelas dan Mata Pelajaran untuk mengisi nilai</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-6 py-4 text-center w-16">No</th>
                            <th className="px-6 py-4 text-left">Santri</th>
                            <th className="px-6 py-4 text-center w-40">Nilai (0-100)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {akademikData.map((row, idx) => (
                            <tr key={row.riwayat_id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-800 uppercase tracking-tight">{row.nama}</div>
                                <div className="text-[10px] text-slate-400 font-mono tracking-widest">{row.nis}</div>
                              </td>
                              <td className="px-6 py-4">
                                <input 
                                  type="number"
                                  value={row.nilai}
                                  onChange={(e) => updateField(setAkademikData, akademikData, idx, 'nilai', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                  className="w-full text-center p-3 border-2 border-slate-100 rounded-xl font-bold text-lg text-blue-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* Akademik: Excel Upload */}
              {akademikMode === 'excel' && (
                <div className="space-y-6">
                  <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center transition-all hover:border-blue-300 hover:bg-blue-50/20 relative">
                    <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4 opacity-70"/>
                    <h3 className="text-lg font-bold text-slate-700">Upload File Global</h3>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto">Upload Excel yang berisi nilai akademik, kepribadian, dan catatan dalam satu file.</p>
                  </div>

                  {excelPreview.length > 0 && (
                    <div className="bg-white border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
                      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="text-green-400 w-5 h-5"/>
                          <span className="font-bold">Preview: {excelPreview.length} Santri Terdeteksi</span>
                        </div>
                        <button onClick={handleSimpanExcel} disabled={loading} className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Simpan Massal
                        </button>
                      </div>
                      <div className="max-h-[500px] overflow-auto">
                        <table className="w-full text-xs whitespace-nowrap">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr>
                              <th className="p-3 text-left border-b">Santri</th>
                              {refData.mapel.slice(0, 5).map(m => <th key={m.id} className="p-3 text-center border-b">{m.nama}</th>)}
                              <th className="p-3 text-center border-b bg-blue-50">Akhlak</th>
                              <th className="p-3 text-left border-b bg-indigo-50">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {excelPreview.slice(0, 20).map((row: any, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-700">{row['NAMA SANTRI']}</td>
                                {refData.mapel.slice(0, 5).map(m => (
                                  <td key={m.id} className="p-3 text-center text-slate-500 font-mono">{row[m.nama.toUpperCase()] || '-'}</td>
                                ))}
                                <td className="p-3 text-center bg-blue-50/50 text-blue-600 font-bold">{row['KEDISIPLINAN'] || '-'}</td>
                                <td className="p-3 bg-indigo-50/50 text-indigo-700 italic truncate max-w-[200px]">{row['CATATAN WALI KELAS'] || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {excelPreview.length > 20 && <div className="p-3 text-center text-slate-400 italic bg-slate-50 border-t">... dan {excelPreview.length - 20} data lainnya</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* KEPRIBADIAN TAB */}
          {activeTab === 'kepribadian' && (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-6">
              <div className="p-5 border-b bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3 text-blue-600">
                  <UserCircle className="w-6 h-6"/>
                  <h3 className="font-bold text-slate-800">Penilaian Karakter & Kepribadian</h3>
                </div>
                {selectedKelas && (
                  <button onClick={handleSimpanKepribadian} disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all active:scale-95">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Simpan Batch
                  </button>
                )}
              </div>
              <div className="overflow-x-auto min-h-[400px]">
                {!selectedKelas ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
                    <UserCircle className="w-16 h-16 opacity-10"/>
                    <p className="font-medium italic">Silakan pilih kelas terlebih dahulu</p>
                  </div>
                ) : (
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-4 text-center w-12">No</th>
                        <th className="px-4 py-4 text-left min-w-[180px]">Nama Lengkap</th>
                        {KEPRIBADIAN_FIELDS.map(f => <th key={f.key} className="px-4 py-4 text-center border-l w-24">{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {kepribadianData.map((row, idx) => (
                        <tr key={row.riwayat_id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-4 font-bold text-slate-700 uppercase tracking-tight">{row.nama}</td>
                          {KEPRIBADIAN_FIELDS.map(f => (
                            <td key={f.key} className="px-4 py-3 border-l">
                              <input 
                                type="number"
                                value={row[f.key]}
                                onChange={(e) => updateField(setKepribadianData, kepribadianData, idx, f.key, parseInt(e.target.value) || 0)}
                                className="w-full text-center p-2 border-2 border-slate-50 rounded-lg focus:border-blue-300 outline-none font-bold text-slate-600 transition-all"
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

          {/* CATATAN TAB */}
          {activeTab === 'catatan' && (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-6">
              <div className="p-5 border-b bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3 text-indigo-600">
                  <MessageSquare className="w-6 h-6"/>
                  <h3 className="font-bold text-slate-800">Evaluasi & Catatan Wali Kelas</h3>
                </div>
                {selectedKelas && (
                  <button onClick={handleSimpanCatatan} disabled={loading} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Simpan Semua Catatan
                  </button>
                )}
              </div>
              <div className="p-6 space-y-6">
                {!selectedKelas ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
                    <FileText className="w-16 h-16 opacity-10"/>
                    <p className="font-medium italic">Silakan pilih kelas terlebih dahulu</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {catatanData.map((row, idx) => (
                      <div key={row.riwayat_id} className="p-5 border-2 border-slate-50 bg-slate-50/30 rounded-2xl flex flex-col md:flex-row gap-6 transition-all hover:border-indigo-100 hover:bg-white hover:shadow-sm group">
                        <div className="md:w-1/4">
                          <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{row.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">{row.nis}</div>
                        </div>
                        <div className="md:w-3/4">
                          <textarea 
                            value={row.catatan_wali_kelas}
                            onChange={(e) => updateField(setCatatanData, catatanData, idx, 'catatan_wali_kelas', e.target.value)}
                            placeholder="Contoh: Pertahankan kedisiplinan dan tingkatkan hafalan juz 30..."
                            className="w-full p-4 border-2 border-white rounded-2xl focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none text-sm min-h-[100px] bg-white transition-all shadow-sm font-medium text-slate-600"
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
      </div>
    </div>
  )
}