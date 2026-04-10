'use client'

import React, { useState } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, ArrowRightLeft, Loader2, BookOpen, Bed, X, User, Search, MapPin, GraduationCap, School, ChevronDown, Activity, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
type SantriKamar = { id: string; nama_lengkap: string; nis: string; kelas_pesantren: string | null; sekolah: string | null; kelas_sekolah: string | null }

const MARHALAH_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#82b1ff', '#b0bec5', '#78909c']
const JENJANG_COLORS = { SLTP: '#3b82f6', SLTA: '#10b981', KULIAH: '#f59e0b', TIDAK_SEKOLAH: '#94a3b8', LAINNYA: '#cbd5e1' }

// --- CUSTOM SVG CHARTS (STYLIZED) ---
function PieChart({ slices, size = 160, donut = true }: {
  slices: { label: string; value: number; color: string }[]
  size?: number
  donut?: boolean
}) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (!total) return null
  const r = size / 2, cx = r, cy = r, ir = donut ? r * 0.6 : 0
  let angle = -Math.PI / 2
  const paths = slices.filter(d => d.value > 0).map(d => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    const ix1 = cx + ir * Math.cos(angle - sweep), iy1 = cy + ir * Math.sin(angle - sweep)
    const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
    const lg = sweep > Math.PI ? 1 : 0
    const path = donut
      ? `M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${lg} 0 ${ix1},${iy1} Z`
      : `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} Z`
    return { ...d, path, pct: Math.round(d.value / total * 100) }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 transition-transform duration-500 hover:scale-105">
      {paths.map((s, i) => (
        <path 
          key={i} 
          d={s.path} 
          fill={s.color} 
          className="stroke-background hover:opacity-80 transition-opacity" 
          strokeWidth="2"
        >
          <title>{s.label}: {s.value} ({s.pct}%)</title>
        </path>
      ))}
    </svg>
  )
}

function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0
  return (
    <div className="flex items-center gap-3 group text-xs">
      <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm border border-white/20" style={{ backgroundColor: color }} />
      <span className="flex-1 text-muted-foreground font-bold uppercase tracking-widest text-[10px] truncate">{label}</span>
      <span className="font-black text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground/50 font-bold w-9 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

function HBarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-muted-foreground truncate max-w-[150px]">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000" 
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  )
}

// --- MAIN PAGE ---

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [modalKamar, setModalKamar] = useState<{ asrama: string; kamar: string; list: SantriKamar[] } | null>(null)
  const [fetchedAsrama, setFetchedAsrama] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setData(await getSensusData(asrama))
    setFetchedAsrama(asrama)
    setLoading(false)
  }

  const isDirty = asrama !== fetchedAsrama

  // Computed values
  const total = data?.total ?? 0
  const asramaKeys = data ? Object.keys(data?.distribusi_kamar || {}).sort() : []
  
  const jenjangSlices = data ? [
    { label: 'SLTP',          value: data.jenjang.SLTP,         color: JENJANG_COLORS.SLTP },
    { label: 'SLTA',          value: data.jenjang.SLTA,         color: JENJANG_COLORS.SLTA },
    { label: 'Kuliah',        value: data.jenjang.KULIAH,       color: JENJANG_COLORS.KULIAH },
    { label: 'Tidak Sekolah', value: data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA, color: JENJANG_COLORS.TIDAK_SEKOLAH },
  ] : []

  const sekolahBar = data ? Object.entries(data.jenjang.detail as Record<string,number>)
    .sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 8) : []
  const sekolahMax = (sekolahBar[0]?.[1] as number) || 1

  const kelasBar = data ? Object.entries(data.kelas_sekolah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM SET')
    .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true })) : []

  const marhalahSlices = data ? Object.entries(data.marhalah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM MASUK KELAS')
    .sort(([,a],[,b]) => (b as number) - (a as number))
    .map(([label, value], i) => ({ label, value: value as number, color: MARHALAH_COLORS[i % MARHALAH_COLORS.length] })) : []
  const marhalahTotal = marhalahSlices.reduce((s, d) => s + d.value, 0)

  const laki = data?.jenis_kelamin?.L || 0
  const perempuan = data?.jenis_kelamin?.P || 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 shadow-sm border border-blue-500/10">
            <Activity className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Sensus Penduduk</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Demografi & Distribusi Kamar Santri</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
             <Home className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10"/>
             <Select value={asrama} onValueChange={(v) => setAsrama(v ?? '')}>
                <SelectTrigger className="h-11 pl-10 bg-muted/20 border-border rounded-xl font-bold focus:ring-blue-500">
                  <SelectValue placeholder="Asrama"/>
                </SelectTrigger>
                <SelectContent>
                  {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a === 'SEMUA' ? 'Seluruh Pesantren' : `Asrama ${a}`}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>
          <Button
            onClick={loadData}
            disabled={loading}
            className={cn(
               "h-11 px-6 font-black rounded-xl shadow-lg transition-all active:scale-95 gap-2",
               isDirty || !data ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            {data ? (isDirty ? 'Update' : 'Refresh') : 'Hitung'}
          </Button>
        </div>
      </div>

      {!data && !loading ? (
        /* EMPTY STATE */
        <Card className="py-24 border-dashed border-2 flex flex-col items-center justify-center text-center bg-muted/10">
          <div className="w-20 h-20 rounded-full bg-blue-500/5 flex items-center justify-center mb-6 border border-blue-500/10">
            <BarChart3 className="w-10 h-10 text-blue-600/30"/>
          </div>
          <div className="max-w-xs px-6">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Belum Ada Perhitungan</h3>
            <p className="text-sm font-bold text-muted-foreground mt-2 opacity-70 uppercase tracking-widest text-[10px]">Pilih asrama dan klik HITUNG untuk melihat laporan statistik santri.</p>
          </div>
        </Card>
      ) : loading ? (
        /* LOADING */
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500"/>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Scanning database santri...</p>
        </div>
      ) : (
        /* CONTENT */
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* TOP STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-blue-600 text-white shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
              <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                <Users className="w-6 h-6 opacity-40"/>
                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Santri</p>
                  <h2 className="text-4xl font-black tabular-nums">{total}</h2>
                  <p className="text-[9px] font-bold uppercase opacity-40 mt-1 tracking-tighter">JIWA TERDATA DI {asrama}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm flex items-center p-6 gap-6 group">
               <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <User className="w-7 h-7 text-blue-600"/>
               </div>
               <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Laki-laki</p>
                  <h3 className="text-2xl font-black text-foreground">{laki}</h3>
                  <Badge variant="outline" className="text-[9px] font-black bg-blue-50 text-blue-600 border-blue-200 mt-1">{total > 0 ? Math.round(laki/total*100) : 0}%</Badge>
               </div>
            </Card>

            <Card className="border-border shadow-sm flex items-center p-6 gap-6 group">
               <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                  <User className="w-7 h-7 text-pink-500"/>
               </div>
               <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Perempuan</p>
                  <h3 className="text-2xl font-black text-foreground">{perempuan}</h3>
                  <Badge variant="outline" className="text-[9px] font-black bg-pink-50 text-pink-500 border-pink-200 mt-1">{total > 0 ? Math.round(perempuan/total*100) : 0}%</Badge>
               </div>
            </Card>

            <Card className="border-border shadow-sm p-6 flex flex-col justify-center gap-3">
               <div className="flex justify-between items-center text-center">
                  <div className="flex-1">
                     <p className="text-[9px] font-black text-muted-foreground uppercase">Masuk</p>
                     <p className="text-xl font-black text-emerald-600">+{data.masuk_bulan_ini}</p>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground/30 mx-2"/>
                  <div className="flex-1">
                     <p className="text-[9px] font-black text-muted-foreground uppercase">Keluar</p>
                     <p className="text-xl font-black text-rose-500">-{data.keluar_bulan_ini}</p>
                  </div>
               </div>
               <p className="text-[9px] font-black text-center text-muted-foreground/40 uppercase tracking-widest border-t pt-2">MOBILITAS BULAN INI</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PENDIDIKAN SECTION */}
            <Card className="border-border shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/30 border-b pb-4">
                 <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-600"/> Pendidikan Formal
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8 flex-1">
                 <div className="flex flex-col sm:flex-row items-center gap-8">
                    <PieChart slices={jenjangSlices} size={150} />
                    <div className="flex-1 space-y-3 w-full">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b pb-1.5 mb-2">Sebaran Jenjang</p>
                       {jenjangSlices.filter(d => d.value > 0).map(d => (
                         <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={total}/>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-6 pt-4 border-t border-border/60">
                    <div>
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <School className="w-3.5 h-3.5"/> Top 8 Instansi Sekolah
                       </p>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                          {sekolahBar.map(([k, v]: any, i) => (
                            <HBarRow key={k} label={k} value={v} max={sekolahMax} color={MARHALAH_COLORS[i % MARHALAH_COLORS.length]}/>
                          ))}
                       </div>
                    </div>
                    
                    <div>
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Distribusi Kelas</p>
                       <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {kelasBar.map(([k, v]: any) => (
                            <div key={k} className="bg-muted/40 border border-border/50 rounded-xl p-2.5 text-center group hover:bg-muted transition-colors">
                              <p className="text-[8px] font-bold text-muted-foreground leading-none mb-1">Kls {k}</p>
                              <p className="text-base font-black text-foreground tabular-nums">{v}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </CardContent>
            </Card>

            {/* MARHALAH SECTION */}
            <Card className="border-border shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/30 border-b pb-4">
                 <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600"/> Marhalah Pesantren
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8 flex-1">
                 <div className="flex flex-col sm:flex-row items-center gap-10">
                    <PieChart slices={marhalahSlices} size={150} donut={false} />
                    <div className="flex-1 grid grid-cols-1 gap-3 w-full">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b pb-1.5 mb-1">Rincian Per-Marhalah</p>
                       {marhalahSlices.map(d => (
                         <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={marhalahTotal}/>
                       ))}
                    </div>
                 </div>
                 
                 <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 mt-auto">
                    <div className="flex items-start gap-4">
                       <div className="p-2.5 bg-background rounded-xl border border-emerald-500/20 shadow-sm text-emerald-600">
                          <Info className="w-5 h-5"/>
                       </div>
                       <div>
                          <p className="font-black text-xs text-emerald-800 uppercase tracking-tight">Status Penempatan</p>
                          <p className="text-[10px] font-bold text-emerald-600/70 mt-0.5">
                             {data.marhalah['BELUM MASUK KELAS'] || 0} santri saat ini belum terdaftar di kelas diniyah aktif.
                          </p>
                       </div>
                    </div>
                 </div>
              </CardContent>
            </Card>

          </div>

          {/* KAMAR SECTION */}
          <Card className="border-border shadow-sm overflow-hidden">
             <CardHeader className="bg-muted/30 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                   <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Bed className="w-4 h-4 text-blue-600"/> Kepadatan Hunian
                   </CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status jumlah santri per kamar</CardDescription>
                </div>
                <div className="flex items-center gap-3 bg-background px-3 py-1.5 rounded-full border border-border shadow-sm text-[8px] font-black uppercase tracking-widest">
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"/> Over (≥10)</div>
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"/> Crowded (7-9)</div>
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"/> Normal (&lt;7)</div>
                </div>
             </CardHeader>
             <CardContent className="p-6 space-y-10">
                {asramaKeys.map(nama => {
                  const kamarData = data.distribusi_kamar[nama]
                  const santriData = data.santri_kamar?.[nama] || {}
                  const kamars = Object.keys(kamarData).sort((a,b) => (parseInt(a)||0) - (parseInt(b)||0))
                  const tot = kamars.reduce((s,k) => s + kamarData[k], 0)
                  return (
                    <div key={nama} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground group">
                          <MapPin className="w-3.5 h-3.5 text-blue-500/50 group-hover:text-blue-500 transition-colors"/>
                          <span>Asrama {nama}</span>
                        </div>
                        <Badge variant="secondary" className="bg-muted text-[10px] font-black uppercase px-2 py-0.5 rounded-md border-0">{kamars.length} Kamar · {tot} Jiwa</Badge>
                      </div>
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
                        {kamars.map(kamar => {
                          const n = kamarData[kamar]
                          const status = n >= 10 ? 'over' : n >= 7 ? 'crowded' : 'normal'
                          const style = {
                            over: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/80',
                            crowded: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/80',
                            normal: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/80'
                          }[status]
                          const iconCol = {
                            over: 'bg-rose-600/10 border-rose-600/10 text-rose-600',
                            crowded: 'bg-amber-600/10 border-amber-600/10 text-amber-600',
                            normal: 'bg-blue-600/10 border-blue-600/10 text-blue-600'
                          }[status]

                          return (
                            <button 
                               key={kamar} 
                               onClick={() => setModalKamar({ asrama: nama, kamar, list: santriData[kamar] || [] })}
                               className={cn(
                                 style, 
                                 "border rounded-2xl overflow-hidden text-left transition-all active:scale-95 group relative h-[72px] flex flex-col justify-between"
                               )}
                            >
                              <div className={cn("px-2.5 py-1.5 flex justify-between items-center", iconCol, "border-b border-inherit shadow-sm")}>
                                <span className="text-[10px] font-black leading-none uppercase tracking-tighter">Kamar {kamar}</span>
                              </div>
                              <div className="px-3 py-2 flex items-baseline gap-1">
                                <span className="text-2xl font-black leading-none tabular-nums tracking-tighter">{n}</span>
                                <span className="text-[10px] font-bold opacity-40 leading-none">JIWA</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
             </CardContent>
          </Card>
        </div>
      )}

      {/* DIALOG SANTRI */}
      <Dialog open={!!modalKamar} onOpenChange={(open) => !open && setModalKamar(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] p-0 overflow-hidden border-0 shadow-2xl rounded-3xl animate-in slide-in-from-bottom-10">
          <DialogHeader className="p-6 bg-muted/30 border-b">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
               <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20"><Users className="w-5 h-5"/></div>
               Kamar {modalKamar?.kamar} {modalKamar?.asrama}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Daftar santri yang terdaftar di kamar ini</DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh]">
            {!modalKamar?.list.length ? (
              <div className="py-20 text-center text-muted-foreground italic text-xs font-bold uppercase tracking-widest opacity-40">Kamar Kosong</div>
            ) : (
              <Table>
                <TableBody>
                  {modalKamar.list.sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap)).map((s, idx) => (
                    <TableRow key={s.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="w-10 text-center font-mono text-[10px] text-muted-foreground font-black opacity-30">{idx + 1}</TableCell>
                      <TableCell className="py-4">
                        <div className="font-black text-foreground text-sm tracking-tight">{s.nama_lengkap}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-black uppercase px-1.5 py-0 border-0",
                            s.kelas_pesantren ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground opacity-50"
                          )}>
                             {s.kelas_pesantren || 'No Marhalah'}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter">
                            {s.sekolah || 'Tidak sekolah'} {s.kelas_sekolah ? `· Kls ${s.kelas_sekolah}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                         <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center border font-black text-[9px] text-muted-foreground group-hover:bg-background">
                            GS
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          
          <div className="p-4 bg-muted/20 border-t flex justify-end">
             <Button onClick={() => setModalKamar(null)} variant="ghost" className="font-black text-xs uppercase rounded-xl tracking-widest px-6 h-10">Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}