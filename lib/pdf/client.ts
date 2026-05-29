'use client'

import { useCallback } from 'react'
import { useReactToPrint as useNativeReactToPrint } from 'react-to-print'

type PrintContentRef = {
  current: Element | Text | null
}

type PdfOptions = Record<string, unknown>

type ReactToPrintCompatOptions = {
  contentRef?: PrintContentRef
  documentTitle?: string
  pageStyle?: string
  onBeforePrint?: () => void | Promise<void>
  onAfterPrint?: () => void
  onPrintError?: (errorLocation?: unknown, error?: unknown) => void
  pdfOptions?: PdfOptions
  filename?: string
  [key: string]: unknown
}

const MAX_CLIENT_HTML_SIZE = 45 * 1024 * 1024

export function isMobileLikeViewport() {
  if (typeof window === 'undefined') return false
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const narrowViewport = window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768
  return coarsePointer || narrowViewport
}

function safeFilename(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'dokumen'
}

function getNodeHtml(node: Element | Text) {
  if (node instanceof Element) return node.outerHTML
  const wrapper = document.createElement('div')
  wrapper.textContent = node.textContent || ''
  return wrapper.outerHTML
}

function collectCurrentPageStyles() {
  const parts: string[] = []

  document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
    const href = (link as HTMLLinkElement).href
    if (href) parts.push(`<link rel="stylesheet" href="${href}">`)
  })

  document.querySelectorAll('style').forEach(style => {
    parts.push(`<style>${style.textContent || ''}</style>`)
  })

  return parts.join('\n')
}

function buildPdfHtml(contentHtml: string, title: string, pageStyle?: string) {
  const style = pageStyle ? `<style>${pageStyle}</style>` : ''

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title.replace(/[<>&"]/g, '')}</title>
  ${collectCurrentPageStyles()}
  ${style}
</head>
<body>
  ${contentHtml}
</body>
</html>`
}

function resolveFilename(filename?: string, documentTitle?: string) {
  const base = filename || documentTitle || 'dokumen'
  return safeFilename(base.endsWith('.pdf') ? base.slice(0, -4) : base) + '.pdf'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadPdfFromHtml({
  contentRef,
  documentTitle,
  filename,
  pageStyle,
  pdfOptions,
}: {
  contentRef?: PrintContentRef
  documentTitle?: string
  filename?: string
  pageStyle?: string
  pdfOptions?: PdfOptions
}) {
  const node = contentRef?.current
  if (!node) throw new Error('Area cetak belum siap.')

  const title = documentTitle || filename || document.title || 'Dokumen'
  const html = buildPdfHtml(getNodeHtml(node), title, pageStyle)
  if (html.length > MAX_CLIENT_HTML_SIZE) {
    throw new Error('Dokumen terlalu besar untuk dibuat PDF dari perangkat ini.')
  }

  const response = await fetch('/api/pdf/from-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      title,
      filename: resolveFilename(filename, documentTitle),
      pageStyle,
      pdfOptions,
    }),
  })

  if (!response.ok) {
    let message = 'Gagal membuat PDF.'
    try {
      const payload = await response.json()
      if (payload?.error) message = payload.error
    } catch {}
    throw new Error(message)
  }

  const blob = await response.blob()
  downloadBlob(blob, resolveFilename(filename, documentTitle))
}

export function useMobilePdfDownload(options: ReactToPrintCompatOptions) {
  return useCallback(async () => {
    await downloadPdfFromHtml({
      contentRef: options.contentRef,
      documentTitle: options.documentTitle,
      filename: options.filename,
      pageStyle: options.pageStyle,
      pdfOptions: options.pdfOptions,
    })
  }, [options.contentRef, options.documentTitle, options.filename, options.pageStyle, options.pdfOptions])
}

export function printOrDownloadPdf({
  nativePrint,
  downloadPdf,
}: {
  nativePrint: () => void
  downloadPdf: () => Promise<void>
}) {
  if (isMobileLikeViewport()) {
    void downloadPdf()
    return
  }

  nativePrint()
}

export function useReactToPrint(options: ReactToPrintCompatOptions) {
  const nativePrint = useNativeReactToPrint(options as any)
  const downloadPdf = useMobilePdfDownload(options)

  return useCallback(async () => {
    if (!isMobileLikeViewport()) {
      nativePrint()
      return
    }

    try {
      await options.onBeforePrint?.()
      await downloadPdf()
      options.onAfterPrint?.()
    } catch (error) {
      options.onPrintError?.('mobile-pdf', error)
      if (!options.onPrintError) throw error
    }
  }, [downloadPdf, nativePrint, options])
}
