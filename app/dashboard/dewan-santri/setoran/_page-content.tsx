'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  TrendingUp, CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, Clock, UserCheck, UserX, ArrowLeftRight, Pencil, X, Check, Save, Info, Wallet, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  asrama: string
  total_santri: number
  bebas_spp: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  penunggak: number
  total_nominal: number
  persentase: number
  tanggal_setor: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
}

type SetoranFormState = {
  asrama: string
  jumlahAktual: string
  namaPenyetor: string
}

export default function MonitoringSetoranPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [nominal, setNominal] = useState(70000)
  const [data, setData] = useState<AsramaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [userAsrama, setUserAsrama] = useState<string | null>(null)
  const [setoranForm, setSetoranForm] = useState<SetoranFormState | null>(null)
  const [savingSetoran, setSavingSetoran] = useState(false)

  const tahunList = useMemo(() => Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i), [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [rows, settings] = await Promise.all([
        getMonitoringSetoran(tahun, bulan),
        getSppSettings(tahun),
      ])
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.asrama === userAsrama) : rows)
      setNominal(settings.nominal)
      setHasLoaded(true)
    } catch (e) {
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientRestriction().then(setUserAsrama)
  }, [])

  function prevBulan() {
    if (bulan === 1) { setBulan(12); setTahun(t => t - 1) }
    else setBulan(b => b - 1)
  }
  function nextBulan() {
    if (bulan === 12) { setBulan(1); setTahun(t => t + 1) }
    else setBulan(b => b + 1)
  }

  async function handleSimpanSetoran() {
    if (!setoranForm) return
    setSavingSetoran(true)
    const toastId = toast.loading("Menyimpan setoran...")
    try {
      const res = await simpanSetoran(
        setoranForm.asrama, tahun, bulan,
        Number(setoranForm.jumlahAktual.replace(/\D/g, '')),
        setoranForm.namaPenyetor
      )
      toast.dismiss(toastId)
      if (res && 'error' in res) { toast.error(res.error); return }
      toast.success('Setoran berhasil disimpan')
      setSetoranForm(null)
      loadData()
    } finally {
      setSavingSetoran(false)
    }
  }

  const totals = useMemo(() => {
    return {
      totalSantri: data.reduce((a, r) => a + r.total_santri, 0),
      totalBebasSpp: data.reduce((a, r) => a + r.bebas_spp, 0),
      totalWajib: data.reduce((a, r) => a + r.wajib_bayar, 0),
      totalBayar: data.reduce((a, r) => a + r.bayar_bulan_ini, 0),
      totalTunggak: data.reduce((a, r) => a + r.penunggak, 0),
      totalNominal: data.reduce((a, r) => a + r.total_nominal, 0),
    }
  }, [data])

  const pctKeseluruhan = totals.totalWajib > 0 ? Math.round((totals.totalBayar / totals.totalWajib) * 100) : 0

  function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
  function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <CalendarCheck className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Monitoring Setoran SPP</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Rekapitulasi Penerimaan & Setoran Asrama</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/50 border p-1 rounded-2xl shadow-inner group">
            <Button variant="ghost" size="icon" onClick={prevBulan} className="h-9 w-9 rounded-xl hover:bg-background">
              <ChevronLeft className="w-4 h-4"/>
            </Button>
            <div className="px-4 py-1.5 bg-background rounded-xl shadow-sm border border-border flex items-center gap-2 min-w-[140px] justify-center">
              <span className="font-black text-indigo-600 uppercase tracking-tight text-xs tabular-nums">
                {BULAN_NAMA[bulan]} {tahun}
              </span>
            </div>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={nextBulan} 
                disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1}
                className="h-9 w-9 rounded-xl hover:bg-background disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4"/>
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={String(bulan)} onValueChange={v => setBulan(Number(v))}>
                <SelectTrigger className="h-11 w-32 bg-muted/20 border-border rounded-xl font-bold focus:ring-indigo-500">
                    <SelectValue placeholder="Bulan"/>
                </SelectTrigger>
                <SelectContent>
                    {BULAN_NAMA.slice(1).map((b, i) => <SelectItem key={i+1} value={String(i+1)} className="font-bold">{b}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={String(tahun)} onValueChange={v => setTahun(Number(v))}>
                <SelectTrigger className="h-11 w-24 bg-muted/20 border-border rounded-xl font-bold focus:ring-indigo-500">
                    <SelectValue placeholder="Tahun"/>
                </SelectTrigger>
                <SelectContent>
                    {tahunList.map(t => <SelectItem key={t} value={String(t)} className="font-bold">{t}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>

          <Button
            onClick={loadData}
            disabled={loading}
            className={cn(
               "h-11 px-6 font-black rounded-xl shadow-lg transition-all active:scale-95 gap-2",
               !hasLoaded ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", loading ? "animate-spin" : "")}/>
            {loading ? 'Memuat...' : (hasLoaded ? 'Refresh' : 'Tampilkan')}
          </Button>
        </div>
      </div>

      {!hasLoaded && !loading && (
        <Card className="py-24 border-dashed border-2 flex flex-col items-center justify-center text-center bg-muted/10">
          <div className="w-20 h-20 rounded-full bg-indigo-500/5 flex items-center justify-center mb-6 border border-indigo-500/10">
            <TrendingUp className="w-10 h-10 text-indigo-600/30"/>
          </div>
          <div className="max-w-xs px-6">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Monitoring Belum Dimuat</h3>
            <p className="text-sm font-bold text-muted-foreground mt-2 opacity-70 uppercase tracking-widest text-[10px]">Pilih periode dan klik tampilkan untuk memuat rekap spp per asrama.</p>
          </div>
        </Card>
      )}

      {loading && (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500"/>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Menghitung rekapitulasi setoran...</p>
        </div>
      )}

      {hasLoaded && !loading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
           
          {/* QUICK SUMMARY (FOR WHOLE INSTITUTION) */}
          {!userAsrama && (
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCardSummary label="Wajib Bayar" value={fmt(totals.totalWajib)} icon={UserCheck} color="indigo" sub="Santri Terdaftar" />
                <StatCardSummary label="Sudah Bayar" value={fmt(totals.totalBayar)} icon={CheckCircle2} color="emerald" sub={`${pctKeseluruhan}% Kepatuhan`} />
                <StatCardSummary label="Penunggak" value={fmt(totals.totalTunggak)} icon={UserX} color="rose" sub="Belum Setor SPP" />
                <StatCardSummary label="Tarif Terberlaku" value={fmtRp(nominal)} icon={Banknote} color="amber" sub={`Unit Tahun ${tahun}`} />
             </div>
          )}

          {/* LIST BY ASRAMA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.length === 0 ? (
               <div className="lg:col-span-2 py-24 text-center">
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-50">Tidak ada data untuk periode ini</p>
               </div>
            ) : data.map(row => {
              const isEditing = setoranForm?.asrama === row.asrama
              return (
                <Card key={row.asrama} className="border-border shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
                  <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 border-b bg-muted/20">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-background rounded-xl border border-border shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                          <Building2 className="w-5 h-5"/>
                        </div>
                        <div>
                           <CardTitle className="text-base font-black uppercase tracking-tight leading-none">{row.asrama}</CardTitle>
                           <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">{fmt(row.total_santri)} Santri Terdata</CardDescription>
                        </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Kepatuhan</p>
                       <Badge className={cn(
                          "font-black text-xs px-2.5 py-0.5 rounded-lg shadow-none",
                          row.persentase >= 80 ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                          row.persentase >= 50 ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                          'bg-rose-500/10 text-rose-700 border-rose-500/20'
                       )}>
                         {row.persentase}%
                       </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="p-5 space-y-4">
                       <Progress 
                          value={row.persentase} 
                          className="h-2 bg-muted rounded-full overflow-hidden" 
                          indicatorClassName={cn(
                             row.persentase >= 80 ? 'bg-emerald-500' :
                             row.persentase >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          )}
                       />

                       <div className="grid grid-cols-3 gap-3">
                         <MiniStat label="Wajib Bayar" value={fmt(row.wajib_bayar)} color="indigo" />
                         <MiniStat label="Sudah Bayar" value={fmt(row.bayar_bulan_ini)} color="emerald" />
                         <MiniStat label="Tunggakan" value={fmt(row.penunggak)} color="rose" />
                         <MiniStat label="Bebas Tagihan" value={fmt(row.bebas_spp)} color="slate" />
                         <MiniStat label="Tung. Lalu" value={fmt(row.bayar_tunggakan_lalu)} color="orange" />
                         <MiniStat label="Nominal" value={fmtRp(row.total_nominal).replace('Rp ', 'Rp')} color="teal" isCurrency />
                       </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* STATUS SETORAN SECTION */}
                    <div className="p-5 bg-muted/10 flex-1">
                      {!isEditing ? (
                        <div className="flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl border border-border bg-background",
                                row.tanggal_setor ? "text-emerald-600" : "text-muted-foreground opacity-30"
                              )}>
                                 {row.tanggal_setor ? <CheckCircle2 className="w-5 h-5"/> : <Clock className="w-5 h-5"/>}
                              </div>
                              <div className="flex flex-col">
                                 {row.tanggal_setor ? (
                                    <>
                                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Status: Disetor</span>
                                       <span className="text-xs font-black text-foreground">
                                          {row.nama_penyetor} • {format(new Date(row.tanggal_setor), 'dd MMM yyyy', {locale: idLocale})}
                                       </span>
                                       {row.jumlah_aktual != null && (
                                         <span className="text-[9px] font-bold text-indigo-600 uppercase mt-0.5">Aktual: {fmtRp(row.jumlah_aktual)}</span>
                                       )}
                                    </>
                                 ) : (
                                    <>
                                       <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">Status</span>
                                       <span className="text-xs font-bold text-muted-foreground opacity-40 uppercase tracking-widest italic">Belum Disetor Ke Pusat</span>
                                    </>
                                 )}
                              </div>
                           </div>
                           <Button 
                              variant="ghost" 
                              onClick={() => setSetoranForm({
                                asrama: row.asrama,
                                jumlahAktual: row.jumlah_aktual != null ? String(row.jumlah_aktual) : String(row.total_nominal),
                                namaPenyetor: row.nama_penyetor ?? '',
                              })}
                              className="h-10 px-4 rounded-xl text-indigo-600 hover:bg-indigo-500/5 font-black text-[10px] uppercase gap-2 hover:text-indigo-700"
                           >
                              <Pencil className="w-3.5 h-3.5"/> {row.tanggal_setor ? 'Edit' : 'Setor'}
                           </Button>
                        </div>
                      ) : (
                        /* INLINE FORM */
                        <div className="space-y-3 animate-in fade-in duration-300">
                           <div className="flex gap-2">
                             <div className="flex-1 space-y-1">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nama Penyetor</span>
                                <Input 
                                  placeholder="Nama..." 
                                  value={setoranForm.namaPenyetor}
                                  onChange={e => setSetoranForm(f => f ? { ...f, namaPenyetor: e.target.value } : f)}
                                  className="h-9 text-xs font-bold rounded-lg border-border focus-visible:ring-indigo-500"
                                />
                             </div>
                             <div className="flex-1 space-y-1">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nominal (Rp)</span>
                                <Input 
                                  placeholder="0" 
                                  value={setoranForm.jumlahAktual}
                                  onChange={e => setSetoranForm(f => f ? { ...f, jumlahAktual: e.target.value } : f)}
                                  className="h-9 text-xs font-bold rounded-lg border-border focus-visible:ring-indigo-500 text-right"
                                />
                             </div>
                           </div>
                           <div className="flex gap-2 justify-end pt-1">
                              <Button variant="ghost" size="sm" onClick={() => setSetoranForm(null)} className="h-8 rounded-lg text-[10px] uppercase font-black tracking-widest">Batal</Button>
                              <Button 
                                onClick={handleSimpanSetoran} 
                                size="sm" 
                                disabled={savingSetoran}
                                className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-indigo-600/20"
                              >
                                {savingSetoran ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                                Simpan Setoran
                              </Button>
                           </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* TOTAL FOOTER (ONLY IF MULTIPLE DORM) */}
          {!userAsrama && data.length > 0 && (
            <Card className="bg-indigo-600 border-0 shadow-2xl shadow-indigo-600/20 text-white overflow-hidden relative group">
               <div className="absolute top-0 right-0 w-64 h-full bg-white/5 -skew-x-12 translate-x-32 group-hover:translate-x-16 transition-transform duration-1000"/>
               <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                  <div className="flex flex-wrap justify-center md:justify-start gap-10">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Terkumpul</p>
                        <p className="text-3xl font-black tabular-nums">{fmtRp(totals.totalNominal)}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Potensi Tagihan</p>
                        <p className="text-3xl font-black tabular-nums opacity-60">{fmtRp(totals.totalWajib * nominal)}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Selisih / Over</p>
                        <p className={cn(
                           "text-3xl font-black tabular-nums",
                           totals.totalNominal >= (totals.totalWajib * nominal) ? "text-emerald-300" : "text-rose-300"
                        )}>
                           {totals.totalNominal >= (totals.totalWajib * nominal) ? '+' : ''}{fmtRp(totals.totalNominal - (totals.totalWajib * nominal))}
                        </p>
                     </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/10 text-center min-w-[140px]">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Kepatuhan Total</p>
                     <p className="text-4xl font-black">{pctKeseluruhan}%</p>
                  </div>
               </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function StatCardSummary({ label, value, icon: Icon, color, sub }: any) {
    const variants: any = {
        indigo: "bg-indigo-500 text-indigo-500",
        emerald: "bg-emerald-500 text-emerald-500",
        rose: "bg-rose-500 text-rose-500",
        amber: "bg-amber-500 text-amber-500",
    }
    const c = variants[color] || variants.indigo

    return (
        <Card className="border-border shadow-sm group hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center gap-5">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-opacity-10 shadow-sm border border-opacity-20", c)}>
                    <Icon className="w-6 h-6"/>
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 leading-none mb-1">{label}</p>
                    <p className="text-2xl font-black text-foreground tabular-nums leading-none mb-1.5">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter opacity-40 italic">{sub}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function MiniStat({ label, value, color, isCurrency }: { label: string, value: string, color: string, isCurrency?: boolean }) {
  const colorMap: any = {
    indigo: "text-indigo-600 bg-indigo-500/5",
    emerald: "text-emerald-600 bg-emerald-500/5",
    rose: "text-rose-600 bg-rose-500/5",
    slate: "text-slate-600 bg-slate-500/5",
    orange: "text-orange-600 bg-orange-500/5",
    teal: "text-teal-600 bg-teal-500/5"
  }
  const c = colorMap[color] || colorMap.slate
  return (
    <div className={cn("p-2 rounded-xl border border-border/40 flex flex-col justify-between h-14 transition-all hover:bg-muted/10", c)}>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-60 truncate">{label}</span>
      <span className={cn("font-black tracking-tight tabular-nums", isCurrency ? "text-xs" : "text-base")}>{value}</span>
    </div>
  )
}