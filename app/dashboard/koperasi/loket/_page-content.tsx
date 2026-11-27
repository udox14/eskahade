'use client'

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { formatFinanceDate } from '@/lib/finance/date-format'
import PosHeader from './pos-header'
import PosCardScanner from './pos-card-scanner'
import PosStudentCard from './pos-student-card'
import PosPinPad from './pos-pin-pad'
import PosActionPanel from './pos-action-panel'
import PosReceiptModal from './pos-receipt-modal'
import PosPinModal from './pos-pin-modal'
import CashSessionModal from './cash-session-modal'
import CashTransferModal from './cash-transfer-modal'
import SessionHistoryDrawer from './session-history-drawer'
import {
  openLoketCashSession,
  closeLoketCashSession,
  lookupStudentForLoket,
  verifyStudentLoketPin,
  getStudentLoketAccountData,
  executeLoketDepositOrPayment,
  getLoketInitialData,
  type StudentLoketProfile,
  type StudentLoketFinancials,
  type LoketWithdrawalReceipt,
  type LoketPaymentReceipt,
  type LoketPaymentItemInput,
  type LoketCashAccountOption,
} from './actions'
import type { FinanceCashSession, CashSessionTransactionSummary } from '@/lib/finance/cash-session'

interface LoketContentProps {
  initialData: {
    activeSession: FinanceCashSession | null
    summary: CashSessionTransactionSummary | null
    isViewOnly: boolean
    operator: { id: string; name: string; roles: string[] }
    lastClosedSession: { sessionCode: string; actualClosingBalance: number; closedAt: string | null } | null
    cashAccounts: LoketCashAccountOption[]
  }
}

const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

function toWibYmd(raw: string): string {
  const trimmed = raw.trim()
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) return trimmed.slice(0, 10)
  return new Date(dt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

function todayWibYmd(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export default function LoketContent({ initialData }: LoketContentProps) {
  const [activeSession, setActiveSession] = useState<FinanceCashSession | null>(
    initialData.activeSession
  )
  const [summary, setSummary] = useState<CashSessionTransactionSummary | null>(initialData.summary)
  const isViewOnly = initialData.isViewOnly
  const operator = initialData.operator

  const [sessionModalMode, setSessionModalMode] = useState<'OPEN' | 'CLOSE' | null>(null)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)
  const [isCashTransferOpen, setIsCashTransferOpen] = useState(false)
  const [lastClosedSession, setLastClosedSession] = useState(initialData.lastClosedSession)
  const [cashAccounts, setCashAccounts] = useState<LoketCashAccountOption[]>(initialData.cashAccounts)

  const [isSearchingStudent, setIsSearchingStudent] = useState(false)
  const [currentStudent, setCurrentStudent] = useState<StudentLoketProfile | null>(null)
  const [financials, setFinancials] = useState<StudentLoketFinancials | null>(null)
  const [txSeq, setTxSeq] = useState(0)
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  const [isPinPadOpen, setIsPinPadOpen] = useState(false)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [isPinVerified, setIsPinVerified] = useState(false)

  const [receipt, setReceipt] = useState<LoketWithdrawalReceipt | LoketPaymentReceipt | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmittingTx, setIsSubmittingTx] = useState(false)

  const isStaleSession = useMemo(() => {
    if (!activeSession?.opened_at) return false
    return toWibYmd(activeSession.opened_at) < todayWibYmd()
  }, [activeSession])

  const refreshSessionData = async () => {
    try {
      const fresh = await getLoketInitialData()
      setActiveSession(fresh.activeSession)
      setSummary(fresh.summary)
      setLastClosedSession(fresh.lastClosedSession)
      setCashAccounts(fresh.cashAccounts)
    } catch (err) {
      console.error('Gagal menyegarkan sesi kas:', err)
    }
  }

  const handleScanOrSearch = async (identifier: string) => {
    setIsSearchingStudent(true)
    try {
      const profile = await lookupStudentForLoket(identifier)
      if (!profile) {
        toast.error(`Santri "${identifier}" tidak ditemukan. Pilih dari daftar saran nama atau NIS.`)
        return
      }

      setCurrentStudent(profile)
      setIsPinVerified(false)
      setFinancials(null)
      setDraftIdempotencyKey(crypto.randomUUID())

      if (profile.statusGlobal !== 'aktif') {
        toast.warning(`Santri ${profile.namaLengkap} berstatus "${profile.statusGlobal}".`)
      }

      try {
        setFinancials(await getStudentLoketAccountData(profile.id))
      } catch {
        toast.error('Gagal memuat saldo dan tagihan santri.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearchingStudent(false)
    }
  }

  const handleVerifyPin = async (inputPin: string) => {
    if (!currentStudent) return { verified: false, attemptsLeft: 0, locked: false }
    const res = await verifyStudentLoketPin(currentStudent.id, inputPin)
    if (res.verified && res.verificationToken) {
      setIsPinVerified(true)
      toast.success('PIN santri terverifikasi.')
      try {
        setFinancials(await getStudentLoketAccountData(currentStudent.id))
      } catch {
        toast.error('Gagal memuat saldo dan tagihan santri.')
      }
    }
    return res
  }

  const handlePinModalSuccess = async () => {
    if (!currentStudent) return
    try {
      const refreshed = await lookupStudentForLoket(currentStudent.nis || currentStudent.id)
      if (refreshed) setCurrentStudent(refreshed)
    } catch (err) {
      console.error('Gagal menyegarkan status santri:', err)
    }
  }

  const handleDepositOrPay = async (items: LoketPaymentItemInput[], notes?: string) => {
    if (!currentStudent) return
    if (!activeSession) {
      toast.error('Buka sesi kas terlebih dahulu.')
      return
    }

    setIsSubmittingTx(true)
    try {
      const rec = await executeLoketDepositOrPayment({
        santriId: currentStudent.id,
        items,
        idempotencyKey: `PAY-${currentStudent.id}-${draftIdempotencyKey}`,
        notes,
      })

      setReceipt(rec)
      setIsReceiptOpen(true)
      toast.success(`Penerimaan pembayaran ${formatRupiah(rec.grossAmount)} berhasil.`)

      setTxSeq((n) => n + 1)
      setDraftIdempotencyKey(crypto.randomUUID())

      await refreshSessionData()
      const fin = await getStudentLoketAccountData(currentStudent.id)
      setFinancials(fin)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmittingTx(false)
    }
  }

  const handleResetForNewTransaction = () => {
    setCurrentStudent(null)
    setFinancials(null)
    setIsPinVerified(false)
    setReceipt(null)
    setIsReceiptOpen(false)
    setDraftIdempotencyKey(crypto.randomUUID())
  }

  const handleOpenSessionSubmit = async (openingBalance: number, notes?: string) => {
    const session = await openLoketCashSession(openingBalance, notes)
    setActiveSession(session)
    await refreshSessionData()
    toast.success(`Sesi kas ${session.session_code} berhasil dibuka.`)
  }

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
      toast.success(`Sesi kas ${closed.session_code} ditutup (Kas Fisik Seimbang).`)
    } else {
      toast.warning(
        `Sesi kas ${closed.session_code} ditutup dengan selisih ${formatRupiah(Math.abs(diff))}.`
      )
    }
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* 1. Header & Kartu Status Sesi Kas (selaras lebar konten) */}
      <PosHeader
        activeSession={activeSession}
        summary={summary}
        operator={operator}
        isViewOnly={isViewOnly}
        onOpenSessionClick={() => setSessionModalMode('OPEN')}
        onCloseSessionClick={() => setSessionModalMode('CLOSE')}
        onOpenHistoryClick={() => setIsHistoryDrawerOpen(true)}
        onCashTransferClick={() => setIsCashTransferOpen(true)}
      />

      {/* 2. Peringatan Sesi Kasir Usang (sejajar rapi dengan kartu konten) */}
      {activeSession && isStaleSession && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5 sm:items-center">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:mt-0" aria-hidden="true" />
            <p className="leading-relaxed">
              Sesi <strong className="font-mono">{activeSession.session_code}</strong> masih terbuka sejak{' '}
              <strong>{formatFinanceDate(activeSession.opened_at, true)} WIB</strong>. Tutup sesi dan hitung kas fisik
              sebelum melanjutkan transaksi hari ini.
            </p>
          </div>
          {!isViewOnly && (
            <button
              type="button"
              onClick={() => setSessionModalMode('CLOSE')}
              className="w-full sm:w-auto shrink-0 rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100/70 transition-colors cursor-pointer"
            >
              Tutup Sesi
            </button>
          )}
        </div>
      )}

      {/* 3. Pencarian Santri */}
      <PosCardScanner
        onScan={handleScanOrSearch}
        isSearching={isSearchingStudent}
        disabled={!activeSession && !isViewOnly}
      />

      {/* 4. Profil & Panel Transaksi Santri Terpilih */}
      {currentStudent && (
        <div className="space-y-5">
          <PosStudentCard
            student={currentStudent}
            onReset={handleResetForNewTransaction}
            onPromptPin={() => setIsPinPadOpen(true)}
            isPinVerified={isPinVerified}
            showCredentials={false}
          />

          {financials ? (
            <PosActionPanel
              key={`${currentStudent.id}-${txSeq}`}
              financials={financials}
              onSelectBillingPeriod={async (period) => {
                if (!currentStudent) return
                setFinancials(await getStudentLoketAccountData(currentStudent.id, period || undefined))
              }}
              isSubmitting={isSubmittingTx}
              onDepositOrPay={handleDepositOrPay}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xs space-y-2.5">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-800">Memuat saldo &amp; tagihan santri…</h3>
              <p className="mx-auto max-w-sm text-xs text-slate-500">
                Cocokkan foto santri di atas sebelum menerima setoran atau pembayaran tunai.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals & Drawers */}
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

      {currentStudent && (
        <PosPinModal
          isOpen={isPinModalOpen}
          student={currentStudent}
          isViewOnly={isViewOnly}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={handlePinModalSuccess}
        />
      )}

      <CashSessionModal
        key={`${sessionModalMode}-${activeSession?.id ?? 'none'}-${activeSession?.expected_closing_balance ?? 0}-${lastClosedSession?.sessionCode ?? 'none'}`}
        lastClosedSession={lastClosedSession}
        mode={sessionModalMode || 'OPEN'}
        isOpen={sessionModalMode !== null}
        activeSession={activeSession}
        onClose={() => setSessionModalMode(null)}
        onOpenSessionSubmit={handleOpenSessionSubmit}
        onCloseSessionSubmit={handleCloseSessionSubmit}
      />

      <CashTransferModal
        isOpen={isCashTransferOpen}
        sessionId={activeSession?.id ?? null}
        drawerBalance={
          activeSession ? (activeSession.available_balance ?? activeSession.expected_closing_balance) : 0
        }
        operatorName={operator.name}
        accounts={cashAccounts}
        onClose={() => setIsCashTransferOpen(false)}
        onChanged={refreshSessionData}
      />

      <PosReceiptModal
        receipt={receipt}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onNewTransaction={handleResetForNewTransaction}
      />

      <SessionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        activeSessionId={activeSession?.id}
        onClose={() => setIsHistoryDrawerOpen(false)}
      />
    </div>
  )
}
