'use client'

import React, { useRef, useEffect, useState } from 'react'
import { QrCode, Search, X, Loader2, CreditCard, Sparkles } from 'lucide-react'

interface PosCardScannerProps {
  onScan: (identifier: string) => Promise<void>
  isSearching: boolean
  disabled?: boolean
}

export default function PosCardScanner({
  onScan,
  isSearching,
  disabled = false,
}: PosCardScannerProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input saat modul siap
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = inputValue.trim()
    if (!clean || isSearching || disabled) return
    await onScan(clean)
    setInputValue('')
  }

  const handleClear = () => {
    setInputValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <label
            htmlFor="loket-scanner-input"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Pindai Kartu Santri (QR Barcode Scanner)</span>
          </label>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Arahkan scanner ke kartu atau ketik Token / NIS
          </span>
        </div>

        <div className="relative flex items-center">
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            ) : (
              <CreditCard className="w-5 h-5 text-slate-400" />
            )}
          </div>

          <input
            id="loket-scanner-input"
            ref={inputRef}
            type="text"
            disabled={disabled || isSearching}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pindai kartu QR santri (atau ketik token 'crd_...' / NIS lalu tekan Enter)..."
            className="w-full pl-11 pr-24 py-3.5 text-sm sm:text-base font-medium bg-slate-50/50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all disabled:opacity-60 disabled:bg-slate-100"
            autoComplete="off"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {inputValue && !isSearching && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Bersihkan input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!inputValue.trim() || isSearching || disabled}
              className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-2xs"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Cari</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Mendukung scanner fisik USB/Bluetooth maupun pencarian manual santri.</span>
          </div>
        </div>
      </form>
    </div>
  )
}
