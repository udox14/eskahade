'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  cariSantriSurat, getPelanggaranSantri, getSuggestLevel,
  simpanSuratPernyataan, simpanSuratPerjanjian,
  getDaftarSurat, getDataPreviewSurat, hapusSurat, getAsramaList,
} from './actions'
import {
  ScrollText, Gavel, Search, Loader2, X, Trash2,
  ChevronLeft, ChevronRight, Printer, CheckSquare,
  Square, Eye, Filter, Plus, FileText, ArrowLeft,
  ChevronDown, Info, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale }) }
  catch { return s }
}

const JENIS_LABEL: Record<string, string> = {
  pernyataan: 'Surat Pernyataan',
  SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', SK: 'SK Pengeluaran',
}

const JENIS_COLOR: Record<string, string> = {
  pernyataan: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  SP1: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  SP2: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  SP3: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  SK: 'bg-slate-900 text-slate-50 border-slate-900',
}

// ═══════════════════════════════════════════════════════════════════════════════
// KOMPONEN SURAT — KEEP STYLES FOR PRINTING
// ═══════════════════════════════════════════════════════════════════════════════
const SuratPernyataanDoc = ({ data }: { data: any }) => {
  const { surat, pelanggaran } = data
  return (
    <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.8', color: '#000', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
          <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>MASA BAKTI 2025-2026</p>
        </div>
      </div>
      <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>SURAT PERNYATAAN</p>
        <p style={{ margin: '3px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
      </div>
      <p style={{ marginBottom: '10px' }}>Saya yang bertanda tangan dibawah ini,</p>
      <table style={{ width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
        <tbody>
          {([
            ['Nama', surat.nama_lengkap ?? ''],
            ['Asrama / Kamar', [surat.asrama, surat.kamar].filter(Boolean).join(' / ')],
            ['Kelas Pengajian', surat.nama_kelas ?? ''],
            ['Alamat', surat.alamat ?? ''],
            ['', ''],
            ['Nama Orang Tua', surat.nama_ayah ?? ''],
            ['No Telpon', ''],
          ] as [string, string][]).map(([lbl, val], idx) => (
            <tr key={idx}>
              <td style={{ width: '135px', verticalAlign: 'top', paddingBottom: '3px', whiteSpace: 'nowrap' }}>{lbl}</td>
              <td style={{ width: '12px', verticalAlign: 'top', paddingBottom: '3px' }}>{lbl ? ':' : ''}</td>
              <td style={{ verticalAlign: 'top', paddingBottom: '3px', borderBottom: '1px solid black' }}>{val}&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginBottom: '6px', textIndent: '36px' }}>
        Menyatakan sesungguhnya bahwa pada hari{' '}
        <span style={{ borderBottom: '1px solid black', display: 'inline-block', minWidth: '180px' }}>&nbsp;</span>
        {' '}saya telah melanggar salah satu peraturan Pesantren Sukahideng, yaitu:
      </p>
      <div style={{ marginBottom: '14px' }}>
        {pelanggaran.map((p: any) => (
          <p key={p.id} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px', paddingBottom: '2px' }}>{p.deskripsi}</p>
        ))}
        {Array.from({ length: Math.max(0, 4 - pelanggaran.length) }).map((_, i) => (
          <p key={i} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px' }}>&nbsp;</p>
        ))}
      </div>
      <p style={{ textAlign: 'justify', textIndent: '36px', marginBottom: '4px' }}>
        Saya mengaku bersalah dan berjanji tidak akan mengulanginya. Apabila dikemudian hari saya kembali melanggar salah satu peraturan Pesantren, maka saya bersedia menerima sanksi yang seberat-beratnya tanpa mempersulit pihak siapapun.
      </p>
      <p style={{ textAlign: 'justify', marginBottom: '24px' }}>Demikian surat pernyataan ini saya buat dalam keadaan sehat dan tanpa paksaan dari siapapun.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ textAlign: 'center', minWidth: '220px' }}>
          <p>Sukahideng, {fmtTgl(surat.tanggal)}</p>
          <p style={{ fontWeight: 'bold', marginBottom: '72px' }}>YANG MEMBUAT PERNYATAAN</p>
          <p style={{ borderBottom: '1px solid black', paddingBottom: '2px' }}>&nbsp;</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '52px' }}><p>Mengetahui:</p></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {['KEAMANAN', 'PENGURUS ASRAMA'].map(lbl => (
          <div key={lbl} style={{ textAlign: 'center', minWidth: '180px' }}>
            <p style={{ borderBottom: '1px solid black' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
            <p style={{ fontWeight: 'bold' }}>{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const SuratPerjanjianDoc = ({ data }: { data: any }) => {
  const { surat } = data
  const tglCetak = fmtTgl(surat.tanggal)
  const level: string = surat.level
  return (
    <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.7', color: '#000', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
          <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA · MASA BAKTI 2025-2026</p>
        </div>
      </div>
      <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>
          {level === 'SK' ? 'SURAT KEPUTUSAN PENGELUARAN' : `SURAT PERJANJIAN ${level}`}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
      </div>
      <p style={{ marginBottom: '12px' }}>Yang bertanda tangan di bawah ini:</p>
      <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse' }}>
        <tbody>
          {([
            ['Nama', surat.nama_lengkap],
            ['Asrama / Kamar', [surat.asrama, surat.kamar].filter(Boolean).join(' / ')],
            ['Kelas Pengajian', surat.nama_kelas],
            ['Alamat', surat.alamat],
            ['Nama Orang Tua', surat.nama_ayah],
          ] as [string, string][]).map(([lbl, val]) => (
            <tr key={lbl}>
              <td style={{ width: '150px', verticalAlign: 'top', paddingBottom: '6px' }}>{lbl}</td>
              <td style={{ verticalAlign: 'top', paddingBottom: '6px' }}>
                : {val || <span style={{ borderBottom: '1px solid black', paddingRight: '160px' }}>&nbsp;</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ textAlign: 'justify', marginBottom: '12px', textIndent: '36px' }}>Dengan ini menyatakan berjanji dan bersanggup untuk:</p>
      <ol style={{ paddingLeft: '24px', marginBottom: '12px' }}>
        <li style={{ marginBottom: '8px' }}>Mentaati seluruh peraturan yang berlaku di Pondok Pesantren Sukahideng.</li>
        <li style={{ marginBottom: '8px' }}>Tidak akan mengulangi pelanggaran yang telah dilakukan.</li>
        <li style={{ marginBottom: '8px' }}>Bersedia menerima sanksi yang lebih berat apabila melanggar kembali.</li>
        {(level === 'SP3' || level === 'SK') && (
          <li style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            {level === 'SK'
              ? 'Apabila melanggar kembali, bersedia dikeluarkan dari Pondok Pesantren Sukahideng.'
              : 'Ini adalah peringatan terakhir. Pelanggaran berikutnya akan berakibat pengeluaran dari pesantren.'}
          </li>
        )}
      </ol>
      {surat.catatan && <p style={{ marginBottom: '12px', fontStyle: 'italic' }}>Catatan: {surat.catatan}</p>}
      <p style={{ marginBottom: '32px' }}>Demikian surat perjanjian ini dibuat dengan sesungguhnya dan penuh kesadaran.</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ textAlign: 'center' }}>
          <p>Orang Tua / Wali,</p>
          <div style={{ height: '64px' }} />
          <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{surat.nama_ayah || '(................................)'}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p>Sukahideng, {tglCetak}</p>
          <p style={{ fontWeight: 'bold' }}>Yang Berjanji,</p>
          <div style={{ height: '48px' }} />
          <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{surat.nama_lengkap}</p>
        </div>
      </div>
      <p style={{ fontWeight: 'bold', margin: '24px 0 40px' }}>Mengetahui:</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {['KEAMANAN', 'DEWAN SANTRI', 'PENGURUS ASRAMA'].map(lbl => (
          <div key={lbl} style={{ textAlign: 'center' }}>
            <p style={{ borderBottom: '1px solid black', marginBottom: '4px', paddingBottom: '48px' }}>&nbsp;</p>
            <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOMBOL CETAK & PREVIEW ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function TombolAksiSurat({ surat, onHapus }: { surat: any; onHapus: (r: any) => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `@page { size: 215mm 330mm; margin: 0; }`,
  })

  const loadData = async () => {
    if (!data) {
      setLoading(true)
      const d = await getDataPreviewSurat(surat.id, surat.tipe)
      setLoading(false)
      if (!d) { toast.error('Data surat tidak ditemukan'); return null }
      setData(d)
      return d
    }
    return data
  }

  const cetakLangsung = async () => {
    const d = await loadData()
    if (d) setTimeout(() => handlePrint(), 100)
  }

  const bukaPreview = async () => {
    const d = await loadData()
    if (d) setPreviewOpen(true)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={bukaPreview} disabled={loading} title="Pratinjau">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={cetakLangsung} disabled={loading} title="Cetak">
        <Printer className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => onHapus(surat)} className="text-muted-foreground hover:text-rose-600" title="Hapus">
        <Trash2 className="w-4 h-4" />
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600"/> PRATINJAU DOKUMEN
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-tight opacity-50">
                {surat.nama_lengkap} · {JENIS_LABEL[surat.tipe === 'pernyataan' ? 'pernyataan' : surat.level]}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handlePrint()} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase gap-2 shadow-lg shadow-indigo-600/20">
                <Printer className="w-3.5 h-3.5" /> CETAK SEKARANG
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-100 p-8">
            <div className="mx-auto bg-white shadow-xl" ref={printRef}>
              {data && (
                surat.tipe === 'pernyataan' ? <SuratPernyataanDoc data={data} /> : <SuratPerjanjianDoc data={data} />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BUAT SURAT PERNYATAAN
// ═══════════════════════════════════════════════════════════════════════════════
function FormSuratPernyataan({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [pelanggaran, setPelanggaran] = useState<any[]>([])
  const [loadingP, setLoadingP] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantriSurat(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    const toastId = toast.loading(`Mengambil data pelanggaran ${s.nama_lengkap}...`)
    setSelectedSantri(s); setHasilCari([]); setChecked(new Set())
    setLoadingP(true)
    const p = await getPelanggaranSantri(s.id)
    setPelanggaran(p); setLoadingP(false)
    toast.dismiss(toastId)
  }

  const handleSimpan = async () => {
    if (!selectedSantri || checked.size === 0) { toast.error('Pilih santri dan minimal 1 pelanggaran'); return }
    setSaving(true)
    const res = await simpanSuratPernyataan(selectedSantri.id, [...checked], tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Surat Pernyataan berhasil disimpan')
    onSuccess()
  }

  return (
    <Card className="border-border shadow-xl overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
      <CardHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-tight">Buat Surat Pernyataan</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sanksi disiplin atas pelanggaran tercatat</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {/* Search / Selection Area */}
        {!selectedSantri ? (
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-indigo-600">Langkah 1: Pilih Santri</Label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus placeholder="Cari nama atau NIS (Min. 2 karakter)..."
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  className="h-12 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"
                />
              </div>
              <Button type="submit" disabled={searching || keyword.length < 2} className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} CARI
              </Button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hasilCari.map(s => (
                <button key={s.id} onClick={() => selectSantri(s)}
                  className="flex items-center gap-4 p-4 bg-white border border-border rounded-2xl text-left hover:border-indigo-400 hover:shadow-md transition-all group">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {s.nama_lengkap.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm tracking-tight uppercase truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tracking-wider">
                      {s.nis} · {s.asrama}/{s.kamar} · {s.jumlah_pelanggaran} PELANGGARAN
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 gap-4">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-black">
                  {selectedSantri.nama_lengkap.charAt(0)}
               </div>
               <div>
                  <p className="font-black text-indigo-900 text-sm tracking-tight uppercase leading-none mb-1">{selectedSantri.nama_lengkap}</p>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest opacity-60">{selectedSantri.nis} · {selectedSantri.asrama}/{selectedSantri.kamar}</p>
               </div>
             </div>
             <Button variant="ghost" size="sm" onClick={() => { setSelectedSantri(null); setPelanggaran([]); setChecked(new Set()) }} className="h-10 rounded-xl text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase gap-2">
                <X className="w-4 h-4"/> GANTI SANTRI
             </Button>
          </div>
        )}

        {/* Violations Area */}
        {selectedSantri && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Langkah 2: Pilih Pelanggaran</Label>
                {pelanggaran.length > 0 && (
                  <button onClick={() => setChecked(checked.size === pelanggaran.length ? new Set() : new Set(pelanggaran.map((p: any) => p.id)))} 
                          className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-indigo-600">
                    {checked.size === pelanggaran.length ? 'BATAL SEMUA' : 'PILIH SEMUA'}
                  </button>
                )}
              </div>
              <ScrollArea className="h-64 rounded-2xl border border-dashed border-border p-4 bg-muted/20">
                {loadingP ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                     <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50"/>
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Violations...</p>
                  </div>
                ) : pelanggaran.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-30">
                     <ShieldAlert className="w-12 h-12 mb-3"/>
                     <p className="text-[10px] font-black uppercase tracking-widest">Santri ini belum memiliki catatan pelanggaran</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {pelanggaran.map((p: any) => (
                      <button key={p.id}
                        onClick={() => setChecked(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                        className={cn('flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all group',
                          checked.has(p.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-border hover:border-indigo-300')}>
                        <div className={cn('w-5 h-5 rounded flex items-center justify-center border shrink-0 mt-0.5',
                           checked.has(p.id) ? 'bg-white border-white text-indigo-600' : 'bg-muted border-border')}>
                          {checked.has(p.id) && <CheckSquare className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-black uppercase tracking-tight truncate", checked.has(p.id) ? "text-white" : "text-slate-800")}>{p.deskripsi}</p>
                          <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", checked.has(p.id) ? "text-white/60" : "text-muted-foreground opacity-60")}>
                            {fmtTgl(p.tanggal)} · {p.jenis} · <span className="underline">+{p.poin} POIN</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Langkah 3: Tanggal Surat</Label>
                  <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500 max-w-xs" />
               </div>
               <Button onClick={handleSimpan} disabled={saving || checked.size === 0} className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-2xl shadow-indigo-600/30 gap-3 group">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScrollText className="w-5 h-5 group-hover:scale-110 transition-transform" />} 
                  {saving ? 'GENERATING DOKUMEN...' : 'GENERATE SURAT PERNYATAAN'}
               </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BUAT SP / SK
// ═══════════════════════════════════════════════════════════════════════════════
function FormSuratSP({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [level, setLevel] = useState<'SP1' | 'SP2' | 'SP3' | 'SK'>('SP1')
  const [suggestLevel, setSuggestLevel] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantriSurat(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s); setHasilCari([])
    const suggest = await getSuggestLevel(s.id)
    setLevel(suggest as any); setSuggestLevel(suggest)
  }

  const handleSimpan = async () => {
    if (!selectedSantri) { toast.error('Pilih santri dulu'); return }
    setSaving(true)
    const res = await simpanSuratPerjanjian(selectedSantri.id, level, tanggal, catatan)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(`${level === 'SK' ? 'SK Pengeluaran' : level} berhasil disimpan`)
    onSuccess()
  }

  const SP_LEVELS = ['SP1', 'SP2', 'SP3', 'SK'] as const
  const SP_LABEL: Record<string, string> = { SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', SK: 'SK Pengeluaran' }

  return (
    <Card className="border-border shadow-xl overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
      <CardHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-tight">Buat SP / SK Pengeluaran</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Surat peringatan berjenjang dan pemutusan status</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {!selectedSantri ? (
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-indigo-600">Langkah 1: Pilih Santri</Label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="text" autoFocus placeholder="Nama atau NIS..."
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  className="h-12 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500" />
              </div>
              <Button type="submit" disabled={searching || keyword.length < 2} className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} CARI
              </Button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hasilCari.map(s => (
                <button key={s.id} onClick={() => selectSantri(s)}
                  className="flex items-center gap-4 p-4 bg-white border border-border rounded-2xl text-left hover:border-indigo-400 hover:shadow-md transition-all group">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {s.nama_lengkap.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm tracking-tight uppercase truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tracking-wider">
                      {s.nis} · {s.asrama}/{s.kamar}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 gap-4">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-black">
                  {selectedSantri.nama_lengkap.charAt(0)}
               </div>
               <div>
                  <p className="font-black text-indigo-900 text-sm tracking-tight uppercase leading-none mb-1">{selectedSantri.nama_lengkap}</p>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest opacity-60">{selectedSantri.nis} · {selectedSantri.asrama}/{selectedSantri.kamar}</p>
               </div>
             </div>
             <Button variant="ghost" size="sm" onClick={() => { setSelectedSantri(null); setSuggestLevel('') }} className="h-10 rounded-xl text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase gap-2">
                <X className="w-4 h-4"/> GANTI SANTRI
             </Button>
          </div>
        )}

        {selectedSantri && (
          <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Langkah 2: Pilih Level Peringatan</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SP_LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={cn('relative py-6 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all text-center flex flex-col items-center justify-center gap-2',
                      level === l 
                         ? (l === 'SK' ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-[1.02]' : 'bg-indigo-600 text-white border-indigo-600 shadow-xl scale-[1.02]')
                         : 'bg-white text-slate-400 border-border hover:border-indigo-300 hover:text-indigo-600')}>
                    {SP_LABEL[l]}
                    {suggestLevel === l && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[7px] font-black rounded-full shadow-lg">SUGGESTED</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
               <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Langkah 3: Tanggal & Keterangan</Label>
                  <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500" />
               </div>
               <div className="md:col-span-3 space-y-1.5">
                  <Input 
                    type="text" 
                    value={catatan} 
                    onChange={e => setCatatan(e.target.value)} 
                    placeholder="Catatan tambahan (Opsional)..."
                    className="h-12 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500" 
                  />
               </div>
            </div>

            <Button onClick={handleSimpan} disabled={saving} className="w-full h-16 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-2xl shadow-indigo-600/30 gap-3 group">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5 group-hover:-rotate-12 transition-transform" />}
              {saving ? 'GENERATING...' : `SIMPAN & CETAK ${level === 'SK' ? 'SURAT PENGELUARAN' : SP_LABEL[level]}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABEL DAFTAR SURAT
// ═══════════════════════════════════════════════════════════════════════════════
function TabelDaftarSurat({ refreshKey }: { refreshKey: number }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [asramaFilter, setAsramaFilter] = useState('SEMUA')
  const [jenisFilter, setJenisFilter] = useState('SEMUA')
  const [asramaList, setAsramaList] = useState<string[]>([])

  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asramaFilter, j = jenisFilter) => {
    setLoading(true)
    try {
      const res = await getDaftarSurat({ 
        search: s || undefined, 
        asrama: a !== 'SEMUA' ? a : undefined, 
        jenis: j !== 'SEMUA' ? j : undefined, 
        page: pg 
      })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg)
      setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asramaFilter, jenisFilter])

  useEffect(() => {
    getAsramaList().then(setAsramaList)
  }, [])

  useEffect(() => {
    if (refreshKey > 0) load(1, search, asramaFilter, jenisFilter)
  }, [refreshKey])

  const handleTampilkan = (e?: React.FormEvent) => {
    e?.preventDefault()
    setSearch(searchInput)
    load(1, searchInput, asramaFilter, jenisFilter)
  }

  const handleHapus = async (row: any) => {
    if (!await confirm(`Konfirmasi Penghapusan.
    Yakin ingin menghapus dokumen ${JENIS_LABEL[row.tipe === 'pernyataan' ? 'pernyataan' : row.level]} atas nama ${row.nama_lengkap}?`)) return
    setDeleting(row.id)
    const res = await hapusSurat(row.id, row.tipe)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dukumen berhasil dihapus dari database')
    load(page, search, asramaFilter, jenisFilter)
  }

  return (
    <div className="space-y-1">
      {/* Filter bar */}
      <Card className="border-border shadow-sm overflow-hidden mb-6">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[300px] space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identitas Santri</Label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-600 transition-colors pointer-events-none"/>
              <Input
                type="text" placeholder="Masukkan nama atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTampilkan()}
                className="h-11 pl-10 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"
              />
            </div>
          </div>
          <div className="w-full sm:w-48 space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asrama</Label>
            <Select value={asramaFilter} onValueChange={(v) => setAsramaFilter(v || 'SEMUA')}>
              <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                <SelectValue placeholder="Semua Asrama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA" className="font-bold">Seluruh Asrama</SelectItem>
                {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48 space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Jenis Dokumen</Label>
            <Select value={jenisFilter} onValueChange={(v) => setJenisFilter(v || 'SEMUA')}>
              <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA" className="font-bold">Seluruh Jenis</SelectItem>
                <SelectItem value="pernyataan" className="font-bold">Surat Pernyataan</SelectItem>
                <SelectItem value="SP1" className="font-bold text-blue-600">SP 1</SelectItem>
                <SelectItem value="SP2" className="font-bold text-amber-600">SP 2</SelectItem>
                <SelectItem value="SP3" className="font-bold text-rose-600">SP 3</SelectItem>
                <SelectItem value="SK" className="font-bold text-slate-900">SK Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleTampilkan} disabled={loading} className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2 shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} TAMPILKAN
          </Button>
        </CardContent>
      </Card>

      {!hasLoaded && !loading ? (
        <div className="py-24 text-center border-2 border-dashed rounded-[2.5rem] opacity-20 flex flex-col items-center">
           <FileText className="w-16 h-16 mb-4"/>
           <p className="text-[10px] font-black uppercase tracking-widest">Gunakan filter untuk memuat database surat</p>
           <Button variant="outline" size="sm" onClick={() => handleTampilkan()} className="mt-4 rounded-xl border-current uppercase text-[9px] font-black tracking-widest px-6 h-9">Tampilkan Semua Data</Button>
        </div>
      ) : loading ? (
        <div className="py-32 flex flex-col items-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-indigo-500/50"/>
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Fetching Document Archive...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center border-border border-2 border-dashed rounded-[2.5rem] opacity-30 flex flex-col items-center gap-3">
           <Search className="w-12 h-12 mb-2"/>
           <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada dokumen ditemukan dengan kriteria tersebut</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Menampilkan <span className="text-foreground">{rows.length}</span> dari {total} Dokumen</p>
          </div>

          <Card className="border-border shadow-sm overflow-hidden min-h-[400px]">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest">No</TableHead>
                  <TableHead className="px-4 text-[10px] font-black uppercase tracking-widest">Identitas Santri</TableHead>
                  <TableHead className="px-4 text-[10px] font-black uppercase tracking-widest">Asrama / Kamar</TableHead>
                  <TableHead className="px-4 text-[10px] font-black uppercase tracking-widest">Detail Pelanggaran / Catatan</TableHead>
                  <TableHead className="px-4 text-[10px] font-black uppercase tracking-widest">Kategori</TableHead>
                  <TableHead className="px-4 text-[10px] font-black uppercase tracking-widest text-right">Tanggal</TableHead>
                  <TableHead className="w-24 px-4 h-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id} className="hover:bg-muted/10 group">
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground/50 tabular-nums">{(page - 1) * 30 + i + 1}</TableCell>
                    <TableCell>
                      <p className="font-black text-foreground text-sm tracking-tight uppercase leading-none mb-1">{r.nama_lengkap}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">{r.nis}</p>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{r.asrama} / {r.kamar}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {r.tipe === 'pernyataan'
                        ? <Badge variant="secondary" className="bg-muted border-0 text-[9px] font-black uppercase px-2">{JSON.parse(r.detail || '[]').length} POINT PELANGGARAN</Badge>
                        : <p className="text-[10px] italic text-muted-foreground opacity-50 truncate">{r.catatan || '—'}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] font-black uppercase px-2 shadow-none", JENIS_COLOR[r.tipe === 'pernyataan' ? 'pernyataan' : r.level])}>
                        {JENIS_LABEL[r.tipe === 'pernyataan' ? 'pernyataan' : r.level]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-[10px] tabular-nums text-muted-foreground/60">{fmtTgl(r.tanggal)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end pr-2 group-hover:translate-x-0 translate-x-12 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <TombolAksiSurat surat={r} onHapus={handleHapus} />
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-2xl border border-dashed">
               <Button variant="ghost" size="sm" onClick={() => load(page - 1)} disabled={page <= 1 || loading} className="h-10 px-6 rounded-xl font-black text-[10px] uppercase gap-2">
                  <ChevronLeft className="w-4 h-4" /> PREV
               </Button>
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Laman {page} dari {totalPages}</span>
               <Button variant="ghost" size="sm" onClick={() => load(page + 1)} disabled={page >= totalPages || loading} className="h-10 px-6 rounded-xl font-black text-[10px] uppercase gap-2">
                  NEXT <ChevronRight className="w-4 h-4" />
               </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE CONTENT
// ═══════════════════════════════════════════════════════════════════════════════
export function PageContent() {
  const [view, setView] = useState<'menu' | 'pernyataan' | 'sp'>('menu')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSuccess = () => {
    setView('menu')
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <ScrollText className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Layanan Surat Santri</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Dokumentasi Kedisiplinan & Peringatan Santri</p>
          </div>
        </div>

        {view !== 'menu' && (
           <Button variant="outline" onClick={() => setView('menu')} className="rounded-xl h-12 px-6 font-black text-[10px] uppercase tracking-widest border-border hover:bg-muted/50 gap-2">
              <ArrowLeft className="w-4 h-4"/> KEMBALI KE PANEL UTAMA
           </Button>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* Form area — muncul saat klik card */}
      {view === 'pernyataan' && (
        <FormSuratPernyataan onBack={() => setView('menu')} onSuccess={handleSuccess} />
      )}
      {view === 'sp' && (
        <FormSuratSP onBack={() => setView('menu')} onSuccess={handleSuccess} />
      )}

      {/* Card menu — selalu tampil di view=menu */}
      {view === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-700">
          {/* Card Surat Pernyataan */}
          <button
            onClick={() => setView('pernyataan')}
            className="group relative flex flex-col items-start gap-8 p-8 bg-white border border-border rounded-[2.5rem] text-left hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
            <div className="relative w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <ScrollText className="w-6 h-6" />
            </div>
            <div className="relative">
              <p className="font-black text-xl text-indigo-900 tracking-tight leading-none mb-2">SURAT PERNYATAAN</p>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed max-w-[240px]">
                Validasi kesalahan & janji perbaikan berdasarkan rekaman pelanggaran aktif di database.
              </p>
            </div>
            <div className="relative mt-auto w-full flex items-center justify-between pt-4 border-t border-dashed border-border/50">
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600/50 group-hover:text-indigo-600 transition-colors">MULAI GENERATE →</span>
               <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white" />
                  <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />
               </div>
            </div>
          </button>

          {/* Card SP & SK */}
          <button
            onClick={() => setView('sp')}
            className="group relative flex flex-col items-start gap-8 p-8 bg-white border border-border rounded-[2.5rem] text-left hover:border-rose-400 hover:shadow-2xl hover:shadow-rose-500/10 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
            <div className="relative w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Gavel className="w-6 h-6" />
            </div>
            <div className="relative">
              <p className="font-black text-xl text-rose-900 tracking-tight leading-none mb-2">SP & SK PENGELUARAN</p>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed max-w-[240px]">
                Penerbitan surat peringatan (SP 1-3) dan Keputusan Pengeluaran Santri secara resmi.
              </p>
            </div>
            <div className="relative mt-auto w-full flex items-center justify-between pt-4 border-t border-dashed border-border/50">
               <div className="flex gap-2">
                 {['SP1', 'SP2', 'SP3', 'SK'].map(l => <span key={l} className="text-[8px] font-black px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">{l}</span>)}
               </div>
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600/50 group-hover:text-rose-600 transition-colors">PROSES DOKUMEN →</span>
            </div>
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-6 py-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">ARSIP & RIWAYAT DOKUMEN</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
      </div>

      {/* Tabel surat — selalu tampil */}
      <TabelDaftarSurat refreshKey={refreshKey} />
    </div>
  )
}
