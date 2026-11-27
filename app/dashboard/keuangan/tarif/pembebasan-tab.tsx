'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  revokeExemptionAction,
  previewExemptionRuleAction,
  applyGroupExemptionAction,
  migrateLegacySppExemptionsAction,
  searchActiveStudents,
  type ExemptionWithStudent,
  type AcademicYearOption,
} from './actions'
import type { FinanceItemType } from '@/lib/finance/types'
import type { GroupExemptionPreview } from '@/lib/finance/exemptions'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  ShieldCheck,
  Plus,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  Info,
  ArrowCounterClockwise,
  UsersThree,
  User,
  Eye,
  Lightning,
  X,
} from '@phosphor-icons/react'

interface PembebasanTabProps {
  exemptions: ExemptionWithStudent[]
  academicYears: AcademicYearOption[]
  legacySppCount?: number
  canMutate: boolean
  onRefresh: () => void
}

const ITEM_LABELS: Record<string, string> = {
  ALL: 'Semua Pos Biaya',
  SPP: 'SPP Bulanan',
  UANG_MAKAN: 'Uang Makan (Katering)',
  UANG_NYUCI: 'Uang Nyuci (Laundry)',
  EHB: 'EHB (Tahunan)',
  EKSKUL: 'Ekstrakurikuler (Tahunan)',
  KESEHATAN: 'Kesehatan (Tahunan)',
  USPP: 'USPP / Bangunan',
}

const ITEM_FORM_OPTIONS: SelectPickerOption[] = Object.entries(ITEM_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const STATUS_FILTER_OPTIONS: SelectPickerOption[] = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'REVOKED', label: 'Dicabut' },
]

const KELAS_OPTIONS: SelectPickerOption[] = ['7', '8', '9', '10', '11', '12'].map((k) => ({
  value: k,
  label: `Kelas ${k} (Seluruh Rombel Kelas ${k})`,
}))

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatPeriodLabel(ym: string | null | undefined, fallback: string): string {
  if (!ym) return fallback
  const match = ym.match(/^(\d{4})-(\d{2})$/)
  if (!match) return ym
  const [, y, m] = match
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTH_SHORT[idx]} ${y}` : ym
}

export default function PembebasanTab({
  exemptions,
  academicYears,
  legacySppCount = 0,
  canMutate,
  onRefresh,
}: PembebasanTabProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL')
  const [filterItem, setFilterItem] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modal Grant / Group Exemption
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [targetScope, setTargetScope] = useState<'INDIVIDUAL' | 'KELAS'>('INDIVIDUAL')
  const [selectedKelas, setSelectedKelas] = useState<string>('7')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentOptions, setStudentOptions] = useState<
    Array<{ id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null }>
  >([])
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
  } | null>(null)
  const [itemType, setItemType] = useState<FinanceItemType | 'ALL'>('ALL')
  const [academicYearId, setAcademicYearId] = useState<string>('')
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preview State
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<GroupExemptionPreview | null>(null)

  // Legacy SPP Migration State
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false)

  // Modal Revoke Exemption
  const [revokeTarget, setRevokeTarget] = useState<ExemptionWithStudent | null>(null)
  const [revokeReason, setRevokeReason] = useState<string>('')
  const [isRevoking, setIsRevoking] = useState(false)

  // Escape handler
  useEffect(() => {
    if (!showGrantModal && !revokeTarget) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revokeTarget && !isRevoking) setRevokeTarget(null)
        else if (showGrantModal && !isSubmitting) setShowGrantModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showGrantModal, revokeTarget, isSubmitting, isRevoking])

  // Debounced live search student
  useEffect(() => {
    if (!studentSearch.trim()) return
    let active = true
    const timer = setTimeout(async () => {
      const res = await searchActiveStudents(studentSearch)
      if (active) setStudentOptions(res)
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [studentSearch])

  const yearFormOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: '', label: 'Semua / Sepanjang Waktu' },
      ...academicYears.map((y) => ({
        value: String(y.id),
        label: `${y.nama}${y.is_active ? ' (Aktif)' : ''}`,
      })),
    ],
    [academicYears]
  )

  const handleStudentSearchChange = (val: string) => {
    setStudentSearch(val)
    if (!val.trim()) setStudentOptions([])
  }

  const handleOpenGrantModal = () => {
    setTargetScope('INDIVIDUAL')
    setSelectedKelas('7')
    setSelectedStudent(null)
    setStudentSearch('')
    setStudentOptions([])
    setItemType('ALL')
    const activeYear = academicYears.find((y) => y.is_active === 1)
    setAcademicYearId(activeYear ? String(activeYear.id) : '')
    setPeriodStart('')
    setPeriodEnd('')
    setReason('')
    setNotes('')
    setPreviewData(null)
    setShowGrantModal(true)
  }

  const handlePreview = async () => {
    if (targetScope === 'INDIVIDUAL' && !selectedStudent) {
      toast.error('Pilih santri terlebih dahulu untuk melihat pratinjau.')
      return
    }
    setIsPreviewing(true)
    const res = await previewExemptionRuleAction({
      target: targetScope,
      kelas: selectedKelas,
      santri_id: selectedStudent?.id,
      item_type: itemType,
      period_start: periodStart || undefined,
      period_end: periodEnd || undefined,
    })
    setIsPreviewing(false)
    if (res.success && res.preview) {
      setPreviewData(res.preview)
    } else {
      toast.error(res.error || 'Gagal membuat pratinjau pembebasan.')
    }
  }

  const handleMigrateLegacySpp = async () => {
    if (
      !confirm(
        `Sinkronkan ${legacySppCount} data pembebasan SPP lama ke sistem pembebasan baru? Proses ini aman diulang tanpa duplikasi.`
      )
    ) {
      return
    }
    setIsMigratingLegacy(true)
    const toastId = toast.loading('Menyinkronkan data pembebasan SPP lama…')
    const res = await migrateLegacySppExemptionsAction()
    setIsMigratingLegacy(false)
    toast.dismiss(toastId)
    if (res.success && res.result) {
      toast.success(
        `Sinkronisasi selesai: ${res.result.migratedCount} baru, ${res.result.alreadyMigratedCount} sudah ada, ${res.result.obligationsUpdated} tagihan diperbarui.`
      )
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menyinkronkan data pembebasan lama.')
    }
  }

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targetScope === 'INDIVIDUAL' && !selectedStudent) {
      toast.error('Santri penerima pembebasan wajib dipilih.')
      return
    }
    if (targetScope === 'KELAS' && !selectedKelas) {
      toast.error('Kelas target pembebasan wajib dipilih.')
      return
    }
    if (!reason.trim()) {
      toast.error('Alasan pembebasan wajib diisi.')
      return
    }
    if (periodStart && periodEnd && periodStart > periodEnd) {
      toast.error('Periode mulai tidak boleh lebih besar dari periode selesai.')
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading('Menyimpan aturan pembebasan biaya…')

    const res = await applyGroupExemptionAction({
      target: targetScope,
      kelas: selectedKelas,
      santri_id: selectedStudent?.id,
      item_type: itemType,
      academic_year_id: academicYearId ? parseInt(academicYearId, 10) : null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      reason: reason.trim(),
      notes: notes.trim() || null,
    })

    setIsSubmitting(false)
    toast.dismiss(toastId)

    if (res.success && res.result) {
      const targetLabel = targetScope === 'INDIVIDUAL' ? selectedStudent?.nama_lengkap : `Kelas ${selectedKelas}`
      toast.success(
        `Pembebasan untuk ${targetLabel} diterapkan: ${res.result.exemptionsCreated} santri dibebaskan, ${res.result.obligationsUpdated} tagihan diperbarui.`
      )
      setShowGrantModal(false)
      onRefresh()
    } else {
      toast.error('Gagal memberikan pembebasan', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!revokeTarget) return
    if (!revokeReason.trim()) {
      toast.error('Alasan pencabutan pembebasan wajib diisi.')
      return
    }

    setIsRevoking(true)
    const toastId = toast.loading('Mencabut pembebasan biaya…')

    const res = await revokeExemptionAction(revokeTarget.id, revokeReason.trim())

    setIsRevoking(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(
        `Pembebasan untuk "${revokeTarget.santri_nama}" dicabut (${res.restoredCount || 0} tagihan dipulihkan).`
      )
      setRevokeTarget(null)
      setRevokeReason('')
      onRefresh()
    } else {
      toast.error('Gagal mencabut pembebasan', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const filteredExemptions = exemptions.filter((e) => {
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false
    if (filterItem !== 'ALL' && e.item_type !== filterItem) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = e.santri_nama?.toLowerCase().includes(q)
      const matchNis = e.santri_nis?.toLowerCase().includes(q)
      const matchReason = e.reason?.toLowerCase().includes(q)
      if (!matchName && !matchNis && !matchReason) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end text-xs flex-1">
          <div className="sm:col-span-3 lg:w-64">
            <span className="mb-1 block font-semibold text-slate-600">Cari Santri / Alasan</span>
            <div className="relative">
              <MagnifyingGlass
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama, NIS, atau alasan…"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:w-40">
            <span className="mb-1 block font-semibold text-slate-600">Status</span>
            <SelectPicker
              value={filterStatus}
              options={STATUS_FILTER_OPTIONS}
              onChange={(val) => setFilterStatus(val as 'ALL' | 'ACTIVE' | 'REVOKED')}
              ariaLabel="Filter status pembebasan"
              className="w-full [&>button]:w-full"
            />
          </div>

          <div className="sm:col-span-2 lg:w-52">
            <span className="mb-1 block font-semibold text-slate-600">Pos Biaya</span>
            <SelectPicker
              value={filterItem}
              options={ITEM_FORM_OPTIONS}
              onChange={setFilterItem}
              ariaLabel="Filter pos biaya pembebasan"
              className="w-full [&>button]:w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canMutate && legacySppCount > 0 && (
            <button
              type="button"
              onClick={handleMigrateLegacySpp}
              disabled={isMigratingLegacy}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Lightning className="h-3.5 w-3.5 text-amber-600" weight="fill" aria-hidden="true" />
              <span>Sinkron SPP Lama ({legacySppCount})</span>
            </button>
          )}

          {canMutate ? (
            <button
              type="button"
              onClick={handleOpenGrantModal}
              className="flex-1 sm:flex-none inline-flex min-h-[40px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" weight="bold" aria-hidden="true" />
              <span>Buat Pembebasan</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span>Mode Lihat Saja</span>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50/60 p-3.5 text-xs text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" weight="bold" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Ketentuan Pembebasan Biaya:</strong> Pembebasan hanya membebaskan sisa
          tagihan yang belum dibayar. Pembayaran yang sudah tercatat sebelumnya tidak dibatalkan otomatis. Jika dicabut,
          sisa tagihan yang belum terbayar akan dipulihkan tanpa menghapus riwayat.
        </p>
      </div>

      {/* Daftar Pembebasan (Mobile Cards + Desktop Table) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {filteredExemptions.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            Belum ada data pembebasan biaya yang sesuai filter.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredExemptions.map((e) => (
                <div key={`m-ex-${e.id}`} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{e.santri_nama}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        NIS {e.santri_nis}
                        {e.santri_asrama ? ` · ${e.santri_asrama}` : ''}
                      </div>
                    </div>
                    {e.status === 'ACTIVE' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        <CheckCircle className="h-3 w-3 text-emerald-600" weight="fill" aria-hidden="true" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        <XCircle className="h-3 w-3 text-slate-400" weight="fill" aria-hidden="true" />
                        Dicabut
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {ITEM_LABELS[e.item_type] || e.item_type}
                    </span>
                    <span className="text-slate-600">{e.reason}</span>
                  </div>

                  {e.status === 'REVOKED' && (
                    <div className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                      Dicabut: {e.revocation_reason || 'Tanpa alasan'}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>
                      {e.academic_year_nama || 'Semua Tahun'} ·{' '}
                      {e.period_start || e.period_end
                        ? `${formatPeriodLabel(e.period_start, 'Awal')} s.d. ${formatPeriodLabel(e.period_end, 'Seterusnya')}`
                        : 'Sepanjang Waktu'}
                    </span>
                    {canMutate && e.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokeTarget(e)
                          setRevokeReason('')
                        }}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        Cabut
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Santri</th>
                    <th className="px-4 py-3">Pos Pembebasan</th>
                    <th className="px-4 py-3">Tahun &amp; Periode</th>
                    <th className="px-4 py-3">Alasan &amp; Catatan</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Diberikan (WIB)</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExemptions.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{e.santri_nama}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          NIS {e.santri_nis}
                          {e.santri_asrama ? ` · ${e.santri_asrama}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {ITEM_LABELS[e.item_type] || e.item_type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{e.academic_year_nama || 'Semua Tahun'}</div>
                        <div className="text-[11px] text-slate-500">
                          {e.period_start || e.period_end
                            ? `${formatPeriodLabel(e.period_start, 'Awal')} s.d. ${formatPeriodLabel(e.period_end, 'Seterusnya')}`
                            : 'Sepanjang Waktu'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-medium text-slate-900">{e.reason}</div>
                        {e.notes && <div className="text-[11px] text-slate-500 truncate">{e.notes}</div>}
                        {e.status === 'REVOKED' && (
                          <div className="mt-1 rounded border border-rose-100 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
                            Dicabut: {e.revocation_reason || 'Tanpa alasan'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {e.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" weight="fill" aria-hidden="true" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            <XCircle className="h-3.5 w-3.5 text-slate-400" weight="fill" aria-hidden="true" />
                            Dicabut
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {e.created_at ? formatFinanceDate(e.created_at, true) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {canMutate && e.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeTarget(e)
                              setRevokeReason('')
                            }}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            Cabut
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Berikan Pembebasan */}
      {showGrantModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-grant-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setShowGrantModal(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <h3 id="modal-grant-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Berikan Pembebasan Biaya Santri</span>
              </h3>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => setShowGrantModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleGrantSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <span className="mb-1.5 block font-semibold text-slate-700">
                  Sasaran Pembebasan <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetScope('INDIVIDUAL')
                      setPreviewData(null)
                    }}
                    className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg border px-3 py-2 font-semibold transition-colors cursor-pointer ${
                      targetScope === 'INDIVIDUAL'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" weight={targetScope === 'INDIVIDUAL' ? 'bold' : 'regular'} aria-hidden="true" />
                    <span>Santri Perorangan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetScope('KELAS')
                      setPreviewData(null)
                    }}
                    className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg border px-3 py-2 font-semibold transition-colors cursor-pointer ${
                      targetScope === 'KELAS'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UsersThree className="h-3.5 w-3.5" weight={targetScope === 'KELAS' ? 'bold' : 'regular'} aria-hidden="true" />
                    <span>Rombongan / Kelas</span>
                  </button>
                </div>
              </div>

              {targetScope === 'INDIVIDUAL' ? (
                <div>
                  <span className="mb-1 block font-semibold text-slate-700">
                    Santri Penerima <span className="text-rose-500">*</span>
                  </span>
                  {selectedStudent ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                      <div>
                        <span className="font-semibold text-emerald-950">{selectedStudent.nama_lengkap}</span>
                        <span className="ml-2 text-emerald-700 tabular-nums">NIS {selectedStudent.nis}</span>
                        {selectedStudent.asrama && (
                          <span className="ml-1.5 text-emerald-700">· {selectedStudent.asrama}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null)
                          setPreviewData(null)
                        }}
                        className="font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <MagnifyingGlass
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => handleStudentSearchChange(e.target.value)}
                          placeholder="Ketik nama atau NIS santri aktif…"
                          className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      {studentOptions.length > 0 && (
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-xs">
                          {studentOptions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudent(s)
                                setStudentSearch('')
                                setStudentOptions([])
                                setPreviewData(null)
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                            >
                              <span className="font-medium text-slate-900">{s.nama_lengkap}</span>
                              <span className="text-[11px] text-slate-500 tabular-nums">NIS {s.nis}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="mb-1 block font-semibold text-slate-700">
                    Tingkat Kelas <span className="text-rose-500">*</span>
                  </span>
                  <SelectPicker
                    value={selectedKelas}
                    options={KELAS_OPTIONS}
                    onChange={(val) => {
                      setSelectedKelas(val)
                      setPreviewData(null)
                    }}
                    ariaLabel="Pilih tingkat kelas"
                    className="w-full [&>button]:w-full"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block font-semibold text-slate-700">Pos Biaya</span>
                  <SelectPicker
                    value={itemType}
                    options={ITEM_FORM_OPTIONS}
                    onChange={(val) => {
                      setItemType(val as FinanceItemType | 'ALL')
                      setPreviewData(null)
                    }}
                    ariaLabel="Pilih pos biaya"
                    className="w-full [&>button]:w-full"
                  />
                </div>
                <div>
                  <span className="mb-1 block font-semibold text-slate-700">Tahun Ajaran</span>
                  <SelectPicker
                    value={academicYearId}
                    options={yearFormOptions}
                    onChange={(val) => {
                      setAcademicYearId(val)
                      setPreviewData(null)
                    }}
                    ariaLabel="Pilih tahun ajaran"
                    className="w-full [&>button]:w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Periode Mulai (Opsional)</label>
                  <input
                    type="month"
                    value={periodStart}
                    onChange={(e) => {
                      setPeriodStart(e.target.value)
                      setPreviewData(null)
                    }}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Periode Selesai (Opsional)</label>
                  <input
                    type="month"
                    value={periodEnd}
                    onChange={(e) => {
                      setPeriodEnd(e.target.value)
                      setPreviewData(null)
                    }}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Alasan Pembebasan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beasiswa Tahfidz / Yatim Piatu"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Nomor SK Beasiswa, memo persetujuan, dll."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || (targetScope === 'INDIVIDUAL' && !selectedStudent)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <Eye className={`h-3.5 w-3.5 ${isPreviewing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{isPreviewing ? 'Menghitung…' : 'Pratinjau Dampak'}</span>
                </button>

                {previewData && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>Sasaran: {previewData.targetLabel}</span>
                      <span className="text-[11px] font-normal text-slate-500 tabular-nums">
                        {previewData.totalStudents} santri
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-1.5 text-[11px] tabular-nums">
                      <div>
                        <span className="text-slate-500">Sudah Bebas: </span>
                        <strong className="text-slate-700">{previewData.alreadyExemptedCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Belum Lunas: </span>
                        <strong className="text-amber-700">{previewData.unpaidCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Sudah Lunas (Aman): </span>
                        <strong className="text-emerald-700">{previewData.alreadyPaidCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Sebagian Lunas: </span>
                        <strong className="text-sky-700">{previewData.partiallyPaidCount}</strong>
                      </div>
                    </div>
                    {previewData.partiallyPaidCount > 0 && (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                        Terdapat {previewData.partiallyPaidCount} tagihan terbayar sebagian (sudah dibayar Rp
                        {(previewData.partiallyPaidAmount || 0).toLocaleString('id-ID')}, sisa Rp
                        {(previewData.partiallyRemainingAmount || 0).toLocaleString('id-ID')}). Tagihan ini dikecualikan
                        dari pembebasan otomatis untuk ditinjau manual.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan…' : 'Simpan Pembebasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cabut Pembebasan */}
      {revokeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-revoke-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRevoking) setRevokeTarget(null)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <h3 id="modal-revoke-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ArrowCounterClockwise className="h-4 w-4 text-rose-600" aria-hidden="true" />
                <span>Cabut Pembebasan Biaya</span>
              </h3>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => setRevokeTarget(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit} className="p-5 space-y-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div>
                  <span className="text-slate-500">Santri: </span>
                  <strong className="text-slate-900">{revokeTarget.santri_nama}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Pos Biaya: </span>
                  <span className="font-medium text-slate-800">
                    {ITEM_LABELS[revokeTarget.item_type] || revokeTarget.item_type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Alasan Sebelumnya: </span>
                  <span className="text-slate-700">{revokeTarget.reason}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Alasan Pencabutan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Contoh: Masa berlaku program beasiswa telah berakhir…"
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 focus:border-rose-500 focus:outline-none resize-none"
                />
              </div>

              <div className="rounded-lg border border-rose-100 bg-rose-50/70 p-2.5 text-[11px] text-rose-800">
                Status akan berubah menjadi <strong>Dicabut</strong> dan sisa tagihan santri yang belum dibayar akan
                kembali ditagihkan otomatis.
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  disabled={isRevoking}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRevoking}
                  className="min-h-[38px] rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {isRevoking ? 'Memproses…' : 'Konfirmasi Cabut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
