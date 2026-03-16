'use client'

import { useState, useCallback } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal } from './actions'
import {
  Gavel, CheckCircle, Loader2, AlertTriangle, Save,
  ChevronLeft, ChevronRight, RefreshCw, Users,
  HeartPulse, ShieldCheck, ClipboardX, AlertCircle, Search
} from 'lucide-react'
import { toast } from 'sonner'

type VonisType = 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
type AbsenItem = {
  santri_id: string; nama: string; nis: string; info: string
  items: { absen_id: string; tanggal: string; sesi: string; status_verif: string }[]
}

const PAGE_SIZE = 15

const VONIS_CONFIG: Record<VonisType, { label: string; labelShort: string; color: string; activeColor: string }> = {
  ALFA_MURNI: { label: 'Alfa (Vonis)',    labelShort: 'Alfa',   color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',      activeColor: 'bg-rose-600 text-white border-rose-600' },
  IZIN:       { label: 'Izin',            labelShort: 'Izin',   color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',       activeColor: 'bg-blue-600 text-white border-blue-600' },
  SAKIT:      { label: 'Sakit',           labelShort: 'Sakit',  color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',   activeColor: 'bg-amber-500 text-white border-amber-500' },
  BELUM:      { label: 'Tdk Hadir',       labelShort: 'TDH',    color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',  activeColor: 'bg-slate-700 text-white border-slate-700' },
  KESALAHAN:  { label: 'Salah Input',     labelShort: 'Salah',  color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', activeColor: 'bg-purple-600 text-white border-purple-600' },
}

function SesiPill({ sesi, tanggal }: { sesi: string; tanggal: string }) {
  const SESI_COLOR: Record<string, string> = {
    shubuh: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    ashar:  'bg-orange-50 text-orange-700 border-orange-100',
    maghrib:'bg-slate-100 text-slate-700 border-slate-200',
  }
  const SESI_LABEL: Record<string, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }

  let tglStr = tanggal
  try { tglStr = new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }
  catch {}

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${SESI_COLOR[sesi] ?? 'bg-slate-100 text-slate-600'}`}>
      {SESI_LABEL[sesi] ?? sesi} · {tglStr}
    </span>
  )
}

// ── Kartu santri ──────────────────────────────────────────────────────────────
function SantriCard({ item, currentVonis, onSelect }: {
  item: AbsenItem
  currentVonis: VonisType | undefined
  onSelect: (santriId: string, v: VonisType) => void
}) {
  const isSelected = !!currentVonis
  const cfg = currentVonis ? VONIS_CONFIG[currentVonis] : null

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden ${
      isSelected ? 'ring-2 ring-emerald-400 border-emerald-300' : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Status bar atas */}
      <div className={`h-0.5 w-full transition-all ${isSelected ? 'bg-emerald-400' : 'bg-slate-200'}`} />

      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              {/* Avatar inisial */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${
                isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {item.nama.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">{item.nama}</h4>
                <p className="text-[11px] text-slate-400 font-mono">{item.nis} · {item.info}</p>
              </div>
              {/* Vonis terpilih — badge */}
              {isSelected && cfg && (
                <span className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.activeColor}`}>
                  ✓ {cfg.labelShort}
                </span>
              )}
            </div>

            {/* Sesi alfa */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.items.slice(0, 6).map((i, idx) => (
                <SesiPill key={idx} sesi={i.sesi} tanggal={i.tanggal} />
              ))}
              {item.items.length > 6 && (
                <span className="text-[10px] text-slate-400 font-medium self-center">+{item.items.length - 6} lagi</span>
              )}
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                {item.items.length} sesi · {item.items.length * 10} poin
              </span>
            </div>
          </div>

          {/* Tombol vonis */}
          <div className="flex flex-wrap sm:flex-col gap-1.5 sm:w-32 sm:shrink-0">
            {(Object.entries(VONIS_CONFIG) as [VonisType, typeof VONIS_CONFIG[VonisType]][]).map(([v, cfg]) => (
              <button key={v} onClick={() => onSelect(item.santri_id, v)}
                className={`flex-1 sm:flex-none py-2 px-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 text-center ${
                  currentVonis === v ? cfg.activeColor : cfg.color
                }`}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VerifikasiAbsenPage() {
  const [list, setList]         = useState<AbsenItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [drafts, setDrafts]     = useState<Record<string, VonisType>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  const loadData = useCallback(async () => {
    setLoading(true)
    setDrafts({})
    try {
      const res = await getAntrianVerifikasi()
      setList(res)
      setHasLoaded(true)
      setPage(1)
    } finally { setLoading(false) }
  }, [])

  const handleSelect = (santriId: string, v: VonisType) => {
    setDrafts(prev => {
      // Toggle off kalau klik yang sama
      if (prev[santriId] === v) {
        const n = { ...prev }; delete n[santriId]; return n
      }
      return { ...prev, [santriId]: v }
    })
  }

  const handlePilihSemua = (v: VonisType) => {
    const newDrafts: Record<string, VonisType> = {}
    filtered.forEach(i => { newDrafts[i.santri_id] = v })
    setDrafts(prev => ({ ...prev, ...newDrafts }))
  }

  const handleSimpan = async () => {
    const ids = Object.keys(drafts)
    if (!ids.length) return
    if (!confirm(`Simpan keputusan untuk ${ids.length} santri?`)) return

    setIsSaving(true)
    const payload = ids.map(id => ({
      santriId: id,
      items: list.find(i => i.santri_id === id)!.items,
      vonis: drafts[id],
    }))
    const res = await simpanVerifikasiMassal(payload)
    setIsSaving(false)

    if (res?.error) {
      toast.error('Gagal', { description: res.error })
    } else {
      toast.success('Verifikasi Tersimpan', { description: `${ids.length} santri berhasil diproses.` })
      setList(prev => prev.filter(i => !drafts[i.santri_id]))
      setDrafts({})
      setPage(1)
    }
  }

  // Filter
  const asramaList = Array.from(new Set(list.map(i => i.info.split(' / ')[0]).filter(Boolean))).sort()
  const filtered = list.filter(i => {
    if (filterAsrama !== 'SEMUA' && !i.info.startsWith(filterAsrama)) return false
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase()) && !i.nis.includes(search)) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalDrafts = Object.keys(drafts).length

  return (
    <div className="max-w-4xl mx-auto pb-32 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-violet-600" />
            Verifikasi Sidang Absensi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Tetapkan status alfa santri secara massal</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-60 transition-colors self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Refresh' : 'Tampilkan Antrian'}
        </button>
      </div>

      {/* ── Empty state ── */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center">
            <Gavel className="w-7 h-7 text-violet-300" />
          </div>
          <p className="text-slate-500 font-medium">Antrian sidang belum dimuat</p>
          <p className="text-sm text-slate-400">Klik <strong>Tampilkan Antrian</strong> untuk mulai</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat antrian...</span>
        </div>
      )}

      {hasLoaded && !loading && list.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
          <p className="font-bold text-slate-700 text-lg">Semua Beres!</p>
          <p className="text-slate-500 text-sm">Tidak ada antrian santri yang perlu diverifikasi.</p>
        </div>
      )}

      {/* ── Toolbar ── */}
      {hasLoaded && !loading && list.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            {/* Stats */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">{list.length} antrian</span>
                </div>
                {totalDrafts > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">{totalDrafts} sudah dipilih</span>
                  </div>
                )}
              </div>
              {/* Pilih semua */}
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 self-center font-medium">Pilih semua:</span>
                {(['ALFA_MURNI','IZIN','SAKIT'] as VonisType[]).map(v => (
                  <button key={v} onClick={() => handlePilihSemua(v)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all active:scale-95 ${VONIS_CONFIG[v].color}`}>
                    {VONIS_CONFIG[v].labelShort}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter asrama + search */}
            <div className="flex gap-2 flex-wrap">
              {asramaList.length > 1 && (
                <select value={filterAsrama} onChange={e => { setFilterAsrama(e.target.value); setPage(1) }}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 min-w-[140px]">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
              className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Cari nama atau NIS..."
                  value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button type="submit"
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors">
                Cari
              </button>
            </form>
          </div>

          {/* Hal info */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
              <span><strong className="text-slate-700">{filtered.length}</strong> santri{search && ` cocok "${search}"`}</span>
              {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
            </div>
          )}

          {/* List kartu */}
          <div className="space-y-2">
            {paged.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                Tidak ada santri yang cocok.
              </div>
            ) : paged.map(item => (
              <SantriCard key={item.santri_id} item={item}
                currentVonis={drafts[item.santri_id]}
                onSelect={handleSelect} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
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
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                        pg === page ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Floating save bar ── */}
      {totalDrafts > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <button onClick={handleSimpan} disabled={isSaving}
            className="w-full bg-slate-900 text-white py-4 px-5 rounded-2xl shadow-2xl flex items-center justify-between hover:bg-black transition-all active:scale-95 disabled:opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-sm">
                {totalDrafts}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm leading-none">Simpan Putusan</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{totalDrafts} santri akan diproses</p>
              </div>
            </div>
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : <Save className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      )}
    </div>
  )
}
