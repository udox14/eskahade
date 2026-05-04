'use client'

import { useState, useCallback, useEffect } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal, getKelasList, getAsramaList, getMarhalahList } from './actions'
import {
  Gavel, CheckCircle, Loader2, AlertTriangle,
  Save, ChevronLeft, ChevronRight, RefreshCw, Search, Filter, ChevronDown, Calendar
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
    <div className="flex items-center bg-slate-50 border border-slate-200 p-0.5 rounded-xl w-fit">
      {([
        { v: 'ALFA_MURNI' as VonisType, label: 'Alfa',   active: 'bg-rose-600 text-white shadow-sm',   idle: 'text-slate-600 hover:bg-white hover:text-rose-600' },
        { v: 'SAKIT'      as VonisType, label: 'Sakit',  active: 'bg-amber-500 text-white shadow-sm',  idle: 'text-slate-600 hover:bg-white hover:text-amber-600' },
        { v: 'IZIN'       as VonisType, label: 'Izin',   active: 'bg-blue-600 text-white shadow-sm',   idle: 'text-slate-600 hover:bg-white hover:text-blue-600' },
        { v: 'BELUM'      as VonisType, label: 'Mangkir',active: 'bg-slate-700 text-white shadow-sm',   idle: 'text-slate-600 hover:bg-white' },
        { v: 'KESALAHAN'  as VonisType, label: 'Salah',  active: 'bg-violet-600 text-white shadow-sm', idle: 'text-slate-600 hover:bg-white hover:text-violet-600' },
      ].map(({ v, label, active, idle }) => (
        <button key={v} onClick={() => onSelect(item.santri_id, v)}
          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all active:scale-90 ${vonis === v ? active : idle}`}>
          {label}
        </button>
      )))}
    </div>
  )

  const sesiPills = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg">
        <AlertTriangle className="w-3 h-3" />
        <span className="text-[11px] font-black uppercase tracking-tighter">{item.items.length} Sesi</span>
      </div>
      <div className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
        {fmtTgl(item.items[0].tanggal)} — {fmtTgl(item.items[item.items.length - 1].tanggal)}
      </div>
    </div>
  )

  if (no === -1) {
    // Mobile card
    return (
      <div className={`rounded-xl border p-4 space-y-4 transition-all shadow-sm ${
        terpilih ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`font-bold text-sm ${terpilih ? 'text-emerald-800' : 'text-slate-900'}`}>{item.nama}</p>
            <p className="text-[11px] text-slate-400 font-medium tracking-tight uppercase">{item.nis} · {item.info}</p>
          </div>
          {terpilih && (
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail Alfa:</p>
          {sesiPills}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Tentukan Vonis:</p>
          <div className="flex justify-center">
            {tombol}
          </div>
        </div>
      </div>
    )
  }

  // Desktop row
  return (
    <tr className={`border-b border-slate-100 transition-colors ${terpilih ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}>
      <td className="px-3 py-2.5 text-xs text-slate-300 text-center w-8">{no}</td>
      <td className="px-3 py-2.5">
        <p className={`font-semibold text-sm leading-tight ${terpilih ? 'text-emerald-800' : 'text-slate-800'}`}>{item.nama}</p>
        <p className="text-xs text-slate-400">{item.nis} · {item.info}</p>
      </td>
      <td className="px-3 py-2.5">{sesiPills}</td>
      <td className="px-3 py-2.5">{tombol}</td>
    </tr>
  )
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
  }, [selectedDate, selectedKelas, selectedAsrama, selectedMarhalah])

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
          <h1 className="text-2xl font-bold text-slate-800">Verifikasi Absensi</h1>
          <p className="text-slate-500 text-sm">Tetapkan status sidang alfa santri secara massal</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-60 transition-all shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-bold">Filter Sidang</span>
        </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1 uppercase tracking-wider">Marhalah</label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg outline-none appearance-none text-sm text-slate-700 cursor-pointer transition-all hover:border-slate-300"
                  value={selectedMarhalah}
                  onChange={(e) => { setSelectedMarhalah(e.target.value); setSelectedKelas('') }}
                >
                  <option value="">Semua Marhalah</option>
                  {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1 uppercase tracking-wider">Kelas</label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg outline-none appearance-none text-sm text-slate-700 cursor-pointer transition-all hover:border-slate-300"
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList
                    .filter(k => !selectedMarhalah || k.marhalah_id == selectedMarhalah)
                    .map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)
                  }
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1 uppercase tracking-wider">Asrama</label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg outline-none appearance-none text-sm text-slate-700 cursor-pointer transition-all hover:border-slate-300"
                  value={selectedAsrama}
                  onChange={(e) => setSelectedAsrama(e.target.value)}
                >
                  <option value="">Semua Asrama</option>
                  {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1 uppercase tracking-wider">Pilih Pekan (Opsional)</label>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm text-slate-700 transition-all hover:border-slate-300"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
            className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari nama atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all" />
            </div>
            <button type="submit"
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition-all active:scale-95">
              Cari
            </button>
          </form>

          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { v: 'ALFA_MURNI' as VonisType, label: 'ALFA',   cls: 'bg-rose-600 text-white hover:bg-rose-700' },
              { v: 'SAKIT'      as VonisType, label: 'SAKIT',  cls: 'bg-amber-500 text-white hover:bg-amber-600' },
              { v: 'IZIN'       as VonisType, label: 'IZIN',   cls: 'bg-blue-600 text-white hover:bg-blue-700' },
            ].map(({ v, label, cls }) => (
              <button key={v} onClick={() => handlePilihSemua(v)}
                className={`px-5 py-2.5 rounded-lg text-[11px] font-black tracking-widest transition-all active:scale-95 shadow-sm ${cls}`}>
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
        <div className="flex flex-col items-center py-20 bg-white rounded-xl border shadow-sm text-center gap-4">
          <Gavel className="w-16 h-16 text-slate-200" />
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Siap Verifikasi?</h3>
            <p className="text-slate-500 text-sm">Pilih filter di atas lalu klik tombol di bawah untuk menampilkan antrian sidang.</p>
          </div>
          <button 
            onClick={loadData}
            className="bg-violet-600 text-white px-8 py-3 rounded-xl font-bold shadow hover:bg-violet-700 active:scale-95 transition-all"
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
                  no={-1}
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
