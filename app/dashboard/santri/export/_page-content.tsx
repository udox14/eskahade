'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getFilterOptions, getDataExport, getKamarList } from './actions'
import {
  KOLOM_TERSEDIA,
  SORT_OPTIONS,
  KOLOM_DEFAULT,
  HEADER_MAP,
  PRESET_KOLOM,
  type ExportFilter,
  type SortBy,
  type KolomExport,
} from './constants'
import {
  Funnel,
  ArrowsDownUp,
  Users,
  Eye,
  CircleNotch,
  Sparkle,
  ArrowCounterClockwise,
  IdentificationBadge,
  House,
  GraduationCap,
  UsersThree,
  MagnifyingGlass,
  FileXls,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// ── Kelompok Kolom ─────────────────────────────────────────────────────────────
const GRUP_CONFIG: {
  nama: string
  icon: React.ElementType
}[] = [
  { nama: 'Identitas Santri', icon: IdentificationBadge },
  { nama: 'Pesantren & Asrama', icon: House },
  { nama: 'Sekolah & Layanan', icon: GraduationCap },
  { nama: 'Keluarga & Wilayah', icon: UsersThree },
]

interface FilterOptionsState {
  asramaList: string[]
  sekolahList: string[]
  kelasSekolahList: string[]
  tahunList: number[]
  marhalahUnik: string[]
  kelasList: string[]
  jasaMakanList: { id: string; nama_jasa: string }[]
  jasaCuciList: { id: string; nama_jasa: string }[]
  kabKotaList: string[]
  provinsiList: string[]
  golDarahList: string[]
  jemaahList: string[]
  asramaBinaan: string | null
}

export default function ExportSantriPage() {
  const [opts, setOpts] = useState<FilterOptionsState | null>(null)
  const [loadingOpts, setLoadingOpts] = useState(true)
  const [kamarList, setKamarList] = useState<string[]>([])

  // Filter State
  const [filter, setFilter] = useState<ExportFilter>({
    status: 'aktif',
  })
  const [sortBy, setSortBy] = useState<SortBy>('nama_lengkap')
  const [kolom, setKolom] = useState<KolomExport[]>(KOLOM_DEFAULT)

  // Preview & Export State
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [hasPreview, setHasPreview] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Load opsi filter saat mount
  useEffect(() => {
    let alive = true
    getFilterOptions().then((o) => {
      if (alive) {
        setOpts(o)
        setLoadingOpts(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  // Lazy load daftar kamar jika asrama dipilih tunggal
  useEffect(() => {
    let alive = true
    if (filter.asrama && filter.asrama.length === 1) {
      getKamarList(filter.asrama[0]).then((k) => {
        if (alive) setKamarList(k)
      })
    } else {
      setKamarList([])
    }
    return () => {
      alive = false
    }
  }, [filter.asrama])

  // Helper pengubah filter
  const updateFilter = useCallback((key: keyof ExportFilter, val: unknown) => {
    setFilter((prev) => {
      if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: val }
    })
  }, [])

  const resetFilter = useCallback(() => {
    setFilter({ status: 'aktif' })
    setHasPreview(false)
  }, [])

  // Hitung jumlah filter aktif (di luar status default aktif)
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filter.status && filter.status !== 'aktif') count++
    if (filter.jenis_kelamin) count++
    if (filter.asrama && filter.asrama.length > 0) count++
    if (filter.kamar && filter.kamar.length > 0) count++
    if (filter.tempat_makan_id && filter.tempat_makan_id.length > 0) count++
    if (filter.tempat_mencuci_id && filter.tempat_mencuci_id.length > 0) count++
    if (filter.sekolah && filter.sekolah.length > 0) count++
    if (filter.kelas_sekolah && filter.kelas_sekolah.length > 0) count++
    if (filter.nama_kelas && filter.nama_kelas.length > 0) count++
    if (filter.marhalah && filter.marhalah.length > 0) count++
    if (filter.tahun_masuk && filter.tahun_masuk.length > 0) count++
    if (filter.kategori_santri && filter.kategori_santri.length > 0) count++
    if (filter.gol_darah && filter.gol_darah.length > 0) count++
    if (filter.kab_kota && filter.kab_kota.length > 0) count++
    if (filter.jemaah && filter.jemaah.length > 0) count++
    if (filter.q) count++
    return count
  }, [filter])

  // Toggle satu kolom
  const toggleKolom = useCallback((key: KolomExport) => {
    setKolom((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  // Toggle semua kolom dalam grup
  const toggleGrupKolom = useCallback(
    (grupNama: string) => {
      const kolomInGrup = KOLOM_TERSEDIA.filter((k) => k.group === grupNama).map((k) => k.key)
      const allSelected = kolomInGrup.every((k) => kolom.includes(k))

      if (allSelected) {
        setKolom((prev) => prev.filter((k) => !kolomInGrup.includes(k)))
      } else {
        setKolom((prev) => Array.from(new Set([...prev, ...kolomInGrup])))
      }
    },
    [kolom]
  )

  // Terapkan Preset
  const applyPreset = useCallback((presetKolom: KolomExport[]) => {
    setKolom(presetKolom)
  }, [])

  // Preview Data
  const handlePreview = useCallback(async () => {
    if (kolom.length === 0) {
      toast.error('Pilih minimal 1 kolom untuk pratinjau')
      return
    }
    setLoadingPreview(true)
    try {
      const res = await getDataExport(filter, kolom, sortBy)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setPreview(res.rows.slice(0, 10))
      setTotal(res.total)
      setHasPreview(true)
      if (res.total === 0) {
        toast.info('Tidak ada data santri yang cocok dengan kriteria filter.')
      }
    } catch {
      toast.error('Gagal mengambil pratinjau data')
    } finally {
      setLoadingPreview(false)
    }
  }, [filter, kolom, sortBy])

  // Export ke Excel
  const handleExport = async () => {
    if (kolom.length === 0) {
      toast.error('Pilih minimal 1 kolom yang ingin diexport')
      return
    }
    setExporting(true)
    const toastId = toast.loading('Mengambil seluruh data santri...')
    try {
      const res = await getDataExport(filter, kolom, sortBy)
      if ('error' in res) {
        toast.error(res.error)
        return
      }

      if (res.rows.length === 0) {
        toast.error('Data kosong, tidak ada baris yang bisa diexport')
        return
      }

      toast.loading('Menyusun file Excel (.xlsx)...', { id: toastId })
      const XLSX = await import('xlsx')

      const headers = ['No', ...kolom.map((k) => HEADER_MAP[k] || k)]
      const rows = res.rows.map((r, i) => [
        i + 1,
        ...kolom.map((k) => {
          const val = r[k]
          if (k === 'jenis_kelamin') {
            return val === 'L' ? 'Laki-laki' : val === 'P' ? 'Perempuan' : val || ''
          }
          if (k === 'status_global') {
            const s = String(val || '').toLowerCase()
            if (s === 'aktif') return 'Aktif'
            if (s === 'lulus') return 'Lulus'
            if (s === 'keluar') return 'Keluar'
            if (s === 'nonaktif_sementara') return 'Nonaktif Sementara'
            return val || ''
          }
          return val ?? ''
        }),
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

      // Lebar kolom otomatis
      const colWidths = headers.map((h, colIdx) => {
        let maxLen = h.length
        for (let rowIdx = 0; rowIdx < Math.min(rows.length, 100); rowIdx++) {
          const cellStr = String(rows[rowIdx][colIdx] ?? '')
          if (cellStr.length > maxLen) maxLen = cellStr.length
        }
        return { wch: Math.min(Math.max(maxLen + 3, 10), 45) }
      })
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data Santri')

      const statusTag = filter.status ? `_${filter.status}` : ''
      const asramaTag = filter.asrama && filter.asrama.length === 1 ? `_${filter.asrama[0]}` : ''
      const dateTag = new Date().toISOString().slice(0, 10)
      const fileName = `Data_Santri${statusTag}${asramaTag}_${dateTag}.xlsx`

      XLSX.writeFile(wb, fileName)
      toast.success(`Berhasil mengunduh ${res.total} data santri!`, { id: toastId })
    } catch {
      toast.error('Gagal mengekspor file Excel', { id: toastId })
    } finally {
      setExporting(false)
      toast.dismiss(toastId)
    }
  }

  if (loadingOpts) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
        <CircleNotch className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Memuat konfigurasi export...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ── HEADER ── */}
      <DashboardPageHeader
        title="Export Data Santri"
        description="Filter data santri secara spesifik, tentukan susunan kolom, lalu unduh dalam format spreadsheet Excel."
      />

      {/* ── 1. KARTU FILTER SANTRI (CLEAN FORM GRID) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Seksi */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Funnel className="w-4 h-4" weight="duotone" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">1. Kriteria & Filter Santri</h2>
              <p className="text-xs text-slate-500">Tentukan data santri yang ingin diambil.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                {activeFiltersCount} filter diterapkan
              </span>
            )}
            <button
              type="button"
              onClick={resetFilter}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Isi Form Filter */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Baris 1: Status, JK, Kategori, Pencarian Cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Santri */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Status Santri</label>
              <select
                value={filter.status ?? 'aktif'}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="aktif">Santri Aktif (Default)</option>
                <option value="lulus">Alumni / Lulus</option>
                <option value="nonaktif_sementara">Nonaktif Sementara</option>
                <option value="keluar">Santri Keluar</option>
                <option value="all">Semua Status (Aktif & Nonaktif)</option>
              </select>
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Jenis Kelamin</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {(['', 'L', 'P'] as const).map((jk) => (
                  <button
                    key={jk}
                    type="button"
                    onClick={() => updateFilter('jenis_kelamin', jk || undefined)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      (filter.jenis_kelamin ?? '') === jk
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {jk === '' ? 'Semua' : jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </button>
                ))}
              </div>
            </div>

            {/* Kategori Santri */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Kategori Santri</label>
              <select
                value={filter.kategori_santri?.[0] ?? ''}
                onChange={(e) =>
                  updateFilter('kategori_santri', e.target.value ? [e.target.value] : undefined)
                }
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Kategori</option>
                <option value="REGULER">REGULER</option>
                <option value="BARU">BARU</option>
                <option value="SADESA">SADESA</option>
              </select>
            </div>

            {/* Pencarian Nama / NIS */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Pencarian Nama / NIS</label>
              <div className="relative">
                <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ketik nama atau NIS..."
                  value={filter.q ?? ''}
                  onChange={(e) => updateFilter('q', e.target.value || undefined)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Baris 2: Asrama, Kamar, Marhalah, Kelas Pesantren */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            {/* Asrama */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Asrama</label>
              <select
                value={filter.asrama?.[0] ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  updateFilter('asrama', val ? [val] : undefined)
                  updateFilter('kamar', undefined)
                }}
                disabled={Boolean(opts?.asramaBinaan)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Semua Asrama</option>
                {opts?.asramaList.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Kamar */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Kamar</label>
              <select
                value={filter.kamar?.[0] ?? ''}
                onChange={(e) => updateFilter('kamar', e.target.value ? [e.target.value] : undefined)}
                disabled={!filter.asrama || filter.asrama.length !== 1}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {!filter.asrama?.length
                    ? 'Pilih asrama dahulu'
                    : kamarList.length === 0
                      ? 'Tidak ada data kamar'
                      : 'Semua Kamar'}
                </option>
                {kamarList.map((kmr) => (
                  <option key={kmr} value={kmr}>
                    Kamar {kmr}
                  </option>
                ))}
              </select>
            </div>

            {/* Marhalah */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Marhalah</label>
              <select
                value={filter.marhalah?.[0] ?? ''}
                onChange={(e) => updateFilter('marhalah', e.target.value ? [e.target.value] : undefined)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Marhalah</option>
                {opts?.marhalahUnik.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Kelas Pesantren */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Kelas Pesantren</label>
              <select
                value={filter.nama_kelas?.[0] ?? ''}
                onChange={(e) => updateFilter('nama_kelas', e.target.value ? [e.target.value] : undefined)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Kelas Pesantren</option>
                {opts?.kelasList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Baris 3: Sekolah Formal, Kelas Sekolah, Tahun Masuk, Domisili/Fasilitas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            {/* Sekolah Formal */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Sekolah Formal</label>
              <select
                value={filter.sekolah?.[0] ?? ''}
                onChange={(e) => updateFilter('sekolah', e.target.value ? [e.target.value] : undefined)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Sekolah</option>
                {opts?.sekolahList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Kelas Sekolah */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Tingkat Kelas Sekolah</label>
              <select
                value={filter.kelas_sekolah?.[0] ?? ''}
                onChange={(e) =>
                  updateFilter('kelas_sekolah', e.target.value ? [e.target.value] : undefined)
                }
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Tingkat</option>
                {opts?.kelasSekolahList.map((ks) => (
                  <option key={ks} value={ks}>
                    Kelas {ks}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahun Masuk */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Tahun Masuk</label>
              <select
                value={filter.tahun_masuk?.[0] ?? ''}
                onChange={(e) =>
                  updateFilter('tahun_masuk', e.target.value ? [Number(e.target.value)] : undefined)
                }
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Tahun</option>
                {opts?.tahunList.map((th) => (
                  <option key={th} value={th}>
                    Tahun {th}
                  </option>
                ))}
              </select>
            </div>

            {/* Kab/Kota Domisili */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Kab/Kota Asal</label>
              <select
                value={filter.kab_kota?.[0] ?? ''}
                onChange={(e) => updateFilter('kab_kota', e.target.value ? [e.target.value] : undefined)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                <option value="">Semua Kab/Kota</option>
                {opts?.kabKotaList.map((kota) => (
                  <option key={kota} value={kota}>
                    {kota}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KARTU PILIHAN KOLOM (PRESETS + STRUCTURED CHECKBOXES) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Seksi */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkle className="w-4 h-4" weight="duotone" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">2. Pilihan Kolom Data</h2>
              <p className="text-xs text-slate-500">Pilih preset praktis atau centang kolom yang dibutuhkan.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-1 rounded-full">
              {kolom.length} dari {KOLOM_TERSEDIA.length} kolom dipilih
            </span>
          </div>
        </div>

        {/* Toolbar Preset Cepat */}
        <div className="px-5 py-3.5 bg-slate-50/40 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
            <span>⚡ Preset Ekspor Cepat:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_KOLOM.map((preset) => {
              const isMatch =
                preset.kolom.length === kolom.length &&
                preset.kolom.every((k) => kolom.includes(k))
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.kolom)}
                  title={preset.description}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isMatch
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setKolom([])}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all ml-auto"
            >
              Hapus Semua
            </button>
          </div>
        </div>

        {/* Kluster Kolom Berdasarkan Grup */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {GRUP_CONFIG.map(({ nama, icon: IconComponent }) => {
            const listKolomGrup = KOLOM_TERSEDIA.filter((k) => k.group === nama)
            const allChecked = listKolomGrup.every((k) => kolom.includes(k.key))
            const someChecked =
              !allChecked && listKolomGrup.some((k) => kolom.includes(k.key))

            return (
              <div
                key={nama}
                className="rounded-xl border border-slate-200/80 bg-slate-50/30 overflow-hidden flex flex-col"
              >
                {/* Header Grup */}
                <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-slate-500" weight="duotone" />
                    <span className="text-xs font-bold text-slate-700">{nama}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleGrupKolom(nama)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    {allChecked ? 'Batal Semua' : someChecked ? 'Pilih Semua' : 'Pilih Semua'}
                  </button>
                </div>

                {/* Daftar Checkbox Kolom */}
                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white flex-1">
                  {listKolomGrup.map((item) => {
                    const isChecked = kolom.includes(item.key)
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/60 text-slate-900 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleKolom(item.key)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 3. PENGURUTAN & TOMBOL AKSI (ACTION BAR) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Dropdown Pengurutan */}
        <div className="flex items-center gap-2.5">
          <ArrowsDownUp className="w-4 h-4 text-slate-500 shrink-0" weight="duotone" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Urutan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tombol Preview & Download */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loadingPreview || kolom.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loadingPreview ? (
              <CircleNotch className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <Eye className="w-4 h-4 text-slate-500" weight="bold" />
            )}
            <span>Pratinjau Data</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || kolom.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
          >
            {exporting ? (
              <CircleNotch className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileXls className="w-4 h-4 text-white" weight="bold" />
            )}
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* ── 4. TABEL PRATINJAU DATA ── */}
      {hasPreview && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" weight="duotone" />
              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                Hasil Pratinjau ({total.toLocaleString('id-ID')} Santri Ditemukan)
              </span>
              {total > 10 && (
                <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                  — menampilkan 10 baris pertama
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {kolom.length} Kolom
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="px-3 py-2.5 font-bold text-slate-600 w-12 text-center">No</th>
                  {kolom.map((k) => (
                    <th key={k} className="px-3 py-2.5 font-bold text-slate-600 whitespace-nowrap">
                      {HEADER_MAP[k] || k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    {kolom.map((k) => {
                      const val = row[k]
                      let displayVal = String(val ?? '-')
                      if (k === 'jenis_kelamin') {
                        displayVal = val === 'L' ? 'Laki-laki' : val === 'P' ? 'Perempuan' : '-'
                      }
                      return (
                        <td
                          key={k}
                          className="px-3 py-2 text-slate-800 max-w-[200px] truncate font-medium"
                          title={String(val ?? '')}
                        >
                          {displayVal === '' ? '-' : displayVal}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              Tidak ada data yang sesuai dengan kombinasi filter yang dipilih.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
