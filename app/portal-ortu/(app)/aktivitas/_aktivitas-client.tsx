'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react'
import { formatTanggalId, namaBulanId } from '@/lib/portal/format'
import { isHoliday, VALID_SESI, type SessionType } from '@/lib/absensi/pengajian'
import type { RekapAbsensiAnak, PelanggaranAnak } from '@/lib/portal/data'

interface AktivitasClientProps {
  rekapBulan: RekapAbsensiAnak
  rekap7Hari: RekapAbsensiAnak
  pelanggaran: PelanggaranAnak[]
  currentYear: number
  currentMonth: number
  todayStr: string
}

type SessionStatus = 'H' | 'S' | 'I' | 'A' | 'L' | '-'

function shiftBulan(tahun: number, bulan: number, delta: number) {
  const d = new Date(Date.UTC(tahun, bulan - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function getDotClass(status: SessionStatus) {
  switch (status) {
    case 'H':
      return 'bg-emerald-500'
    case 'S':
      return 'bg-slate-400'
    case 'I':
      return 'bg-amber-400'
    case 'A':
      return 'bg-red-500'
    case 'L':
      return 'bg-slate-200' // Libur: Abu-abu netral, tidak hijau
    case '-':
    default:
      return 'bg-slate-200/60 ring-1 ring-inset ring-slate-300'
  }
}

function SessionCard({ sesiName, status }: { sesiName: string; status: SessionStatus }) {
  if (status === 'L') {
    return (
      <div className="rounded-xl border border-slate-200/60 bg-slate-100/70 p-2.5 text-center space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{sesiName}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-500 border border-slate-200/80 shadow-2xs">
          Libur
        </span>
      </div>
    )
  }

  let badge = null
  if (status === 'H') {
    badge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        Hadir
      </span>
    )
  } else if (status === 'S') {
    badge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        Sakit
      </span>
    )
  } else if (status === 'I') {
    badge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        Izin
      </span>
    )
  } else if (status === 'A') {
    badge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
        Alfa
      </span>
    )
  } else {
    badge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200/60">
        Belum disahkan
      </span>
    )
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center space-y-1 shadow-2xs">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{sesiName}</span>
      {badge}
    </div>
  )
}

export function AktivitasClient({
  rekapBulan,
  rekap7Hari,
  pelanggaran,
  currentYear,
  currentMonth,
  todayStr,
}: AktivitasClientProps) {
  const [activeTab, setActiveTab] = useState<'KEHADIRAN' | 'PELANGGARAN'>('KEHADIRAN')
  const [kehadiranMode, setKehadiranMode] = useState<'MINGGUAN' | 'BULANAN'>('MINGGUAN')

  // Map detail ketidakhadiran per tanggal untuk 7 hari & bulanan
  const detail7HariMap = useMemo(() => {
    const map = new Map<string, { shubuh: string | null; ashar: string | null; maghrib: string | null }>()
    rekap7Hari.detail.forEach(d => map.set(d.tanggal, d))
    return map
  }, [rekap7Hari.detail])

  const validDates7HariSet = useMemo(() => {
    return new Set(rekap7Hari.validDates || [])
  }, [rekap7Hari.validDates])

  const libur7HariSet = useMemo(() => {
    return new Set(rekap7Hari.liburSesi || [])
  }, [rekap7Hari.liburSesi])

  const detailBulanMap = useMemo(() => {
    const map = new Map<string, { shubuh: string | null; ashar: string | null; maghrib: string | null }>()
    rekapBulan.detail.forEach(d => map.set(d.tanggal, d))
    return map
  }, [rekapBulan.detail])

  const validDatesBulanSet = useMemo(() => {
    return new Set(rekapBulan.validDates || [])
  }, [rekapBulan.validDates])

  const liburBulanSet = useMemo(() => {
    return new Set(rekapBulan.liburSesi || [])
  }, [rekapBulan.liburSesi])

  // Helper untuk menentukan status sesi
  function resolveSessionStatus(
    dateStr: string,
    sesi: SessionType,
    detailMap: Map<string, { shubuh: string | null; ashar: string | null; maghrib: string | null }>,
    validSet: Set<string>,
    liburSet: Set<string>
  ): SessionStatus {
    if (isHoliday(dateStr, sesi) || liburSet.has(`${dateStr}-${sesi}`)) {
      return 'L'
    }
    if (!validSet.has(dateStr)) {
      return '-'
    }
    const row = detailMap.get(dateStr)
    if (row) {
      const s = row[sesi]
      if (s === 'S' || s === 'I' || s === 'A') return s
    }
    return 'H'
  }

  // 1. Data 7 Hari Terakhir
  const days7 = useMemo(() => {
    const result: { dateStr: string; dayNum: number; dayName: string; fullDateStr: string }[] = []
    const HARI_SINGKAT = ['Ahd', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const base = new Date(`${todayStr}T12:00:00Z`)
    for (let i = 6; i >= 0; i--) {
      const cur = new Date(base)
      cur.setUTCDate(cur.getUTCDate() - i)
      const dateStr = cur.toISOString().split('T')[0]
      const dow = cur.getUTCDay()
      result.push({
        dateStr,
        dayNum: cur.getUTCDate(),
        dayName: HARI_SINGKAT[dow],
        fullDateStr: formatTanggalId(dateStr),
      })
    }
    return result
  }, [todayStr])

  const [selectedDay7Str, setSelectedDay7Str] = useState<string>(todayStr)

  // 2. Data Kalender Bulanan (7 Kolom: Min s/d Sab)
  const monthCells = useMemo(() => {
    const firstDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1))
    const firstDow = firstDate.getUTCDay() // 0 = Minggu
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()

    const cells: (string | null)[] = []
    for (let i = 0; i < firstDow; i++) {
      cells.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push(dStr)
    }
    return cells
  }, [currentYear, currentMonth])

  const [selectedCalDayStr, setSelectedCalDayStr] = useState<string>(() => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    if (todayStr.startsWith(prefix)) return todayStr
    return `${prefix}-01`
  })

  // Agregasi Pelanggaran & Poin
  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const persen7Hari =
    rekap7Hari.totalSesi > 0 ? Math.round((rekap7Hari.hadir / rekap7Hari.totalSesi) * 100) : null
  const persenBulan =
    rekapBulan.totalSesi > 0 ? Math.round((rekapBulan.hadir / rekapBulan.totalSesi) * 100) : null

  // Sesi hari terpilih 7 hari
  const day7Status = useMemo(() => {
    return {
      shubuh: resolveSessionStatus(selectedDay7Str, 'shubuh', detail7HariMap, validDates7HariSet, libur7HariSet),
      ashar: resolveSessionStatus(selectedDay7Str, 'ashar', detail7HariMap, validDates7HariSet, libur7HariSet),
      maghrib: resolveSessionStatus(selectedDay7Str, 'maghrib', detail7HariMap, validDates7HariSet, libur7HariSet),
    }
  }, [selectedDay7Str, detail7HariMap, validDates7HariSet, libur7HariSet])

  // Sesi hari terpilih kalender bulanan
  const calDayStatus = useMemo(() => {
    return {
      shubuh: resolveSessionStatus(selectedCalDayStr, 'shubuh', detailBulanMap, validDatesBulanSet, liburBulanSet),
      ashar: resolveSessionStatus(selectedCalDayStr, 'ashar', detailBulanMap, validDatesBulanSet, liburBulanSet),
      maghrib: resolveSessionStatus(selectedCalDayStr, 'maghrib', detailBulanMap, validDatesBulanSet, liburBulanSet),
    }
  }, [selectedCalDayStr, detailBulanMap, validDatesBulanSet, liburBulanSet])

  return (
    <div className="space-y-4">
      {/* 1. SEGMENTED CONTROL: KEHADIRAN vs PELANGGARAN */}
      <nav aria-label="Tab Aktivitas" className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100/90 text-xs font-bold text-slate-500">
        <button
          type="button"
          onClick={() => setActiveTab('KEHADIRAN')}
          className={`min-h-[40px] rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'KEHADIRAN'
              ? 'bg-white text-slate-950 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-emerald-700" />
          <span>Kehadiran</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PELANGGARAN')}
          className={`min-h-[40px] rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'PELANGGARAN'
              ? 'bg-white text-slate-950 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-slate-500" />
          <span>Pelanggaran</span>
          {totalPoin > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-red-100 text-red-800 whitespace-nowrap shrink-0">
              {totalPoin}
            </span>
          )}
        </button>
      </nav>

      {/* 2. TAB CONTENT: KEHADIRAN */}
      {activeTab === 'KEHADIRAN' && (
        <section className="space-y-4">
          {/* Sub-toggle: Mode Mingguan vs Bulanan */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Periode Kehadiran</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setKehadiranMode('MINGGUAN')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  kehadiranMode === 'MINGGUAN'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setKehadiranMode('BULANAN')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  kehadiranMode === 'BULANAN'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulanan
              </button>
            </div>
          </div>

          {/* MODE 1: 7 HARI TERAKHIR */}
          {kehadiranMode === 'MINGGUAN' && (
            <div className="space-y-4">
              {rekap7Hari.totalSesi === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Belum ada data kehadiran yang disahkan untuk 7 hari terakhir.
                  </p>
                </div>
              ) : (
                <>
                  {/* Hero Summary Card */}
                  <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
                        7 Hari Terakhir
                      </span>
                      <span className="text-xs text-emerald-200/90 font-medium">
                        {rekap7Hari.hadir} dari {rekap7Hari.totalSesi} pertemuan
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <p className="text-4xl font-black font-mono tracking-tight text-white">
                        {persen7Hari}%
                      </p>
                      <span className="text-sm font-semibold text-emerald-100">
                        Tingkat Kehadiran
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#bef264] transition-all duration-500"
                        style={{ width: `${persen7Hari}%` }}
                      />
                    </div>
                  </div>

                  {/* 4 Kotak Status Presensi */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100/80 p-2.5">
                      <span className="block text-base font-black font-mono text-emerald-900">{rekap7Hari.hadir}</span>
                      <span className="block text-[10px] font-bold text-emerald-700">Hadir</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 border border-slate-200/80 p-2.5">
                      <span className="block text-base font-black font-mono text-slate-800">{rekap7Hari.sakit}</span>
                      <span className="block text-[10px] font-bold text-slate-600">Sakit</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100/80 p-2.5">
                      <span className="block text-base font-black font-mono text-amber-900">{rekap7Hari.izin}</span>
                      <span className="block text-[10px] font-bold text-amber-700">Izin</span>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-200/80 p-2.5">
                      <span className="block text-base font-black font-mono text-red-900">{rekap7Hari.alfa}</span>
                      <span className="block text-[10px] font-bold text-red-700">Alfa</span>
                    </div>
                  </div>

                  {/* STRIP 7 HARI INTERAKTIF */}
                  <div className="space-y-2 pt-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pilih Tanggal untuk Cek Sesi
                    </h3>

                    <div className="grid grid-cols-7 gap-1.5">
                      {days7.map(item => {
                        const isSelected = item.dateStr === selectedDay7Str
                        const s = resolveSessionStatus(item.dateStr, 'shubuh', detail7HariMap, validDates7HariSet, libur7HariSet)
                        const a = resolveSessionStatus(item.dateStr, 'ashar', detail7HariMap, validDates7HariSet, libur7HariSet)
                        const m = resolveSessionStatus(item.dateStr, 'maghrib', detail7HariMap, validDates7HariSet, libur7HariSet)

                        const hasAlfa = s === 'A' || a === 'A' || m === 'A'
                        const hasSakitOrIzin = s === 'S' || a === 'S' || m === 'S' || s === 'I' || a === 'I' || m === 'I'

                        let borderClass = isSelected
                          ? 'border-emerald-700 ring-2 ring-emerald-600/30 bg-emerald-50 shadow-xs'
                          : hasAlfa
                            ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                            : hasSakitOrIzin
                              ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                              : 'border-slate-200/90 bg-white hover:bg-slate-50'

                        return (
                          <button
                            key={item.dateStr}
                            type="button"
                            onClick={() => setSelectedDay7Str(item.dateStr)}
                            className={`flex flex-col items-center justify-between py-2 px-1 rounded-xl border transition-all cursor-pointer ${borderClass}`}
                          >
                            <span className={`text-[10px] font-bold ${item.dayName === 'Ahd' ? 'text-red-500' : 'text-slate-500'}`}>
                              {item.dayName}
                            </span>
                            <span className={`text-xs font-black font-mono my-1 ${isSelected ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                              {item.dayNum}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${getDotClass(s)}`} />
                              <span className={`w-1.5 h-1.5 rounded-full ${getDotClass(a)}`} />
                              <span className={`w-1.5 h-1.5 rounded-full ${getDotClass(m)}`} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* DETAIL SESI HARI TERPILIH */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-3">
                    <p className="text-xs font-bold text-slate-900 pb-1 border-b border-slate-100">
                      {formatTanggalId(selectedDay7Str)}
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <SessionCard sesiName="Shubuh" status={day7Status.shubuh} />
                      <SessionCard sesiName="Ashar" status={day7Status.ashar} />
                      <SessionCard sesiName="Maghrib" status={day7Status.maghrib} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* MODE 2: KALENDER BULANAN */}
          {kehadiranMode === 'BULANAN' && (
            <div className="space-y-4">
              {/* Month Selector Bar */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-2.5 border border-slate-200/80">
                <Link
                  href={`/portal-ortu/aktivitas?bulan=${shiftBulan(currentYear, currentMonth, -1)}`}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 active:scale-95 transition cursor-pointer"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </Link>
                <div className="text-center">
                  <span className="text-sm font-bold text-slate-900">
                    {namaBulanId(currentMonth)} {currentYear}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {rekapBulan.totalSesi > 0
                      ? `${rekapBulan.hadir} dari ${rekapBulan.totalSesi} pertemuan`
                      : 'Belum ada pertemuan terverifikasi'}
                  </p>
                </div>
                <Link
                  href={`/portal-ortu/aktivitas?bulan=${shiftBulan(currentYear, currentMonth, 1)}`}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 active:scale-95 transition cursor-pointer"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </Link>
              </div>

              {rekapBulan.totalSesi === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Belum ada data kehadiran yang disahkan untuk bulan ini.
                  </p>
                </div>
              ) : (
                <>
                  {/* 4 Kotak Ringkasan Bulanan */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100/80 p-2">
                      <span className="block text-sm font-black font-mono text-emerald-900">{rekapBulan.hadir}</span>
                      <span className="block text-[10px] font-bold text-emerald-700">Hadir</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 border border-slate-200/80 p-2">
                      <span className="block text-sm font-black font-mono text-slate-800">{rekapBulan.sakit}</span>
                      <span className="block text-[10px] font-bold text-slate-600">Sakit</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100/80 p-2">
                      <span className="block text-sm font-black font-mono text-amber-900">{rekapBulan.izin}</span>
                      <span className="block text-[10px] font-bold text-amber-700">Izin</span>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-200/80 p-2">
                      <span className="block text-sm font-black font-mono text-red-900">{rekapBulan.alfa}</span>
                      <span className="block text-[10px] font-bold text-red-700">Alfa</span>
                    </div>
                  </div>

                  {/* KALENDER BULANAN (7 Kolom: Min - Sab) */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5">
                    {/* Header Hari */}
                    <div className="grid grid-cols-7 gap-1 text-center pb-2 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-red-600">Min</span>
                      <span className="text-[11px] font-bold text-slate-500">Sen</span>
                      <span className="text-[11px] font-bold text-slate-500">Sel</span>
                      <span className="text-[11px] font-bold text-slate-500">Rab</span>
                      <span className="text-[11px] font-bold text-slate-500">Kam</span>
                      <span className="text-[11px] font-bold text-slate-500">Jum</span>
                      <span className="text-[11px] font-bold text-slate-500">Sab</span>
                    </div>

                    {/* Date Cells Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {monthCells.map((dStr, idx) => {
                        if (!dStr) {
                          return <div key={`empty-${idx}`} className="h-12 rounded-xl bg-transparent" />
                        }

                        const dayNum = Number(dStr.slice(8, 10))
                        const dow = new Date(`${dStr}T12:00:00Z`).getUTCDay()
                        const isSelected = dStr === selectedCalDayStr

                        const s = resolveSessionStatus(dStr, 'shubuh', detailBulanMap, validDatesBulanSet, liburBulanSet)
                        const a = resolveSessionStatus(dStr, 'ashar', detailBulanMap, validDatesBulanSet, liburBulanSet)
                        const m = resolveSessionStatus(dStr, 'maghrib', detailBulanMap, validDatesBulanSet, liburBulanSet)

                        const hasAlfa = s === 'A' || a === 'A' || m === 'A'
                        const hasSakitOrIzin = s === 'S' || a === 'S' || m === 'S' || s === 'I' || a === 'I' || m === 'I'

                        let borderClass = ''
                        if (isSelected) {
                          borderClass = 'border-emerald-700 ring-2 ring-emerald-600/30 bg-emerald-50/90 shadow-xs'
                        } else if (hasAlfa) {
                          borderClass = 'border-red-200 bg-red-50/50 hover:bg-red-50'
                        } else if (hasSakitOrIzin) {
                          borderClass = 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                        } else {
                          borderClass = 'border-slate-100 bg-white hover:bg-slate-50'
                        }

                        return (
                          <button
                            key={dStr}
                            type="button"
                            onClick={() => setSelectedCalDayStr(dStr)}
                            className={`flex flex-col items-center justify-between p-1.5 h-12 rounded-xl border transition cursor-pointer ${borderClass}`}
                          >
                            <span
                              className={`text-[11px] font-bold font-mono leading-none ${
                                isSelected
                                  ? 'text-emerald-950 font-black'
                                  : dow === 0
                                    ? 'text-red-500'
                                    : 'text-slate-800'
                              }`}
                            >
                              {dayNum}
                            </span>
                            <div className="flex items-center gap-0.5 mt-auto">
                              <span className={`w-1 h-1 rounded-full ${getDotClass(s)}`} />
                              <span className={`w-1 h-1 rounded-full ${getDotClass(a)}`} />
                              <span className={`w-1 h-1 rounded-full ${getDotClass(m)}`} />
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Keterangan Status Kalender */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-y-1 text-[10px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hadir
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400" /> Sakit
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" /> Izin
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> Alfa
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-slate-200" /> Libur
                      </span>
                    </div>
                  </div>

                  {/* PANEL RINCIAN TANGGAL KALENDER */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-3">
                    <p className="text-xs font-bold text-slate-900 pb-1 border-b border-slate-100">
                      {formatTanggalId(selectedCalDayStr)}
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <SessionCard sesiName="Shubuh" status={calDayStatus.shubuh} />
                      <SessionCard sesiName="Ashar" status={calDayStatus.ashar} />
                      <SessionCard sesiName="Maghrib" status={calDayStatus.maghrib} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TULISAN TUNGGAL RESMI */}
          <p className="text-[11px] text-slate-500 text-center pt-2 leading-relaxed">
            Data absensi diperbarui setelah disahkan secara berkala oleh Seksi Pengajaran.
          </p>
        </section>
      )}

      {/* 3. TAB CONTENT: PELANGGARAN (REDESIGNED TOTAL!) */}
      {activeTab === 'PELANGGARAN' && (
        <section className="space-y-4">
          {/* KARTU STATUS KEDISIPLINAN */}
          {totalPoin === 0 ? (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <p className="text-sm font-bold text-emerald-950">
                  Tidak ada pelanggaran tercatat
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                0 Poin
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-200/90 bg-red-50/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-red-600 flex items-center justify-center shrink-0 border border-red-100 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-950">Catatan Pelanggaran</p>
                  <p className="text-[11px] text-red-700/80 mt-0.5">
                    {pelanggaran.length} catatan kedisiplinan
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-white text-red-700 border border-red-200 shadow-2xs">
                {totalPoin} Poin
              </span>
            </div>
          )}

          {/* DAFTAR CATATAN KEDISIPLINAN */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Riwayat Catatan Kedisiplinan
            </h3>

            {pelanggaran.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                Tidak ada riwayat pelanggaran.
              </div>
            ) : (
              <div className="space-y-2">
                {pelanggaran.map(item => {
                  const jenisKey = String(item.jenis).toUpperCase()
                  const jenisBadgeCls =
                    jenisKey === 'BERAT'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : jenisKey === 'SEDANG'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 ${jenisBadgeCls}`}>
                          {item.jenis}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatTanggalId(item.tanggal)}
                        </span>
                      </div>
                      {item.deskripsi && (
                        <p className="text-xs font-medium text-slate-800 leading-relaxed">
                          {item.deskripsi}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                        <span className="text-[11px] text-slate-400">Bagian Keamanan</span>
                        <span className="font-mono font-bold text-red-600">
                          +{item.poin} Poin
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
