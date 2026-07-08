'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  getMarhalahList, getTahunAjaranAktif, getKelasUntukMarhalah, getPenempatanData, simpanDraftPenempatan,
  getDraftPenempatan, hapusDraftItem, finalisasiDraft, hapusDraftBatch,
  type KandidatPenempatan, type KelasTujuan, type JenjangPenempatan, type DraftPenempatan,
} from './actions'
import { gradeCocokKelas, type Grade } from '@/lib/akademik/grade'
import {
  Loader2, Users, GraduationCap, CheckSquare, Square, Filter, AlertTriangle, CalendarDays, Layers, ChevronDown, BarChart3, ClipboardList, X, FileSpreadsheet
} from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
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

function BadgeSantriBaru() {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 ml-1.5 align-middle">
      Santri Baru
    </span>
  )
}

// Kelompokkan list (yang sudah terurut per `asal`) jadi grup beruntun berdasar asal,
// supaya bisa dipilih sekaligus per kelas asal yang sama.
function groupConsecutiveByAsal<T extends { asal: string; santri_id: string }>(list: T[]) {
  const groups: { asal: string; items: T[] }[] = []
  for (const item of list) {
    const last = groups[groups.length - 1]
    if (last && last.asal === item.asal) last.items.push(item)
    else groups.push({ asal: item.asal, items: [item] })
  }
  return groups
}

export default function PenempatanKelasPage() {
  const [tab, setTab] = useState<'penempatan' | 'review'>('penempatan')
  const [draftCount, setDraftCount] = useState(0)

  useEffect(() => {
    getDraftPenempatan().then(data => setDraftCount(data.length)).catch(() => {})
  }, [])

  return (
    <div className="space-y-6 w-full pb-24">
      <DashboardPageHeader
        title="Penempatan Kelas"
        description="Lanjutan tes klasifikasi & grading. Kelompokkan santri per grade, masukkan ke draft, lalu review sebelum difinalisasi permanen."
        className="border-b pb-4"
      />

      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setTab('penempatan')}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'penempatan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Penempatan
        </button>
        <button
          onClick={() => setTab('review')}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-2 ${tab === 'review' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Review Draft
          {draftCount > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center">{draftCount}</span>
          )}
        </button>
      </div>

      {tab === 'penempatan' ? (
        <TabPenempatan onDraftSaved={() => setTab('review')} />
      ) : (
        <TabReviewDraft onDraftCountChange={setDraftCount} />
      )}
    </div>
  )
}

function TabPenempatan({ onDraftSaved }: { onDraftSaved: () => void }) {
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

  // Asal kandidat "lama": default marhalah sebelumnya (kenaikan normal). Bisa diubah
  // jadi sama dengan tujuan (tinggal kelas) atau marhalah lain (loncat kelas).
  const [selectedSourceMarhalah, setSelectedSourceMarhalah] = useState('')
  const [semuaRekomendasiBaru, setSemuaRekomendasiBaru] = useState(false)

  // santri_id -> kelas_id tujuan
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [bulkKelas, setBulkKelas] = useState('')

  useEffect(() => {
    getTahunAjaranAktif().then(setTahunAktif)
    getMarhalahList().then(setMarhalahList)
  }, [])

  // Set ulang default asal (marhalah sebelumnya) tiap kali marhalah tujuan berganti.
  useEffect(() => {
    if (!selectedMarhalah || marhalahList.length === 0) return
    const target = marhalahList.find((m: any) => String(m.id) === String(selectedMarhalah))
    if (!target) return
    const prev = marhalahList.find((m: any) => Number(m.urutan) === Number(target.urutan) - 1)
    setSelectedSourceMarhalah(prev ? String(prev.id) : String(target.id))
  }, [selectedMarhalah, marhalahList])

  const targetMarhalah = useMemo(
    () => marhalahList.find((m: any) => String(m.id) === String(selectedMarhalah)) || null,
    [marhalahList, selectedMarhalah]
  )

  // Asal kandidat lama tidak boleh dari marhalah yang levelnya LEBIH TINGGI dari tujuan
  // (gak masuk akal santri "turun" dari marhalah atas ke marhalah bawah). Sama level
  // (tinggal kelas) atau lebih rendah (loncat maju) tetap boleh.
  const sourceMarhalahOptions = useMemo(() => {
    if (!targetMarhalah) return marhalahList
    return marhalahList.filter((m: any) => Number(m.urutan) <= Number(targetMarhalah.urutan))
  }, [marhalahList, targetMarhalah])

  const labelSourceMarhalah = (m: any) => {
    if (!targetMarhalah) return m.nama
    const diff = Number(m.urutan) - Number(targetMarhalah.urutan)
    if (diff === -1) return `${m.nama} (sebelumnya)`
    if (diff === 0) return `${m.nama} (tinggal kelas)`
    return `${m.nama} (loncat)`
  }

  const handleTampilkan = async () => {
    if (!selectedMarhalah) return toast.warning('Pilih marhalah tujuan terlebih dahulu.')
    setLoading(true)
    setPlacements({})
    setSelected([])
    setBulkKelas('')
    try {
      const [data, kelas] = await Promise.all([
        getPenempatanData(selectedMarhalah, selectedGender, selectedJenjang, {
          sourceMarhalahId: selectedSourceMarhalah || undefined,
          semuaRekomendasiBaru,
        }),
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
        sumber: k.sumber,
      }))
    if (payload.length === 0) return toast.error('Belum ada santri yang ditentukan kelasnya.')
    if (!await confirm(`Masukkan ${payload.length} santri ke draft penempatan? Belum permanen — bisa direview/dibatalkan di tab Review Draft.`)) return

    setSaving(true)
    const t = toast.loading('Menyimpan draft...')
    try {
      const res = await simpanDraftPenempatan(selectedMarhalah, payload)
      toast.dismiss(t)
      if (res?.error) {
        toast.error('Gagal', { description: res.error, duration: 8000 })
      } else {
        toast.success('Masuk draft!', { description: `${res.count} santri masuk draft. Review di tab Review Draft.` })
        await handleTampilkan() // refresh: santri yang sudah masuk draft hilang dari daftar kandidat
        onDraftSaved()
      }
    } catch {
      toast.dismiss(t)
      toast.error('Terjadi kesalahan saat menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
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

        {selectedMarhalah && (
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 pt-1 border-t border-slate-100 mt-1">
            <div className="w-full md:w-72">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asal Kandidat Lama</label>
              <select
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-medium text-sm outline-none"
                value={selectedSourceMarhalah}
                onChange={(e) => setSelectedSourceMarhalah(e.target.value)}
              >
                {sourceMarhalahOptions.map(m => <option key={m.id} value={m.id}>{labelSourceMarhalah(m)}</option>)}
              </select>
              <p className="text-[10px] font-medium text-slate-400 mt-1">Sama dengan tujuan = tinggal kelas. Marhalah lain = loncat kelas.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={semuaRekomendasiBaru}
                onChange={(e) => setSemuaRekomendasiBaru(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Tampilkan santri baru dari rekomendasi marhalah lain juga
            </label>
          </div>
        )}

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
                          <th className="py-2 px-3 text-center">Draft</th>
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
                              <td className="py-2 px-3 text-center font-bold text-amber-600">{k.draft > 0 ? `+${k.draft}` : '-'}</td>
                              <td className="py-2 px-3 text-center font-bold text-indigo-600">{tambah > 0 ? `+${tambah}` : '-'}</td>
                              <td className="py-2 pl-3 text-center font-black text-slate-800">{k.jumlah + k.draft + tambah}</td>
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
                      {groupConsecutiveByAsal(list).map(asalGroup => {
                        const asalIds = asalGroup.items.map(s => s.santri_id)
                        const asalAllSelected = asalIds.every(id => selected.includes(id))
                        return (
                          <React.Fragment key={`${section.key}-${asalGroup.asal}`}>
                            <tr className="bg-slate-50/80">
                              <td colSpan={6} className="px-3 py-1.5">
                                <button
                                  onClick={() => toggleSelectGroup(asalIds)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-indigo-600"
                                >
                                  {asalAllSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5" />}
                                  Pilih semua dari {asalGroup.asal} ({asalGroup.items.length})
                                </button>
                              </td>
                            </tr>
                            {asalGroup.items.map(s => {
                              const isSel = selected.includes(s.santri_id)
                              const placedId = placements[s.santri_id] || ''
                              return (
                                <tr key={s.santri_id} className={`hover:bg-slate-50 ${isSel ? 'bg-indigo-50/40' : ''}`}>
                                  <td className="p-3 text-center cursor-pointer" onClick={() => toggleSelect(s.santri_id)}>
                                    {isSel ? <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto" /> : <Square className="w-5 h-5 text-slate-300 mx-auto" />}
                                  </td>
                                  <td className="p-3 cursor-pointer" onClick={() => toggleSelect(s.santri_id)}>
                                    <p className="font-bold text-slate-800">
                                      {s.nama}
                                      {s.kategori_efektif === 'BARU' && <BadgeSantriBaru />}
                                    </p>
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
                                            {k.nama_kelas}{k.grade ? ` [${k.grade}]` : ''}{cocok ? ' • disarankan' : ''}{k.baru_lama ? ` • untuk: ${k.baru_lama}` : ''}
                                          </option>
                                        )
                                      })}
                                    </select>
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
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
            <span className="font-semibold text-sm">Santri siap masuk draft</span>
          </div>
          <button
            onClick={handleSimpan}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 active:scale-95 disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardList className="w-5 h-5" />}
            Simpan ke Draft
          </button>
        </div>
      )}
    </div>
  )
}

function TabReviewDraft({ onDraftCountChange }: { onDraftCountChange: (n: number) => void }) {
  const confirm = useConfirm()
  const [drafts, setDrafts] = useState<DraftPenempatan[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [statOpen, setStatOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getDraftPenempatan()
      setDrafts(data)
      onDraftCountChange(data.length)
      setSelected(prev => prev.filter(id => data.some(d => d.id === id)))
    } catch {
      toast.error('Gagal memuat draft penempatan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const g: Record<string, DraftPenempatan[]> = {}
    drafts.forEach(d => { (g[d.nama_kelas] ||= []).push(d) })
    return Object.entries(g).sort((a, b) => naturalCompare(a[0], b[0]))
  }, [drafts])

  // Statistik per kelas tujuan: total + breakdown grade A/B/C + jumlah santri baru.
  const statsPerKelas = useMemo(() => {
    return grouped.map(([namaKelas, list]) => {
      const gradeA = list.filter(d => d.grade === 'A').length
      const gradeB = list.filter(d => d.grade === 'B').length
      const gradeC = list.filter(d => d.grade === 'C').length
      const gradeX = list.length - gradeA - gradeB - gradeC
      const santriBaru = list.filter(d => d.kategori_efektif === 'BARU').length
      return { namaKelas, total: list.length, gradeA, gradeB, gradeC, gradeX, santriBaru }
    })
  }, [grouped])

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const selectAll = () => setSelected(drafts.map(d => d.id))
  const clearSelection = () => setSelected([])

  const handleBatalkanSatu = async (d: DraftPenempatan) => {
    if (!await confirm(`Batalkan draft penempatan ${d.nama} ke ${d.nama_kelas}?`)) return
    const res = await hapusDraftItem(d.id)
    if (res?.error) return toast.error('Gagal', { description: res.error })
    toast.success('Draft dibatalkan.')
    await load()
  }

  const handleBatalkanBatch = async () => {
    if (selected.length === 0) return toast.warning('Pilih minimal satu draft untuk dibatalkan.')
    if (!await confirm(`Kembalikan ${selected.length} santri terpilih ke daftar penempatan?`)) return

    setBusy(true)
    const t = toast.loading('Membatalkan draft...')
    try {
      const res = await hapusDraftBatch(selected)
      toast.dismiss(t)
      if (res?.error) {
        toast.error('Gagal', { description: res.error })
      } else {
        toast.success('Draft dibatalkan!', { description: `${res.count} santri dikembalikan ke daftar penempatan.` })
        setSelected([])
        await load()
      }
    } catch {
      toast.dismiss(t)
      toast.error('Terjadi kesalahan saat membatalkan.')
    } finally {
      setBusy(false)
    }
  }

  const handleExportExcel = () => {
    if (drafts.length === 0) return toast.warning('Tidak ada draft untuk diexport.')
    const data = drafts.map((d, index) => ({
      'No': index + 1,
      'Nama Santri': d.nama,
      'NIS': d.nis,
      'Kelas Asal': d.asal,
      'Kelas Tujuan': d.nama_kelas,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Draft Penempatan')
    XLSX.writeFile(wb, 'draft_penempatan.xlsx')
  }

  const handleFinalisasi = async () => {
    if (selected.length === 0) return toast.warning('Pilih minimal satu draft untuk difinalisasi.')
    if (!await confirm(`Finalisasi ${selected.length} santri ke kelas tujuan? Setelah ini penempatan PERMANEN dan tidak bisa dibatalkan dari sini.`)) return

    setBusy(true)
    const t = toast.loading('Memfinalisasi penempatan...')
    try {
      const res = await finalisasiDraft(selected)
      toast.dismiss(t)
      if (res?.error) {
        toast.error('Gagal', { description: res.error, duration: 8000 })
      } else {
        toast.success('Penempatan permanen!', { description: `${res.count} santri berhasil ditempatkan.` })
        setSelected([])
        await load()
      }
    } catch {
      toast.dismiss(t)
      toast.error('Terjadi kesalahan saat finalisasi.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
        <p className="font-medium">Memuat draft penempatan...</p>
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-500">Belum ada draft penempatan</h3>
        <p className="text-sm text-slate-400 mt-1">Tempatkan santri di tab Penempatan — hasilnya akan muncul di sini untuk direview.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end mb-1">
        <button
          onClick={handleExportExcel}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm inline-flex items-center gap-2 transition-all active:scale-95"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setStatOpen(o => !o)}
          className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-50"
        >
          <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-sm font-bold text-slate-700">Statistik Draft</span>
          <span className="text-xs text-slate-400 hidden sm:inline">— per kelas tujuan, breakdown grade A/B/C</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${statOpen ? 'rotate-180' : ''}`} />
        </button>
        {statOpen && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 font-bold uppercase text-[11px] border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3">Kelas Tujuan</th>
                  <th className="py-2 px-3 text-center">Grade A</th>
                  <th className="py-2 px-3 text-center">Grade B</th>
                  <th className="py-2 px-3 text-center">Grade C</th>
                  <th className="py-2 px-3 text-center">Belum Ada Grade</th>
                  <th className="py-2 px-3 text-center">Santri Baru</th>
                  <th className="py-2 pl-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {statsPerKelas.map(s => (
                  <tr key={s.namaKelas}>
                    <td className="py-2 pr-3 font-bold text-slate-800">{s.namaKelas}</td>
                    <td className="py-2 px-3 text-center font-semibold text-green-700">{s.gradeA || '-'}</td>
                    <td className="py-2 px-3 text-center font-semibold text-blue-700">{s.gradeB || '-'}</td>
                    <td className="py-2 px-3 text-center font-semibold text-orange-700">{s.gradeC || '-'}</td>
                    <td className="py-2 px-3 text-center font-semibold text-slate-400">{s.gradeX || '-'}</td>
                    <td className="py-2 px-3 text-center font-semibold text-indigo-600">{s.santriBaru || '-'}</td>
                    <td className="py-2 pl-3 text-center font-black text-slate-800">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-indigo-50/60 p-4 border border-indigo-100 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-2 z-20 backdrop-blur">
        <div>
          <h3 className="font-bold text-indigo-900">{drafts.length} santri dalam draft, {selected.length} dipilih</h3>
          <p className="text-xs text-indigo-700/70 font-medium mt-0.5">Review dulu sebelum finalisasi — draft belum mengubah kelas santri.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 lg:mt-0">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <button onClick={selectAll} className="text-xs font-bold text-indigo-700 hover:underline px-2">Pilih Semua</button>
            <button onClick={clearSelection} className="text-xs font-bold text-slate-500 hover:underline px-2">Kosongkan</button>
          </div>
          <button
            onClick={handleBatalkanBatch}
            disabled={busy || selected.length === 0}
            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm transition-colors"
          >
            <X className="w-4 h-4" />
            Batalkan Terpilih
          </button>
          <button
            onClick={handleFinalisasi}
            disabled={busy || selected.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
            Finalisasi Terpilih
          </button>
        </div>
      </div>

      {grouped.map(([namaKelas, list]) => (
        <div key={namaKelas} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-700">{namaKelas}</span>
              <span className="text-xs font-bold text-slate-400">{list.length} santri (draft)</span>
            </div>
            
            <button
              onClick={() => {
                const ids = list.map(d => d.id)
                const allSelected = ids.every(id => selected.includes(id))
                setSelected(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])))
              }}
              className="sm:ml-auto text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1.5"
            >
              {list.every(d => selected.includes(d.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              Pilih Semua Kelas Ini
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Nama & NIS</th>
                  <th className="p-3 text-center">Sumber</th>
                  <th className="p-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(d => {
                  const isSel = selected.includes(d.id)
                  return (
                    <tr key={d.id} className={`hover:bg-slate-50 ${isSel ? 'bg-indigo-50/40' : ''}`}>
                      <td className="p-3 text-center cursor-pointer" onClick={() => toggleSelect(d.id)}>
                        {isSel ? <CheckSquare className="w-5 h-5 text-indigo-600 mx-auto" /> : <Square className="w-5 h-5 text-slate-300 mx-auto" />}
                      </td>
                      <td className="p-3 cursor-pointer" onClick={() => toggleSelect(d.id)}>
                        <p className="font-bold text-slate-800">
                          {d.nama}
                          {d.kategori_efektif === 'BARU' && <BadgeSantriBaru />}
                        </p>
                        <p className="text-slate-500 font-mono text-xs">{d.nis}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${d.sumber === 'baru' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                          {d.sumber === 'baru' ? 'Baru' : 'Naik'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleBatalkanSatu(d)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                        >
                          <X className="w-3.5 h-3.5" /> Batalkan
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
