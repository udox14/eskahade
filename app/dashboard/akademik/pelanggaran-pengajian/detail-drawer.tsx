'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  X,
  Filter,
  RotateCcw,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { getStudentDetail } from './actions'
import {
  IncidentList,
  ErrorMessage,
  ListLoading,
  Pager,
  button,
} from './_components'
import { FilterModal } from './_forms'
import type {
  Capabilities,
  Filters,
  Incident,
  Options,
  Page,
  Santri,
} from '@/lib/pengajian-violations/types'

interface PelanggaranDetailDrawerProps {
  santriId: string | null
  initialFilters: Filters
  options: Options
  cap: Capabilities | null
  refresh: number
  onClose: () => void
  onEdit: (row: Incident) => void
  onCancel: (row: Incident) => void
}

export function PelanggaranDetailDrawer({
  santriId,
  initialFilters,
  options,
  cap,
  refresh,
  onClose,
  onEdit,
  onCancel,
}: PelanggaranDetailDrawerProps) {
  const [filters, setFilters] = useState<Filters>(() => ({
    ...initialFilters,
    min: undefined,
    max: undefined,
    sort: 'time',
    direction: 'desc',
  }))
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [data, setData] = useState<{ student: Santri; history: Page<Incident> } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Close on Escape key press
  useEffect(() => {
    if (!santriId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [santriId, onClose])

  // Fetch student detail when santriId, filters, page, or refresh changes
  useEffect(() => {
    if (!santriId) return

    let isMounted = true
    startTransition(async () => {
      setError('')
      try {
        const res = await getStudentDetail(santriId, filters, page)
        if (isMounted) {
          if (res.data) {
            setData(res.data)
          } else {
            setError(res.error || 'Detail tidak dapat dimuat.')
            setData(null)
          }
        }
      } catch {
        if (isMounted) {
          setError('Detail riwayat tidak dapat dimuat.')
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [santriId, filters, page, refresh])

  if (!santriId) return null

  // Active / cancelled counts for KPI summary
  const activeCount = data?.history.rows.filter((r) => r.status === 'active').length ?? 0
  const cancelledCount = data?.history.rows.filter((r) => r.status === 'cancelled').length ?? 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-labelledby="drawer-title"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />

        <div className="absolute inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 pointer-events-none">
          <div className="w-screen max-w-xl md:max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full pointer-events-auto animate-in slide-in-from-right duration-300">
            {/* ─────────────────────────────────────────────────────────────
                1. DRAWER HEADER (Matching Status Pembayaran Standard)
               ───────────────────────────────────────────────────────────── */}
            <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4">
              {data ? (
                <div className="flex items-center gap-3.5 min-w-0">
                  <SantriPhotoAvatar
                    src={data.student.foto_url}
                    alt={data.student.nama_lengkap}
                    name={data.student.nama_lengkap}
                    size="md"
                    clickable={false}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 id="drawer-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
                        {data.student.nama_lengkap}
                      </h3>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {data.student.status_global || 'Aktif'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      NIS: {data.student.nis} · {data.student.asrama || 'Non-Asrama'}
                      {data.student.kamar ? ` / ${data.student.kamar}` : ''}
                      {data.student.jenis_kelamin ? ` · ${data.student.jenis_kelamin === 'L' ? 'Putra' : 'Putri'}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-12 h-14 bg-slate-200 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-5 w-44 bg-slate-200 rounded" />
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Tutup riwayat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                2. SUMMARY STRIP (KPI RINGKAS)
               ───────────────────────────────────────────────────────────── */}
            {data && (
              <div className="grid grid-cols-3 gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Riwayat</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {data.history.total} <span className="text-xs font-normal text-slate-500">kejadian</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Catatan Aktif</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {activeCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dibatalkan</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    {cancelledCount > 0 ? cancelledCount : '-'}
                  </span>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                3. TOOLBAR / FILTER STRIP
               ───────────────────────────────────────────────────────────── */}
            <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={button}
                  onClick={() => setFilterOpen(true)}
                >
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <span>Filter & Urutan</span>
                </button>

                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    setFilters({ status: 'all', sort: 'time', direction: 'desc' })
                    setPage(1)
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Semua Riwayat</span>
                </button>
              </div>

              <span className="text-xs text-slate-400">
                {filters.status === 'all'
                  ? 'Semua status'
                  : filters.status === 'cancelled'
                  ? 'Dibatalkan saja'
                  : 'Catatan aktif saja'}
              </span>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                4. SCROLLABLE BODY (INCIDENT LIST)
               ───────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {error && (
                <div className="p-6">
                  <ErrorMessage message={error} />
                </div>
              )}

              {isPending && !data ? (
                <div className="p-6">
                  <ListLoading />
                </div>
              ) : data ? (
                <div className="divide-y divide-slate-100">
                  <IncidentList
                    data={data.history}
                    cap={cap}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    compact
                  />
                </div>
              ) : null}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                5. DRAWER FOOTER (PAGINATION)
               ───────────────────────────────────────────────────────────── */}
            {data && data.history.total > 0 && (
              <div className="shrink-0">
                <Pager data={data.history} onPage={setPage} noun="kejadian" />
              </div>
            )}
          </div>
        </div>
      </div>

      {filterOpen && (
        <FilterModal
          value={filters}
          options={options}
          tab="riwayat"
          detail
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f)
            setPage(1)
            setFilterOpen(false)
          }}
        />
      )}
    </>
  )
}
