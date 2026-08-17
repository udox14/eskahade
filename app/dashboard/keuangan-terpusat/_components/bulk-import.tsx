'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle, DownloadSimple, UploadSimple, Warning, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ResultBanner, SectionPanel, type FinanceResult } from './finance-ui'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 5_000
const PREVIEW_LIMIT = 50

/** Satu kolom template: label jadi header di Excel, contoh mengisi baris pertama. */
export type BulkColumn = { key: string; label: string; example: string | number }

/** Pembacaan satu sel; header dicocokkan tanpa peduli huruf besar/kecil dan spasi. */
export type BulkCellReader = (key: string) => unknown

export type BulkParsed<T> = { value: T } | { error: string }

/** Hasil dari server: baris yang masuk, yang dilewati, dan yang ditolak beserta alasannya. */
export type BulkOutcome = {
  success: boolean
  created?: number
  skipped?: number
  rejected?: Array<{ row: number; reason: string }>
  error?: string
}

type Row<P> = { row: number; value: P & { row: number }; cells: string[] }
type Rejected = { row: number; reason: string }

const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '')

function cellReader(raw: Record<string, unknown>): BulkCellReader {
  const entries = Object.entries(raw).map(([key, value]) => [normalize(key), value] as const)
  return key => entries.find(([name]) => name === normalize(key))?.[1]
}

/** Pembantu untuk `parseRow`: teks yang sudah dirapikan, kosong jadi ''. */
export const asText = (value: unknown) => String(value ?? '').trim()

/** Pembantu untuk `parseRow`: rupiah/angka bulat; pemisah ribuan dan "Rp" ikut dibuang. */
export function asInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null
  const digits = String(value ?? '').replace(/[^\d-]/g, '')
  if (!digits || digits === '-') return null
  const parsed = Number(digits)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** Pembantu untuk `parseRow`: tanggal Excel maupun teks jadi `YYYY-MM-DD`. */
export function asDateISO(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return null
}

/**
 * Impor massal berbasis Excel dengan tiga langkah tetap: unduh template,
 * unggah, lalu periksa pratinjau sebelum dieksekusi.
 *
 * Dua aturan yang dipegang seluruh pemakainya:
 * baris yang bermasalah **ditolak sendiri beserta alasannya** — satu baris jelek
 * tidak menggagalkan seluruh berkas; dan tombol eksekusi hanya mengirim baris
 * yang lolos validasi, sehingga tidak ada yang diam-diam tersimpan separuh.
 */
export function BulkImport<P extends object>({
  title, description, templateName, sheetName = 'Template', columns, parseRow, previewHeaders,
  onSubmit, disabled, disabledReason, note, submitLabel = 'Eksekusi baris valid',
}: {
  title: string
  description: string
  /** Nama berkas template tanpa ekstensi. */
  templateName: string
  sheetName?: string
  columns: BulkColumn[]
  /**
   * Nomor baris tidak perlu Anda isi — komponen ini yang menyisipkannya, supaya
   * penolakan dari server selalu menunjuk baris Excel yang benar.
   */
  parseRow: (get: BulkCellReader, rowNumber: number) => BulkParsed<P>
  /** Judul kolom pratinjau; bawaannya label kolom template. */
  previewHeaders?: string[]
  onSubmit: (values: Array<P & { row: number }>) => Promise<BulkOutcome>
  disabled?: boolean
  disabledReason?: string
  note?: React.ReactNode
  submitLabel?: string
}) {
  const [pending, startTransition] = useTransition()
  const [reading, setReading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [valid, setValid] = useState<Row<P>[]>([])
  const [rejected, setRejected] = useState<Rejected[]>([])
  const [result, setResult] = useState<FinanceResult | null>(null)

  function reset() {
    setValid([])
    setRejected([])
    setFileName('')
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import('xlsx')
      const header = Object.fromEntries(columns.map(column => [column.label, column.example]))
      const sheet = XLSX.utils.json_to_sheet([header])
      sheet['!cols'] = columns.map(column => ({ wch: Math.max(14, column.label.length + 2) }))
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31))
      XLSX.writeFile(book, `${templateName}.xlsx`)
      toast.success('Template diunduh. Baris contoh boleh ditimpa atau dihapus.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat template.')
    }
  }

  async function readFile(file: File) {
    setResult(null)
    reset()
    if (file.size <= 0 || file.size > MAX_BYTES) {
      toast.error('Berkas harus berukuran 1 byte–5 MB.')
      return
    }
    setReading(true)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('Berkas tidak memiliki lembar kerja.')
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (!raw.length) throw new Error('Lembar pertama tidak berisi baris data.')
      if (raw.length > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS.toLocaleString('id-ID')} baris per berkas. Pecah berkasnya.`)

      const nextValid: Row<P>[] = []
      const nextRejected: Rejected[] = []
      raw.forEach((entry, index) => {
        // +2: baris 1 adalah header, jadi nomor baris cocok dengan yang terlihat di Excel.
        const rowNumber = index + 2
        const get = cellReader(entry)
        const isBlank = columns.every(column => asText(get(column.key)) === '')
        if (isBlank) return
        const parsed = parseRow(get, rowNumber)
        if ('error' in parsed) nextRejected.push({ row: rowNumber, reason: parsed.error })
        else nextValid.push({
          row: rowNumber,
          value: { ...parsed.value, row: rowNumber },
          cells: columns.map(column => asText(get(column.key))),
        })
      })

      if (!nextValid.length && !nextRejected.length) throw new Error('Semua baris kosong. Isi dulu templatenya.')
      setFileName(file.name)
      setValid(nextValid)
      setRejected(nextRejected)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Berkas tidak dapat dibaca.')
    } finally {
      setReading(false)
    }
  }

  function execute() {
    startTransition(async () => {
      try {
        const outcome = await onSubmit(valid.map(row => row.value))
        if (!outcome.success) {
          const message = outcome.error || 'Impor tidak dapat diproses.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        const created = outcome.created ?? 0
        const serverRejected = outcome.rejected ?? []
        const details = [
          outcome.skipped ? `${outcome.skipped} dilewati karena sudah ada` : '',
          serverRejected.length ? `${serverRejected.length} ditolak server` : '',
        ].filter(Boolean).join(' · ')
        setResult({
          tone: created ? 'success' : 'duplicate',
          message: created ? `${created} baris berhasil dimasukkan.` : 'Tidak ada baris baru yang dimasukkan.',
          detail: details || undefined,
        })
        toast.success(created ? `${created} baris dimasukkan.` : 'Tidak ada baris baru.')
        // Penolakan dari server digabung ke daftar yang sama supaya petugas
        // memperbaiki satu tempat, bukan dua.
        setRejected(current => [...current, ...serverRejected].sort((a, b) => a.row - b.row))
        setValid(current => current.filter(row => serverRejected.some(item => item.row === row.row)))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impor tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  const headers = previewHeaders ?? columns.map(column => column.label)

  return <SectionPanel title={title} description={description}>
    <div className="space-y-4 p-4">
      {disabled ? <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{disabledReason || 'Akun Anda tidak memiliki kewenangan melakukan impor di halaman ini.'}</p> : null}

      <ol className="grid gap-3 lg:grid-cols-3">
        <li className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <p className="text-xs font-bold text-slate-900">1. Unduh template</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">Kolom: {columns.map(column => column.label).join(' · ')}.</p>
          <button type="button" onClick={downloadTemplate} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 text-xs font-bold text-blue-800">
            <DownloadSimple className="h-4 w-4" />{templateName}.xlsx
          </button>
        </li>
        <li className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-900">2. Unggah hasil isian</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">Urutan kolom bebas; judul kolom yang dipakai untuk mencocokkan. Maksimal 5 MB.</p>
          <label className={cn('mt-2 flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700', disabled && 'pointer-events-none opacity-50')}>
            <UploadSimple className="h-4 w-4" />{reading ? 'Membaca berkas...' : fileName || 'Pilih berkas .xlsx / .csv'}
            <input type="file" accept=".xlsx,.xls,.csv" disabled={disabled || reading} className="hidden" onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void readFile(file)
            }} />
          </label>
        </li>
        <li className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-900">3. Periksa lalu eksekusi</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">Hanya baris valid yang dikirim. Baris bermasalah tidak menggagalkan yang lain.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
            <span className="text-emerald-700">{valid.length} valid</span>
            <span className={rejected.length ? 'text-red-700' : 'text-slate-400'}>{rejected.length} ditolak</span>
          </div>
        </li>
      </ol>

      {note ? <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-[11px] leading-5 text-slate-700">{note}</div> : null}

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {rejected.length ? <div className="overflow-hidden rounded-lg border border-red-200">
        <p className="flex items-center gap-1.5 border-b border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">
          <XCircle className="h-4 w-4" />{rejected.length} baris ditolak — perbaiki di Excel lalu unggah ulang
        </p>
        <ul className="max-h-56 divide-y divide-red-100 overflow-y-auto bg-white">
          {rejected.slice(0, PREVIEW_LIMIT).map(item => <li key={`${item.row}-${item.reason}`} className="flex gap-3 px-3 py-2 text-xs">
            <span className="w-16 shrink-0 font-bold tabular-nums text-slate-500">Baris {item.row}</span>
            <span className="text-red-800">{item.reason}</span>
          </li>)}
        </ul>
        {rejected.length > PREVIEW_LIMIT ? <p className="border-t border-red-100 bg-red-50/60 px-3 py-2 text-[11px] text-red-800">{rejected.length - PREVIEW_LIMIT} penolakan lain tidak ditampilkan.</p> : null}
      </div> : null}

      {valid.length ? <div className="overflow-hidden rounded-lg border border-slate-200">
        <p className="flex items-center gap-1.5 border-b border-slate-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          <CheckCircle className="h-4 w-4" />{valid.length} baris siap dieksekusi{fileName ? ` dari ${fileName}` : ''}
        </p>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Baris</th>{headers.map(header => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {valid.slice(0, PREVIEW_LIMIT).map(row => <tr key={row.row}>
                <td className="px-3 py-2 tabular-nums text-slate-500">{row.row}</td>
                {row.cells.map((cell, index) => <td key={index} className="px-3 py-2 text-slate-800">{cell || '—'}</td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        {valid.length > PREVIEW_LIMIT ? <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">Menampilkan {PREVIEW_LIMIT} baris pertama; seluruh {valid.length} baris tetap akan diproses.</p> : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
          <button type="button" disabled={disabled || pending} onClick={execute} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">
            {pending ? 'Memproses...' : `${submitLabel} (${valid.length})`}
          </button>
          <button type="button" disabled={pending} onClick={() => { reset(); setResult(null) }} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600">Buang berkas</button>
          <span className="flex items-center gap-1 text-[11px] text-amber-800"><Warning className="h-3.5 w-3.5" />Periksa nominal dan nama sebelum menekan eksekusi.</span>
        </div>
      </div> : null}
    </div>
  </SectionPanel>
}
