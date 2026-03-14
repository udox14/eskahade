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

  // Init Marhalah
  useEffect(() => {
    getMarhalahList().then(setMarhalahList)
  }, [])

  // Load Data
  const loadData = async () => {
    setLoading(true)
    const days = getDaysArray(selectedDate)
    const res = await getJurnalGuru(days[0].dateStr, days[6].dateStr, selectedMarhalah)
    
    setDataList(res.list)
    setGridData(res.absensi)
    setLoading(false)
    setHasLoaded(true)
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

      addSesi(k.guru_shubuh, 'shubuh')
      addSesi(k.guru_ashar, 'ashar')
      addSesi(k.guru_maghrib, 'maghrib')

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
    else toast.success("Jurnal Tersimpan!")
  }

  // --- KEYBOARD NAVIGATION (MEMOIZED) ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number, totalRows: number) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()

      const maxRow = totalRows
      const maxCol = 21 // 7 hari x 3 sesi
      
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
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Briefcase className="w-6 h-6 text-indigo-600"/> Absensi Guru (Jurnal)
           </h1>
           <p className="text-gray-500 text-sm">Input kehadiran mengajar mingguan.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
             <div className="bg-white p-1.5 border rounded-lg flex items-center gap-2 shadow-sm">
                <Filter className="w-4 h-4 text-gray-400 ml-2"/>
                <select 
                    value={selectedMarhalah} 
                    onChange={e => setSelectedMarhalah(e.target.value)}
                    className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer pr-2"
                >
                    <option value="">Semua Tingkat</option>
                    {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
            </div>

            <div className="bg-white p-1 border rounded-lg shadow-sm">
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="p-2 text-sm font-bold text-gray-700 outline-none"
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

      <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-wrap gap-4">
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-100 text-green-700 font-bold border rounded flex items-center justify-center">H</span> Hadir</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-yellow-100 text-yellow-700 font-bold border rounded flex items-center justify-center">B</span> Badal</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-red-100 text-red-700 font-bold border rounded flex items-center justify-center">A</span> Kosong</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-gray-200 text-gray-500 font-bold border rounded flex items-center justify-center">L</span> Libur</span>
        <span className="ml-auto italic">* Navigasi panah kanan/kiri terkunci per baris</span>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[70vh]">
        {!hasLoaded ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Search className="w-16 h-16 mb-4 text-gray-200"/>
                <p>Silakan pilih tingkat dan tanggal, lalu klik <b>Tampilkan</b>.</p>
            </div>
        ) : loading ? (
             <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500"/></div>
        ) : (
             <div className="overflow-auto flex-1">
             <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                   <tr>
                      <th className="p-3 text-left border bg-gray-100 sticky left-0 z-30 w-48 min-w-[12rem] shadow-sm">Kelas</th>
                      <th className="p-3 text-left border bg-gray-100 z-30 w-48 min-w-[12rem] shadow-sm md:sticky md:left-48">Guru Pengajar</th>
                      {days.map(day => (
                        <th key={day.dateStr} colSpan={3} className="border text-center py-2 px-1 min-w-[6rem]">
                            <div className="font-bold text-gray-800">{day.label}</div>
                            <div className="text-[10px] text-gray-500 font-normal">{day.shortDate}</div>
                        </th>
                      ))}
                   </tr>
                   <tr>
                      <th className="border bg-gray-100 sticky left-0 z-30 shadow-sm"></th>
                      <th className="border bg-gray-100 md:sticky md:left-48 z-30"></th>
                      {days.map(day => (
                        <React.Fragment key={day.dateStr + 'h'}>
                            <th className="border text-center text-[9px] text-gray-500 bg-gray-50 w-8" title="Shubuh">S</th>
                            <th className="border text-center text-[9px] text-gray-500 bg-gray-50 w-8" title="Ashar">A</th>
                            <th className="border text-center text-[9px] text-gray-500 bg-gray-50 w-8" title="Maghrib">M</th>
                        </React.Fragment>
                      ))}
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
                                    className="p-3 border sticky left-0 bg-white group-hover:bg-indigo-50 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] align-top font-bold text-gray-800"
                                    rowSpan={row.rowSpan}
                                >
                                    {row.kelas.nama_kelas}
                                    <div className="text-[10px] font-normal text-gray-400 mt-1">{row.kelas.marhalah?.nama}</div>
                                </td>
                            )}

                            {/* KOLOM GURU */}
                            <td className="p-2 border bg-white z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] md:sticky md:left-48 text-xs font-medium text-gray-700 flex items-center gap-2 h-full min-h-[40px]">
                                <User className="w-3 h-3 text-indigo-400"/> {row.guru.name}
                            </td>

                            {/* KOLOM INPUT GRID (OPTIMIZED) */}
                            {days.map(day => {
                                const key = `${row.kelas.id}-${day.dateStr}`
                                const val = gridData[key] || { shubuh:'', ashar:'', maghrib:'' }
                                
                                return (
                                    <React.Fragment key={key}>
                                        {SESSIONS.map(sess => {
                                            const isMyJob = row.validSessions.includes(sess)
                                            const isHoliday = isLibur(day.dayName, sess)
                                            const disabled = !isMyJob || isHoliday
                                            
                                            const cellId = `cell-${rowIdx}-${colCounter}`
                                            colCounter++

                                            return (
                                                <CellInput 
                                                    key={sess}
                                                    id={cellId}
                                                    value={val[sess]} 
                                                    onChange={(v: string) => handleCellChange(row.kelas.id, day.dateStr, sess, v)} 
                                                    disabled={disabled}
                                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, rowIdx, colCounter - 1, rowsToRender.length)}
                                                />
                                            )
                                        })}
                                    </React.Fragment>
                                )
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
    let color = 'bg-white text-gray-800'
    if (value === 'H') color = 'bg-green-100 text-green-700 font-bold'
    if (value === 'A') color = 'bg-red-100 text-red-700 font-bold'
    if (value === 'B') color = 'bg-yellow-100 text-yellow-700 font-bold'
    if (value === 'L') color = 'bg-gray-100 text-gray-400'

    if (disabled) color = 'bg-gray-200/50 text-gray-300 cursor-not-allowed'

    return (
        <td className={`border p-0 h-full align-middle ${disabled ? 'bg-gray-100' : ''}`}>
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