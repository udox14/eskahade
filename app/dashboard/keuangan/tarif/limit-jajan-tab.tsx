// app/dashboard/keuangan/tarif/limit-jajan-tab.tsx
// Tab Monitoring & Konfigurasi Limit Uang Jajan (Patch C2)
// Mendukung server-side pagination, server-side search (nama/NIS), filter Asrama & Kelas,
// evaluasi limit efektif berdasar aturan nilai terketat, dan mutasi limit orang tua individual.

'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Coins,
  Info,
  MagnifyingGlass,
  ShieldCheck,
  PencilSimple,
  X,
  Buildings,
  GraduationCap,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import Pagination from '@/components/ui/pagination'
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

export default function LimitJajanTab({
  globalDailyLimit,
  initialStudentLimits,
  initialPagination,
  initialAsramaList = [],
  initialKelasList = [],
  canMutate,
  onRefresh,
}: LimitJajanTabProps) {
  // Global Limit State
  const [globalInput, setGlobalInput] = useState<string>(
    globalDailyLimit.toLocaleString('id-ID')
  )
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)

  // Server Dataset State
  const [students, setStudents] = useState<StudentWalletLimitRow[]>(initialStudentLimits)
  const [pagination, setPagination] = useState(
    initialPagination || {
      currentPage: 1,
      pageSize: DEFAULT_FINANCE_PAGE_SIZE,
      totalItems: initialStudentLimits.length,
      totalPages: Math.ceil(initialStudentLimits.length / DEFAULT_FINANCE_PAGE_SIZE) || 1,
    }
  )
  const [asramaList] = useState<string[]>(initialAsramaList)
  const [kelasList] = useState<string[]>(initialKelasList)

  // Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsrama, setSelectedAsrama] = useState('ALL')
  const [selectedKelas, setSelectedKelas] = useState('ALL')
  const [isPending, startTransition] = useTransition()

  // Individual Limit Edit Modal
  const [editingStudent, setEditingStudent] = useState<StudentWalletLimitRow | null>(null)
  const [editLimitInput, setEditLimitInput] = useState('')
  const [isSavingIndividual, setIsSavingIndividual] = useState(false)

  // Fetch function server-side
  const loadData = useCallback(
    (params: {
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
    },
    [pagination.currentPage, pagination.pageSize, searchQuery, selectedAsrama, selectedKelas]
  )

  // Handler simpan limit global pesantren
  const handleSaveGlobalLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseInt(globalInput.replace(/\D/g, ''), 10)
    if (isNaN(numeric) || numeric < 0) {
      toast.error('Nominal limit harian harus bernilai angka non-negatif.')
      return
    }

    setIsSavingGlobal(true)
    const toastId = toast.loading('Memperbarui limit harian global...')

    const res = await updateGlobalDailyLimitAction(numeric)

    setIsSavingGlobal(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Limit harian global berhasil diatur ke Rp ${numeric.toLocaleString('id-ID')}/hari.`)
      onRefresh()
      loadData({ page: 1 })
    } else {
      toast.error('Gagal memperbarui limit', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  // Handler cari santri
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadData({ page: 1, search: searchQuery })
  }

  // Handler reset filter
  const handleResetFilter = () => {
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedKelas('ALL')
    loadData({ page: 1, search: '', asrama: 'ALL', kelas: 'ALL' })
  }

  // Handler buka modal edit limit santri
  const handleOpenEditModal = (s: StudentWalletLimitRow) => {
    setEditingStudent(s)
    setEditLimitInput(s.parent_daily_limit !== null ? s.parent_daily_limit.toLocaleString('id-ID') : '')
  }

  // Handler simpan limit individual orang tua
  const handleSaveIndividualLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return

    const raw = editLimitInput.trim().replace(/\D/g, '')
    const numericOrNull = raw === '' ? null : parseInt(raw, 10)

    if (numericOrNull !== null && (isNaN(numericOrNull) || numericOrNull < 0)) {
      toast.error('Nominal limit harian orang tua harus berupa angka non-negatif.')
      return
    }

    setIsSavingIndividual(true)
    const toastId = toast.loading(`Menyimpan limit untuk ${editingStudent.nama_lengkap}...`)

    const res = await updateStudentParentLimitAction(editingStudent.santri_id, numericOrNull)

    setIsSavingIndividual(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(
        numericOrNull !== null
          ? `Limit harian orang tua untuk ${editingStudent.nama_lengkap} diatur ke Rp ${numericOrNull.toLocaleString('id-ID')}.`
          : `Limit harian orang tua untuk ${editingStudent.nama_lengkap} berhasil dikembalikan mengikuti default global.`
      )
      setEditingStudent(null)
      loadData({ page: pagination.currentPage })
    } else {
      toast.error('Gagal menyimpan limit', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Strict Dana Titipan Rule Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" weight="bold" />
        <div>
          <span className="font-bold">Prinsip Dana Titipan Uang Jajan:</span> Saldo uang jajan santri bersumber mutlak dari catatan buku besar transaksi resmi dan <span className="font-bold underline">dilarang keras untuk diedit manual secara langsung</span>. Saldo bertambah hanya via top-up sah atau setoran tunai, dan berkurang hanya melalui penarikan loket atau koreksi berotoritas.
        </div>
      </div>

      {/* Global Limit Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" weight="bold" />
              <h3 className="text-sm font-bold text-slate-800">
                Limit Penarikan Harian Global Pesantren
              </h3>
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Batas penarikan maksimum per santri per hari yang diberlakukan di loket koperasi pesantren. Jika wali santri menetapkan limit lebih rendah di Portal Ortu, sistem otomatis memilih nilai yang paling ketat:
              <span className="font-mono font-semibold text-slate-700 block mt-1">
                Limit Efektif = min(Limit Global Pesantren, Limit Harian Orang Tua)
              </span>
            </p>
          </div>

          <form onSubmit={handleSaveGlobalLimit} className="flex items-center gap-3 shrink-0">
            <div className="relative w-44">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="text"
                disabled={!canMutate || isSavingGlobal}
                value={globalInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setGlobalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {canMutate ? (
              <button
                type="submit"
                disabled={isSavingGlobal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 shrink-0"
              >
                {isSavingGlobal ? 'Menyimpan...' : 'Simpan Limit'}
              </button>
            ) : (
              <span className="text-xs text-slate-400 italic">Read-only</span>
            )}
          </form>
        </div>
      </div>

      {/* Student Limits & Authoritative Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-600" weight="bold" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Monitoring Limit &amp; Saldo Titipan Santri Aktif
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-52 sm:w-60">
              <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NIS santri..."
                className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </form>

            {/* Asrama Filter */}
            {asramaList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700">
                <Buildings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedAsrama}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedAsrama(val)
                    loadData({ page: 1, asrama: val })
                  }}
                  className="bg-transparent text-xs text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Asrama</option>
                  {asramaList.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Kelas Filter */}
            {kelasList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedKelas}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedKelas(val)
                    loadData({ page: 1, kelas: val })
                  }}
                  className="bg-transparent text-xs text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Button */}
            {(searchQuery || selectedAsrama !== 'ALL' || selectedKelas !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ArrowCounterClockwise className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3 text-right">Saldo Saat Ini (Read-Only)</th>
                <th className="px-4 py-3 text-right">Limit Harian Ortu</th>
                <th className="px-4 py-3 text-right">Limit Global Pesantren</th>
                <th className="px-4 py-3 text-right font-bold text-emerald-800">Limit Efektif Harian</th>
                <th className="px-4 py-3 text-center">Status Aturan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {isPending ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data santri...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data santri yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const hasParentLimit = s.parent_daily_limit !== null
                  const isParentStrict = hasParentLimit && s.parent_daily_limit! < globalDailyLimit

                  return (
                    <tr key={s.santri_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div>{s.nama_lengkap}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          NIS: {s.nis} {s.asrama ? `• ${s.asrama}` : ''} {s.kelas ? `• Kelas ${s.kelas}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        Rp {s.saldo_uang_jajan.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {hasParentLimit ? (
                          `Rp ${s.parent_daily_limit!.toLocaleString('id-ID')}`
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum Diatur</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        Rp {globalDailyLimit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                        Rp {s.effective_daily_limit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isParentStrict ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            Mengikuti Ortu
                          </span>
                        ) : hasParentLimit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Mengikuti Global
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Default Global
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {canMutate ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 transition-colors text-[11px] font-medium"
                          >
                            <PencilSimple className="w-3.5 h-3.5" />
                            <span>Atur Limit</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          total={pagination.totalItems}
          onPageChange={(page) => loadData({ page })}
          onPageSizeChange={(size) => loadData({ page: 1, pageSize: size })}
        />
      </div>

      {/* Individual Student Parent Limit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" weight="bold" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Atur Limit Harian Orang Tua
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIndividualLimit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">{editingStudent.nama_lengkap}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  NIS: {editingStudent.nis} {editingStudent.asrama ? `• ${editingStudent.asrama}` : ''}
                </div>
                <div className="text-[11px] text-slate-500">
                  Saldo Titipan: <span className="font-mono font-bold text-slate-800">Rp {editingStudent.saldo_uang_jajan.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Limit Harian Orang Tua (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={editLimitInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setEditLimitInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Kosongkan untuk mengikuti limit global"
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Limit efektif santri ini di loket akan menjadi: <span className="font-mono font-semibold text-emerald-700">min(Rp {globalDailyLimit.toLocaleString('id-ID')}, Limit Ortu)</span>. Kosongkan jika ingin santri mengikuti limit global pondok secara penuh.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingIndividual}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingIndividual ? 'Menyimpan...' : 'Simpan Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
