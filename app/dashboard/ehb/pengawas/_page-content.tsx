'use client'

import { useState, useEffect } from 'react'
import {
  getActiveEventLight, getPengawasList, getGuruList, getSadesaList, addPengawas, updatePengawas, deletePengawas,
  getJadwalPengawasAll, getSesiList, getTanggalList, getRuanganList,
  saveAssignmentManual, deleteAssignment, getKartuPengawasData
} from './actions'
import {
  UserCheck, Plus, Edit2, Trash2, Loader2, AlertTriangle, 
  X, Users, Printer
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Link from 'next/link'
import { fullDateWib } from '../_date-utils'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function PengawasEhbPage() {
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState<'daftar'|'jadwal'>('daftar')
  const [event, setEvent] = useState<{id: number, nama: string} | null>(null)
  
  const [pengawasList, setPengawasList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [sadesaList, setSadesaList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form Pengawas (Edit saja - single)
  const [showEditForm, setShowEditForm] = useState(false)
  const [formData, setFormData] = useState({ id: 0, nama_pengawas: '', tag: 'junior', jenis_kelamin: 'L' })

  // Form Tambah Massal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTab, setAddTab] = useState<'guru'|'sadesa'>('guru')
  const [selectedGurus, setSelectedGurus] = useState<Set<number>>(new Set())
  const [selectedSadesa, setSelectedSadesa] = useState<Set<string>>(new Set())
  const [defaultTag, setDefaultTag] = useState('junior')
  const [defaultGender, setDefaultGender] = useState<'L' | 'P'>('L')
  const [guruSearch, setGuruSearch] = useState('')
  const [sadesaSearch, setSadesaSearch] = useState('')

  // Jadwal State
  const [jadwal, setJadwal] = useState<any[]>([])
  const [sesiList, setSesiList] = useState<any[]>([])
  const [tanggalList, setTanggalList] = useState<string[]>([])
  const [ruanganList, setRuanganList] = useState<any[]>([])
  
  // Edit Jadwal Manual
  const [editCell, setEditCell] = useState<{tgl: string, sesiId: number, ruanganId: number, jpId: number|null} | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const evt = await getActiveEventLight()
      setEvent(evt || null)
      
      if (evt) {
        const [pengawas, gurus, sadesa] = await Promise.all([
          getPengawasList(evt.id),
          getGuruList(),
          getSadesaList()
        ])
        if (pengawas && pengawas.__error) throw new Error(pengawas.__error)
        if (gurus && gurus.__error) throw new Error(gurus.__error)
        if (sadesa && sadesa.__error) throw new Error(sadesa.__error)
        
        setPengawasList(pengawas)
        setGuruList(gurus)
        setSadesaList(sadesa)
      }
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadJadwalData = async () => {
    if (!event) return
    setLoading(true)
    try {
      const [jdw, sesis, tgls, ruangs] = await Promise.all([
        getJadwalPengawasAll(event.id),
        getSesiList(event.id),
        getTanggalList(event.id),
        getRuanganList(event.id)
      ])
      setJadwal(jdw)
      setSesiList(sesis)
      setTanggalList(tgls)
      setRuanganList(ruangs)
    } catch (err: any) {
      toast.error('Gagal memuat matriks jadwal: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CRUD PENGAWAS
  // ──────────────────────────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setSelectedGurus(new Set())
    setSelectedSadesa(new Set())
    setDefaultTag('junior')
    setDefaultGender('L')
    setGuruSearch('')
    setSadesaSearch('')
    setAddTab('guru')
    setShowAddModal(true)
  }

  const handleOpenEdit = (p: any) => {
    setFormData({ id: p.id, nama_pengawas: p.nama_pengawas, tag: p.tag, jenis_kelamin: p.jenis_kelamin || 'L' })
    setShowEditForm(true)
  }

  // ── TAMBAH MASSAL DARI GURU ──
  const handleSaveBulkGuru = async () => {
    if (!event) return
    if (selectedGurus.size === 0) return toast.error('Pilih minimal 1 guru')

    // Filter guru yang sudah jadi pengawas
    const sudahAda = new Set(pengawasList.filter(p => p.guru_id).map((p: any) => p.guru_id))
    const toAdd = [...selectedGurus].filter(id => !sudahAda.has(id))
    if (toAdd.length === 0) return toast.error('Semua guru yang dipilih sudah terdaftar sebagai pengawas')

    const payload = toAdd.map(gid => {
      const g = guruList.find((x: any) => x.id === gid)
      return { guru_id: gid, nama_pengawas: g?.nama || '', tag: defaultTag, jenis_kelamin: defaultGender }
    })
    const res = await addPengawas(event.id, payload)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${toAdd.length} pengawas berhasil ditambahkan!`)
    setShowAddModal(false)
    loadData()
  }

  // ── TAMBAH MASSAL DARI SADESA ──
  const handleSaveBulkSadesa = async () => {
    if (!event) return
    if (selectedSadesa.size === 0) return toast.error('Pilih minimal 1 santri SADESA')

    const sudahAda = new Set(pengawasList.map((p: any) => String(p.nama_pengawas || '').trim().toLowerCase()))
    const toAdd = [...selectedSadesa].filter(id => {
      const s = sadesaList.find((x: any) => x.id === id)
      return s?.nama && !sudahAda.has(String(s.nama).trim().toLowerCase())
    })
    if (toAdd.length === 0) return toast.error('Semua SADESA yang dipilih sudah terdaftar sebagai pengawas')

    const payload = toAdd.map(id => {
      const s = sadesaList.find((x: any) => x.id === id)
      return { nama_pengawas: s?.nama || '', tag: defaultTag, jenis_kelamin: s?.jenis_kelamin || 'L' }
    })
    const res = await addPengawas(event.id, payload)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${toAdd.length} pengawas SADESA berhasil ditambahkan!`)
    setShowAddModal(false)
    loadData()
  }

  // ── EDIT PENGAWAS ──
  const handleSavePengawas = async () => {
    if (!event) return
    if (!formData.nama_pengawas.trim()) return toast.error('Nama pengawas tidak boleh kosong')
    const res = await updatePengawas(formData.id, {
      nama_pengawas: formData.nama_pengawas,
      tag: formData.tag,
      jenis_kelamin: formData.jenis_kelamin,
    })
    if ('error' in res) return toast.error(res.error)
    toast.success('Data pengawas disimpan')
    setShowEditForm(false)
    loadData()
  }

  const handleDelete = async (id: number) => {
      if (!await confirm('Hapus pengawas ini? Jadwal yang sudah ter-plot untuk pengawas ini juga akan dihapus.')) return
      const res = await deletePengawas(id)
      if ('error' in res) return toast.error(res.error)
      toast.success('Pengawas dihapus')
      loadData()
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // JADWAL MANUAL
  // ──────────────────────────────────────────────────────────────────────────────
  const getCellData = (tgl: string, sesiId: number, ruanganId: number) => {
      return jadwal.find(j => j.tanggal === tgl && j.sesi_id === sesiId && j.ruangan_id === ruanganId)
  }

  const handleSaveCell = async (pengawasId: number) => {
      if (!event || !editCell) return
      if (pengawasId === 0) {
          if (editCell.jpId) await deleteAssignment(editCell.jpId)
      } else {
          const res = await saveAssignmentManual(event.id, editCell.jpId, pengawasId, editCell.ruanganId, editCell.tgl, editCell.sesiId)
          if ('error' in res) return toast.error(res.error)
      }
      toast.success('Jadwal disimpan')
      setEditCell(null)
      loadJadwalData()
      loadData() // refresh total tugas list
  }

  const handlePrintKartu = async (pengawasId: number) => {
      if (!event) return
      const data = await getKartuPengawasData(event.id, pengawasId)
      if (!data) return toast.error('Data tidak ditemukan')
      console.log('PRINT KARTU PENGAWAS:', data)
      toast.success('Data disiapkan untuk dicetak. Cek console.')
  }


  if (loading && activeTab === 'daftar') return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>

  if (!event) return (
    <div className="py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5"/> Belum ada event EHB yang aktif. Silakan atur di menu Jadwal EHB.
      </div>
    </div>
  )

  return (
    <div className="pb-20 space-y-6">
      <DashboardPageHeader
        title="Pengaturan Pengawas"
        description="Kelola daftar pengawas ujian dan jadwal tugas mereka."
        className="border-b pb-4"
        action={(
          <Link href="/dashboard/ehb/pengawas/plotting" className="flex items-center gap-2 bg-white border text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50">
            <Users className="w-4 h-4"/> Auto Plotting Pengawas
          </Link>
        )}
      />

      <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('daftar')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 ${activeTab === 'daftar' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'}`}
          >
              Daftar Pengawas
          </button>
          <button 
            onClick={() => { setActiveTab('jadwal'); loadJadwalData(); }}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 ${activeTab === 'jadwal' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'}`}
          >
              Matriks Jadwal
          </button>
      </div>

      {activeTab === 'daftar' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Daftar Pengawas EHB</h3>
            <button 
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4"/> Tambah Pengawas
            </button>
          </div>
          
          <div className="p-0">
             {pengawasList.length === 0 ? (
                 <div className="text-center py-10 text-slate-500">Belum ada pengawas terdaftar.</div>
             ) : (
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 border-b">
                         <tr>
                             <th className="px-5 py-3 font-bold text-slate-500 text-xs uppercase w-10">No</th>
                             <th className="px-5 py-3 font-bold text-slate-500 text-xs uppercase">Nama Pengawas</th>
                             <th className="px-5 py-3 font-bold text-slate-500 text-xs uppercase text-center">JK</th>
                             <th className="px-5 py-3 font-bold text-slate-500 text-xs uppercase text-center">Status</th>
                             <th className="px-5 py-3 font-bold text-slate-500 text-xs uppercase text-center">Total Tugas</th>
                             <th className="px-5 py-3 w-32"></th>
                         </tr>
                     </thead>
                     <tbody className="divide-y">
                         {pengawasList.map((p, idx) => (
                             <tr key={p.id} className="hover:bg-slate-50">
                                 <td className="px-5 py-3 text-slate-500">{idx+1}</td>
                                 <td className="px-5 py-3">
                                     <p className="font-bold text-slate-800">{p.nama_pengawas}</p>
                                     {p.guru_id && <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Guru Terdaftar</span>}
                                     {!p.guru_id && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">SADESA</span>}
                                 </td>
                                 <td className="px-5 py-3 text-center">
                                     <span className={`px-2 py-1 rounded text-xs font-bold border ${p.jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                         {p.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}
                                     </span>
                                 </td>
                                 <td className="px-5 py-3 text-center">
                                     <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border ${p.tag === 'senior' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                         {p.tag}
                                     </span>
                                 </td>
                                 <td className="px-5 py-3 text-center">
                                     <span className="font-bold text-lg text-slate-700">{p.total_tugas}</span>
                                     <span className="text-xs text-slate-500 ml-1">Sesi</span>
                                 </td>
                                 <td className="px-5 py-3 text-right">
                                     <div className="flex items-center justify-end gap-2">
                                         <button onClick={() => handlePrintKartu(p.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Cetak Kartu">
                                            <Printer className="w-4 h-4"/>
                                         </button>
                                         <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                            <Edit2 className="w-4 h-4"/>
                                         </button>
                                         <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4"/>
                                         </button>
                                     </div>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             )}
          </div>
        </div>
      )}

      {activeTab === 'jadwal' && (
          <div className="bg-white border rounded-xl overflow-hidden">
             <div className="bg-slate-50 px-5 py-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Matriks Jadwal Pengawas</h3>
                  <p className="text-xs text-slate-500 mt-1">Klik kotak kosong untuk mengisi pengawas secara manual, atau klik nama pengawas untuk mengganti.</p>
                </div>
             </div>
             <div className="p-5 overflow-x-auto">
                 {loading ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500"/></div> : (
                     tanggalList.length === 0 || ruanganList.length === 0 ? (
                         <div className="text-center py-10 text-slate-500">Belum ada data tanggal ujian atau ruangan.</div>
                     ) : (
                         <div className="space-y-8 min-w-[800px]">
                             {tanggalList.map(tgl => (
                                 <div key={tgl} className="border rounded-xl overflow-hidden">
                                    <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 font-bold text-indigo-900">
                                        {fullDateWib(tgl)}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="border p-2 min-w-[120px] sticky left-0 z-10 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">Sesi / Ruangan</th>
                                                    {ruanganList.map(r => (
                                                        <th key={r.id} className="border p-2 text-center min-w-[150px]">
                                                            <div className="font-bold text-slate-700">{r.nomor_ruangan}</div>
                                                            <div className="text-[10px] text-slate-500 font-normal">{r.nama_ruangan} • {r.jenis_kelamin === 'L' ? 'Putra' : 'Putri'}</div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sesiList.map(sesi => (
                                                    <tr key={sesi.id} className="hover:bg-slate-50/50">
                                                        <td className="border p-2 sticky left-0 z-10 bg-white shadow-[1px_0_0_0_#e2e8f0]">
                                                            <div className="font-bold text-slate-800">Sesi {sesi.nomor_sesi}</div>
                                                            <div className="text-[10px] text-slate-500">{sesi.label} ({sesi.jam_group})</div>
                                                        </td>
                                                        {ruanganList.map(r => {
                                                            const cell = getCellData(tgl, sesi.id, r.id)
                                                            const isEditing = editCell?.tgl === tgl && editCell?.sesiId === sesi.id && editCell?.ruanganId === r.id
                                                            const availablePengawas = pengawasList.filter(p => r.jenis_kelamin === 'P' || p.jenis_kelamin !== 'P')
                                                            
                                                            return (
                                                                <td key={r.id} className="border p-2 relative">
                                                                    {isEditing ? (
                                                                        <div className="flex gap-1 absolute inset-1 bg-white z-20 shadow-lg border rounded p-1">
                                                                            <select 
                                                                                className="flex-1 text-xs border rounded px-1 outline-none"
                                                                                autoFocus
                                                                                defaultValue={cell?.pengawas_id || 0}
                                                                                onChange={e => handleSaveCell(parseInt(e.target.value))}
                                                                                onBlur={() => setEditCell(null)}
                                                                            >
                                                                                <option value={0}>-- KOSONG --</option>
                                                                                {availablePengawas.map(p => (
                                                                                    <option key={p.id} value={p.id}>{p.nama_pengawas} ({p.tag} • {p.jenis_kelamin === 'P' ? 'P' : 'L'})</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        <div 
                                                                            onClick={() => setEditCell({ tgl, sesiId: sesi.id, ruanganId: r.id, jpId: cell?.id || null })}
                                                                            className={`w-full h-full min-h-[40px] flex items-center justify-center p-1 rounded cursor-pointer transition-colors ${cell ? 'bg-indigo-50 border border-indigo-100 hover:bg-indigo-100' : 'hover:bg-slate-100'}`}
                                                                        >
                                                                            {cell ? (
                                                                                <div className="text-center">
                                                                                    <p className="text-xs font-bold text-indigo-900 leading-tight">{cell.nama_pengawas}</p>
                                                                                    <div className="mt-1 flex items-center justify-center gap-1">
                                                                                      <span className={`text-[9px] uppercase font-bold px-1 rounded ${cell.tag==='senior' ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{cell.tag}</span>
                                                                                      <span className={`text-[9px] font-bold px-1 rounded ${cell.pengawas_jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                        {cell.pengawas_jenis_kelamin === 'P' ? 'P' : 'L'}
                                                                                      </span>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-300 text-xs">-</span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                 </div>
                             ))}
                         </div>
                     )
                 )}
             </div>
          </div>
      )}

      {/* ── MODAL TAMBAH MASSAL ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800">Tambah Pengawas</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>

            {/* Tab */}
            <div className="flex gap-1 px-5 pt-4 shrink-0">
              <button
                onClick={() => setAddTab('guru')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg border transition-colors ${addTab === 'guru' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >Dari Data Guru</button>
              <button
                onClick={() => setAddTab('sadesa')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg border transition-colors ${addTab === 'sadesa' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >SADESA</button>
            </div>

            {/* Tag default */}
            <div className="px-5 pt-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Tag Default:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="defaultTag" value="junior" checked={defaultTag === 'junior'} onChange={() => setDefaultTag('junior')} className="accent-indigo-600"/>
                  <span className="text-xs text-slate-700">Junior</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="defaultTag" value="senior" checked={defaultTag === 'senior'} onChange={() => setDefaultTag('senior')} className="accent-indigo-600"/>
                  <span className="text-xs text-slate-700">Senior</span>
                </label>
              </div>
              {addTab === 'guru' ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">JK Default:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="defaultGender" value="L" checked={defaultGender === 'L'} onChange={() => setDefaultGender('L')} className="accent-indigo-600"/>
                    <span className="text-xs text-slate-700">Laki-laki</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="defaultGender" value="P" checked={defaultGender === 'P'} onChange={() => setDefaultGender('P')} className="accent-indigo-600"/>
                    <span className="text-xs text-slate-700">Perempuan</span>
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">Jenis kelamin pengawas SADESA mengikuti data santri.</p>
              )}
            </div>

            {addTab === 'guru' && (
              <>
                {/* Search & Select All */}
                <div className="px-5 pt-3 shrink-0 space-y-2">
                  <input
                    type="text"
                    placeholder="Cari nama guru..."
                    value={guruSearch}
                    onChange={e => setGuruSearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{selectedGurus.size} dipilih</span>
                    <button
                      onClick={() => {
                        const sudahAda = new Set(pengawasList.filter(p => p.guru_id).map((p: any) => p.guru_id))
                        const visible = guruList.filter((g: any) => !sudahAda.has(g.id) && g.nama.toLowerCase().includes(guruSearch.toLowerCase()))
                        if (selectedGurus.size === visible.length) {
                          setSelectedGurus(new Set())
                        } else {
                          setSelectedGurus(new Set(visible.map((g: any) => g.id)))
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >Pilih Semua</button>
                  </div>
                </div>

                {/* List guru dengan checkbox */}
                <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1 min-h-0">
                  {(() => {
                    const sudahAda = new Set(pengawasList.filter(p => p.guru_id).map((p: any) => p.guru_id))
                    const filtered = guruList.filter((g: any) => g.nama.toLowerCase().includes(guruSearch.toLowerCase()))
                    return filtered.map((g: any) => {
                      const isAdded = sudahAda.has(g.id)
                      const isChecked = selectedGurus.has(g.id)
                      return (
                        <label
                          key={g.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isAdded ? 'opacity-40 cursor-not-allowed bg-slate-50' :
                            isChecked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isAdded}
                            checked={isChecked}
                            onChange={e => {
                              const next = new Set(selectedGurus)
                              if (e.target.checked) next.add(g.id)
                              else next.delete(g.id)
                              setSelectedGurus(next)
                            }}
                            className="accent-indigo-600 w-4 h-4 shrink-0"
                          />
                          <span className="text-sm text-slate-800 flex-1">{g.nama}</span>
                          {isAdded && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">Sudah</span>}
                        </label>
                      )
                    })
                  })()}
                </div>

                <div className="px-5 py-4 border-t shrink-0">
                  <button
                    onClick={handleSaveBulkGuru}
                    className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4"/> Tambah {selectedGurus.size > 0 ? selectedGurus.size + ' ' : ''}Pengawas
                  </button>
                </div>
              </>
            )}

            {addTab === 'sadesa' && (
              <>
                <div className="px-5 pt-3 shrink-0 space-y-2">
                  <input
                    type="text"
                    placeholder="Cari nama SADESA..."
                    value={sadesaSearch}
                    onChange={e => setSadesaSearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{selectedSadesa.size} dipilih</span>
                    <button
                      onClick={() => {
                        const sudahAda = new Set(pengawasList.map((p: any) => String(p.nama_pengawas || '').trim().toLowerCase()))
                        const visible = sadesaList.filter((s: any) => !sudahAda.has(String(s.nama || '').trim().toLowerCase()) && s.nama.toLowerCase().includes(sadesaSearch.toLowerCase()))
                        if (selectedSadesa.size === visible.length) {
                          setSelectedSadesa(new Set())
                        } else {
                          setSelectedSadesa(new Set(visible.map((s: any) => s.id)))
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >Pilih Semua</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1 min-h-0">
                  {(() => {
                    const sudahAda = new Set(pengawasList.map((p: any) => String(p.nama_pengawas || '').trim().toLowerCase()))
                    const filtered = sadesaList.filter((s: any) => s.nama.toLowerCase().includes(sadesaSearch.toLowerCase()))
                    return filtered.map((s: any) => {
                      const isAdded = sudahAda.has(String(s.nama || '').trim().toLowerCase())
                      const isChecked = selectedSadesa.has(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isAdded ? 'opacity-40 cursor-not-allowed bg-slate-50' :
                            isChecked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isAdded}
                            checked={isChecked}
                            onChange={e => {
                              const next = new Set(selectedSadesa)
                              if (e.target.checked) next.add(s.id)
                              else next.delete(s.id)
                              setSelectedSadesa(next)
                            }}
                            className="accent-indigo-600 w-4 h-4 shrink-0"
                          />
                          <span className="text-sm text-slate-800 flex-1">
                            <span className="block">{s.nama}</span>
                            <span className="block text-[11px] text-slate-400">{[s.asrama, s.kamar].filter(Boolean).join(' / ') || 'SADESA'}</span>
                          </span>
                          {isAdded && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">Sudah</span>}
                        </label>
                      )
                    })
                  })()}
                </div>

                <div className="px-5 py-4 border-t shrink-0">
                  <button
                    onClick={handleSaveBulkSadesa}
                    className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4"/> Tambah {selectedSadesa.size > 0 ? selectedSadesa.size + ' ' : ''}Pengawas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL EDIT PENGAWAS ─────────────────────────────────────────────────── */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Edit Pengawas</h3>
              <button onClick={() => setShowEditForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Nama Pengawas</label>
                <input
                  value={formData.nama_pengawas}
                  onChange={e => setFormData({...formData, nama_pengawas: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Tag Status</label>
                <select
                  value={formData.tag}
                  onChange={e => setFormData({...formData, tag: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                >
                  <option value="junior">Junior</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Jenis Kelamin</label>
                <select
                  value={formData.jenis_kelamin}
                  onChange={e => setFormData({...formData, jenis_kelamin: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <button
                onClick={handleSavePengawas}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700"
              >Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
