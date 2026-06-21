'use client'

/**
 * Adapter toast — API kompatibel `sonner`, di-backing `@mantine/notifications`.
 *
 * Tujuan: ganti semua `import { toast } from 'sonner'` → `from '@/lib/toast'`
 * tanpa mengubah call-site. Mendukung pola yang dipakai di repo:
 *   toast.success(msg, { description })
 *   toast.error(msg, { description })
 *   const id = toast.loading('...')   // return id
 *   toast.dismiss(id)
 *   toast.success('done', { id })     // replace toast loading (update)
 *   toast.warning / toast.info / toast(msg)
 *   toast.info(msg, { description, duration: Infinity, action: { label, onClick }, onDismiss })
 */

import { createElement, type ReactNode } from 'react'
import { notifications } from '@mantine/notifications'

export interface ToastAction {
  label: ReactNode
  onClick: () => void
}

export interface ToastOptions {
  /** Pengganti loading/toast lain dengan id yang sama (replace) */
  id?: string
  /** Teks detail di bawah judul */
  description?: ReactNode
  /** Durasi auto-close (ms); Infinity = tampil terus, seperti sonner */
  duration?: number
  /** Tombol aksi di dalam notifikasi */
  action?: ToastAction
  /** Dipanggil saat notifikasi ditutup */
  onDismiss?: () => void
}

type Variant = 'success' | 'error' | 'warning' | 'info' | 'default'

const COLOR: Record<Variant, string | undefined> = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  default: 'gray',
}

let seq = 0
const genId = () => `toast-${Date.now()}-${seq++}`

function withAction(content: ReactNode, action?: ToastAction): ReactNode {
  if (!action) return content
  return createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' } },
    content,
    createElement(
      'button',
      {
        type: 'button',
        onClick: action.onClick,
        style: {
          cursor: 'pointer',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
          background: 'var(--mantine-color-blue-6)',
        },
      },
      action.label,
    ),
  )
}

function buildPayload(variant: Variant, message: ReactNode, opts: ToastOptions, id: string) {
  const hasDesc = opts.description != null && opts.description !== ''
  const autoClose =
    opts.duration === Infinity ? false : (opts.duration ?? (variant === 'error' ? 5000 : 3500))
  return {
    id,
    color: COLOR[variant],
    loading: false,
    title: hasDesc ? message : undefined,
    message: withAction(hasDesc ? opts.description : message, opts.action),
    autoClose,
    withCloseButton: true,
    onClose: opts.onDismiss,
  }
}

function fire(variant: Variant, message: ReactNode, opts: ToastOptions = {}): string {
  if (opts.id) {
    // Replace notifikasi yang sudah ada (mis. loading → hasil akhir)
    notifications.update(buildPayload(variant, message, opts, opts.id))
    return opts.id
  }
  const id = genId()
  notifications.show(buildPayload(variant, message, opts, id))
  return id
}

function loading(message: ReactNode, opts: ToastOptions = {}): string {
  const id = opts.id ?? genId()
  const payload = {
    id,
    loading: true,
    message,
    autoClose: false as const,
    withCloseButton: false,
    onClose: opts.onDismiss,
  }
  if (opts.id) notifications.update(payload)
  else notifications.show(payload)
  return id
}

function dismiss(id?: string): void {
  if (id != null) notifications.hide(String(id))
  else notifications.clean()
}

export const toast = Object.assign(
  (message: ReactNode, opts?: ToastOptions) => fire('default', message, opts),
  {
    success: (message: ReactNode, opts?: ToastOptions) => fire('success', message, opts),
    error:   (message: ReactNode, opts?: ToastOptions) => fire('error', message, opts),
    warning: (message: ReactNode, opts?: ToastOptions) => fire('warning', message, opts),
    info:    (message: ReactNode, opts?: ToastOptions) => fire('info', message, opts),
    loading,
    dismiss,
  },
)
