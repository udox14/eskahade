'use client'

import { useState, useEffect } from 'react'
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
} from '@phosphor-icons/react'

interface PembebasanTabProps {
  exemptions: ExemptionWithStudent[]
  academicYears: AcademicYearOption[]
  legacySppCount?: number
  canMutate: boolean
  onRefresh: () => void
}

const ITEM_OPTIONS: Array<{ value: FinanceItemType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Semua Item Pembayaran (ALL)' },
  { value: 'SPP', label: 'SPP Bulanan' },
  { value: 'UANG_MAKAN', label: 'Uang Makan (Katering)' },
  { value: 'UANG_NYUCI', label: 'Uang Nyuci (Laundry)' },
  { value: 'EHB', label: 'EHB (Tahunan)' },
  { value: 'EKSKUL', label: 'Ekstrakurikuler (Tahunan)' },
  { value: 'KESEHATAN', label: 'Kesehatan (Tahunan)' },
  { value: 'USPP', label: 'USPP / Bangunan' },
]

const KELAS_OPTIONS = ['7', '8', '9', '10', '11', '12']

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

  const handleStudentSearchChange = (val: string) => {
    setStudentSearch(val)
    if (!val.trim()) {
      setStudentOptions([])
    }
  }

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
    if (!confirm(`Migrasikan seluruh data pembebasan SPP legacy (${legacySppCount} data) ke sistem pembebasan baru secara aman dan idempoten?`)) {
      return
    }
    setIsMigratingLegacy(true)
    const toastId = toast.loading('Memigrasikan data pembebasan SPP legacy...')
    const res = await migrateLegacySppExemptionsAction()
    setIsMigratingLegacy(false)
    toast.dismiss(toastId)
    if (res.success && res.result) {
      toast.success(`Migrasi selesai: ${res.result.migratedCount} baru, ${res.result.alreadyMigratedCount} sudah ada, ${res.result.obligationsUpdated} kewajiban diperbarui.`)
      onRefresh()
    } else {
      toast.error(res.error || 'Gagal memigrasikan pembebasan SPP legacy.')
    }
  }

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (targetScope === 'INDIVIDUAL' && !selectedStudent) {
      toast.error('Santri penerima beasiswa/pembebasan wajib dipilih.')
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
    const toastId = toast.loading('Menyimpan aturan pembebasan biaya...')

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
        `Pembebasan biaya untuk ${targetLabel} berhasil diterapkan: ${res.result.exemptionsCreated} santri baru dibebaskan, ${res.result.obligationsUpdated} kewajiban diperbarui.`
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
    const toastId = toast.loading('Mencabut pembebasan biaya...')

    const res = await revokeExemptionAction(revokeTarget.id, revokeReason.trim())

    setIsRevoking(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Pembebasan untuk "${revokeTarget.santri_nama}" berhasil dicabut (${res.restoredCount || 0} tagihan dipulihkan).`)
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
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Cari Santri / Alasan</label>
            <div className="relative">
              <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama, NIS, atau alasan..."
                className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="w-40">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'REVOKED')}
              className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="REVOKED">Dicabut (Revoked)</option>
            </select>
          </div>

          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Item Pembebasan</label>
            <select
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Item</option>
              {ITEM_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canMutate && legacySppCount > 0 && (
            <button
              type="button"
              onClick={handleMigrateLegacySpp}
              disabled={isMigratingLegacy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              title={`Migrasikan ${legacySppCount} santri bebas SPP dari data legacy`}
            >
              <Lightning className="w-3.5 h-3.5 text-amber-600" weight="fill" />
              <span>Sinkron SPP Legacy ({legacySppCount})</span>
            </button>
          )}

          {canMutate ? (
            <button
              onClick={handleOpenGrantModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" weight="bold" />
              Buat Pembebasan
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Info className="w-4 h-4 text-slate-400" />
              Mode Lihat Saja (Pimpinan)
            </div>
          )}
        </div>
      </div>

      {/* Info Banner: Non-retroaktif */}
      <div className="flex items-start gap-3 p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-800">
        <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" weight="bold" />
        <div>
          <span className="font-semibold">Ketentuan Pemberlakuan Pembebasan Biaya:</span> Pembebasan biaya hanya membebaskan sisa kewajiban yang belum dibayar. Transaksi pembayaran yang sudah sukses tercatat di masa lalu <span className="font-semibold">tidak diubah atau di-void secara otomatis</span>. Saat pembebasan dicabut (REVOKED), sisa tagihan yang belum terbayar dipulihkan secara akurat tanpa menghapus jejak histori.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Santri Penerima</th>
                <th className="px-4 py-3">Item Pembebasan</th>
                <th className="px-4 py-3">Tahun & Periode</th>
                <th className="px-4 py-3">Alasan & Catatan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Diberikan Pada</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredExemptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Belum ada data pembebasan biaya yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredExemptions.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{e.santri_nama}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        NIS: {e.santri_nis} {e.santri_asrama ? `• ${e.santri_asrama}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {e.item_type === 'ALL' ? 'Semua Item (ALL)' : e.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                      <div>{e.academic_year_nama || 'Semua Tahun'}</div>
                      <div className="text-slate-400">
                        {e.period_start || e.period_end ? (
                          <>
                            {e.period_start || 'Awal'} s.d. {e.period_end || 'Akhir'}
                          </>
                        ) : (
                          'Sepanjang Waktu'
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-medium text-slate-800">{e.reason}</div>
                      {e.notes && <div className="text-[11px] text-slate-400 truncate">{e.notes}</div>}
                      {e.status === 'REVOKED' && (
                        <div className="mt-1 text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                          Dicabut: {e.revocation_reason || 'Tanpa alasan'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {e.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" weight="fill" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                          <XCircle className="w-3.5 h-3.5 text-slate-400" weight="fill" />
                          Dicabut
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px] font-mono">
                      {e.created_at ? e.created_at.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {canMutate && e.status === 'ACTIVE' ? (
                        <button
                          onClick={() => {
                            setRevokeTarget(e)
                            setRevokeReason('')
                          }}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                        >
                          Cabut
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Berikan Pembebasan */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Berikan Pembebasan Biaya Santri
              </h3>
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGrantSubmit} className="p-5 space-y-4">
              {/* Target Scope Switcher */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sasaran Pembebasan <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetScope('INDIVIDUAL')
                      setPreviewData(null)
                    }}
                    className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold border transition-all ${
                      targetScope === 'INDIVIDUAL'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" weight={targetScope === 'INDIVIDUAL' ? 'bold' : 'regular'} />
                    <span>Santri Perorangan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetScope('KELAS')
                      setPreviewData(null)
                    }}
                    className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold border transition-all ${
                      targetScope === 'KELAS'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UsersThree className="w-3.5 h-3.5" weight={targetScope === 'KELAS' ? 'bold' : 'regular'} />
                    <span>Rombongan / Kelas</span>
                  </button>
                </div>
              </div>

              {/* Santri Picker or Kelas Picker */}
              {targetScope === 'INDIVIDUAL' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Santri Penerima <span className="text-red-500">*</span>
                  </label>
                  {selectedStudent ? (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                      <div>
                        <span className="font-semibold text-emerald-900">{selectedStudent.nama_lengkap}</span>
                        <span className="text-emerald-700 ml-2 font-mono">NIS: {selectedStudent.nis}</span>
                        {selectedStudent.asrama && (
                          <span className="text-emerald-600 ml-2 font-mono">({selectedStudent.asrama})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null)
                          setPreviewData(null)
                        }}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => handleStudentSearchChange(e.target.value)}
                          placeholder="Ketik nama atau NIS santri aktif..."
                          className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      {studentOptions.length > 0 && (
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white shadow-xs">
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
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                            >
                              <span className="font-medium text-slate-800">{s.nama_lengkap}</span>
                              <span className="text-[11px] text-slate-400 font-mono">NIS: {s.nis}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => {
                      setSelectedKelas(e.target.value)
                      setPreviewData(null)
                    }}
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {KELAS_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        Kelas {k} (Seluruh Rombel / Cabang Kelas {k})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Pembayaran</label>
                  <select
                    value={itemType}
                    onChange={(e) => {
                      setItemType(e.target.value as FinanceItemType | 'ALL')
                      setPreviewData(null)
                    }}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {ITEM_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                  <select
                    value={academicYearId}
                    onChange={(e) => {
                      setAcademicYearId(e.target.value)
                      setPreviewData(null)
                    }}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="">Semua / Sepanjang Waktu</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={String(y.id)}>
                        {y.nama} {y.is_active ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periode Mulai (YYYY-MM)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2026-07"
                    value={periodStart}
                    onChange={(e) => {
                      setPeriodStart(e.target.value)
                      setPreviewData(null)
                    }}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periode Selesai (YYYY-MM)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2027-06"
                    value={periodEnd}
                    onChange={(e) => {
                      setPeriodEnd(e.target.value)
                      setPreviewData(null)
                    }}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Pembebasan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beasiswa Tahfidz 30 Juz / Yatim Piatu"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Nomor SK Beasiswa, memo persetujuan, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Preview Trigger & Card */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || (targetScope === 'INDIVIDUAL' && !selectedStudent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Eye className={`w-3.5 h-3.5 ${isPreviewing ? 'animate-spin' : ''}`} />
                  <span>{isPreviewing ? 'Menghitung...' : 'Pratinjau Dampak (Preview)'}</span>
                </button>

                {previewData && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-100">
                    <div className="font-semibold text-slate-800 flex items-center justify-between">
                      <span>Sasaran: {previewData.targetLabel}</span>
                      <span className="text-[11px] text-slate-500 font-normal">Total {previewData.totalStudents} santri</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-500">Sudah Bebas: </span>
                        <span className="font-semibold text-slate-700 font-mono">{previewData.alreadyExemptedCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Belum Lunas: </span>
                        <span className="font-semibold text-amber-700 font-mono">{previewData.unpaidCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Sudah Lunas (Aman): </span>
                        <span className="font-semibold text-emerald-700 font-mono">{previewData.alreadyPaidCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Sebagian Lunas: </span>
                        <span className="font-semibold text-sky-700 font-mono">{previewData.partiallyPaidCount}</span>
                      </div>
                    </div>
                    {previewData.partiallyPaidCount > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                        ⚠️ <strong>Perhatian:</strong> Terdapat {previewData.partiallyPaidCount} tagihan cicilan sebagian (sudah dibayar: Rp {new Intl.NumberFormat('id-ID').format(previewData.partiallyPaidAmount || 0)}, sisa: Rp {new Intl.NumberFormat('id-ID').format(previewData.partiallyRemainingAmount || 0)}). Tagihan ini <strong>dikecualikan secara aman</strong> dari pembebasan otomatis (Review Diperlukan).
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
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
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembebasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Revoke Pembebasan */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ArrowCounterClockwise className="w-4 h-4 text-rose-600" />
                Cabut Pembebasan Biaya
              </h3>
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRevokeSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Santri:</span>{' '}
                  <span className="font-semibold text-slate-800">{revokeTarget.santri_nama}</span>
                </div>
                <div>
                  <span className="text-slate-500">Item:</span>{' '}
                  <span className="font-medium text-slate-800">{revokeTarget.item_type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Alasan Sebelumnya:</span>{' '}
                  <span className="text-slate-700">{revokeTarget.reason}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Pencabutan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Contoh: Santri mengundurkan diri dari program beasiswa / masa berlaku program beasiswa telah berakhir..."
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-rose-50/70 border border-rose-100 p-2.5 rounded-lg">
                Status akan diubah menjadi <span className="font-semibold text-rose-700">REVOKED</span>. Sisa kewajiban santri yang belum dibayar akan kembali ditagihkan secara otomatis.
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  disabled={isRevoking}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRevoking}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isRevoking ? 'Memproses...' : 'Konfirmasi Cabut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
