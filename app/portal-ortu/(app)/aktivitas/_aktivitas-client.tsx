'use client'

import { useState } from 'react'
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
}: AktivitasClientProps) {
  const [activeTab, setActiveTab] = useState<'KEHADIRAN' | 'PELANGGARAN'>('KEHADIRAN')
  const [kehadiranMode, setKehadiranMode] = useState<'MINGGUAN' | 'BULANAN'>('MINGGUAN')

  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const persen7Hari =
    rekap7Hari.totalSesi > 0 ? Math.round((rekap7Hari.hadir / rekap7Hari.totalSesi) * 100) : null
  const persenBulan =
    rekapBulan.totalSesi > 0 ? Math.round((rekapBulan.hadir / rekapBulan.totalSesi) * 100) : null

  return (
    <div className="space-y-5">
      {/* 1. SEGMENTED CONTROL: KEHADIRAN vs PELANGGARAN */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100/90 text-xs font-bold text-slate-500">
        <button
          type="button"
          onClick={() => setActiveTab('KEHADIRAN')}
          className={`min-h-[40px] rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'KEHADIRAN'
              ? 'bg-white text-slate-950 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
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
          <ShieldCheck className="w-4 h-4" />
          <span>Pelanggaran</span>
          {totalPoin > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800 whitespace-nowrap shrink-0">
              {totalPoin}
            </span>
          )}
        </button>
      </div>

      {/* 2. TAB CONTENT: KEHADIRAN */}
      {activeTab === 'KEHADIRAN' && (
        <div className="space-y-5">
          {/* Sub-toggle: Mode Mingguan vs Bulanan */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Periode Kehadiran</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setKehadiranMode('MINGGUAN')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
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
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  kehadiranMode === 'BULANAN'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulanan
              </button>
            </div>
          </div>

          {/* MODE MINGGUAN (7 HARI TERAKHIR) */}
          {kehadiranMode === 'MINGGUAN' && (
            <div className="space-y-4">
              {rekap7Hari.totalSesi === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Belum ada data kehadiran yang selesai diverifikasi.
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Surface */}
                  <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden space-y-3">
                    <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
                          7 Hari Terakhir
                        </span>
                        <span className="text-xs text-emerald-200/80 font-medium">
                          {rekap7Hari.hadir} dari {rekap7Hari.totalSesi} sesi
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

                      {/* Progress bar */}
                      <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#bef264] transition-all duration-500"
                          style={{ width: `${persen7Hari}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status Chips Row */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-emerald-900">{rekap7Hari.hadir}</span>
                      <span className="block text-[10px] font-bold text-emerald-700">Hadir</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-2.5">
                      <span className="block text-sm font-black font-mono text-slate-800">{rekap7Hari.sakit}</span>
                      <span className="block text-[10px] font-bold text-slate-600">Sakit</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-amber-900">{rekap7Hari.izin}</span>
                      <span className="block text-[10px] font-bold text-amber-700">Izin</span>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-rose-900">{rekap7Hari.alfa}</span>
                      <span className="block text-[10px] font-bold text-rose-700">Alfa</span>
                    </div>
                  </div>

                  {/* Detail Absen 7 Hari */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Catatan Ketidakhadiran 7 Hari Terakhir
                    </h3>
                    {rekap7Hari.detail.length > 0 ? (
                      <div className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-100 p-2">
                        {rekap7Hari.detail.map(row => (
                          <div key={row.tanggal} className="py-2.5 px-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{formatTanggalId(row.tanggal)}</span>
                            <div className="flex gap-1.5">
                              {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                                const status = row[sesi]
                                if (!status || !STATUS_STYLE[status]) return null
                                const style = STATUS_STYLE[status]
                                return (
                                  <span key={sesi} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0 ${style.chipCls}`}>
                                    {sesi}: {style.label}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                        Alhamdulillah, santri hadir lengkap pada seluruh sesi.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MODE BULANAN */}
          {kehadiranMode === 'BULANAN' && (
            <div className="space-y-4">
              {/* Month Selector Bar */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <Link
                  href={`/portal-ortu/aktivitas?bulan=${shiftBulan(currentYear, currentMonth, -1)}`}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 active:scale-95 transition cursor-pointer"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </Link>
                <div className="text-center">
                  <span className="text-sm font-bold text-slate-900">{namaBulanId(currentMonth)} {currentYear}</span>
                  {rekapBulan.totalSesi > 0 && (
                    <p className="text-[11px] text-slate-400">{rekapBulan.hadir} dari {rekapBulan.totalSesi} sesi</p>
                  )}
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
                    Belum ada data kehadiran yang selesai diverifikasi.
                  </p>
                </div>
              ) : (
                <>
                  {/* Monthly Stat Overview */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-emerald-900">{rekapBulan.hadir}</span>
                      <span className="block text-[10px] font-bold text-emerald-700">Hadir</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-2.5">
                      <span className="block text-sm font-black font-mono text-slate-800">{rekapBulan.sakit}</span>
                      <span className="block text-[10px] font-bold text-slate-600">Sakit</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-amber-900">{rekapBulan.izin}</span>
                      <span className="block text-[10px] font-bold text-amber-700">Izin</span>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-2.5">
                      <span className="block text-sm font-black font-mono text-rose-900">{rekapBulan.alfa}</span>
                      <span className="block text-[10px] font-bold text-rose-700">Alfa</span>
                    </div>
                  </div>

                  {/* Progress bar bulanan */}
                  <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Tingkat Kehadiran Bulanan</span>
                      <span className="font-mono font-bold text-slate-900">{persenBulan}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${persenBulan}%` }}
                      />
                    </div>
                  </div>

                  {/* Detail Absen Bulanan */}
                  <div className="space-y-2 pt-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Catatan Ketidakhadiran Bulan Ini
                    </h3>
                    {rekapBulan.detail.length > 0 ? (
                      <div className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-100 p-2">
                        {rekapBulan.detail.map(row => (
                          <div key={row.tanggal} className="py-2.5 px-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{formatTanggalId(row.tanggal)}</span>
                            <div className="flex gap-1.5">
                              {(['shubuh', 'ashar', 'maghrib'] as const).map(sesi => {
                                const status = row[sesi]
                                if (!status || !STATUS_STYLE[status]) return null
                                const style = STATUS_STYLE[status]
                                return (
                                  <span key={sesi} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0 ${style.chipCls}`}>
                                    {sesi}: {style.label}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                        Alhamdulillah, santri hadir lengkap pada seluruh sesi.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center pt-1">
            Data kehadiran diperbarui secara berkala.
          </p>
        </div>
      )}

      {/* 3. TAB CONTENT: PELANGGARAN */}
      {activeTab === 'PELANGGARAN' && (
        <div className="space-y-4">
          {/* Summary Banner */}
          {totalPoin > 0 ? (
            <div className="rounded-[22px] bg-rose-950 p-5 text-white shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Total Poin Pelanggaran
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Perlu Perhatian</span>
                </span>
              </div>
              <p className="text-3xl font-black font-mono text-white">
                {totalPoin} Poin
              </p>
              <p className="text-xs text-rose-200/80">
                Akumulasi catatan kedisiplinan santri selama masa pendidikan.
              </p>
            </div>
          ) : (
            <div className="rounded-[22px] bg-emerald-900 p-5 text-white shadow-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Kedisiplinan Tertib</span>
              </div>
              <p className="text-xl font-bold text-white pt-1">
                Alhamdulillah, Santri Tertib
              </p>
              <p className="text-xs text-emerald-200/80">
                Tidak ada catatan pelanggaran kedisiplinan santri yang tercatat.
              </p>
            </div>
          )}

          {/* Daftar Catatan Pelanggaran */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Riwayat Catatan Kedisiplinan
            </h3>

            {pelanggaran.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                Tidak ada riwayat pelanggaran.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-100 p-3">
                {pelanggaran.map(item => (
                  <div key={item.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${JENIS_STYLE[String(item.jenis).toUpperCase()] || 'bg-slate-100 text-slate-700'}`}>
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
        </div>
      )}
    </div>
  )
}
