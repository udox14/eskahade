'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, BookOpenCheck, Check, ChevronRight, Languages, Loader2,
  RotateCcw, Save, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getAvailableHafalanTypes, getHafalanInitialData, getHafalanInputData,
  simpanHafalanHighlightBatch, simpanHafalanProgressBatch,
} from './actions'

const ARABIC_FONT = '"Scheherazade New", "Amiri", "Traditional Arabic", "Noto Naskh Arabic", serif'
const QURAN_FONT = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif'

export default function HafalanPageContent() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kelasId, setKelasId] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState<any>(null)
  const [data, setData] = useState<any>({ santri: [], bab: [], progress: {} })
  const [selectedSantriId, setSelectedSantriId] = useState('')
  const [selectedBabId, setSelectedBabId] = useState<number | null>(null)
  const [santriSearch, setSantriSearch] = useState('')
  const [localChecked, setLocalChecked] = useState<Set<number>>(new Set())
  const [localWords, setLocalWords] = useState<Record<number, number[]>>({}) // jurumiyah: blokId -> word idx
  const [showTerjemah, setShowTerjemah] = useState(true)
  const [dragMode, setDragMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<{ add: boolean } | null>(null)
  const wordDragRef = useRef<{ blokId: number; add: boolean } | null>(null)

  const draftKey = useMemo(() => {
    if (!kelasId || !selectedType?.key || !selectedSantriId) return ''
    return `hafalan-draft:${kelasId}:${selectedType.key}:${selectedSantriId}`
  }, [kelasId, selectedType?.key, selectedSantriId])

  useEffect(() => {
    getHafalanInitialData().then(res => {
      setKelasList(res.kelas)
      if (res.kelas.length === 1) setKelasId(res.kelas[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!kelasId) return
    setSelectedType(null)
    getAvailableHafalanTypes(kelasId).then(setTypes)
  }, [kelasId])

  useEffect(() => {
    if (!kelasId || !selectedType) return
    getHafalanInputData(kelasId, selectedType.key).then(res => {
      setData(res)
      setSelectedSantriId('')
      setSelectedBabId(null)
      setLocalChecked(new Set())
      setDirty(false)
    })
  }, [kelasId, selectedType])

  // bersihkan drag saat pointer dilepas di mana pun
  useEffect(() => {
    const up = () => { dragRef.current = null; wordDragRef.current = null }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [])

  const totalBlok = useMemo(() => data.bab.reduce((s: number, b: any) => s + b.blok.length, 0), [data.bab])
  const selectedSantri = useMemo(() => data.santri.find((i: any) => i.riwayat_id === selectedSantriId), [data.santri, selectedSantriId])
  const selectedBab = useMemo(() => data.bab.find((i: any) => i.id === selectedBabId), [data.bab, selectedBabId])
  const isQuran = selectedType?.key === 'quran'
  const isJurumiyah = selectedType?.key === 'jurumiyah'

  const wordsOf = (blok: any): string[] => String(blok?.teks?.arab || '').split(/\s+/).filter(Boolean)
  const lockedWords = (blokId: number): Set<number> => new Set(data.progressHighlightLocked?.[`${selectedSantriId}:${blokId}`] || [])
  const persistedWords = (blokId: number): number[] => data.progressHighlight?.[`${selectedSantriId}:${blokId}`] || []

  const filteredSantri = useMemo(() => {
    const needle = santriSearch.trim().toLowerCase()
    if (!needle) return data.santri
    return data.santri.filter((i: any) =>
      String(i.nama || '').toLowerCase().includes(needle) || String(i.nis || '').toLowerCase().includes(needle))
  }, [data.santri, santriSearch])

  const getPersistedChecked = (blokId: number) => !!selectedSantriId && !!data.progress[`${selectedSantriId}:${blokId}`]
  const isReadonlyPersisted = (blokId: number) => {
    if (!selectedSantriId) return false
    const key = `${selectedSantriId}:${blokId}`
    return !!data.progress[key] && !data.progressEditable?.[key]
  }
  const canEditBlok = (blok: any) => !!blok?.is_editable && !isReadonlyPersisted(blok.id)

  const selectSantri = (riwayatId: string) => {
    setSelectedSantriId(riwayatId)
    setSelectedBabId(null)
    const nextDraftKey = `hafalan-draft:${kelasId}:${selectedType.key}:${riwayatId}`
    try {
      const raw = sessionStorage.getItem(nextDraftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.checkedBlokIds)) {
          setLocalChecked(new Set(parsed.checkedBlokIds.map(Number)))
          setLocalWords(parsed.words || {})
          setDirty(true)
          toast.info('Draft hafalan dipulihkan')
          return
        }
      }
    } catch {}
    if (isJurumiyah) {
      const lw: Record<number, number[]> = {}
      for (const bab of data.bab) for (const blok of bab.blok) {
        const w = data.progressHighlight?.[`${riwayatId}:${blok.id}`]
        if (w?.length) lw[blok.id] = [...w]
      }
      setLocalWords(lw)
      setLocalChecked(new Set())
      setDirty(false)
      return
    }
    const ids = data.bab.flatMap((b: any) => b.blok.map((bl: any) => bl.id)).filter((id: number) => data.progress[`${riwayatId}:${id}`])
    setLocalChecked(new Set(ids))
    setDirty(false)
  }

  // ── apply / drag-swipe ──
  const applyBlok = (blokId: number, val: boolean) => {
    setLocalChecked(prev => {
      const n = new Set(prev)
      if (val) n.add(blokId); else n.delete(blokId)
      return n
    })
    setDirty(true)
  }

  const onBlokPointerDown = (blok: any) => {
    if (!canEditBlok(blok)) return toast.info('Progress marhalah sebelumnya hanya bisa dilihat')
    const val = !localChecked.has(blok.id)
    dragRef.current = { add: val }
    applyBlok(blok.id, val)
  }

  const onListPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !selectedBab) return
    const node = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-blok-id]')
    if (!node) return
    const id = Number(node.getAttribute('data-blok-id'))
    const blok = selectedBab.blok.find((b: any) => b.id === id)
    if (blok && canEditBlok(blok)) applyBlok(id, dragRef.current.add)
  }

  const toggleSingle = (blok: any) => {
    if (!canEditBlok(blok)) return toast.info('Progress marhalah sebelumnya hanya bisa dilihat')
    applyBlok(blok.id, !localChecked.has(blok.id))
  }

  // ── Jurumiyah: highlight kata ──
  const applyWord = (blokId: number, wordIdx: number, val: boolean) => {
    if (lockedWords(blokId).has(wordIdx)) return
    setLocalWords(prev => {
      const cur = new Set(prev[blokId] || [])
      if (val) cur.add(wordIdx); else cur.delete(wordIdx)
      return { ...prev, [blokId]: Array.from(cur) }
    })
    setDirty(true)
  }

  const onWordPointerDown = (blokId: number, wordIdx: number) => {
    if (lockedWords(blokId).has(wordIdx)) return
    const has = (localWords[blokId] || []).includes(wordIdx)
    if (dragMode) wordDragRef.current = { blokId, add: !has }
    applyWord(blokId, wordIdx, !has)
  }

  const onWordsPointerMove = (e: React.PointerEvent) => {
    const drag = wordDragRef.current
    if (!drag) return
    const node = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-word-idx]')
    if (!node) return
    const idx = Number(node.getAttribute('data-word-idx'))
    applyWord(drag.blokId, idx, drag.add)
  }

  const markSelectedBabComplete = () => {
    if (!selectedBab) return
    if (isJurumiyah) {
      const blok = selectedBab.blok[0]
      if (!blok || !canEditBlok(blok)) return
      const locked = lockedWords(blok.id)
      const all = wordsOf(blok).map((_, i) => i).filter(i => !locked.has(i))
      setLocalWords(prev => ({ ...prev, [blok.id]: all }))
      setDirty(true)
      return
    }
    setLocalChecked(prev => { const n = new Set(prev); for (const b of selectedBab.blok) if (canEditBlok(b)) n.add(b.id); return n })
    setDirty(true)
  }

  const selectedCount = isJurumiyah
    ? Object.values(localWords).reduce((a, w) => a + w.length, 0)
    : localChecked.size
  const totalUnits = isJurumiyah
    ? data.bab.reduce((a: number, b: any) => a + (b.blok[0] ? wordsOf(b.blok[0]).length : 0), 0)
    : totalBlok

  useEffect(() => {
    if (!draftKey || !dirty) return
    try { sessionStorage.setItem(draftKey, JSON.stringify({ checkedBlokIds: Array.from(localChecked), words: localWords, updatedAt: new Date().toISOString() })) } catch {}
  }, [draftKey, dirty, localChecked, localWords])

  const resetAllDraft = () => {
    if (!selectedSantriId) return
    const nc = new Set<number>()
    for (const bab of data.bab) for (const blok of bab.blok) if (getPersistedChecked(blok.id)) nc.add(blok.id)
    setLocalChecked(nc); setDirty(false)
    try { if (draftKey) sessionStorage.removeItem(draftKey) } catch {}
  }

  const saveProgress = async () => {
    if (!selectedSantriId) return
    if (isJurumiyah) return saveHighlight()
    setSaving(true)
    const res = await simpanHafalanProgressBatch({
      kelasId, jenis: selectedType.key, riwayatId: selectedSantriId,
      checkedBlokIds: Array.from(localChecked).filter(id => data.bab.some((b: any) => b.blok.some((bl: any) => bl.id === id && canEditBlok(bl)))),
    })
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    const checkedSet = new Set(res.checkedBlokIds)
    setData((prev: any) => {
      const np = { ...prev.progress }, nps = { ...(prev.progressStatus || {}) }, npe = { ...(prev.progressEditable || {}) }
      for (const bab of prev.bab) for (const blok of bab.blok) {
        if (!canEditBlok(blok)) continue
        const key = `${selectedSantriId}:${blok.id}`
        if (checkedSet.has(blok.id)) { np[key] = true; nps[key] = 'hafal'; npe[key] = true }
        else { delete np[key]; delete nps[key]; delete npe[key] }
      }
      return { ...prev, progress: np, progressStatus: nps, progressEditable: npe }
    })
    setDirty(false)
    try { if (draftKey) sessionStorage.removeItem(draftKey) } catch {}
    toast.success('Hafalan disimpan')
  }

  const saveHighlight = async () => {
    setSaving(true)
    const perBlok = Object.entries(localWords)
      .map(([blokId, words]) => ({ blokId: Number(blokId), words }))
      .filter(p => p.words.length && data.bab.some((b: any) => b.blok.some((bl: any) => bl.id === p.blokId && canEditBlok(bl))))
    const res = await simpanHafalanHighlightBatch({ kelasId, jenis: selectedType.key, riwayatId: selectedSantriId, perBlok })
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    setData((prev: any) => {
      const nh = { ...(prev.progressHighlight || {}) }
      const np = { ...prev.progress }
      for (const bab of prev.bab) for (const blok of bab.blok) {
        if (!canEditBlok(blok)) continue
        const key = `${selectedSantriId}:${blok.id}`
        const words = localWords[blok.id] || []
        if (words.length) { nh[key] = [...words]; np[key] = true } else { delete nh[key]; delete np[key] }
      }
      return { ...prev, progressHighlight: nh, progress: np }
    })
    setDirty(false)
    try { if (draftKey) sessionStorage.removeItem(draftKey) } catch {}
    toast.success('Hafalan disimpan')
  }

  const step: 'home' | 'santri' | 'bab' | 'blok' =
    !kelasId || !selectedType ? 'home'
      : !selectedSantriId ? 'santri'
        : !selectedBabId ? 'bab'
          : 'blok'

  const goBack = () => {
    if (step === 'blok') setSelectedBabId(null)
    else if (step === 'bab') setSelectedSantriId('')
    else if (step === 'santri') setSelectedType(null)
  }

  const persistedCount = (riwayatId: string) =>
    Object.keys(data.progress).filter(k => k.startsWith(`${riwayatId}:`) && data.progress[k]).length

  if (loading) return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-7 w-7 animate-spin" /></div>

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-28">
      {step === 'home' && (
        <DashboardPageHeader title="Hafalan" description="Pilih jenis hafalan, lalu santri, lalu tandai bagian yang sudah dihafal." />
      )}

      {step !== 'home' && (
        <div className="sticky top-0 z-20 -mx-2 mb-4 border-b border-slate-100 bg-white/85 px-2 py-3 backdrop-blur sm:-mx-4 sm:px-4">
          <button onClick={goBack} className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <ArrowLeft className="h-4 w-4" />
            {step === 'santri' ? 'Jenis Hafalan' : step === 'bab' ? 'Daftar Santri' : selectedType.label}
          </button>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Crumb on>{selectedType.label.replace('Hafalan ', '')}</Crumb>
            {selectedSantri && <><Sep /><Crumb on={step !== 'santri'}>{selectedSantri.nama}</Crumb></>}
            {selectedBab && step === 'blok' && <><Sep /><span className="font-bold text-slate-900" dir="rtl" style={{ fontFamily: isQuran ? QURAN_FONT : ARABIC_FONT }}>{selectedBab.judul}</span></>}
          </div>
        </div>
      )}

      {/* HOME */}
      {step === 'home' && (
        <div className="mt-5 space-y-4">
          {kelasList.length > 1 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Kelas</label>
              <select value={kelasId} onChange={e => setKelasId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Pilih kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>
          ) : kelasList.length === 1 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-emerald-600">Kelas</p>
              <p className="font-bold text-emerald-900">{kelasList[0].nama_kelas}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">Belum ada kelas yang bisa diakses.</div>
          )}

          {kelasId && (
            <div className="grid gap-3 sm:grid-cols-2">
              {types.map(type => (
                <button key={type.key} onClick={() => setSelectedType(type)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><BookOpenCheck className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-slate-900">{type.label}</h2>
                    <p className="text-xs text-slate-500">{type.total_bab} bab · {type.total_blok} blok</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                </button>
              ))}
              {types.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">Belum ada konten hafalan aktif untuk marhalah kelas ini.</div>}
            </div>
          )}
        </div>
      )}

      {/* SANTRI */}
      {step === 'santri' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={santriSearch} onChange={e => setSantriSearch(e.target.value)} placeholder="Cari nama / NIS" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="space-y-2">
            {filteredSantri.map((s: any) => {
              const done = persistedCount(s.riwayat_id)
              const pct = totalBlok ? Math.round((done / totalBlok) * 100) : 0
              return (
                <button key={s.riwayat_id} onClick={() => selectSantri(s.riwayat_id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-emerald-300">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{s.nama}</p>
                    <p className="text-xs text-slate-400">{s.nis || '-'}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-emerald-700">{done}/{totalBlok}</p>
                    <ChevronRight className="ml-auto h-5 w-5 text-slate-300" />
                  </div>
                </button>
              )
            })}
            {filteredSantri.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Santri tidak ditemukan.</p>}
          </div>
        </div>
      )}

      {/* BAB */}
      {step === 'bab' && selectedSantri && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
            <p className="text-sm font-bold text-slate-700">{isJurumiyah ? 'Pilih bab' : 'Pilih bab / surat'}</p>
            <p className="text-sm font-bold text-emerald-700">{selectedCount}/{totalUnits}{isJurumiyah ? ' kata' : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.bab.map((bab: any) => {
              const jblok = isJurumiyah ? bab.blok[0] : null
              const done = isJurumiyah
                ? ((localWords[jblok?.id] || []).length + (data.progressHighlightLocked?.[`${selectedSantriId}:${jblok?.id}`]?.length || 0))
                : bab.blok.filter((b: any) => localChecked.has(b.id)).length
              const all = isJurumiyah ? (jblok ? wordsOf(jblok).length : 0) : bab.blok.length
              const full = all > 0 && done >= all
              return (
                <button key={bab.id} onClick={() => setSelectedBabId(bab.id)}
                  className={`relative rounded-2xl border p-3 text-left transition hover:border-emerald-300 ${bab.is_editable ? 'border-slate-200 bg-white' : 'border-sky-100 bg-sky-50'}`}>
                  <div className="flex items-start justify-between gap-1">
                    <p className="line-clamp-2 font-bold leading-tight text-slate-900" dir={isQuran ? 'rtl' : 'ltr'} style={isQuran ? { fontFamily: QURAN_FONT } : undefined}>{bab.judul}</p>
                    {!bab.is_editable && <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">Lama</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${full ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${all ? (done / all) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{done}/{all}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* BLOK — panel baca + swipe blocking */}
      {step === 'blok' && selectedBab && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={markSelectedBabComplete} disabled={!selectedBab.blok.some((b: any) => canEditBlok(b))} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Hafal semua</button>
              <button onClick={() => setDragMode(v => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${dragMode ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {dragMode ? 'Mode Blok: ON' : 'Mode Blok'}
              </button>
              <button onClick={() => setShowTerjemah(v => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${showTerjemah ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Languages className="h-3.5 w-3.5" /> Terjemah
              </button>
            </div>
            {dirty && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Draft belum disimpan</span>}
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
            {dragMode ? 'Mode Blok aktif: geser jari untuk menandai beberapa bagian sekaligus (scroll dimatikan sementara).' : 'Tap bagian untuk menandai hafal. Aktifkan "Mode Blok" untuk swipe banyak sekaligus.'}
          </p>

          {dirty && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold leading-5">Belum tersimpan. Tekan Simpan Hafalan agar masuk database.</p>
            </div>
          )}

          {isJurumiyah && selectedBab.blok[0] ? (
            <div
              onPointerMove={onWordsPointerMove}
              dir="rtl"
              style={{ fontFamily: ARABIC_FONT, touchAction: dragMode ? 'none' : 'auto' }}
              className="select-none rounded-2xl border border-slate-200 bg-white p-4 text-right text-2xl leading-[2.6] text-slate-900 shadow-sm"
            >
              {(() => {
                const blok = selectedBab.blok[0]
                const editable = canEditBlok(blok)
                const locked = lockedWords(blok.id)
                const sel = new Set(localWords[blok.id] || [])
                return wordsOf(blok).map((w, i) => {
                  const isLocked = locked.has(i)
                  const isSel = sel.has(i)
                  return (
                    <span
                      key={i}
                      data-word-idx={i}
                      onClick={() => { if (!dragMode && editable) applyWord(blok.id, i, !isSel) }}
                      onPointerDown={() => { if (dragMode && editable) onWordPointerDown(blok.id, i) }}
                      className={`mx-0.5 inline-block cursor-pointer rounded px-1 transition ${
                        isLocked ? 'bg-sky-100 text-sky-700'
                        : isSel ? 'bg-emerald-500 text-white'
                        : 'hover:bg-emerald-50'}`}
                    >
                      {w}
                    </span>
                  )
                })
              })()}
            </div>
          ) : (
          <div className="space-y-2" onPointerMove={onListPointerMove}>
            {selectedBab.blok.map((blok: any) => {
              const checked = localChecked.has(blok.id)
              const persisted = getPersistedChecked(blok.id)
              const readonly = isReadonlyPersisted(blok.id)
              const changed = canEditBlok(blok) && checked !== persisted
              const num = isQuran ? (String(blok.label).match(/\d+/)?.[0] || blok.label) : blok.label
              return (
                <div key={blok.id} data-blok-id={blok.id}
                  onClick={() => { if (!dragMode) toggleSingle(blok) }}
                  onPointerDown={() => { if (dragMode) onBlokPointerDown(blok) }}
                  style={{ touchAction: dragMode ? 'none' : 'auto' }}
                  className={`flex select-none items-stretch gap-3 rounded-2xl border p-3 transition ${
                    readonly ? 'cursor-not-allowed border-sky-200 bg-sky-50'
                    : changed && checked ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200'
                    : changed && !checked ? 'border-rose-300 bg-rose-50'
                    : checked ? 'border-emerald-500 bg-emerald-50'
                    : 'cursor-pointer border-slate-200 bg-white hover:border-emerald-300'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${checked ? 'bg-emerald-600 text-white' : readonly ? 'bg-sky-200 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    {checked ? <Check className="h-5 w-5" /> : num}
                  </div>
                  <div className="min-w-0 flex-1">
                    {blok.teks?.arab ? (
                      <p dir="rtl" style={{ fontFamily: isQuran ? QURAN_FONT : ARABIC_FONT }} className="text-right text-2xl leading-[2.4] text-slate-900">{blok.teks.arab}</p>
                    ) : (
                      <p className="font-bold text-slate-800">{blok.label}{blok.deskripsi ? <span className="ml-1 text-xs font-normal text-slate-400">· {blok.deskripsi}</span> : null}</p>
                    )}
                    {showTerjemah && blok.teks?.terjemah && <p className="mt-1 text-sm leading-relaxed text-slate-500">{blok.teks.terjemah}</p>}
                    {blok.teks?.meta && !isQuran && <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">{blok.teks.meta}</p>}
                  </div>
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      {selectedSantriId && step !== 'home' && step !== 'santri' && (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex max-w-3xl gap-2 px-3 sm:bottom-4">
          <button onClick={resetAllDraft} disabled={!dirty || saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg disabled:opacity-50">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={saveProgress} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Hafalan ({selectedCount})
          </button>
        </div>
      )}
    </div>
  )
}

function Crumb({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <span className={`font-bold ${on ? 'text-slate-900' : 'text-slate-400'}`}>{children}</span>
}
function Sep() { return <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> }
