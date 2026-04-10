'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { getMarhalahList, getRekapKinerjaGuru } from './actions'
import { useReactToPrint } from 'react-to-print'
import { Filter, Search, Loader2, Briefcase, ArrowLeft, Printer, Palette, Circle } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

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

function naturalSort(a: string, b: string) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) }
function getColorPerforma(p: number) {
  if (p >= 90) return '#16a34a'; if (p >= 75) return '#2563eb'; if (p >= 50) return '#ea580c'; return '#dc2626'
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
    setLoading(true); setHasSearched(true)
    const res = await getRekapKinerjaGuru(startDate, endDate, selectedMarhalah, badalAsHadir)
    setData(res || []); setLoading(false)
  }

  const setRange = (type: 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date()
    if (type === 'THIS_MONTH') { setStartDate(format(startOfMonth(now), 'yyyy-MM-dd')); setEndDate(format(endOfMonth(now), 'yyyy-MM-dd')) }
    else { setStartDate(format(subDays(now, 7), 'yyyy-MM-dd')); setEndDate(format(now, 'yyyy-MM-dd')) }
  }

  const hasSesi = (row: any, sesi: string) => {
    if (sesi === 'semua') return true
    const k = row.kelas_ajar as string
    const hasS = k.includes('(Shubuh)'), hasA = k.includes('(Ashar)'), hasM = k.includes('(Maghrib)')
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
    const filtered = data.filter(row => hasSesi(row, filterSesi))
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

  const namaMarhalah = selectedMarhalah ? marhalahList.find(m => String(m.id) === String(selectedMarhalah))?.nama || '' : 'Semua Tingkat'
  const isBW = printMode === 'bw'

  const S = {
    headerBg: isBW ? '#000000' : '#1e1b4b', headerBorder: isBW ? '#000000' : '#312e81',
    hadirBg: isBW ? '#ffffff' : '#f0fdf4', hadirColor: isBW ? '#000000' : '#16a34a', hadirPctColor: isBW ? '#000000' : '#86efac',
    badalBg: isBW ? '#ffffff' : '#fffbeb', badalColor: isBW ? '#000000' : '#d97706', badalPctColor: isBW ? '#000000' : '#fcd34d',
    kosongBg: isBW ? '#ffffff' : '#fef2f2', kosongColor: isBW ? '#000000' : '#dc2626', kosongPctColor: isBW ? '#000000' : '#fca5a5',
    stripeBg: isBW ? '#ffffff' : '#f8f7ff', titleColor: isBW ? '#000000' : '#1e1b4b',
    subColor: isBW ? '#000000' : '#374151', metaColor: isBW ? '#000000' : '#6b7280',
    borderColor: isBW ? '#000000' : '#e5e7eb',
    perfColor: (p: number) => isBW ? '#000000' : getColorPerforma(p),
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/akademik/absensi-guru" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'rounded-xl')}>
            <ArrowLeft className="w-5 h-5"/>
          </Link>
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600"><Briefcase className="w-5 h-5"/></div>
              Rekap Kinerja Guru
            </h1>
            <p className="text-sm text-muted-foreground ml-[3.25rem]">Evaluasi kehadiran pengajar berdasarkan jadwal kelas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRange('THIS_WEEK')} className="text-xs font-black rounded-xl shadow-none">7 Hari Terakhir</Button>
          <Button variant="outline" size="sm" onClick={() => setRange('THIS_MONTH')} className="text-xs font-black rounded-xl shadow-none">Bulan Ini</Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Dari</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-muted/20 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-foreground"/>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Sampai</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-muted/20 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-foreground"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Filter Tingkat</label>
              <Select value={selectedMarhalah || '__ALL__'} onValueChange={(v) => setSelectedMarhalah(v === '__ALL__' || !v ? '' : v)}>
                <SelectTrigger className="h-10 shadow-none bg-muted/20 focus:ring-indigo-500 font-bold"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__" className="font-medium">Semua Tingkat</SelectItem>
                  {marhalahList.map(m => <SelectItem key={m.id} value={String(m.id)} className="font-medium">{m.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCari} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl h-10 gap-2 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                Tampilkan Rekap
              </Button>
            </div>
          </div>

          {/* Opsi Badal */}
          <div className="flex items-center gap-4 bg-muted/30 border border-border/60 p-3 rounded-xl">
            <span className="text-sm font-black text-foreground flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-600"/> Opsi Badal:</span>
            <div className="flex gap-4">
              {[
                { checked: badalAsHadir, label: <>Badal = <strong className="text-emerald-600">Terisi (Hadir)</strong></>, onChange: true },
                { checked: !badalAsHadir, label: <>Badal = <strong className="text-destructive">Kosong (Alfa)</strong></>, onChange: false },
              ].map((opt, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="badalOpt" checked={opt.checked} onChange={() => setBadalAsHadir(opt.onChange)}
                    className={cn('w-4 h-4', opt.onChange ? 'accent-indigo-600' : 'accent-red-600')}/>
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sort & Print Controls */}
      {hasSearched && !loading && data.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase">Urutkan:</span>
                <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
                  <SelectTrigger className="w-44 h-8 shadow-none bg-muted/20 focus:ring-indigo-500 font-bold text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>{SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="font-medium">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase">Sesi:</span>
                <Select value={filterSesi} onValueChange={(v) => v && setFilterSesi(v)}>
                  <SelectTrigger className="w-40 h-8 shadow-none bg-muted/20 focus:ring-indigo-500 font-bold text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>{SESI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="font-medium">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">{processedData.length} guru</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/50 border border-border rounded-xl p-1 gap-1">
                <button onClick={() => setPrintMode('colorful')}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all', printMode === 'colorful' ? 'bg-background shadow-sm text-indigo-600' : 'text-muted-foreground hover:text-foreground')}>
                  <Palette className="w-3.5 h-3.5"/> Berwarna
                </button>
                <button onClick={() => setPrintMode('bw')}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all', printMode === 'bw' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <Circle className="w-3.5 h-3.5"/> Hitam Putih
                </button>
              </div>
              <Button onClick={() => handlePrint()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl gap-2 shadow-sm">
                <Printer className="w-4 h-4"/> Cetak
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Table (Layar) */}
      <Card className="border-border shadow-sm overflow-hidden min-h-[360px]">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <Search className="w-16 h-16 mb-4 text-muted-foreground/10"/>
            <p className="text-muted-foreground font-medium">Atur filter dan klik <strong>Tampilkan Rekap</strong>.</p>
          </div>
        ) : loading ? (
          <div className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
        ) : processedData.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground font-medium">Tidak ada data untuk filter yang dipilih.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-indigo-900 text-white font-black uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Nama Guru</th>
                  <th className="px-4 py-3">Jadwal</th>
                  <th className="px-4 py-3 text-center">Wajib</th>
                  <th className="px-4 py-3 text-center bg-emerald-800/60">Hadir</th>
                  <th className="px-4 py-3 text-center bg-amber-700/60">Badal</th>
                  <th className="px-4 py-3 text-center bg-red-800/60">Kosong</th>
                  <th className="px-4 py-3 text-right w-40">Performa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {processedData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground/50 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-black text-foreground">{row.nama}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-xs">{row.kelas_ajar}</td>
                    <td className="px-4 py-3 text-center font-black text-foreground tabular-nums">{row.total_wajib}</td>
                    <td className="px-4 py-3 text-center bg-emerald-500/5">
                      <p className="font-black text-emerald-600 tabular-nums">{row.hadir}</p>
                      <p className="text-[10px] text-emerald-400 tabular-nums">{row.pct_hadir}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-amber-500/5">
                      <p className="font-black text-amber-600 tabular-nums">{row.badal}</p>
                      <p className="text-[10px] text-amber-400 tabular-nums">{row.pct_badal}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-red-500/5">
                      <p className="font-black text-destructive tabular-nums">{row.kosong}</p>
                      <p className="text-[10px] text-red-400 tabular-nums">{row.pct_kosong}%</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-black tabular-nums" style={{ color: getColorPerforma(row.persentase) }}>{row.persentase}%</span>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.persentase}%`, backgroundColor: getColorPerforma(row.persentase) }}/>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Print Area */}
      <div className="hidden">
        <div ref={printRef}>
          <style>{`@page { size: F4 portrait; margin: 10mm 8mm 10mm 8mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: `2px solid ${S.headerBg}`, paddingBottom: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: S.titleColor }}>REKAP ABSEN GURU</div>
              <div style={{ fontSize: '11px', marginTop: '3px', color: S.subColor }}>{fmtDate(startDate)} &mdash; {fmtDate(endDate)}</div>
              <div style={{ fontSize: '10px', marginTop: '2px', color: S.metaColor }}>
                Tingkat: {namaMarhalah} &nbsp;|&nbsp; Sesi: {SESI_OPTIONS.find(o => o.value === filterSesi)?.label} &nbsp;|&nbsp;
                Badal: {badalAsHadir ? 'Hadir' : 'Kosong'} &nbsp;|&nbsp; Urut: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: S.headerBg, color: '#ffffff' }}>
                  {[['No', '24px', 'center'], ['Nama Guru', '130px', 'left'], ['Jadwal', '', 'left'], ['Wajib', '40px', 'center']].map(([label, w, align]) => (
                    <th key={label} style={{ padding: '5px 4px', textAlign: align as any, ...(w ? { width: w } : {}), border: `1px solid ${S.headerBorder}` }}>{label}</th>
                  ))}
                  {[['Hadir', '#14532d'], ['Badal', '#78350f'], ['Kosong', '#7f1d1d']].map(([label, bg]) => (
                    <th key={label} style={{ padding: '5px 4px', textAlign: 'center', width: '52px', border: `1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : bg }}>{label}</th>
                  ))}
                  <th style={{ padding: '5px 4px', textAlign: 'center', width: '55px', border: `1px solid ${S.headerBorder}` }}>Performa</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((row, idx) => (
                  <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : S.stripeBg }}>
                    <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, color: isBW ? '#000' : '#9ca3af' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 'bold', border: `1px solid ${S.borderColor}` }}>{row.nama}</td>
                    <td style={{ padding: '4px 6px', color: S.metaColor, fontSize: '9px', border: `1px solid ${S.borderColor}` }}>{row.kelas_ajar}</td>
                    <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: `1px solid ${S.borderColor}` }}>{row.total_wajib}</td>
                    <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.hadirBg }}>
                      <div style={{ fontWeight: 'bold', color: S.hadirColor }}>{row.hadir}</div>
                      <div style={{ fontSize: '8px', color: S.hadirPctColor }}>{row.pct_hadir}%</div>
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.badalBg }}>
                      <div style={{ fontWeight: 'bold', color: S.badalColor }}>{row.badal}</div>
                      <div style={{ fontSize: '8px', color: S.badalPctColor }}>{row.pct_badal}%</div>
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.kosongBg }}>
                      <div style={{ fontWeight: 'bold', color: S.kosongColor }}>{row.kosong}</div>
                      <div style={{ fontSize: '8px', color: S.kosongPctColor }}>{row.pct_kosong}%</div>
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}` }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: S.perfColor(row.persentase) }}>{row.persentase}%</div>
                      <div style={{ height: '3px', backgroundColor: isBW ? '#000' : '#e5e7eb', borderRadius: '2px', overflow: 'hidden', margin: '2px auto', width: '40px' }}>
                        <div style={{ height: '100%', width: `${row.persentase}%`, backgroundColor: S.perfColor(row.persentase), borderRadius: '2px' }}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '10px', fontSize: '9px', color: S.metaColor, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${S.borderColor}`, paddingTop: '6px' }}>
              <span>Total: {processedData.length} guru</span>
              <span>Dicetak: {format(new Date(), 'd MMMM yyyy HH:mm', { locale: localeId })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}