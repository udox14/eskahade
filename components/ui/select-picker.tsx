'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectPickerOption {
  value: string
  label: string
}

interface SelectPickerProps {
  value: string
  options: SelectPickerOption[]
  onChange: (value: string) => void
  prefixLabel?: string
  icon?: React.ReactNode
  ariaLabel?: string
  disabled?: boolean
  align?: 'left' | 'right'
  placement?: 'bottom' | 'top'
  className?: string
  menuClassName?: string
}

/**
 * Custom dropdown select ringan tanpa dependency eksternal (mengikuti pola dropdown-menu.tsx).
 * Menggantikan native <select> agar tampilan trigger & daftar pilihan konsisten dengan
 * tema ESKAHADE di desktop maupun mobile/WebView.
 */
export function SelectPicker({
  value,
  options,
  onChange,
  prefixLabel,
  icon,
  ariaLabel,
  disabled = false,
  align = 'right',
  placement = 'bottom',
  className,
  menuClassName,
}: SelectPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  const labelId = useId()

  const selectedIndex = options.findIndex((opt) => opt.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  const close = useCallback((returnFocus = false) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  const open = useCallback(() => {
    if (disabled || options.length === 0) return
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setIsOpen(true)
  }, [disabled, options.length, selectedIndex])

  const selectValue = useCallback(
    (nextValue: string) => {
      close(true)
      if (nextValue !== value) {
        onChange(nextValue)
      }
    },
    [close, onChange, value]
  )

  // Klik di luar & Escape menutup dropdown
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        close(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close(true)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, close])

  // Fokus & gulir ke opsi aktif saat dibuka
  useEffect(() => {
    if (!isOpen) return
    listboxRef.current?.focus()
    const activeEl = listboxRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [isOpen])

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isOpen) {
        open()
      } else {
        close(true)
      }
    }
  }

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev < options.length - 1 ? prev + 1 : 0
        const optEl = listboxRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)
        optEl?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : options.length - 1
        const optEl = listboxRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)
        optEl?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHighlightedIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHighlightedIndex(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const idx = highlightedIndex >= 0 ? highlightedIndex : selectedIndex
      if (idx >= 0 && options[idx]) {
        selectValue(options[idx].value)
      }
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && prefixLabel ? labelId : undefined}
        onClick={() => (isOpen ? close(false) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex w-full min-h-[44px] sm:min-h-[38px] items-center justify-between gap-2.5 rounded-lg border bg-white px-3 py-1.5 text-sm shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-600/15'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon ? (
            <span className="shrink-0 text-emerald-700" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          {prefixLabel ? (
            <span id={labelId} className="text-xs font-medium text-slate-500">
              {prefixLabel}
            </span>
          ) : null}
          <span className="truncate font-semibold text-slate-900">
            {selectedOption?.label ?? value}
          </span>
        </span>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180 text-emerald-700'
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel || prefixLabel || 'Pilih opsi'}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
          onKeyDown={handleListKeyDown}
          className={cn(
            'absolute z-50 min-w-full w-56 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 focus:outline-none',
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isHighlighted = idx === highlightedIndex

            return (
              <button
                key={opt.value}
                id={`${listboxId}-opt-${idx}`}
                type="button"
                role="option"
                data-index={idx}
                data-selected={isSelected ? 'true' : undefined}
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => selectValue(opt.value)}
                className={cn(
                  'flex w-full min-h-[38px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-emerald-50 font-semibold text-emerald-900'
                    : isHighlighted
                      ? 'bg-slate-100/90 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
