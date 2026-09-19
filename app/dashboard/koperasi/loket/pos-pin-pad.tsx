'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  KeyRound,
  X,
  Delete,
  Lock,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

interface PosPinPadProps {
  isOpen: boolean
  santriNama: string
  isLocked: boolean
  remainingLockSeconds?: number
  onClose: () => void
  onVerify: (pin: string) => Promise<{ verified: boolean; attemptsLeft: number; locked: boolean; remainingLockSeconds?: number }>
}

export default function PosPinPad({
  isOpen,
  santriNama,
  isLocked: initialIsLocked,
  remainingLockSeconds: initialRemainingLockSeconds = 0,
  onClose,
  onVerify,
}: PosPinPadProps) {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(initialIsLocked)
  const [lockCountdown, setLockCountdown] = useState(initialRemainingLockSeconds)

  // Sinkronisasi status lock awal
  useEffect(() => {
    setIsLocked(initialIsLocked)
    setLockCountdown(initialRemainingLockSeconds)
  }, [initialIsLocked, initialRemainingLockSeconds])

  // Countdown timer saat terkunci
  useEffect(() => {
    if (!isLocked || lockCountdown <= 0) return
    const timer = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          setIsLocked(false)
          setErrorMessage(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isLocked, lockCountdown])

  // Listener keyboard fisik
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked || isVerifying) return

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPin((prev) => (prev.length < 6 ? prev + e.key : prev))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin((prev) => prev.slice(0, -1))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLocked, isVerifying, onClose])

  const submitPin = useCallback(async (fullPin: string) => {
    try {
      setIsVerifying(true)
      setErrorMessage(null)

      const result = await onVerify(fullPin)

      if (result.verified) {
        setPin('')
        onClose()
      } else {
        setPin('')
        if (result.locked) {
          setIsLocked(true)
          setLockCountdown(result.remainingLockSeconds || 15 * 60)
          setErrorMessage('PIN salah 3 kali berturut-turut. Akun terkunci sementara selama 15 menit.')
        } else {
          setErrorMessage(`PIN salah. Sisa kesempatan mencoba: ${result.attemptsLeft} kali.`)
        }
      }
    } catch (err) {
      setPin('')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsVerifying(false)
    }
  }, [onVerify, onClose])

  // Auto-submit saat 6 digit terisi
  useEffect(() => {
    if (pin.length === 6 && !isVerifying && !isLocked) {
      submitPin(pin)
    }
  }, [pin, isVerifying, isLocked, submitPin])

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6 && !isLocked && !isVerifying) {
      setPin((prev) => prev + digit)
    }
  }

  const handleBackspace = () => {
    if (!isLocked && !isVerifying) {
      setPin((prev) => prev.slice(0, -1))
    }
  }

  const handleClear = () => {
    if (!isLocked && !isVerifying) {
      setPin('')
      setErrorMessage(null)
    }
  }

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s < 10 ? '0' : ''}${s}s`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Pinpad */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Verifikasi PIN Santri</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{santriNama}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-2 text-center">
          {/* Banner Lockout jika akun terkunci */}
          {isLocked ? (
            <div className="my-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
              <div className="flex items-center justify-center gap-1.5 font-bold">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Akun Santri Terkunci</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Terkunci otomatis karena 3x salah memasukkan PIN berturut-turut.
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-rose-200 text-rose-900 font-mono font-bold text-xs">
                Sisa Waktu: {formatTime(lockCountdown)}
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 mb-4">
                Santri silakan memasukkan 6 digit PIN rahasia:
              </p>

              {/* 6 Digit Masked Circles */}
              <div className="flex items-center justify-center gap-3 my-4">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = idx < pin.length
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        isFilled
                          ? 'bg-emerald-600 scale-110 shadow-xs'
                          : 'border-2 border-slate-300 bg-slate-100'
                      }`}
                    />
                  )
                })}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="min-h-[28px] my-2 text-xs font-semibold text-rose-600 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Loading Indicator saat verifikasi */}
              {isVerifying && (
                <div className="my-2 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Memverifikasi PIN...</span>
                </div>
              )}

              {/* Tombol Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mt-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={isVerifying || isLocked}
                    onClick={() => handleDigitClick(digit)}
                    className="h-13 rounded-2xl bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 text-slate-800 hover:text-emerald-700 font-bold text-xl border border-slate-200 hover:border-emerald-200 transition-all active:scale-95 shadow-2xs disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={isVerifying || isLocked || pin.length === 0}
                  onClick={handleClear}
                  className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-xs border border-slate-200 transition-all active:scale-95 disabled:opacity-40"
                >
                  Reset
                </button>

                <button
                  type="button"
                  disabled={isVerifying || isLocked}
                  onClick={() => handleDigitClick('0')}
                  className="h-13 rounded-2xl bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 text-slate-800 hover:text-emerald-700 font-bold text-xl border border-slate-200 hover:border-emerald-200 transition-all active:scale-95 shadow-2xs disabled:opacity-40"
                >
                  0
                </button>

                <button
                  type="button"
                  disabled={isVerifying || isLocked || pin.length === 0}
                  onClick={handleBackspace}
                  className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 transition-all active:scale-95 disabled:opacity-40"
                  title="Hapus"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </>
          )}

          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
