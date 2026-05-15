'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionRekap, getRekapAbsenMalam, getKamarList, getRiwayatAlfaAbsenMalam } from '../rekap-asrama/actions'
import { History, Moon, Home, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

function bulanIni() { return new Date().toISOString().slice(0, 7) }
function getDaysInMonth(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function formatBulan(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
function formatTanggal(tanggal: string) {
  return new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function prevBulan(b: string) {
  const [y, m] = b.split('-').map(Number)
  return new Date(y, m - 2).toISOString().slice(0, 7)
}
function nextBulan(b: string) {
  const [y, m] = b.split('-').map(Number)
  return new Date(y, m).toISOString().slice(0, 7)
}

export default function RekapAbsenMalamPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [asrama, setAsrama] = useState<string>(ASRAMA_LIST[0] || '')
  const [bulan, setBulan] = useState(bulanIni())
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<'bulan' | 'riwayat'>('bulan')
  const [filterKamar, setFilterKamar] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [availableKamars, setAvailableKamars] = useState<string[]>([])

  const [malamSantri, setMalamSantri] = useState<any[]>([])
  const [malamAlfa, setMalamAlfa] = useState<Record<string, number>>({})
  const [malamDetail, setMalamDetail] = useState<Record<string, Record<string, string>>>({})
  const [riwayatAlfa, setRiwayatAlfa] = useState<any[]>([])

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
      const [malam, riwayat] = await Promise.all([
        getRekapAbsenMalam(asramaRef.current, bulanRef.current),
        getRiwayatAlfaAbsenMalam(asramaRef.current),
      ])
      setMalamSantri(malam.santriList)
      setMalamAlfa(malam.alfaPerSantri)
      setMalamDetail(malam.detailPerSantri)
      setRiwayatAlfa(riwayat)
      setHasLoaded(true)
    } catch (error: any) {
      console.error(error)
      alert("Gagal memuat rekap absen malam. Error: " + (error?.message || "Unknown error"))
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

  const filteredSantri = malamSantri.filter(s => {
    const matchKamar = filterKamar === 'Semua' || (s.kamar || 'Tanpa Kamar') === filterKamar
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || (s.nis || '').includes(searchQuery)
    return matchKamar && matchSearch
  })
  const filteredRiwayatAlfa = riwayatAlfa.filter(s => {
    const matchKamar = filterKamar === 'Semua' || (s.kamar || 'Tanpa Kamar') === filterKamar
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || (s.nis || '').includes(searchQuery)
    return matchKamar && matchSearch
  })
  const roomFeatureBlocked = isAsramaTanpaKamar(sessionInfo?.asrama_binaan ?? asrama)

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">

      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Rekap Absen Malam"
          description="Rekap absensi malam per bulan."
          className="flex-1"
        />
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
            ? <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5"/> {sessionInfo.asrama_binaan}
              </span>
            : <select value={asrama} onChange={e => setAsrama(e.target.value)}
                className="border rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm">
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          }

          <select
            value={filterKamar}
            onChange={e => setFilterKamar(e.target.value)}
            disabled={availableKamars.length === 0}
            className="border rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="Semua">Semua Kamar</option>
            {availableKamars.map(k => <option key={k} value={k}>{k === 'Tanpa Kamar' ? k : `Kamar ${k}`}</option>)}
          </select>

          <button
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-60 ${
              !hasLoaded ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin"/> Memuat...</>
              : <><Search className="w-4 h-4"/> {hasLoaded ? 'Perbarui' : 'Tampilkan'}</>
            }
          </button>
        </div>
      </div>

      {/* TABS & FILTER */}
      {hasLoaded && !loading && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab('bulan')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === 'bulan' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Moon className="h-4 w-4" />
              Rekap Bulan Ini
            </button>
            <button
              onClick={() => setActiveTab('riwayat')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === 'riwayat' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4" />
              Riwayat Semua Alfa
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama santri..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* KONTEN */}
      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
            <Moon className="w-10 h-10 text-indigo-300"/>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-500">Data belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih asrama & bulan lalu tekan <strong>Tampilkan</strong>.</p>
          </div>
          <button onClick={load}
            className="mt-1 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow">
            Tampilkan Sekarang
          </button>
        </div>

      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400"/>
        </div>

      ) : roomFeatureBlocked ? (
        <div className="py-12 text-center text-slate-400 bg-white border rounded-2xl">
          Asrama ini tidak memakai kamar, jadi tidak ikut rekap absen malam.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {activeTab === 'bulan' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-red-600">
                  {filteredSantri.reduce((s, santri) => s + (malamAlfa[santri.id] || 0), 0)}
                </p>
                <p className="text-xs text-red-400 mt-1">Total Alfa</p>
              </div>
            )}
            {activeTab === 'riwayat' && (
              <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-slate-800">
                  {filteredRiwayatAlfa.reduce((sum, santri) => sum + santri.total_alfa, 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Riwayat Semua Alfa</p>
              </div>
            )}
          </div>

          {activeTab === 'riwayat' && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">Riwayat Semua Alfa</p>
                <p className="text-xs text-slate-400">Tidak tergantung bulan yang sedang dibuka.</p>
              </div>
              <span className="text-xs text-slate-400">{filteredRiwayatAlfa.length} santri</span>
            </div>
            {filteredRiwayatAlfa.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                Belum ada riwayat ALFA absen malam untuk filter ini.
              </div>
            ) : (
              <div className="divide-y">
                {filteredRiwayatAlfa.map((santri: any) => (
                  <div key={santri.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-800">{santri.nama_lengkap}</p>
                        <p className="text-xs text-slate-400">{santri.nis || '-'} / Kamar {santri.kamar || '-'}</p>
                      </div>
                      <span className="w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-600">
                        {santri.total_alfa}x ALFA
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {santri.tanggal.map((item: any) => (
                        <span key={`${santri.id}-${item.tanggal}`} className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          {formatTanggal(item.tanggal)}
                          {item.keterangan ? ` - ${item.keterangan}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {activeTab === 'bulan' && (filteredSantri.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white border rounded-2xl">
              Tidak ada record ALFA absen malam untuk filter ini.
            </div>
          ) : sortedKamars(filteredSantri).map(kamar => {
            const santriKamar = grouped(filteredSantri)[kamar]
            return (
              <div key={kamar} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-2.5 flex justify-between items-center">
                  <span className="font-bold">{kamar === 'Tanpa Kamar' ? kamar : `Kamar ${kamar}`}</span>
                  <span className="text-xs text-slate-400">{santriKamar.length} santri alfa</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10 w-40">Nama</th>
                        <th className="px-2 py-2 text-center font-bold text-red-600 w-10">Σ Alfa</th>
                        {daysArr.map(d => (
                          <th key={d} className="px-1 py-2 text-center text-slate-400 font-normal w-7">{d.slice(8)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {santriKamar.map((s: any) => {
                        const alfa = malamAlfa[s.id] || 0
                        const detail = malamDetail[s.id] || {}
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 sticky left-0 bg-white z-10">
                              <p className="font-semibold text-slate-800 truncate max-w-[150px]">{s.nama_lengkap}</p>
                            </td>
                            <td className="px-2 py-2 text-center">
                              {alfa > 0
                                ? <span className="bg-red-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full">{alfa}</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            {daysArr.map(d => {
                              const st = detail[d]
                              return (
                                <td key={d} className="px-1 py-2 text-center">
                                  {st === 'ALFA'
                                    ? <span className="inline-block w-5 h-5 rounded bg-red-500 text-white text-[9px] font-black leading-5">A</span>
                                    : <span className="text-slate-200">·</span>
                                  }
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
          }))}
        </div>
      )}
    </div>
  )
}
