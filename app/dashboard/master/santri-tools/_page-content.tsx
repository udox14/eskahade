'use client'

import { useState, useEffect } from 'react'
import {
  previewNaikKelas, eksekusiNaikKelas,
  getSantriPembebasan, setBebas,
  catatBebasPembayaran, hapusBebasPembayaran,
  getSekolahList,
} from './actions'
import {
  ArrowUpCircle, ShieldCheck, Loader2, Search, CheckSquare,
  Square, AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp,
  GraduationCap, Banknote, RefreshCw, Users, Filter,
} from 'lucide-react'
import { toast } from 'sonner'

const ASRAMA_LIST = ['', 'AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const JENIS_BIAYA_LIST = ['KESEHATAN', 'EHB', 'EKSKUL', 'BANGUNAN']

const STATUS_COLOR: Record<string, string> = {
  naik: 'bg-green-100 text-green-700',
  lulus_sltp: 'bg-blue-100 text-blue-700',
  lulus_slta: 'bg-purple-100 text-purple-700',
  tidak_diketahui: 'bg-slate-100 text-slate-500',
}
const STATUS_LABEL: Record<string, string> = {
  naik: 'Naik Kelas',
  lulus_sltp: 'Lulus SLTP → SLTA',
  lulus_slta: 'Lulus SLTA',
  tidak_diketahui: 'Format Tidak Dikenal',
}

type Tab = 'naik_kelas' | 'pembebasan'

export default function SantriToolsPage() {
  const [tab, setTab] = useState<Tab>('naik_kelas')

  // ── TAB NAIK KELAS ─────────────────────────────────────────────────────
  const [filterAsrama, setFilterAsrama] = useState('')
  const [filterSekolah, setFilterSekolah] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [sekolahList, setSekolahList] = useState<string[]>([])
  const [preview, setPreview] = useState<any[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [eksekusiLoading, setEksekusiLoading] = useState(false)
  const [showTidakDikenal, setShowTidakDikenal] = useState(false)

  // ── TAB PEMBEBASAN ─────────────────────────────────────────────────────
  const [pbAsrama, setPbAsrama] = useState('')
  const [pbSearch, setPbSearch] = useState('')
  const [pbHanyaBebas, setPbHanyaBebas] = useState(false)
  const [pbData, setPbData] = useState<any[]>([])
  const [pbLoading, setPbLoading] = useState(false)
  const [pbSelected, setPbSelected] = useState<Set<string>>(new Set())
  const [pbTahun, setPbTahun] = useState(new Date().getFullYear())
  // Modal detail pembayaran tahunan
  const [modalSantri, setModalSantri] = useState<any | null>(null)

  useEffect(() => {
    getSekolahList().then(setSekolahList)
  }, [])

  // ── Naik Kelas ─────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setLoadingPreview(true)
    setPreview(null)
    setSelectedIds(new Set())
    const res = await previewNaikKelas({ asrama: filterAsrama || undefined, sekolah: filterSekolah || undefined, kelasSekolah: filterKelas || undefined })
    if ('error' in res) { toast.error(res.error as string); setLoadingPreview(false); return }
    setPreview(res)
    // Auto-select semua yang bisa naik
    const autoSelect = new Set(res.filter(s => s.status !== 'tidak_diketahui').map(s => s.id))
    setSelectedIds(autoSelect)
    setLoadingPreview(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSelected) ids.forEach(id => n.delete(id))
      else ids.forEach(id => n.add(id))
      return n
    })
  }

  const handleEksekusi = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Naikkan kelas sekolah ${selectedIds.size} santri? Tindakan ini tidak bisa dibatalkan secara massal.`)) return
    setEksekusiLoading(true)
    const res = await eksekusiNaikKelas([...selectedIds])
    setEksekusiLoading(false)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${(res as any).updated} santri berhasil dinaikkan kelasnya!`)
    setPreview(null)
    setSelectedIds(new Set())
  }

  // Group preview by status
  const grouped = preview ? {
    naik: preview.filter(s => s.status === 'naik'),
    lulus_sltp: preview.filter(s => s.status === 'lulus_sltp'),
    lulus_slta: preview.filter(s => s.status === 'lulus_slta'),
    tidak_diketahui: preview.filter(s => s.status === 'tidak_diketahui'),
  } : null

  // ── Pembebasan ──────────────────────────────────────────────────────────
  const loadPembebasan = async () => {
    setPbLoading(true)
    setPbData([])
    setPbSelected(new Set())
    const res = await getSantriPembebasan({ asrama: pbAsrama || undefined, search: pbSearch || undefined, hanyaBebasSpp: pbHanyaBebas })
    setPbData(res)
    setPbLoading(false)
  }

  const handleToggleBebas = async (ids: string[], bebas: boolean) => {
    const res = await setBebas(ids, bebas)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${(res as any).updated} santri ${bebas ? 'dibebaskan dari' : 'dikenakan kembali'} SPP`)
    loadPembebasan()
  }

  const handleCatatBebas = async (santriId: string, jenis: string) => {
    const res = await catatBebasPembayaran(santriId, jenis, pbTahun, '')
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${jenis} tahun ${pbTahun} dicatat bebas`)
    // Update modal data
    const updated = await getSantriPembebasan({ asrama: pbAsrama || undefined, search: modalSantri?.nis })
    if (updated.length) setModalSantri(updated[0])
    loadPembebasan()
  }

  const handleHapusBebas = async (santriId: string, jenis: string) => {
    const res = await hapusBebasPembayaran(santriId, jenis, pbTahun)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`Pembebasan ${jenis} dihapus`)
    const updated = await getSantriPembebasan({ asrama: pbAsrama || undefined, search: modalSantri?.nis })
    if (updated.length) setModalSantri(updated[0])
    loadPembebasan()
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6">

      {/* HEADER */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-7 h-7 text-indigo-600"/> Manajemen Santri
        </h1>
        <p className="text-sm text-slate-500 mt-1">Operasi massal data santri — naik kelas sekolah & manajemen pembebasan.</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('naik_kelas')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === 'naik_kelas' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <ArrowUpCircle className="w-4 h-4"/> Naik Kelas Sekolah
        </button>
        <button onClick={() => setTab('pembebasan')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === 'pembebasan' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <ShieldCheck className="w-4 h-4"/> Manajemen Pembebasan
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: NAIK KELAS SEKOLAH
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'naik_kelas' && (
        <div className="space-y-5">

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
            <div className="text-sm text-amber-800">
              <p className="font-bold mb-1">Cara Kerja</p>
              <p>Sistem akan menaikkan angka di depan kelas sekolah (+1). Contoh: <code className="bg-amber-100 px-1 rounded">7A → 8A</code>, <code className="bg-amber-100 px-1 rounded">9 → 10</code>.</p>
              <p className="mt-1">Santri kelas <strong>12 dianggap lulus</strong> — kolom kelas sekolahnya akan dikosongkan. Santri kelas <strong>9 naik ke 10</strong> (lulus SLTP, masuk SLTA).</p>
              <p className="mt-1 text-amber-600 font-semibold">Pastikan filter sudah tepat sebelum eksekusi. Preview dulu sebelum menyimpan!</p>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Asrama</label>
              <select value={filterAsrama} onChange={e => setFilterAsrama(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a || '— Semua Asrama —'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Sekolah</label>
              <select value={filterSekolah} onChange={e => setFilterSekolah(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Semua Sekolah —</option>
                {sekolahList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Filter Kelas (opsional)</label>
              <input value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
                placeholder="mis: 7, 8A"
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-32"/>
            </div>
            <button onClick={handlePreview} disabled={loadingPreview}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60">
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              Preview
            </button>
          </div>

          {/* Preview hasil */}
          {preview && grouped && (
            <div className="space-y-4">

              {/* Ringkasan */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(grouped).map(([status, list]) => (
                  <div key={status} className={`rounded-xl border p-3 text-center ${STATUS_COLOR[status]}`}>
                    <p className="text-2xl font-black">{list.length}</p>
                    <p className="text-xs font-bold mt-0.5">{STATUS_LABEL[status]}</p>
                  </div>
                ))}
              </div>

              {/* Tabel per group */}
              {(['naik', 'lulus_sltp', 'lulus_slta'] as const).map(status => {
                const list = grouped[status]
                if (!list.length) return null
                const listIds = list.map(s => s.id)
                const allSel = listIds.every(id => selectedIds.has(id))
                return (
                  <div key={status} className="bg-white border rounded-xl overflow-hidden">
                    <div className={`px-4 py-3 flex items-center justify-between border-b ${STATUS_COLOR[status]}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleAll(listIds)} className="hover:opacity-70">
                          {allSel ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                        </button>
                        <span className="font-bold text-sm">{STATUS_LABEL[status]} ({list.length})</span>
                      </div>
                      <span className="text-xs font-semibold opacity-70">
                        {listIds.filter(id => selectedIds.has(id)).length} dipilih
                      </span>
                    </div>
                    <div className="divide-y max-h-64 overflow-y-auto">
                      {list.map(s => (
                        <div key={s.id} onClick={() => toggleSelect(s.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.has(s.id) ? 'bg-indigo-50' : ''}`}>
                          {selectedIds.has(s.id)
                            ? <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0"/>
                            : <Square className="w-4 h-4 text-slate-300 shrink-0"/>}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400">{s.nis} · {s.asrama} · {s.sekolah || '-'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-sm">
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{s.kelas_sekolah}</span>
                            <span className="text-slate-400">→</span>
                            <span className={`font-mono px-2 py-0.5 rounded font-bold ${
                              s.kelas_baru ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {s.kelas_baru ?? '(kosong)'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Tidak dikenali (collapsible) */}
              {grouped.tidak_diketahui.length > 0 && (
                <div className="bg-white border rounded-xl overflow-hidden">
                  <button onClick={() => setShowTidakDikenal(v => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 border-b hover:bg-slate-100 transition-colors">
                    <span className="text-sm font-bold text-slate-500">
                      Format Tidak Dikenal ({grouped.tidak_diketahui.length}) — tidak akan diproses
                    </span>
                    {showTidakDikenal ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                  </button>
                  {showTidakDikenal && (
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {grouped.tidak_diketahui.map(s => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400">{s.nis} · {s.asrama}</p>
                          </div>
                          <span className="font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs">"{s.kelas_sekolah}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Eksekusi */}
              {selectedIds.size > 0 && (
                <div className="sticky bottom-4 z-10">
                  <button onClick={handleEksekusi} disabled={eksekusiLoading}
                    className="w-full bg-indigo-700 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-indigo-800 transition-all active:scale-95 disabled:opacity-60">
                    <div>
                      <p className="text-xs text-indigo-200">Siap dinaikkan</p>
                      <p className="text-xl font-black">{selectedIds.size} Santri</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 px-5 py-2.5 rounded-lg font-black text-sm">
                      {eksekusiLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowUpCircle className="w-5 h-5"/>}
                      {eksekusiLoading ? 'Memproses...' : 'EKSEKUSI NAIK KELAS'}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: MANAJEMEN PEMBEBASAN
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'pembebasan' && (
        <div className="space-y-5">

          {/* Filter */}
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Asrama</label>
              <select value={pbAsrama} onChange={e => setPbAsrama(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a || '— Semua Asrama —'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Cari Nama / NIS</label>
              <input value={pbSearch} onChange={e => setPbSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadPembebasan()}
                placeholder="Nama atau NIS..."
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-44"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Tahun Pembayaran</label>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setPbTahun(t => t - 1)} className="px-3 py-2 hover:bg-slate-100 text-sm font-bold">-</button>
                <span className="px-3 font-mono font-bold text-sm">{pbTahun}</span>
                <button onClick={() => setPbTahun(t => t + 1)} className="px-3 py-2 hover:bg-slate-100 text-sm font-bold">+</button>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={pbHanyaBebas} onChange={e => setPbHanyaBebas(e.target.checked)} className="w-4 h-4 accent-indigo-600"/>
              <span className="text-sm font-semibold text-slate-600">Hanya yg bebas SPP</span>
            </label>
            <button onClick={loadPembebasan} disabled={pbLoading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60">
              {pbLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              Tampilkan
            </button>
          </div>

          {/* Bulk action */}
          {pbSelected.size > 0 && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <span className="text-sm font-bold text-indigo-700">{pbSelected.size} dipilih</span>
              <button onClick={() => handleToggleBebas([...pbSelected], true)}
                className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">
                <ShieldCheck className="w-3.5 h-3.5"/> Bebaskan SPP
              </button>
              <button onClick={() => handleToggleBebas([...pbSelected], false)}
                className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600">
                <X className="w-3.5 h-3.5"/> Cabut Pembebasan
              </button>
              <button onClick={() => setPbSelected(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Batal pilih</button>
            </div>
          )}

          {/* Tabel santri */}
          {pbLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>
          ) : pbData.length === 0 && !pbLoading ? (
            <div className="flex flex-col items-center py-20 gap-3 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-200"/>
              <p className="text-slate-400 font-semibold">Belum ada data</p>
              <p className="text-sm text-slate-400">Atur filter lalu tekan Tampilkan.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const allIds = pbData.map(s => s.id)
                    const allSel = allIds.every(id => pbSelected.has(id))
                    setPbSelected(allSel ? new Set() : new Set(allIds))
                  }} className="hover:opacity-70">
                    {pbData.every(s => pbSelected.has(s.id))
                      ? <CheckSquare className="w-4 h-4 text-indigo-600"/>
                      : <Square className="w-4 h-4 text-slate-400"/>}
                  </button>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{pbData.length} Santri</span>
                </div>
                <span className="text-xs text-slate-400">Klik nama untuk kelola pembayaran tahunan</span>
              </div>
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {pbData.map(s => (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${pbSelected.has(s.id) ? 'bg-indigo-50' : ''}`}>
                    <button onClick={() => setPbSelected(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })}
                      className="shrink-0 hover:opacity-70">
                      {pbSelected.has(s.id)
                        ? <CheckSquare className="w-4 h-4 text-indigo-600"/>
                        : <Square className="w-4 h-4 text-slate-300"/>}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setModalSantri(s)}>
                      <p className="text-sm font-bold text-slate-800 truncate">{s.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400">{s.nis} · {s.asrama} Kamar {s.kamar}</p>
                    </div>
                    {/* Badge bebas SPP */}
                    <button
                      onClick={() => handleToggleBebas([s.id], !s.bebas_spp)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                        s.bebas_spp
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                      }`}
                      title={s.bebas_spp ? 'Klik untuk cabut bebas SPP' : 'Klik untuk bebaskan SPP'}
                    >
                      <ShieldCheck className="w-3 h-3"/>
                      {s.bebas_spp ? 'Bebas SPP' : 'Kena SPP'}
                    </button>
                    {/* Badge pembayaran tahunan yg sudah bebas */}
                    <div className="shrink-0 flex gap-1 flex-wrap justify-end max-w-[140px]">
                      {s.sudah_bayar.map((jenis: string) => (
                        <span key={jenis} className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{jenis}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal pembayaran tahunan */}
          {modalSantri && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalSantri(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{modalSantri.nama_lengkap}</h3>
                    <p className="text-xs text-slate-500">{modalSantri.nis} · Tahun {pbTahun}</p>
                  </div>
                  <button onClick={() => setModalSantri(null)} className="p-1.5 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400"/>
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pembayaran Tahunan — Tahun {pbTahun}</p>
                  {JENIS_BIAYA_LIST.map(jenis => {
                    const sudahBebas = modalSantri.sudah_bayar.includes(jenis)
                    return (
                      <div key={jenis} className={`flex items-center justify-between p-3 rounded-xl border ${sudahBebas ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                          <Banknote className={`w-4 h-4 ${sudahBebas ? 'text-blue-500' : 'text-slate-400'}`}/>
                          <span className="text-sm font-semibold text-slate-700">{jenis}</span>
                          {sudahBebas && <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-bold">BEBAS</span>}
                        </div>
                        {sudahBebas ? (
                          <button onClick={() => handleHapusBebas(modalSantri.id, jenis)}
                            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                            <X className="w-3 h-3"/> Cabut
                          </button>
                        ) : (
                          <button onClick={() => handleCatatBebas(modalSantri.id, jenis)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3"/> Bebaskan
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="px-5 pb-5">
                  <p className="text-[10px] text-slate-400">Pembebasan dicatat sebagai transaksi Rp 0. Hanya admin yang dapat mengubah ini.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}