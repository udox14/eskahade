'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { getSantriBaru, simpanTes, getAsramaList } from './actions'
import {
  Search, Save, CheckCircle, Clock, GraduationCap,
  RefreshCw, X, FileText, BookOpen, Hash, User,
  ChevronLeft, ChevronRight, Filter, AlertCircle, Loader2, ShieldCheck, PenTool
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type FilterStatus = 'SEMUA' | 'SUDAH' | 'BELUM'

type Santri = {
  id: string; nis: string; nama: string; jk: string
  asrama: string; kamar: string; status_tes: 'SUDAH' | 'BELUM'
  hasil: {
    id: string; rekomendasi_marhalah: string; catatan_grade: string
    hari_tes: string; sesi_tes: string; tulis_arab: string
    baca_kelancaran: string; baca_tajwid: string
    hafalan_juz: number; nahwu_pengalaman: number
  } | null
}

export default function TesKlasifikasiPage() {
  const [rows, setRows]           = useState<Santri[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [asramaList, setAsramaList] = useState<string[]>([])

  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null)
  const [saving, setSaving] = useState(false)

  function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }

  useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  const loadData = useCallback(async (pg = 1, s = search, f = filterStatus, a = filterAsrama) => {
    setLoading(true)
    try {
      const res = await getSantriBaru({ search: s, page: pg, filterStatus: f, asrama: a !== 'SEMUA' ? a : undefined })
      setRows(res.rows as Santri[])
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
      setHasLoaded(true)
    } catch (err: any) {
      toast.error('Gagal memuat data', { description: err?.message })
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterAsrama])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    loadData(1, searchInput, filterStatus, filterAsrama)
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) return
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    const res = await simpanTes(formData)
    setSaving(false)
    if ('error' in res) {
      toast.error('Gagal menyimpan', { description: (res as any).error })
    } else {
      toast.success('Hasil tes berhasil disimpan!')
      setSelectedSantri(null)
      loadData(page)
    }
  }

  const sudah  = rows.filter(r => r.status_tes === 'SUDAH').length

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header Hero */}
      <div className="relative bg-teal-950 border border-teal-900/50 text-teal-50 px-6 pt-6 pb-8 rounded-[2.5rem] shadow-xl shadow-teal-900/10 overflow-hidden mb-2">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-teal-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3 mb-1 uppercase tracking-tight">
              <GraduationCap className="w-6 h-6 text-teal-400" /> Tes Klasifikasi
            </h1>
            <p className="text-teal-200/60 text-xs font-medium max-w-md">Instumen penilaian kualifikasi akademik untuk penentuan Marhalah / Grade awal bagi santri baru.</p>
          </div>
          {hasLoaded && (
            <div className="flex items-center gap-3">
               <div className="bg-teal-900/40 border border-teal-800/50 p-2 px-4 rounded-2xl">
                 <p className="text-[10px] font-black uppercase tracking-widest text-teal-400/80">Proses Tes</p>
                 <p className="font-black text-lg tabular-nums">{fmtNum(sudah)} <span className="text-xs text-teal-500 font-medium">Santri</span></p>
               </div>
               <div className="bg-teal-900/40 border border-teal-800/50 p-2 px-4 rounded-2xl">
                 <p className="text-[10px] font-black uppercase tracking-widest text-teal-400/80">Total Baru</p>
                 <p className="font-black text-lg tabular-nums">{fmtNum(total)} <span className="text-xs text-teal-500 font-medium">Santri</span></p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-5 rounded-[2.5rem] border-border shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">

          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] block ml-1">Asrama</label>
            <Select value={filterAsrama} onValueChange={(v) => { setFilterAsrama(v ?? ''); if (hasLoaded) loadData(1, search, filterStatus, v ?? '') }}>
                <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-teal-500">
                  <SelectValue placeholder="Semua Asrama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA" className="font-bold">SEMUA ASRAMA</SelectItem>
                  {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] block ml-1">Status Penilaian</label>
            <Tabs value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); if (hasLoaded) loadData(1, search, v as any, filterAsrama) }}>
              <TabsList className="h-11 w-full bg-muted border border-border p-1 rounded-2xl">
                <TabsTrigger value="SEMUA" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest">SEMUA</TabsTrigger>
                <TabsTrigger value="BELUM" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest">BELUM</TabsTrigger>
                <TabsTrigger value="SUDAH" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest">SUDAH</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <form onSubmit={handleSearch} className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] block ml-1">Pencarian</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nama atau NIS..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="h-11 pl-11 bg-background border-border rounded-2xl text-sm focus:ring-teal-500 font-medium"
              />
            </div>
          </form>

          <div className="md:col-span-2">
            <Button
              onClick={() => { setSearch(searchInput); loadData(1, searchInput, filterStatus, filterAsrama) }}
              disabled={loading}
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tampilkan
            </Button>
          </div>
        </div>
      </Card>

      {/* Konten */}
      {!hasLoaded ? (
        <div className="bg-muted/30 border-border border border-dashed rounded-[3.5rem] p-20 text-center space-y-5 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-12 h-12 text-muted-foreground/30" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground font-black uppercase tracking-[0.3em] text-sm">Repositori Santri Baru</p>
            <p className="text-muted-foreground text-[11px] font-medium max-w-xs mx-auto">Silakan ketuk tombol <b>Tampilkan</b> untuk memuat daftar santri yang memerlukan tes klasifikasi.</p>
          </div>
          <Button onClick={() => loadData(1)} variant="outline" className="h-10 px-8 rounded-xl font-black text-[11px] border-border hover:bg-teal-600 hover:text-white transition-all">LOAD DATABASE</Button>
        </div>
      ) : loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-3">
           <Loader2 className="w-12 h-12 animate-spin text-teal-500"/>
           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Singkronisasi Database...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-muted/20 border-border border rounded-[3rem] p-20 text-center space-y-4">
           <ShieldCheck className="w-12 h-12 text-teal-500/30 mx-auto" />
           <p className="text-muted-foreground font-medium text-sm italic">Tidak ada antrian santri untuk kriteria ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
               Ditemukan <span className="text-foreground">{fmtNum(total)}</span> Rekaman Data
             </span>
             {totalPages > 1 && <Badge variant="outline" className="font-black text-[9px] tracking-widest bg-muted border-transparent h-5 px-2">Hal. {page} / {totalPages}</Badge>}
          </div>

          <Card className="rounded-[2.5rem] border-border shadow-2xl overflow-hidden bg-card">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12 px-6 h-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-r border-border/30">ID</TableHead>
                    <TableHead className="px-6 h-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Data Santri</TableHead>
                    <TableHead className="px-6 h-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Domisili Asrama</TableHead>
                    <TableHead className="px-6 h-10 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Status Tes</TableHead>
                    <TableHead className="px-6 h-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Analisis Hasil</TableHead>
                    <TableHead className="px-6 h-10 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s, i) => (
                    <TableRow key={s.id} className="group border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 text-[10px] font-black text-muted-foreground/30 tabular-nums border-r border-border/30">{(page - 1) * 30 + i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-black text-foreground text-sm uppercase tracking-tight">{s.nama}</div>
                        <div className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{s.nis}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-muted border-transparent font-black text-[9px] shadow-none uppercase px-2 h-5 text-muted-foreground">
                          {s.asrama || '—'} • {s.kamar || '—'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {s.status_tes === 'SUDAH'
                          ? <Badge className="bg-teal-500/10 text-teal-600 border-teal-500/20 px-2.5 h-6 text-[10px] font-black uppercase tracking-widest shadow-none">
                              <CheckCircle className="w-3 h-3 mr-1" /> SELESAI
                            </Badge>
                          : <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-2.5 h-6 text-[10px] font-black uppercase tracking-widest shadow-none">
                              <Clock className="w-3 h-3 mr-1" /> ANTRIAN
                            </Badge>
                        }
                      </td>
                      <td className="px-6 py-4">
                        {s.hasil ? (
                          <div className="inline-flex items-center gap-3 bg-teal-500/5 border border-teal-500/10 p-2 rounded-2xl">
                            <div className="p-1.5 bg-teal-500/10 rounded-xl">
                              <GraduationCap className="w-4 h-4 text-teal-600" />
                            </div>
                            <div>
                               <p className="font-black text-[11px] text-teal-700 uppercase leading-none mb-0.5">{s.hasil.rekomendasi_marhalah}</p>
                               <p className="text-[9px] font-bold text-teal-600/60 uppercase tracking-tighter">{s.hasil.catatan_grade}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] italic">Pending Analysis</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => setSelectedSantri(s)}
                          className={cn(
                            "h-9 rounded-xl px-4 text-[10px] font-black uppercase tracking-[0.1em] gap-2 transition-all active:scale-[0.98]",
                             s.status_tes === 'SUDAH'
                              ? 'bg-muted text-foreground hover:bg-teal-100 hover:text-teal-700 border border-border shadow-none'
                              : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-500/20'
                          )}
                        >
                          {s.status_tes === 'SUDAH' ? <><PenTool className="w-3 h-3"/> EDIT NILAI</> : <><Save className="w-3 h-3"/> INPUT TES</>}
                        </Button>
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-6">
              <Button variant="outline" size="sm" onClick={() => loadData(page - 1)} disabled={page <= 1 || loading} className="h-9 px-4 rounded-xl font-black text-[11px] border-border shadow-sm">SEBELUMNYA</Button>
              <div className="h-9 flex items-center px-4 bg-muted border border-border/50 rounded-xl text-[10px] font-black text-muted-foreground">HAL {page} / {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => loadData(page + 1)} disabled={page >= totalPages || loading} className="h-9 px-4 rounded-xl font-black text-[11px] border-border shadow-sm">BERIKUTNYA</Button>
            </div>
          )}
        </div>
      )}

      {/* Modal Form Penilaian */}
      <Dialog open={!!selectedSantri} onOpenChange={(o) => !o && setSelectedSantri(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-card">
          <form onSubmit={handleSimpan} className="flex flex-col">
            <DialogHeader className="p-8 pb-0">
               <div className="flex items-center gap-4">
                  <div className="p-4 bg-teal-500/10 rounded-[1.5rem] shrink-0 border border-teal-500/10">
                    <PenTool className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrumen Penilaian</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground flex items-center gap-2 mt-1">
                      <User className="w-3 h-3 text-teal-500" /> {selectedSantri?.nama} • {selectedSantri?.nis}
                    </DialogDescription>
                  </div>
               </div>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="p-8 space-y-8">
                {/* A. Menulis */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center font-black text-teal-600 text-xs shadow-sm">A</div>
                     <h4 className="font-black text-foreground text-xs uppercase tracking-widest">Kemampuan Menulis Arab</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {['BAIK', 'KURANG', 'TIDAK_BISA'].map(opt => (
                      <label key={opt} className="cursor-pointer">
                        <input type="radio" name="tulis_arab" value={opt}
                          defaultChecked={selectedSantri?.hasil?.tulis_arab === opt} required className="peer sr-only" />
                        <div className="py-4 px-2 rounded-2xl border-2 border-muted bg-muted/20 text-center peer-checked:border-teal-500 peer-checked:bg-teal-500/5 peer-checked:text-teal-700 transition-all hover:border-teal-500/20 active:scale-95 text-[10px] font-black uppercase tracking-wider">
                          {opt.replace('_', ' ')}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* B. Membaca */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center font-black text-teal-600 text-xs shadow-sm">B</div>
                     <h4 className="font-black text-foreground text-xs uppercase tracking-widest">Kemampuan Membaca Qur'an</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-muted-foreground border-b border-border pb-1 uppercase tracking-widest ml-1">1. Kelancaran</p>
                      <div className="grid grid-cols-1 gap-2">
                        {['LANCAR', 'TIDAK_LANCAR', 'TIDAK_BISA'].map(opt => (
                          <label key={opt} className="cursor-pointer group">
                             <input type="radio" name="baca_kelancaran" value={opt}
                              defaultChecked={selectedSantri?.hasil?.baca_kelancaran === opt} required className="peer sr-only" />
                             <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-border border-2 bg-background hover:bg-muted/50 transition-all peer-checked:border-teal-500 peer-checked:bg-teal-500/5">
                                <div className="w-4 h-4 rounded-full border-2 border-muted peer-checked:border-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <div className="w-2 h-2 rounded-full bg-teal-500 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-[11px] font-black uppercase text-foreground">{opt.replace('_', ' ')}</span>
                             </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-muted-foreground border-b border-border pb-1 uppercase tracking-widest ml-1">2. Tajwid</p>
                      <div className="grid grid-cols-1 gap-2">
                        {['BAIK', 'KURANG', 'BURUK'].map(opt => (
                          <label key={opt} className="cursor-pointer group">
                             <input type="radio" name="baca_tajwid" value={opt}
                              defaultChecked={selectedSantri?.hasil?.baca_tajwid === opt} required className="peer sr-only" />
                             <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-border border-2 bg-background hover:bg-muted/50 transition-all peer-checked:border-teal-500 peer-checked:bg-teal-500/5">
                                <div className="w-4 h-4 rounded-full border-2 border-muted peer-checked:border-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <div className="w-2 h-2 rounded-full bg-teal-500 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-[11px] font-black uppercase text-foreground">{opt}</span>
                             </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-muted/30 p-4 rounded-[2rem] border border-border">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-background rounded-xl border border-border shadow-sm">
                         <Hash className="w-4 h-4 text-teal-600" />
                       </div>
                       <div>
                         <p className="text-[11px] font-black text-foreground uppercase tracking-tight leading-none">Capaian Hafalan</p>
                         <p className="text-[10px] font-medium text-muted-foreground">Kalkulasi total Juz yang sudah dihafal.</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="number" name="hafalan_juz"
                        defaultValue={selectedSantri?.hasil?.hafalan_juz ?? 0}
                        placeholder="0" min="0" max="30"
                        className="w-16 h-12 text-center font-black text-xl text-teal-700 bg-background border-2 border-border rounded-2xl focus:ring-4 focus:ring-teal-500/10 outline-none transition-all tabular-nums shadow-inner" />
                       <Badge variant="secondary" className="font-black text-[10px] tracking-widest py-1 bg-teal-500/10 text-teal-600 border-none">JUZ</Badge>
                    </div>
                  </div>
                </div>

                {/* C. Nahwu */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center font-black text-teal-600 text-xs shadow-sm">C</div>
                     <h4 className="font-black text-foreground text-xs uppercase tracking-widest">Wawasan Ilmu Alat (Nahwu)</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="cursor-pointer group">
                      <input type="radio" name="nahwu_pengalaman" value="on"
                        defaultChecked={!!selectedSantri?.hasil?.nahwu_pengalaman} className="peer sr-only" />
                      <div className="p-6 rounded-[2rem] border-2 border-muted bg-muted/20 text-center peer-checked:border-teal-500 peer-checked:bg-teal-500/5 transition-all hover:border-teal-500/20 active:scale-95 group-active:scale-95 duration-200">
                        <ShieldCheck className="w-8 h-8 text-muted-foreground group-hover:text-teal-500 group-hover:animate-bounce mx-auto mb-3 opacity-20 peer-checked:opacity-100" />
                        <span className="block text-xs font-black text-foreground uppercase tracking-widest">Sdh Pernah</span>
                        <span className="text-[10px] font-medium text-muted-foreground tracking-tight">Lanjut ke instrumen lanjutan</span>
                      </div>
                    </label>
                    <label className="cursor-pointer group">
                      <input type="radio" name="nahwu_pengalaman" value="off"
                        defaultChecked={!selectedSantri?.hasil?.nahwu_pengalaman} className="peer sr-only" />
                      <div className="p-6 rounded-[2rem] border-2 border-muted bg-muted/20 text-center peer-checked:border-slate-500 peer-checked:bg-slate-50/50 transition-all hover:border-slate-300 active:scale-95 group-active:scale-95 duration-200">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20 peer-checked:opacity-100" />
                        <span className="block text-xs font-black text-foreground uppercase tracking-widest">Blm Pernah</span>
                        <span className="text-[10px] font-medium text-muted-foreground tracking-tight">Masuk kelas klasifikasi dasar</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-8 border-t border-border/50 gap-4 bg-muted/10">
              <Button type="button" variant="ghost" onClick={() => setSelectedSantri(null)} className="flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest text-muted-foreground">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest gap-2 shadow-xl shadow-teal-500/20 border-teal-500/10">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> PROSES...</> : <><Save className="w-4 h-4" /> SIMPAN & ANALISA</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
