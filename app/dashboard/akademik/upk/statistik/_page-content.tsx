'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Boxes,
  CircleDollarSign,
  Loader2,
  PackageCheck,
  PackageX,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { rupiah } from '@/lib/upk-utils'
import { getStatistikKitabUPK, type StatistikKitabUPK } from './actions'

type UnitUPK = 'PUTRA' | 'PUTRI'

const number = (value: number) => value.toLocaleString('id-ID')

export default function StatistikUPKPage() {
  const [rows, setRows] = useState<StatistikKitabUPK[]>([])
  const [loading, setLoading] = useState(true)
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')
  const [unit, setUnit] = useState<'' | UnitUPK>('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const loadData = useCallback(async () => {
    if (tanggalDari && tanggalSampai && tanggalDari > tanggalSampai) {
      toast.error('Tanggal mulai tidak boleh setelah tanggal akhir.')
      return
    }
    setLoading(true)
    try {
      setRows(await getStatistikKitabUPK({ tanggalDari, tanggalSampai, unit }))
    } catch (error) {
      console.error('[UPK Statistik] Gagal memuat statistik', error)
      toast.error('Gagal memuat statistik UPK.')
    } finally {
      setLoading(false)
    }
  }, [tanggalDari, tanggalSampai, unit])

  useEffect(() => {
    loadData()
  }, [loadData])

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    return rows.filter((row) => {
      if (!showInactive && !row.is_active && row.katalog_id !== null) return false
      return !needle || row.nama_kitab.toLocaleLowerCase('id-ID').includes(needle)
    })
  }, [rows, search, showInactive])

  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      kitab: acc.kitab + 1,
      stok: acc.stok + row.stok_total,
      terjual: acc.terjual + row.qty_terjual,
      sudah: acc.sudah + row.qty_sudah,
      belum: acc.belum + row.qty_belum,
      gratis: acc.gratis + row.qty_gratis,
      omzet: acc.omzet + row.omzet,
      nilaiStok: acc.nilaiStok + row.nilai_stok,
    }),
    { kitab: 0, stok: 0, terjual: 0, sudah: 0, belum: 0, gratis: 0, omzet: 0, nilaiStok: 0 }
  ), [rows])

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-24">
      <DashboardPageHeader
        title="Statistik Penjualan Kitab"
        description="Penjualan, penyerahan pesanan, stok, dan omzet lengkap per kitab UPK."
        className="border-b pb-4"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Kitab Terjual" value={number(totals.terjual)} icon={BookOpen} tone="text-slate-900" />
        <StatCard label="Sudah Diserahkan" value={number(totals.sudah)} icon={PackageCheck} tone="text-emerald-700" />
        <StatCard label="Belum Diserahkan" value={number(totals.belum)} icon={PackageX} tone="text-amber-700" />
        <StatCard label="Stok Tersisa" value={number(totals.stok)} icon={Boxes} tone="text-blue-700" />
        <StatCard label="Omzet Penjualan" value={rupiah(totals.omzet)} icon={CircleDollarSign} tone="text-emerald-700" />
        <StatCard label="Nilai Modal Stok" value={rupiah(totals.nilaiStok)} icon={BarChart3} tone="text-violet-700" />
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[145px_145px_130px_1fr_auto]">
          <input
            type="date"
            value={tanggalDari}
            onChange={(event) => setTanggalDari(event.target.value)}
            aria-label="Tanggal mulai"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            type="date"
            value={tanggalSampai}
            onChange={(event) => setTanggalSampai(event.target.value)}
            aria-label="Tanggal akhir"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value as '' | UnitUPK)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
          >
            <option value="">Semua Unit</option>
            <option value="PUTRA">Putra</option>
            <option value="PUTRI">Putri</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama kitab..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Terapkan
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>{tanggalDari || tanggalSampai ? 'Statistik transaksi mengikuti periode; stok selalu posisi terkini.' : 'Menampilkan seluruh transaksi selesai; stok adalah posisi terkini.'}</p>
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Tampilkan katalog nonaktif
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div>
            <h2 className="font-bold text-slate-800">Rincian per Kitab</h2>
            <p className="text-xs text-slate-500">{visibleRows.length} kitab · {number(totals.gratis)} kitab dibagikan gratis</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-600" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">Tidak ada data kitab yang cocok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Kitab</th>
                  <th className="px-3 py-3 text-right">Terjual</th>
                  <th className="px-3 py-3 text-right">Sudah Serah</th>
                  <th className="px-3 py-3 text-right">Belum Serah</th>
                  <th className="px-3 py-3 text-right">Stok Lama</th>
                  <th className="px-3 py-3 text-right">Stok Baru</th>
                  <th className="px-3 py-3 text-right">Total Stok</th>
                  <th className="px-3 py-3 text-right">Nota</th>
                  <th className="px-3 py-3 text-right">Gratis</th>
                  <th className="px-4 py-3 text-right">Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.katalog_id ?? `historis-${row.nama_kitab}`} className="hover:bg-amber-50/30">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3">
                      <p className="max-w-[300px] truncate font-bold text-slate-800">{row.nama_kitab}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {row.katalog_id === null ? 'Data historis · katalog tidak ditemukan' : `${rupiah(row.harga_jual)} · modal stok ${rupiah(row.nilai_stok)}`}
                      </p>
                    </td>
                    <NumberCell value={row.qty_terjual} strong />
                    <NumberCell value={row.qty_sudah} tone="text-emerald-700" />
                    <NumberCell value={row.qty_belum} tone={row.qty_belum ? 'text-amber-700' : undefined} />
                    <NumberCell value={row.stok_lama} />
                    <NumberCell value={row.stok_baru} />
                    <NumberCell value={row.stok_total} strong tone={row.stok_total <= 0 ? 'text-rose-600' : 'text-blue-700'} />
                    <NumberCell value={row.transaksi} />
                    <NumberCell value={row.qty_gratis} />
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{rupiah(row.omzet)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-slate-50 font-extrabold text-slate-800">
                <tr>
                  <td className="sticky left-0 bg-slate-50 px-4 py-3">TOTAL</td>
                  <NumberCell value={totals.terjual} strong />
                  <NumberCell value={totals.sudah} strong />
                  <NumberCell value={totals.belum} strong />
                  <td colSpan={2} />
                  <NumberCell value={totals.stok} strong />
                  <td />
                  <NumberCell value={totals.gratis} strong />
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-emerald-700">{rupiah(totals.omzet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-400">
        Terjual dan omzet hanya menghitung transaksi penjualan berstatus selesai; transaksi void dan item batal tidak dihitung. Kitab gratis dipisahkan agar angka omzet tidak tercampur.
      </p>
    </div>
  )
}

function NumberCell({ value, strong, tone }: { value: number; strong?: boolean; tone?: string }) {
  return <td className={`px-3 py-3 text-right font-mono ${strong ? 'font-extrabold' : 'font-semibold'} ${tone ?? 'text-slate-700'}`}>{number(value)}</td>
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof BookOpen; tone: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" /> <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 truncate font-mono text-base font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}
