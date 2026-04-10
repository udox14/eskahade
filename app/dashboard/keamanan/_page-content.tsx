'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMasterPelanggaran, tambahMasterPelanggaran, editMasterPelanggaran,
  hapusMasterPelanggaran, cariSantri, simpanPelanggaran, hapusPelanggaran,
  getDaftarPelanggar, getDetailSantri,
} from './actions'
import {
  ShieldAlert, Plus, Search, Loader2, X, Trash2, Edit2,
  ChevronLeft, ChevronRight, BookOpen, Camera,
  Image as ImageIcon, Filter, Eye, Users, ChevronDown,
  CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale }) }
  catch { return s }
}

const KATEGORI_COLOR: Record<string, string> = {
  RINGAN: 'bg-slate-100 text-slate-600 border-slate-200',
  SEDANG: 'bg-amber-100 text-amber-700 border-amber-200',
  BERAT:  'bg-rose-100 text-rose-700 border-rose-200',
}
const KATEGORI_DOT: Record<string, string> = {
  RINGAN: 'bg-slate-400', SEDANG: 'bg-amber-400', BERAT: 'bg-rose-500',
}
const SP_COLOR: Record<string, string> = {
  SP1: 'bg-amber-100 text-amber-700 border-amber-200',
  SP2: 'bg-orange-100 text-orange-700 border-orange-200',
  SP3: 'bg-rose-100 text-rose-700 border-rose-200',
  SK:  'bg-red-900 text-white border-red-900',
}

async function kompresGambar(file: File, maxW = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new window.Image()
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * ratio; canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject; img.src = e.target?.result as string
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}
async function uploadFoto(base64: string): Promise<string> {
  const res = await fetch('/api/upload-foto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, folder: 'bukti-pelanggaran' }),
  })
  const data = await res.json()
  if (!data.url) throw new Error('Upload gagal')
  return data.url
}

// MODAL INPUT PELANGGARAN
function ModalInputPelanggaran({ masterList, onClose, onSuccess }: {
  masterList: any[]; onClose: () => void; onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisSearch, setJenisSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedItem = masterList.find(m => String(m.id) === selectedMasterId)
  const filteredMaster = jenisSearch.trim()
    ? masterList.filter(m => m.nama_pelanggaran.toLowerCase().includes(jenisSearch.toLowerCase()) || m.kategori.toLowerCase().includes(jenisSearch.toLowerCase()))
    : masterList

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantri(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }
  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { setFotoBase64(await kompresGambar(file)) }
    catch { toast.error('Gagal memproses foto') }
    finally { setUploading(false) }
  }
  const handleSimpan = async () => {
    if (!selectedSantri) { toast.error('Pilih santri dulu'); return }
    if (!selectedMasterId) { toast.error('Pilih jenis pelanggaran'); return }
    setSaving(true)
    try {
      let fotoUrl: string | undefined
      if (fotoBase64) { try { fotoUrl = await uploadFoto(fotoBase64) } catch { toast.error('Foto gagal diupload, data tetap disimpan tanpa foto') } }
      const res = await simpanPelanggaran({ santriId: selectedSantri.id, masterId: Number(selectedMasterId), deskripsiTambahan: deskripsi || undefined, tanggal, fotoUrl })
      if ('error' in res) { toast.error(res.error); return }
      toast.success(`Pelanggaran ${selectedSantri.nama_lengkap} berhasil dicatat`)
      onSuccess(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="font-black text-foreground text-sm">Catat Pelanggaran</DialogTitle>
              <DialogDescription className="text-[10px] mt-0">{step === 1 ? 'Langkah 1 — Pilih santri' : 'Langkah 2 — Detail pelanggaran'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex px-5 pt-3 pb-0 gap-2 shrink-0">
          {[1, 2].map(s => <div key={s} className={cn('flex-1 h-1 rounded-full transition-colors', s <= step ? 'bg-rose-500' : 'bg-muted')} />)}
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-5 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="text" autoFocus placeholder="Cari nama atau NIS santri..." value={keyword} onChange={e => setKeyword(e.target.value)}
                    className="pl-9 h-10 focus-visible:ring-rose-500 shadow-none bg-muted/20" />
                </div>
                <Button type="submit" disabled={searching || keyword.length < 2} className="bg-foreground hover:bg-foreground/90 text-background h-10 rounded-xl font-bold gap-1.5">
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Cari
                </Button>
              </form>
              {hasilCari.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Hasil Pencarian</p>
                  {hasilCari.map(s => (
                    <button key={s.id} onClick={() => { setSelectedSantri(s); setStep(2) }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-rose-50/50 dark:hover:bg-rose-900/10 border border-border/60 hover:border-rose-300 rounded-xl text-left transition-all group">
                      <div className="w-9 h-9 rounded-xl bg-muted group-hover:bg-rose-100 flex items-center justify-center text-sm font-black text-foreground group-hover:text-rose-700 transition-colors shrink-0">{s.nama_lengkap.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-muted-foreground">{s.nis} · {s.asrama} / {s.kamar}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground/40 gap-2">
                  <Users className="w-10 h-10" />
                  <p className="text-xs text-muted-foreground">Ketik minimal 2 karakter lalu klik Cari</p>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-400/20 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-sm font-black text-rose-700 dark:text-rose-400 shrink-0">{selectedSantri?.nama_lengkap.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground text-sm truncate">{selectedSantri?.nama_lengkap}</p>
                  <p className="text-xs text-muted-foreground">{selectedSantri?.nis} · {selectedSantri?.asrama} / {selectedSantri?.kamar}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setStep(1); setSelectedSantri(null); setSelectedMasterId(''); setJenisSearch('') }} className="h-8 w-8 shrink-0 rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1.5">Jenis Pelanggaran <span className="text-rose-500">*</span></label>
                <div className="relative" ref={dropdownRef}>
                  <button type="button" onClick={() => { setShowDropdown(v => !v); setTimeout(() => searchRef.current?.focus(), 50) }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-all bg-muted/20 text-left', showDropdown ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-border hover:border-border/80')}>
                    {selectedItem ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[selectedItem.kategori])} />
                        <span className="font-bold text-foreground truncate">{selectedItem.nama_pelanggaran}</span>
                        <span className="text-xs font-black text-rose-600 shrink-0">+{selectedItem.poin}p</span>
                      </div>
                    ) : <span className="text-muted-foreground">Ketik untuk mencari pelanggaran...</span>}
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2', showDropdown && 'rotate-180')} />
                  </button>
                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-border/60">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input ref={searchRef} type="text" placeholder="Cari jenis pelanggaran..." value={jenisSearch} onChange={e => setJenisSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-border/60 rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                          {jenisSearch && <button onClick={() => setJenisSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredMaster.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6 italic">Tidak ada yang cocok</p>
                          : jenisSearch.trim()
                            ? filteredMaster.map(m => (
                              <button key={m.id} onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false); setJenisSearch('') }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors text-left border-b border-border/40 last:border-0">
                                <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[m.kategori])} />
                                <span className="flex-1 text-sm font-medium text-foreground truncate">{m.nama_pelanggaran}</span>
                                <span className="text-xs font-black text-rose-600 shrink-0">+{m.poin}p</span>
                              </button>
                            ))
                            : ['RINGAN', 'SEDANG', 'BERAT'].flatMap(kat => {
                              const items = masterList.filter(m => m.kategori === kat)
                              if (!items.length) return []
                              return [
                                <div key={`hdr-${kat}`} className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/40">
                                  <span className={cn('w-2 h-2 rounded-full', KATEGORI_DOT[kat])} />
                                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kat}</span>
                                </div>,
                                ...items.map(m => (
                                  <button key={m.id} onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false) }}
                                    className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors text-left border-b border-border/40 last:border-0', selectedMasterId === String(m.id) && 'bg-rose-50/50 dark:bg-rose-900/10')}>
                                    <span className="flex-1 text-sm font-medium text-foreground truncate">{m.nama_pelanggaran}</span>
                                    <span className="text-xs font-black text-rose-600 shrink-0">+{m.poin}p</span>
                                    {selectedMasterId === String(m.id) && <span className="text-rose-500 text-xs shrink-0">✓</span>}
                                  </button>
                                ))
                              ]
                            })
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Tanggal Kejadian</label>
                <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} max={new Date().toISOString().slice(0, 10)}
                  className="h-10 focus-visible:ring-rose-500 shadow-none bg-muted/20" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Keterangan Tambahan <span className="text-muted-foreground/50 font-normal normal-case">(opsional)</span></label>
                <Textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Detail kejadian, saksi, lokasi, dsb..." rows={2}
                  className="focus-visible:ring-rose-500 shadow-none bg-muted/20 resize-none text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Foto Bukti <span className="text-muted-foreground/50 font-normal normal-case">(opsional · auto kompres)</span></label>
                {fotoBase64 ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={fotoBase64} className="w-full max-h-36 object-cover" alt="Bukti" />
                    <button onClick={() => { setFotoBase64(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 p-1.5 bg-background border border-border rounded-lg shadow-sm text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full border-2 border-dashed border-border rounded-xl py-5 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-rose-400 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <span className="text-xs font-medium">{uploading ? 'Memproses...' : 'Klik untuk pilih foto'}</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border/60 shrink-0 bg-muted/20">
          {step === 1
            ? <p className="text-xs text-muted-foreground text-center">Pilih santri dari hasil pencarian di atas</p>
            : <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl font-bold shadow-none">← Kembali</Button>
              <Button onClick={handleSimpan} disabled={saving || !selectedMasterId}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                {saving ? 'Menyimpan...' : 'Catat Pelanggaran'}
              </Button>
            </div>
          }
        </div>
      </DialogContent>
    </Dialog>
  )
}

// MODAL DETAIL SANTRI
function ModalDetail({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dtab, setDtab] = useState<'pelanggaran' | 'riwayat'>('pelanggaran')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { getDetailSantri(santriId).then(d => { setData(d); setLoading(false) }) }, [santriId])

  const handleHapus = async (id: string) => {
    if (!await confirm('Hapus data pelanggaran ini?')) return
    setDeleting(id)
    const res = await hapusPelanggaran(id)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dihapus')
    setData((prev: any) => ({ ...prev, pelanggaran: prev.pelanggaran.filter((p: any) => p.id !== id) }))
  }
  const totalPoin = data?.pelanggaran?.reduce((a: number, p: any) => a + (p.poin ?? 0), 0) ?? 0

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60 shrink-0 text-left">
          {loading ? <div className="h-4 w-40 bg-muted rounded-lg animate-pulse" /> : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-sm font-black text-rose-700 dark:text-rose-400 shrink-0">{data?.profil?.nama_lengkap?.charAt(0)}</div>
              <div>
                <DialogTitle className="font-black text-foreground text-sm leading-tight">{data?.profil?.nama_lengkap}</DialogTitle>
                <DialogDescription className="text-[11px]">{data?.profil?.nis} · {data?.profil?.asrama}/{data?.profil?.kamar}</DialogDescription>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex gap-1 bg-muted/50 p-1 mx-4 mt-3 rounded-xl shrink-0">
          {([
            { key: 'pelanggaran', label: 'Pelanggaran', count: data?.pelanggaran?.length ?? 0 },
            { key: 'riwayat', label: 'Riwayat SP', count: (data?.suratPernyataan?.length ?? 0) + (data?.suratPerjanjian?.length ?? 0) },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setDtab(t.key)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5', dtab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
              {t.count > 0 && <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', dtab === t.key ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-muted text-muted-foreground')}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : dtab === 'pelanggaran' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-400/20">
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest">Total Poin</p>
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5 tabular-nums">{totalPoin}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Jumlah Kasus</p>
                    <p className="text-2xl font-black text-foreground mt-0.5 tabular-nums">{data.pelanggaran.length}<span className="text-sm font-bold ml-0.5">x</span></p>
                  </div>
                </div>
                {data.pelanggaran.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">Belum ada catatan pelanggaran</p>
                  : data.pelanggaran.map((p: any) => (
                    <Card key={p.id} className="p-3 shadow-sm border-border">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge variant="outline" className={cn('text-[9px] font-black', KATEGORI_COLOR[p.jenis] ?? KATEGORI_COLOR.RINGAN)}>{p.jenis}</Badge>
                            <span className="text-xs font-black text-rose-600">+{p.poin}p</span>
                            <span className="text-[10px] text-muted-foreground">{fmtTgl(p.tanggal)}</span>
                          </div>
                          <p className="text-sm font-bold text-foreground">{p.deskripsi}</p>
                          {p.penindak_nama && <p className="text-[10px] text-muted-foreground mt-0.5">Dicatat: {p.penindak_nama}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.foto_url && <a href={p.foto_url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"><ImageIcon className="w-3.5 h-3.5" /></a>}
                          <Button variant="ghost" size="icon" onClick={() => handleHapus(p.id)} disabled={deleting === p.id} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(data.suratPernyataan.length + data.suratPerjanjian.length) === 0
                  ? <p className="text-center py-8 text-muted-foreground text-sm">Belum ada riwayat SP / Pernyataan</p>
                  : <>
                    {data.suratPernyataan.map((sp: any) => (
                      <div key={sp.id} className="flex items-center gap-3 bg-card border border-border/60 rounded-xl p-3">
                        <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center shrink-0">
                          <CheckSquare className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm">Surat Pernyataan</p>
                          <p className="text-xs text-muted-foreground">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                        </div>
                      </div>
                    ))}
                    {data.suratPerjanjian.map((sp: any) => (
                      <div key={sp.id} className="flex items-center gap-3 bg-card border border-border/60 rounded-xl p-3">
                        <span className={cn('text-xs font-black px-2.5 py-2 rounded-xl border shrink-0', SP_COLOR[sp.level] ?? 'bg-muted text-muted-foreground')}>{sp.level}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm">{sp.level === 'SK' ? 'SK Pengeluaran' : `Surat Perjanjian ${sp.level}`}</p>
                          <p className="text-xs text-muted-foreground">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                          {sp.catatan && <p className="text-xs text-muted-foreground mt-0.5 italic">"{sp.catatan}"</p>}
                        </div>
                      </div>
                    ))}
                  </>}
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// TAB DAFTAR PELANGGAR
function TabDaftar({ masterList }: { masterList: any[] }) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modalId, setModalId] = useState<string | null>(null)
  const [showModalInput, setShowModalInput] = useState(false)

  const load = useCallback(async (pg = 1, s = search) => {
    setLoading(true)
    try {
      const res = await getDaftarPelanggar({ search: s || undefined, page: pg })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg)
      setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search])

  const handleTampilkan = () => { setSearch(searchInput); load(1, searchInput) }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <form onSubmit={e => { e.preventDefault(); handleTampilkan() }} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input type="text" placeholder="Cari nama atau NIS..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="pl-9 h-10 focus-visible:ring-rose-500 shadow-sm" />
          </div>
          <Button type="submit" disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold h-10 gap-1.5 shadow-sm whitespace-nowrap">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
            Tampilkan
          </Button>
        </form>
        <Button onClick={() => setShowModalInput(true)} className="rounded-xl font-bold h-10 gap-2 shadow-sm whitespace-nowrap">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Catat Pelanggaran</span>
          <span className="sm:hidden">Catat</span>
        </Button>
      </div>

      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center py-16 gap-3 border-2 border-dashed border-border/60 rounded-2xl bg-muted/20 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-foreground text-sm font-bold">Data belum dimuat</p>
          <p className="text-xs text-muted-foreground">Klik <strong>Tampilkan</strong> untuk memuat daftar pelanggar</p>
          <Button onClick={handleTampilkan} className="mt-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm">
            Tampilkan Semua
          </Button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 gap-2 text-muted-foreground border border-border/60 rounded-2xl bg-card">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm font-medium">Memuat...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 border-2 border-dashed border-border/60 rounded-2xl bg-muted/20 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-muted-foreground text-sm font-medium">Tidak ada data pelanggar</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground px-0.5"><strong className="text-foreground font-black">{total}</strong> santri tercatat pernah melanggar</p>

          {/* Desktop Table */}
          <Card className="hidden md:block shadow-sm border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {['No', 'Nama Santri', 'Asrama / Kamar', 'Kasus', 'Total Poin', 'SP Terakhir', ''].map(h => (
                    <TableHead key={h} className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => setModalId(r.id)}>
                    <TableCell className="text-xs text-muted-foreground/60 tabular-nums">{(page - 1) * 30 + i + 1}</TableCell>
                    <TableCell>
                      <p className="font-bold text-foreground group-hover:text-rose-600 transition-colors text-sm">{r.nama_lengkap}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.nis}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">{r.asrama}/{r.kamar}</TableCell>
                    <TableCell className="text-xs font-black text-foreground tabular-nums">{r.jumlah_pelanggaran}x</TableCell>
                    <TableCell><span className="text-sm font-black text-rose-600 tabular-nums">{r.total_poin}</span><span className="text-xs text-muted-foreground"> poin</span></TableCell>
                    <TableCell>
                      {r.sp_terakhir ? <Badge variant="outline" className={cn('text-[10px] font-black', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</Badge> : <span className="text-muted-foreground/30">—</span>}
                    </TableCell>
                    <TableCell><Eye className="w-4 h-4 text-muted-foreground/20 group-hover:text-rose-400 transition-colors" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {rows.map(r => (
              <button key={r.id} onClick={() => setModalId(r.id)}
                className="w-full bg-card border border-border/60 rounded-2xl p-4 shadow-sm text-left hover:border-rose-300 active:scale-[0.98] transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-foreground text-sm">{r.nama_lengkap}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.nis} · {r.asrama}/{r.kamar}</p>
                  </div>
                  {r.sp_terakhir && <Badge variant="outline" className={cn('shrink-0 text-[10px] font-black', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</Badge>}
                </div>
                <div className="mt-2.5 flex gap-3 text-xs">
                  <span className="text-muted-foreground">{r.jumlah_pelanggaran}x kasus</span>
                  <span className="font-black text-rose-600">{r.total_poin} poin</span>
                  <span className="text-muted-foreground">· {fmtTgl(r.terakhir)}</span>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => load(page - 1)} disabled={page <= 1 || loading} className="rounded-xl font-bold shadow-none gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </Button>
              <span className="text-xs text-muted-foreground font-medium">Hal {page}/{totalPages}</span>
              <Button variant="outline" onClick={() => load(page + 1)} disabled={page >= totalPages || loading} className="rounded-xl font-bold shadow-none gap-1.5">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
      {modalId && <ModalDetail santriId={modalId} onClose={() => setModalId(null)} />}
      {showModalInput && <ModalInputPelanggaran masterList={masterList} onClose={() => setShowModalInput(false)} onSuccess={() => load(1, search)} />}
    </div>
  )
}

// TAB KAMUS PELANGGARAN
function TabKamus({ masterList, onRefresh }: { masterList: any[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleSimpan = async () => {
    if (!form.nama.trim()) { toast.error('Nama pelanggaran wajib diisi'); return }
    setSaving(true)
    const res = editId ? await editMasterPelanggaran(editId, form) : await tambahMasterPelanggaran(form)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(editId ? 'Diperbarui' : 'Ditambahkan')
    setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }); setEditId(null)
    onRefresh()
  }
  const handleHapus = async (id: number) => {
    if (!await confirm('Hapus jenis pelanggaran ini?')) return
    setDeleting(id)
    const res = await hapusMasterPelanggaran(id)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dihapus'); onRefresh()
  }
  const grouped = ['RINGAN', 'SEDANG', 'BERAT'].reduce((acc, k) => {
    acc[k] = masterList.filter((m: any) => m.kategori === k); return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-5">
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            {editId ? '✎ Edit Jenis Pelanggaran' : '+ Tambah Jenis Pelanggaran'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Kategori</label>
              <div className="flex gap-1 bg-muted/50 border border-border/60 p-1 rounded-xl">
                {(['RINGAN', 'SEDANG', 'BERAT'] as const).map(k => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, kategori: k }))}
                    className={cn('flex-1 py-1.5 rounded-lg text-xs font-black transition-all', form.kategori === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>{k}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Poin</label>
              <Input type="number" value={form.poin} onChange={e => setForm(f => ({ ...f, poin: Number(e.target.value) }))} min={1} max={100}
                className="h-10 shadow-none focus-visible:ring-rose-500 bg-muted/20" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Nama Pelanggaran</label>
              <Input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Merokok, Berkelahi, Pencurian..."
                className="h-10 shadow-none focus-visible:ring-rose-500 bg-muted/20" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Deskripsi <span className="font-normal normal-case text-muted-foreground/60">(opsional)</span></label>
              <Input type="text" value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Keterangan singkat..."
                className="h-10 shadow-none focus-visible:ring-rose-500 bg-muted/20" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSimpan} disabled={saving} className="flex-1 rounded-xl font-black shadow-sm h-11">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Data'}
            </Button>
            {editId && (
              <Button variant="outline" onClick={() => { setEditId(null); setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }) }} className="rounded-xl font-bold shadow-none">Batal</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {['RINGAN', 'SEDANG', 'BERAT'].map(kat => (
        <div key={kat}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[kat])} />
            <span className={cn('text-[10px] font-black uppercase tracking-widest', { RINGAN: 'text-muted-foreground', SEDANG: 'text-amber-600', BERAT: 'text-rose-600' }[kat])}>{kat}</span>
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-[10px] text-muted-foreground font-bold">{grouped[kat]?.length ?? 0}</span>
          </div>
          {!grouped[kat]?.length ? <p className="text-xs text-muted-foreground italic pl-3">Belum ada</p>
            : <div className="space-y-1.5">
              {grouped[kat].map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3 hover:border-border transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{m.nama_pelanggaran}</p>
                    {m.deskripsi && <p className="text-xs text-muted-foreground truncate">{m.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-black text-rose-600 bg-rose-500/10 border border-rose-400/20 px-2 py-0.5 rounded-lg">+{m.poin}p</span>
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(m.id); setForm({ kategori: m.kategori, nama: m.nama_pelanggaran, poin: m.poin, deskripsi: m.deskripsi || '' }) }} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleHapus(m.id)} disabled={deleting === m.id} className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>}
        </div>
      ))}
    </div>
  )
}

// MAIN PAGE
export default function KeamananPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'daftar' | 'kamus'>('daftar')
  const [masterList, setMasterList] = useState<any[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const loadMaster = useCallback(async () => {
    setLoadingMaster(true)
    setMasterList(await getMasterPelanggaran())
    setLoadingMaster(false)
  }, [])

  useEffect(() => { loadMaster() }, [loadMaster])

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4">
      {/* Header Hero */}
      <div className="relative bg-rose-950 border border-rose-900/50 text-rose-50 px-5 pt-5 pb-6 rounded-[2rem] shadow-xl shadow-rose-900/10 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <h1 className="text-xl font-black flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-rose-400"/> Pelanggaran
        </h1>
        <p className="text-rose-200/70 text-xs font-medium">Catatan disiplin & rekap kasus santri.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'daftar' | 'kamus')}>
        <TabsList className="w-full h-12 bg-muted/60 p-1.5 rounded-2xl border border-border mb-1">
          <TabsTrigger value="daftar" className="flex-1 font-black rounded-xl gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ShieldAlert className="w-4 h-4"/> Daftar Pelanggar
          </TabsTrigger>
          <TabsTrigger value="kamus" className="flex-1 font-black rounded-xl gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BookOpen className="w-4 h-4"/> Kamus Pelanggaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daftar" className="mt-4 outline-none">
          <TabDaftar masterList={masterList} />
        </TabsContent>

        <TabsContent value="kamus" className="mt-4 outline-none">
          {loadingMaster
            ? <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : <TabKamus masterList={masterList} onRefresh={loadMaster} />
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}