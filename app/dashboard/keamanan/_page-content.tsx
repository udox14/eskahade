'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  CheckSquare,
  Download,
  Edit2,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { RowActionMenu, RowActionItem } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  editMasterPelanggaran,
  getDaftarPelanggar,
  getDataExportPelanggaran,
  getMasterPelanggaran,
  getOpsiExportPelanggaran,
  hapusMasterPelanggaran,
  importMasterPelanggaranMassal,
  tambahMasterPelanggaran,
  type DaftarPelanggarItem,
  type ExportPelanggaranFilter,
  type MasterPelanggaranItem,
  type SantriSearchResult,
} from './actions'
import {
  button,
  control,
  Empty,
  Field,
  ListLoading,
  Modal,
  Pager,
  primary,
  primaryRose,
  SpBadge,
  StudentIdentity,
} from './_components'
import { DetailDrawer } from './detail-drawer'
import { ModalInputPelanggaran } from './_forms'
import { HistoryReview } from './history-review'
import { getDaftarPelanggarCacheKey, keamananCache } from './_cache'

function fmtTgl(s?: string | null) {
  if (!s) return '—'
  try {
    return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale })
  } catch {
    return s
  }
}

const KATEGORI_DOT: Record<string, string> = {
  RINGAN: 'bg-slate-400',
  SEDANG: 'bg-amber-400',
  BERAT: 'bg-rose-500',
}

type TabType = 'daftar' | 'verifikasi' | 'kamus'

type ImportKamusRow = {
  kategori: string
  nama_pelanggaran: string
  deskripsi: string
  urutan: number
}

function ModalExportPelanggaran({ onClose }: { onClose: () => void }) {
  const [loadingOpts, setLoadingOpts] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [asramas, setAsramas] = useState<string[]>([])
  const [santri, setSantri] = useState<
    Array<{ id: string; nama_lengkap: string; nis: string | null; asrama: string | null; kamar: string | null }>
  >([])
  const [selectedAsramas, setSelectedAsramas] = useState<string[]>([])
  const [selectedSantriIds, setSelectedSantriIds] = useState<string[]>([])
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    let alive = true
    getOpsiExportPelanggaran().then((res) => {
      if (!alive) return
      if ('error' in res) {
        toast.error(res.error)
        onClose()
        return
      }
      setAsramas(res.asramas)
      setSantri(res.santri)
      setLoadingOpts(false)
    })
    return () => {
      alive = false
    }
  }, [onClose])

  const toggleAsrama = (asrama: string) => {
    setSelectedAsramas((prev) =>
      prev.includes(asrama) ? prev.filter((item) => item !== asrama) : [...prev, asrama]
    )
  }

  const toggleSantri = (id: string) => {
    setSelectedSantriIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const filteredSantri = santri.filter((item) => {
    const q = keyword.trim().toLowerCase()
    const matchKeyword =
      !q ||
      item.nama_lengkap.toLowerCase().includes(q) ||
      String(item.nis || '').toLowerCase().includes(q)
    const matchAsrama =
      selectedAsramas.length === 0 || selectedAsramas.includes(item.asrama || '')
    return matchKeyword && matchAsrama
  })

  const selectedSantriList = santri.filter((item) => selectedSantriIds.includes(item.id))

  const handleExport = async () => {
    if (tanggalMulai && tanggalSelesai && tanggalMulai > tanggalSelesai) {
      toast.error('Tanggal mulai tidak boleh melebihi tanggal selesai.')
      return
    }

    setExporting(true)
    try {
      const filter: ExportPelanggaranFilter = {
        asramas: selectedAsramas.length ? selectedAsramas : undefined,
        santriIds: selectedSantriIds.length ? selectedSantriIds : undefined,
        tanggalMulai: tanggalMulai || undefined,
        tanggalSelesai: tanggalSelesai || undefined,
      }
      const res = await getDataExportPelanggaran(filter)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (res.rows.length === 0) {
        toast.info('Tidak ada data sesuai pilihan export')
        return
      }

      const XLSX = await import('xlsx')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = res.rows.map((row: any, index: number) => ({
        No: index + 1,
        'Tanggal Pelanggaran': row.tanggal || '',
        'Waktu Input': row.created_at || '',
        NIS: row.nis || '',
        'Nama Santri': row.nama_lengkap || '',
        Asrama: row.asrama || '',
        Kamar: row.kamar || '',
        Kategori: row.jenis || '',
        'Nama Pelanggaran': row.nama_pelanggaran || '',
        Deskripsi: row.deskripsi || '',
        'Jumlah Kejadian': Number(row.jumlah_kejadian || 0),
        'Perlu Verifikasi': row.perlu_verifikasi ? 'Ya' : 'Tidak',
        Sumber: row.source === 'pengajian' ? 'Pengajian' : 'Umum',
        Sesi: row.sesi || '',
        Penindak: row.penindak_nama || '',
        'Foto Bukti': row.foto_url || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 28 },
        { wch: 18 },
        { wch: 10 },
        { wch: 12 },
        { wch: 26 },
        { wch: 42 },
        { wch: 8 },
        { wch: 22 },
        { wch: 32 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Pelanggaran')

      const suffix =
        [tanggalMulai, tanggalSelesai].filter(Boolean).join('_sd_') ||
        new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `Export_Pelanggaran_${suffix}.xlsx`)
      toast.success(`${res.rows.length} catatan pelanggaran berhasil diexport`)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'kesalahan tidak diketahui'
      toast.error(`Export gagal: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title="Export Data Pelanggaran"
      busy={exporting}
      onClose={onClose}
      wide
      footer={
        <div className="flex w-full sm:w-auto items-center justify-end gap-2">
          <button
            type="button"
            className={button}
            disabled={exporting}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loadingOpts || exporting}
            onClick={handleExport}
            className={cn(primary, 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{exporting ? 'Menyiapkan XLSX…' : 'Download XLSX'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {loadingOpts ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="text-xs">Memuat opsi export…</span>
          </div>
        ) : (
          <>
            {/* Rentang Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tanggal Mulai">
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className={control}
                />
              </Field>
              <Field label="Tanggal Selesai">
                <input
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className={control}
                />
              </Field>
            </div>

            {/* Filter Asrama */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Filter Asrama
                </label>
                {selectedAsramas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAsramas([])}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Reset pilihan
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {asramas.map((asrama) => (
                  <button
                    type="button"
                    key={asrama}
                    onClick={() => toggleAsrama(asrama)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer',
                      selectedAsramas.includes(asrama)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {asrama}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Santri */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Filter Santri Tertentu <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                </label>
                {selectedSantriIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSantriIds([])}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Reset pilihan ({selectedSantriIds.length})
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari santri..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={control + ' pl-9 text-xs min-h-9'}
                />
              </div>

              {selectedSantriList.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedSantriList.slice(0, 6).map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/60"
                    >
                      <span>{item.nama_lengkap}</span>
                      <button
                        type="button"
                        onClick={() => toggleSantri(item.id)}
                        className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedSantriList.length > 6 && (
                    <span className="text-xs text-slate-400 self-center">
                      +{selectedSantriList.length - 6} lainnya
                    </span>
                  )}
                </div>
              )}

              <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {filteredSantri.slice(0, 60).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleSantri(item.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition cursor-pointer"
                  >
                    {selectedSantriIds.includes(item.id) ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.nama_lengkap}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.asrama || '-'}{item.kamar ? ` / ${item.kamar}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function KeamananPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<TabType>('daftar')
  const [refresh, setRefresh] = useState(0)
  const [unverifiedTotal, setUnverifiedTotal] = useState<number>(0)

  // ─── MASTER KAMUS STATE ───────────────────────────────────────────────────
  const [masterList, setMasterList] = useState<MasterPelanggaranItem[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const loadMaster = useCallback(async () => {
    setLoadingMaster(true)
    try {
      const res = await getMasterPelanggaran()
      setMasterList(res)
    } finally {
      setLoadingMaster(false)
    }
  }, [])

  useEffect(() => {
    void loadMaster()
  }, [loadMaster, refresh])

  // ─── DAFTAR PELANGGAR STATE ───────────────────────────────────────────────
  const [rows, setRows] = useState<DaftarPelanggarItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingDaftar, setLoadingDaftar] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Modals & Drawer
  const [selectedSantriId, setSelectedSantriId] = useState<string | null>(null)
  const [showInputModal, setShowInputModal] = useState(false)
  const [preselectedSantri, setPreselectedSantri] = useState<SantriSearchResult | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // ─── LOAD DAFTAR PELANGGAR DENGAN SWR CACHING ────────────────────────────
  const loadDaftar = useCallback(
    async (pg = page, s = search) => {
      const cacheKey = getDaftarPelanggarCacheKey(s, undefined, pg)
      const cached = keamananCache.get<{ rows: DaftarPelanggarItem[]; total: number; totalPages: number }>(cacheKey)

      if (cached) {
        // Fast-path: Instant UI update from cache without loading skeleton!
        setRows(cached.rows)
        setTotal(cached.total)
        setTotalPages(cached.totalPages)
        setPage(pg)
        setLoadingDaftar(false)

        if (keamananCache.isFresh(cacheKey, 60_000)) return
      } else {
        setLoadingDaftar(true)
      }

      try {
        const res = await getDaftarPelanggar({ search: s || undefined, page: pg })
        setRows(res.rows)
        setTotal(res.total)
        setTotalPages(res.totalPages)
        setPage(pg)
        keamananCache.set(cacheKey, res)
      } finally {
        setLoadingDaftar(false)
      }
    },
    [page, search]
  )

  useEffect(() => {
    void loadDaftar(page, search)
  }, [loadDaftar, page, search, refresh])

  const handleRefreshAll = () => {
    keamananCache.clear()
    setRefresh((n) => n + 1)
  }

  // ─── KAMUS FORM STATE ─────────────────────────────────────────────────────
  const [kamusForm, setKamusForm] = useState({ kategori: 'RINGAN', nama: '', deskripsi: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [savingKamus, setSavingKamus] = useState(false)
  const [deletingKamusId, setDeletingKamusId] = useState<number | null>(null)

  // Import Kamus
  const [importRows, setImportRows] = useState<ImportKamusRow[]>([])
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const handleSimpanKamus = async () => {
    if (!kamusForm.nama.trim()) {
      toast.error('Nama pelanggaran wajib diisi')
      return
    }
    setSavingKamus(true)
    try {
      const res = editId
        ? await editMasterPelanggaran(editId, kamusForm)
        : await tambahMasterPelanggaran(kamusForm)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(editId ? 'Jenis pelanggaran diperbarui' : 'Jenis pelanggaran ditambahkan')
      setKamusForm({ kategori: 'RINGAN', nama: '', deskripsi: '' })
      setEditId(null)
      keamananCache.clear()
      await loadMaster()
    } finally {
      setSavingKamus(false)
    }
  }

  const handleHapusKamus = async (id: number) => {
    const ok = await confirm('Hapus jenis pelanggaran ini?')
    if (!ok) return

    setDeletingKamusId(id)
    try {
      const res = await hapusMasterPelanggaran(id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Jenis pelanggaran dihapus')
      keamananCache.clear()
      await loadMaster()
    } finally {
      setDeletingKamusId(null)
    }
  }

  const downloadKamusTemplate = async () => {
    const XLSX = await import('xlsx')
    const templateRows: ImportKamusRow[] = [
      {
        kategori: 'RINGAN',
        nama_pelanggaran: 'Terlambat mengikuti kegiatan',
        deskripsi: 'Tidak hadir tepat waktu pada kegiatan wajib',
        urutan: 10,
      },
      {
        kategori: 'SEDANG',
        nama_pelanggaran: 'Meninggalkan asrama tanpa izin',
        deskripsi: 'Keluar area asrama tanpa izin pengurus',
        urutan: 20,
      },
      {
        kategori: 'BERAT',
        nama_pelanggaran: 'Berkelahi',
        deskripsi: 'Terlibat perkelahian atau kekerasan fisik',
        urutan: 30,
      },
    ]
    const ws = XLSX.utils.json_to_sheet(
      templateRows.map((row) => ({
        KATEGORI: row.kategori,
        'NAMA PELANGGARAN': row.nama_pelanggaran,
        DESKRIPSI: row.deskripsi,
        URUTAN: row.urutan,
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kamus Pelanggaran')
    XLSX.writeFile(wb, 'Template_Kamus_Pelanggaran.xlsx')
  }

  const handleUploadKamusImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const readImportVal = (row: Record<string, unknown>, keys: string[]) => {
        const found = Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()))
        return found ? row[found] : ''
      }

      const parsed = rawRows
        .map((row) => ({
          kategori: String(readImportVal(row, ['kategori']) || '').trim().toUpperCase(),
          nama_pelanggaran: String(
            readImportVal(row, ['nama pelanggaran', 'nama_pelanggaran', 'nama']) || ''
          ).trim(),
          deskripsi: String(readImportVal(row, ['deskripsi', 'keterangan']) || '').trim(),
          urutan: Number(readImportVal(row, ['urutan']) || 0),
        }))
        .filter((row) => row.kategori || row.nama_pelanggaran || row.deskripsi || row.urutan)

      setImportRows(parsed)
      toast.success(`${parsed.length} baris template terbaca`)
    } catch {
      toast.error('Gagal membaca file Excel template')
    } finally {
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  const handleSimpanKamusImport = async () => {
    if (!importRows.length) return
    setImporting(true)
    try {
      const res = await importMasterPelanggaranMassal(importRows)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const parts = [`${res.inserted} baru`, `${res.updated} diperbarui`]
      if (res.skipped > 0) parts.push(`${res.skipped} duplikat dilewati`)
      toast.success(`Import selesai: ${parts.join(', ')}`)
      setImportRows([])
      keamananCache.clear()
      await loadMaster()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'kesalahan tidak diketahui'
      toast.error(`Import gagal: ${msg}`)
    } finally {
      setImporting(false)
    }
  }

  const groupedKamus = ['RINGAN', 'SEDANG', 'BERAT'].reduce<Record<string, MasterPelanggaranItem[]>>((acc, k) => {
    acc[k] = masterList.filter((m) => m.kategori === k)
    return acc
  }, {})

  const TABS = [
    { key: 'daftar' as const, label: 'Daftar Pelanggar', shortLabel: 'Daftar', icon: ShieldAlert },
    {
      key: 'verifikasi' as const,
      label: 'Verifikasi Histori',
      shortLabel: 'Verifikasi',
      icon: FileCheck,
      badge: unverifiedTotal > 0 ? unverifiedTotal : undefined,
    },
    { key: 'kamus' as const, label: 'Kamus Pelanggaran', shortLabel: 'Kamus', icon: BookOpen },
  ]

  return (
    <div className="space-y-4 sm:space-y-5 pb-16">
      <DashboardPageHeader
        title="Pelanggaran Santri"
        description="Pencatatan disiplin, pembinaan, dan histori sanksi santri."
      />

      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION TABS (Daftar, Verifikasi, Kamus)
         ───────────────────────────────────────────────────────────── */}
      <nav
        className="flex gap-1 rounded-2xl bg-slate-100 p-1"
        role="tablist"
        aria-label="Menu Pelanggaran"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.shortLabel}</span>
            {t.badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  tab === t.key ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DAFTAR PELANGGAR
         ───────────────────────────────────────────────────────────── */}
      {tab === 'daftar' && (
        <div className="space-y-3 sm:space-y-4">
          {/* TOOLBAR STRIP */}
          <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className={control + ' pl-10 pr-9'}
                  aria-label="Cari nama atau NIS"
                  placeholder="Cari nama santri atau NIS…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setSearch(searchInput)
                      setPage(1)
                    }
                  }}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    onClick={() => {
                      setSearchInput('')
                      setSearch('')
                      setPage(1)
                    }}
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Action buttons beside search on desktop, stacked on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  className={cn(primaryRose, 'w-full sm:w-auto justify-center whitespace-nowrap')}
                  onClick={() => {
                    setPreselectedSantri(null)
                    setShowInputModal(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span>Catat Pelanggaran</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(button, 'flex-1 sm:flex-none justify-center whitespace-nowrap')}
                    onClick={() => setShowExportModal(true)}
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Export XLSX</span>
                  </button>
                </div>
              </div>
            </div>

            {search && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <p>
                  Menampilkan hasil pencarian: <span className="font-bold text-slate-800">&ldquo;{search}&rdquo;</span>
                </p>
                <button
                  type="button"
                  className="font-semibold text-rose-700 hover:text-rose-800 transition cursor-pointer"
                  onClick={() => {
                    setSearchInput('')
                    setSearch('')
                    setPage(1)
                  }}
                >
                  Reset Pencarian
                </button>
              </div>
            )}
          </div>

          {/* Subheader info & refresh */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <p>
              Total <span className="font-bold text-slate-800">{total}</span> santri pernah tercatat
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 transition cursor-pointer"
              onClick={handleRefreshAll}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Segarkan data</span>
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              PANEL DATA SANTRI PELANGGAR
             ───────────────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
            {loadingDaftar ? (
              <ListLoading />
            ) : rows.length === 0 ? (
              <Empty>
                Tidak ada data santri yang cocok dengan pencarian.
                <br />
                Ketik nama atau NIS santri lain untuk melihat data.
              </Empty>
            ) : (
              <>
                {/* ── MOBILE VIEW: Clean Cards with 3-dots Menu ── */}
                <div className="p-3 sm:p-4 space-y-2.5 md:hidden">
                  {rows.map((row) => (
                    <article
                      key={row.id}
                      onClick={() => setSelectedSantriId(row.id)}
                      className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5 transition-colors hover:border-slate-300 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <StudentIdentity student={row} />
                        </div>

                        {/* Top-Right Dropdown Menu */}
                        <div
                          className="shrink-0 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowActionMenu label={`Aksi untuk ${row.nama_lengkap}`}>
                            <RowActionItem
                              icon={<Eye className="h-3.5 w-3.5" />}
                              onSelect={() => setSelectedSantriId(row.id)}
                            >
                              Lihat Rincian & Riwayat
                            </RowActionItem>
                            <RowActionItem
                              icon={<Plus className="h-3.5 w-3.5" />}
                              onSelect={() => {
                                setPreselectedSantri(row)
                                setShowInputModal(true)
                              }}
                            >
                              Catat Pelanggaran Santri Ini
                            </RowActionItem>
                          </RowActionMenu>
                        </div>
                      </div>

                      {/* Bottom Info Strip */}
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {row.jumlah_pelanggaran} kejadian
                          </span>
                          {row.perlu_verifikasi > 0 && (
                            <span className="inline-flex rounded-md bg-rose-50 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              {row.perlu_verifikasi} perlu verifikasi
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <SpBadge level={row.sp_terakhir} />
                          <span>·</span>
                          <span>{fmtTgl(row.terakhir)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* ── DESKTOP VIEW: Clean Table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th scope="col" className="py-3 pl-6 pr-2 w-12 text-slate-400">
                          No
                        </th>
                        <th scope="col" className="py-3 px-4">
                          Santri
                        </th>
                        <th scope="col" className="py-3 px-4">
                          Jumlah Kejadian
                        </th>
                        <th scope="col" className="py-3 px-4">
                          Perlu Verifikasi
                        </th>
                        <th scope="col" className="py-3 px-4">
                          SP Terakhir
                        </th>
                        <th scope="col" className="py-3 px-4">
                          Terakhir Melanggar
                        </th>
                        <th scope="col" className="py-3 pl-3 pr-6 text-right w-16">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {rows.map((row, i) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedSantriId(row.id)}
                          className="transition-colors hover:bg-slate-50/80 cursor-pointer group"
                        >
                          <td className="py-3.5 pl-6 pr-2 text-slate-400 font-mono">
                            {(page - 1) * 30 + i + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <StudentIdentity student={row} />
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                            {row.jumlah_pelanggaran}
                            <span className="text-xs font-normal text-slate-400 ml-1">kejadian</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {row.perlu_verifikasi > 0 ? (
                              <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                {row.perlu_verifikasi} catatan
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <SpBadge level={row.sp_terakhir} />
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {fmtTgl(row.terakhir)}
                          </td>
                          <td className="py-3.5 pl-3 pr-6 text-right">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-700 transition cursor-pointer"
                              aria-label={`Lihat rincian ${row.nama_lengkap}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSantriId(row.id)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pager
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  onPage={(pg) => {
                    setPage(pg)
                    loadDaftar(pg, search)
                  }}
                  disabled={loadingDaftar}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: VERIFIKASI HISTORI
         ───────────────────────────────────────────────────────────── */}
      {tab === 'verifikasi' && (
        <HistoryReview
          onTotalChange={setUnverifiedTotal}
          onVerified={() => {
            keamananCache.clear()
            loadDaftar(1, search)
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: KAMUS PELANGGARAN
         ───────────────────────────────────────────────────────────── */}
      {tab === 'kamus' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Form Tambah / Edit */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              {editId ? 'Edit Jenis Pelanggaran' : 'Tambah Jenis Pelanggaran Baru'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Kategori Pelanggaran
                </label>
                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl max-w-sm">
                  {(['RINGAN', 'SEDANG', 'BERAT'] as const).map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setKamusForm((f) => ({ ...f, kategori: k }))}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer',
                        kamusForm.kategori === k
                          ? 'bg-white shadow-2xs text-slate-900'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nama Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={kamusForm.nama}
                  onChange={(e) => setKamusForm((f) => ({ ...f, nama: e.target.value }))}
                  placeholder="Contoh: Merokok, Meninggalkan Asrama Tanpa Izin..."
                  className={control}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Deskripsi / Keterangan <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={kamusForm.deskripsi}
                  onChange={(e) => setKamusForm((f) => ({ ...f, deskripsi: e.target.value }))}
                  placeholder="Keterangan singkat cakupan jenis pelanggaran..."
                  className={control}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={savingKamus}
                onClick={handleSimpanKamus}
                className={primary}
              >
                {savingKamus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{savingKamus ? 'Menyimpan…' : editId ? 'Simpan Perubahan' : 'Tambah Jenis'}</span>
              </button>

              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null)
                    setKamusForm({ kategori: 'RINGAN', nama: '', deskripsi: '' })
                  }}
                  className={button}
                >
                  Batal
                </button>
              )}
            </div>
          </div>

          {/* Import Kamus Excel Section */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Import Master Pelanggaran (Excel)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unduh template standar, isi kolom kategori, nama pelanggaran, dan deskripsi, lalu unggah kembali.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadKamusTemplate}
                  className={cn(button, 'text-xs')}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className={cn(primary, 'bg-emerald-600 hover:bg-emerald-700 text-xs')}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload File Excel</span>
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadKamusImport}
                  className="hidden"
                />
              </div>
            </div>

            {importRows.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Preview Import ({importRows.length} baris)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportRows([])}
                      className={cn(button, 'text-xs')}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={handleSimpanKamusImport}
                      className={cn(primary, 'bg-emerald-700 hover:bg-emerald-800 text-xs')}
                    >
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <span>{importing ? 'Menyimpan…' : 'Simpan ke Master'}</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-auto rounded-lg border border-emerald-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2">Nama Pelanggaran</th>
                        <th className="px-3 py-2">Deskripsi</th>
                        <th className="px-3 py-2 text-right">Urutan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importRows.slice(0, 50).map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 font-bold text-slate-800">{row.kategori}</td>
                          <td className="px-3 py-2 text-slate-800">{row.nama_pelanggaran}</td>
                          <td className="px-3 py-2 text-slate-500">{row.deskripsi || '-'}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{row.urutan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Grouped Master Pelanggaran Cards */}
          <div className="space-y-4">
            {loadingMaster ? (
              <ListLoading />
            ) : (
              ['RINGAN', 'SEDANG', 'BERAT'].map((kat) => {
                const list = groupedKamus[kat] || []

                return (
                  <div
                    key={kat}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-5 py-3 bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', KATEGORI_DOT[kat])} />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Kategori {kat}
                        </h4>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {list.length} jenis
                      </span>
                    </div>

                    {!list.length ? (
                      <p className="p-6 text-center text-xs text-slate-400 italic">
                        Belum ada jenis pelanggaran kategori {kat}.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {list.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/60 transition"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{m.nama_pelanggaran}</p>
                              {m.deskripsi && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{m.deskripsi}</p>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditId(m.id)
                                  setKamusForm({
                                    kategori: m.kategori,
                                    nama: m.nama_pelanggaran,
                                    deskripsi: m.deskripsi || '',
                                  })
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                title="Edit jenis pelanggaran"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                disabled={deletingKamusId === m.id}
                                onClick={() => handleHapusKamus(m.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Hapus jenis pelanggaran"
                              >
                                {deletingKamusId === m.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODALS & DRAWERS
         ───────────────────────────────────────────────────────────── */}
      {/* 1. Side Drawer Detail Santri */}
      {selectedSantriId && (
        <DetailDrawer
          santriId={selectedSantriId}
          onClose={() => setSelectedSantriId(null)}
          onMutated={() => {
            keamananCache.clear()
            loadDaftar(page, search)
          }}
        />
      )}

      {/* 2. Modal Catat Pelanggaran */}
      {showInputModal && (
        <ModalInputPelanggaran
          masterList={masterList}
          preselectedSantri={preselectedSantri}
          onClose={() => {
            setShowInputModal(false)
            setPreselectedSantri(null)
          }}
          onSuccess={() => {
            keamananCache.clear()
            loadDaftar(1, search)
          }}
        />
      )}

      {/* 3. Modal Export Data */}
      {showExportModal && (
        <ModalExportPelanggaran onClose={() => setShowExportModal(false)} />
      )}
    </div>
  )
}
