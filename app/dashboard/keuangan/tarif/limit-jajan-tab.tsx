// app/dashboard/keuangan/tarif/limit-jajan-tab.tsx
// Tab Monitoring & Konfigurasi Limit Uang Jajan

'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Coins,
  Info,
  MagnifyingGlass,
  ShieldCheck,
  PencilSimple,
  X,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import {
  updateGlobalDailyLimitAction,
  getStudentWalletLimitsAction,
  updateStudentParentLimitAction,
  type StudentWalletLimitRow,
} from './actions'
import { DEFAULT_FINANCE_PAGE_SIZE } from '@/lib/finance/constants'

interface LimitJajanTabProps {
  globalDailyLimit: number
  initialStudentLimits: StudentWalletLimitRow[]
  initialPagination?: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  initialAsramaList?: string[]
  initialKelasList?: string[]
  canMutate: boolean
  onRefresh: () => void
}

const PAGE_SIZE_OPTIONS: SelectPickerOption[] = [
  { value: '20', label: '20 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' },
]

function formatRupiah(val: number): string {
  return `Rp${Math.round(val || 0).toLocaleString('id-ID')}`
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function LimitJajanTab({
  globalDailyLimit,
  initialStudentLimits,
  initialPagination,
  initialAsramaList = [],
  initialKelasList = [],
  canMutate,
  onRefresh,
}: LimitJajanTabProps) {
  const [globalInput, setGlobalInput] = useState<string>(globalDailyLimit.toLocaleString('id-ID'))
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)

  const [students, setStudents] = useState<StudentWalletLimitRow[]>(initialStudentLimits)
  const [pagination, setPagination] = useState(
    initialPagination || {
      currentPage: 1,
      pageSize: DEFAULT_FINANCE_PAGE_SIZE,
      totalItems: initialStudentLimits.length,
      totalPages: Math.ceil(initialStudentLimits.length / DEFAULT_FINANCE_PAGE_SIZE) || 1,
    }
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsrama, setSelectedAsrama] = useState('ALL')
  const [selectedKelas, setSelectedKelas] = useState('ALL')
  const [isPending, startTransition] = useTransition()

  const [editingStudent, setEditingStudent] = useState<StudentWalletLimitRow | null>(null)
  const [editLimitInput, setEditLimitInput] = useState('')
  const [isSavingIndividual, setIsSavingIndividual] = useState(false)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!editingStudent) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSavingIndividual) setEditingStudent(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingStudent, isSavingIndividual])

  const asramaOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Asrama' },
      ...initialAsramaList.map((a) => ({ value: a, label: a })),
    ],
    [initialAsramaList]
  )

  const kelasOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Kelas' },
      ...initialKelasList.map((k) => ({ value: k, label: k })),
    ],
    [initialKelasList]
  )

  const loadData = (params: {
    page?: number
    pageSize?: number
    search?: string
    asrama?: string
    kelas?: string
  }) => {
    startTransition(async () => {
      try {
        const res = await getStudentWalletLimitsAction({
          page: params.page ?? pagination.currentPage,
          pageSize: params.pageSize ?? pagination.pageSize,
          search: params.search !== undefined ? params.search : searchQuery,
          asrama: params.asrama !== undefined ? params.asrama : selectedAsrama,
          kelas: params.kelas !== undefined ? params.kelas : selectedKelas,
        })
        setStudents(res.items)
        setPagination(res.pagination)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal memuat data limit santri.')
      }
    })
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      loadData({ page: 1, search: val })
    }, 350)
  }

  const handleSaveGlobalLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseInt(globalInput.replace(/\D/g, ''), 10)
    if (isNaN(numeric) || numeric < 0) {
      toast.error('Nominal limit harian harus berupa angka positif.')
      return
    }

    setIsSavingGlobal(true)
    const toastId = toast.loading('Memperbarui limit harian global…')

    const res = await updateGlobalDailyLimitAction(numeric)

    setIsSavingGlobal(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Limit harian global diatur ke ${formatRupiah(numeric)}/hari.`)
      onRefresh()
      loadData({ page: 1 })
    } else {
      toast.error('Gagal memperbarui limit', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const handleResetFilter = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedKelas('ALL')
    loadData({ page: 1, search: '', asrama: 'ALL', kelas: 'ALL' })
  }

  const handleOpenEditModal = (s: StudentWalletLimitRow) => {
    setEditingStudent(s)
    setEditLimitInput(s.parent_daily_limit !== null ? s.parent_daily_limit.toLocaleString('id-ID') : '')
  }

  const handleSaveIndividualLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return

    const raw = editLimitInput.trim().replace(/\D/g, '')
    const numericOrNull = raw === '' ? null : parseInt(raw, 10)

    if (numericOrNull !== null && (isNaN(numericOrNull) || numericOrNull < 0)) {
      toast.error('Nominal limit harian orang tua harus berupa angka positif.')
      return
    }

    setIsSavingIndividual(true)
    const toastId = toast.loading(`Menyimpan limit untuk ${editingStudent.nama_lengkap}…`)

    const res = await updateStudentParentLimitAction(editingStudent.santri_id, numericOrNull)

    setIsSavingIndividual(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(
        numericOrNull !== null
          ? `Limit harian orang tua untuk ${editingStudent.nama_lengkap} diatur ke ${formatRupiah(numericOrNull)}.`
          : `Limit harian ${editingStudent.nama_lengkap} dikembalikan mengikuti limit global.`
      )
      setEditingStudent(null)
      loadData({ page: pagination.currentPage })
    } else {
      toast.error('Gagal menyimpan limit', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const rangeStart =
    pagination.totalItems === 0 ? 0 : (pagination.currentPage - 1) * pagination.pageSize + 1
  const rangeEnd = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)

  return (
    <div className="space-y-5">
      {/* Info Banner Dana Titipan */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/70 p-3.5 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" weight="bold" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Prinsip Dana Titipan:</strong> Saldo uang jajan santri dihitung otomatis
          dari buku besar transaksi resmi dan tidak dapat diubah manual. Saldo hanya berubah melalui top-up sah,
          pencairan kolektif/loket, atau koreksi berotoritas.
        </p>
      </div>

      {/* Limit Harian Global */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                Limit Pencairan Harian Global Pesantren
              </h3>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              Batas pencairan maksimum per santri per hari. Jika wali menetapkan limit lebih rendah, sistem otomatis
              memilih nilai yang lebih ketat (<strong className="text-slate-700">nilai terkecil</strong> antara limit
              pesantren dan limit wali).
            </p>
          </div>

          <form onSubmit={handleSaveGlobalLimit} className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="relative w-44">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={!canMutate || isSavingGlobal}
                value={globalInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setGlobalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                }}
                aria-label="Nominal limit harian global"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {canMutate ? (
              <button
                type="submit"
                disabled={isSavingGlobal}
                className="min-h-[38px] shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingGlobal ? 'Menyimpan…' : 'Simpan Limit'}
              </button>
            ) : (
              <span className="text-xs text-slate-400">Lihat saja</span>
            )}
          </form>
        </div>
      </section>

      {/* Monitoring Limit & Saldo Santri */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Monitoring Limit &amp; Saldo Titipan Santri Aktif
            </h3>
          </div>

          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                loadData({ page: 1, search: searchQuery })
              }}
              className="relative flex-1"
            >
              <MagnifyingGlass
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari nama atau NIS santri…"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                    setSearchQuery('')
                    loadData({ page: 1, search: '' })
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </form>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {initialAsramaList.length > 0 && (
                <SelectPicker
                  value={selectedAsrama}
                  options={asramaOptions}
                  onChange={(val) => {
                    setSelectedAsrama(val)
                    loadData({ page: 1, asrama: val })
                  }}
                  ariaLabel="Filter asrama"
                  className="w-full sm:w-44 [&>button]:w-full"
                />
              )}

              {initialKelasList.length > 0 && (
                <SelectPicker
                  value={selectedKelas}
                  options={kelasOptions}
                  onChange={(val) => {
                    setSelectedKelas(val)
                    loadData({ page: 1, kelas: val })
                  }}
                  ariaLabel="Filter kelas"
                  className="w-full sm:w-40 [&>button]:w-full"
                />
              )}

              {(searchQuery || selectedAsrama !== 'ALL' || selectedKelas !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="col-span-2 sm:col-span-1 inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowCounterClockwise className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body (Mobile Cards + Desktop Table) */}
        <div aria-busy={isPending} className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
          {students.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-500">
              Tidak ada data santri yang cocok dengan filter pencarian.
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {students.map((s) => {
                  const hasParentLimit = s.parent_daily_limit !== null
                  const isParentStrict = hasParentLimit && s.parent_daily_limit! < globalDailyLimit
                  return (
                    <div key={`m-wl-${s.santri_id}`} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{s.nama_lengkap}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            NIS {s.nis}
                            {s.asrama ? ` · ${s.asrama}` : ''}
                            {s.kelas ? ` · ${s.kelas}` : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatRupiah(s.saldo_uang_jajan)}
                          </div>
                          <div className="text-[10px] text-slate-500">Saldo titipan</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs tabular-nums">
                        <div>
                          <span className="text-slate-500">Limit Efektif: </span>
                          <strong className="text-emerald-700">{formatRupiah(s.effective_daily_limit)}/hari</strong>
                          <span className="ml-1.5 text-[10px] text-slate-500">
                            ({isParentStrict ? 'Limit Wali' : 'Limit Global'})
                          </span>
                        </div>
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(s)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 cursor-pointer"
                          >
                            <PencilSimple className="h-3 w-3" aria-hidden="true" />
                            <span>Atur</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Santri</th>
                      <th className="px-4 py-3 text-right">Saldo Saat Ini</th>
                      <th className="px-4 py-3 text-right">Limit Harian Wali</th>
                      <th className="px-4 py-3 text-right">Limit Global</th>
                      <th className="px-4 py-3 text-right text-emerald-800">Limit Efektif</th>
                      <th className="px-4 py-3 text-center">Aturan Aktif</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => {
                      const hasParentLimit = s.parent_daily_limit !== null
                      const isParentStrict = hasParentLimit && s.parent_daily_limit! < globalDailyLimit

                      return (
                        <tr key={s.santri_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-900">{s.nama_lengkap}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              NIS {s.nis}
                              {s.asrama ? ` · ${s.asrama}` : ''}
                              {s.kelas ? ` · ${s.kelas}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatRupiah(s.saldo_uang_jajan)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                            {hasParentLimit ? (
                              formatRupiah(s.parent_daily_limit!)
                            ) : (
                              <span className="text-slate-400">Belum diatur</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                            {formatRupiah(globalDailyLimit)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            {formatRupiah(s.effective_daily_limit)}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {isParentStrict ? (
                              <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                                Limit Wali
                              </span>
                            ) : (
                              <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                Limit Global
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {canMutate ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(s)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
                              >
                                <PencilSimple className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Atur Limit</span>
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Inline Single-Fetch Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/40 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-slate-600 tabular-nums">
            <span>
              Menampilkan <strong className="text-slate-900">{rangeStart}–{rangeEnd}</strong> dari{' '}
              <strong className="text-slate-900">{pagination.totalItems.toLocaleString('id-ID')}</strong> santri
            </span>
            <SelectPicker
              value={String(pagination.pageSize)}
              options={PAGE_SIZE_OPTIONS}
              onChange={(val) => loadData({ page: 1, pageSize: Number(val) })}
              ariaLabel="Jumlah baris per halaman"
              placement="top"
              align="left"
              className="w-28"
            />
          </div>

          {pagination.totalPages > 1 && (
            <nav aria-label="Navigasi halaman limit santri" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Halaman pertama"
                disabled={pagination.currentPage <= 1 || isPending}
                onClick={() => loadData({ page: 1 })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                disabled={pagination.currentPage <= 1 || isPending}
                onClick={() => loadData({ page: pagination.currentPage - 1 })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {getPageRange(pagination.currentPage, pagination.totalPages).map((entry, idx) =>
                entry === '...' ? (
                  <span key={`dots-${idx}`} className="px-1.5 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    aria-current={entry === pagination.currentPage ? 'page' : undefined}
                    disabled={isPending}
                    onClick={() => loadData({ page: entry })}
                    className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                      entry === pagination.currentPage
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}

              <button
                type="button"
                aria-label="Halaman berikutnya"
                disabled={pagination.currentPage >= pagination.totalPages || isPending}
                onClick={() => loadData({ page: pagination.currentPage + 1 })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Halaman terakhir"
                disabled={pagination.currentPage >= pagination.totalPages || isPending}
                onClick={() => loadData({ page: pagination.totalPages })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </section>

      {/* Modal Atur Limit Individual */}
      {editingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-limit-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingIndividual) setEditingStudent(null)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
                <h4 id="modal-limit-title" className="text-sm font-bold text-slate-900">
                  Atur Limit Harian Wali
                </h4>
              </div>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => setEditingStudent(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveIndividualLimit} className="p-5 space-y-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="font-bold text-slate-900">{editingStudent.nama_lengkap}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  NIS {editingStudent.nis}
                  {editingStudent.asrama ? ` · ${editingStudent.asrama}` : ''}
                </div>
                <div className="text-[11px] text-slate-600 tabular-nums">
                  Saldo Titipan: <strong className="text-slate-900">{formatRupiah(editingStudent.saldo_uang_jajan)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700">Limit Harian Wali (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editLimitInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setEditLimitInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Kosongkan untuk mengikuti limit global"
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Limit efektif santri akan menjadi nilai terkecil antara limit global ({formatRupiah(globalDailyLimit)})
                  dan limit wali. Kosongkan jika ingin mengikuti limit global sepenuhnya.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingIndividual}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingIndividual ? 'Menyimpan…' : 'Simpan Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
