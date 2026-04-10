'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { Upload, Download, Save, CheckCircle, ArrowLeft, Loader2, UserPlus, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importSantriMassal, tambahSantriSatuSatu, getKelasList } from './actions'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "SADESA", "LAINNYA"]

const FORM_INIT = {
  nis: '', nama_lengkap: '', nik: '',
  jenis_kelamin: 'L' as 'L' | 'P',
  tempat_lahir: '', tanggal_lahir: '',
  nama_ayah: '', nama_ibu: '', alamat: '',
  gol_darah: '',
  alamat_lengkap: '', kecamatan: '', kab_kota: '', provinsi: '',
  jemaah: '', no_wa_ortu: '',
  tanggal_masuk: '', tanggal_keluar: '',
  sekolah: '', kelas_sekolah: '',
  asrama: '', kamar: '',
  kelas_pesantren: '',
  nama_tempat_makan: '',
  nama_tempat_cuci: '',
}

export default function InputSantriPage() {
  const confirm = useConfirm()
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
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const headers = [{
      nis: "12345", nama_lengkap: "Ahmad Fulan", nik: "3201",
      jenis_kelamin: "L", tempat_lahir: "Tasik", tanggal_lahir: "2010-01-01",
      nama_ayah: "Budi", nama_ibu: "Siti", alamat: "Sukarame",
      gol_darah: "A",
      alamat_lengkap: "Kp. Sukarame RT 01/02 Desa Sukahideng",
      kecamatan: "Taraju", kab_kota: "Tasikmalaya", provinsi: "Jawa Barat",
      jemaah: "Jemaah Taraju",
      no_wa_ortu: "08123456789",
      tanggal_masuk: "2024-07-01", tanggal_keluar: "",
      sekolah: "MTSN", kelas_sekolah: "7",
      asrama: "BAHAGIA", kamar: "1", kelas_pesantren: "1-A",
      nama_tempat_makan: "Bi Ade",
      nama_tempat_cuci: "Bi Hani"
    }]
    const ws = XLSX.utils.json_to_sheet(headers)
    ws['!cols'] = [
      {wch:12},{wch:25},{wch:16},{wch:5},{wch:12},{wch:14},
      {wch:15},{wch:15},{wch:15},
      {wch:5},{wch:35},{wch:15},{wch:15},{wch:15},{wch:20},
      {wch:14},{wch:14},{wch:14},
      {wch:10},{wch:10},{wch:15},{wch:8},{wch:15},
      {wch:20},{wch:20}
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.writeFile(wb, "Template_Santri_Migrasi.xlsx")
    toast.success("Template didownload")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const id = toast.loading("Membaca file...")
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws)
      const clean = JSON.parse(JSON.stringify(raw)).map((row: any) => ({
        ...row,
        kelas_pesantren: row.kelas_pesantren || row['KELAS PESANTREN'] || row['kelas pesantren'],
        no_wa_ortu: row.no_wa_ortu ? String(row.no_wa_ortu) : (row['no_wa_ortu'] || ''),
      }))
      setExcelData(clean)
      toast.dismiss(id)
      toast.success(`Berhasil membaca ${clean.length} baris data`)
    } catch { toast.dismiss(id); toast.error("Format file salah") }
  }

  const handleSaveExcel = async () => {
    if (excelData.length === 0) return toast.warning("Data kosong")
    if (!await confirm(`Import ${excelData.length} santri? Proses akan berjalan per 50 data.\nData yang NIS-nya sudah ada akan dilewati otomatis.`)) return

    setIsSavingExcel(true)
    const BATCH_SIZE = 50
    const total = excelData.length
    let inserted = 0

    const toastId = toast.loading(`Memproses 0 / ${total} santri...`)

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = excelData.slice(i, i + BATCH_SIZE)
      const result = await importSantriMassal(batch)

      if ('error' in result) {
        toast.dismiss(toastId)
        toast.error("Import terhenti", { description: result.error })
        setIsSavingExcel(false)
        return
      }

      inserted += result.count ?? 0
      toast.loading(`Memproses ${Math.min(i + BATCH_SIZE, total)} / ${total} santri...`, { id: toastId })
    }

    setIsSavingExcel(false)
    toast.dismiss(toastId)
    const skipped = total - inserted
    const desc = skipped > 0
      ? `${inserted} santri ditambahkan, ${skipped} dilewati (NIS sudah ada).`
      : `${inserted} santri berhasil diimport.`
    toast.success("Import selesai!", { description: desc })
    router.push('/dashboard/santri')
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tambah Data Santri</h1>
          <p className="text-muted-foreground text-sm">Input satu per satu atau sekaligus via Excel.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as 'FORM' | 'EXCEL')} className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="FORM" className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Form Satu-Satu</TabsTrigger>
          <TabsTrigger value="EXCEL" className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Import Excel</TabsTrigger>
        </TabsList>

        {/* ══ TAB FORM ══ */}
        <TabsContent value="FORM" className="animate-in fade-in slide-in-from-bottom-2">
          <form onSubmit={handleSimpanForm}>
            <Card className="shadow-sm">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-lg">Formulir Data Santri</CardTitle>
                <CardDescription>Isi data dengan lengkap. Field bertanda (*) wajib diisi.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">

                {/* SEKSI: IDENTITAS */}
                <div className="px-6 py-4 bg-blue-50/50 dark:bg-blue-900/10 border-b">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-blue-800 dark:text-blue-400">Identitas Santri</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 border-b">
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">NIS <span className="text-red-500">*</span></Label>
                    <Input value={form.nis} onChange={e => set('nis', e.target.value)} placeholder="Nomor Induk Santri" required className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Nama Lengkap <span className="text-red-500">*</span></Label>
                    <Input value={form.nama_lengkap} onChange={e => set('nama_lengkap', e.target.value)} placeholder="Nama lengkap santri" required className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">NIK</Label>
                    <Input value={form.nik} onChange={e => set('nik', e.target.value)} placeholder="Nomor Induk Kependudukan" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Jenis Kelamin <span className="text-red-500">*</span></Label>
                    <div className="flex gap-3 h-10">
                      <Button type="button" variant={form.jenis_kelamin === 'L' ? 'default' : 'outline'} className={cn("flex-1", form.jenis_kelamin === 'L' ? "bg-blue-600 hover:bg-blue-700" : "")} onClick={() => set('jenis_kelamin', 'L')}>
                        👦 Laki-laki
                      </Button>
                      <Button type="button" variant={form.jenis_kelamin === 'P' ? 'default' : 'outline'} className={cn("flex-1", form.jenis_kelamin === 'P' ? "bg-pink-600 hover:bg-pink-700" : "")} onClick={() => set('jenis_kelamin', 'P')}>
                        👧 Perempuan
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Tempat Lahir</Label>
                    <Input value={form.tempat_lahir} onChange={e => set('tempat_lahir', e.target.value)} placeholder="Kota/Kabupaten" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Tanggal Lahir</Label>
                    <Input type="date" value={form.tanggal_lahir} onChange={e => set('tanggal_lahir', e.target.value)} className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Golongan Darah</Label>
                    <Select value={form.gol_darah} onValueChange={v => set('gol_darah', v ?? '')}>
                      <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="-- Tidak Diketahui --" /></SelectTrigger>
                      <SelectContent>
                        {['A','B','AB','O'].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Alamat (Ringkas)</Label>
                    <Textarea value={form.alamat} onChange={e => set('alamat', e.target.value)} placeholder="Alamat singkat" rows={2} className="bg-background shadow-sm resize-none" />
                  </div>
                </div>

                {/* SEKSI: ALAMAT LENGKAP */}
                <div className="px-6 py-4 bg-yellow-50/50 dark:bg-yellow-900/10 border-b">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-yellow-800 dark:text-yellow-400">Alamat Lengkap & Jemaah</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 border-b">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Alamat Lengkap (Jalan/Kampung, RT/RW, Desa)</Label>
                    <Textarea value={form.alamat_lengkap} onChange={e => set('alamat_lengkap', e.target.value)} placeholder="Contoh: Kp. Sukarame RT 01/02 Desa Sukahideng" rows={2} className="bg-background shadow-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Kecamatan</Label>
                    <Input value={form.kecamatan} onChange={e => set('kecamatan', e.target.value)} placeholder="Nama kecamatan" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Kab/Kota</Label>
                    <Input value={form.kab_kota} onChange={e => set('kab_kota', e.target.value)} placeholder="Kabupaten atau Kota" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Provinsi</Label>
                    <Input value={form.provinsi} onChange={e => set('provinsi', e.target.value)} placeholder="Nama provinsi" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Jemaah</Label>
                    <Input value={form.jemaah} onChange={e => set('jemaah', e.target.value)} placeholder="Pengelompokan wilayah/jemaah" className="bg-background shadow-sm" />
                  </div>
                </div>

                {/* SEKSI: ORANG TUA */}
                <div className="px-6 py-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-b">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400">Orang Tua & Kontak</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 border-b">
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Nama Ayah</Label>
                    <Input value={form.nama_ayah} onChange={e => set('nama_ayah', e.target.value)} placeholder="Nama ayah kandung" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Nama Ibu</Label>
                    <Input value={form.nama_ibu} onChange={e => set('nama_ibu', e.target.value)} placeholder="Nama ibu kandung" className="bg-background shadow-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">No. WhatsApp Orang Tua</Label>
                    <Input value={form.no_wa_ortu} onChange={e => set('no_wa_ortu', e.target.value)} placeholder="Contoh: 08123456789" className="bg-background shadow-sm" />
                  </div>
                </div>

                {/* SEKSI: SEKOLAH */}
                <div className="px-6 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-indigo-800 dark:text-indigo-400">Info Sekolah</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 border-b">
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Sekolah</Label>
                    <Select value={form.sekolah} onValueChange={v => set('sekolah', v ?? '')}>
                      <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="-- Pilih Sekolah --" /></SelectTrigger>
                      <SelectContent>
                        {SEKOLAH_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Kelas Sekolah</Label>
                    <Input value={form.kelas_sekolah} onChange={e => set('kelas_sekolah', e.target.value)} placeholder="Contoh: 7A, 8B" className="bg-background shadow-sm" />
                  </div>
                </div>

                {/* SEKSI: ASRAMA & PESANTREN */}
                <div className="px-6 py-4 bg-purple-50/50 dark:bg-purple-900/10 border-b">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-purple-800 dark:text-purple-400">Asrama & Kelas Pesantren</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Asrama</Label>
                    <Select value={form.asrama} onValueChange={v => set('asrama', v ?? '')}>
                      <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="-- Pilih Asrama --" /></SelectTrigger>
                      <SelectContent>
                        {ASRAMA_LIST.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Kamar</Label>
                    <Input value={form.kamar} onChange={e => set('kamar', e.target.value)} placeholder="Nomor kamar" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Kelas Pesantren</Label>
                    <Select value={form.kelas_pesantren} onValueChange={v => set('kelas_pesantren', v ?? '')}>
                      <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="-- Pilih Kelas --" /></SelectTrigger>
                      <SelectContent>
                        {kelasList.map(k => <SelectItem key={k.id} value={k.nama_kelas}>{k.nama_kelas}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Tanggal Masuk</Label>
                    <Input type="date" value={form.tanggal_masuk} onChange={e => set('tanggal_masuk', e.target.value)} className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">Tanggal Keluar</Label>
                    <Input type="date" value={form.tanggal_keluar} onChange={e => set('tanggal_keluar', e.target.value)} className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">🍽️ Tempat Makan</Label>
                    <Input value={form.nama_tempat_makan} onChange={e => set('nama_tempat_makan', e.target.value)} placeholder="Contoh: Bi Ade" className="bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase text-[11px] tracking-wider text-muted-foreground">👕 Tempat Cuci</Label>
                    <Input value={form.nama_tempat_cuci} onChange={e => set('nama_tempat_cuci', e.target.value)} placeholder="Contoh: Bi Hani" className="bg-background shadow-sm" />
                  </div>
                </div>

              </CardContent>
              <CardFooter className="px-6 py-4 bg-muted/30 border-t flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setForm(FORM_INIT)} className="px-5">
                  Reset Form
                </Button>
                <Button type="submit" disabled={isSavingForm} className="px-6 shadow-sm">
                  {isSavingForm ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Santri
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* ══ TAB EXCEL ══ */}
        <TabsContent value="EXCEL">
          <Card className="animate-in fade-in slide-in-from-right-2">
            <CardContent className="p-6 space-y-6">
              {/* DOWNLOAD */}
              <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-border/50">
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-400 text-sm">Langkah 1: Download Template</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Gunakan template ini untuk mengisi data santri + kelas secara offline.</p>
                </div>
                <Button variant="outline" onClick={downloadTemplate} className="text-blue-600 border-blue-200 hover:bg-blue-50 border shadow-sm">
                  <Download className="w-4 h-4 mr-2" /> Template Excel
                </Button>
              </div>

              {/* UPLOAD */}
              <div className="border-2 border-dashed border-border/60 p-10 text-center relative focus-within:border-primary hover:bg-muted/30 transition-all rounded-xl">
                <Input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-foreground font-semibold">Klik atau seret file ke sini untuk mengunggah Excel</p>
                <p className="text-sm text-muted-foreground mt-1">Format harus .xlsx dan sesuai dengan struktur template</p>
              </div>

              {/* PREVIEW */}
              {excelData.length > 0 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" /> 
                      Preview Data ({excelData.length} baris)
                    </h3>
                    <Button onClick={handleSaveExcel} disabled={isSavingExcel} className="w-full sm:w-auto shadow-sm">
                      {isSavingExcel ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} Simpan Semua Data
                    </Button>
                  </div>
                  <div className="border border-border/60 rounded-xl overflow-hidden max-h-96 overflow-y-auto overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-muted/80 sticky top-0 font-bold text-foreground backdrop-blur-sm z-10 border-b">
                        <tr>
                          <th className="p-3">NIS</th>
                          <th className="p-3">Nama</th>
                          <th className="p-3 bg-primary/10 text-primary">Kelas Pesantren</th>
                          <th className="p-3">Asrama</th>
                          <th className="p-3">Sekolah</th>
                          <th className="p-3">Kab/Kota</th>
                          <th className="p-3">Jemaah</th>
                          <th className="p-3">No. WA Ortu</th>
                          <th className="p-3">Tgl Masuk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {excelData.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-3 font-mono text-xs text-muted-foreground">{r.nis}</td>
                            <td className="p-3 font-medium">{r.nama_lengkap}</td>
                            <td className="p-3 font-bold text-primary bg-primary/5">{r.kelas_pesantren || <span className="text-muted-foreground font-normal italic">Kosong</span>}</td>
                            <td className="p-3 text-muted-foreground">{r.asrama}</td>
                            <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{r.sekolah}</td>
                            <td className="p-3 text-muted-foreground">{r.kab_kota}</td>
                            <td className="p-3 text-muted-foreground">{r.jemaah}</td>
                            <td className="p-3 text-muted-foreground">{r.no_wa_ortu}</td>
                            <td className="p-3 text-muted-foreground">{r.tanggal_masuk}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {excelData.length > 50 && <p className="text-xs text-center text-muted-foreground">Menampilkan 50 baris pertama dari {excelData.length} total baris.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  )
}