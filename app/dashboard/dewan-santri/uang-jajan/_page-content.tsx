'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getSummaryPerAsrama, getSantriUangJajan, getAsramaList,
  getKamarList, getDetailTransaksiSantri
} from './actions'
import {
  Wallet, Users, Search, Filter, LayoutGrid, List,
  ChevronLeft, ChevronRight, RefreshCw, Building2, Banknote,
  ArrowDownToLine, ArrowUpFromLine, AlertCircle, ChevronDown,
  ChevronUp, TrendingDown, TrendingUp, Minus
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// ── Helpers ───────────────────────────────────────────────────────────────
const BULAN_NAMA = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember']

function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }
function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
function fmtDate(s: string | null) {
  if (!s) return '—'
  try { return new Date(s.replace(' ','T')).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) }
  catch { return '—' }
}
function fmtDateTime(s: string | null) {
  if (!s) return '—'
  try { return new Date(s.replace(' ','T')).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) }
  catch { return '—' }
}

type SummaryRow = {
  asrama: string; total_santri: number; total_saldo: number
  punya_saldo: number; tidak_punya_saldo: number
  masuk_bulan_ini: number; keluar_bulan_ini: number; santri_topup_bulan_ini: number
}
type SantriRow = {
  id: string; nama_lengkap: string; nis: string
  asrama: string; kamar: string; saldo: number
  masuk_bulan_ini: number; keluar_bulan_ini: number
  terakhir_masuk: string|null; terakhir_keluar: string|null
}
type DetailRow = {
  id: string; jenis: string; nominal: number
  keterangan: string|null; created_at: string; admin_nama: string|null
}
type FilterSaldo = 'SEMUA' | 'PUNYA' | 'KOSONG'
type ViewMode = 'table' | 'grid'

// ── Komponen: Card Asrama ─────────────────────────────────────────────────
function AsramaCard({ row, active, onClick }: {
  row: SummaryRow; active: boolean; onClick: () => void
}) {
  const pct = row.total_santri > 0 ? Math.round((row.punya_saldo/row.total_santri)*100) : 0
  const net = row.masuk_bulan_ini - row.keluar_bulan_ini

  return (
    <button onClick={onClick} className={`w-full text-left bg-white rounded-2xl border transition-all duration-200 p-5 hover:shadow-md hover:-translate-y-0.5 ${
      active ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md' : 'border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">{row.asrama}</div>
            <div className="text-xs text-slate-400">{fmtNum(row.total_santri)} santri</div>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
          pct >= 70 ? 'bg-emerald-100 text-emerald-700' :
          pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
        }`}>{pct}%</span>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
        <div className={`h-1.5 rounded-full ${pct>=70?'bg-emerald-500':pct>=40?'bg-amber-400':'bg-rose-400'}`}
          style={{width:`${pct}%`}} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded-xl p-2.5">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Total Saldo</div>
          <div className="font-bold text-slate-800">{fmtRp(row.total_saldo)}</div>
        </div>
        <div className={`rounded-xl p-2.5 ${net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${net>=0?'text-emerald-600':'text-rose-500'}`}>
            Net Bulan Ini
          </div>
          <div className={`font-bold ${net>=0?'text-emerald-700':'text-rose-600'}`}>
            {net>=0?'+':''}{fmtRp(net)}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-2.5">
          <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide mb-1">Masuk</div>
          <div className="font-bold text-blue-700">{fmtRp(row.masuk_bulan_ini)}</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-2.5">
          <div className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide mb-1">Keluar</div>
          <div className="font-bold text-orange-700">{fmtRp(row.keluar_bulan_ini)}</div>
        </div>
      </div>

      {row.santri_topup_bulan_ini > 0 && (
        <div className="mt-3 text-xs text-emerald-600 flex items-center gap-1">
          <ArrowDownToLine className="w-3 h-3" />
          <span><strong>{row.santri_topup_bulan_ini}</strong> santri topup bulan ini</span>
        </div>
      )}
    </button>
  )
}

// ── Komponen: Detail Transaksi (expand inline) ────────────────────────────
function DetailPanel({ santriId, tahun, bulan, onClose }: {
  santriId: string; tahun: number; bulan: number; onClose: () => void
}) {
  const [data, setData] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDetailTransaksiSantri(santriId, tahun, bulan).then(d => {
      setData(d); setLoading(false)
    })
  }, [santriId, tahun, bulan])

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-1 mb-2">
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-slate-400 text-xs">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memuat...
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">Tidak ada transaksi bulan ini</p>
      ) : (
        <div className="space-y-1.5">
          {data.map(d => (
            <div key={d.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
              d.jenis==='MASUK' ? 'bg-emerald-50 border border-emerald-100' : 'bg-orange-50 border border-orange-100'
            }`}>
              <div className="flex items-center gap-2">
                {d.jenis==='MASUK'
                  ? <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                  : <ArrowUpFromLine className="w-3 h-3 text-orange-500" />}
                <span className="text-slate-600">{d.keterangan || (d.jenis==='MASUK'?'Topup':'Jajan')}</span>
                <span className="text-slate-400">· {fmtDateTime(d.created_at)}</span>
              </div>
              <span className={`font-bold ${d.jenis==='MASUK'?'text-emerald-700':'text-orange-600'}`}>
                {d.jenis==='MASUK'?'+':'-'}{fmtRp(d.nominal)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function MonitoringUangJajanPage() {
  const now = new Date()

  // Filter bulan/tahun
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const tahunList = Array.from({length:4},(_,i)=>now.getFullYear()-1+i)

  // Summary
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryLoaded, setSummaryLoaded] = useState(false)

  // Filter tabel
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [filterSaldo, setFilterSaldo] = useState<FilterSaldo>('SEMUA')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Tabel
  const [rows, setRows] = useState<SantriRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingTable, setLoadingTable] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // UI
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [activeCard, setActiveCard] = useState<string|null>(null)
  const [expandedRow, setExpandedRow] = useState<string|null>(null)

  useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  useEffect(() => {
    if (filterAsrama !== 'SEMUA') {
      getKamarList(filterAsrama).then(l => { setKamarList(l); setFilterKamar('SEMUA') })
    } else { setKamarList([]); setFilterKamar('SEMUA') }
  }, [filterAsrama])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try { setSummaryData(await getSummaryPerAsrama(tahun, bulan)); setSummaryLoaded(true) }
    finally { setLoadingSummary(false) }
  }, [tahun, bulan])

  const loadTable = useCallback(async (pg = 1) => {
    setLoadingTable(true)
    setExpandedRow(null)
    try {
      const res = await getSantriUangJajan({
        tahun, bulan,
        asrama: filterAsrama !== 'SEMUA' ? filterAsrama : undefined,
        kamar:  filterKamar  !== 'SEMUA' ? filterKamar  : undefined,
        search: search || undefined,
        page: pg, filterSaldo,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoadingTable(false) }
  }, [tahun, bulan, filterAsrama, filterKamar, search, filterSaldo])

  const handleTampilkan = () => { loadSummary(); loadTable(1) }

  const handleCardClick = (asrama: string) => {
    setActiveCard(asrama); setFilterAsrama(asrama)
    setFilterKamar('SEMUA'); setSearch(''); setSearchInput('')
    setFilterSaldo('SEMUA')
  }

  // Re-load tabel saat filter berubah (jika sudah pernah load)
  useEffect(() => {
    if (hasLoaded) loadTable(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAsrama, filterKamar, filterSaldo, search])

  const prevBulan = () => { if(bulan===1){setBulan(12);setTahun(t=>t-1)} else setBulan(b=>b-1) }
  const nextBulan = () => { if(bulan===12){setBulan(1);setTahun(t=>t+1)} else setBulan(b=>b+1) }

  // Totals global
  const gt = {
    saldo:  summaryData.reduce((a,r)=>a+r.total_saldo,0),
    masuk:  summaryData.reduce((a,r)=>a+r.masuk_bulan_ini,0),
    keluar: summaryData.reduce((a,r)=>a+r.keluar_bulan_ini,0),
    punya:  summaryData.reduce((a,r)=>a+r.punya_saldo,0),
    total:  summaryData.reduce((a,r)=>a+r.total_santri,0),
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5">

      {/* ── Header ── */}
      <div className="space-y-4">
        <DashboardPageHeader
          title="Monitoring Uang Jajan"
          description="Pantau saldo & mutasi uang jajan santri"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_104px]">
            <div className="flex items-center justify-between gap-1 bg-white border border-slate-200 rounded-xl p-1">
              <button onClick={prevBulan} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1 text-center font-bold text-slate-800 text-base px-1">
                {BULAN_NAMA[bulan]} {tahun}
              </div>
              <button onClick={nextBulan}
                disabled={tahun===now.getFullYear()&&bulan===now.getMonth()+1}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <select value={tahun} onChange={e=>setTahun(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {tahunList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button onClick={handleTampilkan} disabled={loadingSummary||loadingTable}
            className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            <RefreshCw className={`w-4 h-4 ${(loadingSummary||loadingTable)?'animate-spin':''}`} />
            Tampilkan
          </button>
        </div>
      </div>

      {/* ── Global Stats (muncul setelah load) ── */}
      {summaryLoaded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label:'Total Saldo', value:fmtRp(gt.saldo), icon:Banknote, cls:'bg-emerald-50 text-emerald-600' },
            { label:'Masuk Bulan Ini', value:fmtRp(gt.masuk), icon:ArrowDownToLine, cls:'bg-blue-50 text-blue-600' },
            { label:'Keluar Bulan Ini', value:fmtRp(gt.keluar), icon:ArrowUpFromLine, cls:'bg-orange-50 text-orange-600' },
            { label:'Saldo Kosong', value:`${fmtNum(gt.total-gt.punya)} orang`, icon:AlertCircle, cls:'bg-rose-50 text-rose-600' },
          ].map(item=>(
            <div key={item.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className={`inline-flex p-2 rounded-xl mb-3 ${item.cls}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold text-slate-900 leading-tight">{item.value}</div>
              <div className="text-xs text-slate-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cards Asrama ── */}
      {summaryLoaded && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Per Asrama · {BULAN_NAMA[bulan]} {tahun}
            </h2>
            {activeCard && (
              <button onClick={()=>{setActiveCard(null);setFilterAsrama('SEMUA')}}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                × Hapus filter
              </button>
            )}
          </div>
          {loadingSummary ? (
            <div className="flex justify-center py-8 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin"/><span className="text-sm">Memuat...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaryData.map(row=>(
                <AsramaCard key={row.asrama} row={row}
                  active={activeCard===row.asrama} onClick={()=>handleCardClick(row.asrama)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      {summaryLoaded && <div className="border-t border-slate-200" />}

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,180px)_auto_minmax(0,1fr)_auto] xl:items-end">

          <div className="min-w-0">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={filterAsrama}
              onChange={e=>{setFilterAsrama(e.target.value);setActiveCard(null)}}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {kamarList.length > 0 && (
            <div className="min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Kamar</label>
              <select value={filterKamar} onChange={e=>setFilterKamar(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="SEMUA">Semua Kamar</option>
                {kamarList.map(k=><option key={k} value={k}>Kamar {k}</option>)}
              </select>
            </div>
          )}

          <div className="min-w-0">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Saldo</label>
            <div className="flex w-full gap-1 bg-slate-100 p-1 rounded-xl">
              {(['SEMUA','PUNYA','KOSONG'] as FilterSaldo[]).map(f=>(
                <button key={f} onClick={()=>setFilterSaldo(f)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSaldo===f
                      ? f==='KOSONG' ? 'bg-white text-rose-600 shadow-sm'
                      : f==='PUNYA' ? 'bg-white text-emerald-600 shadow-sm'
                      : 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {f==='SEMUA'?'Semua':f==='PUNYA'?'Ada':'Kosong'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={e=>{e.preventDefault();setSearch(searchInput)}} className="min-w-0">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
              <input type="text" placeholder="Nama atau NIS..."
                value={searchInput} onChange={e=>setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
            </div>
          </form>

          <div className="flex items-end gap-2">
            <button onClick={()=>loadTable(1)} disabled={loadingTable}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 min-w-[160px]">
              <Filter className="w-4 h-4"/>
              {loadingTable?'Memuat...':'Tampilkan'}
            </button>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['table','grid'] as ViewMode[]).map(v=>(
                <button key={v} onClick={()=>setViewMode(v)}
                  className={`p-2 rounded-lg transition-all ${viewMode===v?'bg-white shadow-sm text-slate-800':'text-slate-400 hover:text-slate-600'}`}>
                  {v==='table' ? <List className="w-4 h-4"/> : <LayoutGrid className="w-4 h-4"/>}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabel / Grid ── */}
      {!hasLoaded ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-emerald-300"/>
          </div>
          <p className="text-slate-500 font-medium text-sm">Pilih bulan lalu klik <strong>Tampilkan</strong></p>
        </div>
      ) : loadingTable ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin"/><span className="text-sm">Memuat data...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Tidak ada santri yang cocok.</div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              <strong className="text-slate-700">{fmtNum(rows.length)}</strong> dari <strong className="text-slate-700">{fmtNum(total)}</strong> santri
              {filterAsrama!=='SEMUA'&&<> · {filterAsrama}</>}
              {filterKamar!=='SEMUA'&&<> · Kamar {filterKamar}</>}
            </span>
            <span className="text-xs">Hal {page}/{totalPages}</span>
          </div>

          {/* Table view */}
          {viewMode==='table' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['No','Nama Santri','Asrama','Kamar','Saldo Sekarang','Masuk','Keluar',''].map(h=>(
                        <th key={h} className={`px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${h==='Saldo Sekarang'||h==='Masuk'||h==='Keluar'?'text-right':'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>(
                      <>
                        <tr key={r.id}
                          className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedRow===r.id?'bg-slate-50':''}`}
                          onClick={()=>setExpandedRow(expandedRow===r.id?null:r.id)}>
                          <td className="px-4 py-3 text-xs text-slate-300">{(page-1)*30+i+1}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{r.nama_lengkap}</div>
                            <div className="text-xs text-slate-400">{r.nis}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{r.asrama}</td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">{r.kamar}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-bold ${r.saldo>0?'text-emerald-700':'text-rose-500'}`}>
                              {fmtRp(r.saldo)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.masuk_bulan_ini>0 ? (
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                                +{fmtRp(r.masuk_bulan_ini)}
                              </span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.keluar_bulan_ini>0 ? (
                              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">
                                -{fmtRp(r.keluar_bulan_ini)}
                              </span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {expandedRow===r.id
                              ? <ChevronUp className="w-4 h-4 text-slate-400"/>
                              : <ChevronDown className="w-4 h-4 text-slate-300"/>}
                          </td>
                        </tr>
                        {expandedRow===r.id && (
                          <tr key={`${r.id}-detail`} className="bg-slate-50">
                            <td colSpan={8} className="px-4 pb-3 pt-0">
                              <DetailPanel santriId={r.id} tahun={tahun} bulan={bulan}
                                onClose={()=>setExpandedRow(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grid view */}
          {viewMode==='grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {rows.map(r=>(
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {r.nama_lengkap.split(' ').map(n=>n[0]).slice(0,2).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{r.nama_lengkap}</div>
                      <div className="text-xs text-slate-400">{r.nis}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Asrama</span>
                      <span className="text-slate-700 font-medium">{r.asrama}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kamar</span>
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg">{r.kamar}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-1.5 flex justify-between">
                      <span className="text-slate-400">Saldo</span>
                      <span className={`font-bold ${r.saldo>0?'text-emerald-700':'text-rose-500'}`}>{fmtRp(r.saldo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">Masuk</span>
                      <span className="text-blue-600 font-semibold">{r.masuk_bulan_ini>0?'+'+fmtRp(r.masuk_bulan_ini):'—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-400">Keluar</span>
                      <span className="text-orange-600 font-semibold">{r.keluar_bulan_ini>0?'-'+fmtRp(r.keluar_bulan_ini):'—'}</span>
                    </div>
                  </div>
                  <button onClick={()=>setExpandedRow(expandedRow===r.id?null:r.id)}
                    className="mt-3 w-full text-xs text-slate-400 hover:text-emerald-600 flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-200 rounded-lg hover:border-emerald-300 transition-colors">
                    {expandedRow===r.id?<><ChevronUp className="w-3 h-3"/>Sembunyikan</>:<><ChevronDown className="w-3 h-3"/>Lihat Transaksi</>}
                  </button>
                  {expandedRow===r.id && (
                    <DetailPanel santriId={r.id} tahun={tahun} bulan={bulan} onClose={()=>setExpandedRow(null)}/>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={()=>loadTable(page-1)} disabled={page<=1||loadingTable}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4"/> Sebelumnya
              </button>
              <div className="flex gap-1">
                {Array.from({length:Math.min(totalPages,5)},(_,i)=>{
                  let pg=i+1
                  if(totalPages>5){
                    if(page<=3) pg=i+1
                    else if(page>=totalPages-2) pg=totalPages-4+i
                    else pg=page-2+i
                  }
                  return(
                    <button key={pg} onClick={()=>loadTable(pg)} disabled={loadingTable}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                        pg===page?'bg-emerald-600 text-white shadow-sm':'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={()=>loadTable(page+1)} disabled={page>=totalPages||loadingTable}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
