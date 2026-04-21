'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionRekap, getRekapAbsenBerjamaah, getKamarList } from '../rekap-asrama/actions'
import ImportBerjamaahModal from '../rekap-asrama/ImportBerjamaahModal'
import { Flame, Home, Loader2, ChevronLeft, ChevronRight, Search, Upload } from 'lucide-react'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const WAKTU = ['shubuh', 'ashar', 'maghrib', 'isya'] as const
type Waktu = typeof WAKTU[number]

const WAKTU_LABEL: Record<Waktu, string> = { shubuh: 'Shb', ashar: 'Ash', maghrib: 'Mgr', isya: 'Isy' }

const STATUS_COLOR: Record<string, string> = {
  'A': 'bg-red-500 text-white',
  'S': 'bg-orange-400 text-white',
  'H': 'bg-purple-400 text-white',
  'P': 'bg-blue-400 text-white',
}

function bulanIni() { return new Date().toISOString().slice(0, 7) }
function getDaysInMonth(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function formatBulan(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
function prevBulan(b: string) {
  const [y, m] = b.split('-').map(Number)
  return new Date(y, m - 2).toISOString().slice(0, 7)
}
function nextBulan(b: string) {
  const [y, m] = b.split('-').map(Number)
  return new Date(y, m).toISOString().slice(0, 7)
}

export default function RekapAbsenBerjamaahPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [bulan, setBulan] = useState(bulanIni())
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filterKamar, setFilterKamar] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [availableKamars, setAvailableKamars] = useState<string[]>([])

  const [bjSantri, setBjSantri] = useState<any[]>([])
  const [bjDetail, setBjDetail] = useState<Record<string, Record<string, any>>>({})

  const sessionInfoRef = useRef<any>(null)
  const asramaRef = useRef(asrama)
  const bulanRef = useRef(bulan)

  useEffect(() => {
    asramaRef.current = asrama
    setFilterKamar('Semua')
    getKamarList(asrama).then(k => setAvailableKamars(k))
  }, [asrama])
  useEffect(() => { bulanRef.current = bulan }, [bulan])

  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    getSessionRekap().then(s => {
      setSessionInfo(s)
      sessionInfoRef.current = s
      if (s?.asrama_binaan) {
        setAsrama(s.asrama_binaan)
        asramaRef.current = s.asrama_binaan
      }
      setSessionReady(true)
    })
  }, [])

  useEffect(() => {
    if (sessionReady && sessionInfoRef.current?.asrama_binaan) {
      load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady])

  async function load() {
    setLoading(true)
    try {
      const si = sessionInfoRef.current
      const hideHaid = !si?.isPutri || si?.role === 'keamanan'
      const bj = await getRekapAbsenBerjamaah(asramaRef.current, bulanRef.current, hideHaid)
      setBjSantri(bj.santriList)
      setBjDetail(bj.detail)
      setHasLoaded(true)
    } catch (error: any) {
      console.error(error)
      alert("Gagal memuat rekap absen berjamaah. Error: " + (error?.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  const days = getDaysInMonth(bulan)
  const daysArr = Array.from({ length: days }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${bulan}-${d}`
  })

  const grouped = (list: any[]) => list.reduce((acc, s) => {
    const k = s.kamar || 'Tanpa Kamar'
    if (!acc[k]) acc[k] = []
    acc[k].push(s)
    return acc
  }, {} as Record<string, any[]>)

  const sortedKamars = (list: any[]) =>
    Object.keys(grouped(list)).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))

  const isPutri = ASRAMA_PUTRI.includes(asrama)

  const filteredSantri = bjSantri.filter(s => {
    const matchKamar = filterKamar === 'Semua' || (s.kamar || 'Tanpa Kamar') === filterKamar
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || (s.nis || '').includes(searchQuery)
    return matchKamar && matchSearch
  })

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Flame className="w-7 h-7 text-teal-600"/> Rekap Absen Berjamaah
          </h1>
          <p className="text-sm text-slate-500">Rekap shalat berjamaah per bulan</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-1 shadow-sm">
            <button onClick={() => setBulan(b => prevBulan(b))} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[130px] text-center">{formatBulan(bulan)}</span>
            <button onClick={() => setBulan(b => nextBulan(b))} disabled={bulan >= bulanIni()}
              className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>

          {sessionInfo?.asrama_binaan
            ? <span className="bg-teal-100 text-teal-700 text-sm font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5"/> {sessionInfo.asrama_binaan}
              </span>
            : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                className="border rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 bg-white shadow-sm">
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          }

          <select
            value={filterKamar}
            onChange={e => setFilterKamar(e.target.value)}
            disabled={availableKamars.length === 0}
            className="border rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 bg-white shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="Semua">Semua Kamar</option>
            {availableKamars.map(k => <option key={k} value={k}>{k === 'Tanpa Kamar' ? k : `Kamar ${k}`}</option>)}
          </select>

          <button
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-60 ${
              !hasLoaded ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin"/> Memuat...</>
              : <><Search className="w-4 h-4"/> {hasLoaded ? 'Perbarui' : 'Tampilkan'}</>
            }
          </button>
        </div>
      </div>

      {/* FILTER CARI & IMPORT */}
      {hasLoaded && !loading && (
        <div className="flex gap-2 justify-end flex-wrap">
          {!isPutri && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex shrink-0 items-center justify-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl font-bold shadow-sm hover:bg-teal-100 active:scale-95 transition text-sm"
              title="Import Excel Mesin Fingerprint"
            >
              <Upload className="w-4 h-4"/>
              <span className="hidden lg:block">Import Excel</span>
            </button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama santri..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* KONTEN */}
      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center">
            <Flame className="w-10 h-10 text-teal-300"/>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-500">Data belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih asrama & bulan lalu tekan <strong>Tampilkan</strong>.</p>
          </div>
          <button onClick={load}
            className="mt-1 bg-teal-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 active:scale-95 transition-all shadow">
            Tampilkan Sekarang
          </button>
        </div>

      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-teal-400"/>
        </div>

      ) : (
        <div className="space-y-4">
          {filteredSantri.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white border rounded-2xl">
              Tidak ada data absen berjamaah untuk filter ini.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {WAKTU.map(w => {
                  const alfa = filteredSantri.reduce((s, santri) => {
                    return s + Object.values(bjDetail[santri.id] || {}).filter((d: any) => d[w] === 'A').length
                  }, 0)
                  return (
                    <div key={w} className="bg-white border rounded-xl p-3 text-center shadow-sm">
                      <p className="text-sm text-slate-500 font-semibold capitalize">{w}</p>
                      <p className="text-xl font-black text-red-600 tabular-nums">{alfa}</p>
                      <p className="text-[10px] text-slate-400">alfa bulan ini</p>
                    </div>
                  )
                })}
              </div>

              {sortedKamars(filteredSantri).map(kamar => {
                const santriKamar = grouped(filteredSantri)[kamar]
                return (
                  <div key={kamar} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-teal-900 text-white px-4 py-2.5 flex justify-between items-center">
                      <span className="font-bold">{kamar === 'Tanpa Kamar' ? kamar : `Kamar ${kamar}`}</span>
                      <span className="text-xs text-teal-300">{santriKamar.length} santri</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[600px]">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10 w-36">Nama</th>
                            {WAKTU.map(w => (
                              <th key={w} className="px-1 py-2 text-center font-bold text-slate-500 w-10">{WAKTU_LABEL[w]}</th>
                            ))}
                            {daysArr.map(d => (
                              <th key={d} className="px-0.5 py-2 text-center text-slate-400 font-normal w-5 text-[10px]">{d.slice(8)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {santriKamar.map((s: any) => {
                            const detail = bjDetail[s.id] || {}
                            const counts: Record<Waktu, Record<string, number>> = {
                              shubuh: {}, ashar: {}, maghrib: {}, isya: {}
                            }
                            Object.values(detail).forEach((d: any) => {
                              WAKTU.forEach(w => {
                                if (d[w]) counts[w][d[w]] = (counts[w][d[w]] || 0) + 1
                              })
                            })
                            return (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                  <p className="font-semibold text-slate-800 truncate max-w-[130px]">{s.nama_lengkap}</p>
                                </td>
                                {WAKTU.map(w => {
                                  const a = counts[w]['A'] || 0
                                  const nonH = Object.values(counts[w]).reduce((s, v) => s + v, 0)
                                  return (
                                    <td key={w} className="px-1 py-2 text-center">
                                      {a > 0
                                        ? <span className="inline-block bg-red-500 text-white font-black text-[9px] px-1 py-0.5 rounded-full min-w-[16px]">{a}</span>
                                        : nonH > 0
                                          ? <span className="inline-block bg-orange-200 text-orange-700 font-bold text-[9px] px-1 py-0.5 rounded-full min-w-[16px]">{nonH}</span>
                                          : <span className="text-slate-200">—</span>
                                      }
                                    </td>
                                  )
                                })}
                                {daysArr.map(d => {
                                  const dayData = detail[d]
                                  const hasIssue = dayData && WAKTU.some(w => dayData[w] !== null)
                                  if (!hasIssue) return (
                                    <td key={d} className="px-0.5 py-2 text-center">
                                      <span className="text-slate-200 text-[9px]">·</span>
                                    </td>
                                  )
                                  return (
                                    <td key={d} className="px-0.5 py-1 text-center">
                                      <div className="flex flex-col gap-0.5 items-center">
                                        {WAKTU.map(w => {
                                          const st = dayData?.[w]
                                          if (!st) return null
                                          return (
                                            <span key={w} className={`inline-block text-[8px] font-black w-4 h-4 rounded leading-4 text-center ${STATUS_COLOR[st] || 'bg-slate-200 text-slate-600'}`}>
                                              {st}
                                            </span>
                                          )
                                        })}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {showImportModal && (
        <ImportBerjamaahModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => load()}
          santriList={bjSantri}
        />
      )}
    </div>
  )
}
