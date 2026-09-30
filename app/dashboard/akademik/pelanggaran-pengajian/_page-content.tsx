'use client'

import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  X,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { toWibDateInputValue, formatWibDateTime } from '@/lib/date/wib'
import { cn } from '@/lib/utils'
import type {
  Analytics,
  Capabilities,
  Filters,
  Incident,
  Options,
  Page,
  Recap,
  Tab,
} from '@/lib/pengajian-violations/types'
import {
  getAnalytics,
  getCapabilities,
  getHistory,
  getOptions,
  getRecap,
} from './actions'
import {
  Bars,
  button,
  control,
  Empty,
  ErrorMessage,
  IncidentList,
  ListLoading,
  Pager,
  primary,
  SortHeading,
  StudentIdentity,
} from './_components'
import { CancelForm, FilterModal, IncidentForm, Settings } from './_forms'
import { PelanggaranDetailDrawer } from './detail-drawer'

const emptyOptions: Options = {
  asramas: [],
  kamars: [],
  classes: [],
  actors: [],
  types: [],
}

function initialFilters(): Record<Tab, Filters> {
  const date = toWibDateInputValue()
  return {
    riwayat: { status: 'active', sort: 'time', direction: 'desc' },
    rekap: { status: 'active', sort: 'count', direction: 'desc' },
    analitik: {
      status: 'active',
      start: date.slice(0, 7) + '-01',
      end: date,
    },
  }
}

function RecapList({
  data,
  onSelect,
  filters,
  onSort,
  compact = false,
}: {
  data: Page<Recap>
  onSelect: (id: string) => void
  filters?: Filters
  onSort?: (sort: Filters['sort']) => void
  compact?: boolean
}) {
  if (!data.rows.length) {
    return <Empty>Belum ada santri dengan catatan yang sesuai filter.</Empty>
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          MOBILE VIEW (Card List)
         ───────────────────────────────────────────────────────────── */}
      <div className={`p-3 sm:p-4 space-y-2.5 ${compact ? '' : 'md:hidden'}`}>
        {data.rows.map((row) => (
          <button
            key={row.santri_id}
            type="button"
            className="group block w-full rounded-xl border border-slate-200/90 bg-white p-3.5 text-left shadow-2xs transition-colors hover:border-emerald-300 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
            onClick={() => onSelect(row.santri_id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <StudentIdentity student={row} />
              </div>

              <div className="shrink-0 text-right">
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-slate-900">
                  <span className="text-sm font-bold tabular-nums">{row.count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">kali</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              <span>
                {row.type_count} jenis · Terakhir {formatWibDateTime(row.last)}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP TABLE VIEW
         ───────────────────────────────────────────────────────────── */}
      {!compact && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  { label: 'Santri', sort: 'name' as const },
                  { label: 'Jumlah Kejadian', sort: 'count' as const },
                  { label: 'Jenis Berbeda', sort: undefined },
                  { label: 'Kejadian Terakhir', sort: 'last' as const },
                ].map((h) => (
                  <th key={h.label} scope="col" className="px-5 py-3">
                    <SortHeading
                      label={h.label}
                      sort={h.sort}
                      filters={filters}
                      onSort={h.sort ? onSort : undefined}
                    />
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 text-right">
                  <span className="sr-only">Rincian</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.rows.map((row) => (
                <tr
                  key={row.santri_id}
                  className="transition-colors hover:bg-slate-50/80 cursor-pointer"
                  onClick={() => onSelect(row.santri_id)}
                >
                  <td className="px-5 py-3.5">
                    <StudentIdentity student={row} />
                  </td>
                  <td className="px-5 py-3.5 font-bold tabular-nums text-slate-900 text-sm">
                    {row.count}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums font-medium text-slate-700">
                    {row.type_count}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {formatWibDateTime(row.last)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      aria-label={`Lihat riwayat ${row.nama_lengkap}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(row.santri_id)
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function PageContent() {
  const [tab, setTab] = useState<Tab>('riwayat')
  const [allFilters, setAllFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10) // Load 10 records by default on initial open
  const [refresh, setRefresh] = useState(0)

  const [options, setOptions] = useState<Options>(emptyOptions)
  const [cap, setCap] = useState<Capabilities | null>(null)
  const [initError, setInitError] = useState('')

  const [history, setHistory] = useState<Page<Incident> | null>(null)
  const [recap, setRecap] = useState<Page<Recap> | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [form, setForm] = useState<{ row?: Incident } | null>(null)
  const [cancel, setCancel] = useState<Incident | null>(null)
  const [student, setStudent] = useState<{ id: string; filters: Filters } | null>(null)
  const [weekly, setWeekly] = useState(false)

  const filters = allFilters[tab]

  // Load capabilities & options
  useEffect(() => {
    let alive = true
    Promise.all([getOptions(), getCapabilities()])
      .then(([o, c]) => {
        if (!alive) return
        if (!o.data || !c.data) {
          setInitError(o.error || c.error || 'Gagal memuat pengaturan.')
          return
        }
        setOptions(o.data)
        setCap(c.data)
        setInitError('')
      })
      .catch(() => {
        if (alive) setInitError('Pengaturan tidak dapat dimuat.')
      })
    return () => {
      alive = false
    }
  }, [refresh])

  // Fetch data per tab (bounded by pageSize)
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        if (tab === 'riwayat') {
          const r = await getHistory(filters, page, pageSize)
          if (alive) {
            if (r.data) setHistory(r.data)
            else setError(r.error || 'Gagal memuat riwayat.')
          }
        } else if (tab === 'rekap') {
          const r = await getRecap(filters, page, pageSize)
          if (alive) {
            if (r.data) setRecap(r.data)
            else setError(r.error || 'Gagal memuat rekap.')
          }
        } else {
          const r = await getAnalytics(filters)
          if (alive) {
            if (r.data) setAnalytics(r.data)
            else setError(r.error || 'Gagal memuat analitik.')
          }
        }
      } catch {
        if (alive) setError('Data tidak dapat dimuat.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [tab, filters, page, pageSize, refresh])

  function updateFilters(f: Filters) {
    setAllFilters((a) => ({ ...a, [tab]: f }))
    setPage(1)
  }

  function saved() {
    setForm(null)
    setCancel(null)
    setRefresh((n) => n + 1)
  }

  function selectStudent(id: string) {
    setStudent({ id, filters: { ...filters } })
  }

  function drill(patch: Filters) {
    setAllFilters((a) => ({
      ...a,
      riwayat: { ...filters, ...patch, status: 'active', sort: 'time', direction: 'desc' },
    }))
    setTab('riwayat')
    setPage(1)
  }

  const filterCount = Object.entries(filters).filter(
    ([k, v]) => !['sort', 'direction', 'status', 'search'].includes(k) && v !== undefined && v !== ''
  ).length

  const sort = (key: Filters['sort']) =>
    updateFilters({
      ...filters,
      sort: key,
      direction: filters.sort === key && filters.direction === 'desc' ? 'asc' : 'desc',
    })

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER (Clean header without duplicate action buttons)
         ───────────────────────────────────────────────────────────── */}
      <DashboardPageHeader
        title="Pelanggaran Pengajian"
        description="Pencatatan kejadian dan evaluasi kedisiplinan pengajian santri."
      />

      {initError && <ErrorMessage message={initError} />}

      {/* ─────────────────────────────────────────────────────────────
          NAVIGATION TABS (Modern Clean Underline)
         ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" role="tablist" aria-label="Tab modul pelanggaran">
          {(['riwayat', 'rekap', 'analitik'] as const).map((t) => {
            const isSelected = tab === t
            return (
              <button
                id={`tab-${t}`}
                key={t}
                role="tab"
                aria-selected={isSelected}
                aria-controls={`panel-${t}`}
                tabIndex={isSelected ? 0 : -1}
                className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer capitalize ${
                  isSelected
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                onClick={() => {
                  setTab(t)
                  setPage(1)
                }}
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault()
                    const tabs: Tab[] = ['riwayat', 'rekap', 'analitik']
                    const index =
                      e.key === 'Home'
                        ? 0
                        : e.key === 'End'
                        ? 2
                        : (tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : 2)) % 3
                    setTab(tabs[index])
                    setPage(1)
                    document.getElementById(`tab-${tabs[index]}`)?.focus()
                  }
                }}
              >
                {t}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER & ACTIONS TOOLBAR STRIP
          - Desktop: Search bar | Catat Pelanggaran | Filter | Pengaturan (gear)
          - Mobile: Search bar (full) -> Below: Catat | Filter | Pengaturan (gear)
         ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className={control + ' pl-10 pr-9'}
              aria-label="Cari nama atau NIS"
              placeholder="Cari nama santri atau NIS…"
              value={filters.search ?? ''}
              onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
            />
            {filters.search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => updateFilters({ ...filters, search: '' })}
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Action buttons beside search on desktop, stacked on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {tab === 'riwayat' && (!cap || cap.create) && (
              <button
                type="button"
                className={cn(primary, 'w-full sm:w-auto justify-center whitespace-nowrap')}
                onClick={() => setForm({})}
              >
                <Plus className="h-4 w-4" />
                <span>Catat Pelanggaran</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(button, 'flex-1 sm:flex-none justify-center whitespace-nowrap')}
                onClick={() => setFilterOpen(true)}
              >
                <Filter className="h-4 w-4 text-slate-500" />
                <span>Filter & Urutkan</span>
                {filterCount > 0 && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-bold text-emerald-800">
                    {filterCount}
                  </span>
                )}
              </button>

              {(!cap || cap.manage) && (
                <button
                  type="button"
                  className={cn(button, 'shrink-0 px-3')}
                  onClick={() => setSettingsOpen(true)}
                  title="Pengaturan Jenis Pelanggaran"
                  aria-label="Pengaturan jenis pelanggaran"
                >
                  <SettingsIcon className="h-4 w-4 text-slate-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {filterCount > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <p>
              <span className="font-semibold text-slate-800">{filterCount} filter</span> aktif diterapkan
            </p>
            <button
              type="button"
              className="font-semibold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
              onClick={() =>
                updateFilters({ ...initialFilters()[tab], search: filters.search })
              }
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Filter Info & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
        <p>
          {filters.start || filters.end
            ? `${filters.start || 'Awal'} — ${filters.end || 'Sekarang'}`
            : 'Seluruh periode'}
          {' · '}
          {tab !== 'riwayat'
            ? 'Catatan aktif saja'
            : filters.status === 'all'
            ? 'Semua status'
            : filters.status === 'cancelled'
            ? 'Dibatalkan'
            : 'Catatan aktif'}
        </p>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 transition cursor-pointer"
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Segarkan data</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT PANELS
         ───────────────────────────────────────────────────────────── */}
      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        aria-busy={loading}
        className={
          tab === 'analitik'
            ? 'min-w-0'
            : 'min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs'
        }
      >
        {error ? (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        ) : loading ? (
          <ListLoading />
        ) : tab === 'riwayat' && history ? (
          <>
            <IncidentList
              data={history}
              cap={cap}
              onEdit={(row) => setForm({ row })}
              onCancel={setCancel}
              onStudent={selectStudent}
              filters={filters}
              onSort={sort}
            />
            <Pager
              data={history}
              onPage={setPage}
              noun="kejadian"
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          </>
        ) : tab === 'rekap' && recap ? (
          <>
            <RecapList
              data={recap}
              onSelect={selectStudent}
              filters={filters}
              onSort={sort}
            />
            <Pager
              data={recap}
              onPage={setPage}
              noun="santri"
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          </>
        ) : tab === 'analitik' && analytics ? (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              {[
                { label: 'Total Kejadian', value: analytics.total },
                { label: 'Santri Tercatat', value: analytics.students },
                { label: 'Santri Berulang (≥2x)', value: analytics.repeat },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              Santri berulang memiliki minimal 2 kejadian pada periode dan filter yang dipilih. Klik kelompok sebaran untuk melihat rincian riwayat kejadian.
            </p>

            {/* Tren Chart */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Tren Kejadian</h3>
                <select
                  className={control + ' !w-auto !py-1 text-xs'}
                  aria-label="Interval tren"
                  value={weekly ? 'weekly' : 'daily'}
                  onChange={(e) => setWeekly(e.target.value === 'weekly')}
                >
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan (Senin)</option>
                </select>
              </div>

              <Bars
                title={weekly ? 'Grafik Mingguan' : 'Grafik Harian'}
                rows={weekly ? analytics.weekly : analytics.trend}
              />
            </div>

            {/* Distribution Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Bars
                title="Sebaran Jenis Pelanggaran"
                rows={analytics.types}
                onPick={(r) => drill({ typeId: r.key })}
              />
              <Bars
                title="Sebaran Sesi Pengajian"
                rows={analytics.sessions}
                onPick={(r) => drill({ session: r.key })}
              />
              <Bars
                title="Sebaran Asrama Saat Ini"
                rows={analytics.dorms}
                onPick={(r) => drill({ asrama: r.key })}
              />
              <Bars
                title="Sebaran Kelas Pengajian"
                rows={analytics.classes}
                onPick={(r) => drill({ kelasId: r.key })}
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Asrama dan kelas mengikuti penempatan santri saat ini. Santri yang terdaftar di beberapa kelas dihitung sekali pada masing-masing kelas.
            </p>

            {/* Top 10 Recurring Students */}
            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="border-b border-slate-100 p-5 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">
                  Santri dengan Kejadian Berulang Terbanyak
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  10 santri dengan catatan kejadian tertinggi dalam rentang filter aktif saat ini.
                </p>
              </div>

              <RecapList
                data={{
                  rows: analytics.recurring,
                  total: analytics.recurring.length,
                  page: 1,
                }}
                onSelect={selectStudent}
                compact
              />
            </section>
          </div>
        ) : (
          <Empty>Belum ada data yang tersedia.</Empty>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          MODALS & DRAWERS
         ───────────────────────────────────────────────────────────── */}
      {filterOpen && (
        <FilterModal
          value={filters}
          options={options}
          tab={tab}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            updateFilters(f)
            setFilterOpen(false)
          }}
        />
      )}

      {settingsOpen && (!cap || cap.manage) && (
        <Settings
          options={options}
          canCreate={!cap || cap.create}
          canUpdate={!cap || cap.update}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setRefresh((n) => n + 1)}
        />
      )}

      {/* Side Drawer for Student History with Animations & Phone Back Button Handling */}
      {student && (
        <PelanggaranDetailDrawer
          santriId={student.id}
          initialFilters={student.filters}
          options={options}
          cap={cap}
          refresh={refresh}
          onClose={() => setStudent(null)}
          onEdit={(row) => setForm({ row })}
          onCancel={setCancel}
        />
      )}

      {form && (
        <IncidentForm
          row={form.row}
          options={options}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      )}

      {cancel && (
        <CancelForm
          row={cancel}
          onClose={() => setCancel(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
