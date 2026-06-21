'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  SkipForward,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { toast } from '@/lib/toast'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { cn } from '@/lib/utils'
import {
  clearSetupWizardOverride,
  saveSetupWizardOverride,
  type SetupWizardItemState,
  type SetupWizardState,
} from './actions'

const STATUS_META = {
  complete: {
    label: 'Selesai',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  skipped: {
    label: 'Dilewati',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    icon: SkipForward,
  },
  needs_review: {
    label: 'Perlu dicek',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: TriangleAlert,
  },
  not_started: {
    label: 'Belum mulai',
    className: 'border-slate-200 bg-white text-slate-500',
    dot: 'bg-slate-300',
    icon: CircleDashed,
  },
}

function StatusBadge({ status }: { status: SetupWizardItemState['status'] }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  )
}

function OverrideControls({ item }: { item: SetupWizardItemState }) {
  const router = useRouter()
  const [note, setNote] = useState(item.override?.note ?? '')
  const [pending, startTransition] = useTransition()

  const save = (status: 'complete' | 'skipped') => {
    startTransition(async () => {
      const result = await saveSetupWizardOverride({ itemKey: item.key, status, note })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(status === 'complete' ? 'Ditandai selesai manual' : 'Ditandai dilewati')
      router.refresh()
    })
  }

  const clear = () => {
    startTransition(async () => {
      const result = await clearSetupWizardOverride(item.key)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setNote('')
      toast.success('Override dihapus, kembali ke status otomatis')
      router.refresh()
    })
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Catatan override
      </label>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Opsional, misalnya: PSB tahun ini tidak dipakai."
        rows={2}
        className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-emerald-500"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || item.locked}
          onClick={() => save('complete')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-emerald-300"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Selesai manual
        </button>
        <button
          type="button"
          disabled={pending || item.locked}
          onClick={() => save('skipped')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:text-slate-300"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Dilewati
        </button>
        {item.override ? (
          <button
            type="button"
            disabled={pending}
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Pakai otomatis
          </button>
        ) : null}
      </div>
    </div>
  )
}

function WizardCard({ item, index }: { item: SetupWizardItemState; index: number }) {
  const meta = STATUS_META[item.status]

  return (
    <div className="relative pl-10">
      <div className="absolute left-3 top-0 h-full w-px bg-slate-200" />
      <div className={cn('absolute left-0 top-5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white text-[11px] font-black text-white shadow-sm', meta.dot)}>
        {index + 1}
      </div>

      <article className={cn(
        'rounded-3xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5',
        item.status === 'complete' && 'border-emerald-100',
        item.status === 'needs_review' && 'border-amber-100',
        item.locked && 'opacity-70'
      )}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {item.group}
              </span>
              <StatusBadge status={item.status} />
              {item.override ? (
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                  Override admin
                </span>
              ) : null}
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
          </div>

          <Link
            href={item.returnHref}
            aria-disabled={item.locked}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold shadow-sm transition',
              item.locked
                ? 'pointer-events-none bg-slate-100 text-slate-400'
                : 'bg-slate-900 text-white hover:bg-emerald-700'
            )}
          >
            Buka fitur
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Status otomatis</span>
              <span>{item.completed}/{item.total || 1}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  item.autoStatus === 'complete' ? 'bg-emerald-500' : item.autoStatus === 'needs_review' ? 'bg-amber-400' : 'bg-slate-300'
                )}
                style={{ width: `${Math.min(100, Math.round((item.completed / (item.total || 1)) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
          </div>
        </div>

        {item.override?.note ? (
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {item.override.note}
          </div>
        ) : null}

        <OverrideControls item={item} />
      </article>
    </div>
  )
}

export default function SetupTahunAjaranContent({ state }: { state: SetupWizardState }) {
  const subtitle = state.tahunAjaran
    ? `Tahun ajaran aktif: ${state.tahunAjaran.nama}`
    : 'Belum ada tahun ajaran aktif'
  const remaining = useMemo(
    () => state.items.filter(item => item.status !== 'complete' && item.status !== 'skipped').length,
    [state.items]
  )

  return (
    <div className="space-y-6 pb-20">
      <DashboardPageHeader
        title="Setup Tahun Ajaran"
        description="Timeline pekerjaan awal tahun ajaran supaya admin tahu apa yang perlu dibereskan sebelum operasional berjalan."
      />

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-60 w-60 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              {subtitle}
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {state.progress.done} dari {state.progress.total} langkah beres.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Sistem menghitung status dari data aplikasi. Kalau ada kondisi khusus di lapangan, admin bisa menandai item sebagai selesai manual atau dilewati.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 text-center backdrop-blur">
            <div className="text-5xl font-black tracking-tighter text-emerald-300">{state.progress.percent}%</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/40">Progress</div>
            <div className="mt-3 h-2 w-44 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${state.progress.percent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selesai</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{state.progress.done}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tersisa</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{remaining}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tahun Angkatan</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{state.tahunAwal ?? '-'}</p>
        </div>
      </div>

      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-black text-slate-900">Timeline Setup</h2>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-5">
          {state.items.map((item, index) => (
            <WizardCard key={item.key} item={item} index={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
