'use client'

import { useState, useEffect } from 'react'
import {
  getActiveEhbEvent, getAllEhbEvents, createEhbEvent, setActiveEvent, deleteEhbEvent,
  getSesiList, saveSesiConfig,
  getKelasJamMapping, getKelasAktifList, saveKelasJamMapping,
  getJadwalEhb, getTanggalJadwal, getMapelAktifList, saveJadwalEhb,
  getTahunAjaranList, hapusJadwalCell, hapusTanggal, updateTanggalJadwal, copyJadwalFromEvent, SesiInput, JadwalItem
} from './actions'
import {
  CalendarDays, Settings, Users, BookOpen, Plus, Save, Trash2, 
  AlertTriangle, Loader2, CheckCircle2, ChevronDown, ChevronRight, X
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

export default function JadwalEhbPage() {
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState<'event'|'sesi'|'mapping'|'jadwal'>('event')
  
  // Event Data
  const [activeEvent, setActiveEventData] = useState<any>(null)
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form New Event
  const [newEvent, setNewEvent] = useState({ tahunAjaranId: 0, semester: 2, nama: '', tanggal_mulai: '', tanggal_selesai: '' })

  // Sesi Data
  const [sesiList, setSesiList] = useState<SesiInput[]>([])
  const [loadingSesi, setLoadingSesi] = useState(false)

  // Mapping Data
  const [kelasAktif, setKelasAktif] = useState<any[]>([])
  const [kelasJamMapping, setKelasJamMapping] = useState<Record<string, string>>({}) // kelas_id -> jam_group
  const [loadingMapping, setLoadingMapping] = useState(false)

  // Jadwal Data
  const [jadwal, setJadwal] = useState<any[]>([])
  const [mapelAktif, setMapelAktif] = useState<any[]>([])
  const [tanggalList, setTanggalList] = useState<string[]>([])
  const [newTglStart, setNewTglStart] = useState('')
  const [newTglEnd, setNewTglEnd] = useState('')
  const [loadingJadwal, setLoadingJadwal] = useState(false)

  // Bulk Set Mapel per Marhalah
  const [bulkModal, setBulkModal] = useState<{
    tgl: string, sesiId: number, marhalahNama: string, kelasIds: string[]
  } | null>(null)
  const [bulkMapelId, setBulkMapelId] = useState<number | ''>()

  // Set per Sesi (semua marhalah sekaligus)
  const [sesiModal, setSesiModal] = useState<{
    tgl: string, sesiId: number, sesiLabel: string, allKelasIds: string[]
  } | null>(null)
  const [sesiMapelId, setSesiMapelId] = useState<number | ''>()

  // Fitur Accordion Jadwal
  const [expandedDates, setExpandedDates] = useState<string[]>([])

  // Fitur Copy Event
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState<number | ''>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    const [evt, evts, tas] = await Promise.all([
      getActiveEhbEvent(),
      getAllEhbEvents(),
      getTahunAjaranList()
    ])
    setActiveEventData(evt)
    setAllEvents(evts)
    setTahunAjaranList(tas)
    if (evt) {
      loadSesi(evt.id)
    }
    setLoading(false)
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB EVENT
  // ──────────────────────────────────────────────────────────────────────────────
  
  const handleCreateEvent = async () => {
    if (!newEvent.tahunAjaranId || !newEvent.nama || !newEvent.tanggal_mulai || !newEvent.tanggal_selesai) return toast.error('Lengkapi semua data event')
    const start = new Date(newEvent.tanggal_mulai)
    const end = new Date(newEvent.tanggal_selesai)
    if (start > end) return toast.error('Tanggal mulai harus sebelum tanggal selesai')

    const res = await createEhbEvent(newEvent)
    if ('error' in res) return toast.error(res.error)
    toast.success('Event EHB berhasil dibuat dan diaktifkan')
    setNewEvent({ tahunAjaranId: 0, semester: 2, nama: '', tanggal_mulai: '', tanggal_selesai: '' })
    loadInitialData()
  }

  const handleSetActiveEvent = async (id: number) => {
    const res = await setActiveEvent(id)
    if ('error' in res) return toast.error(res.error)
    toast.success('Event EHB aktif diubah')
    loadInitialData()
  }

  const handleDeleteEvent = async (id: number) => {
    if (!await confirm('Hapus event EHB ini beserta SEMUA data jadwal, ruangan, dan pengawasnya?')) return
    const res = await deleteEhbEvent(id)
    if ('error' in res) return toast.error(res.error)
    toast.success('Event EHB dihapus')
    loadInitialData()
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB SESI
  // ──────────────────────────────────────────────────────────────────────────────

  const loadSesi = async (eventId: number) => {
    setLoadingSesi(true)
    const res = await getSesiList(eventId)
    if (res && res.length > 0) {
      setSesiList(res)
    } else {
      // Default 4 sesi
      setSesiList([
        { nomor_sesi: 1, label: 'Sesi 1', jam_group: 'Jam ke-1', waktu_mulai: '', waktu_selesai: '' },
        { nomor_sesi: 2, label: 'Sesi 2', jam_group: 'Jam ke-2', waktu_mulai: '', waktu_selesai: '' },
        { nomor_sesi: 3, label: 'Sesi 3', jam_group: 'Jam ke-1', waktu_mulai: '', waktu_selesai: '' },
        { nomor_sesi: 4, label: 'Sesi 4', jam_group: 'Jam ke-2', waktu_mulai: '', waktu_selesai: '' },
      ])
    }
    setLoadingSesi(false)
  }

  const handleSesiChange = (index: number, field: keyof SesiInput, value: string) => {
    const newList = [...sesiList]
    newList[index] = { ...newList[index], [field]: value }
    setSesiList(newList)
  }

  const addSesi = () => {
    setSesiList([...sesiList, { nomor_sesi: sesiList.length + 1, label: '', jam_group: '', waktu_mulai: '', waktu_selesai: '' }])
  }

  const removeSesi = (index: number) => {
    const newList = sesiList.filter((_, i) => i !== index)
    // Re-number
    newList.forEach((s, i) => s.nomor_sesi = i + 1)
    setSesiList(newList)
  }

  const handleSaveSesi = async () => {
    if (!activeEvent) return
    const res = await saveSesiConfig(activeEvent.id, sesiList)
    if ('error' in res) return toast.error(res.error)
    toast.success('Konfigurasi sesi berhasil disimpan')
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB MAPPING KELAS -> JAM
  // ──────────────────────────────────────────────────────────────────────────────

  const loadMapping = async () => {
    if (!activeEvent) return
    setLoadingMapping(true)
    const [kelasRes, mappingRes] = await Promise.all([
      getKelasAktifList(),
      getKelasJamMapping(activeEvent.id)
    ])
    setKelasAktif(kelasRes)
    
    const map: Record<string, string> = {}
    mappingRes.forEach((m: any) => map[m.kelas_id] = m.jam_group)
    setKelasJamMapping(map)
    setLoadingMapping(false)
  }

  const handleMappingChange = (kelasId: string, jamGroup: string) => {
    setKelasJamMapping(prev => ({ ...prev, [kelasId]: jamGroup }))
  }

  const handleSaveMapping = async () => {
    if (!activeEvent) return
    const mappings = Object.entries(kelasJamMapping).map(([k, j]) => ({ kelas_id: k, jam_group: j }))
    const res = await saveKelasJamMapping(activeEvent.id, mappings)
    if ('error' in res) return toast.error(res.error)
    toast.success('Mapping kelas berhasil disimpan')
  }

  // Unique jam groups dari sesi
  const jamGroups = Array.from(new Set(
    sesiList.flatMap(s => (s.jam_group || '').split(',').map(x => x.trim()).filter(Boolean))
  ))

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB JADWAL
  // ──────────────────────────────────────────────────────────────────────────────

  const loadJadwal = async () => {
    if (!activeEvent) return
    setLoadingJadwal(true)
    const [jdw, mapel, kelasRes, mappingRes] = await Promise.all([
      getJadwalEhb(activeEvent.id),
      getMapelAktifList(),
      getKelasAktifList(),
      getKelasJamMapping(activeEvent.id)
    ])
    setJadwal(jdw)
    setMapelAktif(mapel)
    
    // Generate tanggalList dari event
    const start = activeEvent.tanggal_mulai ? new Date(activeEvent.tanggal_mulai) : null
    const end = activeEvent.tanggal_selesai ? new Date(activeEvent.tanggal_selesai) : null
    const newDates: string[] = []
    if (start && end && start <= end) {
      const curr = new Date(start)
      while (curr <= end) {
        newDates.push(curr.toISOString().split('T')[0])
        curr.setDate(curr.getDate() + 1)
      }
    }
    setTanggalList(newDates)
    setExpandedDates(prev => prev.length > 0 ? prev : [])

    // Selalu sinkronkan kelas & mapping
    setKelasAktif(kelasRes)
    const map: Record<string, string> = {}
    mappingRes.forEach((m: any) => map[m.kelas_id] = m.jam_group)
    setKelasJamMapping(map)
    setLoadingJadwal(false)
  }

  // Get current jadwal mapping: tanggal -> sesi_id -> kelas_id -> mapel_id
  const jadwalMap: Record<string, Record<number, Record<string, number>>> = {}
  jadwal.forEach(j => {
    if (!jadwalMap[j.tanggal]) jadwalMap[j.tanggal] = {}
    if (!jadwalMap[j.tanggal][j.sesi_id]) jadwalMap[j.tanggal][j.sesi_id] = {}
    jadwalMap[j.tanggal][j.sesi_id][j.kelas_id] = j.mapel_id
  })

  // Helper: dapatkan mapel_id yang sudah terpakai oleh kelas-kelas dalam marhalah
  // lintas SEMUA tanggal dan semua sesi, KECUALI mapel milik kelas itu sendiri (excludeKelasId)
  const getUsedMapelIds = (kelasIdsInMarhalah: string[], excludeKelasId?: string): Set<number> => {
    const used = new Set<number>()
    for (const tglKey of Object.keys(jadwalMap)) {
      for (const sid of Object.keys(jadwalMap[tglKey]).map(Number)) {
        for (const kId of kelasIdsInMarhalah) {
          if (kId === excludeKelasId) continue // kelas sendiri boleh ganti
          const mid = jadwalMap[tglKey]?.[sid]?.[kId]
          if (mid) used.add(mid)
        }
      }
    }
    return used
  }

  const handleJadwalChange = async (tgl: string, sesiId: number, kelasId: string, mapelId: number | '') => {
    if (!activeEvent) return
    const item = { tanggal: tgl, sesi_id: sesiId, kelas_id: kelasId, mapel_id: mapelId as number }
    
    const res = await (mapelId === '' 
      ? hapusJadwalCell(activeEvent.id, tgl, sesiId, kelasId)
      : saveJadwalEhb(activeEvent.id, [item]))
      
    if ('error' in res) return toast.error(res.error)
    toast.success('Jadwal disimpan')
    loadJadwal()
  }

  // Bulk set mapel untuk semua kelas dalam satu marhalah sekaligus
  const handleBulkSetMarhalah = async () => {
    if (!activeEvent || !bulkModal || bulkMapelId === '') return toast.error('Pilih mata pelajaran terlebih dahulu')
    const items = bulkModal.kelasIds.map(kId => ({
      tanggal: bulkModal.tgl,
      sesi_id: bulkModal.sesiId,
      kelas_id: kId,
      mapel_id: bulkMapelId as number
    }))
    const res = await saveJadwalEhb(activeEvent.id, items)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Jadwal ${bulkModal.marhalahNama} (${items.length} kelas) berhasil diset!`)
    setBulkModal(null)
    setBulkMapelId('')
    loadJadwal()
  }

  // Inline: set mapel untuk seluruh kelas dalam marhalah (non-Mutawassithah) tanpa modal
  const handleMarhalahChange = async (tgl: string, sesiId: number, kelasIds: string[], mapelId: number | '') => {
    if (!activeEvent) return
    if (mapelId === '') {
      // Hapus semua kelas marhalah ini untuk sesi+tgl ini
      for (const kId of kelasIds) {
        await hapusJadwalCell(activeEvent.id, tgl, sesiId, kId)
      }
    } else {
      const items = kelasIds.map(kId => ({ tanggal: tgl, sesi_id: sesiId, kelas_id: kId, mapel_id: mapelId as number }))
      const res = await saveJadwalEhb(activeEvent.id, items)
      if ('error' in res) return toast.error(res.error)
    }
    loadJadwal()
  }

  // Set mapel untuk SEMUA kelas di satu sesi sekaligus
  const handleApplyBulkSesiMapel = async () => {
    if (!activeEvent || !sesiModal || sesiMapelId === '') return toast.error('Pilih mata pelajaran terlebih dahulu')
    const items = sesiModal.allKelasIds.map(kId => ({
      tanggal: sesiModal.tgl,
      sesi_id: sesiModal.sesiId,
      kelas_id: kId,
      mapel_id: sesiMapelId as number
    }))
    const res = await saveJadwalEhb(activeEvent.id, items)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Sesi ${sesiModal.sesiLabel}: ${items.length} kelas berhasil diset!`)
    setSesiModal(null)
    setSesiMapelId('')
    loadJadwal()
  }

  const handleCopyEvent = async () => {
    if (!activeEvent || copySourceId === '') return toast.error('Pilih event sumber terlebih dahulu')
    if (!await confirm('Peringatan: Menyalin jadwal akan menghapus semua konfigurasi sesi, mapping kelas, dan jadwal yang ada di event ini. Lanjutkan?')) return
    
    setLoadingJadwal(true)
    const res = await copyJadwalFromEvent(activeEvent.id, copySourceId as number)
    if ('error' in res) {
      toast.error(res.error)
      setLoadingJadwal(false)
      return
    }
    
    toast.success('Jadwal berhasil disalin dari event lain')
    setCopyModalOpen(false)
    setCopySourceId('')
    loadJadwal() // Ini akan me-load semuanya karena logic loadJadwal sudah ambil sesi & mapping juga
  }

  // Helper render
  const renderTabBtn = (id: typeof activeTab, icon: React.ReactNode, label: string, disabled = false) => (
    <button 
      disabled={disabled}
      onClick={() => {
        setActiveTab(id)
        if (id === 'sesi' && activeEvent) loadSesi(activeEvent.id)
        if (id === 'mapping' && activeEvent) loadMapping()
        if (id === 'jadwal' && activeEvent) loadJadwal()
      }}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border'
      }`}
    >
      {icon} {label}
    </button>
  )

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-indigo-600"/> Pengaturan Jadwal EHB
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola event EHB, sesi, dan jadwal pelajaran yang diujikan.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {renderTabBtn('event', <BookOpen className="w-4 h-4"/>, '1. Event EHB')}
        {renderTabBtn('sesi', <Settings className="w-4 h-4"/>, '2. Sesi & Waktu', !activeEvent)}
        {renderTabBtn('mapping', <Users className="w-4 h-4"/>, '3. Mapping Kelas', !activeEvent)}
        {renderTabBtn('jadwal', <CalendarDays className="w-4 h-4"/>, '4. Jadwal Mapel', !activeEvent)}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* TAB: EVENT */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'event' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
            <h3 className="font-bold text-indigo-900 mb-4">Event EHB Aktif</h3>
            {activeEvent ? (
              <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600"/>
                </div>
                <div>
                  <p className="font-bold text-lg text-slate-800">{activeEvent.nama}</p>
                  <p className="text-sm text-slate-500">Tahun Ajaran: {activeEvent.tahun_ajaran_nama} • Semester: {activeEvent.semester === 1 ? 'Ganjil' : 'Genap'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5"/> Belum ada event EHB yang aktif. Silakan buat atau pilih dari daftar.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Buat Event Baru</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">Tahun Ajaran</label>
                  <select 
                    value={newEvent.tahunAjaranId} 
                    onChange={e => setNewEvent({...newEvent, tahunAjaranId: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value={0}>-- Pilih --</option>
                    {tahunAjaranList.map(ta => <option key={ta.id} value={ta.id}>{ta.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Semester</label>
                  <select 
                    value={newEvent.semester} 
                    onChange={e => setNewEvent({...newEvent, semester: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value={1}>Ganjil</option>
                    <option value={2}>Genap</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Nama Event</label>
                  <input 
                    value={newEvent.nama} 
                    onChange={e => setNewEvent({...newEvent, nama: e.target.value})}
                    placeholder="misal: EHB Semester Genap 2025/2026"
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Tanggal Mulai</label>
                  <input 
                    type="date"
                    value={newEvent.tanggal_mulai} 
                    onChange={e => setNewEvent({...newEvent, tanggal_mulai: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Tanggal Selesai</label>
                  <input 
                    type="date"
                    value={newEvent.tanggal_selesai} 
                    onChange={e => setNewEvent({...newEvent, tanggal_selesai: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <button 
                  onClick={handleCreateEvent}
                  className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700"
                >
                  Buat & Aktifkan
                </button>
              </div>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden flex flex-col max-h-[400px]">
              <h3 className="font-bold text-slate-800 p-5 border-b shrink-0">Daftar Event</h3>
              <div className="overflow-y-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500">Event</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 w-24">Status</th>
                      <th className="px-4 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allEvents.map(evt => (
                      <tr key={evt.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{evt.nama}</p>
                          <p className="text-xs text-slate-500">{evt.tahun_ajaran_nama}</p>
                          {evt.tanggal_mulai && evt.tanggal_selesai && (
                            <p className="text-[10px] text-indigo-600 mt-1">
                              {new Date(evt.tanggal_mulai).toLocaleDateString('id-ID', {day:'numeric', month:'short'})} - {new Date(evt.tanggal_selesai).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {evt.is_active === 1 ? (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Aktif</span>
                          ) : (
                            <button 
                              onClick={() => handleSetActiveEvent(evt.id)}
                              className="bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-1 rounded text-xs font-bold border"
                            >
                              Aktifkan
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* TAB: SESI */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sesi' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Pengaturan Sesi</h3>
                <p className="text-xs text-slate-500 mt-1">Atur label dan jam group (pengelompokan ruangan) untuk setiap sesi.</p>
              </div>
              <button 
                onClick={handleSaveSesi}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
              >
                <Save className="w-4 h-4"/> Simpan Sesi
              </button>
            </div>
            
            <div className="p-5">
              {loadingSesi ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto"/> : (
                <div className="space-y-3">
                  {sesiList.map((sesi, idx) => (
                    <div key={idx} className="flex flex-wrap gap-3 items-end p-3 border rounded-lg bg-slate-50/50">
                      <div className="w-16">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Sesi</label>
                        <div className="bg-slate-200 font-bold text-slate-700 rounded px-3 py-2 text-sm text-center">
                          {sesi.nomor_sesi}
                        </div>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Label (Tampil di jadwal/absen)</label>
                        <input 
                          value={sesi.label}
                          onChange={e => handleSesiChange(idx, 'label', e.target.value)}
                          placeholder="mis: Shubuh, Pagi"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Jam Group (Pengelompokan)</label>
                        <input 
                          value={sesi.jam_group}
                          onChange={e => handleSesiChange(idx, 'jam_group', e.target.value)}
                          placeholder="mis: Jam ke-1 atau Jam ke-1, Jam ke-2"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Mulai</label>
                        <input 
                          type="time"
                          value={sesi.waktu_mulai}
                          onChange={e => handleSesiChange(idx, 'waktu_mulai', e.target.value)}
                          className="w-full border rounded px-2 py-2 text-sm"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Selesai</label>
                        <input 
                          type="time"
                          value={sesi.waktu_selesai}
                          onChange={e => handleSesiChange(idx, 'waktu_selesai', e.target.value)}
                          className="w-full border rounded px-2 py-2 text-sm"
                        />
                      </div>
                      <button 
                        onClick={() => removeSesi(idx)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={addSesi}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 p-2"
                  >
                    <Plus className="w-4 h-4"/> Tambah Sesi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* TAB: MAPPING KELAS */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'mapping' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
             <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Mapping Kelas → Jam Group</h3>
                <p className="text-xs text-slate-500 mt-1">Tentukan setiap kelas masuk ke jam group yang mana.</p>
              </div>
              <button 
                onClick={handleSaveMapping}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
              >
                <Save className="w-4 h-4"/> Simpan Mapping
              </button>
            </div>

            <div className="p-5">
              {jamGroups.length === 0 ? (
                <div className="text-amber-600 bg-amber-50 p-4 rounded-lg text-sm">
                  Belum ada Jam Group yang didefinisikan. Silakan atur di tab <b>Sesi & Waktu</b> terlebih dahulu.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl overflow-x-auto">
                    {jamGroups.map(jg => {
                      let count = 0
                      kelasAktif.forEach(k => {
                        if (kelasJamMapping[k.id] === jg) {
                          count += (k.jml_santri || 0)
                        }
                      })
                      return (
                        <div key={jg as string} className="bg-white px-4 py-2 rounded-lg border border-indigo-200 shadow-sm shrink-0">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{jg as string}</p>
                          <p className="text-xl font-black text-indigo-700">{count} <span className="text-sm font-bold text-slate-400">santri</span></p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from(new Set(kelasAktif.map(k => k.marhalah_nama))).map(marhalahNama => {
                    const kelasInMarhalah = kelasAktif.filter(k => k.marhalah_nama === marhalahNama)
                    return (
                      <div key={marhalahNama as string} className="border rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 font-bold text-sm text-slate-700 border-b flex justify-between items-center">
                          <span>{marhalahNama as string}</span>
                          <select 
                            onChange={e => {
                                const jg = e.target.value;
                                if (!jg) return;
                                const updates = {...kelasJamMapping};
                                kelasInMarhalah.forEach(k => updates[k.id] = jg);
                                setKelasJamMapping(updates);
                                e.target.value = '';
                            }}
                            className="text-xs border rounded outline-none font-normal px-1 py-0.5 bg-white"
                          >
                            <option value="">-- Set Semua --</option>
                            {jamGroups.map(jg => <option key={jg as string} value={jg as string}>{jg as string}</option>)}
                          </select>
                        </div>
                        <div className="divide-y max-h-[300px] overflow-y-auto">
                          {kelasInMarhalah.map(k => (
                            <div key={k.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                              <div>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                  {k.nama_kelas}
                                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{k.jml_santri || 0} santri</span>
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{k.jenis_kelamin === 'L' ? 'Laki-laki' : k.jenis_kelamin === 'P' ? 'Perempuan' : 'Campur'}</p>
                              </div>
                              <select 
                                value={kelasJamMapping[k.id] || ''}
                                onChange={e => handleMappingChange(k.id, e.target.value)}
                                className={`text-sm border rounded px-2 py-1 outline-none ${!kelasJamMapping[k.id] ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200'}`}
                              >
                                <option value="">- Pilih Jam -</option>
                                {jamGroups.map(jg => <option key={jg as string} value={jg as string}>{jg as string}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* TAB: JADWAL */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'jadwal' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
             <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Jadwal Mapel EHB</h3>
                <p className="text-xs text-slate-500 mt-1">Isi mata pelajaran yang diujikan untuk setiap kelas pada setiap sesi.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCopyModalOpen(true)}
                  className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center gap-1"
                >
                  <BookOpen className="w-4 h-4"/> Salin dari Event Lain
                </button>
              </div>
            </div>

            <div className="p-5 overflow-x-auto">
              {tanggalList.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2"/>
                  Rentang tanggal belum diatur pada Event aktif. Silakan atur di database atau buat Event baru.
                </div>
              ) : (
                <div className="space-y-4 min-w-[800px]">
                  {tanggalList.map(tgl => {
                    const isExpanded = expandedDates.includes(tgl)
                    return (
                    <div key={tgl} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <div 
                        className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors"
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedDates(prev => prev.filter(d => d !== tgl))
                          } else {
                            setExpandedDates(prev => [...prev, tgl])
                          }
                        }}
                      >
                        <h4 className="font-bold text-indigo-900">{new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                        <div className="text-indigo-600">
                          {isExpanded ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                        </div>
                      </div>
                      
                      {isExpanded && (
                      <div className="divide-y">
                        {sesiList.map(sesi => {
                          const sesiJamGroups = (sesi.jam_group || '').split(',').map(s => s.trim())
                          const kelasForSesi = kelasAktif.filter(k => sesiJamGroups.includes(kelasJamMapping[k.id]))
                          if (kelasForSesi.length === 0) return null

                          // Group by marhalah
                          const byMarhalah: Record<string, {nama: string, kelas: any[]}> = {}
                          kelasForSesi.forEach(k => {
                            if (!byMarhalah[k.marhalah_id]) byMarhalah[k.marhalah_id] = { nama: k.marhalah_nama, kelas: [] }
                            byMarhalah[k.marhalah_id].kelas.push(k)
                          })

                          return (
                            <div key={sesi.id} className="flex">
                              <div className="w-32 bg-slate-50 border-r p-3 shrink-0 flex flex-col justify-center items-center text-center gap-1">
                                <span className="font-black text-slate-700 text-lg">Sesi {sesi.nomor_sesi}</span>
                                <span className="text-xs text-slate-500">{sesi.label}</span>
                                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded">{sesi.jam_group}</span>
                                <button
                                  onClick={() => {
                                    setSesiMapelId('')
                                    setSesiModal({
                                      tgl,
                                      sesiId: sesi.id!,
                                      sesiLabel: sesi.label,
                                      allKelasIds: kelasForSesi.map(k => k.id)
                                    })
                                  }}
                                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100 w-full"
                                >⚡ Set Sesi</button>
                              </div>
                              <div className="flex-1 p-3 space-y-3">
                                {Object.entries(byMarhalah).map(([marhalahId, { nama: marhalahNama, kelas }]) => {
                                  const isMutawassithah = marhalahNama.toLowerCase().includes('mutawassithah')
                                  const kelasIds = kelas.map(k => k.id)
                                  const usedIds = getUsedMapelIds(kelasIds)

                                  if (!isMutawassithah) {
                                    // ── PER MARHALAH: satu dropdown langsung set semua kelas ──
                                    // Nilai saat ini: ambil dari kelas pertama (semua harusnya sama)
                                    const currentMapelId = jadwalMap[tgl]?.[sesi.id!]?.[kelas[0].id]
                                    const availableMapel = mapelAktif.filter(m => !usedIds.has(m.id) || m.id === currentMapelId)
                                    return (
                                      <div key={marhalahId} className="flex items-center gap-3 py-1">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-wide w-40 shrink-0">{marhalahNama}</span>
                                        <select
                                          value={currentMapelId || ''}
                                          onChange={e => handleMarhalahChange(tgl, sesi.id!, kelasIds, e.target.value ? parseInt(e.target.value) : '')}
                                          className={`text-sm border rounded-lg px-2 py-1.5 flex-1 outline-none ${
                                            currentMapelId ? 'border-indigo-300 bg-indigo-50 font-medium' : 'border-slate-200'
                                          }`}
                                        >
                                          <option value="">-- Pilih Mapel --</option>
                                          {availableMapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                                        </select>
                                        {currentMapelId && (
                                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-200 px-2 py-1 rounded shrink-0">
                                            {kelas.length} kelas
                                          </span>
                                        )}
                                      </div>
                                    )
                                  }

                                  // ── PER KELAS (Mutawassithah) ──
                                  return (
                                    <div key={marhalahId}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-wide">{marhalahNama}</span>
                                        <button
                                          onClick={() => {
                                            setBulkMapelId('')
                                            setBulkModal({ tgl, sesiId: sesi.id!, marhalahNama, kelasIds })
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100"
                                        >⚡ Set Semua</button>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {kelas.map(k => {
                                          const savedMapelId = jadwalMap[tgl]?.[sesi.id!]?.[k.id]
                                          const usedIdsKelas = getUsedMapelIds(kelasIds, k.id)
                                          const availableMapel = mapelAktif.filter(m => !usedIdsKelas.has(m.id) || m.id === savedMapelId)
                                          return (
                                            <div key={k.id} className="border rounded p-2 bg-white flex flex-col gap-1">
                                              <span className="text-xs font-bold text-slate-700">{k.nama_kelas}</span>
                                              <select
                                                value={savedMapelId || ''}
                                                onChange={e => handleJadwalChange(tgl, sesi.id!, k.id, e.target.value ? parseInt(e.target.value) : '')}
                                                className={`text-xs border rounded px-1 py-1 w-full outline-none ${savedMapelId ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}
                                              >
                                                <option value="">-- Kosong --</option>
                                                {availableMapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                                              </select>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BULK SET MARHALAH ──────────────────────────────────────── */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Set Semua Kelas</h3>
                <p className="text-xs text-slate-500 mt-0.5">{bulkModal.marhalahNama} — {bulkModal.kelasIds.length} kelas</p>
              </div>
              <button onClick={() => setBulkModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Mata Pelajaran</label>
                <select
                  value={bulkMapelId}
                  onChange={e => setBulkMapelId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                  autoFocus
                >
                  <option value="">-- Pilih Mapel --</option>
                  {mapelAktif
                    .filter(m => !getUsedMapelIds(bulkModal.kelasIds).has(m.id))
                    .map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠️ Tindakan ini akan menimpa jadwal yang sudah ada untuk semua kelas {bulkModal.marhalahNama} pada sesi ini.
              </p>
              <button
                onClick={handleBulkSetMarhalah}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700"
              >Terapkan ke {bulkModal.kelasIds.length} Kelas</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SET PER SESI ───────────────────────────────────────────── */}
      {sesiModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-emerald-50">
              <div>
                <h3 className="font-bold text-slate-800">⚡ Set Semua Sesi</h3>
                <p className="text-xs text-slate-500 mt-0.5">{sesiModal.sesiLabel} — {sesiModal.allKelasIds.length} kelas (semua marhalah)</p>
              </div>
              <button onClick={() => setSesiModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Mata Pelajaran</label>
                <select
                  value={sesiMapelId}
                  onChange={e => setSesiMapelId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-emerald-500"
                  autoFocus
                >
                  <option value="">-- Pilih Mapel --</option>
                  {mapelAktif.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠️ Semua kelas di sesi ini akan diisi mapel yang sama. Jadwal yang sudah ada akan ditimpa.
              </p>
              <button
                onClick={handleApplyBulkSesiMapel}
                className="w-full bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-emerald-700"
              >Terapkan ke {sesiModal.allKelasIds.length} Kelas</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COPY EVENT ───────────────────────────────────────────── */}
      {copyModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Salin Jadwal</h3>
                <p className="text-xs text-slate-500 mt-0.5">Duplikasi dari semester lalu</p>
              </div>
              <button onClick={() => setCopyModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Pilih Event Sumber</label>
                <select
                  value={copySourceId}
                  onChange={e => setCopySourceId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                >
                  <option value="">-- Pilih Event --</option>
                  {allEvents.filter(e => e.id !== activeEvent?.id).map(evt => (
                    <option key={evt.id} value={evt.id}>{evt.nama} ({evt.tahun_ajaran_nama})</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠️ <b>Peringatan:</b> Tindakan ini akan <b>MENGHAPUS</b> Sesi, Mapping Kelas, dan Jadwal yang sudah ada di event saat ini, lalu menggantinya dengan data dari event yang dipilih.
              </p>
              <button
                onClick={handleCopyEvent}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700"
              >Salin Sekarang</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
