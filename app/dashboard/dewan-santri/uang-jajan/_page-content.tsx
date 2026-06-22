'use client'

import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'

import { useState, useEffect, useCallback } from 'react'
import {
  getSummaryPerAsrama,
  getSantriUangJajan,
  getAsramaList,
  getKamarList,
  getDetailTransaksiSantri,
} from './actions'
import {
  Wallet,
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  X,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const BULAN_NAMA = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s.replace(' ', 'T')).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

type SummaryRow = {
  asrama: string
  total_santri: number
  total_saldo: number
  total_saldo_jajan: number
  total_saldo_tabungan: number
  punya_saldo: number
  tidak_punya_saldo: number
  masuk_bulan_ini: number
  keluar_bulan_ini: number
  auto_bulan_ini: number
  santri_topup_bulan_ini: number
}

type SantriRow = {
  id: string
  nama_lengkap: string
  nis: string
  asrama: string
  kamar: string
  foto_url: string | null
  saldo: number
  saldo_tabungan: number
  masuk_bulan_ini: number
  keluar_bulan_ini: number
  auto_bulan_ini: number
  terakhir_masuk: string | null
  terakhir_keluar: string | null
}

type DetailRow = {
  id: string
  jenis: string
  nominal: number
  dompet: string
  source: string
  keterangan: string | null
  created_at: string
  admin_nama: string | null
}

type FilterSaldo = 'SEMUA' | 'PUNYA' | 'KOSONG'
type ViewMode = 'table' | 'grid'

function AsramaCard({ row, active, onClick }: { row: SummaryRow; active: boolean; onClick: () => void }) {
  const pct = row.total_santri > 0 ? Math.round((row.punya_saldo / row.total_santri) * 100) : 0
  const net = row.masuk_bulan_ini - row.keluar_bulan_ini

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        active ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md' : 'border-slate-200'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-50 p-2">
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">{row.asrama}</div>
            <div className="text-xs text-slate-400">{fmtNum(row.total_santri)} santri</div>
          </div>
        </div>
        <span
          className={`rounded-lg px-2 py-1 text-xs font-bold ${
            pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {pct}%
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Titipan</div>
          <div className="font-bold text-slate-800">{fmtRp(row.total_saldo)}</div>
        </div>
        <div className={`rounded-xl p-2.5 ${net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            Net Bulan Ini
          </div>
          <div className={`font-bold ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{net >= 0 ? '+' : ''}{fmtRp(net)}</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-500">Uang Jajan</div>
          <div className="font-bold text-blue-700">{fmtRp(row.total_saldo_jajan)}</div>
        </div>
        <div className="rounded-xl bg-orange-50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-500">Tabungan</div>
          <div className="font-bold text-orange-700">{fmtRp(row.total_saldo_tabungan)}</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-500">Masuk Jajan</div>
          <div className="font-bold text-blue-700">{fmtRp(row.masuk_bulan_ini)}</div>
        </div>
        <div className="rounded-xl bg-orange-50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-500">Keluar Jajan</div>
          <div className="font-bold text-orange-700">{fmtRp(row.keluar_bulan_ini)}</div>
        </div>
      </div>

      {row.santri_topup_bulan_ini > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600">
          <ArrowDownToLine className="h-3 w-3" />
          <span><strong>{row.santri_topup_bulan_ini}</strong> santri topup bulan ini</span>
        </div>
      )}
    </button>
  )
}

function DetailModal({ santri, tahun, bulan, onClose }: { santri: SantriRow; tahun: number; bulan: number; onClose: () => void }) {
  const [data, setData] = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDetailTransaksiSantri(santri.id, tahun, bulan).then(result => {
      setData(result)
      setLoading(false)
    })
  }, [santri.id, tahun, bulan])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900">{santri.nama_lengkap}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{santri.nis}</span>
              <span>{santri.asrama}</span>
              <span>Kamar {santri.kamar}</span>
              <span className={`font-semibold ${santri.saldo > 0 ? 'text-emerald-700' : 'text-rose-500'}`}>
                Uang Jajan {fmtRp(santri.saldo)}
              </span>
              <span className="font-semibold text-blue-700">
                Tabungan {fmtRp(santri.saldo_tabungan)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            aria-label="Tutup detail transaksi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" /> Memuat transaksi...
            </div>
          ) : data.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Tidak ada transaksi pada periode ini.</p>
          ) : (
            <div className="space-y-2">
              {data.map(d => (
                <div key={d.id} className={`rounded-2xl border px-4 py-3 ${d.jenis === 'MASUK' ? 'border-emerald-100 bg-emerald-50' : 'border-orange-100 bg-orange-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        {d.jenis === 'MASUK' ? (
                          <ArrowDownToLine className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4 shrink-0 text-orange-500" />
                        )}
                        <span className="truncate">{d.keterangan || (d.jenis === 'MASUK' ? 'Topup' : 'Jajan')}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.dompet === 'JAJAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {d.dompet === 'JAJAN' ? 'Uang Jajan' : 'Tabungan'}
                        </span>
                        {d.source === 'AUTO_POTONG' && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Auto</span>}
                        {d.source === 'TRANSFER' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Transfer</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {fmtDateTime(d.created_at)}
                        {d.admin_nama ? ` · ${d.admin_nama}` : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${d.jenis === 'MASUK' ? 'text-emerald-700' : 'text-orange-600'}`}>
                      {d.jenis === 'MASUK' ? '+' : '-'}{fmtRp(d.nominal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MonitoringUangJajanPage() {
  const now = new Date()

  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const tahunList = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i)

  const [summaryData, setSummaryData] = useState<SummaryRow[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryLoaded, setSummaryLoaded] = useState(false)

  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [filterSaldo, setFilterSaldo] = useState<FilterSaldo>('SEMUA')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<SantriRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingTable, setLoadingTable] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [activeCard, setActiveCard] = useState<string | null>(null)
  const [selectedDetailRow, setSelectedDetailRow] = useState<SantriRow | null>(null)

  useEffect(() => {
    getAsramaList().then(setAsramaList)
  }, [])

  useEffect(() => {
    if (filterAsrama !== 'SEMUA') {
      getKamarList(filterAsrama).then(list => {
        setKamarList(list)
        setFilterKamar('SEMUA')
      })
    } else {
      setKamarList([])
      setFilterKamar('SEMUA')
    }
  }, [filterAsrama])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      setSummaryData(await getSummaryPerAsrama(tahun, bulan))
      setSummaryLoaded(true)
    } finally {
      setLoadingSummary(false)
    }
  }, [tahun, bulan])

  const loadTable = useCallback(async (pg = 1) => {
    setLoadingTable(true)
    setSelectedDetailRow(null)
    try {
      const res = await getSantriUangJajan({
        tahun,
        bulan,
        asrama: filterAsrama !== 'SEMUA' ? filterAsrama : undefined,
        kamar: filterKamar !== 'SEMUA' ? filterKamar : undefined,
        search: search || undefined,
        page: pg,
        filterSaldo,
      })
      setRows(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
      setHasLoaded(true)
    } finally {
      setLoadingTable(false)
    }
  }, [tahun, bulan, filterAsrama, filterKamar, search, filterSaldo])

  const handleTampilkan = () => {
    loadSummary()
    loadTable(1)
  }

  const handleCardClick = (asrama: string) => {
    setActiveCard(asrama)
    setFilterAsrama(asrama)
    setFilterKamar('SEMUA')
    setSearch('')
    setSearchInput('')
    setFilterSaldo('SEMUA')
  }

  useEffect(() => {
    if (hasLoaded) loadTable(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAsrama, filterKamar, filterSaldo, search])

  const prevBulan = () => {
    if (bulan === 1) {
      setBulan(12)
      setTahun(t => t - 1)
    } else {
      setBulan(b => b - 1)
    }
  }

  const nextBulan = () => {
    if (bulan === 12) {
      setBulan(1)
      setTahun(t => t + 1)
    } else {
      setBulan(b => b + 1)
    }
  }

  const gt = {
    saldo: summaryData.reduce((a, r) => a + r.total_saldo, 0),
    saldoJajan: summaryData.reduce((a, r) => a + r.total_saldo_jajan, 0),
    saldoTabungan: summaryData.reduce((a, r) => a + r.total_saldo_tabungan, 0),
    masuk: summaryData.reduce((a, r) => a + r.masuk_bulan_ini, 0),
    keluar: summaryData.reduce((a, r) => a + r.keluar_bulan_ini, 0),
    auto: summaryData.reduce((a, r) => a + r.auto_bulan_ini, 0),
    punya: summaryData.reduce((a, r) => a + r.punya_saldo, 0),
    total: summaryData.reduce((a, r) => a + r.total_santri, 0),
  }

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-5">
      <div className="space-y-4">
        <DashboardPageHeader
          title="Monitoring Uang Jajan"
          description="Pantau saldo & mutasi uang jajan santri"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_104px]">
            <div className="flex items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <button onClick={prevBulan} className="rounded-lg p-2 transition-colors hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1 px-1 text-center text-base font-bold text-slate-800">
                {BULAN_NAMA[bulan]} {tahun}
              </div>
              <button
                onClick={nextBulan}
                disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1}
                className="rounded-lg p-2 transition-colors hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            <select
              value={tahun}
              onChange={e => setTahun(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button
            onClick={handleTampilkan}
            disabled={loadingSummary || loadingTable}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${(loadingSummary || loadingTable) ? 'animate-spin' : ''}`} />
            Tampilkan
          </button>
        </div>
      </div>

      {summaryLoaded && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total Titipan', value: fmtRp(gt.saldo), icon: Banknote, cls: 'bg-emerald-50 text-emerald-600' },
            { label: 'Uang Jajan', value: fmtRp(gt.saldoJajan), icon: Wallet, cls: 'bg-blue-50 text-blue-600' },
            { label: 'Tabungan', value: fmtRp(gt.saldoTabungan), icon: Banknote, cls: 'bg-indigo-50 text-indigo-600' },
            { label: 'Auto Potong', value: fmtRp(gt.auto), icon: ArrowUpFromLine, cls: 'bg-orange-50 text-orange-600' },
            { label: 'Masuk Jajan', value: fmtRp(gt.masuk), icon: ArrowDownToLine, cls: 'bg-sky-50 text-sky-600' },
            { label: 'Saldo Jajan Kosong', value: `${fmtNum(gt.total - gt.punya)} orang`, icon: AlertCircle, cls: 'bg-rose-50 text-rose-600' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 inline-flex rounded-xl p-2 ${item.cls}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-bold leading-tight text-slate-900">{item.value}</div>
              <div className="mt-1 text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {summaryLoaded && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Per Asrama · {BULAN_NAMA[bulan]} {tahun}
            </h2>
            {activeCard && (
              <button
                onClick={() => {
                  setActiveCard(null)
                  setFilterAsrama('SEMUA')
                }}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                × Hapus filter
              </button>
            )}
          </div>
          {loadingSummary ? (
            <div className="flex justify-center gap-2 py-8 text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Memuat...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {summaryData.map(row => (
                <AsramaCard
                  key={row.asrama}
                  row={row}
                  active={activeCard === row.asrama}
                  onClick={() => handleCardClick(row.asrama)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {summaryLoaded && <div className="border-t border-slate-200" />}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,180px)_auto_minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Asrama</label>
            <select
              value={filterAsrama}
              onChange={e => {
                setFilterAsrama(e.target.value)
                setActiveCard(null)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {kamarList.length > 0 && (
            <div className="min-w-0">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Kamar</label>
              <select
                value={filterKamar}
                onChange={e => setFilterKamar(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="SEMUA">Semua Kamar</option>
                {kamarList.map(k => <option key={k} value={k}>Kamar {k}</option>)}
              </select>
            </div>
          )}

          <div className="min-w-0">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo</label>
            <div className="flex w-full gap-1 rounded-xl bg-slate-100 p-1">
              {(['SEMUA', 'PUNYA', 'KOSONG'] as FilterSaldo[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterSaldo(f)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    filterSaldo === f
                      ? f === 'KOSONG'
                        ? 'bg-white text-rose-600 shadow-sm'
                        : f === 'PUNYA'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f === 'SEMUA' ? 'Semua' : f === 'PUNYA' ? 'Ada' : 'Kosong'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput) }} className="min-w-0">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Nama atau NIS..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </form>

          <div className="flex items-end gap-2">
            <button
              onClick={() => loadTable(1)}
              disabled={loadingTable}
              className="flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Filter className="h-4 w-4" />
              {loadingTable ? 'Memuat...' : 'Tampilkan'}
            </button>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['table', 'grid'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`rounded-lg p-2 transition-all ${viewMode === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {v === 'table' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!hasLoaded ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <Wallet className="h-7 w-7 text-emerald-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Pilih bulan lalu klik <strong>Tampilkan</strong></p>
        </div>
      ) : loadingTable ? (
        <div className="flex justify-center gap-2 py-16 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">Tidak ada santri yang cocok.</div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              <strong className="text-slate-700">{fmtNum(rows.length)}</strong> dari <strong className="text-slate-700">{fmtNum(total)}</strong> santri
              {filterAsrama !== 'SEMUA' && <> · {filterAsrama}</>}
              {filterKamar !== 'SEMUA' && <> · Kamar {filterKamar}</>}
            </span>
            <span className="text-xs">Hal {page}/{totalPages}</span>
          </div>

          {viewMode === 'table' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['No', 'Nama Santri', 'Asrama', 'Kamar', 'Uang Jajan', 'Tabungan', 'Masuk', 'Keluar', 'Auto', ''].map(h => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${
                            h === 'Uang Jajan' || h === 'Tabungan' || h === 'Masuk' || h === 'Keluar' || h === 'Auto' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs text-slate-300">{(page - 1) * 30 + i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <SantriPhotoAvatar
                              src={r.foto_url}
                              name={r.nama_lengkap}
                              alt={`Foto ${r.nama_lengkap}`}
                              size="sm"
                              className="shrink-0"
                            />
                            <div>
                              <div className="font-semibold text-slate-800">{r.nama_lengkap}</div>
                              <div className="text-xs text-slate-400">{r.nis}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.asrama}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{r.kamar}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-bold ${r.saldo > 0 ? 'text-emerald-700' : 'text-rose-500'}`}>{fmtRp(r.saldo)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-bold ${r.saldo_tabungan > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{fmtRp(r.saldo_tabungan)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.masuk_bulan_ini > 0 ? (
                            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                              +{fmtRp(r.masuk_bulan_ini)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.keluar_bulan_ini > 0 ? (
                            <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600">
                              -{fmtRp(r.keluar_bulan_ini)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.auto_bulan_ini > 0 ? (
                            <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              -{fmtRp(r.auto_bulan_ini)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedDetailRow(r)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map(r => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <SantriPhotoAvatar
                      src={r.foto_url}
                      name={r.nama_lengkap}
                      alt={`Foto ${r.nama_lengkap}`}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 whitespace-normal break-words leading-snug">{r.nama_lengkap}</div>
                      <div className="text-xs text-slate-400">{r.nis}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Asrama</span>
                      <span className="font-medium text-slate-700">{r.asrama}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kamar</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-700">{r.kamar}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5">
                      <span className="text-slate-400">Uang Jajan</span>
                      <span className={`font-bold ${r.saldo > 0 ? 'text-emerald-700' : 'text-rose-500'}`}>{fmtRp(r.saldo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">Tabungan</span>
                      <span className={`font-bold ${r.saldo_tabungan > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{fmtRp(r.saldo_tabungan)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">Masuk</span>
                      <span className="font-semibold text-blue-600">{r.masuk_bulan_ini > 0 ? `+${fmtRp(r.masuk_bulan_ini)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-400">Keluar</span>
                      <span className="font-semibold text-orange-600">{r.keluar_bulan_ini > 0 ? `-${fmtRp(r.keluar_bulan_ini)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-500">Auto</span>
                      <span className="font-semibold text-amber-700">{r.auto_bulan_ini > 0 ? `-${fmtRp(r.auto_bulan_ini)}` : '—'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDetailRow(r)}
                    className="mt-3 w-full rounded-lg border border-dashed border-slate-200 py-2 text-xs text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    Lihat Detail Transaksi
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => loadTable(page - 1)}
                disabled={page <= 1 || loadingTable}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Sebelumnya
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => loadTable(pg)}
                      disabled={loadingTable}
                      className={`h-9 w-9 rounded-xl text-sm font-bold transition-all ${
                        pg === page ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pg}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => loadTable(page + 1)}
                disabled={page >= totalPages || loadingTable}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Berikutnya <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {selectedDetailRow && (
        <DetailModal
          key={`${selectedDetailRow.id}-${tahun}-${bulan}`}
          santri={selectedDetailRow}
          tahun={tahun}
          bulan={bulan}
          onClose={() => setSelectedDetailRow(null)}
        />
      )}
    </div>
  )
}
