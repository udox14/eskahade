'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionRekap, getRekapAbsenMalam, getKamarList, getRiwayatAlfaAbsenMalam, deleteAbsenMalamRecord } from '../rekap-asrama/actions'
import { CalendarDays, History, Moon, Home, Loader2, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'
import { toast } from '@/lib/toast'
import { Button, TextInput, NativeSelect, ActionIcon, SegmentedControl } from '@mantine/core'

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
  const [tanggal, setTanggal] = useState('')
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
  const tanggalRef = useRef(tanggal)

  useEffect(() => {
    asramaRef.current = asrama
    setFilterKamar('Semua')
    getKamarList(asrama).then(k => setAvailableKamars(k))
  }, [asrama])
  useEffect(() => { bulanRef.current = bulan }, [bulan])
  useEffect(() => { tanggalRef.current = tanggal }, [tanggal])

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
        getRekapAbsenMalam(asramaRef.current, bulanRef.current, tanggalRef.current || undefined),
        getRiwayatAlfaAbsenMalam(asramaRef.current),
      ])
      setMalamSantri(malam.santriList)
      setMalamAlfa(malam.alfaPerSantri)
      setMalamDetail(malam.detailPerSantri)
      setRiwayatAlfa(riwayat)
      setHasLoaded(true)
    } catch (error: any) {
      console.error(error)
      toast.error("Gagal memuat rekap absen malam.", { description: error?.message || "Unknown error" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAlfa = async (santriId: string, nama: string, tanggalStr: string) => {
    const ok = window.confirm(`Apakah Anda yakin ingin membatalkan status ALFA untuk ${nama} pada tanggal ${formatTanggal(tanggalStr)}?`)
    if (!ok) return

    setLoading(true)
    try {
      const res = await deleteAbsenMalamRecord(santriId, tanggalStr)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      await load()
    } catch (e: any) {
      toast.error("Gagal membatalkan alfa", { description: e?.message || String(e) })
    } finally {
      setLoading(false)
    }
  }

  const days = getDaysInMonth(bulan)
  const daysArr = tanggal
    ? [tanggal]
    : Array.from({ length: days }, (_, i) => {
        const d = String(i + 1).padStart(2, '0')
        return `${bulan}-${d}`
      })

  const handleTanggalChange = (value: string) => {
    setTanggal(value)
    if (value) setBulan(value.slice(0, 7))
  }

  const handleBulanChange = (next: string) => {
    setBulan(next)
    setTanggal('')
  }

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
    <div className="space-y-5 pb-16">

      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Rekap Absen Malam"
          description="Rekap absensi malam per bulan."
          className="flex-1"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-1 shadow-sm">
            <ActionIcon
              onClick={() => handleBulanChange(prevBulan(bulan))}
              variant="subtle"
              color="gray"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </ActionIcon>
            <span className="text-sm font-bold text-slate-700 min-w-[130px] text-center">{formatBulan(bulan)}</span>
            <ActionIcon
              onClick={() => handleBulanChange(nextBulan(bulan))}
              disabled={bulan >= bulanIni()}
              variant="subtle"
              color="gray"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </ActionIcon>
          </div>

          {sessionInfo?.asrama_binaan
            ? <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" /> {sessionInfo.asrama_binaan}
              </span>
            : <NativeSelect
                value={asrama}
                onChange={e => setAsrama(e.target.value)}
                data={ASRAMA_LIST.map(a => ({ label: a, value: a }))}
              />
          }

          <TextInput
            type="date"
            value={tanggal}
            onChange={e => handleTanggalChange(e.target.value)}
            leftSection={<CalendarDays className="h-4 w-4" />}
            rightSection={tanggal
              ? <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() => setTanggal('')}
                  title="Tampilkan semua tanggal bulan ini"
                >
                  <X className="h-3.5 w-3.5" />
                </ActionIcon>
              : null
            }
            title="Filter tanggal"
          />

          <NativeSelect
            value={filterKamar}
            onChange={e => setFilterKamar(e.target.value)}
            disabled={availableKamars.length === 0}
            data={[
              { label: 'Semua Kamar', value: 'Semua' },
              ...availableKamars.map(k => ({ label: k === 'Tanpa Kamar' ? k : `Kamar ${k}`, value: k })),
            ]}
          />

          <Button
            onClick={load}
            loading={loading}
            leftSection={loading ? null : <Search className="w-4 h-4" />}
            color={!hasLoaded ? 'indigo' : 'gray'}
            variant={!hasLoaded ? 'filled' : 'light'}
          >
            {hasLoaded ? 'Perbarui' : 'Tampilkan'}
          </Button>
        </div>
      </div>

      {hasLoaded && !loading && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            value={activeTab}
            onChange={v => setActiveTab(v as 'bulan' | 'riwayat')}
            data={[
              { label: <span className="flex items-center gap-2"><Moon className="h-4 w-4" />Rekap Bulan Ini</span>, value: 'bulan' },
              { label: <span className="flex items-center gap-2"><History className="h-4 w-4" />Riwayat Semua Alfa</span>, value: 'riwayat' },
            ]}
          />
          <TextInput
            placeholder="Cari nama santri..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftSection={<Search className="w-4 h-4" />}
            className="w-full sm:w-64"
          />
        </div>
      )}

      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
            <Moon className="w-10 h-10 text-indigo-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-500">Data belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih asrama, bulan atau tanggal, lalu tekan <strong>Tampilkan</strong>.</p>
          </div>
          <Button onClick={load} color="indigo">Tampilkan Sekarang</Button>
        </div>

      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
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
                          <span key={`${santri.id}-${item.tanggal}`} className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 pl-2 pr-1.5 py-1 text-xs font-semibold text-red-700">
                            <span>
                              {formatTanggal(item.tanggal)}
                              {item.keterangan ? ` - ${item.keterangan}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelAlfa(santri.id, santri.nama_lengkap, item.tanggal)}
                              className="rounded-md p-0.5 hover:bg-red-200 hover:text-red-900 transition-colors cursor-pointer"
                              title={`Batalkan Alfa tanggal ${item.tanggal}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
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
                  <span className="text-xs text-slate-400">
                    {santriKamar.length} santri alfa{tanggal ? ` pada ${formatTanggal(tanggal)}` : ''}
                  </span>
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
                                  {st === 'ALFA' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelAlfa(s.id, s.nama_lengkap, d)}
                                      className="inline-block w-5 h-5 rounded bg-red-500 text-white text-[9px] font-black leading-5 hover:bg-red-600 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                      title={`Batalkan Alfa ${s.nama_lengkap} tanggal ${d}`}
                                    >
                                      A
                                    </button>
                                  ) : (
                                    <span className="text-slate-200">·</span>
                                  )}
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
