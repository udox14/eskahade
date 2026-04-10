'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionRekap, getRekapAbsenMalam, getRekapAbsenBerjamaah } from './actions'
import { BarChart3, Moon, Sun, Home, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const WAKTU = ['shubuh', 'ashar', 'maghrib', 'isya'] as const
type Waktu = typeof WAKTU[number]
const WAKTU_LABEL: Record<Waktu, string> = { shubuh: 'Shb', ashar: 'Ash', maghrib: 'Mgr', isya: 'Isy' }

function bulanIni() { return new Date().toISOString().slice(0, 7) }
function getDaysInMonth(bulan: string) { const [y, m] = bulan.split('-').map(Number); return new Date(y, m, 0).getDate() }
function formatBulan(bulan: string) { const [y, m] = bulan.split('-').map(Number); return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }
function prevBulan(b: string) { const [y, m] = b.split('-').map(Number); return new Date(y, m - 2).toISOString().slice(0, 7) }
function nextBulan(b: string) { const [y, m] = b.split('-').map(Number); return new Date(y, m).toISOString().slice(0, 7) }

const STATUS_COLOR: Record<string, string> = {
  'A': 'bg-red-500 text-white',
  'S': 'bg-orange-400 text-white',
  'H': 'bg-purple-400 text-white',
  'P': 'bg-blue-400 text-white',
  'ALFA': 'bg-red-500 text-white',
}

export default function RekapAsramaPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [bulan, setBulan] = useState(bulanIni())
  const [tab, setTab] = useState<'malam' | 'berjamaah'>('malam')
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [malamSantri, setMalamSantri] = useState<any[]>([])
  const [malamAlfa, setMalamAlfa] = useState<Record<string, number>>({})
  const [malamDetail, setMalamDetail] = useState<Record<string, Record<string, string>>>({})
  const [bjSantri, setBjSantri] = useState<any[]>([])
  const [bjDetail, setBjDetail] = useState<Record<string, Record<string, any>>>({})

  const sessionInfoRef = useRef<any>(null)
  const asramaRef = useRef(asrama)
  const bulanRef = useRef(bulan)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => { asramaRef.current = asrama }, [asrama])
  useEffect(() => { bulanRef.current = bulan }, [bulan])

  useEffect(() => {
    getSessionRekap().then(s => {
      setSessionInfo(s)
      sessionInfoRef.current = s
      if (s?.asrama_binaan) { setAsrama(s.asrama_binaan); asramaRef.current = s.asrama_binaan }
      setSessionReady(true)
    })
  }, [])

  useEffect(() => {
    if (sessionReady && sessionInfoRef.current?.asrama_binaan) load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady])

  async function load() {
    setLoading(true)
    try {
      const currentAsrama = asramaRef.current
      const currentBulan = bulanRef.current
      const si = sessionInfoRef.current
      const hideHaid = !si?.isPutri || si?.role === 'keamanan'
      const isPutriAsrama = ASRAMA_PUTRI.includes(currentAsrama)
      const [malam, bj] = await Promise.all([
        getRekapAbsenMalam(currentAsrama, currentBulan),
        isPutriAsrama ? getRekapAbsenBerjamaah(currentAsrama, currentBulan, hideHaid) : Promise.resolve({ santriList: [], detail: {} })
      ])
      setMalamSantri(malam.santriList); setMalamAlfa(malam.alfaPerSantri); setMalamDetail(malam.detailPerSantri)
      setBjSantri(bj.santriList); setBjDetail(bj.detail)
      setHasLoaded(true)
      if (!isPutriAsrama) setTab('malam')
    } finally { setLoading(false) }
  }

  const days = getDaysInMonth(bulan)
  const daysArr = Array.from({ length: days }, (_, i) => { const d = String(i + 1).padStart(2, '0'); return `${bulan}-${d}` })
  const grouped = (list: any[]) => list.reduce((acc, s) => { const k = s.kamar || 'Tanpa Kamar'; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc }, {} as Record<string, any[]>)
  const sortedKamars = (list: any[]) => Object.keys(grouped(list)).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
  const isPutri = ASRAMA_PUTRI.includes(asrama)

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
              <BarChart3 className="w-5 h-5"/>
            </div>
            Rekap Absen Asrama
          </h1>
          <p className="text-sm text-muted-foreground font-medium ml-[3.25rem]">Absen malam & shalat berjamaah</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-xl px-2 py-1 shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setBulan(b => prevBulan(b))} className="h-8 w-8 rounded-lg">
              <ChevronLeft className="w-4 h-4"/>
            </Button>
            <span className="text-sm font-black text-foreground min-w-[130px] text-center">{formatBulan(bulan)}</span>
            <Button variant="ghost" size="icon" onClick={() => setBulan(b => nextBulan(b))} disabled={bulan >= bulanIni()} className="h-8 w-8 rounded-lg disabled:opacity-30">
              <ChevronRight className="w-4 h-4"/>
            </Button>
          </div>

          {/* Asrama selector */}
          {sessionInfo?.asrama_binaan ? (
            <Badge className="bg-indigo-500/10 text-indigo-700 border-indigo-400/30 font-black h-10 px-3 rounded-xl flex items-center gap-1.5 border">
              <Home className="w-3.5 h-3.5"/> {sessionInfo.asrama_binaan}
            </Badge>
          ) : (
            <Select value={asrama} onValueChange={(v) => { if (v) setAsrama(v) }}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl font-bold shadow-sm focus:ring-0">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={load}
            disabled={loading}
            className={cn('gap-2 rounded-xl font-black h-10 shadow-sm', !hasLoaded ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-muted/80 text-foreground hover:bg-muted border border-border')}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin"/> Memuat...</> : <><Search className="w-4 h-4"/> {hasLoaded ? 'Perbarui' : 'Tampilkan'}</>}
          </Button>
        </div>
      </div>

      {/* KONTEN */}
      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center">
            <BarChart3 className="w-10 h-10 text-indigo-400"/>
          </div>
          <div>
            <p className="text-base font-black text-foreground">Data belum dimuat</p>
            <p className="text-sm text-muted-foreground mt-1">Pilih asrama & bulan lalu tekan <strong>Tampilkan</strong>.</p>
          </div>
          <Button onClick={load} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-8 shadow-sm">
            Tampilkan Sekarang
          </Button>
        </div>

      ) : loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400"/>
        </div>

      ) : (
        <>
          {hasLoaded && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'malam' | 'berjamaah')}>
              <TabsList className={cn('h-12 bg-muted/60 border border-border p-1.5 rounded-2xl', isPutri ? 'w-full sm:w-auto grid grid-cols-2' : 'w-auto')}>
                <TabsTrigger value="malam" className="font-black gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-6">
                  <Moon className="w-4 h-4"/> Absen Malam
                </TabsTrigger>
                {isPutri && (
                  <TabsTrigger value="berjamaah" className="font-black gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-6">
                    <Sun className="w-4 h-4"/> Berjamaah
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ABSEN MALAM */}
              <TabsContent value="malam" className="mt-4 space-y-4 outline-none">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="shadow-sm border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-foreground tabular-nums">{malamSantri.length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Total Santri</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-destructive/20 bg-destructive/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-destructive tabular-nums">{Object.values(malamAlfa).reduce((s, v) => s + v, 0)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-destructive/70 mt-1">Total Alfa</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-amber-300/30 bg-amber-500/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-black text-amber-600 tabular-nums">{Object.keys(malamAlfa).length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 mt-1">Pernah Alfa</p>
                    </CardContent>
                  </Card>
                </div>

                {malamSantri.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl bg-muted/10">
                    Tidak ada data absen malam untuk periode ini.
                  </div>
                ) : sortedKamars(malamSantri).map(kamar => {
                  const santriKamar = grouped(malamSantri)[kamar]
                  return (
                    <Card key={kamar} className="shadow-sm border-border overflow-hidden">
                      <div className="bg-foreground text-background px-4 py-2.5 flex justify-between items-center">
                        <span className="font-black text-sm">Kamar {kamar}</span>
                        <span className="text-xs opacity-60">{santriKamar.length} santri</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead className="bg-muted/50 border-b border-border/60">
                            <tr>
                              <th className="px-3 py-2 text-left sticky left-0 bg-muted/80 z-10 w-40 font-black uppercase tracking-widest text-[9px] text-muted-foreground">Nama</th>
                              <th className="px-2 py-2 text-center font-black text-destructive w-10 text-[9px] uppercase tracking-widest">Σ Alfa</th>
                              {daysArr.map(d => (
                                <th key={d} className="px-1 py-2 text-center text-muted-foreground/60 font-normal w-7 text-[9px]">{d.slice(8)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {santriKamar.map((s: any) => {
                              const alfa = malamAlfa[s.id] || 0
                              const detail = malamDetail[s.id] || {}
                              return (
                                <tr key={s.id} className="hover:bg-muted/20">
                                  <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                    <p className="font-bold text-foreground truncate max-w-[150px] text-xs">{s.nama_lengkap}</p>
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    {alfa > 0
                                      ? <span className="bg-destructive text-destructive-foreground font-black text-[10px] px-1.5 py-0.5 rounded-full">{alfa}</span>
                                      : <span className="text-muted-foreground/30">—</span>
                                    }
                                  </td>
                                  {daysArr.map(d => {
                                    const st = detail[d]
                                    return (
                                      <td key={d} className="px-1 py-2 text-center">
                                        {st === 'ALFA'
                                          ? <span className="inline-block w-5 h-5 rounded bg-destructive text-destructive-foreground text-[9px] font-black leading-5">A</span>
                                          : <span className="text-muted-foreground/20">·</span>
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
                    </Card>
                  )
                })}
              </TabsContent>

              {/* ABSEN BERJAMAAH */}
              <TabsContent value="berjamaah" className="mt-4 space-y-4 outline-none">
                {bjSantri.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl bg-muted/10">
                    Tidak ada data absen berjamaah untuk periode ini.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      {WAKTU.map(w => {
                        const alfa = bjSantri.reduce((s, santri) => s + Object.values(bjDetail[santri.id] || {}).filter((d: any) => d[w] === 'A').length, 0)
                        return (
                          <Card key={w} className="shadow-sm border-border">
                            <CardContent className="p-3 text-center">
                              <p className="text-xs text-muted-foreground font-bold capitalize mb-1">{w}</p>
                              <p className="text-xl font-black text-destructive tabular-nums">{alfa}</p>
                              <p className="text-[9px] text-muted-foreground/60 mt-0.5">alfa bulan ini</p>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    {sortedKamars(bjSantri).map(kamar => {
                      const santriKamar = grouped(bjSantri)[kamar]
                      return (
                        <Card key={kamar} className="shadow-sm border-teal-300/30 overflow-hidden">
                          <div className="bg-teal-900 text-teal-50 px-4 py-2.5 flex justify-between items-center">
                            <span className="font-black text-sm">Kamar {kamar}</span>
                            <span className="text-xs text-teal-300">{santriKamar.length} santri</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[600px]">
                              <thead className="bg-muted/50 border-b border-border/60">
                                <tr>
                                  <th className="px-3 py-2 text-left sticky left-0 bg-muted/80 z-10 w-36 font-black uppercase tracking-widest text-[9px] text-muted-foreground">Nama</th>
                                  {WAKTU.map(w => (
                                    <th key={w} className="px-1 py-2 text-center font-black text-muted-foreground w-10 text-[9px] uppercase">{WAKTU_LABEL[w]}</th>
                                  ))}
                                  {daysArr.map(d => (
                                    <th key={d} className="px-0.5 py-2 text-center text-muted-foreground/50 font-normal w-5 text-[9px]">{d.slice(8)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {santriKamar.map((s: any) => {
                                  const detail = bjDetail[s.id] || {}
                                  const counts: Record<Waktu, Record<string, number>> = { shubuh: {}, ashar: {}, maghrib: {}, isya: {} }
                                  Object.values(detail).forEach((d: any) => {
                                    WAKTU.forEach(w => { if (d[w]) counts[w][d[w]] = (counts[w][d[w]] || 0) + 1 })
                                  })
                                  return (
                                    <tr key={s.id} className="hover:bg-muted/20">
                                      <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                        <p className="font-bold text-foreground truncate max-w-[130px] text-xs">{s.nama_lengkap}</p>
                                      </td>
                                      {WAKTU.map(w => {
                                        const a = counts[w]['A'] || 0
                                        const nonH = Object.values(counts[w]).reduce((s, v) => s + v, 0)
                                        return (
                                          <td key={w} className="px-1 py-2 text-center">
                                            {a > 0
                                              ? <span className="inline-block bg-destructive text-destructive-foreground font-black text-[9px] px-1 py-0.5 rounded-full min-w-[16px]">{a}</span>
                                              : nonH > 0
                                                ? <span className="inline-block bg-amber-200 text-amber-700 font-bold text-[9px] px-1 py-0.5 rounded-full min-w-[16px]">{nonH}</span>
                                                : <span className="text-muted-foreground/20">—</span>
                                            }
                                          </td>
                                        )
                                      })}
                                      {daysArr.map(d => {
                                        const dayData = detail[d]
                                        const hasIssue = dayData && WAKTU.some(w => dayData[w] !== null)
                                        if (!hasIssue) return <td key={d} className="px-0.5 py-2 text-center"><span className="text-muted-foreground/20 text-[9px]">·</span></td>
                                        return (
                                          <td key={d} className="px-0.5 py-1 text-center">
                                            <div className="flex flex-col gap-0.5 items-center">
                                              {WAKTU.map(w => {
                                                const st = dayData?.[w]
                                                if (!st) return null
                                                return (
                                                  <span key={w} className={cn('inline-block text-[8px] font-black w-4 h-4 rounded leading-4 text-center', STATUS_COLOR[st] || 'bg-muted text-muted-foreground')}>
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
                        </Card>
                      )
                    })}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}