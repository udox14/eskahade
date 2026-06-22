'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  aktifkanKembaliSantri,
  getFilterOptions,
  getSantriAktif,
  getSantriIdsByStatus,
  getSantriNonaktif,
  nonaktifkanSantri,
} from './actions'
import {
  arsipkanSantriDariNonaktif,
  getArsipForDownload,
  getGrupArsip,
  getSantriDalamGrup,
  hapusArsipMassal,
  hapusArsipPermanen,
  restoreSantri,
} from '../arsip/actions'
import {
  Archive,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  GraduationCap,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

type SantriRow = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  kelas_sekolah: string | null
  sekolah: string | null
}

type SantriNonaktifRow = SantriRow & {
  tanggal_mulai: string | null
  tanggal_rencana_aktif: string | null
  alasan: string | null
  catatan: string | null
}

type TabKey = 'aktif' | 'nonaktif' | 'alumni'

type GrupArsip = {
  key: string
  angkatan: number | null
  catatan: string | null
  tanggal_arsip: string
  jumlah: number
  asramaList: string[]
}

type ArsipRow = {
  id: string
  santri_id_asli: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  tanggal_arsip: string
  catatan: string | null
  angkatan: number | null
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

function fmtTgl(value: string | null) {
  if (!value) return '-'
  try {
    return format(new Date(value.replace(' ', 'T')), 'dd MMM yyyy', { locale: id })
  } catch {
    return value
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function EmptyState({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center py-14 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
      <Icon className="w-10 h-10 text-slate-200" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

function Pager({
  page,
  totalPages,
  loading,
  onPage,
}: {
  page: number
  totalPages: number
  loading: boolean
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1 || loading}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Sebelumnya
      </button>
      <span className="text-sm text-slate-500">Hal {page}/{totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages || loading}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
      >
        Berikutnya <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function FilterBar({
  asramaList,
  kamarList,
  kelasSekolahList,
  searchInput,
  setSearchInput,
  asrama,
  setAsrama,
  kamar,
  setKamar,
  kelasSekolah,
  setKelasSekolah,
  pageSize,
  setPageSize,
  loading,
  onApply,
}: {
  asramaList: string[]
  kamarList: string[]
  kelasSekolahList: string[]
  searchInput: string
  setSearchInput: (value: string) => void
  asrama: string
  setAsrama: (value: string) => void
  kamar: string
  setKamar: (value: string) => void
  kelasSekolah: string
  setKelasSekolah: (value: string) => void
  pageSize: number
  setPageSize: (value: number) => void
  loading: boolean
  onApply: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
          <select
            value={asrama}
            onChange={e => setAsrama(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="SEMUA">Semua Asrama</option>
            {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Kamar</label>
          <select
            value={kamar}
            onChange={e => setKamar(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="SEMUA">Semua Kamar</option>
            <option value="TANPA_KAMAR">Tanpa Kamar</option>
            {kamarList.map(k => <option key={k} value={k}>Kamar {k}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Kelas Formal</label>
          <select
            value={kelasSekolah}
            onChange={e => setKelasSekolah(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="SEMUA">Semua Kelas</option>
            {kelasSekolahList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
          </select>
        </div>
        <form onSubmit={e => { e.preventDefault(); onApply() }} className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Nama atau NIS..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </form>
        <button
          onClick={onApply}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors self-end"
        >
          <Filter className="w-4 h-4" />
          {loading ? 'Memuat...' : 'Tampilkan'}
        </button>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Baris:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none"
          >
            {[10, 20, 50, 100, 0].map(v => <option key={v} value={v}>{v === 0 ? 'Semua' : v}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function NonaktifModal({
  count,
  onClose,
  onSubmit,
}: {
  count: number
  onClose: () => void
  onSubmit: (payload: { tanggalMulai: string; tanggalRencanaAktif: string; alasan: string; catatan: string }) => Promise<void>
}) {
  const [tanggalMulai, setTanggalMulai] = useState(today())
  const [tanggalRencanaAktif, setTanggalRencanaAktif] = useState('')
  const [alasan, setAlasan] = useState('Pelepasan kelas 9/12')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ tanggalMulai, tanggalRencanaAktif, alasan, catatan })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">Nonaktifkan Sementara</h3>
              <p className="text-sm text-slate-500 mt-0.5">{fmtNum(count)} santri dipilih</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Mulai Nonaktif</span>
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={e => setTanggalMulai(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
              <label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Rencana Aktif</span>
                <input
                  type="date"
                  value={tanggalRencanaAktif}
                  onChange={e => setTanggalRencanaAktif(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Alasan</span>
              <input
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Catatan</span>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                rows={3}
                placeholder="Opsional"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </label>
            <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Santri akan tidak muncul di kegiatan yang hanya mengambil status aktif. Data induk, kelas, asrama, dan riwayat tetap disimpan.</p>
            </div>
          </div>

          <div className="p-5 pt-0 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Nonaktifkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AlumniModal({
  count,
  groups,
  onClose,
  onSubmit,
}: {
  count: number
  groups: GrupArsip[]
  onClose: () => void
  onSubmit: (payload: { mode: 'existing' | 'new'; groupKey: string; catatan: string }) => Promise<void>
}) {
  const [mode, setMode] = useState<'existing' | 'new'>(groups.length > 0 ? 'existing' : 'new')
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? '')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (groups.length > 0 && !groupKey) {
      setMode('existing')
      setGroupKey(groups[0].key)
    }
  }, [groupKey, groups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ mode, groupKey, catatan })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">Jadikan Alumni</h3>
              <p className="text-sm text-slate-500 mt-0.5">{fmtNum(count)} santri nonaktif dipilih</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('existing')}
                disabled={groups.length === 0}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${mode === 'existing' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}
              >
                Grup Lama
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === 'new' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}
              >
                Grup Baru
              </button>
            </div>

            {mode === 'existing' ? (
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pilih Grup Arsip</span>
                <select
                  value={groupKey}
                  onChange={e => setGroupKey(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {groups.map(group => (
                    <option key={group.key} value={group.key}>
                      {group.catatan || (group.angkatan ? `Angkatan ${group.angkatan}` : `Arsip ${group.tanggal_arsip}`)} - {fmtTgl(group.tanggal_arsip)} ({fmtNum(group.jumlah)})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Catatan Grup Baru</span>
                <input
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  required
                  placeholder="Contoh: Wisuda Angkatan 2026"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>
            )}

            <div className="flex gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800">
              <GraduationCap className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Santri akan dipindahkan dari daftar nonaktif ke Arsip Alumni. Log nonaktif aktif akan ditutup otomatis.</p>
            </div>
          </div>

          <div className="p-5 pt-0 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving || (mode === 'existing' && !groupKey)} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Jadikan Alumni'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SantriNonaktifPage() {
  const confirm = useConfirm()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'alumni'
    ? 'alumni'
    : searchParams.get('tab') === 'nonaktif'
      ? 'nonaktif'
      : 'aktif'
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [kelasSekolahList, setKelasSekolahList] = useState<string[]>([])
  const [rows, setRows] = useState<Array<SantriRow | SantriNonaktifRow>>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [kamar, setKamar] = useState('SEMUA')
  const [kelasSekolah, setKelasSekolah] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [showModal, setShowModal] = useState(false)
  const [showAlumniModal, setShowAlumniModal] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const [groups, setGroups] = useState<GrupArsip[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [activeGroup, setActiveGroup] = useState<GrupArsip | null>(null)
  const [archiveRows, setArchiveRows] = useState<ArsipRow[]>([])
  const [archiveTotal, setArchiveTotal] = useState(0)
  const [archivePage, setArchivePage] = useState(1)
  const [archivePageSize, setArchivePageSize] = useState(20)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveAsrama, setArchiveAsrama] = useState('SEMUA')
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([])
  const [loadingArchiveRows, setLoadingArchiveRows] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)

  useEffect(() => {
    getFilterOptions().then(options => {
      setAsramaList(options.asramaList)
      setKamarList(options.kamarList)
      setKelasSekolahList(options.kelasSekolahList)
    })
  }, [])

  const labelGroup = (group: GrupArsip) => {
    if (group.catatan) return group.catatan
    if (group.angkatan) return `Angkatan ${group.angkatan}`
    return `Arsip ${group.tanggal_arsip}`
  }

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    try {
      const data = await getGrupArsip()
      setGroups(data)
      setGroupsLoaded(true)
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'alumni' && !groupsLoaded) loadGroups()
  }, [groupsLoaded, loadGroups, tab])

  const load = useCallback(async (
    pg = 1,
    override?: { search?: string; asrama?: string; kamar?: string; kelasSekolah?: string; pageSize?: number }
  ) => {
    setLoading(true)
    try {
      const effectiveSearch = override?.search ?? search
      const effectiveAsrama = override?.asrama ?? asrama
      const effectiveKamar = override?.kamar ?? kamar
      const effectiveKelasSekolah = override?.kelasSekolah ?? kelasSekolah
      const effectivePageSize = override?.pageSize ?? pageSize
      const params = {
        search: effectiveSearch || undefined,
        asrama: effectiveAsrama !== 'SEMUA' ? effectiveAsrama : undefined,
        kamar: effectiveKamar !== 'SEMUA' ? effectiveKamar : undefined,
        kelasSekolah: effectiveKelasSekolah !== 'SEMUA' ? effectiveKelasSekolah : undefined,
        page: pg,
        pageSize: effectivePageSize,
      }
      const res = tab === 'aktif'
        ? await getSantriAktif(params)
        : await getSantriNonaktif(params)
      setRows(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
      setSelectedIds([])
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [asrama, kamar, kelasSekolah, pageSize, search, tab])

  useEffect(() => {
    if (hasLoaded && tab !== 'alumni') load(1)
  }, [tab, pageSize, load, hasLoaded])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected = rows.length > 0 && rows.every(row => selectedSet.has(row.id))
  const allFilteredSelected = total > 0 && selectedIds.length >= total

  const toggleOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !rows.some(row => row.id === id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...rows.map(row => row.id)])])
    }
  }

  const selectAllFiltered = async () => {
    setSelectingAll(true)
    try {
      const res = await getSantriIdsByStatus(
        tab === 'aktif' ? 'aktif' : 'nonaktif_sementara',
        {
          search: search || undefined,
          asrama: asrama !== 'SEMUA' ? asrama : undefined,
          kamar: kamar !== 'SEMUA' ? kamar : undefined,
          kelasSekolah: kelasSekolah !== 'SEMUA' ? kelasSekolah : undefined,
        }
      )
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      setSelectedIds(res.ids)
    } finally {
      setSelectingAll(false)
    }
  }

  const clearSelection = () => setSelectedIds([])

  const handleApply = () => {
    const nextSearch = searchInput.trim()
    setSearch(nextSearch)
    load(1, { search: nextSearch })
  }

  const handleNonaktif = async (payload: { tanggalMulai: string; tanggalRencanaAktif: string; alasan: string; catatan: string }) => {
    try {
      const res = await nonaktifkanSantri({
        santriIds: selectedIds,
        tanggalMulai: payload.tanggalMulai,
        tanggalRencanaAktif: payload.tanggalRencanaAktif || undefined,
        alasan: payload.alasan,
        catatan: payload.catatan || undefined,
      })
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      toast.success(`${fmtNum(res.count)} santri dinonaktifkan sementara`)
      setShowModal(false)
      await load(page)
    } catch (error) {
      toast.error('Gagal', {
        description: error instanceof Error ? error.message : 'Nonaktifkan santri belum berhasil.',
      })
    }
  }

  const handleRestore = async () => {
    if (!await confirm(`Aktifkan kembali ${fmtNum(selectedIds.length)} santri?`)) return
    setRestoring(true)
    try {
      const res = await aktifkanKembaliSantri({ santriIds: selectedIds, tanggalAktif: today() })
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      toast.success(`${fmtNum(res.count)} santri aktif kembali`)
      load(1)
    } catch (error) {
      toast.error('Gagal', {
        description: error instanceof Error ? error.message : 'Aktifkan kembali santri belum berhasil.',
      })
    } finally {
      setRestoring(false)
    }
  }

  const openArchiveGroup = async (group: GrupArsip, pg = 1, search = archiveSearch, asrama = archiveAsrama, pageSizeValue = archivePageSize) => {
    setActiveGroup(group)
    setLoadingArchiveRows(true)
    try {
      const res = await getSantriDalamGrup(group.angkatan, group.catatan, group.tanggal_arsip, {
        search: search || undefined,
        asrama: asrama !== 'SEMUA' ? asrama : undefined,
        page: pg,
        pageSize: pageSizeValue,
      })
      setArchiveRows(res.data)
      setArchiveTotal(res.total)
      setArchivePage(pg)
      setSelectedArchiveIds([])
    } finally {
      setLoadingArchiveRows(false)
    }
  }

  const handleArchiveNonaktif = async (payload: { mode: 'existing' | 'new'; groupKey: string; catatan: string }) => {
    const group = groups.find(item => item.key === payload.groupKey)
    if (payload.mode === 'existing' && !group) {
      toast.error('Grup arsip tidak ditemukan')
      return
    }
    setArchiving(true)
    try {
      const res = await arsipkanSantriDariNonaktif({
        santriIds: selectedIds,
        target: payload.mode === 'existing'
          ? { mode: 'existing', group: { angkatan: group!.angkatan, catatan: group!.catatan, tanggal_arsip: group!.tanggal_arsip } }
          : { mode: 'new', catatan: payload.catatan },
      })
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      const msg = res.gagal > 0 ? `${fmtNum(res.berhasil)} berhasil, ${fmtNum(res.gagal)} gagal` : `${fmtNum(res.berhasil)} santri menjadi alumni`
      toast.success('Arsip Alumni diperbarui', { description: msg })
      setShowAlumniModal(false)
      await loadGroups()
      await load(1)
    } catch (error) {
      toast.error('Gagal', {
        description: error instanceof Error ? error.message : 'Jadikan alumni belum berhasil.',
      })
    } finally {
      setArchiving(false)
    }
  }

  const handleArchiveRestore = async () => {
    if (selectedArchiveIds.length === 0) return
    if (!await confirm(`Restore ${fmtNum(selectedArchiveIds.length)} alumni ke daftar aktif?`)) return
    setArchiveBusy(true)
    try {
      const res = await restoreSantri(selectedArchiveIds)
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      toast.success(`${fmtNum(res.berhasil)} santri direstore`)
      await loadGroups()
      if (activeGroup) await openArchiveGroup(activeGroup, archivePage)
    } catch (error) {
      toast.error('Gagal', {
        description: error instanceof Error ? error.message : 'Restore alumni belum berhasil.',
      })
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleArchiveDelete = async (id?: string) => {
    const ids = id ? [id] : selectedArchiveIds
    if (ids.length === 0) return
    if (!await confirm(`Hapus ${fmtNum(ids.length)} catatan arsip? Catatan alumni aktif harus direstore dulu sebelum bisa dihapus.`)) return
    setArchiveBusy(true)
    try {
      const res = id ? await hapusArsipPermanen(id) : await hapusArsipMassal(ids)
      if ('error' in res) {
        toast.error('Gagal hapus', { description: res.error })
        return
      }
      toast.success('Catatan arsip diperbarui')
      await loadGroups()
      if (activeGroup) await openArchiveGroup(activeGroup, archivePage)
    } catch (error) {
      toast.error('Gagal hapus', {
        description: error instanceof Error ? error.message : 'Hapus catatan arsip belum berhasil.',
      })
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleArchiveDownload = async () => {
    const ids = selectedArchiveIds.length > 0 ? selectedArchiveIds : undefined
    setArchiveBusy(true)
    try {
      const res = await getArsipForDownload(ids, ids || !activeGroup ? undefined : {
        angkatan: activeGroup.angkatan,
        catatan: activeGroup.catatan,
        tanggal_arsip: activeGroup.tanggal_arsip,
      })
      if ('error' in res) {
        toast.error('Gagal', { description: res.error })
        return
      }
      const exportData = res.data.map((item: any) => {
        try {
          return { ...item, snapshot: item.snapshot ? JSON.parse(item.snapshot) : null }
        } catch {
          return item
        }
      })
      const blob = new Blob([JSON.stringify({
        keterangan: 'Backup Arsip Alumni - SKHDAPP',
        tanggal_export: new Date().toISOString(),
        total: exportData.length,
        data: exportData,
      }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arsip_alumni_${activeGroup?.angkatan ?? 'backup'}_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${fmtNum(exportData.length)} data didownload`)
    } finally {
      setArchiveBusy(false)
    }
  }

  const renderRows = () => {
    if (!hasLoaded && !loading) {
      return <EmptyState icon={Users} text="Atur filter lalu tekan Tampilkan untuk memuat data." />
    }
    if (loading) {
      return (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      )
    }
    if (rows.length === 0) {
      return <EmptyState icon={CheckCircle} text="Tidak ada data yang cocok." />
    }

    return (
      <>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span><strong className="text-slate-700">{fmtNum(total)}</strong> santri ditemukan</span>
          {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
        </div>

        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="w-4 h-4 rounded accent-amber-600" />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Santri</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kelas / Asrama</th>
                {tab === 'nonaktif' && (
                  <>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periode</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alasan</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => {
                const nonaktif = row as SantriNonaktifRow
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedSet.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 rounded accent-amber-600" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{row.nama_lengkap}</div>
                      <div className="text-xs text-slate-400">{row.nis}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{row.sekolah || '-'} {row.kelas_sekolah ? `Kelas ${row.kelas_sekolah}` : ''}</div>
                      <div className="text-slate-400">{row.asrama || '-'} / Kamar {row.kamar || '-'}</div>
                    </td>
                    {tab === 'nonaktif' && (
                      <>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="font-bold">{fmtTgl(nonaktif.tanggal_mulai)}</div>
                          <div className="text-slate-400">Rencana: {fmtTgl(nonaktif.tanggal_rencana_aktif)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[260px]">
                          <div className="truncate" title={nonaktif.alasan || ''}>{nonaktif.alasan || '-'}</div>
                          {nonaktif.catatan && <div className="text-slate-400 truncate" title={nonaktif.catatan}>{nonaktif.catatan}</div>}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {rows.map(row => {
            const nonaktif = row as SantriNonaktifRow
            return (
              <label key={row.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-3">
                <input type="checkbox" checked={selectedSet.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 mt-1 rounded accent-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">{row.nama_lengkap}</p>
                  <p className="text-xs text-slate-400">{row.nis} - {row.asrama || '-'} / {row.kamar || '-'}</p>
                  <p className="text-xs text-slate-500 mt-1">{row.sekolah || '-'} {row.kelas_sekolah ? `Kelas ${row.kelas_sekolah}` : ''}</p>
                  {tab === 'nonaktif' && (
                    <div className="mt-2 bg-amber-50 text-amber-800 rounded-xl p-2 text-xs">
                      <p className="font-bold">{fmtTgl(nonaktif.tanggal_mulai)} - rencana {fmtTgl(nonaktif.tanggal_rencana_aktif)}</p>
                      <p className="truncate">{nonaktif.alasan || '-'}</p>
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <Pager page={page} totalPages={totalPages} loading={loading} onPage={load} />
      </>
    )
  }

  const renderAlumni = () => {
    if (loadingGroups && !groupsLoaded) {
      return (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat arsip...</span>
        </div>
      )
    }

    if (!activeGroup) {
      if (!groupsLoaded) {
        return <EmptyState icon={Archive} text="Klik tab Alumni untuk memuat daftar arsip." />
      }
      if (groups.length === 0) {
        return <EmptyState icon={Archive} text="Belum ada data alumni di arsip." />
      }
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-slate-700">{fmtNum(groups.reduce((sum, group) => sum + group.jumlah, 0))}</strong> total alumni</span>
            <button onClick={loadGroups} disabled={loadingGroups} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-60">
              {loadingGroups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
          {groups.map(group => (
            <button
              key={group.key}
              onClick={() => openArchiveGroup(group, 1, '', 'SEMUA')}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-purple-200 hover:shadow-sm transition-all text-left"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 truncate">{labelGroup(group)}</p>
                <p className="text-xs text-slate-500 mt-1">{fmtNum(group.jumlah)} santri - {fmtTgl(group.tanggal_arsip)}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          ))}
        </div>
      )
    }

    const selectedArchiveSet = new Set(selectedArchiveIds)
    const allArchiveVisibleSelected = archiveRows.length > 0 && archiveRows.every(row => selectedArchiveSet.has(row.id))
    const archiveTotalPages = archivePageSize === 0 ? 1 : Math.max(1, Math.ceil(archiveTotal / archivePageSize))

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <button
            onClick={() => {
              setActiveGroup(null)
              setArchiveRows([])
              setSelectedArchiveIds([])
              setArchiveSearch('')
              setArchiveAsrama('SEMUA')
            }}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-purple-700"
          >
            <ChevronLeft className="w-4 h-4" /> Daftar Arsip
          </button>
          <span className="text-sm font-bold text-slate-800">{labelGroup(activeGroup)}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <form
              onSubmit={e => {
                e.preventDefault()
                openArchiveGroup(activeGroup, 1)
              }}
              className="flex-1 min-w-[180px]"
            >
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari Alumni</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  placeholder="Nama atau NIS..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </form>
            {activeGroup.asramaList.length > 1 && (
              <div className="min-w-[150px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
                <select
                  value={archiveAsrama}
                  onChange={e => {
                    setArchiveAsrama(e.target.value)
                    openArchiveGroup(activeGroup, 1, archiveSearch, e.target.value)
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="SEMUA">Semua Asrama</option>
                  {activeGroup.asramaList.map(asramaItem => <option key={asramaItem} value={asramaItem}>{asramaItem}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => openArchiveGroup(activeGroup, 1)} disabled={loadingArchiveRows} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-60 transition-colors">
              {loadingArchiveRows ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              Tampilkan
            </button>
            <button onClick={handleArchiveDownload} disabled={archiveBusy} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors">
              <Download className="w-4 h-4" /> {selectedArchiveIds.length > 0 ? `Download (${fmtNum(selectedArchiveIds.length)})` : 'Download Grup'}
            </button>
          </div>
        </div>

        {selectedArchiveIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-slate-500">{fmtNum(selectedArchiveIds.length)} dipilih</span>
            <button onClick={() => setSelectedArchiveIds([])} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
              <X className="w-4 h-4" /> Batal Pilih
            </button>
            <button onClick={() => handleArchiveDelete()} disabled={archiveBusy} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition-colors">
              <Trash2 className="w-4 h-4" /> Hapus Catatan
            </button>
            <button onClick={handleArchiveRestore} disabled={archiveBusy} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              <RotateCcw className="w-4 h-4" /> Restore
            </button>
          </div>
        )}

        {loadingArchiveRows ? (
          <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat alumni...</span>
          </div>
        ) : archiveRows.length === 0 ? (
          <EmptyState icon={Users} text="Tidak ada alumni di grup ini." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allArchiveVisibleSelected}
                      onChange={() => {
                        if (allArchiveVisibleSelected) setSelectedArchiveIds(prev => prev.filter(id => !archiveRows.some(row => row.id === id)))
                        else setSelectedArchiveIds(prev => [...new Set([...prev, ...archiveRows.map(row => row.id)])])
                      }}
                      className="w-4 h-4 rounded accent-purple-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Santri</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Asrama</th>
                  <th className="px-4 py-3 text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {archiveRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedArchiveSet.has(row.id)}
                        onChange={() => setSelectedArchiveIds(prev => prev.includes(row.id) ? prev.filter(item => item !== row.id) : [...prev, row.id])}
                        className="w-4 h-4 rounded accent-purple-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{row.nama_lengkap}</div>
                      <div className="text-xs text-slate-400">{row.nis}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{row.asrama || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleArchiveDelete(row.id)} disabled={archiveBusy} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50" title="Hapus catatan arsip">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {archiveTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => openArchiveGroup(activeGroup, archivePage - 1)} disabled={archivePage <= 1 || loadingArchiveRows} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <span className="text-sm text-slate-500">Hal {archivePage}/{archiveTotalPages}</span>
            <button onClick={() => openArchiveGroup(activeGroup, archivePage + 1)} disabled={archivePage >= archiveTotalPages || loadingArchiveRows} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-5">
      <DashboardPageHeader
        title="Status Santri"
        description="Kelola alur santri aktif, nonaktif sementara, lalu alumni final."
      />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {([
            { key: 'aktif', label: 'Nonaktifkan', icon: UserMinus },
            { key: 'nonaktif', label: 'Daftar Nonaktif', icon: UserCheck },
            { key: 'alumni', label: 'Alumni', icon: Archive },
          ] as const).map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === item.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {tab !== 'alumni' && (selectedIds.length > 0 || (tab === 'nonaktif' && hasLoaded && total > 0)) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-slate-500">{fmtNum(selectedIds.length)} dipilih</span>
            {tab === 'nonaktif' && total > 0 && !allFilteredSelected && (
              <button
                onClick={selectAllFiltered}
                disabled={selectingAll || loading}
                className="flex items-center gap-2 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 disabled:opacity-60 transition-colors"
              >
                {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Pilih Semua ({fmtNum(total)})
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                onClick={clearSelection}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" /> Batal Pilih
              </button>
            )}
            {tab === 'aktif' ? (
              <button
                onClick={() => setShowModal(true)}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
              >
                <UserMinus className="w-4 h-4" /> Nonaktifkan
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (!groupsLoaded) loadGroups()
                    setShowAlumniModal(true)
                  }}
                  disabled={archiving || selectedIds.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-60 transition-colors"
                >
                  {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  Jadikan Alumni
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring || selectedIds.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Aktifkan Kembali
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {tab !== 'alumni' && (
        <FilterBar
          asramaList={asramaList}
          kamarList={kamarList}
          kelasSekolahList={kelasSekolahList}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          asrama={asrama}
          setAsrama={setAsrama}
          kamar={kamar}
          setKamar={setKamar}
          kelasSekolah={kelasSekolah}
          setKelasSekolah={setKelasSekolah}
          pageSize={pageSize}
          setPageSize={setPageSize}
          loading={loading}
          onApply={handleApply}
        />
      )}

      {tab === 'alumni' ? renderAlumni() : renderRows()}

      {showModal && (
        <NonaktifModal
          count={selectedIds.length}
          onClose={() => setShowModal(false)}
          onSubmit={handleNonaktif}
        />
      )}
      {showAlumniModal && (
        <AlumniModal
          count={selectedIds.length}
          groups={groups}
          onClose={() => setShowAlumniModal(false)}
          onSubmit={handleArchiveNonaktif}
        />
      )}
    </div>
  )
}
