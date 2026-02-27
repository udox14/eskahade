'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSantriAktifUntukArsip, getFilterOptionsSantri,
  getGrupArsip, getSantriDalamGrup,
  arsipkanSantri, restoreSantri,
  hapusArsipPermanen, hapusArsipMassal,
  getArsipForDownload
} from './actions'
import {
  Archive, RotateCcw, ArrowLeft, Search, Loader2,
  CheckSquare, Square, Trash2, AlertTriangle,
  Users, Info, X, Download, Filter, GraduationCap,
  ChevronRight, ChevronLeft, Calendar, BookOpen
} from 'lucide-react'
import { toast } from 'sonner'

type Grup = {
  key: string
  angkatan: number | null
  catatan: string | null
  tanggal_arsip: string
  jumlah: number
  asramaList: string[]
}

export default function ArsipSantriPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'ARSIPKAN' | 'DAFTAR_ARSIP'>('ARSIPKAN')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── TAB ARSIPKAN ──
  const [santriList, setSantriList] = useState<any[]>([])
  const [santriTotal, setSantriTotal] = useState(0)
  const [santriPage, setSantriPage] = useState(1)
  const [santriHasMore, setSantriHasMore] = useState(false)
  const [loadingSantri, setLoadingSantri] = useState(false)
  const [loadingMoreSantri, setLoadingMoreSantri] = useState(false)
  const [filterSantri, setFilterSantri] = useState({ search: '', asrama: '', sekolah: '', kelas_sekolah: '', kelas_pesantren: '' })
  const [optsSantri, setOptsSantri] = useState<{ asramaList: string[], sekolahList: string[], kelasList: string[] }>({ asramaList: [], sekolahList: [], kelasList: [] })
  const [selectedArsip, setSelectedArsip] = useState<Set<string>>(new Set())
  const [catatanArsip, setCatatanArsip] = useState('')
  const [isArsipkan, setIsArsipkan] = useState(false)
  const [showFilterSantri, setShowFilterSantri] = useState(false)

  // ── TAB DAFTAR ARSIP — LEVEL 1: GRUP ──
  const [grupList, setGrupList] = useState<Grup[]>([])
  const [loadingGrup, setLoadingGrup] = useState(false)
  const [grupTotal, setGrupTotal] = useState(0)

  // ── TAB DAFTAR ARSIP — LEVEL 2: SANTRI DALAM GRUP ──
  const [activeGrup, setActiveGrup] = useState<Grup | null>(null)
  const [santriArsipList, setSantriArsipList] = useState<any[]>([])
  const [santriArsipTotal, setSantriArsipTotal] = useState(0)
  const [santriArsipPage, setSantriArsipPage] = useState(1)
  const [santriArsipHasMore, setSantriArsipHasMore] = useState(false)
  const [loadingSantriArsip, setLoadingSantriArsip] = useState(false)
  const [loadingMoreSantriArsip, setLoadingMoreSantriArsip] = useState(false)
  const [filterSantriArsip, setFilterSantriArsip] = useState({ search: '', asrama: '' })
  const [optsArsipAsrama, setOptsArsipAsrama] = useState<string[]>([])

  const [selectedRestore, setSelectedRestore] = useState<Set<string>>(new Set())
  const [isRestore, setIsRestore] = useState(false)
  const [isHapusMassal, setIsHapusMassal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // ── INIT ──
  useEffect(() => { loadFilterOptions() }, [])
  useEffect(() => {
    if (tab === 'ARSIPKAN') loadSantri(1, filterSantri, false)
    else { setActiveGrup(null); loadGrup() }
  }, [tab])

  const loadFilterOptions = async () => {
    const os = await getFilterOptionsSantri()
    setOptsSantri(os)
  }

  // ── LOAD SANTRI AKTIF ──
  const loadSantri = async (page: number, filter: typeof filterSantri, append: boolean) => {
    append ? setLoadingMoreSantri(true) : setLoadingSantri(true)
    const res = await getSantriAktifUntukArsip({ ...filter, page })
    if (append) setSantriList(prev => [...prev, ...res.data])
    else { setSantriList(res.data); setSelectedArsip(new Set()) }
    setSantriTotal(res.total); setSantriPage(page); setSantriHasMore(res.hasMore)
    append ? setLoadingMoreSantri(false) : setLoadingSantri(false)
  }

  const handleFilterSantriChange = (key: string, val: string) => {
    const next = { ...filterSantri, [key]: val }
    setFilterSantri(next)
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = setTimeout(() => loadSantri(1, next, false), 350)
  }

  // ── LOAD GRUP ARSIP (LEVEL 1) ──
  const loadGrup = async () => {
    setLoadingGrup(true)
    const data = await getGrupArsip()
    setGrupList(data)
    setGrupTotal(data.reduce((s, g) => s + g.jumlah, 0))
    setLoadingGrup(false)
  }

  // ── BUKA GRUP → LEVEL 2 ──
  const bukaGrup = async (grup: Grup) => {
    setActiveGrup(grup)
    setSelectedRestore(new Set())
    setFilterSantriArsip({ search: '', asrama: '' })
    setOptsArsipAsrama(grup.asramaList)
    loadSantriGrup(1, { search: '', asrama: '' }, false, grup)
  }

  const loadSantriGrup = async (
    page: number,
    filter: typeof filterSantriArsip,
    append: boolean,
    grup?: Grup
  ) => {
    const g = grup ?? activeGrup
    if (!g) return
    append ? setLoadingMoreSantriArsip(true) : setLoadingSantriArsip(true)
    const res = await getSantriDalamGrup(g.angkatan, g.catatan, g.tanggal_arsip, { ...filter, page })
    if (append) setSantriArsipList(prev => [...prev, ...res.data])
    else { setSantriArsipList(res.data); setSelectedRestore(new Set()) }
    setSantriArsipTotal(res.total); setSantriArsipPage(page); setSantriArsipHasMore(res.hasMore)
    append ? setLoadingMoreSantriArsip(false) : setLoadingSantriArsip(false)
  }

  const handleFilterSantriArsipChange = (key: string, val: string) => {
    const next = { ...filterSantriArsip, [key]: val }
    setFilterSantriArsip(next)
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = setTimeout(() => loadSantriGrup(1, next, false), 350)
  }

  // ── SELECT HELPERS ──
  const toggleSelectArsip = (id: string) => setSelectedArsip(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAllSantri = () => {
    if (selectedArsip.size === santriList.length && santriList.length > 0) setSelectedArsip(new Set())
    else setSelectedArsip(new Set(santriList.map(s => s.id)))
  }
  const toggleSelectRestore = (id: string) => setSelectedRestore(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAllRestore = () => {
    if (selectedRestore.size === santriArsipList.length && santriArsipList.length > 0) setSelectedRestore(new Set())
    else setSelectedRestore(new Set(santriArsipList.map(a => a.id)))
  }

  const activeFilterCount = Object.entries(filterSantri).filter(([k, v]) => k !== 'search' && v).length

  // ── ACTIONS ──
  const handleArsipkan = async () => {
    if (selectedArsip.size === 0) return toast.warning("Pilih santri yang akan dijadikan alumni")
    if (!confirm(`⚠️ Jadikan ${selectedArsip.size} santri sebagai ALUMNI?\n\nData mereka akan dipindah ke arsip dan dihapus dari daftar aktif.`)) return
    setIsArsipkan(true)
    const toastId = toast.loading(`Memproses ${selectedArsip.size} santri...`)
    const res = await arsipkanSantri(Array.from(selectedArsip), catatanArsip)
    toast.dismiss(toastId); setIsArsipkan(false)
    if (res?.error) { toast.error("Gagal", { description: res.error }); return }
    const msg = (res?.gagal ?? 0) > 0 ? `${res?.berhasil} berhasil, ${res?.gagal} gagal` : `${res?.berhasil} santri berhasil diarsipkan`
    toast.success("Selesai!", { description: msg })
    if ((res?.errors?.length ?? 0) > 0) console.error("Errors:", res?.errors)
    setCatatanArsip(''); loadSantri(1, filterSantri, false)
  }

  const handleRestore = async () => {
    if (selectedRestore.size === 0) return toast.warning("Pilih data yang akan direstore")
    if (!confirm(`Restore ${selectedRestore.size} santri ke daftar aktif?\n\nSantri dikembalikan tanpa kelas — atur manual setelahnya.`)) return
    setIsRestore(true)
    const toastId = toast.loading(`Merestore ${selectedRestore.size} santri...`)
    const res = await restoreSantri(Array.from(selectedRestore))
    toast.dismiss(toastId); setIsRestore(false)
    if (res?.error) { toast.error("Gagal", { description: res.error }); return }
    const msg = (res?.gagal ?? 0) > 0 ? `${res?.berhasil} berhasil, ${res?.gagal} gagal` : `${res?.berhasil} santri berhasil direstore`
    toast.success("Restore Selesai!", { description: msg })
    // Refresh grup & level 2
    loadSantriGrup(1, filterSantriArsip, false)
    loadGrup()
  }

  const handleHapusMassal = async () => {
    if (selectedRestore.size === 0) return toast.warning("Pilih data yang akan dihapus")
    if (!confirm(`⚠️ HAPUS PERMANEN ${selectedRestore.size} data arsip dari Supabase?\n\nPastikan sudah didownload dulu. Tindakan ini TIDAK BISA dibatalkan!`)) return
    setIsHapusMassal(true)
    const toastId = toast.loading(`Menghapus ${selectedRestore.size} arsip...`)
    const res = await hapusArsipMassal(Array.from(selectedRestore))
    toast.dismiss(toastId); setIsHapusMassal(false)
    if (res?.error) { toast.error("Gagal hapus", { description: res.error }); return }
    toast.success(`${res?.count} arsip dihapus`, { description: "Storage Supabase kini lebih lega." })
    loadSantriGrup(1, filterSantriArsip, false)
    loadGrup()
    // Kalau grup sudah kosong, kembali ke level 1
    if ((santriArsipTotal - (res?.count ?? 0)) <= 0) setActiveGrup(null)
  }

  const handleHapusSatu = async (id: string, nama: string) => {
    if (!confirm(`Hapus permanen arsip "${nama}"?\n\nData ini TIDAK BISA dikembalikan lagi!`)) return
    const res = await hapusArsipPermanen(id)
    if (res?.error) { toast.error("Gagal hapus"); return }
    toast.success("Arsip dihapus")
    loadSantriGrup(santriArsipPage, filterSantriArsip, false)
    loadGrup()
  }

  const handleDownload = async () => {
    const ids = selectedRestore.size > 0 ? Array.from(selectedRestore) : undefined
    setIsDownloading(true)
    const toastId = toast.loading("Menyiapkan data...")
    // Kalau tidak ada yang dipilih, download semua dalam grup ini
    const res = await getArsipForDownload(ids)
    toast.dismiss(toastId); setIsDownloading(false)
    if (res.error || !res.data) { toast.error("Gagal", { description: res.error }); return }
    const blob = new Blob([JSON.stringify({
      keterangan: "Backup Arsip Alumni - SKHDAPP",
      tanggal_export: new Date().toISOString(),
      total: res.data.length,
      data: res.data
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `arsip_alumni_${activeGrup?.angkatan ?? 'backup'}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success(`${res.data.length} data berhasil didownload`)
  }

  // ── LABEL GRUP ──
  const labelGrup = (g: Grup) => {
    if (g.catatan) return g.catatan
    if (g.angkatan) return `Angkatan ${g.angkatan}`
    return `Backup ${g.tanggal_arsip}`
  }

  // ── RENDER ──
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-28">

      {/* HEADER */}
      <div className="flex items-center gap-4 border-b pb-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Archive className="w-6 h-6 text-purple-600" /> Arsip Alumni
          </h1>
          <p className="text-gray-500 text-sm">Jadikan santri alumni, restore, atau hapus arsip untuk hemat storage.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg text-center">
            <p className="font-bold text-blue-700">{santriTotal}</p>
            <p className="text-[10px] text-blue-500">Santri Aktif</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-lg text-center">
            <p className="font-bold text-purple-700">{grupTotal}</p>
            <p className="text-[10px] text-purple-500">Total Alumni</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('ARSIPKAN')} className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'ARSIPKAN' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <GraduationCap className="w-4 h-4" /> Jadikan Alumni
        </button>
        <button onClick={() => setTab('DAFTAR_ARSIP')} className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'DAFTAR_ARSIP' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <RotateCcw className="w-4 h-4" /> Daftar Arsip & Restore
          {grupList.length > 0 && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{grupList.length}</span>}
        </button>
      </div>

      {/* ══ TAB 1: JADIKAN ALUMNI ══ */}
      {tab === 'ARSIPKAN' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Pilih santri yang sudah lulus → sistem menyalin semua data (nilai, absensi, pelanggaran, SPP) ke arsip → lalu menghapusnya dari daftar aktif untuk menghemat storage.</p>
          </div>

          {/* Kontrol filter */}
          <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Catatan Arsip (Opsional)</label>
                <input value={catatanArsip} onChange={e => setCatatanArsip(e.target.value)} placeholder="Contoh: Wisuda Angkatan 2024" className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="relative md:w-64">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cari</label>
                <Search className="absolute left-3 bottom-2.5 text-gray-400 w-4 h-4" />
                <input value={filterSantri.search} onChange={e => handleFilterSantriChange('search', e.target.value)} placeholder="Nama / NIS..." className="w-full pl-9 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="flex items-end">
                <button onClick={() => setShowFilterSantri(p => !p)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition-colors ${showFilterSantri || activeFilterCount > 0 ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <Filter className="w-4 h-4" /> Filter
                  {activeFilterCount > 0 && <span className="bg-purple-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
                </button>
              </div>
            </div>
            {showFilterSantri && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t animate-in fade-in">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Asrama</label>
                  <select value={filterSantri.asrama} onChange={e => handleFilterSantriChange('asrama', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">Semua</option>
                    {optsSantri.asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Sekolah</label>
                  <select value={filterSantri.sekolah} onChange={e => handleFilterSantriChange('sekolah', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">Semua</option>
                    {optsSantri.sekolahList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Kelas Sekolah</label>
                  <input value={filterSantri.kelas_sekolah} onChange={e => handleFilterSantriChange('kelas_sekolah', e.target.value)} placeholder="Contoh: 9A" className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Kelas Pesantren</label>
                  <select value={filterSantri.kelas_pesantren} onChange={e => handleFilterSantriChange('kelas_pesantren', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">Semua</option>
                    {optsSantri.kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={() => { const e = { search: filterSantri.search, asrama: '', sekolah: '', kelas_sekolah: '', kelas_pesantren: '' }; setFilterSantri(e); loadSantri(1, e, false) }} className="col-span-full text-xs text-red-500 hover:text-red-700 flex items-center gap-1 justify-end">
                    <X className="w-3 h-3" /> Reset filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabel santri aktif */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAllSantri} className="text-gray-500 hover:text-purple-600">
                  {selectedArsip.size === santriList.length && santriList.length > 0 ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5" />}
                </button>
                <span className="text-sm font-bold text-gray-600">
                  {santriList.length} dari {santriTotal} santri{selectedArsip.size > 0 && ` • ${selectedArsip.size} dipilih`}
                </span>
              </div>
              {selectedArsip.size > 0 && <button onClick={() => setSelectedArsip(new Set())} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Batal pilih</button>}
            </div>
            <div className="max-h-[450px] overflow-y-auto">
              {loadingSantri ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
              ) : santriList.length === 0 ? (
                <div className="py-16 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 text-gray-300" /><p>Tidak ada santri ditemukan</p></div>
              ) : (
                <>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0 z-10 border-b">
                      <tr>
                        <th className="px-4 py-2 w-10"></th>
                        <th className="px-2 py-2">Nama / NIS</th>
                        <th className="px-4 py-2 hidden md:table-cell">Asrama</th>
                        <th className="px-4 py-2 hidden md:table-cell">Sekolah</th>
                        <th className="px-4 py-2 hidden md:table-cell">Kls Sekolah</th>
                        <th className="px-4 py-2 hidden md:table-cell">Kls Pesantren</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {santriList.map(s => {
                        const isSelected = selectedArsip.has(s.id)
                        const kelasPesantren = s.riwayat_pendidikan?.[0]?.kelas?.nama_kelas
                        return (
                          <tr key={s.id} onClick={() => toggleSelectArsip(s.id)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3">{isSelected ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5 text-gray-300" />}</td>
                            <td className="px-2 py-3">
                              <p className={`font-bold ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>{s.nama_lengkap}</p>
                              <p className="text-xs text-gray-400 font-mono">{s.nis}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{s.asrama || '-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{s.sekolah || '-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{s.kelas_sekolah || '-'}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {kelasPesantren && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{kelasPesantren}</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {santriHasMore && (
                    <div className="p-4 text-center border-t">
                      <button onClick={() => loadSantri(santriPage + 1, filterSantri, true)} disabled={loadingMoreSantri} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto disabled:opacity-50">
                        {loadingMoreSantri && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loadingMoreSantri ? 'Memuat...' : `Muat lebih banyak (sisa ${santriTotal - santriList.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 2: DAFTAR ARSIP & RESTORE ══ */}
      {tab === 'DAFTAR_ARSIP' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">

          {/* ── LEVEL 1: DAFTAR GRUP ── */}
          {!activeGrup && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">Pilih batch arsip untuk melihat daftar santri di dalamnya dan melakukan restore atau hapus.</p>
              </div>

              {loadingGrup ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
              ) : grupList.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Archive className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>Belum ada data alumni di arsip</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {grupList.map(g => (
                    <button key={g.key} onClick={() => bukaGrup(g)}
                      className="w-full bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-purple-200 transition-all text-left group">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${g.angkatan ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {g.angkatan
                          ? <BookOpen className="w-6 h-6 text-purple-600" />
                          : <Calendar className="w-6 h-6 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 group-hover:text-purple-700 transition-colors">{labelGrup(g)}</p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {g.jumlah} santri
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(g.tanggal_arsip).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          {g.asramaList.slice(0, 3).map(a => (
                            <span key={a} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                          {g.asramaList.length > 3 && <span className="text-[10px] text-gray-400">+{g.asramaList.length - 3} asrama</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── LEVEL 2: SANTRI DALAM GRUP ── */}
          {activeGrup && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveGrup(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 font-bold transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Daftar Arsip
                </button>
                <span className="text-gray-300">/</span>
                <span className="text-sm font-bold text-gray-800">{labelGrup(activeGrup)}</span>
              </div>

              {/* Filter + aksi */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input value={filterSantriArsip.search} onChange={e => handleFilterSantriArsipChange('search', e.target.value)} placeholder="Cari nama / NIS..." className="w-full pl-9 p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                {optsArsipAsrama.length > 1 && (
                  <select value={filterSantriArsip.asrama} onChange={e => handleFilterSantriArsipChange('asrama', e.target.value)} className="p-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-400">
                    <option value="">Semua Asrama</option>
                    {optsArsipAsrama.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
                <button onClick={handleDownload} disabled={isDownloading} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2 shadow-sm">
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {selectedRestore.size > 0 ? `Download Terpilih (${selectedRestore.size})` : 'Download Semua'}
                </button>
              </div>

              {/* Tabel santri arsip */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleSelectAllRestore} className="text-gray-500 hover:text-green-600">
                      {selectedRestore.size === santriArsipList.length && santriArsipList.length > 0 ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="text-sm font-bold text-gray-600">
                      {santriArsipList.length} dari {santriArsipTotal} santri{selectedRestore.size > 0 && ` • ${selectedRestore.size} dipilih`}
                    </span>
                  </div>
                  {selectedRestore.size > 0 && <button onClick={() => setSelectedRestore(new Set())} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Batal pilih</button>}
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {loadingSantriArsip ? (
                    <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
                  ) : santriArsipList.length === 0 ? (
                    <div className="py-16 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 text-gray-300" /><p>Tidak ada santri ditemukan</p></div>
                  ) : (
                    <>
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0 z-10 border-b">
                          <tr>
                            <th className="px-4 py-2 w-10"></th>
                            <th className="px-2 py-2">Nama / NIS</th>
                            <th className="px-4 py-2 hidden md:table-cell">Asrama</th>
                            <th className="px-4 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {santriArsipList.map(a => {
                            const isSelected = selectedRestore.has(a.id)
                            return (
                              <tr key={a.id} className={`transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                <td className="px-4 py-3">
                                  <button onClick={() => toggleSelectRestore(a.id)}>
                                    {isSelected ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                                  </button>
                                </td>
                                <td className="px-2 py-3">
                                  <p className={`font-bold ${isSelected ? 'text-green-800' : 'text-gray-800'}`}>{a.nama_lengkap}</p>
                                  <p className="text-xs text-gray-400 font-mono">{a.nis}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{a.asrama || '-'}</td>
                                <td className="px-4 py-3">
                                  <button onClick={() => handleHapusSatu(a.id, a.nama_lengkap)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Hapus permanen">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {santriArsipHasMore && (
                        <div className="p-4 text-center border-t">
                          <button onClick={() => loadSantriGrup(santriArsipPage + 1, filterSantriArsip, true)} disabled={loadingMoreSantriArsip} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto disabled:opacity-50">
                            {loadingMoreSantriArsip && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loadingMoreSantriArsip ? 'Memuat...' : `Muat lebih banyak (sisa ${santriArsipTotal - santriArsipList.length})`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ FLOATING ACTION BAR ══ */}
      {tab === 'ARSIPKAN' && selectedArsip.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm">{selectedArsip.size}</div>
              <div className="leading-tight">
                <p className="font-bold text-sm">Siap dijadikan alumni</p>
                <p className="text-xs text-gray-400">Data akan dipindah ke arsip</p>
              </div>
            </div>
            <button onClick={handleArsipkan} disabled={isArsipkan} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 active:scale-95">
              {isArsipkan ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              Jadikan Alumni
            </button>
          </div>
        </div>
      )}

      {tab === 'DAFTAR_ARSIP' && activeGrup && selectedRestore.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{selectedRestore.size}</div>
              <div className="leading-tight">
                <p className="font-bold text-sm">Terpilih</p>
                <p className="text-xs text-gray-400">Restore atau hapus permanen</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleHapusMassal} disabled={isHapusMassal || isRestore} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 active:scale-95">
                {isHapusMassal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus Permanen
              </button>
              <button onClick={handleRestore} disabled={isRestore || isHapusMassal} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 active:scale-95">
                {isRestore ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}