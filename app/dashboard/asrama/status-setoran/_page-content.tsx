'use client'

import { useState, useEffect } from 'react'
import { getStatusSetoranSaya } from './actions'
import { Loader2, CheckCircle, XCircle, Calendar, Home, AlertCircle, ChevronLeft, ChevronRight, Banknote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function StatusSetoranPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [statusData, setStatusData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [tahun])

  const loadData = async () => {
    setLoading(true)
    const res = await getStatusSetoranSaya(tahun)
    setStatusData(res)
    setLoading(false)
  }

  const currentMonth = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Banknote className="w-5 h-5" />
            </div>
            Status Setoran Asrama
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Rekapitulasi setoran SPP {statusData?.asrama ? `Asrama ${statusData.asrama}` : ''} ke Pusat.
          </p>
        </div>

        {/* Year Navigator */}
        <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-2xl p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTahun(t => t - 1)}
            className="h-9 w-9 rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-3 font-black text-foreground flex items-center gap-2 tabular-nums">
            <Calendar className="w-4 h-4 text-muted-foreground" /> {tahun}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTahun(t => t + 1)}
            className="h-9 w-9 rounded-xl"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500" />
          <p className="text-muted-foreground text-sm mt-3 font-medium">Memuat data...</p>
        </div>
      ) : statusData?.error ? (
        <Card className="shadow-sm border-destructive/30 bg-destructive/5">
          <CardContent className="p-8 text-center text-destructive space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-bold">{statusData.error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary statsbar */}
          {statusData?.data && (
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const lunas = Object.values(statusData.data as Record<string, any>).length
                const belum = BULAN_LIST.filter((_, idx) => {
                  const bulanIndex = idx + 1
                  const isPast = (tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonth)
                  return isPast && !statusData.data[bulanIndex]
                }).length
                const belumJatuhTempo = BULAN_LIST.filter((_, idx) => {
                  const bulanIndex = idx + 1
                  const isPast = (tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonth)
                  return !isPast && !statusData.data[bulanIndex]
                }).length
                return (
                  <>
                    <Card className="shadow-sm border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-black text-emerald-600 tabular-nums">{lunas}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Sudah Setor</p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-black text-destructive tabular-nums">{belum}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Belum Setor</p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-black text-muted-foreground tabular-nums">{belumJatuhTempo}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Belum Tempo</p>
                      </CardContent>
                    </Card>
                  </>
                )
              })()}
            </div>
          )}

          {/* Grid bulan */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {BULAN_LIST.map((namaBulan, idx) => {
              const bulanIndex = idx + 1
              const info = statusData.data[bulanIndex]
              const isLunas = !!info
              const isPast = (tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonth)
              const isCurrent = isCurrentYear && bulanIndex === currentMonth

              return (
                <Card
                  key={bulanIndex}
                  className={cn(
                    "overflow-hidden shadow-sm border transition-all flex flex-col justify-between min-h-[120px]",
                    isLunas
                      ? "border-emerald-300/50 bg-emerald-500/5 dark:bg-emerald-950/30"
                      : isPast
                        ? "border-destructive/30 bg-destructive/5 dark:bg-red-950/20"
                        : isCurrent
                          ? "border-indigo-300/50 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                          : "border-border/60 bg-card"
                  )}
                >
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <span className={cn(
                        "font-black text-base leading-tight",
                        isLunas ? "text-emerald-700 dark:text-emerald-400" :
                        isPast ? "text-destructive dark:text-red-400" :
                        isCurrent ? "text-indigo-600 dark:text-indigo-400" : "text-foreground"
                      )}>
                        {namaBulan}
                      </span>
                      {isLunas
                        ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        : isPast
                          ? <XCircle className="w-5 h-5 text-destructive/70 shrink-0" />
                          : null
                      }
                    </div>

                    <div className="mt-auto">
                      {isLunas ? (
                        <>
                          <Badge className="text-[9px] font-black bg-emerald-500/10 text-emerald-700 border-emerald-300/50 hover:bg-emerald-500/15 shadow-none mb-1.5 border">
                            SUDAH DISETOR
                          </Badge>
                          <p className="text-[10px] text-emerald-600/80 font-medium leading-relaxed">
                            {new Date(info.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}<br/>
                            Oleh: {info.penerima}
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge
                            variant={isPast ? "destructive" : "outline"}
                            className={cn(
                              "text-[9px] font-black shadow-none mb-1.5",
                              !isPast && "text-muted-foreground"
                            )}
                          >
                            {isPast ? 'BELUM SETOR' : 'BELUM TEMPO'}
                          </Badge>
                          {isPast && (
                            <p className="text-[10px] text-destructive/70 font-medium leading-relaxed">
                              Segera hubungi Dewan Santri
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}