'use client'

import { useState, useEffect } from 'react'
import { getPlottingPengawasStatus, resetPlottingPengawas, autoPlotPengawas } from './actions'
import { getActiveEventLight } from '../actions'
import {
  Users, RefreshCw, Play, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, Info, CalendarCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import Link from 'next/link'

export default function PlottingPengawasPage() {
  const confirm = useConfirm()
  const [event, setEvent] = useState<{id: number, nama: string} | null>(null)
  
  const [status, setStatus] = useState<any>({ total: 0, total_senior: 0, total_junior: 0 })
  const [slotDibutuhkan, setSlotDibutuhkan] = useState(0)
  const [terplot, setTerplot] = useState(0)
  
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
      const res = await getPlottingPengawasStatus(evt.id)
      setStatus(res.pengawas)
      setSlotDibutuhkan(res.slotDibutuhkan)
      setTerplot(res.terplot)
    }
    setLoading(false)
  }

  const handleAutoPlot = async () => {
    if (!event) return
    
    if (status.total === 0) return toast.error('Belum ada pengawas terdaftar.')
    
    // Perhitungan kasar minimal pengawas = max ruangan per sesi.
    // Jika pengawas < max ruangan, ada ruangan kosong! (ditangani error backend, tapi kasih warning di sini)
    // Di frontend kita tidak hitung max ruangan per sesi, biarkan backend handle.

    if (!await confirm(
      'Mulai Auto Plotting Pengawas?\n\n' +
      'Sistem akan menyusun jadwal pengawas dengan aturan:\n' +
      '1. Pemerataan beban tugas\n' +
      '2. Pencegahan jaga berturut-turut (back-to-back)\n' +
      '3. Pengawas Senior tidak dialokasikan di sesi terakhir\n\n' +
      'Perhatian: Tindakan ini akan MENGHAPUS semua jadwal pengawas yang ada saat ini.'
    )) return

    setProcessing(true)
    const res = await autoPlotPengawas(event.id)
    setProcessing(false)

    if ('error' in res) return toast.error(res.error, { duration: 10000 }) // longer error read
    toast.success(`Jadwal pengawas berhasil dibuat! ${res.count} slot telah diisi.`)
    loadData()
  }

  const handleReset = async () => {
    if (!event) return
    if (!await confirm('KOSONGKAN JADWAL?\n\nTindakan ini akan menghapus semua tugas dari seluruh pengawas. Apakah Anda yakin?')) return

    setProcessing(true)
    const res = await resetPlottingPengawas(event.id)
    setProcessing(false)

    if ('error' in res) return toast.error(res.error)
    toast.success('Semua jadwal pengawas berhasil dikosongkan.')
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

  const readyToRun = slotDibutuhkan > 0 && status.total > 0

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4 flex items-center gap-4">
        <Link href="/dashboard/ehb/pengawas" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-5 h-5"/>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Auto Plotting Jadwal Pengawas
          </h1>
          <p className="text-sm text-slate-500 mt-1">Penjadwalan otomatis pengawas EHB dengan mempertimbangkan status senioritas dan keadilan (fairness).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Panel */}
        <div className="bg-white border rounded-xl overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-5 py-4 border-b">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-indigo-600"/> Status Kesiapan</h3>
          </div>
          <div className="p-5 flex-1 flex flex-col gap-5">
            
            <div className="bg-slate-50 border rounded-xl p-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-slate-500 font-bold mb-1">Total Pengawas</p>
                    <p className="text-2xl font-black text-slate-800">{status.total} <span className="text-sm font-normal text-slate-500">Orang</span></p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{status.total_senior} Senior • {status.total_junior} Junior</p>
                </div>
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-500"/>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-indigo-600 font-bold mb-1">Slot Tugas Dibutuhkan</p>
                    <p className="text-2xl font-black text-indigo-900">{slotDibutuhkan} <span className="text-sm font-normal text-indigo-600">Sesi-Ruangan</span></p>
                    {status.total > 0 && slotDibutuhkan > 0 && (
                        <p className="text-[10px] text-indigo-500 font-bold mt-1 uppercase tracking-wider">
                            Rata-rata: ~{Math.ceil(slotDibutuhkan / status.total)} tugas / orang
                        </p>
                    )}
                </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-green-600 font-bold mb-1">Status Plotting Saat Ini</p>
                    <p className="text-2xl font-black text-green-900">{terplot} <span className="text-sm font-normal text-green-600">Terisi</span></p>
                </div>
                {terplot > 0 && terplot >= slotDibutuhkan && (
                    <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-700"/>
                    </div>
                )}
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
                    {slotDibutuhkan === 0 && <li>Jadwal Ujian EHB belum diatur (Tidak ada ruangan aktif/mata pelajaran).</li>}
                    {status.total === 0 && <li>Belum ada Pengawas yang terdaftar.</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 text-sm">
                  <Info className="w-5 h-5 shrink-0 mt-0.5"/> 
                  <div>
                    <p className="font-bold mb-1">Algoritma Penjadwalan:</p>
                    <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li>Mengurutkan pengawas berdasarkan yang paling sedikit mendapat tugas (Pemerataan).</li>
                        <li>Mencegah pengawas menjaga 2 sesi berturut-turut di hari yang sama.</li>
                        <li>Mencegah pengawas dengan Tag <b>Senior</b> menjaga di sesi terakhir hari tersebut.</li>
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={handleAutoPlot}
                  disabled={processing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-6 h-6 animate-spin"/> : <Users className="w-6 h-6"/>}
                  {processing ? 'Memproses Plotting...' : 'Mulai Auto Plotting'}
                </button>

                <div className="flex items-center gap-4 pt-4 border-t">
                  <button 
                    onClick={handleReset}
                    disabled={processing || terplot === 0}
                    className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-5 h-5 ${processing ? 'animate-spin' : ''}`}/>
                    Kosongkan Semua Jadwal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
