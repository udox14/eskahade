'use client'

import { useEffect, useState } from 'react'
import { BookOpenCheck, Download, FileSpreadsheet, Loader2, Plus, ToggleLeft, ToggleRight, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getMasterHafalanInitialData,
  getMasterHafalanList,
  importHafalanMassal,
  setHafalanActive,
  tambahHafalanBab,
  tambahHafalanBlok,
  tambahSuratQuran,
} from './actions'

export default function MasterHafalanContent() {
  const [types, setTypes] = useState<any[]>([])
  const [marhalah, setMarhalah] = useState<any[]>([])
  const [quranSurahs, setQuranSurahs] = useState<any[]>([])
  const [jenis, setJenis] = useState('quran')
  const [marhalahId, setMarhalahId] = useState('')
  const [surahNumber, setSurahNumber] = useState('1')
  const [bab, setBab] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [newBab, setNewBab] = useState({ judul: '', urutan: 0 })
  const [newBlok, setNewBlok] = useState<Record<number, { label: string; deskripsi: string; urutan: number }>>({})

  useEffect(() => {
    getMasterHafalanInitialData().then(data => {
      setTypes([...data.types])
      setMarhalah(data.marhalah)
      setQuranSurahs([...data.quranSurahs])
      if (data.marhalah[0]) setMarhalahId(String(data.marhalah[0].id))
      setLoading(false)
    })
  }, [])

  const load = async () => {
    if (!jenis || !marhalahId) return
    setBab(await getMasterHafalanList(jenis, Number(marhalahId)))
  }

  useEffect(() => { load() }, [jenis, marhalahId])

  const addBab = async () => {
    const res = await tambahHafalanBab({ jenis, marhalahId: Number(marhalahId), judul: newBab.judul, urutan: newBab.urutan })
    if ('error' in res) return toast.error(res.error)
    toast.success('Bab ditambahkan')
    setNewBab({ judul: '', urutan: 0 })
    load()
  }

  const addSuratQuran = async () => {
    const res = await tambahSuratQuran({ marhalahId: Number(marhalahId), surahNumber: Number(surahNumber) })
    if ('error' in res) return toast.error(res.error)
    toast.success(`Surat ditambahkan dengan ${res.count} ayat`)
    load()
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      {
        BAB: jenis === 'quran' ? 'Al-Fatihah' : 'Bab Kalam',
        'URUTAN BAB': 1,
        BLOK: jenis === 'quran' ? 'Ayat 1' : 'Definisi Kalam',
        DESKRIPSI: jenis === 'quran' ? 'Al-Fatihah:1' : 'Bagian awal bab',
        'URUTAN BLOK': 1,
      },
      {
        BAB: jenis === 'quran' ? 'Al-Fatihah' : 'Bab Kalam',
        'URUTAN BAB': 1,
        BLOK: jenis === 'quran' ? 'Ayat 2' : 'Pembagian Kalam',
        DESKRIPSI: '',
        'URUTAN BLOK': 2,
      },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Hafalan')
    XLSX.writeFile(wb, `Template_Hafalan_${jenis}.xlsx`)
  }

  const handleUploadImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setImportRows(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris terbaca`)
    } catch {
      toast.error('Gagal membaca file Excel')
    } finally {
      event.target.value = ''
    }
  }

  const saveImport = async () => {
    if (!importRows.length) return
    setImporting(true)
    const res = await importHafalanMassal({ jenis, marhalahId: Number(marhalahId), rows: importRows })
    setImporting(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Import selesai: ${res.insertedBab} bab, ${res.insertedBlok} blok, ${res.skipped} dilewati`)
    setImportRows([])
    load()
  }

  const addBlok = async (babId: number) => {
    const input = newBlok[babId] || { label: '', deskripsi: '', urutan: 0 }
    const res = await tambahHafalanBlok({ babId, ...input })
    if ('error' in res) return toast.error(res.error)
    toast.success('Blok ditambahkan')
    setNewBlok(prev => ({ ...prev, [babId]: { label: '', deskripsi: '', urutan: 0 } }))
    load()
  }

  const toggleActive = async (target: 'bab' | 'blok', id: number, active: boolean) => {
    const res = await setHafalanActive(target, id, active)
    if ('error' in res) return toast.error(res.error)
    load()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Master Hafalan"
        description="Atur bab dan blok hafalan per jenis dan marhalah."
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jenis Hafalan</label>
            <select value={jenis} onChange={e => setJenis(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
              {types.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Marhalah</label>
            <select value={marhalahId} onChange={e => setMarhalahId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
              {marhalah.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
        </div>
      </div>

      {jenis === 'quran' ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah Surat Al-Qur'an</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select value={surahNumber} onChange={e => setSurahNumber(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
              {quranSurahs.map(surah => (
                <option key={surah.number} value={surah.number}>
                  {surah.number}. {surah.name} ({surah.ayahCount} ayat)
                </option>
              ))}
            </select>
            <button onClick={addSuratQuran} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Buat Blok Ayat</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Surat akan dibuat sebagai bab, dan setiap ayat otomatis menjadi blok hafalan.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah Bab</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
            <input value={newBab.judul} onChange={e => setNewBab(prev => ({ ...prev, judul: e.target.value }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Contoh: Bab Kalam" />
            <input type="number" value={newBab.urutan} onChange={e => setNewBab(prev => ({ ...prev, urutan: Number(e.target.value || 0) }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Urutan" />
            <button onClick={addBab} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Simpan Bab</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><FileSpreadsheet className="h-4 w-4 text-blue-600" /> Import Excel</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <button onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">
            <Download className="h-4 w-4" /> Download Template
          </button>
          <div className="relative">
            <input type="file" accept=".xlsx,.xls" onChange={handleUploadImport} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
              <Upload className="h-4 w-4" /> Upload Excel
            </button>
          </div>
        </div>
        {importRows.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="flex flex-col gap-3 border-b bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-bold text-slate-700">Preview {importRows.length} baris</p>
              <button onClick={saveImport} disabled={importing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Simpan Import
              </button>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-slate-500">
                  <tr>
                    <th className="p-2">BAB</th>
                    <th className="p-2">BLOK</th>
                    <th className="p-2">DESKRIPSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importRows.slice(0, 20).map((row, index) => (
                    <tr key={index}>
                      <td className="p-2 font-semibold">{row.BAB || row.bab || row['JUDUL BAB'] || '-'}</td>
                      <td className="p-2">{row.BLOK || row.blok || row['LABEL BLOK'] || '-'}</td>
                      <td className="p-2 text-slate-500">{row.DESKRIPSI || row.deskripsi || row.KETERANGAN || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {bab.map(item => (
            <div key={item.id} className="rounded-xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-slate-900"><BookOpenCheck className="h-4 w-4 text-emerald-600" /> {item.judul}</h2>
                  <p className="text-xs text-slate-500">Urutan {item.urutan}</p>
                </div>
                <button onClick={() => toggleActive('bab', item.id, !item.is_active)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {item.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {item.is_active ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
              <div className="p-4">
                <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_100px_auto]">
                  <input value={newBlok[item.id]?.label || ''} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: e.target.value, deskripsi: prev[item.id]?.deskripsi || '', urutan: prev[item.id]?.urutan || 0 } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Label blok" />
                  <input value={newBlok[item.id]?.deskripsi || ''} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: prev[item.id]?.label || '', deskripsi: e.target.value, urutan: prev[item.id]?.urutan || 0 } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Deskripsi opsional" />
                  <input type="number" value={newBlok[item.id]?.urutan || 0} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: prev[item.id]?.label || '', deskripsi: prev[item.id]?.deskripsi || '', urutan: Number(e.target.value || 0) } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                  <button onClick={() => addBlok(item.id)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Tambah Blok</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.blok.map((blok: any) => (
                    <button key={blok.id} onClick={() => toggleActive('blok', blok.id, !blok.is_active)} title={blok.deskripsi || blok.label} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${blok.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                      {blok.label}
                    </button>
                  ))}
                  {item.blok.length === 0 && <p className="text-sm text-slate-400">Belum ada blok.</p>}
                </div>
              </div>
            </div>
          ))}
          {bab.length === 0 && <div className="rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada bab untuk filter ini.</div>}
        </div>
      )}
    </div>
  )
}
