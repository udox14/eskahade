import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

const MAX_HTML_BYTES = 50 * 1024 * 1024
const PDF_ENDPOINT_BASE = 'https://api.cloudflare.com/client/v4/accounts'

type PdfRequestBody = {
  html?: unknown
  title?: unknown
  filename?: unknown
  pageStyle?: unknown
  pdfOptions?: unknown
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function withBaseHref(html: string, origin: string) {
  if (/<base\b/i.test(html)) return html

  const baseTag = `<base href="${escapeHtmlAttribute(origin.replace(/\/$/, ''))}/">`
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, match => `${match}\n  ${baseTag}`)
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`
}

function cleanFilename(input: unknown) {
  const value = typeof input === 'string' ? input : 'dokumen.pdf'
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const withExtension = cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'dokumen'}.pdf`
  return withExtension
}

function getEnv(name: string) {
  return process.env[name]?.trim() || ''
}

function normalizePdfOptions(value: unknown) {
  const options = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    printBackground: true,
    preferCSSPageSize: true,
    ...options,
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  }

  let body: PdfRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload PDF tidak valid.' }, { status: 400 })
  }

  if (typeof body.html !== 'string' || body.html.trim().length === 0) {
    return NextResponse.json({ error: 'HTML dokumen tidak boleh kosong.' }, { status: 400 })
  }

  const htmlBytes = new TextEncoder().encode(body.html).byteLength
  if (htmlBytes > MAX_HTML_BYTES) {
    return NextResponse.json({ error: 'HTML dokumen terlalu besar untuk dibuat PDF.' }, { status: 413 })
  }

  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID')
  const apiToken = getEnv('CLOUDFLARE_BROWSER_RENDERING_API_TOKEN')
  if (!accountId || !apiToken) {
    return NextResponse.json(
      { error: 'Konfigurasi Cloudflare Browser Run belum lengkap.' },
      { status: 500 }
    )
  }

  const html = withBaseHref(sanitizeHtml(body.html), new URL(request.url).origin)
  const filename = cleanFilename(body.filename)

  const upstream = await fetch(`${PDF_ENDPOINT_BASE}/${accountId}/browser-rendering/pdf`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      html,
      pdfOptions: normalizePdfOptions(body.pdfOptions),
    }),
  })

  if (!upstream.ok) {
    let detail = 'Cloudflare Browser Run gagal membuat PDF.'
    try {
      const payload = await upstream.json()
      detail = payload?.errors?.[0]?.message || payload?.error || detail
    } catch {}
    return NextResponse.json({ error: detail }, { status: upstream.status })
  }

  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  headers.set('Cache-Control', 'no-store')

  const browserMsUsed = upstream.headers.get('X-Browser-Ms-Used')
  if (browserMsUsed) headers.set('X-Browser-Ms-Used', browserMsUsed)

  return new Response(upstream.body, { status: 200, headers })
}
