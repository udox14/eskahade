'use client'

import { classContext, contextBooks } from '@/lib/supervisi/context'
import { useState } from 'react'
import { getActivityTeachers, updateInterviewIdentity } from './actions'
import type { Interview, Teacher } from '@/lib/supervisi/types'
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles'
import { PencilSimple, CircleNotch, WarningCircle } from '@phosphor-icons/react'

export default function IdentityEditor({
  interview,
  onSaved,
  onBusyChange,
}: {
  interview: Interview
  onSaved: () => Promise<void>
  onBusyChange: (busy: boolean) => void
}) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [guru, setGuru] = useState(interview.guru_id)
  const [key, setKey] = useState(interview.identity.kelas_id)
  const [error, setError] = useState('')

  async function load() {
    setBusy(true)
    setError('')
    try {
      setTeachers(await getActivityTeachers(interview.kegiatan_id))
      setOpen(true)
    } catch {
      setError('Pilihan identitas guru belum dapat dimuat.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      const r = await updateInterviewIdentity(interview.id, interview.revision, guru, key)
      if (r.ok) {
        await onSaved()
        setOpen(false)
      } else {
        setError(r.error)
      }
    } catch {
      setError('Identitas belum tersimpan. Coba lagi.')
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  const teacher = teachers.find((t) => t.id === guru)
  const selected = teacher ? classContext(teacher, key || 'all') : null

  if (!open) {
    return (
      <div>
        <button
          type="button"
          disabled={busy}
          className={`${secondaryClass} text-xs py-2`}
          onClick={load}
        >
          {busy ? (
            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PencilSimple className="w-3.5 h-3.5" weight="bold" />
          )}
          <span>Koreksi Pilihan Guru / Kelas</span>
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <PencilSimple className="w-4 h-4 text-amber-600" weight="duotone" />
          <span>Koreksi Identitas Wawancara</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Pilihan guru dan kelas hanya dapat dikoreksi sebelum jawaban pertama disimpan.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700">
          <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Guru Pengajar</label>
        <select
          className={inputClass}
          disabled={busy}
          value={guru}
          onChange={(e) => {
            const id = Number(e.target.value)
            setGuru(id)
            setKey('all')
          }}
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nama}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="bg-white p-3 rounded-xl border border-amber-200/80 text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">
            Kelas Diniyah: <span className="font-normal">{selected.kelas_nama || 'Semua Kelas'}</span>
          </p>
          <p className="font-semibold text-slate-900">
            Kitab / Pelajaran: <span className="font-normal">{contextBooks(selected)}</span>
          </p>
          <p className="font-semibold text-slate-900">
            Waktu Sesi: <span className="font-normal">{selected.sesi}</span>
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className={`${buttonClass} text-xs py-2`}
          disabled={busy || !selected}
          onClick={save}
        >
          {busy && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
          <span>Simpan Koreksi</span>
        </button>
        <button
          type="button"
          className={`${secondaryClass} text-xs py-2`}
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Batal
        </button>
      </div>
    </div>
  )
}
