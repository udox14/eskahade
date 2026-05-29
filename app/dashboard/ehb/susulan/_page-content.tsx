'use client'

import { useState, useEffect } from 'react'
import { getActiveEventLight, getSusulanList, markSusulanDone } from './actions'
import { 
  CheckCircle2, AlertTriangle, Loader2, Search, CheckSquare, ClipboardList, BarChart3, BookOpen
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { shortDateWib } from '../_date-utils'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function SusulanEhbPage() {
  const confirm = useConfirm()
  const [event, setEvent] = useState<{ id: number, nama: string } | null>(null)
  const [susulanList, setSusulanList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<'daftar' | 'rekap'>('daftar')

  // Multi-select for bulk action
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    if (evt) {
      const list = await getSusulanList(evt.id)
      setSusulanList(list)
    }
    setLoading(false)
    setSelectedIds([])
  }

  const handleMarkDone = async (id: number) => {
    if (!await confirm('Tandai santri ini sudah menyelesaikan susulan?')) return
    const res = await markSusulanDone([id])
    if (res.error) return toast.error(res.error)
    toast.success('Berhasil ditandai selesai')
    loadData()
  }

  const handleBulkMarkDone = async () => {
    if (selectedIds.length === 0) return
    if (!await confirm(`Tandai ${selectedIds.length} santri terpilih sudah menyelesaikan susulan?`)) return
    const res = await markSusulanDone(selectedIds)
    if (res.error) return toast.error(res.error)
    toast.success(`${selectedIds.length} jadwal susulan ditandai selesai`)
    loadData()
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const filteredList = susulanList.filter(s => 
    s.nama_lengkap.toLowerCase().includes(keyword.toLowerCase()) || 
    s.nama_kelas.toLowerCase().includes(keyword.toLowerCase()) ||
    s.mapel_nama.toLowerCase().includes(keyword.toLowerCase()) ||
    (s.marhalah_nama || '').toLowerCase().includes(keyword.toLowerCase()) ||
    (s.nama_kitab || '').toLowerCase().includes(keyword.toLowerCase())
  )

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  if (!event) return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" /> Belum ada event EHB yang aktif.
      </div>
    </div>
  )

  const pendingCount = susulanList.filter(s => s.is_susulan_done === 0).length
  const rekapGroups = buildRekapGroups(susulanList)
  const filteredRekapGroups = rekapGroups
    .map(group => {
      const q = keyword.toLowerCase()
      const items = group.items.filter(item => (
        group.marhalahNama.toLowerCase().includes(q) ||
        item.mapelNama.toLowerCase().includes(q) ||
        item.namaKitab.toLowerCase().includes(q)
      ))
      return { ...group, items }
    })
    .filter(group => group.items.length > 0)
  const totalMapelRekap = rekapGroups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <DashboardPageHeader
        title="Daftar Susulan EHB"
        description="Daftar santri yang tidak hadir ujian dan belum menyelesaikan susulan."
        className="border-b pb-4"
      />

      <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
        <button
          onClick={() => setActiveTab('daftar')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition sm:flex-none ${activeTab === 'daftar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardList className="h-4 w-4" /> Daftar Susulan
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition sm:flex-none ${activeTab === 'rekap' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BarChart3 className="h-4 w-4" /> Rekap Soal
        </button>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={activeTab === 'daftar' ? 'Cari santri, kelas, mapel...' : 'Cari marhalah, mapel, kitab...'} 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4"/> {pendingCount} Tunggakan
            </div>
            {activeTab === 'rekap' && (
              <div className="hidden bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg text-sm font-bold sm:flex items-center gap-2">
                <BookOpen className="w-4 h-4"/> {totalMapelRekap} Mapel
              </div>
            )}
            {activeTab === 'daftar' && selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkMarkDone}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all"
                >
                    <CheckSquare className="w-4 h-4"/> Tandai {selectedIds.length} Selesai
                </button>
            )}
          </div>
        </div>

        {activeTab === 'daftar' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold w-10 text-center">
                    <input 
                        type="checkbox" 
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredList.filter(f => f.is_susulan_done === 0).length}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setSelectedIds(filteredList.filter(f => f.is_susulan_done === 0).map(f => f.absensi_id))
                            } else {
                                setSelectedIds([])
                            }
                        }}
                    />
                </th>
                <th className="px-4 py-3 font-bold">Nama Santri</th>
                <th className="px-4 py-3 font-bold">Jadwal Asli</th>
                <th className="px-4 py-3 font-bold">Mata Pelajaran</th>
                <th className="px-4 py-3 font-bold text-center">Status Absen</th>
                <th className="px-4 py-3 font-bold text-center">Status Susulan</th>
                <th className="px-4 py-3 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">Tidak ada data susulan</td>
                </tr>
              ) : filteredList.map(s => {
                const isDone = s.is_susulan_done === 1
                return (
                  <tr key={s.absensi_id} className={`hover:bg-slate-50 ${isDone ? 'bg-slate-50 opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-center">
                        {!isDone && (
                            <input 
                                type="checkbox" 
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                checked={selectedIds.includes(s.absensi_id)}
                                onChange={() => toggleSelect(s.absensi_id)}
                            />
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{s.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{s.nis} • <span className="font-semibold">{s.nama_kelas}</span></p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 font-medium">{shortDateWib(s.tanggal)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{s.mapel_nama}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        s.status_absen === 'S' ? 'bg-amber-100 text-amber-700' :
                        s.status_absen === 'I' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {s.status_absen === 'S' ? 'Sakit' : s.status_absen === 'I' ? 'Izin' : 'Alpha'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isDone ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs font-medium bg-slate-100 px-2 py-1 rounded-full">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isDone && (
                        <button 
                          onClick={() => handleMarkDone(s.absensi_id)}
                          className="bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="divide-y">
            {filteredRekapGroups.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-400">Tidak ada data rekap susulan</div>
            ) : filteredRekapGroups.map(group => {
              return (
                <section key={group.key} className="p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-bold text-slate-900">{group.marhalahNama}</h2>
                      <p className="text-xs text-slate-500">{group.pendingTotal} lembar perlu disiapkan dari {group.total} total data susulan</p>
                    </div>
                    <div className="w-fit rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">
                      {group.items.length} mapel
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-bold">Mata Pelajaran</th>
                          <th className="px-4 py-3 font-bold">Nama Kitab</th>
                          <th className="px-4 py-3 text-center font-bold">Perlu Lembar</th>
                          <th className="px-4 py-3 text-center font-bold">Total Susulan</th>
                          <th className="px-4 py-3 text-center font-bold">Selesai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.items.map(item => (
                          <tr key={item.key} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{item.mapelNama}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{item.namaKitab}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex min-w-12 justify-center rounded-lg bg-amber-100 px-3 py-1 font-black text-amber-800">
                                {item.pending}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{item.total}</td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-700">{item.done}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function buildRekapGroups(list: any[]) {
  const groupMap = new Map<string, {
    key: string
    marhalahNama: string
    marhalahUrutan: number
    total: number
    pendingTotal: number
    itemsMap: Map<string, {
      key: string
      mapelNama: string
      namaKitab: string
      total: number
      pending: number
      done: number
    }>
  }>()

  for (const row of list) {
    const marhalahNama = row.marhalah_nama || 'Tanpa Marhalah'
    const marhalahKey = String(row.marhalah_id || marhalahNama)
    const mapelKey = String(row.mapel_id || row.mapel_nama)
    const isDone = row.is_susulan_done === 1

    if (!groupMap.has(marhalahKey)) {
      groupMap.set(marhalahKey, {
        key: marhalahKey,
        marhalahNama,
        marhalahUrutan: Number(row.marhalah_urutan ?? 999999),
        total: 0,
        pendingTotal: 0,
        itemsMap: new Map(),
      })
    }

    const group = groupMap.get(marhalahKey)!
    group.total += 1
    if (!isDone) group.pendingTotal += 1

    if (!group.itemsMap.has(mapelKey)) {
      group.itemsMap.set(mapelKey, {
        key: mapelKey,
        mapelNama: row.mapel_nama || '-',
        namaKitab: row.nama_kitab || '-',
        total: 0,
        pending: 0,
        done: 0,
      })
    }

    const item = group.itemsMap.get(mapelKey)!
    item.total += 1
    if (isDone) item.done += 1
    else item.pending += 1
  }

  return Array.from(groupMap.values())
    .sort((a, b) => a.marhalahUrutan - b.marhalahUrutan || a.marhalahNama.localeCompare(b.marhalahNama))
    .map(group => ({
      key: group.key,
      marhalahNama: group.marhalahNama,
      total: group.total,
      pendingTotal: group.pendingTotal,
      items: Array.from(group.itemsMap.values()).sort((a, b) => a.mapelNama.localeCompare(b.mapelNama)),
    }))
}
