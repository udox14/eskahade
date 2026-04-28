'use client'

import { useCallback, useState, useEffect } from 'react'
import {
  getActiveEventLight, getJadwalAktifList, getRuanganForJadwal, getPesertaForAbsensi, saveAbsensiBatch
} from './actions'
import { 
  Calendar, MapPin, Users, Loader2, ChevronLeft, ChevronRight, 
  CheckCircle2, AlertTriangle, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { fullDateWib, shortDateWib } from '../_date-utils'

type SesiAktif = {
  tanggal: string
  sesi_id: number
  label: string
  jam_group: string
  waktu_mulai: string | null
  waktu_selesai: string | null
}

type RuanganAbsensi = {
  id: number
  nomor_ruangan: number
  nama_ruangan: string | null
  jenis_kelamin: string
  jumlah_peserta: number
  kelas_list: string
}

type PesertaAbsensi = {
  nomor_kursi: number
  santri_id: string
  nama_lengkap: string
  nis: string | null
  nama_kelas: string
  marhalah_nama: string
  status_absen: string | null
}

export default function AbsensiEhbPage() {
  const [event, setEvent] = useState<{ id: number, nama: string } | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [view, setView] = useState<'list-sesi' | 'list-ruangan' | 'input-absensi'>('list-sesi')
  
  // Data States
  const [sesiList, setSesiList] = useState<SesiAktif[]>([])
  const [ruanganList, setRuanganList] = useState<RuanganAbsensi[]>([])
  const [pesertaList, setPesertaList] = useState<PesertaAbsensi[]>([])
  const [pesertaSearch, setPesertaSearch] = useState('')
  
  // Selections
  const [selectedSesi, setSelectedSesi] = useState<SesiAktif | null>(null)
  const [selectedRuangan, setSelectedRuangan] = useState<RuanganAbsensi | null>(null)
  
  // Input State
  const [absensiMap, setAbsensiMap] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState(false)

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    if (evt) {
      const list = await getJadwalAktifList(evt.id)
      setSesiList(list)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitialData()
  }, [loadInitialData])

  const handleSelectSesi = async (sesi: SesiAktif) => {
    if (!event) return
    setSelectedSesi(sesi)
    setLoading(true)
    setView('list-ruangan')
    const rList = await getRuanganForJadwal(event.id, sesi.tanggal, sesi.sesi_id, sesi.jam_group)
    setRuanganList(rList)
    setLoading(false)
  }

  const handleSelectRuangan = async (ruangan: RuanganAbsensi) => {
    if (!event || !selectedSesi) return
    setSelectedRuangan(ruangan)
    setPesertaSearch('')
    setLoading(true)
    setView('input-absensi')
    const pList = await getPesertaForAbsensi(event.id, ruangan.id, selectedSesi.tanggal, selectedSesi.sesi_id, selectedSesi.jam_group)
    setPesertaList(pList)
    
    // Set initial absensi map
    const initialMap: Record<string, string | null> = {}
    pList.forEach((p: PesertaAbsensi) => {
        initialMap[p.santri_id] = p.status_absen || null // null = Hadir
    })
    setAbsensiMap(initialMap)
    
    setLoading(false)
  }

  const handleSetAbsen = (santriId: string, status: string | null) => {
    setAbsensiMap(prev => ({ ...prev, [santriId]: status }))
  }

  const filteredPesertaList = pesertaList.filter(p => {
    const needle = pesertaSearch.trim().toLowerCase()
    if (!needle) return true
    const status = absensiMap[p.santri_id]
    const statusLabel = status === 'A' ? 'alpha tidak hadir'
      : status === 'I' ? 'izin tidak hadir'
      : status === 'S' ? 'sakit tidak hadir'
      : 'hadir'
    return [
      p.nama_lengkap,
      p.nis,
      p.nama_kelas,
      String(p.nomor_kursi || ''),
      statusLabel,
    ].some(value => String(value || '').toLowerCase().includes(needle))
  })

  const handleSaveAbsensi = async () => {
    if (!event || !selectedSesi || !selectedRuangan) return
    setSaving(true)
    
    const updates = Object.keys(absensiMap).map(santri_id => ({
        santri_id,
        status: absensiMap[santri_id]
    }))

    const res = await saveAbsensiBatch(event.id, selectedSesi.tanggal, selectedSesi.sesi_id, updates)
    setSaving(false)

    if (res.error) {
        toast.error(res.error)
    } else {
        toast.success('Absensi berhasil disimpan')
        setView('list-ruangan') // Back to ruangan list after save
    }
  }

  // Helper for grouping Sesi by Tanggal
  const groupedSesi: Record<string, SesiAktif[]> = {}
  sesiList.forEach(s => {
      if (!groupedSesi[s.tanggal]) groupedSesi[s.tanggal] = []
      groupedSesi[s.tanggal].push(s)
  })

  if (loading && view === 'list-sesi') return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  if (!event) return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" /> 
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 border-x">
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: LIST SESI */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {view === 'list-sesi' && (
        <div className="flex flex-col h-full">
            <div className="bg-indigo-600 px-5 pt-10 pb-6 shadow-md rounded-b-3xl">
                <h1 className="text-2xl font-bold text-white mb-1">Absensi EHB</h1>
                <p className="text-indigo-100 text-sm">Pilih jadwal ujian yang sedang berlangsung.</p>
            </div>
            
            <div className="p-4 flex-1 space-y-6">
                {Object.keys(groupedSesi).length === 0 ? (
                    <div className="text-center py-20">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-slate-500">Belum ada jadwal aktif</p>
                    </div>
                ) : (
                    Object.keys(groupedSesi).map(tgl => (
                        <div key={tgl} className="space-y-3">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 px-1">
                                <Calendar className="w-4 h-4 text-indigo-500"/>
                                {fullDateWib(tgl)}
                            </h3>
                            {groupedSesi[tgl].map(s => (
                                <div 
                                    key={s.sesi_id}
                                    onClick={() => handleSelectSesi(s)}
                                    className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between group active:scale-95"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg mb-0.5">{s.label}</p>
                                        <div className="flex items-center gap-2 text-xs font-medium">
                                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{s.jam_group}</span>
                                            <span className="text-slate-500">{s.waktu_mulai} - {s.waktu_selesai}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: LIST RUANGAN */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {view === 'list-ruangan' && (
        <div className="flex flex-col h-full pb-10">
            <div className="bg-white px-4 py-4 border-b sticky -top-4 md:-top-8 z-10 flex items-center gap-3 shadow-sm">
                <button 
                    onClick={() => setView('list-sesi')}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
                >
                    <ChevronLeft className="w-6 h-6 text-slate-700" />
                </button>
                <div>
                    <h2 className="font-bold text-slate-800 text-lg leading-tight">Daftar Ruangan</h2>
                    <p className="text-xs text-indigo-600 font-bold">{selectedSesi?.label} • {selectedSesi ? shortDateWib(selectedSesi.tanggal, false) : ''}</p>
                </div>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                ) : ruanganList.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                        <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-500 text-sm">Tidak ada ruangan</p>
                        <p className="text-xs text-slate-400">Tidak ada santri yang ujian di sesi ini.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ruanganList.map(r => (
                            <div 
                                key={r.id}
                                onClick={() => handleSelectRuangan(r)}
                                className="bg-white border p-4 rounded-2xl shadow-sm hover:border-indigo-300 cursor-pointer flex justify-between items-center active:scale-95 transition-all"
                            >
                                <div className="flex gap-3 items-center">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0 ${r.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                        {r.nomor_ruangan}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{r.nama_ruangan || `Ruangan ${r.nomor_ruangan}`}</p>
                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                                            <Users className="w-3.5 h-3.5" />
                                            <span className="font-bold">{r.jumlah_peserta}</span> peserta
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {/* VIEW 3: INPUT ABSENSI */}
      {/* ────────────────────────────────────────────────────────────────────────────── */}
      {view === 'input-absensi' && (
        <div className="flex flex-col h-full pb-28">
            <div className="bg-white px-4 py-4 border-b sticky -top-4 md:-top-8 z-10 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setView('list-ruangan')}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
                    >
                        <ChevronLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg leading-tight">{selectedRuangan?.nama_ruangan || `Ruang ${selectedRuangan?.nomor_ruangan}`}</h2>
                        <p className="text-xs text-slate-500">{selectedSesi?.label} • {selectedSesi ? shortDateWib(selectedSesi.tanggal, false) : ''}</p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={pesertaSearch}
                        onChange={e => setPesertaSearch(e.target.value)}
                        placeholder="Cari nama, kelas, kursi, atau status tidak hadir"
                        className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                </div>
            </div>

            <div className="p-3">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                ) : (
                    <div className="space-y-2">
                        {filteredPesertaList.length === 0 ? (
                            <div className="bg-white border border-dashed rounded-2xl p-10 text-center text-slate-400">
                                <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p className="font-bold text-slate-500 text-sm">Tidak ada hasil</p>
                                <p className="text-xs">Coba kata kunci lain.</p>
                            </div>
                        ) : filteredPesertaList.map(p => {
                            const val = absensiMap[p.santri_id]
                            const isAlpha = val === 'A'
                            const isIzin = val === 'I'
                            const isSakit = val === 'S'
                            const isHadir = val === null

                            return (
                                <div key={p.santri_id} className={`bg-white border rounded-2xl p-3 shadow-sm transition-colors ${!isHadir ? 'border-red-200 bg-red-50/30' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                                {p.nomor_kursi}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 leading-tight">{p.nama_lengkap}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{p.nis} • {p.nama_kelas}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-4 gap-2 h-10">
                                        <button 
                                            onClick={() => handleSetAbsen(p.santri_id, null)}
                                            className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isHadir ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Hadir
                                        </button>
                                        <button 
                                            onClick={() => handleSetAbsen(p.santri_id, 'S')}
                                            className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSakit ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Sakit
                                        </button>
                                        <button 
                                            onClick={() => handleSetAbsen(p.santri_id, 'I')}
                                            className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isIzin ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Izin
                                        </button>
                                        <button 
                                            onClick={() => handleSetAbsen(p.santri_id, 'A')}
                                            className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isAlpha ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Alpha
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Float Action Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t max-w-md mx-auto flex gap-3 z-20">
                <button 
                    onClick={handleSaveAbsensi}
                    disabled={saving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>}
                    Simpan Absensi
                </button>
            </div>
        </div>
      )}
    </div>
  )
}
