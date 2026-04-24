'use client'

import { useState, useEffect } from 'react'
import {
  getActiveEhbEvent, getAllEhbEvents, createEhbEvent, setActiveEvent, deleteEhbEvent,
  getSesiList, saveSesiConfig,
  getKelasJamMapping, getKelasAktifList, saveKelasJamMapping,
  getJadwalEhb, getTanggalJadwal, getMapelAktifList, saveJadwalEhb,
  getTahunAjaranList, hapusJadwalCell, hapusTanggal, SesiInput, JadwalItem
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
  const [newEvent, setNewEvent] = useState({ tahunAjaranId: 0, semester: 2, nama: '' })

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
  const [loadingJadwal, setLoadingJadwal] = useState(false)

  // Form Add Tanggal
  const [newTanggal, setNewTanggal] = useState('')

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
    if (!newEvent.tahunAjaranId || !newEvent.nama) return toast.error('Lengkapi data event')
    const res = await createEhbEvent(newEvent)
    if ('error' in res) return toast.error(res.error)
    toast.success('Event EHB berhasil dibuat dan diaktifkan')
    setNewEvent({ tahunAjaranId: 0, semester: 2, nama: '' })
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
  const jamGroups = Array.from(new Set(sesiList.map(s => s.jam_group).filter(Boolean)))

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB JADWAL
  // ──────────────────────────────────────────────────────────────────────────────

  const loadJadwal = async () => {
    if (!activeEvent) return
    setLoadingJadwal(true)
    const [jdw, mapel, tgls] = await Promise.all([
      getJadwalEhb(activeEvent.id),
      getMapelAktifList(),
      getTanggalJadwal(activeEvent.id)
    ])
    setJadwal(jdw)
    setMapelAktif(mapel)
    setTanggalList(tgls)
    setLoadingJadwal(false)
  }

  const handleAddTanggal = () => {
    if (!newTanggal) return
    if (tanggalList.includes(newTanggal)) return toast.error('Tanggal sudah ada')
    setTanggalList([...tanggalList, newTanggal].sort())
    setNewTanggal('')
  }

  const handleDeleteTanggal = async (tgl: string) => {
    if (!activeEvent) return
    if (!await confirm(`Hapus jadwal EHB tanggal ${tgl}?`)) return
    const res = await hapusTanggal(activeEvent.id, tgl)
    if ('error' in res) return toast.error(res.error)
    toast.success('Tanggal dihapus')
    loadJadwal()
  }

  // Get current jadwal mapping: tanggal -> sesi_id -> kelas_id -> mapel_id
  const jadwalMap: Record<string, Record<number, Record<string, number>>> = {}
  jadwal.forEach(j => {
    if (!jadwalMap[j.tanggal]) jadwalMap[j.tanggal] = {}
    if (!jadwalMap[j.tanggal][j.sesi_id]) jadwalMap[j.tanggal][j.sesi_id] = {}
    jadwalMap[j.tanggal][j.sesi_id][j.kelas_id] = j.mapel_id
  })

  // State untuk form edit jadwal (sementara)
  const [editJadwal, setEditJadwal] = useState<Record<string, number>>({}) // key: "tgl_sesi_kelas", value: mapel_id

  const handleJadwalChange = (tgl: string, sesiId: number, kelasId: string, mapelId: number | '') => {
    const key = `${tgl}_${sesiId}_${kelasId}`
    if (mapelId === '') {
      const newEdit = { ...editJadwal }
      delete newEdit[key]
      setEditJadwal(newEdit)
    } else {
      setEditJadwal({ ...editJadwal, [key]: mapelId })
    }
  }

  const handleSaveJadwal = async () => {
    if (!activeEvent) return
    const items: JadwalItem[] = []
    
    // Convert editJadwal ke array
    Object.entries(editJadwal).forEach(([key, mapelId]) => {
      const [tanggal, sesiIdStr, kelasId] = key.split('_')
      items.push({
        tanggal,
        sesi_id: parseInt(sesiIdStr),
        kelas_id: kelasId,
        mapel_id: mapelId
      })
    })

    if (!items.length) return toast.info('Tidak ada perubahan untuk disimpan')

    const res = await saveJadwalEhb(activeEvent.id, items)
    if ('error' in res) return toast.error(res.error)
    toast.success('Jadwal berhasil disimpan')
    setEditJadwal({})
    loadJadwal()
  }

  const handleHapusJadwalCell = async (tgl: string, sesiId: number, kelasId: string) => {
    if (!activeEvent) return
    const res = await hapusJadwalCell(activeEvent.id, tgl, sesiId, kelasId)
    if ('error' in res) return toast.error(res.error)
    // Remove from edit state if present
    const key = `${tgl}_${sesiId}_${kelasId}`
    if (editJadwal[key]) {
        const newEdit = { ...editJadwal }
        delete newEdit[key]
        setEditJadwal(newEdit)
    }
    loadJadwal()
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
                          placeholder="mis: Jam ke-1"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Mulai</label>
                        <input 
                          type="time"
                          value={sesi.waktu_mulai}
                          onChange={e => handleSesiChange(idx, 'waktu_mulai', e.target.value)}
                          className="w-full border rounded px-2 py-2 text-sm"
                        />
                      </div>
                      <div className="w-24">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Group kelas by marhalah for display */}
                  {Array.from(new Set(kelasAktif.map(k => k.marhalah_nama))).map(marhalahNama => {
                    const kelasInMarhalah = kelasAktif.filter(k => k.marhalah_nama === marhalahNama)
                    return (
                      <div key={marhalahNama as string} className="border rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 font-bold text-sm text-slate-700 border-b">
                          {marhalahNama as string}
                        </div>
                        <div className="divide-y max-h-[300px] overflow-y-auto">
                          {kelasInMarhalah.map(k => (
                            <div key={k.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                              <div>
                                <p className="text-sm font-bold text-slate-800">{k.nama_kelas}</p>
                                <p className="text-[10px] text-slate-500">{k.jenis_kelamin === 'L' ? 'Laki-laki' : k.jenis_kelamin === 'P' ? 'Perempuan' : 'Campur'}</p>
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
                <div className="flex items-center gap-2 border rounded-lg px-2 bg-white">
                  <input 
                    type="date" 
                    value={newTanggal}
                    onChange={e => setNewTanggal(e.target.value)}
                    className="text-sm border-none outline-none py-2"
                  />
                  <button 
                    onClick={handleAddTanggal}
                    className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-xs font-bold hover:bg-slate-200"
                  >
                    Tambah Tgl
                  </button>
                </div>
                <button 
                  onClick={handleSaveJadwal}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4"/> Simpan Perubahan
                </button>
              </div>
            </div>

            <div className="p-5 overflow-x-auto">
              {tanggalList.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  Belum ada tanggal jadwal. Tambahkan tanggal di pojok kanan atas.
                </div>
              ) : (
                <div className="space-y-8 min-w-[800px]">
                  {tanggalList.map(tgl => (
                    <div key={tgl} className="border rounded-xl overflow-hidden">
                      <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex justify-between items-center">
                        <h4 className="font-bold text-indigo-900">{new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                        <button onClick={() => handleDeleteTanggal(tgl)} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3 h-3"/> Hapus Tgl</button>
                      </div>
                      
                      {/* Nested tables for each Sesi */}
                      <div className="divide-y">
                        {sesiList.map(sesi => {
                          // Filter kelas that belong to this sesi's jam_group
                          const kelasForSesi = kelasAktif.filter(k => kelasJamMapping[k.id] === sesi.jam_group)
                          if (kelasForSesi.length === 0) return null

                          return (
                            <div key={sesi.id} className="flex">
                              <div className="w-32 bg-slate-50 border-r p-3 shrink-0 flex flex-col justify-center items-center text-center">
                                <span className="font-black text-slate-700 text-lg">Sesi {sesi.nomor_sesi}</span>
                                <span className="text-xs text-slate-500">{sesi.label}</span>
                                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded mt-1">{sesi.jam_group}</span>
                              </div>
                              <div className="flex-1 p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {kelasForSesi.map(k => {
                                  const key = `${tgl}_${sesi.id}_${k.id}`
                                  const savedMapelId = jadwalMap[tgl]?.[sesi.id!]?.[k.id]
                                  const currentMapelId = editJadwal[key] !== undefined ? editJadwal[key] : savedMapelId

                                  return (
                                    <div key={k.id} className="border rounded p-2 bg-white flex flex-col gap-1 relative group">
                                      <span className="text-xs font-bold text-slate-700">{k.nama_kelas}</span>
                                      <select 
                                        value={currentMapelId || ''}
                                        onChange={e => handleJadwalChange(tgl, sesi.id!, k.id, e.target.value ? parseInt(e.target.value) : '')}
                                        className={`text-xs border rounded px-1 py-1 w-full outline-none ${currentMapelId ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}
                                      >
                                        <option value="">-- Kosong --</option>
                                        {mapelAktif.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                                      </select>
                                      {savedMapelId && !editJadwal[key] && (
                                         <button 
                                            onClick={() => handleHapusJadwalCell(tgl, sesi.id!, k.id)}
                                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hidden group-hover:block hover:bg-red-200 shadow"
                                            title="Hapus jadwal mapel ini"
                                          >
                                            <X className="w-3 h-3"/>
                                         </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
