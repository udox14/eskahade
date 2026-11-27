'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, User } from 'lucide-react'
import { publicMediaUrl } from '@/lib/r2/references'
import { searchStudentsForLoket, type LoketStudentSearchOption } from './actions'

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
  const [suggestions, setSuggestions] = useState<LoketStudentSearchOption[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  // Live autocomplete pencarian nama / NIS (debounce 250ms)
  useEffect(() => {
    const q = inputValue.trim()
    if (disabled || q.length < 2) {
      setSuggestions([])
      setIsDropdownOpen(false)
      setHighlightedIndex(-1)
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true)
      try {
        const res = await searchStudentsForLoket(q)
        if (active) {
          setSuggestions(res)
          setIsDropdownOpen(true)
          setHighlightedIndex(res.length > 0 ? 0 : -1)
        }
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setIsLoadingSuggestions(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [inputValue, disabled])

  const selectStudent = async (identifier: string) => {
    setIsDropdownOpen(false)
    setSuggestions([])
    setHighlightedIndex(-1)
    setInputValue('')
    await onScan(identifier)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = inputValue.trim()
    if (!clean || isSearching || disabled) return

    if (isDropdownOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      await selectStudent(suggestions[highlightedIndex].nis || suggestions[highlightedIndex].id)
      return
    }
    if (suggestions.length === 1) {
      await selectStudent(suggestions[0].nis || suggestions[0].id)
      return
    }
    await selectStudent(clean)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsDropdownOpen(false)
    }
  }

  const handleClear = () => {
    setInputValue('')
    setSuggestions([])
    setIsDropdownOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="loket-scanner-input"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            <Search className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Cari Santri</span>
          </label>
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            Ketik nama atau NIS santri, lalu pilih dari daftar atau tekan Enter
          </span>
        </div>

        <div className="relative">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 text-slate-400">
              {isSearching || isLoadingSuggestions ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              )}
            </div>

            <input
              id="loket-scanner-input"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="loket-student-suggestions"
              disabled={disabled || isSearching}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setIsDropdownOpen(true)
              }}
              placeholder="Ketik nama atau NIS santri…"
              className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-24 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all disabled:bg-slate-100 disabled:opacity-60"
              autoComplete="off"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {inputValue && !isSearching && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={handleClear}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}

              <button
                type="submit"
                disabled={!inputValue.trim() || isSearching || disabled}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {isSearching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Cari</span>
              </button>
            </div>
          </div>

          {/* Live Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div
              id="loket-student-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100"
            >
              {suggestions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  Tidak ada santri aktif yang cocok dengan &ldquo;{inputValue.trim()}&rdquo;.
                </div>
              ) : (
                suggestions.map((s, idx) => {
                  const isHighlighted = idx === highlightedIndex
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => selectStudent(s.nis || s.id)}
                      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                        {s.fotoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={publicMediaUrl(s.fotoUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">{s.namaLengkap}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          NIS {s.nis}
                          {s.asrama ? ` · ${s.asrama}` : ''}
                          {s.kamar ? ` / ${s.kamar}` : ''}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <p className="px-0.5 text-[11px] text-slate-500">
          Untuk setor uang jajan atau pembayaran tagihan tunai. Cocokkan foto santri sebelum memproses transaksi.
        </p>
      </form>
    </div>
  )
}
