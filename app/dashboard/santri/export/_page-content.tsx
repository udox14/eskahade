'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getFilterOptions, getDataExport,
  KOLOM_TERSEDIA, type ExportFilter, type SortBy, type KolomExport
} from './actions'
import {
  FileSpreadsheet, Filter, Download, RefreshCw,
  ChevronDown, ChevronUp, Check, Loader2, Users, Settings2
} from 'lucide-react'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'nama_lengkap',    label: 'Nama (A-Z)' },
  { value: 'nis',             label: 'NIS' },
  { value: 'asrama',          label: 'Asrama & Kamar' },
  { value: 'kamar',           label: 'Kamar' },
  { value: 'kelas_pesantren', label: 'Kelas Pesantren' },
  { value: 'sekolah',         label: 'Sekolah & Kelas' },
  { value: 'tahun_masuk',     label: 'Tahun Masuk' },
]

const KOLOM_GROUPS = [...new Set(KOLOM_TERSEDIA.map(k => k.group))]

const KOLOM_DEFAULT: KolomExport[] = ['nis', 'nama_lengkap', 'jenis_kelamin', 'asrama', 'kamar', 'sekolah', 'kelas_sekolah']

// ── Komponen: Toggle pilih kolom ──────────────────────────────────────────────
function KolomPicker({ selected, onChange }: {
  selected: KolomExport[]
  onChange: (k: KolomExport[]) => void
}) {
  const toggle = (k: KolomExport) =>
    onChange(selected.includes(k) ? selected.filter(x => x !== k) : [...selected, k])

  const pilihSemua  = () => onChange(KOLOM_TERSEDIA.map(k => k.key))
  const hapusSemua  = () => onChange([])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{selected.length} kolom dipilih</span>
        <div className="flex gap-1.5">
          <button onClick={pilihSemua} className="text-[10px] font-bold text-emerald-600 hover:underline">Pilih semua</button>
          <span className="text-slate-300">·</span>
          <button onClick={hapusSemua} className="text-[10px] font-bold text-red-500 hover:underline">Hapus semua</button>
        </div>
      </div>
      {KOLOM_GROUPS.map(grp => (
        <div key={grp}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{grp}</p>
          <div className="flex flex-wrap gap-1.5">
            {KOLOM_TERSEDIA.filter(k => k.group === grp).map(k => (
              <button key={k.key} onClick={() => toggle(k.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  selected.includes(k.key)
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}>
                {selected.includes(k.key) && <Check className="w-3 h-3" />}
                {k.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Komponen: Section collapsible ────────────────────────────────────────────
function Section({ title, icon: Icon, badge, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; badge?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-slate-800 text-sm">{title}</span>
          {badge && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  )
}

// ── Komponen: Select / Input filter ──────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, placeholder = 'Semua' }: {
  label: string; value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExportSantriPage() {
  const [opts, setOpts]         = useState<any>(null)
  const [loadingOpts, setLoadingOpts] = useState(true)

  // Filter
  const [filter, setFilter]     = useState<ExportFilter>({})
  const [sortBy, setSortBy]     = useState<SortBy>('nama_lengkap')
  const [kolom, setKolom]       = useState<KolomExport[]>(KOLOM_DEFAULT)

  // Preview
  const [preview, setPreview]   = useState<any[]>([])
  const [total, setTotal]       = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [hasPreview, setHasPreview] = useState(false)

  const [exporting, setExporting] = useState(false)

  // Load opsi filter saat mount
  useEffect(() => {
    getFilterOptions().then(o => { setOpts(o); setLoadingOpts(false) })
  }, [])

  // Update kamar list saat asrama berubah
  const kamarList = opts?.kamarList ?? []

  const setF = (key: keyof ExportFilter, val: string | number | undefined) =>
    setFilter(prev => ({ ...prev, [key]: val || undefined }))

  // Hitung jumlah filter aktif
  const activeFilters = Object.values(filter).filter(v => v !== undefined && v !== '').length

  // Preview — ambil 10 baris pertama untuk konfirmasi
  const handlePreview = useCallback(async () => {
    if (kolom.length === 0) { toast.error('Pilih minimal 1 kolom'); return }
    setLoadingPreview(true)
    try {
      const res = await getDataExport(filter, kolom, sortBy)
      if ('error' in res) { toast.error(res.error); return }
      setPreview(res.rows.slice(0, 10))
      setTotal(res.total)
      setHasPreview(true)
    } finally { setLoadingPreview(false) }
  }, [filter, kolom, sortBy])

  // Export ke Excel
  const handleExport = async () => {
    if (kolom.length === 0) { toast.error('Pilih minimal 1 kolom'); return }
    setExporting(true)
    const toastId = toast.loading('Mengambil data...')
    try {
      const res = await getDataExport(filter, kolom, sortBy)
      if ('error' in res) { toast.error(res.error); return }

      const XLSX = await import('xlsx')

      // Header row
      const headerMap: Record<KolomExport, string> = {
        nis: 'NIS', nama_lengkap: 'Nama Lengkap', jenis_kelamin: 'JK',
        nik: 'NIK', tempat_lahir: 'Tempat Lahir', tanggal_lahir: 'Tgl Lahir',
        nama_ayah: 'Nama Ayah', nama_ibu: 'Nama Ibu', alamat: 'Alamat',
        asrama: 'Asrama', kamar: 'Kamar', tahun_masuk: 'Tahun Masuk',
        sekolah: 'Sekolah', kelas_sekolah: 'Kelas Sekolah',
        nama_kelas: 'Kelas Pesantren', marhalah: 'Marhalah',
      }

      const headers = ['No', ...kolom.map(k => headerMap[k])]
      const rows = res.rows.map((r: any, i: number) => [
        i + 1,
        ...kolom.map(k => {
          const v = r[k] ?? r['nama'] ?? ''
          if (k === 'jenis_kelamin') return v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : v
          return v ?? ''
        })
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      // Auto column width
      const colWidths = headers.map((h, i) => ({
        wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length), 8)
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      const filterDesc = [
        filter.asrama && filter.asrama,
        filter.jenis_kelamin === 'L' ? 'Laki' : filter.jenis_kelamin === 'P' ? 'Perempuan' : '',
        filter.nama_kelas && filter.nama_kelas,
      ].filter(Boolean).join('_') || 'Semua'

      XLSX.utils.book_append_sheet(wb, ws, 'Data Santri')
      XLSX.writeFile(wb, `Data_Santri_${filterDesc}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)

      toast.success(`Berhasil export ${res.total} data santri`)
    } catch (e) {
      toast.error('Gagal export')
    } finally {
      setExporting(false)
      toast.dismiss(toastId)
    }
  }

  const kolomBadge = `${kolom.length}/${KOLOM_TERSEDIA.length} kolom`
  const filterBadge = activeFilters > 0 ? `${activeFilters} filter aktif` : undefined

  if (loadingOpts) {
    return (
      <div className="flex justify-center py-20 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat opsi...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          Export Data Santri
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Pilih filter, kolom, dan urutan — lalu export ke Excel
        </p>
      </div>

      {/* 1. Filter kriteria */}
      <Section title="Filter Kriteria" icon={Filter} badge={filterBadge} defaultOpen={true}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

          <FilterSelect label="Jenis Kelamin"
            value={filter.jenis_kelamin ?? ''}
            onChange={v => setF('jenis_kelamin', v as 'L' | 'P' || undefined)}
            options={['L', 'P']}
            placeholder="Semua" />

          <FilterSelect label="Asrama"
            value={filter.asrama ?? ''}
            onChange={v => { setF('asrama', v); setF('kamar', '') }}
            options={opts?.asramaList ?? []} />

          <FilterSelect label="Kamar"
            value={filter.kamar ?? ''}
            onChange={v => setF('kamar', v)}
            options={filter.asrama ? kamarList : []}
            placeholder={filter.asrama ? 'Semua Kamar' : '← Pilih asrama dulu'} />

          <FilterSelect label="Kelas Pesantren"
            value={filter.nama_kelas ?? ''}
            onChange={v => setF('nama_kelas', v)}
            options={opts?.kelasList?.map((k: any) => k.nama_kelas) ?? []} />

          <FilterSelect label="Marhalah"
            value={filter.marhalah ?? ''}
            onChange={v => setF('marhalah', v)}
            options={opts?.marhalahUnik ?? []} />

          <FilterSelect label="Sekolah"
            value={filter.sekolah ?? ''}
            onChange={v => setF('sekolah', v)}
            options={opts?.sekolahList ?? []} />

          <FilterSelect label="Kelas Sekolah"
            value={filter.kelas_sekolah ?? ''}
            onChange={v => setF('kelas_sekolah', v)}
            options={opts?.kelasSekolahList ?? []} />

          <FilterSelect label="Tahun Masuk"
            value={filter.tahun_masuk?.toString() ?? ''}
            onChange={v => setF('tahun_masuk', v ? Number(v) : undefined)}
            options={opts?.tahunList?.map(String) ?? []} />

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kata dalam Alamat</label>
            <input type="text" placeholder="Cth: Tasikmalaya"
              value={filter.alamat_kata ?? ''}
              onChange={e => setF('alamat_kata', e.target.value || undefined)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        {activeFilters > 0 && (
          <button onClick={() => setFilter({})}
            className="mt-3 text-xs text-red-500 hover:underline font-medium">
            × Hapus semua filter
          </button>
        )}
      </Section>

      {/* 2. Pilih kolom */}
      <Section title="Kolom yang Diexport" icon={Settings2} badge={kolomBadge} defaultOpen={true}>
        <KolomPicker selected={kolom} onChange={setKolom} />
      </Section>

      {/* 3. Urutan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold text-slate-700 shrink-0">Urutkan berdasarkan:</label>
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setSortBy(s.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  sortBy === s.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tombol aksi */}
      <div className="flex flex-wrap gap-3">
        <button onClick={handlePreview} disabled={loadingPreview || kolom.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Pratinjau Data
        </button>
        <button onClick={handleExport} disabled={exporting || kolom.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Mengexport...' : 'Export Excel'}
        </button>
      </div>

      {/* Preview tabel */}
      {hasPreview && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800 text-sm">
                Pratinjau — {total} data ditemukan
              </span>
              {total > 10 && (
                <span className="text-xs text-slate-400">(menampilkan 10 pertama)</span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">No</th>
                  {kolom.map(k => (
                    <th key={k} className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {KOLOM_TERSEDIA.find(x => x.key === k)?.label ?? k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    {kolom.map(k => (
                      <td key={k} className="px-3 py-2 text-slate-700 max-w-[180px] truncate">
                        {k === 'jenis_kelamin'
                          ? (row[k] === 'L' ? 'Laki-laki' : row[k] === 'P' ? 'Perempuan' : row[k])
                          : (row[k] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              Tidak ada data yang cocok dengan filter ini.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
