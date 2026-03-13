'use client'

import { useState, useEffect } from 'react'
import { getSensusData } from './actions'
import { BarChart3, Users, Home, School, GraduationCap, ArrowRightLeft, Loader2, BookOpen, Bed, X } from 'lucide-react'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

type SantriKamar = { id: string; nama_lengkap: string; nis: string; sekolah: string | null; kelas_sekolah: string | null }

export default function SensusPage() {
  const [asrama, setAsrama] = useState('SEMUA')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalKamar, setModalKamar] = useState<{ asrama: string; kamar: string; list: SantriKamar[] } | null>(null)

  useEffect(() => { loadData() }, [asrama])

  const loadData = async () => {
    setLoading(true)
    const res = await getSensusData(asrama)
    setData(res)
    setLoading(false)
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>
  if (!data) return <div className="flex h-96 items-center justify-center text-gray-400">Tidak ada data santri.</div>

  const asramaKeys = data?.distribusi_kamar ? Object.keys(data.distribusi_kamar).sort() : []

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">

      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600"/> Sensus Penduduk
          </h1>
          <p className="text-gray-500 text-sm">Statistik demografi santri {asrama !== 'SEMUA' ? `Asrama ${asrama}` : 'Se-Pesantren'}.</p>
        </div>
        <div className="bg-white p-1 rounded-lg border shadow-sm flex items-center gap-2">
          <Home className="w-4 h-4 ml-2 text-gray-400"/>
          <select value={asrama} onChange={(e) => setAsrama(e.target.value)} className="bg-transparent font-bold text-sm text-gray-700 p-2 outline-none cursor-pointer">
            {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* 1. RINGKASAN UTAMA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Penduduk" value={data.total} icon={Users} color="bg-blue-600" />
        <StatCard label="Santri Baru (Bln Ini)" value={data.masuk_bulan_ini} icon={ArrowRightLeft} color="bg-green-600" />
        <StatCard label="Santri Keluar (Bln Ini)" value={data.keluar_bulan_ini} icon={ArrowRightLeft} color="bg-red-600" />
        <StatCard label="Mahasiswa" value={data.jenjang.KULIAH} icon={GraduationCap} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 2. STATISTIK JENJANG SEKOLAH */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
            <School className="w-5 h-5 text-blue-500"/> Jenjang Pendidikan Formal
          </h3>
          <div className="space-y-5">
            <ProgressBar label="SLTP (MTS/SMP)" value={data.jenjang.SLTP} total={data.total} color="bg-blue-500" />
            <ProgressBar label="SLTA (MA/SMA/SMK)" value={data.jenjang.SLTA} total={data.total} color="bg-indigo-500" />
            <ProgressBar label="Perguruan Tinggi" value={data.jenjang.KULIAH} total={data.total} color="bg-purple-500" />
            <ProgressBar label="Tidak Sekolah / Lainnya" value={data.jenjang.TIDAK_SEKOLAH + data.jenjang.LAINNYA} total={data.total} color="bg-gray-400" />
          </div>

          {/* RINCIAN SEKOLAH */}
          <div className="mt-6 pt-4 border-t border-dashed">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Rincian Sekolah</p>
            <div className="space-y-1.5">
              {Object.entries(data.jenjang.detail)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([key, val]: any) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                    <span className="text-sm text-slate-700 truncate pr-2">{key}</span>
                    <span className="font-bold text-slate-800 text-sm shrink-0 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{val}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* 3. STATISTIK KELAS & MARHALAH */}
        <div className="space-y-6">

          {/* Marhalah */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600"/> Sebaran Marhalah
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data.marhalah).map(([key, val]: any) => (
                <div key={key} className="bg-green-50 text-green-800 px-4 py-3 rounded-lg border border-green-100 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase">{key}</span>
                  <span className="font-extrabold text-lg">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kelas Sekolah */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-orange-600"/> Detail Kelas Sekolah
            </h3>
            <div className="space-y-1.5">
              {Object.entries(data.kelas_sekolah).sort().map(([key, val]: any) => (
                <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">
                  <span className="text-sm font-medium text-orange-800">Kelas {key}</span>
                  <span className="font-bold text-orange-900 bg-white border border-orange-200 px-2 py-0.5 rounded-full text-sm">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. KEPADATAN PER KAMAR */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
          <Bed className="w-5 h-5 text-indigo-500"/> Kepadatan Penduduk per Kamar
        </h3>
        <div className="space-y-4">
          {asramaKeys.map(namaAsrama => {
            const kamarData = data.distribusi_kamar[namaAsrama]
            const santriKamarData = data.santri_kamar?.[namaAsrama] || {}
            const sortedKamars = Object.keys(kamarData).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
            const totalAsrama = sortedKamars.reduce((sum, k) => sum + kamarData[k], 0)

            return (
              <div key={namaAsrama} className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <Home className="w-3.5 h-3.5"/> Asrama {namaAsrama}
                  </span>
                  <span className="text-xs text-slate-400">{sortedKamars.length} kamar · {totalAsrama} jiwa</span>
                </div>
                <div className="p-3 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                  {sortedKamars.map(kamar => {
                    const jumlah = kamarData[kamar]
                    const density = jumlah >= 10 ? 'bg-red-100 border-red-200 text-red-700 hover:bg-red-200' :
                                    jumlah >= 7  ? 'bg-orange-100 border-orange-200 text-orange-700 hover:bg-orange-200' :
                                                   'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                    return (
                      <button
                        key={kamar}
                        onClick={() => setModalKamar({ asrama: namaAsrama, kamar, list: santriKamarData[kamar] || [] })}
                        className={`border rounded-lg py-2 px-1 text-center transition-all active:scale-95 ${density}`}
                        title={`Kamar ${kamar} — ${jumlah} santri`}
                      >
                        <span className="block text-[9px] font-semibold opacity-50 leading-none mb-1">{kamar}</span>
                        <span className="block text-sm font-extrabold leading-none">{jumlah}</span>
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

      {/* MODAL LIST SANTRI PER KAMAR */}
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
              {modalKamar.list.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Tidak ada data santri.</div>
              ) : (
                modalKamar.list
                  .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
                  .map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="w-6 text-xs text-gray-400 font-mono shrink-0 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-gray-400">{s.nis || '-'} · {s.sekolah || 'Tidak sekolah'}{s.kelas_sekolah ? ` Kelas ${s.kelas_sekolah}` : ''}</p>
                      </div>
                    </div>
                  ))
              )}
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

function ProgressBar({ label, value, total, color }: any) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-bold text-gray-700">{label}</span>
        <span className="font-bold text-gray-900">{value} <span className="text-xs text-gray-400 font-normal">({percent}%)</span></span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  )
}
