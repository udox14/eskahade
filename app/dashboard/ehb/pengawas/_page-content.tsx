'use client'

import { useState, useEffect } from 'react'
import {
  getActiveEventLight, getPengawasList, getGuruList, addPengawas, updatePengawas, deletePengawas,
  getJadwalPengawasAll, getSesiList, getTanggalList, getRuanganList,
  saveAssignmentManual, deleteAssignment, getKartuPengawasData
} from './actions'
import {
  UserCheck, Plus, Edit2, Trash2, CalendarDays, Loader2, AlertTriangle, 
  X, Users, Printer, FileText, CheckCircle2, ChevronDown, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Link from 'next/link'

export default function PengawasEhbPage() {
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState<'daftar'|'jadwal'>('daftar')
  const [event, setEvent] = useState<{id: number, nama: string} | null>(null)
  
  const [pengawasList, setPengawasList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form Pengawas
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ id: 0, guru_id: 0, nama_pengawas: '', tag: 'junior' })
  const [isManualName, setIsManualName] = useState(false)

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
        const [pengawas, gurus] = await Promise.all([
          getPengawasList(evt.id),
          getGuruList()
        ])
        if (pengawas && pengawas.__error) throw new Error(pengawas.__error)
        if (gurus && gurus.__error) throw new Error(gurus.__error)
        
        setPengawasList(pengawas)
        setGuruList(gurus)
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
    setFormData({ id: 0, guru_id: 0, nama_pengawas: '', tag: 'junior' })
    setIsManualName(false)
    setShowForm(true)
  }

  const handleOpenEdit = (p: any) => {
    setFormData({ id: p.id, guru_id: p.guru_id || 0, nama_pengawas: p.nama_pengawas, tag: p.tag })
    setIsManualName(!p.guru_id)
    setShowForm(true)
  }

  const handleSavePengawas = async () => {
    if (!event) return
    if (!formData.nama_pengawas && !formData.guru_id) return toast.error('Pilih guru atau masukkan nama pengawas')

    let nama = formData.nama_pengawas
    if (!isManualName && formData.guru_id) {
        const guru = guruList.find(g => g.id === formData.guru_id)
        if (guru) nama = guru.nama
    }

    let res
    if (formData.id) {
        res = await updatePengawas(formData.id, { nama_pengawas: nama, tag: formData.tag })
    } else {
        res = await addPengawas(event.id, [{ guru_id: isManualName ? undefined : formData.guru_id, nama_pengawas: nama, tag: formData.tag }])
    }

    if ('error' in res) return toast.error(res.error)
    toast.success('Data pengawas disimpan')
    setShowForm(false)
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
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5"/> Belum ada event EHB yang aktif. Silakan atur di menu Jadwal EHB.
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-indigo-600"/> Pengaturan Pengawas
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola daftar pengawas ujian dan jadwal tugas mereka.</p>
        </div>
        <Link href="/dashboard/ehb/pengawas/plotting" className="flex items-center gap-2 bg-white border text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50">
          <Users className="w-4 h-4"/> Auto Plotting Pengawas
        </Link>
      </div>

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
                                        {new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                                                                                {pengawasList.map(p => (
                                                                                    <option key={p.id} value={p.id}>{p.nama_pengawas} ({p.tag})</option>
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
                                                                                    <span className={`text-[9px] uppercase font-bold px-1 rounded ${cell.tag==='senior' ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{cell.tag}</span>
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

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL FORM PENGAWAS */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{formData.id ? 'Edit Pengawas' : 'Tambah Pengawas'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <input type="checkbox" id="manualName" checked={isManualName} onChange={e => { setIsManualName(e.target.checked); setFormData({...formData, guru_id: 0}) }} className="rounded border-slate-300"/>
                 <label htmlFor="manualName" className="text-xs font-bold text-slate-600">Input nama manual (Bukan guru aktif)</label>
              </div>

              {!isManualName ? (
                  <div>
                    <label className="text-xs font-bold text-slate-500">Pilih Guru</label>
                    <select 
                        value={formData.guru_id} 
                        onChange={e => setFormData({...formData, guru_id: parseInt(e.target.value)})}
                        className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                    >
                        <option value={0}>-- Pilih Guru --</option>
                        {guruList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                    </select>
                  </div>
              ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-500">Nama Pengawas</label>
                    <input 
                        value={formData.nama_pengawas} 
                        onChange={e => setFormData({...formData, nama_pengawas: e.target.value})}
                        placeholder="Masukkan nama"
                        className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                    />
                  </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500">Tag Status</label>
                <select 
                  value={formData.tag} 
                  onChange={e => setFormData({...formData, tag: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-indigo-500"
                >
                  <option value="junior">Junior (Standard)</option>
                  <option value="senior">Senior (Diprioritaskan/Aturan Khusus)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Status Senior digunakan dalam algoritma Auto Plotting untuk mendapatkan perlakuan khusus (misal tidak jaga sesi malam).</p>
              </div>

              <button 
                onClick={handleSavePengawas}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
