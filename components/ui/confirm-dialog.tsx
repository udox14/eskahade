'use client'

/**
 * useConfirm — pengganti window.confirm berbasis modal Mantine.
 *
 * API TIDAK BERUBAH (kompatibel dengan ~100 call-site lama):
 *
 *   const confirm = useConfirm()
 *   const handleHapus = async () => {
 *     if (!await confirm('Hapus data ini?')) return
 *     await deleteData(id)
 *   }
 *
 * ConfirmDialogProvider dipertahankan sebagai passthrough agar import lama
 * (jika ada) tidak rusak. Modal Mantine dirender via <ModalsProvider> yang
 * sudah dipasang di app/layout.tsx — tidak perlu provider tambahan.
 */

import { useCallback } from 'react'
import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type DialogVariant = 'danger' | 'warning' | 'success' | 'info'

export interface ConfirmOptions {
  /** Override teks judul (default: diekstrak dari message) */
  title?: string
  /** Override label tombol konfirmasi */
  confirmLabel?: string
  /** Override label tombol batal */
  cancelLabel?: string
  /** Override variant warna */
  variant?: DialogVariant
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detect variant dari pesan (logika sama seperti versi lama)
// ─────────────────────────────────────────────────────────────────────────────
function detectVariant(msg: string): DialogVariant {
  const m = msg.toLowerCase()
  if (
    m.includes('hapus') || m.includes('permanen') || m.includes('tidak bisa dibatalkan') ||
    m.includes('reset') || m.includes('dihapus') || m.includes('alumni') || m.includes('⚠️')
  ) return 'danger'
  if (
    m.includes('yakin') || m.includes('pastikan') || m.includes('vonis') ||
    m.includes('telat') || m.includes('peringatan')
  ) return 'warning'
  if (
    m.includes('simpan') || m.includes('bayar') || m.includes('proses') ||
    m.includes('aktifkan') || m.includes('naik') || m.includes('restore') ||
    m.includes('kembalikan') || m.includes('import') || m.includes('apply') ||
    m.includes('terima') || m.includes('serahkan') || m.includes('lunasi')
  ) return 'success'
  return 'info'
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse message → title + body
// ─────────────────────────────────────────────────────────────────────────────
function parseMessage(raw: string) {
  const cleaned = raw.replace(/^[⚠️❗✅ℹ️\s]+/, '').trim()
  const lines   = cleaned.split('\n')
  const title   = lines[0].trim()
  const body    = lines.slice(1).join('\n').trim()
  return {
    title: title.length > 90 ? title.slice(0, 87) + '…' : title,
    body,
  }
}

// Variant → warna tombol Mantine + label default
const VARIANT: Record<DialogVariant, { color: string; label: string }> = {
  danger:  { color: 'red',   label: 'Ya, Hapus' },
  warning: { color: 'yellow', label: 'Ya, Lanjutkan' },
  success: { color: 'green', label: 'Ya, Simpan' },
  info:    { color: 'dark',  label: 'Ya, Lanjutkan' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider — passthrough (kompat mundur; modal dirender oleh ModalsProvider)
// ─────────────────────────────────────────────────────────────────────────────
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useConfirm(): ConfirmFn {
  return useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    const variant = options.variant ?? detectVariant(message)
    const cfg = VARIANT[variant]
    const { title, body } = parseMessage(message)

    return new Promise<boolean>((resolve) => {
      let settled = false
      const done = (v: boolean) => { if (!settled) { settled = true; resolve(v) } }
      modals.openConfirmModal({
        title: options.title ?? title,
        children: body ? <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{body}</Text> : null,
        labels: {
          confirm: options.confirmLabel ?? cfg.label,
          cancel: options.cancelLabel ?? 'Batal',
        },
        confirmProps: { color: cfg.color },
        onConfirm: () => done(true),
        onCancel: () => done(false),
        onClose: () => done(false),
      })
    })
  }, [])
}
