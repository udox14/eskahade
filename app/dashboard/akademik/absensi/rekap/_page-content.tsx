'use client'

import { useState, useEffect } from 'react'
import { getUserScope, getRekapAbsensi, getDetailAbsensiSantri, getReferensiFilter } from './actions'
import { Search, Filter, Loader2, Home, BookOpen, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

function BadgeStatus({ status }: { status: string }) {
  if (status === 'A') return <Badge className="bg-red-500/10 text-red-700 border-red-400/30 font-black border text-[10px]">A</Badge>
  if (status === 'S') return <Badge className="bg-amber-500/10 text-amber-700 border-amber-400/30 font-black border text-[10px]">S</Badge>
  if (status === 'I') return <Badge className="bg-blue-500/10 text-blue-700 border-blue-400/30 font-black border text-[10px]">I</Badge>
  return <span className="text-muted-foreground/30 text-xs">—</span>
}

export default function RekapAbsensiPage() {
  const [scope, setScope] = useState<any>(null)
  const [filterAsrama, setFilterAsrama] = useState('')
  const [filterKamar, setFilterKamar] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [searchName, setSearchName] = useState('')
  const [refKelas, setRefKelas] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detailAbsen, setDetailAbsen] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    async function init() {
      const s = await getUserScope()
      setScope(s)
      if (s.type === 'ASRAMA') setFilterAsrama(s.value ?? '')
      if (s.type === 'KELAS') setFilterKelas(s.value ?? '')
      const ref = await getReferensiFilter()
      setRefKelas(ref.kelas)
    }
    init()
  }, [])

  const loadData = async () => {
    setLoading(true); setHasSearched(true)
    const res = await getRekapAbsensi(searchName, filterAsrama, filterKelas, filterKamar)
    setData(res); setLoading(false)
  }

  const handleViewDetail = async (santri: any) => {
    setSelectedSantri(santri); setLoadingDetail(true)
    const res = await getDetailAbsensiSantri(santri.id)
    setDetailAbsen(res); setLoadingDetail(false)
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600"><Filter className="w-5 h-5"/></div>
          Rekapitulasi Kehadiran
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ml-[3.25rem]">Monitoring kedisiplinan pengajian santri.</p>
      </div>

      {/* Filter Bar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-end flex-wrap">
          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Asrama</label>
            <Select
              value={filterAsrama || '__ALL__'}
              onValueChange={(v) => { setFilterAsrama(v === '__ALL__' ? '' : (v ?? '')); setFilterKamar('') }}
              disabled={scope?.type === 'ASRAMA'}
            >
              <SelectTrigger className="h-10 shadow-none bg-muted/20 focus:ring-blue-500 disabled:opacity-70">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__" className="font-medium">Semua Asrama</SelectItem>
                {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-medium">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-32 space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kamar</label>
            <Select
              value={filterKamar || '__ALL__'}
              onValueChange={(v) => setFilterKamar(v === '__ALL__' ? '' : (v ?? ''))}
              disabled={!filterAsrama}
            >
              <SelectTrigger className="h-10 shadow-none bg-muted/20 focus:ring-blue-500 disabled:opacity-50">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__" className="font-medium">Semua</SelectItem>
                {Array.from({ length: 50 }, (_, i) => i + 1).map(k => (
                  <SelectItem key={k} value={String(k)} className="font-mono">{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-48 space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kelas</label>
            <Select
              value={filterKelas || '__ALL__'}
              onValueChange={(v) => setFilterKelas(v === '__ALL__' ? '' : (v ?? ''))}
              disabled={scope?.type === 'KELAS'}
            >
              <SelectTrigger className="h-10 shadow-none bg-muted/20 focus:ring-blue-500 disabled:opacity-70">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__" className="font-medium">Semua Kelas</SelectItem>
                {refKelas.map((k: any) => <SelectItem key={k.id} value={String(k.id)} className="font-medium">{k.nama_kelas}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 relative space-y-1.5 min-w-[160px]">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Cari Nama</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input
                type="text"
                placeholder="Cari Nama Santri..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="pl-9 h-10 shadow-none bg-muted/20 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <Button onClick={loadData} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-10 gap-2 shadow-sm shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tampilkan
          </Button>
        </CardContent>
      </Card>

      {/* Table Result */}
      <Card className="border-border shadow-sm overflow-hidden min-h-[360px]">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <Search className="w-16 h-16 mb-4 text-muted-foreground/10"/>
            <p className="text-base font-black text-foreground">Siap Menampilkan Data</p>
            <p className="text-sm text-muted-foreground mt-1">Pilih filter dan klik tombol <strong>Tampilkan</strong>.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-24"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500"/></div>
        ) : data.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground font-medium">Tidak ada data ditemukan sesuai filter.</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Nama Santri</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Kelas / Asrama</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] text-destructive text-center">Alfa</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] text-amber-600 text-center">Sakit</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[10px] text-blue-600 text-center">Izin</TableHead>
                <TableHead className="text-right"/>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => handleViewDetail(row)}>
                  <TableCell>
                    <p className="font-bold text-foreground text-sm group-hover:text-blue-600 transition-colors">{row.nama}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{row.nis}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> {row.info_kelas}</div>
                    <div className="flex items-center gap-1 mt-1"><Home className="w-3 h-3"/> {row.info_asrama}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn('font-black text-sm tabular-nums', row.total_a > 0 ? 'text-destructive' : 'text-muted-foreground/40')}>{row.total_a || '—'}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn('font-black text-sm tabular-nums', row.total_s > 0 ? 'text-amber-600' : 'text-muted-foreground/40')}>{row.total_s || '—'}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn('font-black text-sm tabular-nums', row.total_i > 0 ? 'text-blue-600' : 'text-muted-foreground/40')}>{row.total_i || '—'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="text-[11px] font-bold rounded-xl shadow-none h-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedSantri} onOpenChange={(o) => { if (!o) { setSelectedSantri(null); setDetailAbsen([]) } }}>
        <DialogContent className="p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl w-full max-w-lg max-h-[82vh] flex flex-col gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border/60 bg-muted/20 text-left">
            <DialogTitle className="font-black text-foreground">{selectedSantri?.nama}</DialogTitle>
            <DialogDescription>{selectedSantri?.info_kelas} · {selectedSantri?.info_asrama}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {loadingDetail ? (
              <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>
            ) : detailAbsen.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground italic font-medium">
                Tidak ada catatan ketidakhadiran. Rajin! 🎉
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    {['Tanggal', 'Shubuh', 'Ashar', 'Maghrib'].map(h => (
                      <TableHead key={h} className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center first:text-left">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailAbsen.map((d: any) => (
                    <TableRow key={d.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3"/>
                          {format(new Date(d.tanggal), 'dd MMM yyyy', { locale: id })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><BadgeStatus status={d.shubuh}/></TableCell>
                      <TableCell className="text-center"><BadgeStatus status={d.ashar}/></TableCell>
                      <TableCell className="text-center"><BadgeStatus status={d.maghrib}/></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end">
            <Button onClick={() => { setSelectedSantri(null); setDetailAbsen([]) }} className="rounded-xl font-bold shadow-none">Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}