'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import {
  NAMA_BULAN,
  NAMA_HARI,
  SESSIONS,
  SESSION_COLORS,
  SESSION_LABEL,
  STATUS_TEXT,
  STATUS_TONE,
  pad,
  sourceLabel,
  statusClass,
  type GuruSession,
} from './_ui-shared'

/**
 * Kalender heatmap detail absensi satu guru.
 *
 * Tabel detail yang panjang menyulitkan pembacaan pola: hari apa sering alfa,
 * sesi mana yang bermasalah. Grid bulanan menampilkan pola itu sekaligus, dan
 * seluruh rincian per baris tetap dapat dibuka lewat panel di bawah kalender -
 * tidak ada informasi yang dibuang.
 *
 * Grid bulanan (7 kolom) dipilih daripada heatmap gaya GitHub (53 kolom minggu)
 * karena 53 kolom tidak muat di layar ponsel tanpa scroll horizontal.
 */

export type DetailRow = {
  tanggal: string
  hari: string
  sesi: GuruSession
  sesi_label: string
  kelas: string
  status: string
  status_label: string
  catatan: string
  sumber_guru: string
  snapshot_guru_nama: string | null
  jadwal_guru_nama: string | null
  snapshot_berbeda: boolean
}

/** Urutan keparahan: yang terburuk mewakili sesi bila satu sesi punya beberapa kelas. */
const STATUS_RANK: Record<string, number> = { H: 0, B: 1, A: 2 }

function worstStatus(rows: DetailRow[]) {
  return rows.reduce((worst, row) => (
    (STATUS_RANK[row.status] ?? 0) > (STATUS_RANK[worst] ?? 0) ? row.status : worst
  ), rows[0]?.status ?? 'H')
}

type DayBucket = {
  rows: DetailRow[]
  perSesi: Partial<Record<GuruSession, DetailRow[]>>
  adaSnapshotBerbeda: boolean
}

function bulanKey(tahun: number, bulan: number) {
  return `${tahun}-${pad(bulan)}`
}

/** Daftar bulan yang tercakup rentang, supaya hari tanpa kewajiban tetap tampil. */
function bulanDalamRentang(startDate: string, endDate: string) {
  const out: { tahun: number; bulan: number }[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return out
  let tahun = Number(startDate.slice(0, 4))
  let bulan = Number(startDate.slice(5, 7))
  const akhir = endDate.slice(0, 7)
  // Batas 24 bulan supaya rentang tidak wajar tidak membekukan render.
  for (let i = 0; i < 24; i++) {
    out.push({ tahun, bulan })
    if (bulanKey(tahun, bulan) >= akhir) break
    bulan += 1
    if (bulan > 12) { bulan = 1; tahun += 1 }
  }
  return out
}

function selRentangBulan(tahun: number, bulan: number) {
  const pertama = new Date(tahun, bulan - 1, 1)
  const jumlahHari = new Date(tahun, bulan, 0).getDate()
  const cells: (number | null)[] = Array(pertama.getDay()).fill(null)
  for (let d = 1; d <= jumlahHari; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function ringkasanSel(bucket: DayBucket | undefined) {
  if (!bucket) return 'Tidak ada kewajiban mengajar'
  return SESSIONS
    .filter(sesi => bucket.perSesi[sesi]?.length)
    .map(sesi => `${SESSION_LABEL[sesi]}: ${STATUS_TEXT[worstStatus(bucket.perSesi[sesi]!)] || '-'}`)
    .join(' · ')
}

export function KalenderAbsensiGuru({ rows, startDate, endDate, statusDifilter, hinggaTanggal }: {
  rows: DetailRow[]
  startDate: string
  endDate: string
  /** True bila "Status Tampil" bukan "Semua Status" - sel abu belum tentu tanpa jadwal. */
  statusDifilter?: boolean
  /** Tanggal efektif terakhir yang dihitung (WIB). Setelah ini ditandai belum terjadi. */
  hinggaTanggal?: string
}) {
  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>()
    rows.forEach(row => {
      let bucket = map.get(row.tanggal)
      if (!bucket) {
        bucket = { rows: [], perSesi: {}, adaSnapshotBerbeda: false }
        map.set(row.tanggal, bucket)
      }
      bucket.rows.push(row)
      const perSesi = bucket.perSesi[row.sesi] || (bucket.perSesi[row.sesi] = [])
      perSesi.push(row)
      if (row.snapshot_berbeda) bucket.adaSnapshotBerbeda = true
    })
    return map
  }, [rows])

  const bulanList = useMemo(() => bulanDalamRentang(startDate, endDate), [startDate, endDate])

  // Default ke alfa pertama: itu yang biasanya dicari saat membuka rekap.
  const tanggalDefault = useMemo(() => {
    const alfa = rows.find(row => row.status === 'A')
    return alfa?.tanggal || rows[0]?.tanggal || ''
  }, [rows])

  const [selectedDate, setSelectedDate] = useState(tanggalDefault)
  useEffect(() => { setSelectedDate(tanggalDefault) }, [tanggalDefault])

  const bucketTerpilih = selectedDate ? buckets.get(selectedDate) : undefined

  return (
    <div className="space-y-4 p-4">
      <Legenda statusDifilter={statusDifilter} adaBelumTerjadi={Boolean(hinggaTanggal && hinggaTanggal < endDate)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {bulanList.map(({ tahun, bulan }) => (
            <GridBulan
              key={bulanKey(tahun, bulan)}
              tahun={tahun}
              bulan={bulan}
              buckets={buckets}
              selectedDate={selectedDate}
              hinggaTanggal={hinggaTanggal}
              onPilih={tanggal => setSelectedDate(current => (current === tanggal ? '' : tanggal))}
            />
          ))}
          {bulanList.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">Rentang tanggal belum diatur.</p>
          )}
        </div>

        <PanelDetail tanggal={selectedDate} bucket={bucketTerpilih} />
      </div>
    </div>
  )
}

function Legenda({ statusDifilter, adaBelumTerjadi }: { statusDifilter?: boolean; adaBelumTerjadi?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
      <span className="font-bold uppercase tracking-wide text-slate-400">Keterangan</span>
      <LegendaItem tone={STATUS_TONE.H} label="Hadir" />
      <LegendaItem tone={STATUS_TONE.B} label="Badal" />
      <LegendaItem tone={STATUS_TONE.A} label="Alfa" />
      <LegendaItem tone="bg-slate-200" label={statusDifilter ? 'Di luar filter status' : 'Tidak ada jadwal'} />
      {adaBelumTerjadi && <LegendaItem tone="bg-slate-100 ring-1 ring-dashed ring-slate-300" label="Belum terjadi" />}
      <span className="text-slate-400">Tiga strip tiap tanggal = Shubuh, Ashar, Maghrib (kiri ke kanan).</span>
      {statusDifilter && (
        <span className="text-amber-600">Filter status aktif: sel abu bisa berarti ada jadwal yang statusnya sedang disembunyikan.</span>
      )}
    </div>
  )
}

function LegendaItem({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-4 rounded-full ${tone}`} />
      {label}
    </span>
  )
}

function GridBulan({ tahun, bulan, buckets, selectedDate, hinggaTanggal, onPilih }: {
  tahun: number
  bulan: number
  buckets: Map<string, DayBucket>
  selectedDate: string
  hinggaTanggal?: string
  onPilih: (tanggal: string) => void
}) {
  const cells = useMemo(() => selRentangBulan(tahun, bulan), [tahun, bulan])

  const ringkas = useMemo(() => {
    const hitung = { H: 0, B: 0, A: 0 }
    cells.forEach(day => {
      if (day === null) return
      const bucket = buckets.get(`${tahun}-${pad(bulan)}-${pad(day)}`)
      bucket?.rows.forEach(row => {
        if (row.status in hitung) hitung[row.status as keyof typeof hitung] += 1
      })
    })
    return hitung
  }, [cells, buckets, tahun, bulan])

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h3 className="text-sm font-black text-slate-800">{NAMA_BULAN[bulan - 1]} {tahun}</h3>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">{ringkas.H} Hadir</span>
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">{ringkas.B} Badal</span>
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700">{ringkas.A} Alfa</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 p-2 sm:gap-2 sm:p-3">
        {NAMA_HARI.map(hari => (
          <div key={hari} className="truncate pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-[11px]">
            <span className="sm:hidden">{hari.slice(0, 3)}</span>
            <span className="hidden sm:inline">{hari}</span>
          </div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />
          const tanggal = `${tahun}-${pad(bulan)}-${pad(day)}`
          const bucket = buckets.get(tanggal)
          const adaData = Boolean(bucket?.rows.length)
          const belumTerjadi = Boolean(hinggaTanggal && tanggal > hinggaTanggal)
          const terpilih = selectedDate === tanggal
          const ringkasan = belumTerjadi ? 'Belum terjadi, tidak dihitung' : ringkasanSel(bucket)

          return (
            <button
              key={tanggal}
              type="button"
              onClick={() => adaData && onPilih(tanggal)}
              disabled={!adaData}
              title={`${day} ${NAMA_BULAN[bulan - 1]} - ${ringkasan}`}
              aria-label={`${day} ${NAMA_BULAN[bulan - 1]} ${tahun}. ${ringkasan}`}
              aria-pressed={terpilih}
              className={`relative flex min-h-[56px] min-w-0 flex-col rounded-lg border p-1 text-left transition sm:min-h-[72px] sm:rounded-xl sm:p-1.5 ${
                belumTerjadi
                  ? 'border-dashed border-slate-200 bg-white'
                  : adaData
                    ? 'border-slate-200 bg-white hover:ring-2 hover:ring-indigo-300'
                    : 'border-slate-100 bg-slate-50/60'
              } ${terpilih ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <span className={`text-[11px] font-bold sm:text-sm ${adaData && !belumTerjadi ? 'text-slate-700' : 'text-slate-300'}`}>
                {day}
              </span>

              {bucket?.adaSnapshotBerbeda && !belumTerjadi && (
                <AlertTriangle className="absolute right-1 top-1 h-3 w-3 text-amber-500" />
              )}

              {!belumTerjadi && (
                <div className="mt-auto flex gap-0.5 pt-1.5 sm:gap-1">
                  {SESSIONS.map(sesi => {
                    const rowsSesi = bucket?.perSesi[sesi]
                    const tone = rowsSesi?.length ? STATUS_TONE[worstStatus(rowsSesi)] : 'bg-slate-200'
                    return (
                      <span
                        key={sesi}
                        className={`h-1.5 flex-1 rounded-full ${tone} ${rowsSesi && rowsSesi.length > 1 ? 'ring-1 ring-slate-900/25' : ''}`}
                      />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PanelDetail({ tanggal, bucket }: { tanggal: string; bucket: DayBucket | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 lg:sticky lg:top-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rincian tanggal</p>
      {!tanggal || !bucket ? (
        <p className="mt-2 text-sm text-slate-500">
          Pilih salah satu tanggal berwarna pada kalender untuk melihat rincian kelas, sumber data, dan catatannya.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm font-black text-slate-800">
            {bucket.rows[0]?.hari}, {tanggal}
          </p>
          <p className="text-xs text-slate-400">{bucket.rows.length} waktu wajib</p>
          <div className="mt-3 space-y-2">
            {bucket.rows.map(row => (
              <div key={`${row.tanggal}-${row.sesi}-${row.kelas}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${SESSION_COLORS[row.sesi]}`}>
                    {row.sesi_label}
                  </span>
                  <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-black ${statusClass(row.status)}`}>
                    {row.status_label}
                  </span>
                  <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-black ${row.snapshot_berbeda ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    {sourceLabel(row)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-700">{row.kelas}</p>
                {row.snapshot_berbeda && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Snapshot: {row.snapshot_guru_nama || '-'}; jadwal: {row.jadwal_guru_nama || '-'}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">Catatan: {row.catatan}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
