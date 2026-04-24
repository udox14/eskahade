'use client'

import { useState, useEffect } from 'react'
import { getPlottingStatus, resetPlotting, autoPlotSantri, getUnplottedSantri } from './actions'
import { getActiveEventLight } from '../actions'
import {
  MapPin, RefreshCw, Play, AlertTriangle, CheckCircle2,
  Users, UserX, Loader2, ArrowLeft, Info
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Link from 'next/link'

export default function PlottingEhbPage() {
  const confirm = useConfirm()
  const [event, setEvent] = useState<{id: number, nama: string} | null>(null)
  
  const [status, setStatus] = useState<any[]>([])
  const [kapasitas, setKapasitas] = useState<any[]>([])
  const [jamGroups, setJamGroups] = useState<string[]>([])
  
  const [unplotted, setUnplotted] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    
    if (evt) {
      const res = await getPlottingStatus(evt.id)
      setStatus(res.status)
      setKapasitas(res.kapasitas)
      setJamGroups(res.jamGroups)

      const unp = await getUnplottedSantri(evt.id)
      setUnplotted(unp)
    }
    setLoading(false)
  }

  const handleAutoPlot = async () => {
    if (!event) return
    // Check if there's enough capacity
    // It's checked during the process, but we warn anyway
    if (!await confirm(
      'Mulai Auto Plotting?\n\n' +
      'Sistem akan mengelompokkan santri berdasarkan Marhalah, lalu diurutkan secara Abjad. Santri dari marhalah yang berbeda kemudian akan disilang (Cross Seating) ke dalam kursi ruangan secara berurutan.\n\n' +
      'Perhatian: Tindakan ini akan MENGHAPUS semua plotting ruangan yang ada saat ini.'
    )) return

    setProcessing(true)
    const res = await autoPlotSantri(event.id)
    setProcessing(false)

    if ('error' in res) return toast.error(res.error)
    toast.success(`Plotting berhasil! ${res.count} kursi telah diisi.`)
    loadData()
  }

  const handleReset = async () => {
    if (!event) return
    if (!await confirm('KOSONGKAN RUANGAN?\n\nTindakan ini akan menghapus semua santri dari ruangan EHB. Apakah Anda yakin?')) return

    setProcessing(true)
    const res = await resetPlotting(event.id)
    setProcessing(false)

    if ('error' in res) return toast.error(res.error)
    toast.success('Semua ruangan berhasil dikosongkan.')
    loadData()
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>

  if (!event) return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5"/> Belum ada event EHB yang aktif. Silakan atur di menu Jadwal EHB.
      </div>
    </div>
  )

  // Calculate totals
  const L = status.find(s => s.jenis_kelamin === 'L') || { total_santri: 0, terplot: 0 }
  const P = status.find(s => s.jenis_kelamin === 'P') || { total_santri: 0, terplot: 0 }
  const kapL = kapasitas.find(k => k.jenis_kelamin === 'L') || { total_kapasitas: 0, total_ruangan: 0 }
  const kapP = kapasitas.find(k => k.jenis_kelamin === 'P') || { total_kapasitas: 0, total_ruangan: 0 }

  const multiplier = Math.max(1, jamGroups.length)
  const effKapL = kapL.total_kapasitas * multiplier
  const effKapP = kapP.total_kapasitas * multiplier

  const readyToRun = jamGroups.length > 0 && (kapL.total_ruangan > 0 || kapP.total_ruangan > 0)

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4 flex items-center gap-4">
        <Link href="/dashboard/ehb/ruangan" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-5 h-5"/>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Auto Plotting Ruangan
          </h1>
          <p className="text-sm text-slate-500 mt-1">Penempatan otomatis dengan Cross Seating yang tetap berurutan per kelas dan abjad.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Panel */}
        <div className="bg-white border rounded-xl overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-5 py-4 border-b">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-600"/> Status Plotting</h3>
          </div>
          <div className="p-5 flex-1 flex flex-col gap-5">
            {/* LAKI LAKI */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">Putra</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-bold mb-1">Peserta / Kapasitas</p>
                  <p className="text-lg font-black text-blue-950">{L.total_santri} / <span className={L.total_santri > effKapL ? 'text-red-500' : ''}>{effKapL}</span></p>
                  <p className="text-[10px] text-blue-500">dalam {kapL.total_ruangan} ruangan × {jamGroups.length} jam</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold mb-1">Status</p>
                  <p className="text-lg font-black text-blue-950">{L.terplot} <span className="text-sm font-normal">terplot</span></p>
                  {L.terplot >= L.total_santri && L.total_santri > 0 && (
                    <p className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> SELESAI</p>
                  )}
                </div>
              </div>
            </div>

            {/* PEREMPUAN */}
            <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
              <h4 className="font-bold text-pink-900 mb-3 flex items-center gap-2">Putri</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-pink-600 font-bold mb-1">Peserta / Kapasitas</p>
                  <p className="text-lg font-black text-pink-950">{P.total_santri} / <span className={P.total_santri > effKapP ? 'text-red-500' : ''}>{effKapP}</span></p>
                  <p className="text-[10px] text-pink-500">dalam {kapP.total_ruangan} ruangan × {jamGroups.length} jam</p>
                </div>
                <div>
                  <p className="text-xs text-pink-600 font-bold mb-1">Status</p>
                  <p className="text-lg font-black text-pink-950">{P.terplot} <span className="text-sm font-normal">terplot</span></p>
                  {P.terplot >= P.total_santri && P.total_santri > 0 && (
                    <p className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> SELESAI</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white border rounded-xl overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-5 py-4 border-b">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Play className="w-5 h-5 text-indigo-600"/> Eksekusi Plotting</h3>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center space-y-6">
            {!readyToRun ? (
              <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5"/> 
                <div className="text-sm">
                  <p className="font-bold mb-1">Persyaratan Belum Terpenuhi:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    {jamGroups.length === 0 && <li>Belum ada mapping Kelas ke Jam Group.</li>}
                    {kapL.total_ruangan === 0 && kapP.total_ruangan === 0 && <li>Belum ada Ruangan yang dibuat.</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 text-sm">
                  <Info className="w-5 h-5 shrink-0 mt-0.5"/> 
                  <p>
                    Algoritma akan membagi santri berdasarkan <b>Jenis Kelamin</b> dan <b>Jam Group</b>, 
                    lalu menyilang mereka (Cross Seating) antar marhalah sambil tetap menjaga urutan abjad kelas (A-Z) di dalam ruangan.
                  </p>
                </div>

                <button 
                  onClick={handleAutoPlot}
                  disabled={processing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-6 h-6 animate-spin"/> : <MapPin className="w-6 h-6"/>}
                  {processing ? 'Memproses Plotting...' : 'Mulai Auto Plotting'}
                </button>

                <div className="flex items-center gap-4 pt-4 border-t">
                  <button 
                    onClick={handleReset}
                    disabled={processing || (L.terplot === 0 && P.terplot === 0)}
                    className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-5 h-5 ${processing ? 'animate-spin' : ''}`}/>
                    Kosongkan Semua Ruangan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unplotted Santri List */}
      {unplotted.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden mt-6">
          <div className="bg-red-50 px-5 py-4 border-b border-red-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-red-800 flex items-center gap-2"><UserX className="w-5 h-5"/> Santri Belum Mendapat Ruangan</h3>
              <p className="text-xs text-red-600 mt-1">Daftar santri aktif yang belum terplot karena kapasitas ruangan kurang atau ada penambahan santri baru.</p>
            </div>
            <div className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-lg text-sm">
              {unplotted.length} Santri
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase">Nama Santri</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase">JK</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase">Kelas</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase">Jam Group</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unplotted.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-800">{u.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{u.nis}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${u.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {u.jenis_kelamin === 'L' ? 'L' : 'P'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{u.nama_kelas}</td>
                    <td className="px-5 py-3">
                      <span className="bg-slate-100 text-slate-600 border px-2 py-1 rounded text-xs font-bold">
                        {u.jam_group}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
