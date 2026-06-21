'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  BookMarked,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Loader2,
  Search,
  Users,
  ClipboardList,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { fullDateWib, shortDateWib } from '../_date-utils'
import {
  getActiveEventLight,
  getAsramaForMenghafal,
  getBlokForMenghafal,
  getJadwalMenghafalList,
  getKamarForMenghafal,
  getPesertaForMenghafal,
  saveAbsensiMenghafalInput,
  type AsramaMenghafal,
  type BlokMenghafal,
  type KamarMenghafal,
  type PesertaMenghafal,
  type SesiMenghafal,
} from './actions'

type ViewState = 'list-asrama' | 'list-sesi' | 'list-blok' | 'list-kamar' | 'input-absensi'

function statusLabel(status: string | null | undefined) {
  if (status === 'A') return 'alpha tidak hadir'
  if (status === 'I') return 'izin tidak hadir'
  if (status === 'S') return 'sakit tidak hadir'
  return 'hadir'
}

export default function AbsensiMenghafalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const [event, setEvent] = useState<{ id: number, nama: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewState>('list-asrama')

  const [asramaList, setAsramaList] = useState<AsramaMenghafal[]>([])
  const [sesiList, setSesiList] = useState<SesiMenghafal[]>([])
  const [blokList, setBlokList] = useState<BlokMenghafal[]>([])
  const [kamarList, setKamarList] = useState<KamarMenghafal[]>([])
  const [pesertaList, setPesertaList] = useState<PesertaMenghafal[]>([])
  const [pesertaSearch, setPesertaSearch] = useState('')

  const [selectedAsrama, setSelectedAsrama] = useState<AsramaMenghafal | null>(null)
  const [selectedSesi, setSelectedSesi] = useState<SesiMenghafal | null>(null)
  const [selectedBlok, setSelectedBlok] = useState<BlokMenghafal | null>(null)
  const [selectedKamar, setSelectedKamar] = useState<KamarMenghafal | null>(null)

  const [absensiMap, setAbsensiMap] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    if (evt) {
      setAsramaList(await getAsramaForMenghafal(evt.id))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleBackFromAsrama = () => {
    if (fromPath && fromPath.startsWith('/dashboard')) {
      router.push(fromPath)
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/dashboard')
  }

  const handleSelectAsrama = async (asrama: AsramaMenghafal) => {
    if (!event) return
    setSelectedAsrama(asrama)
    setSelectedSesi(null)
    setSelectedBlok(null)
    setSelectedKamar(null)
    setLoading(true)
    setView('list-sesi')
    setSesiList(await getJadwalMenghafalList(event.id))
    setLoading(false)
  }

  const handleSelectSesi = async (sesi: SesiMenghafal) => {
    if (!event || !selectedAsrama) return
    setSelectedSesi(sesi)
    setSelectedBlok(null)
    setSelectedKamar(null)
    setLoading(true)
    setView('list-blok')
    setBlokList(await getBlokForMenghafal(event.id, sesi.tanggal, sesi.sesi_id, sesi.jam_group, selectedAsrama.asrama))
    setLoading(false)
  }

  const handleSelectBlok = async (blok: BlokMenghafal) => {
    if (!event || !selectedSesi || !selectedAsrama) return
    setSelectedBlok(blok)
    setSelectedKamar(null)
    setLoading(true)
    setView('list-kamar')
    setKamarList(await getKamarForMenghafal(event.id, selectedSesi.tanggal, selectedSesi.sesi_id, selectedSesi.jam_group, selectedAsrama.asrama, blok.blok_key))
    setLoading(false)
  }

  const handleSelectKamar = async (kamar: KamarMenghafal) => {
    if (!event || !selectedSesi) return
    setSelectedKamar(kamar)
    setPesertaSearch('')
    setLoading(true)
    setView('input-absensi')
    const list = await getPesertaForMenghafal(
      event.id,
      selectedSesi.tanggal,
      selectedSesi.sesi_id,
      selectedSesi.jam_group,
      kamar.asrama,
      kamar.kamar
    )
    setPesertaList(list)
    const initialMap: Record<string, string> = {}
    list.forEach(p => {
      initialMap[p.santri_id] = p.status_absen || 'H'
    })
    setAbsensiMap(initialMap)
    setLoading(false)
  }

  const handleSetAbsen = async (santriId: string, status: string) => {
    if (!event || !selectedSesi) return
    const previous = absensiMap[santriId] || 'H'
    setAbsensiMap(prev => ({ ...prev, [santriId]: status }))
    setSavingIds(prev => ({ ...prev, [santriId]: true }))

    const res = await saveAbsensiMenghafalInput(event.id, selectedSesi.tanggal, selectedSesi.sesi_id, santriId, status)
    setSavingIds(prev => {
      const next = { ...prev }
      delete next[santriId]
      return next
    })

    if (res.error) {
      setAbsensiMap(prev => ({ ...prev, [santriId]: previous }))
      toast.error(res.error)
    }
  }

  const filteredPesertaList = pesertaList.filter(p => {
    const needle = pesertaSearch.trim().toLowerCase()
    if (!needle) return true
    return [
      p.nama_lengkap,
      p.nis,
      p.nama_kelas,
      p.marhalah_nama,
      p.jam_group,
      p.asrama,
      p.kamar,
      statusLabel(absensiMap[p.santri_id]),
    ].some(value => String(value || '').toLowerCase().includes(needle))
  })

  const groupedSesi: Record<string, SesiMenghafal[]> = {}
  sesiList.forEach(sesi => {
    if (!groupedSesi[sesi.tanggal]) groupedSesi[sesi.tanggal] = []
    groupedSesi[sesi.tanggal].push(sesi)
  })

  if (loading && view === 'list-asrama') {
    return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
  }

  if (!event) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 border-x">
      {view === 'list-asrama' && (
        <div className="flex flex-col h-full">
          <div className="bg-teal-700 px-5 pt-10 pb-6 shadow-md rounded-b-3xl">
            <div className="flex items-start justify-between gap-3">
              <button onClick={handleBackFromAsrama} className="p-2 -ml-2 rounded-full text-white hover:bg-white/10 active:bg-white/15">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <Link href="/dashboard/ehb/absensi-menghafal/rekap?from=/dashboard/ehb/absensi-menghafal" className="p-2 rounded-full text-white hover:bg-white/10 active:bg-white/15">
                <ClipboardList className="w-5 h-5" />
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 mt-2">Absensi Menghafal</h1>
            <p className="text-teal-100 text-sm">Pilih asrama yang akan diabsen.</p>
          </div>

          <div className="p-4 flex-1">
            {asramaList.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-500">Tidak ada asrama tersedia</p>
                <p className="text-xs text-slate-400">Pastikan santri aktif sudah punya asrama, kamar, dan mapping jam EHB.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {asramaList.map(asrama => (
                  <button
                    key={asrama.asrama}
                    onClick={() => handleSelectAsrama(asrama)}
                    className="w-full bg-white border p-4 rounded-2xl shadow-sm hover:border-teal-300 cursor-pointer flex justify-between items-center active:scale-95 transition-all"
                  >
                    <div className="flex gap-3 items-center text-left min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-black flex-shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{asrama.asrama}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span className="font-bold">{asrama.jumlah_kamar}</span> kamar
                          <span className="text-slate-300">/</span>
                          <span className="font-bold">{asrama.jumlah_santri}</span> santri
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'list-sesi' && (
        <div className="flex flex-col h-full">
          <div className="bg-teal-700 px-5 pt-10 pb-6 shadow-md rounded-b-3xl">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => setView('list-asrama')} className="p-2 -ml-2 rounded-full text-white hover:bg-white/10 active:bg-white/15">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <Link href="/dashboard/ehb/absensi-menghafal/rekap?from=/dashboard/ehb/absensi-menghafal" className="p-2 rounded-full text-white hover:bg-white/10 active:bg-white/15">
                <ClipboardList className="w-5 h-5" />
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 mt-2">Absensi Menghafal</h1>
            <p className="text-teal-100 text-sm">{selectedAsrama?.asrama} - pilih jadwal EHB.</p>
          </div>

          <div className="p-4 flex-1 space-y-6">
            {Object.keys(groupedSesi).length === 0 ? (
              <div className="text-center py-20">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-500">Belum ada jadwal sesi 1-4</p>
              </div>
            ) : (
              Object.keys(groupedSesi).map(tanggal => (
                <div key={tanggal} className="space-y-3">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 px-1">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    {fullDateWib(tanggal)}
                  </h3>
                  {groupedSesi[tanggal].map(sesi => (
                    <button
                      key={sesi.sesi_id}
                      onClick={() => handleSelectSesi(sesi)}
                      className="w-full text-left bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between group active:scale-95"
                    >
                      <div>
                        <p className="font-bold text-slate-800 text-lg mb-0.5">{sesi.label}</p>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{sesi.jam_group}</span>
                          <span className="text-slate-500">{sesi.waktu_mulai} - {sesi.waktu_selesai}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {view === 'list-blok' && (
        <div className="flex flex-col h-full pb-10">
          <div className="bg-white px-4 py-4 border-b sticky -top-4 md:-top-8 z-10 flex items-center gap-3 shadow-sm">
            <button onClick={() => setView('list-sesi')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200">
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">Daftar Blok</h2>
              <p className="text-xs text-teal-700 font-bold">{selectedAsrama?.asrama} - {selectedSesi?.label} - {selectedSesi ? shortDateWib(selectedSesi.tanggal, false) : ''}</p>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : blokList.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-500 text-sm">Tidak ada santri menghafal</p>
                <p className="text-xs text-slate-400">Tidak ada santri dari jam lain di sesi ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blokList.map(blok => (
                  <button
                    key={blok.blok_key}
                    onClick={() => handleSelectBlok(blok)}
                    className="w-full bg-white border p-4 rounded-2xl shadow-sm hover:border-teal-300 cursor-pointer flex justify-between items-center active:scale-95 transition-all"
                  >
                    <div className="flex gap-3 items-center text-left">
                      <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-black text-lg flex-shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Blok {blok.blok_label}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span className="font-bold">{blok.jumlah_kamar}</span> kamar
                          <span className="text-slate-300">/</span>
                          <span className="font-bold">{blok.jumlah_santri}</span> santri
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'list-kamar' && (
        <div className="flex flex-col h-full pb-10">
          <div className="bg-white px-4 py-4 border-b sticky -top-4 md:-top-8 z-10 flex items-center gap-3 shadow-sm">
            <button onClick={() => setView('list-blok')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200">
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">Daftar Kamar</h2>
              <p className="text-xs text-teal-700 font-bold">{selectedAsrama?.asrama} - Blok {selectedBlok?.blok_label}</p>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : kamarList.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                <DoorOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-500 text-sm">Tidak ada kamar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {kamarList.map(kamar => (
                  <button
                    key={`${kamar.asrama}-${kamar.kamar}`}
                    onClick={() => handleSelectKamar(kamar)}
                    className="w-full bg-white border p-4 rounded-2xl shadow-sm hover:border-teal-300 cursor-pointer flex justify-between items-center active:scale-95 transition-all"
                  >
                    <div className="flex gap-3 items-center text-left min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-xl flex-shrink-0">
                        {kamar.kamar}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">Kamar {kamar.kamar}</p>
                        <p className="text-[10px] font-bold text-cyan-700 uppercase truncate">{kamar.asrama}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-bold">{kamar.jumlah_santri}</span> santri
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'input-absensi' && (
        <div className="flex flex-col h-full pb-28">
          <div className="bg-white px-4 py-4 border-b sticky -top-4 md:-top-8 z-10 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list-kamar')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200">
                <ChevronLeft className="w-6 h-6 text-slate-700" />
              </button>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-800 text-lg leading-tight truncate">Kamar {selectedKamar?.kamar}</h2>
                <p className="text-xs text-slate-500 truncate">{selectedKamar?.asrama} - Blok {selectedKamar?.blok_label} - {selectedSesi?.label}</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={pesertaSearch}
                onChange={e => setPesertaSearch(e.target.value)}
                placeholder="Cari nama, kelas, asrama, atau status"
                className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
              />
            </div>
          </div>

          <div className="p-3">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : (
              <div className="space-y-2">
                {filteredPesertaList.length === 0 ? (
                  <div className="bg-white border border-dashed rounded-2xl p-10 text-center text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-500 text-sm">Tidak ada hasil</p>
                    <p className="text-xs">Coba kata kunci lain.</p>
                  </div>
                ) : filteredPesertaList.map(p => {
                  const val = absensiMap[p.santri_id]
                  const isAlpha = val === 'A'
                  const isIzin = val === 'I'
                  const isSakit = val === 'S'
                  const isHadir = val === 'H' || !val
                  const isSaving = Boolean(savingIds[p.santri_id])

                  return (
                    <div key={p.santri_id} className={`bg-white border rounded-2xl p-3 shadow-sm transition-colors ${!isHadir ? 'border-red-200 bg-red-50/30' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            <BookMarked className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 leading-tight">{p.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{p.nis || '-'} - {p.nama_kelas} - {p.jam_group}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 h-10">
                        <button onClick={() => handleSetAbsen(p.santri_id, 'H')} disabled={isSaving} className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isHadir ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          Hadir
                        </button>
                        <button onClick={() => handleSetAbsen(p.santri_id, 'S')} disabled={isSaving} className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSakit ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          Sakit
                        </button>
                        <button onClick={() => handleSetAbsen(p.santri_id, 'I')} disabled={isSaving} className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isIzin ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          Izin
                        </button>
                        <button onClick={() => handleSetAbsen(p.santri_id, 'A')} disabled={isSaving} className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isAlpha ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          Alfa
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-white/80 backdrop-blur-md border-t max-w-md mx-auto z-20">
            <p className="text-center text-xs font-bold text-slate-500">
              Setiap perubahan langsung tersimpan
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
