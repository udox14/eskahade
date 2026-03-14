'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { getMarhalahList, getRekapKinerjaGuru } from './actions'
import { useReactToPrint } from 'react-to-print'
import { Filter, Search, Loader2, Briefcase, ArrowLeft, Printer, Palette, Circle } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import Link from 'next/link'

const SESI_OPTIONS = [
  { value: 'semua',          label: 'Semua Sesi' },
  { value: 'shubuh',         label: 'Shubuh Saja' },
  { value: 'ashar',          label: 'Ashar Saja' },
  { value: 'maghrib',        label: 'Maghrib Saja' },
  { value: 'shubuh_maghrib', label: 'Shubuh & Maghrib' },
  { value: 'shubuh_ashar',   label: 'Shubuh & Ashar' },
  { value: 'ashar_maghrib',  label: 'Ashar & Maghrib' },
  { value: 'lengkap',        label: 'Ketiga Sesi' },
]

const SORT_OPTIONS = [
  { value: 'nama',     label: 'Nama Guru' },
  { value: 'kelas',    label: 'Kelas / Marhalah' },
  { value: 'performa', label: 'Performa (Terendah)' },
  { value: 'hadir',    label: 'Hadir (Terbanyak)' },
  { value: 'badal',    label: 'Badal (Terbanyak)' },
  { value: 'kosong',   label: 'Alfa/Kosong (Terbanyak)' },
]

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function getColorPerforma(p: number) {
  if (p >= 90) return '#16a34a'
  if (p >= 75) return '#2563eb'
  if (p >= 50) return '#ea580c'
  return '#dc2626'
}

export default function RekapAbsensiGuruPage() {
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [marhalahList, setMarhalahList]     = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [badalAsHadir, setBadalAsHadir]     = useState(true)
  const [sortBy, setSortBy]                 = useState('performa')
  const [filterSesi, setFilterSesi]         = useState('semua')
  const [printMode, setPrintMode]           = useState<'colorful' | 'bw'>('colorful')

  const [data, setData]           = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Rekap Absen Guru ${startDate} sd ${endDate}`,
  })

  useEffect(() => {
    const now = new Date()
    setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    getMarhalahList().then(setMarhalahList)
  }, [])

  const handleCari = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getRekapKinerjaGuru(startDate, endDate, selectedMarhalah, badalAsHadir)
    setData(res || [])
    setLoading(false)
  }

  const setRange = (type: 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date()
    if (type === 'THIS_MONTH') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'))
      setEndDate(format(now, 'yyyy-MM-dd'))
    }
  }

  const hasSesi = (row: any, sesi: string) => {
    if (sesi === 'semua') return true
    const kelas = row.kelas_ajar as string
    const hasS = kelas.includes('(Shubuh)')
    const hasA = kelas.includes('(Ashar)')
    const hasM = kelas.includes('(Maghrib)')
    if (sesi === 'shubuh')         return hasS && !hasA && !hasM
    if (sesi === 'ashar')          return !hasS && hasA && !hasM
    if (sesi === 'maghrib')        return !hasS && !hasA && hasM
    if (sesi === 'shubuh_maghrib') return hasS && !hasA && hasM
    if (sesi === 'shubuh_ashar')   return hasS && hasA && !hasM
    if (sesi === 'ashar_maghrib')  return !hasS && hasA && hasM
    if (sesi === 'lengkap')        return hasS && hasA && hasM
    return true
  }

  const processedData = useMemo(() => {
    let filtered = data.filter(row => hasSesi(row, filterSesi))
    return [...filtered].sort((a, b) => {
      if (sortBy === 'nama')     return naturalSort(a.nama, b.nama)
      if (sortBy === 'kelas')    return naturalSort(a.kelas_ajar, b.kelas_ajar)
      if (sortBy === 'performa') return a.persentase - b.persentase
      if (sortBy === 'hadir')    return b.hadir - a.hadir
      if (sortBy === 'badal')    return b.badal - a.badal
      if (sortBy === 'kosong')   return b.kosong - a.kosong
      return 0
    })
  }, [data, sortBy, filterSesi])

  const fmtDate = (d: string) => {
    if (!d) return ''
    try { return format(new Date(d), 'd MMMM yyyy', { locale: localeId }) }
    catch { return d }
  }

  const namaMarhalah = selectedMarhalah
    ? marhalahList.find(m => String(m.id) === String(selectedMarhalah))?.nama || ''
    : 'Semua Tingkat'

  // ── Style helper untuk mode print ──
  const isBW = printMode === 'bw'

  const S = {
    headerBg:     isBW ? '#000000' : '#1e1b4b',
    headerBorder: isBW ? '#000000' : '#312e81',
    hadirBg:      isBW ? '#ffffff' : '#f0fdf4',
    hadirColor:   isBW ? '#000000' : '#16a34a',
    hadirPctColor:isBW ? '#000000' : '#86efac',
    badalBg:      isBW ? '#ffffff' : '#fffbeb',
    badalColor:   isBW ? '#000000' : '#d97706',
    badalPctColor:isBW ? '#000000' : '#fcd34d',
    kosongBg:     isBW ? '#ffffff' : '#fef2f2',
    kosongColor:  isBW ? '#000000' : '#dc2626',
    kosongPctColor:isBW? '#000000' : '#fca5a5',
    stripeBg:     isBW ? '#ffffff' : '#f8f7ff',
    titleColor:   isBW ? '#000000' : '#1e1b4b',
    subColor:     isBW ? '#000000' : '#374151',
    metaColor:    isBW ? '#000000' : '#6b7280',
    borderColor:  isBW ? '#000000' : '#e5e7eb',
    perfColor:    (p: number) => isBW ? '#000000' : getColorPerforma(p),
    perfBarBg:    isBW ? '#000000' : '',
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/akademik/absensi-guru" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600"/>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-indigo-600"/> Rekap Kinerja Guru
            </h1>
            <p className="text-gray-500 text-sm">Evaluasi kehadiran pengajar berdasarkan jadwal kelas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRange('THIS_WEEK')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100">7 Hari Terakhir</button>
          <button onClick={() => setRange('THIS_MONTH')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100">Bulan Ini</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Dari</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Sampai</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filter Tingkat</label>
            <select value={selectedMarhalah} onChange={e=>setSelectedMarhalah(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white">
              <option value="">Semua Tingkat</option>
              {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleCari} disabled={loading} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 h-[38px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              Tampilkan Rekap
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
          <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><Filter className="w-4 h-4"/> Opsi Perhitungan:</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="badalOpt" checked={badalAsHadir === true} onChange={() => setBadalAsHadir(true)} className="accent-indigo-600 w-4 h-4"/>
              <span className="text-sm text-gray-600">Badal = <b className="text-green-600">Terisi (Hadir)</b></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="badalOpt" checked={badalAsHadir === false} onChange={() => setBadalAsHadir(false)} className="accent-red-600 w-4 h-4"/>
              <span className="text-sm text-gray-600">Badal = <b className="text-red-600">Kosong (Alfa)</b></span>
            </label>
          </div>
        </div>
      </div>

      {/* KONTROL SORT, FILTER SESI & TOMBOL PRINT */}
      {hasSearched && !loading && data.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Urutkan:</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Sesi:</span>
              <select value={filterSesi} onChange={e=>setFilterSesi(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500">
                {SESI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-400">{processedData.length} guru</span>
          </div>

          {/* TOMBOL PRINT + TOGGLE MODE */}
          <div className="flex items-center gap-2">
            {/* Toggle Colorful / BW */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setPrintMode('colorful')}
                title="Cetak Berwarna"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'colorful' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Palette className="w-3.5 h-3.5"/> Berwarna
              </button>
              <button
                onClick={() => setPrintMode('bw')}
                title="Cetak Hitam Putih"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'bw' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Circle className="w-3.5 h-3.5"/> Hitam Putih
              </button>
            </div>
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition-colors text-sm"
            >
              <Printer className="w-4 h-4"/> Cetak
            </button>
          </div>
        </div>
      )}

      {/* TABEL HASIL (LAYAR) */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full py-32 text-gray-400">
            <Search className="w-16 h-16 mb-4 text-gray-200"/>
            <p>Silakan atur filter dan klik <b>Tampilkan Rekap</b>.</p>
          </div>
        ) : loading ? (
          <div className="py-32 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
        ) : processedData.length === 0 ? (
          <div className="py-32 text-center text-gray-400">Tidak ada data untuk filter yang dipilih.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-indigo-900 text-white font-bold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">No</th>
                  <th className="px-4 py-3">Nama Guru</th>
                  <th className="px-4 py-3">Jadwal</th>
                  <th className="px-4 py-3 text-center">Hari Wajib</th>
                  <th className="px-4 py-3 text-center bg-green-700/50">Hadir</th>
                  <th className="px-4 py-3 text-center bg-yellow-600/50">Badal</th>
                  <th className="px-4 py-3 text-center bg-red-700/50">Kosong</th>
                  <th className="px-4 py-3 text-right rounded-tr-xl w-40">Performa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx+1}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{row.nama}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 max-w-xs">{row.kelas_ajar}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">{row.total_wajib}</td>
                    <td className="px-4 py-3 text-center bg-green-50/30">
                      <p className="font-bold text-green-600">{row.hadir}</p>
                      <p className="text-[10px] text-green-400">{row.pct_hadir}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-yellow-50/30">
                      <p className="font-bold text-yellow-600">{row.badal}</p>
                      <p className="text-[10px] text-yellow-400">{row.pct_badal}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-red-50/30">
                      <p className="font-bold text-red-600">{row.kosong}</p>
                      <p className="text-[10px] text-red-400">{row.pct_kosong}%</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-extrabold" style={{color: getColorPerforma(row.persentase)}}>
                          {row.persentase}%
                        </span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${row.persentase}%`, backgroundColor: getColorPerforma(row.persentase)}}/>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════ AREA PRINT ═══════════════ */}
      <div className="hidden">
        <div ref={printRef}>
          <style>{`
            @page { size: F4 portrait; margin: 10mm 8mm 10mm 8mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}</style>

          <div style={{fontFamily:'Arial, sans-serif', fontSize:'11px', color:'#000'}}>

            {/* JUDUL */}
            <div style={{textAlign:'center', marginBottom:'10px', borderBottom: isBW ? '2px solid #000' : '2px solid #1e1b4b', paddingBottom:'8px'}}>
              <div style={{fontSize:'15px', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', color: S.titleColor}}>
                REKAP ABSEN GURU
              </div>
              <div style={{fontSize:'11px', marginTop:'3px', color: S.subColor}}>
                {fmtDate(startDate)} &mdash; {fmtDate(endDate)}
              </div>
              <div style={{fontSize:'10px', marginTop:'2px', color: S.metaColor}}>
                Tingkat: {namaMarhalah} &nbsp;|&nbsp;
                Sesi: {SESI_OPTIONS.find(o=>o.value===filterSesi)?.label} &nbsp;|&nbsp;
                Badal: {badalAsHadir ? 'Hadir' : 'Kosong'} &nbsp;|&nbsp;
                Urut: {SORT_OPTIONS.find(o=>o.value===sortBy)?.label}
              </div>
            </div>

            {/* TABEL */}
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'10px'}}>
              <thead>
                <tr style={{backgroundColor: S.headerBg, color:'#ffffff'}}>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'24px', border:`1px solid ${S.headerBorder}`}}>No</th>
                  <th style={{padding:'5px 6px', textAlign:'left', width:'130px', border:`1px solid ${S.headerBorder}`}}>Nama Guru</th>
                  <th style={{padding:'5px 6px', textAlign:'left', border:`1px solid ${S.headerBorder}`}}>Jadwal</th>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'40px', border:`1px solid ${S.headerBorder}`}}>Wajib</th>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'52px', border:`1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#14532d'}}>Hadir</th>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'52px', border:`1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#78350f'}}>Badal</th>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'52px', border:`1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#7f1d1d'}}>Kosong</th>
                  <th style={{padding:'5px 4px', textAlign:'center', width:'55px', border:`1px solid ${S.headerBorder}`}}>Performa</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((row, idx) => (
                  <tr key={row.id} style={{backgroundColor: idx % 2 === 0 ? '#ffffff' : S.stripeBg}}>
                    <td style={{padding:'4px', textAlign:'center', border:`1px solid ${S.borderColor}`, color: isBW ? '#000' : '#9ca3af'}}>{idx+1}</td>
                    <td style={{padding:'4px 6px', fontWeight:'bold', border:`1px solid ${S.borderColor}`}}>{row.nama}</td>
                    <td style={{padding:'4px 6px', color: S.metaColor, fontSize:'9px', border:`1px solid ${S.borderColor}`}}>{row.kelas_ajar}</td>
                    <td style={{padding:'4px', textAlign:'center', fontWeight:'bold', border:`1px solid ${S.borderColor}`}}>{row.total_wajib}</td>

                    {/* HADIR */}
                    <td style={{padding:'4px', textAlign:'center', border:`1px solid ${S.borderColor}`, backgroundColor: S.hadirBg}}>
                      <div style={{fontWeight:'bold', color: S.hadirColor}}>{row.hadir}</div>
                      <div style={{fontSize:'8px', color: S.hadirPctColor}}>{row.pct_hadir}%</div>
                    </td>
                    {/* BADAL */}
                    <td style={{padding:'4px', textAlign:'center', border:`1px solid ${S.borderColor}`, backgroundColor: S.badalBg}}>
                      <div style={{fontWeight:'bold', color: S.badalColor}}>{row.badal}</div>
                      <div style={{fontSize:'8px', color: S.badalPctColor}}>{row.pct_badal}%</div>
                    </td>
                    {/* KOSONG */}
                    <td style={{padding:'4px', textAlign:'center', border:`1px solid ${S.borderColor}`, backgroundColor: S.kosongBg}}>
                      <div style={{fontWeight:'bold', color: S.kosongColor}}>{row.kosong}</div>
                      <div style={{fontSize:'8px', color: S.kosongPctColor}}>{row.pct_kosong}%</div>
                    </td>
                    {/* PERFORMA */}
                    <td style={{padding:'4px', textAlign:'center', border:`1px solid ${S.borderColor}`}}>
                      <div style={{fontWeight:'bold', fontSize:'12px', color: S.perfColor(row.persentase)}}>
                        {row.persentase}%
                      </div>
                      <div style={{height:'3px', backgroundColor: isBW ? '#000' : '#e5e7eb', borderRadius:'2px', overflow:'hidden', margin:'2px auto', width:'40px'}}>
                        <div style={{height:'100%', width:`${row.persentase}%`, backgroundColor: S.perfColor(row.persentase), borderRadius:'2px'}}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* FOOTER */}
            <div style={{marginTop:'10px', fontSize:'9px', color: S.metaColor, display:'flex', justifyContent:'space-between', borderTop:`1px solid ${S.borderColor}`, paddingTop:'6px'}}>
              <span>Total: {processedData.length} guru</span>
              <span>Dicetak: {format(new Date(), 'd MMMM yyyy HH:mm', {locale: localeId})}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}