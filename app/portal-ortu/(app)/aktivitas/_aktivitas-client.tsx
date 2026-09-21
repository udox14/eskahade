'use client'

import Link from 'next/link'
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Clock,
} from 'lucide-react'
import { formatTanggalId, namaBulanId } from '@/lib/portal/format'
import type { RekapAbsensiAnak, PelanggaranAnak } from '@/lib/portal/data'

interface AktivitasClientProps {
  rekapBulan: RekapAbsensiAnak
  rekap7Hari: RekapAbsensiAnak
  pelanggaran: PelanggaranAnak[]
  currentYear: number
  currentMonth: number
  todayStr: string
}

const STATUS_STYLE: Record<string, { label: string; chipCls: string }> = {
  A: { label: 'Alfa', chipCls: 'bg-rose-100 text-rose-800' },
  S: { label: 'Sakit', chipCls: 'bg-slate-100 text-slate-700' },
  I: { label: 'Izin', chipCls: 'bg-amber-100 text-amber-800' },
  H: { label: 'Hadir', chipCls: 'bg-emerald-100 text-emerald-800' },
}

const JENIS_STYLE: Record<string, string> = {
  RINGAN: 'bg-amber-100 text-amber-800',
  SEDANG: 'bg-orange-100 text-orange-800',
  BERAT: 'bg-rose-100 text-rose-800',
}

function shiftBulan(tahun: number, bulan: number, delta: number) {
  const d = new Date(Date.UTC(tahun, bulan - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function AktivitasClient({
  rekapBulan,
  rekap7Hari,
  pelanggaran,
  currentYear,
  currentMonth,
  todayStr,
}: AktivitasClientProps) {
  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const persen7Hari =
    rekap7Hari.totalSesi > 0 ? Math.round((rekap7Hari.hadir / rekap7Hari.totalSesi) * 100) : null
  const persenBulan =
    rekapBulan.totalSesi > 0 ? Math.round((rekapBulan.hadir / rekapBulan.totalSesi) * 100) : null

  // Cek catatan presensi hari ini
  const todayDetail = rekapBulan.detail.find(d => d.tanggal === todayStr)
  const shubuhCode = todayDetail?.shubuh || 'H'
  const asharCode = todayDetail?.ashar || 'H'
  const maghribCode = todayDetail?.maghrib || 'H'

  const sessionsToday = [
    { name: 'Subuh', code: shubuhCode, icon: Sun, iconCls: 'bg-amber-50 text-amber-700' },
    { name: 'Ashar', code: asharCode, icon: Sunset, iconCls: 'bg-orange-50 text-orange-700' },
    { name: 'Maghrib', code: maghribCode, icon: Moon, iconCls: 'bg-indigo-50 text-indigo-700' },
  ]

  return (
    <div className="space-y-7">
      {/* 1. TOP: EXPRESSIVE SUMMARY SURFACE (7 Hari Terakhir) */}
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
              7 Hari Terakhir
            </span>
            <span className="text-xs text-emerald-200/80 font-medium">
              {rekap7Hari.hadir} dari {rekap7Hari.totalSesi} sesi aktif
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-black font-mono tracking-tight text-white">
              {persen7Hari !== null ? `${persen7Hari}%` : '—'}
            </p>
            <span className="text-sm font-semibold text-emerald-100">
              Kehadiran Pengajian
            </span>
          </div>

          {/* Compact Progress Visual */}
          <div className="space-y-1.5 pt-1">
            <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#bef264] transition-all duration-500"
                style={{ width: `${persen7Hari ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-emerald-200/80">
              Sinkronisasi data dilakukan setiap Selasa malam oleh tim akademik.
            </p>
          </div>
        </div>
      </div>

      {/* 2. FLAT SECTION: HARI INI (Tanpa Outer Card Pembungkus) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-sm font-bold text-slate-900">
            Hari ini
          </h2>
          <span className="text-xs font-medium text-slate-400">
            {formatTanggalId(todayStr)}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {sessionsToday.map(sesi => {
            const Icon = sesi.icon
            const style = STATUS_STYLE[sesi.code] || STATUS_STYLE.H
            return (
              <div key={sesi.name} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sesi.iconCls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{sesi.name}</p>
                    <p className="text-[11px] text-slate-400">Sesi pengajian rutin</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${style.chipCls}`}>
                  {style.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. FLAT SECTION: KEDISIPLINAN (Tanpa Outer Card) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-sm font-bold text-slate-900">
            Kedisiplinan
          </h2>
          {totalPoin > 0 && (
            <span className="text-xs font-bold font-mono text-rose-700">
              {totalPoin} poin pelanggaran
            </span>
          )}
        </div>

        {pelanggaran.length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tidak ada catatan</p>
              <p className="text-xs text-slate-500">Alhamdulillah, santri tertib dan tidak memiliki pelanggaran.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pelanggaran.map(item => (
              <div key={item.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-100 text-slate-700'}`}>
                    {item.jenis}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatTanggalId(item.tanggal)}
                  </span>
                </div>
                {item.deskripsi && (
                  <p className="text-xs text-slate-700 leading-relaxed pt-0.5">
                    {item.deskripsi}
                  </p>
                )}
                <p className="text-xs font-bold text-rose-600 font-mono">
                  +{item.poin} poin
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. FLAT SECTION: REKAP BULANAN & RIWAYAT (Tanpa 6 KPI Card Grid) */}
      <div className="space-y-3 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-bold text-slate-900">
            Kehadiran Bulan Ini
          </h2>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <Link
              href={`/portal-ortu/aktivitas?bulan=${shiftBulan(currentYear, currentMonth, -1)}`}
              className="p-1 rounded-lg hover:bg-slate-100 active:scale-95 transition"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span>{namaBulanId(currentMonth)} {currentYear}</span>
            <Link
              href={`/portal-ortu/aktivitas?bulan=${shiftBulan(currentYear, currentMonth, 1)}`}
              className="p-1 rounded-lg hover:bg-slate-100 active:scale-95 transition"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Compact Monthly Stat Row */}
        <div className="flex items-center justify-between py-2 text-xs">
          <div className="space-y-0.5">
            <p className="text-2xl font-black font-mono text-slate-950">
              {persenBulan !== null ? `${persenBulan}%` : '—'}
            </p>
            <p className="text-[11px] text-slate-400">
              {rekapBulan.hadir} dari {rekapBulan.totalSesi} total sesi
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-center">
            <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5 min-w-[48px]">
              <span className="block text-xs font-black font-mono text-emerald-800">{rekapBulan.hadir}</span>
              <span className="block text-[9px] font-bold text-emerald-700">Hadir</span>
            </div>
            <div className="rounded-xl bg-slate-100 px-2.5 py-1.5 min-w-[48px]">
              <span className="block text-xs font-black font-mono text-slate-700">{rekapBulan.sakit}</span>
              <span className="block text-[9px] font-bold text-slate-600">Sakit</span>
            </div>
            <div className="rounded-xl bg-amber-50 px-2.5 py-1.5 min-w-[48px]">
              <span className="block text-xs font-black font-mono text-amber-800">{rekapBulan.izin}</span>
              <span className="block text-[9px] font-bold text-amber-700">Izin</span>
            </div>
            <div className="rounded-xl bg-rose-50 px-2.5 py-1.5 min-w-[48px]">
              <span className="block text-xs font-black font-mono text-rose-800">{rekapBulan.alfa}</span>
              <span className="block text-[9px] font-bold text-rose-700">Alfa</span>
            </div>
          </div>
        </div>

        {/* Catatan Hari Ketidakhadiran */}
        {rekapBulan.detail.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-500">Catatan Ketidakhadiran:</p>
            <div className="divide-y divide-slate-100">
              {rekapBulan.detail.map(row => (
                <div key={row.tanggal} className="py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{formatTanggalId(row.tanggal)}</span>
                  <div className="flex gap-1.5">
                    {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                      const status = row[sesi]
                      if (!status || !STATUS_STYLE[status]) return null
                      const style = STATUS_STYLE[status]
                      return (
                        <span key={sesi} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${style.chipCls}`}>
                          {sesi}: {style.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2 text-xs text-emerald-800 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Alhamdulillah, tidak ada catatan alfa atau ketidakhadiran bulan ini.</span>
          </div>
        )}
      </div>
    </div>
  )
}
