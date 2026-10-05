'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  createActivity,
  getTeacherCandidates,
  getActivityTargetIds,
  updateActivityTargets,
} from './actions'
import type { Activity, Teacher } from '@/lib/supervisi/types'
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles'
import {
  ChalkboardTeacher,
  MagnifyingGlass,
  CircleNotch,
  X,
  WarningCircle,
} from '@phosphor-icons/react'

export default function ActivityEditor({
  years,
  activity,
  onClose,
  onSaved,
}: {
  years: {
    id: number
    nama: string
    is_active: number
  }[]
  activity?: Activity
  onClose: () => void
  onSaved: (id: string) => Promise<void>
}) {
  const [name, setName] = useState(activity?.nama ?? '')
  const [year, setYear] = useState(activity?.tahun_ajaran_id ?? years[0]?.id ?? 0)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getTeacherCandidates(year),
      activity ? getActivityTargetIds(activity.id) : Promise.resolve(null),
    ])
      .then(([t, ids]) => {
        if (active) {
          setTeachers(t)
          setSelected(ids ?? t.map((g) => g.id))
        }
      })
      .catch(() => {
        if (active) {
          setError('Daftar target guru belum dapat dimuat.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [year, activity])

  const filteredTeachers = useMemo(() => {
    if (!search.trim()) return teachers
    const q = search.toLowerCase()
    return teachers.filter(
      (t) =>
        t.nama.toLowerCase().includes(q) ||
        t.kelas.some((k) => k.toLowerCase().includes(q))
    )
  }, [teachers, search])

  async function save() {
    setBusy(true)
    setError('')
    try {
      const r = activity
        ? await updateActivityTargets(activity.id, selected)
        : await createActivity(name, year, selected)
      if (r.ok) {
        await onSaved(activity?.id ?? String(r.data))
      } else {
        setError(r.error)
      }
    } catch {
      setError('Kegiatan belum tersimpan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const toggleSelectAll = () => {
    if (selected.length === teachers.length) {
      setSelected([])
    } else {
      setSelected(teachers.map((t) => t.id))
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* Header Modal */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ChalkboardTeacher className="w-4 h-4" weight="duotone" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              {activity ? 'Atur Target Guru' : 'Kegiatan Supervisi Baru'}
            </h2>
            <p className="text-xs text-slate-500">
              {activity
                ? 'Tentukan guru yang akan diwawancarai pada kegiatan ini.'
                : 'Buat kegiatan supervisi baru dan tentukan daftar guru sasaran.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs sm:text-sm text-rose-700">
            <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Nama Kegiatan <span className="text-rose-500">*</span>
            </label>
            <input
              disabled={Boolean(activity)}
              maxLength={200}
              placeholder="Contoh: Supervisi Semester Ganjil"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Tahun Ajaran <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={Boolean(activity)}
              className={inputClass}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.nama} {y.is_active ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pemilihan Guru Target */}
        <div className="space-y-2 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Pilih Guru Sasaran:</span>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                {selected.length} dari {teachers.length} guru dipilih
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <MagnifyingGlass className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari guru..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-emerald-700 hover:underline px-1 py-1"
                onClick={toggleSelectAll}
              >
                {selected.length === teachers.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/30 divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <CircleNotch className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Memuat data pengajar...</span>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                Tidak ada guru yang sesuai pencarian.
              </p>
            ) : (
              filteredTeachers.map((t) => {
                const isChecked = selected.includes(t.id)
                return (
                  <label
                    key={t.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer select-none transition-colors ${
                      isChecked ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      checked={isChecked}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, t.id]
                            : prev.filter((id) => id !== t.id)
                        )
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {t.nama}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {t.kelas.length > 0 ? t.kelas.join(', ') : 'Belum ada kelas'}
                        {!t.contexts.length && (
                          <span className="text-amber-600 ml-1">· Penugasan belum lengkap</span>
                        )}
                      </p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* Footer Tombol Aksi */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button type="button" className={secondaryClass} onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            disabled={busy || loading || selected.length === 0 || !name.trim()}
            className={buttonClass}
            onClick={save}
          >
            {busy && <CircleNotch className="w-4 h-4 animate-spin" />}
            <span>{activity ? 'Simpan Target' : 'Buat Kegiatan'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
