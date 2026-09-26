'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Dropdown menu ringan untuk aksi per-baris tabel.
 *
 * Alasan dibuat lokal (bukan dependency baru):
 * - kebutuhan hanya satu pemicu + daftar aksi, tanpa submenu/positioning engine;
 * - aksesibilitas dasar (role menu/menuitem, Escape, klik luar, fokus kembali) sudah terpenuhi;
 * - menghindari penambahan dependency UI baru (UI_UX_GUIDELINES §5).
 *
 * Pemakaian:
 *   <RowActionMenu label="Aksi untuk Ahmad">
 *     <RowActionItem icon={<Printer />} onSelect={...}>Cetak Kartu</RowActionItem>
 *   </RowActionMenu>
 */

interface RowActionMenuProps {
  /** Accessible label untuk tombol pemicu (wajib, karena tombol hanya berisi ikon). */
  label: string
  children: React.ReactNode
  align?: 'left' | 'right'
}

export function RowActionMenu({ label, children, align = 'right' }: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  const close = useCallback(() => {
    setIsOpen(false)
    setOpenUpward(false)
  }, [])

  /**
   * Arah menu ditentukan saat dibuka, bukan lewat effect.
   * Baris di bagian bawah tabel membuka menu ke atas agar tidak terpotong viewport.
   */
  const toggleMenu = useCallback(() => {
    if (isOpen) {
      close()
      return
    }
    const triggerRect = triggerRef.current?.getBoundingClientRect()
    if (triggerRect) {
      const estimatedMenuHeight = (menuRef.current?.offsetHeight ?? 0) || 240
      const spaceBelow = window.innerHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top
      setOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow)
    }
    setIsOpen(true)
  }, [isOpen, close])

  // Klik di luar & tombol Escape menutup menu.
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        close()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        triggerRef.current?.focus()
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

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []
    )
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex =
      event.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={toggleMenu}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer',
          isOpen
            ? 'border-slate-300 bg-slate-100 text-slate-700'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        )}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute z-40 w-56 origin-top rounded-xl border border-slate-200 bg-white p-1 shadow-lg focus:outline-none',
            align === 'right' ? 'right-0' : 'left-0',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface RowActionItemProps {
  children: React.ReactNode
  icon?: React.ReactNode
  onSelect: () => void
  tone?: 'default' | 'warning' | 'danger' | 'success'
  disabled?: boolean
  /** Keterangan tambahan di bawah label (opsional). */
  hint?: string
}

const TONE_CLASS: Record<NonNullable<RowActionItemProps['tone']>, string> = {
  default: 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
  warning: 'text-amber-800 hover:bg-amber-50',
  danger: 'text-rose-700 hover:bg-rose-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
}

export function RowActionItem({
  children,
  icon,
  onSelect,
  tone = 'default',
  disabled = false,
  hint,
}: RowActionItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        TONE_CLASS[tone]
      )}
    >
      {icon ? <span className="mt-px shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {hint ? <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{hint}</span> : null}
      </span>
    </button>
  )
}

export function RowActionSeparator() {
  return <div role="separator" className="my-1 h-px bg-slate-100" />
}
