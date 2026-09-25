'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Printer,
  Wallet,
  Banknote,
  Loader2,
  Check,
} from 'lucide-react'
import DocumentLetterhead from '@/components/print/document-letterhead'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import {
  searchStudentsForPayment,
  getUnpaidObligationsForCashPayment,
  recordCashPayment,
  getCurrentCashSessionInfo,
  openCashSessionAction,
  type StudentSearchResultItem,
  type PayableObligationItem,
  type RecordCashPaymentResult,
} from './actions'

interface CatatPembayaranModalProps {
  isOpen: boolean
  initialSantriId?: string | null
  onClose: () => void
  onSuccess: () => void
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

interface ActiveStudentInfo {
  id: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
}

interface ActiveCashSessionInfo {
  id: string
  sessionCode: string
  openingBalance: number
  totalCashIn: number
  expectedClosingBalance: number
}

export function CatatPembayaranModal({
  isOpen,
  initialSantriId,
  onClose,
  onSuccess,
}: CatatPembayaranModalProps) {
  // Cash session state (PRD #23 & Fase 4C)
  const [cashSession, setCashSession] = useState<ActiveCashSessionInfo | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('')
  const [openingNotesInput, setOpeningNotesInput] = useState<string>('')
  const [sessionActionError, setSessionActionError] = useState<string | null>(null)

  // Modal View Stages:
  // 'SELECT_STUDENT' -> 'SELECT_ITEMS' -> 'CONFIRM' -> 'RECEIPT'
  const [stage, setStage] = useState<'SELECT_STUDENT' | 'SELECT_ITEMS' | 'CONFIRM' | 'RECEIPT'>('SELECT_STUDENT')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StudentSearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Selected student state
  const [selectedStudent, setSelectedStudent] = useState<ActiveStudentInfo | null>(null)
  const [obligations, setObligations] = useState<PayableObligationItem[]>([])
  const [isLoadingObligations, setIsLoadingObligations] = useState(false)

  // Item selections & amounts: { [obligationId]: { selected: boolean; amount: number } }
  const [itemSelections, setItemSelections] = useState<Record<string, { selected: boolean; amount: number }>>({})

  // Submission & Result state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [receiptResult, setReceiptResult] = useState<RecordCashPaymentResult | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string>('')

  // Generate new idempotency token when opening or selecting student
  const resetForm = () => {
    setStage('SELECT_STUDENT')
    setSearchQuery('')
    setSearchResults([])
    setSelectedStudent(null)
    setObligations([])
    setItemSelections({})
    setErrorMessage(null)
    setSessionActionError(null)
    setReceiptResult(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isOpeningSession) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, isOpeningSession, onClose])

  // Initialize modal state on open or initialSantriId change
  useEffect(() => {
    if (!isOpen) {
      resetForm()
      return
    }

    const initToken = crypto.randomUUID()
    setIdempotencyKey(initToken)
    setErrorMessage(null)
    setReceiptResult(null)
    setSessionActionError(null)

    // Cek keberadaan sesi kas aktif milik operator
    setIsLoadingSession(true)
    getCurrentCashSessionInfo()
      .then((session) => {
        setCashSession(session)
      })
      .catch((err) => {
        console.error('Gagal memeriksa status sesi kas:', err)
      })
      .finally(() => {
        setIsLoadingSession(false)
      })

    if (initialSantriId) {
      setIsLoadingObligations(true)
      setStage('SELECT_ITEMS')
      getUnpaidObligationsForCashPayment(initialSantriId)
        .then((res) => {
          setSelectedStudent({
            id: res.santri.id,
            nis: res.santri.nis,
            namaLengkap: res.santri.namaLengkap,
            fotoUrl: res.santri.fotoUrl,
            asrama: res.santri.asrama,
            kamar: res.santri.kamar,
          })
          setObligations(res.obligations)
          // Default: select all unpaid items with their full remaining amounts
          const initMap: Record<string, { selected: boolean; amount: number }> = {}
          for (const ob of res.obligations) {
            initMap[ob.id] = { selected: true, amount: ob.remaining }
          }
          setItemSelections(initMap)
        })
        .catch((err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat kewajiban santri.')
          setStage('SELECT_STUDENT')
        })
        .finally(() => {
          setIsLoadingObligations(false)
        })
    } else {
      setStage('SELECT_STUDENT')
      setSelectedStudent(null)
      setObligations([])
      setItemSelections({})
    }
  }, [isOpen, initialSantriId])

  // Realtime search with debounce
  useEffect(() => {
    if (stage !== 'SELECT_STUDENT' || !isOpen) return
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchStudentsForPayment(trimmed)
        setSearchResults(results)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery, stage, isOpen])

  // Handle student selected from list
  const handleSelectStudent = async (student: StudentSearchResultItem) => {
    setSelectedStudent(student)
    setErrorMessage(null)
    setIsLoadingObligations(true)
    setStage('SELECT_ITEMS')

    try {
      const res = await getUnpaidObligationsForCashPayment(student.id)
      // Sinkronkan identitas (termasuk foto) dari data otoritatif server
      setSelectedStudent({
        id: res.santri.id,
        nis: res.santri.nis,
        namaLengkap: res.santri.namaLengkap,
        fotoUrl: res.santri.fotoUrl,
        asrama: res.santri.asrama,
        kamar: res.santri.kamar,
      })
      setObligations(res.obligations)
      const initMap: Record<string, { selected: boolean; amount: number }> = {}
      for (const ob of res.obligations) {
        initMap[ob.id] = { selected: true, amount: ob.remaining }
      }
      setItemSelections(initMap)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memuat kewajiban santri.')
    } finally {
      setIsLoadingObligations(false)
    }
  }

  // Toggle item selection
  const handleToggleItem = (obId: string) => {
    setItemSelections((prev) => {
      const current = prev[obId]
      const ob = obligations.find((o) => o.id === obId)
      if (!current) {
        return { ...prev, [obId]: { selected: true, amount: ob?.remaining || 0 } }
      }
      return {
        ...prev,
        [obId]: {
          selected: !current.selected,
          amount: current.amount > 0 ? current.amount : ob?.remaining || 0,
        },
      }
    })
  }

  // Change amount for an item
  const handleAmountChange = (obId: string, val: number) => {
    const ob = obligations.find((o) => o.id === obId)
    if (!ob) return
    const clamped = Math.max(0, Math.min(val, ob.remaining))
    setItemSelections((prev) => ({
      ...prev,
      [obId]: {
        selected: prev[obId]?.selected ?? true,
        amount: clamped,
      },
    }))
  }

  // Toggle select all
  const areAllSelected = obligations.length > 0 && obligations.every((ob) => itemSelections[ob.id]?.selected)
  const handleToggleSelectAll = () => {
    const nextVal = !areAllSelected
    const nextMap: Record<string, { selected: boolean; amount: number }> = {}
    for (const ob of obligations) {
      nextMap[ob.id] = {
        selected: nextVal,
        amount: itemSelections[ob.id]?.amount || ob.remaining,
      }
    }
    setItemSelections(nextMap)
  }

  // Calculations
  const selectedItemsList = obligations
    .filter((ob) => itemSelections[ob.id]?.selected)
    .map((ob) => ({
      ...ob,
      payAmount: itemSelections[ob.id]?.amount || 0,
    }))

  const totalPaymentAmount = selectedItemsList.reduce((acc, it) => acc + it.payAmount, 0)

  // Validation before proceed to confirmation
  const validateItems = (): string | null => {
    if (selectedItemsList.length === 0) {
      return 'Pilih minimal satu pos kewajiban yang akan dibayarkan.'
    }
    for (const it of selectedItemsList) {
      if (it.payAmount <= 0) {
        return `Nominal untuk pos ${it.itemLabel} harus lebih besar dari Rp0.`
      }
      if (it.payAmount > it.remaining) {
        return `Nominal untuk pos ${it.itemLabel} melebihi sisa tagihan (${formatRupiah(it.remaining)}).`
      }
      if (it.installmentRule === 'DISALLOWED' && it.payAmount !== it.remaining) {
        return `Pos ${it.itemLabel} tidak dapat dicicil parsial. Wajib lunas penuh sebesar ${formatRupiah(it.remaining)}.`
      }
    }
    return null
  }

  const handleProceedToConfirm = () => {
    const err = validateItems()
    if (err) {
      setErrorMessage(err)
      return
    }
    setErrorMessage(null)
    setStage('CONFIRM')
  }

  // Submit cash payment
  const handleExecutePayment = async () => {
    if (!selectedStudent) return
    const err = validateItems()
    if (err) {
      setErrorMessage(err)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const itemsPayload = selectedItemsList.map((it) => ({
        obligationId: it.id,
        amount: it.payAmount,
      }))

      const res = await recordCashPayment({
        santriId: selectedStudent.id,
        items: itemsPayload,
        idempotencyKey,
      })

      setReceiptResult(res)
      setStage('RECEIPT')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pembayaran tunai.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Finish and refresh
  const handleFinish = () => {
    onSuccess()
    onClose()
  }

  // Print receipt
  const handlePrint = () => {
    window.print()
  }

  // Open Cash Session handler (PRD #23 & Fase 4C)
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setSessionActionError(null)

    const rawNum = openingBalanceInput.replace(/\D/g, '')
    const num = rawNum === '' ? 0 : parseInt(rawNum, 10)
    if (isNaN(num) || num < 0) {
      setSessionActionError('Saldo kas fisik awal harus berupa angka valid non-negatif.')
      return
    }

    setIsOpeningSession(true)
    try {
      const created = await openCashSessionAction(num, openingNotesInput.trim() || undefined)
      setCashSession({
        ...created,
        totalCashIn: 0,
      })
      setOpeningBalanceInput('')
      setOpeningNotesInput('')
    } catch (err: unknown) {
      setSessionActionError(err instanceof Error ? err.message : 'Gagal membuka sesi kas baru.')
    } finally {
      setIsOpeningSession(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
        onClick={() => {
          if (!isSubmitting && !isOpeningSession) onClose()
        }}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {!cashSession && !isLoadingSession
                    ? 'Buka Sesi Kas Operasional'
                    : stage === 'RECEIPT'
                    ? 'Bukti Pembayaran Tunai'
                    : 'Catat Pembayaran Tunai'}
                </h3>
                {cashSession && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-[11px] font-mono font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {cashSession.sessionCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {!cashSession && !isLoadingSession
                  ? 'Input saldo kas fisik awal (float) sebelum menerima pembayaran'
                  : stage === 'RECEIPT'
                  ? 'Transaksi berhasil dicatat dan masuk ke sistem keuangan'
                  : 'Pencatatan pembayaran tunai langsung di loket pesantren'}
              </p>
            </div>
          </div>
          {stage !== 'RECEIPT' && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isOpeningSession}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Tutup dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoadingSession ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <span className="text-xs font-medium text-slate-500">Memeriksa status sesi kas loket...</span>
            </div>
          ) : !cashSession ? (
            /* Form Buka Sesi Kas (PRD #23 & Fase 4C) */
            <form onSubmit={handleOpenSession} className="space-y-5">
              {sessionActionError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold block mb-0.5">Gagal Membuka Sesi:</span>
                    <span>{sessionActionError}</span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Sesi Kas Aktif Belum Tersedia
                </div>
                <p className="leading-relaxed text-slate-600">
                  Sesuai standar operasional dan rekonsiliasi kas pesantren, setiap penerimaan tunai wajib tercatat dalam sesi kas aktif. Masukkan saldo kas fisik awal (uang kembalian / kas float) yang ada di laci loket saat ini.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <div>
                  <label htmlFor="opening-balance-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Saldo Kas Fisik Awal (Opening Float) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">
                      Rp
                    </span>
                    <input
                      id="opening-balance-input"
                      type="text"
                      inputMode="numeric"
                      value={openingBalanceInput ? parseInt(openingBalanceInput, 10).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '')
                        setOpeningBalanceInput(clean)
                      }}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Isi Rp0 jika loket dimulai tanpa uang kas fisik awal.
                  </p>
                </div>

                <div>
                  <label htmlFor="opening-notes-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Catatan Pembukaan (Opsional)
                  </label>
                  <input
                    id="opening-notes-input"
                    type="text"
                    value={openingNotesInput}
                    onChange={(e) => setOpeningNotesInput(e.target.value)}
                    placeholder="Contoh: Sesi Loket Pagi / Kas Awal Bendahara"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isOpeningSession}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOpeningSession}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isOpeningSession ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Membuka Sesi Kas...</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="h-4 w-4" />
                      <span>Buka Sesi Kas & Lanjutkan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Error Banner */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold block mb-0.5">Peringatan:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

          {/* ─────────────────────────────────────────────────────────────
              STAGE 1: SELECT STUDENT (Autocomplete Search)
             ───────────────────────────────────────────────────────────── */}
          {stage === 'SELECT_STUDENT' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="student-search-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Cari Santri
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="student-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik Nama Lengkap atau NIS santri..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    autoFocus
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Search Results List */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400 block">
                  {searchQuery.trim() ? `Hasil Pencarian (${searchResults.length})` : 'Masukkan kata kunci untuk mencari'}
                </span>

                {searchResults.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    {searchResults.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStudent(st)}
                        className="w-full text-left p-3.5 hover:bg-emerald-50/50 flex items-center justify-between transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <SantriPhotoAvatar
                            src={st.fotoUrl}
                            alt={st.namaLengkap}
                            name={st.namaLengkap}
                            size="sm"
                            clickable={false}
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{st.namaLengkap}</p>
                            <p className="text-xs text-slate-500">
                              NIS: {st.nis} · {st.asrama || 'Non-Asrama'}{st.kamar ? ` / ${st.kamar}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.trim() && !isSearching ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    Tidak ditemukan santri aktif dengan kata kunci &quot;{searchQuery}&quot;.
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STAGE 2: SELECT ITEMS & AMOUNTS
             ───────────────────────────────────────────────────────────── */}
          {stage === 'SELECT_ITEMS' && (
            <div className="space-y-5">
              {/* Santri Banner */}
              {selectedStudent && (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <SantriPhotoAvatar
                      src={selectedStudent.fotoUrl}
                      alt={selectedStudent.namaLengkap}
                      name={selectedStudent.namaLengkap}
                      size="sm"
                      clickable={false}
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{selectedStudent.namaLengkap}</p>
                      <p className="text-xs text-slate-500">
                        NIS: {selectedStudent.nis} · {selectedStudent.asrama || 'Non-Asrama'}{selectedStudent.kamar ? ` / ${selectedStudent.kamar}` : ''}
                      </p>
                    </div>
                  </div>
                  {!initialSantriId && (
                    <button
                      type="button"
                      onClick={() => setStage('SELECT_STUDENT')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-200/60 transition cursor-pointer"
                    >
                      Ganti Santri
                    </button>
                  )}
                </div>
              )}

              {/* Obligations Loading / Empty / List */}
              {isLoadingObligations ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Memuat tagihan aktif santri...</span>
                </div>
              ) : obligations.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">Semua Kewajiban Lunas</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Santri ini tidak memiliki kewajiban aktif yang belum terbayar pada sistem keuangan baru.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wider text-slate-500">
                      Pilih Pos Tagihan ({obligations.length} Tersedia)
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                    >
                      {areAllSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {obligations.map((ob) => {
                      const sel = itemSelections[ob.id]?.selected ?? false
                      const currentAmount = itemSelections[ob.id]?.amount ?? ob.remaining
                      const isDisallowed = ob.installmentRule === 'DISALLOWED'

                      return (
                        <div
                          key={ob.id}
                          className={`p-3.5 rounded-xl border transition ${
                            sel
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-white opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                id={`check-${ob.id}`}
                                checked={sel}
                                onChange={() => handleToggleItem(ob.id)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div>
                                <label
                                  htmlFor={`check-${ob.id}`}
                                  className="text-sm font-bold text-slate-900 block cursor-pointer"
                                >
                                  {ob.itemLabel}
                                  <span className="ml-2 text-xs font-normal text-slate-500">
                                    ({ob.period})
                                  </span>
                                </label>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>Tagihan: {formatRupiah(ob.amountExpected - ob.amountExempted)}</span>
                                  {ob.amountPaid > 0 && (
                                    <span>· Sudah Bayar: {formatRupiah(ob.amountPaid)}</span>
                                  )}
                                  <span className="font-medium text-amber-700">
                                    · Sisa: {formatRupiah(ob.remaining)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Badge Cicilan */}
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                                isDisallowed
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              }`}
                            >
                              {isDisallowed ? 'Wajib Lunas Penuh' : 'Dapat Dicicil'}
                            </span>
                          </div>

                          {/* Nominal Input Field (hanya jika terpilih) */}
                          {sel && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-600 font-medium">
                                Nominal Dibayar:
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500">Rp</span>
                                <input
                                  type="number"
                                  disabled={isDisallowed}
                                  value={currentAmount}
                                  onChange={(e) =>
                                    handleAmountChange(ob.id, parseInt(e.target.value || '0', 10))
                                  }
                                  min={1}
                                  max={ob.remaining}
                                  className={`w-32 px-2.5 py-1 text-right font-mono font-bold text-sm rounded-lg border transition ${
                                    isDisallowed
                                      ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                                      : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500'
                                  }`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Summary Bar */}
                  <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Total Pembayaran Tunai</span>
                      <span className="text-xs text-slate-300 font-medium">
                        {selectedItemsList.length} Pos Kewajiban Dipilih
                      </span>
                    </div>
                    <span className="text-xl font-mono font-bold text-emerald-400">
                      {formatRupiah(totalPaymentAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STAGE 3: CONFIRMATION PROMPT
             ───────────────────────────────────────────────────────────── */}
          {stage === 'CONFIRM' && selectedStudent && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Konfirmasi Penerimaan Uang Fisik
                </div>
                <p className="leading-relaxed">
                  Pastikan uang tunai sebesar{' '}
                  <strong className="font-mono text-emerald-800 text-sm">
                    {formatRupiah(totalPaymentAmount)}
                  </strong>{' '}
                  telah diterima secara fisik dari santri / wali santri di loket sebelum menekan tombol
                  konfirmasi.
                </p>
              </div>

              {/* Rincian Ringkas */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Santri:</span>
                  <span className="font-bold text-slate-900">
                    {selectedStudent.namaLengkap} ({selectedStudent.nis})
                  </span>
                </div>
                {cashSession && (
                  <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Sesi Kas Loket:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {cashSession.sessionCode}
                    </span>
                  </div>
                )}
                <div className="space-y-1.5 text-xs">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">
                    Alokasi Pos:
                  </span>
                  {selectedItemsList.map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-slate-700">
                      <span>
                        {it.itemLabel}{' '}
                        <span className="text-slate-400 text-[11px]">({it.period})</span>
                      </span>
                      <span className="font-mono font-medium text-slate-900">
                        {formatRupiah(it.payAmount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900">Total Tagihan Tunai:</span>
                  <span className="font-mono text-emerald-700">{formatRupiah(totalPaymentAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STAGE 4: RECEIPT (Bukti Bayar Tunai)
             ───────────────────────────────────────────────────────────── */}
          {stage === 'RECEIPT' && receiptResult && (
            <div className="space-y-4">
              {/* Screen-only Success Alert */}
              <div className="print:hidden flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Pembayaran Tunai Berhasil Dicatat!</span>
                  <span>
                    Kewajiban santri telah diperbarui secara otomatis di sistem keuangan.
                  </span>
                </div>
              </div>

              {/* Printable Cash Receipt Document */}
              <div
                id="printable-cash-receipt"
                className="p-6 border border-slate-300 rounded-2xl bg-white text-slate-900 space-y-4 shadow-sm font-sans"
              >
                {/* Receipt Header */}
                <div>
                  <DocumentLetterhead />
                  <div className="flex justify-between items-center -mt-2 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Bukti Pembayaran Tunai (Kuitansi)
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase rounded">
                        LUNAS - TUNAI
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-800">
                        {receiptResult.paymentNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Receipt Metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Data Santri
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {receiptResult.santri.namaLengkap}
                    </p>
                    <p className="text-slate-600">NIS: {receiptResult.santri.nis}</p>
                    <p className="text-slate-500 text-[11px]">
                      {receiptResult.santri.asrama || 'Non-Asrama'}
                      {receiptResult.santri.kamar ? ` / ${receiptResult.santri.kamar}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Waktu & Kasir
                    </span>
                    <p className="font-medium text-slate-800">
                      {formatDateDisplay(receiptResult.paidAt)}
                    </p>
                    <p className="text-slate-600">Petugas: {receiptResult.receivedByName}</p>
                    {receiptResult.sessionCode && (
                      <p className="text-emerald-700 font-mono text-[11px] font-semibold">
                        Sesi: {receiptResult.sessionCode}
                      </p>
                    )}
                    <p className="text-slate-400 text-[11px]">
                      Order: {receiptResult.orderNumber}
                    </p>
                  </div>
                </div>

                {/* Receipt Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-left font-semibold">Pos Tagihan</th>
                        <th className="py-2 px-3 text-right font-semibold">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiptResult.allocations.map((alc) => (
                        <tr key={alc.id}>
                          <td className="py-2 px-3 text-slate-800">{alc.itemLabel}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                            {formatRupiah(alc.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t-2 border-slate-300 font-bold">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-900">Total Diterima (Tunai)</td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800">
                          {formatRupiah(receiptResult.grossAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Receipt Footer */}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-end text-[10px] text-slate-400">
                  <p>Bukti sah pembayaran tunai sistem keuangan pondok pesantren.</p>
                  <p className="font-mono">Dicetak: {formatDateDisplay(new Date().toISOString())}</p>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        {cashSession && !isLoadingSession && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            {stage === 'SELECT_STUDENT' && (
              <>
                <span className="text-xs text-slate-400">Langkah 1 dari 3: Pilih Santri</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  Batal
                </button>
              </>
            )}

            {stage === 'SELECT_ITEMS' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (initialSantriId) {
                      onClose()
                    } else {
                      setStage('SELECT_STUDENT')
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  {initialSantriId ? 'Batal' : 'Kembali'}
                </button>
                <button
                  type="button"
                  onClick={handleProceedToConfirm}
                  disabled={obligations.length === 0 || selectedItemsList.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                >
                  <span>Lanjut Konfirmasi ({formatRupiah(totalPaymentAmount)})</span>
                </button>
              </>
            )}

            {stage === 'CONFIRM' && (
              <>
                <button
                  type="button"
                  onClick={() => setStage('SELECT_ITEMS')}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  Kembali Edit
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayment}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyimpan Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Konfirmasi Terima Uang Tunai</span>
                    </>
                  )}
                </button>
              </>
            )}

            {stage === 'RECEIPT' && (
              <div className="w-full flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>Cetak Bukti</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                >
                  Selesai & Perbarui Data
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
