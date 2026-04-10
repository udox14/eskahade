'use client'

import React, { useState, useEffect } from 'react'
import { getKelasList, getAbsensiData, simpanAbsensi } from './actions'
import { Save, Calendar, Loader2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']

export default function AbsensiPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dataSantri, setDataSantri] = useState<any[]>([])
  const [gridData, setGridData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getKelasList().then(setKelasList) }, [])

  useEffect(() => {
    if (!selectedKelas) return
    setLoading(true)
    const loadToast = toast.loading("Memuat data absensi...")
    getAbsensiData(selectedKelas, selectedDate).then((data: any) => {
      setDataSantri(data.santri || [])
      const grid: Record<string, any> = {}
      if (data.absensi) {
        data.absensi.forEach((row: any) => {
          if (!grid[row.riwayat_pendidikan_id]) grid[row.riwayat_pendidikan_id] = {}
          grid[row.riwayat_pendidikan_id][row.tanggal] = { shubuh: row.shubuh, ashar: row.ashar, maghrib: row.maghrib }
        })
      }
      setGridData(grid)
      setLoading(false)
      toast.dismiss(loadToast)
    })
  }, [selectedKelas, selectedDate])

  const getDaysArray = () => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const diff = (day < 3 ? day + 7 : day) - 3
    d.setDate(d.getDate() - diff)
    const days = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(d)
      current.setDate(d.getDate() + i)
      days.push({ dateStr: current.toISOString().split('T')[0], label: format(current, 'EEEE', { locale: id }), shortDate: format(current, 'dd/MM') })
    }
    return days
  }

  const days = getDaysArray()

  const isHoliday = (dayName: string, session: SessionType) => {
    const d = dayName.toLowerCase()
    if (d === 'selasa' && session === 'maghrib') return true
    if (d === 'kamis' && session === 'maghrib') return true
    if (d === 'jumat' && (session === 'shubuh' || session === 'ashar')) return true
    return false
  }

  const handleCellChange = (santriId: string, dateStr: string, session: SessionType, value: string) => {
    const upperVal = value.toUpperCase()
    if (!['H', 'S', 'I', 'A', ''].includes(upperVal)) return
    setGridData(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], [dateStr]: { ...(prev[santriId]?.[dateStr] || { shubuh: 'H', ashar: 'H', maghrib: 'H' }), [session]: upperVal || 'H' } }
    }))
  }

  const handleFillRow = (santriId: string, value: string) => {
    setGridData(prev => {
      const currentSantriData = prev[santriId] ? JSON.parse(JSON.stringify(prev[santriId])) : {}
      days.forEach(day => {
        if (!currentSantriData[day.dateStr]) currentSantriData[day.dateStr] = { shubuh: 'H', ashar: 'H', maghrib: 'H' }
        SESSIONS.forEach(session => { if (!isHoliday(day.label, session)) currentSantriData[day.dateStr][session] = value })
      })
      return { ...prev, [santriId]: currentSantriData }
    })
    toast.success(`Set ${value === 'H' ? 'Reset' : value} seminggu`, { duration: 1000 })
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentRow: number, currentCol: number) => {
    const totalRows = dataSantri.length
    const totalCols = 21
    let nextRow = currentRow, nextCol = currentCol
    if (e.key === 'ArrowRight') nextCol++
    else if (e.key === 'ArrowLeft') nextCol--
    else if (e.key === 'ArrowDown') nextRow++
    else if (e.key === 'ArrowUp') nextRow--
    else return
    e.preventDefault()
    const findNextValidCell = (r: number, c: number, direction: 'fwd' | 'bwd' | 'vertical'): HTMLElement | null => {
      if (r < 0 || r >= totalRows || c < 0 || c >= totalCols) return null
      const el = document.getElementById(`cell-${r}-${c}`) as HTMLInputElement
      if (el && !el.disabled) return el
      if (direction === 'fwd') return findNextValidCell(r, c + 1, 'fwd')
      if (direction === 'bwd') return findNextValidCell(r, c - 1, 'bwd')
      return findNextValidCell(direction === 'vertical' ? (e.key === 'ArrowDown' ? r + 1 : r - 1) : r, c, 'vertical')
    }
    let direction: 'fwd' | 'bwd' | 'vertical' = 'vertical'
    if (e.key === 'ArrowRight') direction = 'fwd'
    if (e.key === 'ArrowLeft') direction = 'bwd'
    const target = findNextValidCell(nextRow, nextCol, direction)
    if (target) { target.focus(); (target as HTMLInputElement).select() }
  }

  const handleSimpan = async () => {
    if (!selectedKelas) return
    setSaving(true)
    const loadToast = toast.loading("Menyimpan absensi...")
    const payload: any[] = []
    dataSantri.forEach(s => {
      const santriGrid = gridData[s.id] || {}
      days.forEach(day => {
        const dayData = santriGrid[day.dateStr]
        if (dayData) {
          payload.push({ riwayat_id: s.id, tanggal: day.dateStr, shubuh: dayData.shubuh || 'H', ashar: dayData.ashar || 'H', maghrib: dayData.maghrib || 'H' })
        }
      })
    })
    const res = await simpanAbsensi(payload)
    setSaving(false)
    toast.dismiss(loadToast)
    if (res?.error) toast.error("Gagal menyimpan absensi", { description: res.error })
    else toast.success("Alhamdulillah!", { description: "Absensi mingguan berhasil disimpan." })
  }

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-green-500/10 rounded-xl text-green-600"><Calendar className="w-5 h-5"/></div>
            Absensi Mingguan
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Input rapel absensi per pekan.</p>
        </div>
        <Button
          onClick={handleSimpan}
          disabled={saving || !selectedKelas}
          className="bg-green-600 hover:bg-green-700 text-white font-black rounded-xl gap-2 shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
          Simpan Absensi
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pilih Kelas</label>
            <Select value={selectedKelas} onValueChange={(v) => { if (v) setSelectedKelas(v) }}>
              <SelectTrigger className="h-10 shadow-none focus:ring-green-500 bg-muted/20">
                <SelectValue placeholder="-- Pilih Kelas --"/>
              </SelectTrigger>
              <SelectContent>
                {kelasList.map(k => <SelectItem key={k.id} value={k.id} className="font-medium">{k.nama_kelas}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Tanggal (Pewakil Pekan)</label>
            <input
              type="date"
              className="p-2 h-10 border border-border rounded-xl bg-muted/20 focus:outline-none focus:ring-2 focus:ring-green-500 text-foreground text-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="text-sm font-bold text-muted-foreground pb-2 whitespace-nowrap">
            {days[0].shortDate} s.d. {days[6].shortDate}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {!selectedKelas ? (
        <div className="flex flex-col items-center py-16 gap-3 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/20"/>
          <p className="text-muted-foreground font-medium">Pilih kelas untuk mulai mengabsen.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-green-600"/></div>
      ) : (
        <Card className="border-border shadow-sm overflow-hidden flex flex-col" style={{ height: '70vh' }}>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/80 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left border border-border/40 bg-muted/80 sticky left-0 z-30 w-48 min-w-[12rem] text-xs font-black text-foreground">Nama Santri</th>
                  <th className="p-2 text-center border border-border/40 bg-muted/80 z-30 w-32 min-w-[8rem] text-xs font-black text-foreground md:sticky md:left-48">Aksi Cepat</th>
                  {days.map(day => (
                    <th key={day.dateStr} colSpan={3} className="border border-border/40 text-center py-2 px-1 min-w-[9rem]">
                      <div className="font-black text-foreground text-xs">{day.label}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{day.shortDate}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="border border-border/40 bg-muted/80 sticky left-0 z-30"/>
                  <th className="border border-border/40 bg-muted/80 z-30 md:sticky md:left-48"/>
                  {days.map(day => (
                    <React.Fragment key={day.dateStr + 'header'}>
                      <th className={cn('border border-border/40 text-center text-[10px] font-black text-muted-foreground w-10', isHoliday(day.label, 'shubuh') ? 'bg-muted/60' : 'bg-muted/30')}>S</th>
                      <th className={cn('border border-border/40 text-center text-[10px] font-black text-muted-foreground w-10', isHoliday(day.label, 'ashar') ? 'bg-muted/60' : 'bg-muted/30')}>A</th>
                      <th className={cn('border border-border/40 text-center text-[10px] font-black text-muted-foreground w-10', isHoliday(day.label, 'maghrib') ? 'bg-muted/60' : 'bg-muted/30')}>M</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataSantri.map((s, rowIdx) => {
                  let currentCellIndex = 0
                  return (
                    <tr key={s.id} className={cn(rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20', 'hover:bg-green-50/30 dark:hover:bg-green-900/5 transition-colors')}>
                      <td className="p-2 border border-border/30 sticky left-0 bg-inherit font-bold text-foreground truncate z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-xs">
                        {s.nama_lengkap}
                      </td>
                      <td className="p-1 border border-border/30 bg-inherit z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-center md:sticky md:left-48">
                        <div className="flex justify-center gap-1">
                          {[
                            { val: 'A', cls: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
                            { val: 'S', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
                            { val: 'I', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
                          ].map(b => (
                            <button key={b.val} onClick={() => handleFillRow(s.id, b.val)} title={`Set ${b.val} Seminggu`}
                              className={cn('w-6 h-6 rounded border text-xs font-black transition-colors', b.cls)}>{b.val}</button>
                          ))}
                          <button onClick={() => handleFillRow(s.id, 'H')} title="Reset Baris"
                            className="w-6 h-6 rounded bg-muted border border-border text-muted-foreground hover:bg-muted/80 flex items-center justify-center transition-colors">
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        </div>
                      </td>
                      {days.map(day => {
                        const val = gridData[s.id]?.[day.dateStr] || { shubuh: 'H', ashar: 'H', maghrib: 'H' }
                        return (
                          <React.Fragment key={day.dateStr + s.id}>
                            {SESSIONS.map(session => {
                              const isOff = isHoliday(day.label, session)
                              const cellId = `cell-${rowIdx}-${currentCellIndex}`
                              const cellColIndex = currentCellIndex
                              currentCellIndex++
                              return (
                                <CellInput
                                  key={session as string}
                                  id={cellId}
                                  value={(val[session] as string) ?? 'H'}
                                  isHoliday={isOff}
                                  onChange={(v) => handleCellChange(s.id, day.dateStr, session, v)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, cellColIndex)}
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
        </Card>
      )}
    </div>
  )
}

function CellInput({ id, value, isHoliday, onChange, onKeyDown }: {
  key?: React.Key; id: string; value: string; isHoliday: boolean
  onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void
}) {
  let bgColor = ''
  if (isHoliday) bgColor = 'bg-muted text-muted-foreground/40 cursor-not-allowed'
  else if (value === 'S') bgColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  else if (value === 'I') bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  else if (value === 'A') bgColor = 'bg-red-100 text-red-800 font-black dark:bg-red-900/30 dark:text-red-300'
  return (
    <td className={cn('border border-border/30 p-0 h-8', isHoliday ? 'bg-muted/40' : '')}>
      <input
        id={id}
        type="text"
        maxLength={1}
        disabled={isHoliday}
        className={cn('w-full h-full text-center focus:outline-none focus:bg-green-100 focus:ring-2 focus:ring-inset focus:ring-green-500 uppercase cursor-pointer transition-colors text-xs font-bold', bgColor)}
        value={isHoliday ? '-' : (value === 'H' ? '' : value)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        autoComplete="off"
      />
    </td>
  )
}