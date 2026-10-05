'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getSupervisiHome,
  getCoverage,
  getSupervisiAnalytics,
  getActivityTeachers,
  startInterview,
  changeActivityStatus,
} from './actions'
import DeleteActivity from './delete-activity'
import { classContext, contextBooks } from '@/lib/supervisi/context'
import ActivityEditor from './activity-editor'
import type { Teacher } from '@/lib/supervisi/types'
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles'
import {
  ChalkboardTeacher,
  Clock,
  NotePencil,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  PlusCircle,
  Table,
  ChartBar,
  Gear,
  CaretLeft,
  CaretRight,
  CircleNotch,
  WarningCircle,
  BookOpen,
  ClipboardText,
  Lock,
  LockOpen,
  Trash,
} from '@phosphor-icons/react'

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  belum: {
    label: 'Belum Dimulai',
    badgeClass: 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/10',
  },
  draft: {
    label: 'Draft',
    badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  },
  selesai: {
    label: 'Selesai',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  },
}

function getPageRange(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function SupervisiHome({
  initial,
}: {
  initial: Awaited<ReturnType<typeof getSupervisiHome>>
}) {
  const router = useRouter()
  const [home, setHome] = useState(initial)
  const [activityId, setActivityId] = useState(initial.activities[0]?.id ?? '')
  const [tab, setTab] = useState<'rekap' | 'analitik' | 'kegiatan'>('rekap')

  // Filter & Pagination
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [kelas, setKelas] = useState('')
  const [page, setPage] = useState(1)

  // Data Async
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getCoverage>> | null>(null)
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getSupervisiAnalytics>> | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal & Form States
  const [editor, setEditor] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState(0)
  const [context, setContext] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  )

  const activity = home.activities.find((a) => a.id === activityId)
  const teacher = teachers.find((t) => t.id === teacherId)
  const selectedContext = teacher ? classContext(teacher, context || 'all') : null

  // Fetch coverage & analytics
  useEffect(() => {
    let active = true
    if (!activityId) return

    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      Promise.all([
        getCoverage(activityId, search, status, kelas, page),
        tab === 'analitik' ? getSupervisiAnalytics(activityId) : Promise.resolve(null),
      ])
        .then(([c, a]) => {
          if (active) {
            setCoverage(c)
            if (a) setAnalytics(a)
          }
        })
        .catch(() => {
          if (active) {
            setError('Data supervisi belum dapat dimuat. Periksa koneksi atau coba lagi.')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [activityId, search, status, kelas, page, tab, home])

  async function refresh() {
    const data = await getSupervisiHome()
    setHome(data)
    if (!data.activities.some((a) => a.id === activityId)) {
      setActivityId(data.activities[0]?.id ?? '')
    }
  }

  async function begin(guruId = 0) {
    setError('')
    setBusy(true)
    try {
      const t = await getActivityTeachers(activityId)
      setTeachers(t)
      setTeacherId(guruId)
      setContext('all')
      setStarting(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Daftar guru belum dapat dimuat.')
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    setBusy(true)
    setError('')
    try {
      const r = await startInterview(activityId, teacherId, context || 'all', date)
      if (r.ok) {
        router.push(`/dashboard/sekpen/supervisi/${r.data}`)
      } else {
        setError(r.error)
      }
    } catch {
      setError('Wawancara belum dapat dimulai. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function transition(next: 'terbuka' | 'ditutup') {
    if (!activity) return
    setBusy(true)
    setError('')
    try {
      const r = await changeActivityStatus(activity.id, next, activity.revision, reason)
      if (r.ok) {
        setReason('')
        await refresh()
      } else {
        setError(r.error)
      }
    } catch {
      setError('Status kegiatan belum dapat diubah.')
    } finally {
      setBusy(false)
    }
  }

  const totals = coverage?.totals ?? []
  const countByStatus = (s: string) => totals.find((t) => t.status === s)?.n ?? 0
  const totalTarget = totals.reduce((a, b) => a + b.n, 0)
  const totalPages = Math.max(1, Math.ceil((coverage?.total ?? 0) / 20))

  return (
    <div className="space-y-6 pb-20">
      {/* ── 1. HEADER HALAMAN ── */}
      <DashboardPageHeader
        title="Supervisi Pengajaran"
        description="Evaluasi pengalaman belajar santri, pantau keterlaksanaan pengajian, dan siapkan bahan pembinaan guru."
        action={
          activity?.status === 'terbuka' ? (
            <button
              disabled={busy}
              onClick={() => begin()}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4" weight="bold" />
              <span>Mulai Wawancara</span>
            </button>
          ) : home.admin && !activity ? (
            <button
              onClick={() => setEditor('new')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" weight="bold" />
              <span>Kegiatan Baru</span>
            </button>
          ) : undefined
        }
      />

      {/* Tombol Mulai Wawancara Mobile (Lebar Penuh Kiri-Kanan) */}
      {activity?.status === 'terbuka' ? (
        <div className="sm:hidden">
          <button
            type="button"
            disabled={busy}
            onClick={() => begin()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 px-4 text-sm font-bold shadow-sm transition"
          >
            <Plus className="w-4.5 h-4.5" weight="bold" />
            <span>Mulai Wawancara</span>
          </button>
        </div>
      ) : home.admin && !activity ? (
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setEditor('new')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 px-4 text-sm font-bold shadow-sm transition"
          >
            <PlusCircle className="w-4.5 h-4.5" weight="bold" />
            <span>Buat Kegiatan Baru</span>
          </button>
        </div>
      ) : null}

      {/* Pesan Kesalahan Global */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-xs sm:text-sm text-rose-700">
          <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. KOTAK INFORMASI KEGIATAN AKTIF ── */}
      {activity && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:px-4 sm:py-3 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Kegiatan:
            </span>
            {home.activities.length > 1 ? (
              <select
                aria-label="Pilih Kegiatan Supervisi"
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[280px] truncate transition"
                value={activityId}
                onChange={(e) => {
                  setActivityId(e.target.value)
                  setPage(1)
                  setCoverage(null)
                  setAnalytics(null)
                  setStarting(false)
                }}
              >
                {home.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nama} ({a.tahun_nama})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {activity.nama} ({activity.tahun_nama})
              </span>
            )}
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 capitalize ${
              activity.status === 'terbuka'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                : activity.status === 'persiapan'
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/10'
            }`}
          >
            {activity.status === 'terbuka'
              ? 'Aktif'
              : activity.status === 'persiapan'
                ? 'Persiapan'
                : 'Ditutup'}
          </span>
        </div>
      )}

      {/* Modal Activity Editor */}
      {editor && (
        <ActivityEditor
          years={home.years}
          activity={editor === 'new' ? undefined : activity}
          onClose={() => setEditor(null)}
          onSaved={async (id) => {
            await refresh()
            setActivityId(id)
            setEditor(null)
          }}
        />
      )}

      {/* Belum Ada Kegiatan */}
      {!activity && !editor && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 sm:p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ClipboardText className="h-6 w-6" weight="duotone" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Belum Ada Kegiatan Supervisi</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {home.admin
              ? 'Silakan klik tombol di bawah untuk memulai dan menyusun agenda supervisi guru pengajar.'
              : 'Kegiatan supervisi belum dibuka oleh administrator.'}
          </p>
          {home.admin && (
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setEditor('new')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition"
              >
                <PlusCircle className="w-4.5 h-4.5" weight="bold" />
                <span>Buat Kegiatan Baru</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ada Kegiatan Aktif */}
      {activity && (
        <>
          {/* ── 3. EMPAT KARTU METRIK KPI ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Target Guru */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Target Guru
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-slate-900">
                  {totalTarget}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <ChalkboardTeacher className="w-5 h-5" weight="duotone" />
              </div>
            </div>

            {/* Belum Dimulai */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Belum Dimulai
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-slate-700">
                  {countByStatus('belum')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
                <Clock className="w-5 h-5" weight="duotone" />
              </div>
            </div>

            {/* Draft Berjalan */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Draft Berjalan
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-amber-700">
                  {countByStatus('draft')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <NotePencil className="w-5 h-5" weight="duotone" />
              </div>
            </div>

            {/* Selesai */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Wawancara Selesai
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-emerald-700">
                  {countByStatus('selesai')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle className="w-5 h-5" weight="duotone" />
              </div>
            </div>
          </div>

          {/* ── 4. TAB NAVIGATION TERPADU ── */}
          <div className="flex border-b border-slate-200 bg-white px-2 sm:px-4 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => {
                setTab('rekap')
                setStarting(false)
              }}
              className={`flex items-center gap-2 py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition ${
                tab === 'rekap'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table className="w-4 h-4" weight={tab === 'rekap' ? 'fill' : 'regular'} />
              <span>Rekap</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('analitik')
                setStarting(false)
              }}
              className={`flex items-center gap-2 py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition ${
                tab === 'analitik'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ChartBar className="w-4 h-4" weight={tab === 'analitik' ? 'fill' : 'regular'} />
              <span>Analitik</span>
            </button>

            {home.admin && (
              <button
                type="button"
                onClick={() => {
                  setTab('kegiatan')
                  setStarting(false)
                }}
                className={`flex items-center gap-2 py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition ${
                  tab === 'kegiatan'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Gear className="w-4 h-4" weight={tab === 'kegiatan' ? 'fill' : 'regular'} />
                <span>Kelola</span>
              </button>
            )}
          </div>

          {/* ── FORM MULAI WAWANCARA (EXPANDED CARD) ── */}
          {starting && (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Mulai Wawancara Pengajar
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instrumen supervisi pengajaran santri. Seluruh kelas dan kitab guru terpilih otomatis.
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Guru */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Guru Pengajar <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={inputClass}
                      value={teacherId}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        setTeacherId(id)
                        setContext('all')
                      }}
                    >
                      <option value={0}>-- Pilih Guru Pengajar --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tanggal Wawancara */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Tanggal Wawancara <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Info Otomatis: Kelas, Kitab & Sesi Pengajian */}
                {selectedContext && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ChalkboardTeacher className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" weight="duotone" />
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">
                          Kelas Diniyah (Otomatis Terpilih Semua)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {selectedContext.kelas_nama || 'Semua Kelas'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <BookOpen className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" weight="duotone" />
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">
                          Kitab / Mata Pelajaran (Otomatis)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {contextBooks(selectedContext)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" weight="duotone" />
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">
                          Waktu Pengajian (Otomatis)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {selectedContext.sesi}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tombol Aksi */}
                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={!selectedContext || !date || busy}
                    className={buttonClass}
                    onClick={start}
                  >
                    {busy && <CircleNotch className="w-4 h-4 animate-spin" />}
                    <span>Buka Draft Wawancara</span>
                    <CaretRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={() => setStarting(false)}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. KONTEN TAB: REKAP ── */}
          {tab === 'rekap' && !starting && (
            <div className="space-y-4">
              {/* Toolbar Filter */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Cari nama guru pengajar..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="all">Semua Status</option>
                    <option value="belum">Belum Dimulai</option>
                    <option value="draft">Draft</option>
                    <option value="selesai">Selesai</option>
                  </select>

                  <select
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    value={kelas}
                    onChange={(e) => {
                      setKelas(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">Semua Kelas</option>
                    {coverage?.classes.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabel Daftar Pengajar */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                  <div className="hidden sm:grid sm:grid-cols-[2.5fr_1.2fr_1.5fr_120px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span>Pengajar & Kelas</span>
                    <span>Status</span>
                    <span>Progress Instrumen</span>
                    <span className="text-right">Aksi</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {coverage?.rows.map((r) => {
                      const statusConfig = STATUS_LABELS[r.status] || STATUS_LABELS.belum
                      const progressPct = Math.round((r.completed_count / 53) * 100)

                      return (
                        <div key={r.guru_id}>
                          {/* ── Tampilan Mobile: Super Compact (2 Baris Ringkas & Padat) ── */}
                          <div className="sm:hidden p-3.5 hover:bg-slate-50/50 transition flex flex-col gap-2">
                            {/* Baris 1: Nama Guru, Status Badge, dan Tombol Aksi */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {r.guru_nama}
                                </span>
                                <span
                                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeClass}`}
                                >
                                  {statusConfig.label}
                                </span>
                              </div>

                              <div className="shrink-0">
                                {r.interview_id ? (
                                  <Link
                                    href={`/dashboard/sekpen/supervisi/${r.interview_id}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 px-2.5 py-1 rounded-lg transition"
                                  >
                                    <span>{r.status === 'selesai' ? 'Lihat' : 'Draft'}</span>
                                    <CaretRight className="w-3 h-3" />
                                  </Link>
                                ) : r.status === 'belum' && activity.status === 'terbuka' ? (
                                  <button
                                    type="button"
                                    onClick={() => begin(r.guru_id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg shadow-xs transition"
                                  >
                                    <Plus className="w-3 h-3" weight="bold" />
                                    <span>Mulai</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {r.status === 'belum' ? '—' : 'Lain'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Baris 2: Kelas & Progress */}
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="truncate flex-1 min-w-0">
                                {r.kelas.length > 0 ? r.kelas.join(', ') : 'Belum ada kelas'}
                              </span>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-semibold text-slate-600 tabular-nums text-[11px]">
                                  {r.completed_count}/53
                                </span>
                                <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      r.completed_count === 53
                                        ? 'bg-emerald-600'
                                        : r.completed_count > 0
                                          ? 'bg-amber-500'
                                          : 'bg-slate-200'
                                    }`}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* ── Tampilan Desktop: Grid 4 Kolom Proporsional ── */}
                          <div className="hidden sm:grid sm:grid-cols-[2.5fr_1.2fr_1.5fr_120px] sm:items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition">
                            {/* Nama & Kelas */}
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-slate-900">
                                {r.guru_nama}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {r.kelas.length > 0 ? r.kelas.join(', ') : 'Belum ada kelas'}
                              </p>
                            </div>

                            {/* Status Wawancara */}
                            <div>
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusConfig.badgeClass}`}
                              >
                                {statusConfig.label}
                              </span>
                            </div>

                            {/* Progress Pengisian */}
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                                <span>{r.completed_count} / 53 item</span>
                                <span className="font-mono text-slate-400">{progressPct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    r.completed_count === 53
                                      ? 'bg-emerald-600'
                                      : r.completed_count > 0
                                        ? 'bg-amber-500'
                                        : 'bg-slate-200'
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Tombol Aksi */}
                            <div className="flex items-center justify-end">
                              {r.interview_id ? (
                                <Link
                                  href={`/dashboard/sekpen/supervisi/${r.interview_id}`}
                                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl transition"
                                >
                                  <span>{r.status === 'selesai' ? 'Lihat Hasil' : 'Buka Draft'}</span>
                                  <CaretRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : r.status === 'belum' && activity.status === 'terbuka' ? (
                                <button
                                  type="button"
                                  onClick={() => begin(r.guru_id)}
                                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl shadow-xs transition"
                                >
                                  <Plus className="w-3.5 h-3.5" weight="bold" />
                                  <span>Mulai</span>
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  {r.status === 'belum' ? '—' : 'Petugas lain'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {!coverage?.rows.length && (
                      <p className="p-12 text-center text-xs sm:text-sm text-slate-400">
                        Tidak ada guru pengajar yang sesuai dengan filter.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-1 pt-2">
                <span>
                  Menampilkan{' '}
                  <span className="font-semibold text-slate-800">
                    {coverage?.total === 0 ? 0 : (page - 1) * 20 + 1}–{Math.min(page * 20, coverage?.total ?? 0)}
                  </span>{' '}
                  dari <span className="font-semibold text-slate-800">{coverage?.total ?? 0}</span> guru
                </span>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* Tombol Sebelumnya */}
                    <button
                      type="button"
                      disabled={page === 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Halaman sebelumnya"
                      aria-label="Halaman sebelumnya"
                    >
                      <CaretLeft className="w-4 h-4" />
                    </button>

                    {/* Nomor Halaman */}
                    <div className="flex items-center gap-1">
                      {getPageRange(page, totalPages).map((p, i) =>
                        p === '...' ? (
                          <span key={`dots-${i}`} className="px-1.5 text-slate-400 select-none">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            disabled={loading}
                            onClick={() => setPage(Number(p))}
                            className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-semibold transition-colors ${
                              p === page
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>

                    {/* Tombol Berikutnya */}
                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Halaman berikutnya"
                      aria-label="Halaman berikutnya"
                    >
                      <CaretRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 6. KONTEN TAB: ANALITIK ── */}
          {tab === 'analitik' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ringkasan Hasil Evaluasi Santri
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {home.all
                      ? 'Menampilkan seluruh hasil wawancara selesai pada kegiatan ini.'
                      : 'Menampilkan hasil wawancara selesai milik Anda.'}
                  </p>
                </div>
                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1 rounded-full shrink-0">
                  {analytics?.count ?? 0} Wawancara Selesai
                </span>
              </div>

              {loading ? (
                <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ) : analytics?.count ? (
                <div className="space-y-4">
                  {analytics.sections.map((sec, idx) => (
                    <div
                      key={sec.title}
                      className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden"
                    >
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Bagian {idx + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            {sec.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {sec.rated} jawaban dinilai · {sec.unknown} tidak diketahui
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-base sm:text-lg font-bold tabular-nums text-emerald-700">
                            {sec.average?.toFixed(2) ?? '—'} <span className="text-xs text-slate-400 font-normal">/ 4.00</span>
                          </span>
                        </div>
                      </div>

                      {/* Bar Progress Rata-rata */}
                      <div className="px-5 pt-4">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all"
                            style={{ width: `${((sec.average ?? 0) / 4) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Detail Indikator Breakdown */}
                      <div className="p-4 sm:p-5">
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-between list-none">
                            <span>Lihat Distribusi Skor per Indikator</span>
                            <CaretRight className="w-3.5 h-3.5 transition group-open:rotate-90" />
                          </summary>
                          <div className="mt-4 space-y-4 pt-3 border-t border-slate-100">
                            {sec.indicators.map((ind) => (
                              <div key={ind.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs">
                                <p className="font-bold text-slate-800">{ind.label}</p>
                                <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1 mb-2">
                                  <span>Rata-rata: <strong className="text-emerald-700">{ind.average?.toFixed(2) ?? '—'}</strong></span>
                                  <span>·</span>
                                  <span>Dinilai: {ind.rated}</span>
                                  <span>·</span>
                                  <span>Tidak diketahui: {ind.unknown}</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60">
                                  {ind.distribution.map((distVal, scaleIdx) => (
                                    <div
                                      key={scaleIdx}
                                      className="p-2 rounded-lg bg-white border border-slate-200/60 flex items-center justify-between"
                                    >
                                      <span className="text-slate-500 font-medium truncate">
                                        Skala {scaleIdx + 1}
                                      </span>
                                      <span className="font-bold tabular-nums text-slate-800">
                                        {distVal}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs sm:text-sm text-slate-400 shadow-sm">
                  Belum ada hasil wawancara selesai yang dapat dianalisis pada kegiatan ini.
                </div>
              )}
            </div>
          )}

          {/* ── 7. KONTEN TAB: KEGIATAN (ADMIN ONLY) ── */}
          {tab === 'kegiatan' && home.admin && (
            <div className="space-y-6">
              {/* Header Tab Kelola Kegiatan dengan Tombol + Buat Kegiatan Baru */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Kelola Kegiatan Supervisi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Atur agenda supervisi, konfigurasi target guru, dan kelola status pembukaan/penutupan kegiatan.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition shrink-0"
                  onClick={() => setEditor('new')}
                >
                  <PlusCircle className="w-4 h-4" weight="bold" />
                  <span>Buat Kegiatan Baru</span>
                </button>
              </div>

              {/* Panel Pengaturan Kegiatan yang Dipilih */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Detail & Status Kegiatan Aktif
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-0.5">
                      {activity.nama}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tahun ajaran: <span className="font-semibold text-slate-700">{activity.tahun_nama}</span> · Revisi #{activity.revision}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Dropdown pilih kegiatan jika ada lebih dari 1 */}
                    {home.activities.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label htmlFor="kegiatan-select-admin" className="text-xs text-slate-500 font-medium">
                          Pilih:
                        </label>
                        <select
                          id="kegiatan-select-admin"
                          className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                          value={activityId}
                          onChange={(e) => {
                            setActivityId(e.target.value)
                            setPage(1)
                            setCoverage(null)
                            setAnalytics(null)
                            setStarting(false)
                          }}
                        >
                          {home.activities.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nama} ({a.tahun_nama})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        activity.status === 'terbuka'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : activity.status === 'persiapan'
                            ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                            : 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/10'
                      }`}
                    >
                      {activity.status === 'terbuka'
                        ? 'Terbuka'
                        : activity.status === 'persiapan'
                          ? 'Persiapan'
                          : 'Ditutup'}
                    </span>
                  </div>
                </div>

                {/* Status Persiapan */}
                {activity.status === 'persiapan' && (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                    <p className="text-xs font-semibold text-amber-900">
                      Kegiatan masih dalam tahap persiapan. Anda dapat menyusun target guru sebelum membuka kegiatan.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        className={secondaryClass}
                        onClick={() => setEditor(activity.id)}
                      >
                        <ChalkboardTeacher className="w-4 h-4" />
                        <span>Atur Target Guru</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={buttonClass}
                        onClick={() => transition('terbuka')}
                      >
                        <LockOpen className="w-4 h-4" />
                        <span>Buka Kegiatan Supervisi</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Terbuka */}
                {activity.status === 'terbuka' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Tutup Kegiatan Supervisi</h5>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Jika kegiatan ditutup, seluruh draft dan hasil wawancara akan dikunci (read-only) sampai dibuka kembali.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold transition shadow-xs"
                      disabled={busy}
                      onClick={() => transition('ditutup')}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Konfirmasi Tutup Kegiatan</span>
                    </button>
                  </div>
                )}

                {/* Status Ditutup */}
                {activity.status === 'ditutup' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Buka Kembali Kegiatan</h5>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Masukkan alasan membuka kembali kegiatan supervisi untuk kebutuhan audit trail.
                      </p>
                    </div>
                    <textarea
                      maxLength={1000}
                      placeholder="Contoh: Koreksi data pengajar dan penambahan wawancara susulan"
                      className={`${inputClass} text-xs`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !reason.trim()}
                      className={buttonClass}
                      onClick={() => transition('terbuka')}
                    >
                      <LockOpen className="w-4 h-4" />
                      <span>Buka Kembali Kegiatan</span>
                    </button>
                  </div>
                )}

                {/* Hapus Kegiatan */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-rose-700">Zona Bahaya</h5>
                    <p className="text-xs text-slate-500">
                      Menghapus seluruh kegiatan beserta seluruh wawancara di dalamnya secara permanen.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200/80 transition"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash className="w-4 h-4" />
                    <span>Hapus Kegiatan</span>
                  </button>
                </div>
              </div>

              {/* Riwayat / Daftar Seluruh Kegiatan */}
              {home.activities.length > 0 && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Daftar Semua Agenda Supervisi ({home.activities.length})
                  </h4>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
                    {home.activities.map((a) => (
                      <div
                        key={a.id}
                        className={`p-3.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 text-xs transition ${
                          a.id === activityId ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">{a.nama}</span>
                            {a.id === activityId && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                                Sedang Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 mt-0.5">
                            Tahun: {a.tahun_nama}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              a.status === 'terbuka'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                : a.status === 'persiapan'
                                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-600/10'
                            }`}
                          >
                            {a.status}
                          </span>

                          {a.id !== activityId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActivityId(a.id)
                                setPage(1)
                                setCoverage(null)
                                setAnalytics(null)
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition"
                            >
                              Pilih
                            </button>
                          ) : a.status === 'persiapan' ? (
                            <button
                              type="button"
                              onClick={() => setEditor(a.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition"
                            >
                              Edit Target
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Delete Activity */}
          {deleting && activity && (
            <DeleteActivity
              activity={activity}
              onClose={() => setDeleting(false)}
              onDeleted={async () => {
                setDeleting(false)
                setStarting(false)
                setEditor(null)
                setCoverage(null)
                setAnalytics(null)
                await refresh()
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
