'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { 
  ArrowLeftRight, Search, Building2, Users, History, 
  ChevronRight, ArrowRight, Loader2, CheckCircle2,
  X, Filter, CheckSquare, Square, MoreHorizontal,
  Home, UserPlus
} from 'lucide-react'
import { 
  getSantriUntukMutasi, 
  getKamarListByAsrama, 
  getRingkasanAsrama, 
  getLogMutasi,
  mutasiSantri,
  mutasiBatch
} from './actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

type SantriMutasi = {
  id: string
  nis: string
  nama_lengkap: string
  jenis_kelamin: string
  asrama: string | null
  kamar: string | null
  kelas_sekolah: string | null
  sekolah: string | null
  marhalah_nama: string | null
  nama_kelas: string | null
}

type LogMutasi = {
  id: number
  santri_id: string
  nama_lengkap: string
  nis: string
  asrama_lama: string | null
  kamar_lama: string | null
  asrama_baru: string
  kamar_baru: string | null
  alasan: string | null
  nama_operator: string | null
  created_at: string
}

export default function MutasiAsramaClient({ 
  userRole, 
  asramaBinaan,
  userId
}: { 
  userRole: string
  asramaBinaan: string | null
  userId: string
}) {
  const confirm = useConfirm()
  
  // States
  const [tab, setTab] = useState<'mutasi' | 'riwayat'>('mutasi')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  // Data
  const [santriList, setSantriList] = useState<SantriMutasi[]>([])
  const [logs, setLogs] = useState<LogMutasi[]>([])
  const [summary, setSummary] = useState<{ perAsrama: any[], tanpaAsrama: number }>({ perAsrama: [], tanpaAsrama: 0 })
  
  // Filters
  const [filterAsrama, setFilterAsrama] = useState<string | 'ALL' | 'NONE'>('ALL')
  const [search, setSearch] = useState('')
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [targetAsrama, setTargetAsrama] = useState('')
  const [targetKamar, setTargetKamar] = useState('')
  const [kamarOptions, setKamarOptions] = useState<{ nomor_kamar: string; kuota: number; blok: string | null }[]>([])
  const [mutasiTarget, setMutasiTarget] = useState<'single' | 'batch'>('single')
  const [singleSantri, setSingleSantri] = useState<SantriMutasi | null>(null)
  const [alasan, setAlasan] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sList, sum, lData] = await Promise.all([
        getSantriUntukMutasi({ 
          asrama: filterAsrama === 'ALL' ? undefined : (filterAsrama === 'NONE' ? null : filterAsrama),
          search: search 
        }),
        getRingkasanAsrama(),
        getLogMutasi(50)
      ])
      setSantriList(sList)
      setSummary(sum)
      setLogs(lData)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterAsrama, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Fetch Kamar when Target Asrama changes
  useEffect(() => {
    if (targetAsrama) {
      getKamarListByAsrama(targetAsrama).then(setKamarOptions)
    } else {
      setKamarOptions([])
    }
    setTargetKamar('')
  }, [targetAsrama])

  const filteredSantri = useMemo(() => {
    return santriList
  }, [santriList])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedIds.length === filteredSantri.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredSantri.map(s => s.id))
    }
  }

  const handleOpenMutasi = (mode: 'single' | 'batch', s?: SantriMutasi) => {
    setMutasiTarget(mode)
    if (mode === 'single' && s) {
      setSingleSantri(s)
      setTargetAsrama(s.asrama || '')
    } else {
      setSingleSantri(null)
      setTargetAsrama('')
    }
    setAlasan('')
    setModalOpen(true)
  }

  const executeMutasi = async () => {
    if (!targetAsrama) return toast.error('Pilih asrama tujuan')
    
    setProcessing(true)
    const toastId = toast.loading('Memproses mutasi...')
    
    try {
      let res
      if (mutasiTarget === 'single' && singleSantri) {
        res = await mutasiSantri({
          santriId: singleSantri.id,
          asramaBaru: targetAsrama,
          kamarBaru: targetKamar || null,
          alasan
        })
      } else {
        res = await mutasiBatch({
          santriIds: selectedIds,
          asramaBaru: targetAsrama,
          kamarBaru: targetKamar || null,
          alasan
        })
      }

      if (res.error) throw new Error(res.error)
      
      toast.success('Berhasil memproses mutasi', { id: toastId })
      setModalOpen(false)
      setSelectedIds([])
      await loadData()
    } catch (e: any) {
      toast.error(e.message, { id: toastId })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-emerald-600"/> Mutasi Asrama
          </h1>
          <p className="text-sm text-slate-500">Pindahkan santri antar asrama atau assign santri baru ke asrama</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setTab('mutasi')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
              tab === 'mutasi' ? "bg-white shadow text-emerald-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users className="w-4 h-4"/> Mutasi Santri
          </button>
          <button 
            onClick={() => setTab('riwayat')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
              tab === 'riwayat' ? "bg-white shadow text-emerald-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <History className="w-4 h-4"/> Riwayat Mutasi
          </button>
        </div>
      </div>

      {tab === 'mutasi' && (
        <div className="space-y-4">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <button 
              onClick={() => setFilterAsrama('ALL')}
              className={cn(
                "p-3 rounded-2xl border transition-all text-left",
                filterAsrama === 'ALL' ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase">Semua</p>
              <p className="text-xl font-black text-slate-800">{(summary?.perAsrama?.reduce((a: any, b: any) => a + (b.jumlah || 0), 0) || 0) + (summary?.tanpaAsrama || 0)}</p>
            </button>
            <button 
              onClick={() => setFilterAsrama('NONE')}
              className={cn(
                "p-3 rounded-2xl border transition-all text-left",
                filterAsrama === 'NONE' ? "bg-amber-50 border-amber-200 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase">Tanpa Asrama</p>
              <p className="text-xl font-black text-amber-600">{summary?.tanpaAsrama || 0}</p>
            </button>
            {summary?.perAsrama?.map(a => (
              <button 
                key={a.asrama}
                onClick={() => setFilterAsrama(a.asrama)}
                className={cn(
                  "p-3 rounded-2xl border transition-all text-left",
                  filterAsrama === a.asrama ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{a.asrama}</p>
                <p className="text-xl font-black text-slate-800">{a.jumlah}</p>
              </button>
            ))}
          </div>

          {/* FILTERS & ACTIONS */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input 
                type="text" 
                placeholder="Cari nama atau NIS..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 border-slate-200 transition-all text-sm"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {selectedIds.length > 0 && (
                <button 
                  onClick={() => handleOpenMutasi('batch')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                  <ArrowRight className="w-4 h-4"/> Pindah Terpilih ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={selectAll} className="text-slate-400 hover:text-emerald-500 transition-colors">
                        {selectedIds.length === filteredSantri.length && filteredSantri.length > 0 ? <CheckSquare className="w-5 h-5 text-emerald-500"/> : <Square className="w-5 h-5"/>}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">Santri</th>
                    <th className="px-4 py-3 text-left">Asrama & Kamar Saat Ini</th>
                    <th className="px-4 py-3 text-left">Kelas / Marhalah</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-2"/>
                        <p className="text-slate-400 font-medium">Memuat data santri...</p>
                      </td>
                    </tr>
                  ) : filteredSantri.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                        <p>Tidak ada santri ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSantri.map(s => (
                      <tr 
                        key={s.id} 
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors group",
                          selectedIds.includes(s.id) ? "bg-emerald-50/30" : ""
                        )}
                      >
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => toggleSelect(s.id)}
                            className={cn(
                              "transition-colors",
                              selectedIds.includes(s.id) ? "text-emerald-500" : "text-slate-300 group-hover:text-slate-400"
                            )}
                          >
                            {selectedIds.includes(s.id) ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-bold text-slate-800">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{s.nis}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {s.asrama ? (
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">{s.asrama}</span>
                              <span className="text-slate-400">/</span>
                              <span className="font-bold text-slate-600">{s.kamar || '—'}</span>
                            </div>
                          ) : (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1 w-fit">
                              <UserPlus className="w-3 h-3"/> Tanpa Asrama
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-600">{s.nama_kelas || s.kelas_sekolah || '—'}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{s.marhalah_nama || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleOpenMutasi('single', s)}
                            className="bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            Pindahkan
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Santri</th>
                  <th className="px-4 py-3 text-left">Dari</th>
                  <th className="px-4 py-3 text-left">Ke</th>
                  <th className="px-4 py-3 text-left">Operator</th>
                  <th className="px-4 py-3 text-left">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-400">Memuat riwayat...</td></tr>
                ) : !logs || logs.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">Belum ada riwayat mutasi</td></tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">{log.nama_lengkap}</td>
                      <td className="px-4 py-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{log.asrama_lama || '—'}</div>
                        <div className="text-xs font-medium text-slate-600">{log.kamar_lama || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">{log.asrama_baru}</div>
                        <div className="text-xs font-medium text-emerald-700">{log.kamar_baru || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">{log.nama_operator || 'Sistem'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 italic">{log.alasan || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL MUTASI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <ArrowLeftRight className="w-6 h-6"/> Mutasi Asrama
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-emerald-100 hover:text-white transition-colors">
                  <X className="w-6 h-6"/>
                </button>
              </div>
              <p className="text-emerald-100 text-sm font-medium">
                {mutasiTarget === 'single' ? `Pindahkan ${singleSantri?.nama_lengkap}` : `Pindahkan ${selectedIds.length} santri terpilih`}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Asrama Tujuan</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASRAMA_LIST.map(a => (
                    <button 
                      key={a}
                      onClick={() => setTargetAsrama(a)}
                      className={cn(
                        "px-3 py-2.5 rounded-xl border text-sm font-bold transition-all text-center",
                        targetAsrama === a ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kamar Tujuan (Opsional)</label>
                <select 
                  value={targetKamar}
                  onChange={(e) => setTargetKamar(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
                  disabled={!targetAsrama}
                >
                  <option value="">— Pilih Kamar —</option>
                  {kamarOptions.map(k => (
                    <option key={k.nomor_kamar} value={k.nomor_kamar}>
                      Kamar {k.nomor_kamar} {k.blok ? `(Blok ${k.blok})` : ''} — {k.kuota} org
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 italic">* Kosongkan jika kamar akan diatur nanti di Perpindahan Kamar</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alasan (Opsional)</label>
                <textarea 
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Misal: Pindah asrama karena permintaan wali..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={executeMutasi}
                  disabled={!targetAsrama || processing}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>}
                  Konfirmasi Mutasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
