'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSantriAktifUntukArsip, getFilterOptionsSantri,
  getGrupArsip, getSantriDalamGrup,
  arsipkanSantri, restoreSantri,
  hapusArsipPermanen, hapusArsipMassal,
  getArsipForDownload
} from './actions'
import {
  Archive, RotateCcw, ArrowLeft, Search, Loader2,
  CheckSquare, Square, Trash2, AlertTriangle,
  Users, Info, X, Download, Filter, GraduationCap,
  ChevronRight, ChevronLeft, Calendar, BookOpen
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { Button, TextInput, NativeSelect, SegmentedControl, ActionIcon } from '@mantine/core'

const PAGE_SIZE_OPTIONS = [10, 50, 100, 0]
const ARCHIVE_BATCH_SIZE = 10

type Grup = {
  key: string
  angkatan: number | null
  catatan: string | null
  tanggal_arsip: string
  jumlah: number
  asramaList: string[]
}

function PaginationBar({
  page,
  total,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  total: number
  pageSize: number
  loading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : pageSize === 0 ? 1 : (page - 1) * pageSize + 1
  const end = pageSize === 0 ? total : Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-t bg-slate-50">
      <p className="text-xs text-slate-500">
        {total === 0 ? 'Tidak ada data' : `Menampilkan ${start}-${end} dari ${total} santri`}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          Tampilkan
          <NativeSelect
            value={pageSize}
            disabled={loading}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            size="xs"
            style={{ width: 80 }}
            data={PAGE_SIZE_OPTIONS.map(size => ({ label: size === 0 ? 'SEMUA' : String(size), value: String(size) }))}
          />
        </div>
        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <ActionIcon
              onClick={() => onPageChange(page - 1)}
              disabled={loading || page <= 1}
              variant="default"
              size="sm"
              title="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </ActionIcon>
            <span className="text-xs font-bold text-slate-600 min-w-16 text-center">{page} / {totalPages}</span>
            <ActionIcon
              onClick={() => onPageChange(page + 1)}
              disabled={loading || page >= totalPages}
              variant="default"
              size="sm"
              title="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </ActionIcon>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArsipSantriPage() {
  const confirm = useConfirm()
  const router = useRouter()
  const [tab, setTab] = useState<'ARSIPKAN' | 'DAFTAR_ARSIP'>('ARSIPKAN')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── TAB ARSIPKAN ──
  const [santriList, setSantriList] = useState<any[]>([])
  const [santriTotal, setSantriTotal] = useState(0)
  const [santriPage, setSantriPage] = useState(1)
  const [santriPageSize, setSantriPageSize] = useState(10)
  const [loadingSantri, setLoadingSantri] = useState(false)
  const [filterSantri, setFilterSantri] = useState({ search: '', asrama: '', status_kamar: '', sekolah: '', kelas_sekolah: '', kelas_pesantren: '', tahun_masuk: '' })
  const [optsSantri, setOptsSantri] = useState<{ asramaList: string[], sekolahList: string[], kelasList: string[], tahunList: number[] }>({ asramaList: [], sekolahList: [], kelasList: [], tahunList: [] })
  const [selectedArsip, setSelectedArsip] = useState<Set<string>>(new Set())
  const [catatanArsip, setCatatanArsip] = useState('')
  const [isArsipkan, setIsArsipkan] = useState(false)
  const [showFilterSantri, setShowFilterSantri] = useState(false)

  // ── TAB DAFTAR ARSIP — LEVEL 1: GRUP ──
  const [grupList, setGrupList] = useState<Grup[]>([])
  const [loadingGrup, setLoadingGrup] = useState(false)
  const [grupTotal, setGrupTotal] = useState(0)

  // ── TAB DAFTAR ARSIP — LEVEL 2: SANTRI DALAM GRUP ──
  const [activeGrup, setActiveGrup] = useState<Grup | null>(null)
  const [santriArsipList, setSantriArsipList] = useState<any[]>([])
  const [santriArsipTotal, setSantriArsipTotal] = useState(0)
  const [santriArsipPage, setSantriArsipPage] = useState(1)
  const [santriArsipPageSize, setSantriArsipPageSize] = useState(10)
  const [loadingSantriArsip, setLoadingSantriArsip] = useState(false)
  const [filterSantriArsip, setFilterSantriArsip] = useState({ search: '', asrama: '' })
  const [hasLoadedSantri, setHasLoadedSantri] = useState(false)
  const [hasLoadedGrup, setHasLoadedGrup] = useState(false)
  const [optsArsipAsrama, setOptsArsipAsrama] = useState<string[]>([])

  const [selectedRestore, setSelectedRestore] = useState<Set<string>>(new Set())
  const [isRestore, setIsRestore] = useState(false)
  const [isHapusMassal, setIsHapusMassal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => { loadFilterOptions() }, [])

  const loadFilterOptions = async () => {
    const os = await getFilterOptionsSantri()
    setOptsSantri(os)
  }

  const loadSantri = async (page: number, filter: typeof filterSantri, pageSize = santriPageSize) => {
    setHasLoadedSantri(true)
    setLoadingSantri(true)
    const res = await getSantriAktifUntukArsip({ ...filter, tahun_masuk: filter.tahun_masuk ? Number(filter.tahun_masuk) : undefined, page, pageSize })
    setSantriList(res.data)
    setSelectedArsip(new Set())
    setSantriTotal(res.total); setSantriPage(page)
    setLoadingSantri(false)
  }

  const handleFilterSantriChange = (key: string, val: string) => {
    const next = { ...filterSantri, [key]: val }
    setFilterSantri(next)
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = setTimeout(() => loadSantri(1, next), 350)
  }

  const loadGrup = async () => {
    setHasLoadedGrup(true)
    setLoadingGrup(true)
    const data = await getGrupArsip()
    setGrupList(data)
    setGrupTotal(data.reduce((s, g) => s + g.jumlah, 0))
    setLoadingGrup(false)
  }

  const bukaGrup = async (grup: Grup) => {
    setActiveGrup(grup)
    setSelectedRestore(new Set())
    setFilterSantriArsip({ search: '', asrama: '' })
    setOptsArsipAsrama(grup.asramaList)
    loadSantriGrup(1, { search: '', asrama: '' }, santriArsipPageSize, grup)
  }

  const loadSantriGrup = async (
    page: number,
    filter: typeof filterSantriArsip,
    pageSize = santriArsipPageSize,
    grup?: Grup
  ) => {
    const g = grup ?? activeGrup
    if (!g) return
    setLoadingSantriArsip(true)
    const res = await getSantriDalamGrup(g.angkatan, g.catatan, g.tanggal_arsip, { ...filter, page, pageSize })
    setSantriArsipList(res.data)
    setSelectedRestore(new Set())
    setSantriArsipTotal(res.total); setSantriArsipPage(page)
    setLoadingSantriArsip(false)
  }

  const handleFilterSantriArsipChange = (key: string, val: string) => {
    const next = { ...filterSantriArsip, [key]: val }
    setFilterSantriArsip(next)
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = setTimeout(() => loadSantriGrup(1, next), 350)
  }

  const toggleSelectArsip = (id: string) => setSelectedArsip(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAllSantri = () => {
    if (selectedArsip.size === santriList.length && santriList.length > 0) setSelectedArsip(new Set())
    else setSelectedArsip(new Set(santriList.map(s => s.id)))
  }
  const toggleSelectRestore = (id: string) => setSelectedRestore(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAllRestore = () => {
    if (selectedRestore.size === santriArsipList.length && santriArsipList.length > 0) setSelectedRestore(new Set())
    else setSelectedRestore(new Set(santriArsipList.map(a => a.id)))
  }

  const activeFilterCount = Object.entries(filterSantri).filter(([k, v]) => k !== 'search' && v).length

  const handleArsipkan = async () => {
    if (selectedArsip.size === 0) return toast.warning("Pilih santri yang akan dijadikan alumni")
    if (!await confirm(`Jadikan ${selectedArsip.size} santri sebagai ALUMNI?\n\nData historis tetap disimpan di D1. Santri hanya disembunyikan dari daftar aktif.`)) return
    setIsArsipkan(true)
    const ids = Array.from(selectedArsip)
    const toastId = toast.loading(`Memproses 0 / ${ids.length} santri...`)
    let berhasil = 0
    let gagal = 0
    const errors: string[] = []

    try {
      for (let i = 0; i < ids.length; i += ARCHIVE_BATCH_SIZE) {
        const chunk = ids.slice(i, i + ARCHIVE_BATCH_SIZE)
        toast.loading(`Memproses ${Math.min(i + chunk.length, ids.length)} / ${ids.length} santri...`, { id: toastId })
        const res = await arsipkanSantri(chunk, catatanArsip)
        if ('error' in res) throw new Error(res.error)
        berhasil += res.berhasil
        gagal += res.gagal
        errors.push(...res.errors)
      }

      toast.dismiss(toastId)
      const msg = gagal > 0 ? `${berhasil} berhasil, ${gagal} gagal` : `${berhasil} santri berhasil diarsipkan`
      toast.success("Selesai!", { description: msg })
      if (errors.length > 0) console.error("Errors:", errors)
      setCatatanArsip('')
      loadSantri(1, filterSantri)
      if (hasLoadedGrup) loadGrup()
    } catch (err: any) {
      toast.dismiss(toastId)
      toast.error("Gagal", { description: err?.message ?? 'Proses arsip terhenti' })
    } finally {
      setIsArsipkan(false)
    }
  }

  const handleRestore = async () => {
    if (selectedRestore.size === 0) return toast.warning("Pilih data yang akan direstore")
    if (!await confirm(`Restore ${selectedRestore.size} santri ke daftar aktif?\n\nData historis dan riwayat yang masih ada akan tetap dipertahankan.`)) return
    setIsRestore(true)
    const toastId = toast.loading(`Merestore ${selectedRestore.size} santri...`)
    const res = await restoreSantri(Array.from(selectedRestore))
    toast.dismiss(toastId); setIsRestore(false)
    if ('error' in res) { toast.error("Gagal", { description: res.error }); return }
    const msg = (res?.gagal ?? 0) > 0 ? `${res?.berhasil} berhasil, ${res?.gagal} gagal` : `${res?.berhasil} santri berhasil direstore`
    toast.success("Restore Selesai!", { description: msg })
    loadSantriGrup(1, filterSantriArsip)
    loadGrup()
  }

  const handleHapusMassal = async () => {
    if (selectedRestore.size === 0) return toast.warning("Pilih data yang akan dihapus")
    if (!await confirm(`Hapus ${selectedRestore.size} catatan arsip?\n\nCatatan alumni soft-archive tidak bisa dihapus sebelum santri direstore.`)) return
    setIsHapusMassal(true)
    const toastId = toast.loading(`Menghapus ${selectedRestore.size} arsip...`)
    const res = await hapusArsipMassal(Array.from(selectedRestore))
    toast.dismiss(toastId); setIsHapusMassal(false)
    if ('error' in res) { toast.error("Gagal hapus", { description: res.error }); return }
    toast.success(`${res?.count} catatan arsip dihapus`)
    loadSantriGrup(1, filterSantriArsip)
    loadGrup()
    if ((santriArsipTotal - (res?.count ?? 0)) <= 0) setActiveGrup(null)
  }

  const handleHapusSatu = async (id: string, nama: string) => {
    if (!await confirm(`Hapus catatan arsip "${nama}"?\n\nUntuk alumni soft-archive, restore dulu sebelum menghapus catatannya.`)) return
    const res = await hapusArsipPermanen(id)
    if ('error' in res) { toast.error("Gagal hapus", { description: res.error }); return }
    toast.success("Catatan arsip dihapus")
    loadSantriGrup(santriArsipPage, filterSantriArsip)
    loadGrup()
  }

  const handleDownload = async () => {
    const ids = selectedRestore.size > 0 ? Array.from(selectedRestore) as string[] : undefined
    setIsDownloading(true)
    const toastId = toast.loading("Menyiapkan data...")
    const res = await getArsipForDownload(ids, ids || !activeGrup ? undefined : {
      angkatan: activeGrup?.angkatan ?? null,
      catatan: activeGrup?.catatan ?? null,
      tanggal_arsip: activeGrup?.tanggal_arsip ?? ''
    })
    toast.dismiss(toastId); setIsDownloading(false)
    if ('error' in res || !('data' in res)) { toast.error("Gagal", { description: (res as any).error }); return }
    const exportData = res.data.map((item: any) => {
      try {
        return { ...item, snapshot: item.snapshot ? JSON.parse(item.snapshot) : null }
      } catch {
        return item
      }
    })
    const blob = new Blob([JSON.stringify({
      keterangan: "Backup Arsip Alumni - SKHDAPP",
      tanggal_export: new Date().toISOString(),
      total: exportData.length,
      data: exportData
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `arsip_alumni_${activeGrup?.angkatan ?? 'backup'}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success(`${exportData.length} data berhasil didownload`)
  }

  const labelGrup = (g: Grup) => {
    if (g.catatan) return g.catatan
    if (g.angkatan) return `Angkatan ${g.angkatan}`
    return `Backup ${g.tanggal_arsip}`
  }

  return (
    <div className="space-y-6 pb-28">

      {/* HEADER */}
      <div className="flex items-start gap-4 border-b pb-4">
        <ActionIcon onClick={() => router.back()} variant="subtle" color="gray" size="lg" title="Kembali">
          <ArrowLeft className="w-5 h-5" />
        </ActionIcon>
        <DashboardPageHeader
          title="Arsip Alumni"
          description="Jadikan santri alumni tanpa menghapus data historis."
          className="flex-1"
        />
      </div>

      {/* TABS */}
      <SegmentedControl
        value={tab}
        onChange={v => setTab(v as 'ARSIPKAN' | 'DAFTAR_ARSIP')}
        data={[
          { label: 'Jadikan Alumni', value: 'ARSIPKAN' },
          {
            label: (
              <span className="flex items-center gap-1">
                Daftar Arsip & Restore
                {grupList.length > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{grupList.length}</span>
                )}
              </span>
            ),
            value: 'DAFTAR_ARSIP',
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl">
          <p className="text-lg font-bold text-blue-700 leading-none">{santriTotal}</p>
          <p className="text-[11px] text-blue-500 mt-1">Santri Aktif</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 px-3 py-2 rounded-xl">
          <p className="text-lg font-bold text-purple-700 leading-none">{grupTotal}</p>
          <p className="text-[11px] text-purple-500 mt-1">Total Alumni</p>
        </div>
      </div>

      {/* ══ TAB 1: JADIKAN ALUMNI ══ */}
      {tab === 'ARSIPKAN' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Pilih santri yang sudah lulus → sistem membuat snapshot arsip → lalu mengubah statusnya menjadi alumni agar tidak muncul di daftar aktif.</p>
          </div>

          {/* Kontrol filter */}
          <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <TextInput
                  label={<span className="text-xs font-bold text-slate-500 uppercase">Catatan Arsip (Opsional)</span>}
                  value={catatanArsip}
                  onChange={e => setCatatanArsip(e.target.value)}
                  placeholder="Contoh: Wisuda Angkatan 2024"
                />
              </div>
              <div className="md:w-64">
                <TextInput
                  label={<span className="text-xs font-bold text-slate-500 uppercase">Cari</span>}
                  value={filterSantri.search}
                  onChange={e => handleFilterSantriChange('search', e.target.value)}
                  placeholder="Nama / NIS..."
                  leftSection={<Search className="w-4 h-4" />}
                />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={() => setShowFilterSantri(p => !p)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition-colors ${showFilterSantri || activeFilterCount > 0 ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Filter className="w-4 h-4" /> Filter
                  {activeFilterCount > 0 && <span className="bg-purple-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
                </button>
                <Button
                  onClick={() => loadSantri(1, filterSantri)}
                  loading={loadingSantri}
                  color="grape"
                  leftSection={!loadingSantri ? <Search className="w-4 h-4" /> : undefined}
                >
                  Tampilkan
                </Button>
              </div>
            </div>
            {showFilterSantri && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t animate-in fade-in">
                <NativeSelect
                  label={<span className="text-xs font-bold text-slate-500">Asrama</span>}
                  value={filterSantri.asrama}
                  onChange={e => handleFilterSantriChange('asrama', e.target.value)}
                  data={[{ label: 'Semua', value: '' }, ...optsSantri.asramaList.map(a => ({ label: a, value: a }))]}
                />
                <NativeSelect
                  label={<span className="text-xs font-bold text-slate-500">Kamar</span>}
                  value={filterSantri.status_kamar}
                  onChange={e => handleFilterSantriChange('status_kamar', e.target.value)}
                  data={[{ label: 'Semua', value: '' }, { label: 'Tanpa Kamar', value: 'TANPA_KAMAR' }]}
                />
                <NativeSelect
                  label={<span className="text-xs font-bold text-slate-500">Sekolah</span>}
                  value={filterSantri.sekolah}
                  onChange={e => handleFilterSantriChange('sekolah', e.target.value)}
                  data={[{ label: 'Semua', value: '' }, ...optsSantri.sekolahList.map(s => ({ label: s, value: s }))]}
                />
                <TextInput
                  label={<span className="text-xs font-bold text-slate-500">Kelas Sekolah</span>}
                  value={filterSantri.kelas_sekolah}
                  onChange={e => handleFilterSantriChange('kelas_sekolah', e.target.value)}
                  placeholder="Contoh: 9A"
                />
                <NativeSelect
                  label={<span className="text-xs font-bold text-slate-500">Kelas Pesantren</span>}
                  value={filterSantri.kelas_pesantren}
                  onChange={e => handleFilterSantriChange('kelas_pesantren', e.target.value)}
                  data={[{ label: 'Semua', value: '' }, ...optsSantri.kelasList.map(k => ({ label: k, value: k }))]}
                />
                <NativeSelect
                  label={<span className="text-xs font-bold text-slate-500">Tahun Masuk</span>}
                  value={filterSantri.tahun_masuk}
                  onChange={e => handleFilterSantriChange('tahun_masuk', e.target.value)}
                  data={[{ label: 'Semua', value: '' }, ...optsSantri.tahunList.map(t => ({ label: String(t), value: String(t) }))]}
                />
                {activeFilterCount > 0 && (
                  <Button
                    onClick={() => { const e = { search: filterSantri.search, asrama: '', status_kamar: '', sekolah: '', kelas_sekolah: '', kelas_pesantren: '', tahun_masuk: '' }; setFilterSantri(e); loadSantri(1, e) }}
                    variant="transparent"
                    color="red"
                    size="xs"
                    className="col-span-full justify-end"
                    leftSection={<X className="w-3 h-3" />}
                  >
                    Reset filter
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Tabel santri aktif */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAllSantri} className="text-slate-500 hover:text-purple-600">
                  {selectedArsip.size === santriList.length && santriList.length > 0 ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5" />}
                </button>
                <span className="text-sm font-bold text-slate-600">
                  {santriList.length} dari {santriTotal} santri{selectedArsip.size > 0 && ` • ${selectedArsip.size} dipilih`}
                </span>
              </div>
              {selectedArsip.size > 0 && <button onClick={() => setSelectedArsip(new Set())} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Batal pilih</button>}
            </div>
            <div className="max-h-[450px] overflow-y-auto">
              {!hasLoadedSantri ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 text-slate-200" />
                  <p className="text-sm">Klik <strong className="text-slate-600">Tampilkan</strong> untuk memuat daftar santri</p>
                </div>
              ) : loadingSantri ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
              ) : santriList.length === 0 ? (
                <div className="py-16 text-center text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p>Tidak ada santri ditemukan</p></div>
              ) : (
                <>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 z-10 border-b">
                      <tr>
                        <th className="px-4 py-2 w-10"></th>
                        <th className="px-2 py-2">Nama / NIS</th>
                        <th className="px-4 py-2 hidden md:table-cell">Asrama</th>
                        <th className="px-4 py-2 hidden md:table-cell">Sekolah</th>
                        <th className="px-4 py-2 hidden md:table-cell">Kls Sekolah</th>
                        <th className="px-4 py-2 hidden md:table-cell">Kls Pesantren</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {santriList.map(s => {
                        const isSelected = selectedArsip.has(s.id)
                        const kelasPesantren = s.kelas_pesantren_nama
                        return (
                          <tr key={s.id} onClick={() => toggleSelectArsip(s.id)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3">{isSelected ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5 text-slate-300" />}</td>
                            <td className="px-2 py-3">
                              <p className={`font-bold ${isSelected ? 'text-purple-800' : 'text-slate-800'}`}>{s.nama_lengkap}</p>
                              <p className="text-xs text-slate-400 font-mono">{s.nis}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{s.asrama || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{s.sekolah || '-'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{s.kelas_sekolah || '-'}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {kelasPesantren && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{kelasPesantren}</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <PaginationBar
                    page={santriPage}
                    total={santriTotal}
                    pageSize={santriPageSize}
                    loading={loadingSantri}
                    onPageChange={nextPage => loadSantri(nextPage, filterSantri)}
                    onPageSizeChange={nextPageSize => {
                      setSantriPageSize(nextPageSize)
                      loadSantri(1, filterSantri, nextPageSize)
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 2: DAFTAR ARSIP & RESTORE ══ */}
      {tab === 'DAFTAR_ARSIP' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">

          {/* ── LEVEL 1: DAFTAR GRUP ── */}
          {!activeGrup && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">Pilih batch arsip untuk melihat daftar alumni, download snapshot, atau restore ke daftar aktif.</p>
              </div>

              {!hasLoadedGrup ? (
                <div className="flex flex-col items-center py-14 gap-3 text-center">
                  <Archive className="w-10 h-10 text-slate-200" />
                  <p className="text-slate-500 text-sm">Klik <strong>Tampilkan Arsip</strong> untuk memuat data</p>
                  <Button
                    onClick={loadGrup}
                    loading={loadingGrup}
                    color="blue"
                    leftSection={!loadingGrup ? <Archive className="w-4 h-4" /> : undefined}
                  >
                    Tampilkan Arsip
                  </Button>
                </div>
              ) : loadingGrup ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
              ) : grupList.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Archive className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>Belum ada data alumni di arsip</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {grupList.map(g => (
                    <button key={g.key} onClick={() => bukaGrup(g)}
                      className="w-full bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm hover:border-purple-200 transition-all text-left group">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${g.angkatan ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {g.angkatan
                          ? <BookOpen className="w-6 h-6 text-purple-600" />
                          : <Calendar className="w-6 h-6 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{labelGrup(g)}</p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {g.jumlah} santri
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(g.tanggal_arsip).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          {g.asramaList.slice(0, 3).map(a => (
                            <span key={a} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                          {g.asramaList.length > 3 && <span className="text-[10px] text-slate-400">+{g.asramaList.length - 3} asrama</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── LEVEL 2: SANTRI DALAM GRUP ── */}
          {activeGrup && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveGrup(null)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-purple-600 font-bold transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Daftar Arsip
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-bold text-slate-800">{labelGrup(activeGrup)}</span>
              </div>

              {/* Filter + aksi */}
              <div className="flex flex-col md:flex-row gap-3">
                <TextInput
                  className="flex-1"
                  value={filterSantriArsip.search}
                  onChange={e => handleFilterSantriArsipChange('search', e.target.value)}
                  placeholder="Cari nama / NIS..."
                  leftSection={<Search className="w-4 h-4" />}
                />
                {optsArsipAsrama.length > 1 && (
                  <NativeSelect
                    value={filterSantriArsip.asrama}
                    onChange={e => handleFilterSantriArsipChange('asrama', e.target.value)}
                    data={[{ label: 'Semua Asrama', value: '' }, ...optsArsipAsrama.map(a => ({ label: a, value: a }))]}
                  />
                )}
                <Button
                  onClick={handleDownload}
                  loading={isDownloading}
                  variant="default"
                  leftSection={!isDownloading ? <Download className="w-4 h-4" /> : undefined}
                >
                  {selectedRestore.size > 0 ? `Download Terpilih (${selectedRestore.size})` : 'Download Grup'}
                </Button>
              </div>

              {/* Tabel santri arsip */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleSelectAllRestore} className="text-slate-500 hover:text-green-600">
                      {selectedRestore.size === santriArsipList.length && santriArsipList.length > 0 ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="text-sm font-bold text-slate-600">
                      {santriArsipList.length} dari {santriArsipTotal} santri{selectedRestore.size > 0 && ` • ${selectedRestore.size} dipilih`}
                    </span>
                  </div>
                  {selectedRestore.size > 0 && <button onClick={() => setSelectedRestore(new Set())} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Batal pilih</button>}
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {loadingSantriArsip ? (
                    <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
                  ) : santriArsipList.length === 0 ? (
                    <div className="py-16 text-center text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p>Tidak ada santri ditemukan</p></div>
                  ) : (
                    <>
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 z-10 border-b">
                          <tr>
                            <th className="px-4 py-2 w-10"></th>
                            <th className="px-2 py-2">Nama / NIS</th>
                            <th className="px-4 py-2 hidden md:table-cell">Asrama</th>
                            <th className="px-4 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {santriArsipList.map(a => {
                            const isSelected = selectedRestore.has(a.id)
                            return (
                              <tr key={a.id} className={`transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3">
                                  <button onClick={() => toggleSelectRestore(a.id)}>
                                    {isSelected ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                                  </button>
                                </td>
                                <td className="px-2 py-3">
                                  <p className={`font-bold ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>{a.nama_lengkap}</p>
                                  <p className="text-xs text-slate-400 font-mono">{a.nis}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{a.asrama || '-'}</td>
                                <td className="px-4 py-3">
                                  <ActionIcon
                                    onClick={() => handleHapusSatu(a.id, a.nama_lengkap)}
                                    variant="subtle"
                                    color="red"
                                    size="sm"
                                    title="Hapus catatan arsip"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </ActionIcon>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <PaginationBar
                        page={santriArsipPage}
                        total={santriArsipTotal}
                        pageSize={santriArsipPageSize}
                        loading={loadingSantriArsip}
                        onPageChange={nextPage => loadSantriGrup(nextPage, filterSantriArsip)}
                        onPageSizeChange={nextPageSize => {
                          setSantriArsipPageSize(nextPageSize)
                          loadSantriGrup(1, filterSantriArsip, nextPageSize)
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ FLOATING ACTION BAR ══ */}
      {tab === 'ARSIPKAN' && selectedArsip.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm">{selectedArsip.size}</div>
              <div className="leading-tight">
                <p className="font-bold text-sm">Siap dijadikan alumni</p>
                <p className="text-xs text-slate-400">Status akan diubah menjadi alumni</p>
              </div>
            </div>
            <Button
              onClick={handleArsipkan}
              loading={isArsipkan}
              color="grape"
              leftSection={!isArsipkan ? <GraduationCap className="w-4 h-4" /> : undefined}
            >
              Jadikan Alumni
            </Button>
          </div>
        </div>
      )}

      {tab === 'DAFTAR_ARSIP' && activeGrup && selectedRestore.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{selectedRestore.size}</div>
              <div className="leading-tight">
                <p className="font-bold text-sm">Terpilih</p>
                <p className="text-xs text-slate-400">Restore atau hapus catatan</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleHapusMassal}
                loading={isHapusMassal}
                disabled={isRestore}
                color="red"
                leftSection={!isHapusMassal ? <Trash2 className="w-4 h-4" /> : undefined}
              >
                Hapus Catatan
              </Button>
              <Button
                onClick={handleRestore}
                loading={isRestore}
                disabled={isHapusMassal}
                color="green"
                leftSection={!isRestore ? <RotateCcw className="w-4 h-4" /> : undefined}
              >
                Restore
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
