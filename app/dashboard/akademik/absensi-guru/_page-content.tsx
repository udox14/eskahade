'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getJurnalGuru, simpanAbsensiGuru, getMarhalahList } from './actions'
import { Save, Loader2, Briefcase, User, Filter, Search } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']

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

  // Init Marhalah
  useEffect(() => {
    getMarhalahList().then(setMarhalahList)
  }, [])

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
  }

  // --- LOGIC 1: ARRAY HARI ---
  const getDaysArray = (baseDate: string) => {
    const d = new Date(baseDate)
    const day = d.getDay()
    const diff = (day < 3 ? day + 7 : day) - 3
    d.setDate(d.getDate() - diff)
    
    const daysArr = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(d)
      current.setDate(d.getDate() + i)
      daysArr.push({
        dateStr: current.toISOString().split('T')[0],
        label: format(current, 'EEEE', { locale: id }),
        shortDate: format(current, 'dd/MM'),
        dayName: format(current, 'EEEE', { locale: id }).toLowerCase() 
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
    // Validasi input: hanya H, A, S, I, B, L atau kosong
    if (!['H', 'A', 'S', 'I', 'B', 'L', ''].includes(upperVal)) return
    
    setHasUnsavedChanges(true)
    const key = `${kelasId}-${dateStr}`
    setGridData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { shubuh:'', ashar:'', maghrib:'' }),
        [session]: upperVal
      }
    }))
  }, []) // Empty dependency karena state updater (setGridData) stabil

  const handleSimpan = async () => {
    setSaving(true)
    const loadToast = toast.loading("Menyimpan jurnal...")
    const payload: any[] = []
    
    dataList.forEach(k => {
      days.forEach(day => {
        const key = `${k.id}-${day.dateStr}`
        const val = gridData[key]
        if (val) {
          payload.push({
            kelas_id: k.id,
            guru_id_wali: k.guru_maghrib?.id || null, 
            tanggal: day.dateStr,
            shubuh: val.shubuh || '',
            ashar: val.ashar || '',
            maghrib: val.maghrib || ''
          })
        }
      })
    })

    const res = await simpanAbsensiGuru(payload)
    setSaving(false)
    toast.dismiss(loadToast)

    if (res?.error) toast.error("Gagal menyimpan", { description: res.error })
    else {
        setHasUnsavedChanges(false)
        toast.success("Jurnal Tersimpan!")
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
  }, [])

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
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-slate-200 text-slate-500 font-bold border rounded flex items-center justify-center">L</span> Libur</span>
        <span className="ml-auto italic">* Navigasi panah kanan/kiri terkunci per baris</span>
      </div>

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
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead className="bg-slate-100 sticky top-0 z-40">
                   <tr>
                      <th rowSpan={2} className="p-3 text-left border-b border-r bg-slate-100 w-40 sticky left-0 z-50">Kelas</th>
                      <th rowSpan={2} className="p-3 text-left border-b border-r bg-slate-100 w-48 sticky left-40 z-50">Guru Pengajar</th>
                      {SESSIONS.map(sess => {
                           const sessDays = days.filter(d => !isLibur(d.dayName, sess))
                           return (
                               <th key={sess} colSpan={sessDays.length} className="border-b border-r text-center py-2 px-1 font-extrabold text-slate-800 uppercase bg-slate-200 tracking-widest text-[11px]">
                                   {sess}
                               </th>
                           )
                      })}
                   </tr>
                   <tr>
                      {SESSIONS.map(sess => {
                           const sessDays = days.filter(d => !isLibur(d.dayName, sess))
                           return sessDays.map(day => (
                               <th key={sess + day.dateStr} className="border-b border-r text-center text-[10px] text-slate-600 bg-slate-50 min-w-[3.5rem] p-1.5 font-bold uppercase">
                                   {day.label}
                               </th>
                           ))
                      })}
                   </tr>
                </thead>
                <tbody>
                   {rowsToRender.map((row, rowIdx) => {
                      let colCounter = 0
                      return (
                        <tr key={row.uniqueId} className="group hover:bg-indigo-50/50 transition-colors">
                            {/* KOLOM KELAS */}
                            {row.isFirst && (
                                <td 
                                    className="p-3 border-b border-r sticky left-0 bg-white z-20 align-top"
                                    rowSpan={row.rowSpan}
                                >
                                    <div className="font-bold text-slate-800 leading-tight">{row.kelas.nama_kelas}</div>
                                    <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">{row.kelas.marhalah_nama || row.kelas.marhalah?.nama}</div>
                                </td>
                            )}

                            {/* KOLOM GURU */}
                            <td className="p-2 border-b border-r bg-white sticky left-40 z-20 group-hover:bg-indigo-50/50 transition-colors">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                        <User className="w-3 h-3 text-indigo-500"/>
                                    </div>
                                    <span className="truncate">{row.guru.name}</span>
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
    </div>
  )
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

    if (disabled) color = 'bg-slate-50 text-slate-200 cursor-not-allowed'

    return (
        <td className={`border-b border-r p-0 h-10 ${disabled ? 'bg-slate-50' : ''}`}>
            <input 
                id={id}
                type="text" 
                maxLength={1}
                disabled={disabled}
                className={`w-full h-full text-center focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-inset focus:ring-indigo-400 uppercase cursor-pointer transition-all text-xs ${color}`}
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