'use client'

import { useState } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, ArrowRightLeft, Loader2, BookOpen, Bed, X, User, Search } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
type SantriKamar = { id: string; nama_lengkap: string; nis: string; kelas_pesantren: string | null; sekolah: string | null; kelas_sekolah: string | null }

const MARHALAH_COLORS = ['#10b981','#34d399','#6ee7b7','#059669','#047857','#065f46','#064e3b','#022c22','#a7f3d0','#d1fae5']
const JENJANG_COLORS  = { SLTP: '#3b82f6', SLTA: '#6366f1', KULIAH: '#8b5cf6', TIDAK_SEKOLAH: '#94a3b8', LAINNYA: '#cbd5e1' }

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

function HBarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-36 shrink-0 truncate text-slate-600 text-right">{label}</span>
      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
      </div>
      <span className="w-7 shrink-0 font-bold text-slate-800 text-right">{value}</span>
    </div>
  )
}

function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="flex-1 text-slate-600 truncate">{label}</span>
      <span className="font-bold text-slate-800 tabular-nums">{value}</span>
      <span className="text-slate-400 w-9 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [modalKamar, setModalKamar] = useState<{ asrama: string; kamar: string; list: SantriKamar[] } | null>(null)
  // Simpan asrama terakhir yang sudah di-fetch, untuk tahu kapan perlu re-fetch
  const [fetchedAsrama, setFetchedAsrama] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setData(await getSensusData(asrama))
    setFetchedAsrama(asrama)
    setLoading(false)
  }

  const isDirty = asrama !== fetchedAsrama

  // Computed values (hanya kalau data ada)
  const total = data?.total ?? 0
  const asramaKeys = Object.keys(data?.distribusi_kamar || {}).sort()
  const jenjangSlices = data ? [
    { label: 'SLTP',          value: data.jenjang.SLTP,         color: JENJANG_COLORS.SLTP },
    { label: 'SLTA',          value: data.jenjang.SLTA,         color: JENJANG_COLORS.SLTA },
    { label: 'Kuliah',        value: data.jenjang.KULIAH,       color: JENJANG_COLORS.KULIAH },
    { label: 'Tidak Sekolah', value: data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA, color: JENJANG_COLORS.TIDAK_SEKOLAH },
  ] : []
  const sekolahBar = data ? Object.entries(data.jenjang.detail as Record<string,number>)
    .sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 8) : []
  const sekolahMax = (sekolahBar[0]?.[1] as number) || 1
  const kelasBar = data ? Object.entries(data.kelas_sekolah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM SET')
    .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true })) : []
  const kelasMax = Math.max(...kelasBar.map(([,v]) => v as number), 1)
  const marhalahSlices = data ? Object.entries(data.marhalah as Record<string,number>)
    .filter(([k]) => k !== 'BELUM MASUK KELAS')
    .sort(([,a],[,b]) => (b as number) - (a as number))
    .map(([label, value], i) => ({ label, value: value as number, color: MARHALAH_COLORS[i % MARHALAH_COLORS.length] })) : []
  const marhalahTotal = marhalahSlices.reduce((s, d) => s + d.value, 0)
  const laki = data?.jenis_kelamin?.L || 0
  const perempuan = data?.jenis_kelamin?.P || 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <DashboardPageHeader
          title="Sensus Penduduk"
          description={`Statistik demografi santri ${asrama !== 'SEMUA' ? `Asrama ${asrama}` : 'se-Pesantren'}.`}
          className="flex-1"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <Home className="w-4 h-4 text-slate-400"/>
            <select value={asrama} onChange={e => setAsrama(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer">
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 ${
              isDirty || !data
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin"/> Menghitung...</>
              : <><Search className="w-4 h-4"/> {data ? (isDirty ? 'Perbarui' : 'Hitung Ulang') : 'Tampilkan'}</>
            }
          </button>
        </div>
      </div>

      {/* EMPTY STATE */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
            <BarChart3 className="w-10 h-10 text-blue-300"/>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-500">Data belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih filter lalu tekan <strong>Tampilkan</strong> untuk menghitung statistik santri.</p>
          </div>
          <button onClick={loadData}
            className="mt-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow">
            Tampilkan Sekarang
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
          <p className="text-sm text-slate-500">Menghitung data sensus...</p>
        </div>
      )}

      {/* HASIL */}
      {data && !loading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

          {/* STAT CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <Users className="w-6 h-6 opacity-70"/>
              <div className="mt-3">
                <p className="text-4xl font-black tabular-nums">{total}</p>
                <p className="text-blue-100 text-xs mt-1 font-medium uppercase tracking-wide">Total Santri</p>
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600"/>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-black text-blue-700 tabular-nums">{laki}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Laki-laki</p>
                <p className="text-xs text-blue-400">{total > 0 ? Math.round(laki/total*100) : 0}%</p>
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                <User className="w-4 h-4 text-pink-500"/>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-black text-pink-600 tabular-nums">{perempuan}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Perempuan</p>
                <p className="text-xs text-pink-400">{total > 0 ? Math.round(perempuan/total*100) : 0}%</p>
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col gap-3 justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Masuk</p>
                  <p className="text-xl font-black text-green-600 tabular-nums">{data.masuk_bulan_ini}</p>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-slate-300"/>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium">Keluar</p>
                  <p className="text-xl font-black text-red-500 tabular-nums">{data.keluar_bulan_ini}</p>
                </div>
              </div>
              <p className="text-[10px] text-center text-slate-400 border-t pt-2">Pergerakan bulan ini</p>
            </div>
          </div>

          {/* PENDIDIKAN FORMAL */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full inline-block"/>
              Pendidikan Formal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4">Jenjang</p>
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <PieChart slices={jenjangSlices} size={160} donut={true}/>
                  <div className="flex-1 space-y-3 w-full">
                    {jenjangSlices.filter(d => d.value > 0).map(d => (
                      <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={total}/>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Rincian Sekolah</p>
                  <div className="space-y-2">
                    {sekolahBar.map(([k, v]: any, i) => (
                      <HBarRow key={k} label={k} value={v} max={sekolahMax}
                        color={[JENJANG_COLORS.SLTP, JENJANG_COLORS.SLTA, JENJANG_COLORS.KULIAH, JENJANG_COLORS.TIDAK_SEKOLAH][i % 4]}/>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Detail Kelas Sekolah</p>
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

          {/* MARHALAH */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
              <span className="w-1 h-4 bg-green-500 rounded-full inline-block"/>
              Sebaran Marhalah
            </h3>
            <div className="flex flex-col sm:flex-row gap-8 items-center">
              <PieChart slices={marhalahSlices} size={180} donut={false}/>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 w-full">
                {marhalahSlices.map(d => (
                  <LegendRow key={d.label} color={d.color} label={d.label} value={d.value} total={marhalahTotal}/>
                ))}
              </div>
            </div>
          </div>

          {/* KAMAR */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block"/>
              Kepadatan per Kamar
              <span className="ml-auto text-[10px] font-normal text-slate-400 normal-case tracking-normal">
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
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {kamars.map(kamar => {
                        const n = kamarData[kamar]
                        const cls = n >= 10 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                  : n >= 7  ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                                  :           'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        return (
                          <button key={kamar} onClick={() => setModalKamar({ asrama: nama, kamar, list: santriData[kamar] || [] })}
                            className={`${cls} border rounded-xl overflow-hidden text-left transition-all active:scale-95 cursor-pointer w-full`}>
                            <div className="bg-black/[0.06] border-b border-inherit px-2.5 py-1.5">
                              <span className="text-xs font-bold leading-none">Kamar {kamar}</span>
                            </div>
                            <div className="px-2.5 py-2 flex items-baseline gap-1">
                              <span className="text-2xl font-black leading-none tabular-nums">{n}</span>
                              <span className="text-[10px] opacity-50 leading-none">jiwa</span>
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

        </div>
      )}

      {/* MODAL SANTRI */}
      {modalKamar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setModalKamar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">Kamar {modalKamar.kamar}</h3>
                <p className="text-xs text-slate-500">Asrama {modalKamar.asrama} · {modalKamar.list.length} santri</p>
              </div>
              <button onClick={() => setModalKamar(null)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400"/>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y">
              {modalKamar.list.length === 0
                ? <div className="py-12 text-center text-slate-400 text-sm">Tidak ada data santri.</div>
                : modalKamar.list
                    .sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
                    .map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="w-5 text-[11px] text-slate-400 font-mono shrink-0 text-right">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {s.kelas_pesantren
                              ? <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">{s.kelas_pesantren}</span>
                              : <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Belum masuk kelas</span>
                            }
                            <span className="text-[10px] text-slate-400">{s.sekolah || 'Tidak sekolah'}{s.kelas_sekolah ? ` · Kelas ${s.kelas_sekolah}` : ''}</span>
                          </div>
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
