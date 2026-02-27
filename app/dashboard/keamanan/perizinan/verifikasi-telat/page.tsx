'use client'

import { useState, useEffect } from 'react'
import { getAntrianTelat, simpanVonisTelat } from './actions'
import { AlertTriangle, ArrowLeft, Loader2, Clock, CheckCircle, Gavel } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

export default function VerifikasiTelatPage() {
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const res = await getAntrianTelat()
    setList(res)
    setLoading(false)
  }

  const handleVonis = async (item: any, vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR') => {
    if (vonis === 'TELAT_MURNI' && !confirm(`Yakin vonis ${item.nama} bersalah (Poin +25)?`)) return

    setProcessingId(item.izin_id)
    const res = await simpanVonisTelat(item.izin_id, item.santri_id, vonis)
    setProcessingId(null)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Berhasil", { description: vonis === 'MANGKIR' ? "Ditunda ke sidang berikutnya" : "Status diperbarui." })
      setList(prev => prev.filter(i => i.izin_id !== item.izin_id))
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Verifikasi Keterlambatan</h1>
          <p className="text-gray-500 text-sm">Sidang santri yang terlambat kembali.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3"/>
          <h3 className="text-lg font-bold text-gray-700">Semua Tertib!</h3>
          <p className="text-gray-500">Tidak ada antrian sidang keterlambatan saat ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex items-center gap-3 text-orange-800 text-sm">
            <AlertTriangle className="w-5 h-5"/>
            <span>Menampilkan <b>{list.length}</b> santri dalam daftar tunggu sidang.</span>
          </div>

          <div className="grid gap-4">
            {list.map((item) => (
              <div key={item.izin_id} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in slide-in-from-bottom-2">
                
                {/* Info Santri & Keterlambatan */}
                <div className="flex gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.tgl_kembali ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                  }`}>
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">{item.nama}</h4>
                    <div className="flex gap-2 mb-2">
                        <p className="text-xs text-gray-500 bg-gray-50 inline-block px-2 py-0.5 rounded border">
                        {item.info}
                        </p>
                        {item.tgl_kembali ? (
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">
                                SUDAH BALIK (Menunggu Sidang)
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 animate-pulse">
                                BELUM BALIK (Overdue)
                            </span>
                        )}
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <p className="text-gray-600">
                        <span className="font-bold">Janji Kembali:</span> {format(new Date(item.batas_kembali), 'dd MMM HH:mm', { locale: id })}
                      </p>
                      <p className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded w-fit">
                        Telat: {item.durasi_telat}
                      </p>
                      <p className="text-xs text-gray-400 italic">"{item.alasan}"</p>
                    </div>
                  </div>
                </div>

                {/* Tombol Vonis */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {processingId === item.izin_id ? (
                    <div className="text-center text-sm text-gray-400 py-4 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin"/> Memproses...
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleVonis(item, 'TELAT_MURNI')}
                        className="w-full py-2.5 px-4 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-md transition-colors flex items-center justify-center gap-2"
                      >
                        <Gavel className="w-4 h-4"/> VONIS TELAT (+25)
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleVonis(item, 'SAKIT')}
                          className="py-2 px-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-xs font-bold hover:bg-yellow-100 transition-colors"
                        >
                          Uzur Sakit
                        </button>
                        <button 
                          onClick={() => handleVonis(item, 'IZIN_UZUR')}
                          className="py-2 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                          Uzur Syar'i
                        </button>
                      </div>

                      <button 
                        onClick={() => handleVonis(item, 'MANGKIR')}
                        className="py-2 px-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-xs font-bold hover:bg-black hover:text-white transition-colors"
                      >
                        TIDAK HADIR SIDANG
                      </button>
                    </>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}