'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  HandCoins,
  Loader2,
  PackageCheck,
  PackageX,
  PieChart,
  RefreshCw,
  Search,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { rupiah } from '@/lib/upk-utils'
import {
  getPerformaUserUPK,
  getStatistikKitabUPK,
  type PerformaUserUPK,
  type StatistikKitabUPK,
} from './actions'

type UnitUPK = 'PUTRA' | 'PUTRI'

const number = (value: number) => value.toLocaleString('id-ID')

export default function StatistikUPKPage() {
  const [activeTab, setActiveTab] = useState<'kitab' | 'user'>('kitab')
  const [rows, setRows] = useState<StatistikKitabUPK[]>([])
  const [userRows, setUserRows] = useState<PerformaUserUPK[]>([])
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
      if (activeTab === 'kitab') {
        setRows(await getStatistikKitabUPK({ tanggalDari, tanggalSampai, unit }))
      } else {
        setUserRows(await getPerformaUserUPK({ tanggalDari, tanggalSampai, unit }))
      }
    } catch (error) {
      console.error('[UPK Statistik] Gagal memuat statistik', error)
      toast.error('Gagal memuat statistik UPK.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, tanggalDari, tanggalSampai, unit])

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

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    return userRows.filter((row) => !needle || row.nama_user.toLocaleLowerCase('id-ID').includes(needle))
  }, [userRows, search])

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

  const userTotals = useMemo(() => userRows.reduce(
    (acc, row) => ({
      selesai: acc.selesai + row.pesanan_selesai,
      dibuat: acc.dibuat + row.pesanan_dibuat,
      catatan: acc.catatan + row.catatan_dibuat,
      serah: acc.serah + row.kitab_diserahkan,
      aktivitas: acc.aktivitas + row.total_aktivitas,
      nilai: acc.nilai + row.nilai_ditangani,
    }),
    { selesai: 0, dibuat: 0, catatan: 0, serah: 0, aktivitas: 0, nilai: 0 }
  ), [userRows])

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-24">
      <DashboardPageHeader
        title="Statistik UPK"
        description="Pantau penjualan kitab dan kontribusi setiap user UPK dalam satu tempat."
        className="border-b pb-4"
      />

      <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
        <TabButton active={activeTab === 'kitab'} onClick={() => { setActiveTab('kitab'); setSearch('') }} icon={BookOpen}>
          Performa Kitab
        </TabButton>
        <TabButton active={activeTab === 'user'} onClick={() => { setActiveTab('user'); setSearch('') }} icon={Users}>
          Performa User
        </TabButton>
      </div>

      {activeTab === 'kitab' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Kitab Terjual" value={number(totals.terjual)} icon={BookOpen} tone="text-slate-900" />
          <StatCard label="Sudah Diserahkan" value={number(totals.sudah)} icon={PackageCheck} tone="text-emerald-700" />
          <StatCard label="Belum Diserahkan" value={number(totals.belum)} icon={PackageX} tone="text-amber-700" />
          <StatCard label="Stok Tersisa" value={number(totals.stok)} icon={Boxes} tone="text-blue-700" />
          <StatCard label="Omzet Penjualan" value={rupiah(totals.omzet)} icon={CircleDollarSign} tone="text-emerald-700" />
          <StatCard label="Nilai Modal Stok" value={rupiah(totals.nilaiStok)} icon={BarChart3} tone="text-violet-700" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="User Aktif" value={number(userRows.length)} icon={UserRoundCheck} tone="text-slate-900" />
          <StatCard label="Pesanan Selesai" value={number(userTotals.selesai)} icon={ClipboardCheck} tone="text-emerald-700" />
          <StatCard label="Transaksi Dicatat" value={number(userTotals.dibuat)} icon={FileText} tone="text-blue-700" />
          <StatCard label="Catatan Dibuat" value={number(userTotals.catatan)} icon={FileText} tone="text-violet-700" />
          <StatCard label="Kitab Diserahkan" value={number(userTotals.serah)} icon={PackageCheck} tone="text-amber-700" />
          <StatCard label="Nilai Ditangani" value={rupiah(userTotals.nilai)} icon={HandCoins} tone="text-emerald-700" />
        </div>
      )}

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
              placeholder={activeTab === 'kitab' ? 'Cari nama kitab...' : 'Cari nama user...'}
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
          <p>{activeTab === 'kitab'
            ? (tanggalDari || tanggalSampai ? 'Statistik transaksi mengikuti periode; stok selalu posisi terkini.' : 'Menampilkan seluruh transaksi selesai; stok adalah posisi terkini.')
            : 'Performa mencakup transaksi yang dicatat, transaksi selesai, dan jejak aktivitas UPK pada periode terpilih.'}</p>
          {activeTab === 'kitab' && (
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Tampilkan katalog nonaktif
            </label>
          )}
        </div>
      </div>

      {activeTab === 'kitab' ? <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
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
      </div> : (
        <div className="space-y-5">
          <UserPerformanceCharts rows={visibleUsers} loading={loading} />
          <UserPerformanceTable rows={visibleUsers} loading={loading} />
        </div>
      )}

      <p className="px-1 text-xs leading-relaxed text-slate-400">
        {activeTab === 'kitab'
          ? 'Terjual dan omzet hanya menghitung transaksi penjualan berstatus selesai; transaksi void dan item batal tidak dihitung. Kitab gratis dipisahkan agar angka omzet tidak tercampur.'
          : 'Transaksi dicatat mengikuti user pembuat (created_by), termasuk transaksi biasa dan gratis. Pesanan selesai serta nilai ditangani mengikuti user kasir saat pembayaran.'}
      </p>
    </div>
  )
}

function UserPerformanceCharts({ rows, loading }: { rows: PerformaUserUPK[]; loading: boolean }) {
  const ranking = [...rows]
    .sort((a, b) => b.pesanan_selesai - a.pesanan_selesai || b.total_aktivitas - a.total_aktivitas)
    .slice(0, 8)
  const maxSelesai = Math.max(1, ...ranking.map((row) => row.pesanan_selesai))
  const composition = [
    { label: 'Transaksi dicatat', value: rows.reduce((sum, row) => sum + row.pesanan_dibuat, 0), color: '#0ea5e9' },
    { label: 'Kasir selesai', value: rows.reduce((sum, row) => sum + row.pesanan_selesai, 0), color: '#10b981' },
    { label: 'Kitab diserahkan', value: rows.reduce((sum, row) => sum + row.kitab_diserahkan, 0), color: '#f59e0b' },
    { label: 'Tindak lanjut', value: rows.reduce((sum, row) => sum + row.tindak_lanjut, 0), color: '#ec4899' },
    { label: 'Operasional', value: rows.reduce((sum, row) => sum + row.entri_operasional, 0), color: '#8b5cf6' },
  ]
  const totalComposition = composition.reduce((sum, item) => sum + item.value, 0)
  let cursor = 0
  const gradientParts = composition.map((item) => {
    const start = cursor
    cursor += totalComposition ? (item.value / totalComposition) * 100 : 0
    return `${item.color} ${start}% ${cursor}%`
  })
  const donutBackground = totalComposition
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)'

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <ChartLoading />
        <ChartLoading />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-800"><Trophy className="h-4 w-4 text-amber-500" /> Peringkat Pesanan Selesai</h2>
            <p className="mt-0.5 text-xs text-slate-500">8 user teratas pada periode terpilih</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{number(rows.length)} user</span>
        </div>

        {ranking.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="space-y-3.5">
            {ranking.map((row, index) => {
              const width = row.pesanan_selesai > 0 ? Math.max(4, (row.pesanan_selesai / maxSelesai) * 100) : 0
              return (
                <div key={row.user_key} className="grid grid-cols-[28px_minmax(90px,150px)_1fr_45px] items-center gap-2 sm:grid-cols-[32px_minmax(120px,180px)_1fr_54px]">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>{index + 1}</span>
                  <span className="truncate text-xs font-bold text-slate-700 sm:text-sm" title={row.nama_user}>{row.nama_user}</span>
                  <div className="h-8 overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className="flex h-full min-w-0 items-center justify-end rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 px-2 transition-[width] duration-500"
                      style={{ width: `${width}%` }}
                      aria-label={`${row.nama_user}: ${row.pesanan_selesai} pesanan selesai`}
                    />
                  </div>
                  <span className="text-right font-mono text-sm font-extrabold text-emerald-700">{number(row.pesanan_selesai)}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-800"><PieChart className="h-4 w-4 text-violet-500" /> Komposisi Pekerjaan</h2>
          <p className="mt-0.5 text-xs text-slate-500">Sebaran pekerjaan tercatat seluruh user</p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center lg:flex-col xl:flex-row">
          <div
            className="relative h-44 w-44 shrink-0 rounded-full"
            style={{ background: donutBackground }}
            role="img"
            aria-label={`Total ${totalComposition} pekerjaan tercatat`}
          >
            <div className="absolute inset-[24px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <span className="font-mono text-2xl font-extrabold text-slate-800">{number(totalComposition)}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pekerjaan</span>
            </div>
          </div>
          <div className="w-full min-w-0 space-y-3">
            {composition.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{item.label}</span>
                <span className="font-mono font-extrabold text-slate-800">{number(item.value)}</span>
                <span className="w-9 text-right font-mono text-[10px] text-slate-400">{totalComposition ? Math.round((item.value / totalComposition) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function ChartLoading() {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-xl border bg-white shadow-sm">
      <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
    </div>
  )
}

function ChartEmpty() {
  return <div className="flex min-h-56 items-center justify-center text-sm text-slate-400">Belum ada data untuk divisualisasikan.</div>
}

function UserPerformanceTable({ rows, loading }: { rows: PerformaUserUPK[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-3">
        <h2 className="font-bold text-slate-800">Peringkat Performa User</h2>
        <p className="text-xs text-slate-500">Diurutkan berdasarkan pesanan selesai, lalu total aktivitas</p>
      </div>
      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-600" /></div>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center text-sm text-slate-400">Belum ada aktivitas user pada periode ini.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">User</th>
                <th className="px-3 py-3 text-right">Selesai</th>
                <th className="px-3 py-3 text-right">Transaksi Dicatat</th>
                <th className="px-3 py-3 text-right">Catatan</th>
                <th className="px-3 py-3 text-right">Kitab Diserah</th>
                <th className="px-3 py-3 text-right">Tindak Lanjut</th>
                <th className="px-3 py-3 text-right">Operasional</th>
                <th className="px-3 py-3 text-right">Koreksi</th>
                <th className="px-3 py-3 text-right">Hari Aktif</th>
                <th className="px-3 py-3 text-right">Total Aktivitas</th>
                <th className="px-3 py-3 text-right">Rata-rata Proses</th>
                <th className="px-4 py-3 text-right">Nilai Ditangani</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={row.user_key} className="hover:bg-amber-50/30">
                  <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{index + 1}</td>
                  <td className="sticky left-0 z-10 bg-white px-4 py-3">
                    <p className="max-w-[240px] truncate font-bold text-slate-800">{row.nama_user}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Terakhir: {formatActivityTime(row.aktivitas_terakhir)}</p>
                  </td>
                  <NumberCell value={row.pesanan_selesai} strong tone="text-emerald-700" />
                  <NumberCell value={row.pesanan_dibuat} />
                  <NumberCell value={row.catatan_dibuat} tone="text-violet-700" />
                  <NumberCell value={row.kitab_diserahkan} tone="text-amber-700" />
                  <NumberCell value={row.tindak_lanjut} />
                  <NumberCell value={row.entri_operasional} />
                  <NumberCell value={row.koreksi} tone={row.koreksi ? 'text-rose-600' : undefined} />
                  <NumberCell value={row.hari_aktif} />
                  <NumberCell value={row.total_aktivitas} strong />
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-slate-700">{formatMinutes(row.rata_menit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{rupiah(row.nilai_ditangani)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatMinutes(value: number) {
  if (value <= 0) return '-'
  if (value < 60) return `${value} mnt`
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${hours}j${minutes ? ` ${minutes}m` : ''}`
}

function formatActivityTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(date)
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean
  onClick: () => void
  icon: typeof BookOpen
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
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
