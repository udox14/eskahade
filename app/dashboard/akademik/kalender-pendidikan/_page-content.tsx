'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getKalenderBulan, simpanRentang, type KalenderRow } from './actions'

const SESI = ['shubuh', 'ashar', 'maghrib'] as const
type Sesi = typeof SESI[number]
const SESI_LABEL: Record<Sesi, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

type DateEntry = Partial<Record<Sesi, { jenis: 'libur' | 'lainnya'; keterangan: string | null }>>

// Pola libur mingguan (baseline hardcoded, sama dengan logika rekap). Hanya untuk ditampilkan.
function liburRutin(dateStr: string): Sesi[] {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  const out: Sesi[] = []
  if (day === 2 || day === 4) out.push('maghrib')
  if (day === 5) out.push('shubuh', 'ashar')
  return out
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function KalenderPendidikanContent({
  tahunAwal,
  bulanAwal,
  rowsAwal,
}: {
  tahunAwal: number
  bulanAwal: number
  rowsAwal: KalenderRow[]
}) {
  const [tahun, setTahun] = useState(tahunAwal)
  const [bulan, setBulan] = useState(bulanAwal) // 1..12
  const [rows, setRows] = useState<KalenderRow[]>(rowsAwal)
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()

  const [mulai, setMulai] = useState('')
  const [selesai, setSelesai] = useState('')
  const [formSesi, setFormSesi] = useState<Set<Sesi>>(new Set(SESI))
  const [formJenis, setFormJenis] = useState<'libur' | 'lainnya'>('libur')
  const [formKeterangan, setFormKeterangan] = useState('')

  const byTanggal = useMemo(() => {
    const map: Record<string, DateEntry> = {}
    for (const r of rows) {
      if (!map[r.tanggal]) map[r.tanggal] = {}
      map[r.tanggal][r.sesi as Sesi] = { jenis: r.jenis, keterangan: r.keterangan }
    }
    return map
  }, [rows])

  const summary = useMemo(() => {
    let libur = 0
    let lainnya = 0
    for (const entry of Object.values(byTanggal)) {
      const vals = Object.values(entry)
      if (vals.some((v) => v.jenis === 'lainnya')) lainnya++
      if (vals.some((v) => v.jenis === 'libur')) libur++
    }
    return { libur, lainnya, totalTanggal: Object.keys(byTanggal).length }
  }, [byTanggal])

  function reload(t: number, b: number) {
    startLoading(async () => {
      const next = await getKalenderBulan(t, b)
      setRows(next)
    })
  }

  function gantiBulan(delta: number) {
    let b = bulan + delta
    let t = tahun
    if (b < 1) { b = 12; t -= 1 }
    if (b > 12) { b = 1; t += 1 }
    setBulan(b)
    setTahun(t)
    reload(t, b)
  }

  function pilihTanggal(tanggal: string) {
    setMulai(tanggal)
    setSelesai(tanggal)
    const entry = byTanggal[tanggal] || {}
    const sesiSet = new Set<Sesi>(SESI.filter((s) => entry[s]))
    const firstJenis = SESI.map((s) => entry[s]?.jenis).find(Boolean) as 'libur' | 'lainnya' | undefined
    const firstKet = SESI.map((s) => entry[s]?.keterangan).find((k) => k) || ''
    // kalau tanggal masih efektif, default ke full-hari libur biar cepat ditandai
    setFormSesi(sesiSet.size ? sesiSet : new Set(SESI))
    setFormJenis(firstJenis || 'libur')
    setFormKeterangan(firstKet)
  }

  function toggleSesi(s: Sesi) {
    setFormSesi((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  function toggleFullHari() {
    setFormSesi((prev) => (prev.size === SESI.length ? new Set() : new Set(SESI)))
  }

  function simpan(efektif: boolean) {
    if (!mulai) {
      toast.error('Pilih tanggal dulu.')
      return
    }
    startSaving(async () => {
      const res = await simpanRentang({
        tanggalMulai: mulai,
        tanggalSelesai: selesai || mulai,
        sesiList: efektif ? [] : Array.from(formSesi),
        jenis: formJenis,
        keterangan: formKeterangan,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        efektif
          ? `${res.jumlahTanggal} tanggal diset efektif`
          : `${res.jumlahTanggal} tanggal disimpan`
      )
      reload(tahun, bulan)
    })
  }

  // Grid: offset awal + jumlah hari
  const firstWeekday = new Date(tahun, bulan - 1, 1).getDay() // 0=Ahad
  const daysInMonth = new Date(tahun, bulan, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const rangeAktif = Boolean(mulai)
  const inRange = (t: string) => rangeAktif && t >= mulai && t <= (selesai || mulai)

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <DashboardPageHeader
        title="Kalender Pendidikan"
        description="Tandai hari libur / lainnya per tanggal atau per sesi pengajian. Hari yang ditandai dikecualikan dari perhitungan rekap absen santri & guru."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kalender */}
        <div className="rounded-2xl border bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-black tracking-wide text-slate-800">
                {NAMA_BULAN[bulan - 1]} {tahun}
              </h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => gantiBulan(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setTahun(tahunAwal); setBulan(bulanAwal); reload(tahunAwal, bulanAwal) }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Hari Ini
              </button>
              <button
                onClick={() => gantiBulan(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {NAMA_HARI.map((h, i) => (
                <div
                  key={h}
                  className={`pb-2 text-center text-[11px] font-bold uppercase tracking-wide ${
                    i === 5 ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {h}
                </div>
              ))}

              {cells.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />
                const tanggal = `${tahun}-${pad(bulan)}-${pad(day)}`
                const entry = byTanggal[tanggal] || {}
                const sesiTerpakai = SESI.filter((s) => entry[s])
                const count = sesiTerpakai.length
                const adaLainnya = sesiTerpakai.some((s) => entry[s]?.jenis === 'lainnya')
                const adaLibur = sesiTerpakai.some((s) => entry[s]?.jenis === 'libur')
                const fullDay = count === SESI.length
                const rutin = liburRutin(tanggal)
                const selected = inRange(tanggal)

                const baseColor = fullDay
                  ? adaLainnya && !adaLibur
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-rose-50 border-rose-300'
                  : 'bg-white border-slate-200'

                return (
                  <button
                    key={tanggal}
                    onClick={() => pilihTanggal(tanggal)}
                    className={`flex min-h-[68px] flex-col items-start rounded-xl border p-1.5 text-left transition hover:ring-2 hover:ring-indigo-300 ${baseColor} ${
                      selected ? 'ring-2 ring-indigo-500' : ''
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-700">{day}</span>

                    {fullDay ? (
                      <span
                        className={`mt-auto inline-block rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                          adaLainnya && !adaLibur ? 'bg-amber-200 text-amber-800' : 'bg-rose-200 text-rose-800'
                        }`}
                      >
                        {adaLainnya && !adaLibur ? 'Lainnya' : 'Libur'}
                      </span>
                    ) : (
                      <div className="mt-auto flex flex-wrap gap-0.5">
                        {SESI.map((s) => {
                          const e = entry[s]
                          if (!e) {
                            if (rutin.includes(s)) {
                              return (
                                <span
                                  key={s}
                                  title={`${SESI_LABEL[s]}: libur rutin (mingguan)`}
                                  className="rounded bg-slate-100 px-1 text-[8px] font-semibold text-slate-400"
                                >
                                  {SESI_LABEL[s][0]}
                                </span>
                              )
                            }
                            return null
                          }
                          return (
                            <span
                              key={s}
                              title={`${SESI_LABEL[s]}: ${e.jenis}`}
                              className={`rounded px-1 text-[8px] font-bold ${
                                e.jenis === 'lainnya' ? 'bg-amber-200 text-amber-800' : 'bg-rose-200 text-rose-800'
                              }`}
                            >
                              {SESI_LABEL[s][0]}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-rose-300" /> Libur
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-amber-300" /> Lainnya
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-slate-200" /> Libur rutin (otomatis)
                </span>
              </div>
              <div className="font-semibold text-slate-600">{summary.totalTanggal} tanggal ditandai</div>
            </div>
          </div>
        </div>

        {/* Panel atur (kanan) */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Atur Tanggal</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {rangeAktif
                  ? mulai === (selesai || mulai)
                    ? `${NAMA_HARI[new Date(`${mulai}T00:00:00`).getDay()]}, ${mulai}`
                    : `${mulai} → ${selesai}`
                  : 'Klik tanggal di kalender untuk mulai.'}
              </p>
            </div>

            <div className="space-y-4 p-5">
              {/* Rentang tanggal */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Dari</span>
                  <input
                    type="date"
                    value={mulai}
                    onChange={(e) => { setMulai(e.target.value); if (!selesai || e.target.value > selesai) setSelesai(e.target.value) }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Sampai</span>
                  <input
                    type="date"
                    value={selesai}
                    min={mulai || undefined}
                    onChange={(e) => setSelesai(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
              </div>
              <p className="-mt-2 text-[11px] text-slate-400">
                Isi rentang berbeda untuk batch (mis. libur semester berhari-hari).
              </p>

              {/* Cakupan sesi */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Cakupan</span>
                  <button onClick={toggleFullHari} className="text-xs font-bold text-indigo-600 hover:underline">
                    {formSesi.size === SESI.length ? 'Kosongkan' : 'Full hari'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SESI.map((s) => {
                    const active = formSesi.has(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSesi(s)}
                        className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {SESI_LABEL[s]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Jenis */}
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Jenis</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['libur', 'lainnya'] as const).map((j) => (
                    <button
                      key={j}
                      onClick={() => setFormJenis(j)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold capitalize transition ${
                        formJenis === j
                          ? j === 'libur'
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Libur & Lainnya sama-sama dikecualikan dari rekap; beda hanya label.
                </p>
              </div>

              {/* Keterangan */}
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Keterangan</span>
                <input
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="mis. Maulid Nabi, Libur Semester"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 border-t bg-slate-50 px-5 py-4">
              <button
                onClick={() => simpan(true)}
                disabled={saving || !rangeAktif}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                Efektif
              </button>
              <button
                onClick={() => simpan(false)}
                disabled={saving || !rangeAktif || formSesi.size === 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-indigo-300"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
