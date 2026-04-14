'use client'

import { useState, useEffect } from 'react'
import {
  getPeriodeAktif, tandaiTelatMassal,
} from '../actions'
import {
  getSessionMonitoring, getMonitoringAggregate,
  getMonitoringPerKamar, getMonitoringSantriKamar,
} from './actions'
import {
  LayoutList, ChevronDown, ChevronRight, Loader2, CalendarRange,
  Bus, Car, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

function PctBar({ val, total, color }: { val: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-6 text-right">{pct}%</span>
    </div>
  )
}

function BadgeSantri({ status, jenis }: { status: string; jenis: string | null }) {
  if (status === 'SUDAH')
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">DATANG</span>
  if (status === 'TELAT' || status === 'VONIS')
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">TELAT</span>
  if (jenis === null)
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">PULANG</span>
  return null
}

// ─── Row santri (level 3) ────────────────────────────────────────────────────
function RowSantri({ s }: { s: any }) {
  const pulang = s.status_pulang === 'PULANG'
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{s.nama_lengkap}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-400">{s.nis}</span>
          {s.jenis_pulang === 'ROMBONGAN' && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-teal-600">
              <Bus className="w-2.5 h-2.5" /> ROMBONGAN
            </span>
          )}
          {s.jenis_pulang === 'DIJEMPUT' && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-purple-600">
              <Car className="w-2.5 h-2.5" /> DIJEMPUT
            </span>
          )}
        </div>
        {s.keterangan && <p className="text-[10px] text-slate-400 italic mt-0.5">"{s.keterangan}"</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {pulang ? (
          <BadgeSantri status={s.status_datang} jenis={s.status_datang} />
        ) : (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">BELUM PULANG</span>
        )}
        {s.tgl_datang && (
          <span className="text-[9px] text-slate-300">
            {new Date(s.tgl_datang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Accordion kamar (level 2) ───────────────────────────────────────────────
function AccordionKamar({
  kamarRow, periodeId, asrama,
}: { kamarRow: any; periodeId: number; asrama: string }) {
  const [open, setOpen] = useState(false)
  const [santriList, setSantriList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const handleOpen = async () => {
    if (!open && !loaded) {
      setLoading(true)
      const res = await getMonitoringSantriKamar(periodeId, asrama, kamarRow.kamar)
      setSantriList(res)
      setLoaded(true)
      setLoading(false)
    }
    setOpen(o => !o)
  }

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-sm">Kamar {kamarRow.kamar}</span>
            <span className="text-xs text-slate-400">{kamarRow.total} santri</span>
          </div>
          <div className="flex gap-3 mt-1 text-[10px]">
            <span className="text-amber-600 font-medium">{kamarRow.sudah_pulang} pulang</span>
            <span className="text-emerald-600 font-medium">{kamarRow.sudah_datang} datang</span>
            {kamarRow.telat > 0 && <span className="text-rose-600 font-bold">{kamarRow.telat} telat</span>}
          </div>
          <PctBar val={kamarRow.sudah_datang} total={kamarRow.sudah_pulang || 1} color="bg-emerald-400" />
        </div>
      </button>
      {open && (
        <div className="bg-slate-50/50">
          {loading ? (
            <div className="flex justify-center py-4 gap-2 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat santri...
            </div>
          ) : santriList.length === 0 ? (
            <p className="text-center py-4 text-slate-400 text-xs">Tidak ada data.</p>
          ) : (
            santriList.map(s => <RowSantri key={s.id} s={s} />)
          )}
        </div>
      )}
    </div>
  )
}

// ─── Accordion asrama (level 1) ──────────────────────────────────────────────
function AccordionAsrama({
  row, periodeId, canExpand,
}: { row: any; periodeId: number; canExpand: boolean }) {
  const [open, setOpen] = useState(false)
  const [kamarList, setKamarList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const handleOpen = async () => {
    if (!canExpand) return
    if (!open && !loaded) {
      setLoading(true)
      const res = await getMonitoringPerKamar(periodeId, row.asrama)
      setKamarList(res)
      setLoaded(true)
      setLoading(false)
    }
    setOpen(o => !o)
  }

  const pctPulang = row.total > 0 ? Math.round((row.sudah_pulang / row.total) * 100) : 0
  const pctDatang = row.sudah_pulang > 0 ? Math.round((row.sudah_datang / row.sudah_pulang) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={handleOpen}
        className={`w-full px-4 py-4 text-left ${canExpand ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        <div className="flex items-center gap-3">
          {canExpand && (
            open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                 : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800">{row.asrama}</h3>
              <span className="text-xs text-slate-400 font-medium">{row.total} santri</span>
            </div>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-amber-50 rounded-xl p-2 text-center border border-amber-100">
                <p className="text-base font-bold text-amber-700">{row.sudah_pulang}</p>
                <p className="text-[9px] text-amber-500 font-medium">Pulang</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-2 text-center border border-emerald-100">
                <p className="text-base font-bold text-emerald-700">{row.sudah_datang}</p>
                <p className="text-[9px] text-emerald-500 font-medium">Datang</p>
              </div>
              <div className={`rounded-xl p-2 text-center border ${row.telat > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-base font-bold ${row.telat > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{row.belum_datang}</p>
                <p className={`text-[9px] font-medium ${row.telat > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {row.telat > 0 ? `${row.telat} Telat` : 'Blm Datang'}
                </p>
              </div>
            </div>
            {/* Progress bars */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 w-14">Keberangkatan</span>
                <PctBar val={row.sudah_pulang} total={row.total} color="bg-amber-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 w-14">Kepulangan</span>
                <PctBar val={row.sudah_datang} total={row.sudah_pulang || 1} color="bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Level 2: per kamar */}
      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="flex justify-center py-4 gap-2 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat kamar...
            </div>
          ) : kamarList.length === 0 ? (
            <p className="text-center py-4 text-slate-400 text-xs">Tidak ada data kamar.</p>
          ) : (
            kamarList.map(k => (
              <AccordionKamar
                key={k.kamar}
                kamarRow={k}
                periodeId={periodeId}
                asrama={row.asrama}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MonitoringPerpulanganPage() {
  const [session, setSession] = useState<any>(null)
  const [periode, setPeriode] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tandaiLoading, setTandaiLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const [s, p] = await Promise.all([getSessionMonitoring(), getPeriodeAktif()])
    setSession(s)
    setPeriode(p)
    if (p?.id) {
      const asramaFilter = s?.role === 'pengurus_asrama' ? s.asrama_binaan ?? undefined : undefined
      const data = await getMonitoringAggregate(p.id, asramaFilter)
      setRows(data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleTandaiTelat = async () => {
    if (!periode?.id) return
    setTandaiLoading(true)
    const res = await tandaiTelatMassal(periode.id)
    setTandaiLoading(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(`${res.count} santri ditandai TELAT`)
    load()
  }

  // Total aggregate
  const total = rows.reduce((a, r) => ({
    total: a.total + r.total,
    sudah_pulang: a.sudah_pulang + r.sudah_pulang,
    sudah_datang: a.sudah_datang + r.sudah_datang,
    belum_datang: a.belum_datang + r.belum_datang,
    telat: a.telat + r.telat,
  }), { total: 0, sudah_pulang: 0, sudah_datang: 0, belum_datang: 0, telat: 0 })

  // Client-side role checks on plain session data object
  const sessionRole = session?.role ?? ''
  const canExpand = sessionRole !== 'pengurus_asrama'
  const canTandaiTelat = ['admin', 'keamanan', 'dewan_santri'].includes(sessionRole)

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-blue-600" /> Monitoring Perpulangan
          </h1>
          {periode && (
            <p className="text-sm text-slate-500 mt-0.5">{periode.nama_periode}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {canTandaiTelat && periode && (
            <button
              onClick={handleTandaiTelat}
              disabled={tandaiLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {tandaiLoading ? 'Memproses...' : 'Tandai Telat'}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Perbarui
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat data...</span>
        </div>
      ) : !periode ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
          <CalendarRange className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Belum Ada Periode Aktif</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          Belum ada data perpulangan.
        </div>
      ) : (
        <>
          {/* Summary card (hanya kalau bisa lihat semua asrama) */}
          {canExpand && rows.length > 1 && (
            <div className="bg-slate-900 text-white rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Total Semua Asrama</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold">{total.total}</p>
                  <p className="text-[9px] text-slate-400">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-400">{total.sudah_pulang}</p>
                  <p className="text-[9px] text-slate-400">Pulang</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-400">{total.sudah_datang}</p>
                  <p className="text-[9px] text-slate-400">Datang</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${total.telat > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{total.belum_datang}</p>
                  <p className="text-[9px] text-slate-400">Blm Datang</p>
                </div>
              </div>
            </div>
          )}

          {/* List per asrama */}
          <div className="space-y-3">
            {rows.map(r => (
              <AccordionAsrama
                key={r.asrama}
                row={r}
                periodeId={periode.id}
                canExpand={canExpand}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
