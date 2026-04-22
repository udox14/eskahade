'use client'

import { useState, useCallback, useEffect } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal, getKelasList, getAsramaList, getMarhalahList } from './actions'
import {
  Gavel, CheckCircle, Loader2, AlertTriangle,
  Save, ChevronLeft, ChevronRight, RefreshCw, Users, Search, Filter, ChevronDown, Calendar
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

  const [kelasList, setKelasList] = useState<any[]>([])
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedAsrama, setSelectedAsrama] = useState('')
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [selectedDate, setSelectedDate] = useState('') // Kosongkan agar fetch 3 bulan terakhir defaultnya

  useEffect(() => {
    getKelasList().then(setKelasList)
    getAsramaList().then(setAsramaList)
    getMarhalahList().then(setMarhalahList)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true); setDrafts({})
    try { 
      const data = await getAntrianVerifikasi(selectedDate, {
        kelasId: selectedKelas,
        asrama: selectedAsrama,
        marhalahId: selectedMarhalah
      })
      setList(data)
      setHasLoaded(true)
      setPage(1) 
    }
    finally { setLoading(false) }
  }, [selectedDate, selectedKelas, selectedAsrama, selectedMarhalah])

  useEffect(() => {
    if (hasLoaded) {
      loadData()
    }
  }, [loadData, hasLoaded])

  const handleSelect = (santriId: string, v: VonisType) =>
    setDrafts(prev => prev[santriId] === v
      ? (({ [santriId]: _, ...rest }) => rest)(prev)
      : { ...prev, [santriId]: v }
    )

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


  const filtered = list.filter(i => {
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase()) && !i.nis.includes(search)) return false
    return true
  })
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const paged       = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalDrafts = Object.keys(drafts).length

  return (
    <div className="max-w-5xl mx-auto pb-32 space-y-6">
      {/* Header Utama */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <Gavel className="w-8 h-8 text-violet-600" /> Verifikasi Absensi
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Tetapkan status sidang alfa santri secara massal</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 disabled:opacity-60 transition-all shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan Antrian
          </button>
        </div>
      </div>

      {/* FILTER BAR - PREMIUM DESIGN */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Filter Sidang</span>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filter Marhalah */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-violet-600 transition-colors">Marhalah</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none appearance-none text-sm text-slate-700 font-bold cursor-pointer transition-all hover:border-slate-300"
                value={selectedMarhalah}
                onChange={(e) => { setSelectedMarhalah(e.target.value); setSelectedKelas('') }}
              >
                <option value="">Semua Marhalah</option>
                {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Kelas */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-violet-600 transition-colors">Kelas</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none appearance-none text-sm text-slate-700 font-bold cursor-pointer transition-all hover:border-slate-300"
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
              >
                <option value="">Semua Kelas</option>
                {kelasList
                  .filter(k => !selectedMarhalah || k.marhalah_id == selectedMarhalah)
                  .map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)
                }
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Asrama */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-violet-600 transition-colors">Asrama</label>
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none appearance-none text-sm text-slate-700 font-bold cursor-pointer transition-all hover:border-slate-300"
                value={selectedAsrama}
                onChange={(e) => setSelectedAsrama(e.target.value)}
              >
                <option value="">Semua Asrama</option>
                {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter Tanggal */}
            <div className="relative group">
              <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-tighter z-10 group-focus-within:text-violet-600 transition-colors">Pilih Pekan (Opsional)</label>
              <input 
                type="date" 
                className="w-full pl-3 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm text-slate-700 font-bold transition-all hover:border-slate-300"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-100">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
            className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
              <input type="text" placeholder="Cari nama santri atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all shadow-inner" />
            </div>
            <button type="submit"
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200">
              Cari
            </button>
          </form>

          <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-2 mr-1">Pilih Semua:</span>
            {([
              { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',  cls: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white' },
              { v: 'SAKIT'      as VonisType, label: 'Sakit', cls: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-500 hover:text-white' },
              { v: 'IZIN'       as VonisType, label: 'Izin',  cls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white' },
            ].map(({ v, label, cls }) => (
              <button key={v} onClick={() => handlePilihSemua(v)}
                className={`border px-4 py-2 rounded-xl text-[10px] font-black tracking-wider transition-all active:scale-95 ${cls}`}>
                {label}
              </button>
            )))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
           <Loader2 className="w-12 h-12 animate-spin text-violet-600 opacity-20" />
           <p className="text-slate-400 font-bold animate-pulse tracking-widest text-[10px]">MEMUAT ANTRIAN SIDANG...</p>
        </div>
      ) : !hasLoaded ? (
        <div className="flex flex-col items-center py-24 gap-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center">
          <div className="w-24 h-24 bg-violet-50 rounded-full flex items-center justify-center">
            <Gavel className="w-12 h-12 text-violet-300" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Siap Verifikasi?</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">Gunakan filter di atas lalu klik tombol di bawah untuk menarik data santri yang perlu disidang.</p>
          </div>
          <button 
            onClick={loadData}
            className="bg-violet-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all"
          >
            Tampilkan Antrian Sidang
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">Semua Beres!</h3>
            <p className="text-slate-500 text-sm mt-1">Tidak ditemukan antrian sidang yang perlu diproses.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-2 rounded-full tracking-widest">
                <Users className="w-3.5 h-3.5" /> {list.length} ANTRIAN
              </div>
              {totalDrafts > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-pulse tracking-widest">
                  <CheckCircle className="w-3.5 h-3.5" /> {totalDrafts} DIPILIH
                </div>
              )}
            </div>
            {totalPages > 1 && (
               <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                Halaman {page} dari {totalPages}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* Desktop tabel */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">No</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Nama Santri</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Sesi Alfa</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Vonis Sidang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
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
            <div className="sm:hidden p-4 space-y-4">
              {paged.map((item, i) => (
                <BarisAbsen key={item.santri_id} item={item}
                  no={(page-1)*PAGE_SIZE+i+1}
                  vonis={drafts[item.santri_id]}
                  onSelect={handleSelect} />
              ))}
            </div>

            {paged.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-bold italic">Tidak ada data yang cocok dengan pencarian.</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="flex items-center gap-2 px-5 py-2.5 font-bold border border-slate-200 rounded-2xl text-slate-600 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" /> Sebelum
              </button>
              <div className="flex gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-10 h-10 rounded-2xl text-sm font-black transition-all ${
                        pg === page ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                className="flex items-center gap-2 px-5 py-2.5 font-bold border border-slate-200 rounded-2xl text-slate-600 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all">
                Lanjut <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating save */}
      {totalDrafts > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <button onClick={handleSimpan} disabled={isSaving}
            className="w-full bg-slate-900 text-white py-4 px-6 rounded-[2rem] shadow-2xl flex items-center justify-between hover:bg-black hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-60 ring-4 ring-white">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-lg">
                {totalDrafts}
              </div>
              <div className="text-left">
                <p className="font-black text-sm tracking-tight">SIMPAN PUTUSAN</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{totalDrafts} SANTRI SIAP PROSES</p>
              </div>
            </div>
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : <Save className="w-6 h-6 text-emerald-400" />}
          </button>
        </div>
      )}
    </div>
  )
}
