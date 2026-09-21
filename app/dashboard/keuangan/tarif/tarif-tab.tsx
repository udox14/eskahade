'use client'

import { useState } from 'react'
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
  USPP: 'USPP / Bangunan (Lifetime)',
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

  // Override State & Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideItemType, setOverrideItemType] = useState<FinanceItemType>('SPP')
  const [overridePeriod, setOverridePeriod] = useState<string>('')
  const [overrideNominalInput, setOverrideNominalInput] = useState<string>('')
  const [overrideNotes, setOverrideNotes] = useState<string>('')
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false)
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null)

  // Cutover State
  const [cutoverDateInput, setCutoverDateInput] = useState<string>(
    koperasiCutover.effectiveAt ? koperasiCutover.effectiveAt.slice(0, 16) : ''
  )
  const [isUpdatingCutover, setIsUpdatingCutover] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [effectiveUntil, setEffectiveUntil] = useState<string>('')

  // Handle item type change with automatic installment rule enforcement
  const handleItemTypeChange = (type: FinanceItemType) => {
    setSelectedItemType(type)
    if (type === 'SPP') {
      setInstallmentRule('DISALLOWED')
    } else if (type === 'USPP') {
      setInstallmentRule('ALLOWED')
    }
  }

  const handleOpenModal = () => {
    setSelectedItemType('SPP')
    const activeYear = academicYears.find((y) => y.is_active === 1)
    setSelectedAcademicYear(activeYear ? String(activeYear.id) : '')
    setNominalInput('')
    setInstallmentRule('DISALLOWED')
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
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
    const toastId = toast.loading('Menyimpan versi tarif baru...')

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
      toast.error('Nominal override harus berupa angka positif.')
      return
    }
    const cleanPeriod = overridePeriod.trim()
    if (!cleanPeriod || !/^\d{4}-\d{2}$/.test(cleanPeriod)) {
      toast.error('Format periode harus YYYY-MM (contoh: 2026-07).')
      return
    }

    setIsSubmittingOverride(true)
    const toastId = toast.loading('Menyimpan tarif khusus periode...')

    const res = await saveTariffOverrideAction({
      item_type: overrideItemType,
      period: cleanPeriod,
      nominal,
      notes: overrideNotes.trim() || null,
    })

    setIsSubmittingOverride(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Tarif khusus ${ITEM_TYPE_LABELS[overrideItemType]} periode ${cleanPeriod} berhasil disimpan.`)
      setShowOverrideModal(false)
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menyimpan tarif khusus periode.')
    }
  }

  const handleDeleteOverride = async (override: FinanceTariffOverride) => {
    if (
      !confirm(
        `Hapus tarif khusus ${ITEM_TYPE_LABELS[override.item_type]} untuk periode ${override.period}? Tagihan akan kembali menggunakan tarif tahunan standar.`
      )
    ) {
      return
    }
    setDeletingOverrideId(override.id)
    const res = await deleteTariffOverrideAction(override.item_type, override.period)
    setDeletingOverrideId(null)
    if (res.success) {
      toast.success(`Tarif khusus periode ${override.period} berhasil dihapus.`)
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menghapus tarif khusus periode.')
    }
  }

  const handleUpdateCutover = async () => {
    if (!cutoverDateInput.trim()) {
      toast.error('Masukkan tanggal cutover pengalihan.')
      return
    }
    const formatted =
      cutoverDateInput.trim().length === 10
        ? `${cutoverDateInput.trim()}T00:00:00+07:00`
        : cutoverDateInput.trim()
    const confirmed = confirm(
      `PERINGATAN AUDIT KEUANGAN:\n\nPengalihan ke Koperasi akan mengarahkan semua pembayaran masuk baru pada atau setelah ${formatted} ke kas operasional Koperasi.\n\nSeluruh transaksi sebelum waktu ini TETAP berstatus PRE_KOPERASI secara permanen.\n\nApakah Anda yakin ingin menetapkan titik waktu pengalihan ini?`
    )
    if (!confirmed) return

    setIsUpdatingCutover(true)
    const toastId = toast.loading('Memperbarui tanggal pengalihan Koperasi...')
    const res = await setKoperasiCutoverAction(formatted)
    setIsUpdatingCutover(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Pengaturan cutover Koperasi berhasil disimpan.')
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal menyimpan pengaturan cutover Koperasi.')
    }
  }

  const handleResetCutover = async () => {
    const confirmed = confirm(
      'Kembalikan status ke Pra-Koperasi (kosongkan tanggal cutover)? Seluruh pembayaran baru akan tetap berstatus PRE_KOPERASI.'
    )
    if (!confirmed) return

    setIsUpdatingCutover(true)
    const toastId = toast.loading('Mereset status ke Pra-Koperasi...')
    const res = await setKoperasiCutoverAction(null)
    setIsUpdatingCutover(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Status pengalihan berhasil direset ke Pra-Koperasi.')
      setCutoverDateInput('')
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal mereset status pengalihan.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const filteredTariffs = tariffs.filter((t) => {
    if (filterItem !== 'ALL' && t.item_type !== filterItem) return false
    if (filterYear !== 'ALL') {
      if (filterYear === 'NULL' && t.academic_year_id !== null) return false
      if (filterYear !== 'NULL' && String(t.academic_year_id) !== filterYear) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Item Pembayaran</label>
            <select
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Item</option>
              {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tahun Ajaran</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Tahun Ajaran</option>
              <option value="NULL">Umum (Tanpa Tahun Ajaran)</option>
              {academicYears.map((y) => (
                <option key={y.id} value={String(y.id)}>
                  {y.nama} {y.is_active ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          {canMutate ? (
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" weight="bold" />
              Tambah Versi Tarif
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Info className="w-4 h-4 text-slate-400" />
              Mode Lihat Saja (Pimpinan)
            </div>
          )}
        </div>
      </div>

      {/* Info Banner: Immutability */}
      <div className="flex items-start gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
        <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" weight="bold" />
        <div>
          <span className="font-semibold">Histori Tarif Abadi (Immutable Versioning):</span> Perubahan tarif tidak pernah menimpa atau mengubah transaksi historis. Saat nominal tarif baru berlaku, sistem otomatis menerapkannya untuk periode efektif berikutnya tanpa merusak audit trail transaksi masa lalu.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Item Pembayaran</th>
                <th className="px-4 py-3">Tahun Ajaran</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Aturan Cicilan</th>
                <th className="px-4 py-3">Periode Berlaku</th>
                <th className="px-4 py-3 text-center">Status Versi</th>
                <th className="px-4 py-3">Dibuat Pada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredTariffs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Belum ada tarif yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTariffs.map((t) => {
                  const isCurrent = t.effective_from <= today && (!t.effective_until || t.effective_until >= today)
                  const isUpcoming = t.effective_from > today
                  const isExpired = t.effective_until && t.effective_until < today

                  const yearObj = academicYears.find((y) => y.id === t.academic_year_id)

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-emerald-600" />
                          <span>{ITEM_TYPE_LABELS[t.item_type] || t.item_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {yearObj ? yearObj.nama : <span className="text-slate-400 italic">Umum / Semua</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                        Rp {t.nominal.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5">
                        {t.installment_rule === 'ALLOWED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Boleh Dicicil
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Wajib Penuh
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <CalendarBlank className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.effective_from}</span>
                          <span className="text-slate-400">s.d.</span>
                          <span>{t.effective_until || 'Seterusnya'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" weight="fill" />
                            Aktif
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                            <Clock className="w-3.5 h-3.5 text-sky-600" weight="fill" />
                            Mendatang
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            <WarningCircle className="w-3.5 h-3.5 text-slate-400" weight="fill" />
                            Kedaluwarsa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-[11px] font-mono">
                        {t.created_at ? t.created_at.slice(0, 16).replace('T', ' ') : '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Section: Tarif Khusus Periode (Override Bulanan) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ArrowsLeftRight className="w-4 h-4 text-emerald-600" />
              Tarif Khusus Periode (Override Bulanan)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Penetapan nominal khusus untuk satu bulan tertentu (misal SPP bulan pembukaan). Sistem mendahulukan tarif khusus ini dibanding tarif standar.
            </p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={() => {
                setOverrideItemType('SPP')
                setOverridePeriod('')
                setOverrideNominalInput('')
                setOverrideNotes('')
                setShowOverrideModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" weight="bold" />
              <span>Tambah Tarif Khusus</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Pos Tagihan</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Nominal Override</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3">Ditetapkan Pada</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {tariffOverrides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Belum ada tarif khusus periode yang ditetapkan. Tagihan seluruh periode menggunakan tarif standar.
                  </td>
                </tr>
              ) : (
                tariffOverrides.map((ov) => (
                  <tr key={ov.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {ITEM_TYPE_LABELS[ov.item_type] || ov.item_type}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-emerald-700">
                      {ov.period}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">
                      Rp {ov.nominal.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {ov.notes || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px] font-mono">
                      {ov.created_at ? ov.created_at.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {canMutate ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteOverride(ov)}
                          disabled={deletingOverrideId === ov.id}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition-colors disabled:opacity-50"
                          title="Hapus tarif khusus periode"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Section: Pengalihan Pengelolaan Dana Koperasi (Cutover Control) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-200 shrink-0">
              <Buildings className="w-5 h-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Tata Kelola & Pengalihan Dana Koperasi (Cutover Control)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Mengatur titik waktu pengalihan arus penerimaan dana ke kas operasional Koperasi.
                Sebelum titik ini, seluruh penerimaan berstatus <strong>Pra-Koperasi (PRE_KOPERASI)</strong> sebagai bukti pelunasan santri (evidence of settlement) dan dikecualikan dari saldo operasional Koperasi.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {koperasiCutover.isStarted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" weight="fill" />
                <span>Aktif Sejak {koperasiCutover.effectiveAt?.slice(0, 16).replace('T', ' ')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Belum Dimulai (Semua Transaksi = PRE_KOPERASI)</span>
              </span>
            )}
          </div>
        </div>

        {canMutate && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Titik Waktu Pengalihan:
              </label>
              <input
                type="datetime-local"
                value={cutoverDateInput}
                onChange={(e) => setCutoverDateInput(e.target.value)}
                className="text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdateCutover}
                disabled={isUpdatingCutover || !cutoverDateInput}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {isUpdatingCutover ? 'Menyimpan...' : 'Terapkan Titik Pengalihan'}
              </button>

              {koperasiCutover.isStarted && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetCutover}
                    disabled={isUpdatingCutover || Boolean(koperasiCutover.hasKoperasiPayments)}
                    title={
                      koperasiCutover.hasKoperasiPayments
                        ? 'Reset dinonaktifkan karena sudah terdapat transaksi operasional Koperasi tercatat'
                        : 'Reset ke Pra-Koperasi'
                    }
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset ke Pra-Koperasi
                  </button>
                  {Boolean(koperasiCutover.hasKoperasiPayments) && (
                    <span className="text-[11px] text-slate-500 italic">
                      (Terkunci: {koperasiCutover.koperasiPaymentsCount} transaksi Koperasi)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Versi Tarif */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                Terbitkan Versi Tarif Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedItemType}
                  onChange={(e) => handleItemTypeChange(e.target.value as FinanceItemType)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">Umum / Tanpa Tahun Ajaran Spesifik</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={String(y.id)}>
                      {y.nama} {y.is_active ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Tarif (Rupiah) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">Rp</span>
                  <input
                    type="text"
                    required
                    value={nominalInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setNominalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Contoh: 350.000"
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aturan Cicilan Tagihan
                </label>
                {selectedItemType === 'SPP' ? (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="font-semibold text-slate-800">Terkunci: Tidak Boleh Dicicil.</span> SPP wajib dilunasi penuh per periode tagihan.
                  </div>
                ) : selectedItemType === 'USPP' ? (
                  <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <span className="font-semibold">Terkunci: Boleh Dicicil.</span> USPP dapat dicicil bertahap sesuai kemampuan santri.
                  </div>
                ) : (
                  <select
                    value={installmentRule}
                    onChange={(e) => setInstallmentRule(e.target.value as FinanceInstallmentRule)}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="DISALLOWED">Wajib Lunas Penuh (Tidak Boleh Dicicil)</option>
                    <option value="ALLOWED">Boleh Dicicil</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Berlaku Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Berlaku Sampai (Opsional)
                  </label>
                  <input
                    type="date"
                    value={effectiveUntil}
                    onChange={(e) => setEffectiveUntil(e.target.value)}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Versi Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Tarif Khusus Periode */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ArrowsLeftRight className="w-4 h-4 text-emerald-600" />
                Tetapkan Tarif Khusus Periode
              </h3>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pos Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={overrideItemType}
                  onChange={(e) => setOverrideItemType(e.target.value as FinanceItemType)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {Object.entries(ITEM_TYPE_LABELS)
                    .filter(([k]) => ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].includes(k))
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Periode Spesifik (YYYY-MM) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2026-07"
                  value={overridePeriod}
                  onChange={(e) => setOverridePeriod(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Override (Rupiah) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">Rp</span>
                  <input
                    type="text"
                    required
                    value={overrideNominalInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setOverrideNominalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                    }}
                    placeholder="Contoh: 350.000"
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Alasan Khusus
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tarif transisi bulan pembukaan tahun ajaran"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  disabled={isSubmittingOverride}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmittingOverride ? 'Menyimpan...' : 'Simpan Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
