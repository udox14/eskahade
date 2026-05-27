'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, BookOpenCheck, Check, ChevronRight, Loader2, RotateCcw, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getAvailableHafalanTypes,
  getHafalanInitialData,
  getHafalanInputData,
  simpanHafalanProgressBatch,
} from './actions'

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
  const [localStatus, setLocalStatus] = useState<Record<number, string>>({})
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const santriListRef = useRef<HTMLDivElement>(null)
  const babSelectorRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)

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
      setLocalStatus({})
      setRangeAnchor(null)
      setDirty(false)
    })
  }, [kelasId, selectedType])

  const totalBlok = useMemo(() => data.bab.reduce((sum: number, bab: any) => sum + bab.blok.length, 0), [data.bab])
  const selectedSantri = useMemo(
    () => data.santri.find((item: any) => item.riwayat_id === selectedSantriId),
    [data.santri, selectedSantriId]
  )
  const selectedBab = useMemo(
    () => data.bab.find((item: any) => item.id === selectedBabId),
    [data.bab, selectedBabId]
  )
  const filteredSantri = useMemo(() => {
    const needle = santriSearch.trim().toLowerCase()
    if (!needle) return data.santri
    return data.santri.filter((item: any) =>
      String(item.nama || '').toLowerCase().includes(needle) ||
      String(item.nis || '').toLowerCase().includes(needle)
    )
  }, [data.santri, santriSearch])

  const selectSantri = (riwayatId: string) => {
    setSelectedSantriId(riwayatId)
    const nextDraftKey = `hafalan-draft:${kelasId}:${selectedType.key}:${riwayatId}`
    try {
      const rawDraft = sessionStorage.getItem(nextDraftKey)
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft)
        if (Array.isArray(parsed?.checkedBlokIds)) {
          setLocalChecked(new Set(parsed.checkedBlokIds.map(Number)))
          setLocalStatus(parsed.statusByBlokId || {})
          setDirty(true)
          setSelectedBabId(null)
          toast.info('Draft hafalan yang belum disimpan dipulihkan')
          return
        }
      }
    } catch {}

    const ids = data.bab.flatMap((bab: any) => bab.blok.map((blok: any) => blok.id))
      .filter((blokId: number) => data.progress[`${riwayatId}:${blokId}`])
    setLocalChecked(new Set(ids))
    setLocalStatus(Object.fromEntries(
      ids.map((blokId: number) => [blokId, data.progressStatus?.[`${riwayatId}:${blokId}`] || 'hafal'])
    ))
    setDirty(false)
    setSelectedBabId(null)
    setRangeAnchor(null)
    window.setTimeout(() => babSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const selectBab = (babId: number) => {
    setSelectedBabId(babId)
    setRangeAnchor(null)
    window.setTimeout(() => blockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const toggleLocal = (blokId: number) => {
    const target = selectedBab?.blok.find((blok: any) => blok.id === blokId)
    if (!target?.is_editable || isReadonlyPersisted(blokId)) {
      toast.info('Progress dari marhalah sebelumnya hanya bisa dilihat')
      return
    }
    setLocalChecked(prev => {
      const next = new Set(prev)
      const selectedBabBlocks = selectedBab?.blok || []
      const anchorIndex = rangeAnchor == null ? -1 : selectedBabBlocks.findIndex((blok: any) => blok.id === rangeAnchor)
      const currentIndex = selectedBabBlocks.findIndex((blok: any) => blok.id === blokId)

      if (anchorIndex >= 0 && currentIndex >= 0 && rangeAnchor !== blokId) {
        const [start, end] = anchorIndex < currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]
        for (const blok of selectedBabBlocks.slice(start, end + 1)) {
          if (canEditBlok(blok)) next.add(blok.id)
        }
      } else if (next.has(blokId)) {
        next.delete(blokId)
      } else {
        next.add(blokId)
      }
      return next
    })
    setRangeAnchor(blokId)
    setDirty(true)
  }

  const setJurumiyahStatus = (blokId: number, status: 'belum' | 'proses' | 'hafal') => {
    const target = data.bab.flatMap((bab: any) => bab.blok).find((blok: any) => blok.id === blokId)
    if (!target?.is_editable || isReadonlyPersisted(blokId)) {
      toast.info('Progress dari marhalah sebelumnya hanya bisa dilihat')
      return
    }
    setLocalChecked(prev => {
      const next = new Set(prev)
      if (status === 'belum') next.delete(blokId)
      else next.add(blokId)
      return next
    })
    setLocalStatus(prev => {
      const next = { ...prev }
      if (status === 'belum') delete next[blokId]
      else next[blokId] = status
      return next
    })
    setDirty(true)
  }

  const markSelectedBabComplete = () => {
    if (!selectedBab) return
    setLocalChecked(prev => {
      const next = new Set(prev)
      for (const blok of selectedBab.blok) {
        if (canEditBlok(blok)) next.add(blok.id)
      }
      return next
    })
    setDirty(true)
  }

  useEffect(() => {
    if (!draftKey || !dirty) return
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        checkedBlokIds: Array.from(localChecked),
        statusByBlokId: localStatus,
        updatedAt: new Date().toISOString(),
      }))
    } catch {}
  }, [draftKey, dirty, localChecked])

  const displayBlokLabel = (label: string) => {
    if (selectedType?.key !== 'quran') return label
    const match = String(label).match(/\d+/)
    return match ? match[0] : label
  }

  const getPersistedChecked = (blokId: number) => {
    if (!selectedSantriId) return false
    return !!data.progress[`${selectedSantriId}:${blokId}`]
  }

  const isReadonlyPersisted = (blokId: number) => {
    if (!selectedSantriId) return false
    const key = `${selectedSantriId}:${blokId}`
    return !!data.progress[key] && !data.progressEditable?.[key]
  }

  const canEditBlok = (blok: any) => {
    return !!blok?.is_editable && !isReadonlyPersisted(blok.id)
  }

  const hasDraftChanges = (checked: Set<number>, statusByBlokId: Record<number, string>) => {
    if (!selectedSantriId) return false
    for (const bab of data.bab) {
      for (const blok of bab.blok) {
        if (!canEditBlok(blok)) continue
        const persisted = getPersistedChecked(blok.id)
        const current = checked.has(blok.id)
        if (persisted !== current) return true

        if (selectedType?.key === 'jurumiyah' && current) {
          const persistedStatus = data.progressStatus?.[`${selectedSantriId}:${blok.id}`] || 'hafal'
          const currentStatus = statusByBlokId[blok.id] || 'hafal'
          if (persistedStatus !== currentStatus) return true
        }
      }
    }
    return false
  }

  const resetDraftForBab = (bab: any) => {
    if (!bab || !selectedSantriId) return
    const nextChecked = new Set(localChecked)
    const nextStatus = { ...localStatus }

    for (const blok of bab.blok) {
      if (!canEditBlok(blok)) continue
      const persisted = getPersistedChecked(blok.id)
      const persistedStatus = data.progressStatus?.[`${selectedSantriId}:${blok.id}`]

      if (persisted) {
        nextChecked.add(blok.id)
        nextStatus[blok.id] = persistedStatus || 'hafal'
      } else {
        nextChecked.delete(blok.id)
        delete nextStatus[blok.id]
      }
    }

    setLocalChecked(nextChecked)
    setLocalStatus(nextStatus)
    setRangeAnchor(null)
    const nextDirty = hasDraftChanges(nextChecked, nextStatus)
    setDirty(nextDirty)
    if (!nextDirty && draftKey) {
      try {
        sessionStorage.removeItem(draftKey)
      } catch {}
    }
  }

  const resetAllDraft = () => {
    if (!selectedSantriId) return
    const nextChecked = new Set<number>()
    const nextStatus: Record<number, string> = {}

    for (const bab of data.bab) {
      for (const blok of bab.blok) {
        if (getPersistedChecked(blok.id)) {
          nextChecked.add(blok.id)
          nextStatus[blok.id] = data.progressStatus?.[`${selectedSantriId}:${blok.id}`] || 'hafal'
        }
      }
    }

    setLocalChecked(nextChecked)
    setLocalStatus(nextStatus)
    setRangeAnchor(null)
    setDirty(false)
    try {
      if (draftKey) sessionStorage.removeItem(draftKey)
    } catch {}
  }

  const saveProgress = async () => {
    if (!selectedSantriId) return
    setSaving(true)
    const res = await simpanHafalanProgressBatch({
      kelasId,
      jenis: selectedType.key,
      riwayatId: selectedSantriId,
      checkedBlokIds: Array.from(localChecked).filter(blokId =>
        data.bab.some((bab: any) => bab.blok.some((blok: any) => blok.id === blokId && canEditBlok(blok)))
      ),
      statusByBlokId: selectedType.key === 'jurumiyah'
        ? Object.fromEntries(Object.entries(localStatus).map(([key, value]) => [key, value]))
        : undefined,
    })
    setSaving(false)
    if ('error' in res) return toast.error(res.error)

    const checkedSet = new Set(res.checkedBlokIds)
    setData((prev: any) => {
      const nextProgress = { ...prev.progress }
      for (const bab of prev.bab) {
        for (const blok of bab.blok) {
          if (!canEditBlok(blok)) continue
          const key = `${selectedSantriId}:${blok.id}`
          if (checkedSet.has(blok.id)) nextProgress[key] = true
          else delete nextProgress[key]
        }
      }
      const nextProgressStatus = { ...(prev.progressStatus || {}) }
      for (const bab of prev.bab) {
        for (const blok of bab.blok) {
          if (!canEditBlok(blok)) continue
          const key = `${selectedSantriId}:${blok.id}`
          if (checkedSet.has(blok.id)) nextProgressStatus[key] = selectedType.key === 'jurumiyah' ? localStatus[blok.id] || 'hafal' : 'hafal'
          else delete nextProgressStatus[key]
        }
      }
      const nextProgressEditable = { ...(prev.progressEditable || {}) }
      for (const bab of prev.bab) {
        for (const blok of bab.blok) {
          if (!canEditBlok(blok)) continue
          const key = `${selectedSantriId}:${blok.id}`
          if (checkedSet.has(blok.id)) nextProgressEditable[key] = true
          else delete nextProgressEditable[key]
        }
      }
      return { ...prev, progress: nextProgress, progressStatus: nextProgressStatus, progressEditable: nextProgressEditable }
    })
    setDirty(false)
    try {
      if (draftKey) sessionStorage.removeItem(draftKey)
    } catch {}
    toast.success('Hafalan disimpan')
    window.setTimeout(() => santriListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-2 pb-20 sm:px-4 lg:px-0">
      <DashboardPageHeader
        title="Hafalan"
        description="Pilih jenis hafalan yang tersedia untuk marhalah kelas, lalu tandai blok yang sudah dihafal santri."
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {kelasList.length > 1 ? (
          <div className="max-w-sm">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Pilih kelas</option>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>
        ) : kelasList.length === 1 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-bold uppercase text-emerald-600">Kelas</p>
            <p className="font-semibold text-emerald-900">{kelasList[0].nama_kelas}</p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : !kelasId ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada kelas yang bisa diakses.</div>
      ) : !selectedType ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {types.map(type => (
            <button key={type.key} onClick={() => setSelectedType(type)} className="group rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><BookOpenCheck className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{type.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{type.total_bab} bab, {type.total_blok} blok tersedia</p>
            </button>
          ))}
          {types.length === 0 && <div className="col-span-full rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada konten hafalan aktif untuk marhalah kelas ini.</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <button onClick={() => setSelectedType(null)} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Jenis Hafalan</button>
            <div className="text-left md:text-right">
              <h2 className="text-lg font-bold text-slate-900">{selectedType.label}</h2>
              <p className="text-sm text-slate-500">{data.bab.length} bab, {totalBlok} blok</p>
            </div>
          </div>

          <div ref={santriListRef} className="grid min-w-0 gap-4 lg:grid-cols-[320px_1fr]">
            <div className="min-w-0 rounded-xl border bg-white shadow-sm">
              <div className="border-b p-3">
                <p className="mb-2 text-sm font-bold text-slate-800">Pilih Santri</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={santriSearch}
                    onChange={e => setSantriSearch(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Cari nama / NIS"
                  />
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2">
                {filteredSantri.map((santri: any) => {
                  const done = Object.keys(data.progress).filter(key => key.startsWith(`${santri.riwayat_id}:`) && data.progress[key]).length
                  const active = selectedSantriId === santri.riwayat_id
                  return (
                    <button
                      key={santri.riwayat_id}
                      onClick={() => selectSantri(santri.riwayat_id)}
                      className={`mb-2 w-full rounded-lg border p-3 text-left transition ${active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{santri.nama}</p>
                          <p className="text-xs text-slate-400">{santri.nis || '-'}</p>
                        </div>
                        <p className="shrink-0 text-xs font-bold text-emerald-700">{done}/{totalBlok}</p>
                      </div>
                    </button>
                  )
                })}
                {filteredSantri.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Santri tidak ditemukan.</p>}
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {!selectedSantri ? (
                <div className="rounded-xl border bg-white p-12 text-center text-slate-400">Pilih santri terlebih dahulu.</div>
              ) : (
                <>
                  <div ref={babSelectorRef} className="min-w-0 rounded-xl border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-600">Santri Terpilih</p>
                        <h3 className="font-bold text-slate-900">{selectedSantri.nama}</h3>
                      </div>
                      <p className="text-sm font-bold text-emerald-700">{localChecked.size}/{totalBlok} blok</p>
                    </div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Pilih Bab / Surat</p>
                    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                      {data.bab.map((bab: any) => {
                        const active = selectedBabId === bab.id
                        const babDone = bab.blok.filter((blok: any) => localChecked.has(blok.id)).length
                        if (selectedType?.key === 'jurumiyah') {
                          const statusBlok = bab.blok[0]
                          const status = statusBlok ? localStatus[statusBlok.id] || 'belum' : 'belum'
                          const readonly = statusBlok && !statusBlok.is_editable
                          return (
                            <div key={bab.id} className={`min-h-24 rounded-lg border p-2 ${readonly ? 'border-blue-100 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">{bab.judul}</p>
                                {readonly && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Lama</span>}
                              </div>
                              {bab.source_marhalah_nama && <p className="mt-1 text-[10px] font-semibold text-slate-500">{bab.source_marhalah_nama}</p>}
                              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold">
                                {(['belum', 'proses', 'hafal'] as const).map(option => (
                                  <button
                                    key={option}
                                    disabled={readonly}
                                    onClick={() => statusBlok && setJurumiyahStatus(statusBlok.id, option)}
                                    className={`rounded-md px-1 py-1.5 ${
                                      status === option
                                        ? option === 'hafal'
                                          ? 'bg-emerald-600 text-white'
                                          : option === 'proses'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-700 text-white'
                                        : 'bg-white text-slate-500'
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                  >
                                    {option === 'belum' ? 'Belum' : option === 'proses' ? 'Proses' : 'Selesai'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <button
                            key={bab.id}
                            onClick={() => selectBab(bab.id)}
                            className={`min-h-16 rounded-lg border p-2 text-left transition ${
                              active
                                ? 'border-emerald-500 bg-emerald-600 text-white'
                                : bab.is_editable
                                  ? 'border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-300'
                                  : 'border-blue-100 bg-blue-50 text-slate-800 hover:border-blue-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-bold leading-tight">{bab.judul}</p>
                              {!bab.is_editable && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>Lama</span>}
                            </div>
                            <p className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>{babDone}/{bab.blok.length}</p>
                          </button>
                        )
                      })}
                    </div>
                    {selectedType?.key === 'jurumiyah' && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          onClick={resetAllDraft}
                          disabled={!dirty || saving}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50 sm:w-auto"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Unselect draft
                        </button>
                        <button
                          onClick={saveProgress}
                          disabled={saving}
                          className="sticky bottom-16 z-30 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 md:static md:w-auto"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Simpan Hafalan
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedBab && selectedType?.key !== 'jurumiyah' && (
                    <div ref={blockRef} className="min-w-0 rounded-xl border bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-500">Input Blok</p>
                          <h3 className="font-bold text-slate-900">{selectedBab.judul}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={markSelectedBabComplete} disabled={!selectedBab.blok.some((blok: any) => canEditBlok(blok))} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                            Hafal semua
                          </button>
                          <button
                            onClick={() => resetDraftForBab(selectedBab)}
                            disabled={!dirty}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Unselect draft
                          </button>
                          {dirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Draft lokal</span>}
                        </div>
                      </div>
                      {dirty && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p className="text-xs font-semibold leading-5">Belum tersimpan. Tekan Simpan Hafalan agar masuk ke database.</p>
                        </div>
                      )}
                      <div className={selectedType?.key === 'quran'
                        ? 'grid grid-cols-5 justify-items-center gap-1.5 sm:grid-cols-8 sm:gap-2 md:grid-cols-10'
                        : 'flex flex-wrap gap-2'
                      }>
                        {selectedBab.blok.map((blok: any) => {
                          const checked = localChecked.has(blok.id)
                          const persisted = getPersistedChecked(blok.id)
                          const readonly = isReadonlyPersisted(blok.id)
                          const changed = canEditBlok(blok) && checked !== persisted
                          return (
                            <button
                              key={blok.id}
                              onClick={() => toggleLocal(blok.id)}
                              title={blok.deskripsi || blok.label}
                              className={`relative flex items-center justify-center rounded-lg border text-sm font-black leading-tight transition ${
                                selectedType?.key === 'quran'
                                  ? 'aspect-square h-11 w-11 sm:h-12 sm:w-12'
                                  : 'min-h-12 min-w-[88px] max-w-full px-3 py-2 sm:min-w-24'
                              } ${
                                readonly
                                  ? 'cursor-not-allowed border-blue-200 bg-blue-50 text-blue-700'
                                  : changed && checked
                                  ? 'border-amber-400 bg-amber-100 text-amber-900 ring-2 ring-amber-200'
                                  : changed && !checked
                                    ? 'border-rose-300 bg-rose-50 text-rose-700 ring-2 ring-rose-100'
                                    : checked
                                      ? 'border-emerald-500 bg-emerald-600 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              {checked && selectedType?.key !== 'quran' ? <Check className="h-4 w-4" /> : displayBlokLabel(blok.label)}
                              {changed && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-semibold text-slate-600 sm:flex sm:flex-wrap sm:gap-2 sm:text-[11px]">
                        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-50 px-1.5 py-1 text-emerald-700 sm:justify-start sm:px-2"><span className="h-2 w-2 rounded-full bg-emerald-600" /> DB</span>
                        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-blue-50 px-1.5 py-1 text-blue-700 sm:justify-start sm:px-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Lama</span>
                        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-amber-50 px-1.5 py-1 text-amber-700 sm:justify-start sm:px-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> + Draft</span>
                        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-rose-50 px-1.5 py-1 text-rose-700 sm:justify-start sm:px-2"><span className="h-2 w-2 rounded-full bg-rose-500" /> - Draft</span>
                      </div>
                      <button
                        onClick={saveProgress}
                        disabled={saving}
                        className="sticky bottom-16 z-30 mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 md:static md:w-auto"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan Hafalan
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
