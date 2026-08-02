'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowUp, BookOpenCheck, Check, ChevronRight, Languages, Loader2,
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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type AutosaveScope = {
  key: string
  kelasId: string
  jenis: string
  riwayatId: string
}

type PendingChange = {
  checked: boolean
  revision: number
}

export default function HafalanPageContent() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kelasId, setKelasId] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState<any>(null)
  const [data, setData] = useState<any>({ santri: [], bab: [], progress: {} })
  const [selectedSantriId, setSelectedSantriId] = useState('')
  const [selectedBabId, setSelectedBabId] = useState<number | null>(null)
  const [babTab, setBabTab] = useState<'current' | 'old'>('current')
  const [santriSearch, setSantriSearch] = useState('')
  const [quranTargetAyat, setQuranTargetAyat] = useState('')
  const [localChecked, setLocalChecked] = useState<Set<number>>(new Set())
  const [localWords, setLocalWords] = useState<Record<number, number[]>>({}) // jurumiyah: blokId -> word idx
  const [showTerjemah, setShowTerjemah] = useState(true)
  const [dragMode, setDragMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const dragRef = useRef<{ add: boolean } | null>(null)
  const wordDragRef = useRef<{ blokId: number; add: boolean } | null>(null)
  const localCheckedRef = useRef(localChecked)
  const pendingChangesRef = useRef(new Map<string, Map<number, PendingChange>>())
  const autosaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const autosaveInFlightRef = useRef(new Set<string>())
  const quranTargetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeRevisionRef = useRef(0)
  const currentScopeKeyRef = useRef('')
  const currentDataScopeKeyRef = useRef('')

  const draftKey = useMemo(() => {
    if (!kelasId || !selectedType?.key || !selectedSantriId) return ''
    return `hafalan-draft:${kelasId}:${selectedType.key}:${selectedSantriId}`
  }, [kelasId, selectedType?.key, selectedSantriId])

  const saveScope = useMemo<AutosaveScope | null>(() => {
    if (!kelasId || !selectedType?.key || !selectedSantriId) return null
    return {
      key: `${kelasId}:${selectedType.key}:${selectedSantriId}`,
      kelasId,
      jenis: selectedType.key,
      riwayatId: selectedSantriId,
    }
  }, [kelasId, selectedType?.key, selectedSantriId])
  currentScopeKeyRef.current = saveScope?.key || ''
  currentDataScopeKeyRef.current = kelasId && selectedType?.key ? `${kelasId}:${selectedType.key}` : ''

  useEffect(() => {
    getHafalanInitialData().then(res => {
      setKelasList(res.kelas)
      let cachedKelasId = ''
      try { cachedKelasId = localStorage.getItem('hafalan-selected-kelas') || '' } catch {}
      const availableKelasIds = res.kelas.map((kelas: any) => String(kelas.id))
      if (res.kelas.length === 1) setKelasId(String(res.kelas[0].id))
      else if (cachedKelasId && availableKelasIds.includes(cachedKelasId)) setKelasId(cachedKelasId)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!kelasId || kelasList.length < 2) return
    try { localStorage.setItem('hafalan-selected-kelas', kelasId) } catch {}
  }, [kelasId, kelasList.length])

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
      setBabTab('current')
      setLocalChecked(new Set())
      localCheckedRef.current = new Set()
      setDirty(false)
      setSaving(false)
      setSaveStatus('idle')
    })
  }, [kelasId, selectedType])

  useEffect(() => {
    localCheckedRef.current = localChecked
  }, [localChecked])

  useEffect(() => {
    const timers = autosaveTimersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      if (quranTargetTimerRef.current) clearTimeout(quranTargetTimerRef.current)
    }
  }, [])

  // bersihkan drag saat pointer dilepas di mana pun
  useEffect(() => {
    const up = () => { dragRef.current = null; wordDragRef.current = null }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [])

  const scrollMainToTop = () => {
    const scroller = document.querySelector('main') as HTMLElement | null
    if (!scroller) return
    const previousScrollBehavior = scroller.style.scrollBehavior
    scroller.style.scrollBehavior = 'auto'
    scroller.scrollTop = 0
    scroller.style.scrollBehavior = previousScrollBehavior
  }

  useEffect(() => {
    if (!selectedSantriId) return
    scrollMainToTop()
  }, [selectedSantriId])

  useEffect(() => {
    setQuranTargetAyat('')
    if (quranTargetTimerRef.current) {
      clearTimeout(quranTargetTimerRef.current)
      quranTargetTimerRef.current = null
    }
  }, [selectedBabId, selectedSantriId, selectedType?.key])

  const currentBab = useMemo(() => data.bab.filter((b: any) => b.is_editable), [data.bab])
  const oldBab = useMemo(() => data.bab.filter((b: any) => !b.is_editable), [data.bab])
  const visibleBab = babTab === 'old' ? oldBab : currentBab
  const currentBlokIds = useMemo(
    () => new Set<number>(currentBab.flatMap((b: any) => b.blok.map((blok: any) => blok.id))),
    [currentBab],
  )
  const totalBlok = useMemo(() => currentBab.reduce((s: number, b: any) => s + b.blok.length, 0), [currentBab])
  const selectedSantri = useMemo(() => data.santri.find((i: any) => i.riwayat_id === selectedSantriId), [data.santri, selectedSantriId])
  const selectedBab = useMemo(() => data.bab.find((i: any) => i.id === selectedBabId), [data.bab, selectedBabId])
  const isQuran = selectedType?.key === 'quran'
  const isJurumiyah = selectedType?.key === 'jurumiyah'

  const wordsOf = (blok: any): string[] => String(blok?.teks?.arab || '').split(/\s+/).filter(Boolean)
  const lockedWords = (blokId: number): Set<number> => new Set(data.progressHighlightLocked?.[`${selectedSantriId}:${blokId}`] || [])
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
  const getQuranAyatNumber = (blok: any) => Number(String(blok?.label || '').match(/\d+/)?.[0] || 0)
  const quranAyatRows = isQuran && selectedBab
    ? [...selectedBab.blok].sort((a: any, b: any) => getQuranAyatNumber(a) - getQuranAyatNumber(b))
    : []
  const quranLastMemorizedAyat = quranAyatRows.reduce(
    (last: number, blok: any) => localChecked.has(blok.id) ? Math.max(last, getQuranAyatNumber(blok)) : last,
    0,
  )
  const quranMaxAyat = quranAyatRows.length ? getQuranAyatNumber(quranAyatRows[quranAyatRows.length - 1]) : 0
  const quranHasEditableAyat = quranAyatRows.some((blok: any) => canEditBlok(blok))

  const getScopeForSantri = (riwayatId: string): AutosaveScope | null => {
    if (!kelasId || !selectedType?.key || !riwayatId) return null
    return {
      key: `${kelasId}:${selectedType.key}:${riwayatId}`,
      kelasId,
      jenis: selectedType.key,
      riwayatId,
    }
  }

  const getPendingForScope = (scope: AutosaveScope) => {
    let pending = pendingChangesRef.current.get(scope.key)
    if (!pending) {
      pending = new Map<number, PendingChange>()
      pendingChangesRef.current.set(scope.key, pending)
    }
    return pending
  }

  const clearAutosaveTimer = (scopeKey: string) => {
    const timer = autosaveTimersRef.current.get(scopeKey)
    if (timer === undefined) return
    clearTimeout(timer)
    autosaveTimersRef.current.delete(scopeKey)
  }

  function scheduleAutosave(scope: AutosaveScope, delay = 800) {
    clearAutosaveTimer(scope.key)
    const timer = setTimeout(() => {
      autosaveTimersRef.current.delete(scope.key)
      void flushAutosave(scope)
    }, delay)
    autosaveTimersRef.current.set(scope.key, timer)
  }

  async function flushAutosave(scope: AutosaveScope) {
    const pending = pendingChangesRef.current.get(scope.key)
    if (!pending?.size || autosaveInFlightRef.current.has(scope.key)) return

    const snapshot = new Map(pending)
    autosaveInFlightRef.current.add(scope.key)
    if (currentScopeKeyRef.current === scope.key) {
      setSaving(true)
      setSaveStatus('saving')
    }

    try {
      const res = await simpanHafalanProgressBatch({
        kelasId: scope.kelasId,
        jenis: scope.jenis,
        riwayatId: scope.riwayatId,
        changes: Array.from(snapshot.entries()).map(([blokId, change]) => ({
          blokId,
          checked: change.checked,
        })),
      })
      if ('error' in res) throw new Error(res.error)

      const appliedIds = new Set(res.appliedBlokIds || snapshot.keys())
      if (currentDataScopeKeyRef.current === `${scope.kelasId}:${scope.jenis}`) {
        setData((prev: any) => {
          const np = { ...prev.progress }
          const nps = { ...(prev.progressStatus || {}) }
          const npe = { ...(prev.progressEditable || {}) }
          for (const [blokId, change] of snapshot) {
            if (!appliedIds.has(blokId)) continue
            const key = `${scope.riwayatId}:${blokId}`
            if (change.checked) {
              np[key] = true
              nps[key] = 'hafal'
              npe[key] = true
            } else {
              delete np[key]
              delete nps[key]
              delete npe[key]
            }
          }
          return { ...prev, progress: np, progressStatus: nps, progressEditable: npe }
        })
      }

      const latest = pendingChangesRef.current.get(scope.key)
      for (const [blokId, change] of snapshot) {
        if (latest?.get(blokId)?.revision === change.revision) latest.delete(blokId)
      }

      if (!latest?.size) {
        pendingChangesRef.current.delete(scope.key)
        try { sessionStorage.removeItem(`hafalan-draft:${scope.kelasId}:${scope.jenis}:${scope.riwayatId}`) } catch {}
        if (currentScopeKeyRef.current === scope.key) {
          setDirty(false)
          setSaveStatus('saved')
        }
      } else {
        if (currentScopeKeyRef.current === scope.key) {
          setDirty(true)
          setSaveStatus('saving')
        }
        if (!autosaveTimersRef.current.has(scope.key)) scheduleAutosave(scope, 0)
      }
    } catch (error) {
      console.error('[hafalan] autosave gagal:', error)
      if (currentScopeKeyRef.current === scope.key) {
        setDirty(true)
        setSaveStatus('error')
      }
    } finally {
      autosaveInFlightRef.current.delete(scope.key)
      if (currentScopeKeyRef.current === scope.key) setSaving(false)
    }
  }

  const queueAutosave = (blokId: number, checked: boolean, scope = saveScope) => {
    if (!isQuran || !scope) return
    getPendingForScope(scope).set(blokId, {
      checked,
      revision: ++changeRevisionRef.current,
    })
    if (currentScopeKeyRef.current === scope.key) {
      setDirty(true)
      setSaveStatus('saving')
    }
    scheduleAutosave(scope)
  }

  const applyQuranTarget = (rawValue: string) => {
    if (!isQuran || !selectedBab) return
    const normalized = rawValue.replace(/\D/g, '')
    const target = Number(normalized)
    const currentLast = quranAyatRows.reduce(
      (last: number, blok: any) => localCheckedRef.current.has(blok.id) ? Math.max(last, getQuranAyatNumber(blok)) : last,
      0,
    )
    if (!normalized || !Number.isInteger(target) || target <= currentLast) {
      setQuranTargetAyat('')
      return
    }
    if (target > quranMaxAyat) {
      setQuranTargetAyat('')
      toast.info(`Maksimal ayat pada surat ini adalah ${quranMaxAyat}.`)
      return
    }

    const nextChecked = new Set(localCheckedRef.current)
    const addedIds: number[] = []
    for (const blok of quranAyatRows) {
      const ayatNumber = getQuranAyatNumber(blok)
      if (ayatNumber > currentLast && ayatNumber <= target && canEditBlok(blok) && !nextChecked.has(blok.id)) {
        nextChecked.add(blok.id)
        addedIds.push(blok.id)
      }
    }
    if (!addedIds.length) {
      setQuranTargetAyat('')
      return
    }

    setLocalChecked(nextChecked)
    localCheckedRef.current = nextChecked
    for (const blokId of addedIds) queueAutosave(blokId, true)
    setDirty(true)
    setQuranTargetAyat('')
  }

  const handleQuranTargetChange = (value: string) => {
    const normalized = value.replace(/\D/g, '')
    setQuranTargetAyat(normalized)
    if (quranTargetTimerRef.current) clearTimeout(quranTargetTimerRef.current)
    if (!normalized) return
    quranTargetTimerRef.current = setTimeout(() => {
      quranTargetTimerRef.current = null
      applyQuranTarget(normalized)
    }, 500)
  }

  const submitQuranTarget = () => {
    if (quranTargetTimerRef.current) {
      clearTimeout(quranTargetTimerRef.current)
      quranTargetTimerRef.current = null
    }
    applyQuranTarget(quranTargetAyat)
  }

  const retryAutosave = () => {
    if (!saveScope || !pendingChangesRef.current.get(saveScope.key)?.size) return
    setSaveStatus('saving')
    scheduleAutosave(saveScope, 0)
  }

  const canEditBlokForSantri = (blok: any, riwayatId: string) => {
    const key = `${riwayatId}:${blok.id}`
    return !!blok?.is_editable && !(data.progress[key] && !data.progressEditable?.[key])
  }

  const selectSantri = (riwayatId: string) => {
    setSelectedSantriId(riwayatId)
    setBabTab('current')
    setSelectedBabId(currentBab.length === 1 ? currentBab[0].id : null)
    const scope = getScopeForSantri(riwayatId)
    const nextDraftKey = `hafalan-draft:${kelasId}:${selectedType.key}:${riwayatId}`
    try {
      const raw = sessionStorage.getItem(nextDraftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.checkedBlokIds)) {
          const restoredChecked = new Set<number>(parsed.checkedBlokIds.map(Number))
          let restoredHasPending = !!(scope && pendingChangesRef.current.get(scope.key)?.size)
          setLocalChecked(restoredChecked)
          localCheckedRef.current = restoredChecked
          setLocalWords(parsed.words || {})
          setDirty(true)
          setSaveStatus(isQuran ? 'saving' : 'idle')
          if (isQuran && scope) {
            for (const bab of data.bab) for (const blok of bab.blok) {
              if (!canEditBlokForSantri(blok, riwayatId)) continue
              const checked = restoredChecked.has(blok.id)
              if (checked !== !!data.progress[`${riwayatId}:${blok.id}`]) {
                queueAutosave(blok.id, checked, scope)
                restoredHasPending = true
              }
            }
          }
          if (isQuran && !restoredHasPending) {
            setDirty(false)
            setSaveStatus('saved')
            try { sessionStorage.removeItem(nextDraftKey) } catch {}
          }
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
      const emptyChecked = new Set<number>()
      setLocalChecked(emptyChecked)
      localCheckedRef.current = emptyChecked
      setDirty(false)
      setSaveStatus('idle')
      return
    }
    const ids = data.bab.flatMap((b: any) => b.blok.map((bl: any) => bl.id)).filter((id: number) => data.progress[`${riwayatId}:${id}`])
    const nextChecked = new Set<number>(ids)
    const pending = scope ? pendingChangesRef.current.get(scope.key) : undefined
    for (const [blokId, change] of pending || []) {
      if (change.checked) nextChecked.add(blokId)
      else nextChecked.delete(blokId)
    }
    setLocalChecked(nextChecked)
    localCheckedRef.current = nextChecked
    setLocalWords({})
    setDirty(!!pending?.size)
    setSaveStatus(pending?.size ? 'saving' : 'saved')
  }

  // ── apply / drag-swipe ──
  const applyBlok = (blokId: number, val: boolean) => {
    setLocalChecked(prev => {
      const n = new Set(prev)
      if (val) n.add(blokId); else n.delete(blokId)
      localCheckedRef.current = n
      return n
    })
    setDirty(true)
    queueAutosave(blokId, val)
  }

  const onBlokPointerDown = (blok: any) => {
    if (!canEditBlok(blok)) return toast.info('Progress marhalah sebelumnya hanya bisa dilihat')
    const val = !localCheckedRef.current.has(blok.id)
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
    applyBlok(blok.id, !localCheckedRef.current.has(blok.id))
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
    const editableBlokIds = selectedBab.blok.filter((b: any) => canEditBlok(b)).map((b: any) => b.id)
    const nextChecked = new Set(localCheckedRef.current)
    for (const blokId of editableBlokIds) nextChecked.add(blokId)
    setLocalChecked(nextChecked)
    localCheckedRef.current = nextChecked
    for (const blokId of editableBlokIds) queueAutosave(blokId, true)
    setDirty(true)
  }

  const selectedCount = isJurumiyah
    ? visibleBab.reduce((a: number, b: any) => a + (b.blok[0] ? (localWords[b.blok[0].id] || []).length : 0), 0)
    : visibleBab.reduce((a: number, b: any) => a + b.blok.filter((blok: any) => localChecked.has(blok.id)).length, 0)
  const totalUnits = isJurumiyah
    ? visibleBab.reduce((a: number, b: any) => a + (b.blok[0] ? wordsOf(b.blok[0]).length : 0), 0)
    : visibleBab.reduce((a: number, b: any) => a + b.blok.length, 0)

  useEffect(() => {
    if (!draftKey || !dirty) return
    try { sessionStorage.setItem(draftKey, JSON.stringify({ checkedBlokIds: Array.from(localChecked), words: localWords, updatedAt: new Date().toISOString() })) } catch {}
  }, [draftKey, dirty, localChecked, localWords])

  const resetAllDraft = () => {
    if (!selectedSantriId) return
    const nc = new Set<number>()
    for (const bab of data.bab) for (const blok of bab.blok) if (getPersistedChecked(blok.id)) nc.add(blok.id)
    setLocalChecked(nc)
    localCheckedRef.current = nc
    if (isJurumiyah) {
      const nw: Record<number, number[]> = {}
      for (const bab of data.bab) for (const blok of bab.blok) {
        const words = data.progressHighlight?.[`${selectedSantriId}:${blok.id}`]
        if (words?.length) nw[blok.id] = [...words]
      }
      setLocalWords(nw)
    }
    if (saveScope) {
      clearAutosaveTimer(saveScope.key)
      pendingChangesRef.current.delete(saveScope.key)
    }
    setDirty(false)
    setSaveStatus('saved')
    try { if (draftKey) sessionStorage.removeItem(draftKey) } catch {}
  }

  const saveProgress = async () => {
    if (!selectedSantriId) return
    if (isJurumiyah) return saveHighlight()
    setSaving(true)
    const res = await simpanHafalanProgressBatch({
      kelasId, jenis: selectedType.key, riwayatId: selectedSantriId,
      changes: data.bab.flatMap((b: any) => b.blok)
        .filter((blok: any) => canEditBlok(blok))
        .map((blok: any) => ({ blokId: blok.id, checked: localChecked.has(blok.id) })),
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
    Object.keys(data.progress).filter(k => {
      const [, blokId] = k.split(':')
      return k.startsWith(`${riwayatId}:`) && currentBlokIds.has(Number(blokId)) && data.progress[k]
    }).length

  if (loading) return <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto h-7 w-7 animate-spin" /></div>

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-28">
      {step === 'home' && (
        <DashboardPageHeader title="Hafalan" description="Pilih jenis hafalan, lalu santri, lalu tandai bagian yang sudah dihafal." />
      )}

      {step !== 'home' && (
        <div className="-mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white px-4 pb-3 pt-2 md:-mx-8 md:-mt-8 md:px-8">
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

      {step !== 'home' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
          <aside className="sticky top-4 hidden self-start lg:block">
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">Daftar santri</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{data.santri.length}</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={santriSearch} onChange={e => setSantriSearch(e.target.value)} placeholder="Cari nama / NIS" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto pr-1">
                {filteredSantri.map((s: any) => {
                  const done = persistedCount(s.riwayat_id)
                  const pct = totalBlok ? Math.round((done / totalBlok) * 100) : 0
                  return (
                    <button key={s.riwayat_id} onClick={() => selectSantri(s.riwayat_id)} className={`flex w-full items-center gap-2 rounded-2xl border p-3 text-left shadow-sm transition hover:border-emerald-300 ${selectedSantriId === s.riwayat_id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{s.nama}</p>
                        <p className="text-[11px] text-slate-400">{s.nis || '-'}</p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-emerald-700">{done}/{totalBlok}</p>
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                      </div>
                    </button>
                  )
                })}
                {filteredSantri.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Santri tidak ditemukan.</p>}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {step === 'santri' && (
              <div className="hidden rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center lg:block">
                <p className="font-bold text-slate-700">Pilih santri di panel kiri</p>
                <p className="mt-1 text-sm text-slate-400">Setelah dipilih, daftar bab atau ayat akan tampil di sini.</p>
              </div>
            )}

      {/* SANTRI */}
      {step === 'santri' && (
        <div className="space-y-3 lg:hidden">
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
            <p className="text-sm font-bold text-slate-700">{isJurumiyah ? 'Pilih bab' : 'Pilih bab / surat'}</p>
            <p className="text-sm font-bold text-emerald-700">{selectedCount}/{totalUnits}{isJurumiyah ? ' kata' : ''}</p>
          </div>

          {oldBab.length > 0 && (
            <div className="flex w-full gap-1 rounded-xl bg-slate-100 p-1">
              <button onClick={() => setBabTab('current')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${babTab === 'current' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Hafalan kelas ini
              </button>
              <button onClick={() => setBabTab('old')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${babTab === 'old' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Hafalan lama
              </button>
            </div>
          )}

          {visibleBab.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">
              Belum ada hafalan pada tab ini.
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleBab.map((bab: any) => {
              const jblok = isJurumiyah ? bab.blok[0] : null
              const done = isJurumiyah
                ? ((localWords[jblok?.id] || []).length + (data.progressHighlightLocked?.[`${selectedSantriId}:${jblok?.id}`]?.length || 0))
                : bab.blok.filter((b: any) => localChecked.has(b.id)).length
              const all = isJurumiyah ? (jblok ? wordsOf(jblok).length : 0) : bab.blok.length
              const full = all > 0 && done >= all
              return (
                <button key={bab.id} onClick={() => setSelectedBabId(bab.id)}
                  className={`relative flex min-h-[6rem] flex-col rounded-2xl border p-3 text-left transition hover:border-emerald-300 ${bab.is_editable ? 'border-slate-200 bg-white' : 'border-sky-100 bg-sky-50'}`}>
                  <div className="flex items-start justify-between gap-1">
                    <p className={`min-w-0 flex-1 whitespace-normal break-words font-bold text-slate-900 ${isQuran ? 'text-center text-xl leading-[1.8] sm:text-2xl' : 'leading-snug'}`} dir={isQuran ? 'rtl' : 'ltr'} style={{ fontFamily: isQuran ? QURAN_FONT : ARABIC_FONT }}>{bab.judul}</p>
                    {!bab.is_editable && <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">Lama</span>}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${full ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${all ? (done / all) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{done}/{all}</span>
                  </div>
                </button>
              )
            })}
          </div>
          )}
        </div>
      )}

      {/* BLOK — panel baca + swipe blocking */}
      {step === 'blok' && selectedBab && (
        <div className="space-y-3">
          {isQuran && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-900">Input sampai ayat</p>
                <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                  Sudah hafal sampai <span className="font-black">{quranLastMemorizedAyat} ayat</span> dari {quranMaxAyat} ayat.
                </p>
              </div>
              <input
                type="number"
                min={quranLastMemorizedAyat + 1}
                max={quranMaxAyat}
                inputMode="numeric"
                value={quranTargetAyat}
                onChange={e => handleQuranTargetChange(e.target.value)}
                onBlur={submitQuranTarget}
                onKeyDown={e => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitQuranTarget()
                  }
                }}
                disabled={!quranHasEditableAyat || quranLastMemorizedAyat >= quranMaxAyat}
                placeholder="Nomor ayat"
                aria-label="Input target ayat hafalan"
                className="h-10 w-32 rounded-xl border border-emerald-200 bg-white px-3 text-center text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          )}

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
            {!isQuran && dirty && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Draft belum disimpan</span>}
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
            {isQuran
              ? 'Tap ayat untuk menandai hafal. Perubahan disimpan otomatis setelah 800 ms.'
              : dragMode
                ? 'Mode Blok aktif: geser jari untuk menandai beberapa bagian sekaligus (scroll dimatikan sementara).'
                : 'Tap bagian untuk menandai hafal. Aktifkan "Mode Blok" untuk swipe banyak sekaligus.'}
          </p>

          {dirty && !isQuran && (
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

          </section>
        </div>
      )}

      {step !== 'home' && (
        <button
          type="button"
          onClick={scrollMainToTop}
          aria-label="Scroll ke atas"
          title="Scroll ke atas"
          className="fixed bottom-24 right-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:border-emerald-300 hover:text-emerald-700 sm:bottom-20 sm:right-6"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Sticky save bar */}
      {selectedSantriId && step !== 'home' && step !== 'santri' && (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto flex max-w-3xl gap-2 px-3 sm:bottom-4">
          {isQuran ? (
            <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg">
              <span className={saveStatus === 'error' ? 'text-rose-600' : saveStatus === 'saving' ? 'text-amber-700' : 'text-emerald-700'}>
                {saveStatus === 'error' ? 'Gagal' : saveStatus === 'saving' ? 'Menyimpan' : 'Tersimpan'}
              </span>
              {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
              {saveStatus === 'error' && <button onClick={retryAutosave} disabled={saving} className="text-xs font-black text-rose-700 underline underline-offset-2 disabled:opacity-50">Coba lagi</button>}
            </div>
          ) : (
            <>
              <button onClick={resetAllDraft} disabled={!dirty || saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg disabled:opacity-50">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={saveProgress} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Hafalan ({selectedCount})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Crumb({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return <span className={`font-bold ${on ? 'text-slate-900' : 'text-slate-400'}`}>{children}</span>
}
function Sep() { return <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> }
