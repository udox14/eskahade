'use client'

import { useEffect, useMemo, useState } from 'react'
import { tandaiTelatMassal, getPeriodeAktif } from '../actions'
import {
  getMonitoringAggregate,
  getMonitoringPerKamar,
  getMonitoringSantriKamar,
  getSessionMonitoring,
} from './actions'
import {
  AlertTriangle,
  Bus,
  CalendarRange,
  Car,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

type AggregateRow = {
  asrama: string
  total: number
  sudah_pulang: number
  belum_pulang: number
  sudah_datang: number
  belum_datang: number
  telat: number
}

type KamarRow = {
  kamar: string
  total: number
  sudah_pulang: number
  belum_pulang: number
  sudah_datang: number
  belum_datang: number
  telat: number
}

type SantriRow = {
  id: string
  nama_lengkap: string
  nis: string
  jenis_pulang: string | null
  status_pulang: string
  status_datang: string
  keterangan: string | null
  tgl_pulang: string | null
  tgl_datang: string | null
}

function localTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function PctBar({
  value,
  total,
  color,
}: {
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] font-bold text-slate-400">{pct}%</span>
    </div>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'slate' | 'amber' | 'emerald' | 'rose'
}) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
  } as const

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}

function JenisBadge({ jenis }: { jenis: SantriRow['jenis_pulang'] }) {
  if (jenis === 'ROMBONGAN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-1 text-[10px] font-bold text-teal-700">
        <Bus className="h-3 w-3" />
        Romb.
      </span>
    )
  }

  if (jenis === 'DIJEMPUT') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">
        <Car className="h-3 w-3" />
        Jemput
      </span>
    )
  }

  return null
}

function SantriBadge({ row }: { row: SantriRow }) {
  if (row.status_pulang !== 'PULANG') {
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Belum Pulang</span>
  }
  if (row.status_datang === 'SUDAH') {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">Sudah Datang</span>
  }
  if (row.status_datang === 'TELAT' || row.status_datang === 'VONIS') {
    return <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">{row.status_datang}</span>
  }
  return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Belum Datang</span>
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-76px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function KamarDetailModal({
  periodeId,
  asrama,
  kamar,
  onClose,
}: {
  periodeId: number
  asrama: string
  kamar: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<SantriRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getMonitoringSantriKamar(periodeId, asrama, kamar).then((data) => {
      if (!active) return
      setRows(data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [periodeId, asrama, kamar])

  return (
    <ModalShell
      title={`Kamar ${kamar}`}
      description={`Detail santri ${asrama} pada kamar ${kamar}.`}
      onClose={onClose}
    >
      {loading ? (
        <div className="flex justify-center gap-2 py-14 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Memuat santri...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-400">Tidak ada data santri pada kamar ini.</div>
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-slate-800">{row.nama_lengkap}</p>
                    <SantriBadge row={row} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <JenisBadge jenis={row.jenis_pulang} />
                    <span>Pulang {localTime(row.tgl_pulang)}</span>
                    <span>Datang {localTime(row.tgl_datang)}</span>
                  </div>
                </div>
              </div>
              {row.keterangan ? (
                <p className="mt-2 text-xs text-slate-500">{row.keterangan}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </ModalShell>
  )
}

function AsramaDetailModal({
  periodeId,
  row,
  onClose,
}: {
  periodeId: number
  row: AggregateRow
  onClose: () => void
}) {
  const [rooms, setRooms] = useState<KamarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKamar, setSelectedKamar] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getMonitoringPerKamar(periodeId, row.asrama).then((data) => {
      if (!active) return
      setRooms(data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [periodeId, row.asrama])

  return (
    <>
      <ModalShell
        title={row.asrama}
        description="Ringkasan per kamar. Ketuk salah satu kamar untuk melihat daftar santri."
        onClose={onClose}
      >
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-4">
          <StatChip label="Total" value={row.total} tone="slate" />
          <StatChip label="Pulang" value={row.sudah_pulang} tone="amber" />
          <StatChip label="Datang" value={row.sudah_datang} tone="emerald" />
          <StatChip label="Telat" value={row.telat} tone="rose" />
        </div>

        {loading ? (
          <div className="flex justify-center gap-2 py-14 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat rekap kamar...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400">Belum ada data kamar untuk asrama ini.</div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {rooms.map((room) => (
              <button
                key={room.kamar}
                onClick={() => setSelectedKamar(room.kamar)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800">Kamar {room.kamar}</p>
                      {room.telat > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">
                          {room.telat} telat
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {room.total} santri • {room.belum_pulang} belum pulang • {room.belum_datang} belum datang
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <span>Keberangkatan</span>
                      <span>{room.sudah_pulang}/{room.total}</span>
                    </div>
                    <PctBar value={room.sudah_pulang} total={room.total} color="bg-amber-400" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <span>Kepulangan</span>
                      <span>{room.sudah_datang}/{room.sudah_pulang || 0}</span>
                    </div>
                    <PctBar value={room.sudah_datang} total={room.sudah_pulang || 1} color="bg-emerald-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ModalShell>

      {selectedKamar ? (
        <KamarDetailModal
          periodeId={periodeId}
          asrama={row.asrama}
          kamar={selectedKamar}
          onClose={() => setSelectedKamar(null)}
        />
      ) : null}
    </>
  )
}

export default function MonitoringPerpulanganPage() {
  const [session, setSession] = useState<any>(null)
  const [periode, setPeriode] = useState<any>(null)
  const [rows, setRows] = useState<AggregateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tandaiLoading, setTandaiLoading] = useState(false)
  const [selectedAsrama, setSelectedAsrama] = useState<AggregateRow | null>(null)

  const load = async () => {
    setLoading(true)
    const [sessionInfo, activePeriode] = await Promise.all([getSessionMonitoring(), getPeriodeAktif()])
    setSession(sessionInfo)
    setPeriode(activePeriode)

    if (activePeriode?.id) {
      const asramaFilter = sessionInfo?.role === 'pengurus_asrama'
        ? sessionInfo.asrama_binaan ?? undefined
        : undefined
      const data = await getMonitoringAggregate(activePeriode.id, asramaFilter)
      setRows(data)
    } else {
      setRows([])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleTandaiTelat = async () => {
    if (!periode?.id) return
    setTandaiLoading(true)
    const res = await tandaiTelatMassal(periode.id)
    setTandaiLoading(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    toast.success(`${res.count} santri ditandai telat.`)
    await load()
  }

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    sudah_pulang: acc.sudah_pulang + row.sudah_pulang,
    sudah_datang: acc.sudah_datang + row.sudah_datang,
    belum_datang: acc.belum_datang + row.belum_datang,
    telat: acc.telat + row.telat,
  }), {
    total: 0,
    sudah_pulang: 0,
    sudah_datang: 0,
    belum_datang: 0,
    telat: 0,
  }), [rows])

  const canTandaiTelat = ['admin', 'keamanan', 'dewan_santri'].includes(session?.role ?? '')

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-24 lg:max-w-6xl">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <DashboardPageHeader
          title="Monitoring Perpulangan"
          description={periode?.nama_periode ?? 'Pantau progres perpulangan dan kedatangan santri per asrama.'}
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2">
          {canTandaiTelat && periode ? (
            <button
              onClick={handleTandaiTelat}
              disabled={tandaiLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {tandaiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Tandai Telat
            </button>
          ) : null}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Perbarui
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Memuat monitoring perpulangan...</span>
        </div>
      ) : !periode ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <CalendarRange className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-lg font-bold text-slate-700">Belum ada periode aktif</p>
          <p className="mt-2 text-sm text-slate-500">Aktifkan periode perpulangan terlebih dahulu untuk membuka monitoring.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          Belum ada data perpulangan pada periode ini.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
            <StatChip label="Total Santri" value={totals.total} tone="slate" />
            <StatChip label="Sudah Pulang" value={totals.sudah_pulang} tone="amber" />
            <StatChip label="Sudah Datang" value={totals.sudah_datang} tone="emerald" />
            <StatChip label="Belum Datang" value={totals.belum_datang} tone="amber" />
            <StatChip label="Telat" value={totals.telat} tone="rose" />
          </section>

          <section className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {rows.map((row) => (
              <article key={row.asrama} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-slate-800">{row.asrama}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.total} santri • {row.belum_pulang} belum pulang • {row.belum_datang} belum datang
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedAsrama(row)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                    title="Lihat detail"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <StatChip label="Pulang" value={row.sudah_pulang} tone="amber" />
                  <StatChip label="Datang" value={row.sudah_datang} tone="emerald" />
                  <StatChip label="Telat" value={row.telat} tone="rose" />
                </div>

                <div className="mt-4 space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <span>Keberangkatan</span>
                      <span>{row.sudah_pulang}/{row.total}</span>
                    </div>
                    <PctBar value={row.sudah_pulang} total={row.total} color="bg-amber-400" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <span>Kepulangan</span>
                      <span>{row.sudah_datang}/{row.sudah_pulang || 0}</span>
                    </div>
                    <PctBar value={row.sudah_datang} total={row.sudah_pulang || 1} color="bg-emerald-400" />
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {selectedAsrama && periode ? (
        <AsramaDetailModal
          periodeId={periode.id}
          row={selectedAsrama}
          onClose={() => setSelectedAsrama(null)}
        />
      ) : null}
    </div>
  )
}
