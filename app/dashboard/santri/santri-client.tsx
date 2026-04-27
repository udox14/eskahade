'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, X, SlidersHorizontal } from 'lucide-react'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [text, setText] = useState(searchParams.get('q') || '')
  const query = useDebounce(text, 500)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    const currentQuery = searchParams.get('q') || ''
    if (query === currentQuery) return
    const params = new URLSearchParams(searchParams.toString())
    if (query) params.set('q', query); else params.delete('q')
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [query, router, searchParams])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      <input
        type="text"
        placeholder="Cari nama atau NIS..."
        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
        value={text}
        onChange={e => setText(e.target.value)}
      />
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
    <select
      value={limit}
      onChange={handleChange}
      className="border border-slate-200 rounded-xl px-2.5 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-slate-50 focus:bg-white transition-colors"
    >
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="50">50</option>
      <option value="100">100</option>
      <option value="9999">Semua</option>
    </select>
  )
}

export function PaginationControls({ total, limit, page }: { total: number; limit: number; page: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / limit)

  const go = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-500">
        Hal. <b>{page}</b>/<b>{totalPages}</b> - {total} santri
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={() => go(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4))
          const p = start + i
          return (
            <button
              key={p}
              onClick={() => go(p)}
              className={`w-8 h-8 text-xs rounded-lg border transition-colors font-medium ${
                p === page
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => go(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  )
}

type SantriFilterOptions = {
  asramaKamar: { asrama: string | null; kamar: string | null }[]
  asramaList: string[]
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
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{allLabel}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

const statusLabel = (status: string) => {
  if (status === 'aktif') return 'Aktif'
  if (status === 'keluar') return 'Keluar'
  if (status === 'lulus') return 'Lulus'
  if (status === 'arsip') return 'Arsip'
  return status.toUpperCase()
}

export function SantriFilter({
  marhalahList,
  kelasList,
  filterOptions,
  userAsrama,
}: {
  marhalahList: any[]
  kelasList: any[]
  filterOptions: SantriFilterOptions
  userAsrama: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  const [status, setStatus] = useState(searchParams.get('status') || '')
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

  const filteredKelas = kelasList.filter(k => !marhalah || k.marhalah_id.toString() === marhalah)
  const kamarOptions = filterOptions.asramaKamar
    .filter(row => (!asrama || row.asrama === asrama) && row.kamar)
    .map(row => row.kamar as string)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const toOptions = (items: Array<string | number>) => items.map(item => ({ value: String(item), label: String(item) }))

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString())
    const setParam = (key: string, value: string, defaultValue = '') => {
      if (value && value !== defaultValue) params.set(key, value)
      else params.delete(key)
    }
    setParam('status', status)
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
    setIsOpen(false)
  }

  const handleReset = () => {
    setStatus(''); setJenisKelamin(''); setGolDarah(''); setTahunMasuk('')
    setAsrama(userAsrama || ''); setKamar(''); setSekolah(''); setKelasSekolah(''); setMarhalah(''); setKelasPesantren('')
    setProvinsi(''); setKabKota(''); setKecamatan(''); setJemaah(''); setAlamat('')
    const params = new URLSearchParams(searchParams.toString())
    ;[
      'status','jenis_kelamin','gol_darah','tahun_masuk','asrama','kamar','sekolah','kelas_sekolah',
      'marhalah','kelas','provinsi','kab_kota','kecamatan','jemaah','alamat'
    ].forEach(k => params.delete(k))
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
    setIsOpen(false)
  }

  const activeCount = [
    status,
    jenisKelamin, golDarah, tahunMasuk, userAsrama ? '' : asrama, kamar, sekolah, kelasSekolah,
    marhalah, kelasPesantren, provinsi, kabKota, kecamatan, jemaah, alamat.trim(),
  ].filter(Boolean).length

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
          activeCount > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filter</span>
        {activeCount > 0 && (
          <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-slate-800">Filter Santri</h3>
                {activeCount > 0 && (
                  <p className="text-xs text-blue-600 mt-0.5">{activeCount} filter aktif</p>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Identitas & Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    allLabel="Aktif"
                    options={[
                      { value: 'all', label: 'Semua Status' },
                      ...filterOptions.statusList
                        .filter(v => v !== 'aktif')
                        .map(v => ({ value: v, label: statusLabel(v) })),
                    ]}
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
                    options={toOptions(filterOptions.golDarahList.length ? filterOptions.golDarahList : ['A', 'B', 'AB', 'O'])}
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

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tempat Tinggal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Asrama"
                    value={asrama}
                    onChange={value => { setAsrama(value); setKamar('') }}
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

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Sekolah Formal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField label="Sekolah" value={sekolah} onChange={setSekolah} allLabel="Semua Sekolah" options={toOptions(filterOptions.sekolahList)} />
                  <SelectField label="Kelas Sekolah" value={kelasSekolah} onChange={setKelasSekolah} allLabel="Semua Kelas Sekolah" options={toOptions(filterOptions.kelasSekolahList)} />
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Kelas Pesantren</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Marhalah"
                    value={marhalah}
                    onChange={value => { setMarhalah(value); setKelasPesantren('') }}
                    allLabel="Semua Marhalah"
                    options={marhalahList.map((m: any) => ({ value: String(m.id), label: m.nama }))}
                  />
                  <SelectField
                    label="Kelas Pesantren"
                    value={kelasPesantren}
                    onChange={setKelasPesantren}
                    allLabel="Semua Kelas"
                    options={filteredKelas.map((k: any) => ({ value: String(k.id), label: k.nama_kelas }))}
                    disabled={!marhalah}
                  />
                </div>
              </div>

              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-3">Alamat & Jemaah</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField label="Provinsi" value={provinsi} onChange={setProvinsi} allLabel="Semua Provinsi" options={toOptions(filterOptions.provinsiList)} />
                  <SelectField label="Kab/Kota" value={kabKota} onChange={setKabKota} allLabel="Semua Kab/Kota" options={toOptions(filterOptions.kabKotaList)} />
                  <SelectField label="Kecamatan" value={kecamatan} onChange={setKecamatan} allLabel="Semua Kecamatan" options={toOptions(filterOptions.kecamatanList)} />
                  <SelectField label="Jemaah" value={jemaah} onChange={setJemaah} allLabel="Semua Jemaah" options={toOptions(filterOptions.jemaahList)} />
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Kata dalam Alamat</span>
                    <input
                      type="text"
                      value={alamat}
                      onChange={e => setAlamat(e.target.value)}
                      placeholder="Contoh: Taraju, Cisinga, RT 02"
                      className="w-full p-2.5 border border-yellow-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-2 w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
