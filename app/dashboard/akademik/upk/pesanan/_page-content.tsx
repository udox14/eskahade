'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronRight,
  ClipboardList,
  Coins,
  HandCoins,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { rupiah } from '@/lib/upk-utils'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  bayarTunggakan,
  getDetailSantriUPK,
  getKembalianDitahan,
  getPesananBelumSerah,
  getTunggakanSantri,
  serahkanKembalian,
  serahkanPesanan,
} from './actions'

type UnitUPK = 'PUTRA' | 'PUTRI'
type Tab = 'serah' | 'tunggakan' | 'kembalian'

type SantriAgg = {
  santri_id: string
  nis: string | null
  nama_santri: string
  unit: UnitUPK
  kelas_nama: string | null
  marhalah_nama: string | null
  jml_kitab: number
  jml_item: number
  jml_nota: number
  total_nilai: number
  total_tunggakan: number
  total_kembalian: number
}

type DetailItem = {
  id: string
  katalog_id: number | null
  nama_kitab: string
  qty: number
  harga_jual: number
  subtotal: number
  status_serah: string
  masuk_pesanan: number
  stok: number
}

type DetailAntrian = {
  id: string
  tanggal: string
  nomor: number
  unit: UnitUPK
  total_tagihan: number
  total_bayar: number
  sisa_kembalian: number
  kembalian_ditahan: number
  sisa_tunggakan: number
  items: DetailItem[]
}

const TABS: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'serah', label: 'Penyerahan', icon: Package },
  { key: 'tunggakan', label: 'Tunggakan', icon: Coins },
  { key: 'kembalian', label: 'Kembalian', icon: HandCoins },
]

function nomorAntrian(value: number) {
  return String(value || 0).padStart(3, '0')
}

function tanggalPendek(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PesananUPKPage() {
  const [tab, setTab] = useState<Tab>('serah')
  const [unit, setUnit] = useState<'' | UnitUPK>('')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [rows, setRows] = useState<SantriAgg[]>([])
  const [loading, setLoading] = useState(true)

  const [detailSantri, setDetailSantri] = useState<SantriAgg | null>(null)
  const [detail, setDetail] = useState<DetailAntrian[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [bayarInput, setBayarInput] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const fn = tab === 'serah' ? getPesananBelumSerah : tab === 'tunggakan' ? getTunggakanSantri : getKembalianDitahan
      const data = await fn(unit, submittedSearch)
      setRows(data)
    } catch (error) {
      console.error('[UPK Pesanan] Gagal memuat data', error)
      toast.error('Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [tab, unit, submittedSearch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.santri += 1
        acc.kitab += r.jml_kitab
        acc.tunggakan += r.total_tunggakan
        acc.kembalian += r.total_kembalian
        return acc
      },
      { santri: 0, kitab: 0, tunggakan: 0, kembalian: 0 }
    )
  }, [rows])

  const openDetail = async (santri: SantriAgg) => {
    setDetailSantri(santri)
    setDetail(null)
    setBayarInput({})
    setLoadingDetail(true)
    const data = await getDetailSantriUPK(santri.santri_id)
    setLoadingDetail(false)
    setDetail(data.antrian)
  }

  const closeDetail = () => {
    setDetailSantri(null)
    setDetail(null)
  }

  const refreshAll = async () => {
    if (detailSantri) {
      const data = await getDetailSantriUPK(detailSantri.santri_id)
      setDetail(data.antrian)
      if (!data.antrian.some((a) => relevantForTab(a, tab).length > 0 || relevantAntrian(a, tab))) {
        closeDetail()
      }
    }
    loadData()
  }

  const doSerah = async (itemId: string) => {
    setBusy(itemId)
    const res = await serahkanPesanan({ itemId })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    toast.success('Kitab diserahkan')
    refreshAll()
  }

  const doBayar = async (antrianId: string, sisa: number) => {
    const raw = bayarInput[antrianId]
    const nominal = raw === undefined || raw === '' ? sisa : parseInt(raw, 10) || 0
    setBusy(antrianId)
    const res = await bayarTunggakan({ antrianId, nominal })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    toast.success('Pembayaran tunggakan dicatat')
    setBayarInput((prev) => ({ ...prev, [antrianId]: '' }))
    refreshAll()
  }

  const doKembalian = async (antrianId: string) => {
    setBusy(antrianId)
    const res = await serahkanKembalian({ antrianId })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    toast.success('Kembalian diserahkan')
    refreshAll()
  }

  const applySearch = () => setSubmittedSearch(search)

  const metricFor = (r: SantriAgg) => {
    if (tab === 'serah') return { label: `${r.jml_kitab} kitab · ${r.jml_item} item`, value: rupiah(r.total_nilai), tone: 'text-slate-800' }
    if (tab === 'tunggakan') return { label: `${r.jml_nota} nota`, value: rupiah(r.total_tunggakan), tone: 'text-amber-700' }
    return { label: `${r.jml_nota} nota`, value: rupiah(r.total_kembalian), tone: 'text-blue-700' }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <DashboardPageHeader
        title="Pesanan & Penagihan UPK"
        description="Serahkan kitab pesanan, tagih tunggakan, dan serahkan kembalian yang ditahan."
        className="border-b pb-4"
        action={
          <Link
            href="/dashboard/akademik/upk/kasir"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 hover:bg-amber-700 sm:w-auto"
          >
            <ShoppingCart className="h-4 w-4" /> Buka Kasir
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Santri" value={summary.santri.toLocaleString('id-ID')} icon={ClipboardList} tone="text-slate-800" />
        {tab === 'serah' ? (
          <StatCard label="Kitab Pesanan" value={summary.kitab.toLocaleString('id-ID')} icon={Package} tone="text-emerald-700" />
        ) : tab === 'tunggakan' ? (
          <StatCard label="Total Tunggakan" value={rupiah(summary.tunggakan)} icon={Coins} tone="text-amber-700" />
        ) : (
          <StatCard label="Total Kembalian" value={rupiah(summary.kembalian)} icon={HandCoins} tone="text-blue-700" />
        )}
        <StatCard label="Daftar" value={`${rows.length}`} icon={RefreshCw} tone="text-slate-800" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              tab === key ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label}</span>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_auto]">
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as '' | UnitUPK)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
        >
          <option value="">Semua Unit</option>
          <option value="PUTRA">Putra</option>
          <option value="PUTRI">Putri</option>
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Cari nama santri / NIS..."
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          onClick={applySearch}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
        >
          <RefreshCw className="h-4 w-4" /> Muat
        </button>
      </div>

      {/* List (card-based, mobile-first) */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-16 text-center text-sm text-slate-400">
            {tab === 'serah'
              ? 'Tidak ada kitab pesanan yang belum diserahkan.'
              : tab === 'tunggakan'
                ? 'Tidak ada tunggakan.'
                : 'Tidak ada kembalian yang ditahan.'}
          </div>
        ) : (
          rows.map((r) => {
            const m = metricFor(r)
            return (
              <button
                key={r.santri_id}
                onClick={() => openDetail(r)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{r.nama_santri}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.nis || '-'} · {r.kelas_nama || r.marhalah_nama || '-'} · {r.unit}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`font-mono text-sm font-extrabold ${m.tone}`}>{m.value}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{m.label}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              </button>
            )
          })
        )}
      </div>

      {/* Detail modal */}
      {detailSantri && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-slate-800">{detailSantri.nama_santri}</h2>
                <p className="truncate text-xs text-slate-500">
                  {detailSantri.nis || '-'} · {detailSantri.kelas_nama || detailSantri.marhalah_nama || '-'} · {detailSantri.unit}
                </p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingDetail || !detail ? (
                <div className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" />
                </div>
              ) : tab === 'serah' ? (
                <SerahDetail antrian={detail} busy={busy} onSerah={doSerah} />
              ) : tab === 'tunggakan' ? (
                <TunggakanDetail antrian={detail} busy={busy} input={bayarInput} setInput={setBayarInput} onBayar={doBayar} />
              ) : (
                <KembalianDetail antrian={detail} busy={busy} onKembalian={doKembalian} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── helpers untuk deteksi apakah nota/item masih relevan setelah aksi ──
function relevantForTab(a: DetailAntrian, tab: Tab): DetailItem[] {
  if (tab !== 'serah') return []
  return a.items.filter((i) => i.status_serah === 'BELUM')
}
function relevantAntrian(a: DetailAntrian, tab: Tab): boolean {
  if (tab === 'tunggakan') return a.sisa_tunggakan > 0
  if (tab === 'kembalian') return a.kembalian_ditahan === 1 && a.sisa_kembalian > 0
  return false
}

function SerahDetail({ antrian, busy, onSerah }: { antrian: DetailAntrian[]; busy: string | null; onSerah: (id: string) => void }) {
  const belum = antrian
    .map((a) => ({ a, items: a.items.filter((i) => i.status_serah === 'BELUM') }))
    .filter((g) => g.items.length > 0)

  if (!belum.length) return <EmptyDetail text="Semua kitab sudah diserahkan." />

  return (
    <>
      {belum.map(({ a, items }) => (
        <div key={a.id} className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
            <span>Nota {nomorAntrian(a.nomor)}</span>
            <span>{tanggalPendek(a.tanggal)}</span>
          </div>
          <div className="divide-y">
            {items.map((it) => {
              const cukup = it.katalog_id === null || it.stok >= it.qty
              return (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{it.nama_kitab}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      qty {it.qty} · stok {it.stok} · {rupiah(it.subtotal)}
                    </p>
                  </div>
                  <button
                    onClick={() => onSerah(it.id)}
                    disabled={!cukup || busy === it.id}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                      cukup
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'cursor-not-allowed bg-slate-100 text-slate-400'
                    }`}
                    title={cukup ? 'Serahkan kitab' : 'Stok belum cukup'}
                  >
                    {busy === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {cukup ? 'Serahkan' : 'Stok habis'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

function TunggakanDetail({
  antrian,
  busy,
  input,
  setInput,
  onBayar,
}: {
  antrian: DetailAntrian[]
  busy: string | null
  input: Record<string, string>
  setInput: (fn: (prev: Record<string, string>) => Record<string, string>) => void
  onBayar: (antrianId: string, sisa: number) => void
}) {
  const notas = antrian.filter((a) => a.sisa_tunggakan > 0)
  if (!notas.length) return <EmptyDetail text="Tidak ada tunggakan." />

  return (
    <>
      {notas.map((a) => (
        <div key={a.id} className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Nota {nomorAntrian(a.nomor)} · {tanggalPendek(a.tanggal)}</span>
            <span className="font-mono text-sm text-amber-700">{rupiah(a.sisa_tunggakan)}</span>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={input[a.id] ?? ''}
              onChange={(e) => setInput((prev) => ({ ...prev, [a.id]: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder={`Bayar (default ${a.sisa_tunggakan.toLocaleString('id-ID')})`}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            />
            <button
              onClick={() => onBayar(a.id, a.sisa_tunggakan)}
              disabled={busy === a.id}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Bayar
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

function KembalianDetail({ antrian, busy, onKembalian }: { antrian: DetailAntrian[]; busy: string | null; onKembalian: (id: string) => void }) {
  const notas = antrian.filter((a) => a.kembalian_ditahan === 1 && a.sisa_kembalian > 0)
  if (!notas.length) return <EmptyDetail text="Tidak ada kembalian yang ditahan." />

  return (
    <>
      {notas.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Nota {nomorAntrian(a.nomor)}</p>
            <p className="text-xs text-slate-500">{tanggalPendek(a.tanggal)}</p>
          </div>
          <span className="font-mono text-sm font-extrabold text-blue-700">{rupiah(a.sisa_kembalian)}</span>
          <button
            onClick={() => onKembalian(a.id)}
            disabled={busy === a.id}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Serahkan
          </button>
        </div>
      ))}
    </>
  )
}

function EmptyDetail({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-slate-400">{text}</div>
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Package; tone: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
        <Icon className="h-3.5 w-3.5" /> <span className="truncate">{label}</span>
      </div>
      <p className={`mt-0.5 truncate font-mono text-sm font-extrabold sm:text-base ${tone}`}>{value}</p>
    </div>
  )
}
