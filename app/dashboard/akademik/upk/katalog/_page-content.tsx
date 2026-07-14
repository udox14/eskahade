'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rupiah } from '@/lib/upk-utils'
import {
  getKatalogUPK,
  getDaftarKitabPerMarhalah,
  getMarhalahList,
  getMasterKitabOptions,
  getTokoList,
  hapusKatalogUPK,
  hapusTokoUPK,
  importKatalogUPK,
  simpanKatalogBatchUPK,
  simpanKatalog as simpanKatalogUPK,
  simpanPengaturanTampilanKatalog,
  simpanTokoUPK,
} from './actions'
import {
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileSpreadsheet,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { PriceListPrintButton } from './_price-list-print'

type MarhalahSel = { marhalah_id: number; is_default: boolean }

type KatalogForm = {
  id: string
  kitab_id: string
  nama_kitab: string
  toko_id: string
  stok_lama: string
  stok_baru: string
  harga_beli: string
  harga_jual: string
  is_active: boolean
  catatan: string
  marhalah: MarhalahSel[]
  is_consignment: boolean
  prioritas_stok: 'LAMA' | 'BARU'
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
  toko_id: number | null
  stok_lama: number
  stok_baru: number
  harga_beli: number
  harga_jual: number
  is_active: boolean
  catatan: string | null
  stok_updated_at: string | null
  marhalah: { marhalah_id: number; nama: string | null; is_default: boolean }[]
  toko_nama: string | null
  jumlah_stok: number
  modal: number
  laba_kotor: number
  laba_bersih: number
  is_consignment: boolean
  prioritas_stok?: 'LAMA' | 'BARU'
}

type ImportPreviewRow = {
  [key: string]: string | number | null | undefined
}

type DaftarMarhalah = Awaited<ReturnType<typeof getDaftarKitabPerMarhalah>>['marhalah'][number]
type VisibilitySettings = Awaited<ReturnType<typeof getDaftarKitabPerMarhalah>>['settings']

const emptyKatalogForm: KatalogForm = {
  id: '',
  kitab_id: '',
  nama_kitab: '',
  toko_id: '',
  stok_lama: '',
  stok_baru: '0',
  harga_beli: '',
  harga_jual: '',
  is_active: true,
  catatan: '',
  marhalah: [],
  is_consignment: false,
  prioritas_stok: 'LAMA',
}

const emptyTokoForm: TokoForm = { id: '', nama: '', is_active: true }

type BatchRow = {
  checked: boolean
  toko_id: string
  stok_lama: string
  harga_beli: string
  harga_jual: string
  catatan: string
}

const emptyBatchRow: BatchRow = {
  checked: false,
  toko_id: '',
  stok_lama: '',
  harga_beli: '',
  harga_jual: '',
  catatan: '',
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
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchMarhalah, setBatchMarhalah] = useState('')
  const [batchRows, setBatchRows] = useState<Record<string, BatchRow>>({})
  const [batchSaving, setBatchSaving] = useState(false)
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState<'DAFTAR' | 'KELOLA'>('DAFTAR')
  const [daftarMarhalah, setDaftarMarhalah] = useState<DaftarMarhalah[]>([])
  const [visibility, setVisibility] = useState<VisibilitySettings>({ showItemPrices: true, showTotalPrice: true })
  const [daftarLoading, setDaftarLoading] = useState(true)
  const [visibilitySaving, setVisibilitySaving] = useState<keyof VisibilitySettings | null>(null)

  const stok = numberValue(form.stok_lama) + numberValue(form.stok_baru)
  const modal = stok * numberValue(form.harga_beli)
  const labaKotor = stok * numberValue(form.harga_jual)
  const labaBersih = labaKotor - modal

  const initData = useCallback(async () => {
    try {
      const [marhalah, toko, kitab, daftar] = await Promise.all([
        getMarhalahList(),
        getTokoList(true),
        getMasterKitabOptions(),
        getDaftarKitabPerMarhalah(),
      ])
      setMarhalahList(marhalah)
      setTokoList(toko)
      setMasterKitab(kitab)
      setDaftarMarhalah(daftar.marhalah)
      setVisibility(daftar.settings)
    } catch (error) {
      console.error('[UPK Katalog] Gagal memuat data awal', error)
      toast.error('Gagal memuat data awal katalog.')
    } finally {
      setDaftarLoading(false)
    }
  }, [])

  const loadKatalog = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getKatalogUPK(submittedSearch, filterMarhalah, filterStatus)
      setKatalog(data)
    } catch (error) {
      console.error('[UPK Katalog] Gagal memuat katalog', error)
      setKatalog([])
      toast.error('Gagal memuat katalog UPK.')
    } finally {
      setLoading(false)
    }
  }, [filterMarhalah, filterStatus, submittedSearch])

  const loadToko = async () => {
    const toko = await getTokoList(true)
    setTokoList(toko)
  }

  const reloadDaftar = async () => {
    const daftar = await getDaftarKitabPerMarhalah()
    setDaftarMarhalah(daftar.marhalah)
    setVisibility(daftar.settings)
  }

  const toggleVisibility = async (key: keyof VisibilitySettings) => {
    if (visibilitySaving) return
    const previous = visibility
    const next = { ...visibility, [key]: !visibility[key] }
    setVisibility(next)
    setVisibilitySaving(key)
    try {
      const result = await simpanPengaturanTampilanKatalog(next)
      if ('error' in result) {
        setVisibility(previous)
        toast.error(result.error)
      } else {
        toast.success('Pengaturan tampilan disimpan')
      }
    } catch {
      setVisibility(previous)
      toast.error('Gagal menyimpan pengaturan tampilan.')
    } finally {
      setVisibilitySaving(null)
    }
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

  const existingKitabIds = useMemo(
    () => new Set(katalog.map(item => item.kitab_id).filter(Boolean) as number[]),
    [katalog]
  )

  const batchKitabList = useMemo(
    () => (batchMarhalah ? masterKitab.filter(k => String(k.marhalah_id) === batchMarhalah) : []),
    [batchMarhalah, masterKitab]
  )

  const batchSelectedCount = useMemo(
    () => Object.values(batchRows).filter(r => r.checked).length,
    [batchRows]
  )

  const openBatchModal = () => {
    setBatchMarhalah('')
    setBatchRows({})
    setIsBatchModalOpen(true)
  }

  const toggleBatchRow = (id: number) => {
    setBatchRows(prev => {
      const current = prev[id] ?? emptyBatchRow
      return { ...prev, [id]: { ...current, checked: !current.checked } }
    })
  }

  const setBatchField = (id: number, key: keyof BatchRow, value: string) => {
    setBatchRows(prev => {
      const current = prev[id] ?? emptyBatchRow
      return { ...prev, [id]: { ...current, [key]: value } }
    })
  }

  const toggleBatchAll = (checked: boolean) => {
    setBatchRows(prev => {
      const next = { ...prev }
      batchKitabList.forEach(k => {
        if (existingKitabIds.has(k.id)) return
        const current = next[k.id] ?? emptyBatchRow
        next[k.id] = { ...current, checked }
      })
      return next
    })
  }

  const handleSubmitBatch = async () => {
    const items = batchKitabList
      .filter(k => batchRows[k.id]?.checked && !existingKitabIds.has(k.id))
      .map(k => {
        const row = batchRows[k.id]
        return {
          kitab_id: k.id,
          nama_kitab: k.nama_kitab,
          marhalah_id: Number(batchMarhalah),
          toko_id: row.toko_id ? Number(row.toko_id) : null,
          stok_lama: numberValue(row.stok_lama),
          harga_beli: numberValue(row.harga_beli),
          harga_jual: numberValue(row.harga_jual),
          catatan: row.catatan,
        }
      })

    if (!items.length) {
      toast.warning('Ceklis minimal satu kitab dulu.')
      return
    }

    setBatchSaving(true)
    const result = await simpanKatalogBatchUPK(items)
    setBatchSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    const parts = [`${result.inserted} ditambahkan`]
    if (result.skipped) parts.push(`${result.skipped} dilewati`)
    toast.success(`Batch selesai: ${parts.join(', ')}`)
    if (result.skippedReasons.length) {
      toast.warning(`Dilewati: ${result.skippedReasons.join('; ')}`)
    }
    setIsBatchModalOpen(false)
    setBatchRows({})
    loadKatalog()
    reloadDaftar()
  }

  const applySearch = () => {
    setSubmittedSearch(search)
  }

  const handlePilihMaster = (id: string) => {
    const selected = masterKitab.find(k => String(k.id) === id)
    setForm(prev => {
      const next: KatalogForm = { ...prev, kitab_id: id, nama_kitab: selected?.nama_kitab ?? prev.nama_kitab }
      // auto-tambah marhalah master kalau belum ada
      if (selected?.marhalah_id && !prev.marhalah.some(m => m.marhalah_id === selected.marhalah_id)) {
        next.marhalah = [...prev.marhalah, { marhalah_id: selected.marhalah_id, is_default: prev.marhalah.length === 0 }]
      }
      return next
    })
  }

  const toggleFormMarhalah = (marhalahId: number) => {
    setForm(prev => {
      const exists = prev.marhalah.some(m => m.marhalah_id === marhalahId)
      if (exists) return { ...prev, marhalah: prev.marhalah.filter(m => m.marhalah_id !== marhalahId) }
      return { ...prev, marhalah: [...prev.marhalah, { marhalah_id: marhalahId, is_default: false }] }
    })
  }

  const toggleFormDefault = (marhalahId: number) => {
    setForm(prev => ({
      ...prev,
      marhalah: prev.marhalah.map(m => m.marhalah_id === marhalahId ? { ...m, is_default: !m.is_default } : m),
    }))
  }

  const handleEdit = (item: KatalogItem) => {
    setForm({
      id: String(item.id),
      kitab_id: item.kitab_id ? String(item.kitab_id) : '',
      nama_kitab: item.nama_kitab ?? '',
      toko_id: item.toko_id ? String(item.toko_id) : '',
      stok_lama: String(item.stok_lama ?? 0),
      stok_baru: String(item.stok_baru ?? 0),
      harga_beli: String(item.harga_beli ?? 0),
      harga_jual: String(item.harga_jual ?? 0),
      is_active: !!item.is_active,
      is_consignment: !!item.is_consignment,
      prioritas_stok: item.prioritas_stok ?? 'LAMA',
      catatan: item.catatan ?? '',
      marhalah: item.marhalah.map(m => ({ marhalah_id: m.marhalah_id, is_default: m.is_default })),
    })
    setIsKatalogModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.marhalah.length) {
      toast.warning('Pilih minimal satu marhalah.')
      return
    }
    setSaving(true)
    const result = await simpanKatalogUPK({
      id: form.id ? Number(form.id) : null,
      kitab_id: form.kitab_id ? Number(form.kitab_id) : null,
      nama_kitab: form.nama_kitab,
      toko_id: form.toko_id ? Number(form.toko_id) : null,
      stok_lama: numberValue(form.stok_lama),
      harga_beli: numberValue(form.harga_beli),
      harga_jual: numberValue(form.harga_jual),
      is_active: form.is_active,
      catatan: form.catatan,
      marhalah: form.marhalah,
      is_consignment: form.is_consignment,
      prioritas_stok: form.prioritas_stok,
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success(form.id ? 'Katalog diperbarui' : 'Katalog ditambahkan')
    resetForm()
    setIsKatalogModalOpen(false)
    loadKatalog()
    reloadDaftar()
  }

  const handleDelete = async (id: number) => {
    if (!await confirm('Hapus item katalog ini?')) return
    const result = await hapusKatalogUPK(id)
    if ('error' in result) toast.error(result.error)
    else {
      toast.success('Item katalog dihapus')
      loadKatalog()
      reloadDaftar()
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
        'HARGA BELI': 12000,
        'HARGA JUAL': 15000,
        'CATATAN': 'Contoh, boleh dikosongkan',
      },
      {
        'NAMA KITAB': 'Kitab Tambahan Manual',
        'MARHALAH': contohMarhalah,
        'TOKO': 'Online',
        'STOK LAMA': 0,
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
    reloadDaftar()
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
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      <DashboardPageHeader
        title="Katalog UPK"
        description={activeTab === 'DAFTAR' ? 'Pilih daftar kitab per marhalah dan lihat perkiraan total harganya.' : 'Master barang, stok, harga beli, harga jual, dan estimasi laba UPK.'}
        className="border-b pb-4"
        action={activeTab === 'KELOLA' ? (
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
        ) : undefined}
      />

      <div className="grid grid-cols-2 rounded-xl border bg-slate-100 p-1" role="tablist" aria-label="Katalog UPK">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'DAFTAR'}
          onClick={() => setActiveTab('DAFTAR')}
          className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${activeTab === 'DAFTAR' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Daftar Kitab
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'KELOLA'}
          onClick={() => setActiveTab('KELOLA')}
          className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${activeTab === 'KELOLA' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Kelola Katalog
        </button>
      </div>

      {activeTab === 'DAFTAR' ? (
        <DaftarKitabMarhalah
          key={daftarLoading ? 'loading' : 'ready'}
          marhalah={daftarMarhalah}
          settings={visibility}
          loading={daftarLoading}
        />
      ) : (
      <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-amber-600" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">Tampilan Daftar Kitab</h2>
                <p className="text-xs text-slate-500">Pengaturan ini berlaku untuk seluruh marhalah.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <VisibilityToggle
                label="Tampilkan harga per kitab"
                description="Nominal harga jual muncul pada setiap item."
                checked={visibility.showItemPrices}
                loading={visibilitySaving === 'showItemPrices'}
                onClick={() => toggleVisibility('showItemPrices')}
              />
              <VisibilityToggle
                label="Tampilkan total harga"
                description="Total pilihan muncul di bagian bawah card."
                checked={visibility.showTotalPrice}
                loading={visibilitySaving === 'showTotalPrice'}
                onClick={() => toggleVisibility('showTotalPrice')}
              />
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border flex flex-col lg:flex-row gap-3">
            <button onClick={openBatchModal} className="px-4 py-2.5 bg-amber-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-amber-700">
              <Plus className="w-4 h-4" /> Tambah Kitab
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
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.marhalah.length === 0 && <span className="text-xs text-slate-400">Tanpa marhalah</span>}
                            {item.marhalah.map(m => (
                              <span key={m.marhalah_id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.is_default ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                {m.is_default ? '★ ' : ''}{m.nama || '-'}
                              </span>
                            ))}
                            {!!item.is_consignment && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                Konsinyasi
                              </span>
                            )}
                            {item.prioritas_stok === 'BARU' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                Stok Baru Dahulu
                              </span>
                            )}
                          </div>
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
      )}

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

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Marhalah & Default Kasir</label>
                <p className="text-[11px] text-slate-400 mb-2">Ceklis marhalah tempat kitab ini dijual. Centang ★ kalau mau auto-terpilih di kasir untuk marhalah itu. Stok tetap satu pool.</p>
                <div className="border border-slate-200 rounded-lg divide-y max-h-56 overflow-y-auto">
                  {marhalahList.map(m => {
                    const sel = form.marhalah.find(x => x.marhalah_id === m.id)
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${sel ? 'bg-amber-50/60' : ''}`}>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4" checked={!!sel} onChange={() => toggleFormMarhalah(m.id)} />
                          <span className="font-bold text-slate-700">{m.nama}</span>
                        </label>
                        <label className={`flex items-center gap-1.5 text-xs font-bold ${sel ? 'text-amber-700 cursor-pointer' : 'text-slate-300'}`}>
                          <input type="checkbox" className="w-4 h-4" disabled={!sel} checked={!!sel?.is_default} onChange={() => toggleFormDefault(m.id)} />
                          ★ Default
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Toko</label>
                <select
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Stok Lama</label>
                  <input name="stok_lama" type="number" min="0" value={form.stok_lama} onChange={e => setField('stok_lama', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Stok Baru</label>
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-extrabold text-slate-800">{Number(form.stok_baru || 0).toLocaleString('id-ID')}</p>
                    <p className="text-[11px] font-semibold text-slate-400">Ditambah otomatis dari Belanja</p>
                  </div>
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

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Prioritas Pengurangan Stok</label>
                <select
                  name="prioritas_stok"
                  value={form.prioritas_stok}
                  onChange={e => setField('prioritas_stok', e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="LAMA">Habiskan Stok Lama Dulu (Default)</option>
                  <option value="BARU">Habiskan Stok Baru Dulu</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1 font-semibold">Menentukan stok mana yang akan dipotong terlebih dahulu saat penjualan di kasir.</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input name="is_active" type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} className="w-4 h-4" />
                  Aktif dan bisa dipakai di kasir
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input name="is_consignment" type="checkbox" checked={form.is_consignment} onChange={e => setField('is_consignment', e.target.checked)} className="w-4 h-4" />
                  Kitab Konsinyasi (Sisa stok bisa dikembalikan ke toko)
                </label>
              </div>

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

      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-amber-600" /> Tambah Kitab ke Katalog
              </h2>
              <button
                onClick={() => { setIsBatchModalOpen(false); setBatchRows({}) }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 border-b bg-white flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Pilih Marhalah</label>
                <select
                  value={batchMarhalah}
                  onChange={e => { setBatchMarhalah(e.target.value); setBatchRows({}) }}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-bold text-slate-700"
                >
                  <option value="">Pilih marhalah dulu...</option>
                  {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              {batchMarhalah && (
                <div className="text-sm font-bold text-slate-500 pb-2.5">
                  {batchSelectedCount} dipilih dari {batchKitabList.length} kitab
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!batchMarhalah ? (
                <div className="text-center py-20 text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  Pilih marhalah untuk menampilkan daftar kitab.
                </div>
              ) : batchKitabList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">Tidak ada kitab pada marhalah ini di Manajemen Kitab.</div>
              ) : (
                <table className="w-full text-sm text-left min-w-[1000px]">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={batchSelectedCount > 0 && batchSelectedCount === batchKitabList.filter(k => !existingKitabIds.has(k.id)).length}
                          onChange={e => toggleBatchAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-3">Kitab</th>
                      <th className="px-3 py-3 w-44">Toko</th>
                      <th className="px-3 py-3 w-28 text-right">Stok Lama</th>
                      <th className="px-3 py-3 w-32 text-right">Harga Beli</th>
                      <th className="px-3 py-3 w-32 text-right">Harga Jual</th>
                      <th className="px-3 py-3 w-48">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batchKitabList.map(k => {
                      const sudahAda = existingKitabIds.has(k.id)
                      const row = batchRows[k.id] ?? emptyBatchRow
                      return (
                        <tr key={k.id} className={sudahAda ? 'bg-slate-50 text-slate-400' : row.checked ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4"
                              disabled={sudahAda}
                              checked={!sudahAda && row.checked}
                              onChange={() => toggleBatchRow(k.id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-bold text-slate-800">{k.nama_kitab}</p>
                            {sudahAda && <p className="text-[10px] font-bold text-amber-600 uppercase">Sudah di katalog</p>}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.toko_id}
                              disabled={sudahAda || !row.checked}
                              onChange={e => setBatchField(k.id, 'toko_id', e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-100"
                            >
                              <option value="">Belum ditentukan</option>
                              {tokoList.filter(t => t.is_active).map(t => (
                                <option key={t.id} value={t.id}>{t.nama}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" placeholder="0"
                              value={row.stok_lama}
                              disabled={sudahAda || !row.checked}
                              onChange={e => setBatchField(k.id, 'stok_lama', e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm text-right disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" placeholder="0"
                              value={row.harga_beli}
                              disabled={sudahAda || !row.checked}
                              onChange={e => setBatchField(k.id, 'harga_beli', e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm text-right disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" placeholder="0"
                              value={row.harga_jual}
                              disabled={sudahAda || !row.checked}
                              onChange={e => setBatchField(k.id, 'harga_jual', e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm text-right disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.catatan}
                              disabled={sudahAda || !row.checked}
                              onChange={e => setBatchField(k.id, 'catatan', e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100"
                              placeholder="Opsional"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex flex-col sm:flex-row justify-end gap-2">
              <button type="button" onClick={() => { setIsBatchModalOpen(false); setBatchRows({}) }} className="px-4 py-2.5 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-white">
                Batal
              </button>
              <button onClick={handleSubmitBatch} disabled={batchSaving || batchSelectedCount === 0} className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {batchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Tambah {batchSelectedCount > 0 ? `${batchSelectedCount} ` : ''}Kitab
              </button>
            </div>
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
                Kolom utama: <b>NAMA KITAB</b>, <b>MARHALAH</b>, <b>TOKO</b>, <b>STOK LAMA</b>, <b>HARGA BELI</b>, <b>HARGA JUAL</b>, <b>CATATAN</b>. Stok baru ditambah otomatis dari fitur Belanja. Jika nama kitab dan marhalah cocok dengan Manajemen Kitab, data otomatis ditautkan; jika tidak, tetap masuk sebagai item manual.
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

function VisibilityToggle({
  label,
  description,
  checked,
  loading,
  onClick,
}: {
  label: string
  description: string
  checked: boolean
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={loading}
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50 disabled:opacity-70"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-700">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      {loading ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-600" />
      ) : (
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-amber-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      )}
    </button>
  )
}

function DaftarKitabMarhalah({
  marhalah,
  settings,
  loading,
}: {
  marhalah: DaftarMarhalah[]
  settings: VisibilitySettings
  loading: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(
    marhalah.flatMap(group => group.items.map(item => [`${group.id}:${item.id}`, item.is_default]))
  ))
  const touchStartX = useRef<number | null>(null)

  const goTo = (index: number) => {
    if (!marhalah.length) return
    setActiveIndex(Math.max(0, Math.min(index, marhalah.length - 1)))
  }

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const distance = event.changedTouches[0]?.clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(distance) < 45) return
    goTo(activeIndex + (distance < 0 ? 1 : -1))
  }

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center rounded-2xl border bg-white"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>
  }

  if (!marhalah.length) {
    return <div className="rounded-2xl border border-dashed bg-white py-16 text-center text-sm text-slate-400">Belum ada marhalah.</div>
  }

  const group = marhalah[activeIndex]
  const selectedItems = group.items.filter(item => selected[`${group.id}:${item.id}`])
  const total = selectedItems.reduce((sum, item) => sum + item.harga_jual, 0)

  return (
    <section className="mx-auto w-full max-w-2xl" aria-label="Daftar kitab per marhalah">
      <div className="mb-4 flex justify-center sm:justify-end">
        <PriceListPrintButton marhalah={marhalah} />
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Marhalah sebelumnya"
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Marhalah {activeIndex + 1} dari {marhalah.length}</p>
          <h2 className="truncate text-xl font-black text-slate-900">{group.nama}</h2>
        </div>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === marhalah.length - 1}
          aria-label="Marhalah berikutnya"
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div
        key={group.id}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="animate-in fade-in slide-in-from-right-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm duration-300 motion-reduce:animate-none"
      >
        <div className="border-b bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-800">Paket Kitab {group.nama}</p>
              <p className="mt-0.5 text-xs text-slate-500">Ketuk kitab untuk mengubah pilihan.</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">{group.items.length} kitab</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {group.items.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p className="text-sm font-bold text-slate-500">Belum ada kitab aktif</p>
              <p className="mt-1 text-xs text-slate-400">Tambahkan kitab untuk marhalah ini melalui tab Kelola Katalog.</p>
            </div>
          ) : group.items.map(item => {
            const key = `${group.id}:${item.id}`
            const checked = !!selected[key]
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={checked}
                onClick={() => setSelected(current => ({ ...current, [key]: !current[key] }))}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:px-5 ${checked ? 'bg-amber-50/60' : 'bg-white hover:bg-slate-50'}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${checked ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                  <CheckCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold leading-snug text-slate-800">{item.nama_kitab}</span>
                    {item.is_default && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-700">Default</span>}
                  </span>
                </span>
                {settings.showItemPrices && <span className="shrink-0 font-mono text-sm font-extrabold text-emerald-700">{rupiah(item.harga_jual)}</span>}
              </button>
            )
          })}
        </div>

        <div className="border-t bg-slate-900 px-4 py-4 text-white sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400">{selectedItems.length} dari {group.items.length} kitab dipilih</p>
              {settings.showTotalPrice && <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-400">Total harga</p>}
            </div>
            {settings.showTotalPrice && <p className="font-mono text-xl font-black text-white">{rupiah(total)}</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Pilih marhalah">
        {marhalah.map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => goTo(index)}
            aria-label={`Buka ${item.nama}`}
            aria-current={index === activeIndex ? 'step' : undefined}
            className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-amber-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400 sm:hidden">Geser card ke kiri atau kanan untuk pindah marhalah</p>
    </section>
  )
}
