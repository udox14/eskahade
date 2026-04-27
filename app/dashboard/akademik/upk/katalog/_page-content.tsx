'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getKatalogUPK,
  getMarhalahList,
  getMasterKitabOptions,
  getTokoList,
  hapusKatalogUPK,
  hapusTokoUPK,
  importKatalogUPK,
  simpanKatalogUPK,
  simpanTokoUPK,
} from './actions'
import {
  BookOpen,
  CheckCircle,
  Download,
  Edit,
  FileSpreadsheet,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Pagination, { usePagination } from '@/components/ui/pagination'

type KatalogForm = {
  id: string
  kitab_id: string
  nama_kitab: string
  marhalah_id: string
  toko_id: string
  stok_lama: string
  stok_baru: string
  harga_beli: string
  harga_jual: string
  is_active: boolean
  catatan: string
}

type TokoForm = {
  id: string
  nama: string
  is_active: boolean
}

type MarhalahOption = {
  id: number
  nama: string
}

type TokoItem = {
  id: number
  nama: string
  is_active: boolean
}

type MasterKitabItem = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
}

type KatalogItem = {
  id: number
  kitab_id: number | null
  nama_kitab: string
  marhalah_id: number
  toko_id: number | null
  stok_lama: number
  stok_baru: number
  harga_beli: number
  harga_jual: number
  is_active: boolean
  catatan: string | null
  stok_updated_at: string | null
  marhalah_nama: string | null
  toko_nama: string | null
  jumlah_stok: number
  modal: number
  laba_kotor: number
  laba_bersih: number
}

type ImportPreviewRow = {
  [key: string]: string | number | null | undefined
}

const emptyKatalogForm: KatalogForm = {
  id: '',
  kitab_id: '',
  nama_kitab: '',
  marhalah_id: '',
  toko_id: '',
  stok_lama: '0',
  stok_baru: '0',
  harga_beli: '0',
  harga_jual: '0',
  is_active: true,
  catatan: '',
}

const emptyTokoForm: TokoForm = { id: '', nama: '', is_active: true }

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function numberValue(value: string) {
  const parsed = parseInt(value || '0', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function tanggalPendek(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function KatalogUPKPage() {
  const confirm = useConfirm()
  const [katalog, setKatalog] = useState<KatalogItem[]>([])
  const [marhalahList, setMarhalahList] = useState<MarhalahOption[]>([])
  const [tokoList, setTokoList] = useState<TokoItem[]>([])
  const [masterKitab, setMasterKitab] = useState<MasterKitabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [filterMarhalah, setFilterMarhalah] = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [form, setForm] = useState<KatalogForm>(emptyKatalogForm)
  const [tokoForm, setTokoForm] = useState<TokoForm>(emptyTokoForm)
  const [isKatalogModalOpen, setIsKatalogModalOpen] = useState(false)
  const [isTokoModalOpen, setIsTokoModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const stok = numberValue(form.stok_lama) + numberValue(form.stok_baru)
  const modal = stok * numberValue(form.harga_beli)
  const labaKotor = stok * numberValue(form.harga_jual)
  const labaBersih = labaKotor - modal

  const initData = useCallback(async () => {
    const [marhalah, toko, kitab] = await Promise.all([
      getMarhalahList(),
      getTokoList(true),
      getMasterKitabOptions(),
    ])
    setMarhalahList(marhalah)
    setTokoList(toko)
    setMasterKitab(kitab)
  }, [])

  const loadKatalog = useCallback(async () => {
    setLoading(true)
    const data = await getKatalogUPK(submittedSearch, filterMarhalah, filterStatus)
    setKatalog(data)
    setLoading(false)
  }, [filterMarhalah, filterStatus, submittedSearch])

  const loadToko = async () => {
    const toko = await getTokoList(true)
    setTokoList(toko)
  }

  useEffect(() => {
    initData()
  }, [initData])

  useEffect(() => {
    loadKatalog()
  }, [loadKatalog])

  const setField = (key: keyof KatalogForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const resetForm = () => setForm(emptyKatalogForm)

  const openTambahModal = () => {
    resetForm()
    setIsKatalogModalOpen(true)
  }

  const applySearch = () => {
    setSubmittedSearch(search)
  }

  const handlePilihMaster = (id: string) => {
    const selected = masterKitab.find(k => String(k.id) === id)
    setForm(prev => ({
      ...prev,
      kitab_id: id,
      nama_kitab: selected?.nama_kitab ?? prev.nama_kitab,
      marhalah_id: selected?.marhalah_id ? String(selected.marhalah_id) : prev.marhalah_id,
    }))
  }

  const handleEdit = (item: KatalogItem) => {
    setForm({
      id: String(item.id),
      kitab_id: item.kitab_id ? String(item.kitab_id) : '',
      nama_kitab: item.nama_kitab ?? '',
      marhalah_id: item.marhalah_id ? String(item.marhalah_id) : '',
      toko_id: item.toko_id ? String(item.toko_id) : '',
      stok_lama: String(item.stok_lama ?? 0),
      stok_baru: String(item.stok_baru ?? 0),
      harga_beli: String(item.harga_beli ?? 0),
      harga_jual: String(item.harga_jual ?? 0),
      is_active: !!item.is_active,
      catatan: item.catatan ?? '',
    })
    setIsKatalogModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await simpanKatalogUPK(formData)
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success(form.id ? 'Katalog diperbarui' : 'Katalog ditambahkan')
    resetForm()
    setIsKatalogModalOpen(false)
    loadKatalog()
  }

  const handleDelete = async (id: number) => {
    if (!await confirm('Hapus item katalog ini?')) return
    const result = await hapusKatalogUPK(id)
    if ('error' in result) toast.error(result.error)
    else {
      toast.success('Item katalog dihapus')
      loadKatalog()
    }
  }

  const handleSubmitToko = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const result = await simpanTokoUPK(formData)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(tokoForm.id ? 'Toko diperbarui' : 'Toko ditambahkan')
    setTokoForm(emptyTokoForm)
    setIsTokoModalOpen(false)
    loadToko()
  }

  const handleDeleteToko = async (id: number) => {
    if (!await confirm('Hapus toko ini?')) return
    const result = await hapusTokoUPK(id)
    if ('error' in result) toast.error(result.error)
    else {
      toast.success('Toko dihapus')
      loadToko()
    }
  }

  const downloadTemplateImport = async () => {
    const XLSX = await import('xlsx')
    const contohMarhalah = marhalahList[0]?.nama || 'Ibtidaiyyah 1'
    const rows = [
      {
        'NAMA KITAB': 'Jurumiyah',
        'MARHALAH': contohMarhalah,
        'TOKO': 'Katara Printgraph',
        'STOK LAMA': 10,
        'STOK BARU': 40,
        'HARGA BELI': 12000,
        'HARGA JUAL': 15000,
        'CATATAN': 'Contoh, boleh dikosongkan',
      },
      {
        'NAMA KITAB': 'Kitab Tambahan Manual',
        'MARHALAH': contohMarhalah,
        'TOKO': 'Online',
        'STOK LAMA': 0,
        'STOK BARU': 25,
        'HARGA BELI': 8000,
        'HARGA JUAL': 10000,
        'CATATAN': '',
      },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Katalog UPK')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(marhalahList.map(m => ({ 'MARHALAH YANG VALID': m.nama }))),
      'Daftar Marhalah'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(tokoList.map(t => ({ 'TOKO': t.nama }))),
      'Daftar Toko'
    )
    XLSX.writeFile(wb, 'Template_Katalog_UPK.xlsx')
  }

  const handleUploadImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets['Katalog UPK'] || wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<ImportPreviewRow>(sheet, { defval: '' })
      setImportRows(data)
      toast.success(`${data.length} baris terbaca`)
    } catch {
      toast.error('Gagal membaca file Excel.')
    } finally {
      e.target.value = ''
    }
  }

  const handleImportKatalog = async () => {
    if (!importRows.length) return toast.warning('Upload file Excel dulu.')
    setIsImporting(true)
    const result = await importKatalogUPK(importRows)
    setIsImporting(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    const parts = [`${result.inserted} baru`, `${result.updated} diperbarui`]
    if (result.failed) parts.push(`${result.failed} dilewati`)
    toast.success(`Import selesai: ${parts.join(', ')}`)
    result.errors.forEach(msg => toast.warning(msg))
    setImportRows([])
    setIsImportModalOpen(false)
    loadKatalog()
    loadToko()
  }

  const summary = useMemo(() => {
    return katalog.reduce((acc, item) => {
      acc.stok += item.jumlah_stok || 0
      acc.modal += item.modal || 0
      acc.labaBersih += item.laba_bersih || 0
      return acc
    }, { stok: 0, modal: 0, labaBersih: 0 })
  }, [katalog])

  const { paged, safePage, totalPages } = usePagination(katalog, pageSize, page)

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-24">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" /> Katalog UPK
          </h1>
          <p className="text-slate-500 text-sm">Master barang, stok, harga beli, harga jual, dan estimasi laba UPK.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full xl:w-auto">
          <div className="bg-white border rounded-lg px-4 py-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase">Total Stok</p>
            <p className="text-lg font-extrabold text-slate-800">{summary.stok.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase">Modal</p>
            <p className="text-lg font-extrabold text-blue-700">{rupiah(summary.modal)}</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase">Laba Bersih</p>
            <p className="text-lg font-extrabold text-emerald-700">{rupiah(summary.labaBersih)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border flex flex-col lg:flex-row gap-3">
            <button onClick={openTambahModal} className="px-4 py-2.5 bg-amber-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-amber-700">
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-emerald-700">
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => setIsTokoModalOpen(true)} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-blue-700">
              <Store className="w-4 h-4" /> Master Toko
            </button>
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applySearch()}
                placeholder="Cari kitab, toko, atau catatan..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
            <select value={filterMarhalah} onChange={e => setFilterMarhalah(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700">
              <option value="">Semua Marhalah</option>
              {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-sm font-bold text-slate-700">
              <option value="SEMUA">Semua Status</option>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
            </select>
            <button onClick={applySearch} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
              <RefreshCw className="w-4 h-4" /> Muat
            </button>
          </div>

          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[1050px]">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr>
                    <th className="px-4 py-3">Kitab</th>
                    <th className="px-4 py-3">Toko</th>
                    <th className="px-4 py-3 text-center">Stok</th>
                    <th className="px-4 py-3 text-right">Beli</th>
                    <th className="px-4 py-3 text-right">Jual</th>
                    <th className="px-4 py-3 text-right">Modal</th>
                    <th className="px-4 py-3 text-right">Laba Kotor</th>
                    <th className="px-4 py-3 text-right">Laba Bersih</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-16"><Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-600" /></td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-slate-400">Belum ada data katalog.</td></tr>
                  ) : (
                    paged.map(item => (
                      <tr key={item.id} className={!item.is_active ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{item.nama_kitab}</p>
                          <p className="text-xs text-slate-500">{item.marhalah_nama || '-'}{item.kitab_id ? ' - dari master kitab' : ' - manual'}</p>
                          {item.catatan && <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.catatan}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.toko_nama || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <p className="font-extrabold text-slate-800">{item.jumlah_stok}</p>
                          <p className="text-[10px] text-slate-400">L {item.stok_lama} / B {item.stok_baru}</p>
                          <p className="text-[10px] text-slate-400">{tanggalPendek(item.stok_updated_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{rupiah(item.harga_beli)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{rupiah(item.harga_jual)}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-700">{rupiah(item.modal)}</td>
                        <td className="px-4 py-3 text-right font-mono">{rupiah(item.laba_kotor)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{rupiah(item.laba_bersih)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit item">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Hapus item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={katalog.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            />
          </div>
        </div>

      {isKatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-amber-600" />
                {form.id ? 'Edit Item Katalog' : 'Tambah Item Katalog'}
              </h2>
              <button
                onClick={() => { resetForm(); setIsKatalogModalOpen(false) }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <input type="hidden" name="id" value={form.id} />
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Ambil dari Manajemen Kitab</label>
                <select
                  name="kitab_id"
                  value={form.kitab_id}
                  onChange={e => handlePilihMaster(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Manual / tidak terhubung</option>
                  {masterKitab.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kitab} - {k.marhalah_nama || '-'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nama Kitab</label>
                <input
                  name="nama_kitab"
                  required
                  value={form.nama_kitab}
                  onChange={e => setField('nama_kitab', e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                  placeholder="Nama kitab/barang"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Marhalah</label>
                  <select
                    name="marhalah_id"
                    required
                    value={form.marhalah_id}
                    onChange={e => setField('marhalah_id', e.target.value)}
                    className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Pilih</option>
                    {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Toko</label>
                  <select
                    name="toko_id"
                    value={form.toko_id}
                    onChange={e => setField('toko_id', e.target.value)}
                    className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Belum ditentukan</option>
                    {tokoList.filter(t => t.is_active || String(t.id) === form.toko_id).map(t => (
                      <option key={t.id} value={t.id}>{t.nama}{!t.is_active ? ' (nonaktif)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Stok Lama</label>
                  <input name="stok_lama" type="number" min="0" value={form.stok_lama} onChange={e => setField('stok_lama', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Stok Baru</label>
                  <input name="stok_baru" type="number" min="0" value={form.stok_baru} onChange={e => setField('stok_baru', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Harga Beli</label>
                  <input name="harga_beli" type="number" min="0" value={form.harga_beli} onChange={e => setField('harga_beli', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Harga Jual</label>
                  <input name="harga_jual" type="number" min="0" value={form.harga_jual} onChange={e => setField('harga_jual', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 border rounded-lg p-3 text-xs">
                <div>
                  <p className="font-bold text-slate-400 uppercase">Stok</p>
                  <p className="font-extrabold text-slate-800">{stok}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Modal</p>
                  <p className="font-extrabold text-blue-700">{rupiah(modal)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Bersih</p>
                  <p className="font-extrabold text-emerald-700">{rupiah(labaBersih)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                <textarea name="catatan" value={form.catatan} onChange={e => setField('catatan', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm min-h-20" placeholder="Edisi, kualitas cetak, info toko, atau catatan harga" />
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="is_active" type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} className="w-4 h-4" />
                Aktif dan bisa dipakai di kasir
              </label>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => { resetForm(); setIsKatalogModalOpen(false) }} className="px-4 py-2.5 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button disabled={saving} className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {form.id ? 'Simpan Perubahan' : 'Tambah ke Katalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Import Katalog UPK
              </h2>
              <button
                onClick={() => { setImportRows([]); setIsImportModalOpen(false) }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button onClick={downloadTemplateImport} className="border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-4 py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-100">
                  <Download className="w-5 h-5" /> Download Template Excel
                </button>
                <div className="relative">
                  <input type="file" accept=".xlsx,.xls" onChange={handleUploadImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button className="w-full border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-100">
                    <Upload className="w-5 h-5" /> Upload File Excel
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                Kolom utama: <b>NAMA KITAB</b>, <b>MARHALAH</b>, <b>TOKO</b>, <b>STOK LAMA</b>, <b>STOK BARU</b>, <b>HARGA BELI</b>, <b>HARGA JUAL</b>, <b>CATATAN</b>. Jika nama kitab dan marhalah cocok dengan Manajemen Kitab, data otomatis ditautkan; jika tidak, tetap masuk sebagai item manual.
              </div>

              {importRows.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="font-bold text-slate-700 text-sm">Preview {importRows.length} baris</p>
                    <button onClick={() => setImportRows([])} className="text-xs font-bold text-slate-500 hover:text-slate-800">Bersihkan preview</button>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full min-w-[900px] text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Nama Kitab</th>
                          <th className="px-3 py-2">Marhalah</th>
                          <th className="px-3 py-2">Toko</th>
                          <th className="px-3 py-2 text-right">Stok Lama</th>
                          <th className="px-3 py-2 text-right">Stok Baru</th>
                          <th className="px-3 py-2 text-right">Beli</th>
                          <th className="px-3 py-2 text-right">Jual</th>
                          <th className="px-3 py-2">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importRows.slice(0, 50).map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 font-medium text-slate-800">{row['NAMA KITAB'] || row['Nama Kitab'] || row['nama kitab']}</td>
                            <td className="px-3 py-2">{row['MARHALAH'] || row['Marhalah'] || row['marhalah']}</td>
                            <td className="px-3 py-2">{row['TOKO'] || row['Toko'] || row['toko']}</td>
                            <td className="px-3 py-2 text-right font-mono">{row['STOK LAMA'] || row['Stok Lama'] || row['stok lama']}</td>
                            <td className="px-3 py-2 text-right font-mono">{row['STOK BARU'] || row['Stok Baru'] || row['stok baru']}</td>
                            <td className="px-3 py-2 text-right font-mono">{row['HARGA BELI'] || row['Harga Beli'] || row['harga beli']}</td>
                            <td className="px-3 py-2 text-right font-mono">{row['HARGA JUAL'] || row['Harga Jual'] || row['harga jual']}</td>
                            <td className="px-3 py-2">{row['CATATAN'] || row['Catatan'] || row['catatan']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importRows.length > 50 && <p className="px-4 py-2 text-xs text-slate-500 bg-slate-50">Preview hanya menampilkan 50 baris pertama.</p>}
                </div>
              ) : (
                <div className="text-center py-14 border border-dashed rounded-lg text-slate-400">
                  Upload file template untuk melihat preview.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex flex-col sm:flex-row justify-end gap-2">
              <button type="button" onClick={() => { setImportRows([]); setIsImportModalOpen(false) }} className="px-4 py-2.5 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-white">
                Batal
              </button>
              <button onClick={handleImportKatalog} disabled={isImporting || importRows.length === 0} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Simpan Import
              </button>
            </div>
          </div>
        </div>
      )}

      {isTokoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" /> Master Toko
              </h2>
              <button
                onClick={() => { setTokoForm(emptyTokoForm); setIsTokoModalOpen(false) }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <form onSubmit={handleSubmitToko} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <input type="hidden" name="id" value={tokoForm.id} />
                <input name="nama" required value={tokoForm.nama} onChange={e => setTokoForm(prev => ({ ...prev, nama: e.target.value }))} className="p-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Nama toko" />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> {tokoForm.id ? 'Update' : 'Tambah'}
                </button>
                <label className="sm:col-span-2 flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input name="is_active" type="checkbox" checked={tokoForm.is_active} onChange={e => setTokoForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                  Toko aktif
                </label>
              </form>

              <div className="divide-y border rounded-lg overflow-hidden">
                {tokoList.map(toko => (
                  <div key={toko.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-bold text-slate-700">{toko.nama}</p>
                      {!toko.is_active && <p className="text-[10px] font-bold text-slate-400 uppercase">Nonaktif</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setTokoForm({ id: String(toko.id), nama: toko.nama, is_active: toko.is_active })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit toko">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteToko(toko.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Hapus toko">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
