'use client'

import React, { useState, useEffect } from 'react'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  TrendingUp, CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, UserCheck, UserX, ArrowLeftRight, Eye, X, Check, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  asrama: string
  total_santri: number
  bebas_spp: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  penunggak: number
  total_nominal: number
  persentase: number
  tanggal_setor: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
}

export default function MonitoringSetoranPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [nominal, setNominal] = useState(70000)
  const [data, setData] = useState<AsramaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [userAsrama, setUserAsrama] = useState<string | null>(null)
  
  // MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeRow, setActiveRow] = useState<AsramaRow | null>(null)

  // SETORAN FORM (Inside Modal)
  const [savingSetoran, setSavingSetoran] = useState(false)
  const [formJumlah, setFormJumlah] = useState('')
  const [formPenyetor, setFormPenyetor] = useState('')
  const [isEditingForm, setIsEditingForm] = useState(false)

  const tahunList = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const load = async () => {
    setLoading(true)
    try {
      const [rows, settings] = await Promise.all([
        getMonitoringSetoran(tahun, bulan),
        getSppSettings(tahun),
      ])
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.asrama === userAsrama) : rows)
      setNominal(settings.nominal)
      setHasLoaded(true)
      
      // Update active row silently if modal is open
      if (isModalOpen && activeRow) {
        const updatedRow = rows.find((r: AsramaRow) => r.asrama === activeRow.asrama)
        if (updatedRow) setActiveRow(updatedRow)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientRestriction().then(setUserAsrama)
  }, [])

  function prevBulan() {
    if (bulan === 1) { setBulan(12); setTahun(t => t - 1) }
    else setBulan(b => b - 1)
  }
  function nextBulan() {
    if (bulan === 12) { setBulan(1); setTahun(t => t + 1) }
    else setBulan(b => b + 1)
  }

  function openDetailModal(row: AsramaRow) {
    setActiveRow(row)
    setFormJumlah(row.jumlah_aktual != null ? String(row.jumlah_aktual) : String(row.total_nominal))
    setFormPenyetor(row.nama_penyetor ?? '')
    setIsEditingForm(false)
    setIsModalOpen(true)
  }

  async function handleSimpanSetoran() {
    if (!activeRow) return
    setSavingSetoran(true)
    try {
      const res = await simpanSetoran(
        activeRow.asrama, tahun, bulan,
        Number(formJumlah.replace(/\D/g, '')),
        formPenyetor
      )
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Setoran berhasil disimpan')
      setIsEditingForm(false)
      load() // refetches and updates row
    } finally {
      setSavingSetoran(false)
    }
  }

  const totalSantri    = data.reduce((a, r) => a + r.total_santri, 0)
  const totalBebasSpp  = data.reduce((a, r) => a + r.bebas_spp, 0)
  const totalWajib     = data.reduce((a, r) => a + r.wajib_bayar, 0)
  const totalBayar     = data.reduce((a, r) => a + r.bayar_bulan_ini, 0)
  const totalTunggak   = data.reduce((a, r) => a + r.penunggak, 0)
  const totalNominal   = data.reduce((a, r) => a + r.total_nominal, 0)
  const pctKeseluruhan = totalWajib > 0 ? Math.round((totalBayar / totalWajib) * 100) : 0

  function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
  function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-3 max-w-[100vw] overflow-hidden">
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Monitoring Setoran SPP</h1>
          <p className="text-xs md:text-sm text-slate-500">Rekap pembayaran per asrama bulan {BULAN_NAMA[bulan]} {tahun}</p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={prevBulan} className="p-1.5 rounded bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="min-w-[120px] text-center px-2 font-bold text-slate-800 text-sm">
            {BULAN_NAMA[bulan]} {tahun}
          </div>
          <button onClick={nextBulan} disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1} className="p-1.5 rounded bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        
        <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          {BULAN_NAMA.slice(1).map((b, i) => <option key={i+1} value={i+1}>{b}</option>)}
        </select>
        
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex items-center gap-2 md:ml-auto bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-1.5 text-xs">
          <Banknote className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-blue-800">Tarif {tahun}: <strong>{fmtRp(nominal)}</strong></span>
        </div>

        <button onClick={load} disabled={loading} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ${!hasLoaded ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin border-transparent' : ''}`} />
          {loading ? 'Dimuat...' : !hasLoaded ? 'Tampilkan Data' : 'Perbarui'}
        </button>
      </div>

      {/* ── Ringkasan Total ── */}
      {!userAsrama && (
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: 'Total Santri', value: fmt(totalSantri), icon: Users, color: 'text-slate-700 bg-slate-50 border-slate-200' },
            { label: 'Wajib Bayar', value: fmt(totalWajib), icon: UserCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Lunas', value: fmt(totalBayar), sub: `${pctKeseluruhan}%`, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'Tunggakan', value: fmt(totalTunggak), icon: AlertCircle, color: 'text-rose-700 bg-rose-50 border-rose-200' },
          ].map(item => (
            <div key={item.label} className={`flex-1 min-w-[140px] rounded-xl border p-3 flex items-center justify-between ${item.color}`}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">{item.label}</div>
                <div className="text-xl font-black leading-none">{item.value} {item.sub && <span className="text-xs font-bold ml-1 opacity-80">({item.sub})</span>}</div>
              </div>
              <item.icon className="w-8 h-8 opacity-20 flex-shrink-0" />
            </div>
          ))}
          {/* Uang Card */}
          <div className="flex-1 min-w-[200px] sm:min-w-[240px] rounded-xl border border-indigo-200 p-3 flex flex-col justify-center bg-indigo-50">
             <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-0.5">Potensi Uang Terkumpul</div>
             <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-indigo-800">{fmtRp(totalNominal)}</span>
                <span className="text-[10px] font-bold text-slate-500 line-through">{fmtRp(totalWajib * nominal)}</span>
             </div>
          </div>
        </div>
      )}

      {/* ── Tabel Data (Dinamis & Responsif) ── */}
      <div className="bg-white border md:rounded-2xl shadow-sm rounded-xl overflow-hidden min-h-[40vh]">
        {loading ? (
          <div className="flex justify-center flex-col items-center py-32 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <span className="font-bold">Memuat rincian asrama...</span>
          </div>
        ) : !hasLoaded ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
             <Search className="w-16 h-16 text-slate-200 mb-2"/>
             <p className="text-slate-500 font-bold">Tekan "Tampilkan" untuk melihat daftar.</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center font-bold text-slate-400">Tidak ada data untuk bulan ini.</div>
        ) : (
          <div className="overflow-x-auto">
            {/* DESKTOP TABLE */}
            <table className="w-full text-left hidden sm:table border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Area Asrama</th>
                  <th className="py-3 px-4">Progres Kepatuhan</th>
                  <th className="py-3 px-4 text-right">Potensi Masuk</th>
                  <th className="py-3 px-4 text-center">Status Setoran Fisik</th>
                  <th className="py-3 px-4 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.asrama} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0"><Building2 className="w-4 h-4 text-indigo-600"/></div>
                        <div>
                          <p className="font-bold text-slate-800 leading-tight">{row.asrama}</p>
                          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Users className="w-2.5 h-2.5"/>{fmt(row.total_santri)} Total Santri</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-600">{fmt(row.bayar_bulan_ini)} / {fmt(row.wajib_bayar)} Siswa</span>
                        <span className={row.persentase >= 80 ? 'text-emerald-600' : row.persentase >= 50 ? 'text-yellow-600' : 'text-rose-600'}>{row.persentase}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${row.persentase >= 80 ? 'bg-emerald-500' : row.persentase >= 50 ? 'bg-yellow-400' : 'bg-rose-500'}`} style={{ width: `${row.persentase}%`}}></div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <p className="font-extrabold text-slate-800 text-sm">{fmtRp(row.total_nominal)}</p>
                      <p className="text-[10px] font-bold text-rose-500">-{fmt(row.penunggak)} Berhutang</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.tanggal_setor ? (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5"/>
                          <div className="text-left">
                            <p className="text-[9px] font-black uppercase tracking-wider leading-none">Sudah Setor</p>
                            <p className="text-[9px] font-bold opacity-80 mt-0.5">{format(new Date(row.tanggal_setor), 'dd/MM/yy')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1.5 rounded text-[10px] font-bold border border-slate-200">
                          <CalendarCheck className="w-3.5 h-3.5"/> Belum Laporan
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => openDetailModal(row)} className="p-2 border border-slate-200 text-blue-600 bg-white hover:bg-blue-50 rounded-lg transition-colors font-bold flex focus:outline-none focus:ring-2">
                        <Eye className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* MOBILE COMPACT CARDS */}
            <div className="sm:hidden divide-y divide-slate-100 bg-white">
              {data.map((row) => (
                <div key={row.asrama} onClick={() => openDetailModal(row)} className="p-3 active:bg-slate-50 transition-colors w-full text-left relative overflow-hidden">
                  <div className={`absolute top-0 bottom-0 left-0 w-1 ${row.persentase >= 80 ? 'bg-emerald-500' : row.persentase >= 50 ? 'bg-yellow-400' : 'bg-rose-500'}`} />
                  <div className="flex justify-between items-start pl-2 mb-2">
                    <p className="font-extrabold text-slate-800 text-sm leading-tight flex items-center gap-1.5">{row.asrama} <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 rounded">{fmt(row.total_santri)} Org</span></p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.tanggal_setor ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {row.tanggal_setor ? `Lapor: ${format(new Date(row.tanggal_setor), 'dd/MM')}` : 'BLM SETOR'}
                    </span>
                  </div>
                  <div className="pl-2 grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Uang Masuk</p>
                      <p className="text-xs font-black text-slate-800">{fmtRp(row.total_nominal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Persentase</p>
                      <p className={`text-xs font-black ${row.persentase >= 80 ? 'text-emerald-600' : row.persentase >= 50 ? 'text-yellow-600' : 'text-rose-600'}`}>{row.persentase}% Lunas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Detail & Form Perekaman ── */}
      {isModalOpen && activeRow && (
        <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full sm:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex justify-center items-center"><Building2 className="w-5 h-5"/></div>
                 <div>
                   <h2 className="text-lg font-black text-slate-900 leading-tight">{activeRow.asrama}</h2>
                   <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">Detail & Form Setor</p>
                 </div>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200/50 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 grow">
               {/* Grid Statistik Detail */}
               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatMini icon={<ShieldCheck className="w-3.5 h-3.5 text-purple-500"/>} title="Bebas SPP" value={fmt(activeRow.bebas_spp)} color="text-purple-700"/>
                  <StatMini icon={<UserCheck className="w-3.5 h-3.5 text-blue-500"/>} title="Wajib SPP" value={fmt(activeRow.wajib_bayar)} color="text-blue-700"/>
                  <StatMini icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"/>} title="Sudah Lunas" value={fmt(activeRow.bayar_bulan_ini)} color="text-emerald-700"/>
                  <StatMini icon={<UserX className="w-3.5 h-3.5 text-rose-500"/>} title="Penunggak" value={fmt(activeRow.penunggak)} color="text-rose-700"/>
                  <StatMini icon={<ArrowLeftRight className="w-3.5 h-3.5 text-amber-500"/>} title="Tunggakan Lalu" value={fmt(activeRow.bayar_tunggakan_lalu)} color="text-amber-700"/>
               </div>

               {/* Potongan Form Setoran */}
               <div className="border border-blue-100 bg-blue-50/30 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Banknote className="w-32 h-32"/></div>
                  <h3 className="font-extrabold text-slate-800 mb-1 flex items-center gap-2 relative z-10">
                     <CalendarCheck className="w-4 h-4 text-blue-600"/> Bukti Setoran Asrama
                  </h3>
                  
                  {activeRow.tanggal_setor && !isEditingForm ? (
                    <div className="mt-4 relative z-10 bg-white border border-emerald-100 rounded-xl p-4 flex flex-col justify-center items-center text-center shadow-sm">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2"/>
                      <p className="text-xs font-bold text-slate-500 mb-1">Sudah direkaporkan oleh:</p>
                      <p className="text-sm font-black text-slate-800">{activeRow.nama_penyetor || '-'}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Pada {format(new Date(activeRow.tanggal_setor), 'd MMMM yyyy, HH:mm', { locale: idLocale })}</p>
                      <div className="w-full h-px bg-slate-100 my-3"></div>
                      <p className="text-xs font-bold text-slate-500 mb-0.5">Uang Aktual Disetor:</p>
                      <p className="text-lg font-black text-emerald-700">{fmtRp(activeRow.jumlah_aktual ?? activeRow.total_nominal)}</p>
                      <button onClick={() => setIsEditingForm(true)} className="mt-3 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 w-full transition-colors flex items-center justify-center gap-1">Modifikasi Laporan</button>
                    </div>
                  ) : (
                    <form className="mt-4 relative z-10 space-y-4" onSubmit={e=>{e.preventDefault(); handleSimpanSetoran();}}>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Nama Pengurus Penyetor</label>
                         <input type="text" required placeholder="Budi Santoso..." value={formPenyetor} onChange={e => setFormPenyetor(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"/>
                       </div>
                       <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block flex justify-between">
                            Jumlah Uang Aktual 
                            <span className="text-blue-500 font-semibold italic">Potensi: {fmtRp(activeRow.total_nominal)}</span>
                         </label>
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                            <input type="text" required value={fmt(Number(formJumlah.replace(/\D/g, '')))} onChange={e => setFormJumlah(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"/>
                         </div>
                       </div>
                       <div className="pt-2 flex gap-2">
                         {isEditingForm && <button type="button" onClick={() => setIsEditingForm(false)} className="px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm w-1/3 hover:bg-slate-50">Batal</button>}
                         <button type="submit" disabled={savingSetoran} className={`px-4 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm transition-colors ${isEditingForm ? 'w-2/3' : 'w-full'} disabled:opacity-70 disabled:animate-pulse`}>
                           {savingSetoran ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} 
                           {savingSetoran ? 'Merekam Laporan...' : 'Rekam Laporan Uang Fisik'}
                         </button>
                       </div>
                    </form>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatMini({icon, title, value, color}: {icon: React.ReactNode, title: string, value: string, color: string}) {
  return (
    <div className="text-left">
      <div className="flex items-center gap-1.5 mb-1"><span className="p-1 rounded-md bg-white border border-slate-200">{icon}</span><span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{title}</span></div>
      <div className={`text-base font-black ${color}`}>{value}</div>
    </div>
  )
}