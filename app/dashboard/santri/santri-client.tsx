'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  SlidersHorizontal,
  Pencil,
  Eye,
} from 'lucide-react'
import { RowActionMenu, RowActionItem } from '@/components/ui/dropdown-menu'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

/**
 * Hook untuk menangani tombol/gestur 'Back' pada mobile saat modal terbuka.
 */
function useModalHistory(isOpen: boolean, onClose: () => void) {
  const isPushedRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modalOpen: true }, '')
      isPushedRef.current = true

      const handlePopState = () => {
        isPushedRef.current = false
        onClose()
      }

      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
        if (isPushedRef.current) {
          isPushedRef.current = false
          window.history.back()
        }
      }
    }
  }, [isOpen, onClose])
}

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const [text, setText] = useState(urlQuery)
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery)
  const query = useDebounce(text, 400)
  const isMounted = useRef(false)

  // Menyesuaikan state jika URL searchParams berubah dari luar (misal tombol reset filter)
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery)
    setText(urlQuery)
  }

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    const currentQuery = searchParams.get('q') || ''
    if (query === currentQuery) return
    const params = new URLSearchParams(searchParams.toString())
    if (query) params.set('q', query)
    else params.delete('q')
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [query, router, searchParams])

  const handleClear = () => {
    setText('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
      <input
        type="text"
        placeholder="Cari nama atau NIS santri..."
        className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/50 focus:bg-white transition-colors"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          aria-label="Hapus pencarian"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export function LimitSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const limit = searchParams.get('limit') || '10'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', e.target.value)
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="relative shrink-0">
      <select
        value={limit}
        onChange={handleChange}
        className="h-10 border border-slate-200 rounded-xl pl-3 pr-7 text-xs sm:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 hover:bg-white focus:bg-white transition-colors cursor-pointer appearance-none"
        aria-label="Jumlah per halaman"
      >
        <option value="10">10 / hal</option>
        <option value="20">20 / hal</option>
        <option value="50">50 / hal</option>
        <option value="100">100 / hal</option>
        <option value="9999">Semua</option>
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  )
}

export function PaginationControls({ total, limit, page }: { total: number; limit: number; page: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const go = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
      <p className="font-medium">
        Menampilkan <span className="font-semibold text-slate-900">{start}–{end}</span> dari{' '}
        <span className="font-semibold text-slate-900">{total}</span> santri
      </p>

      <div className="flex items-center gap-2">
        <span className="text-slate-500">
          Hal. <span className="font-semibold text-slate-900">{page}</span> dari {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => go(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1.5 sm:p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => go(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1.5 sm:p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Menu aksi 3-dots untuk kartu santri mobile.
 */
export function SantriActionMenu({
  santriId,
  santriNama,
  canUpdate,
  canViewDetail,
}: {
  santriId: number | string
  santriNama: string
  canUpdate: boolean
  canViewDetail: boolean
}) {
  const router = useRouter()

  if (!canViewDetail && !canUpdate) return null

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
      }}
      className="shrink-0"
    >
      <RowActionMenu label={`Aksi untuk ${santriNama}`} align="right">
        {canViewDetail && (
          <RowActionItem
            icon={<Eye />}
            onSelect={() => router.push(`/dashboard/santri/${santriId}`)}
          >
            Lihat Detail Profil
          </RowActionItem>
        )}
        {canUpdate && (
          <RowActionItem
            icon={<Pencil />}
            tone="default"
            onSelect={() => router.push(`/dashboard/santri/${santriId}/edit`)}
          >
            Edit Data Santri
          </RowActionItem>
        )}
      </RowActionMenu>
    </div>
  )
}

export type MarhalahItem = {
  id: number | string
  nama: string
}

export type KelasItem = {
  id: number | string
  nama_kelas: string
  marhalah_id: number | string
}

export type SantriFilterOptions = {
  asramaKamar: { asrama: string | null; kamar: string | null }[]
  asramaList: string[]
  kategoriSantriList: string[]
  sekolahList: string[]
  kelasSekolahList: string[]
  statusList: string[]
  golDarahList: string[]
  tahunMasukList: number[]
  provinsiList: string[]
  kabKotaList: string[]
  kecamatanList: string[]
  jemaahList: string[]
}

type SelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  allLabel: string
  disabled?: boolean
}

function SelectField({ label, value, onChange, options, allLabel, disabled = false }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none px-3 py-2 pr-8 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </label>
  )
}

const statusLabel = (status: string) => {
  if (status === 'aktif') return 'Aktif'
  if (status === 'nonaktif_sementara') return 'Nonaktif Sementara'
  if (status === 'keluar') return 'Keluar'
  if (status === 'lulus') return 'Lulus'
  if (status === 'arsip') return 'Arsip'
  if (status === 'all') return 'Semua Status'
  return status.toUpperCase()
}

function SantriFilterModalContent({
  marhalahList,
  kelasList,
  filterOptions,
  userAsrama,
  onClose,
}: {
  marhalahList: MarhalahItem[]
  kelasList: KelasItem[]
  filterOptions: SantriFilterOptions
  userAsrama: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [kategoriSantri, setKategoriSantri] = useState(searchParams.get('kategori_santri') || '')
  const [jenisKelamin, setJenisKelamin] = useState(searchParams.get('jenis_kelamin') || '')
  const [golDarah, setGolDarah] = useState(searchParams.get('gol_darah') || '')
  const [tahunMasuk, setTahunMasuk] = useState(searchParams.get('tahun_masuk') || '')
  const [asrama, setAsrama] = useState(userAsrama || searchParams.get('asrama') || '')
  const [kamar, setKamar] = useState(searchParams.get('kamar') || '')
  const [sekolah, setSekolah] = useState(searchParams.get('sekolah') || '')
  const [kelasSekolah, setKelasSekolah] = useState(searchParams.get('kelas_sekolah') || '')
  const [marhalah, setMarhalah] = useState(searchParams.get('marhalah') || '')
  const [kelasPesantren, setKelasPesantren] = useState(searchParams.get('kelas') || '')
  const [provinsi, setProvinsi] = useState(searchParams.get('provinsi') || '')
  const [kabKota, setKabKota] = useState(searchParams.get('kab_kota') || '')
  const [kecamatan, setKecamatan] = useState(searchParams.get('kecamatan') || '')
  const [jemaah, setJemaah] = useState(searchParams.get('jemaah') || '')
  const [alamat, setAlamat] = useState(searchParams.get('alamat') || '')

  const filteredKelas = kelasList.filter((k) => !marhalah || k.marhalah_id.toString() === marhalah)
  const kamarOptions = filterOptions.asramaKamar
    .filter((row) => (!asrama || row.asrama === asrama) && row.kamar)
    .map((row) => row.kamar as string)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const toOptions = (items: Array<string | number>) =>
    items.map((item) => ({ value: String(item), label: String(item) }))

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString())
    const setParam = (key: string, value: string, defaultValue = '') => {
      if (value && value !== defaultValue) params.set(key, value)
      else params.delete(key)
    }
    setParam('status', status)
    setParam('kategori_santri', kategoriSantri)
    setParam('jenis_kelamin', jenisKelamin)
    setParam('gol_darah', golDarah)
    setParam('tahun_masuk', tahunMasuk)
    if (!userAsrama) setParam('asrama', asrama)
    else params.delete('asrama')
    setParam('kamar', kamar)
    setParam('sekolah', sekolah)
    setParam('kelas_sekolah', kelasSekolah)
    setParam('marhalah', marhalah)
    setParam('kelas', kelasPesantren)
    setParam('provinsi', provinsi)
    setParam('kab_kota', kabKota)
    setParam('kecamatan', kecamatan)
    setParam('jemaah', jemaah)
    setParam('alamat', alamat.trim())
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
    onClose()
  }

  const handleReset = () => {
    setStatus('')
    setKategoriSantri('')
    setJenisKelamin('')
    setGolDarah('')
    setTahunMasuk('')
    setAsrama(userAsrama || '')
    setKamar('')
    setSekolah('')
    setKelasSekolah('')
    setMarhalah('')
    setKelasPesantren('')
    setProvinsi('')
    setKabKota('')
    setKecamatan('')
    setJemaah('')
    setAlamat('')
    const params = new URLSearchParams(searchParams.toString())
    ;[
      'status',
      'kategori_santri',
      'jenis_kelamin',
      'gol_darah',
      'tahun_masuk',
      'asrama',
      'kamar',
      'sekolah',
      'kelas_sekolah',
      'marhalah',
      'kelas',
      'provinsi',
      'kab_kota',
      'kecamatan',
      'jemaah',
      'alamat',
    ].forEach((k) => params.delete(k))
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
    onClose()
  }

  const currentActiveCount = [
    status && status !== 'aktif' ? status : '',
    kategoriSantri,
    jenisKelamin,
    golDarah,
    tahunMasuk,
    userAsrama ? '' : asrama,
    kamar,
    sekolah,
    kelasSekolah,
    marhalah,
    kelasPesantren,
    provinsi,
    kabKota,
    kecamatan,
    jemaah,
    alamat.trim(),
  ].filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[88vh] flex flex-col overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-base">Filter Santri</h3>
            {currentActiveCount > 0 && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-600/20">
                {currentActiveCount} aktif
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Tutup filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5 text-slate-800">
          {/* 1. Status & Kategori */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Status & Kategori
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Status Santri"
                value={status}
                onChange={setStatus}
                allLabel="Aktif (Default)"
                options={[
                  { value: 'all', label: 'Semua Status' },
                  ...filterOptions.statusList
                    .filter((v) => v !== 'aktif')
                    .map((v) => ({ value: v, label: statusLabel(v) })),
                ]}
              />
              <SelectField
                label="Kategori Santri"
                value={kategoriSantri}
                onChange={setKategoriSantri}
                allLabel="Semua Kategori"
                options={filterOptions.kategoriSantriList.map((v) => ({ value: v, label: v }))}
              />
              <SelectField
                label="Jenis Kelamin"
                value={jenisKelamin}
                onChange={setJenisKelamin}
                allLabel="Semua Jenis Kelamin"
                options={[
                  { value: 'L', label: 'Laki-laki' },
                  { value: 'P', label: 'Perempuan' },
                ]}
              />
              <SelectField
                label="Golongan Darah"
                value={golDarah}
                onChange={setGolDarah}
                allLabel="Semua Golongan Darah"
                options={toOptions(
                  filterOptions.golDarahList.length
                    ? filterOptions.golDarahList
                    : ['A', 'B', 'AB', 'O']
                )}
              />
              <SelectField
                label="Tahun Masuk"
                value={tahunMasuk}
                onChange={setTahunMasuk}
                allLabel="Semua Tahun Masuk"
                options={toOptions(filterOptions.tahunMasukList)}
              />
            </div>
          </div>

          {/* 2. Tempat Tinggal */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Tempat Tinggal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Asrama"
                value={asrama}
                onChange={(value) => {
                  setAsrama(value)
                  setKamar('')
                }}
                allLabel="Semua Asrama"
                options={toOptions(filterOptions.asramaList)}
                disabled={!!userAsrama}
              />
              <SelectField
                label="Kamar"
                value={kamar}
                onChange={setKamar}
                allLabel="Semua Kamar"
                options={toOptions(kamarOptions)}
              />
            </div>
          </div>

          {/* 3. Pendidikan Pesantren */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Pendidikan Pesantren
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Marhalah"
                value={marhalah}
                onChange={(value) => {
                  setMarhalah(value)
                  setKelasPesantren('')
                }}
                allLabel="Semua Marhalah"
                options={marhalahList.map((m) => ({ value: String(m.id), label: m.nama }))}
              />
              <SelectField
                label="Kelas Pesantren"
                value={kelasPesantren}
                onChange={setKelasPesantren}
                allLabel="Semua Kelas"
                options={filteredKelas.map((k) => ({ value: String(k.id), label: k.nama_kelas }))}
                disabled={!marhalah}
              />
            </div>
          </div>

          {/* 4. Sekolah Formal */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Sekolah Formal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Sekolah"
                value={sekolah}
                onChange={setSekolah}
                allLabel="Semua Sekolah"
                options={toOptions(filterOptions.sekolahList)}
              />
              <SelectField
                label="Kelas Sekolah"
                value={kelasSekolah}
                onChange={setKelasSekolah}
                allLabel="Semua Kelas Sekolah"
                options={toOptions(filterOptions.kelasSekolahList)}
              />
            </div>
          </div>

          {/* 5. Alamat & Jemaah */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Domisili Asal & Jemaah
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Provinsi"
                value={provinsi}
                onChange={setProvinsi}
                allLabel="Semua Provinsi"
                options={toOptions(filterOptions.provinsiList)}
              />
              <SelectField
                label="Kabupaten / Kota"
                value={kabKota}
                onChange={setKabKota}
                allLabel="Semua Kab/Kota"
                options={toOptions(filterOptions.kabKotaList)}
              />
              <SelectField
                label="Kecamatan"
                value={kecamatan}
                onChange={setKecamatan}
                allLabel="Semua Kecamatan"
                options={toOptions(filterOptions.kecamatanList)}
              />
              <SelectField
                label="Jemaah"
                value={jemaah}
                onChange={setJemaah}
                allLabel="Semua Jemaah"
                options={toOptions(filterOptions.jemaahList)}
              />
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Kata dalam Alamat
                </span>
                <input
                  type="text"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Contoh: Taraju, Cisinga, RT 02"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Reset Filter
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 sm:flex-initial px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition-colors text-center"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    </div>
  )
}

export function SantriFilter({
  marhalahList,
  kelasList,
  filterOptions,
  userAsrama,
}: {
  marhalahList: MarhalahItem[]
  kelasList: KelasItem[]
  filterOptions: SantriFilterOptions
  userAsrama: string | null
}) {
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // Tangani gestur/tombol back pada HP
  useModalHistory(isOpen, () => setIsOpen(false))

  // Tangani tombol keyboard Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const statusParam = searchParams.get('status')
  const activeCount = [
    statusParam && statusParam !== 'aktif' ? statusParam : '',
    searchParams.get('kategori_santri'),
    searchParams.get('jenis_kelamin'),
    searchParams.get('gol_darah'),
    searchParams.get('tahun_masuk'),
    userAsrama ? '' : searchParams.get('asrama'),
    searchParams.get('kamar'),
    searchParams.get('sekolah'),
    searchParams.get('kelas_sekolah'),
    searchParams.get('marhalah'),
    searchParams.get('kelas'),
    searchParams.get('provinsi'),
    searchParams.get('kab_kota'),
    searchParams.get('kecamatan'),
    searchParams.get('jemaah'),
    searchParams.get('alamat')?.trim(),
  ].filter(Boolean).length

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
          activeCount > 0
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
        }`}
        aria-label="Filter santri"
      >
        <SlidersHorizontal className="w-4 h-4 text-current shrink-0" />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <SantriFilterModalContent
          marhalahList={marhalahList}
          kelasList={kelasList}
          filterOptions={filterOptions}
          userAsrama={userAsrama}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

/**
 * Chip filter aktif di bawah toolbar dengan opsi penghapusan per-filter & reset.
 */
export function ActiveFilterChips({ userAsrama }: { userAsrama?: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const kategoriSantri = searchParams.get('kategori_santri') || ''
  const jenisKelamin = searchParams.get('jenis_kelamin') || ''
  const golDarah = searchParams.get('gol_darah') || ''
  const tahunMasuk = searchParams.get('tahun_masuk') || ''
  const asrama = (!userAsrama && searchParams.get('asrama')) || ''
  const kamar = searchParams.get('kamar') || ''
  const sekolah = searchParams.get('sekolah') || ''
  const kelasSekolah = searchParams.get('kelas_sekolah') || ''
  const marhalah = searchParams.get('marhalah') || ''
  const kelasPesantren = searchParams.get('kelas') || ''
  const provinsi = searchParams.get('provinsi') || ''
  const kabKota = searchParams.get('kab_kota') || ''
  const kecamatan = searchParams.get('kecamatan') || ''
  const jemaah = searchParams.get('jemaah') || ''
  const alamat = searchParams.get('alamat') || ''

  const chips: { key: string; label: string }[] = []

  if (q) chips.push({ key: 'q', label: `Cari: "${q}"` })
  if (status && status !== 'aktif') {
    chips.push({ key: 'status', label: `Status: ${statusLabel(status)}` })
  }
  if (kategoriSantri) chips.push({ key: 'kategori_santri', label: `Kategori: ${kategoriSantri}` })
  if (asrama) chips.push({ key: 'asrama', label: `Asrama: ${asrama}` })
  if (kamar) chips.push({ key: 'kamar', label: `Kamar: ${kamar}` })
  if (sekolah) chips.push({ key: 'sekolah', label: `Sekolah: ${sekolah}` })
  if (kelasSekolah) chips.push({ key: 'kelas_sekolah', label: `Kls Formal: ${kelasSekolah}` })
  if (marhalah) chips.push({ key: 'marhalah', label: 'Marhalah terpilih' })
  if (kelasPesantren) chips.push({ key: 'kelas', label: 'Kelas Pesantren' })
  if (jenisKelamin) {
    chips.push({ key: 'jenis_kelamin', label: jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan' })
  }
  if (golDarah) chips.push({ key: 'gol_darah', label: `Gol. Darah ${golDarah}` })
  if (tahunMasuk) chips.push({ key: 'tahun_masuk', label: `Masuk ${tahunMasuk}` })
  if (provinsi) chips.push({ key: 'provinsi', label: `Prov: ${provinsi}` })
  if (kabKota) chips.push({ key: 'kab_kota', label: `Kota: ${kabKota}` })
  if (kecamatan) chips.push({ key: 'kecamatan', label: `Kec: ${kecamatan}` })
  if (jemaah) chips.push({ key: 'jemaah', label: `Jemaah: ${jemaah}` })
  if (alamat) chips.push({ key: 'alamat', label: `Alamat: "${alamat}"` })

  if (chips.length === 0) return null

  const removeChip = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    if (key === 'marhalah') {
      params.delete('kelas')
    }
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const resetAll = () => {
    const params = new URLSearchParams()
    const limit = searchParams.get('limit')
    if (limit) params.set('limit', limit)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
      <span className="text-[11px] font-semibold text-slate-400 mr-0.5">Filter aktif:</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs px-2.5 py-1 rounded-lg transition-colors"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => removeChip(chip.key)}
            className="text-slate-400 hover:text-slate-700 -mr-1 p-0.5 rounded-full hover:bg-slate-300/50 transition-colors"
            aria-label={`Hapus filter ${chip.label}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={resetAll}
        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline px-1.5 py-0.5"
      >
        Reset Semua
      </button>
    </div>
  )
}
