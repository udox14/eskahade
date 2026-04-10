'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSantriAktif, getSantriKeluar, getAsramaList,
  tetapkanKeluar, aktifkanKembali, getDataSuratBerhenti, catatSuratBerhenti
} from './actions'
import {
  UserX, UserCheck, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, Printer, X, AlertTriangle, CheckCircle, Loader2,
  FileText, CalendarDays, LogOut, RotateCcw, Users, Building2, Trash2, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string | null) {
  if (!s) return '—'
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: id }) }
  catch { return s }
}
function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }

type SantriAktif = {
  id: string; nis: string; nama_lengkap: string
  asrama: string | null; kamar: string | null; tahun_masuk: number | null
}
type SantriKeluar = SantriAktif & {
  tanggal_keluar: string | null; alasan_keluar: string | null; ada_surat: number
}

// ── Modal Tetapkan Keluar ─────────────────────────────────────────────────────
function ModalKeluar({ santri, open, onClose, onSuccess }: {
  santri: SantriAktif
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [tanggal, setTanggal]   = useState(new Date().toISOString().slice(0, 10))
  const [alasan, setAlasan]     = useState('')
  const [buatSurat, setBuatSurat] = useState(true)
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alasan.trim()) { toast.error('Alasan keluar wajib diisi'); return }
    setSaving(true)
    const res = await tetapkanKeluar({
      santriId: santri.id, tanggalKeluar: tanggal,
      alasanKeluar: alasan, buatSurat,
    })
    setSaving(false)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${santri.nama_lengkap} ditetapkan keluar`)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-0">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-rose-500/10 rounded-2xl shrink-0">
                 <LogOut className="w-5 h-5 text-rose-600" />
               </div>
               <div>
                  <DialogTitle className="text-xl font-black text-foreground">Tetapkan Keluar</DialogTitle>
                  <DialogDescription className="text-xs font-medium text-muted-foreground">{santri.nama_lengkap}</DialogDescription>
               </div>
             </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Info santri */}
            <div className="bg-muted/50 rounded-2xl p-4 border border-border/50 space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Atribut Santri</p>
              <p className="font-black text-foreground text-sm uppercase">{santri.nama_lengkap}</p>
              <p className="text-xs font-mono text-muted-foreground">{santri.nis} • {santri.asrama || '—'} / {santri.kamar || '—'}</p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Tanggal Keluar</label>
                <Input 
                  type="date" 
                  value={tanggal} 
                  onChange={e => setTanggal(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="h-11 border-border bg-background rounded-2xl font-bold" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Alasan Keluar</label>
                <Textarea 
                  value={alasan} 
                  onChange={e => setAlasan(e.target.value)}
                  placeholder="Pindah sekolah, urusan keluarga, dsb..."
                  className="min-h-[100px] border-border bg-background rounded-2xl font-medium resize-none text-sm" 
                  required 
                />
              </div>
            </div>

            <label className="flex items-center gap-4 p-4 bg-muted/30 border border-border rounded-2xl cursor-pointer hover:bg-muted transition-colors group">
              <input 
                type="checkbox" 
                checked={buatSurat} 
                onChange={e => setBuatSurat(e.target.checked)}
                className="w-5 h-5 rounded-lg accent-rose-600" 
              />
              <div className="flex-1">
                <p className="text-sm font-black text-foreground uppercase tracking-tight">Catat ke Layanan Surat</p>
                <p className="text-[10px] font-medium text-muted-foreground">Otomatis membuat record Surat Berhenti di modul Surat.</p>
              </div>
            </label>

            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-700 dark:text-amber-400">
               <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
               <p className="text-[11px] font-medium leading-relaxed">
                 Aksi ini akan menonaktifkan akun santri dari seluruh fitur operasional. Data tidak dihapus dan dapat diaktifkan kembali.
               </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-border/50 gap-3">
            <Button variant="ghost" onClick={onClose} type="button" className="flex-1 h-12 rounded-2xl font-black text-muted-foreground uppercase tracking-widest">Batal</Button>
            <Button 
                type="submit" 
                disabled={saving}
                className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black gap-2 shadow-xl shadow-rose-500/20 transition-all active:scale-[0.98]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              KONFIRMASI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal Cetak Surat ─────────────────────────────────────────────────────────
function ModalSurat({ santriId, open, onClose }: { santriId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      getDataSuratBerhenti(santriId).then(d => { setData(d); setLoading(false) })
    }
  }, [santriId, open])

  const handleCetak = async () => {
    if (data) {
      await catatSuratBerhenti(santriId, `Keluar per ${data.tanggal_keluar || '—'}. ${data.alasan_keluar || ''}`)
    }
    window.print()
    toast.success('Surat siap dicetak')
  }

  const tglCetak = format(new Date(), 'dd MMMM yyyy', { locale: id })
  const tahunIni = new Date().getFullYear()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-slate-900 overflow-y-auto print:bg-white print:max-h-none print:shadow-none print:rounded-none">
         {/* Toolbar */}
         <div className="sticky top-0 z-50 p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Printer className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest italic">Preview Surat Pengunduran Diri</h3>
                 <p className="text-[10px] font-medium text-slate-400">{data?.nama_lengkap || 'Memuat...'}</p>
              </div>
            </div>
            <div className="flex gap-2">
               <Button onClick={handleCetak} disabled={loading} className="bg-white hover:bg-slate-100 text-slate-900 font-black h-10 px-6 rounded-xl gap-2 transition-all active:scale-95 shadow-lg shadow-white/5">
                  <Printer className="w-4 h-4" /> CETAK
               </Button>
               <Button variant="ghost" onClick={onClose} className="h-10 w-10 p-0 rounded-xl hover:bg-slate-800 text-slate-400">
                  <X className="w-5 h-5" />
               </Button>
            </div>
         </div>

         {/* Backdrop preview */}
         <div className="p-8 bg-slate-950 flex justify-center print:p-0 print:bg-white">
            {loading ? (
              <div className="h-[297mm] w-full max-w-[210mm] bg-white rounded-lg flex flex-col items-center justify-center gap-4 shadow-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Menyiapkan Dokumen...</p>
              </div>
            ) : !data ? (
              <div className="h-[297mm] w-full max-w-[210mm] bg-white rounded-lg flex items-center justify-center text-slate-400 font-bold italic">Data tidak ditemukan</div>
            ) : (
                <div id="print-area" className="w-full max-w-[210mm] bg-white shadow-2xl print:shadow-none p-[2.5cm_1.5cm] md:p-[2.5cm_2cm]" 
                     style={{ minHeight: '297mm', fontFamily: "'Times New Roman', serif", color: 'black', fontSize: '14pt', lineHeight: '1.6' }}>
                  
                  {/* Kop */}
                  <div className="mb-4">
                    <img src="/kop-pesantren.png" alt="Kop" className="w-full h-auto max-h-[160px] object-contain" />
                    <div className="h-[3px] bg-black mt-3 mb-1" />
                    <div className="h-[1px] bg-black" />
                  </div>

                  {/* Judul */}
                  <div className="text-center mb-10">
                    <h2 className="text-xl font-bold underline mb-1">SURAT PENGUNDURAN DIRI</h2>
                    <p className="text-sm">Nomor : ...../PP-SKH/{tahunIni}</p>
                  </div>

                  <p className="mb-4">Yang bertanda tangan di bawah ini :</p>
                  <table className="w-full mb-6 ml-4 border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-48 font-bold align-top">Nama Wali Santri</td>
                        <td className="align-top">: {data.nama_ayah || '.................................................................'}</td>
                      </tr>
                      <tr>
                        <td className="font-bold align-top">Alamat Domisili</td>
                        <td className="align-top">: {data.alamat || '.................................................................'}</td>
                      </tr>
                      <tr>
                        <td className="font-bold align-top">Nomor WhatsApp</td>
                        <td className="align-top">: .................................................................</td>
                      </tr>
                    </tbody>
                  </table>

                  <p className="mb-4">Selaku orang tua / wali dari :</p>
                  <table className="w-full mb-10 ml-4 border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-48 font-bold align-top">Nama Santri</td>
                        <td className="align-top">: {data.nama_lengkap}</td>
                      </tr>
                      <tr>
                        <td className="font-bold align-top">Asrama / Kamar</td>
                        <td className="align-top">: {data.asrama || '—'} / {data.kamar || '—'}</td>
                      </tr>
                      <tr>
                        <td className="font-bold align-top">Tanggal Keluar</td>
                        <td className="align-top">: {fmtTgl(data.tanggal_keluar)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <p className="mb-12 text-justify">
                    Dengan ini kami menyatakan untuk mengundurkan diri (keluar) dari Pondok Pesantren Sukahideng
                    dikarenakan <strong>"{data.alasan_keluar || '.................................................................'}"</strong>.
                    Demikian surat pernyataan ini kami buat dengan kesadaran penuh tanpa paksaan dari pihak manapun.
                  </p>

                  <p className="text-right mb-4">Tasikmalaya, {tglCetak}</p>
                  <p className="font-bold mb-20 text-center md:text-left">Yang membuat pernyataan,</p>

                  <div className="grid grid-cols-2 gap-y-20 gap-x-10 mb-12">
                    {[
                      { label: 'Wali Santri,', nama: data.nama_ayah },
                      { label: 'Santri yang bersangkutan,', nama: data.nama_lengkap },
                      { label: 'Dewan Santri (IDP),', nama: null },
                      { label: 'Pengurus Asrama,', nama: null },
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <p className="font-bold mb-24">{item.label}</p>
                        <p className="font-bold underline uppercase">({item.nama || '.........................................'})</p>
                      </div>
                    ))}
                  </div>

                  {/* TTD Pimpinan */}
                  <div className="flex justify-center pt-8">
                    <div className="text-center min-w-[320px]">
                      <p className="font-bold">Mengetahui,</p>
                      <p className="font-bold mb-28">Pimpinan Pondok Pesantren,</p>
                      <p className="font-bold underline text-lg uppercase">KH. I. Abdul Basith Wahab, BA</p>
                    </div>
                  </div>
                </div>
            )}
         </div>

         <style>{`
           @media print { 
             body * { visibility: hidden !important; } 
             #print-area, #print-area * { visibility: visible !important; } 
             #print-area { 
               position: absolute !important; 
               left: 0 !important; 
               top: 0 !important; 
               padding: 0 !important;
               margin: 0 !important;
               width: 100% !important;
               box-shadow: none !important;
             } 
           }
         `}</style>
      </DialogContent>
    </Dialog>
  )
}

// ── Tab Santri Aktif ──────────────────────────────────────────────────────────
function TabAktif({ asramaList }: { asramaList: string[] }) {
  const [rows, setRows]         = useState<SantriAktif[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]     = useState('')
  const [asrama, setAsrama]     = useState('SEMUA')
  const [modalSantri, setModalSantri] = useState<SantriAktif | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asrama) => {
    setLoading(true)
    try {
      const res = await getSantriAktif({
        search: s || undefined,
        asrama: a !== 'SEMUA' ? a : undefined,
        page: pg,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asrama])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Filter bar */}
      <Card className="p-5 rounded-[2rem] border-border shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          <div className="md:col-span-3 space-y-2">
             <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] block ml-1">Asrama</label>
             <Select value={asrama} onValueChange={(v) => { setAsrama(v ?? ''); if (hasLoaded) load(1, search, v ?? '') }}>
                <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-rose-500">
                  <SelectValue placeholder="Semua Asrama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA" className="font-bold">SEMUA ASRAMA</SelectItem>
                  {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>

          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput, asrama) }}
                className="md:col-span-6 space-y-2">
             <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] block ml-1">Cari Nama / NIS</label>
             <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input 
                    placeholder="Masukan nama santri..." 
                    className="h-11 pl-11 bg-background border-border rounded-2xl text-sm focus:ring-rose-500 font-medium"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                />
             </div>
          </form>

          <div className="md:col-span-3">
            <Button 
               onClick={() => { setSearch(searchInput); load(1, searchInput, asrama) }}
               disabled={loading}
               className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black gap-2 shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]"
            >
               {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Filter className="w-4 h-4" />}
               Tampilkan Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {!hasLoaded && !loading ? (
        <div className="bg-muted/30 border-border border border-dashed rounded-[3rem] p-20 text-center space-y-4">
           <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto shadow-sm">
             <Users className="w-10 h-10 text-muted-foreground/30"/>
           </div>
           <p className="text-muted-foreground font-black text-[11px] uppercase tracking-widest leading-loose">
             Tekan <span className="text-rose-600">tampilkan data</span> untuk memuat list santri aktif.
           </p>
        </div>
      ) : loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-3">
           <Loader2 className="w-12 h-12 animate-spin text-rose-500"/>
           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Mengambil List Santri Aktif...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <span className="text-foreground">{fmtNum(rows.length)}</span> dari {fmtNum(total)} Terdeteksi
            </span>
            {totalPages > 1 && <Badge variant="secondary" className="font-black text-[10px] tracking-widest bg-muted h-5 px-2">Hal. {page} dari {totalPages}</Badge>}
          </div>

          <Card className="rounded-[2rem] border-border shadow-2xl overflow-hidden bg-card">
            <ScrollArea className="w-full">
               <Table>
                 <TableHeader className="bg-muted/50">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-12 h-10 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-r border-border/30">No</TableHead>
                      <TableHead className="h-10 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Profil Santri</TableHead>
                      <TableHead className="h-10 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Asrama / Kamar</TableHead>
                      <TableHead className="h-10 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Angkatan</TableHead>
                      <TableHead className="h-10 px-6 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Aksi</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                   {rows.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium italic">Data tidak ditemukan.</TableCell>
                     </TableRow>
                   ) : (
                     rows.map((r, i) => (
                       <TableRow key={r.id} className="group border-border/30 hover:bg-muted/20 transition-colors">
                         <td className="px-6 py-4 text-xs font-black text-muted-foreground/30 tabular-nums border-r border-border/30">{(page-1)*30+i+1}</td>
                         <td className="px-6 py-4">
                            <div className="font-black text-foreground text-sm uppercase tracking-tight">{r.nama_lengkap}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{r.nis}</div>
                         </td>
                         <td className="px-6 py-4">
                            <Badge variant="outline" className="bg-muted border-transparent font-black text-[10px] shadow-none uppercase px-2 h-5">
                               {r.asrama || '—'} • {r.kamar || '—'}
                            </Badge>
                         </td>
                         <td className="px-6 py-4 text-xs font-bold tabular-nums text-muted-foreground">{r.tahun_masuk || '—'}</td>
                         <td className="px-6 py-4 text-right">
                           <Button 
                              onClick={() => setModalSantri(r)}
                              variant="ghost"
                              className="h-8 rounded-xl px-4 text-[10px] font-black uppercase text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 gap-2 border border-rose-500/10 shadow-sm"
                           >
                             <LogOut className="w-3 h-3" /> SET KELUAR
                           </Button>
                         </td>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
            </ScrollArea>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => load(page-1)} 
                disabled={page <= 1 || loading}
                className="h-9 px-4 rounded-xl font-black text-[11px] gap-2 border-border shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> SEBELUMNYA
              </Button>
              <div className="text-[10px] font-black uppercase text-muted-foreground bg-muted h-9 flex items-center px-4 rounded-xl border border-border/50">
                PAGINASI {page} S/D {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => load(page+1)} 
                disabled={page >= totalPages || loading}
                className="h-9 px-4 rounded-xl font-black text-[11px] gap-2 border-border shadow-sm"
              >
                BERIKUTNYA <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal tetapkan keluar */}
      {modalSantri && (
        <ModalKeluar 
            santri={modalSantri} 
            open={!!modalSantri}
            onClose={() => setModalSantri(null)}
            onSuccess={() => { setModalSantri(null); load(page) }} 
        />
      )}
    </div>
  )
}

// ── Tab Santri Keluar ─────────────────────────────────────────────────────────
function TabKeluar({ asramaList }: { asramaList: string[] }) {
  const [rows, setRows]         = useState<SantriKeluar[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]     = useState('')
  const [asrama, setAsrama]     = useState('SEMUA')
  const [suratId, setSuratId]   = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asrama) => {
    setLoading(true)
    try {
      const res = await getSantriKeluar({
        search: s || undefined,
        asrama: a !== 'SEMUA' ? a : undefined,
        page: pg,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asrama])

  const handleRestore = async (r: SantriKeluar) => {
     // Gunakan toast prosms atau dialog standard
    if (!window.confirm(`Kembalikan ${r.nama_lengkap} menjadi santri aktif?`)) return
    setRestoringId(r.id)
    const res = await aktifkanKembali(r.id)
    setRestoringId(null)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${r.nama_lengkap} berhasil diaktifkan kembali`)
    setRows(prev => prev.filter(x => x.id !== r.id))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Filter bar */}
      <Card className="p-5 rounded-[2rem] border-border shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-3 space-y-2">
             <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] block ml-1">Asrama</label>
             <Select value={asrama} onValueChange={(v) => { setAsrama(v ?? ''); if (hasLoaded) load(1, search, v ?? '') }}>
                <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-slate-500">
                  <SelectValue placeholder="Semua Asrama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA" className="font-bold">SEMUA ASRAMA</SelectItem>
                  {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput, asrama) }}
                className="md:col-span-6 space-y-2">
             <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] block ml-1">Cari Nama Keluar</label>
             <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input 
                    placeholder="Masukan nama santri..." 
                    className="h-11 pl-11 bg-background border-border rounded-2xl text-sm focus:ring-slate-500 font-medium"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                />
             </div>
          </form>
          <div className="md:col-span-3">
            <Button 
               onClick={() => { setSearch(searchInput); load(1, searchInput, asrama) }}
               disabled={loading}
               className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black gap-2 shadow-lg shadow-slate-500/20 transition-all active:scale-[0.98]"
            >
               {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4" />}
               Cari Data
            </Button>
          </div>
        </div>
      </Card>

      {!hasLoaded && !loading ? (
        <div className="bg-muted/30 border-border border border-dashed rounded-[3rem] p-20 text-center space-y-4">
           <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto shadow-sm">
             <UserX className="w-10 h-10 text-muted-foreground/30"/>
           </div>
           <p className="text-muted-foreground font-black text-[11px] uppercase tracking-widest leading-loose">
             Tekan <span className="text-foreground">cari data</span> untuk melihat log santri keluar.
           </p>
        </div>
      ) : loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-3">
           <Loader2 className="w-12 h-12 animate-spin text-slate-500"/>
           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Memproses Pencatatan...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
               Ditemukan <span className="text-foreground">{fmtNum(total)}</span> Riwayat Keluar
             </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-[3rem]">
                <CheckCircle className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                <p className="text-emerald-700 dark:text-emerald-400 font-bold italic">Log santri keluar nihil.</p>
              </div>
            ) : (
              rows.map((r) => (
                <Card key={r.id} className="relative group p-0 overflow-hidden rounded-[2.5rem] border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                   <div className="h-1.5 bg-rose-500/20 w-full" />
                   <div className="p-6 space-y-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-rose-500/10 rounded-[1.25rem] border border-rose-500/10">
                            <UserX className="w-5 h-5 text-rose-500" />
                          </div>
                          <div>
                            <p className="font-black text-foreground uppercase tracking-tight">{r.nama_lengkap}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{r.nis} • {r.asrama || '—'} / {r.kamar || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-muted/50 rounded-2xl p-3 border border-border/50">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Tanggal Keluar</p>
                            <div className="flex items-center gap-2 text-foreground font-black text-[11px]">
                               <CalendarDays className="w-3.5 h-3.5 text-rose-500" />
                               {fmtTgl(r.tanggal_keluar)}
                            </div>
                         </div>
                         <div className="bg-muted/50 rounded-2xl p-3 border border-border/50">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Motif Keluar</p>
                            <p className="text-[11px] font-bold text-foreground truncate">{r.alasan_keluar || 'Tidak dicatat'}</p>
                         </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          onClick={() => setSuratId(r.id)}
                          variant="outline"
                          className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-background border-border shadow-sm hover:bg-muted"
                        >
                          <Printer className="w-3.5 h-3.5 text-primary" /> CETAK SURAT
                        </Button>
                        <Button 
                          onClick={() => handleRestore(r)} 
                          disabled={restoringId === r.id}
                          variant="ghost"
                          className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border border-emerald-500/10"
                        >
                          {restoringId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          AKTIFKAN
                        </Button>
                      </div>
                   </div>
                </Card>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-6">
              <Button variant="outline" size="sm" onClick={() => load(page-1)} disabled={page<=1||loading} className="h-9 px-4 rounded-xl font-black text-[11px] gap-2 shadow-sm border-border">SEBELUMNYA</Button>
              <div className="text-[10px] font-black text-muted-foreground">HAL {page} / {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => load(page+1)} disabled={page>=totalPages||loading} className="h-9 px-4 rounded-xl font-black text-[11px] gap-2 shadow-sm border-border">BERIKUTNYA</Button>
            </div>
          )}
        </div>
      )}

      {suratId && <ModalSurat open={!!suratId} santriId={suratId} onClose={() => setSuratId(null)} />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SantriKeluarPage() {
  const [tab, setTab]           = useState<'aktif' | 'keluar'>('aktif')
  const [asramaList, setAsramaList] = useState<string[]>([])

  useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Hero */}
      <div className="relative bg-slate-950 border border-slate-900/50 text-slate-50 px-6 pt-6 pb-8 rounded-[2.5rem] shadow-xl shadow-slate-900/10 overflow-hidden mb-2">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <h1 className="text-2xl font-black flex items-center gap-3 mb-1 uppercase tracking-tight">
          <UserX className="w-6 h-6 text-rose-500" /> Santri Keluar
        </h1>
        <p className="text-slate-200/60 text-xs font-medium max-w-md">Pencatatan sirkulasi santri yang berhenti di tengah semester. Data tetap terjaga dalam arsip riwayat keluar.</p>
      </div>

      {/* Modern Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="bg-muted p-1 rounded-[1.5rem] h-12 w-full max-w-[400px] border border-border shadow-sm mb-6">
          <TabsTrigger value="aktif" className="flex-1 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md">
            <LogOut className="w-3.5 h-3.5" /> Tetapkan Keluar
          </TabsTrigger>
          <TabsTrigger value="keluar" className="flex-1 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md">
            <UserX className="w-3.5 h-3.5" /> Daftar Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aktif" className="mt-0 outline-none">
          <TabAktif asramaList={asramaList} />
        </TabsContent>
        <TabsContent value="keluar" className="mt-0 outline-none">
          <TabKeluar asramaList={asramaList} />
        </TabsContent>
      </Tabs>

    </div>
  )
}
