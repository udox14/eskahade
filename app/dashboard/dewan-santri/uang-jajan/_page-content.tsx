'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getSummaryPerAsrama, getSantriUangJajan, getAsramaList,
  getKamarList, getDetailTransaksiSantri
} from './actions'
import {
  Wallet, Users, Search, Filter, LayoutGrid, List,
  ChevronLeft, ChevronRight, RefreshCw, Building2, Banknote,
  ArrowDownToLine, ArrowUpFromLine, AlertCircle, ChevronDown,
  ChevronUp, TrendingDown, TrendingUp, Minus, Info, ArrowUpRight, ArrowDownRight, MoreHorizontal, User, History, Loader2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

// ── Helpers ───────────────────────────────────────────────────────────────
const BULAN_NAMA = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember']

function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }
function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
function fmtDate(s: string | null) {
  if (!s) return '—'
  try { return new Date(s.replace(' ','T')).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) }
  catch { return '—' }
}
function fmtDateTime(s: string | null) {
  if (!s) return '—'
  try { return new Date(s.replace(' ','T')).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) }
  catch { return '—' }
}

type SummaryRow = {
  asrama: string; total_santri: number; total_saldo: number
  punya_saldo: number; tidak_punya_saldo: number
  masuk_bulan_ini: number; keluar_bulan_ini: number; santri_topup_bulan_ini: number
}
type SantriRow = {
  id: string; nama_lengkap: string; nis: string
  asrama: string; kamar: string; saldo: number
  masuk_bulan_ini: number; keluar_bulan_ini: number
  terakhir_masuk: string|null; terakhir_keluar: string|null
}
type DetailRow = {
  id: string; jenis: string; nominal: number
  keterangan: string|null; created_at: string; admin_nama: string|null
}
type FilterSaldo = 'SEMUA' | 'PUNYA' | 'KOSONG'
type ViewMode = 'table' | 'grid'

// ── Main Component ────────────────────────────────────────────────────────
export default function MonitoringUangJajanPage() {
  const now = new Date()

  // Filter bulan/tahun
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const tahunList = useMemo(() => Array.from({length:4},(_,i)=>now.getFullYear()-1+i), [])

  // Summary
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryLoaded, setSummaryLoaded] = useState(false)

  // Filter tabel
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [filterSaldo, setFilterSaldo] = useState<FilterSaldo>('SEMUA')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Tabel
  const [rows, setRows] = useState<SantriRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingTable, setLoadingTable] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // UI
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [activeCard, setActiveCard] = useState<string|null>(null)
  const [expandedRow, setExpandedRow] = useState<string|null>(null)

  useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  useEffect(() => {
    if (filterAsrama !== 'SEMUA') {
      getKamarList(filterAsrama).then(l => { setKamarList(l); setFilterKamar('SEMUA') })
    } else { setKamarList([]); setFilterKamar('SEMUA') }
  }, [filterAsrama])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try { setSummaryData(await getSummaryPerAsrama(tahun, bulan)); setSummaryLoaded(true) }
    finally { setLoadingSummary(false) }
  }, [tahun, bulan])

  const loadTable = useCallback(async (pg = 1) => {
    setLoadingTable(true)
    setExpandedRow(null)
    try {
      const res = await getSantriUangJajan({
        tahun, bulan,
        asrama: filterAsrama !== 'SEMUA' ? filterAsrama : undefined,
        kamar:  filterKamar  !== 'SEMUA' ? filterKamar  : undefined,
        search: search || undefined,
        page: pg, filterSaldo,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoadingTable(false) }
  }, [tahun, bulan, filterAsrama, filterKamar, search, filterSaldo])

  const handleTampilkan = () => { loadSummary(); loadTable(1) }

  const handleCardClick = (asrama: string) => {
    setActiveCard(asrama); setFilterAsrama(asrama)
    setFilterKamar('SEMUA'); setSearch(''); setSearchInput('')
    setFilterSaldo('SEMUA')
  }

  useEffect(() => {
    if (hasLoaded) loadTable(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAsrama, filterKamar, filterSaldo, search])

  const prevBulan = () => { if(bulan===1){setBulan(12);setTahun(t=>t-1)} else setBulan(b=>b-1) }
  const nextBulan = () => { if(bulan===12){setBulan(1);setTahun(t=>t+1)} else setBulan(b=>b+1) }

  const gt = useMemo(() => ({
    saldo:  summaryData.reduce((a,r)=>a+r.total_saldo,0),
    masuk:  summaryData.reduce((a,r)=>a+r.masuk_bulan_ini,0),
    keluar: summaryData.reduce((a,r)=>a+r.keluar_bulan_ini,0),
    punya:  summaryData.reduce((a,r)=>a+r.punya_saldo,0),
    total:  summaryData.reduce((a,r)=>a+r.total_santri,0),
  }), [summaryData])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
            <Wallet className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Monitoring Uang Jajan</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Manajemen Saldo & Mutasi Jajan Santri</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/50 border p-1 rounded-2xl shadow-inner group">
            <Button variant="ghost" size="icon" onClick={prevBulan} className="h-9 w-9 rounded-xl hover:bg-background">
              <ChevronLeft className="w-4 h-4"/>
            </Button>
            <div className="px-5 py-1.5 bg-background rounded-xl shadow-sm border border-border flex items-center gap-2 min-w-[140px] justify-center">
              <span className="font-black text-emerald-600 uppercase tracking-tight text-xs tabular-nums">
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
            <Select value={String(tahun)} onValueChange={v => setTahun(Number(v))}>
                <SelectTrigger className="h-11 w-24 bg-muted/20 border-border rounded-xl font-bold focus:ring-emerald-500">
                    <SelectValue placeholder="Tahun"/>
                </SelectTrigger>
                <SelectContent>
                    {tahunList.map(t => <SelectItem key={t} value={String(t)} className="font-bold">{t}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleTampilkan}
            disabled={loadingSummary || loadingTable}
            className={cn(
               "h-11 px-6 font-black rounded-xl shadow-lg transition-all active:scale-95 gap-2",
               !hasLoaded ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", (loadingSummary || loadingTable) ? "animate-spin" : "")}/>
            { (loadingSummary || loadingTable) ? 'Memuat...' : (hasLoaded ? 'Refresh' : 'Tampilkan')}
          </Button>
        </div>
      </div>

      {/* GLOBAL STATS */}
      {summaryLoaded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-500">
          <StatCardSummary label="Total Saldo" value={fmtRp(gt.saldo)} icon={Banknote} color="emerald" sub="Sisa dana beredar" />
          <StatCardSummary label="Dana Masuk" value={fmtRp(gt.masuk)} icon={ArrowDownToLine} color="blue" sub={`Topup Bulan ${BULAN_NAMA[bulan]}`} />
          <StatCardSummary label="Dana Keluar" value={fmtRp(gt.keluar)} icon={ArrowUpFromLine} color="orange" sub={`Jajan Bulan ${BULAN_NAMA[bulan]}`} />
          <StatCardSummary label="Saldo Kosong" value={`${fmtNum(gt.total-gt.punya)} Jiwa`} icon={AlertCircle} color="rose" sub="Santri dana 0" />
        </div>
      )}

      {/* ASRAMA CARDS */}
      {summaryLoaded && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-l-2 border-emerald-500 pl-3">Sebaran Per Asrama</h2>
            {activeCard && (
               <Button variant="ghost" size="sm" onClick={() => {setActiveCard(null); setFilterAsrama('SEMUA')}} className="h-7 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-500/5">
                 × Clear Filter
               </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {loadingSummary ? Array.from({length: 3}).map((_, i) => <SkeletonCard key={i}/>) : (
               summaryData.map(row => (
                 <AsramaCard key={row.asrama} row={row} active={activeCard === row.asrama} onClick={() => handleCardClick(row.asrama)} />
               ))
            )}
          </div>
        </div>
      )}

      <Separator className="my-8 opacity-50" />

      {/* FILTER & TABLE SECTION */}
      <div className="space-y-6">
         {/* Filter Bar */}
         <Card className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-4 flex flex-wrap items-end gap-4">
               <div className="w-full sm:w-48 space-y-1.5">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Filter Asrama</Label>
                  <Select value={filterAsrama} onValueChange={v => {setFilterAsrama(v ?? 'SEMUA'); setActiveCard(null)}}>
                     <SelectTrigger className="h-10 border-border bg-muted/20 font-bold rounded-xl focus:ring-emerald-500">
                        <SelectValue placeholder="Semua Asrama"/>
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="SEMUA" className="font-bold">Semua Asrama</SelectItem>
                        {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>

               {kamarList.length > 0 && (
                 <div className="w-32 space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Kamar</Label>
                    <Select value={filterKamar} onValueChange={(v) => setFilterKamar(v ?? '')}>
                       <SelectTrigger className="h-10 border-border bg-muted/20 font-bold rounded-xl focus:ring-emerald-500">
                          <SelectValue placeholder="Kamar"/>
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="SEMUA" className="font-bold">Seluruh</SelectItem>
                          {kamarList.map(k => <SelectItem key={k} value={k} className="font-bold">Kmr {k}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
               )}

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Filter Saldo</Label>
                  <div className="flex gap-1 bg-muted/50 p-1 border rounded-xl shadow-inner">
                     {(['SEMUA','PUNYA','KOSONG'] as FilterSaldo[]).map(f => (
                       <Button 
                          key={f} 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFilterSaldo(f)}
                          className={cn(
                             "h-8 rounded-lg text-[10px] uppercase font-black tracking-widest px-3",
                             filterSaldo === f ? "bg-background text-emerald-600 shadow-sm" : "text-muted-foreground/60"
                          )}
                       >
                         {f === 'SEMUA' ? 'All' : f === 'PUNYA' ? 'Punya' : 'Kosong'}
                       </Button>
                     ))}
                  </div>
               </div>

               <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Cari Nama/NIS</Label>
                  <div className="relative group">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors"/>
                     <Input 
                        placeholder="Cari santri..." 
                        value={searchInput} 
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
                        className="h-10 pl-10 border-border bg-muted/20 rounded-xl font-bold focus-visible:ring-emerald-500"
                     />
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button onClick={() => setSearch(searchInput)} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-600/20">
                     Filter
                  </Button>
                  <div className="flex gap-1 bg-muted/50 p-1 border rounded-xl shadow-inner">
                     <Button variant="ghost" size="icon" onClick={() => setViewMode('table')} className={cn("h-8 w-8 rounded-lg", viewMode === 'table' ? "bg-background text-emerald-600 shadow-sm" : "text-muted-foreground/40")}>
                        <List className="w-4 h-4"/>
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => setViewMode('grid')} className={cn("h-8 w-8 rounded-lg", viewMode === 'grid' ? "bg-background text-emerald-600 shadow-sm" : "text-muted-foreground/40")}>
                        <LayoutGrid className="w-4 h-4"/>
                     </Button>
                  </div>
               </div>
            </CardContent>
         </Card>

         {!hasLoaded ? (
            <Card className="py-24 flex flex-col items-center justify-center text-center bg-muted/5 border-dashed border-2">
               <Wallet className="w-12 h-12 text-muted-foreground/10 mb-4"/>
               <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Pilih parameter dan klik Tampilkan di atas</p>
            </Card>
         ) : loadingTable ? (
            <div className="py-32 flex flex-col items-center gap-3">
               <Loader2 className="w-10 h-10 animate-spin text-emerald-500 opacity-50"/>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Memuat data santri...</p>
            </div>
         ) : rows.length === 0 ? (
            <div className="py-24 text-center">
               <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/10"/>
               <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Data tidak ditemukan</p>
            </div>
         ) : (
            <div className="space-y-6">
               <div className="flex justify-between items-center px-1">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                     <Users className="w-3.5 h-3.5"/> 
                     Tampil {rows.length} dari {total} Santri
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/20 text-muted-foreground">Laman {page} / {totalPages}</Badge>
               </div>

               {viewMode === 'table' ? (
                  <Card className="border-border shadow-sm overflow-hidden">
                     <div className="overflow-x-auto">
                        <Table>
                           <TableHeader className="bg-muted/30">
                              <TableRow>
                                 <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Santri & NIS</TableHead>
                                 <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest">Asrama</TableHead>
                                 <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest text-right">Saldo Saat Ini</TableHead>
                                 <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Mutasi Jan/Kel</TableHead>
                                 <TableHead className="px-4 h-12 text-[10px] font-black uppercase tracking-widest text-center">Aksi</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {rows.map((r, i) => (
                                 <React.Fragment key={r.id}>
                                    <TableRow 
                                       className={cn(
                                          "group transition-colors cursor-pointer",
                                          expandedRow === r.id ? "bg-emerald-500/[0.03]" : "hover:bg-emerald-500/5"
                                       )}
                                       onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                                    >
                                       <TableCell className="px-6 py-4">
                                          <div className="font-black text-foreground text-sm tracking-tight">{r.nama_lengkap}</div>
                                          <div className="flex items-center gap-1.5 mt-0.5 opacity-50">
                                             <span className="text-[10px] font-black text-muted-foreground uppercase leading-none">{r.nis}</span>
                                          </div>
                                       </TableCell>
                                       <TableCell className="px-4 py-4">
                                          <div className="text-[10px] font-black text-muted-foreground uppercase opacity-70 tracking-tight leading-none mb-1">{r.asrama}</div>
                                          <Badge variant="outline" className="text-[9px] font-black opacity-50 h-4 border-muted-foreground/20 leading-none">Kmr {r.kamar}</Badge>
                                       </TableCell>
                                       <TableCell className="px-4 py-4 text-right">
                                          <span className={cn(
                                             "font-black text-sm tabular-nums",
                                             r.saldo > 0 ? "text-emerald-700" : "text-rose-500"
                                          )}>
                                             {fmtRp(r.saldo)}
                                          </span>
                                       </TableCell>
                                       <TableCell className="px-4 py-4 text-right">
                                          <div className="flex flex-col items-end gap-1">
                                             {r.masuk_bulan_ini > 0 ? (
                                                <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded shadow-sm">
                                                   <ArrowDownRight className="w-3 h-3"/> +{fmtRp(r.masuk_bulan_ini)}
                                                </div>
                                             ) : <span className="w-4 h-px bg-muted-foreground opacity-20"/>}
                                             {r.keluar_bulan_ini > 0 ? (
                                                <div className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded shadow-sm">
                                                   <ArrowUpRight className="w-3 h-3"/> -{fmtRp(r.keluar_bulan_ini)}
                                                </div>
                                             ) : <span className="w-4 h-px bg-muted-foreground opacity-20"/>}
                                          </div>
                                       </TableCell>
                                       <TableCell className="px-4 py-4 text-center">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-emerald-500/10 transition-transform">
                                             {expandedRow === r.id ? <ChevronUp className="w-4 h-4 text-emerald-600"/> : <MoreHorizontal className="w-4 h-4"/>}
                                          </Button>
                                       </TableCell>
                                    </TableRow>
                                    {expandedRow === r.id && (
                                       <TableRow className="bg-emerald-500/[0.02] border-none">
                                          <TableCell colSpan={5} className="p-0 border-none">
                                             <div className="px-6 py-2 animate-in slide-in-from-top-2 duration-300">
                                                <DetailPanel santriId={r.id} tahun={tahun} bulan={bulan} />
                                             </div>
                                          </TableCell>
                                       </TableRow>
                                    )}
                                 </React.Fragment>
                              ))}
                           </TableBody>
                        </Table>
                     </div>
                  </Card>
               ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
                     {rows.map(r => (
                        <GridItem key={r.id} r={r} expanded={expandedRow === r.id} onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)} tahun={tahun} bulan={bulan}/>
                     ))}
                  </div>
               )}

               {/* Pagination UI */}
               {totalPages > 1 && (
                 <div className="flex items-center justify-center gap-2 pt-6">
                    <Button variant="outline" onClick={() => loadTable(page-1)} disabled={page <= 1 || loadingTable} className="h-10 px-4 rounded-xl font-black text-[10px] uppercase shadow-none border-border">
                       <ChevronLeft className="w-4 h-4 mr-1"/> Prev
                    </Button>
                    <div className="flex gap-1.5">
                       {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                          let pg = i + 1;
                          if (totalPages > 5) {
                            if (page > 3) pg = page - 2 + i;
                            if (page > totalPages - 2) pg = totalPages - 4 + i;
                          }
                          if (pg > totalPages) return null;
                          return (
                             <Button 
                                key={pg} 
                                variant={pg === page ? 'default' : 'outline'}
                                onClick={() => loadTable(pg)}
                                disabled={loadingTable}
                                className={cn(
                                   "w-10 h-10 rounded-xl font-black text-xs transition-all",
                                   pg === page ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20" : "border-border shadow-none"
                                )}
                             >
                                {pg}
                             </Button>
                          )
                       })}
                    </div>
                    <Button variant="outline" onClick={() => loadTable(page+1)} disabled={page >= totalPages || loadingTable} className="h-10 px-4 rounded-xl font-black text-[10px] uppercase shadow-none border-border">
                       Next <ChevronRight className="w-4 h-4 ml-1"/>
                    </Button>
                 </div>
               )}
            </div>
         )}
      </div>
    </div>
  )
}

// ── CHILD COMPONENTS ──────────────────────────────────────────────────────

function AsramaCard({ row, active, onClick }: {
  row: SummaryRow; active: boolean; onClick: () => void
}) {
  const pct = row.total_santri > 0 ? Math.round((row.punya_saldo/row.total_santri)*100) : 0
  const net = row.masuk_bulan_ini - row.keluar_bulan_ini

  return (
    <Card 
       onClick={onClick} 
       className={cn(
          "cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border",
          active ? "ring-2 ring-emerald-500 shadow-emerald-500/10" : "hover:border-emerald-200"
       )}
    >
      <div className={cn("absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl transition-all duration-700", active ? "scale-150 opacity-100" : "opacity-0")}/>
      <CardContent className="p-6 space-y-5 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-foreground tracking-tight uppercase text-sm leading-none">{row.asrama}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tracking-widest mt-1.5">{fmtNum(row.total_santri)} Santri</div>
            </div>
          </div>
          <Badge variant="outline" className={cn(
             "h-7 font-black text-[9px] uppercase px-2 rounded-lg border shadow-none",
             pct >= 70 ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
             pct >= 40 ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
          )}>{pct}% Aktif</Badge>
        </div>

        <div className="space-y-1.5">
           <Progress value={pct} className="h-1.5 bg-muted rounded-full overflow-hidden" indicatorClassName={pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}/>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 transition-colors group-hover:bg-muted/60">
            <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mb-1 opacity-50">Total Saldo</div>
            <div className="font-black text-foreground tabular-nums text-sm truncate">{fmtRp(row.total_saldo).replace('Rp ', 'Rp')}</div>
          </div>
          <div className={cn("rounded-2xl p-3 border shadow-sm transition-all group-hover:shadow-md", net >= 0 ? 'bg-emerald-50/50 border-emerald-500/10' : 'bg-rose-50/50 border-rose-500/10')}>
            <div className={cn("text-[9px] font-black uppercase tracking-widest mb-1 opacity-60", net >= 0 ? 'text-emerald-700' : 'text-rose-600')}>Bulan Ini</div>
            <div className={cn("font-black tabular-nums text-sm", net >= 0 ? 'text-emerald-800' : 'text-rose-700')}>
              {net >= 0 ? '+' : '-'}{fmtRp(Math.abs(net)).replace('Rp ', '')}
            </div>
          </div>
        </div>

        {row.santri_topup_bulan_ini > 0 && (
          <div className="pt-2 flex justify-center">
             <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 opacity-70 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
               <ArrowDownToLine className="w-3 h-3" />
               <span>{row.santri_topup_bulan_ini} Santri Topup</span>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DetailPanel({ santriId, tahun, bulan }: {
  santriId: string; tahun: number; bulan: number
}) {
  const [data, setData] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDetailTransaksiSantri(santriId, tahun, bulan).then(d => {
      setData(d); setLoading(false)
    })
  }, [santriId, tahun, bulan])

  return (
    <Card className="border-border/60 bg-background/50 backdrop-blur-sm shadow-inner rounded-[20px] overflow-hidden my-4 relative">
       <div className="absolute top-0 right-0 p-4 opacity-10"><History className="w-12 h-12"/></div>
       <CardHeader className="bg-muted/20 py-3 px-5 border-b">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
             <TrendingDown className="w-3.5 h-3.5"/> History Transaksi {BULAN_NAMA[bulan]} {tahun}
          </CardTitle>
       </CardHeader>
       <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-10 opacity-40">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fetching records...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 opacity-30">
               <Minus className="w-6 h-6"/>
               <p className="text-[9px] font-black uppercase tracking-widest">Tidak ada record transaksi terpantau</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map(d => (
                <div key={d.id} className={cn(
                   "flex items-center justify-between p-3 rounded-2xl border transition-all hover:shadow-sm",
                   d.jenis === 'MASUK' ? "bg-blue-500/[0.03] border-blue-500/10" : "bg-orange-500/[0.03] border-orange-500/10"
                )}>
                  <div className="flex items-center gap-4">
                     <div className={cn(
                        "p-2 rounded-xl shadow-sm border",
                        d.jenis === 'MASUK' ? "bg-white text-blue-600 border-blue-100" : "bg-white text-orange-600 border-orange-100"
                     )}>
                        {d.jenis === 'MASUK' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                     </div>
                     <div>
                        <p className="font-black text-[12px] text-foreground tracking-tight uppercase h-4 overflow-hidden">{d.keterangan || (d.jenis === 'MASUK' ? 'Topup Saldo' : 'Pengeluaran Jajan')}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <span className="text-[9px] font-black text-muted-foreground opacity-50 uppercase tracking-widest tabular-nums">{fmtDateTime(d.created_at)}</span>
                           <span className="text-[8px] opacity-20">|</span>
                           <span className="text-[9px] font-black text-muted-foreground opacity-40 uppercase tracking-widest">{d.admin_nama?.split(' ')[0] || 'System'}</span>
                        </div>
                     </div>
                  </div>
                  <Badge variant="outline" className={cn(
                     "font-black text-xs tabular-nums px-3 py-1 rounded-xl shadow-sm border",
                     d.jenis === 'MASUK' ? "bg-blue-500 text-white border-blue-600" : "bg-orange-500 text-white border-orange-600"
                  )}>
                    {d.jenis === 'MASUK' ? '+' : '-'}{fmtRp(d.nominal)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
       </CardContent>
    </Card>
  )
}

function StatCardSummary({ label, value, icon: Icon, color, sub }: any) {
    const variants: any = {
        emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/10",
        blue: "text-blue-600 bg-blue-500/10 border-blue-500/10",
        orange: "text-orange-600 bg-orange-500/10 border-orange-500/10",
        rose: "text-rose-600 bg-rose-500/10 border-rose-500/10",
    }
    const c = variants[color] || variants.emerald

    return (
        <Card className="border-border shadow-sm group hover:shadow-md transition-all overflow-hidden relative">
            <CardContent className="p-6 flex items-center gap-5 relative z-10">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border group-hover:scale-110 transition-transform", c)}>
                    <Icon className="w-6 h-6"/>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 leading-none mb-2">{label}</p>
                    <p className="text-xl font-black text-foreground tabular-nums leading-none tracking-tight mb-2 truncate">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter opacity-40 italic">{sub}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function GridItem({ r, expanded, onClick, tahun, bulan }: any) {
   return (
      <Card className={cn(
         "border-border group transition-all duration-300 relative overflow-hidden flex flex-col",
         expanded ? "shadow-xl border-emerald-300" : "hover:shadow-lg hover:-translate-y-1"
      )}>
         <CardContent className="p-6 flex-1 flex flex-col space-y-5">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform shrink-0">
                  {r.nama_lengkap.split(' ').map((n: string)=>n[0]).slice(0,2).join('')}
               </div>
               <div className="min-w-0 flex-1">
                  <div className="font-black text-foreground text-sm tracking-tight uppercase truncate">{r.nama_lengkap}</div>
                  <div className="text-[10px] font-black text-muted-foreground opacity-50 uppercase tracking-widest">{r.nis}</div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 block ml-1">Lokasi</span>
                  <div className="bg-muted/40 p-2 rounded-xl border border-border/50 text-center">
                     <span className="text-[10px] font-black uppercase text-foreground truncate block">{r.asrama}</span>
                     <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Kmr {r.kamar}</span>
                  </div>
               </div>
               <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 block ml-1">Sisa Dana</span>
                  <div className={cn("p-2 rounded-xl border border-border/50 text-center flex items-center justify-center", r.saldo > 0 ? "bg-emerald-500/5 text-emerald-700" : "bg-rose-500/5 text-rose-600")}>
                     <span className="text-xs font-black tabular-nums">{fmtRp(r.saldo).replace('Rp ', 'Rp')}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-4 pt-2">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-2">
                  <span className="text-blue-600 flex items-center gap-1"><ArrowDownToLine className="w-3 h-3"/> Topup</span>
                  <span className="text-blue-700">{r.masuk_bulan_ini > 0 ? `+${fmtRp(r.masuk_bulan_ini)}` : '—'}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-2">
                  <span className="text-orange-600 flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3"/> Jajan</span>
                  <span className="text-orange-700">{r.keluar_bulan_ini > 0 ? `-${fmtRp(r.keluar_bulan_ini)}` : '—'}</span>
               </div>
            </div>

            <Button 
               variant="ghost" 
               onClick={onClick}
               className={cn(
                  "w-full h-10 rounded-2xl font-black text-[9px] uppercase tracking-widest border border-dashed transition-all mt-auto",
                  expanded ? "bg-emerald-600 text-white border-none shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-300"
               )}
            >
               {expanded ? <><ChevronUp className="w-4 h-4 mr-2"/> Sembunyikan</> : <><History className="w-4 h-4 mr-2"/> Histori Transaksi</>}
            </Button>
            
            {expanded && <DetailPanel santriId={r.id} tahun={tahun} bulan={bulan} />}
         </CardContent>
      </Card>
   )
}

function SkeletonCard() {
   return (
      <div className="h-48 rounded-3xl bg-muted/20 border-2 border-dashed border-muted flex items-center justify-center animate-pulse">
         <RefreshCw className="w-6 h-6 text-muted-foreground opacity-20 animate-spin"/>
      </div>
   )
}
