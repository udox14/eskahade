'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getJurnalGuru, simpanAbsensiGuru, getMarhalahList } from './actions'
import { Save, Loader2, Briefcase, User, Filter, Search } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']

export default function AbsensiGuruPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [dataList, setDataList] = useState<any[]>([])
  const [gridData, setGridData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getMarhalahList().then(setMarhalahList) }, [])

  const loadData = async () => {
    setLoading(true)
    const days = getDaysArray(selectedDate)
    const res = await getJurnalGuru(days[0].dateStr, days[6].dateStr, selectedMarhalah)
    setDataList(res.list); setGridData(res.absensi); setLoading(false); setHasLoaded(true)
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
      daysArr.push({
        dateStr: current.toISOString().split('T')[0],
        label: format(current, 'EEEE', { locale: id }),
        shortDate: format(current, 'dd/MM'),
        dayName: format(current, 'EEEE', { locale: id }).toLowerCase()
      })
    }
    return daysArr
  }

  const days = useMemo(() => getDaysArray(selectedDate), [selectedDate])

  const isLibur = (dayName: string, session: SessionType) => {
    if (dayName === 'selasa' && session === 'maghrib') return true
    if (dayName === 'kamis' && session === 'maghrib') return true
    if (dayName === 'jumat' && (session === 'shubuh' || session === 'ashar')) return true
    return false
  }

  // --- LOGIC: ROW GENERATION ---
  const rowsToRender = useMemo(() => {
    const rows: any[] = []
    dataList.forEach(k => {
      const mapGuru = new Map<string, { id: string, name: string, sessions: SessionType[] }>()
      
      const addSesi = (guruId: string | null, guruNama: string | null, s: SessionType) => {
        if (!guruId) return 
        if (!mapGuru.has(guruId)) {
          mapGuru.set(guruId, { id: guruId, name: guruNama ?? '-', sessions: [] })
        }
        mapGuru.get(guruId)?.sessions.push(s)
      }

      // Gunakan field flat sesuai alias di query SQL (remote fix)
      addSesi(k.guru_shubuh_id, k.guru_shubuh_nama, 'shubuh')
      addSesi(k.guru_ashar_id, k.guru_ashar_nama, 'ashar')
      addSesi(k.guru_maghrib_id, k.guru_maghrib_nama, 'maghrib')

      if (mapGuru.size === 0) {
        rows.push({ uniqueId: `${k.id}-empty`, kelas: k, guru: { name: 'Belum Ada Guru' }, validSessions: [], isFirst: true, rowSpan: 1 })
      } else {
        let isFirst = true
        const teachers = Array.from(mapGuru.values()).sort((a, b) => {
          const score = (t: any) => (t.sessions.includes('shubuh') ? 1 : t.sessions.includes('ashar') ? 2 : 3)
          return score(a) - score(b)
        })
        teachers.forEach(t => {
          rows.push({ uniqueId: `${k.id}-${t.id}`, kelas: k, guru: t, validSessions: t.sessions, isFirst, rowSpan: teachers.length })
          isFirst = false
        })
      }
    })
    return rows
  }, [dataList])

  const handleCellChange = useCallback((kelasId: string, dateStr: string, session: SessionType, value: string) => {
    const upperVal = value.toUpperCase()
    if (!['H', 'A', 'S', 'I', 'B', 'L', ''].includes(upperVal)) return
    const key = `${kelasId}-${dateStr}`
    setGridData(prev => ({ ...prev, [key]: { ...(prev[key] || { shubuh: '', ashar: '', maghrib: '' }), [session]: upperVal } }))
  }, [])

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
            guru_id_wali: k.guru_maghrib_id || null, 
            tanggal: day.dateStr,
            shubuh: val.shubuh || '',
            ashar: val.ashar || '',
            maghrib: val.maghrib || ''
          })
        }
      })
    })
    const res = await simpanAbsensiGuru(payload)
    setSaving(false); toast.dismiss(loadToast)
    if (res?.error) toast.error("Gagal menyimpan", { description: res.error })
    else toast.success("Jurnal Tersimpan!")
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number, totalRows: number) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const maxCol = 21
      let currR = rowIdx, currC = colIdx
      const moveR = e.key === 'ArrowDown' ? 1 : (e.key === 'ArrowUp' ? -1 : 0)
      const moveC = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0)
      let safetyCounter = 0
      while (safetyCounter < 50) {
        safetyCounter++; currR += moveR; currC += moveC
        if (currR < 0 || currR >= totalRows || currC < 0 || currC >= maxCol) break
        const el = document.getElementById(`cell-${currR}-${currC}`) as HTMLInputElement
        if (el && !el.disabled) { el.focus(); el.select(); break }
      }
    }
  }, [])

  return (
    <div className="space-y-5 max-w-[95vw] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600"><Briefcase className="w-5 h-5"/></div>
            Absensi Guru (Jurnal)
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Input kehadiran mengajar mingguan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMarhalah || '__ALL__'} onValueChange={(v) => setSelectedMarhalah(v === '__ALL__' || !v ? '' : v)}>
            <SelectTrigger className="w-40 h-10 shadow-sm focus:ring-indigo-500 bg-background font-bold">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__" className="font-medium">Semua Tingkat</SelectItem>
              {marhalahList.map(m => <SelectItem key={m.id} value={m.id} className="font-medium">{m.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 px-3 border border-border rounded-xl text-sm font-bold text-foreground bg-background outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button onClick={loadData} disabled={loading} variant="outline" className="h-10 font-bold rounded-xl gap-2 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tampilkan
          </Button>
          {hasLoaded && (
            <Button onClick={handleSimpan} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-10 gap-2 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
              Simpan
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs bg-indigo-500/10 border border-indigo-400/20 px-4 py-3 rounded-xl">
        {[
          { code: 'H', label: 'Hadir', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
          { code: 'B', label: 'Badal', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
          { code: 'A', label: 'Kosong', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
          { code: 'L', label: 'Libur', cls: 'bg-muted text-muted-foreground' },
        ].map(b => (
          <span key={b.code} className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-400">
            <span className={cn('w-5 h-5 rounded font-black text-[10px] flex items-center justify-center', b.cls)}>{b.code}</span>
            {b.label}
          </span>
        ))}
        <span className="ml-auto italic text-indigo-600/60 dark:text-indigo-400/60 hidden sm:inline">* Navigasi ↑↓←→ tersedia</span>
      </div>

      {/* Grid Table */}
      <Card className="border-border shadow-sm overflow-hidden flex flex-col" style={{ height: '70vh' }}>
        {!hasLoaded ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Search className="w-16 h-16 text-muted-foreground/10"/>
            <p className="text-muted-foreground font-medium">Pilih tingkat dan tanggal, lalu klik <strong>Tampilkan</strong>.</p>
          </div>
        ) : loading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500"/></div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/80 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left border border-border/30 bg-muted/80 sticky left-0 z-30 w-48 min-w-[12rem] text-xs font-black text-foreground">Kelas</th>
                  <th className="p-3 text-left border border-border/30 bg-muted/80 z-30 w-48 min-w-[12rem] text-xs font-black text-foreground md:sticky md:left-48">Guru Pengajar</th>
                  {days.map(day => (
                    <th key={day.dateStr} colSpan={3} className="border border-border/30 text-center py-2 px-1 min-w-[6rem]">
                      <div className="font-black text-foreground text-xs">{day.label}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{day.shortDate}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="border border-border/30 bg-muted/80 sticky left-0 z-30"/>
                  <th className="border border-border/30 bg-muted/80 md:sticky md:left-48 z-30"/>
                  {days.map(day => (
                    <React.Fragment key={day.dateStr + 'h'}>
                      {['S', 'A', 'M'].map(s => (
                        <th key={s} className="border border-border/30 text-center text-[9px] font-black text-muted-foreground bg-muted/40 w-8">{s}</th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsToRender.map((row, rowIdx) => {
                  let colCounter = 0
                  return (
                    <tr key={row.uniqueId} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors">
                      {row.isFirst && (
                        <td className="p-3 border border-border/30 sticky left-0 bg-background z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] align-top font-black text-foreground text-xs" rowSpan={row.rowSpan}>
                          {row.kelas.nama_kelas}
                          <div className="text-[10px] font-normal text-muted-foreground mt-1">{row.kelas.marhalah_nama}</div>
                        </td>
                      )}
                      <td className="p-2 border border-border/30 bg-background z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] md:sticky md:left-48 text-xs font-medium text-foreground flex items-center gap-1.5 h-full min-h-[40px]">
                        <User className="w-3 h-3 text-indigo-400 shrink-0"/> {row.guru.name}
                      </td>
                      {days.map(day => {
                        const key = `${row.kelas.id}-${day.dateStr}`
                        const val = gridData[key] || { shubuh: '', ashar: '', maghrib: '' }
                        return (
                          <React.Fragment key={key}>
                            {SESSIONS.map(sess => {
                              const isMyJob = row.validSessions.includes(sess)
                              const isHoliday = isLibur(day.dayName, sess)
                              const disabled = !isMyJob || isHoliday
                              const cellId = `cell-${rowIdx}-${colCounter}`
                              colCounter++
                              return (
                                <GuruCellInput
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
      </Card>
    </div>
  )
}

const GuruCellInput = React.memo(({ id, value, onChange, disabled, onKeyDown }: {
  id: string; value: string; onChange: (v: string) => void; disabled?: boolean
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) => {
  let color = 'bg-background text-foreground'
  if (value === 'H') color = 'bg-emerald-100 text-emerald-700 font-black dark:bg-emerald-900/30 dark:text-emerald-400'
  if (value === 'A') color = 'bg-red-100 text-red-700 font-black dark:bg-red-900/30 dark:text-red-400'
  if (value === 'B') color = 'bg-amber-100 text-amber-700 font-black dark:bg-amber-900/30 dark:text-amber-400'
  if (value === 'L') color = 'bg-muted/60 text-muted-foreground'
  if (disabled) color = 'bg-muted/40 text-muted-foreground/20 cursor-not-allowed'
  return (
    <td className={cn('border border-border/30 p-0 h-full align-middle', disabled ? 'bg-muted/20' : '')}>
      <input
        id={id}
        type="text"
        maxLength={1}
        disabled={disabled}
        className={cn('w-full h-10 text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 uppercase cursor-pointer transition-colors text-xs', color)}
        value={disabled ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        autoComplete="off"
      />
    </td>
  )
}, (prev, next) => prev.value === next.value && prev.disabled === next.disabled && prev.id === next.id)