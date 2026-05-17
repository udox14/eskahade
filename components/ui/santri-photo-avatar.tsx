'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type SantriPhotoAvatarProps = {
  src?: string | null
  alt?: string
  name: string
  size?: 'sm' | 'md'
  clickable?: boolean
  className?: string
}

const sizeClassMap = {
  sm: 'w-10 h-[3.35rem]',
  md: 'w-12 h-16',
} as const

function getInitials(name: string) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function SantriPhotoLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/88 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Tutup preview foto"
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out"
      />
      <div className="relative z-10 w-full max-w-md">
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="aspect-[3/4] w-full bg-slate-100">
            <img src={src} alt={alt} className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SantriPhotoAvatar({
  src,
  alt,
  name,
  size = 'md',
  clickable = true,
  className,
}: SantriPhotoAvatarProps) {
  const [open, setOpen] = useState(false)
  const hasPhoto = Boolean(src)
  const canOpen = hasPhoto && clickable

  const frame = (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm',
        sizeClassMap[size],
        className
      )}
    >
      {hasPhoto ? (
        <img src={src!} alt={alt || name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-500">
          {getInitials(name)}
        </div>
      )}
    </div>
  )

  if (!canOpen) return frame

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={`Lihat foto ${name}`}
      >
        {frame}
      </button>
      <SantriPhotoLightbox src={src!} alt={alt || name} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
