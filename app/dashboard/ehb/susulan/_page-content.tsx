'use client'

import { useState, useEffect } from 'react'
import { getActiveEventLight, getSusulanList, markSusulanDone } from './actions'
import { 
  ClipboardList, CheckCircle2, AlertTriangle, Loader2, Search, CheckSquare
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
    s.mapel_nama.toLowerCase().includes(keyword.toLowerCase())
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

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <DashboardPageHeader
        title="Daftar Susulan EHB"
        description="Daftar santri yang tidak hadir ujian dan belum menyelesaikan susulan."
        className="border-b pb-4"
      />

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari santri, kelas, mapel..." 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4"/> {pendingCount} Tunggakan
            </div>
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkMarkDone}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all"
                >
                    <CheckSquare className="w-4 h-4"/> Tandai {selectedIds.length} Selesai
                </button>
            )}
          </div>
        </div>

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
      </div>
    </div>
  )
}
