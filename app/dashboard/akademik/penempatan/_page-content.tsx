'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  getMarhalahList, getTahunAjaranAktif, getKelasUntukMarhalah, getPenempatanData, simpanPenempatan,
  type KandidatPenempatan, type KelasTujuan, type JenjangPenempatan,
} from './actions'
import { gradeCocokKelas, type Grade } from '@/lib/akademik/grade'
import {
  Loader2, Users, GraduationCap, CheckSquare, Square, Filter, AlertTriangle, CalendarDays, Layers, ChevronDown, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const GRADE_SECTIONS: { key: Grade | 'X'; label: string }[] = [
  { key: 'A', label: 'Grade A' },
  { key: 'B', label: 'Grade B' },
  { key: 'C', label: 'Grade C' },
  { key: 'X', label: 'Belum Ada Grade' },
]

function gradeBadgeClass(grade: Grade | null): string {
  if (grade === 'A') return 'bg-green-50 text-green-700 border-green-200'
  if (grade === 'B') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (grade === 'C') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-slate-100 text-slate-500 border-slate-200'
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function labelSekolah(santri: KandidatPenempatan) {
  if (String(santri.kategori_santri || '').toUpperCase() === 'SADESA') return 'SADESA'
  return santri.sekolah || '-'
}

export default function PenempatanKelasPage() {
  const confirm = useConfirm()
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')

  const [kandidat, setKandidat] = useState<KandidatPenempatan[]>([])
  const [kelasTujuan, setKelasTujuan] = useState<KelasTujuan[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedGender, setSelectedGender] = useState<'L' | 'P'>('L')
  const [selectedJenjang, setSelectedJenjang] = useState<JenjangPenempatan>('SLTP')
  const [statOpen, setStatOpen] = useState(false)

  // santri_id -> kelas_id tujuan
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [bulkKelas, setBulkKelas] = useState('')

  useEffect(() => {
    getTahunAjaranAktif().then(setTahunAktif)
    getMarhalahList().then(setMarhalahList)
  }, [])

  const handleTampilkan = async () => {
    if (!selectedMarhalah) return toast.warning('Pilih marhalah tujuan terlebih dahulu.')
    setLoading(true)
    setPlacements({})
    setSelected([])
    setBulkKelas('')
    try {
      const [data, kelas] = await Promise.all([
        getPenempatanData(selectedMarhalah, selectedGender, selectedJenjang),
        getKelasUntukMarhalah(selectedMarhalah, selectedGender),
      ])
      setKandidat(data)
      setKelasTujuan(kelas)
      if (data.length === 0) toast.info('Tidak ada santri kandidat untuk marhalah ini.')
      if (kelas.length === 0) toast.warning('Belum ada kelas di marhalah ini. Atur kelas dulu di Master Kelas.')
    } catch {
      toast.error('Gagal memuat data penempatan.')
    } finally {
      setLoading(false)
    }
  }

  // Opsi kelas tetap urut natural (1-1, 1-2, ...); yang cocok grade hanya ditandai.
  const kelasOptionsFor = (grade: Grade | null) => {
    return [...kelasTujuan].sort((a, b) => naturalCompare(a.nama_kelas, b.nama_kelas))
  }

  const grouped = useMemo(() => {
    const g: Record<string, KandidatPenempatan[]> = { A: [], B: [], C: [], X: [] }
    kandidat.forEach(k => g[k.grade ?? 'X'].push(k))
    // Urutkan tiap grade ikut kelas asal (natural sort), lalu urutan grading (kecil=atas), baru/null jatuh ke bawah alfabet.
    Object.values(g).forEach(list => list.sort((a, b) => {
      const cmpAsal = naturalCompare(a.asal || '', b.asal || '')
      if (cmpAsal !== 0) return cmpAsal
      
      const ua = a.urutan ?? Number.MAX_SAFE_INTEGER
      const ub = b.urutan ?? Number.MAX_SAFE_INTEGER
      if (ua !== ub) return ua - ub
      return a.nama.localeCompare(b.nama, undefined, { sensitivity: 'base' })
    }))
    return g
  }, [kandidat])

  // Penempatan sesi ini (belum disimpan) per kelas, untuk overlay statistik.
  const pendingByKelas = useMemo(() => {
    const m: Record<string, number> = {}
    Object.values(placements).forEach(kid => { if (kid) m[kid] = (m[kid] || 0) + 1 })
    return m
  }, [placements])

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleSelectGroup = (ids: string[]) => {
    const allSelected = ids.every(id => selected.includes(id))
    setSelected(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))
  }

  const applyBulk = () => {
    if (selected.length === 0) return toast.warning('Pilih minimal satu santri (ceklis).')
    if (!bulkKelas) return toast.warning('Pilih kelas tujuan terlebih dahulu.')
    setPlacements(prev => {
      const next = { ...prev }
      selected.forEach(id => { next[id] = bulkKelas })
      return next
    })
    setSelected([])
    toast.success(`Kelas tujuan diterapkan ke ${selected.length} santri.`)
  }

  const setOne = (santriId: string, kelasId: string) =>
    setPlacements(prev => ({ ...prev, [santriId]: kelasId }))

  const totalReady = Object.values(placements).filter(Boolean).length

  const handleSimpan = async () => {
    const payload = kandidat
      .filter(k => placements[k.santri_id])
      .map(k => ({
        santri_id: k.santri_id,
        kelas_id: placements[k.santri_id],
        riwayat_lama_id: k.riwayat_lama_id,
      }))
    if (payload.length === 0) return toast.error('Belum ada santri yang ditentukan kelasnya.')
    if (!await confirm(`Simpan penempatan untuk ${payload.length} santri ke kelas tujuan?`)) return

    setSaving(true)
    const t = toast.loading('Menyimpan penempatan...')
    try {
      const res = await simpanPenempatan(payload)
      toast.dismiss(t)
      if (res?.error) {
        toast.error('Gagal', { description: res.error, duration: 8000 })
      } else {
        toast.success('Penempatan berhasil!', { description: `${res.count} santri ditempatkan.` })
        await handleTampilkan() // refresh: santri yang sudah ditempatkan hilang dari daftar
      }
    } catch {
      toast.dismiss(t)
      toast.error('Terjadi kesalahan saat menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full pb-24">
      <DashboardPageHeader
        title="Penempatan Kelas"
        description="Lanjutan tes klasifikasi & grading. Kelompokkan santri per grade, lalu masukkan ke kelas sesuai komposisinya."
        className="border-b pb-4"
      />

      {/* BANNER TAHUN AJARAN */}
      {tahunAktif ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            Tahun ajaran aktif: <span className="font-bold">{tahunAktif.nama}</span>
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Belum ada tahun ajaran aktif!</p>
            <Link href="/dashboard/pengaturan/tahun-ajaran" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-800 underline">
              <CalendarDays className="w-3.5 h-3.5" /> Atur Tahun Ajaran →
            </Link>
          </div>
        </div>
      )}

      {/* STEP 1: PILIH MARHALAH TUJUAN */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="w-full md:flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marhalah Tujuan</label>
            <select
              className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-medium text-sm outline-none"
              value={selectedMarhalah}
              onChange={(e) => setSelectedMarhalah(e.target.value)}
            >
              <option value="">-- Pilih Marhalah --</option>
              {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jenis Kelamin</label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSelectedGender('L')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all ${selectedGender === 'L' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Putra
              </button>
              <button
                onClick={() => setSelectedGender('P')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all ${selectedGender === 'P' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Putri
              </button>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jenjang Sekolah</label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSelectedJenjang('SLTP')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all ${selectedJenjang === 'SLTP' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                SLTP
              </button>
              <button
                onClick={() => setSelectedJenjang('SLTA')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-sm font-bold transition-all ${selectedJenjang === 'SLTA' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                SLTA
              </button>
            </div>
          </div>
          <button
            onClick={handleTampilkan}
            disabled={!selectedMarhalah || loading}
            className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
            Tampilkan
          </button>
        </div>
        <p className="text-[11px] font-medium text-slate-400">SLTP: MTS/MTSN/SMP. SLTA: MAN/SMK/SMA/SADESA.</p>
      </div>

      {/* PERINGATAN KELAS KOSONG */}
      {kandidat.length > 0 && kelasTujuan.length === 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Belum ada kelas di marhalah ini.</p>
            <p className="text-xs text-amber-700 mt-0.5">Atur jumlah kelas & komposisi grade-nya dulu.</p>
            <Link href="/dashboard/master/kelas" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-800 underline">
              <Layers className="w-3.5 h-3.5" /> Master Kelas →
            </Link>
          </div>
        </div>
      )}

      {/* STATISTIK (accordion) */}
      {kandidat.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setStatOpen(o => !o)}
            className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-50"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-sm font-bold text-slate-700">Statistik</span>
            <span className="text-xs text-slate-400 hidden sm:inline">— ringkasan grade & isi tiap kelas</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${statOpen ? 'rotate-180' : ''}`} />
          </button>
          {statOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              {/* Ringkasan grade kandidat */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Kandidat per Grade ({kandidat.length} total)</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { k: 'A', label: 'Grade A', cls: 'bg-green-50 text-green-700 border-green-200' },
                    { k: 'B', label: 'Grade B', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { k: 'C', label: 'Grade C', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
                    { k: 'X', label: 'Belum Ada Grade', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
                  ] as const).map(g => (
                    <span key={g.k} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border ${g.cls}`}>
                      {g.label}
                      <span className="font-black">{grouped[g.k]?.length || 0}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Isi tiap kelas tujuan */}
              {kelasTujuan.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Jumlah Santri per Kelas</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-slate-500 font-bold uppercase text-[11px] border-b border-slate-100">
                        <tr>
                          <th className="py-2 pr-3">Kelas</th>
                          <th className="py-2 px-3 text-center">Komposisi</th>
                          <th className="py-2 px-3 text-center">Terisi</th>
                          <th className="py-2 px-3 text-center">+ Baru (sesi ini)</th>
                          <th className="py-2 pl-3 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {kelasTujuan.map(k => {
                          const tambah = pendingByKelas[k.id] || 0
                          return (
                            <tr key={k.id}>
                              <td className="py-2 pr-3 font-bold text-slate-800">
                                {k.nama_kelas}
                                <span className="ml-2 text-[10px] font-bold text-slate-400">{k.jenis_kelamin === 'C' ? 'CAMPUR' : k.jenis_kelamin === 'L' ? 'PUTRA' : 'PUTRI'}</span>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-500 font-semibold">{k.grade || '-'}</td>
                              <td className="py-2 px-3 text-center text-slate-600">{k.jumlah}</td>
                              <td className="py-2 px-3 text-center font-bold text-indigo-600">{tambah > 0 ? `+${tambah}` : '-'}</td>
                              <td className="py-2 pl-3 text-center font-black text-slate-800">{k.jumlah + tambah}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BULK TOOLBAR */}
      {kandidat.length > 0 && kelasTujuan.length > 0 && (
        <div className="bg-indigo-50/60 p-4 border border-indigo-100 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-2 z-20 backdrop-blur">
          <div>
            <h3 className="font-bold text-indigo-900">Terapkan ke {selected.length} santri terpilih</h3>
            <p className="text-xs text-indigo-700/70 font-medium mt-0.5">Ceklis santri lalu pilih kelas tujuan. Kelas diurutkan natural, dan yang cocok grade ditandai.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto bg-white p-2 rounded-xl border border-indigo-100 shadow-sm">
            <select
              className="w-full sm:w-auto p-2 text-sm outline-none text-indigo-700 font-bold bg-transparent"
              value={bulkKelas}
              onChange={(e) => setBulkKelas(e.target.value)}
            >
              <option value="">Pilih Kelas Tujuan</option>
              {kelasTujuan.map(k => (
                <option key={k.id} value={k.id}>{k.nama_kelas}{k.grade ? ` [${k.grade}]` : ''}</option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* GRADE SECTIONS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
          <p className="font-medium">Memuat kandidat santri...</p>
        </div>
      ) : kandidat.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-500">Pilih marhalah tujuan lalu klik Tampilkan</h3>
        </div>
      ) : (
        <div className="space-y-5">
          {GRADE_SECTIONS.map(section => {
            const list = grouped[section.key]
            if (!list || list.length === 0) return null
            const ids = list.map(s => s.santri_id)
            const allSelected = ids.every(id => selected.includes(id))
            const grade = section.key === 'X' ? null : (section.key as Grade)

            return (
              <div key={section.key} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleSelectGroup(ids)} className="text-slate-400 hover:text-indigo-600">
                      {allSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${gradeBadgeClass(grade)}`}>
                      {section.label}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{list.length} santri</span>
                  </div>
                  {section.key === 'X' && (
                    <span className="text-[11px] text-amber-600 font-bold inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Belum dites/digrading — tempatkan manual
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px]">
                      <tr>
                        <th className="p-3 w-10"></th>
                        <th className="p-3">Nama & NIS</th>
                        <th className="p-3 text-center">Sumber</th>
                        <th className="p-3 text-center">Sekolah</th>
                        <th className="p-3 text-center">Asal</th>
                        <th className="p-3 w-72">Kelas Tujuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map(s => {
                        const isSel = selected.includes(s.santri_id)
                        const placedId = placements[s.santri_id] || ''
                        return (
                          <tr key={s.santri_id} className={`hover:bg-slate-50 ${isSel ? 'bg-indigo-50/40' : ''}`}>
                            <td className="p-3 text-center cursor-pointer" onClick={() => toggleSelect(s.santri_id)}>
                              {isSel ? <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto" /> : <Square className="w-5 h-5 text-slate-300 mx-auto" />}
                            </td>
                            <td className="p-3 cursor-pointer" onClick={() => toggleSelect(s.santri_id)}>
                              <p className="font-bold text-slate-800">{s.nama}</p>
                              <p className="text-slate-500 font-mono text-xs">{s.nis}</p>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.sumber === 'baru' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                                {s.sumber === 'baru' ? 'Baru' : 'Naik'}
                              </span>
                            </td>
                            <td className="p-3 text-center text-slate-500 text-xs">
                              <span className="inline-flex max-w-36 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-bold uppercase">
                                {labelSekolah(s)}
                              </span>
                            </td>
                            <td className="p-3 text-center text-slate-500 text-xs">{s.asal}</td>
                            <td className="p-3">
                              <select
                                className={`w-full p-2 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${placedId ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white text-slate-700'}`}
                                value={placedId}
                                onChange={(e) => setOne(s.santri_id, e.target.value)}
                              >
                                <option value="">- Belum Ditentukan -</option>
                                {kelasOptionsFor(grade).map(k => {
                                  const cocok = gradeCocokKelas(grade, k.grade)
                                  return (
                                    <option key={k.id} value={k.id}>
                                      {k.nama_kelas}{k.grade ? ` [${k.grade}]` : ''}{cocok ? ' • disarankan' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FLOATING SAVE BAR */}
      {totalReady > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[420px] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm">{totalReady}</div>
            <span className="font-semibold text-sm">Santri siap ditempatkan</span>
          </div>
          <button
            onClick={handleSimpan}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 active:scale-95 disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
            Simpan Penempatan
          </button>
        </div>
      )}
    </div>
  )
}
