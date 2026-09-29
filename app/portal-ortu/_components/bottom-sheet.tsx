'use client'

import React, { useEffect, useId, useRef } from 'react'
import { X } from '@phosphor-icons/react'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
  contentRef?: React.RefObject<HTMLDivElement | null>
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  maxWidth = 'max-w-md',
  className = '',
  contentClassName = '',
  headerClassName = '',
  footerClassName = '',
  contentRef,
}: BottomSheetProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
        if (focusable.length === 0) {
          e.preventDefault()
          dialogRef.current.focus()
        } else if (e.shiftKey && document.activeElement === focusable[0]) {
          e.preventDefault()
          focusable[focusable.length - 1].focus()
        } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          e.preventDefault()
          focusable[0].focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:block">
      {/* Backdrop: klik luar menutup sheet */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer print:hidden"
        aria-hidden="true"
      />

      {/* Sheet / Dialog Panel: responsif mobile bottom-sheet & desktop modal dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} max-h-[90dvh] flex flex-col rounded-t-[28px] sm:rounded-[22px] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-2 duration-200 z-10 print:shadow-none print:max-w-none print:max-h-none print:border-none print:w-full print:rounded-none ${className}`}
      >
        {/* Mobile Drag Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0 print:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header (Sticky / Fixed) */}
        <div className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 sm:px-6 sm:py-4 shrink-0 bg-white dark:bg-slate-900 ${headerClassName}`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-bold text-slate-950 dark:text-slate-100 truncate leading-snug">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer print:hidden"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div
          ref={contentRef}
          className={`overflow-y-auto flex-1 p-5 sm:p-6 ${
            !footer ? 'pb-[max(env(safe-area-inset-bottom),1.5rem)]' : ''
          } ${contentClassName}`}
        >
          {children}
        </div>

        {/* Footer (Optional Sticky Bottom Bar) */}
        {footer && (
          <div className={`p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs flex gap-2.5 shrink-0 pb-[max(env(safe-area-inset-bottom),1rem)] ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
