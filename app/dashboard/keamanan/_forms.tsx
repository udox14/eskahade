'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Camera,
  ChevronDown,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { cn } from '@/lib/utils'
import {
  cariSantri,
  simpanPelanggaran,
  type DaftarPelanggarFilter,
  type MasterPelanggaranItem,
  type SantriSearchResult,
} from './actions'
import {
  button,
  control,
  ErrorMessage,
  Field,
  Modal,
  primaryRose,
} from './_components'

export async function kompresGambar(file: File, maxW = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadFoto(base64: string): Promise<string> {
  const res = await fetch('/api/upload-foto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, folder: 'bukti-pelanggaran' }),
  })
  const data = await res.json()
  if (!data.url) throw new Error('Upload gagal')
  return data.url
}

const KATEGORI_DOT: Record<string, string> = {
  RINGAN: 'bg-slate-400',
  SEDANG: 'bg-amber-400',
  BERAT: 'bg-rose-500',
}

export function ModalInputPelanggaran({
  masterList,
  preselectedSantri,
  onClose,
  onSuccess,
}: {
  masterList: MasterPelanggaranItem[]
  preselectedSantri?: SantriSearchResult | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedSantri, setSelectedSantri] = useState<SantriSearchResult | null>(preselectedSantri || null)
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<SantriSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [jenisSearch, setJenisSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [deskripsi, setDeskripsi] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedItem = masterList.find((m) => String(m.id) === selectedMasterId)
  const filteredMaster = jenisSearch.trim()
    ? masterList.filter(
        (m) =>
          m.nama_pelanggaran.toLowerCase().includes(jenisSearch.toLowerCase()) ||
          m.kategori.toLowerCase().includes(jenisSearch.toLowerCase())
      )
    : masterList

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Auto live search santri
  useEffect(() => {
    if (selectedSantri || keyword.trim().length < 2) {
      setHasilCari([])
      return
    }

    let alive = true
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await cariSantri(keyword)
        if (alive) {
          setHasilCari(res)
          setSearching(false)
        }
      } catch {
        if (alive) {
          setHasilCari([])
          setSearching(false)
        }
      }
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [keyword, selectedSantri])

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      setFotoBase64(await kompresGambar(file))
    } catch {
      toast.error('Gagal memproses foto')
    } finally {
      setUploading(false)
    }
  }

  const handleSimpan = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!selectedSantri) {
      setError('Pilih santri terlebih dahulu.')
      return
    }
    if (!selectedMasterId) {
      setError('Pilih jenis pelanggaran.')
      return
    }
    setError('')
    setSaving(true)

    try {
      let fotoUrl: string | undefined
      if (fotoBase64) {
        try {
          fotoUrl = await uploadFoto(fotoBase64)
        } catch {
          toast.error('Foto gagal diunggah, data tetap disimpan tanpa foto.')
        }
      }

      const res = await simpanPelanggaran({
        santriId: selectedSantri.id,
        masterId: Number(selectedMasterId),
        deskripsiTambahan: deskripsi || undefined,
        tanggal,
        fotoUrl,
      })

      if ('error' in res) {
        setError(res.error)
        return
      }

      toast.success(`Pelanggaran ${selectedSantri.nama_lengkap} berhasil dicatat`)
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Catat Pelanggaran Santri"
      busy={saving}
      onClose={onClose}
      footer={
        <div className="flex w-full sm:w-auto items-center justify-end gap-2">
          <button
            type="button"
            className={button}
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || !selectedSantri || !selectedMasterId}
            onClick={() => handleSimpan()}
            className={primaryRose}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            <span>{saving ? 'Menyimpan…' : 'Catat Pelanggaran'}</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSimpan} className="space-y-4">
        {error && <ErrorMessage message={error} />}

        {/* ─────────────────────────────────────────────────────────────
            1. PILIH SANTRI
           ───────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Identitas Santri <span className="text-rose-500">*</span>
          </label>

          {selectedSantri ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <SantriPhotoAvatar
                  src={selectedSantri.foto_url}
                  alt={selectedSantri.nama_lengkap}
                  name={selectedSantri.nama_lengkap}
                  size="md"
                  clickable={false}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {selectedSantri.nama_lengkap}
                  </p>
                  {/* Baris 2: Asrama / Kamar */}
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {selectedSantri.asrama ? `${selectedSantri.asrama}${selectedSantri.kamar ? ` / ${selectedSantri.kamar}` : ''}` : 'Non-Asrama'}
                  </p>
                  {/* Baris 3: Kelas */}
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {selectedSantri.nama_kelas || '-'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                onClick={() => {
                  setSelectedSantri(null)
                  setKeyword('')
                  setHasilCari([])
                }}
              >
                Ganti Santri
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Ketik nama santri atau NIS..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={control + ' pl-9'}
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>

              {hasilCari.length > 0 && (
                <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  {hasilCari.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setSelectedSantri(s)
                        setHasilCari([])
                      }}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-rose-50/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <SantriPhotoAvatar
                          src={s.foto_url}
                          alt={s.nama_lengkap}
                          name={s.nama_lengkap}
                          size="sm"
                          clickable={false}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {s.nama_lengkap}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {s.asrama ? `${s.asrama}${s.kamar ? ` / ${s.kamar}` : ''}` : 'Non-Asrama'}
                            {s.nama_kelas ? ` · ${s.nama_kelas}` : ''}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/60">
                        Pilih
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!hasilCari.length && keyword.trim().length >= 2 && !searching && (
                <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  Tidak ada santri aktif yang cocok dengan kata kunci.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. RINCIAN PELANGGARAN
           ───────────────────────────────────────────────────────────── */}
        <div className="space-y-4 pt-1">
          {/* Jenis Pelanggaran Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Jenis Pelanggaran <span className="text-rose-500">*</span>
            </label>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowDropdown((v) => !v)
                  setTimeout(() => searchRef.current?.focus(), 50)
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all bg-slate-50/50 text-left border cursor-pointer',
                  showDropdown
                    ? 'border-rose-500 ring-2 ring-rose-500/20 bg-white'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                {selectedItem ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        KATEGORI_DOT[selectedItem.kategori] || 'bg-slate-400'
                      )}
                    />
                    <span className="font-semibold text-slate-800 truncate">
                      {selectedItem.nama_pelanggaran}
                    </span>
                    <span className="text-xs text-slate-400">({selectedItem.kategori})</span>
                  </div>
                ) : (
                  <span className="text-slate-400">Cari atau pilih jenis pelanggaran...</span>
                )}
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2',
                    showDropdown && 'rotate-180'
                  )}
                />
              </button>

              {showDropdown && (
                <div className="absolute z-50 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        ref={searchRef}
                        type="text"
                        placeholder="Ketik untuk memfilter jenis..."
                        value={jenisSearch}
                        onChange={(e) => setJenisSearch(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                      />
                      {jenisSearch && (
                        <button
                          type="button"
                          onClick={() => setJenisSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                    {filteredMaster.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6 italic">
                        Tidak ada jenis pelanggaran yang cocok.
                      </p>
                    ) : jenisSearch.trim() ? (
                      filteredMaster.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            setSelectedMasterId(String(m.id))
                            setShowDropdown(false)
                            setJenisSearch('')
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-rose-50/60 transition-colors text-left cursor-pointer',
                            selectedMasterId === String(m.id) && 'bg-rose-50/80 font-bold'
                          )}
                        >
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              KATEGORI_DOT[m.kategori] || 'bg-slate-400'
                            )}
                          />
                          <span className="flex-1 text-xs text-slate-800 truncate">
                            {m.nama_pelanggaran}
                          </span>
                          <span className="text-[10px] text-slate-400">{m.kategori}</span>
                        </button>
                      ))
                    ) : (
                      ['RINGAN', 'SEDANG', 'BERAT'].flatMap((kat) => {
                        const items = masterList.filter((m) => m.kategori === kat)
                        if (!items.length) return []
                        return [
                          <div
                            key={`hdr-${kat}`}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                          >
                            <span className={cn('w-2 h-2 rounded-full', KATEGORI_DOT[kat])} />
                            <span>{kat}</span>
                          </div>,
                          ...items.map((m) => (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => {
                                setSelectedMasterId(String(m.id))
                                setShowDropdown(false)
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-3.5 py-2 hover:bg-rose-50/60 transition-colors text-left cursor-pointer',
                                selectedMasterId === String(m.id) && 'bg-rose-50'
                              )}
                            >
                              <span className="text-xs text-slate-800 truncate">
                                {m.nama_pelanggaran}
                              </span>
                              {selectedMasterId === String(m.id) && (
                                <span className="text-rose-600 text-xs font-bold shrink-0">✓</span>
                              )}
                            </button>
                          )),
                        ]
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tanggal Kejadian */}
          <Field label="Tanggal Kejadian">
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={control}
            />
          </Field>

          {/* Keterangan Tambahan */}
          <Field label="Keterangan Tambahan (Opsional)">
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Kronologi singkat, lokasi kejadian, saksi, dsb..."
              rows={2}
              className={control}
            />
          </Field>

          {/* Foto Bukti */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Foto Bukti <span className="text-slate-400 font-normal lowercase">(opsional · auto-kompres)</span>
            </label>

            {fotoBase64 ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoBase64} className="w-full max-h-40 object-cover" alt="Bukti" />
                <button
                  type="button"
                  onClick={() => {
                    setFotoBase64(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-rose-600 cursor-pointer"
                  title="Hapus foto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-slate-200 hover:border-rose-300 rounded-xl py-4 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:bg-rose-50/40 transition cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  <Camera className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-600">
                  {uploading ? 'Memproses gambar…' : 'Ambil atau pilih foto bukti'}
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFoto}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function ModalFilterPelanggaran({
  value,
  asramas,
  onClose,
  onApply,
}: {
  value: DaftarPelanggarFilter
  asramas: string[]
  onClose: () => void
  onApply: (filters: DaftarPelanggarFilter) => void
}) {
  const [draft, setDraft] = useState<DaftarPelanggarFilter>({ ...value })
  const [error, setError] = useState('')

  const set = (key: keyof DaftarPelanggarFilter, val: unknown) => {
    setDraft((d) => ({
      ...d,
      [key]: val === '' || val === undefined ? undefined : val,
    }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.tanggalMulai && draft.tanggalSelesai && draft.tanggalMulai > draft.tanggalSelesai) {
      setError('Tanggal mulai harus sebelum tanggal selesai.')
      return
    }
    if (
      draft.minKejadian != null &&
      draft.maxKejadian != null &&
      draft.minKejadian > draft.maxKejadian
    ) {
      setError('Jumlah kejadian minimum melebihi maksimum.')
      return
    }
    onApply(draft)
  }

  return (
    <Modal
      title="Filter & Urutkan Pelanggar"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            className={button}
            onClick={() => {
              setDraft({
                search: value.search,
                page: 1,
                pageSize: value.pageSize || 10,
                sort: 'jumlah',
                direction: 'desc',
              })
              setError('')
            }}
          >
            Reset Default
          </button>
          <button form="keamanan-filter-form" className={primaryRose} type="submit">
            Terapkan Filter
          </button>
        </div>
      }
    >
      <form id="keamanan-filter-form" className="space-y-4 sm:space-y-5" onSubmit={submit}>
        {error && <ErrorMessage message={error} />}

        {/* Section 1: Rentang Waktu */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Rentang Waktu Kejadian
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Dari Tanggal">
              <input
                type="date"
                className={control}
                value={draft.tanggalMulai ?? ''}
                onChange={(e) => set('tanggalMulai', e.target.value)}
              />
            </Field>
            <Field label="Sampai Tanggal">
              <input
                type="date"
                className={control}
                value={draft.tanggalSelesai ?? ''}
                onChange={(e) => set('tanggalSelesai', e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Lokasi Asrama */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Lokasi Asrama
          </h4>
          <Field label="Asrama Santri">
            <select
              className={control}
              value={draft.asrama ?? ''}
              onChange={(e) => set('asrama', e.target.value)}
            >
              <option value="">Semua Asrama</option>
              {asramas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="__unassigned__">Belum ditempatkan / Non-Asrama</option>
            </select>
          </Field>
        </div>

        {/* Section 3: Kategori Pelanggaran & Status SP */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Kategori & SP
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Kategori Pelanggaran">
              <select
                className={control}
                value={draft.kategori ?? ''}
                onChange={(e) => set('kategori', e.target.value)}
              >
                <option value="">Semua Kategori</option>
                <option value="RINGAN">Ringan</option>
                <option value="SEDANG">Sedang</option>
                <option value="BERAT">Berat</option>
              </select>
            </Field>

            <Field label="Status Surat Pembinaan (SP)">
              <select
                className={control}
                value={draft.spLevel ?? ''}
                onChange={(e) => set('spLevel', e.target.value)}
              >
                <option value="">Semua Santri</option>
                <option value="ADA_SP">Pernah Dapat SP (Aktif)</option>
                <option value="TANPA_SP">Tanpa SP</option>
                <option value="SP1">SP1 Saja</option>
                <option value="SP2">SP2 Saja</option>
                <option value="SP3">SP3 Saja</option>
                <option value="SK">SK (Skorsing/Keluaran) Saja</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Section 4: Batas Jumlah Kejadian */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Jumlah Kejadian Pelanggaran
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Jumlah Minimum">
              <input
                type="number"
                min={0}
                placeholder="Misal: 1"
                className={control}
                value={draft.minKejadian ?? ''}
                onChange={(e) =>
                  set(
                    'minKejadian',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
              />
            </Field>
            <Field label="Jumlah Maksimum">
              <input
                type="number"
                min={0}
                placeholder="Misal: 10"
                className={control}
                value={draft.maxKejadian ?? ''}
                onChange={(e) =>
                  set(
                    'maxKejadian',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
              />
            </Field>
          </div>
        </div>

        {/* Section 5: Pengurutan Data */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pengurutan
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Urut Berdasarkan">
              <select
                className={control}
                value={draft.sort ?? 'jumlah'}
                onChange={(e) => set('sort', e.target.value)}
              >
                <option value="jumlah">Jumlah Kejadian</option>
                <option value="terakhir">Waktu Melanggar Terakhir</option>
                <option value="nama">Nama Santri</option>
                <option value="sp">Level SP Terakhir</option>
              </select>
            </Field>

            <Field label="Arah Urutan">
              <select
                className={control}
                value={draft.direction ?? 'desc'}
                onChange={(e) => set('direction', e.target.value)}
              >
                <option value="desc">Menurun (Terbanyak / Terbaru / Z–A)</option>
                <option value="asc">Menaik (Paling Sedikit / Terlama / A–Z)</option>
              </select>
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  )
}

