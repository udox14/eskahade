'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { Banknote, BookOpen, ChevronDown, Download, FileText, History, Loader2, RefreshCw, RotateCcw, Save, Search, Settings2, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import Pagination, { usePagination } from '@/components/ui/pagination'
import {
  bayarInlineNonSpp,
  bulkBayarNonSpp,
  getActiveTahunAjaran,
  getBukuBesarSantri,
  getDaftarTarifNonSpp,
  getLaporanNonSpp,
  getMonitoringNonSpp,
  getTarifNonSpp,
  getTahunAjaranOptions,
  searchSantriNonSpp,
  simpanTarifNonSpp,
  simpanOpeningBalanceNonSpp,
  voidOpeningBalanceNonSpp,
  voidPembayaranNonSpp,
} from './actions'

const ASRAMA_LIST = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4', 'AL-BAGHORY']
const JENIS_ALL = ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL'] as const
const JENIS_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const

type TabKey = 'pembayaran' | 'tarif' | 'buku-besar' | 'laporan'

function rp(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function intFromInput(value: string) {
  const parsed = Number(value.replace(/\D/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function KeuanganNonSppPage() {
  const [tab, setTab] = useState<TabKey>('pembayaran')
  const [tahunOptions, setTahunOptions] = useState<any[]>([])
  const [tahunAjaranId, setTahunAjaranId] = useState<number>(0)

  useEffect(() => {
    async function init() {
      const [list, active] = await Promise.all([getTahunAjaranOptions(), getActiveTahunAjaran()])
      setTahunOptions(list)
      setTahunAjaranId(active?.id || list[0]?.id || 0)
    }
    init()
  }, [])

  const tahunAjaran = tahunOptions.find((item) => item.id === tahunAjaranId)

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <DashboardPageHeader
        title="Keuangan Non-SPP"
        description="Pembayaran Bangunan, Kesehatan, EHB, dan Ekskul dalam satu tempat."
        action={(
          <select
            value={tahunAjaranId || ''}
            onChange={(event) => setTahunAjaranId(Number(event.target.value))}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {!tahunAjaranId && <option value="">Pilih Tahun Ajaran</option>}
            {tahunOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.nama}{item.is_active ? ' - Aktif' : ''}</option>
            ))}
          </select>
        )}
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabButton active={tab === 'pembayaran'} onClick={() => setTab('pembayaran')} icon={Banknote} label="Pembayaran" />
        <TabButton active={tab === 'tarif'} onClick={() => setTab('tarif')} icon={Settings2} label="Tarif Tahun Ajaran" />
        <TabButton active={tab === 'buku-besar'} onClick={() => setTab('buku-besar')} icon={BookOpen} label="Buku Besar" />
        <TabButton active={tab === 'laporan'} onClick={() => setTab('laporan')} icon={FileText} label="Laporan" />
      </div>

      {!tahunAjaranId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500">Tahun ajaran belum tersedia.</div>
      ) : tab === 'pembayaran' ? (
        <PembayaranTab tahunAjaranId={tahunAjaranId} tahunAjaranNama={tahunAjaran?.nama || '-'} />
      ) : tab === 'tarif' ? (
        <TarifTab tahunAjaranId={tahunAjaranId} tahunAjaranNama={tahunAjaran?.nama || '-'} />
      ) : tab === 'buku-besar' ? (
        <BukuBesarTab />
      ) : (
        <LaporanTab tahunAjaranId={tahunAjaranId} tahunAjaranNama={tahunAjaran?.nama || '-'} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
}

function PembayaranTab({ tahunAjaranId, tahunAjaranNama }: { tahunAjaranId: number; tahunAjaranNama: string }) {
  const [asrama, setAsrama] = useState('SEMUA')
  const [kamar, setKamar] = useState('SEMUA')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkJenis, setBulkJenis] = useState<Record<string, boolean>>({ BANGUNAN: true, KESEHATAN: true, EHB: true, EKSKUL: true })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [lastBatch, setLastBatch] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await getMonitoringNonSpp({ tahunAjaranId, asrama, kamar, search })
    setRows(data)
    setSelected(new Set())
    setPage(1)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId])

  const { paged, totalPages, safePage } = usePagination(rows, pageSize, page)
  const allPageSelected = paged.length > 0 && paged.every((row: any) => selected.has(row.id))

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) paged.forEach((row: any) => next.delete(row.id))
      else paged.forEach((row: any) => next.add(row.id))
      return next
    })
  }

  const submitBulk = async () => {
    const jenis = JENIS_ALL.filter((item) => bulkJenis[item])
    if (!selected.size) return toast.warning('Pilih santri terlebih dahulu.')
    if (!jenis.length) return toast.warning('Pilih jenis biaya.')
    if (!confirm(`Tandai ${selected.size} santri sudah bayar untuk ${jenis.join(', ')}?`)) return
    setLoading(true)
    const res = await bulkBayarNonSpp({ santriIds: Array.from(selected), tahunAjaranId, jenis })
    setLoading(false)
    if ('error' in res) return toast.error('Gagal', { description: res.error })
    setLastBatch(res.batchId)
    toast.success('Bulk pembayaran tersimpan', { description: `${res.inserted} transaksi dibuat, ${res.skipped} dilewati. Total ${rp(res.total)}.` })
    load()
  }

  const undoBatch = async () => {
    if (!lastBatch) return
    const alasan = prompt('Alasan void batch pembayaran ini?')
    if (!alasan) return
    const res = await voidPembayaranNonSpp({ batchId: lastBatch, alasan })
    if ('error' in res) return toast.error('Gagal void', { description: res.error })
    toast.success('Batch di-void', { description: `${res.count} transaksi dibatalkan.` })
    setLastBatch(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_120px_auto] md:items-end">
          <FilterInput search={search} setSearch={setSearch} load={load} />
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
            <select value={asrama} onChange={(event) => { setAsrama(event.target.value); setKamar('SEMUA') }} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="SEMUA">Semua Asrama</option>
              {ASRAMA_LIST.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kamar</label>
            <select value={kamar} onChange={(event) => setKamar(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="SEMUA">Semua</option>
              {Array.from({ length: 30 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tampilkan
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-extrabold text-emerald-900">Bulk pembayaran {tahunAjaranNama}</p>
            <p className="text-xs text-emerald-700">{selected.size} santri dipilih. Item yang sudah lunas otomatis dilewati.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {JENIS_ALL.map((jenis) => (
              <label key={jenis} className="flex items-center gap-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-800">
                <input type="checkbox" checked={!!bulkJenis[jenis]} onChange={(event) => setBulkJenis((prev) => ({ ...prev, [jenis]: event.target.checked }))} />
                {jenis}
              </label>
            ))}
            <button onClick={submitBulk} disabled={loading || !selected.size} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Tandai Terpilih Bayar</button>
            {lastBatch && (
              <button onClick={undoBatch} className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                <RotateCcw className="h-4 w-4" /> Void Batch
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allPageSelected} onChange={togglePage} /></th>
                <th className="min-w-[240px] px-4 py-3">Santri</th>
                <th className="px-4 py-3 text-center">Bangunan</th>
                {JENIS_TAHUNAN.map((jenis) => <th key={jenis} className="px-4 py-3 text-center">{jenis}</th>)}
                <th className="px-4 py-3 text-right">Kurang</th>
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Data tidak ditemukan.</td></tr>
              ) : paged.map((row: any) => (
                <Fragment key={row.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-slate-800">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{row.nis || '-'} - {row.asrama || '-'} Kamar {row.kamar || '-'} - Angkatan {row.tahun_masuk_fix}</p>
                      {row.is_legacy_settled && <p className="mt-1 text-[11px] font-bold text-indigo-700">Saldo awal migrasi lunas per {row.legacy_cutoff_tanggal}</p>}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={row.is_legacy_settled && row.bangunan.tarif <= 0 ? 'LUNAS AWAL' : row.bangunan.status} sisa={row.bangunan.sisa} /></td>
                    {JENIS_TAHUNAN.map((jenis) => <td key={jenis} className="px-4 py-3 text-center"><StatusBadge status={row.is_legacy_settled && row.tahunan[jenis].tarif <= 0 ? 'LUNAS AWAL' : row.tahunan[jenis].lunas ? 'LUNAS' : 'BELUM'} sisa={row.tahunan[jenis].sisa} /></td>)}
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{rp(row.total_kurang)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="rounded border border-slate-200 p-2 text-slate-500 hover:bg-slate-100" title="Detail inline">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded === row.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={8} className="px-4 py-4">
                        <InlinePaymentRow row={row} tahunAjaranId={tahunAjaranId} onChanged={load} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} totalPages={totalPages} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
      </div>
    </div>
  )
}

function FilterInput({ search, setSearch, load }: { search: string; setSearch: (value: string) => void; load: () => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Cari Nama / NIS</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ketik nama santri..." />
      </div>
    </div>
  )
}

function StatusBadge({ status, sisa }: { status: string; sisa: number }) {
  const good = status === 'LUNAS' || status === 'LUNAS AWAL'
  const warn = status === 'CICIL'
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-extrabold ${good ? 'border-green-200 bg-green-50 text-green-700' : warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{status}</span>
      {sisa > 0 && <p className="text-[10px] font-mono text-red-600">{rp(sisa)}</p>}
    </div>
  )
}

function InlinePaymentRow({ row, tahunAjaranId, onChanged }: { row: any; tahunAjaranId: number; onChanged: () => void }) {
  const [nominalBangunan, setNominalBangunan] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const bayar = async (jenis: typeof JENIS_ALL[number], nominal?: number) => {
    setSaving(jenis)
    const res = await bayarInlineNonSpp({ santriId: row.id, tahunAjaranId, jenis, nominal })
    setSaving(null)
    if ('error' in res) return toast.error('Gagal', { description: res.error })
    toast.success('Pembayaran tersimpan')
    setNominalBangunan('')
    onChanged()
  }

  const voidPayment = async (paymentId: string) => {
    const alasan = prompt('Alasan void transaksi ini?')
    if (!alasan) return
    const res = await voidPembayaranNonSpp({ paymentId, alasan })
    if ('error' in res) return toast.error('Gagal void', { description: res.error })
    toast.success('Transaksi di-void')
    onChanged()
  }

  const markOpeningBalance = async (jenis: typeof JENIS_ALL[number]) => {
    const current = jenis === 'BANGUNAN' ? row.opening_balance?.BANGUNAN : row.opening_balance?.[jenis]
    const nominalText = prompt(`Nominal tagihan awal ${jenis}?`, current ? String(current) : '')
    if (!nominalText) return
    const nominal = intFromInput(nominalText)
    const catatan = prompt('Catatan tagihan awal?', `Tagihan awal migrasi ${jenis}`) || undefined
    const res = await simpanOpeningBalanceNonSpp({ santriId: row.id, tahunAjaranId, jenis, nominal, catatan })
    if ('error' in res) return toast.error('Gagal menandai tagihan awal', { description: res.error })
    toast.success('Tagihan awal tersimpan')
    onChanged()
  }

  const voidOpeningBalance = async (openingBalanceId: string) => {
    const alasan = prompt('Alasan void tagihan awal ini?')
    if (!alasan) return
    const res = await voidOpeningBalanceNonSpp({ openingBalanceId, alasan })
    if ('error' in res) return toast.error('Gagal void tagihan awal', { description: res.error })
    toast.success('Tagihan awal di-void')
    onChanged()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800"><WalletCards className="h-4 w-4 text-emerald-600" /> Input Inline</h4>
        {row.is_legacy_settled && (
          <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800">
            <p className="font-extrabold">Saldo awal migrasi dianggap lunas per {row.legacy_cutoff_tanggal}.</p>
            <p>Tandai kategori sebagai tagihan awal hanya jika santri ini ternyata belum lunas.</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="font-bold text-slate-700">Bangunan</p>
            <p className="mb-2 text-xs text-slate-500">Terbayar {rp(row.bangunan.paid)} dari {rp(row.bangunan.tarif)}</p>
            {row.bangunan.sisa > 0 ? (
              <div className="space-y-2">
                <input value={nominalBangunan} onChange={(event) => setNominalBangunan(event.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))} className="h-10 w-full rounded border border-slate-200 px-3 text-right font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder={rp(row.bangunan.sisa)} />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => bayar('BANGUNAN', intFromInput(nominalBangunan))} disabled={saving === 'BANGUNAN'} className="rounded bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving === 'BANGUNAN' ? '...' : 'Bayar Cicil'}</button>
                  <button onClick={() => bayar('BANGUNAN')} disabled={saving === 'BANGUNAN'} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Lunasi</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="rounded bg-green-50 p-2 text-center text-xs font-bold text-green-700">{row.is_legacy_settled && row.bangunan.tarif <= 0 ? 'Lunas Awal/Migrasi' : 'Lunas'}</p>
                {row.is_legacy_settled && <button onClick={() => markOpeningBalance('BANGUNAN')} className="w-full rounded border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">Tandai Belum Lunas</button>}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 p-3">
            <p className="font-bold text-slate-700">Tahunan</p>
            <p className="mb-2 text-xs text-slate-500">Kesehatan, EHB, dan Ekskul</p>
            <div className="space-y-2">
              {JENIS_TAHUNAN.map((jenis) => {
                const item = row.tahunan[jenis]
                return (
                  <div key={jenis} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold text-slate-700">{jenis}</p>
                      <p className="text-[11px] text-slate-500">Sisa {rp(item.sisa)}</p>
                    </div>
                    {item.lunas ? item.paymentIds[0] ? (
                      <button onClick={() => voidPayment(item.paymentIds[0])} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">Void</button>
                    ) : (
                      <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{item.hasPsbPayment ? 'Flow PSB' : 'Lunas'}</span>
                    ) : item.sisa > 0 ? (
                      <button onClick={() => bayar(jenis)} disabled={saving === jenis || item.sisa <= 0} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Bayar</button>
                    ) : row.is_legacy_settled ? (
                      <button onClick={() => markOpeningBalance(jenis)} className="rounded border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50">Tandai Belum</button>
                    ) : (
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">-</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {row.opening_balance_rows?.length > 0 && (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
            <p className="mb-2 text-xs font-extrabold uppercase text-indigo-700">Tagihan Awal Aktif</p>
            <div className="space-y-2">
              {row.opening_balance_rows.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700">{item.jenis_biaya} - {rp(item.nominal_tagihan)}</span>
                  <button onClick={() => voidOpeningBalance(item.id)} className="rounded border border-red-200 px-2 py-1 font-bold text-red-700 hover:bg-red-50">Void Tagihan</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MiniLedger santriId={row.id} tahunAjaranId={tahunAjaranId} onVoid={onChanged} />
    </div>
  )
}

function MiniLedger({ santriId, tahunAjaranId, onVoid }: { santriId: string; tahunAjaranId: number; onVoid: () => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    getBukuBesarSantri(santriId, tahunAjaranId).then(setData)
  }, [santriId, tahunAjaranId])
  if (!data) return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">Memuat riwayat...</div>

  const voidPayment = async (paymentId: string) => {
    const alasan = prompt('Alasan void transaksi ini?')
    if (!alasan) return
    const res = await voidPembayaranNonSpp({ paymentId, alasan })
    if ('error' in res) return toast.error('Gagal void', { description: res.error })
    toast.success('Transaksi di-void')
    onVoid()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><History className="h-4 w-4 text-emerald-600" /> Riwayat Ringkas</h4>
        <Link href={`/dashboard/keuangan/non-spp/buku-besar/${santriId}`} className="text-xs font-bold text-emerald-700 hover:underline">Buka lengkap</Link>
      </div>
      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        {data.payments.length === 0 ? <p className="text-sm text-slate-400">Belum ada transaksi.</p> : data.payments.slice(0, 8).map((p: any) => (
          <div key={p.id} className={`rounded border p-2 text-xs ${p.status === 'VOID' ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-extrabold">{p.jenis_biaya} {p.tahun_tagihan || ''} - {rp(p.nominal_bayar)}</p>
                <p>{p.tanggal_bayar} - {p.penerima_nama || 'Sistem'}</p>
                {p.psb_receipt_id && <p className="font-bold text-blue-700">Flow PSB</p>}
                {p.batch_id && <p>Batch: {p.batch_id.slice(0, 8)}</p>}
                {p.status === 'VOID' && <p className="font-bold">VOID: {p.void_reason}</p>}
              </div>
              {p.status !== 'VOID' && !p.psb_receipt_id && <button onClick={() => voidPayment(p.id)} className="rounded border border-red-200 bg-white px-2 py-1 font-bold text-red-700">Void</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TarifTab({ tahunAjaranId, tahunAjaranNama }: { tahunAjaranId: number; tahunAjaranNama: string }) {
  const [tahunAngkatan, setTahunAngkatan] = useState(new Date().getFullYear())
  const [tarif, setTarif] = useState<any>({ BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 })
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    const [detail, daftar] = await Promise.all([getTarifNonSpp(tahunAjaranId, tahunAngkatan), getDaftarTarifNonSpp(tahunAjaranId)])
    setTarif(detail)
    setList(daftar)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId, tahunAngkatan])

  const save = async () => {
    setLoading(true)
    const res = await simpanTarifNonSpp({ tahunAjaranId, tahunAngkatan, tarif })
    setLoading(false)
    if ('error' in res) return toast.error('Gagal', { description: res.error })
    toast.success('Tarif tersimpan', { description: `${tahunAjaranNama} - Angkatan ${tahunAngkatan}` })
    refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-800"><Settings2 className="h-5 w-5 text-emerald-600" /> Tarif {tahunAjaranNama}</h3>
        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tahun Angkatan</label>
        <div className="mb-4 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
          <button onClick={() => setTahunAngkatan((value) => value - 1)} className="rounded bg-slate-100 font-bold">-</button>
          <input type="number" value={tahunAngkatan} onChange={(event) => setTahunAngkatan(Number(event.target.value))} className="h-11 rounded border border-slate-200 text-center font-extrabold outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => setTahunAngkatan((value) => value + 1)} className="rounded bg-slate-100 font-bold">+</button>
        </div>
        <div className="space-y-3">
          {JENIS_ALL.map((jenis) => <MoneyInput key={jenis} label={jenis} value={tarif[jenis] || 0} onChange={(value) => setTarif((prev: any) => ({ ...prev, [jenis]: value }))} />)}
        </div>
        <button onClick={save} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Tarif
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h3 className="font-extrabold text-slate-700">Daftar Tarif Tersimpan</h3>
          <p className="text-xs text-slate-500">Label legacy berarti tarif lama angkatan, belum disimpan khusus untuk Tahun Ajaran ini.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Angkatan</th>
                {JENIS_ALL.map((jenis) => <th key={jenis} className="px-4 py-3 text-right">{jenis}</th>)}
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Belum ada tarif.</td></tr> : list.map((item) => (
                <tr key={item.tahun} className={item.tahun === tahunAngkatan ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-3 font-extrabold text-slate-800">{item.tahun} {item.legacy && <span className="ml-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">legacy</span>}</td>
                  {JENIS_ALL.map((jenis) => <td key={jenis} className="px-4 py-3 text-right font-mono">{rp(item[jenis])}</td>)}
                  <td className="px-4 py-3 text-center"><button onClick={() => setTahunAngkatan(item.tahun)} className="rounded border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
        <input value={Number(value || 0).toLocaleString('id-ID')} onChange={(event) => onChange(intFromInput(event.target.value))} onFocus={(event) => event.target.select()} className="h-11 w-full rounded border border-slate-200 pl-10 pr-3 text-right font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
    </div>
  )
}

function BukuBesarTab() {
  const [ledgerQuery, setLedgerQuery] = useState('')
  const [searchRows, setSearchRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const searchLedger = async () => {
    if (ledgerQuery.trim().length < 2) return toast.warning('Ketik minimal 2 karakter.')
    setLoading(true)
    setSearchRows(await searchSantriNonSpp(ledgerQuery))
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-extrabold text-slate-800"><BookOpen className="h-5 w-5 text-emerald-600" /> Buku Besar Santri</h3>
        <p className="text-sm text-slate-500">Cari santri, lalu buka halaman khusus untuk melihat ketuntasan tiap tahun, riwayat pembayaran, dan kuitansi.</p>
      </div>
      <div className="flex max-w-2xl gap-2">
        <input value={ledgerQuery} onChange={(event) => setLedgerQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && searchLedger()} className="h-11 min-w-0 flex-1 rounded border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Cari nama / NIS" />
        <button onClick={searchLedger} disabled={loading} className="flex items-center gap-2 rounded bg-slate-800 px-4 text-sm font-bold text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Cari
        </button>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        {searchRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">Hasil pencarian akan tampil di sini.</div>
        ) : searchRows.map((row) => (
          <Link key={row.id} href={`/dashboard/keuangan/non-spp/buku-besar/${row.id}`} className="flex items-center justify-between border-b px-4 py-3 text-sm hover:bg-emerald-50">
            <div>
              <p className="font-extrabold text-slate-800">{row.nama_lengkap}</p>
              <p className="text-xs text-slate-500">{row.nis || '-'} - {row.asrama || '-'} Kamar {row.kamar || '-'}</p>
            </div>
            <span className="rounded border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">Buka Buku Besar</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function LaporanTab({ tahunAjaranId, tahunAjaranNama }: { tahunAjaranId: number; tahunAjaranNama: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadReport = async () => {
    setLoading(true)
    const res = await getLaporanNonSpp(tahunAjaranId)
    setData(res)
    setLoading(false)
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunAjaranId])

  const exportExcel = async () => {
    if (!data?.list?.length) return toast.warning('Data kosong.')
    const XLSX = await import('xlsx')
    const rows = data.list.map((item: any, index: number) => ({
      No: index + 1,
      Tanggal: item.tanggal_bayar,
      Santri: item.nama_lengkap,
      NIS: item.nis,
      Asrama: item.asrama,
      Jenis: item.jenis_biaya,
      Tahun_Tagihan: item.tahun_tagihan || '-',
      Nominal: item.nominal_bayar,
      Status: item.status || 'AKTIF',
      Batch: item.batch_id || '',
      PSB_Receipt: item.psb_receipt_id || '',
      Penerima: item.penerima_nama || 'Sistem',
      Keterangan: item.keterangan || '',
      Void_Reason: item.void_reason || '',
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Non-SPP')
    XLSX.writeFile(workbook, `Keuangan_Non_SPP_${tahunAjaranNama.replace(/\W+/g, '_')}.xlsx`)
    toast.success('Export berhasil')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(['TOTAL', ...JENIS_ALL] as const).map((jenis) => (
          <ReportStat
            key={jenis}
            title={jenis === 'TOTAL' ? 'Total Keseluruhan' : jenis}
            potential={data?.targets?.[jenis]?.target || 0}
            received={data?.targets?.[jenis]?.terima || 0}
            remaining={data?.targets?.[jenis]?.kurang || 0}
          />
        ))}
      </div>
      {data?.legacy && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p className="font-extrabold">Saldo awal migrasi per {data.legacy.cutoffTanggal}</p>
          <p>{data.legacy.settledCount} santri legacy dianggap lunas awal. {data.legacy.piutangCount} santri legacy memiliki tagihan awal aktif.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800">Laporan Transaksi {tahunAjaranNama}</h3>
            <p className="text-xs text-slate-500">Transaksi void tetap ditampilkan untuk audit, tetapi tidak masuk uang diterima.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadReport} disabled={loading} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><RefreshCw className="h-4 w-4" /> Muat</button>
            <button onClick={exportExcel} className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><Download className="h-4 w-4" /> Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : !data?.list?.length ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Belum ada transaksi.</td></tr> : data.list.slice(0, 100).map((item: any) => (
                <tr key={item.id} className={item.status === 'VOID' ? 'bg-red-50/40 text-slate-500' : ''}>
                  <td className="px-4 py-3 text-xs">{item.tanggal_bayar}</td>
                  <td className="px-4 py-3"><p className="font-bold">{item.nama_lengkap}</p><p className="text-xs text-slate-400">{item.nis || '-'} - {item.asrama || '-'}</p></td>
                  <td className="px-4 py-3">{item.jenis_biaya} {item.tahun_tagihan || ''}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{rp(item.nominal_bayar)}</td>
                  <td className="px-4 py-3 text-xs font-bold">{item.psb_receipt_id ? 'Flow PSB' : 'Non-SPP'}</td>
                  <td className="px-4 py-3">{item.status === 'VOID' ? <span className="font-bold text-red-700">VOID</span> : <span className="font-bold text-green-700">AKTIF</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReportStat({ title, potential, received, remaining }: { title: string; potential: number; received: number; remaining: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 truncate text-xs font-extrabold uppercase text-slate-500">{title}</p>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">Potensi</span>
          <span className="min-w-0 whitespace-nowrap text-right font-mono font-extrabold text-slate-800">{rp(potential)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-emerald-600">Diterima</span>
          <span className="min-w-0 whitespace-nowrap text-right font-mono font-extrabold text-emerald-700">{rp(received)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-red-600">Belum</span>
          <span className="min-w-0 whitespace-nowrap text-right font-mono font-extrabold text-red-700">{rp(remaining)}</span>
        </div>
      </div>
    </div>
  )
}
