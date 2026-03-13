'use client'

import { useState, useEffect } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, ArrowRightLeft, Loader2, BookOpen, Bed, X, Male, Female, User } from 'lucide-react'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
type SantriKamar = { id: string; nama_lengkap: string; nis: string; sekolah: string | null; kelas_sekolah: string | null }

const MARHALAH_COLORS = ['#10b981','#34d399','#6ee7b7','#059669','#047857','#065f46','#064e3b','#022c22','#a7f3d0','#d1fae5']
const JENJANG_COLORS  = { SLTP: '#3b82f6', SLTA: '#6366f1', KULIAH: '#8b5cf6', TIDAK_SEKOLAH: '#94a3b8', LAINNYA: '#cbd5e1' }

// ─── Pie Chart SVG (tanpa library) ───────────────────────────────────────────
function PieChart({ slices, size = 140, donut = true }: {
  slices: { label: string; value: number; color: string }[]
  size?: number
  donut?: boolean
}) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (!total) return null
  const r = size / 2, cx = r, cy = r, ir = donut ? r * 0.52 : 0
  let angle = -Math.PI / 2
  const paths = slices.filter(d => d.value > 0).map(d => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    const ix1 = cx + ir * Math.cos(angle - sweep), iy1 = cy + ir * Math.sin(angle - sweep)
    const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
    const lg = sweep > Math.PI ? 1 : 0
    const path = donut
      ? `M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${lg} 0 ${ix1},${iy1} Z`
      : `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} Z`
    return { ...d, path, pct: Math.round(d.value / total * 100) }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 drop-shadow-sm">
      {paths.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2">
          <title>{s.label}: {s.value} ({s.pct}%)</title>
        </path>
      ))}
    </svg>
  )
}

// ─── Horizontal bar dengan label di luar ─────────────────────────────────────
function HBarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-36 shrink-0 truncate text-gray-600 text-right">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
      </div>
      <span className="w-7 shrink-0 font-bold text-gray-800 text-right">{value}</span>
    </div>
  )
}

// ─── Legend dot row ───────────────────────────────────────────────────────────
function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="flex-1 text-gray-600 truncate">{label}</span>
      <span className="font-bold text-gray-800 tabular-nums">{value}</span>
      <span className="text-gray-400 w-9 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalKamar, setModalKamar] = useState<{ asrama: string; kamar: string; list: SantriKamar[] } | null>(null)

  useEffect(() => { loadData() }, [asrama])
  const loadData = async () => {
    setLoading(true)
    setData(await getSensusData(asrama))
    setLoading(false)
  }

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
    </div>
  )
  if (!data) return <div className="flex h-96 items-center justify-center text-gray-400">Tidak ada data.</div>

  const total = data.total
  const asramaKeys = Object.keys(data.distribusi_kamar || {}).sort()

  // Jenjang pie
  const jenjangSlices = [
    { label: 'SLTP',           value: data.jenjang.SLTP,         color: JENJANG_COLORS.SLTP },
    { label: 'SLTA',           value: data.jenjang.SLTA,         color: JENJANG_COLORS.SLTA },
    { label: 'Kuliah',         value: data.jenjang.KULIAH,       color: JENJANG_COLORS.KULIAH },
    { label: 'Tidak Sekolah',  value: data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA, color: JENJANG_COLORS.TIDAK_SEKOLAH },
  ]

  // Rincian sekolah bar (top 8, sorted desc)
  const sekolahBar = Object.entries(data.jenjang.detail as Record<string,number>)
    .sort(([,a],[,b]) => (b as number) - (a as number)).slice(0,8)
  const sekolahMax = (sekolahBar[0]?.[1] as number) || 1

  // Kelas sekolah bar
  const kelasBar = Object.entries(data.kelas_sekolah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM SET')
    .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true }))
  const kelasMax = Math.max(...kelasBar.map(([,v]) => v as number), 1)

  // Marhalah pie
  const marhalahSlices = Object.entries(data.marhalah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM MASUK KELAS')
    .sort(([,a],[,b]) => (b as number) - (a as number))
    .map(([label, value], i) => ({ label, value: value as number, color: MARHALAH_COLORS[i % MARHALAH_COLORS.length] }))

  const marhalahTotal = marhalahSlices.reduce((s,d) => s + d.value, 0)

  const laki    = data.jenis_kelamin?.L || 0
  const perempuan = data.jenis_kelamin?.P || 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600"/> Sensus Penduduk
          </h1>
          <p className="text-sm text-gray-500">
            Statistik demografi santri {asrama !== 'SEMUA' ? `Asrama ${asrama}` : 'Se-Pesantren'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
          <Home className="w-4 h-4 text-gray-400"/>
          <select value={asrama} onChange={e => setAsrama(e.target.value)}
            className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer">
            {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <Users className="w-6 h-6 opacity-70"/>
          <div className="mt-3">
            <p className="text-4xl font-black tabular-nums">{total}</p>
            <p className="text-blue-100 text-xs mt-1 font-medium uppercase tracking-wide">Total Santri</p>
          </div>
        </div>
        {/* Laki-laki */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600"/>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-blue-700 tabular-nums">{laki}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Laki-laki</p>
            <p className="text-xs text-blue-400">{total > 0 ? Math.round(laki/total*100) : 0}%</p>
          </div>
        </div>
        {/* Perempuan */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
            <User className="w-4 h-4 text-pink-500"/>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-pink-600 tabular-nums">{perempuan}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Perempuan</p>
            <p className="text-xs text-pink-400">{total > 0 ? Math.round(perempuan/total*100) : 0}%</p>
          </div>
        </div>
        {/* Masuk / Keluar */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col gap-3 justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Masuk</p>
              <p className="text-xl font-black text-green-600 tabular-nums">{data.masuk_bulan_ini}</p>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-gray-300"/>
            <div className="text-right">
              <p className="text-xs text-gray-400 font-medium">Keluar</p>
              <p className="text-xl font-black text-red-500 tabular-nums">{data.keluar_bulan_ini}</p>
            </div>
          </div>
          <p className="text-[10px] text-center text-gray-400 border-t pt-2">Pergerakan bulan ini</p>
        </div>
      </div>

      {/* ── ROW 2: PENDIDIKAN FORMAL ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 rounded-full inline-block"/>
          Pendidikan Formal
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Kiri: Pie jenjang + legend */}
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Jenjang</p>
            <div className="flex gap-6 items-center">
              <PieChart slices={jenjangSlices} size={130} donut={true}/>
              <div className="flex-1 space-y-2.5">
                {jenjangSlices.filter(d => d.value > 0).map(d => (
                  <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={total}/>
                ))}
              </div>
            </div>
          </div>

          {/* Kanan: Bar detail sekolah + bar kelas */}
          <div className="space-y-5">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Rincian Sekolah</p>
              <div className="space-y-2">
                {sekolahBar.map(([k, v]: any, i) => (
                  <HBarRow key={k} label={k} value={v} max={sekolahMax}
                    color={[JENJANG_COLORS.SLTP, JENJANG_COLORS.SLTA, JENJANG_COLORS.KULIAH, JENJANG_COLORS.TIDAK_SEKOLAH][i % 4]}/>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Detail Kelas Sekolah</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {kelasBar.map(([k, v]: any) => (
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center hover:bg-slate-100 transition-colors">
                    <p className="text-[10px] text-slate-500 font-semibold">Kelas {k}</p>
                    <p className="text-base font-extrabold text-slate-800 tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── ROW 3: MARHALAH ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
          <span className="w-1 h-4 bg-green-500 rounded-full inline-block"/>
          Sebaran Marhalah
        </h3>
        <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <PieChart slices={marhalahSlices} size={150} donut={false}/>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 w-full">
            {marhalahSlices.map(d => (
              <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={marhalahTotal}/>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 4: KAMAR ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
          <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block"/>
          Kepadatan per Kamar
          <span className="ml-auto text-[10px] font-normal text-gray-400 normal-case tracking-normal">
            <span className="text-red-400 font-bold">■</span> ≥10 &nbsp;
            <span className="text-orange-400 font-bold">■</span> 7–9 &nbsp;
            <span className="text-indigo-400 font-bold">■</span> &lt;7
          </span>
        </h3>
        <div className="space-y-5">
          {asramaKeys.map(nama => {
            const kamarData = data.distribusi_kamar[nama]
            const santriData = data.santri_kamar?.[nama] || {}
            const kamars = Object.keys(kamarData).sort((a,b) => (parseInt(a)||0) - (parseInt(b)||0))
            const tot = kamars.reduce((s,k) => s + kamarData[k], 0)
            return (
              <div key={nama}>
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-3.5 h-3.5 text-slate-400"/>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{nama}</span>
                  <span className="text-xs text-slate-400">({kamars.length} kamar · {tot} jiwa)</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                  {kamars.map(kamar => {
                    const n = kamarData[kamar]
                    const cls = n >= 10 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                              : n >= 7  ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                              :           'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    return (
                      <button key={kamar} onClick={() => setModalKamar({ asrama: nama, kamar, list: santriData[kamar] || [] })}
                        className={`${cls} border rounded-lg overflow-hidden text-left transition-all active:scale-95 cursor-pointer`}>
                        <div className="bg-black/[0.04] border-b border-inherit px-1.5 py-0.5">
                          <span className="text-[9px] font-bold opacity-70 leading-none">{kamar}</span>
                        </div>
                        <div className="px-1.5 py-1 flex items-baseline gap-0.5">
                          <span className="text-sm font-extrabold leading-none tabular-nums">{n}</span>
                          <span className="text-[8px] opacity-50 leading-none">jiwa</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MODAL SANTRI ── */}
      {modalKamar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setModalKamar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-gray-800">Kamar {modalKamar.kamar}</h3>
                <p className="text-xs text-gray-500">Asrama {modalKamar.asrama} · {modalKamar.list.length} santri</p>
              </div>
              <button onClick={() => setModalKamar(null)} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400"/>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y">
              {modalKamar.list.length === 0
                ? <div className="py-12 text-center text-gray-400 text-sm">Tidak ada data santri.</div>
                : modalKamar.list
                    .sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
                    .map((s,i) => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                        <span className="w-5 text-[11px] text-gray-400 font-mono shrink-0 text-right">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.nama_lengkap}</p>
                          <p className="text-xs text-gray-400">
                            {s.nis || '—'} · {s.sekolah || 'Tidak sekolah'}
                            {s.kelas_sekolah ? ` Kelas ${s.kelas_sekolah}` : ''}
                          </p>
                        </div>
                      </div>
                    ))
              }
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
