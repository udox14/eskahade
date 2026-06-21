'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { Upload, Download, Save, CheckCircle, Loader2, UserPlus, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importSantriMassal, tambahSantriSatuSatu, getKelasList } from './actions'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { KATEGORI_SANTRI_DASAR } from '@/lib/santri/kategori'
import { Button, TextInput, Textarea, NativeSelect, SegmentedControl } from '@mantine/core'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]
const KATEGORI_SANTRI_LIST = KATEGORI_SANTRI_DASAR
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "LAINNYA"]

const FORM_INIT = {
  nis: '', nama_lengkap: '', nik: '',
  jenis_kelamin: 'L' as 'L' | 'P',
  tempat_lahir: '', tanggal_lahir: '',
  nama_ayah: '', nama_ibu: '', alamat: '',
  gol_darah: '',
  alamat_lengkap: '', kecamatan: '', kab_kota: '', provinsi: '',
  jemaah: '', no_wa_ortu: '',
  tanggal_masuk: '', tanggal_keluar: '',
  kategori_santri: 'REGULER',
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

  const set = (key: string, val: string) => setForm(prev => {
    if (key === 'kategori_santri' && val === 'SADESA') {
      return { ...prev, kategori_santri: val, sekolah: '', kelas_sekolah: '' }
    }
    return { ...prev, [key]: val }
  })
  const isSadesa = form.kategori_santri === 'SADESA'

  // ── HANDLER FORM ──
  const handleSimpanForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nis || !form.nama_lengkap) return toast.warning("NIS dan Nama wajib diisi")
    setIsSavingForm(true)
    const toastId = toast.loading("Menyimpan...")
    const res = await tambahSantriSatuSatu(form)
    toast.dismiss(toastId)
    setIsSavingForm(false)
    if ('error' in res) { toast.error("Gagal", { description: res.error }); return }
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
      kategori_santri: "REGULER", sekolah: "MTSN", kelas_sekolah: "7",
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
        kategori_santri: row.kategori_santri || row['KATEGORI SANTRI'] || row['kategori santri'] || '',
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
    <div className="space-y-6 pb-20">

      <DashboardPageHeader
        title="Tambah Data Santri"
        description="Input data santri satu per satu atau sekaligus via Excel."
      />

      <SegmentedControl
        value={tab}
        onChange={v => setTab(v as 'FORM' | 'EXCEL')}
        data={[
          { label: 'Form', value: 'FORM' },
          { label: 'Import Massal', value: 'EXCEL' },
        ]}
      />

      {/* ══ TAB FORM ══ */}
      {tab === 'FORM' && (
        <form onSubmit={handleSimpanForm} className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-left-2">

          {/* SEKSI: IDENTITAS */}
          <div className="px-6 pt-6 pb-4 border-b bg-blue-50/40">
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide text-blue-800">Identitas Santri</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            <TextInput
              label={<span className="text-xs font-bold text-slate-500 uppercase">NIS <span className="text-red-500">*</span></span>}
              value={form.nis}
              onChange={e => set('nis', e.target.value)}
              placeholder="Nomor Induk Santri"
              required
            />
            <TextInput
              label={<span className="text-xs font-bold text-slate-500 uppercase">Nama Lengkap <span className="text-red-500">*</span></span>}
              value={form.nama_lengkap}
              onChange={e => set('nama_lengkap', e.target.value)}
              placeholder="Nama lengkap santri"
              required
            />
            <TextInput
              label="NIK"
              value={form.nik}
              onChange={e => set('nik', e.target.value)}
              placeholder="Nomor Induk Kependudukan"
            />
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Jenis Kelamin <span className="text-red-500">*</span></label>
              <SegmentedControl
                value={form.jenis_kelamin}
                onChange={v => set('jenis_kelamin', v)}
                fullWidth
                data={[
                  { label: 'Laki-laki', value: 'L' },
                  { label: 'Perempuan', value: 'P' },
                ]}
              />
            </div>
            <TextInput
              label="Tempat Lahir"
              value={form.tempat_lahir}
              onChange={e => set('tempat_lahir', e.target.value)}
              placeholder="Kota/Kabupaten"
            />
            <TextInput
              label="Tanggal Lahir"
              type="date"
              value={form.tanggal_lahir}
              onChange={e => set('tanggal_lahir', e.target.value)}
            />
            <NativeSelect
              label="Golongan Darah"
              value={form.gol_darah}
              onChange={e => set('gol_darah', e.target.value)}
              data={[
                { label: '-- Tidak Diketahui --', value: '' },
                ...['A', 'B', 'AB', 'O'].map(g => ({ label: g, value: g })),
              ]}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Alamat (Ringkas)"
                value={form.alamat}
                onChange={e => set('alamat', e.target.value)}
                placeholder="Alamat singkat"
                rows={2}
                resize="none"
              />
            </div>
          </div>

          {/* SEKSI: ALAMAT LENGKAP */}
          <div className="px-6 pt-5 pb-4 border-b bg-yellow-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-yellow-800">Alamat Lengkap & Jemaah</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            <div className="md:col-span-2">
              <Textarea
                label="Alamat Lengkap (Jalan/Kampung, RT/RW, Desa)"
                value={form.alamat_lengkap}
                onChange={e => set('alamat_lengkap', e.target.value)}
                placeholder="Contoh: Kp. Sukarame RT 01/02 Desa Sukahideng"
                rows={2}
                resize="none"
              />
            </div>
            <TextInput
              label="Kecamatan"
              value={form.kecamatan}
              onChange={e => set('kecamatan', e.target.value)}
              placeholder="Nama kecamatan"
            />
            <TextInput
              label="Kab/Kota"
              value={form.kab_kota}
              onChange={e => set('kab_kota', e.target.value)}
              placeholder="Kabupaten atau Kota"
            />
            <TextInput
              label="Provinsi"
              value={form.provinsi}
              onChange={e => set('provinsi', e.target.value)}
              placeholder="Nama provinsi"
            />
            <TextInput
              label="Jemaah"
              value={form.jemaah}
              onChange={e => set('jemaah', e.target.value)}
              placeholder="Pengelompokan wilayah/jemaah"
            />
          </div>

          {/* SEKSI: ORANG TUA */}
          <div className="px-6 pt-5 pb-4 border-b bg-green-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-green-800">Orang Tua & Kontak</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            <TextInput
              label="Nama Ayah"
              value={form.nama_ayah}
              onChange={e => set('nama_ayah', e.target.value)}
              placeholder="Nama ayah kandung"
            />
            <TextInput
              label="Nama Ibu"
              value={form.nama_ibu}
              onChange={e => set('nama_ibu', e.target.value)}
              placeholder="Nama ibu kandung"
            />
            <div className="md:col-span-2">
              <TextInput
                label="No. WhatsApp Orang Tua"
                value={form.no_wa_ortu}
                onChange={e => set('no_wa_ortu', e.target.value)}
                placeholder="Contoh: 08123456789"
              />
            </div>
          </div>

          {/* SEKSI: SEKOLAH */}
          <div className="px-6 pt-5 pb-4 border-b bg-green-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-green-800">Info Sekolah</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
            <div>
              <NativeSelect
                label="Kategori Setelah Masa Baru"
                value={form.kategori_santri}
                onChange={e => set('kategori_santri', e.target.value)}
                data={KATEGORI_SANTRI_LIST.map(kategori => ({ label: kategori, value: kategori }))}
              />
              <p className="mt-1 text-[11px] text-slate-500">Santri baru otomatis tampil sebagai BARU selama 3 bulan sejak ditambahkan.</p>
            </div>
            <NativeSelect
              label="Sekolah"
              value={form.sekolah}
              onChange={e => set('sekolah', e.target.value)}
              disabled={isSadesa}
              data={[
                { label: '-- Pilih Sekolah --', value: '' },
                ...SEKOLAH_LIST.map(s => ({ label: s, value: s })),
              ]}
            />
            <TextInput
              label="Kelas Sekolah"
              value={form.kelas_sekolah}
              onChange={e => set('kelas_sekolah', e.target.value)}
              disabled={isSadesa}
              placeholder={isSadesa ? "Tidak dipakai untuk SADESA" : "Contoh: 7A, 8B"}
            />
          </div>

          {/* SEKSI: ASRAMA & PESANTREN */}
          <div className="px-6 pt-5 pb-4 border-b bg-purple-50/40">
            <h2 className="font-bold text-sm uppercase tracking-wide text-purple-800">Asrama & Kelas Pesantren</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <NativeSelect
              label="Asrama"
              value={form.asrama}
              onChange={e => set('asrama', e.target.value)}
              data={[
                { label: '-- Pilih Asrama --', value: '' },
                ...ASRAMA_LIST.map(a => ({ label: a, value: a })),
              ]}
            />
            <TextInput
              label="Kamar"
              value={form.kamar}
              onChange={e => set('kamar', e.target.value)}
              placeholder="Nomor kamar"
            />
            <NativeSelect
              label="Kelas Pesantren"
              value={form.kelas_pesantren}
              onChange={e => set('kelas_pesantren', e.target.value)}
              data={[
                { label: '-- Pilih Kelas --', value: '' },
                ...kelasList.map(k => ({ label: k.nama_kelas, value: k.nama_kelas })),
              ]}
            />
            <div>
              <TextInput
                label={<span className="text-xs font-bold text-slate-500 uppercase">Tanggal Masuk <span className="text-slate-400 font-normal normal-case">(tahun masuk otomatis)</span></span>}
                type="date"
                value={form.tanggal_masuk}
                onChange={e => set('tanggal_masuk', e.target.value)}
              />
            </div>
            <div>
              <TextInput
                label={<span className="text-xs font-bold text-slate-500 uppercase">Tanggal Keluar <span className="text-slate-400 font-normal normal-case">(isi jika keluar sebelum lulus)</span></span>}
                type="date"
                value={form.tanggal_keluar}
                onChange={e => set('tanggal_keluar', e.target.value)}
              />
            </div>
            <div>
              <TextInput
                label={<span className="text-xs font-bold text-slate-500 uppercase">Tempat Makan <span className="text-slate-400 font-normal normal-case">(auto-sync ke Katering)</span></span>}
                value={form.nama_tempat_makan}
                onChange={e => set('nama_tempat_makan', e.target.value)}
                placeholder="Contoh: Bi Ade"
              />
            </div>
            <div>
              <TextInput
                label={<span className="text-xs font-bold text-slate-500 uppercase">Tempat Cuci <span className="text-slate-400 font-normal normal-case">(auto-sync ke Laundry)</span></span>}
                value={form.nama_tempat_cuci}
                onChange={e => set('nama_tempat_cuci', e.target.value)}
                placeholder="Contoh: Bi Hani"
              />
            </div>
          </div>

          {/* FOOTER TOMBOL */}
          <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
            <Button type="button" variant="default" onClick={() => setForm(FORM_INIT)}>
              Reset Form
            </Button>
            <Button
              type="submit"
              loading={isSavingForm}
              color="blue"
              leftSection={!isSavingForm ? <Save className="w-4 h-4" /> : undefined}
            >
              Simpan Santri
            </Button>
          </div>
        </form>
      )}

      {/* ══ TAB EXCEL ══ */}
      {tab === 'EXCEL' && (
        <div className="bg-white border rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-right-2">
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div>
              <p className="font-bold text-blue-900 text-sm">Langkah 1: Download Template</p>
              <p className="text-xs text-blue-600">Gunakan template ini untuk mengisi data santri + kelas.</p>
            </div>
            <Button
              onClick={downloadTemplate}
              variant="default"
              size="xs"
              leftSection={<Download className="w-4 h-4" />}
            >
              Template Excel
            </Button>
          </div>

          <div className="border-2 border-dashed p-8 text-center relative hover:bg-slate-50 transition-colors rounded-lg">
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="text-slate-600 font-medium">Klik untuk upload Excel</p>
            <p className="text-xs text-slate-400 mt-1">Format .xlsx sesuai template</p>
          </div>

          {excelData.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Preview Data ({excelData.length} baris)</h3>
                <Button
                  onClick={handleSaveExcel}
                  loading={isSavingExcel}
                  color="green"
                  leftSection={!isSavingExcel ? <Save className="w-4 h-4" /> : undefined}
                >
                  Simpan Semua
                </Button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 font-bold text-slate-600">
                    <tr>
                      <th className="p-3 border-b">NIS</th>
                      <th className="p-3 border-b">Nama</th>
                      <th className="p-3 border-b bg-green-50 text-green-800">Kelas Pesantren</th>
                      <th className="p-3 border-b">Asrama</th>
                      <th className="p-3 border-b">Sekolah</th>
                      <th className="p-3 border-b">Kab/Kota</th>
                      <th className="p-3 border-b">Jemaah</th>
                      <th className="p-3 border-b">No. WA Ortu</th>
                      <th className="p-3 border-b">Tgl Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {excelData.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-xs">{r.nis}</td>
                        <td className="p-3 font-medium">{r.nama_lengkap}</td>
                        <td className="p-3 font-bold text-green-700 bg-green-50/30">{r.kelas_pesantren || <span className="text-slate-400 font-normal italic">Kosong</span>}</td>
                        <td className="p-3 text-slate-500">{r.asrama}</td>
                        <td className="p-3 text-blue-600">{r.sekolah}</td>
                        <td className="p-3 text-slate-500">{r.kab_kota}</td>
                        <td className="p-3 text-slate-500">{r.jemaah}</td>
                        <td className="p-3 text-slate-500">{r.no_wa_ortu}</td>
                        <td className="p-3 text-slate-500">{r.tanggal_masuk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelData.length > 50 && <p className="text-xs text-center text-slate-400">Menampilkan 50 baris pertama dari {excelData.length} total.</p>}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
