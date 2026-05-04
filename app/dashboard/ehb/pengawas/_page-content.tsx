'use client'

import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  getActiveEventLight, getPengawasList, getGuruList, addPengawas, updatePengawas, deletePengawas,
  getJadwalPengawasAll, getSesiList, getTanggalList, getRuanganList,
  saveAssignmentManual, deleteAssignment, getKartuPengawasData
} from './actions'
import {
  UserCheck, Plus, Edit2, Trash2, Loader2, AlertTriangle, 
  X, Users, Printer, Upload, Download, FileSpreadsheet
} from 'lucide-react'
import { toast } from 'sonner'
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
  const [loading, setLoading] = useState(true)

  // Form Pengawas (Edit saja - single)
  const [showEditForm, setShowEditForm] = useState(false)
  const [formData, setFormData] = useState({ id: 0, nama_pengawas: '', tag: 'junior' })

  // Form Tambah Massal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTab, setAddTab] = useState<'guru'|'manual'>('guru')
  const [selectedGurus, setSelectedGurus] = useState<Set<number>>(new Set())
  const [defaultTag, setDefaultTag] = useState('junior')
  const [manualName, setManualName] = useState('')
  const [guruSearch, setGuruSearch] = useState('')
  const [importedRows, setImportedRows] = useState<{nama: string, tag: string}[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setSelectedGurus(new Set())
    setDefaultTag('junior')
    setManualName('')
    setGuruSearch('')
    setAddTab('guru')
    setShowAddModal(true)
  }

  const handleOpenEdit = (p: any) => {
    setFormData({ id: p.id, nama_pengawas: p.nama_pengawas, tag: p.tag })
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
      return { guru_id: gid, nama_pengawas: g?.nama || '', tag: defaultTag }
    })
    const res = await addPengawas(event.id, payload)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${toAdd.length} pengawas berhasil ditambahkan!`)
    setShowAddModal(false)
    loadData()
  }

  // ── TAMBAH MANUAL (NAMA BEBAS) ──
  const handleSaveManual = async () => {
    if (!event) return
    if (!manualName.trim()) return toast.error('Masukkan nama pengawas')
    const res = await addPengawas(event.id, [{ nama_pengawas: manualName.trim(), tag: defaultTag }])
    if ('error' in res) return toast.error(res.error)
    toast.success('Pengawas ditambahkan!')
    setManualName('')
    setShowAddModal(false)
    loadData()
  }

  // ── IMPORT EXCEL ──
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['nama_pengawas', 'tag'],
      ['Contoh: Ustadz Ahmad Fauzi', 'junior'],
      ['Contoh: Ustadzah Siti Aminah', 'senior'],
    ])
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Pengawas')
    XLSX.writeFile(wb, 'template_pengawas.xlsx')
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' })
        const parsed = rows
          .map((r: any) => ({
            nama: (r['nama_pengawas'] || r['nama'] || '').toString().trim(),
            tag: ['senior', 'junior'].includes((r['tag'] || '').toString().toLowerCase())
              ? (r['tag'] || '').toString().toLowerCase()
              : 'junior'
          }))
          .filter((r: any) => r.nama.length > 0)
        if (parsed.length === 0) return toast.error('Tidak ada data yang bisa dibaca dari file Excel')
        setImportedRows(parsed)
        toast.success(`${parsed.length} baris berhasil diimpor. Cek preview lalu klik Simpan.`)
      } catch {
        toast.error('Gagal membaca file Excel')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSaveImport = async () => {
    if (!event || importedRows.length === 0) return
    const payload = importedRows.map(r => ({ nama_pengawas: r.nama, tag: r.tag }))
    const res = await addPengawas(event.id, payload)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${importedRows.length} pengawas berhasil ditambahkan!`)
    setImportedRows([])
    setShowAddModal(false)
    loadData()
  }

  // ── EDIT PENGAWAS ──
  const handleSavePengawas = async () => {
    if (!event) return
    if (!formData.nama_pengawas.trim()) return toast.error('Nama pengawas tidak boleh kosong')
    const res = await updatePengawas(formData.id, { nama_pengawas: formData.nama_pengawas, tag: formData.tag })
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
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5"/> Belum ada event EHB yang aktif. Silakan atur di menu Jadwal EHB.
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
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
                onClick={() => setAddTab('manual')}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg border transition-colors ${addTab === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >Nama Manual</button>
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

            {addTab === 'manual' && (
              <div className="px-5 py-4 flex-1 overflow-y-auto space-y-4 min-h-0">
                {/* Input nama satu-satu */}
                <div>
                  <label className="text-xs font-bold text-slate-500">Tambah Satu Nama</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      placeholder="Masukkan nama pengawas..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      onKeyDown={e => e.key === 'Enter' && handleSaveManual()}
                    />
                    <button
                      onClick={handleSaveManual}
                      className="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 shrink-0"
                    >Tambah</button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200"/>
                  <span className="text-xs text-slate-400 font-bold">ATAU IMPORT EXCEL</span>
                  <div className="flex-1 h-px bg-slate-200"/>
                </div>

                {/* Template & Upload */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Import dari Excel</p>
                      <p className="text-xs text-slate-500 mt-0.5">Kolom: <code className="bg-slate-200 px-1 rounded text-[11px]">nama_pengawas</code>, <code className="bg-slate-200 px-1 rounded text-[11px]">tag</code></p>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                    >
                      <Download className="w-3.5 h-3.5"/> Template
                    </button>
                  </div>
                  <label className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-500 shrink-0"/>
                    <span className="text-sm text-slate-600">
                      {importedRows.length > 0
                        ? <><span className="font-bold text-indigo-700">{importedRows.length} baris</span> siap diimpor</>  
                        : 'Klik untuk pilih file .xlsx / .xls'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportExcel}
                    />
                  </label>
                </div>

                {/* Preview tabel import */}
                {importedRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-slate-600">Preview ({importedRows.length} baris)</p>
                      <button onClick={() => setImportedRows([])} className="text-xs text-red-500 hover:underline">Hapus semua</button>
                    </div>
                    <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-slate-600">Nama</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 w-20">Tag</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importedRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5">{r.nama}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  r.tag === 'senior' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>{r.tag}</span>
                              </td>
                              <td className="px-2">
                                <button
                                  onClick={() => setImportedRows(prev => prev.filter((_, j) => j !== i))}
                                  className="text-slate-300 hover:text-red-500"
                                ><X className="w-3.5 h-3.5"/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleSaveImport}
                      className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4"/> Simpan {importedRows.length} Pengawas
                    </button>
                  </div>
                )}
              </div>
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
