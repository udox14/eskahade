'use client'

import { useState, useEffect } from 'react'
import {
  getRuanganList, addRuangan, updateRuangan, deleteRuangan, addRuanganBulk, addRuanganImport,
  getRuanganDetail, getActiveEventLight, getOtherRuangan, pindahSantri, hapusPeserta,
  cariSantriUnplotted, tambahPesertaManual,
  getDataCetakRuangan, getSesiListForRuangan, getDataBlankoAbsensi, getJamGroups
} from './actions'
import * as XLSX from 'xlsx'
import {
  LayoutList, Plus, Edit2, Trash2, MapPin, Users, Loader2, X, Printer,
  ArrowRightLeft, UserPlus, Search, FileText, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Link from 'next/link'

export default function RuanganEhbPage() {
  const confirm = useConfirm()
  const [event, setEvent] = useState<{ id: number, nama: string } | null>(null)
  const [ruanganList, setRuanganList] = useState<any[]>([])
  const [jamGroups, setJamGroups] = useState<string[]>([])
  const [activeJamTab, setActiveJamTab] = useState<string>('Semua')
  const [loading, setLoading] = useState(true)

  // Modal Form Ruangan
  const [showForm, setShowForm] = useState(false)
  const [addMode, setAddMode] = useState<'single'|'bulk'|'import'>('single')
  const [formData, setFormData] = useState({ id: 0, nomor_ruangan: 1, nama_ruangan: '', kapasitas: 20, jenis_kelamin: 'L' })
  const [bulkData, setBulkData] = useState({ count: 10, start_nomor: 1, kapasitas: 20, jenis_kelamin: 'L' })
  const [importFile, setImportFile] = useState<File | null>(null)

  // Drawer / Modal Detail Ruangan
  const [detailRuangan, setDetailRuangan] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [pesertaByJam, setPesertaByJam] = useState<Record<string, any[]>>({})

  // Modal Pindah Ruangan
  const [showPindah, setShowPindah] = useState<any>(null) // the participant to move
  const [otherRuangan, setOtherRuangan] = useState<any[]>([])
  const [targetRuanganId, setTargetRuanganId] = useState<number>(0)

  // Modal Tambah Peserta Manual
  const [showTambah, setShowTambah] = useState<{ ruangan_id: number, jam_group: string, jenis_kelamin: string } | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Modal Cetak Blanko
  const [showCetakBlanko, setShowCetakBlanko] = useState<number | null>(null) // ruangan_id
  const [sesiList, setSesiList] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (event && !loading) {
        getRuanganList(event.id, activeJamTab !== 'Semua' ? activeJamTab : undefined).then(list => {
            setRuanganList(list)
        })
    }
  }, [activeJamTab])

  const loadData = async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    if (evt) {
      const jgs = await getJamGroups(evt.id)
      const groups = jgs.map(j => j.jam_group)
      setJamGroups(groups)

      const list = await getRuanganList(evt.id, activeJamTab !== 'Semua' ? activeJamTab : undefined)
      setRuanganList(list)
    }
    setLoading(false)
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CRUD RUANGAN
  // ──────────────────────────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    const nextNo = ruanganList.length > 0 ? Math.max(...ruanganList.map(r => r.nomor_ruangan)) + 1 : 1
    setFormData({ id: 0, nomor_ruangan: nextNo, nama_ruangan: '', kapasitas: 20, jenis_kelamin: 'L' })
    setAddMode('single')
    setBulkData({ count: 10, start_nomor: nextNo, kapasitas: 20, jenis_kelamin: 'L' })
    setImportFile(null)
    setShowForm(true)
  }

  const handleOpenEdit = (r: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormData({ id: r.id, nomor_ruangan: r.nomor_ruangan, nama_ruangan: r.nama_ruangan || '', kapasitas: r.kapasitas, jenis_kelamin: r.jenis_kelamin })
    setAddMode('single')
    setShowForm(true)
  }

  const handleSaveRuangan = async () => {
    if (!event) return
    let res
    
    if (addMode === 'single') {
        const isEdit = formData.id !== 0
        if (isEdit) {
            res = await updateRuangan(formData.id, formData)
        } else {
            res = await addRuangan(event.id, formData)
        }
    } else if (addMode === 'bulk') {
        if (!bulkData.count || !bulkData.start_nomor || !bulkData.kapasitas) return toast.error('Harap lengkapi form generate')
        res = await addRuanganBulk(event.id, bulkData.count, bulkData.start_nomor, bulkData.kapasitas, bulkData.jenis_kelamin)
    } else if (addMode === 'import') {
        if (!importFile) return toast.error('Pilih file excel terlebih dahulu')
        try {
            const data = await importFile.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const json = XLSX.utils.sheet_to_json(worksheet)
            if (json.length === 0) return toast.error('File excel kosong')
            res = await addRuanganImport(event.id, json)
        } catch (error) {
            return toast.error('Gagal membaca file excel')
        }
    }

    if (res && 'error' in res) return toast.error(res.error)
    toast.success('Berhasil menyimpan ruangan')
    setShowForm(false)
    loadData()
  }

  const handleDeleteRuangan = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!await confirm('Hapus ruangan ini?')) return
    const res = await deleteRuangan(id)
    if ('error' in res) return toast.error(res.error)
    toast.success('Ruangan dihapus')
    loadData()
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // DETAIL RUANGAN (PESERTA)
  // ──────────────────────────────────────────────────────────────────────────────

  const handleOpenDetail = async (id: number) => {
    setLoadingDetail(true)
    const res = await getRuanganDetail(id)
    if (res) {
      setDetailRuangan(res.ruangan)

      const grouped: Record<string, any[]> = {}
      res.peserta.forEach((p: any) => {
        if (!grouped[p.jam_group]) grouped[p.jam_group] = []
        grouped[p.jam_group].push(p)
      })
      setPesertaByJam(grouped)
    }
    setLoadingDetail(false)
  }

  const handleHapusPeserta = async (plottingId: number) => {
    if (!await confirm('Keluarkan santri ini dari ruangan?')) return
    const res = await hapusPeserta(plottingId)
    if ('error' in res) return toast.error(res.error)
    toast.success('Peserta dikeluarkan')
    handleOpenDetail(detailRuangan.id) // reload detail
    loadData() // reload list
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // PINDAH RUANGAN
  // ──────────────────────────────────────────────────────────────────────────────

  const handleOpenPindah = async (peserta: any) => {
    if (!event || !detailRuangan) return
    setShowPindah(peserta)
    setTargetRuanganId(0)
    const list = await getOtherRuangan(event.id, detailRuangan.id, detailRuangan.jenis_kelamin)
    setOtherRuangan(list)
  }

  const handlePindahSantri = async () => {
    if (!event || !showPindah || !targetRuanganId) return
    const res = await pindahSantri(showPindah.santri_id, event.id, targetRuanganId, showPindah.jam_group)
    if ('error' in res) return toast.error(res.error)
    toast.success('Santri berhasil dipindahkan')
    setShowPindah(null)
    handleOpenDetail(detailRuangan.id)
    loadData()
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAMBAH PESERTA MANUAL
  // ──────────────────────────────────────────────────────────────────────────────

  const handleCariSantri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !showTambah || !searchKeyword) return
    setSearching(true)
    const res = await cariSantriUnplotted(event.id, showTambah.jenis_kelamin, searchKeyword)
    setSearchResults(res)
    setSearching(false)
  }

  const handleTambahPeserta = async (santriId: string) => {
    if (!event || !showTambah) return
    const res = await tambahPesertaManual(event.id, showTambah.ruangan_id, santriId, showTambah.jam_group)
    if ('error' in res) return toast.error(res.error)
    toast.success('Peserta ditambahkan')
    setShowTambah(null)
    handleOpenDetail(detailRuangan.id)
    loadData()
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CETAK MOCKUP (CONSOLE LOG OR JSON PREVIEW UNTUK SEKARANG)
  // ──────────────────────────────────────────────────────────────────────────────

  const handlePrintList = async (ruanganId: number) => {
    const data = await getDataCetakRuangan(ruanganId)
    if (!data) return toast.error('Data tidak ditemukan')

    // In real app, open a new window or trigger print modal
    console.log("PRINT DATA LIST:", data)
    toast.success('Data siap dicetak. Cek console.')
  }

  const handleOpenCetakBlanko = async (ruanganId: number) => {
    if (!event) return
    const list = await getSesiListForRuangan(event.id)
    setSesiList(list)
    setShowCetakBlanko(ruanganId)
  }

  const handlePrintBlanko = async (sesiId: number) => {
    if (!showCetakBlanko) return
    const data = await getDataBlankoAbsensi(showCetakBlanko, sesiId)
    if (!data) return toast.error('Data tidak ditemukan')

    console.log("PRINT DATA BLANKO:", data)
    toast.success('Data siap dicetak. Cek console.')
    setShowCetakBlanko(null)
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  if (!event) return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" /> Belum ada event EHB yang aktif. Silakan atur di menu Jadwal EHB.
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutList className="w-7 h-7 text-indigo-600" /> Ruangan EHB
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola daftar ruangan ujian dan peserta di dalamnya.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/ehb/ruangan/plotting" className="flex items-center gap-2 bg-white border text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50">
            <MapPin className="w-4 h-4" /> Auto Plotting
          </Link>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Tambah Ruangan
          </button>
        </div>
      </div>

      {jamGroups.length > 0 && (
        <div className="flex gap-2 border-b">
          <button 
            onClick={() => setActiveJamTab('Semua')}
            className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeJamTab === 'Semua' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            Total Gabungan
          </button>
          {jamGroups.map(jg => (
            <button 
              key={jg}
              onClick={() => setActiveJamTab(jg)}
              className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeJamTab === jg ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {jg}
            </button>
          ))}
        </div>
      )}

      {ruanganList.length === 0 ? (
        <div className="text-center py-20 bg-white border rounded-xl">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-500">Belum ada ruangan</p>
          <p className="text-sm text-slate-400 mt-1">Silakan tambah ruangan untuk event ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ruanganList.map(r => (
            <div
              key={r.id}
              onClick={() => handleOpenDetail(r.id)}
              className="bg-white border rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded flex items-center justify-center font-bold text-lg ${r.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {r.nomor_ruangan}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{r.nama_ruangan || `Ruangan ${r.nomor_ruangan}`}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{r.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                    </div>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleOpenEdit(r, e)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => handleDeleteRuangan(r.id, e)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">{r.total_peserta}</span><span className="text-xs text-slate-400">/ {r.kapasitas}</span>
                  </div>
                  {r.total_peserta > r.kapasitas && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">OVER</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL FORM RUANGAN */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{formData.id ? 'Edit Ruangan' : 'Tambah Ruangan'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {!formData.id && (
                <div className="flex border-b bg-slate-50/50">
                    <button onClick={() => setAddMode('single')} className={`flex-1 py-2 text-sm font-bold ${addMode === 'single' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>Satu per Satu</button>
                    <button onClick={() => setAddMode('bulk')} className={`flex-1 py-2 text-sm font-bold ${addMode === 'bulk' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>Generate Massal</button>
                    <button onClick={() => setAddMode('import')} className={`flex-1 py-2 text-sm font-bold ${addMode === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>Import Excel</button>
                </div>
            )}
            <div className="p-5 space-y-4">
              {addMode === 'single' && (
                  <>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Nomor Ruangan</label>
                        <input
                          type="number"
                          value={formData.nomor_ruangan}
                          onChange={e => setFormData({ ...formData, nomor_ruangan: parseInt(e.target.value) })}
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Nama Alias (Opsional)</label>
                        <input
                          value={formData.nama_ruangan}
                          onChange={e => setFormData({ ...formData, nama_ruangan: e.target.value })}
                          placeholder="mis: Aula Utama"
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Kapasitas Kursi</label>
                        <input
                          type="number"
                          value={formData.kapasitas}
                          onChange={e => setFormData({ ...formData, kapasitas: parseInt(e.target.value) })}
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Jenis Kelamin</label>
                        <select
                          value={formData.jenis_kelamin}
                          onChange={e => setFormData({ ...formData, jenis_kelamin: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="L">Laki-laki (Putra)</option>
                          <option value="P">Perempuan (Putri)</option>
                        </select>
                      </div>
                  </>
              )}
              {addMode === 'bulk' && !formData.id && (
                  <>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500">Jumlah Ruangan</label>
                              <input
                                  type="number"
                                  value={bulkData.count}
                                  onChange={e => setBulkData({ ...bulkData, count: parseInt(e.target.value) })}
                                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500">Mulai dari Nomor</label>
                              <input
                                  type="number"
                                  value={bulkData.start_nomor}
                                  onChange={e => setBulkData({ ...bulkData, start_nomor: parseInt(e.target.value) })}
                                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                              />
                          </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Kapasitas per Ruangan</label>
                        <input
                          type="number"
                          value={bulkData.kapasitas}
                          onChange={e => setBulkData({ ...bulkData, kapasitas: parseInt(e.target.value) })}
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500">Setel Jenis Kelamin</label>
                        <select
                          value={bulkData.jenis_kelamin}
                          onChange={e => setBulkData({ ...bulkData, jenis_kelamin: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="L">Laki-laki (Putra)</option>
                          <option value="P">Perempuan (Putri)</option>
                        </select>
                      </div>
                      <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-xs">
                          Akan membuat <b>{bulkData.count} ruangan</b> baru dimulai dari <b>Nomor {bulkData.start_nomor}</b> hingga <b>Nomor {bulkData.start_nomor + bulkData.count - 1}</b> dengan kapasitas masing-masing <b>{bulkData.kapasitas} kursi</b>.
                      </div>
                  </>
              )}
              {addMode === 'import' && !formData.id && (
                  <div className="space-y-4">
                      <div className="bg-slate-50 p-4 border rounded-xl text-sm">
                          <p className="font-bold text-slate-800 mb-2">Instruksi Import</p>
                          <ul className="list-disc pl-5 text-slate-600 space-y-1 text-xs">
                              <li>Buat file Excel (.xlsx) dengan kolom berikut di baris pertama: <b>Nomor Ruangan</b>, <b>Nama Ruangan</b>, <b>Kapasitas</b>, <b>L/P</b></li>
                              <li>Isi baris selanjutnya dengan data ruangan.</li>
                              <li>Contoh kolom L/P diisi 'L' untuk Putra, 'P' untuk Putri.</li>
                              <li>Jika Nomor Ruangan sudah ada, data kapasitas dan jenis kelamin akan ditimpa (update).</li>
                          </ul>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">Upload File Excel</label>
                          <input 
                              type="file" 
                              accept=".xlsx,.xls"
                              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                          />
                      </div>
                  </div>
              )}
              <button
                onClick={handleSaveRuangan}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700 mt-4"
              >
                {addMode === 'import' ? 'Proses Import' : addMode === 'bulk' ? 'Generate Ruangan' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL DETAIL RUANGAN */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {detailRuangan && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xl ${detailRuangan.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                  {detailRuangan.nomor_ruangan}
                </span>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{detailRuangan.nama_ruangan || `Ruangan ${detailRuangan.nomor_ruangan}`}</h3>
                  <p className="text-xs text-slate-500">Kapasitas: {detailRuangan.kapasitas} kursi • {detailRuangan.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintList(detailRuangan.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak List
                </button>
                <button
                  onClick={() => handleOpenCetakBlanko(detailRuangan.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200"
                >
                  <FileText className="w-3.5 h-3.5" /> Cetak Blanko
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button onClick={() => setDetailRuangan(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 bg-slate-100/50 flex-1">
              {loadingDetail ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Loop over jam_group */}
                  {Object.entries(pesertaByJam).length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-500">Belum ada peserta di ruangan ini</div>
                  ) : (
                    Object.entries(pesertaByJam).map(([jamGroup, participants]) => (
                      <div key={jamGroup} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                          <h4 className="font-bold text-slate-700 text-sm">{jamGroup}</h4>
                          <button
                            onClick={() => {
                              setShowTambah({ ruangan_id: detailRuangan.id, jam_group: jamGroup, jenis_kelamin: detailRuangan.jenis_kelamin })
                              setSearchKeyword(''); setSearchResults([])
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" /> Tambah
                          </button>
                        </div>
                        <div className="divide-y">
                          {participants.map(p => (
                            <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 group">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 border border-slate-200">
                                {p.nomor_kursi}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{p.nama_lengkap}</p>
                                <p className="text-[10px] text-slate-500 truncate">{p.nama_kelas} • {String(detailRuangan.nomor_ruangan).padStart(2, '0')}-{String(p.nomor_kursi).padStart(2, '0')}</p>
                              </div>
                              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                <button
                                  onClick={() => handleOpenPindah(p)}
                                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Pindah Ruangan"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleHapusPeserta(p.id)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                                  title="Keluarkan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL PINDAH RUANGAN */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {showPindah && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Pindah Ruangan</h3>
              <button onClick={() => setShowPindah(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border text-sm">
                <p className="font-bold text-slate-800">{showPindah.nama_lengkap}</p>
                <p className="text-xs text-slate-500">{showPindah.nama_kelas} • {showPindah.jam_group}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Pindah ke Ruangan:</label>
                <select
                  value={targetRuanganId}
                  onChange={e => setTargetRuanganId(parseInt(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value={0}>-- Pilih Ruangan --</option>
                  {otherRuangan.map(r => (
                    <option key={r.id} value={r.id}>
                      Ruang {r.nomor_ruangan} {r.nama_ruangan ? `(${r.nama_ruangan})` : ''} - Sisa {r.kapasitas - r.terisi} kursi
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handlePindahSantri}
                disabled={targetRuanganId === 0}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Pindahkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL TAMBAH PESERTA MANUAL */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {showTambah && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">Tambah Peserta Manual</h3>
                <p className="text-xs text-slate-500">ke {showTambah.jam_group}</p>
              </div>
              <button onClick={() => setShowTambah(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 border-b shrink-0">
              <form onSubmit={handleCariSantri} className="flex gap-2">
                <input
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  placeholder="Cari nama santri..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button type="submit" disabled={searching || !searchKeyword} className="bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-700">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </form>
            </div>
            <div className="overflow-y-auto flex-1 p-5 pt-0">
              {searchResults.length > 0 ? (
                <div className="divide-y mt-2">
                  {searchResults.map(s => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{s.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-500">{s.nis} • {s.nama_kelas}</p>
                      </div>
                      <button
                        onClick={() => handleTambahPeserta(s.id)}
                        className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100"
                      >
                        Tambah
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-sm">
                  {searching ? 'Mencari...' : 'Silakan cari nama santri'}
                  <p className="text-[10px] mt-1">Hanya menampilkan santri {showTambah.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} yang belum diplotting.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL PILIH SESI UNTUK CETAK BLANKO */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {showCetakBlanko && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Cetak Blanko Absensi</h3>
              <button onClick={() => setShowCetakBlanko(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600 mb-2">Pilih sesi yang akan dicetak blankonya:</p>
              {sesiList.map(sesi => (
                <button
                  key={sesi.id}
                  onClick={() => handlePrintBlanko(sesi.id)}
                  className="w-full text-left p-3 border rounded-xl hover:border-indigo-500 hover:bg-indigo-50 flex justify-between items-center group transition-all"
                >
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Sesi {sesi.nomor_sesi} - {sesi.label}</p>
                    <p className="text-[10px] text-slate-500">{sesi.jam_group}</p>
                  </div>
                  <Printer className="w-4 h-4 text-indigo-300 group-hover:text-indigo-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
