'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Home, Settings, Play, CheckCircle, RotateCcw, Users, Crown,
  ChevronDown, ChevronUp, GripVertical, X, Plus, Trash2,
  AlertTriangle, Loader2, Printer, Eye, ArrowRight, Save
} from 'lucide-react'
import {
  getDataPerpindahan, simpanKonfigurasiKamar, generateDraft,
  updateKamarDraft, applyDraft, setKetuaKamar, resetDraft
} from './actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

// ── Tipe ──────────────────────────────────────────────────────────────────────
type KamarConfig = { nomor_kamar: string; kuota: number; reserved_baru: number; blok?: string }
type SantriData = {
  id: string; nama_lengkap: string; nis: string; jenis_kelamin: string
  kamar_asli: string | null; sekolah: string | null; kelas_sekolah: string | null
  marhalah_nama: string | null; nama_kelas: string | null
}
type DraftItem = { santri_id: string; kamar_lama: string | null; kamar_baru: string; applied: number }
type KetuaItem = { nomor_kamar: string; santri_id: string; nama_lengkap: string }
type GetDataResult =
  | { error: string; configs: KamarConfig[]; drafts: DraftItem[]; ketuaList: KetuaItem[]; santriList: SantriData[]; defaultConfigs: KamarConfig[] }
  | { configs: KamarConfig[]; drafts: DraftItem[]; ketuaList: KetuaItem[]; santriList: SantriData[]; defaultConfigs: KamarConfig[] }

// ── Badge status kamar ────────────────────────────────────────────────────────
function KamarStatusBadge({ isi, kuota }: { isi: number; kuota: number }) {
  if (isi === 0) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Kosong</span>
  if (isi > kuota) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Over</span>
  if (isi === kuota) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold">Penuh</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-semibold">Normal</span>
}

// ── Combobox Ketua Kamar ──────────────────────────────────────────────────────
function ComboboxKetuaKamar({
  candidates,
  value,
  onChange,
  placeholder = "— Pilih Ketua —",
}: {
  candidates: { id: string; nama_lengkap: string; kelas_sekolah: string | null }[];
  value: string;
  onChange: (val: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = candidates.filter(c =>
    c.nama_lengkap.toLowerCase().includes(search.toLowerCase())
  );
  const selected = candidates.find(c => c.id === value);

  return (
    <div className="relative w-full" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className="w-full bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer flex justify-between items-center text-xs font-semibold shadow-sm hover:border-slate-300 transition-colors"
      >
        <span className="truncate">{selected ? `${selected.nama_lengkap} ${selected.kelas_sekolah ? `(Kls ${selected.kelas_sekolah})` : ''}` : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg flex flex-col overflow-hidden max-h-56 text-xs">
          <div className="p-1.5 border-b border-inherit bg-slate-50 flex items-center">
            <input
              autoFocus
              type="text"
              placeholder="Cari nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 bg-transparent outline-none border-none text-xs text-slate-800"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            <div
              onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
              className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 text-slate-500 hover:text-red-600 font-bold border-b border-inherit transition-colors"
            >
              {placeholder}
            </div>
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                className="px-3 py-2 cursor-pointer hover:bg-amber-50 flex justify-between items-center group transition-colors"
              >
                <span className="text-slate-700 font-medium group-hover:text-amber-700 truncate">{c.nama_lengkap}</span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{c.kelas_sekolah ? `Kls ${c.kelas_sekolah}` : ''}</span>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-3 text-center text-slate-400">Tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
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
  const [draftMap, setDraftMap] = useState<Record<string, DraftItem>>({}) // santri_id -> draft
  const [ketuaMap, setKetuaMap] = useState<Record<string, KetuaItem>>({}) // nomor_kamar -> ketua
  const [isApplied, setIsApplied] = useState(false)

  // UI states
  const [step, setStep] = useState<'config' | 'generate' | 'plotting'>('config')
  const [localKamar, setLocalKamar] = useState<KamarConfig[]>([])
  const [modalKamar, setModalKamar] = useState<string | null>(null)
  const [dragSantriId, setDragSantriId] = useState<string | null>(null)
  const [dragOverKamar, setDragOverKamar] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getDataPerpindahan(asrama) as GetDataResult
    if ('error' in res && res.error) {
      toast.error(res.error)
      setConfigs([])
      setSantriList([])
      setDraftMap({})
      setKetuaMap({})
      setLocalKamar([])
      setIsApplied(false)
      setLoading(false)
      return
    }
    setConfigs(res.configs)
    setSantriList(res.santriList)
    // Build draft map
    const dm: Record<string, DraftItem> = {}
    res.drafts.forEach(d => { dm[d.santri_id] = d })
    setDraftMap(dm)
    // Build ketua map
    const km: Record<string, KetuaItem> = {}
    res.ketuaList.forEach(k => { km[k.nomor_kamar] = k })
    setKetuaMap(km)
    // Determine step
    if (res.configs.length === 0) {
      setStep('config')
      setLocalKamar(res.defaultConfigs.map(c => ({
        nomor_kamar: c.nomor_kamar,
        kuota: c.kuota,
        reserved_baru: c.reserved_baru ?? 0,
        blok: c.blok || '',
      })))
      setConfigOpen(true)
      setIsApplied(false)
    } else {
      setLocalKamar(res.configs.map(c => ({
        nomor_kamar: c.nomor_kamar,
        kuota: c.kuota,
        reserved_baru: c.reserved_baru ?? 0,
        blok: c.blok || '',
      })))
      setConfigOpen(false)
      if (res.drafts.length > 0) {
        setIsApplied(res.drafts.every(d => d.applied === 1))
        setStep('plotting')
      } else {
        setIsApplied(false)
        setStep('generate')
      }
    }
    setLoading(false)
  }, [asrama])

  useEffect(() => { load() }, [load])

  // ── Derived: santri per kamar ──────────────────────────────────────────────
  const hasDrafts = Object.keys(draftMap).length > 0
  const getSantriDiKamar = (nomor: string) =>
    santriList.filter(s => (draftMap[s.id]?.kamar_baru ?? s.kamar_asli) === nomor)
  const getEfektifKamar = (cfg: KamarConfig) => Math.max(0, cfg.kuota - (cfg.reserved_baru ?? 0))

  const santriTanpaDraft = santriList.filter(s => !draftMap[s.id])
  const totalReserved = configs.reduce((sum, k) => sum + (k.reserved_baru ?? 0), 0)
  const totalEffective = configs.reduce((sum, k) => sum + Math.max(0, k.kuota - (k.reserved_baru ?? 0)), 0)
  const overflowCount = Math.max(0, santriList.length - totalEffective)

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSimpanConfig = async () => {
    if (localKamar.length === 0) return toast.error('Tambahkan minimal 1 kamar')
    if (localKamar.some(k => !k.nomor_kamar.trim())) return toast.error('Nomor kamar tidak boleh kosong')
    if (localKamar.some(k => (k.reserved_baru ?? 0) > k.kuota)) {
      return toast.error('Slot santri baru tidak boleh melebihi kuota kamar')
    }
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
    const res = await generateDraft(asrama)
    toast.dismiss(toastId)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Draft dibuat untuk ${res.total} santri`)
    if ((res.overflowCount ?? 0) > 0) {
      toast.warning('Kapasitas efektif belum cukup', {
        description: `${res.overflowCount} santri tetap dipaksa masuk karena total kuota efektif setelah reserve hanya ${res.total - res.overflowCount}.`,
      })
    }
    await load()
  }

  const handlePindah = async (santriId: string, kamarBaru: string) => {
    const santri = santriList.find(item => item.id === santriId)
    // Optimistic update
    setDraftMap(prev => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        santri_id: santriId,
        kamar_baru: kamarBaru,
        applied: 0,
        kamar_lama: prev[santriId]?.kamar_lama ?? santri?.kamar_asli ?? null,
      }
    }))
    setIsApplied(false)
    const res = await updateKamarDraft(asrama, santriId, kamarBaru)
    if ('error' in res) { toast.error(res.error); await load(); return }
    const removedKetuaKamar = res.removedKetuaKamar
    if (removedKetuaKamar) {
      setKetuaMap(prev => {
        const next = { ...prev }
        delete next[removedKetuaKamar]
        return next
      })
      toast.warning('Ketua kamar dilepas otomatis', {
        description: `Santri dipindah dari kamar ${removedKetuaKamar}, jadi status ketuanya dibersihkan.`,
      })
    }
  }

  const handleApply = async () => {
    if (!await confirm(`Apply perpindahan kamar untuk ${Object.keys(draftMap).length} santri di asrama ${asrama}? Kolom kamar santri akan diupdate.`)) return
    setSaving(true)
    const res = await applyDraft(asrama)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    const skipped = res.skipped ?? 0
    toast.success(`Berhasil apply ${res.count} santri!`, skipped > 0 ? {
      description: `${skipped} draft stale dilewati dan dibersihkan.`
    } : undefined)
    await load()
  }

  const handleReset = async () => {
    if (!await confirm('Reset semua draft perpindahan? Data kamar santri di database TIDAK berubah.')) return
    const res = await resetDraft(asrama)
    if ('error' in res) return toast.error(res.error)
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
    toast.success('Ketua kamar diganti')
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const handleDrop = (kamarTujuan: string) => {
    if (dragSantriId && kamarTujuan !== draftMap[dragSantriId]?.kamar_baru) {
      handlePindah(dragSantriId, kamarTujuan)
    }
    setDragSantriId(null)
    setDragOverKamar(null)
  }

  // ── Print ──────────────────────────────────────────────────────────────────
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
          Kuota: ${d.kuota} orang | Reserve baru: ${d.reserved_baru || 0} | Terisi: ${d.santri.length} orang |
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
              <td>${(draftMap[s.id]?.kamar_lama ?? s.kamar_asli) === d.nomor_kamar ? 'LAMA' : 'BARU'}</td>
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
    <div className="space-y-6 max-w-7xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row gap-4 border-b pb-4 sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Perpindahan Kamar"
          description="Setup distribusi kamar santri menjelang tahun ajaran baru."
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          {!asramaBinaan && (
            <select value={asrama} onChange={e => { setAsrama(e.target.value); setStep('config') }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {asramaBinaan && (
            <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-2 rounded-lg">
              {asramaBinaan}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500"/></div>
      ) : (
        <>
          {/* TABS */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {(['plotting', 'monitoring'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'plotting' ? '⚙️ Plotting & Setup' : '📊 Monitoring Kamar'}
              </button>
            ))}
          </div>

          {/* ── TAB PLOTTING ─────────────────────────────────────────────── */}
          {tab === 'plotting' && (
            <div className="space-y-5">

              {/* STEP INDICATOR */}
              <div className="flex items-center gap-2 text-xs">
                {['config', 'generate', 'plotting'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold transition-colors ${
                      step === s ? 'bg-indigo-600 text-white' :
                      (['config','generate','plotting'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                      'bg-slate-200 text-slate-400'
                    }`}>{i + 1}</div>
                    <span className={`hidden sm:block font-medium ${step === s ? 'text-indigo-700' : 'text-slate-400'}`}>
                      {s === 'config' ? 'Konfigurasi Kamar' : s === 'generate' ? 'Generate Draft' : 'Review & Apply'}
                    </span>
                    {i < 2 && <ArrowRight className="w-3 h-3 text-slate-300"/>}
                  </div>
                ))}
              </div>

              {/* ─ STEP 1: KONFIGURASI ─ */}
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50 cursor-pointer"
                  onClick={() => setConfigOpen(v => !v)}>
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-500"/>
                    Step 1 — Konfigurasi Kamar
                    {configs.length > 0 && !configOpen && (
                      <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                        {localKamar.length} kamar · {[...new Set(localKamar.map(k => k.blok).filter(Boolean))].length} blok
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{localKamar.length} kamar dikonfigurasi</span>
                    {configOpen ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                  </div>
                </div>
                {configOpen && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Tentukan daftar kamar, kuota, dan slot santri baru tiap kamar.</p>
                        {configs.length === 0 && localKamar.length > 0 && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Kuota awal sudah diprefill dari jumlah penghuni riil tiap kamar saat ini.
                          </p>
                        )}
                      </div>
                      <button onClick={() => setLocalKamar(prev => [...prev, { nomor_kamar: String(prev.length + 1), kuota: 10, reserved_baru: 0, blok: '' }])}
                        className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        <Plus className="w-3.5 h-3.5"/> Tambah Kamar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {localKamar.map((k, i) => (
                        <div key={i} className="border rounded-xl p-3 space-y-2 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Kamar</label>
                            <button onClick={() => setLocalKamar(prev => prev.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                          <input value={k.nomor_kamar} onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, nomor_kamar: e.target.value} : x))}
                            className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="No. Kamar"/>
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-slate-400 shrink-0">Kuota:</label>
                            <input type="number" min={1} max={50} value={k.kuota}
                              onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, kuota: Number(e.target.value)} : x))}
                              className="w-full border rounded px-2 py-1 text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none"/>
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-slate-400 shrink-0">Baru:</label>
                            <input type="number" min={0} max={50} value={k.reserved_baru ?? 0}
                              onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, reserved_baru: Number(e.target.value)} : x))}
                              className="w-full border rounded px-2 py-1 text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none"/>
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-slate-400 shrink-0">Blok:</label>
                            <input value={k.blok || ''} placeholder="A/B/C (opt)"
                              onChange={e => setLocalKamar(prev => prev.map((x, j) => j === i ? {...x, blok: e.target.value.toUpperCase()} : x))}
                              className="w-full border rounded px-2 py-1 text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                              maxLength={3}/>
                          </div>
                          {(k.reserved_baru ?? 0) > k.kuota && (
                            <p className="text-[10px] font-semibold text-red-500">
                              Slot baru melebihi kuota kamar.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSimpanConfig} disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Simpan & Lanjut
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─ STEP 2: GENERATE ─ */}
              {configs.length > 0 && (
                <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50 cursor-pointer"
                    onClick={() => setStep('generate')}>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Play className="w-4 h-4 text-green-500"/>
                      Step 2 — Generate Draft Otomatis
                    </h3>
                    <span className="text-xs text-slate-400">{santriList.length} santri di asrama ini</span>
                  </div>
                  {step === 'generate' && (
                    <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-500">
                        Sistem akan mendistribusikan santri secara proporsional berdasarkan kelas sekolah.
                        Slot santri baru mengikuti reserve yang diatur per kamar.
                      </p>
                      {(() => {
                        const bloks = [...new Set(configs.map(k => k.blok).filter(Boolean))]
                        return bloks.length > 0 ? (
                          <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                            <div className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500">🔒</div>
                            <div>
                              <p className="text-xs font-semibold text-indigo-700 mb-1">Blok aktif — santri hanya dipindah dalam blok yang sama</p>
                              <div className="flex flex-wrap gap-1.5">
                                {bloks.map(blok => {
                                  const kamarBlok = configs.filter(k => k.blok === blok)
                                  return (
                                    <span key={blok} className="text-[10px] bg-white border border-indigo-200 text-indigo-600 font-bold px-2 py-0.5 rounded-lg">
                                      Blok {blok}: Kamar {kamarBlok.map(k => k.nomor_kamar).join(', ')}
                                    </span>
                                  )
                                })}
                                {configs.filter(k => !k.blok).length > 0 && (
                                  <span className="text-[10px] bg-white border border-slate-200 text-slate-500 font-medium px-2 py-0.5 rounded-lg">
                                    Tanpa blok: Kamar {configs.filter(k => !k.blok).map(k => k.nomor_kamar).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
                            <span>ℹ️</span> Tidak ada blok dikonfigurasi — semua santri didistribusikan bebas ke semua kamar.
                            <button onClick={() => setConfigOpen(true)} className="text-indigo-600 font-semibold hover:underline ml-1">Set blok →</button>
                          </div>
                        )
                      })()}
                      <div className="bg-indigo-50 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-indigo-800">Reserve santri baru per kamar aktif</p>
                            <p className="text-xs text-indigo-500 mt-1">
                              Total reserve diambil dari Step 1. Ubah konfigurasi kamar jika ingin menyesuaikan slot baru.
                            </p>
                          </div>
                          <div className="text-center shrink-0">
                            <p className="text-2xl font-black text-indigo-700">{totalReserved}</p>
                            <p className="text-xs text-indigo-400">slot reserved</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                        <div className="bg-slate-50 rounded-xl p-3 border">
                          <p className="text-lg font-black text-slate-800">{santriList.length}</p>
                          <p className="text-xs text-slate-400">Santri akan dipindah</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border">
                          <p className="text-lg font-black text-slate-800">{configs.length}</p>
                          <p className="text-xs text-slate-400">Kamar tersedia</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border">
                          <p className="text-lg font-black text-slate-800">{totalReserved}</p>
                          <p className="text-xs text-slate-400">Reserve santri baru</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border">
                          <p className="text-lg font-black text-slate-800">{totalEffective}</p>
                          <p className="text-xs text-slate-400">Slot efektif</p>
                        </div>
                      </div>

                      {overflowCount > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>
                          <div>
                            Total slot efektif saat ini hanya {totalEffective}, sedangkan santri yang akan diplot ada {santriList.length}.
                            Sistem tetap bisa generate draft, tapi sekitar {overflowCount} santri akan terdorong masuk melebihi kapasitas efektif reserve.
                          </div>
                        </div>
                      )}

                      {/* SETUP KETUA KAMAR SEBELUM GENERATE */}
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Crown className="w-5 h-5 text-amber-500"/>
                          <h4 className="font-bold text-amber-800">Tentukan Ketua Kamar (Opsional)</h4>
                        </div>
                        <p className="text-xs text-amber-700 mb-4">Ketua yang dipilih akan otomatis ditetapkan di kamarnya saat generate draft dan kuota kamar akan disesuaikan.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {configs.map(cfg => {
                            const ketua = ketuaMap[cfg.nomor_kamar];
                            return (
                              <div key={cfg.nomor_kamar} className="bg-white p-2.5 rounded-lg border border-amber-200">
                                <div className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Kamar {cfg.nomor_kamar}</div>
                                <ComboboxKetuaKamar
                                  candidates={santriList}
                                  value={ketua?.santri_id || ''}
                                  onChange={(val) => handleSetKetua(cfg.nomor_kamar, val)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={handleGenerate} disabled={saving}
                          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                          Generate Draft
                        </button>
                        {hasDrafts && (
                          <button onClick={() => setStep('plotting')}
                            className="border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-5 py-2 rounded-lg text-sm font-semibold">
                            Lihat Draft Existing →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─ STEP 3: PLOTTING ─ */}
              {hasDrafts && (
                <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3 border-b bg-slate-50 gap-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500"/>
                      Step 3 — Review & Koreksi Manual
                      {isApplied && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">SUDAH DIAPPLY</span>}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handlePrint('all')}
                        className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-xl px-3 py-1.5 hover:bg-slate-50 text-slate-600">
                        <Printer className="w-3.5 h-3.5"/> Cetak Semua
                      </button>
                      <button onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 text-red-500">
                        <RotateCcw className="w-3.5 h-3.5"/> Reset Draft
                      </button>
                      <button onClick={handleApply} disabled={saving}
                        className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-1.5 font-semibold disabled:opacity-50">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle className="w-3.5 h-3.5"/>}
                        {isApplied ? 'Apply Ulang' : 'Apply ke Database'}
                      </button>
                    </div>
                  </div>

                  {/* Santri tanpa draft */}
                  {santriTanpaDraft.length > 0 && (
                    <div className="mx-5 mt-4 space-y-3">
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5"/>
                        <p className="text-xs text-yellow-700">
                          <b>{santriTanpaDraft.length} santri</b> belum ada di draft. Generate ulang atau assign manual.
                        </p>
                      </div>
                      <div className="border border-yellow-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-yellow-50/70 border-b border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-800">Assign manual santri yang belum masuk draft</p>
                        </div>
                        <div className="divide-y bg-white">
                          {santriTanpaDraft.map(s => (
                            <div key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{s.nama_lengkap}</p>
                                <p className="text-xs text-slate-400">
                                  {s.nama_kelas || s.kelas_sekolah || 'Belum masuk kelas'}
                                  {s.kamar_asli ? ` · Kamar asal ${s.kamar_asli}` : ' · Belum punya kamar asal'}
                                </p>
                              </div>
                              <select
                                onChange={e => {
                                  if (e.target.value) handlePindah(s.id, e.target.value)
                                  e.target.value = ''
                                }}
                                className="sm:w-44 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                defaultValue=""
                              >
                                <option value="" disabled>Pilih kamar tujuan</option>
                                {configs.map(c => (
                                  <option key={c.nomor_kamar} value={c.nomor_kamar}>
                                    Kamar {c.nomor_kamar}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {configs.map(cfg => {
                      const santriKamar = getSantriDiKamar(cfg.nomor_kamar)
                      const ketua = ketuaMap[cfg.nomor_kamar]
                      const kuotaEfektif = getEfektifKamar(cfg)
                      const isOver = santriKamar.length > kuotaEfektif
                      return (
                        <div key={cfg.nomor_kamar}
                          onDragOver={e => { e.preventDefault(); setDragOverKamar(cfg.nomor_kamar) }}
                          onDrop={() => handleDrop(cfg.nomor_kamar)}
                          onDragLeave={() => setDragOverKamar(null)}
                          className={`border rounded-xl transition-all ${dragOverKamar === cfg.nomor_kamar ? 'border-indigo-400 bg-indigo-50 shadow-sm' : isOver ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-slate-50/50'}`}
                        >
                          {/* Kamar header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-inherit bg-white rounded-t-xl">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800">Kamar {cfg.nomor_kamar}</span>
                              {cfg.blok && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded">
                                  Blok {cfg.blok}
                                </span>
                              )}
                              <KamarStatusBadge isi={santriKamar.length} kuota={kuotaEfektif}/>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`font-bold tabular-nums ${isOver ? 'text-red-500' : 'text-slate-600'}`}>
                                {santriKamar.length}/{kuotaEfektif}
                              </span>
                              <button onClick={() => handlePrint(cfg.nomor_kamar)}
                                className="text-slate-400 hover:text-slate-600"><Printer className="w-3.5 h-3.5"/></button>
                            </div>
                          </div>
                          <div className="px-3 py-1.5 border-b border-inherit bg-slate-50/80 text-[10px] text-slate-500 flex items-center justify-between">
                            <span>Kuota fisik {cfg.kuota}</span>
                            <span>Reserve baru {cfg.reserved_baru ?? 0}</span>
                            <span>Efektif {kuotaEfektif}</span>
                          </div>

                          {/* Ketua picker */}
                          <div className="px-3 py-2 border-b border-inherit bg-amber-50/50">
                            <div className="flex items-center gap-1.5">
                              <Crown className="w-3 h-3 text-amber-500 shrink-0"/>
                              <div className="flex-1 min-w-0 pr-1">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                  Ganti Ketua Kamar
                                </p>
                                <ComboboxKetuaKamar
                                  candidates={santriKamar}
                                  value={ketua?.santri_id || ''}
                                  onChange={(val) => handleSetKetua(cfg.nomor_kamar, val)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Daftar santri */}
                          <div className="p-2 space-y-1 max-h-52 overflow-y-auto">
                            {santriKamar.length === 0 ? (
                              <p className="text-center text-xs text-slate-400 py-4">Drag santri ke sini</p>
                            ) : (
                              santriKamar.map(s => {
                                const isLama = (draftMap[s.id]?.kamar_lama ?? s.kamar_asli) === cfg.nomor_kamar
                                const isKetua = ketua?.santri_id === s.id
                                return (
                                  <div key={s.id}
                                    draggable
                                    onDragStart={() => setDragSantriId(s.id)}
                                    onDragEnd={() => setDragSantriId(null)}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing select-none transition-all ${
                                      dragSantriId === s.id ? 'opacity-40' :
                                      isKetua ? 'bg-amber-50 border border-amber-200' :
                                      isLama ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-slate-100 hover:border-indigo-200'
                                    }`}
                                  >
                                    <GripVertical className="w-3 h-3 text-slate-300 shrink-0"/>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate">{s.nama_lengkap}</p>
                                      <p className="text-[10px] text-slate-400 truncate">{s.nama_kelas || s.kelas_sekolah || '-'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isKetua && <Crown className="w-3 h-3 text-amber-500"/>}
                                      <span className={`text-[9px] px-1 rounded font-bold ${isLama ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                        {isLama ? 'LAMA' : 'BARU'}
                                      </span>
                                      {/* Dropdown pindah */}
                                      <select onChange={e => { if (e.target.value) handlePindah(s.id, e.target.value); e.target.value = '' }}
                                        className="text-[9px] border rounded px-1 py-0.5 outline-none bg-white cursor-pointer text-slate-500 max-w-[60px]"
                                        title="Pindah ke kamar lain" defaultValue="">
                                        <option value="" disabled>⇄</option>
                                        {configs.filter(c => c.nomor_kamar !== cfg.nomor_kamar).map(c => (
                                          <option key={c.nomor_kamar} value={c.nomor_kamar}>→ {c.nomor_kamar}</option>
                                        ))}
                                      </select>
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
                </div>
              )}
            </div>
          )}

          {/* ── TAB MONITORING ───────────────────────────────────────────── */}
          {tab === 'monitoring' && (
            <div className="space-y-4">
              {configs.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Home className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
                  <p>Belum ada konfigurasi kamar. Setup dulu di tab Plotting.</p>
                </div>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
                      <p className="text-2xl font-black text-slate-800">{configs.length}</p>
                      <p className="text-xs text-slate-400 mt-1">Total Kamar</p>
                    </div>
                    <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
                      <p className="text-2xl font-black text-indigo-700">{santriList.length}</p>
                      <p className="text-xs text-slate-400 mt-1">Total Santri</p>
                    </div>
                    <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
                      <p className="text-2xl font-black text-green-600">{totalReserved}</p>
                      <p className="text-xs text-slate-400 mt-1">Reserve Baru</p>
                    </div>
                    <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
                      <p className={`text-2xl font-black ${overflowCount > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {overflowCount > 0 ? overflowCount : Object.keys(ketuaMap).length}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{overflowCount > 0 ? 'Overflow Efektif' : 'Ketua Ditentukan'}</p>
                    </div>
                  </div>

                  {/* Tabel monitoring */}
                  <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3 text-left">Kamar</th>
                          <th className="px-4 py-3 text-center">Blok</th>
                          <th className="px-4 py-3 text-center">Kuota</th>
                          <th className="px-4 py-3 text-center">Reserve</th>
                          <th className="px-4 py-3 text-center">Efektif</th>
                          <th className="px-4 py-3 text-center">Terisi</th>
                          <th className="px-4 py-3 text-center">Sisa Efektif</th>
                          <th className="px-4 py-3 text-center">Ketua</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {configs.map(cfg => {
                          const santriKamar = getSantriDiKamar(cfg.nomor_kamar)
                          const isi = santriKamar.length
                          const efektif = getEfektifKamar(cfg)
                          const ketua = ketuaMap[cfg.nomor_kamar]
                          return (
                            <tr key={cfg.nomor_kamar} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-bold text-slate-800">Kamar {cfg.nomor_kamar}</td>
                              <td className="px-4 py-3 text-center text-xs">{cfg.blok ? <span className="bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded">{cfg.blok}</span> : <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3 text-center text-slate-600">{cfg.kuota}</td>
                              <td className="px-4 py-3 text-center text-slate-600">{cfg.reserved_baru ?? 0}</td>
                              <td className="px-4 py-3 text-center text-slate-600">{efektif}</td>
                              <td className="px-4 py-3 text-center font-bold">{isi}</td>
                              <td className={`px-4 py-3 text-center font-bold ${efektif - isi < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {efektif - isi}
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-slate-500">
                                {ketua ? <span className="flex items-center justify-center gap-1"><Crown className="w-3 h-3 text-amber-400"/>{ketua.nama_lengkap}</span> : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <KamarStatusBadge isi={isi} kuota={efektif}/>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => setModalKamar(cfg.nomor_kamar)}
                                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
                                    <Eye className="w-3 h-3"/> Lihat
                                  </button>
                                  <button onClick={() => handlePrint(cfg.nomor_kamar)}
                                    className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
                                    <Printer className="w-3 h-3"/> Cetak
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL DETAIL KAMAR ───────────────────────────────────────────────── */}
      {modalKamar && (() => {
        const cfg = configs.find(c => c.nomor_kamar === modalKamar)!
        const santriKamar = getSantriDiKamar(modalKamar)
        const ketua = ketuaMap[modalKamar]
        const efektif = getEfektifKamar(cfg)
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setModalKamar(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Kamar {modalKamar}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">Asrama {asrama}</span>
                    <KamarStatusBadge isi={santriKamar.length} kuota={efektif}/>
                    <span className="text-xs text-slate-400">{santriKamar.length}/{efektif} jiwa efektif</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePrint(modalKamar)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><Printer className="w-4 h-4"/></button>
                  <button onClick={() => setModalKamar(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
              </div>
              {ketua && (
                <div className="px-5 py-2.5 bg-amber-50 border-b flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500"/>
                  <span className="text-sm font-semibold text-amber-700">Ketua: {ketua.nama_lengkap}</span>
                </div>
              )}
              <div className="px-5 py-2.5 bg-slate-50 border-b text-xs text-slate-500 flex items-center gap-4">
                <span>Kuota fisik {cfg.kuota}</span>
                <span>Reserve baru {cfg.reserved_baru ?? 0}</span>
                <span>Kuota efektif {efektif}</span>
              </div>
              <div className="overflow-y-auto flex-1 divide-y">
                {santriKamar.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">Belum ada santri di kamar ini.</div>
                ) : (
                  santriKamar
                    .sort((a, b) => {
                      if (ketua?.santri_id === a.id) return -1
                      if (ketua?.santri_id === b.id) return 1
                      return a.nama_lengkap.localeCompare(b.nama_lengkap)
                    })
                    .map((s, i) => {
                      const isLama = (draftMap[s.id]?.kamar_lama ?? s.kamar_asli) === modalKamar
                      const isKetua = ketua?.santri_id === s.id
                      return (
                        <div key={s.id} className={`flex items-center gap-3 px-5 py-3 ${isKetua ? 'bg-amber-50' : ''}`}>
                          <span className="w-5 text-xs text-slate-400 font-mono shrink-0 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                              {isKetua && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0"/>}
                            </div>
                            <p className="text-xs text-slate-400">
                              {s.nama_kelas || 'Belum masuk kelas'} · {s.sekolah || 'Tidak sekolah'}{s.kelas_sekolah ? ` Kls ${s.kelas_sekolah}` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${isLama ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {isLama ? 'LAMA' : 'BARU'}
                          </span>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
