'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getPerizinanList, simpanIzin, setSudahDatang, cariSantri, hapusIzin } from './actions'
import { Search, Plus, MapPin, Home, Clock, CheckCircle, X, User, ArrowLeft, AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const LIST_PEMBERI_IZIN = [
  "Muhammad Fakhri", "Gungun T. Aminullah", "Yusup Fallo",
  "Ryan M. Ridwan", "M. Jihad Robbani", "Wahid Hasyim", "Abdul Halim"
]

function JenisBadge({ jenis }: { jenis: string }) {
  if (jenis === 'PULANG')
    return <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-400/30 font-black text-[10px] gap-1"><Home className="w-3 h-3"/> Pulang</Badge>
  return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-400/30 font-black text-[10px] gap-1"><MapPin className="w-3 h-3"/> Keluar Komplek</Badge>
}

function StatusBadge({ item }: { item: any }) {
  if (item.status !== 'AKTIF')
    return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-400/30 hover:bg-emerald-500/20 font-black text-[10px] gap-1 border"><CheckCircle className="w-3 h-3"/> Selesai</Badge>
  if (item.tgl_kembali_aktual)
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-400/30 hover:bg-amber-500/20 font-black text-[10px] gap-1 border"><AlertTriangle className="w-3 h-3"/> Menunggu Sidang</Badge>
  return <Badge variant="destructive" className="font-black text-[10px]">Belum Kembali</Badge>
}

export default function PerizinanPage() {
  const confirm = useConfirm()
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterWaktu, setFilterWaktu] = useState<'HARI' | 'MINGGU' | 'BULAN'>('HARI')
  const [loading, setLoading] = useState(true)

  const [isOpenInput, setIsOpenInput] = useState(false)
  const [searchSantri, setSearchSantri] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisIzin, setJenisIzin] = useState<'PULANG' | 'KELUAR_KOMPLEK'>('KELUAR_KOMPLEK')
  const [pemberiIzin, setPemberiIzin] = useState('')

  const [isOpenReturn, setIsOpenReturn] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState('')
  const [waktuKembali, setWaktuKembali] = useState(new Date().toISOString().slice(0, 16))
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [filterWaktu])

  const loadData = async () => {
    setLoading(true)
    const res = await getPerizinanList(filterWaktu)
    setList(res)
    setLoading(false)
  }

  const handleCariSantri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchSantri.length < 3) { toast.warning("Ketik minimal 3 huruf."); return }
    const res = await cariSantri(searchSantri)
    setHasilCari(res)
    if (res.length === 0) toast.info("Santri tidak ditemukan.")
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSantri) { toast.error("Mohon pilih santri terlebih dahulu!"); return }
    const loadingToast = toast.loading("Menyimpan data izin...")
    const formData = new FormData(e.currentTarget)
    formData.append('santri_id', selectedSantri.id)
    formData.append('jenis', jenisIzin)
    const res = await simpanIzin(formData)
    toast.dismiss(loadingToast)
    if ('error' in res) { toast.error("Gagal menyimpan: " + (res as any).error) }
    else {
      toast.success("Data perizinan berhasil disimpan!")
      setIsOpenInput(false); setSelectedSantri(null); setSearchSantri(''); setHasilCari([])
      loadData()
    }
  }

  const handleHapus = async (item: any) => {
    if (!await confirm(`Hapus data izin ${item.nama}?`)) return
    setDeletingId(item.id)
    const res = await hapusIzin(item.id)
    setDeletingId(null)
    if ('error' in res) { toast.error('Gagal hapus', { description: (res as any).error }); return }
    toast.success('Data izin dihapus')
    setList(prev => prev.filter(i => i.id !== item.id))
  }

  const openReturnModal = (item: any) => {
    setSelectedReturnId(item.id)
    const now = new Date()
    setWaktuKembali(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    setIsOpenReturn(true)
  }

  const handleSimpanKembali = async () => {
    const tid = toast.loading("Memproses kepulangan...")
    const res = await setSudahDatang(selectedReturnId, waktuKembali)
    toast.dismiss(tid)
    if ('error' in res) { toast.error((res as any).error) }
    else {
      if ((res as any).message?.includes('Terlambat'))
        toast.warning("Tercatat Terlambat!", { description: "Data masuk ke antrian verifikasi/sidang." })
      else
        toast.success("Tepat Waktu.", { description: "Izin diselesaikan." })
      setIsOpenReturn(false); loadData()
    }
  }

  const { paged: pagedList, totalPages: totalPagesList, safePage: safePageList } = usePagination(list, pageSize, page)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500"/> Perizinan Santri
            </h1>
            <p className="text-sm text-muted-foreground font-medium">Monitoring santri keluar/masuk komplek.</p>
          </div>
        </div>
        <Button onClick={() => setIsOpenInput(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Izin Baru
        </Button>
      </div>

      {/* FILTER WAKTU */}
      <div className="flex gap-1 bg-muted/60 border border-border p-1.5 rounded-2xl w-fit">
        {(['HARI', 'MINGGU', 'BULAN'] as const).map(f => (
          <button key={f} onClick={() => setFilterWaktu(f)}
            className={cn('px-4 py-1.5 rounded-xl text-xs font-black transition-all', filterWaktu === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {f === 'HARI' ? 'Hari Ini' : f === 'MINGGU' ? 'Minggu Ini' : 'Bulan Ini'}
          </button>
        ))}
      </div>

      {/* DAFTAR PERIZINAN */}
      {loading ? (
        <Card className="flex justify-center items-center py-14 border-border shadow-sm gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Memuat...</span>
        </Card>
      ) : list.length === 0 ? (
        <Card className="py-14 text-center text-muted-foreground text-sm font-medium border-border shadow-sm">
          Tidak ada data perizinan untuk periode ini.
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block shadow-sm border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Santri</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Jenis & Alasan</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Waktu</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Status</TableHead>
                  <TableHead className="w-10"/>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedList.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-bold text-foreground text-sm">{item.nama}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.asrama} / {item.kamar}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <JenisBadge jenis={item.jenis}/>
                        <span className="text-xs text-muted-foreground">via {item.pemberi_izin}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic truncate max-w-[220px]">"{item.alasan}"</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="text-muted-foreground">Pergi: <span className="font-bold text-foreground">{format(new Date(item.tgl_mulai), 'dd MMM yyyy, HH:mm', { locale: id })}</span></p>
                      {item.tgl_kembali_aktual ? (
                        <p className={cn('font-black mt-0.5', item.status === 'AKTIF' ? 'text-amber-600' : 'text-emerald-600')}>
                          Tiba: {format(new Date(item.tgl_kembali_aktual), 'dd MMM yyyy, HH:mm', { locale: id })}
                          {item.status === 'AKTIF' && ' ⚠'}
                        </p>
                      ) : (
                        <p className="text-destructive mt-0.5 font-medium">Batas: {format(new Date(item.tgl_selesai_rencana), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.status === 'AKTIF' && !item.tgl_kembali_aktual ? (
                        <Button variant="outline" size="sm" onClick={() => openReturnModal(item)} className="text-[11px] font-black border-rose-300 text-rose-600 hover:bg-rose-50 shadow-none h-8 rounded-xl">
                          Belum Kembali
                        </Button>
                      ) : <StatusBadge item={item}/>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleHapus(item)} disabled={deletingId === item.id} className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {pagedList.map((item) => (
              <Card key={item.id} className="overflow-hidden shadow-sm border-border">
                <div className={cn('h-1 w-full', item.status !== 'AKTIF' ? 'bg-emerald-400' : item.tgl_kembali_aktual ? 'bg-amber-400' : 'bg-rose-400')} />
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-foreground text-sm">{item.nama}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.asrama} / {item.kamar}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <JenisBadge jenis={item.jenis}/>
                      <Button variant="ghost" size="icon" onClick={() => handleHapus(item)} disabled={deletingId === item.id} className="h-6 w-6 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">"{item.alasan}" <span className="not-italic font-medium">· via {item.pemberi_izin}</span></p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 rounded-xl p-2 border border-border/60">
                      <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-0.5">Berangkat</p>
                      <p className="font-bold text-foreground">{format(new Date(item.tgl_mulai), 'dd MMM, HH:mm', { locale: id })}</p>
                    </div>
                    <div className={cn('rounded-xl p-2 border', item.tgl_kembali_aktual ? item.status === 'AKTIF' ? 'bg-amber-500/10 border-amber-300/40' : 'bg-emerald-500/10 border-emerald-300/40' : 'bg-destructive/5 border-destructive/20')}>
                      <p className={cn('text-[10px] font-black uppercase tracking-widest mb-0.5', item.tgl_kembali_aktual ? item.status === 'AKTIF' ? 'text-amber-600' : 'text-emerald-600' : 'text-destructive')}>
                        {item.tgl_kembali_aktual ? 'Tiba' : 'Batas Kembali'}
                      </p>
                      <p className={cn('font-bold', item.tgl_kembali_aktual ? item.status === 'AKTIF' ? 'text-amber-700' : 'text-emerald-700' : 'text-destructive')}>
                        {item.tgl_kembali_aktual
                          ? format(new Date(item.tgl_kembali_aktual), 'dd MMM, HH:mm', { locale: id })
                          : format(new Date(item.tgl_selesai_rencana), 'dd MMM, HH:mm', { locale: id })}
                      </p>
                    </div>
                  </div>
                  {item.status === 'AKTIF' && !item.tgl_kembali_aktual ? (
                    <Button onClick={() => openReturnModal(item)} className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-sm text-xs">
                      Tandai Sudah Kembali
                    </Button>
                  ) : (
                    <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 border', item.status !== 'AKTIF' ? 'bg-emerald-500/10 border-emerald-300/40' : 'bg-amber-500/10 border-amber-300/40')}>
                      {item.status !== 'AKTIF' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0"/> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0"/>}
                      <span className={cn('text-xs font-black', item.status !== 'AKTIF' ? 'text-emerald-700' : 'text-amber-700')}>
                        {item.status !== 'AKTIF' ? 'Selesai' : 'Menunggu Sidang — Terlambat Kembali'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination
            currentPage={safePageList}
            totalPages={totalPagesList}
            pageSize={pageSize}
            total={list.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </>
      )}

      {/* MODAL INPUT IZIN BARU */}
      <Dialog open={isOpenInput} onOpenChange={(o) => { if (!o) { setIsOpenInput(false); setSelectedSantri(null); setHasilCari([]) } }}>
        <DialogContent className="p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl w-full max-w-lg gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border/60 bg-muted/20 text-left">
            <DialogTitle className="font-black text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500"/> Buat Perizinan Baru
            </DialogTitle>
            <DialogDescription>Isi form di bawah untuk mencatat izin santri.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSimpan} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
            {/* Cari Santri */}
            {!selectedSantri ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Cari Santri</label>
                <div className="flex gap-2">
                  <Input placeholder="Nama / NIS..." value={searchSantri} onChange={e => setSearchSantri(e.target.value)}
                    className="h-10 focus-visible:ring-rose-500 shadow-none bg-muted/20"/>
                  <Button type="button" onClick={handleCariSantri} className="h-10 rounded-xl font-bold px-4"><Search className="w-4 h-4"/></Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {hasilCari.map(s => (
                    <button key={s.id} type="button" onClick={() => setSelectedSantri(s)}
                      className="w-full p-2.5 border border-border/60 rounded-xl hover:bg-rose-50/50 dark:hover:bg-rose-900/10 cursor-pointer flex justify-between items-center text-sm transition-colors text-left">
                      <span className="font-bold text-foreground">{s.nama_lengkap}</span>
                      <span className="text-xs text-muted-foreground">{s.asrama}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-400/20 rounded-xl px-4 py-3">
                <User className="w-5 h-5 text-rose-600 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground text-sm truncate">{selectedSantri.nama_lengkap}</p>
                  <p className="text-xs text-muted-foreground">{selectedSantri.asrama} - {selectedSantri.kamar}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSantri(null)} className="text-xs font-bold rounded-xl h-8 text-rose-600 hover:bg-rose-100">Ganti</Button>
              </div>
            )}

            {/* Jenis Izin */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Jenis Izin</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setJenisIzin('KELUAR_KOMPLEK')}
                  className={cn('p-3 rounded-xl border text-center text-sm font-black transition-all', jenisIzin === 'KELUAR_KOMPLEK' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted/50')}>
                  KELUAR KOMPLEK
                </button>
                <button type="button" onClick={() => setJenisIzin('PULANG')}
                  className={cn('p-3 rounded-xl border text-center text-sm font-black transition-all', jenisIzin === 'PULANG' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-card text-foreground border-border hover:bg-muted/50')}>
                  IZIN PULANG
                </button>
              </div>
            </div>

            {/* Waktu */}
            {jenisIzin === 'PULANG' ? (
              <div className="grid grid-cols-2 gap-3 bg-muted/30 border border-border/60 p-3 rounded-xl">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Dari Tanggal</span>
                  <input type="date" name="date_start" required className="w-full p-2 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-purple-500 text-foreground"/>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sampai Tanggal</span>
                  <input type="date" name="date_end" required className="w-full p-2 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-purple-500 text-foreground"/>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 border border-border/60 p-3 rounded-xl space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tanggal Izin</span>
                  <input type="date" name="date_single" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500 text-foreground"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Jam Keluar</span>
                    <input type="time" name="time_start" required className="w-full p-2 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500 text-foreground"/>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Jam Kembali</span>
                    <input type="time" name="time_end" required className="w-full p-2 border border-border rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500 text-foreground"/>
                  </div>
                </div>
              </div>
            )}

            {/* Alasan */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Keperluan / Alasan</label>
              <Textarea name="alasan" required rows={2} className="resize-none focus-visible:ring-rose-500 shadow-none bg-muted/20" placeholder="Contoh: Membeli buku, Sakit..."/>
            </div>

            {/* Pemberi Izin */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pemberi Izin</label>
              <Select value={pemberiIzin} onValueChange={(v) => { if (v) setPemberiIzin(v) }}>
                <SelectTrigger className="h-10 focus:ring-rose-500 shadow-none bg-muted/20">
                  <SelectValue placeholder="-- Pilih Ustadz --"/>
                </SelectTrigger>
                <SelectContent>
                  {LIST_PEMBERI_IZIN.map(nama => (
                    <SelectItem key={nama} value={nama} className="font-medium">{nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hidden input for form data */}
              <input type="hidden" name="pemberi_izin" value={pemberiIzin}/>
            </div>

            <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-sm">
              IZINKAN
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL KONFIRMASI KEMBALI */}
      <Dialog open={isOpenReturn} onOpenChange={(o) => { if (!o) setIsOpenReturn(false) }}>
        <DialogContent className="sm:max-w-sm p-6 text-center rounded-2xl bg-background border-none shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600"/>
          </div>
          <DialogTitle className="text-xl font-black text-foreground mb-2">Konfirmasi Kedatangan</DialogTitle>
          <DialogDescription className="text-muted-foreground mb-5">
            Kapan santri ini tiba di pondok?<br/>
            <span className="text-xs">(Silakan ubah jika data ini input susulan)</span>
          </DialogDescription>

          <input
            type="datetime-local"
            value={waktuKembali}
            onChange={(e) => setWaktuKembali(e.target.value)}
            className="w-full p-3 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl text-center font-black text-foreground bg-background mb-5 focus:border-emerald-500 outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setIsOpenReturn(false)} className="rounded-xl font-bold shadow-none">Batal</Button>
            <Button onClick={handleSimpanKembali} className="rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-sm">SIMPAN</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}