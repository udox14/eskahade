'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFilterOptions, getDataExport, getKamarList } from './actions'
import {
  KOLOM_TERSEDIA, SORT_OPTIONS, KOLOM_DEFAULT, HEADER_MAP,
  type ExportFilter, type SortBy, type KolomExport
} from './constants'
import {
  FileSpreadsheet, Filter, Download, RefreshCw,
  ChevronDown, ChevronUp, Check, Loader2, Users, Settings2, Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Helpers ───────────────────────────────────────────────────────────────────
const KOLOM_GROUPS = [...new Set(KOLOM_TERSEDIA.map(k => k.group))]

// ── Komponen: Toggle pilih kolom ──────────────────────────────────────────────
function KolomPicker({ selected, onChange }: {
  selected: KolomExport[]
  onChange: (k: KolomExport[]) => void
}) {
  const toggle = (k: KolomExport) =>
    onChange(selected.includes(k) ? selected.filter(x => x !== k) : [...selected, k])

  const pilihSemua = () => onChange(KOLOM_TERSEDIA.map(k => k.key))
  const hapusSemua = () => onChange([])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{selected.length} kolom dipilih</span>
        <div className="flex gap-3">
          <button onClick={pilihSemua} className="text-[10px] font-black text-emerald-600 hover:text-emerald-500 uppercase tracking-widest transition-colors">Pilih semua</button>
          <button onClick={hapusSemua} className="text-[10px] font-black text-rose-600 hover:text-rose-500 uppercase tracking-widest transition-colors">Hapus semua</button>
        </div>
      </div>
      <div className="space-y-5">
        {KOLOM_GROUPS.map(grp => (
          <div key={grp} className="space-y-2">
            <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.3em]">{grp}</p>
            <div className="flex flex-wrap gap-2">
              {KOLOM_TERSEDIA.filter(k => k.group === grp).map(k => (
                <Button 
                  key={k.key} 
                  variant={selected.includes(k.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggle(k.key)}
                  className={cn(
                    "h-8 rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-sm",
                    selected.includes(k.key)
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                      : 'bg-card border-border hover:border-emerald-500/50'
                  )}
                >
                  {selected.includes(k.key) && <Check className="w-3 h-3 mr-1.5" />}
                  {k.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Komponen: Section collapsible ─────────────────────────────────────────────
function Section({ title, icon: Icon, badge, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; badge?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden rounded-[2rem]">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-xl transition-colors group-hover:bg-background">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-black text-foreground text-sm uppercase tracking-widest">{title}</span>
          {badge && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-[9px] px-2 h-5">{badge}</Badge>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-6 pb-6 border-t border-border/50 pt-5 animate-in slide-in-from-top-2 duration-300">{children}</div>}
    </Card>
  )
}

// ── Komponen: Multi-select chip ───────────────────────────────────────────────
function MultiChip({ label, selected, onChange, options, disabled = false, loading = false }: {
  label: string
  selected: string[]
  onChange: (v: string[]) => void
  options: string[]
  disabled?: boolean
  loading?: boolean
}) {
  if (loading) return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</label>
      <p className="text-xs text-muted-foreground italic py-1 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Memuat...
      </p>
    </div>
  )

  if (options.length === 0) return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</label>
      <p className="text-xs text-muted-foreground/40 italic py-1 border border-dashed rounded-xl px-3">{disabled ? '← Pilih asrama dulu untuk melihat opsi' : 'Tidak ada opsi tersedia'}</p>
    </div>
  )

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</label>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="text-[10px] font-black text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest">Hapus Semua</button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Button
            key={o}
            variant={selected.includes(o) ? "default" : "outline"}
            size="sm"
            onClick={() => toggle(o)}
            className={cn(
              "h-8 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm",
              selected.includes(o)
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'bg-card border-border hover:border-primary/50'
            )}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExportSantriPage() {
  const [opts, setOpts]               = useState<any>(null)
  const [loadingOpts, setLoadingOpts] = useState(true)

  // Remote fix: kamarList dikelola lewat state + useEffect
  const [kamarList, setKamarList]         = useState<string[]>([])
  const [loadingKamar, setLoadingKamar]   = useState(false)

  // Filter
  const [filter, setFilter] = useState<ExportFilter>({})
  const [sortBy, setSortBy] = useState<SortBy>('nama_lengkap')
  const [kolom, setKolom]   = useState<KolomExport[]>(KOLOM_DEFAULT)

  // Preview
  const [preview, setPreview]           = useState<any[]>([])
  const [total, setTotal]               = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [hasPreview, setHasPreview]     = useState(false)

  const [exporting, setExporting] = useState(false)

  // Load opsi filter saat mount
  useEffect(() => {
    getFilterOptions().then(o => { setOpts(o); setLoadingOpts(false) })
  }, [])

  // Remote fix: Fetch kamar setiap kali filter.asrama berubah
  useEffect(() => {
    if (!filter.asrama?.length) {
      setKamarList([])
      return
    }
    setLoadingKamar(true)
    Promise.all(filter.asrama.map(a => getKamarList(a)))
      .then(results => {
        const merged = [...new Set(results.flat())].sort((a, b) => {
          const na = parseInt(a), nb = parseInt(b)
          return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
        })
        setKamarList(merged)
      })
      .finally(() => setLoadingKamar(false))
  }, [filter.asrama])

  const setF = (key: keyof ExportFilter, val: any) =>
    setFilter(prev => ({ ...prev, [key]: val }))

  const setArr = (key: keyof ExportFilter) => (vals: string[]) =>
    setFilter(prev => ({ ...prev, [key]: vals.length > 0 ? vals : undefined }))

  // Hitung jumlah filter aktif
  const activeFilters = Object.values(filter).filter(v =>
    v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  ).length

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
      const headers = ['No', ...kolom.map(k => HEADER_MAP[k])]
      const rows = res.rows.map((r: any, i: number) => [
        i + 1,
        ...kolom.map(k => {
          const v = r[k] ?? ''
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
        filter.asrama?.join('-'),
        filter.jenis_kelamin === 'L' ? 'Laki' : filter.jenis_kelamin === 'P' ? 'Perempuan' : '',
        filter.nama_kelas?.join('-'),
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

  const kolomBadge  = `${kolom.length}/${KOLOM_TERSEDIA.length} kolom`
  const filterBadge = activeFilters > 0 ? `${activeFilters} filter aktif` : undefined

  if (loadingOpts) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3 text-muted-foreground animate-in fade-in duration-500">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <span className="text-xs font-black uppercase tracking-widest">Memuat Atribut Filter...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header Hero */}
      <div className="relative bg-emerald-950 border border-emerald-900/50 text-emerald-50 px-6 pt-6 pb-8 rounded-[2.5rem] shadow-xl shadow-emerald-900/10 overflow-hidden mb-2">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <h1 className="text-2xl font-black flex items-center gap-3 mb-1">
          <FileSpreadsheet className="w-6 h-6 text-emerald-400"/> Export Data Santri
        </h1>
        <p className="text-emerald-200/60 text-xs font-medium max-w-md">Kustomisasi kriteria, pilih atribut kolom, dan urutkan data sebelum diunduh ke format Excel.</p>
      </div>

      {/* 1. Filter kriteria */}
      <Section title="Filter Kriteria" icon={Filter} badge={filterBadge} defaultOpen={true}>
        <div className="space-y-6">

          {/* Jenis kelamin */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block">Jenis Kelamin</label>
            <div className="flex gap-2 max-w-sm">
              {(['', 'L', 'P'] as const).map(v => (
                <Button 
                  key={v} 
                  variant={(filter.jenis_kelamin ?? '') === v ? "default" : "outline"}
                  onClick={() => setF('jenis_kelamin', v || undefined)}
                  className={cn(
                    "flex-1 h-10 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm",
                    (filter.jenis_kelamin ?? '') === v
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'bg-card border-border hover:border-primary/50'
                  )}
                >
                  {v === '' ? 'Semua' : v === 'L' ? 'Laki-laki' : 'Perempuan'}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <MultiChip label="Asrama" selected={filter.asrama ?? []}
              onChange={vals => {
                setArr('asrama')(vals)
                // Reset kamar saat asrama berubah
                setF('kamar', undefined)
              }}
              options={opts?.asramaList ?? []} />

            <MultiChip label="Kamar" selected={filter.kamar ?? []}
              onChange={setArr('kamar')}
              options={kamarList}
              disabled={!filter.asrama?.length}
              loading={loadingKamar} />

            <MultiChip label="Kelas Pesantren" selected={filter.nama_kelas ?? []}
              onChange={setArr('nama_kelas')}
              options={opts?.kelasList ?? []} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MultiChip label="Marhalah" selected={filter.marhalah ?? []}
                onChange={setArr('marhalah')}
                options={opts?.marhalahUnik ?? []} />

              <MultiChip label="Sekolah" selected={filter.sekolah ?? []}
                onChange={setArr('sekolah')}
                options={opts?.sekolahList ?? []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MultiChip label="Kelas Sekolah" selected={filter.kelas_sekolah ?? []}
                onChange={setArr('kelas_sekolah')}
                options={opts?.kelasSekolahList ?? []} />

              <MultiChip label="Tahun Masuk"
                selected={filter.tahun_masuk?.map(String) ?? []}
                onChange={vals => setF('tahun_masuk', vals.length ? vals.map(Number) : undefined)}
                options={opts?.tahunList?.map(String) ?? []} />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block">Kata dalam Alamat</label>
              <Input 
                placeholder="Cth: Tasikmalaya, Jawa Barat..."
                value={filter.alamat_kata ?? ''}
                onChange={e => setF('alamat_kata', e.target.value || undefined)}
                className="h-11 border-border bg-card rounded-xl px-4 text-sm focus:ring-emerald-500 font-medium" 
              />
            </div>
          </div>
        </div>

        {activeFilters > 0 && (
          <Button 
            variant="ghost" 
            onClick={() => { setFilter({}); setKamarList([]) }}
            className="mt-6 h-8 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-500/5 font-black uppercase tracking-widest gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Filter
          </Button>
        )}
      </Section>

      {/* 2. Pilih kolom */}
      <Section title="Kolom Atribut Export" icon={Settings2} badge={kolomBadge} defaultOpen={true}>
        <KolomPicker selected={kolom} onChange={setKolom} />
      </Section>

      {/* 3. Urutan */}
      <Card className="rounded-[2rem] border border-border shadow-sm p-4 bg-card">
        <div className="flex flex-col md:flex-row md:items-center gap-4 px-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] shrink-0">Urutkan Data Dari:</label>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map(s => (
              <Button 
                key={s.value} 
                variant={sortBy === s.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(s.value)}
                className={cn(
                  "h-8 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                  sortBy === s.value
                    ? 'bg-slate-900 text-white border-transparent'
                    : 'bg-card border-border hover:border-slate-400'
                )}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tombol aksi */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button 
          variant="outline"
          onClick={handlePreview} 
          disabled={loadingPreview || kolom.length === 0}
          className="flex-1 h-12 bg-card border-border text-foreground rounded-2xl font-black gap-2.5 shadow-sm hover:bg-muted/50 transition-all active:scale-[0.98]"
        >
          {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Users className="w-5 h-5 text-primary" />}
          Pratinjau Data
        </Button>
        <Button 
          onClick={handleExport} 
          disabled={exporting || kolom.length === 0}
          className="flex-[1.5] h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black gap-2.5 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-5 h-5" />}
          {exporting ? 'MENYIAPKAN DATA...' : 'EXPORT KE EXCEL'}
        </Button>
      </div>

      {/* Preview tabel */}
      {hasPreview && (
        <Card className="rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="font-black text-foreground text-sm uppercase tracking-widest block">
                  Pratinjau Export
                </span>
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                  {total} data ditemukan {total > 10 && "• menampilkan 10 pertama"}
                </span>
              </div>
            </div>
          </div>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12 h-10 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border/30">No</TableHead>
                  {kolom.map(k => (
                    <TableHead key={k} className="h-10 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                      {KOLOM_TERSEDIA.find(x => x.key === k)?.label ?? k}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={kolom.length + 1} className="h-32 text-center text-muted-foreground font-medium italic">
                      Tidak ada data yang cocok dengan kriteria filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  preview.map((row, i) => (
                    <TableRow key={i} className="group border-border/30 hover:bg-emerald-500/[0.02] transition-colors">
                      <td className="px-6 py-3 text-xs font-black text-muted-foreground/30 tabular-nums border-r border-border/30">{i + 1}</td>
                      {kolom.map(k => (
                        <td key={k} className="px-4 py-3 text-xs font-bold text-foreground">
                          {k === 'jenis_kelamin'
                            ? (row[k] === 'L' ? <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-transparent text-[10px] font-black px-2">Laki-laki</Badge> : <Badge variant="outline" className="bg-pink-500/5 text-pink-600 border-transparent text-[10px] font-black px-2">Perempuan</Badge>)
                            : (row[k] ?? <span className="text-muted-foreground/30 italic font-medium">—</span>)}
                        </td>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  )
}