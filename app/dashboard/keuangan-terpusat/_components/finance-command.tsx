'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, MagnifyingGlass, Student, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { searchSantriByName, type SantriSearchRow } from '@/lib/finance/santri-search'
import { FINANCE_FIELD_CLASS, FINANCE_NAV_GROUPS } from './finance-ui'

type Jump = { key: string; label: string; caption: string; href: string; kind: 'page' | 'santri' }

/**
 * Pencarian cepat lintas halaman keuangan (Ctrl+K).
 *
 * Dua kegunaannya berbeda tapi satu pintu: melompat ke halaman tanpa mencari
 * tabnya, dan menemukan santri lalu membuka riwayatnya di halaman yang tepat
 * dengan filter sudah terisi — sebelumnya NIS harus dicatat dulu, lalu diketik
 * ulang di halaman tujuan.
 */
export function FinanceCommandPalette({ allowedHrefs }: { allowedHrefs: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<SantriSearchRow[]>([])
  const [searching, setSearching] = useState(false)
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const pages = useMemo(() => FINANCE_NAV_GROUPS.flatMap(group => group.items
    .filter(item => allowedHrefs.includes(item.href))
    .map(item => ({ key: item.href, label: item.label, caption: group.label, href: item.href, kind: 'page' as const }))),
    [allowedHrefs])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(current => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => input.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const needle = query.trim()
    // Hasil lama tidak dikosongkan lewat effect; cukup disembunyikan saat kata
    // kuncinya terlalu pendek (lihat `visibleStudents`).
    if (needle.length < 2) return
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchSantriByName(needle)
        .then(setStudents)
        .catch(() => setStudents([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const needle = query.trim().toLowerCase()
  const matchedPages = needle
    ? pages.filter(page => page.label.toLowerCase().includes(needle) || page.caption.toLowerCase().includes(needle))
    : pages

  const ledgerAllowed = allowedHrefs.includes('/dashboard/keuangan-terpusat/transaksi')
  const allocationAllowed = allowedHrefs.includes('/dashboard/keuangan-terpusat/alokasi')
  const visibleStudents = needle.length >= 2 ? students : []

  const results: Jump[] = [
    ...matchedPages,
    ...visibleStudents.flatMap(student => {
      const label = `${student.nama_lengkap} · ${student.nis}`
      const jumps: Jump[] = []
      if (allocationAllowed) jumps.push({ key: `alokasi-${student.id}`, label, caption: 'Lihat alokasi santri ini', href: `/dashboard/keuangan-terpusat/alokasi?q=${encodeURIComponent(student.nis)}`, kind: 'santri' })
      if (ledgerAllowed) jumps.push({ key: `ledger-${student.id}`, label, caption: 'Telusuri jurnal santri ini', href: `/dashboard/keuangan-terpusat/ledger?q=${encodeURIComponent(student.nis)}`, kind: 'santri' })
      return jumps
    }),
  ]

  function go(target: Jump | undefined) {
    if (!target) return
    setOpen(false)
    setQuery('')
    router.push(target.href)
  }

  return <>
    <button type="button" onClick={() => setOpen(true)}
      className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 lg:w-64">
      <MagnifyingGlass className="h-4 w-4" />
      <span className="flex-1 text-left">Cari halaman atau santri</span>
      <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:inline">Ctrl K</kbd>
    </button>

    {open ? <div className="fixed inset-0 z-[85] grid place-items-start justify-center bg-slate-950/60 p-4 pt-[10vh]" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Pencarian cepat keuangan"
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={input}
            value={query}
            onChange={event => { setQuery(event.target.value); setCursor(0) }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); return }
              if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(current => Math.min(current + 1, results.length - 1)) }
              if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(current => Math.max(current - 1, 0)) }
              if (event.key === 'Enter') { event.preventDefault(); go(results[cursor]) }
            }}
            placeholder="Nama halaman, atau nama/NIS santri"
            className={cn(FINANCE_FIELD_CLASS, 'border-0 px-0 focus:ring-0')}
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Tutup pencarian" className="shrink-0 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length ? results.map((item, index) => <button key={item.key} type="button"
            onMouseEnter={() => setCursor(index)}
            onClick={() => go(item)}
            className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs', index === cursor ? 'bg-emerald-50' : 'hover:bg-slate-50')}>
            {item.kind === 'santri' ? <Student className="h-4 w-4 shrink-0 text-emerald-700" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-slate-800">{item.label}</strong>
              <span className="text-slate-500">{item.caption}</span>
            </span>
          </button>) : <p className="px-3 py-6 text-center text-xs text-slate-500">
            {searching ? 'Mencari santri...' : query.trim().length < 2 ? 'Ketik minimal 2 huruf untuk mencari santri.' : 'Tidak ada halaman atau santri yang cocok.'}
          </p>}
        </div>
        <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          ↑↓ memilih · Enter membuka · Esc menutup. Santri dibuka dengan filter NIS sudah terisi.
        </p>
      </section>
    </div> : null}
  </>
}
