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
  Layers,
  RefreshCw,
  KeyRound,
} from 'lucide-react'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import Pagination from '@/components/ui/pagination'
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import {
  RowActionItem,
  RowActionMenu,
  RowActionSeparator,
} from '@/components/ui/dropdown-menu'
import { CardPrintSheet } from './card-print-sheet'
import { PinSlipPrintSheet, type PinSlipItem } from './pin-slip-print-sheet'
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
  getBulkIssuanceCandidatesAction,
  issueCardBatchChunkAction,
  recoverStudentPinsBatchChunkAction,
  type StudentCredentialRow,
  type KredensialResponse,
  type KredensialQueryParams,
  type CardPrintItem,
  type BulkCandidateScope,
  type BulkCandidatesSummary,
} from './actions'


interface KredensialContentProps {
  initialData: KredensialResponse
}

export default function KredensialContent({ initialData }: KredensialContentProps) {
  const [data, setData] = useState<KredensialResponse>(initialData)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAsrama, setSelectedAsrama] = useState<string>('ALL')
  const [selectedCardStatus, setSelectedCardStatus] = useState<string>('ALL')
  const [selectedPinStatus, setSelectedPinStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)

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

  // Bulk Issuance Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkScopeType, setBulkScopeType] = useState<BulkCandidateScope['type']>('ALL_UNISSUED')
  const [bulkAsrama, setBulkAsrama] = useState<string>('ALL')
  const [bulkSummary, setBulkSummary] = useState<BulkCandidatesSummary | null>(null)
  const [isLoadingBulkSummary, setIsLoadingBulkSummary] = useState(false)
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({
    total: 0,
    completed: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    currentChunk: 0,
    totalChunks: 0,
  })
  const [bulkGeneratedSlips, setBulkGeneratedSlips] = useState<PinSlipItem[]>([])
  const [bulkNewlyIssuedCardIds, setBulkNewlyIssuedCardIds] = useState<string[]>([])
  const [bulkIssuedPinNotRetrievable, setBulkIssuedPinNotRetrievable] = useState<
    Array<{ santriId: string; namaLengkap: string; nis: string; asrama: string | null; kamar: string | null }>
  >([])
  const [isRecoveringPins, setIsRecoveringPins] = useState(false)
  const [bulkCompleted, setBulkCompleted] = useState(false)
  const [isShowingPinSlipSheet, setIsShowingPinSlipSheet] = useState(false)


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

  // Print Single Card
  const handlePrintSingleCard = async (santriId: string) => {
    setIsLoadingPrint(true)
    try {
      const cards = await getCardsForBatchPrint([santriId])
      if (cards.length === 0) {
        alert('Data kartu santri aktif tidak ditemukan.')
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

  // Open Bulk Modal & Load Candidates
  const fetchBulkCandidates = async (scopeType: BulkCandidateScope['type'], asramaValue: string) => {
    setIsLoadingBulkSummary(true)
    try {
      const summary = await getBulkIssuanceCandidatesAction({
        type: scopeType,
        asrama: asramaValue !== 'ALL' ? asramaValue : undefined,
        search: searchQuery.trim() || undefined,
        santriIds: scopeType === 'SELECTED_IDS' ? Array.from(selectedSantriIds) : undefined,
      })
      setBulkSummary(summary)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghitung target penerbitan.')
    } finally {
      setIsLoadingBulkSummary(false)
    }
  }

  const handleOpenBulkModal = () => {
    setIsBulkModalOpen(true)
    setBulkCompleted(false)
    setBulkGeneratedSlips([])
    setBulkNewlyIssuedCardIds([])
    setBulkIssuedPinNotRetrievable([])
    setBulkProgress({
      total: 0,
      completed: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      currentChunk: 0,
      totalChunks: 0,
    })
    fetchBulkCandidates(bulkScopeType, bulkAsrama)
  }

  const handleScopeChange = (type: BulkCandidateScope['type'], asramaVal: string = bulkAsrama) => {
    setBulkScopeType(type)
    setBulkAsrama(asramaVal)
    fetchBulkCandidates(type, asramaVal)
  }

  // Execute Bulk Issuance sequentially in chunks of 50
  const handleStartBulkIssuance = async () => {
    if (!bulkSummary || bulkSummary.candidateIds.length === 0) return
    setIsProcessingBulk(true)
    setBulkCompleted(false)

    const targetIds = bulkSummary.candidateIds
    const chunkSize = 50
    const totalChunks = Math.ceil(targetIds.length / chunkSize)

    let completed = 0
    let success = 0
    let skipped = bulkSummary.alreadyActiveCount
    let failed = 0
    const newSlips: PinSlipItem[] = []
    const newCards: string[] = []
    const notRetrievable: Array<{ santriId: string; namaLengkap: string; nis: string; asrama: string | null; kamar: string | null }> = []

    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize)
      const currentChunkIndex = Math.floor(i / chunkSize) + 1

      setBulkProgress({
        total: targetIds.length,
        completed,
        success,
        skipped,
        failed,
        currentChunk: currentChunkIndex,
        totalChunks,
      })

      try {
        const res = await issueCardBatchChunkAction(chunk)
        completed += chunk.length
        success += res.successCount
        skipped += res.skippedCount + (res.issuedPinNotRetrievableCount || 0)
        failed += res.failedCount

        res.items.forEach((item) => {
          if (item.status === 'SUCCESS') {
            newCards.push(item.santriId)
            if (item.initialPin) {
              newSlips.push({
                santriId: item.santriId,
                namaLengkap: item.namaLengkap,
                nis: item.nis,
                asrama: item.asrama,
                kamar: item.kamar,
                initialPin: item.initialPin,
              })
            }
          } else if (item.status === 'ISSUED_PIN_NOT_RETRIEVABLE') {
            notRetrievable.push({
              santriId: item.santriId,
              namaLengkap: item.namaLengkap,
              nis: item.nis,
              asrama: item.asrama,
              kamar: item.kamar,
            })
          }
        })
      } catch {
        completed += chunk.length
        failed += chunk.length
      }

      setBulkProgress({
        total: targetIds.length,
        completed,
        success,
        skipped,
        failed,
        currentChunk: currentChunkIndex,
        totalChunks,
      })
    }

    setBulkGeneratedSlips(newSlips)
    setBulkNewlyIssuedCardIds(newCards)
    setBulkIssuedPinNotRetrievable(notRetrievable)
    setIsProcessingBulk(false)
    setBulkCompleted(true)
    fetchData()
  }

  // Recovery PIN Santri Terdampak (Response Lost / Retry)
  const handleRecoverAffectedPins = async () => {
    if (bulkIssuedPinNotRetrievable.length === 0) return
    const count = bulkIssuedPinNotRetrievable.length
    if (
      !window.confirm(
        `Reset PIN dan buat PIN baru untuk ${count} santri yang kartu aktifnya tidak dapat menampilkan PIN awal? PIN baru akan otomatis ditambahkan ke Lembar Cetak PIN.`
      )
    ) {
      return
    }

    setIsRecoveringPins(true)
    try {
      const targetIds = bulkIssuedPinNotRetrievable.map((s) => s.santriId)
      const chunkSize = 50
      const addedSlips: PinSlipItem[] = []

      for (let i = 0; i < targetIds.length; i += chunkSize) {
        const chunk = targetIds.slice(i, i + chunkSize)
        const res = await recoverStudentPinsBatchChunkAction(chunk)
        res.items.forEach((item) => {
          if (item.status === 'SUCCESS' && item.newPin) {
            addedSlips.push({
              santriId: item.santriId,
              namaLengkap: item.namaLengkap,
              nis: item.nis,
              asrama: item.asrama,
              kamar: item.kamar,
              initialPin: item.newPin,
            })
          }
        })
      }

      setBulkGeneratedSlips((prev) => [...prev, ...addedSlips])
      setBulkIssuedPinNotRetrievable([])
      setSuccessMessage(
        `Berhasil me-reset dan membuat ${addedSlips.length} PIN baru. Silakan cetak Lembar PIN sekarang.`
      )
      fetchData()
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal melakukan recovery PIN santri.')
    } finally {
      setIsRecoveringPins(false)
    }
  }


  const handlePrintNewlyIssuedCards = async () => {
    if (bulkNewlyIssuedCardIds.length === 0) return
    setIsLoadingPrint(true)
    try {
      const cards = await getCardsForBatchPrint(bulkNewlyIssuedCardIds)
      setPrintItems(cards)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memuat kartu untuk dicetak.')
    } finally {
      setIsLoadingPrint(false)
    }
  }

  // Hanya kartu ACTIVE yang dapat dicetak (selaras dengan filter di getCardsForBatchPrint).
  const selectableInPageIds = data.items
    .filter((row) => row.cardStatus === 'ACTIVE')
    .map((row) => row.id)
  const selectedInPageCount = selectableInPageIds.filter((id) =>
    selectedSantriIds.has(id)
  ).length
  const isAllSelectableInPageSelected =
    selectableInPageIds.length > 0 && selectedInPageCount === selectableInPageIds.length

  const formatIssuedAt = (value: string | null) => {
    if (!value) return '-'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
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

      {/* Toolbar: Filter + Aksi Utama */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
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

        {/* Baris aksi: seleksi cetak + aksi massal (satu tempat, tidak lagi dipisah per tab) */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 text-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllInPage}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-indigo-600"
            >
              <CheckSquare className="h-4 w-4" />
              Pilih Semua Kartu Aktif di Halaman Ini
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {selectedSantriIds.size > 0
                ? `${selectedSantriIds.size} kartu terpilih untuk dicetak`
                : 'Pilih kartu aktif pada kolom Pilih untuk mencetak'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStartBatchPrint}
              disabled={isLoadingPrint || selectedSantriIds.size === 0}
              title={
                selectedSantriIds.size === 0
                  ? 'Pilih minimal satu kartu aktif terlebih dahulu.'
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {isLoadingPrint
                ? 'Menyiapkan...'
                : `Pratinjau & Cetak Kartu${selectedSantriIds.size > 0 ? ` (${selectedSantriIds.size})` : ''}`}
            </button>

            {data.userPermissions.canMutate && (
              <button
                type="button"
                onClick={handleOpenBulkModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 font-bold text-emerald-700 shadow-xs transition-colors hover:bg-emerald-100"
              >
                <Layers className="h-4 w-4" />
                <span>Terbitkan Kartu Massal</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={8} cols={7} />
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {hasActiveFilters ? 'Tidak ada santri yang cocok' : 'Belum ada data santri'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {hasActiveFilters
                ? 'Kriteria pencarian atau filter yang Anda gunakan tidak menghasilkan data. Coba longgarkan filter.'
                : 'Belum ada data santri aktif yang dapat ditampilkan pada modul kredensial.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center">
                    <span className="sr-only">Pilih untuk dicetak</span>
                    <input
                      type="checkbox"
                      aria-label="Pilih semua kartu aktif di halaman ini"
                      checked={isAllSelectableInPageSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            selectedInPageCount > 0 && !isAllSelectableInPageSelected
                        }
                      }}
                      onChange={toggleSelectAllInPage}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-5 py-3.5 text-left">Santri</th>
                  <th className="px-5 py-3.5 text-left">Status Kartu</th>
                  <th className="px-5 py-3.5 text-left">Token QR</th>
                  <th className="px-5 py-3.5 text-left">Status PIN</th>
                  <th className="px-5 py-3.5 text-left">Diterbitkan</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((row) => {
                  const isSelected = selectedSantriIds.has(row.id)
                  const hasActiveCard = row.cardStatus === 'ACTIVE'
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3.5 text-center">
                        {hasActiveCard ? (
                          <input
                            type="checkbox"
                            aria-label={`Pilih kartu ${row.namaLengkap} untuk dicetak`}
                            checked={isSelected}
                            onChange={() => toggleSelectSantri(row.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs" title="Hanya kartu aktif yang dapat dicetak">
                            -
                          </span>
                        )}
                      </td>

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

                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {row.cardIssuedAt ? (
                          formatIssuedAt(row.cardIssuedAt)
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right text-xs">
                        {data.userPermissions.canMutate ? (
                          <div className="flex items-center justify-end">
                            <RowActionMenu label={`Aksi kredensial untuk ${row.namaLengkap}`}>
                              <RowActionItem
                                icon={<CreditCard />}
                                onSelect={() => {
                                  setIssueModalSantri(row)
                                  setIssueReason(
                                    row.cardStatus === 'ACTIVE' ? 'Penggantian kartu santri' : ''
                                  )
                                }}
                              >
                                {row.cardStatus === 'ACTIVE' ? 'Ganti Kartu' : 'Terbitkan Kartu'}
                              </RowActionItem>

                              <RowActionItem
                                icon={<KeyRound />}
                                onSelect={() => {
                                  setPinModalSantri(row)
                                  setPinInput('')
                                  setPinReason(
                                    row.hasPin
                                      ? 'Reset PIN oleh admin/koperasi'
                                      : 'Inisialisasi PIN santri'
                                  )
                                }}
                              >
                                {row.hasPin ? 'Reset PIN' : 'Buat PIN'}
                              </RowActionItem>

                              {hasActiveCard && (
                                <>
                                  <RowActionItem
                                    icon={<Printer />}
                                    disabled={isLoadingPrint}
                                    onSelect={() => handlePrintSingleCard(row.id)}
                                  >
                                    Cetak Kartu
                                  </RowActionItem>
                                  <RowActionSeparator />
                                  <RowActionItem
                                    icon={<AlertCircle />}
                                    tone="warning"
                                    onSelect={() => handleReportLost(row)}
                                  >
                                    Lapor Kartu Hilang
                                  </RowActionItem>
                                  <RowActionItem
                                    icon={<Ban />}
                                    tone="danger"
                                    onSelect={() => handleBlockCard(row)}
                                  >
                                    Blokir Kartu
                                  </RowActionItem>
                                </>
                              )}

                              {row.cardStatus === 'BLOCKED' && (
                                <>
                                  <RowActionSeparator />
                                  <RowActionItem
                                    icon={<CheckCircle2 />}
                                    tone="success"
                                    onSelect={() => handleUnblockCard(row)}
                                  >
                                    Buka Blokir Kartu
                                  </RowActionItem>
                                </>
                              )}

                              {row.isPinLocked && (
                                <>
                                  <RowActionSeparator />
                                  <RowActionItem
                                    icon={<Unlock />}
                                    tone="warning"
                                    onSelect={() => handleUnlockPin(row)}
                                  >
                                    Buka Kunci PIN
                                  </RowActionItem>
                                </>
                              )}
                            </RowActionMenu>
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

      {/* Modal Penerbitan Kartu Massal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => !isProcessingBulk && setIsBulkModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Penerbitan Kartu &amp; PIN Santri Massal
                </h3>
              </div>
              {!isProcessingBulk && (
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {!bulkCompleted ? (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Menerbitkan kartu fisik santri secara berurutan dalam batch aman (50 santri/chunk). Santri yang belum memiliki PIN akan otomatis dibuatkan <span className="font-semibold text-slate-800">PIN acak 6-digit unik</span> (hash PBKDF2), sedangkan santri yang sudah memiliki PIN akan tetap dipertahankan.
                </p>

                {/* Scope Selection */}
                {!isProcessingBulk && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                    <label className="font-bold text-slate-800 block">Pilih Cakupan Penerbitan:</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScopeType === 'ALL_UNISSUED'}
                          onChange={() => handleScopeChange('ALL_UNISSUED')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-700 font-medium">
                          Semua santri aktif yang belum memiliki kartu ACTIVE
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScopeType === 'BY_ASRAMA'}
                          onChange={() => handleScopeChange('BY_ASRAMA')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-700 font-medium">Per Asrama tertentu</span>
                      </label>

                      {bulkScopeType === 'BY_ASRAMA' && (
                        <div className="pl-6 pt-1">
                          <select
                            value={bulkAsrama}
                            onChange={(e) => handleScopeChange('BY_ASRAMA', e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                          >
                            <option value="ALL">Pilih Asrama</option>
                            {data.asramaList.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {hasActiveFilters && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bulkScope"
                            checked={bulkScopeType === 'FILTERED'}
                            onChange={() => handleScopeChange('FILTERED')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-slate-700 font-medium">
                            Santri sesuai filter &amp; pencarian tabel saat ini
                          </span>
                        </label>
                      )}

                      {selectedSantriIds.size > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bulkScope"
                            checked={bulkScopeType === 'SELECTED_IDS'}
                            onChange={() => handleScopeChange('SELECTED_IDS')}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-slate-700 font-medium">
                            Santri yang dipilih di tabel ({selectedSantriIds.size} santri)
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Candidate Summary Breakdown */}
                {isLoadingBulkSummary ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
                    <span className="animate-spin inline-block mr-2">⏳</span>
                    Menghitung data target santri...
                  </div>
                ) : bulkSummary ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-slate-500 text-[10px] font-semibold uppercase">Target Total</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                        {bulkSummary.totalCandidates.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="text-emerald-700 text-[10px] font-semibold uppercase">Siap Diterbitkan</div>
                      <div className="text-base font-bold text-emerald-800 mt-0.5 font-mono">
                        {bulkSummary.eligibleCount.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-slate-500 text-[10px] font-semibold uppercase">Sudah Aktif (Skip)</div>
                      <div className="text-base font-bold text-slate-600 mt-0.5 font-mono">
                        {bulkSummary.alreadyActiveCount.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Progress Bar & Status */}
                {isProcessingBulk && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>
                        Memproses chunk {bulkProgress.currentChunk} dari {bulkProgress.totalChunks}...
                      </span>
                      <span className="font-mono">
                        {bulkProgress.total > 0
                          ? Math.min(100, Math.round((bulkProgress.completed / bulkProgress.total) * 100))
                          : 0}
                        %
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            bulkProgress.total > 0
                              ? Math.min(100, Math.round((bulkProgress.completed / bulkProgress.total) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                      <span>Selesai: {bulkProgress.completed} santri</span>
                      <span className="text-emerald-700 font-semibold">Berhasil: {bulkProgress.success}</span>
                      {bulkProgress.skipped > 0 && <span>Dilewati: {bulkProgress.skipped}</span>}
                      {bulkProgress.failed > 0 && <span className="text-rose-600 font-semibold">Gagal: {bulkProgress.failed}</span>}
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isProcessingBulk}
                    onClick={() => setIsBulkModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingBulk || !bulkSummary || bulkSummary.eligibleCount === 0}
                    onClick={handleStartBulkIssuance}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Layers className="h-4 w-4" />
                    <span>
                      {isProcessingBulk
                        ? 'Sedang Menerbitkan...'
                        : `Mulai Terbitkan (${bulkSummary?.eligibleCount || 0} Santri)`}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Completed Screen */
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold text-sm">Penerbitan Kartu Massal Selesai</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Sistem telah selesai memproses seluruh antrean kartu santri tanpa duplikasi kartu aktif.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
                    <div className="bg-white/80 rounded p-1.5 border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">Kartu Terbit</div>
                      <div className="font-bold text-slate-900 text-sm">{bulkProgress.success}</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5 border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">PIN Dibuat</div>
                      <div className="font-bold text-slate-900 text-sm">{bulkGeneratedSlips.length}</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5 border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">Dilewati</div>
                      <div className="font-bold text-slate-900 text-sm">{bulkProgress.skipped}</div>
                    </div>
                    <div className="bg-white/80 rounded p-1.5 border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-sans">Gagal</div>
                      <div className="font-bold text-slate-900 text-sm">{bulkProgress.failed}</div>
                    </div>
                  </div>
                </div>

                {bulkIssuedPinNotRetrievable.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-950 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-900">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>{bulkIssuedPinNotRetrievable.length} Santri Memiliki Kartu Aktif tetapi PIN Tidak Dapat Ditampilkan</span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      <strong>Kartu sudah diterbitkan, tetapi PIN awal tidak dapat ditampilkan kembali. Reset PIN untuk membuat PIN baru.</strong>
                      <br />
                      Hal ini terjadi jika sesi penerbitan terputus atau diulang saat PIN awal sudah tersimpan di database.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={isRecoveringPins}
                        onClick={handleRecoverAffectedPins}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRecoveringPins ? 'animate-spin' : ''}`} />
                        <span>
                          {isRecoveringPins
                            ? 'Mereset PIN...'
                            : `Reset PIN Santri Terdampak (${bulkIssuedPinNotRetrievable.length} Santri)`}
                        </span>
                      </button>
                      <span className="text-[11px] text-rose-700 font-medium">
                        * PIN baru akan otomatis ditambahkan ke Lembar Cetak PIN di bawah.
                      </span>
                    </div>
                  </div>
                )}

                {bulkGeneratedSlips.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 text-xs flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">One-Time Plaintext PIN:</span> Ditemukan {bulkGeneratedSlips.length} santri yang memiliki PIN awal siap didistribusikan. Cetak lembar slip PIN sekarang sebelum menutup modal ini. Setelah modal ditutup, plaintext PIN tidak dapat diakses kembali.
                    </div>
                  </div>
                )}


                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {bulkGeneratedSlips.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsShowingPinSlipSheet(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 font-semibold shadow-xs transition-colors text-xs"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Cetak Lembar PIN ({bulkGeneratedSlips.length})</span>
                      </button>
                    )}

                    {bulkNewlyIssuedCardIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePrintNewlyIssuedCards}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 font-semibold shadow-xs transition-colors text-xs"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Cetak Kartu ({bulkNewlyIssuedCardIds.length})</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkModalOpen(false)
                      setBulkCompleted(false)
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-xs"
                  >
                    Selesai &amp; Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN Slip Print Sheet */}
      {isShowingPinSlipSheet && bulkGeneratedSlips.length > 0 && (
        <PinSlipPrintSheet
          slips={bulkGeneratedSlips}
          onClose={() => setIsShowingPinSlipSheet(false)}
        />
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
