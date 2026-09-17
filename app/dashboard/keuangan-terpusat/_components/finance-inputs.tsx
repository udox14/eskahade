'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DownloadSimple, MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { searchSantriByName, type SantriSearchRow } from '@/lib/finance/santri-search'
import { FINANCE_FIELD_CLASS } from './finance-ui'

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']

/**
 * Nominal dibaca ulang dengan kata supaya salah jumlah nol terlihat sebelum
 * disimpan. `Rp 15.000.000` dan `Rp 1.500.000` nyaris sama di mata, tetapi
 * "lima belas juta" dan "satu juta lima ratus ribu" tidak.
 */
function rupiahWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  const spell = (n: number): string => {
    if (n < 12) return SATUAN[n]
    if (n < 20) return `${SATUAN[n - 10]} belas`
    if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh ${spell(n % 10)}`.trim()
    if (n < 200) return `seratus ${spell(n - 100)}`.trim()
    if (n < 1_000) return `${SATUAN[Math.floor(n / 100)]} ratus ${spell(n % 100)}`.trim()
    if (n < 2_000) return `seribu ${spell(n - 1_000)}`.trim()
    if (n < 1_000_000) return `${spell(Math.floor(n / 1_000))} ribu ${spell(n % 1_000)}`.trim()
    if (n < 1_000_000_000) return `${spell(Math.floor(n / 1_000_000))} juta ${spell(n % 1_000_000)}`.trim()
    if (n < 1_000_000_000_000) return `${spell(Math.floor(n / 1_000_000_000))} miliar ${spell(n % 1_000_000_000)}`.trim()
    return `${spell(Math.floor(n / 1_000_000_000_000))} triliun ${spell(n % 1_000_000_000_000)}`.trim()
  }
  return value === 0 ? 'nol rupiah' : `${spell(value)} rupiah`
}

const groupDigits = (digits: string) => digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * Input rupiah berpemisah ribuan. Nilai mentah dikirim lewat input tersembunyi
 * bernama `name`, sehingga komponen ini bisa dipakai baik oleh form yang
 * membaca `FormData` maupun oleh state terkendali.
 */
export function RupiahInput({
  name, value, defaultValue = 0, onValueChange, id, min, max, placeholder = '0', className, hint, autoFocus,
}: {
  name?: string
  /** Isi bila pemanggil mengendalikan nilainya sendiri. */
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  id?: string
  min?: number
  max?: number
  placeholder?: string
  className?: string
  hint?: string
  autoFocus?: boolean
}) {
  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue)
  const current = controlled ? value : inner
  const [text, setText] = useState(current ? groupDigits(String(current)) : '')
  const [lastSeen, setLastSeen] = useState(current)

  // Nilai dari luar (mis. reset ke 0 setelah submit) harus tercermin di teksnya.
  // Disesuaikan saat render, bukan lewat effect: ini penyesuaian state terhadap
  // perubahan prop, dan effect hanya akan menambah satu render menganggur.
  if (controlled && value !== lastSeen) {
    setLastSeen(value)
    if (Number(text.replace(/\D/g, '') || 0) !== value) setText(value ? groupDigits(String(value)) : '')
  }

  const problem = current > 0 && max !== undefined && current > max ? `Maksimal ${groupDigits(String(max))}.`
    : current > 0 && min !== undefined && current < min ? `Minimal ${groupDigits(String(min))}.`
      : null

  return <div className="grid gap-1">
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={event => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 15)
          setText(groupDigits(digits))
          const next = Number(digits || 0)
          if (!controlled) setInner(next)
          onValueChange?.(next)
        }}
        className={cn(FINANCE_FIELD_CLASS, 'pl-10 text-right font-semibold tabular-nums', problem ? 'border-red-300 bg-red-50' : null, className)}
      />
    </div>
    {name ? <input type="hidden" name={name} value={current || ''} /> : null}
    {problem ? <p className="text-[11px] font-semibold text-red-700">{problem}</p>
      : current > 0 ? <p className="text-[11px] leading-4 text-slate-500">{rupiahWords(current)}</p>
        : hint ? <p className="text-[11px] leading-4 text-slate-500">{hint}</p> : null}
  </div>
}

/**
 * Pemilih santri dengan pencarian nama atau NIS. Menggantikan kolom "NIS santri"
 * yang harus dihafal dan diketik persis.
 */
export function SantriPicker({ selected, onSelect, name, placeholder = 'Ketik nama atau NIS santri...', id }: {
  selected: SantriSearchRow | null
  onSelect: (row: SantriSearchRow | null) => void
  /** Bila diisi, `santri_id` terpilih ikut terkirim lewat FormData. */
  name?: string
  placeholder?: string
  id?: string
}) {
  const fallbackId = useId()
  const comboId = id || `santri-${fallbackId}`
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SantriSearchRow[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected || query.trim().length < 2) return
    const timer = window.setTimeout(() => {
      setSearching(true)
      setError('')
      searchSantriByName(query)
        .then(rows => { setResults(rows); setActiveIndex(rows.length ? 0 : -1); setOpen(true) })
        .catch(() => { setResults([]); setError('Pencarian santri gagal. Periksa koneksi lalu coba lagi.'); setOpen(true) })
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, selected, retry])

  // Klik di luar menutup daftar; versi sebelumnya membiarkannya menggantung.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  if (selected) {
    return <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
      <span className="min-w-0 truncate font-semibold text-slate-800">{selected.nama_lengkap} <span className="font-normal text-slate-500">{selected.nis}{selected.asrama ? ` · ${selected.asrama}` : ''}</span></span>
      {name ? <input type="hidden" name={name} value={selected.id} /> : null}
      <button type="button" onClick={() => { onSelect(null); setQuery(''); setResults([]) }} className="min-h-11 shrink-0 px-2 text-xs font-bold text-slate-600 hover:text-slate-900">Ganti</button>
    </div>
  }

  return <div ref={box} className="relative">
    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      id={comboId}
      value={query}
      role="combobox"
      aria-expanded={open}
      aria-controls={`${comboId}-hasil`}
      aria-activedescendant={open && activeIndex >= 0 ? `${comboId}-option-${activeIndex}` : undefined}
      autoComplete="off"
      onChange={event => { setQuery(event.target.value); if (event.target.value.trim().length < 2) setOpen(false) }}
      onFocus={() => results.length > 0 && setOpen(true)}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return }
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(results.length - 1, index + 1)) }
        if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.max(0, index - 1)) }
        if (event.key === 'Home' && open) { event.preventDefault(); setActiveIndex(0) }
        if (event.key === 'End' && open) { event.preventDefault(); setActiveIndex(results.length - 1) }
        if (event.key === 'Enter' && open && results[activeIndex]) { event.preventDefault(); onSelect(results[activeIndex]); setOpen(false) }
      }}
      placeholder={placeholder}
      className={cn(FINANCE_FIELD_CLASS, 'pl-9')}
    />
    {open ? <div id={`${comboId}-hasil`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
      {searching ? <p className="px-3 py-2 text-xs text-slate-500">Mencari...</p>
        : error ? <div role="alert" className="p-3 text-xs text-red-800"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 min-h-11 rounded-md border border-red-300 bg-white px-3 font-bold">Coba lagi</button></div>
        : results.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">Tidak ada santri aktif yang cocok.</p>
          : results.map((row, index) => <button id={`${comboId}-option-${index}`} key={row.id} type="button" role="option" aria-selected={activeIndex === index}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => { onSelect(row); setOpen(false) }}
            className={cn('block min-h-11 w-full px-3 py-2.5 text-left text-xs hover:bg-emerald-50', activeIndex === index ? 'bg-emerald-50' : null)}>
            <span className="font-bold text-slate-800">{row.nama_lengkap}</span>
            <span className="ml-1.5 text-slate-500">{row.nis}{row.asrama ? ` · ${row.asrama}` : ''}{row.kamar ? ` / ${row.kamar}` : ''}</span>
          </button>)}
    </div> : null}
  </div>
}

/**
 * Kolom alasan dengan contoh siap pakai. Alasan wajib berisi minimal beberapa
 * karakter di banyak tindakan keuangan; chip memberi kerangka kalimat supaya
 * petugas tidak menulis "salah" saja demi lolos panjang minimal.
 */
export function ReasonField({ name, suggestions = [], minLength = 10, placeholder, rows = 3, id }: {
  name: string
  suggestions?: string[]
  minLength?: number
  placeholder?: string
  rows?: number
  id?: string
}) {
  const fallbackId = useId()
  const fieldId = id || fallbackId
  const [text, setText] = useState('')
  const short = text.trim().length < minLength

  return <div className="grid gap-1.5">
    {suggestions.length ? <div className="flex flex-wrap gap-1.5">
      {suggestions.map(item => <button key={item} type="button" onClick={() => setText(item)}
        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-800">
        {item}
      </button>)}
    </div> : null}
    <textarea
      id={fieldId}
      name={name}
      required
      minLength={minLength}
      rows={rows}
      value={text}
      onChange={event => setText(event.target.value)}
      placeholder={placeholder}
      className={cn(FINANCE_FIELD_CLASS, 'py-2 leading-5')}
    />
    <p className={cn('text-[11px]', short && text ? 'font-semibold text-amber-800' : 'text-slate-500')}>
      {short
        ? `Minimal ${minLength} karakter — kurang ${minLength - text.trim().length}. Tulis apa yang diperiksa dan hasilnya, bukan hanya kata kunci.`
        : 'Alasan ini tersimpan permanen di audit log.'}
    </p>
  </div>
}

/** Unduh baris yang sedang tampil (sudah terfilter) sebagai .xlsx. */
export function ExportButton({ filename, sheetName = 'Data', rows, label = 'Unduh Excel', disabled }: {
  filename: string
  sheetName?: string
  rows: () => Record<string, unknown>[]
  label?: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  return <button
    type="button"
    disabled={disabled || busy}
    onClick={async () => {
      setBusy(true)
      try {
        const data = rows()
        if (!data.length) { toast.error('Tidak ada baris untuk diunduh.'); return }
        // Diimpor saat dipakai agar bundel halaman tidak membawa xlsx.
        const XLSX = await import('xlsx')
        const book = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), sheetName.slice(0, 31))
        XLSX.writeFile(book, `${filename}.xlsx`)
        toast.success(`${data.length} baris diunduh.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal membuat berkas Excel.')
      } finally {
        setBusy(false)
      }
    }}
    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
    <DownloadSimple className="h-4 w-4" />{busy ? 'Menyiapkan...' : label}
  </button>
}

/** Bar melayang untuk daftar berpilihan-banyak. */
export function BulkActionBar({ count, noun = 'baris', onClear, children }: {
  count: number
  noun?: string
  onClear: () => void
  children: React.ReactNode
}) {
  if (!count) return null
  return <div className="sticky bottom-3 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 shadow-xl">
    <span className="text-xs font-bold text-white">{count} {noun} dipilih</span>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
    <button type="button" onClick={onClear} aria-label="Bersihkan pilihan" className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
  </div>
}
