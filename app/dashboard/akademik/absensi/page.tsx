'use client'

import React, { useState, useEffect } from 'react'
import { getKelasList, getAbsensiData, simpanAbsensi } from './actions'
import { Save, Calendar, Loader2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner' // IMPORT WAJIB

// Tipe Data untuk Navigasi Grid
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

  // 1. Load Daftar Kelas
  useEffect(() => {
    getKelasList().then(setKelasList)
  }, [])

  // 2. Load Data Utama
  useEffect(() => {
    if (!selectedKelas) return

    setLoading(true)
    const loadToast = toast.loading("Memuat data absensi...") // Toast Loading

    getAbsensiData(selectedKelas, selectedDate).then((data: any) => {
      setDataSantri(data.santri || [])
      
      const grid: Record<string, any> = {}
      if (data.absensi) {
        data.absensi.forEach((row: any) => {
          if (!grid[row.riwayat_pendidikan_id]) grid[row.riwayat_pendidikan_id] = {}
          grid[row.riwayat_pendidikan_id][row.tanggal] = {
            shubuh: row.shubuh,
            ashar: row.ashar,
            maghrib: row.maghrib
          }
        })
      }
      setGridData(grid)
      setLoading(false)
      toast.dismiss(loadToast) // Tutup Toast Loading
    })
  }, [selectedKelas, selectedDate])

  // Helper: Generate Array 7 Hari (Rabu - Selasa)
  const getDaysArray = () => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const diff = (day < 3 ? day + 7 : day) - 3
    d.setDate(d.getDate() - diff)
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const current = new Date(d)
      current.setDate(d.getDate() + i)
      days.push({
        dateStr: current.toISOString().split('T')[0],
        label: format(current, 'EEEE', { locale: id }), // Senin, Selasa, dst
        shortDate: format(current, 'dd/MM')
      })
    }
    return days
  }

  const days = getDaysArray()

  // LOGIKA LIBUR PESANTREN
  const isHoliday = (dayName: string, session: SessionType) => {
    const d = dayName.toLowerCase()
    if (d === 'selasa' && session === 'maghrib') return true
    if (d === 'kamis' && session === 'maghrib') return true
    if (d === 'jumat' && (session === 'shubuh' || session === 'ashar')) return true
    return false
  }

  // Handler: Ubah Nilai Sel
  const handleCellChange = (santriId: string, dateStr: string, session: SessionType, value: string) => {
    const upperVal = value.toUpperCase()
    if (!['H', 'S', 'I', 'A', ''].includes(upperVal)) return

    setGridData(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        [dateStr]: {
          ...(prev[santriId]?.[dateStr] || { shubuh:'H', ashar:'H', maghrib:'H' }),
          [session]: upperVal || 'H' 
        }
      }
    }))
  }

  // Handler: Isi Satu Baris Full (A/S/I/H)
  const handleFillRow = (santriId: string, value: string) => {
    setGridData(prev => {
      const currentSantriData = prev[santriId] ? JSON.parse(JSON.stringify(prev[santriId])) : {}
      
      days.forEach(day => {
        if (!currentSantriData[day.dateStr]) {
            currentSantriData[day.dateStr] = { shubuh: 'H', ashar: 'H', maghrib: 'H' }
        }

        SESSIONS.forEach(session => {
          if (!isHoliday(day.label, session)) {
            currentSantriData[day.dateStr][session] = value
          }
        })
      })

      return { ...prev, [santriId]: currentSantriData }
    })
    
    // Feedback visual kecil
    toast.success(`Set ${value === 'H' ? 'Reset' : value} seminggu`, { duration: 1000 })
  }

  // LOGIKA NAVIGASI KEYBOARD
  const handleKeyDown = (e: React.KeyboardEvent, currentRow: number, currentCol: number) => {
    const totalRows = dataSantri.length
    const totalCols = 21 
    
    let nextRow = currentRow
    let nextCol = currentCol

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
    if (target) {
      target.focus(); 
      (target as HTMLInputElement).select()
    }
  }

  // Handler: Simpan
  const handleSimpan = async () => {
    if (!selectedKelas) return

    setSaving(true)
    const loadToast = toast.loading("Menyimpan absensi...") // Toast Loading

    const payload: any[] = []
    
    dataSantri.forEach(s => {
      const santriGrid = gridData[s.id] || {}
      days.forEach(day => {
        const dayData = santriGrid[day.dateStr]
        if (dayData) {
          const s_ = dayData.shubuh || 'H'
          const a_ = dayData.ashar  || 'H'
          const m_ = dayData.maghrib || 'H'
          // Selalu kirim ke server — biar server yang putuskan upsert atau delete
          // (termasuk baris semua H agar bisa hapus data lama yang salah input)
          payload.push({
            riwayat_id: s.id,
            tanggal: day.dateStr,
            shubuh: s_,
            ashar: a_,
            maghrib: m_
          })
        }
      })
    })

    const res = await simpanAbsensi(payload)
    
    setSaving(false)
    toast.dismiss(loadToast)

    if (res?.error) {
      toast.error("Gagal menyimpan absensi", { description: res.error })
    } else {
      toast.success("Alhamdulillah!", { description: "Absensi mingguan berhasil disimpan." })
    }
  }

  // Generate Kolom Header secara Flat untuk kalkulasi Index
  let colCounter = 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Absensi Mingguan (Rapel)</h1>
        <button 
          onClick={handleSimpan} 
          disabled={saving || !selectedKelas}
          className="bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 disabled:opacity-50 shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
          Simpan Absensi
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-end shadow-sm">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Pilih Kelas</label>
          <select 
            className="p-2 border rounded-md w-full md:w-48 focus:ring-2 focus:ring-green-500 outline-none"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Tanggal (Pewakil Pekan)</label>
          <input 
            type="date" 
            className="p-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 pb-2">
          {days[0].shortDate} s.d. {days[6].shortDate}
        </div>
      </div>

      {!selectedKelas ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
          <p className="text-gray-500">Pilih kelas untuk mulai mengabsen.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-green-600"/></div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[70vh]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left border bg-gray-100 sticky left-0 z-30 w-48 min-w-[12rem] shadow-sm">Nama Santri</th>
                  <th className="p-2 text-center border bg-gray-100 z-30 w-32 min-w-[8rem] shadow-sm md:sticky md:left-48">Aksi Cepat</th>
                  {days.map(day => (
                    <th key={day.dateStr} colSpan={3} className="border text-center py-2 px-1 min-w-[9rem]">
                      <div className="font-bold text-gray-800">{day.label}</div>
                      <div className="text-xs text-gray-500 font-normal">{day.shortDate}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="border bg-gray-100 sticky left-0 z-30 shadow-sm"></th>
                  <th className="border bg-gray-100 z-30 shadow-sm md:sticky md:left-48"></th>
                  {days.map(day => (
                    <React.Fragment key={day.dateStr + 'header'}>
                      <th className={`border text-center text-xs text-gray-500 w-10 ${isHoliday(day.label, 'shubuh') ? 'bg-gray-200' : 'bg-gray-50'}`}>S</th>
                      <th className={`border text-center text-xs text-gray-500 w-10 ${isHoliday(day.label, 'ashar') ? 'bg-gray-200' : 'bg-gray-50'}`}>A</th>
                      <th className={`border text-center text-xs text-gray-500 w-10 ${isHoliday(day.label, 'maghrib') ? 'bg-gray-200' : 'bg-gray-50'}`}>M</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataSantri.map((s, rowIdx) => {
                  let currentCellIndex = 0; 
                  return (
                    <tr key={s.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 border sticky left-0 bg-inherit font-medium truncate z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                        {s.santri.nama_lengkap}
                      </td>
                      
                      <td className="p-1 border bg-inherit z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] text-center md:sticky md:left-48">
                        <div className="flex justify-center gap-1">
                          <button 
                            onClick={() => handleFillRow(s.id, 'A')}
                            className="w-6 h-6 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold border border-red-200"
                            title="Set Alfa Seminggu"
                          >
                            A
                          </button>
                          <button 
                            onClick={() => handleFillRow(s.id, 'S')}
                            className="w-6 h-6 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs font-bold border border-yellow-200"
                            title="Set Sakit Seminggu"
                          >
                            S
                          </button>
                          <button 
                            onClick={() => handleFillRow(s.id, 'I')}
                            className="w-6 h-6 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold border border-blue-200"
                            title="Set Izin Seminggu"
                          >
                            I
                          </button>
                          <button 
                            onClick={() => handleFillRow(s.id, 'H')}
                            className="w-6 h-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center border border-gray-200"
                            title="Reset / Hapus Baris"
                          >
                            <Trash2 className="w-3 h-3" />
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
                                  key={session}
                                  id={cellId}
                                  value={val[session]} 
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
        </div>
      )}
    </div>
  )
}

function CellInput({ 
  id,
  value, 
  isHoliday,
  onChange,
  onKeyDown
}: { 
  id: string,
  value: string, 
  isHoliday: boolean,
  onChange: (v: string) => void,
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  let bgColor = ''
  if (isHoliday) bgColor = 'bg-gray-200 text-gray-400 cursor-not-allowed'
  else if (value === 'S') bgColor = 'bg-yellow-100 text-yellow-800'
  else if (value === 'I') bgColor = 'bg-blue-100 text-blue-800'
  else if (value === 'A') bgColor = 'bg-red-100 text-red-800 font-bold'

  return (
    <td className={`border p-0 h-8 ${isHoliday ? 'bg-gray-200' : ''}`}>
      <input 
        id={id}
        type="text" 
        maxLength={1}
        disabled={isHoliday}
        className={`w-full h-full text-center focus:outline-none focus:bg-green-100 focus:ring-2 focus:ring-inset focus:ring-green-500 uppercase cursor-pointer transition-colors ${bgColor}`}
        value={isHoliday ? '-' : (value === 'H' ? '' : value)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        autoComplete="off"
      />
    </td>
  )
}