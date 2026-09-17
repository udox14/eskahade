'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Warning } from '@phosphor-icons/react'
import { issueCredentialAction, markCredentialAction } from './actions'

type CredentialState = 'REISSUE' | 'ACTIVE' | 'BLOCKED' | 'LOST' | 'REVOKED'

const PRESENTATION: Record<CredentialState, {
  label: string
  confirmLabel: string
  tone: 'neutral' | 'warning' | 'danger'
  impact: string
}> = {
  REISSUE: {
    label: 'Kartu pengganti',
    confirmLabel: 'Terbitkan kartu pengganti',
    tone: 'warning',
    impact: 'Kartu aktif sebelumnya dicabut dan tidak dapat digunakan lagi.',
  },
  ACTIVE: {
    label: 'Buka blokir',
    confirmLabel: 'Buka blokir kartu',
    tone: 'neutral',
    impact: 'Kartu dapat digunakan kembali setelah perubahan disimpan.',
  },
  BLOCKED: {
    label: 'Blokir',
    confirmLabel: 'Blokir kartu',
    tone: 'warning',
    impact: 'Kartu tidak dapat digunakan sampai blokir dibuka kembali.',
  },
  LOST: {
    label: 'Tandai hilang',
    confirmLabel: 'Tandai kartu hilang',
    tone: 'danger',
    impact: 'Status hilang bersifat terminal; kartu ini tidak dapat diaktifkan kembali.',
  },
  REVOKED: {
    label: 'Cabut',
    confirmLabel: 'Cabut kartu',
    tone: 'danger',
    impact: 'Pencabutan bersifat terminal; kartu ini tidak dapat digunakan atau diaktifkan kembali.',
  },
}

export function CredentialActions({ id, santriId, status }: { id: string; santriId: string; status: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [next, setNext] = useState<CredentialState>('BLOCKED')
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()
  const terminal = ['LOST', 'REVOKED'].includes(status)
  const actions: CredentialState[] = [
    'REISSUE',
    ...(terminal ? [] : [status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED', 'LOST', 'REVOKED'] as CredentialState[]),
  ]
  const selected = PRESENTATION[next]

  const toneClass = (tone: 'neutral' | 'warning' | 'danger') => ({
    neutral: 'border-slate-300 text-slate-800 hover:bg-slate-50',
    warning: 'border-amber-500 text-amber-900 hover:bg-amber-50',
    danger: 'border-red-500 text-red-800 hover:bg-red-50',
  }[tone])

  return <>
    <div className="flex flex-wrap gap-2">
      {actions.map(value => {
        const item = PRESENTATION[value]
        return <button
          type="button"
          key={value}
          className={'min-h-11 rounded-md border px-3 text-sm font-semibold ' + toneClass(item.tone)}
          onClick={() => {
            setNext(value)
            setError('')
            dialog.current?.showModal()
          }}
        >
          {item.label}
        </button>
      })}
    </div>
    <dialog ref={dialog} className="m-auto w-full max-w-md rounded-xl p-5 backdrop:bg-black/40">
      <form onSubmit={event => {
        event.preventDefault()
        const reason = String(new FormData(event.currentTarget).get('reason') || '')
        start(async () => {
          try {
            const response = next === 'REISSUE'
              ? await issueCredentialAction({ santriId, kind: 'QR_STATIC', reissue: true })
              : await markCredentialAction(id, next, reason)
            if ('error' in response) {
              setError(response.error || 'Perubahan kartu gagal.')
              return
            }
            dialog.current?.close()
            router.refresh()
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Perubahan kartu gagal.')
          }
        })
      }}>
        <div className="flex items-start gap-3">
          <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-lg ' + (
            selected.tone === 'danger' ? 'bg-red-50 text-red-700' : selected.tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
          )}>
            <Warning className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-bold">{selected.label}</h3>
            <p className="mt-1 text-sm text-slate-600">{selected.impact}</p>
          </div>
        </div>
        <label className="mt-4 block text-sm font-semibold">
          Alasan
          <textarea name="reason" required minLength={5} className="mt-2 min-h-24 w-full rounded-md border border-slate-300 p-3" />
        </label>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4 font-semibold">Batal</button>
          <button
            disabled={pending}
            className={'min-h-11 rounded-md px-4 font-semibold text-white disabled:opacity-50 ' + (
              selected.tone === 'danger' ? 'bg-red-700' : selected.tone === 'warning' ? 'bg-amber-700' : 'bg-slate-800'
            )}
          >
            {pending ? 'Memproses...' : selected.confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  </>
}
