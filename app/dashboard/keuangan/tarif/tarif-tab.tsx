'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createTariffAction } from './actions'
import type { FinanceTariff, FinanceItemType, FinanceInstallmentRule } from '@/lib/finance/types'
import type { AcademicYearOption } from './actions'
import {
  Tag,
  Plus,
  CalendarBlank,
  CheckCircle,
  WarningCircle,
  Clock,
  Info,
} from '@phosphor-icons/react'

interface TarifTabProps {
  tariffs: FinanceTariff[]
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
  academicYears,
  canMutate,
  onRefresh,
}: TarifTabProps) {
  const [filterItem, setFilterItem] = useState<string>('ALL')
  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [selectedItemType, setSelectedItemType] = useState<FinanceItemType>('SPP')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [nominalInput, setNominalInput] = useState<string>('')
  const [installmentRule, setInstallmentRule] = useState<FinanceInstallmentRule>('DISALLOWED')
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
                  Aturan Cicilan (PRD #13)
                </label>
                {selectedItemType === 'SPP' ? (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="font-semibold text-slate-800">Terkunci: Tidak Boleh Dicicil.</span> Sesuai PRD, SPP wajib dilunasi penuh.
                  </div>
                ) : selectedItemType === 'USPP' ? (
                  <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <span className="font-semibold">Terkunci: Boleh Dicicil.</span> Sesuai PRD, USPP selalu boleh dicicil bertahap.
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
    </div>
  )
}
