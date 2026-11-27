'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  createTariffAction,
  saveTariffOverrideAction,
  deleteTariffOverrideAction,
  setKoperasiCutoverAction,
} from './actions'
import type {
  FinanceTariff,
  FinanceTariffOverride,
  FinanceItemType,
  FinanceInstallmentRule,
} from '@/lib/finance/types'
import type { AcademicYearOption } from './actions'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  Tag,
  Plus,
  CalendarBlank,
  CheckCircle,
  WarningCircle,
  Clock,
  Info,
  Trash,
  Buildings,
  ArrowsLeftRight,
  X,
} from '@phosphor-icons/react'

interface TarifTabProps {
  tariffs: FinanceTariff[]
  tariffOverrides?: FinanceTariffOverride[]
  koperasiCutover?: {
    effectiveAt: string | null
    isStarted: boolean
    hasKoperasiPayments?: boolean
    koperasiPaymentsCount?: number
  }
  academicYears: AcademicYearOption[]
  canMutate: boolean
  onRefresh: () => void
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  SPP: 'SPP Bulanan',
  UANG_MAKAN: 'Uang Makan (Katering)',
  UANG_NYUCI: 'Uang Nyuci (Laundry)',
  EHB: 'EHB (Tahunan)',
  EKSKUL: 'Ekstrakurikuler (Tahunan)',
  KESEHATAN: 'Kesehatan (Tahunan)',
  USPP: 'USPP / Bangunan (Sekali)',
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatRupiah(val: number): string {
  return `Rp${Math.round(val || 0).toLocaleString('id-ID')}`
}

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

function formatDateShort(ymd: string | null | undefined): string {
  if (!ymd) return 'Seterusnya'
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ymd
  const [, y, m, d] = match
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${Number(d)} ${MONTH_SHORT[idx]} ${y}` : ymd
}

function formatPeriodLabel(ym: string): string {
  const match = ym.match(/^(\d{4})-(\d{2})$/)
  if (!match) return ym
  const [, y, m] = match
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTH_SHORT[idx]} ${y}` : ym
}

function toWibDatetimeLocal(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) return trimmed.slice(0, 16).replace(' ', 'T')
  return new Date(dt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16)
}

export default function TarifTab({
  tariffs,
  tariffOverrides = [],
  koperasiCutover = { effectiveAt: null, isStarted: false },
  academicYears,
  canMutate,
  onRefresh,
}: TarifTabProps) {
  const [filterItem, setFilterItem] = useState<string>('ALL')
  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State Base Tariff
  const [selectedItemType, setSelectedItemType] = useState<FinanceItemType>('SPP')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [nominalInput, setNominalInput] = useState<string>('')
  const [installmentRule, setInstallmentRule] = useState<FinanceInstallmentRule>('DISALLOWED')
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => todayWib())
  const [effectiveUntil, setEffectiveUntil] = useState<string>('')

  // Override State & Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideItemType, setOverrideItemType] = useState<FinanceItemType>('SPP')
  const [overridePeriod, setOverridePeriod] = useState<string>('')
  const [overrideNominalInput, setOverrideNominalInput] = useState<string>('')
  const [overrideNotes, setOverrideNotes] = useState<string>('')
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false)
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null)

  // Cutover State (WIB)
  const [cutoverDateInput, setCutoverDateInput] = useState<string>(() =>
    toWibDatetimeLocal(koperasiCutover.effectiveAt)
  )
  const [isUpdatingCutover, setIsUpdatingCutover] = useState(false)

  // Escape handler untuk kedua modal
  useEffect(() => {
    if (!showModal && !showOverrideModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showOverrideModal && !isSubmittingOverride) setShowOverrideModal(false)
        else if (showModal && !isSubmitting) setShowModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal, showOverrideModal, isSubmitting, isSubmittingOverride])

  const itemFilterOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Pos Biaya' },
      ...Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
    ],
    []
  )

  const itemFormOptions = useMemo<SelectPickerOption[]>(
    () => Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
    []
  )

  const overrideItemOptions = useMemo<SelectPickerOption[]>(
    () =>
      Object.entries(ITEM_TYPE_LABELS)
        .filter(([k]) => ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].includes(k))
        .map(([k, v]) => ({ value: k, label: v })),
    []
  )

  const yearFilterOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: 'ALL', label: 'Semua Tahun Ajaran' },
      { value: 'NULL', label: 'Umum (Tanpa Tahun Ajaran)' },
      ...academicYears.map((y) => ({
        value: String(y.id),
        label: `${y.nama}${y.is_active ? ' (Aktif)' : ''}`,
      })),
    ],
    [academicYears]
  )

  const yearFormOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: '', label: 'Umum / Tanpa Tahun Ajaran Spesifik' },
      ...academicYears.map((y) => ({
        value: String(y.id),
        label: `${y.nama}${y.is_active ? ' (Aktif)' : ''}`,
      })),
    ],
    [academicYears]
  )

  const installmentOptions: SelectPickerOption[] = [
    { value: 'DISALLOWED', label: 'Wajib Lunas Penuh (Tidak Boleh Dicicil)' },
    { value: 'ALLOWED', label: 'Boleh Dicicil' },
  ]

  const handleItemTypeChange = (type: FinanceItemType) => {
    setSelectedItemType(type)
    if (type === 'SPP') setInstallmentRule('DISALLOWED')
    else if (type === 'USPP') setInstallmentRule('ALLOWED')
  }

  const handleOpenModal = () => {
    setSelectedItemType('SPP')
    const activeYear = academicYears.find((y) => y.is_active === 1)
    setSelectedAcademicYear(activeYear ? String(activeYear.id) : '')
    setNominalInput('')
    setInstallmentRule('DISALLOWED')
    setEffectiveFrom(todayWib())
    setEffectiveUntil('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = parseInt(nominalInput.replace(/\D/g, ''), 10)
    if (isNaN(nominal) || nominal < 0) {
      toast.error('Nominal tarif harus berupa angka positif.')
      return
    }
    if (!effectiveFrom) {
      toast.error('Tanggal berlaku mulai wajib diisi.')
      return
    }
    if (effectiveUntil && effectiveUntil < effectiveFrom) {
      toast.error('Tanggal berlaku sampai tidak boleh lebih awal dari tanggal mulai.')
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading('Menyimpan versi tarif baru…')

    const res = await createTariffAction({
      item_type: selectedItemType,
      academic_year_id: selectedAcademicYear ? parseInt(selectedAcademicYear, 10) : null,
      nominal,
      installment_rule: installmentRule,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil || null,
    })

    setIsSubmitting(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Versi tarif baru berhasil diterbitkan.')
      setShowModal(false)
      onRefresh()
    } else {
      toast.error('Gagal menyimpan tarif', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    const nominal = parseInt(overrideNominalInput.replace(/\D/g, ''), 10)
    if (isNaN(nominal) || nominal < 0) {
      toast.error('Nominal tarif khusus harus berupa angka positif.')
      return
    }
    const cleanPeriod = overridePeriod.trim()
    if (!cleanPeriod || !/^\d{4}-\d{2}$/.test(cleanPeriod)) {
      toast.error('Pilih periode bulan yang valid.')
      return
    }

    setIsSubmittingOverride(true)
    const toastId = toast.loading('Menyimpan tarif khusus periode…')

    const res = await saveTariffOverrideAction({
      item_type: overrideItemType,
      period: cleanPeriod,
      nominal,
      notes: overrideNotes.trim() || null,
    })

    setIsSubmittingOverride(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Tarif khusus ${ITEM_TYPE_LABELS[overrideItemType]} (${formatPeriodLabel(cleanPeriod)}) disimpan.`)
      setShowOverrideModal(false)
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menyimpan tarif khusus periode.')
    }
  }

  const handleDeleteOverride = async (override: FinanceTariffOverride) => {
    if (
      !confirm(
        `Hapus tarif khusus ${ITEM_TYPE_LABELS[override.item_type]} untuk ${formatPeriodLabel(override.period)}? Tagihan akan kembali memakai tarif standar.`
      )
    ) {
      return
    }
    setDeletingOverrideId(override.id)
    const res = await deleteTariffOverrideAction(override.item_type, override.period)
    setDeletingOverrideId(null)
    if (res.success) {
      toast.success(`Tarif khusus ${formatPeriodLabel(override.period)} berhasil dihapus.`)
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menghapus tarif khusus periode.')
    }
  }

  const handleUpdateCutover = async () => {
    const raw = cutoverDateInput.trim()
    if (!raw) {
      toast.error('Masukkan tanggal dan jam pengalihan.')
      return
    }
    // Pastikan selalu melampirkan offset WIB (+07:00)
    const formatted =
      raw.length === 10
        ? `${raw}T00:00:00+07:00`
        : raw.length === 16
          ? `${raw}:00+07:00`
          : raw.includes('+') || raw.endsWith('Z')
            ? raw
            : `${raw}+07:00`

    const confirmed = confirm(
      `PERINGATAN AUDIT KEUANGAN:\n\nPengalihan ke Koperasi akan mengarahkan semua pembayaran baru pada atau setelah ${formatFinanceDate(formatted, true)} WIB ke kas operasional Koperasi.\n\nSeluruh transaksi sebelumnya tetap berstatus Pra-Koperasi secara permanen.\n\nLanjutkan?`
    )
    if (!confirmed) return

    setIsUpdatingCutover(true)
    const toastId = toast.loading('Memperbarui titik pengalihan Koperasi…')
    const res = await setKoperasiCutoverAction(formatted)
    setIsUpdatingCutover(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Titik waktu pengalihan Koperasi berhasil disimpan.')
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menyimpan pengaturan pengalihan.')
    }
  }

  const handleResetCutover = async () => {
    const confirmed = confirm(
      'Kembalikan status ke Pra-Koperasi? Seluruh pembayaran baru akan tetap dicatat sebagai Pra-Koperasi.'
    )
    if (!confirmed) return

    setIsUpdatingCutover(true)
    const toastId = toast.loading('Mereset status ke Pra-Koperasi…')
    const res = await setKoperasiCutoverAction(null)
    setIsUpdatingCutover(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Status pengalihan berhasil dikembalikan ke Pra-Koperasi.')
      setCutoverDateInput('')
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal mereset status pengalihan.')
    }
  }

  const today = todayWib()

  const filteredTariffs = tariffs.filter((t) => {
    if (filterItem !== 'ALL' && t.item_type !== filterItem) return false
    if (filterYear !== 'ALL') {
      if (filterYear === 'NULL' && t.academic_year_id !== null) return false
      if (filterYear !== 'NULL' && String(t.academic_year_id) !== filterYear) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Filter Toolbar & Tombol Tambah */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-end text-xs">
          <div className="w-full sm:w-52">
            <span className="mb-1 block font-semibold text-slate-600">Pos Biaya</span>
            <SelectPicker
              value={filterItem}
              options={itemFilterOptions}
              onChange={setFilterItem}
              ariaLabel="Filter pos biaya"
              className="w-full [&>button]:w-full"
            />
          </div>

          <div className="w-full sm:w-52">
            <span className="mb-1 block font-semibold text-slate-600">Tahun Ajaran</span>
            <SelectPicker
              value={filterYear}
              options={yearFilterOptions}
              onChange={setFilterYear}
              ariaLabel="Filter tahun ajaran"
              className="w-full [&>button]:w-full"
            />
          </div>
        </div>

        <div className="shrink-0">
          {canMutate ? (
            <button
              type="button"
              onClick={handleOpenModal}
              className="w-full sm:w-auto inline-flex min-h-[40px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" weight="bold" aria-hidden="true" />
              <span>Tambah Versi Tarif</span>
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
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" weight="bold" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Riwayat Tarif Terjaga:</strong> Perubahan tarif tidak pernah mengubah
          tagihan atau transaksi yang sudah berlalu. Tarif baru otomatis berlaku mulai tanggal efektif yang ditentukan.
        </p>
      </div>

      {/* 1. Daftar Tarif Standar (Mobile Cards + Desktop Table) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {filteredTariffs.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            Belum ada tarif yang sesuai dengan filter.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredTariffs.map((t) => {
                const isCurrent = t.effective_from <= today && (!t.effective_until || t.effective_until >= today)
                const isUpcoming = t.effective_from > today
                const yearObj = academicYears.find((y) => y.id === t.academic_year_id)

                return (
                  <div key={`m-t-${t.id}`} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {ITEM_TYPE_LABELS[t.item_type] || t.item_type}
                        </div>
                        <div className="text-xs text-slate-500">
                          {yearObj ? `TA ${yearObj.nama}` : 'Umum / Semua Tahun'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatRupiah(t.nominal)}
                        </div>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.installment_rule === 'ALLOWED'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {t.installment_rule === 'ALLOWED' ? 'Boleh Dicicil' : 'Wajib Penuh'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarBlank className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {formatDateShort(t.effective_from)} s.d. {formatDateShort(t.effective_until)}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <CheckCircle className="h-3 w-3 text-emerald-600" weight="fill" aria-hidden="true" />
                          Aktif
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                          <Clock className="h-3 w-3 text-sky-600" weight="fill" aria-hidden="true" />
                          Mendatang
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          <WarningCircle className="h-3 w-3 text-slate-400" weight="fill" aria-hidden="true" />
                          Berakhir
                        </span>
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
                    <th className="px-4 py-3">Pos Biaya</th>
                    <th className="px-4 py-3">Tahun Ajaran</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3">Aturan Cicilan</th>
                    <th className="px-4 py-3">Periode Berlaku</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Dibuat (WIB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTariffs.map((t) => {
                    const isCurrent = t.effective_from <= today && (!t.effective_until || t.effective_until >= today)
                    const isUpcoming = t.effective_from > today
                    const yearObj = academicYears.find((y) => y.id === t.academic_year_id)

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                            <span>{ITEM_TYPE_LABELS[t.item_type] || t.item_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {yearObj ? yearObj.nama : <span className="text-slate-400">Umum / Semua</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatRupiah(t.nominal)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {t.installment_rule === 'ALLOWED' ? (
                            <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              Boleh Dicicil
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              Wajib Penuh
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateShort(t.effective_from)}{' '}
                          <span className="text-slate-400">s.d.</span>{' '}
                          {formatDateShort(t.effective_until)}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" weight="fill" aria-hidden="true" />
                              Aktif
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                              <Clock className="h-3.5 w-3.5 text-sky-600" weight="fill" aria-hidden="true" />
                              Mendatang
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              <WarningCircle className="h-3.5 w-3.5 text-slate-400" weight="fill" aria-hidden="true" />
                              Berakhir
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                          {t.created_at ? formatFinanceDate(t.created_at, true) : '—'}
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

      {/* 2. Section: Tarif Khusus Periode */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ArrowsLeftRight className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>Tarif Khusus Bulan Tertentu</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Penetapan nominal khusus untuk satu bulan tertentu (misal SPP bulan pembukaan). Mendahului tarif standar.
            </p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={() => {
                setOverrideItemType('SPP')
                setOverridePeriod(todayWib().slice(0, 7))
                setOverrideNominalInput('')
                setOverrideNotes('')
                setShowOverrideModal(true)
              }}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
              <span>Tambah Tarif Khusus</span>
            </button>
          )}
        </div>

        {tariffOverrides.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            Belum ada tarif khusus bulan tertentu. Seluruh periode memakai tarif standar.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {tariffOverrides.map((ov) => (
                <div key={`m-ov-${ov.id}`} className="p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {ITEM_TYPE_LABELS[ov.item_type] || ov.item_type}
                      </div>
                      <div className="text-xs font-medium text-emerald-700">{formatPeriodLabel(ov.period)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(ov.nominal)}
                      </span>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOverride(ov)}
                          disabled={deletingOverrideId === ov.id}
                          aria-label={`Hapus tarif khusus ${ov.period}`}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {ov.notes && <p className="text-xs text-slate-500">{ov.notes}</p>}
                  <div className="text-[11px] text-slate-400 tabular-nums">
                    Ditetapkan: {ov.created_at ? formatFinanceDate(ov.created_at, true) : '—'}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Pos Tagihan</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3 text-right">Nominal Khusus</th>
                    <th className="px-4 py-3">Catatan</th>
                    <th className="px-4 py-3">Ditetapkan (WIB)</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tariffOverrides.map((ov) => (
                    <tr key={ov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {ITEM_TYPE_LABELS[ov.item_type] || ov.item_type}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-700 whitespace-nowrap">
                        {formatPeriodLabel(ov.period)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(ov.nominal)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{ov.notes || '—'}</td>
                      <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {ov.created_at ? formatFinanceDate(ov.created_at, true) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canMutate ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteOverride(ov)}
                            disabled={deletingOverrideId === ov.id}
                            aria-label={`Hapus tarif khusus ${ov.period}`}
                            className="inline-flex rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash className="h-4 w-4" aria-hidden="true" />
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
      </section>

      {/* 3. Section: Pengalihan Pengelolaan Dana ke Koperasi */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Buildings className="h-5 w-5" weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pengalihan Pengelolaan Dana ke Koperasi
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Menentukan titik waktu penerimaan mulai masuk ke kas operasional Koperasi. Transaksi sebelum titik ini
                dicatat sebagai <strong>Pra-Koperasi</strong> (bukti pelunasan santri, tidak masuk saldo Koperasi).
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {koperasiCutover.isStarted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 tabular-nums">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" weight="fill" aria-hidden="true" />
                <span>
                  Aktif sejak {koperasiCutover.effectiveAt ? formatFinanceDate(koperasiCutover.effectiveAt, true) : '—'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Belum Dimulai (Pra-Koperasi)</span>
              </span>
            )}
          </div>
        </div>

        {canMutate && (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Titik Waktu Pengalihan (WIB):
              </label>
              <input
                type="datetime-local"
                value={cutoverDateInput}
                onChange={(e) => setCutoverDateInput(e.target.value)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUpdateCutover}
                disabled={isUpdatingCutover || !cutoverDateInput}
                className="min-h-[38px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingCutover ? 'Menyimpan…' : 'Terapkan Titik Waktu'}
              </button>

              {koperasiCutover.isStarted && (
                <>
                  <button
                    type="button"
                    onClick={handleResetCutover}
                    disabled={isUpdatingCutover || Boolean(koperasiCutover.hasKoperasiPayments)}
                    title={
                      koperasiCutover.hasKoperasiPayments
                        ? 'Reset dinonaktifkan karena sudah ada transaksi operasional Koperasi'
                        : 'Reset ke Pra-Koperasi'
                    }
                    className="min-h-[38px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Reset ke Pra-Koperasi
                  </button>
                  {Boolean(koperasiCutover.hasKoperasiPayments) && (
                    <span className="text-[11px] text-slate-500">
                      Terkunci ({koperasiCutover.koperasiPaymentsCount} transaksi Koperasi)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Modal Tambah Versi Tarif */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tarif-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setShowModal(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <h3 id="modal-tarif-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Tag className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Terbitkan Versi Tarif Baru</span>
              </h3>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => setShowModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <span className="mb-1 block font-semibold text-slate-700">
                  Pos Biaya <span className="text-rose-500">*</span>
                </span>
                <SelectPicker
                  value={selectedItemType}
                  options={itemFormOptions}
                  onChange={(val) => handleItemTypeChange(val as FinanceItemType)}
                  ariaLabel="Pilih pos biaya"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div>
                <span className="mb-1 block font-semibold text-slate-700">Tahun Ajaran</span>
                <SelectPicker
                  value={selectedAcademicYear}
                  options={yearFormOptions}
                  onChange={setSelectedAcademicYear}
                  ariaLabel="Pilih tahun ajaran"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nominal Tarif (Rupiah) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={nominalInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setNominalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Contoh: 350.000"
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 font-semibold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1 block font-semibold text-slate-700">Aturan Cicilan</span>
                {selectedItemType === 'SPP' ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">
                    <strong className="text-slate-800">Terkunci — Wajib Penuh.</strong> SPP dilunasi penuh per bulan.
                  </div>
                ) : selectedItemType === 'USPP' ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                    <strong>Terkunci — Boleh Dicicil.</strong> USPP dapat dibayar bertahap.
                  </div>
                ) : (
                  <SelectPicker
                    value={installmentRule}
                    options={installmentOptions}
                    onChange={(val) => setInstallmentRule(val as FinanceInstallmentRule)}
                    ariaLabel="Pilih aturan cicilan"
                    className="w-full [&>button]:w-full"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Berlaku Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Berlaku Sampai (Opsional)
                  </label>
                  <input
                    type="date"
                    value={effectiveUntil}
                    onChange={(e) => setEffectiveUntil(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {isSubmitting ? 'Menyimpan…' : 'Simpan Versi Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Tarif Khusus Periode */}
      {showOverrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-override-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingOverride) setShowOverrideModal(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <h3 id="modal-override-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ArrowsLeftRight className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Tetapkan Tarif Khusus Bulan</span>
              </h3>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => setShowOverrideModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="p-5 space-y-4 text-xs">
              <div>
                <span className="mb-1 block font-semibold text-slate-700">
                  Pos Pembayaran <span className="text-rose-500">*</span>
                </span>
                <SelectPicker
                  value={overrideItemType}
                  options={overrideItemOptions}
                  onChange={(val) => setOverrideItemType(val as FinanceItemType)}
                  ariaLabel="Pilih pos pembayaran"
                  className="w-full [&>button]:w-full"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Periode Bulan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="month"
                  required
                  value={overridePeriod}
                  onChange={(e) => setOverridePeriod(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nominal Khusus (Rupiah) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={overrideNominalInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setOverrideNominalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Contoh: 50.000"
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 font-semibold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Catatan / Alasan</label>
                <input
                  type="text"
                  placeholder="Contoh: Tarif khusus bulan pembukaan tahun ajaran"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  disabled={isSubmittingOverride}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOverride ? 'Menyimpan…' : 'Simpan Tarif Khusus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
