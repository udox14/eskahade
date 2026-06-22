'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpenCheck, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  addJuzToMarhalah, addSurahToMarhalah, assignKitabToMarhalah, bersihkanResiduHafalan,
  getMasterAssign, removeQuranSurah, unassignJenisFromMarhalah,
} from './actions'

const ARABIC_FONT = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif'

type Catalog = { jenis: string; label: string; kitab: { key: string; label: string }[] }

export default function MasterHafalanContent() {
  const [data, setData] = useState<any>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => setData(await getMasterAssign())
  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const active = useMemo(() => data?.marhalah.find((m: any) => m.id === activeId) || null, [data, activeId])

  if (loading || !data) {
    return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-7 w-7 animate-spin" /></div>
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-24">
      {active ? (
        <MarhalahDetail key={active.id} marhalah={active} data={data} onBack={() => setActiveId(null)} reload={load} />
      ) : (
        <MarhalahList data={data} onOpen={setActiveId} reload={load} />
      )}
    </div>
  )
}

// ── List marhalah ────────────────────────────────────────────────────────────

function MarhalahList({ data, onOpen, reload }: { data: any; onOpen: (id: number) => void; reload: () => Promise<void> }) {
  const catalog: Catalog[] = data.catalog
  const [cleaning, setCleaning] = useState(false)
  const labelKitab = (jenis: string, key: string) =>
    catalog.find(c => c.jenis === jenis)?.kitab.find(k => k.key === key)?.label || key

  const bersihkan = async () => {
    if (!window.confirm('Hapus semua assignment & materi residu lama (paket di luar konvensi baru)? Tidak bisa dibatalkan.')) return
    setCleaning(true)
    try {
      const res = await bersihkanResiduHafalan()
      if ('error' in res) return toast.error(res.error)
      toast.success(res.clean ? 'Sudah bersih, tidak ada residu.' : `Dibersihkan: ${res.deletedPaket} paket, ${res.deletedBab} bab, ${res.deletedBlok} blok`)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membersihkan residu.')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="space-y-4 pt-1">
      <DashboardPageHeader
        title="Master Hafalan"
        description="Pilih marhalah, lalu assign kitab atau surat/juz Qur'an untuknya."
        action={
          <button onClick={bersihkan} disabled={cleaning} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 sm:w-auto">
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Bersihkan Residu
          </button>
        }
      />
      <div className="space-y-2">
        {data.marhalah.map((m: any) => {
          const a = data.assignments[m.id] || { quran: { surat: [] }, kitab: {} }
          const chips: string[] = []
          if (a.quran.surat?.length) chips.push(`Qur'an: ${a.quran.surat.length} surat`)
          for (const c of catalog) if (a.kitab[c.jenis]) chips.push(`${c.label}: ${labelKitab(c.jenis, a.kitab[c.jenis])}`)
          return (
            <button key={m.id} onClick={() => onOpen(m.id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><BookOpenCheck className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{m.nama}</p>
                {chips.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {chips.map((c, i) => <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{c}</span>)}
                  </div>
                ) : <p className="mt-0.5 text-xs text-slate-400">Belum ada hafalan di-assign</p>}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Detail marhalah ──────────────────────────────────────────────────────────

function MarhalahDetail({ marhalah, data, onBack, reload }: { marhalah: any; data: any; onBack: () => void; reload: () => Promise<void> }) {
  const catalog: Catalog[] = data.catalog
  const assign = data.assignments[marhalah.id] || { quran: { surat: [] }, kitab: {} }
  const [busy, setBusy] = useState(false)
  const [surah, setSurah] = useState('1')
  const [juz, setJuz] = useState('30')

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res && 'error' in res) return toast.error(res.error)
      toast.success(ok)
      await reload()
    } catch (e: any) {
      toast.error(e?.message || 'Terjadi kesalahan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-1">
      <div className="sticky top-0 z-20 -mx-2 mb-4 border-b border-slate-100 bg-white/85 px-2 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        <button onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Semua Marhalah</button>
        <h1 className="text-xl font-bold text-slate-900">{marhalah.nama}</h1>
      </div>

      {/* Al-Qur'an */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-emerald-800"><BookOpenCheck className="h-5 w-5" /> Al-Qur'an</h2>

        {assign.quran.surat?.length ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {assign.quran.surat.map((s: any) => (
              <span key={s.babId} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800">
                <span dir="rtl" style={{ fontFamily: ARABIC_FONT }}>{s.title}</span>
                <span className="text-[11px] text-emerald-500">{s.ayat} ayat</span>
                <button onClick={() => run(() => removeQuranSurah({ babId: s.babId }), 'Surat dilepas')} disabled={busy} className="text-emerald-400 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        ) : <p className="mb-3 text-xs text-slate-400">Belum ada surat/juz.</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex gap-2">
            <select value={surah} onChange={e => setSurah(e.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold">
              {data.quranSurahs.map((s: any) => <option key={s.number} value={s.number}>{s.number}. {s.arabicName || s.name}</option>)}
            </select>
            <button onClick={() => run(() => addSurahToMarhalah({ marhalahId: marhalah.id, surahNumber: Number(surah) }), 'Surat di-assign')} disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Surat</button>
          </div>
          <div className="flex gap-2">
            <select value={juz} onChange={e => setJuz(e.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold">
              {Array.from({ length: 30 }, (_, i) => 30 - i).map(n => <option key={n} value={n}>Juz {n}</option>)}
            </select>
            <button onClick={() => run(() => addJuzToMarhalah({ marhalahId: marhalah.id, juz: Number(juz) }), 'Juz di-assign')} disabled={busy} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Juz</button>
          </div>
        </div>
      </section>

      {/* Kitab non-quran */}
      {catalog.map(c => {
        const current = assign.kitab[c.jenis] || ''
        return (
          <section key={c.jenis} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold text-slate-800">{c.label}</h2>
            <select
              value={current}
              disabled={busy}
              onChange={e => {
                const v = e.target.value
                if (v) run(() => assignKitabToMarhalah({ marhalahId: marhalah.id, jenis: c.jenis, kitabKey: v }), 'Kitab di-assign')
                else run(() => unassignJenisFromMarhalah({ marhalahId: marhalah.id, jenis: c.jenis }), 'Assign dilepas')
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="">— Tidak di-assign —</option>
              {c.kitab.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">Pilih satu kitab — seluruh isinya otomatis jadi materi hafalan marhalah ini.</p>
          </section>
        )
      })}
    </div>
  )
}
