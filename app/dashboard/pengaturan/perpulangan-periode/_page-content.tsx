'use client'

import { useState, useEffect } from 'react'
import {
  getAllPeriode, tambahPeriode, aktifkanPeriode,
  nonaktifkanPeriode, perpanjangTglDatang, hapusPeriode,
} from './actions'
import {
  CalendarRange, Plus, CheckCircle, XCircle, Trash2,
  CalendarClock, Loader2, ChevronDown, ChevronUp,
  PlaneTakeoff, PlaneLanding, History, Sparkles, Clock, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'

function fmtTgl(s: string) {
  try { return format(new Date(s), 'dd MMM yyyy', { locale: localeId }) }
  catch { return s }
}

// ─── Form tambah periode ──────────────────────────────────────────────────────
function FormTambah({ onSuccess }: { onSuccess: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nama_periode: '',
    tgl_mulai_pulang: today,
    tgl_selesai_pulang: today,
    tgl_mulai_datang: today,
    tgl_selesai_datang: today,
  })

  const handleSubmit = async () => {
    if (!form.nama_periode.trim()) return toast.warning('Nama periode harus diisi')
    setLoading(true)
    const res = await tambahPeriode(form)
    setLoading(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Periode berhasil ditambahkan')
    setOpen(false)
    setForm({ nama_periode: '', tgl_mulai_pulang: today, tgl_selesai_pulang: today, tgl_mulai_datang: today, tgl_selesai_datang: today })
    onSuccess()
  }

  const field = (label: string, icon: any, key: keyof typeof form, type = 'text') => {
    const Icon = icon
    return (
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
           <Icon className="w-3 h-3 text-blue-500"/> {label}
        </Label>
        <Input
          type={type}
          value={form[key]}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          className="h-10 rounded-xl bg-background border-border font-bold focus-visible:ring-blue-500"
        />
      </div>
    )
  }

  return (
    <Card className={cn("border-border shadow-sm overflow-hidden transition-all duration-300", open ? "ring-2 ring-blue-500/20" : "")}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors group"
      >
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
          <Plus className="w-4 h-4" />
        </div>
        <span className="font-black text-foreground text-xs uppercase tracking-widest flex-1 text-left">Internalize New Period</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <CardContent className="px-5 pb-6 pt-2 space-y-6 animate-in slide-in-from-top-4 duration-300">
          <Separator className="mb-4 opacity-50" />
          
          {field('Nama Periode (e.g. Libur Idul Fitri 1446H)', Sparkles, 'nama_periode')}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
               <p className="text-[9px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <PlaneTakeoff className="w-3 h-3"/> Window Perpulangan
               </p>
               <div className="grid grid-cols-1 gap-4">
                  {field('Mulai Pulang', Clock, 'tgl_mulai_pulang', 'date')}
                  {field('Selesai Pulang', Clock, 'tgl_selesai_pulang', 'date')}
               </div>
            </div>

            <div className="space-y-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
               <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <PlaneLanding className="w-3 h-3"/> Window Kedatangan
               </p>
               <div className="grid grid-cols-1 gap-4">
                  {field('Mulai Datang', Clock, 'tgl_mulai_datang', 'date')}
                  {field('Selesai Datang', Clock, 'tgl_selesai_datang', 'date')}
               </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !form.nama_periode.trim()}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-500/20 gap-2 transition-transform active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            SIMPAN PERIODE SEKARANG
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Card periode ─────────────────────────────────────────────────────────────
function CardPeriode({ p, onRefresh }: { p: any; onRefresh: () => void }) {
  const [loadingAktif, setLoadingAktif] = useState(false)
  const [loadingHapus, setLoadingHapus] = useState(false)
  const [showPerpanjang, setShowPerpanjang] = useState(false)
  const [tglBaru, setTglBaru] = useState(p.tgl_selesai_datang)
  const [loadingPerpanjang, setLoadingPerpanjang] = useState(false)

  const handleAktifkan = async () => {
    setLoadingAktif(true)
    const res = p.is_active ? await nonaktifkanPeriode(p.id) : await aktifkanPeriode(p.id)
    setLoadingAktif(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(p.is_active ? 'Periode dinonaktifkan' : 'Periode diaktifkan')
    onRefresh()
  }

  const handleHapus = async () => {
    setLoadingHapus(true)
    const res = await hapusPeriode(p.id)
    setLoadingHapus(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Periode berhasil dihapus')
    onRefresh()
  }

  const handlePerpanjang = async () => {
    setLoadingPerpanjang(true)
    const res = await perpanjangTglDatang(p.id, tglBaru)
    setLoadingPerpanjang(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Batas kedatangan berhasil diperpanjang')
    setShowPerpanjang(false)
    onRefresh()
  }

  return (
    <Card className={cn(
      "border-border shadow-sm overflow-hidden transition-all duration-500 relative group",
      p.is_active ? 'ring-1 ring-emerald-500/30 bg-emerald-500/[0.02]' : 'bg-card'
    )}>
      {p.is_active && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
      )}
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className={cn("text-lg font-black tracking-tight uppercase leading-none", p.is_active ? 'text-emerald-950' : 'text-foreground')}>
                {p.nama_periode}
              </h3>
              <Badge 
                variant={p.is_active ? "default" : "outline"} 
                className={cn(
                  "px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase",
                  p.is_active ? "bg-emerald-600 text-white border-none shadow-lg shadow-emerald-500/20" : "text-muted-foreground opacity-60"
                )}
              >
                {p.is_active ? 'OPERATIONAL' : 'DORMANT'}
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 flex items-center gap-1.5">
               <History className="w-3 h-3"/> Logged on {fmtTgl(p.created_at)}
            </p>
          </div>
          {!p.is_active && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHapus}
              disabled={loadingHapus}
              className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
            >
              {loadingHapus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="relative overflow-hidden group/item p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/10 flex flex-col justify-between h-24 transition-colors hover:bg-amber-500/[0.07]">
            <PlaneTakeoff className="absolute -right-2 -bottom-2 w-16 h-16 text-amber-500 opacity-5 transition-transform group-hover/item:scale-125" />
            <div>
              <p className="text-[9px] font-black text-amber-600/70 uppercase tracking-[0.2em] mb-1">Departure Window</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-900 tracking-tight">{fmtTgl(p.tgl_mulai_pulang)}</span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-amber-700/60 uppercase tracking-widest">Target Return: {fmtTgl(p.tgl_selesai_pulang)}</p>
          </div>

          <div className="relative overflow-hidden group/item p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 flex flex-col justify-between h-24 transition-colors hover:bg-emerald-500/[0.07]">
            <PlaneLanding className="absolute -right-2 -bottom-2 w-16 h-16 text-emerald-500 opacity-5 transition-transform group-hover/item:scale-125" />
            <div>
              <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-[0.2em] mb-1">Arrival Window</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-emerald-900 tracking-tight">{fmtTgl(p.tgl_mulai_datang)}</span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">Strict Deadline: {fmtTgl(p.tgl_selesai_datang)}</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center flex-wrap gap-2 pt-2">
          <Button
            onClick={handleAktifkan}
            disabled={loadingAktif}
            className={cn(
              "h-10 rounded-xl text-[10px] font-black tracking-[0.15em] uppercase px-5 transition-all shadow-sm active:scale-95 gap-2",
              p.is_active 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
            )}
          >
            {loadingAktif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {p.is_active ? 'ABORT PERIOD' : 'DEPLOY PERIOD'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowPerpanjang(o => !o)}
            className="h-10 rounded-xl text-[10px] font-black tracking-[0.15em] uppercase px-5 border-blue-500/20 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-all active:scale-95 gap-2 ml-auto"
          >
            <CalendarClock className="w-4 h-4" />
            EXTEND DEADLINE
          </Button>
        </div>

        {/* Perpanjang Drawer-like area */}
        {showPerpanjang && (
          <div className="mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-blue-600"/>
               <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Perpanjang Batas Kedatangan</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={tglBaru}
                onChange={e => setTglBaru(e.target.value)}
                className="flex-1 h-10 rounded-xl bg-background border-border font-bold focus-visible:ring-blue-500"
              />
              <Button
                onClick={handlePerpanjang}
                disabled={loadingPerpanjang}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 shrink-0"
              >
                {loadingPerpanjang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'CONFIRM'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PeriodePerpulanganPage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setList(await getAllPeriode())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-2xl mx-auto px-2 pb-32 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 shadow-sm border border-blue-500/10">
          <CalendarRange className="w-6 h-6"/>
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight uppercase leading-none">Management Periode</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70 mt-1">Jadwal Perpulangan & Kedatangan Santri</p>
        </div>
      </div>

      <Separator className="opacity-50" />

      <FormTambah onSuccess={load} />

      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between px-1">
           <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5"/> Periodic Logs
           </h2>
           <Badge variant="outline" className="text-[9px] font-black opacity-50">{list.length} Records</Badge>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Synchronizing Scheduling Assets...</p>
          </div>
        ) : list.length === 0 ? (
          <Card className="border-dashed border-2 py-16 flex flex-col items-center justify-center text-center opacity-40">
            <CalendarRange className="w-12 h-12 mb-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Active Scheduling Intervals</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {list.map(p => <CardPeriode key={p.id} p={p} onRefresh={load} />)}
          </div>
        )}
      </div>
    </div>
  )
}
