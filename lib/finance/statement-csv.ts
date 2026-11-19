// lib/finance/statement-csv.ts
// Parser CSV rekening koran dari internet banking (impor manual). Murni: tanpa DB, tanpa jaringan.
//
// Prinsip (AGENTS.md §5, §15): nominal integer Rupiah, TIDAK ada pembulatan diam-diam, format tidak
// dikenali = error (fail closed), satu baris bermasalah menggagalkan seluruh impor.
import crypto from 'node:crypto'

export const MAX_STATEMENT_CSV_CHARS = 900_000
export const MAX_STATEMENT_ROWS = 5000

export type StatementDateOrder = 'DMY' | 'MDY'

export interface StatementColumnMapping {
  date: number
  /** Kolom jam terpisah (opsional). */
  time?: number
  description?: number
  /** Mode dua kolom: kredit & debit. */
  credit?: number
  debit?: number
  /** Mode satu kolom nominal (+ kolom tipe opsional; tanpa tipe, tanda minus = debit). */
  amount?: number
  type?: number
  /** Saldo setelah mutasi. */
  balance?: number
  /** Saldo sebelum mutasi (opsional; bersama `balance` memungkinkan verifikasi rantai saldo). */
  balanceBefore?: number
  reference?: number
}

export interface StatementParseOptions {
  /** Indeks baris (0-based) yang berisi judul kolom. Data dimulai di baris berikutnya. -1 = tanpa judul. */
  headerRowIndex: number
  dateOrder: StatementDateOrder
}

export interface ParsedStatementLine {
  rowNumber: number // nomor baris di berkas (1-based)
  transactionDate: string // ISO-8601 +07:00
  type: 'CREDIT' | 'DEBIT'
  amount: number // integer Rupiah
  remark: string
  balance: number | null
  balanceBefore: number | null
  reference: string | null
  /** ID deterministik hasil hash isi baris: impor ulang berkas yang tumpang-tindih tidak menggandakan baris. */
  transactionId: string
}

export interface StatementParseError {
  row: number
  message: string
}

export interface StatementParseResult {
  lines: ParsedStatementLine[]
  errors: StatementParseError[]
  ignoredRows: number
  creditCount: number
  creditTotal: number
  debitCount: number
  debitTotal: number
  fromDateTime: string | null
  toDateTime: string | null
  /** VERIFIED: tiap baris (saldo awal ± mutasi = saldo akhir) dan antar-baris berkesinambungan, tanpa baris hilang. */
  balanceChain: 'VERIFIED' | 'UNAVAILABLE'
}

// ───────────────────────────── CSV tokenizer ─────────────────────────────

export function parseCsv(text: string): { delimiter: string; rows: string[][] } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const delimiter = detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (inQuotes) throw new Error('Berkas CSV tidak valid: tanda kutip tidak tertutup.')
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return { delimiter, rows: rows.map((r) => r.map((c) => c.trim())) }
}

function detectDelimiter(src: string): string {
  const candidates = [',', ';', '\t', '|']
  const sample = src.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 15)
  let best = ','
  let bestScore = -1
  for (const d of candidates) {
    let score = 0
    for (const line of sample) {
      let inQ = false
      let n = 0
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === d && !inQ) n++
      }
      score += n
    }
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

// ───────────────────────────── Nominal ─────────────────────────────

export type RupiahCell = { ok: true; value: number; negative: boolean } | { ok: false; error: string }

/**
 * Nominal Rupiah dari sel CSV. Menerima "1250000", "1.250.000", "1.250.000,00", "1,250,000.00", "Rp 1.250.000".
 * Menolak pecahan non-nol (tidak ada pembulatan), notasi ilmiah, dan format ambigu.
 */
export function parseRupiahCell(raw: string): RupiahCell {
  let s = raw.trim().replace(/^(rp\.?|idr)\s*/i, '').replace(/\s+/g, '')
  if (s === '') return { ok: false, error: 'nominal kosong' }
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  } else if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s)) return { ok: false, error: `nominal "${raw}" tidak dikenali` }

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let intPart = s
  let frac = ''
  let thousandSep: string | null = null

  if (lastDot >= 0 && lastComma >= 0) {
    const decIdx = Math.max(lastDot, lastComma)
    const decSep = s[decIdx]
    thousandSep = decSep === '.' ? ',' : '.'
    intPart = s.slice(0, decIdx)
    frac = s.slice(decIdx + 1)
    if (intPart.includes(decSep)) return { ok: false, error: `nominal "${raw}" ambigu` }
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const count = s.split(sep).length - 1
    const idx = s.lastIndexOf(sep)
    const after = s.slice(idx + 1)
    if (count > 1 || after.length === 3) {
      thousandSep = sep // pemisah ribuan
    } else if (after.length >= 1 && after.length <= 2) {
      intPart = s.slice(0, idx)
      frac = after
    } else {
      return { ok: false, error: `nominal "${raw}" ambigu` }
    }
  }

  if (thousandSep) {
    const re = thousandSep === '.' ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/
    if (!re.test(intPart)) return { ok: false, error: `nominal "${raw}" memiliki pemisah ribuan tidak valid` }
    intPart = intPart.split(thousandSep).join('')
  }
  if (intPart === '' && frac !== '') intPart = '0' // bentuk ".00" (nol tanpa angka depan)
  if (!/^\d+$/.test(intPart)) return { ok: false, error: `nominal "${raw}" tidak valid` }
  if (frac !== '' && !/^0+$/.test(frac)) {
    return { ok: false, error: `nominal "${raw}" memiliki pecahan sen; hanya Rupiah bulat yang didukung` }
  }
  const value = Number(intPart)
  if (!Number.isSafeInteger(value)) return { ok: false, error: `nominal "${raw}" terlalu besar` }
  return { ok: true, value, negative }
}

// ───────────────────────────── Tanggal ─────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function validDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Zona waktu pesantren: WIB (+07:00), tanpa DST. Mengembalikan ISO-8601 dengan offset, atau null. */
export function parseStatementDateTime(raw: string, order: StatementDateOrder): string | null {
  const s = raw.trim().replace(/\s+/g, ' ')
  const m = s.match(/^(.+?)(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*WIB)?)?$/i)
  if (!m) return null
  const datePart = m[1].trim()
  const hh = m[2] !== undefined ? Number(m[2]) : 0
  const mi = m[3] !== undefined ? Number(m[3]) : 0
  const ss = m[4] !== undefined ? Number(m[4]) : 0
  if (hh > 23 || mi > 59 || ss > 59) return null

  let y: number
  let mo: number
  let d: number
  let t: RegExpMatchArray | null
  if ((t = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    y = Number(t[1]); mo = Number(t[2]); d = Number(t[3])
  } else if ((t = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const a = Number(t[1])
    const b = Number(t[2])
    y = t[3].length === 2 ? 2000 + Number(t[3]) : Number(t[3])
    if (order === 'DMY') { d = a; mo = b } else { mo = a; d = b }
  } else if ((t = datePart.match(/^(\d{1,2})[ \-/]([A-Za-z]+)[ \-/,]+(\d{2}|\d{4})$/))) {
    const monthNo = MONTHS[t[2].slice(0, 3).toLowerCase()]
    if (!monthNo) return null
    d = Number(t[1]); mo = monthNo
    y = t[3].length === 2 ? 2000 + Number(t[3]) : Number(t[3])
  } else {
    return null
  }
  if (!validDate(y, mo, d)) return null
  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mi)}:${pad(ss)}+07:00`
}

// ───────────────────────────── Deteksi layout ─────────────────────────────

const HEADER_HINTS: Array<[keyof StatementColumnMapping, RegExp]> = [
  ['credit', /^(kredit|credit|cr|uang masuk|mutasi kredit|masuk)$/],
  ['debit', /^(debet|debit|db|uang keluar|mutasi debet|mutasi debit|keluar)$/],
  ['balanceBefore', /^(saldo awal|saldo sebelum|opening balance)/],
  ['balance', /^(saldo|balance)/],
  ['type', /^(tipe|jenis|type|d\/k|dk|cr\/db|db\/cr)$/],
  ['amount', /^(nominal|jumlah|amount|mutasi)$/],
  ['reference', /(ref|trx id|id transaksi|no\.? transaksi|nomor transaksi)/],
  ['description', /(keterangan|uraian|remark|deskripsi|description|berita|narasi|transaksi)/],
  ['time', /^(jam|time|pukul)$/],
  ['date', /(tanggal|tgl|date|waktu)/],
]

export interface DetectedLayout {
  headerRowIndex: number
  headers: string[]
  mapping: Partial<StatementColumnMapping>
}

export function detectStatementLayout(table: string[][]): DetectedLayout {
  let best: DetectedLayout = { headerRowIndex: -1, headers: [], mapping: {} }
  let bestScore = 0
  for (let r = 0; r < Math.min(table.length, 20); r++) {
    const headers = table[r]
    const mapping: Partial<StatementColumnMapping> = {}
    headers.forEach((h, idx) => {
      const name = h.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (!name) return
      for (const [key, re] of HEADER_HINTS) {
        if (mapping[key] === undefined && re.test(name)) {
          mapping[key] = idx
          break
        }
      }
    })
    const score = Object.keys(mapping).length
    if (mapping.date !== undefined && score > bestScore) {
      bestScore = score
      best = { headerRowIndex: r, headers, mapping }
    }
  }
  return best
}

export function validateMapping(mapping: StatementColumnMapping, columnCount: number): string | null {
  const used = Object.entries(mapping).filter(([, v]) => v !== undefined) as Array<[string, number]>
  for (const [key, idx] of used) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= columnCount) return `Kolom "${key}" di luar jangkauan berkas.`
  }
  if (mapping.date === undefined) return 'Kolom tanggal wajib dipilih.'
  const twoCol = mapping.credit !== undefined && mapping.debit !== undefined
  const oneCol = mapping.amount !== undefined
  if (twoCol === oneCol) {
    return 'Pilih salah satu: kolom Kredit + Debit, atau satu kolom Nominal.'
  }
  if (!twoCol && (mapping.credit !== undefined || mapping.debit !== undefined)) {
    return 'Mode dua kolom memerlukan kolom Kredit dan Debit sekaligus.'
  }
  return null
}

// ───────────────────────────── Parsing baris ─────────────────────────────

function normalizeType(raw: string): 'CREDIT' | 'DEBIT' | null {
  const t = raw.trim().toUpperCase()
  if (['CR', 'C', 'K', 'KREDIT', 'CREDIT'].includes(t)) return 'CREDIT'
  if (['DB', 'DR', 'D', 'DEBET', 'DEBIT'].includes(t)) return 'DEBIT'
  return null
}

function cell(row: string[], idx: number | undefined): string {
  return idx === undefined ? '' : (row[idx] ?? '').trim()
}

export function parseStatementRows(
  table: string[][],
  mapping: StatementColumnMapping,
  options: StatementParseOptions,
  accountNo: string
): StatementParseResult {
  const result: StatementParseResult = {
    lines: [], errors: [], ignoredRows: 0,
    creditCount: 0, creditTotal: 0, debitCount: 0, debitTotal: 0,
    fromDateTime: null, toDateTime: null, balanceChain: 'UNAVAILABLE',
  }
  const width = table.reduce((w, r) => Math.max(w, r.length), 0)
  const mappingError = validateMapping(mapping, width)
  if (mappingError) {
    result.errors.push({ row: 0, message: mappingError })
    return result
  }

  const start = options.headerRowIndex + 1
  const dataRows = table.slice(start)
  if (dataRows.length > MAX_STATEMENT_ROWS) {
    result.errors.push({ row: 0, message: `Berkas melebihi batas ${MAX_STATEMENT_ROWS} baris.` })
    return result
  }

  const occurrences = new Map<string, number>()
  const twoCol = mapping.credit !== undefined && mapping.debit !== undefined

  dataRows.forEach((row, i) => {
    const rowNumber = start + i + 1
    const fail = (message: string) => result.errors.push({ row: rowNumber, message })

    const dateRaw = cell(row, mapping.date)
    const amountCells = twoCol
      ? [cell(row, mapping.credit), cell(row, mapping.debit)]
      : [cell(row, mapping.amount)]
    if (row.every((c) => c.trim() === '')) return
    if (dateRaw === '' && amountCells.every((c) => c === '')) {
      result.ignoredRows++ // baris pembatas/ringkasan tanpa tanggal & nominal
      return
    }
    if (dateRaw === '') {
      // Baris ringkasan/penutup ("Total", "Saldo Akhir") tanpa tanggal diabaikan; pemeriksaan total kredit operator
      // tetap menangkap bila ada mutasi sungguhan yang ikut terlewat. Baris bernominal lain tanpa tanggal = error.
      if (/\b(total|jumlah|sub ?total|saldo|summary|ringkasan)\b/i.test(row.join(' '))) {
        result.ignoredRows++
        return
      }
      return fail('tanggal kosong pada baris bernominal')
    }

    const timeRaw = cell(row, mapping.time)
    const iso = parseStatementDateTime(timeRaw ? `${dateRaw} ${timeRaw}` : dateRaw, options.dateOrder)
    if (!iso) return fail(`tanggal "${dateRaw}${timeRaw ? ' ' + timeRaw : ''}" tidak dikenali`)

    let type: 'CREDIT' | 'DEBIT'
    let amount: number
    if (twoCol) {
      const cr = amountCells[0] === '' ? { ok: true as const, value: 0, negative: false } : parseRupiahCell(amountCells[0])
      const db = amountCells[1] === '' ? { ok: true as const, value: 0, negative: false } : parseRupiahCell(amountCells[1])
      if (!cr.ok) return fail(`kolom kredit: ${cr.error}`)
      if (!db.ok) return fail(`kolom debit: ${db.error}`)
      if (cr.negative || db.negative) return fail('nominal bernilai negatif pada mode dua kolom')
      if (cr.value > 0 && db.value > 0) return fail('kredit dan debit terisi bersamaan')
      if (cr.value === 0 && db.value === 0) return fail('nominal kredit/debit kosong atau nol')
      type = cr.value > 0 ? 'CREDIT' : 'DEBIT'
      amount = cr.value > 0 ? cr.value : db.value
    } else {
      const a = parseRupiahCell(amountCells[0])
      if (!a.ok) return fail(a.error)
      if (a.value === 0) return fail('nominal nol')
      if (mapping.type !== undefined) {
        const t = normalizeType(cell(row, mapping.type))
        if (!t) return fail(`tipe "${cell(row, mapping.type)}" tidak dikenali (gunakan CR/DB, K/D, Kredit/Debit)`)
        if (a.negative) return fail('nominal negatif tidak boleh dikombinasikan dengan kolom tipe')
        type = t
      } else {
        type = a.negative ? 'DEBIT' : 'CREDIT'
      }
      amount = a.value
    }

    const readBalance = (idx: number | undefined): number | null => {
      const raw = cell(row, idx)
      if (raw === '') return null
      const b = parseRupiahCell(raw)
      return b.ok && !b.negative ? b.value : null
    }
    const balance = readBalance(mapping.balance)
    const balanceBefore = readBalance(mapping.balanceBefore)
    const remark = cell(row, mapping.description)
    const reference = cell(row, mapping.reference) || null

    const base = [accountNo, iso, type, amount, remark.toLowerCase(), balanceBefore ?? '', balance ?? '', reference ?? ''].join('|')
    const seen = occurrences.get(base) ?? 0
    occurrences.set(base, seen + 1)
    const transactionId =
      'CSV-' + crypto.createHash('sha256').update(`${base}|${seen}`, 'utf8').digest('hex').slice(0, 32)

    result.lines.push({ rowNumber, transactionDate: iso, type, amount, remark, balance, balanceBefore, reference, transactionId })
    if (type === 'CREDIT') {
      result.creditCount++
      result.creditTotal += amount
    } else {
      result.debitCount++
      result.debitTotal += amount
    }
  })

  verifyBalanceChain(result)

  if (result.lines.length > 0) {
    const sorted = result.lines.map((l) => l.transactionDate).sort()
    result.fromDateTime = `${sorted[0].slice(0, 10)}T00:00:00+07:00`
    result.toDateTime = `${sorted[sorted.length - 1].slice(0, 10)}T23:59:59+07:00`
  } else if (result.errors.length === 0) {
    result.errors.push({ row: 0, message: 'Tidak ada baris mutasi yang dapat dibaca.' })
  }
  return result
}

/**
 * Verifikasi keutuhan berkas dari kolom saldo: setiap baris (saldo awal ± mutasi = saldo akhir) dan antar-baris
 * (saldo akhir baris sebelumnya = saldo awal baris berikutnya; urutan lama→baru atau baru→lama). Baris hilang,
 * terduplikasi, atau terubah akan memutus rantai → impor ditolak. Tanpa kolom saldo → UNAVAILABLE (operator
 * wajib mengonfirmasi total kredit secara manual).
 */
function verifyBalanceChain(result: StatementParseResult): void {
  const lines = result.lines
  if (lines.length === 0 || result.errors.length > 0) return
  if (!lines.every((l) => l.balance !== null && l.balanceBefore !== null)) return

  for (const l of lines) {
    const expected = (l.balanceBefore as number) + (l.type === 'CREDIT' ? l.amount : -l.amount)
    if (expected !== l.balance) {
      result.errors.push({ row: l.rowNumber, message: 'saldo tidak konsisten (saldo awal ± mutasi ≠ saldo akhir)' })
      return
    }
  }
  const ascendingBreak = lines.findIndex((l, i) => i > 0 && lines[i - 1].balance !== l.balanceBefore)
  if (ascendingBreak === -1) {
    result.balanceChain = 'VERIFIED'
    return
  }
  const descendingBreak = lines.findIndex((l, i) => i > 0 && l.balance !== lines[i - 1].balanceBefore)
  if (descendingBreak === -1) {
    result.balanceChain = 'VERIFIED'
    return
  }
  result.errors.push({
    row: lines[ascendingBreak].rowNumber,
    message: 'rantai saldo terputus: ada baris hilang, ganda, atau urutan berubah',
  })
}
