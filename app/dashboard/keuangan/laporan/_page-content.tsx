'use client'

import React, { useState, useMemo } from 'react'
import { getLaporanKeuangan } from './actions'
import { FileText, Calendar, Download, Loader2, TrendingUp, Building2, HeartPulse, BookOpen, Trophy, AlertCircle, ChevronLeft, ChevronRight, Search, Coins, Target, ArrowUpRight, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function LaporanKeuanganPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetchedTahun, setFetchedTahun] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const loadData = async () => {
    setLoading(true)
    const res = await getLaporanKeuangan(tahun)
    setData(res)
    setFetchedTahun(tahun)
    setPage(1)
    setLoading(false)
  }

  const isDirty = tahun !== fetchedTahun

  const pagedData = useMemo(() => {
    if (!data?.list) return []
    return data.list.slice((page - 1) * limit, page * limit)
  }, [data, page, limit])

  const totalItems = data?.list?.length || 0
  const totalPages = Math.ceil(totalItems / limit) || 1

  const handleExport = async () => {
    if (!data || data.list.length === 0) return toast.warning('Data kosong')
    const XLSX = await import('xlsx')
    const rows = data.list.map((item: any, idx: number) => ({
      No: idx + 1,
      Tanggal: format(new Date(item.tanggal_bayar), 'dd/MM/yyyy HH:mm'),
      Santri: item.santri?.nama_lengkap,
      NIS: item.santri?.nis,
      Asrama: item.santri?.asrama,
      Jenis: item.jenis_biaya,
      Tahun_Tagihan: item.tahun_tagihan || '-',
      Nominal: item.nominal_bayar,
      Penerima: item.penerima?.full_name || 'Sistem',
      Keterangan: item.keterangan,
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:5},{wch:20},{wch:30},{wch:15},{wch:15},{wch:15},{wch:10},{wch:15},{wch:20},{wch:30}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Laporan ${tahun}`)
    XLSX.writeFile(workbook, `Laporan_Keuangan_${tahun}.xlsx`)
    toast.success('Laporan berhasil didownload')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
            <FileText className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Laporan Keuangan</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Rekapitulasi Arus Kas & Monitoring Tagihan</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/50 border p-1 rounded-2xl shadow-inner group">
            <Button variant="ghost" size="icon" onClick={() => setTahun(t => t - 1)} className="h-9 w-9 rounded-xl hover:bg-background">
              <ChevronLeft className="w-4 h-4"/>
            </Button>
            <div className="px-4 py-1.5 bg-background rounded-xl shadow-sm border border-border flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600"/>
              <span className="font-black text-emerald-600 tabular-nums">{tahun}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTahun(t => t + 1)} className="h-9 w-9 rounded-xl hover:bg-background">
              <ChevronRight className="w-4 h-4"/>
            </Button>
          </div>

          <Button
            onClick={loadData}
            disabled={loading}
            className={cn(
               "h-11 px-6 font-black rounded-xl shadow-lg transition-all active:scale-95 gap-2",
               isDirty || !data ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            {data ? (isDirty ? 'Perbarui Laporan' : 'Refresh Data') : `Tampilkan ${tahun}`}
          </Button>

          {data?.list?.length > 0 && (
            <Button
              onClick={handleExport}
              variant="outline"
              className="h-11 font-black rounded-xl border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 shadow-sm gap-2"
            >
              <Download className="w-4 h-4"/> Export Excel
            </Button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {!data && !loading ? (
        /* EMPTY STATE */
        <Card className="py-24 border-dashed border-2 flex flex-col items-center justify-center text-center bg-muted/10">
          <div className="w-20 h-20 rounded-full bg-emerald-500/5 flex items-center justify-center mb-6 border border-emerald-500/10">
            <TrendingUp className="w-10 h-10 text-emerald-600/30"/>
          </div>
          <div className="max-w-sm px-6">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Laporan Belum Dimuat</h3>
            <p className="text-sm font-bold text-muted-foreground mt-2 opacity-70 uppercase tracking-widest text-[10px]">Pilih tahun di atas kemudian klik tombol tampilkan untuk memuat mutasi kas.</p>
          </div>
        </Card>
      ) : loading ? (
        /* LOADING STATE */
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <div className="relative">
             <Loader2 className="w-12 h-12 animate-spin text-emerald-500"/>
             <Coins className="w-5 h-5 absolute inset-0 m-auto text-emerald-600"/>
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Menghitung Mutasi Kas {tahun}...</p>
        </div>
      ) : (
        /* RESULTS STATE */
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">

          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-4 border-emerald-500/20 shadow-xl overflow-hidden relative group">
               <div className="absolute top-0 right-0 w-[400px] h-full bg-emerald-500/[0.03] -skew-x-12 translate-x-32 group-hover:translate-x-16 transition-transform duration-1000"/>
               <CardContent className="p-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-b border-emerald-500/10 h-full">
                  <div className="flex-1 p-8 space-y-2 bg-emerald-500/5 group">
                     <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Kas Masuk (Net)</p>
                        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 border-emerald-500/20 font-black text-[9px] uppercase">{fetchedTahun}</Badge>
                     </div>
                     <div className="flex items-end gap-3">
                        <h2 className="text-4xl lg:text-5xl font-black text-emerald-700 tabular-nums">Rp {data.cashFlow.TOTAL.toLocaleString('id-ID')}</h2>
                        <div className="mb-2 p-1.5 bg-emerald-500 rounded-lg text-white shadow-lg shadow-emerald-500/30">
                           <ArrowUpRight className="w-5 h-5"/>
                        </div>
                     </div>
                  </div>
                  <div className="md:w-1/3 p-8 flex flex-col justify-center gap-1 bg-background relative z-10 transition-colors group-hover:bg-muted/30">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Transaksi</p>
                     <p className="text-3xl font-black text-foreground tabular-nums group-hover:scale-105 transition-transform origin-left">{totalItems}</p>
                     <p className="text-[10px] font-bold text-muted-foreground opacity-50 italic">Seluruh mutasi yang tercatat</p>
                  </div>
               </CardContent>
            </Card>

            <StatCard label="Uang Bangunan" icon={Building2} color="indigo" stats={data.targets.BANGUNAN} info="Akumulasi Sepanjang Masa"/>
            <StatCard label="Infaq Kesehatan" icon={HeartPulse} color="rose" stats={data.targets.KESEHATAN} info={`Tahun ${fetchedTahun}`}/>
            <StatCard label="Uang EHB" icon={BookOpen} color="blue" stats={data.targets.EHB} info={`Tahun ${fetchedTahun}`}/>
            <StatCard label="Ekstrakurikuler" icon={Trophy} color="amber" stats={data.targets.EKSKUL} info={`Tahun ${fetchedTahun}`} forceColor="amber"/>
          </div>

          {/* DETAILED TRANSACTION TABLE */}
          <Card className="border-border shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="p-6 bg-muted/40 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600"/> Rincian Kas Masuk
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Log transaksi penerimaan pembayaran santri</CardDescription>
              </div>
              <div className="flex items-center gap-4 bg-background px-4 py-2 rounded-2xl border shadow-sm self-stretch md:self-auto">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Rows:</span>
                  <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1) }}>
                    <SelectTrigger className="h-8 w-20 bg-muted/30 border-0 focus:ring-0 font-black text-xs">
                      <SelectValue placeholder="Limit"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10" className="font-bold">10</SelectItem>
                      <SelectItem value="20" className="font-bold">20</SelectItem>
                      <SelectItem value="50" className="font-bold">50</SelectItem>
                      <SelectItem value="100" className="font-bold">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border"/>
                <span className="text-[10px] font-black uppercase text-muted-foreground">Total: {totalItems}</span>
              </div>
            </CardHeader>

            <div className="overflow-x-auto min-h-[400px]">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border/60">
                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-widest">Tanggal / Sesi</TableHead>
                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-widest">Santri & NIS</TableHead>
                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-widest">Jenis Tagihan</TableHead>
                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-widest text-right">Nominal Bayar</TableHead>
                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-widest">Penerima (User)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                         <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/10"/>
                         <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Tidak ada rincian transaksi ditemukan</p>
                      </TableCell>
                    </TableRow>
                  ) : pagedData.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-emerald-500/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-muted flex flex-col items-center justify-center border group-hover:bg-background transition-colors">
                              <span className="text-[9px] font-black text-muted-foreground leading-none">{format(new Date(item.tanggal_bayar), 'MMM')}</span>
                              <span className="text-xs font-black text-foreground">{format(new Date(item.tanggal_bayar), 'dd')}</span>
                           </div>
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-foreground uppercase tracking-tight">{format(new Date(item.tanggal_bayar), 'yyyy')}</p>
                              <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase">{format(new Date(item.tanggal_bayar), 'HH:mm')}</p>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="font-black text-foreground text-sm tracking-tight">{item.santri?.nama_lengkap}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <Badge variant="outline" className="px-1.5 py-0 text-[9px] h-4 font-black uppercase border-muted-foreground/20 text-muted-foreground">{item.santri?.nis}</Badge>
                           <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase">{item.santri?.asrama}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={cn(
                           "font-black text-[9px] uppercase px-2 py-0.5 rounded-md shadow-none",
                           item.jenis_biaya === 'BANGUNAN' ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/10" : "bg-muted text-foreground border-border"
                        )}>
                          {item.jenis_biaya} {item.tahun_tagihan ? `(${item.tahun_tagihan})` : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <span className="font-black text-sm text-foreground tabular-nums opacity-80">Rp {item.nominal_bayar.toLocaleString('id-ID')}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border font-black text-[8px] uppercase">
                              {item.penerima?.full_name?.charAt(0) || 'S'}
                           </div>
                           <span className="text-[10px] font-black text-muted-foreground uppercase">{item.penerima?.full_name?.split(' ')[0] || 'Sistem'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination UI */}
            <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                  Laman {page} dari {totalPages}
               </div>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-9 px-4 rounded-xl font-black text-xs uppercase shadow-none bg-background active:scale-95 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1"/> Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="h-9 px-4 rounded-xl font-black text-xs uppercase shadow-none bg-background active:scale-95 transition-all"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1"/>
                  </Button>
               </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, icon: Icon, color, stats, info, forceColor }: any) {
  const percent = stats.target > 0 ? Math.round((stats.terima / stats.target) * 100) : 0
  
  const colorMap: Record<string, any> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', fill: 'bg-emerald-500', border: 'border-emerald-500/10', glow: 'shadow-emerald-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', fill: 'bg-indigo-500', border: 'border-indigo-500/10', glow: 'shadow-indigo-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-600', fill: 'bg-rose-500', border: 'border-rose-500/10', glow: 'shadow-rose-500/20' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', fill: 'bg-blue-500', border: 'border-blue-500/10', glow: 'shadow-blue-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', fill: 'bg-amber-500', border: 'border-amber-500/10', glow: 'shadow-amber-500/20' }
  }

  const c = colorMap[color] || colorMap.emerald

  return (
    <Card className="border-border shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-5">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{label}</p>
            <p className="text-[9px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter px-1">{info}</p>
          </div>
          <div className={cn('p-2.5 rounded-2xl border', c.bg, c.text, c.border, 'group-hover:scale-110 transition-transform')}>
            <Icon className="w-4 h-4"/>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="flex-1 space-y-2">
                <div className="flex justify-between items-end px-1">
                   <h4 className={cn('text-2xl font-black tabular-nums tracking-tighter', c.text)}>{percent}%</h4>
                   <span className="text-[9px] font-black text-muted-foreground tracking-widest uppercase opacity-40 leading-none mb-1">Terbayar</span>
                </div>
                <Progress value={percent} className={cn('h-2 rounded-full overflow-hidden bg-muted')} indicatorClassName={c.fill} />
             </div>
          </div>

          <div className="pt-4 border-t border-border/60 space-y-2">
             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                <span>Target</span>
                <span className="text-foreground">Rp {stats.target.toLocaleString('id-ID')}</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Piutang</span>
                <span className="text-rose-600">Rp {stats.kurang.toLocaleString('id-ID')}</span>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}