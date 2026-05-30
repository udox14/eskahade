'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getJurnalGuru,
  simpanAbsensiGuru,
  getMarhalahList,
  previewImportAbsensiGuru,
  importAbsensiGuruHistoris,
  type AbsensiGuruImportCell,
  type AbsensiGuruImportMappings,
} from './actions'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Save, Search, Smartphone, Table2, Upload, User, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']
type InputMode = 'table' | 'mobile'
type ImportPreviewSuccess = {
  success: true
  canImport: boolean
  summary: {
    sourceCells: number
    importRows: number
    kelasCount: number
    dateStart: string
    dateEnd: string
    statusCounts: Record<'H' | 'A' | 'B' | 'L', number>
    matchedGuruCells: number
    unmatchedGuruCells: number
  }
  samples: {
    kelasName: string
    tanggal: string
    shubuh: string
    ashar: string
    maghrib: string
    guruShubuh: string | null
    guruAshar: string | null
    guruMaghrib: string | null
  }[]
  issues: {
    unmatchedKelas: { message: string; kelasName?: string }[]
    unmatchedGuru: { message: string; guruName?: string }[]
    conflicts: { message: string }[]
    duplicateKelas: string[]
  }
  options: {
    kelas: { id: string; label: string }[]
    guru: { id: string; label: string }[]
  }
}
type ImportPreview = ImportPreviewSuccess | { error: string }

const STATUS_CYCLE = ['H', 'A', 'B'] as const
const SESSION_LABEL: Record<SessionType, string> = { shubuh: 'S', ashar: 'A', maghrib: 'M' }
const SESSION_NAME: Record<SessionType, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }

export default function AbsensiGuruPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Filter State
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false) 

  const [dataList, setDataList] = useState<any[]>([])
  const [gridData, setGridData] = useState<Record<string, any>>({})
  const [columnLiburMap, setColumnLiburMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [hasLiburChanges, setHasLiburChanges] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('table')
  const [mobileSearch, setMobileSearch] = useState('')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importCells, setImportCells] = useState<AbsensiGuruImportCell[]>([])
  const [importSheetPeriods, setImportSheetPeriods] = useState<{ sheetName: string; label: string; source: string }[]>([])
  const [importMappings, setImportMappings] = useState<AbsensiGuruImportMappings>({ kelas: {}, guru: {} })
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [readingImport, setReadingImport] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

  // Init Marhalah
  useEffect(() => {
    getMarhalahList().then(setMarhalahList)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('absensi-guru-input-mode')
    if (saved === 'table' || saved === 'mobile') setInputMode(saved)
  }, [])

  const changeInputMode = (mode: InputMode) => {
    setInputMode(mode)
    window.localStorage.setItem('absensi-guru-input-mode', mode)
  }

  // EFFECT UNTUK WARNING KETIKA BELUM SAVE
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    const handleClickAtag = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return
      
      const target = (e.target as Element).closest('a')
      if (target && target.href) {
        const isInternal = target.href.startsWith(window.location.origin)
        if (isInternal && !window.confirm("Ada perubahan yang belum disimpan. Yakin ingin keluar dari halaman ini?")) {
            e.preventDefault()
            e.stopPropagation()
        }
      }
    }

    if (hasUnsavedChanges) {
        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('click', handleClickAtag, { capture: true })
    }

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        document.removeEventListener('click', handleClickAtag, { capture: true })
    }
  }, [hasUnsavedChanges])

  // Load Data
  const loadData = async () => {
    if (hasUnsavedChanges && !window.confirm("Ada absensi yang belum disave! Yakin ingin menampilkan data baru?")) return
    
    setLoading(true)
    const days = getDaysArray(selectedDate)
    const res = await getJurnalGuru(days[0].dateStr, days[6].dateStr, selectedMarhalah)
    
    setDataList(res.list)
    const sanitizedGrid: Record<string, any> = {}
    Object.entries(res.absensi || {}).forEach(([key, value]: [string, any]) => {
      sanitizedGrid[key] = {
        shubuh: value?.shubuh === 'L' ? 'H' : (value?.shubuh || 'H'),
        ashar: value?.ashar === 'L' ? 'H' : (value?.ashar || 'H'),
        maghrib: value?.maghrib === 'L' ? 'H' : (value?.maghrib || 'H'),
      }
    })
    setGridData(sanitizedGrid)
    const nextLiburMap: Record<string, boolean> = {}
    ;(res.libur || []).forEach((item: { tanggal: string; sesi: SessionType }) => {
      nextLiburMap[`${item.tanggal}-${item.sesi}`] = true
    })
    setColumnLiburMap(nextLiburMap)
    setLoading(false)
    setHasLoaded(true)
    setHasUnsavedChanges(false)
    setDirtyKeys(new Set())
    setHasLiburChanges(false)
  }

  // --- LOGIC 1: ARRAY HARI ---
  const DAY_ABBREV: Record<string, string> = {
    'senin': 'SN',
    'selasa': 'SLS',
    'rabu': 'RB',
    'kamis': 'KMS',
    'jumat': 'JMT',
    'sabtu': 'SBT',
    'minggu': 'MGU',
  }

  const getDaysArray = (baseDate: string) => {
    const d = new Date(baseDate)
    const day = d.getDay()
    const diff = (day < 3 ? day + 7 : day) - 3
    d.setDate(d.getDate() - diff)
    
    const daysArr = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(d)
      current.setDate(d.getDate() + i)
      const dayNameStr = format(current, 'EEEE', { locale: id }).toLowerCase()
      daysArr.push({
        dateStr: current.toISOString().split('T')[0],
        label: format(current, 'EEEE', { locale: id }),
        abbrev: DAY_ABBREV[dayNameStr] ?? dayNameStr.substring(0, 3).toUpperCase(),
        shortDate: format(current, 'dd/MM'),
        dayName: dayNameStr
      })
    }
    return daysArr
  }
  
  // Memoize days agar tidak re-calc setiap render
  const days = useMemo(() => getDaysArray(selectedDate), [selectedDate])

  // --- LOGIC 2: LIBUR ---
  const isLibur = (dayName: string, session: SessionType) => {
    if (dayName === 'selasa' && session === 'maghrib') return true
    if (dayName === 'kamis' && session === 'maghrib') return true
    if (dayName === 'jumat' && (session === 'shubuh' || session === 'ashar')) return true
    return false
  }

  // --- LOGIC 3: ROW GENERATION ---
  const rowsToRender = useMemo(() => {
    const rows: any[] = []
    
    dataList.forEach(k => {
      const mapGuru = new Map<string, { id: string, name: string, sessions: Set<SessionType>, assignmentKeys: Set<string> }>()

      ;(k.week_schedule || []).forEach((entry: any) => {
        SESSIONS.forEach(session => {
          const guru = entry?.guru?.[session]
          if (!guru?.id || !guru?.nama) return

          const key = String(guru.id)
          if (!mapGuru.has(key)) {
            mapGuru.set(key, { id: key, name: guru.nama, sessions: new Set(), assignmentKeys: new Set() })
          }
          mapGuru.get(key)?.sessions.add(session)
          mapGuru.get(key)?.assignmentKeys.add(`${entry.tanggal}|${session}`)
        })
      })

      if (mapGuru.size === 0) {
        rows.push({
            uniqueId: `${k.id}-empty`,
            kelas: k,
            guru: { name: 'Belum Ada Guru', assignmentKeys: new Set<string>() },
            validSessions: [],
            isFirst: true,
            rowSpan: 1
        })
      } else {
        let isFirst = true
        const teachers = Array.from(mapGuru.values()).sort((a, b) => {
             const score = (t: any) => (t.sessions.has('shubuh') ? 1 : t.sessions.has('ashar') ? 2 : 3)
             return score(a) - score(b)
        })

        teachers.forEach(t => {
            rows.push({
                uniqueId: `${k.id}-${t.id}`,
                kelas: k,
                guru: { id: t.id, name: t.name, assignmentKeys: t.assignmentKeys },
                validSessions: Array.from(t.sessions),
                isFirst: isFirst,
                rowSpan: teachers.length
            })
            isFirst = false
        })
      }
    })
    return rows
  }, [dataList])

  const hasAssignedGuru = useCallback((kelas: any, session: SessionType, dateStr: string) => {
    const schedule = (kelas.week_schedule || []).find((item: any) => item.tanggal === dateStr)
    return Boolean(schedule?.guru?.[session]?.id)
  }, [])

  const getApplicableKelasIds = useCallback((dateStr: string, session: SessionType) => {
    const day = days.find(item => item.dateStr === dateStr)
    if (!day || isLibur(day.dayName, session)) return []
    return dataList
      .filter(kelas => hasAssignedGuru(kelas, session, dateStr))
      .map(kelas => String(kelas.id))
  }, [dataList, days, hasAssignedGuru])

  const isColumnLibur = useCallback((dateStr: string, session: SessionType) => {
    return Boolean(columnLiburMap[`${dateStr}-${session}`])
  }, [columnLiburMap])

  // --- HANDLERS (Gunakan useCallback) ---
  const handleCellChange = useCallback((kelasId: string, dateStr: string, session: SessionType, value: string) => {
    const upperVal = value.toUpperCase()
    if (!['H', 'A', 'B', ''].includes(upperVal)) return
    
    setHasUnsavedChanges(true)
    const key = `${kelasId}-${dateStr}`
    setDirtyKeys(prev => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setGridData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { shubuh:'', ashar:'', maghrib:'' }),
        [session]: upperVal || 'H'
      }
    }))
  }, []) // Empty dependency karena state updater (setGridData) stabil

  const toggleColumnLibur = useCallback((dateStr: string, session: SessionType) => {
    if (getApplicableKelasIds(dateStr, session).length === 0) return
    const key = `${dateStr}-${session}`
    const nextLibur = !columnLiburMap[key]
    setHasUnsavedChanges(true)
    setHasLiburChanges(true)
    setColumnLiburMap(prev => ({
      ...prev,
      [key]: nextLibur,
    }))
  }, [columnLiburMap, getApplicableKelasIds])

  const cycleCellValue = (kelasId: string, dateStr: string, session: SessionType) => {
    const current = gridData[`${kelasId}-${dateStr}`]?.[session] || 'H'
    const index = STATUS_CYCLE.indexOf(current as any)
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length]
    handleCellChange(kelasId, dateStr, session, next)
  }

  const filteredMobileKelas = useMemo(() => {
    const q = mobileSearch.trim().toLowerCase()
    if (!q) return dataList
    return dataList.filter(k =>
      String(k.nama_kelas || '').toLowerCase().includes(q) ||
      String(k.marhalah_nama || '').toLowerCase().includes(q) ||
      getGuruGroups(k).some(group => group.name.toLowerCase().includes(q))
    )
  }, [dataList, mobileSearch])

  const handleSimpan = async () => {
    if (dirtyKeys.size === 0 && !hasLiburChanges) {
      toast.info('Tidak ada perubahan untuk disimpan')
      return
    }

    setSaving(true)
    const loadToast = toast.loading("Menyimpan jurnal...")
    const payload: any[] = []
    
    dataList.forEach(k => {
      days.forEach(day => {
        const key = `${k.id}-${day.dateStr}`
        if (!dirtyKeys.has(key)) return
        const val = gridData[key]
        if (val) {
          payload.push({
            kelas_id: k.id,
            guru_id_wali: k.guru_maghrib_id || k.guru_ashar_id || k.guru_shubuh_id || null,
            tanggal: day.dateStr,
            shubuh: val.shubuh || 'H',
            ashar: val.ashar || 'H',
            maghrib: val.maghrib || 'H'
          })
        }
      })
    })

    try {
      const liburPayload = days.flatMap(day =>
        SESSIONS
          .filter(session => !isLibur(day.dayName, session))
          .map(session => ({
            tanggal: day.dateStr,
            sesi: session,
            is_libur: Boolean(columnLiburMap[`${day.dateStr}-${session}`]),
          }))
      )
      const res = await simpanAbsensiGuru(payload, liburPayload)
      if (res?.error) {
        toast.error("Gagal menyimpan", { description: res.error })
        return
      }
      setDirtyKeys(new Set())
      setHasUnsavedChanges(false)
      setHasLiburChanges(false)
      toast.success(`Jurnal tersimpan (${res.saved ?? payload.length} baris)`)
    } catch (err: any) {
      toast.error("Gagal menyimpan", { description: err?.message ?? 'Terjadi kesalahan saat menyimpan' })
    } finally {
      setSaving(false)
      toast.dismiss(loadToast)
    }
  }

  const handleUploadImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setReadingImport(true)
    const loadToast = toast.loading('Membaca Excel absensi guru...')
    try {
      const parsed = await parseAbsensiGuruWorkbook(file, selectedDate)
      if (!parsed.cells.length) {
        toast.error('Tidak ada data absensi guru yang terbaca.', {
          description: 'Pastikan sheet punya header NO, MARHALAH, NAMA, KETERANGAN WAKTU dan kolom SB/AS/MG.',
        })
        setImportFileName(file.name)
        setImportCells([])
        setImportSheetPeriods([])
        setImportMappings({ kelas: {}, guru: {} })
        setImportPreview(null)
        return
      }

      const nextMappings: AbsensiGuruImportMappings = { kelas: {}, guru: {} }
      const preview = await previewImportAbsensiGuru(parsed.cells, nextMappings)
      setImportFileName(file.name)
      setImportCells(parsed.cells)
      setImportSheetPeriods(parsed.sheetPeriods)
      setImportMappings(nextMappings)
      setImportPreview(preview)

      if ('error' in preview) {
        toast.error('Gagal membuat preview import', { description: preview.error })
      } else {
        toast.success(`${parsed.cells.length} sel absensi terbaca dari ${parsed.sheetNames.length} sheet`)
      }
    } catch (err: any) {
      toast.error('Gagal membaca file Excel', { description: err?.message ?? 'Format file tidak valid.' })
    } finally {
      toast.dismiss(loadToast)
      setReadingImport(false)
      e.target.value = ''
    }
  }

  const handleImportHistoris = async () => {
    if (!importCells.length) return toast.warning('Upload file Excel dulu.')
    if (!importPreview || 'error' in importPreview || !importPreview.canImport) {
      toast.warning('Preview import masih punya masalah yang perlu dibereskan dulu.')
      return
    }
    if (!window.confirm(`Import ${importPreview.summary.importRows} baris absensi guru historis dari ${importFileName}? Data kelas-tanggal yang sama akan diperbarui.`)) return

    setSavingImport(true)
    const loadToast = toast.loading('Mengimpor absensi guru historis...')
    try {
      const result = await importAbsensiGuruHistoris(importCells, importMappings)
      if ('error' in result) {
        toast.error('Import gagal', { description: result.error })
        return
      }
      toast.success(`Import selesai: ${result.saved} baris tersimpan`)
      if (result.unmatchedGuruCells > 0) {
        toast.warning(`${result.unmatchedGuruCells} sel guru belum cocok; rekap dapat memakai jadwal guru sebagai fallback.`)
      }
      setImportCells([])
      setImportPreview(null)
      setImportFileName('')
      setImportSheetPeriods([])
      setImportMappings({ kelas: {}, guru: {} })
      setShowImportPanel(false)
      if (hasLoaded) await loadData()
    } catch (err: any) {
      toast.error('Import gagal', { description: err?.message ?? 'Terjadi kesalahan saat menyimpan.' })
    } finally {
      toast.dismiss(loadToast)
      setSavingImport(false)
    }
  }

  const handleRefreshImportPreview = async () => {
    if (!importCells.length) return toast.warning('Upload file Excel dulu.')
    setReadingImport(true)
    const loadToast = toast.loading('Menerapkan mapping import...')
    try {
      const preview = await previewImportAbsensiGuru(importCells, importMappings)
      setImportPreview(preview)
      if ('error' in preview) toast.error('Gagal membuat preview import', { description: preview.error })
      else toast.success('Preview diperbarui')
    } catch (err: any) {
      toast.error('Gagal memperbarui preview', { description: err?.message ?? 'Terjadi kesalahan.' })
    } finally {
      toast.dismiss(loadToast)
      setReadingImport(false)
    }
  }

  // --- KEYBOARD NAVIGATION (MEMOIZED) ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number, totalRows: number) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()

      const maxRow = totalRows
      const totalCols = SESSIONS.reduce((acc, sess) => acc + days.filter(d => !isLibur(d.dayName, sess)).length, 0)
      const maxCol = totalCols
      
      let currR = rowIdx
      let currC = colIdx
      
      const moveR = e.key === 'ArrowDown' ? 1 : (e.key === 'ArrowUp' ? -1 : 0)
      const moveC = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0)
      
      let safetyCounter = 0
      while (safetyCounter < 50) {
        safetyCounter++
        
        currR += moveR
        currC += moveC
        
        // Batas Baris
        if (currR < 0 || currR >= maxRow) break
        
        // Batas Kolom (Stop di ujung, jangan pindah baris)
        if (currC < 0 || currC >= maxCol) break
        
        const nextId = `cell-${currR}-${currC}`
        const el = document.getElementById(nextId) as HTMLInputElement
        
        if (el && !el.disabled) {
          el.focus()
          el.select()
          break
        }
      }
    }
  }, [days]) 

  const canRunImport = Boolean(importPreview && isImportPreviewSuccess(importPreview) && importPreview.canImport)

  return (
    <div className="space-y-6 max-w-[95vw] mx-auto pb-20">
      
      {/* HEADER */}
      <div className="space-y-4 border-b pb-4">
        <DashboardPageHeader
          title="Absensi Guru"
          description="Input kehadiran mengajar mingguan."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[auto_minmax(0,1fr)_220px_auto_auto_auto] xl:items-center">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full sm:w-fit">
            <button
              onClick={() => changeInputMode('table')}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all sm:flex-none ${
                inputMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Table2 className="w-4 h-4" />
              Tabel
            </button>
            <button
              onClick={() => changeInputMode('mobile')}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all sm:flex-none ${
                inputMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              HP
            </button>
          </div>

          <div className="bg-white p-1.5 border border-slate-200 rounded-xl flex items-center gap-2 shadow-sm min-w-0">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={selectedMarhalah}
              onChange={e => setSelectedMarhalah(e.target.value)}
              className="w-full min-w-0 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2"
            >
              <option value="">Semua Tingkat</option>
              {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>

          <div className="bg-white p-1 border border-slate-200 rounded-xl shadow-sm">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-2 text-sm font-bold text-slate-700 outline-none"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="bg-white text-indigo-700 border border-indigo-200 px-4 py-3 rounded-xl font-bold shadow-sm hover:bg-indigo-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Tampilkan
          </button>

          <button
            type="button"
            onClick={() => setShowImportPanel(prev => !prev)}
            className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl font-bold shadow-sm hover:bg-emerald-100 flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Excel
          </button>

          {hasLoaded && (
            <button
              onClick={handleSimpan}
              disabled={saving}
              className="bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-indigo-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-wrap gap-4">
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-100 text-green-700 font-bold border rounded flex items-center justify-center">H</span> Hadir</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-yellow-100 text-yellow-700 font-bold border rounded flex items-center justify-center">B</span> Badal</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-red-100 text-red-700 font-bold border rounded flex items-center justify-center">A</span> Kosong</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-slate-100 text-slate-500 font-bold border rounded flex items-center justify-center">L</span> Libur pengajian</span>
        <span className="ml-auto italic">* Mode HP: tap H → A → B → L</span>
      </div>

      <div className="text-[11px] text-slate-500 -mt-2">
        Keterangan tambahan: `L` berarti libur pengajian pada sesi itu, jadi tidak dihitung sebagai kewajiban mengajar.
      </div>

      {showImportPanel && (
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">Import Absensi Guru Historis</p>
              <p className="text-xs text-slate-500">
                Tahun mengikuti filter tanggal. Bulan dibaca dari nama/header sheet; fallback: <b>{format(new Date(selectedDate), 'MMMM yyyy', { locale: id })}</b>.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                {readingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadImport}
                  disabled={readingImport || savingImport}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
              </label>
              <button
                type="button"
                onClick={handleImportHistoris}
                disabled={savingImport || !canRunImport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Jalankan Import
              </button>
            </div>
          </div>

          {importFileName && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              File: <b>{importFileName}</b>
            </div>
          )}

          {importSheetPeriods.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {importSheetPeriods.map(item => (
                <div key={`${item.sheetName}-${item.label}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <p className="font-black text-slate-800">{item.sheetName}</p>
                  <p className="text-slate-500">{item.label} <span className="text-slate-400">({item.source})</span></p>
                </div>
              ))}
            </div>
          )}

          {importPreview && !isImportPreviewSuccess(importPreview) && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importPreview.error}</span>
            </div>
          )}

          {importPreview && isImportPreviewSuccess(importPreview) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                <ImportStat label="Sel terbaca" value={importPreview.summary.sourceCells} />
                <ImportStat label="Baris DB" value={importPreview.summary.importRows} />
                <ImportStat label="Kelas" value={importPreview.summary.kelasCount} />
                <ImportStat label="Hadir" value={importPreview.summary.statusCounts.H} />
                <ImportStat label="Kosong" value={importPreview.summary.statusCounts.A} />
                <ImportStat label="Badal" value={importPreview.summary.statusCounts.B} />
                <ImportStat label="Libur" value={importPreview.summary.statusCounts.L} />
              </div>

              <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                importPreview.canImport ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                {importPreview.canImport ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div>
                  <p className="font-bold">
                    {importPreview.canImport ? 'Preview siap diimpor.' : 'Preview belum bisa diimpor.'}
                  </p>
                  <p className="text-xs opacity-80">
                    Rentang tanggal: {importPreview.summary.dateStart || '-'} sampai {importPreview.summary.dateEnd || '-'}.
                    {importPreview.summary.unmatchedGuruCells > 0 ? ` ${importPreview.summary.unmatchedGuruCells} sel guru belum cocok dengan Data Guru.` : ''}
                  </p>
                </div>
              </div>

              {(importPreview.issues.unmatchedKelas.length > 0 || importPreview.issues.unmatchedGuru.length > 0) && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-amber-900">Cocokkan Data Import</p>
                      <p className="text-xs text-amber-700">Pilih padanan dari master data, lalu terapkan mapping tanpa mengubah Excel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshImportPreview}
                      disabled={readingImport}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {readingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Terapkan Mapping
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <ImportMappingList
                      title="Kelas belum cocok"
                      emptyText="Semua kelas sudah cocok."
                      items={importPreview.issues.unmatchedKelas.map(item => ({
                        key: item.kelasName || '',
                        label: item.kelasName || item.message,
                      })).filter(item => item.key)}
                      options={importPreview.options.kelas}
                      valueMap={importMappings.kelas || {}}
                      onChange={(key, value) => setImportMappings(prev => ({
                        ...prev,
                        kelas: { ...(prev.kelas || {}), [key]: value },
                      }))}
                    />
                    <ImportMappingList
                      title="Guru belum cocok"
                      emptyText="Semua guru sudah cocok."
                      items={importPreview.issues.unmatchedGuru.map(item => ({
                        key: item.guruName || '',
                        label: item.guruName || item.message,
                      })).filter(item => item.key)}
                      options={importPreview.options.guru}
                      valueMap={importMappings.guru || {}}
                      onChange={(key, value) => setImportMappings(prev => ({
                        ...prev,
                        guru: { ...(prev.guru || {}), [key]: value },
                      }))}
                    />
                  </div>
                </div>
              )}

              {importPreview.issues.conflicts.length > 0 && (
                <div className="grid gap-3">
                  <ImportIssueList title="Konflik data" items={importPreview.issues.conflicts.map(item => item.message)} tone="red" />
                </div>
              )}

              {importPreview.samples.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2">SB</th>
                        <th className="px-3 py-2">AS</th>
                        <th className="px-3 py-2">MG</th>
                        <th className="px-3 py-2">Guru Snapshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreview.samples.map((row, idx) => (
                        <tr key={`${row.kelasName}-${row.tanggal}-${idx}`}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{row.tanggal}</td>
                          <td className="px-3 py-2 text-slate-700">{row.kelasName}</td>
                          <td className="px-3 py-2 font-black">{row.shubuh}</td>
                          <td className="px-3 py-2 font-black">{row.ashar}</td>
                          <td className="px-3 py-2 font-black">{row.maghrib}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {[row.guruShubuh, row.guruAshar, row.guruMaghrib].filter(Boolean).join(' / ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasLoaded && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Kontrol Libur Sesi</p>
            <p className="text-[11px] text-slate-500">Atur libur sekali per sesi-hari, lalu semua kelas otomatis ikut.</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              {SESSIONS.map(session => {
                const sessionDays = days.filter(day => !isLibur(day.dayName, session))
                return (
                  <div key={session} className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-2 items-center">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-600">{SESSION_NAME[session]}</div>
                    {sessionDays.map(day => {
                      const active = isColumnLibur(day.dateStr, session)
                      return (
                        <button
                          key={`${session}-${day.dateStr}`}
                          type="button"
                          onClick={() => toggleColumnLibur(day.dateStr, session)}
                          className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                            active
                              ? 'border-slate-300 bg-slate-100 text-slate-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase">{day.abbrev}</div>
                          <div className="text-[10px]">{day.shortDate}</div>
                          <div className="mt-1 text-[11px] font-bold">{active ? 'L' : 'Aktif'}</div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {hasLoaded && inputMode === 'mobile' && dataList.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              placeholder="Cari kelas atau nama guru..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">{filteredMobileKelas.length}</span>
            <span>dari {dataList.length} kelas</span>
          </div>
        </div>
      )}

      {hasLoaded && inputMode === 'mobile' && !loading ? (
        <MobileAbsensiGuruCards
          kelasList={filteredMobileKelas}
          days={days}
          gridData={gridData}
          isLibur={isLibur}
          isColumnLibur={isColumnLibur}
          onCycleCell={cycleCellValue}
        />
      ) : (
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[26rem] md:h-[75vh]">
        {!hasLoaded ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center text-slate-400">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
                  <Search className="w-12 h-12 text-slate-200" />
                </div>
                <div className="max-w-[18rem] space-y-1">
                  <p className="text-base font-medium leading-relaxed text-slate-500">
                    Silakan pilih tingkat dan tanggal, lalu klik <b>Tampilkan</b>.
                  </p>
                </div>
            </div>
        ) : loading ? (
             <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500"/></div>
        ) : (
             <div className="overflow-y-auto overflow-x-hidden hover:overflow-x-auto flex-1">
             <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-40 shadow-sm outline outline-1 outline-slate-200">
                   <tr>
                      <th rowSpan={2} className="p-3 text-left border bg-slate-100 sticky left-0 z-50 w-28">Kelas</th>
                      <th rowSpan={2} className="p-3 text-left border bg-slate-100 sticky left-28 z-50 w-40">Guru Pengajar</th>
                      {SESSIONS.map(sess => {
                           const sessDays = days.filter(d => !isLibur(d.dayName, sess))
                           return (
                               <th key={sess} colSpan={sessDays.length} className="border text-center py-2 px-1 font-extrabold text-slate-800 uppercase bg-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] tracking-widest text-sm">
                                   {sess}
                               </th>
                           )
                      })}
                   </tr>
                   <tr>
                      {SESSIONS.map(sess => {
                           const sessDays = days.filter(d => !isLibur(d.dayName, sess))
                           return sessDays.map(day => (
                               <th key={sess + day.dateStr} className="border text-center text-[10px] text-slate-700 bg-slate-50 w-10 min-w-[2.5rem] p-1 shadow-sm">
                                   <div className="font-bold uppercase tracking-wider">{day.abbrev}</div>
                               </th>
                           ))
                      })}
                   </tr>
                </thead>
                <tbody>
                   {rowsToRender.map((row, rowIdx) => {
                      let colCounter = 0
                      return (
                        <tr key={row.uniqueId} className="hover:bg-indigo-50/30 transition-colors">
                            {/* KOLOM KELAS */}
                            {row.isFirst && (
                                <td 
                                    className="p-3 border sticky left-0 bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] align-top font-bold text-slate-800 w-28"
                                    rowSpan={row.rowSpan}
                                >
                                    <div className="whitespace-nowrap">{row.kelas.nama_kelas}</div>
                                    <div className="text-[10px] font-normal text-slate-400 mt-1 whitespace-nowrap">{row.kelas.marhalah_nama}</div>
                                </td>
                            )}

                            {/* KOLOM GURU */}
                            <td className="p-2 border bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] sticky left-28 text-xs font-medium text-slate-700 w-40 min-w-[10rem]">
                                <div className="flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-indigo-400 shrink-0"/>
                                    <span className="whitespace-nowrap overflow-hidden text-ellipsis">{row.guru.name}</span>
                                </div>
                            </td>

                            {/* KOLOM INPUT GRID (OPTIMIZED) */}
                            {SESSIONS.map(sess => {
                                const sessDays = days.filter(d => !isLibur(d.dayName, sess))
                                return sessDays.map(day => {
                                    const key = `${row.kelas.id}-${day.dateStr}`
                                    const val = gridData[key] || { shubuh:'', ashar:'', maghrib:'' }
                                    
                                    const isMyJob = row.guru.assignmentKeys.has(`${day.dateStr}|${sess}`)
                                    const columnLibur = isColumnLibur(day.dateStr, sess)
                                    const disabled = !isMyJob
                                    const readOnly = columnLibur && isMyJob
                                    
                                    const cellId = `cell-${rowIdx}-${colCounter}`
                                    colCounter++

                                    return (
                                        <CellInput 
                                            key={sess + day.dateStr}
                                            id={cellId}
                                            value={columnLibur && isMyJob ? 'L' : val[sess]} 
                                            onChange={(v: string) => handleCellChange(row.kelas.id, day.dateStr, sess, v)} 
                                            disabled={disabled}
                                            readOnly={readOnly}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, rowIdx, colCounter - 1, rowsToRender.length)}
                                        />
                                    )
                                })
                            })}
                        </tr>
                      )
                   })}
                 </tbody>
              </table>
             </div>
           )}
      </div>
      )}

      {hasLoaded && inputMode === 'mobile' && dataList.length > 0 && hasUnsavedChanges && (
        <div className="fixed left-0 right-0 bottom-0 z-50 bg-white/95 border-t border-slate-200 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
          <button
            onClick={handleSimpan}
            disabled={saving}
            className="w-full bg-indigo-700 text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Simpan {dirtyKeys.size} perubahan
          </button>
        </div>
      )}
    </div>
  )
}

function getGuruGroups(kelas: any) {
  const map = new Map<string, { id: string; name: string; sessions: Set<SessionType>; assignmentKeys: Set<string> }>()

  ;(kelas.week_schedule || []).forEach((entry: any) => {
    SESSIONS.forEach(session => {
      const guru = entry?.guru?.[session]
      if (!guru?.id || !guru?.nama) return

      const key = String(guru.id)
      if (!map.has(key)) map.set(key, { id: key, name: String(guru.nama), sessions: new Set(), assignmentKeys: new Set() })
      map.get(key)!.sessions.add(session)
      map.get(key)!.assignmentKeys.add(`${entry.tanggal}|${session}`)
    })
  })

  return Array.from(map.values()).map(item => ({
    id: item.id,
    name: item.name,
    sessions: Array.from(item.sessions),
    assignmentKeys: item.assignmentKeys,
  })).sort((a, b) => {
    const score = (item: { sessions: SessionType[] }) =>
      item.sessions.includes('shubuh') ? 1 : item.sessions.includes('ashar') ? 2 : 3
    return score(a) - score(b)
  })
}

function MobileAbsensiGuruCards({
  kelasList,
  days,
  gridData,
  isLibur,
  isColumnLibur,
  onCycleCell,
}: {
  kelasList: any[]
  days: { dateStr: string; label: string; abbrev: string; shortDate: string; dayName: string }[]
  gridData: Record<string, any>
  isLibur: (dayName: string, session: SessionType) => boolean
  isColumnLibur: (dateStr: string, session: SessionType) => boolean
  onCycleCell: (kelasId: string, dateStr: string, session: SessionType) => void
}) {
  if (kelasList.length === 0) {
    return (
      <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
        <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Kelas atau guru tidak ditemukan</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-24">
      {kelasList.map(kelas => {
        const groups = getGuruGroups(kelas)
        return (
          <div key={kelas.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50/70">
              <p className="font-black text-slate-900 text-base leading-tight">{kelas.nama_kelas}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{kelas.marhalah_nama || 'Tanpa tingkat'}</p>
            </div>

            {groups.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">Belum ada guru pengajar di kelas ini.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {groups.map(group => (
                  <div key={group.id} className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{group.name}</p>
                        <p className="text-[10px] text-slate-400">{group.sessions.map(s => SESSION_NAME[s]).join(', ')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
                      <div />
                      {days.map(day => (
                        <div key={day.dateStr} className="text-center">
                          <div className="text-[9px] font-black text-slate-500 uppercase leading-tight">{day.abbrev}</div>
                          <div className="text-[9px] text-slate-400 leading-tight">{day.shortDate}</div>
                        </div>
                      ))}
                    </div>

                    {group.sessions.map(session => (
                      <div key={session} className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
                        <div className="h-8 flex items-center justify-center text-[10px] font-black text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                          {SESSION_LABEL[session]}
                        </div>
                        {days.map(day => {
                          const off = isLibur(day.dayName, session)
                          const assigned = group.assignmentKeys.has(`${day.dateStr}|${session}`)
                          const columnLibur = isColumnLibur(day.dateStr, session)
                          const value = columnLibur && assigned ? 'L' : (gridData[`${kelas.id}-${day.dateStr}`]?.[session] || 'H')
                          return (
                            <button
                              key={`${kelas.id}-${day.dateStr}-${session}`}
                              disabled={off || columnLibur || !assigned}
                              onClick={() => onCycleCell(kelas.id, day.dateStr, session)}
                              className={`h-8 rounded-lg text-xs font-black border transition-colors active:scale-95 ${
                                off || !assigned ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : guruStatusButtonClass(value)
                              }`}
                            >
                              {off || !assigned ? '-' : value}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function guruStatusButtonClass(value: string) {
  if (value === 'A') return 'bg-red-100 text-red-800 border-red-200'
  if (value === 'B') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (value === 'L') return 'bg-slate-100 text-slate-500 border-slate-200'
  return 'bg-green-50 text-green-700 border-green-200'
}

function isImportPreviewSuccess(preview: ImportPreview): preview is ImportPreviewSuccess {
  return 'success' in preview && preview.success === true
}

function ImportStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  )
}

function ImportIssueList({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' }) {
  const color = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-amber-200 bg-amber-50 text-amber-800'
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-black">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs opacity-70">Tidak ada.</p>
      ) : (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
          {items.slice(0, 20).map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}
          {items.length > 20 && <li>...dan {items.length - 20} lagi</li>}
        </ul>
      )}
    </div>
  )
}

function ImportMappingList({
  title,
  emptyText,
  items,
  options,
  valueMap,
  onChange,
}: {
  title: string
  emptyText: string
  items: { key: string; label: string }[]
  options: { id: string; label: string }[]
  valueMap: Record<string, string | number>
  onChange: (key: string, value: string) => void
}) {
  const uniqueItems = Array.from(new Map(items.map(item => [item.key, item])).values())

  return (
    <div className="rounded-xl border border-amber-200 bg-white p-3">
      <p className="text-xs font-black text-slate-800">{title}</p>
      {uniqueItems.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
          {uniqueItems.map(item => (
            <div key={item.key} className="grid gap-1">
              <label className="text-[11px] font-bold text-slate-600">{item.label}</label>
              <select
                value={String(valueMap[item.key] || '')}
                onChange={event => onChange(item.key, event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Pilih padanan...</option>
                {options.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function parseAbsensiGuruWorkbook(file: File, selectedDate: string) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const period = parseDateKey(selectedDate)
  const cells: AbsensiGuruImportCell[] = []
  const sheetNames: string[] = []
  const sheetPeriods: { sheetName: string; label: string; source: string }[] = []
  let previousPeriod: { year: number; month: number } | null = null

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet?.['!ref']) return
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const headerRow = findImportHeaderRow(sheet, range, XLSX)
    if (headerRow === -1) return

    const identity = findIdentityColumns(sheet, range, headerRow, XLSX)
    if (identity.kelasCol == null || identity.guruCol == null) return

    const sheetPeriod = detectSheetPeriod(sheet, range, sheetName, period, previousPeriod, XLSX)
    const sourceColumns = findSourceColumns(sheet, range, headerRow, sheetPeriod.year, sheetPeriod.month, XLSX)
    if (sourceColumns.length === 0) return

    previousPeriod = { year: sheetPeriod.year, month: sheetPeriod.month }
    sheetNames.push(sheetName)
    sheetPeriods.push({
      sheetName,
      label: formatMonthYear(sheetPeriod.year, sheetPeriod.month),
      source: sheetPeriod.source,
    })
    for (let row = headerRow + 2; row <= range.e.r; row++) {
      const kelasName = cleanCellText(readCell(sheet, row, identity.kelasCol, XLSX))
      const guruName = cleanCellText(readCell(sheet, row, identity.guruCol, XLSX))
      const waktu = identity.waktuCol != null ? cleanCellText(readCell(sheet, row, identity.waktuCol, XLSX)) : ''
      const allowedSessions = sessionsFromWaktu(waktu)
      if (!kelasName || !guruName) continue

      sourceColumns.forEach(column => {
        if (!allowedSessions.has(column.session)) return
        const status = normalizeExcelStatus(readCell(sheet, row, column.col, XLSX))
        if (!status) return
        cells.push({
          sheet: sheetName,
          row: row + 1,
          kelasName,
          guruName,
          waktu,
          tanggal: column.date,
          sesi: column.session,
          status,
        })
      })
    }
  })

  return { cells, sheetNames, sheetPeriods }
}

function findImportHeaderRow(sheet: any, range: any, XLSX: any) {
  const maxRow = Math.min(range.e.r, range.s.r + 30)
  for (let row = range.s.r; row <= maxRow; row++) {
    const values: string[] = []
    for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 14); col++) {
      values.push(normalizeHeader(readCell(sheet, row, col, XLSX)))
    }
    if (
      values.includes('no') &&
      values.includes('marhalah') &&
      values.includes('nama') &&
      values.some(value => value.includes('keterangan waktu'))
    ) {
      return row
    }
  }
  return -1
}

function findIdentityColumns(sheet: any, range: any, headerRow: number, XLSX: any) {
  const result: { kelasCol: number | null; guruCol: number | null; waktuCol: number | null } = {
    kelasCol: null,
    guruCol: null,
    waktuCol: null,
  }
  for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 14); col++) {
    const header = normalizeHeader(readCell(sheet, headerRow, col, XLSX))
    if (header === 'marhalah') result.kelasCol = col
    if (header === 'nama') result.guruCol = col
    if (header.includes('keterangan waktu')) result.waktuCol = col
  }
  return result
}

function findSourceColumns(sheet: any, range: any, headerRow: number, year: number, month: number, XLSX: any) {
  const result: { col: number; date: string; session: SessionType }[] = []
  let activeDay = ''
  let currentDate: Date | null = null
  let lastDay = ''

  for (let col = range.s.c; col <= range.e.c; col++) {
    const dayHeader = normalizeDayLabel(readCell(sheet, headerRow, col, XLSX))
    const session = sessionFromCode(readCell(sheet, headerRow + 1, col, XLSX))
    if (dayHeader && dayHeader !== 'jumlah') activeDay = dayHeader
    if (!session || !activeDay) continue

    if (activeDay !== lastDay) {
      currentDate = findNextDateForDay(year, month, activeDay, currentDate)
      lastDay = activeDay
    }
    if (!currentDate || currentDate.getMonth() !== month) continue
    result.push({ col, date: formatDateKey(currentDate), session })
  }

  return result
}

function readCell(sheet: any, row: number, col: number, XLSX: any) {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
  return cell?.v ?? ''
}

function cleanCellText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeHeader(value: unknown) {
  return cleanCellText(value).toLowerCase()
}

function normalizeDayLabel(value: unknown) {
  const text = normalizeHeader(value)
    .replace(/'/g, '')
    .replace(/\./g, '')
  if (text.includes('jml') || text.includes('jumlah')) return 'jumlah'
  if (text === 'minggu') return 'ahad'
  if (text === 'jumat') return 'jumat'
  if (['senin', 'selasa', 'rabu', 'kamis', 'sabtu', 'ahad'].includes(text)) return text
  return ''
}

function sessionFromCode(value: unknown): SessionType | null {
  const text = cleanCellText(value).toUpperCase()
  if (text === 'SB') return 'shubuh'
  if (text === 'AS') return 'ashar'
  if (text === 'MG') return 'maghrib'
  return null
}

function normalizeExcelStatus(value: unknown): 'H' | 'A' | 'B' | 'L' | null {
  if (value === null || value === undefined || value === '') return null
  const text = cleanCellText(value).toUpperCase()
  if (text === '1' || text === 'H') return 'H'
  if (text === '0' || text === 'A') return 'A'
  if (text === 'B') return 'B'
  if (text === 'L') return 'L'
  return null
}

function sessionsFromWaktu(value: unknown) {
  const text = normalizeHeader(value)
    .replace(/subuh/g, 'shubuh')
    .replace(/maghrib/g, 'malam')
  const sessions = new Set<SessionType>()

  if (!text || text.includes('semua')) {
    SESSIONS.forEach(session => sessions.add(session))
    return sessions
  }
  if (text.includes('shubuh')) sessions.add('shubuh')
  if (text.includes('ashar')) sessions.add('ashar')
  if (text.includes('malam')) sessions.add('maghrib')

  if (sessions.size === 0) SESSIONS.forEach(session => sessions.add(session))
  return sessions
}

function detectSheetPeriod(
  sheet: any,
  range: any,
  sheetName: string,
  fallback: { year: number; month: number },
  previous: { year: number; month: number } | null,
  XLSX: any
) {
  const topText: string[] = [sheetName]
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 5); row++) {
    for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 12); col++) {
      const value = cleanCellText(readCell(sheet, row, col, XLSX))
      if (value) topText.push(value)
    }
  }

  const detectedMonth = detectMonthIndex(topText.join(' '))
  if (detectedMonth == null) {
    return { ...fallback, source: 'fallback filter' }
  }

  let year = fallback.year
  if (previous) {
    year = previous.year
    if (previous.month >= 9 && detectedMonth <= 2) year += 1
    if (previous.month <= 2 && detectedMonth >= 9) year -= 1
  }

  return { year, month: detectedMonth, source: 'otomatis dari sheet' }
}

function detectMonthIndex(value: string) {
  const text = normalizeHeader(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
  const monthAliases: [number, string[]][] = [
    [0, ['januari', 'jan']],
    [1, ['februari', 'pebruari', 'feb']],
    [2, ['maret', 'mar']],
    [3, ['april', 'apr']],
    [4, ['mei', 'may']],
    [5, ['juni', 'jun']],
    [6, ['juli', 'jul']],
    [7, ['agustus', 'agu', 'ags', 'aug']],
    [8, ['september', 'sept', 'sep']],
    [9, ['oktober', 'october', 'okt', 'oct']],
    [10, ['november', 'nov']],
    [11, ['desember', 'december', 'des', 'dec']],
  ]
  for (const [month, aliases] of monthAliases) {
    if (aliases.some(alias => new RegExp(`(^|\\s)${alias}(\\s|$)`).test(text))) return month
  }
  return null
}

function parseDateKey(value: string) {
  const [year, month] = value.split('-').map(Number)
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month - 1 : new Date().getMonth(),
  }
}

function formatMonthYear(year: number, month: number) {
  return format(new Date(year, month, 1), 'MMMM yyyy', { locale: id })
}

function findNextDateForDay(year: number, month: number, dayLabel: string, previous: Date | null) {
  const startDay = previous ? previous.getDate() + 1 : 1
  for (let day = startDay; day <= 31; day++) {
    const candidate = new Date(year, month, day)
    if (candidate.getMonth() !== month) return null
    if (indonesianDayLabel(candidate) === dayLabel) return candidate
  }
  return null
}

function indonesianDayLabel(date: Date) {
  const labels = ['ahad', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
  return labels[date.getDay()]
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// --- OPTIMASI KOMPONEN (React.memo) ---
// Ini yang membuat input smooth. Dia tidak akan re-render kecuali value/disabled berubah.
// Kita gunakan custom comparator untuk mengabaikan perubahan fungsi callback
const CellInput = React.memo(({ id, value, onChange, disabled, readOnly, onKeyDown }: { 
    id: string, 
    value: string, 
    onChange: (v: string) => void, 
    disabled?: boolean, 
    readOnly?: boolean,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void 
}) => {
    let color = 'bg-white text-slate-800'
    if (value === 'H') color = 'bg-green-100 text-green-700 font-bold'
    if (value === 'A') color = 'bg-red-100 text-red-700 font-bold'
    if (value === 'B') color = 'bg-yellow-100 text-yellow-700 font-bold'
    if (value === 'L') color = 'bg-slate-100 text-slate-500 font-bold'

    if (disabled) color = 'bg-slate-200/50 text-slate-300 cursor-not-allowed'
    if (readOnly) color = 'bg-slate-100 text-slate-500 font-bold cursor-not-allowed'

    return (
        <td className={`border p-0 h-full align-middle ${disabled ? 'bg-slate-100' : ''}`}>
            <input 
                id={id}
                type="text" 
                maxLength={1}
                disabled={disabled}
                readOnly={readOnly}
                className={`w-full h-10 text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 uppercase cursor-pointer transition-colors text-xs ${color}`}
                value={disabled ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={(e) => e.target.select()}
                autoComplete="off"
            />
        </td>
    )
}, (prev, next) => {
    // Re-render hanya jika value, disabled, readOnly, atau ID berubah. 
    // Abaikan perubahan referensi fungsi onChange/onKeyDown
    return (
        prev.value === next.value &&
        prev.disabled === next.disabled &&
        prev.readOnly === next.readOnly &&
        prev.id === next.id
    )
})
