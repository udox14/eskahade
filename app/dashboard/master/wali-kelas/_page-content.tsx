'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { getJadwalFilterOptions, getKelasJadwalByMarhalah, importGuruMassal, tambahGuruManual, hapusGuru, hapusGuruMassal, simpanJadwalBatch } from './actions'
import { UserCheck, Save, Loader2, School, Search, Upload, Download, List, Plus, Trash2, CheckSquare, Square, Printer, Filter, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import Link from 'next/link'

type SessionKey = 's' | 'a' | 'm'
type WeeklySessionKey = 'shubuh' | 'ashar' | 'maghrib'
type WeeklyMap = Record<WeeklySessionKey, Record<number, string>>
type GabunganMap = Record<WeeklySessionKey, { groupKey: string; tempat: string }>

const HARI_LIST = [
  { index: 1, label: 'Senin' },
  { index: 2, label: 'Selasa' },
  { index: 3, label: 'Rabu' },
  { index: 4, label: 'Kamis' },
  { index: 5, label: 'Jumat' },
  { index: 6, label: 'Sabtu' },
  { index: 0, label: 'Ahad' },
] as const

const SESSION_META: { key: SessionKey; serverKey: WeeklySessionKey; label: string }[] = [
  { key: 's', serverKey: 'shubuh', label: 'Shubuh' },
  { key: 'a', serverKey: 'ashar', label: 'Ashar' },
  { key: 'm', serverKey: 'maghrib', label: 'Maghrib' },
]

function isStructuralLibur(hariIndex: number, session: WeeklySessionKey) {
  if (hariIndex === 2 && session === 'maghrib') return true
  if (hariIndex === 4 && session === 'maghrib') return true
  if (hariIndex === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

function makeEmptyWeeklyMap(): WeeklyMap {
  return {
    shubuh: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    ashar: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    maghrib: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  }
}

function makeEmptyGabunganMap(): GabunganMap {
  return {
    shubuh: { groupKey: '', tempat: '' },
    ashar: { groupKey: '', tempat: '' },
    maghrib: { groupKey: '', tempat: '' },
  }
}

function buildRuleSignature(weekly: WeeklyMap) {
  return SESSION_META.flatMap(session =>
    HARI_LIST
      .map(day => {
        const value = weekly[session.serverKey]?.[day.index] || ''
        return value ? `${session.serverKey}|${day.index}|${value}` : ''
      })
      .filter(Boolean)
  ).join('||')
}

function buildGabunganSignature(gabungan: GabunganMap) {
  return SESSION_META
    .map(session => {
      const item = gabungan[session.serverKey]
      return `${session.serverKey}|${String(item?.groupKey || '').trim()}|${String(item?.tempat || '').trim()}`
    })
    .join('||')
}

export default function ManajemenGuruPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'JADWAL' | 'MASTER'>('JADWAL')

  const [kelasList, setKelasList] = useState<any[]>([])
  const [localKelasList, setLocalKelasList] = useState<any[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [waliUserList, setWaliUserList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [jadwalLoaded, setJadwalLoaded] = useState(false)

  const [guruList, setGuruList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedGuruIds, setSelectedGuruIds] = useState<string[]>([])
  const [guruSearch, setGuruSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [newGuru, setNewGuru] = useState({ nama: '', gelar: '', kode: '' })
  const [search, setSearch] = useState('')

  useEffect(() => { loadInitialData() }, [])

  const loadInitialData = async () => {
    setLoading(true)
    const res = await getJadwalFilterOptions()
    setGuruList(res.guruList)
    setMarhalahList(res.marhalahList)
    setWaliUserList(res.waliUserList || [])
    setSelectedGuruIds([])
    setLoading(false)
  }

  const loadKelasByFilter = async (marhalahId: string) => {
    setLoading(true)
    const kelas = await getKelasJadwalByMarhalah(marhalahId)
    setKelasList(kelas)
    const mappedLocal = kelas.map((k: any) => {
      const weekly = makeEmptyWeeklyMap()
      const gabungan = makeEmptyGabunganMap()
      ;(k.weekly_rules || []).forEach((rule: any) => {
        if (weekly[rule.sesi as WeeklySessionKey]) {
          weekly[rule.sesi as WeeklySessionKey][Number(rule.hari_index)] = String(rule.guru_id)
        }
      })
      SESSION_META.forEach(session => {
        const item = k.gabungan?.[session.serverKey]
        if (item) {
          gabungan[session.serverKey] = {
            groupKey: item.group_key || '',
            tempat: item.tempat || '',
          }
        }
      })

      return {
        id: k.id,
        nama_kelas: k.nama_kelas,
        marhalah_nama: k.marhalah_nama,
        wali_kelas_id: k.wali_kelas_id || '',
        s: k.guru_shubuh_id?.toString() || '',
        a: k.guru_ashar_id?.toString() || '',
        m: k.guru_maghrib_id?.toString() || '',
        weekly,
        gabungan,
      }
    })
    setLocalKelasList(mappedLocal)
    setJadwalLoaded(true)
    setLoading(false)
  }

  const handleChangeLocal = (kelasId: string, field: SessionKey | 'wali_kelas_id', value: string) => {
    setLocalKelasList(prev => prev.map(k => k.id === kelasId ? { ...k, [field]: value } : k))
  }

  const handleChangeWeekly = (kelasId: string, session: WeeklySessionKey, hariIndex: number, guruId: string) => {
    setLocalKelasList(prev => prev.map(k => {
      if (k.id !== kelasId) return k
      return {
        ...k,
        weekly: {
          ...k.weekly,
          [session]: {
            ...k.weekly[session],
            [hariIndex]: guruId,
          },
        },
      }
    }))
  }

  const handleChangeGabungan = (kelasId: string, session: WeeklySessionKey, field: 'groupKey' | 'tempat', value: string) => {
    setLocalKelasList(prev => prev.map(k => {
      if (k.id !== kelasId) return k
      return {
        ...k,
        gabungan: {
          ...k.gabungan,
          [session]: {
            ...(k.gabungan?.[session] || { groupKey: '', tempat: '' }),
            [field]: value,
          },
        },
      }
    }))
  }

  const handleSimpanSemua = async () => {
    const changedClasses = localKelasList.filter(local => {
      const asli = kelasList.find((k: any) => k.id === local.id)
      if (!asli) return false

      const asliWeekly = makeEmptyWeeklyMap()
      const asliGabungan = makeEmptyGabunganMap()
      ;(asli.weekly_rules || []).forEach((rule: any) => {
        if (asliWeekly[rule.sesi as WeeklySessionKey]) {
          asliWeekly[rule.sesi as WeeklySessionKey][Number(rule.hari_index)] = String(rule.guru_id)
        }
      })
      SESSION_META.forEach(session => {
        const item = asli.gabungan?.[session.serverKey]
        if (item) {
          asliGabungan[session.serverKey] = {
            groupKey: item.group_key || '',
            tempat: item.tempat || '',
          }
        }
      })

      return (
        (asli.guru_shubuh_id?.toString() || '') !== local.s ||
        (asli.guru_ashar_id?.toString() || '') !== local.a ||
        (asli.guru_maghrib_id?.toString() || '') !== local.m ||
        (asli.wali_kelas_id || '') !== local.wali_kelas_id ||
        buildRuleSignature(asliWeekly) !== buildRuleSignature(local.weekly) ||
        buildGabunganSignature(asliGabungan) !== buildGabunganSignature(local.gabungan)
      )
    })

    if (changedClasses.length === 0) {
      toast.info('Tidak ada perubahan', { description: 'Jadwal, wali kelas, dan pembagian harian belum ada yang diubah.' })
      return
    }

    if (!await confirm(`Terdapat ${changedClasses.length} perubahan jadwal. Simpan sekarang?`)) return
    setIsSavingBatch(true)
    const toastId = toast.loading(`Menyimpan ${changedClasses.length} jadwal...`)

    const payload = changedClasses.map(k => ({
      kelasId: k.id,
      waliKelasId: k.wali_kelas_id || null,
      shubuhId: Number(k.s) || null,
      asharId: Number(k.a) || null,
      maghribId: Number(k.m) || null,
      weeklyRules: SESSION_META.flatMap(session =>
        HARI_LIST.map(day => ({
          sesi: session.serverKey,
          hariIndex: day.index,
          guruId: Number(k.weekly[session.serverKey]?.[day.index] || 0) || null,
        }))
      ),
      gabungan: SESSION_META.reduce((acc: any, session) => {
        acc[session.serverKey] = {
          groupKey: k.gabungan?.[session.serverKey]?.groupKey || null,
          tempat: k.gabungan?.[session.serverKey]?.tempat || null,
        }
        return acc
      }, {}),
    }))

    const res = await simpanJadwalBatch(payload as any)
    setIsSavingBatch(false)
    toast.dismiss(toastId)
    if ('error' in res) toast.error('Gagal', { description: (res as any).error })
    else {
      toast.success('Berhasil!', { description: `${(res as any).count} kelas telah diperbarui.` })
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    }
  }

  const handleTambahGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGuru.nama) return toast.warning('Nama wajib diisi')
    const toastId = toast.loading('Menambahkan...')
    const res = await tambahGuruManual(newGuru.nama, newGuru.gelar, newGuru.kode)
    toast.dismiss(toastId)
    if ((res as any).success) {
      toast.success('Guru ditambahkan')
      setNewGuru({ nama: '', gelar: '', kode: '' })
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error((res as any).error)
  }

  const handleHapusGuru = async (id: string, nama: string) => {
    if (!await confirm(`Hapus guru ${nama}? Pastikan tidak sedang mengajar.`)) return
    const res = await hapusGuru(id as any)
    if ((res as any).success) {
      toast.success('Guru dihapus')
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error((res as any).error)
  }

  const toggleSelectGuru = (id: string) => {
    setSelectedGuruIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const toggleSelectAllGuru = () => {
    if (selectedGuruIds.length === guruList.length) setSelectedGuruIds([])
    else setSelectedGuruIds(guruList.map(g => g.id))
  }

  const handleHapusBatch = async () => {
    if (selectedGuruIds.length === 0) return
    if (!await confirm(`Yakin ingin menghapus ${selectedGuruIds.length} guru yang dipilih? Pastikan mereka tidak sedang terpasang di jadwal!`)) return
    setIsDeletingBatch(true)
    const toastId = toast.loading('Menghapus data...')
    const res = await hapusGuruMassal(selectedGuruIds as any)
    setIsDeletingBatch(false)
    toast.dismiss(toastId)
    if ((res as any).success) {
      toast.success('Berhasil', { description: `${(res as any).count} guru dihapus.` })
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error('Gagal Menghapus', { description: (res as any).error })
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { 'NAMA LENGKAP': 'Ahmad Fulan', 'GELAR': 'S.Pd.I', 'KODE': 'AHM' },
      { 'NAMA LENGKAP': 'Budi Santoso', 'GELAR': 'M.Ag', 'KODE': 'BUD' },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
    XLSX.writeFile(wb, 'Template_Guru.xlsx')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      setExcelData(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris terbaca`)
    } catch {
      toast.error('Gagal baca file')
    }
  }

  const handleSimpanGuru = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading('Mengimport data guru...')
    const res = await importGuruMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if ('error' in res) toast.error('Gagal import', { description: (res as any).error })
    else {
      const skippedMsg = ((res as any).skipped ?? 0) > 0 ? ` (${(res as any).skipped} duplikat dilewati)` : ''
      toast.success(`Berhasil import ${(res as any).count} guru${skippedMsg}`)
      setExcelData([])
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
      setTab('JADWAL')
    }
  }

  const filteredLocalKelas = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return localKelasList
    return localKelasList.filter(k =>
      String(k.nama_kelas || '').toLowerCase().includes(q) ||
      String(k.marhalah_nama || '').toLowerCase().includes(q)
    )
  }, [localKelasList, search])

  const filteredForDropdown = useMemo(() => guruSearch
    ? guruList.filter(g => g.nama_lengkap.toLowerCase().includes(guruSearch.toLowerCase()))
    : guruList, [guruList, guruSearch])

  const { paged: pagedGuruList, totalPages: totalPagesGuruList, safePage: safePageGuruList } = usePagination(guruList, pageSize, page)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Manajemen Guru & Jadwal"
          description="Atur guru default, pembagian harian mingguan, dan wali kelas manual."
          action={(
            <Link
              href="/dashboard/master/wali-kelas/cetak"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Cetak Tugas Mengajar
            </Link>
          )}
          className="flex-1"
        />
        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
          <button onClick={() => setTab('JADWAL')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'JADWAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <School className="w-4 h-4" /> Jadwal Kelas
          </button>
          <button onClick={() => setTab('MASTER')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${tab === 'MASTER' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <UserCheck className="w-4 h-4" /> Master Guru
          </button>
        </div>
      </div>

      {tab === 'JADWAL' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={selectedMarhalah}
                  onChange={async (e) => {
                    const value = e.target.value
                    setSelectedMarhalah(value)
                    setSearch('')
                    setJadwalLoaded(false)
                    setKelasList([])
                    setLocalKelasList([])
                    if (!value) return
                    await loadKelasByFilter(value)
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                >
                  <option value="">Pilih tingkat / marhalah...</option>
                  <option value="SEMUA">Tampilkan semua</option>
                  {marhalahList.map((m: any) => <option key={m.id} value={String(m.id)}>{m.nama}</option>)}
                </select>
              </div>
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input disabled={!jadwalLoaded} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400" placeholder="Cari kelas..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input disabled={!jadwalLoaded} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-400" placeholder="Cari guru di dropdown..." value={guruSearch} onChange={e => setGuruSearch(e.target.value)} />
              </div>
            </div>
            <button onClick={handleSimpanSemua} disabled={isSavingBatch || loading || !jadwalLoaded} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {isSavingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              SIMPAN JADWAL
            </button>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <CalendarDays className="w-4 h-4" />
              Pembagian Harian Mingguan
            </div>
            <p className="mt-1 text-xs text-slate-600">Kolom default tetap menjadi fallback. Jika sel harian dikosongkan, kelas akan otomatis memakai guru default sesi tersebut.</p>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="bg-white border rounded-xl shadow-sm py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
            ) : !jadwalLoaded ? (
              <div className="bg-white border rounded-xl shadow-sm py-20 text-center text-slate-400">
                <div className="space-y-2">
                  <p className="font-semibold text-slate-500">Pilih tingkat / marhalah dulu</p>
                  <p className="text-sm">Konten jadwal kelas akan dimuat setelah filter dipilih.</p>
                </div>
              </div>
            ) : filteredLocalKelas.length === 0 ? (
              <div className="bg-white border rounded-xl shadow-sm py-20 text-center text-slate-400">
                <div className="space-y-2">
                  <p className="font-semibold text-slate-500">Tidak ada kelas</p>
                  <p className="text-sm">Coba pilih filter lain atau gunakan opsi tampilkan semua.</p>
                </div>
              </div>
            ) : filteredLocalKelas.map(k => (
              <div key={k.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-bold text-slate-800">{k.nama_kelas}</p>
                  <p className="text-xs text-slate-500">{k.marhalah_nama || 'Tanpa tingkat'}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Wali Kelas</label>
                    <select value={k.wali_kelas_id} onChange={e => handleChangeLocal(k.id, 'wali_kelas_id', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">- Belum diatur -</option>
                      {waliUserList.map((user: any) => <option key={user.id} value={user.id}>{user.full_name || '(Tanpa nama)'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Default Shubuh</label>
                    <select value={k.s} onChange={e => handleChangeLocal(k.id, 's', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">- Kosong -</option>
                      {filteredForDropdown.map((g: any) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Default Ashar</label>
                    <select value={k.a} onChange={e => handleChangeLocal(k.id, 'a', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">- Kosong -</option>
                      {filteredForDropdown.map((g: any) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Default Maghrib</label>
                    <select value={k.m} onChange={e => handleChangeLocal(k.id, 'm', e.target.value)} className="w-full rounded-xl border border-yellow-300 bg-yellow-50/40 px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-yellow-500 outline-none">
                      <option value="">- Kosong -</option>
                      {filteredForDropdown.map((g: any) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 px-4 py-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-slate-700">Kelas Gabungan per Sesi</p>
                    <p className="text-xs text-slate-500">Isi kode yang sama pada beberapa kelas jika kelas itu digabung pada sesi tertentu. Jadwal gabungan mengikuti kelas pertama dalam kelompok.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {SESSION_META.map(session => (
                      <div key={session.serverKey} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{session.label}</div>
                        <input
                          value={k.gabungan?.[session.serverKey]?.groupKey || ''}
                          onChange={e => handleChangeGabungan(k.id, session.serverKey, 'groupKey', e.target.value)}
                          placeholder="Kode gabungan"
                          className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          value={k.gabungan?.[session.serverKey]?.tempat || ''}
                          onChange={e => handleChangeGabungan(k.id, session.serverKey, 'tempat', e.target.value)}
                          placeholder="Tempat"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 px-4 py-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-slate-700">Override Harian</p>
                    <p className="text-xs text-slate-500">Kosongkan sel untuk memakai guru default sesi. Sel abu-abu berarti sesi itu memang libur pengajian.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Sesi</th>
                          {HARI_LIST.map(day => (
                            <th key={day.index} className="border-b border-slate-200 px-2 py-2 text-center text-xs font-bold uppercase text-slate-500">{day.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SESSION_META.map(session => (
                          <tr key={session.serverKey}>
                            <td className="sticky left-0 z-10 bg-white border-b border-slate-100 px-3 py-3 text-sm font-bold text-slate-700">{session.label}</td>
                            {HARI_LIST.map(day => {
                              const disabled = isStructuralLibur(day.index, session.serverKey)
                              return (
                                <td key={`${session.serverKey}-${day.index}`} className="border-b border-slate-100 px-2 py-2">
                                  <select
                                    disabled={disabled}
                                    value={k.weekly[session.serverKey]?.[day.index] || ''}
                                    onChange={e => handleChangeWeekly(k.id, session.serverKey, day.index, e.target.value)}
                                    className={`w-full rounded-lg border px-2 py-2 text-xs outline-none focus:ring-2 ${
                                      disabled
                                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                        : 'border-slate-200 bg-white focus:ring-indigo-500'
                                    }`}
                                  >
                                    <option value="">{disabled ? 'Libur' : 'Gunakan default'}</option>
                                    {!disabled && filteredForDropdown.map((g: any) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                                  </select>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'MASTER' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Plus className="w-5 h-5 text-green-600" /> Tambah Guru Baru (Manual)
            </h3>
            <form onSubmit={handleTambahGuru} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nama Lengkap</label>
                <input value={newGuru.nama} onChange={e => setNewGuru({ ...newGuru, nama: e.target.value })} className="w-full p-2 border rounded" placeholder="Contoh: Ahmad" required />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Gelar (Opsional)</label>
                <input value={newGuru.gelar} onChange={e => setNewGuru({ ...newGuru, gelar: e.target.value })} className="w-full p-2 border rounded" placeholder="S.Pd." />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kode (Opsional)</label>
                <input value={newGuru.kode} onChange={e => setNewGuru({ ...newGuru, kode: e.target.value })} className="w-full p-2 border rounded" placeholder="AHM" />
              </div>
              <button className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 w-full md:w-auto">Simpan</button>
            </form>
          </div>

          <hr className="border-dashed" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center space-y-3">
              <Download className="w-8 h-8 text-blue-600" />
              <h3 className="font-bold text-blue-900">1. Template Data Guru</h3>
              <button onClick={handleDownloadTemplate} className="bg-white text-blue-700 px-4 py-2 rounded shadow-sm font-bold text-xs border hover:bg-blue-50">Download .xlsx</button>
            </div>
            <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col items-center text-center space-y-3">
              <Upload className="w-8 h-8 text-green-600" />
              <h3 className="font-bold text-green-900">2. Upload Excel</h3>
              <div className="relative">
                <input type="file" accept=".xlsx" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <button className="bg-green-600 text-white px-4 py-2 rounded shadow-sm font-bold text-xs hover:bg-green-700">Pilih File</button>
              </div>
            </div>
          </div>

          {excelData.length > 0 && (() => {
            const previewRows = excelData.map(d => {
              const nama = String(d['NAMA LENGKAP'] || d['NAMA'] || d['nama'] || '').trim()
              const isDuplikat = guruList.some(g => g.nama_lengkap.toLowerCase() === nama.toLowerCase())
              return { nama, gelar: d['GELAR'] || d['gelar'] || '-', isDuplikat }
            })
            const dupCount = previewRows.filter(r => r.isDuplikat).length
            const newCount = previewRows.length - dupCount
            return (
              <div className="bg-white border rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><List className="w-4 h-4" /> Preview ({excelData.length} baris)</h3>
                    <p className="text-xs mt-0.5">
                      <span className="text-green-600 font-bold">{newCount} baru</span>
                      {dupCount > 0 && <span className="text-red-500 font-bold ml-2">{dupCount} duplikat (dilewati)</span>}
                    </p>
                  </div>
                  <button onClick={handleSimpanGuru} disabled={isProcessing || newCount === 0} className="bg-green-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-800 disabled:opacity-50">
                    {isProcessing ? 'Menyimpan...' : `Simpan ${newCount} Guru Baru`}
                  </button>
                </div>
                <div className="max-h-64 overflow-auto border rounded">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr><th className="p-2">Nama</th><th className="p-2">Gelar</th><th className="p-2 text-center">Status</th></tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className={`border-b ${r.isDuplikat ? 'bg-red-50' : ''}`}>
                          <td className={`p-2 font-medium ${r.isDuplikat ? 'text-red-400 line-through' : 'text-slate-800'}`}>{r.nama}</td>
                          <td className="p-2 text-slate-500">{r.gelar}</td>
                          <td className="p-2 text-center">
                            {r.isDuplikat
                              ? <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Duplikat</span>
                              : <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Baru</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-700">Daftar Guru Terdaftar ({guruList.length})</h3>
                <p className="text-xs text-slate-500">Pilih kotak centang untuk menghapus banyak data sekaligus.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAllGuru} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition">
                  {selectedGuruIds.length === guruList.length && guruList.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  Pilih Semua
                </button>
                {selectedGuruIds.length > 0 && (
                  <button onClick={handleHapusBatch} disabled={isDeletingBatch} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-700 disabled:opacity-50 shadow-sm">
                    {isDeletingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Hapus Terpilih ({selectedGuruIds.length})
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pagedGuruList.map(g => (
                <div key={g.id} onClick={() => toggleSelectGuru(g.id)}
                  className={`p-3 border border-slate-200 rounded-xl flex justify-between items-center cursor-pointer transition-all ${selectedGuruIds.includes(g.id) ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-slate-50 hover:bg-white hover:shadow-sm'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    {selectedGuruIds.includes(g.id) ? <CheckSquare className="w-5 h-5 text-red-500 flex-shrink-0" /> : <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                    <div className="truncate">
                      <p className={`font-bold text-sm truncate ${selectedGuruIds.includes(g.id) ? 'text-red-700' : 'text-slate-800'}`}>{g.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{g.gelar || '-'}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleHapusGuru(g.id, g.nama_lengkap) }} className="text-slate-300 hover:text-red-500 p-2 transition-opacity" title="Hapus Guru Ini">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={safePageGuruList}
              totalPages={totalPagesGuruList}
              pageSize={pageSize}
              total={guruList.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
