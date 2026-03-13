'use client'

import { useState, useEffect } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, School, GraduationCap, ArrowRightLeft, Loader2, BookOpen, Bed, X } from 'lucide-react'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
type SantriKamar = { id: string; nama_lengkap: string; nis: string; sekolah: string | null; kelas_sekolah: string | null }

// Palet warna konsisten
const PALETTE = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f97316','#10b981','#14b8a6','#f59e0b','#64748b','#ef4444']

// ---- Pie Chart SVG ----
function PieChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const r = size / 2
  const cx = r, cy = r
  let startAngle = -Math.PI / 2
  const slices = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    startAngle += angle
    const x2 = cx + r * Math.cos(startAngle)
    const y2 = cy + r * Math.sin(startAngle)
    const large = angle > Math.PI ? 1 : 0
    return { ...d, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, pct: Math.round(d.value / total * 100) }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5">
          <title>{s.label}: {s.value} ({s.pct}%)</title>
        </path>
      ))}
    </svg>
  )
}

// ---- Horizontal Bar ----
function HBar({ label, value, max, color, sublabel }: { label: string; value: number; max: number; color: string; sublabel?: string }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0
  return (
    <div className="flex items-center gap-2 group">
      <div className="w-28 shrink-0 text-right">
        <span className="text-xs font-medium text-gray-600 truncate block">{label}</span>
        {sublabel && <span className="text-[10px] text-gray-400">{sublabel}</span>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white mix-blend-plus-lighter">{value > 0 ? value : ''}</span>
      </div>
      <span className="w-8 text-right text-xs font-bold text-gray-700 shrink-0">{pct}%</span>
    </div>
  )
}

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalKamar, setModalKamar] = useState<{ asrama: string; kamar: string; list: SantriKamar[] } | null>(null)

  useEffect(() => { loadData() }, [asrama])
  const loadData = async () => { setLoading(true); setData(await getSensusData(asrama)); setLoading(false) }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>
  if (!data) return <div className="flex h-96 items-center justify-center text-gray-400">Tidak ada data santri.</div>

  const asramaKeys = data?.distribusi_kamar ? Object.keys(data.distribusi_kamar).sort() : []

  // -- Pie data: Jenjang --
  const jenjangPie = [
    { label: 'SLTP',  value: data.jenjang.SLTP,  color: '#3b82f6' },
    { label: 'SLTA',  value: data.jenjang.SLTA,  color: '#6366f1' },
    { label: 'Kuliah', value: data.jenjang.KULIAH, color: '#8b5cf6' },
    { label: 'Lainnya', value: data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA, color: '#94a3b8' },
  ]

  // -- Bar data: Detail sekolah (top 8) --
  const sekolahEntries = Object.entries(data.jenjang.detail as Record<string,number>)
    .sort(([,a],[,b]) => b - a).slice(0, 9)
  const sekolahMax = sekolahEntries[0]?.[1] || 1

  // -- Pie data: Marhalah --
  const marhalahEntries = Object.entries(data.marhalah as Record<string,number>).sort(([,a],[,b]) => b - a)
  const marhalahPie = marhalahEntries.map(([label, value], i) => ({ label, value: value as number, color: PALETTE[i % PALETTE.length] }))

  // -- Bar data: Kelas sekolah --
  const kelasEntries = Object.entries(data.kelas_sekolah as Record<string,number>).sort()
  const kelasMax = Math.max(...kelasEntries.map(([,v]) => v as number), 1)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600"/> Sensus Penduduk
          </h1>
          <p className="text-gray-500 text-sm">Statistik demografi santri {asrama !== 'SEMUA' ? `Asrama ${asrama}` : 'Se-Pesantren'}.</p>
        </div>
        <div className="bg-white p-1 rounded-lg border shadow-sm flex items-center gap-2">
          <Home className="w-4 h-4 ml-2 text-gray-400"/>
          <select value={asrama} onChange={e => setAsrama(e.target.value)} className="bg-transparent font-bold text-sm text-gray-700 p-2 outline-none cursor-pointer">
            {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Penduduk"       value={data.total}              icon={Users}         color="bg-blue-600" />
        <StatCard label="Masuk Bulan Ini"      value={data.masuk_bulan_ini}    icon={ArrowRightLeft} color="bg-green-600" />
        <StatCard label="Keluar Bulan Ini"     value={data.keluar_bulan_ini}   icon={ArrowRightLeft} color="bg-red-600" />
        <StatCard label="Mahasiswa"            value={data.jenjang.KULIAH}     icon={GraduationCap} color="bg-purple-600" />
      </div>

      {/* ROW 2: Jenjang + Marhalah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* JENJANG PENDIDIKAN */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide border-b pb-2">
            <School className="w-4 h-4 text-blue-500"/> Jenjang Pendidikan Formal
          </h3>
          <div className="flex gap-5 items-center mb-5">
            <PieChart data={jenjangPie} size={100} />
            <div className="flex-1 space-y-1.5">
              {jenjangPie.filter(d => d.value > 0).map(d => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}/>
                  <span className="flex-1 text-gray-600">{d.label}</span>
                  <span className="font-bold text-gray-800">{d.value}</span>
                  <span className="text-gray-400 w-8 text-right">{data.total > 0 ? Math.round(d.value/data.total*100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* Bar detail sekolah */}
          <div className="border-t pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Sekolah</p>
            <div className="space-y-1.5">
              {sekolahEntries.map(([key, val]: any, i) => (
                <HBar key={key} label={key} value={val} max={sekolahMax} color={PALETTE[i % PALETTE.length]} />
              ))}
            </div>
          </div>
        </div>

        {/* MARHALAH + KELAS SEKOLAH */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide border-b pb-2">
            <BookOpen className="w-4 h-4 text-green-600"/> Sebaran Marhalah
          </h3>
          <div className="flex gap-5 items-center mb-5">
            <PieChart data={marhalahPie} size={100} />
            <div className="flex-1 space-y-1">
              {marhalahPie.slice(0,6).map(d => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}/>
                  <span className="flex-1 text-gray-600 truncate">{d.label}</span>
                  <span className="font-bold text-gray-800">{d.value}</span>
                </div>
              ))}
              {marhalahPie.length > 6 && <p className="text-[10px] text-gray-400 pl-5">+{marhalahPie.length-6} lainnya</p>}
            </div>
          </div>
          {/* Bar kelas sekolah */}
          <div className="border-t pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Detail Kelas Sekolah</p>
            <div className="space-y-1.5">
              {kelasEntries.map(([key, val]: any, i) => (
                <HBar key={key} label={`Kelas ${key}`} value={val} max={kelasMax} color={PALETTE[(i+4) % PALETTE.length]} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KEPADATAN PER KAMAR */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2 border-b pb-2 text-sm uppercase tracking-wide">
          <Bed className="w-4 h-4 text-indigo-500"/> Kepadatan Penduduk per Kamar
        </h3>
        <div className="space-y-4">
          {asramaKeys.map(namaAsrama => {
            const kamarData = data.distribusi_kamar[namaAsrama]
            const santriKamarData = data.santri_kamar?.[namaAsrama] || {}
            const sortedKamars = Object.keys(kamarData).sort((a, b) => (parseInt(a)||0) - (parseInt(b)||0))
            const totalAsrama = sortedKamars.reduce((sum, k) => sum + kamarData[k], 0)
            return (
              <div key={namaAsrama} className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
                    <Home className="w-3.5 h-3.5"/> Asrama {namaAsrama}
                  </span>
                  <span className="text-xs text-slate-400">{sortedKamars.length} kamar · {totalAsrama} jiwa</span>
                </div>
                <div className="p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {sortedKamars.map(kamar => {
                    const jumlah = kamarData[kamar]
                    const [bg, border, text, hov] =
                      jumlah >= 10 ? ['bg-red-50',    'border-red-200',    'text-red-700',    'hover:bg-red-100']
                    : jumlah >= 7  ? ['bg-orange-50', 'border-orange-200', 'text-orange-700', 'hover:bg-orange-100']
                    :                ['bg-indigo-50', 'border-indigo-200', 'text-indigo-700', 'hover:bg-indigo-100']
                    return (
                      <button
                        key={kamar}
                        onClick={() => setModalKamar({ asrama: namaAsrama, kamar, list: santriKamarData[kamar] || [] })}
                        className={`${bg} ${border} ${text} ${hov} border rounded-lg transition-all active:scale-95 text-left overflow-hidden`}
                        title={`Kamar ${kamar} — ${jumlah} santri`}
                      >
                        <div className="px-2 py-1 border-b border-inherit bg-black/5">
                          <span className="text-[10px] font-bold leading-none opacity-80">Kamar {kamar}</span>
                        </div>
                        <div className="px-2 py-1.5 flex items-baseline gap-1">
                          <span className="text-lg font-extrabold leading-none">{jumlah}</span>
                          <span className="text-[9px] opacity-60">jiwa</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Klik kamar untuk lihat daftar santri &nbsp;·&nbsp;
          <span className="text-red-400 font-bold">■</span> Padat (≥10) &nbsp;
          <span className="text-orange-400 font-bold">■</span> Sedang (7–9) &nbsp;
          <span className="text-indigo-400 font-bold">■</span> Normal (&lt;7)
        </p>
      </div>

      {/* MODAL */}
      {modalKamar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalKamar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-gray-800">Kamar {modalKamar.kamar}</h3>
                <p className="text-xs text-gray-500">Asrama {modalKamar.asrama} &nbsp;·&nbsp; {modalKamar.list.length} santri</p>
              </div>
              <button onClick={() => setModalKamar(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500"/>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y">
              {modalKamar.list.length === 0
                ? <div className="py-10 text-center text-gray-400 text-sm">Tidak ada data santri.</div>
                : modalKamar.list
                    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
                    .map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                        <span className="w-5 text-xs text-gray-400 font-mono shrink-0 text-right">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.nama_lengkap}</p>
                          <p className="text-xs text-gray-400">{s.nis || '-'} · {s.sekolah || 'Tidak sekolah'}{s.kelas_sekolah ? ` Kelas ${s.kelas_sekolah}` : ''}</p>
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

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-full text-white shadow-sm ${color}`}><Icon className="w-5 h-5"/></div>
      <div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
