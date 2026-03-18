'use client'

import { useState, useCallback } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal } from './actions'
import {
  Gavel, CheckCircle, Loader2, AlertTriangle,
  Save, ChevronLeft, ChevronRight, RefreshCw, Users, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

type VonisType = 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
type AbsenItem = {
  santri_id: string; nama: string; nis: string; info: string
  items: { absen_id: string; tanggal: string; sesi: string; status_verif: string }[]
}

const PAGE_SIZE = 20

const SESI_LABEL: Record<string, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }
const SESI_COLOR: Record<string, string> = {
  shubuh:  'bg-indigo-50 text-indigo-700 border-indigo-100',
  ashar:   'bg-orange-50 text-orange-700 border-orange-100',
  maghrib: 'bg-slate-100 text-slate-600 border-slate-200',
}

function fmtTgl(s: string) {
  try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }
  catch { return s }
}

// ── Baris (desktop) / Card (mobile) ──────────────────────────────────────────
function BarisAbsen({ item, no, vonis, onSelect }: {
  item: AbsenItem; no: number
  vonis: VonisType | undefined
  onSelect: (santriId: string, v: VonisType) => void
}) {
  const terpilih = !!vonis

  const tombol = (
    <div className="flex flex-wrap gap-1.5">
      {([
        { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',       active: 'bg-rose-600 text-white',   idle: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' },
        { v: 'SAKIT'      as VonisType, label: 'Sakit',      active: 'bg-amber-500 text-white',  idle: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' },
        { v: 'IZIN'       as VonisType, label: 'Izin',       active: 'bg-blue-600 text-white',   idle: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' },
        { v: 'BELUM'      as VonisType, label: 'Tdk Hadir',  active: 'bg-slate-700 text-white',  idle: 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200' },
        { v: 'KESALAHAN'  as VonisType, label: 'Salah Input',active: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' },
      ].map(({ v, label, active, idle }) => (
        <button key={v} onClick={() => onSelect(item.santri_id, v)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-all ${vonis === v ? active : idle}`}>
          {label}
        </button>
      )))}
    </div>
  )

  const sesiPills = (
    <div className="flex flex-wrap gap-1">
      {item.items.slice(0, 5).map((i, idx) => (
        <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SESI_COLOR[i.sesi] ?? 'bg-slate-100'}`}>
          {SESI_LABEL[i.sesi]} {fmtTgl(i.tanggal)}
        </span>
      ))}
      {item.items.length > 5 && (
        <span className="text-[9px] text-slate-400 self-center">+{item.items.length - 5}</span>
      )}
      <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded">
        {item.items.length} sesi · {item.items.length * 10}p
      </span>
    </div>
  )

  // Desktop row
  const desktopRow = (
    <tr className={`hidden sm:table-row border-b border-slate-100 transition-colors ${terpilih ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}>
      <td className="px-3 py-2.5 text-xs text-slate-300 text-center w-8">{no}</td>
      <td className="px-3 py-2.5">
        <p className={`font-semibold text-sm leading-tight ${terpilih ? 'text-emerald-800' : 'text-slate-800'}`}>{item.nama}</p>
        <p className="text-xs text-slate-400">{item.nis} · {item.info}</p>
      </td>
      <td className="px-3 py-2.5">{sesiPills}</td>
      <td className="px-3 py-2.5">{tombol}</td>
    </tr>
  )

  // Mobile card
  const mobileCard = (
    <div className={`sm:hidden rounded-2xl border p-3.5 space-y-2.5 transition-all ${
      terpilih ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-bold text-sm ${terpilih ? 'text-emerald-800' : 'text-slate-900'}`}>{item.nama}</p>
          <p className="text-xs text-slate-400">{item.nis} · {item.info}</p>
        </div>
        {terpilih && (
          <span className="shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            ✓ Terpilih
          </span>
        )}
      </div>
      {sesiPills}
      {tombol}
    </div>
  )

  return <>{desktopRow}{mobileCard}</>
}

// ── Main ──────────────────────────────────────────────────────────────────────
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

  const handleSelect = async (santriId: string, v: VonisType) =>
    setDrafts(prev => prev[santriId] === v
      ? (({ [santriId]: _, ...rest }) => rest)(prev)
      : { ...prev, [santriId]: v }
    )

  const handlePilihSemua = async (v: VonisType) => {
    const next: Record<string, VonisType> = {}
    filtered.forEach(i => { next[i.santri_id] = v })
    setDrafts(prev => ({ ...prev, ...next }))
  }

  const handleSimpan = async () => {
    const ids = Object.keys(drafts)
    if (!ids.length) return
    if (!await confirm(`Simpan keputusan untuk ${ids.length} santri?`)) return
    setIsSaving(true)
    const payload = ids.map(id => ({
      santriId: id,
      items:    list.find(i => i.santri_id === id)!.items,
      vonis:    drafts[id],
    }))
    const res = await simpanVerifikasiMassal(payload)
    setIsSaving(false)
    if (res?.error) { toast.error('Gagal', { description: res.error }); return }
    toast.success('Tersimpan', { description: `${ids.length} santri berhasil diproses.` })
    setList(prev => prev.filter(i => !drafts[i.santri_id]))
    setDrafts({}); setPage(1)
  }

  const asramaList = Array.from(new Set(list.map(i => i.info.split(' / ')[0]).filter(Boolean))).sort()

  const filtered = list.filter(i => {
    if (filterAsrama !== 'SEMUA' && !i.info.startsWith(filterAsrama)) return false
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase()) && !i.nis.includes(search)) return false
    return true
  })
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const paged       = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalDrafts = Object.keys(drafts).length

  return (
    <div className="max-w-5xl mx-auto pb-32 space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-violet-600" /> Verifikasi Sidang Absensi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Tetapkan status alfa santri secara massal</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-60 transition-colors self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Perbarui' : 'Tampilkan Antrian'}
        </button>
      </div>

      {/* Empty states */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Gavel className="w-10 h-10 text-violet-200" />
          <p className="text-slate-500 text-sm">Klik <strong>Tampilkan Antrian</strong> untuk mulai</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat antrian...</span>
        </div>
      )}
      {hasLoaded && !loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-2 bg-white rounded-2xl border border-slate-200 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <p className="font-bold text-slate-700">Semua Beres!</p>
          <p className="text-slate-500 text-sm">Tidak ada antrian yang perlu diverifikasi.</p>
        </div>
      )}

      {/* Toolbar + tabel */}
      {hasLoaded && !loading && list.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">

              {/* Stats */}
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
                <Users className="w-3.5 h-3.5" /> {list.length} antrian
              </div>
              {totalDrafts > 0 && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" /> {totalDrafts} dipilih
                </div>
              )}

              <div className="flex-1" />

              {/* Pilih semua */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">Pilih semua:</span>
                {([
                  { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',  cls: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
                  { v: 'SAKIT'      as VonisType, label: 'Sakit', cls: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
                  { v: 'IZIN'       as VonisType, label: 'Izin',  cls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                ].map(({ v, label, cls }) => (
                  <button key={v} onClick={() => handlePilihSemua(v)}
                    className={`border px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${cls}`}>
                    {label}
                  </button>
                )))}
              </div>
            </div>

            {/* Search + filter asrama */}
            <div className="flex gap-2 flex-wrap">
              {asramaList.length > 1 && (
                <select value={filterAsrama} onChange={e => { setFilterAsrama(e.target.value); setPage(1) }}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
                className="flex gap-2 flex-1 min-w-[180px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="Cari nama atau NIS..."
                    value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <button type="submit"
                  className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors">
                  Cari
                </button>
              </form>
            </div>
          </div>

          {/* Info hal */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
              <span><strong className="text-slate-700">{filtered.length}</strong> santri</span>
              {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
            </div>
          )}

          {/* Tabel + cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Desktop tabel */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-8">No</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Nama Santri</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Sesi Alfa</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Vonis</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <BarisAbsen key={item.santri_id} item={item}
                      no={(page-1)*PAGE_SIZE+i+1}
                      vonis={drafts[item.santri_id]}
                      onSelect={handleSelect} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden p-3 space-y-2.5">
              {paged.map((item, i) => (
                <BarisAbsen key={item.santri_id} item={item}
                  no={(page-1)*PAGE_SIZE+i+1}
                  vonis={drafts[item.santri_id]}
                  onSelect={handleSelect} />
              ))}
            </div>

            {paged.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">Tidak ada data yang cocok.</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
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
                        pg === page ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating save */}
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
