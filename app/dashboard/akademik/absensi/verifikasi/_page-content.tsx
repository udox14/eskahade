'use client'

import { useState, useEffect } from 'react'
import { getAntrianVerifikasi, simpanVerifikasiMassal } from './actions'
import { CheckCircle, AlertTriangle, ArrowLeft, Loader2, Gavel, ChevronLeft, ChevronRight, Save, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type VonisType = 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM';

export default function VerifikasiPage() {
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, VonisType>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const res = await getAntrianVerifikasi()
    setList(res)
    setDrafts({})
    setLoading(false)
  }

  const handleSelectVonis = (santriId: string, vonis: VonisType) => {
    setDrafts(prev => ({ ...prev, [santriId]: vonis }))
  }

  const handleSimpanSemua = async () => {
    const santriIds = Object.keys(drafts)
    if (santriIds.length === 0) return
    if (!confirm(`Yakin ingin menyimpan keputusan untuk ${santriIds.length} santri?`)) return

    setIsSaving(true)
    const loadToast = toast.loading("Memproses putusan sidang...")

    const payload = santriIds.map(id => {
      const originalData = list.find(item => item.santri_id === id)
      return { santriId: id, items: originalData.items, vonis: drafts[id] }
    })

    const res = await simpanVerifikasiMassal(payload)
    setIsSaving(false)
    toast.dismiss(loadToast)

    if (res?.error) {
      toast.error("Gagal menyimpan", { description: res.error })
    } else {
      setList(prev => prev.filter(item => !drafts[item.santri_id]))
      setDrafts({})
      toast.success("Verifikasi Berhasil", { description: `${santriIds.length} status santri telah diperbarui.` })
    }
  }

  const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE)
  const paginatedList = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const totalDrafts = Object.keys(drafts).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-32">
      <div className="flex items-center gap-4">
        {/* FIX: Ganti Link href ke button router.back() */}
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Verifikasi Hasil Sidang</h1>
          <p className="text-gray-500 text-xs md:text-sm">Mode Cepat: Pilih status, lalu simpan sekaligus.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3"/>
          <h3 className="text-lg font-bold text-gray-700">Semua Beres!</h3>
          <p className="text-gray-500">Tidak ada antrian santri yang perlu diverifikasi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm text-yellow-800 gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4"/>
              <span>Total Antrian: <b>{list.length}</b> Santri</span>
            </div>
            <div className="text-xs text-yellow-600 font-medium bg-yellow-100 px-2 py-1 rounded">
              Halaman {page} dari {totalPages}
            </div>
          </div>

          <div className="grid gap-4">
            {paginatedList.map((item) => {
              const currentVonis = drafts[item.santri_id]
              return (
                <div key={item.santri_id} className={`bg-white p-4 md:p-5 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 transition-all ${currentVonis ? 'ring-2 ring-green-500 bg-green-50/30' : ''}`}>
                  
                  <div className="flex items-start gap-3 md:gap-4 flex-1">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Gavel className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base md:text-lg text-gray-800 leading-tight">{item.nama}</h4>
                      <p className="text-xs md:text-sm text-gray-500 font-mono mb-1">{item.nis}</p>
                      <p className="text-[10px] md:text-xs text-gray-500 bg-gray-50 inline-block px-2 py-1 rounded border truncate max-w-[200px]">
                        {item.info}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-[10px] md:text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                          {item.items.length} Sesi Alfa
                        </span>
                        {item.items.some((i: any) => i.status_verif === 'BELUM') && (
                          <span className="text-[10px] md:text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                            Hutang Sidang
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[200px] mt-2 md:mt-0">
                    <button 
                      onClick={() => handleSelectVonis(item.santri_id, 'ALFA_MURNI')}
                      className={`w-full py-3 md:py-2 px-4 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 touch-manipulation ${
                        currentVonis === 'ALFA_MURNI' 
                          ? 'bg-red-700 text-white shadow-md scale-[1.02]' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      ALFA (Vonis)
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleSelectVonis(item.santri_id, 'IZIN')}
                        className={`py-3 md:py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                          currentVonis === 'IZIN' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        IZIN
                      </button>
                      <button 
                        onClick={() => handleSelectVonis(item.santri_id, 'SAKIT')}
                        className={`py-3 md:py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                          currentVonis === 'SAKIT' 
                            ? 'bg-yellow-500 text-white shadow-md' 
                            : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                        }`}
                      >
                        SAKIT
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleSelectVonis(item.santri_id, 'BELUM')}
                        className={`py-3 md:py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                          currentVonis === 'BELUM' 
                            ? 'bg-gray-800 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        TDK HADIR
                      </button>
                      <button 
                        onClick={() => handleSelectVonis(item.santri_id, 'KESALAHAN')}
                        className={`py-3 md:py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                          currentVonis === 'KESALAHAN' 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-200'
                        }`}
                      >
                        Salah Input
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-4 pb-20">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-3 md:p-2 rounded-full bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-transform">
                <ChevronLeft className="w-6 h-6 text-gray-600"/>
              </button>
              <span className="font-bold text-gray-600 text-sm md:text-base">Halaman {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-3 md:p-2 rounded-full bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-transform">
                <ChevronRight className="w-6 h-6 text-gray-600"/>
              </button>
            </div>
          )}
        </div>
      )}

      {totalDrafts > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <button onClick={handleSimpanSemua} disabled={isSaving} className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">{totalDrafts}</div>
              <div className="text-left leading-tight">
                <span className="block font-bold text-sm">Simpan Perubahan</span>
                <span className="text-xs text-gray-400">Klik untuk memproses data terpilih</span>
              </div>
            </div>
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin"/> : <Save className="w-6 h-6 text-green-400"/>}
          </button>
        </div>
      )}
    </div>
  )
}