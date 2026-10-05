'use client'

import { useEffect, useRef, useState } from 'react'
import type { Activity } from '@/lib/supervisi/types'
import { prepareActivityDeletion, deleteActivity } from './actions'
import { inputClass, secondaryClass } from '@/components/supervisi/styles'
import { Trash, WarningCircle, CircleNotch, X } from '@phosphor-icons/react'

export default function DeleteActivity({
  activity,
  onClose,
  onDeleted,
}: {
  activity: Activity
  onClose: () => void
  onDeleted: () => Promise<void>
}) {
  const [stage, setStage] = useState(1)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [request, setRequest] = useState<{ token: string; total: number; selesai: number } | null>(
    null
  )
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [stage])

  async function next() {
    setBusy(true)
    setError('')
    try {
      const result = await prepareActivityDeletion(activity.id, activity.revision)
      if (result.ok) {
        setRequest(result.data)
        setStage(2)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Konfirmasi belum dapat dimuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!request) return
    setBusy(true)
    setError('')
    try {
      const result = await deleteActivity(activity.id, activity.revision, request.token, name)
      if (result.ok) {
        await onDeleted()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Penghapusan belum dapat dipastikan. Muat ulang untuk memeriksa kegiatan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      key={stage}
      ref={dialog}
      aria-labelledby="delete-title"
      onCancel={(e) => {
        if (busy) e.preventDefault()
        else onClose()
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Trash className="w-5 h-5" weight="duotone" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
              Konfirmasi {stage} dari 2
            </span>
            <h2 id="delete-title" className="text-base font-bold text-slate-900">
              {stage === 1 ? 'Hapus Kegiatan Supervisi?' : 'Konfirmasi Hapus Permanen'}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <p>
          Kegiatan <strong className="text-slate-900 font-semibold">{activity.nama}</strong> beserta seluruh target, draft, hasil wawancara, jawaban, dan riwayatnya akan dihapus secara permanen.
        </p>

        {stage === 2 && (
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/60 text-rose-800 text-xs">
              <p className="font-semibold">Peringatan Dampak Data:</p>
              <p className="mt-0.5">
                {request?.total} wawancara akan terhapus, termasuk {request?.selesai} hasil yang sudah selesai.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ketik nama kegiatan <span className="font-mono text-rose-600 font-normal">&quot;{activity.nama}&quot;</span> untuk konfirmasi:
              </label>
              <input
                autoFocus
                autoComplete="off"
                disabled={busy}
                className={inputClass}
                placeholder={activity.nama}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700">
            <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2.5 pt-3 border-t border-slate-100">
        <button
          type="button"
          autoFocus={stage === 1}
          disabled={busy}
          className={secondaryClass}
          onClick={onClose}
        >
          Batal
        </button>
        <button
          type="button"
          disabled={busy || (stage === 2 && name !== activity.nama)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40 transition shadow-xs"
          onClick={stage === 1 ? next : remove}
        >
          {busy ? (
            <>
              <CircleNotch className="w-4 h-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : stage === 1 ? (
            'Lanjutkan Konfirmasi'
          ) : (
            'Hapus Permanen'
          )}
        </button>
      </div>
    </dialog>
  )
}
