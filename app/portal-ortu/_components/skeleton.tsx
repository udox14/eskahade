import React from 'react'

/** Blok abu-abu berdenyut untuk keadaan loading. */
export function Sk({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-slate-200/80 dark:bg-slate-800 ${className}`} />
}

/**
 * Kerangka halaman loading: judul asli langsung tampil (tidak berkedip),
 * isi berupa skeleton yang meniru susunan halaman sebenarnya.
 */
export function SkPage({
  title,
  gap = 'space-y-4',
  children,
}: {
  title: string
  gap?: string
  children: React.ReactNode
}) {
  return (
    <div className={`px-5 pt-5 pb-32 ${gap}`} role="status" aria-busy="true" aria-label={`Memuat ${title}`}>
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">{title}</h1>
      <div className={`animate-pulse motion-reduce:animate-none ${gap}`}>{children}</div>
    </div>
  )
}

/** Kartu putih berbingkai, sama dengan kartu daftar di halaman asli. */
export function SkCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={`rounded-[22px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs ${className}`}
    >
      {children}
    </div>
  )
}

/** Satu baris daftar: badge ikon + dua baris teks + (opsional) nilai di kanan. */
export function SkRow({ right = true }: { right?: boolean }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4">
      <Sk className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Sk className="h-3.5 w-3/5" />
        <Sk className="h-3 w-2/5 bg-slate-100 dark:bg-slate-800/70" />
      </div>
      {right && <Sk className="h-4 w-16" />}
    </div>
  )
}
