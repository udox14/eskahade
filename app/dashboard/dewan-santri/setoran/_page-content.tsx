'use client'

import React, { useState, useEffect } from 'react'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction, getSppBillingStart, simpanSppBillingStart } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, UserCheck, Eye, X, Check, Search, Save
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
  belum_ada_tagihan?: boolean
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
  const [billingStart, setBillingStart] = useState({ tahun: 2026, bulan: 1, value: '2026-01' })
  const [billingStartInput, setBillingStartInput] = useState('2026-01')
  const [savingBillingStart, setSavingBillingStart] = useState(false)
  
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
    getSppBillingStart().then(res => {
      setBillingStart(res)
      setBillingStartInput(res.value)
    })
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
      load() 
    } finally {
      setSavingSetoran(false)
    }
  }

  async function handleSimpanBillingStart(e: React.FormEvent) {
    e.preventDefault()
    setSavingBillingStart(true)
    try {
      const res = await simpanSppBillingStart(billingStartInput)
      if ('error' in res) { toast.error(res.error); return }
      const updated = await getSppBillingStart()
      setBillingStart(updated)
      setBillingStartInput(updated.value)
      toast.success('Awal tagihan SPP diperbarui')
      load()
    } finally {
      setSavingBillingStart(false)
    }
  }

  const totalSantri    = data.reduce((a, r) => a + r.total_santri, 0)
  const totalBebasSpp  = data.reduce((a, r) => a + r.bebas_spp, 0)
  const totalWajib     = data.reduce((a, r) => a + r.wajib_bayar, 0)
  const totalBayar     = data.reduce((a, r) => a + r.bayar_bulan_ini, 0)
  const totalTunggak   = data.reduce((a, r) => a + r.penunggak, 0)
  const totalNominal   = data.reduce((a, r) => a + r.total_nominal, 0)
  const pctKeseluruhan = totalWajib > 0 ? Math.round((totalBayar / totalWajib) * 100) : 0
  const selectedBeforeBillingStart = (tahun * 100 + bulan) < (billingStart.tahun * 100 + billingStart.bulan)

  function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
  function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-3 max-w-[100vw] overflow-hidden text-slate-800">
      
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monitoring SPP</h1>
          <p className="text-sm text-slate-500 mt-1">Laporan setoran tunai asrama bulan {BULAN_NAMA[bulan]} {tahun}</p>
        </div>
        
        {/* Filtering & Actions - Compact Flex */}
        <div className="grid gap-3 bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:grid-cols-[auto_auto_1fr] md:items-center">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 md:min-w-[10.5rem]">
            <button onClick={prevBulan} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <div className="px-2 text-center text-base font-semibold text-slate-700">{BULAN_NAMA[bulan]} {tahun}</div>
            <button onClick={nextBulan} disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
            <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">Tarif: <span className="text-slate-900 font-semibold">{fmtRp(nominal)}</span></span>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <form onSubmit={handleSimpanBillingStart} className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <div className="flex items-center gap-2 text-blue-700">
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Mulai Tagihan</label>
              </div>
              <input
                type="month"
                value={billingStartInput}
                onChange={e => setBillingStartInput(e.target.value)}
                className="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={savingBillingStart} className="h-10 w-full sm:w-10 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black disabled:opacity-50" title="Simpan mulai tagihan">
                {savingBillingStart ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
            </form>

            <button onClick={load} disabled={loading} className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!hasLoaded ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Memuat...' : 'Tarik Data'}
            </button>
          </div>
        </div>
      </div>

      {selectedBeforeBillingStart && hasLoaded && (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Periode {BULAN_NAMA[bulan]} {tahun} berstatus <span className="font-bold">BELUM ADA TAGIHAN</span>. Awal tagihan aktif dimulai {BULAN_NAMA[billingStart.bulan]} {billingStart.tahun}.
        </div>
      )}

      {/* ── Ringkasan Total - Sleek Version ── */}
      {!userAsrama && hasLoaded && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard title="Total Santri" value={fmt(totalSantri)} icon={Users} />
          <StatCard title="Wajib SPP" value={fmt(totalWajib)} icon={UserCheck} />
          <StatCard title="Telah Lunas" value={fmt(totalBayar)} sub={`${pctKeseluruhan}%`} icon={CheckCircle2} color="text-emerald-600" />
          <StatCard title="Penunggak" value={fmt(totalTunggak)} icon={AlertCircle} color="text-rose-600" />
          <div className="col-span-2 md:col-span-1 border border-indigo-100 bg-indigo-50/50 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
             <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1">Uang Terkumpul</div>
             <div className="text-xl font-bold text-indigo-900 leading-none">{fmtRp(totalNominal)}</div>
             <div className="text-[10px] text-slate-500 mt-1">Potensi: {fmtRp(totalWajib * nominal)}</div>
          </div>
        </div>
      )}

      {/* ── Tabel Utama ── */}
      <div className="bg-white border md:rounded-2xl shadow-sm rounded-xl overflow-hidden min-h-[40vh]">
        {loading ? (
          <div className="flex justify-center flex-col items-center py-24 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-3 text-blue-500" />
            <span className="text-sm font-medium">Sinkronisasi data...</span>
          </div>
        ) : !hasLoaded ? (
          <div className="flex flex-col items-center justify-center py-32 text-center text-slate-400">
             <Search className="w-10 h-10 mb-3 opacity-50"/>
             <p className="text-sm font-medium">Tidak ada data aktif. Klik Tarik Data.</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-24 text-center text-sm font-medium text-slate-400">Tidak ditemukan data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5 font-medium">Asrama & Populasi</th>
                  <th className="py-3 px-5 font-medium">Progres Pembayaran</th>
                  <th className="py-3 px-5 font-medium text-right">Keuangan Masuk</th>
                  <th className="py-3 px-5 font-medium text-center">Rekap Fiskal</th>
                  <th className="py-3 px-5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.asrama} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-800">{row.asrama}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmt(row.total_santri)} Santri ({fmt(row.wajib_bayar)} Wajib)</p>
                    </td>
                    <td className="py-3 px-5 w-48 lg:w-64">
                      {row.belum_ada_tagihan ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          <CalendarCheck className="w-3.5 h-3.5"/> Belum Ada Tagihan
                        </span>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-[11px] font-medium mb-1.5">
                            <span className="text-slate-500">{fmt(row.bayar_bulan_ini)} Lunas</span>
                            <span className={row.persentase >= 80 ? 'text-emerald-600' : row.persentase >= 50 ? 'text-yellow-600' : 'text-rose-600'}>{row.persentase}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 ${row.persentase >= 80 ? 'bg-emerald-500' : row.persentase >= 50 ? 'bg-yellow-400' : 'bg-rose-500'}`} style={{ width: `${row.persentase}%`}}></div>
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <p className="font-semibold text-slate-900">{row.belum_ada_tagihan ? '-' : fmtRp(row.total_nominal)}</p>
                      {row.penunggak > 0 && <p className="text-[10px] font-medium text-rose-500 mt-0.5">-{fmt(row.penunggak)} Orang Nunggak</p>}
                    </td>
                    <td className="py-3 px-5 text-center">
                      {row.belum_ada_tagihan ? (
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md inline-block">Tidak Ditagihkan</span>
                      ) : row.tanggal_setor ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                          <CheckCircle2 className="w-3.5 h-3.5"/> Disetor {format(new Date(row.tanggal_setor), 'dd/MM')}
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md inline-block">Belum Laporan</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button onClick={() => openDetailModal(row)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <Eye className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Detail Kompak ── */}
      {isModalOpen && activeRow && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
            
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
               <div>
                 <h2 className="text-lg font-bold text-slate-900">{activeRow.asrama}</h2>
                 <p className="text-xs text-slate-500 mt-0.5">Laporan Rekapitulasi SPP Fisik</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X className="w-4 h-4"/></button>
            </div>

            <div className="p-5">
               {/* Nano Grid Stats */}
               <div className="flex flex-wrap gap-2 mb-6">
                  <NanoChip label="Bebas SPP" value={activeRow.bebas_spp} />
                  <NanoChip label="Wajib SPP" value={activeRow.wajib_bayar} />
                  <NanoChip label="Telah Lunas" value={activeRow.bayar_bulan_ini} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                  <NanoChip label="Penunggak" value={activeRow.penunggak} color="text-rose-600 bg-rose-50 border-rose-100" />
                  <NanoChip label="Bayar Bulan Lalu" value={activeRow.bayar_tunggakan_lalu} />
               </div>

               {/* Area Form Setoran */}
               <div>
                  <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Validasi Setoran Tunai</h3>
                  
                  {activeRow.belum_ada_tagihan ? (
                    <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-center">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3"><CalendarCheck className="w-5 h-5"/></div>
                      <p className="text-lg font-bold text-blue-800 leading-tight mb-1">Belum Ada Tagihan</p>
                      <p className="text-xs text-blue-600/80">Periode ini berada sebelum awal tagihan SPP yang ditetapkan.</p>
                    </div>
                  ) : activeRow.tanggal_setor && !isEditingForm ? (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-5 h-5"/></div>
                      <p className="text-2xl font-bold text-emerald-700 leading-tight mb-1">{fmtRp(activeRow.jumlah_aktual ?? activeRow.total_nominal)}</p>
                      <p className="text-xs text-emerald-600/80 mb-3">Diserahkan oleh {activeRow.nama_penyetor || '-'} pada {format(new Date(activeRow.tanggal_setor), 'd MMM yyyy')}</p>
                      <button onClick={() => setIsEditingForm(true)} className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 transition-colors">Revisi Nominal / Laporan</button>
                    </div>
                  ) : (
                    <form onSubmit={e=>{e.preventDefault(); handleSimpanSetoran();}} className="space-y-4">
                       <div className="grid grid-cols-1 gap-4">
                         <div>
                           <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Diserahkan Oleh</label>
                           <input type="text" required placeholder="Nama pengurus..." value={formPenyetor} onChange={e => setFormPenyetor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"/>
                         </div>
                         <div>
                           <label className="text-[11px] font-medium text-slate-500 mb-1.5 block flex justify-between">
                              Total Uang Fisik <span className="text-slate-400">Target: {fmtRp(activeRow.total_nominal)}</span>
                           </label>
                           <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                              <input type="text" required value={fmt(Number(formJumlah.replace(/\D/g, '')))} onChange={e => setFormJumlah(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"/>
                           </div>
                         </div>
                       </div>
                       <div className="flex gap-2 pt-2">
                         {isEditingForm && <button type="button" onClick={() => setIsEditingForm(false)} className="px-4 py-2 bg-white border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 flex-1">Batal</button>}
                         <button type="submit" disabled={savingSetoran} className={`px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors flex justify-center items-center gap-2 ${isEditingForm ? 'flex-1' : 'w-full'} disabled:opacity-50`}>
                           {savingSetoran ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} 
                           {savingSetoran ? 'Menyimpan...' : 'Pelunasan Valid'}
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

function StatCard({title, value, sub, icon: Icon, color}: {title: string, value: string, sub?: string, icon: any, color?: string}) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 flex flex-col justify-center bg-white shadow-sm">
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{title}</div>
        <Icon className={`w-3.5 h-3.5 ${color || 'text-slate-400'}`} />
      </div>
      <div className={`text-xl font-bold leading-none ${color || 'text-slate-800'}`}>{value} <span className="text-xs font-semibold ml-0.5">{sub}</span></div>
    </div>
  )
}

function NanoChip({label, value, color}: {label: string, value: string|number, color?: string}) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${color || 'border-slate-200 bg-white text-slate-700'}`}>
      <span className="text-[10px] font-medium opacity-70">{label}:</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  )
}
