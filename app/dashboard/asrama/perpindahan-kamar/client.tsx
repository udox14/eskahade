'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Home, Settings, Play, CheckCircle, RotateCcw, Users, Crown,
  ChevronDown, ChevronUp, GripVertical, X, Plus, Trash2,
  AlertTriangle, Loader2, Printer, Eye, ArrowRight, Save, LayoutDashboard, Shuffle
} from 'lucide-react'
import {
  getDataPerpindahan, simpanKonfigurasiKamar, generateDraft,
  updateKamarDraft, applyDraft, setKetuaKamar, resetDraft
} from './actions'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

// ── Tipe ──────────────────────────────────────────────────────────────────────
type KamarConfig = { nomor_kamar: string; kuota: number; blok?: string }
type SantriData = {
  id: string; nama_lengkap: string; nis: string; jenis_kelamin: string
  kamar_asli: string | null; sekolah: string | null; kelas_sekolah: string | null
  marhalah_nama: string | null; nama_kelas: string | null
}
type DraftItem = { santri_id: string; kamar_lama: string | null; kamar_baru: string; applied: number }
type KetuaItem = { nomor_kamar: string; santri_id: string; nama_lengkap: string }

// ── Badge status kamar ────────────────────────────────────────────────────────
function KamarStatusBadge({ isi, kuota }: { isi: number; kuota: number }) {
  if (isi === 0) return <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground border-slate-200">Kosong</Badge>
  if (isi > kuota) return <Badge variant="destructive" className="text-[10px]">Over</Badge>
  if (isi === kuota) return <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white">Penuh</Badge>
  return <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white">Normal</Badge>
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PerpindahanClient({
  userRole, asramaBinaan
}: { userRole: string; asramaBinaan: string | null }) {
  const confirm = useConfirm()

  const asramaOptions = asramaBinaan ? [asramaBinaan] : ASRAMA_LIST
  const [asrama, setAsrama] = useState(asramaOptions[0])
  const [tab, setTab] = useState<'plotting' | 'monitoring'>('plotting')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Data
  const [configs, setConfigs] = useState<KamarConfig[]>([])
  const [santriList, setSantriList] = useState<SantriData[]>([])
  const [draftMap, setDraftMap] = useState<Record<string, DraftItem>>({}) 
  const [ketuaMap, setKetuaMap] = useState<Record<string, KetuaItem>>({}) 
  const [isApplied, setIsApplied] = useState(false)

  // UI states
  const [step, setStep] = useState<'config' | 'generate' | 'plotting'>('config')
  const [persenBaru, setPersenBaru] = useState(20)
  const [localKamar, setLocalKamar] = useState<KamarConfig[]>([])
  const [modalKamar, setModalKamar] = useState<string | null>(null)
  const [dragSantriId, setDragSantriId] = useState<string | null>(null)
  const [dragOverKamar, setDragOverKamar] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getDataPerpindahan(asrama)
    setConfigs(res.configs)
    setSantriList(res.santriList)
    
    const dm: Record<string, DraftItem> = {}
    res.drafts.forEach((d: any) => { dm[d.santri_id] = d })
    setDraftMap(dm)
    
    const km: Record<string, KetuaItem> = {}
    res.ketuaList.forEach((k: any) => { km[k.nomor_kamar] = k })
    setKetuaMap(km)
    
    if (res.configs.length === 0) {
      setStep('config')
      setLocalKamar([])
    } else {
      setLocalKamar(res.configs.map((c: any) => ({ nomor_kamar: c.nomor_kamar, kuota: c.kuota, blok: c.blok || '' })))
      setConfigOpen(false)
      if (res.drafts.length > 0) {
        setIsApplied(res.drafts.every((d: any) => d.applied === 1))
        setStep('plotting')
      } else {
        setStep('generate')
      }
    }
    setLoading(false)
  }, [asrama])

  useEffect(() => { load() }, [load])

  // ── Derived ──────────────────────────────────────────────────────────────
  const getSantriDiKamar = (nomor: string) =>
    santriList.filter(s => draftMap[s.id]?.kamar_baru === nomor)

  const santriTanpaDraft = santriList.filter(s => !draftMap[s.id])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSimpanConfig = async () => {
    if (localKamar.length === 0) return toast.error('Tambahkan minimal 1 kamar')
    if (localKamar.some(k => !k.nomor_kamar.trim())) return toast.error('Nomor kamar tidak boleh kosong')
    setSaving(true)
    const res = await simpanKonfigurasiKamar(asrama, localKamar)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Konfigurasi kamar disimpan')
    await load()
  }

  const handleGenerate = async () => {
    setSaving(true)
    const toastId = toast.loading('Mendistribusikan santri...')
    const res = await generateDraft(asrama, persenBaru)
    toast.dismiss(toastId)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Draft dibuat untuk ${(res as any).total} santri`)
    await load()
  }

  const handlePindah = async (santriId: string, kamarBaru: string) => {
    setDraftMap(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], santri_id: santriId, kamar_baru: kamarBaru, applied: 0, kamar_lama: prev[santriId]?.kamar_lama ?? null }
    }))
    const res = await updateKamarDraft(asrama, santriId, kamarBaru)
    if ('error' in res) { toast.error(res.error); await load() }
  }

  const handleApply = async () => {
    if (!await confirm(`Apply perpindahan kamar untuk ${Object.keys(draftMap).length} santri di asrama ${asrama}? Kolom kamar santri akan diupdate.`)) return
    setSaving(true)
    const res = await applyDraft(asrama)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Berhasil apply ${(res as any).count} santri!`)
    await load()
  }

  const handleReset = async () => {
    if (!await confirm('Reset semua draft perpindahan? Data kamar santri di database TIDAK berubah.')) return
    await resetDraft(asrama)
    toast.success('Draft direset')
    await load()
  }

  const handleSetKetua = async (nomor_kamar: string, santri_id: string | null) => {
    const res = await setKetuaKamar(asrama, nomor_kamar, santri_id)
    if ('error' in res) return toast.error(res.error)
    setKetuaMap(prev => {
      const next = { ...prev }
      if (!santri_id) { delete next[nomor_kamar]; return next }
      const s = santriList.find(x => x.id === santri_id)
      if (s) next[nomor_kamar] = { nomor_kamar, santri_id, nama_lengkap: s.nama_lengkap }
      return next
    })
    toast.success('Ketua kamar diperbarui')
  }

  const handleDrop = (kamarTujuan: string) => {
    if (dragSantriId && kamarTujuan !== draftMap[dragSantriId]?.kamar_baru) {
      handlePindah(dragSantriId, kamarTujuan)
    }
    setDragSantriId(null)
    setDragOverKamar(null)
  }

  const handlePrint = (mode: 'all' | string) => {
    const printData = configs.map(cfg => {
      const santri = getSantriDiKamar(cfg.nomor_kamar)
      const ketua = ketuaMap[cfg.nomor_kamar]
      return { ...cfg, santri, ketua }
    }).filter(d => mode === 'all' || d.nomor_kamar === mode)

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Daftar Penghuni Kamar - Asrama ${asrama}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; }
        .page { page-break-after: always; padding: 20px; }
        .page:last-child { page-break-after: avoid; }
        h2 { font-size: 15px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
        .meta { font-size: 10px; color: #555; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
        th { background: #f0f0f0; font-size: 10px; }
        .ketua { font-weight: bold; background: #fffbcc; }
        .badge { font-size: 9px; background: #ddd; padding: 1px 5px; border-radius: 3px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>
    ${printData.map(d => `
      <div class="page">
        <h2>ASRAMA ${asrama} — KAMAR ${d.nomor_kamar}</h2>
        <div class="meta">
          Kuota: ${d.kuota} orang | Terisi: ${d.santri.length} orang |
          Ketua: ${d.ketua?.nama_lengkap || '(Belum ditentukan)'}
        </div>
        <table>
          <thead><tr><th>No</th><th>Nama</th><th>Kelas Pesantren</th><th>Sekolah</th><th>Ket</th></tr></thead>
          <tbody>
          ${d.santri.sort((a, b) => {
            if (d.ketua?.santri_id === a.id) return -1
            if (d.ketua?.santri_id === b.id) return 1
            return a.nama_lengkap.localeCompare(b.nama_lengkap)
          }).map((s, i) => `
            <tr class="${d.ketua?.santri_id === s.id ? 'ketua' : ''}">
              <td>${i + 1}</td>
              <td>${s.nama_lengkap} ${d.ketua?.santri_id === s.id ? '<span class="badge">KETUA</span>' : ''}</td>
              <td>${s.nama_kelas || '-'}</td>
              <td>${s.sekolah || '-'} ${s.kelas_sekolah ? 'Kls ' + s.kelas_sekolah : ''}</td>
              <td>${draftMap[s.id]?.kamar_lama === d.nomor_kamar ? 'LAMA' : 'BARU'}</td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      </div>
    `).join('')}
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-28 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER HERO */}
      <div className="relative bg-indigo-950 border border-indigo-900/50 text-indigo-50 px-5 pt-5 pb-6 rounded-[2rem] shadow-xl shadow-indigo-900/10 overflow-hidden mb-6 mx-4 sm:mx-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <div className="absolute top-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"/>
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2 mb-1.5">
             <Shuffle className="w-5 h-5 text-indigo-400"/> Perpindahan Kamar
            </h1>
            <p className="text-indigo-200/70 text-xs font-medium max-w-sm leading-relaxed">
              Setup dan simulasikan distribusi kamar santri menjelang tahun ajaran baru.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!asramaBinaan ? (
               <Select value={asrama} onValueChange={(val) => { setAsrama(val ?? ''); setStep('config') }}>
                 <SelectTrigger className="w-[180px] h-10 border-indigo-500/30 bg-indigo-900/50 text-indigo-50 font-bold focus:ring-0 rounded-xl">
                   <SelectValue placeholder="Pilih Asrama"/>
                 </SelectTrigger>
                 <SelectContent>
                   {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                 </SelectContent>
               </Select>
            ) : (
              <Badge className="bg-indigo-800/50 text-indigo-200 border-indigo-500/30 font-black h-10 px-4 rounded-xl flex items-center gap-2">
                <Home className="w-4 h-4"/> {asramaBinaan}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500"/></div>
      ) : (
        <Tabs value={tab} onValueChange={(v: string) => setTab(v as 'plotting'|'monitoring')} className="mx-4 sm:mx-0">
          
          <TabsList className="mb-6 h-12 w-full sm:w-auto bg-muted/60 p-1.5 rounded-2xl shadow-sm border border-border">
            <TabsTrigger value="plotting" className="flex-1 sm:flex-none gap-2 font-bold px-5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
               <Settings className="w-4 h-4"/> Plotting & Setup
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex-1 sm:flex-none gap-2 font-bold px-5 rounded-xl text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
               <LayoutDashboard className="w-4 h-4"/> Monitoring Kamar
            </TabsTrigger>
          </TabsList>

          {/* ── TAB PLOTTING ─────────────────────────────────────────────── */}
          <TabsContent value="plotting" className="space-y-6 outline-none">

            {/* STEP INDICATOR */}
            <div className="flex items-center gap-3 text-xs overflow-x-auto pb-2 hide-scrollbar w-full px-1">
              {[
                  { id: 'config', label: 'Konfigurasi Kamar' }, 
                  { id: 'generate', label: 'Generate Draft' }, 
                  { id: 'plotting', label: 'Review & Apply' }
              ].map((s, i) => {
                 const stepKeys = ['config', 'generate', 'plotting'];
                 const isCurrent = step === s.id;
                 const isPast = stepKeys.indexOf(step) > i;
                 return (
                    <div key={s.id} className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                           "w-7 h-7 rounded-full flex items-center justify-center font-black transition-all shadow-sm",
                           isCurrent ? "bg-indigo-600 text-white ring-4 ring-indigo-600/20" : 
                           isPast ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {isPast ? <CheckCircle className="w-4 h-4"/> : i + 1}
                        </div>
                        <span className={cn(
                           "hidden sm:block font-bold tracking-tight", 
                           isCurrent ? "text-indigo-700 dark:text-indigo-400" : isPast ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {s.label}
                        </span>
                      </div>
                      {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground/30"/>}
                    </div>
                 )
              })}
            </div>

            {/* ─ STEP 1: KONFIGURASI ─ */}
            <Card className={cn("overflow-hidden shadow-sm transition-colors border-border bg-card", step==='config' && "ring-1 ring-indigo-500")}>
              <div 
                 className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 cursor-pointer select-none transition-colors", configOpen ? "bg-muted/30 border-b border-border/60" : "hover:bg-muted/20")}
                 onClick={() => setConfigOpen(v => !v)}
              >
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <div className={cn("p-1.5 rounded-lg", step==='config' ? 'bg-indigo-500 text-white' : 'bg-muted/50 text-muted-foreground')}>
                     <Settings className="w-4 h-4"/>
                  </div>
                  <h3 className={cn("font-bold", step==='config' ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground')}>Step 1 — Konfigurasi Kamar</h3>
                  {configs.length > 0 && !configOpen && (
                    <Badge variant="outline" className="text-[10px] shadow-none bg-emerald-500/10 text-emerald-600 border-none font-bold">
                       {localKamar.length} kamar · {[...new Set(localKamar.map(k => k.blok).filter(Boolean))].length} blok
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{localKamar.length} kamar dikonfigurasi</span>
                  {configOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}
                </div>
              </div>

              {configOpen && (
                <CardContent className="p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">Sesuaikan daftar kamar dan kuota masing-masing sebelum mem-plotting santri.</p>
                    <Button 
                       variant="outline" 
                       size="sm"
                       onClick={() => setLocalKamar(prev => [...prev, { nomor_kamar: String(prev.length + 1), kuota: 10, blok: '' }])}
                       className="font-bold border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-800 shadow-none shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1.5"/> Tambah Kamar
                    </Button>
                  </div>

                  {localKamar.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {localKamar.map((k, i) => (
                        <div key={i} className="border border-border/80 rounded-2xl p-3 space-y-2.5 bg-muted/20 relative group hover:border-indigo-300 transition-colors">
                          <button onClick={() => setLocalKamar(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110">
                            <Trash2 className="w-3 h-3"/>
                          </button>
                          <div>
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 mb-1 block">Kamar</label>
                            <Input 
                               value={k.nomor_kamar} 
                               onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, nomor_kamar: e.target.value} : x))}
                               className="h-9 px-3 text-sm font-black focus-visible:ring-indigo-500 shadow-none border-border"
                               placeholder="No. Kamar"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest w-12 shrink-0">Kuota</label>
                            <Input 
                               type="number" min={1} max={100} value={k.kuota}
                               onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, kuota: Number(e.target.value)} : x))}
                               className="h-8 px-2 text-xs text-center font-bold focus-visible:ring-indigo-500 shadow-none max-w-[80px]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest w-12 shrink-0">Blok</label>
                            <Input 
                               value={k.blok || ''} placeholder="A/B (opt)"
                               onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, blok: e.target.value.toUpperCase()} : x))}
                               className="h-8 px-2 text-xs text-center font-bold focus-visible:ring-indigo-500 shadow-none uppercase max-w-[80px]"
                               maxLength={5}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 border-2 border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center bg-muted/10">
                       <p className="text-muted-foreground font-medium text-sm mb-3">Belum ada kamar.</p>
                       <Button variant="outline" size="sm" onClick={() => setLocalKamar([{ nomor_kamar: '1', kuota: 10, blok: '' }])} className="font-bold shadow-none">
                         Mulai Buat Kamar
                       </Button>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button onClick={handleSimpanConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-sm">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                      Simpan & Lanjut
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ─ STEP 2: GENERATE ─ */}
            {configs.length > 0 && (
              <Card className={cn("overflow-hidden shadow-sm transition-colors border-border bg-card", step==='generate' && "ring-1 ring-indigo-500")}>
                <div 
                   className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 cursor-pointer select-none transition-colors", step==='generate' ? "bg-muted/30 border-b border-border/60" : "hover:bg-muted/20")}
                   onClick={() => setStep('generate')}
                >
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    <div className={cn("p-1.5 rounded-lg", step==='generate' ? 'bg-indigo-500 text-white' : 'bg-muted/50 text-muted-foreground')}>
                       <Play className="w-4 h-4"/>
                    </div>
                    <h3 className={cn("font-bold", step==='generate' ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground')}>Step 2 — Generate Draft Otomatis</h3>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{santriList.length} santri di Asrama</span>
                </div>
                {step === 'generate' && (
                  <CardContent className="p-5 space-y-6">
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-3xl">
                      Sistem akan mendistribusikan santri secara otomatis. Prioritas perpindahan: tetap di blok yang sama, dicampur kelas secara proporsional. Anda bisa menyisakan slot kosong per kamar untuk santri baru.
                    </p>
                    
                    {(() => {
                      const bloks = [...new Set(configs.map((k:any) => k.blok).filter(Boolean))]
                      return bloks.length > 0 ? (
                        <div className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
                          <Crown className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5"/>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mb-2">Sistem Blok Aktif</p>
                            <div className="flex flex-wrap gap-2">
                              {bloks.map((blok:any) => {
                                const kamarBlok = configs.filter((k:any) => k.blok === blok)
                                return (
                                  <Badge key={blok} variant="outline" className="bg-background border-indigo-300 text-indigo-700">
                                    Blok {blok}: Kamar {kamarBlok.map((k:any) => k.nomor_kamar).join(', ')}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-2xl p-4 text-xs font-medium text-muted-foreground">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500"/> Tidak ada blok dikonfigurasi — santri didistribusikan bebas ke semua kamar.
                        </div>
                      )
                    })()}

                    <div className="flex flex-col md:flex-row gap-6 bg-muted/30 border border-border/50 rounded-2xl p-5 items-center">
                      <div className="flex-1 w-full relative">
                        <label className="text-sm font-black text-foreground block mb-4 flex items-center justify-between">
                          <span>Slot Kosong (Santri Baru)</span>
                          <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">{persenBaru}%</span>
                        </label>
                        <Input 
                           type="range" min={0} max={50} step={5} value={persenBaru}
                           onChange={e => setPersenBaru(Number(e.target.value))}
                           className="w-full h-2 p-0 rounded-lg cursor-pointer accent-indigo-600 bg-muted-foreground/20"
                        />
                        <div className="flex justify-between text-xs font-bold text-muted-foreground mt-2 px-1">
                          <span>0%</span><span>50%</span>
                        </div>
                      </div>
                      <div className="text-center shrink-0 w-full md:w-auto bg-background p-4 rounded-xl border border-border shadow-sm min-w-[140px]">
                        <p className="text-3xl font-black text-indigo-600 tabular-nums">
                          {Math.floor(configs.reduce((s, k) => s + k.kuota, 0) * persenBaru / 100)} <span className="text-base font-bold text-muted-foreground">slot</span>
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Kuota Cadangan</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-muted/10 rounded-2xl p-4 border border-border/50 transition-colors hover:bg-muted/30">
                        <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums">{santriList.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Santri Pindah</p>
                      </div>
                      <div className="bg-muted/10 rounded-2xl p-4 border border-border/50 transition-colors hover:bg-muted/30">
                        <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums">{configs.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Kamar Tersedia</p>
                      </div>
                      <div className="bg-muted/10 rounded-2xl p-4 border border-border/50 transition-colors hover:bg-muted/30">
                        <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                          {Math.floor(configs.reduce((s, k) => s + k.kuota, 0) * (1 - persenBaru / 100))}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Slot Efektif</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button onClick={handleGenerate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl shadow-sm w-full sm:w-auto">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Play className="w-4 h-4 mr-2"/>}
                        Mulai Generate
                      </Button>
                      {Object.keys(draftMap).length > 0 && (
                        <Button variant="outline" onClick={() => setStep('plotting')} className="font-bold h-11 px-6 rounded-xl shadow-none w-full sm:w-auto text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100">
                          Lihat Draft Existing →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* ─ STEP 3: PLOTTING ─ */}
            {Object.keys(draftMap).length > 0 && (
              <Card className={cn("overflow-hidden shadow-sm transition-colors border-border bg-card", step==='plotting' && "ring-1 ring-indigo-500")}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-5 py-4 bg-muted/40 border-b border-border/60 gap-4">
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 rounded-lg bg-indigo-500 text-white">
                        <Users className="w-4 h-4"/>
                     </div>
                     <h3 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                       Step 3 — Review & Koreksi
                       {isApplied && <Badge className="bg-emerald-500 hover:bg-emerald-600 font-bold ml-2">SUDAH DIAPPLY</Badge>}
                     </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto lg:justify-end">
                    <Button variant="outline" size="sm" onClick={() => handlePrint('all')} className="font-bold rounded-xl h-9 shrink-0">
                      <Printer className="w-4 h-4 mr-1.5 text-muted-foreground"/> Cetak
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset} className="font-bold rounded-xl h-9 border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0">
                      <RotateCcw className="w-4 h-4 mr-1.5"/> Reset
                    </Button>
                    <Button onClick={handleApply} disabled={saving} className="font-bold rounded-xl h-9 bg-indigo-600 hover:bg-indigo-700 shrink-0">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5"/> : <CheckCircle className="w-4 h-4 mr-1.5"/>}
                      {isApplied ? 'Apply Ulang' : 'Apply Final'}
                    </Button>
                  </div>
                </div>

                {santriTanpaDraft.length > 0 && (
                  <div className="mx-5 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                      <b>{santriTanpaDraft.length} santri</b> belum ter-assign ke kamar manapun. Lakukan generate ulang atau pindahkan manual ke salah satu kamar.
                    </p>
                  </div>
                )}

                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {configs.map(cfg => {
                    const santriKamar = getSantriDiKamar(cfg.nomor_kamar)
                    const ketua = ketuaMap[cfg.nomor_kamar]
                    const isOver = santriKamar.length > cfg.kuota
                    
                    return (
                      <div key={cfg.nomor_kamar}
                        onDragOver={e => { e.preventDefault(); setDragOverKamar(cfg.nomor_kamar) }}
                        onDrop={() => handleDrop(cfg.nomor_kamar)}
                        onDragLeave={() => setDragOverKamar(null)}
                        className={cn(
                           "border rounded-2xl flex flex-col transition-all overflow-hidden",
                           dragOverKamar === cfg.nomor_kamar ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md scale-[1.02]" : 
                           isOver ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-card hover:border-border"
                        )}
                      >
                        {/* Kamar Header */}
                        <div className={cn("flex flex-col gap-2 p-3 border-b shrink-0", isOver ? "bg-destructive/10" : "bg-muted/30")}>
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className="font-black text-base text-foreground">Kamar {cfg.nomor_kamar}</span>
                               {(cfg as any).blok && (
                                 <Badge variant="outline" className="text-[9px] bg-background">Blok {(cfg as any).blok}</Badge>
                               )}
                             </div>
                             <KamarStatusBadge isi={santriKamar.length} kuota={cfg.kuota}/>
                           </div>
                           <div className="flex items-center justify-between mt-1">
                               <span className={cn("font-bold text-xs tabular-nums", isOver ? 'text-destructive' : 'text-muted-foreground')}>
                                 {santriKamar.length} / {cfg.kuota} <span className="font-medium px-1">Terisi</span>
                               </span>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted" onClick={() => handlePrint(cfg.nomor_kamar)}>
                                  <Printer className="w-3.5 h-3.5"/>
                               </Button>
                           </div>
                        </div>

                        {/* Ketua picker - Using Native Select for perf and styling inside the list */}
                        <div className="px-3 py-2 border-b bg-amber-500/10 flex items-center gap-2 shrink-0">
                          <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                          <select 
                             value={ketua?.santri_id || ''}
                             onChange={e => handleSetKetua(cfg.nomor_kamar, e.target.value || null)}
                             className="flex-1 text-xs px-1 py-0.5 border-0 bg-transparent outline-none text-amber-800 dark:text-amber-400 font-bold cursor-pointer truncate appearance-none"
                          >
                            <option value="" className="text-muted-foreground italic">— Pilih Ketua Kamar —</option>
                            {santriKamar.map(s => <option key={s.id} value={s.id} className="font-bold">{s.nama_lengkap}</option>)}
                          </select>
                        </div>

                        {/* Daftar santri - Scrollable Kanban list */}
                        <div className="p-2 space-y-1.5 flex-1 overflow-y-auto min-h-[140px] max-h-[220px]">
                          {santriKamar.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-6">
                               <ArrowRight className="w-6 h-6 mb-2 rotate-90"/>
                               <p className="text-[10px] font-black uppercase tracking-widest">Tarik Kesini</p>
                            </div>
                          ) : (
                            santriKamar.map(s => {
                              const isLama = draftMap[s.id]?.kamar_lama === cfg.nomor_kamar
                              const isKetua = ketua?.santri_id === s.id
                              return (
                                <div key={s.id}
                                  draggable
                                  onDragStart={() => setDragSantriId(s.id)}
                                  onDragEnd={() => setDragSantriId(null)}
                                  className={cn(
                                     "flex items-center gap-2 px-2 py-2 rounded-xl cursor-grab active:cursor-grabbing select-none transition-all group",
                                     dragSantriId === s.id ? "opacity-30 scale-95" : 
                                     isKetua ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60" : 
                                     isLama ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50" : "bg-background border border-border shadow-sm hover:border-indigo-300"
                                  )}
                                >
                                  <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0"/>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-foreground truncate leading-tight">{s.nama_lengkap}</p>
                                    <p className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">{s.nama_kelas || s.kelas_sekolah || '-'}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                    {isKetua && <Crown className="w-3.5 h-3.5 text-amber-500"/>}
                                    <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border-none font-bold", isLama ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                                      {isLama ? 'LAMA' : 'BARU'}
                                    </Badge>
                                    
                                    {/* Native select to move santri natively without dragging (great for mobile) */}
                                    <div className="relative">
                                       <select 
                                         onChange={e => { if (e.target.value) handlePindah(s.id, e.target.value); e.target.value = '' }}
                                         className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[10px]"
                                         title="Pindah ke kamar lain" 
                                         defaultValue=""
                                       >
                                         <option value="" disabled>Pindah Kamar</option>
                                         {configs.filter(c => c.nomor_kamar !== cfg.nomor_kamar).map(c => (
                                           <option key={c.nomor_kamar} value={c.nomor_kamar}>Ke Kamar {c.nomor_kamar}</option>
                                         ))}
                                       </select>
                                       <div className="bg-muted text-muted-foreground w-6 h-6 rounded flex items-center justify-center font-black group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors cursor-pointer">
                                         ⇄
                                       </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── TAB MONITORING ───────────────────────────────────────────── */}
          <TabsContent value="monitoring" className="space-y-6 outline-none">
            {configs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border/60 rounded-3xl bg-muted/20">
                <LayoutDashboard className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30"/>
                <p className="font-medium text-sm">Belum ada konfigurasi kamar. Harap setup terlebih dahulu.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                  <Card className="shadow-sm border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-black text-foreground tabular-nums tracking-tight">{configs.length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Total Hari Ini</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border bg-indigo-50/30 dark:bg-indigo-950/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-black text-indigo-600 tabular-nums tracking-tight">{santriList.length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Total Santri</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-black text-emerald-600 tabular-nums tracking-tight">
                        {configs.reduce((s, k) => s + k.kuota, 0) - santriList.length}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Sisa Slot</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-black text-amber-500 tabular-nums tracking-tight">{Object.keys(ketuaMap).length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Ketua Terpilih</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabel monitoring */}
                <Card className="shadow-sm border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">Kamar</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Blok</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Kuota</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Terisi</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Sisa</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground whitespace-nowrap min-w-[140px]">Ketua Kamar</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Status</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right pr-6">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configs.map(cfg => {
                          const santriKamar = getSantriDiKamar(cfg.nomor_kamar)
                          const isi = santriKamar.length
                          const ketua = ketuaMap[cfg.nomor_kamar]
                          return (
                            <TableRow key={cfg.nomor_kamar} className="hover:bg-muted/30">
                              <TableCell className="font-bold text-foreground">Kamar {cfg.nomor_kamar}</TableCell>
                              <TableCell className="text-center text-xs">{(cfg as any).blok ? <Badge variant="outline" className="font-bold">{String((cfg as any).blok)}</Badge> : <span className="text-muted-foreground/40">—</span>}</TableCell>
                              <TableCell className="text-center font-medium text-muted-foreground tabular-nums">{cfg.kuota}</TableCell>
                              <TableCell className="text-center font-black text-foreground tabular-nums">{isi}</TableCell>
                              <TableCell className="text-center">
                                 <span className={cn("font-black tabular-nums", cfg.kuota - isi < 0 ? 'text-destructive' : 'text-emerald-600')}>{cfg.kuota - isi}</span>
                              </TableCell>
                              <TableCell className="text-xs font-semibold">
                                {ketua ? <span className="flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-amber-500 shrink-0"/>{ketua.nama_lengkap}</span> : <span className="text-muted-foreground/40 italic">Belum diset</span>}
                              </TableCell>
                              <TableCell className="text-center"><KamarStatusBadge isi={isi} kuota={cfg.kuota}/></TableCell>
                              <TableCell className="text-right pr-4 align-middle">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button variant="secondary" size="sm" onClick={() => setModalKamar(cfg.nomor_kamar)} className="h-8 text-xs font-bold w-[72px]">
                                    <Eye className="w-3.5 h-3.5 mr-1" /> Lihat
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handlePrint(cfg.nomor_kamar)} className="h-8 text-xs font-bold bg-background shadow-sm w-[72px]">
                                    <Printer className="w-3.5 h-3.5 mr-1 text-muted-foreground" /> Cetak
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ── MODAL DETAIL KAMAR ───────────────────────────────────────────────── */}
      <Dialog open={!!modalKamar} onOpenChange={(open) => !open && setModalKamar(null)}>
        {modalKamar && (() => {
          const cfg = configs.find(c => c.nomor_kamar === modalKamar)!
          const santriKamar = getSantriDiKamar(modalKamar)
          const ketua = ketuaMap[modalKamar]
          return (
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl flex flex-col max-h-[85vh]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b bg-muted/20 shrink-0 gap-4">
                  <div>
                    <DialogTitle className="font-black text-xl text-foreground flex items-center gap-2">
                      Kamar {modalKamar}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="shadow-none">Asrama {asrama}</Badge>
                      <KamarStatusBadge isi={santriKamar.length} kuota={cfg?.kuota || 0}/>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums">{santriKamar.length} / {cfg?.kuota} Jiwa</span>
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <Button variant="outline" size="sm" onClick={() => handlePrint(modalKamar)} className="font-bold shadow-sm h-9">
                      <Printer className="w-4 h-4 mr-1.5 text-muted-foreground"/> Print Kamar
                    </Button>
                  </div>
                </div>
                
                {ketua && (
                  <div className="px-6 py-3 bg-amber-500/10 border-b flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/20 rounded-md">
                       <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400"/>
                    </div>
                    <span className="text-sm font-black text-amber-800 dark:text-amber-400">Ketua Kamar: {ketua.nama_lengkap}</span>
                  </div>
                )}
                
                <div className="overflow-y-auto flex-1 p-2 sm:p-4">
                  {santriKamar.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-muted-foreground opacity-60">
                       <LayoutDashboard className="w-12 h-12 mb-3"/>
                       <p className="text-sm font-bold">Belum ada santri di kamar ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {santriKamar
                        .sort((a, b) => {
                          if (ketua?.santri_id === a.id) return -1
                          if (ketua?.santri_id === b.id) return 1
                          return a.nama_lengkap.localeCompare(b.nama_lengkap)
                        })
                        .map((s, i) => {
                          const isLama = draftMap[s.id]?.kamar_lama === modalKamar
                          const isKetua = ketua?.santri_id === s.id
                          return (
                            <div key={s.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50", isKetua ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card hover:bg-muted/40')}>
                              <span className="w-5 text-[10px] text-muted-foreground font-black tracking-widest shrink-0 text-center bg-muted/60 py-1 rounded-sm">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-bold text-foreground text-sm truncate leading-tight">{s.nama_lengkap}</p>
                                  {isKetua && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0"/>}
                                </div>
                                <p className="text-[11px] font-medium text-muted-foreground truncate">
                                  {s.nama_kelas || 'Reguler'} • {s.sekolah || '-'}{s.kelas_sekolah ? ` (Kelas ${s.kelas_sekolah})` : ''}
                                </p>
                              </div>
                              <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-none font-bold shrink-0", isLama ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')}>
                                {isLama ? 'PENGHUNI LAMA' : 'BARU MASUK'}
                              </Badge>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
            </DialogContent>
          )
        })()}
      </Dialog>
    </div>
  )
}
