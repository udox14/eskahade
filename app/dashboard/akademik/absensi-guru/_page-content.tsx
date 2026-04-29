'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getJurnalGuru, simpanAbsensiGuru, getMarhalahList } from './actions'
import { Save, Loader2, Briefcase, User, Filter, Search, Smartphone, Table2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']
type InputMode = 'table' | 'mobile'

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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [inputMode, setInputMode] = useState<InputMode>('table')
  const [mobileSearch, setMobileSearch] = useState('')

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
    setGridData(res.absensi)
    setLoading(false)
    setHasLoaded(true)
    setHasUnsavedChanges(false)
    setDirtyKeys(new Set())
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
      const mapGuru = new Map<string, { id: string, name: string, sessions: SessionType[] }>()
      
      const addSesi = (g: any, s: SessionType) => {
        if (!g || !g.id) return 
        if (!mapGuru.has(g.id)) {
            mapGuru.set(g.id, { id: g.id, name: g.nama_lengkap, sessions: [] })
        }
        mapGuru.get(g.id)?.sessions.push(s)
      }

      addSesi({ id: k.guru_shubuh_id, nama_lengkap: k.guru_shubuh_nama }, 'shubuh')
      addSesi({ id: k.guru_ashar_id, nama_lengkap: k.guru_ashar_nama }, 'ashar')
      addSesi({ id: k.guru_maghrib_id, nama_lengkap: k.guru_maghrib_nama }, 'maghrib')

      if (mapGuru.size === 0) {
        rows.push({
            uniqueId: `${k.id}-empty`,
            kelas: k,
            guru: { name: 'Belum Ada Guru' },
            validSessions: [],
            isFirst: true,
            rowSpan: 1
        })
      } else {
        let isFirst = true
        const teachers = Array.from(mapGuru.values()).sort((a, b) => {
             const score = (t: any) => (t.sessions.includes('shubuh') ? 1 : t.sessions.includes('ashar') ? 2 : 3)
             return score(a) - score(b)
        })

        teachers.forEach(t => {
            rows.push({
                uniqueId: `${k.id}-${t.id}`,
                kelas: k,
                guru: t,
                validSessions: t.sessions,
                isFirst: isFirst,
                rowSpan: teachers.length
            })
            isFirst = false
        })
      }
    })
    return rows
  }, [dataList])

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
      String(k.guru_shubuh_nama || '').toLowerCase().includes(q) ||
      String(k.guru_ashar_nama || '').toLowerCase().includes(q) ||
      String(k.guru_maghrib_nama || '').toLowerCase().includes(q)
    )
  }, [dataList, mobileSearch])

  const handleSimpan = async () => {
    if (dirtyKeys.size === 0) {
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
      const res = await simpanAbsensiGuru(payload)
      if (res?.error) {
        toast.error("Gagal menyimpan", { description: res.error })
        return
      }
      setDirtyKeys(new Set())
      setHasUnsavedChanges(false)
      toast.success(`Jurnal tersimpan (${res.saved ?? payload.length} baris)`)
    } catch (err: any) {
      toast.error("Gagal menyimpan", { description: err?.message ?? 'Terjadi kesalahan saat menyimpan' })
    } finally {
      setSaving(false)
      toast.dismiss(loadToast)
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

  return (
    <div className="space-y-6 max-w-[95vw] mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Briefcase className="w-6 h-6 text-indigo-600"/> Absensi Guru
           </h1>
           <p className="text-slate-500 text-sm">Input kehadiran mengajar mingguan.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                    onClick={() => changeInputMode('table')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        inputMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Table2 className="w-4 h-4" />
                    Tabel
                </button>
                <button
                    onClick={() => changeInputMode('mobile')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        inputMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Smartphone className="w-4 h-4" />
                    HP
                </button>
            </div>
             <div className="bg-white p-1.5 border border-slate-200 rounded-xl flex items-center gap-2 shadow-sm">
                <Filter className="w-4 h-4 text-slate-400 ml-2"/>
                <select 
                    value={selectedMarhalah} 
                    onChange={e => setSelectedMarhalah(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2"
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
                    className="p-2 text-sm font-bold text-slate-700 outline-none"
                />
            </div>

            <button 
                onClick={loadData}
                disabled={loading}
                className="bg-white text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-50 flex items-center gap-2"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} 
                Tampilkan
            </button>
            
            {hasLoaded && (
                <button 
                    onClick={handleSimpan}
                    disabled={saving}
                    className="bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-800 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Simpan
                </button>
            )}
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-wrap gap-4">
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-100 text-green-700 font-bold border rounded flex items-center justify-center">H</span> Hadir</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-yellow-100 text-yellow-700 font-bold border rounded flex items-center justify-center">B</span> Badal</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-red-100 text-red-700 font-bold border rounded flex items-center justify-center">A</span> Kosong</span>
        <span className="ml-auto italic">* Mode HP: tap H → A → B</span>
      </div>

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
          onCycleCell={cycleCellValue}
        />
      ) : (
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[75vh]">
        {!hasLoaded ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Search className="w-16 h-16 mb-4 text-slate-200"/>
                <p>Silakan pilih tingkat dan tanggal, lalu klik <b>Tampilkan</b>.</p>
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
                                    <div className="text-[10px] font-normal text-slate-400 mt-1 whitespace-nowrap">{row.kelas.marhalah?.nama}</div>
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
                                    
                                    const isMyJob = row.validSessions.includes(sess)
                                    const disabled = !isMyJob
                                    
                                    const cellId = `cell-${rowIdx}-${colCounter}`
                                    colCounter++

                                    return (
                                        <CellInput 
                                            key={sess + day.dateStr}
                                            id={cellId}
                                            value={val[sess]} 
                                            onChange={(v: string) => handleCellChange(row.kelas.id, day.dateStr, sess, v)} 
                                            disabled={disabled}
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
  const map = new Map<string, { id: string; name: string; sessions: SessionType[] }>()
  const add = (id: any, name: any, session: SessionType) => {
    if (!id || !name) return
    const key = String(id)
    if (!map.has(key)) map.set(key, { id: key, name: String(name), sessions: [] })
    map.get(key)!.sessions.push(session)
  }

  add(kelas.guru_shubuh_id, kelas.guru_shubuh_nama, 'shubuh')
  add(kelas.guru_ashar_id, kelas.guru_ashar_nama, 'ashar')
  add(kelas.guru_maghrib_id, kelas.guru_maghrib_nama, 'maghrib')

  return Array.from(map.values()).sort((a, b) => {
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
  onCycleCell,
}: {
  kelasList: any[]
  days: { dateStr: string; label: string; abbrev: string; shortDate: string; dayName: string }[]
  gridData: Record<string, any>
  isLibur: (dayName: string, session: SessionType) => boolean
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
                          const value = gridData[`${kelas.id}-${day.dateStr}`]?.[session] || 'H'
                          return (
                            <button
                              key={`${kelas.id}-${day.dateStr}-${session}`}
                              disabled={off}
                              onClick={() => onCycleCell(kelas.id, day.dateStr, session)}
                              className={`h-8 rounded-lg text-xs font-black border transition-colors active:scale-95 ${
                                off ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : guruStatusButtonClass(value)
                              }`}
                            >
                              {off ? '-' : value}
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
  return 'bg-green-50 text-green-700 border-green-200'
}

// --- OPTIMASI KOMPONEN (React.memo) ---
// Ini yang membuat input smooth. Dia tidak akan re-render kecuali value/disabled berubah.
// Kita gunakan custom comparator untuk mengabaikan perubahan fungsi callback
const CellInput = React.memo(({ id, value, onChange, disabled, onKeyDown }: { 
    id: string, 
    value: string, 
    onChange: (v: string) => void, 
    disabled?: boolean, 
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void 
}) => {
    let color = 'bg-white text-slate-800'
    if (value === 'H') color = 'bg-green-100 text-green-700 font-bold'
    if (value === 'A') color = 'bg-red-100 text-red-700 font-bold'
    if (value === 'B') color = 'bg-yellow-100 text-yellow-700 font-bold'
    if (value === 'L') color = 'bg-slate-100 text-slate-400'

    if (disabled) color = 'bg-slate-200/50 text-slate-300 cursor-not-allowed'

    return (
        <td className={`border p-0 h-full align-middle ${disabled ? 'bg-slate-100' : ''}`}>
            <input 
                id={id}
                type="text" 
                maxLength={1}
                disabled={disabled}
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
    // Re-render hanya jika value, disabled, atau ID berubah. 
    // Abaikan perubahan referensi fungsi onChange/onKeyDown
    return (
        prev.value === next.value &&
        prev.disabled === next.disabled &&
        prev.id === next.id
    )
})
