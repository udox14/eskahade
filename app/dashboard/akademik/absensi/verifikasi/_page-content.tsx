'use client'

import { useState, useCallback } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal } from './actions'
import { Gavel, CheckCircle, Loader2, Save, ChevronLeft, ChevronRight, RefreshCw, Users, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type VonisType = 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
type AbsenItem = {
  santri_id: string; nama: string; nis: string; info: string
  items: { absen_id: string; tanggal: string; sesi: string; status_verif: string }[]
}

const PAGE_SIZE = 20

const SESI_COLOR: Record<string, string> = {
  shubuh:  'bg-indigo-500/10 text-indigo-700 border-indigo-400/30',
  ashar:   'bg-amber-500/10 text-amber-700 border-amber-400/30',
  maghrib: 'bg-slate-200/60 text-slate-600 border-slate-300/30',
}

function fmtTgl(s: string) {
  try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }
  catch { return s }
}

const SESI_LABEL: Record<string, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }

const VONIS_OPTS = [
  { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',       activeClass: 'bg-rose-600 text-white shadow-sm',    idleClass: 'bg-rose-500/10 text-rose-700 border border-rose-400/30 hover:bg-rose-500/20' },
  { v: 'SAKIT'      as VonisType, label: 'Sakit',      activeClass: 'bg-amber-500 text-white shadow-sm',   idleClass: 'bg-amber-500/10 text-amber-700 border border-amber-400/30 hover:bg-amber-500/20' },
  { v: 'IZIN'       as VonisType, label: 'Izin',       activeClass: 'bg-blue-600 text-white shadow-sm',    idleClass: 'bg-blue-500/10 text-blue-700 border border-blue-400/30 hover:bg-blue-500/20' },
  { v: 'BELUM'      as VonisType, label: 'Tdk Hadir',  activeClass: 'bg-slate-700 text-white shadow-sm',   idleClass: 'bg-muted text-foreground border border-border hover:bg-muted/80' },
  { v: 'KESALAHAN'  as VonisType, label: 'Salah Input',activeClass: 'bg-violet-600 text-white shadow-sm',  idleClass: 'bg-violet-500/10 text-violet-700 border border-violet-400/30 hover:bg-violet-500/20' },
]

function BarisAbsen({ item, no, vonis, onSelect }: {
  item: AbsenItem; no: number; vonis: VonisType | undefined
  onSelect: (santriId: string, v: VonisType) => void
}) {
  const terpilih = !!vonis

  const sesiPills = (
    <div className="flex flex-wrap gap-1">
      {item.items.slice(0, 5).map((i, idx) => (
        <span key={idx} className={cn('text-[9px] font-black px-1.5 py-0.5 rounded border', SESI_COLOR[i.sesi] ?? 'bg-muted')}>
          {SESI_LABEL[i.sesi]} {fmtTgl(i.tanggal)}
        </span>
      ))}
      {item.items.length > 5 && <span className="text-[9px] text-muted-foreground self-center">+{item.items.length - 5}</span>}
      <span className="text-[9px] font-black bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded">
        {item.items.length} sesi · {item.items.length * 10}p
      </span>
    </div>
  )

  const tombol = (
    <div className="flex flex-wrap gap-1.5">
      {VONIS_OPTS.map(({ v, label, activeClass, idleClass }) => (
        <button key={v} onClick={() => onSelect(item.santri_id, v)}
          className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-black active:scale-95 transition-all', vonis === v ? activeClass : idleClass)}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Desktop Row */}
      <tr className={cn('hidden sm:table-row border-b border-border/40 transition-colors', terpilih ? 'bg-emerald-500/10' : 'hover:bg-muted/20')}>
        <td className="px-3 py-2.5 text-xs text-muted-foreground/40 text-center w-8">{no}</td>
        <td className="px-3 py-2.5">
          <p className={cn('font-black text-sm', terpilih ? 'text-emerald-700' : 'text-foreground')}>{item.nama}</p>
          <p className="text-xs text-muted-foreground">{item.nis} · {item.info}</p>
        </td>
        <td className="px-3 py-2.5">{sesiPills}</td>
        <td className="px-3 py-2.5">{tombol}</td>
      </tr>

      {/* Mobile Card */}
      <div className={cn('sm:hidden rounded-2xl border p-3.5 space-y-2.5 transition-all', terpilih ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-background border-border')}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn('font-black text-sm', terpilih ? 'text-emerald-700' : 'text-foreground')}>{item.nama}</p>
            <p className="text-xs text-muted-foreground">{item.nis} · {item.info}</p>
          </div>
          {terpilih && <Badge className="shrink-0 text-[10px] font-black bg-emerald-500/10 text-emerald-700 border border-emerald-400/30">✓ Terpilih</Badge>}
        </div>
        {sesiPills}
        {tombol}
      </div>
    </>
  )
}

export default function VerifikasiAbsenPage() {
  const confirm = useConfirm()
  const [list, setList]           = useState<AbsenItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [drafts, setDrafts]       = useState<Record<string, VonisType>>({})
  const [isSaving, setIsSaving]   = useState(false)
  const [page, setPage]           = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]       = useState('')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  const loadData = useCallback(async () => {
    setLoading(true); setDrafts({})
    try { setList(await getAntrianVerifikasi()); setHasLoaded(true); setPage(1) }
    finally { setLoading(false) }
  }, [])

  const handleSelect = (santriId: string, v: VonisType) =>
    setDrafts(prev => prev[santriId] === v
      ? (({ [santriId]: _, ...rest }) => rest)(prev)
      : { ...prev, [santriId]: v }
    )

  const asramaList = Array.from(new Set(list.map(i => i.info.split(' / ')[0]).filter(Boolean))).sort()
  const filtered = list.filter(i => {
    if (filterAsrama !== 'SEMUA' && !i.info.startsWith(filterAsrama)) return false
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase()) && !i.nis.includes(search)) return false
    return true
  })

  const handlePilihSemua = (v: VonisType) => {
    const next: Record<string, VonisType> = {}
    filtered.forEach(i => { next[i.santri_id] = v })
    setDrafts(prev => ({ ...prev, ...next }))
  }

  const handleSimpan = async () => {
    const ids = Object.keys(drafts)
    if (!ids.length) return
    if (!await confirm(`Simpan keputusan untuk ${ids.length} santri?`)) return
    setIsSaving(true)
    const payload = ids.map(id => ({ santriId: id, items: list.find(i => i.santri_id === id)!.items, vonis: drafts[id] }))
    const res = await simpanVerifikasiMassal(payload)
    setIsSaving(false)
    if (res?.error) { toast.error('Gagal', { description: res.error }); return }
    toast.success('Tersimpan', { description: `${ids.length} santri berhasil diproses.` })
    setList(prev => prev.filter(i => !drafts[i.santri_id]))
    setDrafts({}); setPage(1)
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalDrafts = Object.keys(drafts).length

  return (
    <div className="max-w-5xl mx-auto pb-32 space-y-5 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-violet-500/10 rounded-xl text-violet-600"><Gavel className="w-5 h-5"/></div>
            Verifikasi Sidang Absensi
          </h1>
          <p className="text-sm text-muted-foreground ml-[3.25rem]">Tetapkan status alfa santri secara massal</p>
        </div>
        <Button onClick={loadData} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl gap-2 shadow-sm self-start sm:self-auto">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')}/>
          {hasLoaded ? 'Perbarui' : 'Tampilkan Antrian'}
        </Button>
      </div>

      {/* Empty States */}
      {!hasLoaded && !loading && (
        <Card className="border-border shadow-sm">
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <Gavel className="w-12 h-12 text-violet-500/20"/>
            <p className="text-muted-foreground font-medium text-sm">Klik <strong>Tampilkan Antrian</strong> untuk mulai</p>
          </div>
        </Card>
      )}
      {loading && (
        <Card className="border-border shadow-sm py-16 text-center flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600"/>
          <p className="text-muted-foreground text-sm font-medium">Memuat antrian...</p>
        </Card>
      )}
      {hasLoaded && !loading && list.length === 0 && (
        <Card className="border-border shadow-sm">
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400"/>
            <p className="font-black text-foreground">Semua Beres!</p>
            <p className="text-muted-foreground text-sm">Tidak ada antrian yang perlu diverifikasi.</p>
          </div>
        </Card>
      )}

      {hasLoaded && !loading && list.length > 0 && (
        <>
          {/* Toolbar */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 font-black border-border">
                  <Users className="w-3.5 h-3.5"/> {list.length} antrian
                </Badge>
                {totalDrafts > 0 && (
                  <Badge className="gap-1 font-black bg-emerald-500/10 text-emerald-700 border border-emerald-400/30">
                    <CheckCircle className="w-3.5 h-3.5"/> {totalDrafts} dipilih
                  </Badge>
                )}
                <div className="flex-1"/>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-medium">Pilih semua:</span>
                  {[
                    { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',  cls: 'bg-rose-500/10 text-rose-700 border-rose-400/30 hover:bg-rose-500/20' },
                    { v: 'SAKIT'      as VonisType, label: 'Sakit', cls: 'bg-amber-500/10 text-amber-700 border-amber-400/30 hover:bg-amber-500/20' },
                    { v: 'IZIN'       as VonisType, label: 'Izin',  cls: 'bg-blue-500/10 text-blue-700 border-blue-400/30 hover:bg-blue-500/20' },
                  ].map(({ v, label, cls }) => (
                    <button key={v} onClick={() => handlePilihSemua(v)}
                      className={cn('border px-2.5 py-1 rounded-lg text-[10px] font-black transition-all active:scale-95', cls)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {asramaList.length > 1 && (
                  <Select value={filterAsrama} onValueChange={(v) => { if (v) { setFilterAsrama(v); setPage(1) } }}>
                    <SelectTrigger className="w-44 h-9 shadow-none bg-muted/20 focus:ring-violet-500 font-bold text-xs">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMUA" className="font-medium">Semua Asrama</SelectItem>
                      {asramaList.map(a => <SelectItem key={a} value={a} className="font-medium">{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex gap-2 flex-1 min-w-[180px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
                    <Input type="text" placeholder="Cari nama atau NIS..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
                      className="pl-9 h-9 shadow-none bg-muted/20 focus-visible:ring-violet-500"/>
                  </div>
                  <Button type="submit" size="sm" className="rounded-xl font-black h-9 shadow-none">Cari</Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span><strong className="text-foreground">{filtered.length}</strong> santri</span>
              {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
            </div>
          )}

          {/* Table (desktop) + Cards (mobile) */}
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/60">
                    <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center w-8">No</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">Nama Santri</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">Sesi Alfa</th>
                    <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">Vonis</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <BarisAbsen key={item.santri_id} item={item} no={(page - 1) * PAGE_SIZE + i + 1}
                      vonis={drafts[item.santri_id]} onSelect={handleSelect}/>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden p-3 space-y-2.5">
              {paged.map((item, i) => (
                <BarisAbsen key={item.santri_id} item={item} no={(page - 1) * PAGE_SIZE + i + 1}
                  vonis={drafts[item.santri_id]} onSelect={handleSelect}/>
              ))}
            </div>
            {paged.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm font-medium">Tidak ada data yang cocok.</div>
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-xl font-bold shadow-none gap-1">
                <ChevronLeft className="w-4 h-4"/> Sebelumnya
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={cn('w-9 h-9 rounded-xl text-sm font-black transition-all', pg === page ? 'bg-violet-600 text-white' : 'border border-border text-foreground hover:bg-muted/50')}>
                      {pg}
                    </button>
                  )
                })}
              </div>
              <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-xl font-bold shadow-none gap-1">
                Berikutnya <ChevronRight className="w-4 h-4"/>
              </Button>
            </div>
          )}
        </>
      )}

      {/* Floating Save */}
      {totalDrafts > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 animate-in slide-in-from-bottom-4">
          <button onClick={handleSimpan} disabled={isSaving}
            className="w-full bg-foreground text-background py-4 px-5 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-foreground/90 transition-all active:scale-95 disabled:opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-sm">{totalDrafts}</div>
              <div className="text-left">
                <p className="font-black text-sm leading-none">Simpan Putusan</p>
                <p className="text-[11px] text-background/50 mt-0.5">{totalDrafts} santri akan diproses</p>
              </div>
            </div>
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400"/> : <Save className="w-5 h-5 text-emerald-400"/>}
          </button>
        </div>
      )}
    </div>
  )
}
