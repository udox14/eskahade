'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction, getSppBillingStart, simpanSppBillingStart, getMonitoringPrintMeta } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, UserCheck, Eye, X, Check, Search, Save, Printer
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useReactToPrint } from 'react-to-print'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  unit_setor: string
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
  is_sadesa?: boolean
}

type PrintMode = 'NON_SADESA' | 'SADESA'

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
  const [tahunAjaranNama, setTahunAjaranNama] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('NON_SADESA')
  const printRef = useRef<HTMLDivElement>(null)
  
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
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.unit_setor === userAsrama) : rows)
      setNominal(settings.nominal)
      setHasLoaded(true)
      
      if (isModalOpen && activeRow) {
        const updatedRow = rows.find((r: AsramaRow) => r.unit_setor === activeRow.unit_setor)
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
    getMonitoringPrintMeta().then(res => setTahunAjaranNama(res.tahunAjaranNama))
  }, [])

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Rekap_Setoran_SPP_${printMode}_${bulan}_${tahun}`,
    pageStyle: `
      @page { size: 330mm 210mm; margin: 10mm; }
      @media print {
        html, body {
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  })

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
        activeRow.unit_setor, tahun, bulan,
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
  const tahunAjaranDisplay = tahunAjaranNama ?? deriveAcademicYear(tahun, bulan)
  const printRows = useMemo(() => {
    const filtered = data.filter(row => printMode === 'SADESA' ? row.is_sadesa : !row.is_sadesa)
    return filtered
      .slice()
      .sort((a, b) => {
        if (b.persentase !== a.persentase) return b.persentase - a.persentase
        if (b.bayar_bulan_ini !== a.bayar_bulan_ini) return b.bayar_bulan_ini - a.bayar_bulan_ini
        return a.unit_setor.localeCompare(b.unit_setor)
      })
      .map((row, index) => ({ ...row, rank: index + 1 }))
  }, [data, printMode])
  const printTotals = useMemo(() => {
    return printRows.reduce((acc, row) => {
      acc.total_santri += row.total_santri
      acc.bebas_spp += row.bebas_spp
      acc.wajib_bayar += row.wajib_bayar
      acc.bayar_bulan_ini += row.bayar_bulan_ini
      acc.penunggak += row.penunggak
      acc.bayar_tunggakan_lalu += row.bayar_tunggakan_lalu
      acc.jumlah_bayar += row.bayar_bulan_ini + row.bayar_tunggakan_lalu
      acc.total_nominal += row.total_nominal
      if (row.tanggal_setor) acc.tersetor += 1
      return acc
    }, {
      total_santri: 0,
      bebas_spp: 0,
      wajib_bayar: 0,
      bayar_bulan_ini: 0,
      penunggak: 0,
      bayar_tunggakan_lalu: 0,
      jumlah_bayar: 0,
      total_nominal: 0,
      tersetor: 0,
    })
  }, [printRows])
  const printPct = printTotals.wajib_bayar > 0 ? Math.round((printTotals.bayar_bulan_ini / printTotals.wajib_bayar) * 100) : 0
  const canPrint = hasLoaded && printRows.length > 0

  function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
  function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-3 max-w-[100vw] overflow-hidden text-slate-800">
      
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monitoring SPP</h1>
          <p className="text-sm text-slate-500 mt-1">Laporan setoran tunai unit bulan {BULAN_NAMA[bulan]} {tahun}</p>
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

      {hasLoaded && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Cetak Laporan Penerimaan SPP</p>
            <p className="mt-1 text-xs text-slate-500">Format F4 landscape dengan pilihan laporan reguler atau unit SADESA.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[15rem_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Jenis Laporan</label>
              <select
                value={printMode}
                onChange={e => setPrintMode(e.target.value as PrintMode)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="NON_SADESA">Santri Asrama</option>
                <option value="SADESA">SADESA</option>
              </select>
            </div>
            <button
              onClick={() => handlePrint()}
              disabled={!canPrint}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Cetak Laporan
            </button>
          </div>
        </div>
      )}

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
                  <th className="py-3 px-5 font-medium">Unit Setor & Populasi</th>
                  <th className="py-3 px-5 font-medium">Progres Pembayaran</th>
                  <th className="py-3 px-5 font-medium text-right">Keuangan Masuk</th>
                  <th className="py-3 px-5 font-medium text-center">Rekap Fiskal</th>
                  <th className="py-3 px-5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.unit_setor} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-800">{row.unit_setor}</p>
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
                 <h2 className="text-lg font-bold text-slate-900">{activeRow.unit_setor}</h2>
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

      <div className="absolute left-[-99999px] top-0">
        <MonitoringPrintSheet
          ref={printRef}
          bulan={bulan}
          tahun={tahun}
          tahunAjaran={tahunAjaranDisplay}
          nominal={nominal}
          mode={printMode}
          rows={printRows}
          totals={printTotals}
          totalPersentase={printPct}
        />
      </div>
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

const MonitoringPrintSheet = React.forwardRef<HTMLDivElement, {
  bulan: number
  tahun: number
  tahunAjaran: string
  nominal: number
  mode: PrintMode
  rows: Array<AsramaRow & { rank: number }>
  totals: {
    total_santri: number
    bebas_spp: number
    wajib_bayar: number
    bayar_bulan_ini: number
    penunggak: number
    bayar_tunggakan_lalu: number
    jumlah_bayar: number
    total_nominal: number
    tersetor: number
  }
  totalPersentase: number
}>(({ bulan, tahun, tahunAjaran, nominal, mode, rows, totals, totalPersentase }, ref) => {
  const title = mode === 'SADESA' ? 'REKAP SETORAN SPP SADESA' : 'REKAP SETORAN SPP SANTRI'
  const subtitle = mode === 'SADESA' ? 'LAPORAN PENERIMAAN UNIT SADESA' : 'LAPORAN PENERIMAAN SANTRI ASRAMA'
  const bulanNama = BULAN_NAMA[bulan].toUpperCase()
  const printedAt = format(new Date(), 'dd MMMM yyyy', { locale: idLocale })

  return (
    <div ref={ref} className="print-area bg-white text-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .monitoring-print-sheet {
              width: 310mm;
              min-height: 190mm;
              padding: 10mm 12mm;
              color: #111827;
              background: #ffffff;
              font-family: "Arial", "Helvetica", sans-serif;
            }
            .monitoring-print-sheet * {
              box-sizing: border-box;
            }
            .monitoring-print-sheet table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            .monitoring-print-sheet th,
            .monitoring-print-sheet td {
              border: 1px solid #0f172a;
              padding: 5px 6px;
              vertical-align: middle;
            }
            .monitoring-print-sheet .currency {
              width: 30px;
              text-align: center;
            }
            .monitoring-print-sheet .text-left {
              text-align: left;
            }
            .monitoring-print-sheet .text-center {
              text-align: center;
            }
            .monitoring-print-sheet .text-right {
              text-align: right;
            }
            .monitoring-print-sheet .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 8px;
              margin-bottom: 10px;
            }
            .monitoring-print-sheet .summary-card {
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              padding: 8px 10px;
              background: #f8fafc;
            }
            .monitoring-print-sheet .summary-card-label {
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #475569;
            }
            .monitoring-print-sheet .summary-card-value {
              margin-top: 4px;
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
            }
            .monitoring-print-sheet .main-head th {
              background: #e2e8f0;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .monitoring-print-sheet .sub-head th {
              background: #f8fafc;
              font-size: 9px;
              font-weight: 700;
            }
            .monitoring-print-sheet tbody td {
              font-size: 10px;
            }
            .monitoring-print-sheet .highlight {
              background: #fef3c7;
              font-weight: 700;
            }
            .monitoring-print-sheet .money-highlight {
              background: #fff7ed;
              font-weight: 700;
            }
            .monitoring-print-sheet .total-row td {
              background: #dbeafe;
              font-weight: 800;
            }
            .monitoring-print-sheet .total-row td.total-amount {
              background: #fee2e2;
            }
            .monitoring-print-sheet .footer-note {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 12px;
              gap: 12px;
            }
            .monitoring-print-sheet .signature {
              width: 220px;
              text-align: center;
            }
            @media print {
              .monitoring-print-sheet {
                width: 100%;
                min-height: auto;
                padding: 0;
              }
            }
          `,
        }}
      />

      <div className="monitoring-print-sheet">
        <div className="mb-4 text-center">
          <div className="text-[24px] font-black uppercase tracking-wide">{title}</div>
          <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.2em] text-slate-600">{subtitle}</div>
          <div className="mt-1 text-[14px] font-bold uppercase">Tahun Ajaran {tahunAjaran}</div>
        </div>

        <div className="mb-3 flex items-start justify-between gap-6">
          <div className="min-w-[16rem] space-y-1 text-[11px] font-semibold">
            <div className="flex gap-2">
              <span className="w-16">Bulan</span>
              <span>:</span>
              <span>{bulanNama} {tahun}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-16">Tarif</span>
              <span>:</span>
              <span>{formatCurrency(nominal)}</span>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <div>Dicetak pada {printedAt}</div>
            <div>{mode === 'SADESA' ? 'Kategori laporan: SADESA' : 'Kategori laporan: Santri Asrama'}</div>
          </div>
        </div>

        <div className="summary-grid">
          <PrintSummaryCard label="Jumlah Penduduk" value={formatNumber(totals.total_santri)} />
          <PrintSummaryCard label="Wajib Bayar" value={formatNumber(totals.wajib_bayar)} />
          <PrintSummaryCard label="Jumlah Bayar" value={formatNumber(totals.jumlah_bayar)} />
          <PrintSummaryCard label="Penerimaan" value={formatCurrency(totals.total_nominal)} />
        </div>

        <table>
          <thead>
            <tr className="main-head">
              <th rowSpan={2} style={{ width: '34px' }}>No</th>
              <th rowSpan={2} style={{ width: mode === 'SADESA' ? '100px' : '140px' }}>Asrama</th>
              <th rowSpan={2} style={{ width: '78px' }}>Jumlah Penduduk</th>
              <th rowSpan={2} style={{ width: '72px' }}>Digratiskan</th>
              <th rowSpan={2} style={{ width: '74px' }}>Wajib Bayar</th>
              <th rowSpan={2} style={{ width: '82px' }}>Jumlah Bayar Bulan Ini</th>
              <th rowSpan={2} style={{ width: '72px' }}>Penunggak</th>
              <th rowSpan={2} style={{ width: '88px' }}>Bayar Tunggakan Bulan Lalu</th>
              <th rowSpan={2} style={{ width: '72px' }}>Jumlah Bayar</th>
              <th colSpan={2} style={{ width: '92px' }}>Biaya</th>
              <th colSpan={2} style={{ width: '126px' }}>Jumlah</th>
              <th rowSpan={2} style={{ width: '48px' }}>%</th>
              <th rowSpan={2} style={{ width: '62px' }}>Tgl Stor</th>
              <th rowSpan={2} style={{ width: '48px' }}>Rank</th>
            </tr>
            <tr className="sub-head">
              <th className="currency">Rp</th>
              <th>Nominal</th>
              <th className="currency">Rp</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const jumlahBayar = row.bayar_bulan_ini + row.bayar_tunggakan_lalu
              return (
                <tr key={`${row.unit_setor}-${index}`}>
                  <td className="text-center">{index + 1}</td>
                  <td className="text-left font-bold">{row.unit_setor}</td>
                  <td className="text-center">{formatNumber(row.total_santri)}</td>
                  <td className="text-center">{formatNumber(row.bebas_spp)}</td>
                  <td className="highlight text-center">{formatNumber(row.wajib_bayar)}</td>
                  <td className="text-center">{formatNumber(row.bayar_bulan_ini)}</td>
                  <td className="text-center">{formatNumber(row.penunggak)}</td>
                  <td className="text-center">{formatNumber(row.bayar_tunggakan_lalu)}</td>
                  <td className="highlight text-center">{formatNumber(jumlahBayar)}</td>
                  <td className="currency">Rp</td>
                  <td className="text-right">{formatNumber(nominal)}</td>
                  <td className="currency money-highlight">Rp</td>
                  <td className="money-highlight text-right">{formatNumber(row.total_nominal)}</td>
                  <td className="highlight text-center">{row.persentase}</td>
                  <td className="text-center">{row.tanggal_setor ? format(new Date(row.tanggal_setor), 'dd/MM') : '-'}</td>
                  <td className="text-center">{row.rank}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td colSpan={2} className="text-center">Jumlah Total</td>
              <td className="text-center">{formatNumber(totals.total_santri)}</td>
              <td className="text-center">{formatNumber(totals.bebas_spp)}</td>
              <td className="text-center">{formatNumber(totals.wajib_bayar)}</td>
              <td className="text-center">{formatNumber(totals.bayar_bulan_ini)}</td>
              <td className="text-center">{formatNumber(totals.penunggak)}</td>
              <td className="text-center">{formatNumber(totals.bayar_tunggakan_lalu)}</td>
              <td className="text-center">{formatNumber(totals.jumlah_bayar)}</td>
              <td className="currency total-amount"></td>
              <td className="total-amount text-right">{formatNumber(nominal)}</td>
              <td className="currency total-amount">Rp</td>
              <td className="total-amount text-right">{formatNumber(totals.total_nominal)}</td>
              <td className="text-center">{totalPersentase}</td>
              <td className="text-center">{totals.tersetor > 0 ? 'Ada' : '-'}</td>
              <td className="text-center">-</td>
            </tr>
          </tbody>
        </table>

        <div className="footer-note">
          <div className="text-[10px] text-slate-600">
            <div>Keterangan:</div>
            <div>Kolom jumlah bayar adalah akumulasi pembayaran bulan berjalan dan tunggakan bulan sebelumnya.</div>
          </div>
          <div className="signature">
            <div className="text-[11px]">Tasikmalaya, {printedAt}</div>
            <div className="mt-1 text-[11px] font-bold">Petugas Monitoring SPP</div>
            <div className="mt-14 border-t border-slate-800 pt-1 text-[11px] font-semibold">........................................</div>
          </div>
        </div>
      </div>
    </div>
  )
})

MonitoringPrintSheet.displayName = 'MonitoringPrintSheet'

function PrintSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value">{value}</div>
    </div>
  )
}

function deriveAcademicYear(tahun: number, bulan: number) {
  return bulan >= 7 ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value)
}

function formatCurrency(value: number) {
  return `Rp ${formatNumber(value)}`
}
