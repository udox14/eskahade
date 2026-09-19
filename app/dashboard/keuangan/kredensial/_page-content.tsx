'use client'

import React, { useState, useTransition, useId } from 'react'
import {
  Search,
  RotateCcw,
  AlertCircle,
  CreditCard,
  Printer,
  ShieldCheck,
  Lock,
  Unlock,
  Ban,
  CheckCircle2,
  X,
  CheckSquare,
  Square,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import Pagination from '@/components/ui/pagination'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import { CardPrintSheet } from './card-print-sheet'
import {
  getKredensialData,
  issueCardAction,
  reportLostCardAction,
  blockCardAction,
  unblockCardAction,
  setPinAction,
  resetPinAction,
  unlockPinAction,
  getCardsForBatchPrint,
  type StudentCredentialRow,
  type KredensialResponse,
  type KredensialQueryParams,
  type CardPrintItem,
} from './actions'

interface KredensialContentProps {
  initialData: KredensialResponse
}

type TabType = 'LIST' | 'BATCH_PRINT'

export default function KredensialContent({ initialData }: KredensialContentProps) {
  const [data, setData] = useState<KredensialResponse>(initialData)
  const [activeTab, setActiveTab] = useState<TabType>('LIST')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedCardStatus, setSelectedCardStatus] = useState<string>('ALL')
  const [selectedPinStatus, setSelectedPinStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  // Batch Print Selection
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(new Set())
  const [printItems, setPrintItems] = useState<CardPrintItem[] | null>(null)
  const [isLoadingPrint, setIsLoadingPrint] = useState(false)

  // PIN Modal State
  const [pinModalSantri, setPinModalSantri] = useState<StudentCredentialRow | null>(null)
  const [pinInput, setPinInput] = useState<string>('')
  const [pinReason, setPinReason] = useState<string>('')
  const [isSavingPin, setIsSavingPin] = useState(false)

  // Card Issue Modal State
  const [issueModalSantri, setIssueModalSantri] = useState<StudentCredentialRow | null>(null)
  const [issueReason, setIssueReason] = useState<string>('')
  const [isIssuingCard, setIsIssuingCard] = useState(false)

  const searchInputId = useId()
  const asramaSelectId = useId()
  const cardSelectId = useId()
  const pinSelectId = useId()

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAsrama !== 'ALL' ||
    selectedCardStatus !== 'ALL' ||
    selectedPinStatus !== 'ALL'

  const fetchData = (overrides?: {
    search?: string
    asrama?: string
    cardStatus?: string
    pinStatus?: string
    page?: number
    size?: number
  }) => {
    const search = overrides?.search !== undefined ? overrides.search : searchQuery
    const asrama = overrides?.asrama !== undefined ? overrides.asrama : selectedAsrama
    const cardStatus = (overrides?.cardStatus !== undefined ? overrides.cardStatus : selectedCardStatus) as KredensialQueryParams['cardStatusFilter']
    const pinStatus = (overrides?.pinStatus !== undefined ? overrides.pinStatus : selectedPinStatus) as KredensialQueryParams['pinStatusFilter']
    const page = overrides?.page !== undefined ? overrides.page : currentPage
    const size = overrides?.size !== undefined ? overrides.size : pageSize

    startTransition(async () => {
      try {
        const res = await getKredensialData({
          search,
          asrama,
          cardStatusFilter: cardStatus,
          pinStatusFilter: pinStatus,
          page,
          pageSize: size,
        })
        setData(res)
        setErrorMessage(null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data kredensial.'
        setErrorMessage(msg)
      }
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData({ page: 1 })
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedAsrama('ALL')
    setSelectedCardStatus('ALL')
    setSelectedPinStatus('ALL')
    setCurrentPage(1)
    fetchData({
      search: '',
      asrama: 'ALL',
      cardStatus: 'ALL',
      pinStatus: 'ALL',
      page: 1,
    })
  }

  // Issue / Replace Card
  const handleConfirmIssueCard = async () => {
    if (!issueModalSantri || !data.userPermissions.canMutate) return
    setIsIssuingCard(true)
    try {
      await issueCardAction(issueModalSantri.id, issueReason || undefined)
      setIssueModalSantri(null)
      setIssueReason('')
      setSuccessMessage(`Kartu baru untuk ${issueModalSantri.namaLengkap} berhasil diterbitkan.`)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menerbitkan kartu.')
    } finally {
      setIsIssuingCard(false)
    }
  }

  // Toggle Selection for Batch Print
  const toggleSelectSantri = (id: string) => {
    const next = new Set(selectedSantriIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedSantriIds(next)
  }

  const toggleSelectAllInPage = () => {
    const allInPage = data.items.filter(r => r.cardStatus === 'ACTIVE').map(r => r.id)
    const isAllSelected = allInPage.every(id => selectedSantriIds.has(id))
    const next = new Set(selectedSantriIds)
    if (isAllSelected) {
      allInPage.forEach(id => next.delete(id))
    } else {
      allInPage.forEach(id => next.add(id))
    }
    setSelectedSantriIds(next)
  }

  // Start Batch Print
  const handleStartBatchPrint = async () => {
    setIsLoadingPrint(true)
    try {
      const ids = selectedSantriIds.size > 0 ? Array.from(selectedSantriIds) : undefined
      const asrama = selectedAsrama !== 'ALL' ? selectedAsrama : undefined
      const cards = await getCardsForBatchPrint(ids, asrama)
      if (cards.length === 0) {
        alert('Tidak ada kartu santri aktif yang dipilih untuk dicetak.')
        return
      }
      setPrintItems(cards)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyiapkan data cetak kartu.')
    } finally {
      setIsLoadingPrint(false)
    }
  }

  // Save PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinModalSantri || !data.userPermissions.canMutate) return
    if (!/^\d{6}$/.test(pinInput.trim())) {
      alert('PIN harus terdiri dari tepat 6 digit angka numerik.')
      return
    }
    setIsSavingPin(true)
    try {
      if (pinModalSantri.hasPin) {
        await resetPinAction(
          pinModalSantri.id,
          pinInput.trim(),
          pinReason || undefined
        )
      } else {
        await setPinAction(
          pinModalSantri.id,
          pinInput.trim(),
          false,
          pinReason || undefined
        )
      }
      const isReset = pinModalSantri.hasPin
      const studentName = pinModalSantri.namaLengkap
      setPinModalSantri(null)
      setPinInput('')
      setPinReason('')
      setSuccessMessage(
        isReset
          ? `PIN santri ${studentName} berhasil di-reset.`
          : `PIN santri ${studentName} berhasil disimpan.`
      )
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan PIN.')
    } finally {
      setIsSavingPin(false)
    }
  }

  // Unlock PIN
  const handleUnlockPin = async (row: StudentCredentialRow) => {
    if (!data.userPermissions.canMutate) return
    if (!confirm(`Buka kunci PIN untuk santri ${row.namaLengkap}?`)) return
    try {
      await unlockPinAction(row.id, 'Buka kunci oleh petugas')
      setSuccessMessage(`Kunci PIN untuk ${row.namaLengkap} telah dibuka.`)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membuka kunci PIN.')
    }
  }

  // Report Lost Card
  const handleReportLost = async (row: StudentCredentialRow) => {
    if (!row.cardId || !data.userPermissions.canMutate) return
    const reason = prompt(`Alasan pelaporan kartu hilang untuk santri ${row.namaLengkap}:`, 'Kartu hilang')
    if (reason === null) return
    try {
      await reportLostCardAction(row.cardId, reason || 'Kartu hilang')
      setSuccessMessage(`Kartu ${row.namaLengkap} ditandai hilang (LOST).`)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal melaporkan kartu hilang.')
    }
  }

  // Block Card
  const handleBlockCard = async (row: StudentCredentialRow) => {
    if (!row.cardId || !data.userPermissions.canMutate) return
    const reason = prompt(`Alasan pemblokiran kartu ${row.namaLengkap}:`, 'Pelanggaran / kartu ditahan')
    if (reason === null) return
    try {
      await blockCardAction(row.cardId, reason || 'Kartu diblokir')
      setSuccessMessage(`Kartu ${row.namaLengkap} berhasil diblokir.`)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memblokir kartu.')
    }
  }

  // Unblock Card
  const handleUnblockCard = async (row: StudentCredentialRow) => {
    if (!row.cardId || !data.userPermissions.canMutate) return
    if (!confirm(`Buka blokir kartu santri ${row.namaLengkap}?`)) return
    try {
      await unblockCardAction(row.cardId)
      setSuccessMessage(`Blokir kartu ${row.namaLengkap} berhasil dibuka.`)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membuka blokir kartu.')
    }
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Kredensial Kartu & PIN"
        description="Manajemen kartu fisik QR santri, otorisasi keamanan PIN, dan batch printing ATM-style."
      />

      {/* Alerts */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 text-xs">
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Operasi Berhasil</p>
            <p className="text-xs text-emerald-700 mt-0.5">{successMessage}</p>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 text-xs">
            Tutup
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isPending ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Santri Aktif</span>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {data.kpi.totalSantriAktif.toLocaleString('id-ID')}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Total santri aktif terdaftar</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Kartu Aktif</span>
              <div className="mt-2 text-xl font-bold text-emerald-700">
                {data.kpi.totalKartuAktif.toLocaleString('id-ID')}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Tepat 1 aktif per santri</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Kartu Dilaporkan Hilang</span>
              <div className="mt-2 text-xl font-bold text-amber-700">
                {data.kpi.totalKartuHilang.toLocaleString('id-ID')}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Kredensial lama dinonaktifkan</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500">PIN Terkunci</span>
              <div className="mt-2 text-xl font-bold text-rose-700">
                {data.kpi.totalPinTerkunci.toLocaleString('id-ID')}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Lockout 15 menit (&ge;3 salah)</p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('LIST')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
            activeTab === 'LIST'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Daftar Kartu &amp; Santri
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('BATCH_PRINT')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
            activeTab === 'BATCH_PRINT'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="h-4 w-4" />
          Cetak Kartu (Batch Print)
          {selectedSantriIds.size > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
              {selectedSantriIds.size}
            </span>
          )}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              placeholder="Cari santri berdasarkan nama lengkap atau NIS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id={asramaSelectId}
              value={selectedAsrama}
              onChange={(e) => {
                setSelectedAsrama(e.target.value)
                setCurrentPage(1)
                fetchData({ asrama: e.target.value, page: 1 })
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Semua Asrama</option>
              {data.asramaList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              id={cardSelectId}
              value={selectedCardStatus}
              onChange={(e) => {
                setSelectedCardStatus(e.target.value)
                setCurrentPage(1)
                fetchData({ cardStatus: e.target.value, page: 1 })
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Semua Status Kartu</option>
              <option value="ACTIVE">Kartu Aktif</option>
              <option value="NONE">Belum Ada Kartu</option>
              <option value="LOST">Hilang (LOST)</option>
              <option value="BLOCKED">Terblokir (BLOCKED)</option>
              <option value="REVOKED">Dicabut (REVOKED)</option>
            </select>

            <select
              id={pinSelectId}
              value={selectedPinStatus}
              onChange={(e) => {
                setSelectedPinStatus(e.target.value)
                setCurrentPage(1)
                fetchData({ pinStatus: e.target.value, page: 1 })
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">Semua Status PIN</option>
              <option value="HAS_PIN">Sudah Buat PIN</option>
              <option value="NO_PIN">Belum Buat PIN</option>
              <option value="LOCKED">PIN Terkunci</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              Terapkan
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </form>

        {activeTab === 'BATCH_PRINT' && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllInPage}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-indigo-600"
              >
                <CheckSquare className="h-4 w-4" />
                Pilih Semua Kartu Aktif di Halaman Ini
              </button>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">
                {selectedSantriIds.size} kartu terpilih
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartBatchPrint}
              disabled={isLoadingPrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              {isLoadingPrint ? 'Menyiapkan...' : `Pratinjau & Cetak Kartu (${selectedSantriIds.size || 'Semua Filter'})`}
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={8} cols={5} />
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Tidak ada data santri yang cocok dengan filter pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  {activeTab === 'BATCH_PRINT' && (
                    <th className="px-3 py-3.5 text-center w-10">Pilih</th>
                  )}
                  <th className="px-5 py-3.5 text-left">Santri</th>
                  <th className="px-5 py-3.5 text-left">Status Kartu</th>
                  <th className="px-5 py-3.5 text-left">Token QR</th>
                  <th className="px-5 py-3.5 text-left">Status PIN</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((row) => {
                  const isSelected = selectedSantriIds.has(row.id)
                  const hasActiveCard = row.cardStatus === 'ACTIVE'
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      {activeTab === 'BATCH_PRINT' && (
                        <td className="px-3 py-3.5 text-center">
                          {hasActiveCard ? (
                            <button
                              type="button"
                              onClick={() => toggleSelectSantri(row.id)}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      )}

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar
                            src={row.fotoUrl}
                            name={row.namaLengkap}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {row.namaLengkap}
                            </div>
                            <div className="text-xs text-slate-500">
                              NIS: {row.nis}
                              {row.asrama && <> • {row.asrama}</>}
                              {row.kamar && <> / Kamar {row.kamar}</>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        {row.cardStatus === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            Kartu Aktif
                          </span>
                        ) : row.cardStatus === 'LOST' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 border border-amber-200">
                            <AlertCircle className="h-3 w-3" />
                            Hilang (LOST)
                          </span>
                        ) : row.cardStatus === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 font-bold text-rose-700 border border-rose-200">
                            <Ban className="h-3 w-3" />
                            Terblokir (BLOCKED)
                          </span>
                        ) : row.cardStatus === 'REVOKED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                            Dicabut (REVOKED)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 font-medium text-slate-400 border border-slate-200">
                            Belum Ada Kartu
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-xs font-mono text-slate-600">
                        {row.cardToken ? (
                          <span title={row.cardToken}>
                            ••••{row.cardToken.slice(-8)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        {row.isPinLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 font-bold text-rose-700 border border-rose-200">
                            <Lock className="h-3 w-3" />
                            Terkunci (15m)
                          </span>
                        ) : row.hasPin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            PIN Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-500">
                            Belum Dibuat
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center text-xs">
                        {data.userPermissions.canMutate ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setIssueModalSantri(row)
                                setIssueReason(row.cardStatus === 'ACTIVE' ? 'Penggantian kartu santri' : '')
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                            >
                              {row.cardStatus === 'ACTIVE' ? 'Ganti Kartu' : 'Terbitkan Kartu'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPinModalSantri(row)
                                setPinInput('')
                                setPinReason(row.hasPin ? 'Reset PIN oleh admin/koperasi' : 'Inisialisasi PIN santri')
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                            >
                              {row.hasPin ? 'Reset PIN' : 'Buat PIN'}
                            </button>

                            {row.cardStatus === 'ACTIVE' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReportLost(row)}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 transition"
                                  title="Lapor Kartu Hilang"
                                >
                                  Hilang
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBlockCard(row)}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-semibold text-rose-800 hover:bg-rose-100 transition"
                                  title="Blokir Kartu"
                                >
                                  Blokir
                                </button>
                              </>
                            )}

                            {row.cardStatus === 'BLOCKED' && (
                              <button
                                type="button"
                                onClick={() => handleUnblockCard(row)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                                title="Buka Blokir Kartu"
                              >
                                Buka Blokir
                              </button>
                            )}

                            {row.isPinLocked && (
                              <button
                                type="button"
                                onClick={() => handleUnlockPin(row)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100 transition"
                                title="Buka Kunci PIN"
                              >
                                <Unlock className="h-3 w-3" />
                                Buka Kunci
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">View Only</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination.totalPages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <Pagination
              currentPage={data.pagination.currentPage}
              totalPages={data.pagination.totalPages}
              pageSize={data.pagination.pageSize}
              total={data.pagination.totalItems}
              onPageChange={(page) => {
                setCurrentPage(page)
                fetchData({ page })
              }}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
                fetchData({ size, page: 1 })
              }}
            />
          </div>
        )}
      </div>

      {/* Modal Terbitkan / Ganti Kartu */}
      {issueModalSantri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setIssueModalSantri(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {issueModalSantri.cardStatus === 'ACTIVE' ? 'Ganti Kartu Fisik Santri' : 'Terbitkan Kartu Santri Baru'}
              </h3>
              <button type="button" onClick={() => setIssueModalSantri(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Menerbitkan kartu fisik untuk <strong>{issueModalSantri.namaLengkap}</strong> (NIS: {issueModalSantri.nis}).
              </p>

              {issueModalSantri.cardStatus === 'ACTIVE' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <p className="font-bold">Perhatian: Aturan Tepat Satu Kartu Aktif</p>
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Kartu aktif sebelumnya akan otomatis <strong>DICABUT (REVOKED)</strong> secara atomik. Riwayat transaksi masa lalu tetap utuh.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Penerbitan / Penggantian
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kartu baru tahun ajaran baru, atau kartu lama patah"
                  value={issueReason}
                  onChange={(e) => setIssueReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIssueModalSantri(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIssueCard}
                  disabled={isIssuingCard}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isIssuingCard ? 'Memproses...' : 'Terbitkan Kartu Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buat / Reset PIN */}
      {pinModalSantri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setPinModalSantri(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {pinModalSantri.hasPin ? 'Reset PIN Santri' : 'Buat PIN Baru Santri'}
              </h3>
              <button type="button" onClick={() => setPinModalSantri(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Santri: <strong>{pinModalSantri.namaLengkap}</strong> (NIS: {pinModalSantri.nis}).
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  PIN Baru (Wajib Tepat 6 Digit Angka)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Contoh: 123456"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full font-mono text-center tracking-widest text-lg font-bold rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  PIN di-hash menggunakan PBKDF2 Web Crypto API (100.000 iterasi). Tidak disimpan plaintext.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Pembuatan / Reset PIN
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Permintaan santri lupa PIN"
                  value={pinReason}
                  onChange={(e) => setPinReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinModalSantri(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || pinInput.length !== 6}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSavingPin ? 'Menyimpan...' : 'Simpan PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Print Preview Sheet */}
      {printItems && (
        <CardPrintSheet
          cards={printItems}
          onClose={() => setPrintItems(null)}
        />
      )}
    </div>
  )
}
