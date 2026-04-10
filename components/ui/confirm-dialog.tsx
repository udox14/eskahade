'use client'

import React, {
  useEffect, useRef, useState, useCallback,
  createContext, useContext,
} from 'react'
import { AlertTriangle, Trash2, Info, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type DialogVariant = 'danger' | 'warning' | 'success' | 'info'

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

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

const VARIANT_CONFIG: Record<DialogVariant, {
  icon: React.ElementType
  iconClass: string
  buttonVariant: 'default' | 'destructive' | 'secondary' | 'outline'
  label: string
}> = {
  danger: {
    icon: Trash2,
    iconClass: 'text-destructive bg-destructive/10',
    buttonVariant: 'destructive',
    label: 'Ya, Hapus',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600 bg-amber-100 dark:text-amber-500 dark:bg-amber-500/10',
    buttonVariant: 'default', // standard button but maybe we can use custom color, we'll stick to default for simplicity
    label: 'Ya, Lanjutkan',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-emerald-600 bg-emerald-100 dark:text-emerald-500 dark:bg-emerald-500/10',
    buttonVariant: 'default',
    label: 'Ya, Simpan',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600 bg-blue-100 dark:text-blue-500 dark:bg-blue-500/10',
    buttonVariant: 'default',
    label: 'Ya, Lanjutkan',
  },
}

interface State {
  open: boolean
  message: string
  options: ConfirmOptions
  resolve: ((v: boolean) => void) | null
}
const CLOSED: State = { open: false, message: '', options: {}, resolve: null }

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(CLOSED)
  const btnRef    = useRef<HTMLButtonElement>(null)

  const show = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise(resolve => setS({ open: true, message, options, resolve }))
  }, [])

  useEffect(() => {
    ;(window as any).__confirmDialog = show
    return () => { delete (window as any).__confirmDialog }
  }, [show])

  // Focus the confirm button automatically when opened
  useEffect(() => {
    let focusTimer: NodeJS.Timeout
    if (s.open) {
      focusTimer = setTimeout(() => {
        btnRef.current?.focus()
      }, 50)
    }
    return () => clearTimeout(focusTimer)
  }, [s.open])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      s.resolve?.(false)
      setS(CLOSED)
    }
  }

  const confirm = useCallback(() => { s.resolve?.(true);  setS(CLOSED) }, [s])
  const cancel  = useCallback(() => { s.resolve?.(false); setS(CLOSED) }, [s])

  const variant      = s.options.variant ?? detectVariant(s.message)
  const cfg          = VARIANT_CONFIG[variant]
  const Icon         = cfg.icon
  const { title, body } = parseMessage(s.message)
  const confirmLabel = s.options.confirmLabel ?? cfg.label
  const cancelLabel  = s.options.cancelLabel  ?? 'Batal'
  const displayTitle = s.options.title        ?? title

  return (
    <ConfirmContext.Provider value={show}>
      {children}
      <Dialog open={s.open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden outline-none">
          {/* Accent semantic top bar optional, here we just use pure Shadcn design */}
          <div className="p-5 pb-4">
            <DialogHeader className="flex flex-row gap-4 items-start sm:text-left space-y-0">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                cfg.iconClass
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1.5 mt-0.5">
                <DialogTitle className="leading-snug text-[15px]">
                  {displayTitle}
                </DialogTitle>
                {body && (
                  <DialogDescription className="text-sm">
                    {body}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>
          </div>
          <DialogFooter className="px-5 pb-5">
            <div className="flex w-full gap-2.5 sm:justify-end">
              <Button 
                variant="outline" 
                onClick={cancel} 
                className="flex-1 sm:flex-none"
              >
                {cancelLabel}
              </Button>
              <Button 
                ref={btnRef}
                variant={cfg.buttonVariant} 
                className="flex-1 sm:flex-none"
                onClick={confirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  return useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    if (ctx) return ctx(message, options)
    if (typeof window !== 'undefined' && (window as any).__confirmDialog) {
      return (window as any).__confirmDialog(message, options)
    }
    return Promise.resolve(window.confirm(message))
  }, [ctx])
}
