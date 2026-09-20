'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Clock } from 'lucide-react'
import PosHeader from './pos-header'
import PosCardScanner from './pos-card-scanner'
import PosStudentCard from './pos-student-card'
import PosPinPad from './pos-pin-pad'
import PosActionPanel from './pos-action-panel'
import PosReceiptModal from './pos-receipt-modal'
import PosPinModal from './pos-pin-modal'
import CashSessionModal from './cash-session-modal'

import SessionHistoryDrawer from './session-history-drawer'
import {
  openLoketCashSession,
  closeLoketCashSession,
  lookupStudentForLoket,
  verifyStudentLoketPin,
  getStudentLoketAccountData,
  executeLoketWithdrawal,
  executeLoketDepositOrPayment,
  getLoketInitialData,
  type StudentLoketProfile,
  type StudentLoketFinancials,
  type LoketWithdrawalReceipt,
  type LoketPaymentReceipt,
  type LoketPaymentItemInput,
} from './actions'
import type { FinanceCashSession, CashSessionTransactionSummary } from '@/lib/finance/cash-session'

interface LoketContentProps {
  initialData: {
    activeSession: FinanceCashSession | null
    summary: CashSessionTransactionSummary | null
    isViewOnly: boolean
    operator: { id: string; name: string; roles: string[] }
  }
}

export default function LoketContent({ initialData }: LoketContentProps) {
  const [activeSession, setActiveSession] = useState<FinanceCashSession | null>(
    initialData.activeSession
  )
  const [summary, setSummary] = useState<CashSessionTransactionSummary | null>(
    initialData.summary
  )
  const isViewOnly = initialData.isViewOnly
  const operator = initialData.operator

  // Modal Sesi Kas
  const [sessionModalMode, setSessionModalMode] = useState<'OPEN' | 'CLOSE' | null>(null)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)

  // State Santri & Transaksi Kasir
  const [isSearchingStudent, setIsSearchingStudent] = useState(false)
  const [currentStudent, setCurrentStudent] = useState<StudentLoketProfile | null>(null)
  const [financials, setFinancials] = useState<StudentLoketFinancials | null>(null)

  // PIN Pad & Pin Management state
  const [isPinPadOpen, setIsPinPadOpen] = useState(false)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [verificationToken, setVerificationToken] = useState<string | null>(null)


  // Receipt Modal state
  const [receipt, setReceipt] = useState<LoketWithdrawalReceipt | LoketPaymentReceipt | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmittingTx, setIsSubmittingTx] = useState(false)

  // Refresh Sesi Kas
  const refreshSessionData = async () => {
    try {
      const fresh = await getLoketInitialData()
      setActiveSession(fresh.activeSession)
      setSummary(fresh.summary)
    } catch (err) {
      console.error('Gagal merefresh sesi kas:', err)
    }
  }

  // 1. Handler Pemindaian / Pencarian Santri
  const handleScanOrSearch = async (identifier: string) => {
    setIsSearchingStudent(true)
    try {
      const profile = await lookupStudentForLoket(identifier)
      if (!profile) {
        toast.error(`Santri dengan token atau NIS "${identifier}" tidak ditemukan.`)
        return
      }

      setCurrentStudent(profile)
      setIsPinVerified(false)
      setVerificationToken(null)
      setFinancials(null)

      // Cek status keaktifan santri dan kartu
      if (profile.statusGlobal !== 'aktif') {
        toast.warning(`Santri ${profile.namaLengkap} berstatus "${profile.statusGlobal}".`)
      }

      if (profile.card && profile.card.status !== 'ACTIVE') {
        toast.error(`Kartu fisik santri tidak aktif (${profile.card.status}).`)
      }

      // Jika kartu aktif dan memiliki PIN, langsung buka pinpad untuk kelancaran kasir
      if (profile.card?.status === 'ACTIVE' && profile.pinStatus.hasPin && !profile.pinStatus.isLocked) {
        setIsPinPadOpen(true)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearchingStudent(false)
    }
  }

  // 2. Handler Verifikasi PIN
  const handleVerifyPin = async (inputPin: string) => {
    if (!currentStudent) {
      return { verified: false, attemptsLeft: 0, locked: false }
    }

    const res = await verifyStudentLoketPin(currentStudent.id, inputPin)

    if (res.verified && res.verificationToken) {
      setIsPinVerified(true)
      setVerificationToken(res.verificationToken)
      toast.success('PIN santri terverifikasi.')

      // Ambil data finansial santri
      try {
        const fin = await getStudentLoketAccountData(currentStudent.id)
        setFinancials(fin)
      } catch {
        toast.error('Gagal memuat saldo dan tagihan santri.')
      }
    }

    return res
  }

  // 2.1 Handler Callback Sukses Ubah / Reset PIN Santri
  const handlePinModalSuccess = async () => {
    if (!currentStudent) return
    try {
      const refreshed = await lookupStudentForLoket(currentStudent.nis || currentStudent.id)
      if (refreshed) {
        setCurrentStudent(refreshed)
      }
    } catch (err) {
      console.error('Gagal merefresh status santri:', err)
    }
  }

  // 3. Handler Eksekusi Penarikan Uang Jajan

  const handleWithdrawal = async (amount: number, notes?: string) => {
    if (!currentStudent || !verificationToken) {
      toast.error('Verifikasi PIN santri terlebih dahulu.')
      return
    }
    if (!activeSession) {
      toast.error('Buka sesi kas terlebih dahulu.')
      return
    }

    setIsSubmittingTx(true)
    try {
      const idempotencyKey = `WD-${currentStudent.id}-${Date.now()}`
      const rec = await executeLoketWithdrawal({
        santriId: currentStudent.id,
        amount,
        verificationToken,
        idempotencyKey,
        notes,
      })

      setReceipt(rec)
      setIsReceiptOpen(true)
      toast.success(`Penarikan Rp${amount.toLocaleString('id-ID')} berhasil.`)

      // Refresh data sesi kas & saldo santri
      await refreshSessionData()
      const fin = await getStudentLoketAccountData(currentStudent.id)
      setFinancials(fin)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmittingTx(false)
    }
  }

  // 4. Handler Eksekusi Setor / Bayar Tagihan
  const handleDepositOrPay = async (items: LoketPaymentItemInput[], notes?: string) => {
    if (!currentStudent) return
    if (!activeSession) {
      toast.error('Buka sesi kas terlebih dahulu.')
      return
    }

    setIsSubmittingTx(true)
    try {
      const idempotencyKey = `PAY-${currentStudent.id}-${Date.now()}`
      const rec = await executeLoketDepositOrPayment({
        santriId: currentStudent.id,
        items,
        idempotencyKey,
        notes,
      })

      setReceipt(rec)
      setIsReceiptOpen(true)
      toast.success(`Penerimaan pembayaran Rp${rec.grossAmount.toLocaleString('id-ID')} berhasil.`)

      // Refresh data sesi kas & saldo santri
      await refreshSessionData()
      const fin = await getStudentLoketAccountData(currentStudent.id)
      setFinancials(fin)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmittingTx(false)
    }
  }

  // 5. Reset Transaksi (Kembali ke Scanner Cepat)
  const handleResetForNewTransaction = () => {
    setCurrentStudent(null)
    setFinancials(null)
    setIsPinVerified(false)
    setVerificationToken(null)
    setReceipt(null)
    setIsReceiptOpen(false)
  }

  // 6. Handler Buka Sesi Kas
  const handleOpenSessionSubmit = async (openingBalance: number, notes?: string) => {
    const session = await openLoketCashSession(openingBalance, notes)
    setActiveSession(session)
    await refreshSessionData()
    toast.success(`Sesi kas ${session.session_code} berhasil dibuka.`)
  }

  // 7. Handler Tutup Sesi Kas
  const handleCloseSessionSubmit = async (
    sessionId: string,
    actualClosingBalance: number,
    notes?: string
  ) => {
    const closed = await closeLoketCashSession(sessionId, actualClosingBalance, notes)
    setActiveSession(null)
    await refreshSessionData()
    const diff = closed.difference ?? 0
    if (diff === 0) {
      toast.success(`Sesi kas ${closed.session_code} berhasil ditutup (Kas Fisik Impas).`)
    } else {
      toast.warning(
        `Sesi kas ${closed.session_code} ditutup dengan selisih Rp${Math.abs(diff).toLocaleString('id-ID')}.`
      )
    }
  }

  return (
    <div className="min-h-screen bg-slate-100/60 pb-16 flex flex-col">
      {/* 1. Header POS Sticky */}
      <PosHeader
        activeSession={activeSession}
        summary={summary}
        operator={operator}
        isViewOnly={isViewOnly}
        onOpenSessionClick={() => setSessionModalMode('OPEN')}
        onCloseSessionClick={() => setSessionModalMode('CLOSE')}
        onOpenHistoryClick={() => setIsHistoryDrawerOpen(true)}
      />

      {/* 2. Banner Perhatian jika belum ada Sesi Kas Aktif */}
      {!activeSession && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2.5 shadow-xs border-b border-amber-600/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                Operasional loket kasir membutuhkan Sesi Kas aktif. Harap buka sesi kas dengan memasukkan saldo kas fisik awal terlebih dahulu.
              </span>
            </div>
            {!isViewOnly && (
              <button
                type="button"
                onClick={() => setSessionModalMode('OPEN')}
                className="px-3 py-1 bg-amber-950 text-amber-100 rounded-lg hover:bg-black font-bold text-xs transition-colors shrink-0"
              >
                Buka Sesi
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Area Operasional Utama Loket POS */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Step 1: Scanner Input Kartu Santri */}
        <PosCardScanner
          onScan={handleScanOrSearch}
          isSearching={isSearchingStudent}
          disabled={!activeSession && !isViewOnly}
        />

        {/* Step 2: Profil & Verifikasi Wajah Santri */}
        {currentStudent && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <PosStudentCard
              student={currentStudent}
              onReset={handleResetForNewTransaction}
              onPromptPin={() => setIsPinPadOpen(true)}
              onOpenPinModal={() => setIsPinModalOpen(true)}
              isPinVerified={isPinVerified}
            />

            {/* Step 3: Action Panel POS (Tampil setelah PIN Terverifikasi) */}
            {isPinVerified && financials ? (
              <div className="animate-in fade-in duration-200">
                <PosActionPanel
                  financials={financials}
                  isSubmitting={isSubmittingTx}
                  onWithdraw={handleWithdrawal}
                  onDepositOrPay={handleDepositOrPay}
                />
              </div>
            ) : (
              /* State Menunggu Verifikasi PIN */
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Menunggu Verifikasi PIN Santri</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Cocokkan foto wajah santri di atas, lalu minta santri memasukkan PIN rahasia untuk membuka menu transaksi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinPadOpen(true)}
                  disabled={currentStudent.card?.status !== 'ACTIVE' || currentStudent.pinStatus.isLocked}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Masukkan PIN Santri</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Modal PIN Pad Santri */}
      {currentStudent && (
        <PosPinPad
          isOpen={isPinPadOpen}
          santriNama={currentStudent.namaLengkap}
          isLocked={currentStudent.pinStatus.isLocked}
          remainingLockSeconds={currentStudent.pinStatus.remainingLockSeconds}
          onClose={() => setIsPinPadOpen(false)}
          onVerify={handleVerifyPin}
        />
      )}

      {/* 4.1 Modal Kelola / Ubah / Reset PIN Santri */}
      {currentStudent && (
        <PosPinModal
          isOpen={isPinModalOpen}
          student={currentStudent}
          isViewOnly={isViewOnly}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={handlePinModalSuccess}
        />
      )}

      {/* 5. Modal Buka / Tutup Sesi Kas */}

      <CashSessionModal
        mode={sessionModalMode || 'OPEN'}
        isOpen={sessionModalMode !== null}
        activeSession={activeSession}
        onClose={() => setSessionModalMode(null)}
        onOpenSessionSubmit={handleOpenSessionSubmit}
        onCloseSessionSubmit={handleCloseSessionSubmit}
      />

      {/* 6. Modal Struk Transaksi */}
      <PosReceiptModal
        receipt={receipt}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onNewTransaction={handleResetForNewTransaction}
      />

      {/* 7. Drawer Riwayat Sesi Kas */}
      <SessionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        activeSessionId={activeSession?.id}
        onClose={() => setIsHistoryDrawerOpen(false)}
      />
    </div>
  )
}
