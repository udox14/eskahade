'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, BookOpenCheck, Check, ChevronRight, Download, FileSpreadsheet, Layers,
  Loader2, Pencil, Plus, Power, Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  clearPaketMateri, createHafalanPaket, deleteHafalanBab, deleteHafalanBlok, deleteHafalanPaket,
  getMasterHafalanInitialData, getPaketDetail, importHafalanMassal, renameHafalanPaket,
  seedMatanKePaket, setHafalanActive, setHafalanPaketActive, setHafalanPaketMarhalah,
  tambahHafalanBab, tambahHafalanBlok, tambahJuzQuran, tambahSuratQuran,
} from './actions'

type Jenis = { key: string; label: string }
type Paket = {
  id: number; jenis: string; nama: string; is_active: boolean
  total_bab: number; total_blok: number; marhalah: { id: number; nama: string }[]
}

const JENIS_TONE: Record<string, string> = {
  quran: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  hadits: 'bg-sky-50 text-sky-700 ring-sky-200',
  jurumiyah: 'bg-amber-50 text-amber-700 ring-amber-200',
  amtsilah: 'bg-violet-50 text-violet-700 ring-violet-200',
  alfiyah: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export default function MasterHafalanContent() {
  const [types, setTypes] = useState<Jenis[]>([])
  const [marhalah, setMarhalah] = useState<any[]>([])
  const [quranSurahs, setQuranSurahs] = useState<any[]>([])
  const [paket, setPaket] = useState<Paket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filterJenis, setFilterJenis] = useState<string>('all')

  useEffect(() => {
    getMasterHafalanInitialData().then(data => {
      setTypes([...data.types])
      setMarhalah(data.marhalah)
      setQuranSurahs([...data.quranSurahs])
      setPaket(data.paket as Paket[])
      setLoading(false)
    })
  }, [])

  const activePaket = useMemo(() => paket.find(p => p.id === activeId) || null, [paket, activeId])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-2 py-20 text-center text-slate-400">
        <Loader2 className="mx-auto h-7 w-7 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-2 pb-24 sm:px-4 lg:px-0">
      {activePaket ? (
        <PaketDetail
          key={activePaket.id}
          paket={activePaket}
          types={types}
          marhalah={marhalah}
          quranSurahs={quranSurahs}
          onBack={() => setActiveId(null)}
          onPaketChanged={setPaket}
        />
      ) : (
        <PaketList
          paket={paket}
          types={types}
          filterJenis={filterJenis}
          setFilterJenis={setFilterJenis}
          onOpen={setActiveId}
          onPaketChanged={setPaket}
        />
      )}
    </div>
  )
}

// ── List paket ─────────────────────────────────────────────────────────────

function PaketList({ paket, types, filterJenis, setFilterJenis, onOpen, onPaketChanged }: {
  paket: Paket[]; types: Jenis[]; filterJenis: string; setFilterJenis: (v: string) => void
  onOpen: (id: number) => void; onPaketChanged: (p: Paket[]) => void
}) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ jenis: types[0]?.key || 'quran', nama: '' })
  const [busy, setBusy] = useState(false)

  const filtered = filterJenis === 'all' ? paket : paket.filter(p => p.jenis === filterJenis)
  const labelOf = (key: string) => types.find(t => t.key === key)?.label || key

  const submit = async () => {
    if (!form.nama.trim() || busy) return
    setBusy(true)
    const res = await createHafalanPaket(form)
    setBusy(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Paket dibuat')
    onPaketChanged(res.paket as Paket[])
    setForm({ jenis: form.jenis, nama: '' })
    setCreating(false)
    if (res.paketId) onOpen(res.paketId)
  }

  return (
    <div className="space-y-5 pt-1">
      <DashboardPageHeader
        title="Master Hafalan"
        description="Kelola paket hafalan: isi materinya sekali, lalu bagikan ke marhalah mana saja."
        action={
          <button
            onClick={() => setCreating(v => !v)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
          >
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Batal' : 'Paket Baru'}
          </button>
        }
      />

      {creating && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
            <select
              value={form.jenis}
              onChange={e => setForm(f => ({ ...f, jenis: e.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input
              autoFocus
              value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Nama paket, mis. Juz 30, Arba'in 1-20"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Buat
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filterJenis === 'all'} onClick={() => setFilterJenis('all')}>Semua</FilterChip>
        {types.map(t => (
          <FilterChip key={t.key} active={filterJenis === t.key} onClick={() => setFilterJenis(t.key)}>
            {t.label.replace('Hafalan ', '')}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Belum ada paket. Buat paket dulu.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${p.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${JENIS_TONE[p.jenis] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                  {labelOf(p.jenis).replace('Hafalan ', '')}
                </span>
                {!p.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Nonaktif</span>}
                <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
              </div>
              <h3 className="truncate text-base font-bold text-slate-900">{p.nama}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">{p.total_bab} bab · {p.total_blok} blok</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.marhalah.length === 0 ? (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Belum di-assign</span>
                ) : p.marhalah.map(m => (
                  <span key={m.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{m.nama}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}

// ── Detail paket ─────────────────────────────────────────────────────────────

function PaketDetail({ paket, types, marhalah, quranSurahs, onBack, onPaketChanged }: {
  paket: Paket; types: Jenis[]; marhalah: any[]; quranSurahs: any[]
  onBack: () => void; onPaketChanged: (p: Paket[]) => void
}) {
  const [tab, setTab] = useState<'materi' | 'marhalah' | 'import'>('materi')
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(paket.nama)

  const reloadDetail = async () => setDetail(await getPaketDetail(paket.id))
  useEffect(() => { setLoadingDetail(true); reloadDetail().finally(() => setLoadingDetail(false)) }, [paket.id])

  const labelOf = (key: string) => types.find(t => t.key === key)?.label || key

  const saveName = async () => {
    if (!nameDraft.trim()) return
    const res = await renameHafalanPaket({ paketId: paket.id, nama: nameDraft.trim() })
    if ('error' in res) return toast.error(res.error)
    onPaketChanged(res.paket as Paket[])
    setEditingName(false)
    toast.success('Nama paket diubah')
  }

  const toggleActive = async () => {
    const res = await setHafalanPaketActive({ paketId: paket.id, active: !paket.is_active })
    if ('error' in res) return toast.error(res.error)
    onPaketChanged(res.paket as Paket[])
  }

  const removePaket = async () => {
    if (window.prompt(`Ketik HAPUS untuk menghapus paket "${paket.nama}" beserta semua materi & progress santri.`) !== 'HAPUS') return
    const res = await deleteHafalanPaket({ paketId: paket.id })
    if ('error' in res) return toast.error(res.error)
    onPaketChanged(res.paket as Paket[])
    toast.success('Paket dihapus')
    onBack()
  }

  return (
    <div className="pt-1">
      {/* Sticky sub-header */}
      <div className="sticky top-0 z-20 -mx-2 mb-4 border-b border-slate-100 bg-white/85 px-2 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Semua Paket
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ring-1 ring-inset ${JENIS_TONE[paket.jenis] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
            {labelOf(paket.jenis).replace('Hafalan ', '')}
          </span>
          {editingName ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="h-9 rounded-lg border border-slate-200 px-2 text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={saveName} className="rounded-lg bg-emerald-600 p-2 text-white"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setEditingName(false); setNameDraft(paket.nama) }} className="rounded-lg bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button>
            </span>
          ) : (
            <button onClick={() => setEditingName(true)} className="group inline-flex items-center gap-1.5 text-xl font-bold text-slate-900">
              {paket.nama} <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={toggleActive} title={paket.is_active ? 'Nonaktifkan' : 'Aktifkan'} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold ${paket.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Power className="h-4 w-4" /> {paket.is_active ? 'Aktif' : 'Off'}
            </button>
            <button onClick={removePaket} title="Hapus paket" className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Segmented tabs */}
        <div className="mt-3 inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
          {([['materi', 'Materi'], ['marhalah', 'Marhalah'], ['import', 'Import']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition sm:flex-none ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
              {key === 'marhalah' && paket.marhalah.length > 0 && <span className="ml-1.5 text-xs text-emerald-600">{paket.marhalah.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {loadingDetail || !detail ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : tab === 'materi' ? (
        <MateriTab paket={paket} detail={detail} quranSurahs={quranSurahs} reload={reloadDetail} onPaketChanged={onPaketChanged} />
      ) : tab === 'marhalah' ? (
        <MarhalahTab paket={paket} marhalah={marhalah} onPaketChanged={onPaketChanged} />
      ) : (
        <ImportTab paket={paket} reload={reloadDetail} onPaketChanged={onPaketChanged} />
      )}
    </div>
  )
}

// ── Tab: Materi ──────────────────────────────────────────────────────────────

function MateriTab({ paket, detail, quranSurahs, reload, onPaketChanged }: {
  paket: Paket; detail: any; quranSurahs: any[]; reload: () => Promise<void>; onPaketChanged: (p: Paket[]) => void
}) {
  const isQuran = paket.jenis === 'quran'
  const noMarhalah = !detail.paket.hasMarhalah
  const matanOptions: { key: string; label: string }[] = detail.paket.matanOptions || []
  const [matanKey, setMatanKey] = useState(matanOptions[0]?.key || '')
  const [surahNumber, setSurahNumber] = useState('1')
  const [juz, setJuz] = useState('30')
  const [newBab, setNewBab] = useState({ judul: '', urutan: 0 })
  const [openBab, setOpenBab] = useState<number | null>(null)
  const [newBlok, setNewBlok] = useState<Record<number, { label: string; deskripsi: string; ref: string; urutan: number }>>({})
  const [busy, setBusy] = useState(false)

  const addSurat = async () => {
    setBusy(true)
    const res = await tambahSuratQuran({ paketId: paket.id, surahNumber: Number(surahNumber) })
    setBusy(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Surat ditambah (${res.count} ayat)`)
    await reload()
  }

  const addJuz = async () => {
    setBusy(true)
    const res = await tambahJuzQuran({ paketId: paket.id, juz: Number(juz) })
    setBusy(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Juz ${juz} ditambah (${res.insertedBab} surat, ${res.insertedBlok} ayat)`)
    await reload()
  }

  const addBab = async () => {
    if (!newBab.judul.trim()) return
    const res = await tambahHafalanBab({ paketId: paket.id, judul: newBab.judul, urutan: newBab.urutan })
    if ('error' in res) return toast.error(res.error)
    toast.success('Bab ditambah')
    setNewBab({ judul: '', urutan: 0 })
    await reload()
  }

  const addBlok = async (babId: number) => {
    const i = newBlok[babId] || { label: '', deskripsi: '', ref: '', urutan: 0 }
    if (!i.label.trim()) return
    const res = await tambahHafalanBlok({ babId, ...i })
    if ('error' in res) return toast.error(res.error)
    setNewBlok(p => ({ ...p, [babId]: { label: '', deskripsi: '', ref: '', urutan: 0 } }))
    await reload()
  }

  const toggle = async (target: 'bab' | 'blok', id: number, active: boolean) => {
    const res = await setHafalanActive(target, id, active)
    if ('error' in res) return toast.error(res.error)
    await reload()
  }

  const removeBab = async (babId: number, judul: string) => {
    if (!window.confirm(`Hapus bab "${judul}" beserta blok & progress?`)) return
    const res = await deleteHafalanBab({ babId })
    if ('error' in res) return toast.error(res.error)
    await reload()
  }

  const removeBlok = async (blokId: number) => {
    const res = await deleteHafalanBlok({ blokId })
    if ('error' in res) return toast.error(res.error)
    await reload()
  }

  const clearAll = async () => {
    if (window.prompt(`Ketik HAPUS untuk mengosongkan semua materi paket "${paket.nama}".`) !== 'HAPUS') return
    const res = await clearPaketMateri({ paketId: paket.id })
    if ('error' in res) return toast.error(res.error)
    toast.success(`Dikosongkan: ${res.deletedBab} bab, ${res.deletedBlok} blok`)
    await reload()
  }

  const seedMatan = async () => {
    setBusy(true)
    const res = await seedMatanKePaket({ paketId: paket.id, matanKey: matanKey || undefined })
    setBusy(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Materi terisi: ${res.insertedBab} bab, ${res.insertedBlok} segmen`)
    await reload()
  }

  return (
    <div className="space-y-4">
      {noMarhalah && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Paket belum punya marhalah. Buka tab <b>Marhalah</b> dan assign minimal satu agar materi bisa ditambah.
        </div>
      )}

      {matanOptions.length > 0 && !isQuran && (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div>
              <p className="font-bold text-violet-900">Matan bawaan tersedia</p>
              <p className="text-xs font-semibold text-violet-700">Isi otomatis bab + segmen teks (sekali klik). Bab yang sudah ada dilewati.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {matanOptions.length > 1 && (
              <select value={matanKey} onChange={e => setMatanKey(e.target.value)} className="h-11 flex-1 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-400">
                {matanOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            )}
            <button onClick={seedMatan} disabled={busy || noMarhalah} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Isi dari Matan
            </button>
          </div>
        </div>
      )}

      {/* Tambah materi */}
      {isQuran ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah Surat</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select value={surahNumber} onChange={e => setSurahNumber(e.target.value)} disabled={noMarhalah} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:opacity-50">
              {quranSurahs.map(s => <option key={s.number} value={s.number}>{s.number}. {s.arabicName || s.name} ({s.ayahCount} ayat)</option>)}
            </select>
            <button onClick={addSurat} disabled={busy || noMarhalah} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
            </button>
          </div>

          <h3 className="mb-3 mt-4 flex items-center gap-2 text-sm font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah per Juz</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select value={juz} onChange={e => setJuz(e.target.value)} disabled={noMarhalah} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:opacity-50">
              {Array.from({ length: 30 }, (_, i) => 30 - i).map(n => <option key={n} value={n}>Juz {n}</option>)}
            </select>
            <button onClick={addJuz} disabled={busy || noMarhalah} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah Juz
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Tiap ayat otomatis jadi blok ber-teks. Juz yang motong surah diambil range ayatnya saja.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah Bab</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
            <input value={newBab.judul} onChange={e => setNewBab(p => ({ ...p, judul: e.target.value }))} disabled={noMarhalah} placeholder="Judul bab" className="h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50" />
            <input type="number" value={newBab.urutan} onChange={e => setNewBab(p => ({ ...p, urutan: Number(e.target.value || 0) }))} disabled={noMarhalah} placeholder="Urutan" className="h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50" />
            <button onClick={addBab} disabled={noMarhalah} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Bab</button>
          </div>
        </div>
      )}

      {/* List bab */}
      {detail.bab.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">Belum ada materi.</div>
      ) : (
        <div className="space-y-2.5">
          {detail.bab.map((bab: any) => {
            const open = openBab === bab.id
            const done = bab.blok.filter((b: any) => b.is_active).length
            return (
              <div key={bab.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setOpenBab(open ? null : bab.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
                    <BookOpenCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate font-bold text-slate-900">{bab.judul}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-400">{done}/{bab.blok.length}</span>
                  </button>
                  <button onClick={() => toggle('bab', bab.id, !bab.is_active)} className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold ${bab.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{bab.is_active ? 'Aktif' : 'Off'}</button>
                  <button onClick={() => removeBab(bab.id, bab.judul)} className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {bab.blok.map((blok: any) => (
                        <div key={blok.id} className={`group relative rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${blok.is_active ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                          <button onClick={() => toggle('blok', blok.id, !blok.is_active)} title={blok.teks?.arab || blok.deskripsi || blok.label}>
                            {isQuran ? (String(blok.label).match(/\d+/)?.[0] || blok.label) : blok.label}
                          </button>
                          {blok.teks?.arab && <span className="ml-1 text-emerald-500" title="Teks tersedia">·</span>}
                          <button onClick={() => removeBlok(blok.id)} className="ml-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"><X className="inline h-3 w-3" /></button>
                        </div>
                      ))}
                      {bab.blok.length === 0 && <p className="text-sm text-slate-400">Belum ada blok.</p>}
                    </div>

                    {!isQuran && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
                        <input value={newBlok[bab.id]?.label || ''} onChange={e => setNewBlok(p => ({ ...p, [bab.id]: { ...(p[bab.id] || { label: '', deskripsi: '', ref: '', urutan: 0 }), label: e.target.value } }))} placeholder="Label blok" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                        <input value={newBlok[bab.id]?.deskripsi || ''} onChange={e => setNewBlok(p => ({ ...p, [bab.id]: { ...(p[bab.id] || { label: '', deskripsi: '', ref: '', urutan: 0 }), deskripsi: e.target.value } }))} placeholder="Deskripsi (opsional)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                        <input value={newBlok[bab.id]?.ref || ''} onChange={e => setNewBlok(p => ({ ...p, [bab.id]: { ...(p[bab.id] || { label: '', deskripsi: '', ref: '', urutan: 0 }), ref: e.target.value } }))} placeholder="ref teks (opsional)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                        <button onClick={() => addBlok(bab.id)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {detail.bab.length > 0 && (
        <button onClick={clearAll} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100">
          <Trash2 className="h-4 w-4" /> Kosongkan Materi Paket
        </button>
      )}
    </div>
  )
}

// ── Tab: Marhalah ────────────────────────────────────────────────────────────

function MarhalahTab({ paket, marhalah, onPaketChanged }: { paket: Paket; marhalah: any[]; onPaketChanged: (p: Paket[]) => void }) {
  const [busy, setBusy] = useState<number | null>(null)
  const assigned = new Set(paket.marhalah.map(m => m.id))

  const toggle = async (marhalahId: number) => {
    setBusy(marhalahId)
    const res = await setHafalanPaketMarhalah({ paketId: paket.id, marhalahId, assigned: !assigned.has(marhalahId) })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    onPaketChanged(res.paket as Paket[])
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Pilih marhalah yang memakai paket ini. Satu marhalah hanya bisa terikat ke satu paket per jenis.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {marhalah.map(m => {
          const on = assigned.has(m.id)
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              disabled={busy === m.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
            >
              <span className="font-bold text-slate-800">{m.nama}</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab: Import ──────────────────────────────────────────────────────────────

function ImportTab({ paket, reload, onPaketChanged }: { paket: Paket; reload: () => Promise<void>; onPaketChanged: (p: Paket[]) => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const jenis = paket.jenis
    const data = jenis === 'alfiyah'
      ? [{ 'Nama Bab (Arab)': 'المقدمة', 'Jumlah Bait': 7, 'Bait Ke-': '1 - 7' }]
      : jenis === 'hadits'
        ? [{ KITAB: 'arbain', 'Nama Bab (Arab)': 'باب النية', 'Jumlah Hadits': 3, 'Hadits Ke-': '1 - 3' }]
        : jenis === 'jurumiyah'
          ? [{ BAB: 'Bab Kalam', 'URUTAN BAB': 1 }, { BAB: "Bab I'rab", 'URUTAN BAB': 2 }]
          : jenis === 'amtsilah'
            ? [{ BAGIAN: 'Tasrif Istilahi', BAB: '', WAZAN: "Fa'ala - Yaf'ulu", 'URUTAN BLOK': 1 }]
            : [{ BAB: 'Bab Kalam', 'URUTAN BAB': 1, BLOK: 'Definisi Kalam', DESKRIPSI: '', REF: '', 'URUTAN BLOK': 1 }]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `Template_Hafalan_${jenis}.xlsx`)
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setRows(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris terbaca`)
    } catch { toast.error('Gagal membaca Excel') } finally { e.target.value = '' }
  }

  const save = async () => {
    if (!rows.length || importing) return
    setImporting(true)
    try {
      const res = await importHafalanMassal({ paketId: paket.id, rows })
      if ('error' in res) return toast.error(res.error)
      toast.success(`Import: ${res.insertedBab} bab, ${res.insertedBlok} blok, ${res.skipped} dilewati`)
      setRows([])
      await reload()
      const { getHafalanPaketList } = await import('./actions')
      onPaketChanged(await getHafalanPaketList() as Paket[])
    } catch (err: any) { toast.error(err?.message || 'Import gagal') } finally { setImporting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <button onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 hover:bg-sky-100">
          <Download className="h-4 w-4" /> Download Template
        </button>
        <div className="relative">
          <input type="file" accept=".xlsx,.xls" onChange={onUpload} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
            <Upload className="h-4 w-4" /> Upload Excel
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b bg-slate-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-700"><FileSpreadsheet className="h-4 w-4 text-sky-600" /> Preview {rows.length} baris</p>
            <button onClick={save} disabled={importing} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Simpan
            </button>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-slate-500"><tr><th className="p-2">BAB</th><th className="p-2">BLOK</th><th className="p-2">DESKRIPSI</th></tr></thead>
              <tbody className="divide-y">
                {rows.slice(0, 30).map((row, i) => (
                  <tr key={i}>
                    <td className="p-2 font-semibold">{row.BAGIAN || row.Bab || row.BAB || row['JUDUL BAB'] || row['Nama Bab (Arab)'] || row['NAMA BAB (ARAB)'] || '-'}</td>
                    <td className="p-2">{row.WAZAN || row.BLOK || row.blok || row['Bait Ke-'] || row['Hadits Ke-'] || '-'}</td>
                    <td className="p-2 text-slate-500">{row.DESKRIPSI || row['Jumlah Bait'] || row['Jumlah Hadits'] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
