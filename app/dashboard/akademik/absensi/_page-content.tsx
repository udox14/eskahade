'use client'

import React, { useState, useEffect } from 'react'
import { getKelasList, getAbsensiData, simpanAbsensi, getAbsensiGlobalA, getAsramaList, getMarhalahList } from './actions'
import { Save, Calendar, Loader2, Trash2, FileSpreadsheet, X, Filter, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner' // IMPORT WAJIB

// Tipe Data untuk Navigasi Grid
type SessionType = 'shubuh' | 'ashar' | 'maghrib'
const SESSIONS: SessionType[] = ['shubuh', 'ashar', 'maghrib']

export default function AbsensiPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedAsrama, setSelectedAsrama] = useState('')
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const [dataSantri, setDataSantri] = useState<any[]>([])
  const [gridData, setGridData] = useState<Record<string, any>>({})
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSortBy, setExportSortBy] = useState<'asrama' | 'kelas'>('asrama')
  const [hasLoaded, setHasLoaded] = useState(false)

  // 1. Load Data Master
  useEffect(() => {
    getKelasList().then(setKelasList)
    getAsramaList().then(setAsramaList)
    getMarhalahList().then(setMarhalahList)
  }, [])

  // 2. Load Data Utama
  const loadData = () => {
    setLoading(true)
    const loadToast = toast.loading("Memuat data absensi...")

    getAbsensiData(selectedDate, { 
      kelasId: selectedKelas, 
      asrama: selectedAsrama, 
      marhalahId: selectedMarhalah 
    }).then((data: any) => {
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
      setHasUnsavedChanges(false)
      setHasLoaded(true)
      toast.dismiss(loadToast)
    })
  }

  useEffect(() => {
    if (hasLoaded) {
      loadData()
    }
  }, [selectedKelas, selectedAsrama, selectedMarhalah, selectedDate])

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

    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
  const getTotalActiveSessions = () => {
    let count = 0;
    days.forEach(day => {
        SESSIONS.forEach(session => {
            if (!isHoliday(day.label, session)) count++;
        });
    });
    return count;
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentRow: number, currentCol: number) => {
    const totalRows = dataSantri.length
    const totalCols = getTotalActiveSessions()
    
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
    if (dataSantri.length === 0) return

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
      setHasUnsavedChanges(false)
      toast.success("Alhamdulillah!", { description: "Absensi mingguan berhasil disimpan." })
    }
  }

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (hasUnsavedChanges && !window.confirm("Ada absensi yang belum disave! Yakin ingin pindah kelas?")) return
      setSelectedKelas(e.target.value)
  }

  const handleMarhalahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (hasUnsavedChanges && !window.confirm("Ada absensi yang belum disave! Yakin ingin pindah marhalah?")) return
      setSelectedMarhalah(e.target.value)
      setSelectedKelas('') // Reset kelas jika marhalah ganti
  }

  const handleAsramaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (hasUnsavedChanges && !window.confirm("Ada absensi yang belum disave! Yakin ingin pindah asrama?")) return
      setSelectedAsrama(e.target.value)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (hasUnsavedChanges && !window.confirm("Ada absensi yang belum disave! Yakin ingin ganti tanggal/pekan?")) return
      setSelectedDate(e.target.value)
  }

  // Handler: Export Excel
  const handleExportExcel = async () => {
    if (dataSantri.length === 0) return

    const exportToast = toast.loading("Menyiapkan file Excel...")
    try {
      const XLSX = await import('xlsx')
      
      // 1. Persiapkan Header
      const headers = [
        "Nama Santri", 
        "Asrama", 
        "Kamar", 
        "Kelas Pesantren", 
        "Sekolah", 
        "Kelas Sekolah"
      ]
      
      // Tambah header sesi absensi yang aktif
      const activeSessions: { dateStr: string, session: SessionType, label: string }[] = []
      
      days.forEach(day => {
        SESSIONS.forEach(session => {
          if (!isHoliday(day.label, session)) {
            activeSessions.push({ 
              dateStr: day.dateStr, 
              session, 
              label: `${day.label} ${session.charAt(0).toUpperCase() + session.slice(1)}`
            })
          }
        })
      })

      headers.push(...activeSessions.map(s => s.label))

      // 2. Persiapkan Data
      const rows = dataSantri.map(s => {
        const rowData: any[] = [
          s.nama_lengkap,
          s.asrama || '-',
          s.kamar || '-',
          s.kelas_pesantren || '-',
          s.sekolah || '-',
          s.kelas_sekolah || '-'
        ]
        
        const santriGrid = gridData[s.id] || {}
        
        activeSessions.forEach(as => {
          const val = santriGrid[as.dateStr]?.[as.session] || 'H'
          // Sesuai permintaan: Alfa ditulis A. Yang lain (H) dikosongkan agar bersih.
          rowData.push(val === 'H' ? '' : val)
        })
        
        return rowData
      })

      // 3. Generate Sheet
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      
      // Auto-width
      const colWidths = headers.map((h, i) => {
        const maxLen = Math.max(
          h.length,
          ...rows.map(r => String(r[i] || '').length)
        )
        return { wch: maxLen + 2 }
      })
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Absensi")
      
      const tglAwal = days[0].dateStr.split('-').reverse().join('-')
      const tglAkhir = days[6].dateStr.split('-').reverse().join('-')
      const fileName = `Absensi_${dataSantri[0]?.kelas_pesantren || 'Kelas'}_${tglAwal}_sd_${tglAkhir}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      toast.success("Berhasil export ke Excel")
    } catch (error) {
      console.error(error)
      toast.error("Gagal export ke Excel")
    } finally {
      toast.dismiss(exportToast)
    }
  }

  // Handler: Export Global (Khusus Alfa)
  const handleExportGlobalA = async () => {
    const exportToast = toast.loading("Mengambil data rekap global...")
    try {
      const { santri, absensi } = await getAbsensiGlobalA(selectedDate)
      
      if (!santri.length) {
        toast.info("Tidak ditemukan santri dengan Alfa (A) di pekan ini.")
        return
      }

      // Sortir data
      const sortedSantri = [...santri].sort((a, b) => {
        if (exportSortBy === 'asrama') {
          const compAsrama = (a.asrama || '').localeCompare(b.asrama || '')
          if (compAsrama !== 0) return compAsrama
          const compKamar = (a.kamar || '').localeCompare(b.kamar || '', undefined, { numeric: true })
          if (compKamar !== 0) return compKamar
          return a.nama_lengkap.localeCompare(b.nama_lengkap)
        } else {
          const compKelas = (a.kelas_pesantren || '').localeCompare(b.kelas_pesantren || '', undefined, { numeric: true })
          if (compKelas !== 0) return compKelas
          return a.nama_lengkap.localeCompare(b.nama_lengkap)
        }
      })

      const XLSX = await import('xlsx')
      const headers = ["Nama Santri", "Asrama", "Kamar", "Kelas Pesantren", "Sekolah", "Kelas Sekolah"]
      const activeSessions: { dateStr: string, session: SessionType, label: string }[] = []
      
      days.forEach(day => {
        SESSIONS.forEach(session => {
          if (!isHoliday(day.label, session)) {
            activeSessions.push({ 
              dateStr: day.dateStr, 
              session, 
              label: `${day.label} ${session.charAt(0).toUpperCase() + session.slice(1)}`
            })
          }
        })
      })
      headers.push(...activeSessions.map(s => s.label))

      const rows = sortedSantri.map(s => {
        const rowData = [s.nama_lengkap, s.asrama || '-', s.kamar || '-', s.kelas_pesantren || '-', s.sekolah || '-', s.kelas_sekolah || '-']
        const santriGrid = absensi[s.id] || {}
        activeSessions.forEach(as => {
          const val = santriGrid[as.dateStr]?.[as.session] || 'H'
          rowData.push(val === 'H' ? '' : val)
        })
        return rowData
      })

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map(r => String(r[i] || '').length)) + 2 }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Alfa Mingguan")
      
      const tglAwal = days[0].dateStr.split('-').reverse().join('-')
      const tglAkhir = days[6].dateStr.split('-').reverse().join('-')
      const fileName = `Rekap_Alfa_Global_${tglAwal}_sd_${tglAkhir}.xlsx`
      
      XLSX.writeFile(wb, fileName)
      toast.success(`Berhasil export ${santri.length} santri bermasalah.`)
    } catch (e) {
      console.error(e)
      toast.error("Gagal export rekap global")
    } finally {
      toast.dismiss(exportToast)
    }
  }

  // Generate Kolom Header secara Flat untuk kalkulasi Index
  let colCounter = 0;

  return (
    <div className="space-y-6">
      {/* HEADER UTAMA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Absensi Pengajian</h1>
          <p className="text-slate-500 mt-1">Input absensi mingguan (rapel) santri</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
            onClick={handleSimpan} 
            disabled={saving || dataSantri.length === 0}
            className="bg-green-600 text-white px-8 py-3 rounded-2xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 transition-all active:scale-[0.98] font-bold"
          >
            {saving ? <Loader2 className="w-5 h-4 animate-spin"/> : <Save className="w-5 h-4" />}
            Simpan Absensi
          </button>
        </div>
      </div>

      {/* FILTER BAR - PREMIUM DESIGN */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Filter Data</span>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filter Marhalah */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-green-600 transition-colors">Marhalah</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none appearance-none text-sm text-slate-700 font-medium cursor-pointer transition-all hover:border-slate-300"
                value={selectedMarhalah}
                onChange={handleMarhalahChange}
              >
                <option value="">Semua Marhalah</option>
                {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Kelas */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-green-600 transition-colors">Kelas</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none appearance-none text-sm text-slate-700 font-medium cursor-pointer transition-all hover:border-slate-300"
                value={selectedKelas}
                onChange={handleClassChange}
              >
                <option value="">Semua Kelas</option>
                {kelasList
                  .filter(k => !selectedMarhalah || k.marhalah_id == selectedMarhalah)
                  .map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)
                }
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Asrama */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-green-600 transition-colors">Asrama</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none appearance-none text-sm text-slate-700 font-medium cursor-pointer transition-all hover:border-slate-300"
                value={selectedAsrama}
                onChange={handleAsramaChange}
              >
                <option value="">Semua Asrama</option>
                {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Tanggal */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-green-600 transition-colors">Tanggal Pekan</label>
              <div className="relative flex items-center">
                 <input 
                    type="date" 
                    className="w-full pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm text-slate-700 font-medium transition-all hover:border-slate-300"
                    value={selectedDate}
                    onChange={handleDateChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
           <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <Calendar className="w-4 h-4 text-green-600" />
            <span>Pekan Ini: <span className="text-slate-800">{days[0].shortDate} — {days[6].shortDate}</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowExportModal(true)} 
              className="px-4 py-2 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-2 hover:bg-rose-100 transition-colors text-sm font-bold border border-rose-100"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Rekap Alfa (Global)
            </button>
            <button 
              onClick={handleExportExcel} 
              disabled={loading || dataSantri.length === 0}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-2 hover:bg-emerald-100 disabled:opacity-50 transition-colors text-sm font-bold border border-emerald-100"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {!hasLoaded ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center">
             <Calendar className="w-12 h-12 text-green-300" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Siap Absen?</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">Pilih filter di atas lalu klik tombol di bawah untuk menampilkan daftar santri.</p>
          </div>
          <button 
            onClick={loadData}
            className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all"
          >
            Tampilkan Daftar Santri
          </button>
        </div>
      ) : loading ? (
        <div className="text-center py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4 opacity-50"/>
          <p className="text-slate-500 font-medium animate-pulse">Menyiapkan data absensi...</p>
        </div>
      ) : dataSantri.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4"/>
          <h3 className="text-lg font-bold text-slate-400">Tidak Ada Data</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">
            Tidak ditemukan santri yang sesuai dengan kriteria filter yang Anda pilih.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[75vh]">
          <div className="overflow-y-auto overflow-x-hidden hover:overflow-x-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 sticky top-0 z-40 shadow-sm outline outline-1 outline-slate-200">
              <tr>
                <th className="p-3 text-left border w-48 bg-slate-100">Nama Santri</th>
                <th className="p-2 text-center border w-32 bg-slate-100">Aksi Cepat</th>
                {days.map(day => {
                  const activeCount = SESSIONS.filter(s => !isHoliday(day.label, s)).length;
                  if (activeCount === 0) return null;
                  return (
                    <th key={day.dateStr} colSpan={activeCount} className="border text-center py-2 px-1">
                      <div className="font-bold text-slate-800">{day.label}</div>
                      <div className="text-xs text-slate-500 font-normal">{day.shortDate}</div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="border"></th>
                <th className="border"></th>
                {days.map(day => {
                  const activeCount = SESSIONS.filter(s => !isHoliday(day.label, s)).length;
                  if (activeCount === 0) return null;
                  return (
                    <React.Fragment key={day.dateStr + 'header'}>
                      {!isHoliday(day.label, 'shubuh') && <th className="border text-center text-xs text-slate-500 w-10 bg-slate-50">S</th>}
                      {!isHoliday(day.label, 'ashar') && <th className="border text-center text-xs text-slate-500 w-10 bg-slate-50">A</th>}
                      {!isHoliday(day.label, 'maghrib') && <th className="border text-center text-xs text-slate-500 w-10 bg-slate-50">M</th>}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dataSantri.map((s, rowIdx) => {
                let currentCellIndex = 0; 
                return (
                  <tr key={s.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border font-medium truncate">
                      {s.nama_lengkap}
                    </td>
                    
                    <td className="p-1 border text-center">
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
                            className="w-6 h-6 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center border border-slate-200"
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
                              if (isOff) return null;

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
        </div>
      )}

      {/* MODAL EXPORT GLOBAL ALFA */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Export Rekap Alfa</h3>
                <button onClick={() => setShowExportModal(false)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Akan mengekspor <strong>seluruh santri</strong> di semua kelas yang memiliki catatan <strong>Alfa (A)</strong> di pekan terpilih.
              </p>
              
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Urutkan Berdasarkan:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setExportSortBy('asrama')}
                    className={`p-4 rounded-xl border-2 text-left transition-all group ${exportSortBy === 'asrama' ? 'border-green-600 bg-green-50' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className={`font-bold transition-colors ${exportSortBy === 'asrama' ? 'text-green-700' : 'text-slate-700'}`}>Asrama</div>
                    <div className="text-[10px] text-slate-500 mt-1">Asrama → Kamar → Nama</div>
                  </button>
                  <button 
                    onClick={() => setExportSortBy('kelas')}
                    className={`p-4 rounded-xl border-2 text-left transition-all group ${exportSortBy === 'kelas' ? 'border-green-600 bg-green-50' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className={`font-bold transition-colors ${exportSortBy === 'kelas' ? 'text-green-700' : 'text-slate-700'}`}>Kelas</div>
                    <div className="text-[10px] text-slate-500 mt-1">Kelas → Nama</div>
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setShowExportModal(false)
                  setTimeout(handleExportGlobalA, 100)
                }}
                className="w-full mt-8 bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 shadow-xl transition-all active:scale-[0.98]"
              >
                Download Excel (Rekap Global)
              </button>
            </div>
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
  key?: React.Key,
  id: string,
  value: string, 
  isHoliday: boolean,
  onChange: (v: string) => void,
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  let bgColor = ''
  if (isHoliday) bgColor = 'bg-slate-200 text-slate-400 cursor-not-allowed'
  else if (value === 'S') bgColor = 'bg-yellow-100 text-yellow-800'
  else if (value === 'I') bgColor = 'bg-blue-100 text-blue-800'
  else if (value === 'A') bgColor = 'bg-red-100 text-red-800 font-bold'

  return (
    <td className={`border p-0 h-8 ${isHoliday ? 'bg-slate-200' : ''}`}>
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