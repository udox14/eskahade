'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
  aktifkanKembaliSantri,
  getFilterOptions,
  getSantriAktif,
  getSantriNonaktif,
  nonaktifkanSantri,
} from './actions'
import {
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RotateCcw,
  Search,
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

type TabKey = 'aktif' | 'nonaktif'

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
  kelasSekolahList,
  searchInput,
  setSearchInput,
  asrama,
  setAsrama,
  kelasSekolah,
  setKelasSekolah,
  pageSize,
  setPageSize,
  loading,
  onApply,
}: {
  asramaList: string[]
  kelasSekolahList: string[]
  searchInput: string
  setSearchInput: (value: string) => void
  asrama: string
  setAsrama: (value: string) => void
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
            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
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
    await onSubmit({ tanggalMulai, tanggalRencanaAktif, alasan, catatan })
    setSaving(false)
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

export default function SantriNonaktifPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<TabKey>('aktif')
  const [asramaList, setAsramaList] = useState<string[]>([])
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
  const [kelasSekolah, setKelasSekolah] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [showModal, setShowModal] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    getFilterOptions().then(options => {
      setAsramaList(options.asramaList)
      setKelasSekolahList(options.kelasSekolahList)
    })
  }, [])

  const load = useCallback(async (
    pg = 1,
    override?: { search?: string; asrama?: string; kelasSekolah?: string; pageSize?: number }
  ) => {
    setLoading(true)
    try {
      const effectiveSearch = override?.search ?? search
      const effectiveAsrama = override?.asrama ?? asrama
      const effectiveKelasSekolah = override?.kelasSekolah ?? kelasSekolah
      const effectivePageSize = override?.pageSize ?? pageSize
      const params = {
        search: effectiveSearch || undefined,
        asrama: effectiveAsrama !== 'SEMUA' ? effectiveAsrama : undefined,
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
  }, [asrama, kelasSekolah, pageSize, search, tab])

  useEffect(() => {
    if (hasLoaded) load(1)
  }, [tab, pageSize, load, hasLoaded])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected = rows.length > 0 && rows.every(row => selectedSet.has(row.id))

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

  const handleApply = () => {
    const nextSearch = searchInput.trim()
    setSearch(nextSearch)
    load(1, { search: nextSearch })
  }

  const handleNonaktif = async (payload: { tanggalMulai: string; tanggalRencanaAktif: string; alasan: string; catatan: string }) => {
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
    load(page)
  }

  const handleRestore = async () => {
    if (!await confirm(`Aktifkan kembali ${fmtNum(selectedIds.length)} santri?`)) return
    setRestoring(true)
    const res = await aktifkanKembaliSantri({ santriIds: selectedIds, tanggalAktif: today() })
    setRestoring(false)
    if ('error' in res) {
      toast.error('Gagal', { description: res.error })
      return
    }
    toast.success(`${fmtNum(res.count)} santri aktif kembali`)
    load(page)
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

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5">
      <DashboardPageHeader
        title="Nonaktif Sementara"
        description="Kelola santri yang pulang sementara setelah pelepasan dan akan aktif kembali saat evaluasi."
      />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {([
            { key: 'aktif', label: 'Nonaktifkan', icon: UserMinus },
            { key: 'nonaktif', label: 'Daftar Nonaktif', icon: UserCheck },
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

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{fmtNum(selectedIds.length)} dipilih</span>
            {tab === 'aktif' ? (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
              >
                <UserMinus className="w-4 h-4" /> Nonaktifkan
              </button>
            ) : (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Aktifkan Kembali
              </button>
            )}
          </div>
        )}
      </div>

      <FilterBar
        asramaList={asramaList}
        kelasSekolahList={kelasSekolahList}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        asrama={asrama}
        setAsrama={setAsrama}
        kelasSekolah={kelasSekolah}
        setKelasSekolah={setKelasSekolah}
        pageSize={pageSize}
        setPageSize={setPageSize}
        loading={loading}
        onApply={handleApply}
      />

      {renderRows()}

      {showModal && (
        <NonaktifModal
          count={selectedIds.length}
          onClose={() => setShowModal(false)}
          onSubmit={handleNonaktif}
        />
      )}
    </div>
  )
}
