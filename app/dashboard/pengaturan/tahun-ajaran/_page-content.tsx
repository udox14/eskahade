'use client'

import { useState, useEffect } from 'react'
import { 
  CalendarDays, Plus, CheckCircle, Circle, Trash2, 
  Loader2, BookOpen, Users, AlertTriangle, ShieldCheck,
  History, Settings2, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getTahunAjaranList,
  tambahTahunAjaran,
  aktifkanTahunAjaran,
  hapusTahunAjaran,
} from './actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export default function TahunAjaranPage() {
  const confirm = useConfirm()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nama, setNama] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loadingAktif, setLoadingAktif] = useState<number | null>(null)
  const [loadingHapus, setLoadingHapus] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const data = await getTahunAjaranList()
    setList(data)
    setLoading(false)
  }

  const handleTambah = async () => {
    if (!nama.trim()) return toast.error('Isi nama tahun ajaran dulu.')
    setIsSaving(true)
    const res = await tambahTahunAjaran(nama.trim())
    setIsSaving(false)
    if ('error' in res) toast.error(res.error)
    else {
      toast.success(`Tahun ajaran "${nama}" berhasil ditambahkan.`)
      setNama('')
      loadData()
    }
  }

  const handleAktifkan = async (id: number, nama: string) => {
    if (!await confirm(`Aktifkan tahun ajaran "${nama}"?\n\nSemua kelas baru yang dibuat akan otomatis masuk ke tahun ajaran ini.`)) return
    setLoadingAktif(id)
    const res = await aktifkanTahunAjaran(id)
    setLoadingAktif(null)
    if ('error' in res) toast.error(res.error)
    else {
      toast.success(`Tahun ajaran "${nama}" sekarang aktif.`)
      loadData()
    }
  }

  const handleHapus = async (id: number, nama: string) => {
    if (!await confirm(`Hapus tahun ajaran "${nama}"?\nPastikan tidak ada kelas terkait.`)) return
    setLoadingHapus(id)
    const res = await hapusTahunAjaran(id)
    setLoadingHapus(null)
    if ('error' in res) toast.error(res.error)
    else {
      toast.success('Tahun ajaran dihapus.')
      loadData()
    }
  }

  const aktif = list.find(t => t.is_active)

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
            <CalendarDays className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Tahun Ajaran</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Kelola Periode Akademik Aktif</p>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* INFO AKTIF (ENHANCED) */}
      {aktif && (
        <Alert className="bg-emerald-500/5 border-emerald-500/20 text-emerald-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Tahun Ajaran Aktif</AlertTitle>
          <AlertDescription className="flex items-end justify-between gap-4">
            <div>
              <p className="text-lg font-black tracking-tight">{aktif.nama}</p>
              <div className="flex items-center gap-3 mt-1 font-bold text-[10px] uppercase tracking-widest text-emerald-700/70">
                 <span className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> {aktif.jumlah_kelas} Kelas</span>
                 <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {aktif.jumlah_santri} Santri</span>
              </div>
            </div>
            <Sparkles className="w-8 h-8 text-emerald-500/20 opacity-50" />
          </AlertDescription>
        </Alert>
      )}

      {/* GRID CONTENT */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* FORM TAMBAH (MODERNIZED) */}
        <Card className="border-border shadow-sm overflow-hidden bg-muted/5">
          <CardHeader className="bg-muted/30 border-b py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-700">
               <Plus className="w-4 h-4"/> Tambah Periode
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Input tahun ajaran baru ke sistem.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <Input
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTambah()}
                  placeholder="Contoh: 2025/2026"
                  className="h-11 rounded-xl bg-background border-border font-black text-sm focus-visible:ring-emerald-500"
                />
                <p className="text-[10px] text-muted-foreground ml-1 font-bold uppercase tracking-widest opacity-50">Format: YYYY/YYYY (e.g. 2024/2025)</p>
              </div>
              <Button
                onClick={handleTambah}
                disabled={isSaving || !nama.trim()}
                className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20 gap-2 transition-transform active:scale-95 shrink-0"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                TAMBAH
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DAFTAR TAHUN AJARAN */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-700">
                 <History className="w-4 h-4"/> Riwayat Periode
              </CardTitle>
            </div>
            <Settings2 className="w-4 h-4 text-slate-400 opacity-50" />
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Periods...</p>
              </div>
            ) : list.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-border">
                  <CalendarDays className="w-8 h-8 text-muted-foreground opacity-20" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Empty Historical Data</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 divide-y divide-border/50">
                {list.map(ta => (
                  <div
                    key={ta.id}
                    className={cn(
                      "px-6 py-5 flex items-center justify-between gap-4 transition-all hover:bg-muted/30 group",
                      ta.is_active ? 'bg-emerald-500/5' : ''
                    )}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500",
                        ta.is_active 
                          ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] border-emerald-400 text-white scale-110' 
                          : 'bg-white border-border text-slate-300 group-hover:border-slate-400'
                      )}>
                        {ta.is_active ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5 stroke-[1.5]" />}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-base font-black tracking-tight uppercase",
                            ta.is_active ? 'text-emerald-900' : 'text-slate-700'
                          )}>
                            {ta.nama}
                          </span>
                          {ta.is_active && (
                            <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/20 text-[9px] font-black tracking-[0.1em] px-2 py-0">AKTIF</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 font-bold text-[10px] uppercase tracking-widest text-muted-foreground transition-opacity group-hover:opacity-100 opacity-60">
                           <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-emerald-600/50"/> {ta.jumlah_kelas} Kelas</span>
                           <span className="flex items-center gap-1"><Users className="w-3 h-3 text-emerald-600/50"/> {ta.jumlah_santri} Santri</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!ta.is_active && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAktifkan(ta.id, ta.nama)}
                            disabled={loadingAktif === ta.id}
                            className="h-9 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase border-emerald-500/20 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all active:scale-95 gap-1.5"
                          >
                            {loadingAktif === ta.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            AKTIFKAN
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleHapus(ta.id, ta.nama)}
                            disabled={loadingHapus === ta.id}
                            className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"
                            title="Hapus tahun ajaran"
                          >
                            {loadingHapus === ta.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CATATAN (MODERNIZED ALERT) */}
        <Alert variant="warning" className="bg-amber-500/5 border-amber-500/20 text-amber-900 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-2">Protokol Periode Akademik</AlertTitle>
          <AlertDescription>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[10px] font-bold uppercase tracking-widest opacity-80 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">●</span>
                <span>Data tahun sebelumnya tetap tersimpan & aman di arsip sistem.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>●</span>
                <span>Wajib membuat kelas baru setelah mengaktifkan periode baru.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>●</span>
                <span>Semua transaksi & absensi akan terasosiasi dengan periode aktif.</span>
              </li>
              <li className="flex items-start gap-2">
                <span>●</span>
                <span>Periode hanya bisa dihapus jika belum memiliki relasi data kelas.</span>
              </li>
            </ul>
          </AlertDescription>
        </Alert>

      </div>
    </div>
  )
}
