// Render & validasi redaksi notifikasi. Murni (tanpa runtime import).

import type { NotifEventDefinition, NotifPayload, PlaceholderDef, PushPrivacy } from './types'

export const TITLE_MAX = 120
export const BODY_MAX = 500
const PLACEHOLDER_RE = /\{([a-z_][a-z0-9_]*)\}/g
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Nominal internal selalu integer Rupiah; nilai non-integer tidak dibulatkan diam-diam. */
export function formatRupiahExact(value: unknown): string {
  const n = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) return '-'
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '-' : ''}Rp${abs}`
}

function formatWib(value: unknown, withTime: boolean): string {
  if (typeof value !== 'string' || !value.trim()) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }
  const text = new Intl.DateTimeFormat('id-ID', opts).format(date)
  return withTime ? `${text} WIB` : text
}

function formatValue(def: PlaceholderDef, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  switch (def.format) {
    case 'rupiah': return formatRupiahExact(value)
    case 'date': return formatWib(value, false)
    case 'datetime': return formatWib(value, true)
    default: return String(value)
  }
}

function clean(text: string, max: number): string {
  const collapsed = text.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed
}

export function renderTemplate(template: string, def: NotifEventDefinition, payload: NotifPayload, max = BODY_MAX): string {
  const byKey = new Map(def.placeholders.map(p => [p.key, p]))
  const text = template.replace(PLACEHOLDER_RE, (match, key: string) => {
    const placeholder = byKey.get(key)
    return placeholder ? formatValue(placeholder, payload[key]) : match
  })
  return clean(text, max)
}

export interface RenderedNotification {
  title: string
  body: string
  pushBody: string
}

export function renderNotification(
  def: NotifEventDefinition,
  templates: { title: string; inApp: string; push: string; pushPrivacy: PushPrivacy },
  payload: NotifPayload,
): RenderedNotification {
  const title = renderTemplate(templates.title, def, payload, TITLE_MAX)
  const body = renderTemplate(templates.inApp, def, payload, BODY_MAX)
  // FULL: layar kunci menampilkan isi lengkap. MASKED: redaksi push khusus tanpa data sensitif.
  const pushBody = templates.pushPrivacy === 'FULL' ? body : renderTemplate(templates.push, def, payload, BODY_MAX)
  return { title, body, pushBody }
}

export function templatePlaceholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER_RE)].map(m => m[1])
}

/** Mengembalikan pesan kesalahan berbahasa Indonesia; array kosong = valid. */
export function validateTemplates(
  def: NotifEventDefinition,
  templates: { title: string; inApp: string; push: string; pushPrivacy: PushPrivacy },
): string[] {
  const errors: string[] = []
  const known = new Set(def.placeholders.map(p => p.key))
  const sensitive = new Set(def.placeholders.filter(p => p.sensitive).map(p => p.key))
  const fields: Array<[string, string, number]> = [
    ['Judul', templates.title, TITLE_MAX],
    ['Isi notifikasi', templates.inApp, BODY_MAX],
    ['Isi push', templates.push, BODY_MAX],
  ]
  for (const [label, value, max] of fields) {
    if (!value.trim()) errors.push(`${label} wajib diisi.`)
    if (value.length > max) errors.push(`${label} maksimal ${max} karakter.`)
    const unknown = templatePlaceholders(value).filter(k => !known.has(k))
    if (unknown.length) errors.push(`${label} memakai placeholder tidak dikenal: ${[...new Set(unknown)].map(k => `{${k}}`).join(', ')}.`)
  }
  // Judul push selalu tampil di layar kunci; jangan muat data sensitif saat MASKED.
  if (templates.pushPrivacy === 'MASKED') {
    for (const [label, value] of [['Judul', templates.title], ['Isi push', templates.push]] as const) {
      const leaked = templatePlaceholders(value).filter(k => sensitive.has(k))
      if (leaked.length) errors.push(`${label} tidak boleh memuat data sensitif saat push disamarkan: ${[...new Set(leaked)].map(k => `{${k}}`).join(', ')}.`)
    }
  }
  return errors
}

/** Tautan internal saja: path relatif tanpa skema/host, mencegah open redirect. */
export function safeInternalLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string') return null
  const value = link.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if (/[\s<>"']/.test(value)) return null
  return value.slice(0, 300)
}
