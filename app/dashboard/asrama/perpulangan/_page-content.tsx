'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSessionInfo, getPeriodeAktif, getKamarsPerpulangan,
  getDataKamarPerpulangan, konfirmasiPulang, batalPulang,
  konfirmasiRombonganKamar, updateJenisPulang, updateKeterangan,
  konfirmasiDatang, batalDatang,
} from './actions'
import {
  LogOut, Home, ChevronLeft, ChevronRight, Loader2,
  Bus, Car, Users, CheckCircle2, AlertCircle, CalendarRange,
  RefreshCw, PenLine, Plane, ArrowLeft, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
type Tab = 'pulang' | 'datang'

// ─── Badge Components ─────────────────────────────────────────────────────────
function BadgeStatusPulang({ status }: { status: string }) {
  if (status === 'PULANG')
    return <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-300/50 hover:bg-amber-500/20 shadow-none font-black">PULANG</Badge>
  return <Badge variant="outline" className="text-[10px] font-black text-muted-foreground shadow-none">BELUM</Badge>
}

function BadgeStatusDatang({ status }: { status: string }) {
  if (status === 'SUDAH')
    return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-300/50 hover:bg-emerald-500/20 shadow-none font-black">SUDAH</Badge>
  if (status === 'TELAT')
    return <Badge variant="destructive" className="text-[10px] font-black shadow-none">TELAT</Badge>
  if (status === 'VONIS')
    return <Badge className="text-[10px] bg-slate-500/10 text-slate-600 border border-slate-300/50 hover:bg-slate-500/20 shadow-none font-black">DIVONIS</Badge>
  return <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-300/50 hover:bg-amber-500/20 shadow-none font-black">BELUM</Badge>
}

function BadgeJenis({ jenis, onClick }: { jenis: string | null; onClick: () => void }) {
  if (jenis === 'ROMBONGAN')
    return (
      <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 border border-teal-300/60 active:scale-95 transition-transform hover:bg-teal-500/20">
        <Bus className="w-3 h-3" /> ROMBONGAN
      </button>
    )
  if (jenis === 'DIJEMPUT')
    return (
      <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 border border-purple-300/60 active:scale-95 transition-transform hover:bg-purple-500/20">
        <Car className="w-3 h-3" /> DIJEMPUT
      </button>
    )
  return (
    <button onClick={onClick} className="text-[10px] font-black px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border active:scale-95 transition-transform hover:bg-muted">
      BELUM DIATUR
    </button>
  )
}

// ─── Row santri tab Perpulangan ───────────────────────────────────────────────
function RowPulang({
  santri, periodeId, busy, onKonfirmasi, onBatal, onToggleJenis, onKetChange,
}: {
  santri: any; periodeId: number; busy: boolean
  onKonfirmasi: (logId: string, ket: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
  onToggleJenis: (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => Promise<void>
  onKetChange: (logId: string, ket: string) => void
}) {
  const [ket, setKet] = useState(santri.keterangan || '')
  const [editKet, setEditKet] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sudahPulang = santri.status_pulang === 'PULANG'

  const handleToggleJenis = () => {
    const next = santri.jenis_pulang === 'ROMBONGAN' ? 'DIJEMPUT' : 'ROMBONGAN'
    onToggleJenis(santri.log_id, next as 'ROMBONGAN' | 'DIJEMPUT')
  }

  const handleKetBlur = () => {
    setEditKet(false)
    if (ket !== (santri.keterangan || '')) {
      onKetChange(santri.log_id, ket)
    }
  }

  return (
    <div className={cn(
      "p-3.5 border-b border-border/60 last:border-b-0 transition-colors",
      sudahPulang ? "bg-amber-500/5 dark:bg-amber-900/10" : "bg-card"
    )}>
      <div className="flex items-start gap-3">
        {/* Info santri */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-foreground text-sm leading-tight truncate">{santri.nama_lengkap}</p>
            <BadgeStatusPulang status={santri.status_pulang} />
          </div>
          <p className="text-xs text-muted-foreground">NIS {santri.nis} · Kamar {santri.kamar}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <BadgeJenis jenis={santri.jenis_pulang} onClick={handleToggleJenis} />
            {sudahPulang && santri.tgl_pulang && (
              <span className="text-[10px] font-bold text-muted-foreground">
                {new Date(santri.tgl_pulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </span>
            )}
          </div>

          {/* Keterangan editor */}
          {editKet ? (
            <Input
              ref={inputRef}
              value={ket}
              onChange={e => setKet(e.target.value)}
              onBlur={handleKetBlur}
              placeholder="Keterangan (opsional)..."
              className="mt-2 h-8 text-xs focus-visible:ring-amber-500 shadow-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditKet(true)}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <PenLine className="w-3 h-3" />
              {ket ? <span className="text-foreground font-medium">{ket}</span> : <span className="italic">Tambah keterangan...</span>}
            </button>
          )}
        </div>

        {/* Tombol aksi */}
        <div className="shrink-0 mt-1">
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : sudahPulang ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBatal(santri.log_id)}
              className="text-xs font-bold h-8 shadow-none"
            >
              Batal
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onKonfirmasi(santri.log_id, ket)}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black h-8 shadow-sm"
            >
              PULANG
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Row santri tab Kedatangan ────────────────────────────────────────────────
function RowDatang({
  santri, busy,
  onKonfirmasi, onBatal,
}: {
  santri: any; busy: boolean
  onKonfirmasi: (logId: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
}) {
  const sudahDatang = santri.status_datang === 'SUDAH'
  const isTelat = santri.status_datang === 'TELAT' || santri.status_datang === 'VONIS'

  return (
    <div className={cn(
      "p-3.5 border-b border-border/60 last:border-b-0 transition-colors",
      sudahDatang ? "bg-emerald-500/5 dark:bg-emerald-900/10" : isTelat ? "bg-destructive/5" : "bg-card"
    )}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-foreground text-sm truncate">{santri.nama_lengkap}</p>
            <BadgeStatusDatang status={santri.status_datang} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">{santri.nis}</p>
            <BadgeJenis jenis={santri.jenis_pulang} onClick={() => {}} />
          </div>
          {santri.keterangan && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{santri.keterangan}"</p>
          )}
          {sudahDatang && santri.tgl_datang && (
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">
              Datang: {new Date(santri.tgl_datang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </p>
          )}
        </div>

        <div className="shrink-0">
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : isTelat ? (
            <Badge variant="destructive" className="text-xs font-black">Telat</Badge>
          ) : sudahDatang ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBatal(santri.log_id)}
              className="text-xs font-bold h-8 shadow-none"
            >
              Batal
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onKonfirmasi(santri.log_id)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black h-8 shadow-sm"
            >
              SUDAH
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PerpulanganPage() {
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [asramaBinaan, setAsramaBinaan] = useState<string | null>(null)
  const [role, setRole] = useState<string>('')

  const [periode, setPeriode] = useState<any>(null)
  const [loadingPeriode, setLoadingPeriode] = useState(true)

  const [kamars, setKamars] = useState<string[]>([])
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [kamarIdx, setKamarIdx] = useState(0)

  const [santriList, setSantriList] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [tab, setTab] = useState<Tab>('pulang')
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

  // ── Init ──
  useEffect(() => {
    getSessionInfo().then(s => {
      if (!s) return
      setRole(s.role)
      if (s.asrama_binaan) {
        setAsramaBinaan(s.asrama_binaan)
        setAsrama(s.asrama_binaan)
      }
    })
    getPeriodeAktif().then(p => {
      setPeriode(p)
      setLoadingPeriode(false)
    })
  }, [])

  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setSantriList([])
    setKamarCache({})
    setKamarIdx(0)
    getKamarsPerpulangan(asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama])

  useEffect(() => {
    if (!kamars.length || !periode?.id) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    const cacheKey = `${asrama}__${kamar}__${periode.id}`
    if (kamarCache[cacheKey]) {
      setSantriList(kamarCache[cacheKey])
      return
    }

    setLoadingKamar(true)
    setSantriList([])
    getDataKamarPerpulangan(asrama, kamar, periode.id).then(res => {
      setSantriList(res)
      setKamarCache(prev => ({ ...prev, [cacheKey]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars, asrama, periode])

  const activeKamar = kamars[kamarIdx] ?? ''

  const updateSantriState = useCallback((logId: string, patch: Partial<any>) => {
    const cacheKey = `${asrama}__${activeKamar}__${periode?.id}`
    setSantriList(prev => {
      const updated = prev.map(s => s.log_id === logId ? { ...s, ...patch } : s)
      setKamarCache(c => ({ ...c, [cacheKey]: updated }))
      return updated
    })
  }, [asrama, activeKamar, periode])

  const setBusy = (logId: string, val: boolean) =>
    setBusyMap(prev => ({ ...prev, [logId]: val }))

  const handleKonfirmasiPulang = async (logId: string, ket: string) => {
    setBusy(logId, true)
    const res = await konfirmasiPulang(logId, periode.id, ket)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_pulang: 'PULANG', keterangan: ket || null, tgl_pulang: new Date().toISOString() })
    toast.success('Konfirmasi pulang tersimpan')
  }

  const handleBatalPulang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalPulang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_pulang: 'BELUM', keterangan: null, tgl_pulang: null })
    toast.success('Dibatalkan')
  }

  const handleToggleJenis = async (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => {
    const res = await updateJenisPulang(logId, jenisBaru)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { jenis_pulang: jenisBaru })
  }

  const handleKetChange = useCallback(async (logId: string, ket: string) => {
    await updateKeterangan(logId, ket)
    updateSantriState(logId, { keterangan: ket || null })
  }, [updateSantriState])

  const handleKonfirmasiRombongan = async () => {
    if (!periode?.id || !activeKamar) return
    const res = await konfirmasiRombonganKamar(periode.id, asrama, activeKamar, 'Rombongan')
    if ('error' in res) { toast.error(res.error); return }
    if (res.count === 0) { toast.info('Tidak ada santri rombongan yang belum pulang'); return }
    setSantriList(prev => {
      const updated = prev.map(s =>
        s.jenis_pulang === 'ROMBONGAN' && s.status_pulang === 'BELUM'
          ? { ...s, status_pulang: 'PULANG', keterangan: 'Rombongan', tgl_pulang: new Date().toISOString() }
          : s
      )
      const cacheKey = `${asrama}__${activeKamar}__${periode.id}`
      setKamarCache(c => ({ ...c, [cacheKey]: updated }))
      return updated
    })
    toast.success(`${res.count} santri rombongan dikonfirmasi pulang`)
  }

  const handleKonfirmasiDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await konfirmasiDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_datang: 'SUDAH', tgl_datang: new Date().toISOString() })
    toast.success('Kedatangan dikonfirmasi')
  }

  const handleBatalDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_datang: 'BELUM', tgl_datang: null })
    toast.success('Dibatalkan')
  }

  const sudahPulang = santriList.filter(s => s.status_pulang === 'PULANG').length
  const belumPulang = santriList.filter(s => s.status_pulang === 'BELUM').length
  const sudahDatang = santriList.filter(s => s.status_datang === 'SUDAH').length
  const belumDatang = santriList.filter(s => s.status_pulang === 'PULANG' && s.status_datang === 'BELUM').length
  const listDatang = santriList.filter(s => s.status_pulang === 'PULANG')
  const adaRombonganBelum = santriList.some(s => s.jenis_pulang === 'ROMBONGAN' && s.status_pulang === 'BELUM')

  if (loadingPeriode) {
    return (
      <div className="flex justify-center items-center py-32 gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Memuat data...</span>
      </div>
    )
  }

  if (!periode) {
    return (
      <div className="max-w-lg mx-auto pt-10 px-4">
        <Card className="p-8 text-center space-y-3 shadow-sm border-border">
          <CalendarRange className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-black text-foreground">Belum Ada Periode Aktif</p>
          <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto">Dewan santri atau keamanan belum mengatur periode perpulangan yang aktif.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-32 select-none animate-in fade-in slide-in-from-bottom-4">

      {/* ── HEADER HERO ── */}
      <div className="bg-slate-950 border-b border-slate-800 text-slate-50 px-5 pt-5 pb-6 rounded-b-3xl shadow-2xl shadow-slate-900/30 mb-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/5 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500/20 pointer-events-none"/>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-400/10 rounded-lg">
              <LogOut className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="font-black text-lg">Perpulangan & Kedatangan</h1>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 space-y-1">
            <p className="font-black text-amber-300 text-sm">{periode.nama_periode}</p>
            <p className="text-xs text-slate-400 font-medium">✈️ Pulang: {periode.tgl_mulai_pulang} s/d {periode.tgl_selesai_pulang}</p>
            <p className="text-xs text-slate-400 font-medium">🏠 Datang: {periode.tgl_mulai_datang} s/d {periode.tgl_selesai_datang}</p>
          </div>

          {!asramaBinaan ? (
            <Select value={asrama} onValueChange={(val) => { if (val) setAsrama(val) }}>
              <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-11 rounded-2xl font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <Home className="w-4 h-4 text-slate-300" /><span className="font-black">{asramaBinaan}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="px-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
          <TabsList className="w-full h-12 bg-muted/60 p-1.5 rounded-2xl border border-border">
            <TabsTrigger value="pulang" className="flex-1 font-black rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
              <span>✈️</span> Perpulangan
            </TabsTrigger>
            <TabsTrigger value="datang" className="flex-1 font-black rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
              <span>🏠</span> Kedatangan
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── NAVIGASI KAMAR ── */}
        {loadingKamars ? (
          <div className="flex justify-center py-4 gap-2 text-muted-foreground text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar kamar...
          </div>
        ) : kamars.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4 font-medium">Tidak ada kamar ditemukan.</p>
        ) : (
          <div className="mb-4 space-y-3">
            <Card className="shadow-sm border-border bg-card overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setKamarIdx(i => Math.max(0, i - 1))}
                    disabled={kamarIdx === 0}
                    className="h-9 w-9 rounded-xl disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="text-center">
                    <p className="font-black text-foreground">Kamar {activeKamar}</p>
                    <p className="text-xs text-muted-foreground font-medium">{kamarIdx + 1} / {kamars.length}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))}
                    disabled={kamarIdx === kamars.length - 1}
                    className="h-9 w-9 rounded-xl disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats kamar */}
            {!loadingKamar && santriList.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {tab === 'pulang' ? (
                  <>
                    <div className="bg-amber-500/10 border border-amber-300/40 rounded-2xl px-3 py-3 text-center">
                      <p className="text-xl font-black text-amber-700 tabular-nums">{sudahPulang}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">Sudah Pulang</p>
                    </div>
                    <div className="bg-muted/40 border border-border/60 rounded-2xl px-3 py-3 text-center">
                      <p className="text-xl font-black text-foreground tabular-nums">{belumPulang}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Belum Pulang</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-emerald-500/10 border border-emerald-300/40 rounded-2xl px-3 py-3 text-center">
                      <p className="text-xl font-black text-emerald-700 tabular-nums">{sudahDatang}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-0.5">Sudah Datang</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-300/40 rounded-2xl px-3 py-3 text-center">
                      <p className="text-xl font-black text-amber-700 tabular-nums">{belumDatang}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">Belum Datang</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── BULK ROMBONGAN ── */}
        {tab === 'pulang' && !loadingKamar && adaRombonganBelum && (
          <div className="mb-4">
            <Button
              onClick={handleKonfirmasiRombongan}
              className="w-full h-12 gap-2 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl shadow-sm"
            >
              <Bus className="w-4 h-4" /> Konfirmasi Semua Rombongan
            </Button>
          </div>
        )}

        {/* ── DAFTAR SANTRI ── */}
        {loadingKamar ? (
          <Card className="shadow-sm border-border flex justify-center items-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Memuat santri...</span>
          </Card>
        ) : santriList.length === 0 ? (
          <Card className="shadow-sm border-border py-12 text-center text-muted-foreground text-sm font-medium">
            Tidak ada santri di kamar ini.
          </Card>
        ) : tab === 'pulang' ? (
          <Card className="shadow-sm border-border overflow-hidden bg-card">
            {santriList.map(s => (
              <RowPulang
                key={s.id}
                santri={s}
                periodeId={periode.id}
                busy={!!busyMap[s.log_id]}
                onKonfirmasi={handleKonfirmasiPulang}
                onBatal={handleBatalPulang}
                onToggleJenis={handleToggleJenis}
                onKetChange={handleKetChange}
              />
            ))}
          </Card>
        ) : listDatang.length === 0 ? (
          <Card className="shadow-sm border-border py-12 text-center text-muted-foreground text-sm font-medium">
            Belum ada santri yang dikonfirmasi pulang di kamar ini.
          </Card>
        ) : (
          <Card className="shadow-sm border-border overflow-hidden bg-card">
            {listDatang.map(s => (
              <RowDatang
                key={s.id}
                santri={s}
                busy={!!busyMap[s.log_id]}
                onKonfirmasi={handleKonfirmasiDatang}
                onBatal={handleBatalDatang}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}