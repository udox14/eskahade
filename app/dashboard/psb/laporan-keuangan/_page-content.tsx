'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Loader2,
  RefreshCw,
  Search,
  Trophy,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'

import { getPsbFinancialReport, type PsbFinancialFilters } from './actions'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const JENIS_LIST = ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL', 'SPP_JULI'] as const

const JENIS_LABEL: Record<string, string> = {
  BANGUNAN: 'Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB',
  EKSKUL: 'Ekskul',
  SPP_JULI: 'SPP Juli',
}

const STATUS_PSB_LABEL: Record<string, string> = {
  VERIFICATION: 'Belum Verifikasi',
  VERIFIED: 'Sudah Verifikasi',
  PLACED_ASRAMA: 'Sudah Asrama',
  PAID: 'Sudah Bayar',
  PLACED_KAMAR: 'Sudah Kamar',
  DONE: 'Selesai',
}

const STATUS_BAYAR_LABEL: Record<string, string> = {
  LUNAS: 'Lunas',
  CICIL: 'Cicil',
  BELUM_BAYAR: 'Belum Bayar',
  TANPA_TAGIHAN: 'Tanpa Tagihan',
}

const STATUS_BAYAR_CLASS: Record<string, string> = {
  LUNAS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CICIL: 'bg-amber-50 text-amber-700 border-amber-200',
  BELUM_BAYAR: 'bg-rose-50 text-rose-700 border-rose-200',
  TANPA_TAGIHAN: 'bg-slate-50 text-slate-600 border-slate-200',
}

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function compactDate(value: string | null | undefined) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function initialFilters(): PsbFinancialFilters {
  const now = new Date()
  return {
    tahunTagihan: now.getFullYear(),
    q: '',
    tanggalMulai: '',
    tanggalSelesai: '',
    asrama: '',
    sekolah: '',
    jenisKelamin: '',
    statusPsb: '',
    statusPembayaran: '',
    jenisBiaya: '',
    metode: '',
    penerimaId: '',
    receiptNo: '',
    hanyaPiutang: false,
  }
}

export default function PsbLaporanKeuanganContent() {
  const [filters, setFilters] = useState<PsbFinancialFilters>(() => initialFilters())
  const [appliedFilters, setAppliedFilters] = useState<PsbFinancialFilters>(() => initialFilters())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const load = async (nextFilters = appliedFilters) => {
    setLoading(true)
    try {
      const result = await getPsbFinancialReport(nextFilters)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setData(result)
      setAppliedFilters(nextFilters)
      setPage(1)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat laporan keuangan PSB.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const setFilter = (key: keyof PsbFinancialFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const submitFilters = (event?: React.FormEvent) => {
    event?.preventDefault()
    void load(filters)
  }

  const resetFilters = () => {
    const next = initialFilters()
    setFilters(next)
    void load(next)
  }

  const exportExcel = async () => {
    if (!rows.length) {
      toast.warning('Data kosong.')
      return
    }
    const XLSX = await import('xlsx')
    const exportRows = rows.map((row: any, index: number) => ({
      No: index + 1,
      Nama: row.nama_lengkap,
      NIS: row.nis || '',
      'Jenis Kelamin': row.jenis_kelamin || '',
      Sekolah: row.sekolah || '',
      Kelas: row.kelas_sekolah || '',
      Asrama: row.asrama || '',
      Kamar: row.kamar || '',
      'Tahun Masuk': row.tahun_masuk || '',
      'Status PSB': STATUS_PSB_LABEL[row.status_psb] ?? row.status_psb,
      'Tgl Verifikasi': compactDate(row.verified_at),
      'Tgl Penempatan Asrama': compactDate(row.placed_asrama_at),
      'Tgl Pembayaran': compactDate(row.paid_at),
      'Tgl Penempatan Kamar': compactDate(row.placed_kamar_at),
      'Tgl Selesai': compactDate(row.done_at),
      'Kuitansi Terakhir': row.receipt_no_terakhir || '',
      'Semua Kuitansi': row.receipt_no_list || '',
      Metode: row.metode_terakhir || '',
      Penerima: row.penerima_terakhir || '',
      'Semua Penerima': row.penerima_list || '',
      'Tanggal Bayar Terakhir': compactDate(row.tanggal_bayar_terakhir),
      'Target Bangunan': row.biaya.BANGUNAN.target,
      'Terbayar Bangunan': row.biaya.BANGUNAN.terbayar,
      'Sisa Bangunan': row.biaya.BANGUNAN.sisa,
      'Target Kesehatan': row.biaya.KESEHATAN.target,
      'Terbayar Kesehatan': row.biaya.KESEHATAN.terbayar,
      'Sisa Kesehatan': row.biaya.KESEHATAN.sisa,
      'Target EHB': row.biaya.EHB.target,
      'Terbayar EHB': row.biaya.EHB.terbayar,
      'Sisa EHB': row.biaya.EHB.sisa,
      'Target Ekskul': row.biaya.EKSKUL.target,
      'Terbayar Ekskul': row.biaya.EKSKUL.terbayar,
      'Sisa Ekskul': row.biaya.EKSKUL.sisa,
      'Target SPP Juli': row.biaya.SPP_JULI.target,
      'Terbayar SPP Juli': row.biaya.SPP_JULI.terbayar,
      'Sisa SPP Juli': row.biaya.SPP_JULI.sisa,
      'Total Target': row.total_target,
      'Total Terbayar': row.total_terbayar,
      'Total Sisa': row.total_sisa,
      'Status Pembayaran': STATUS_BAYAR_LABEL[row.status_pembayaran] ?? row.status_pembayaran,
      Catatan: row.catatan || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 13 }, { wch: 18 },
      { wch: 13 }, { wch: 18 }, { wch: 13 }, { wch: 20 }, { wch: 32 }, { wch: 12 },
      { wch: 20 }, { wch: 32 }, { wch: 18 }, ...Array(18).fill({ wch: 16 }), { wch: 18 }, { wch: 48 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan PSB')
    XLSX.writeFile(workbook, `Laporan_Keuangan_PSB_${appliedFilters.tahunTagihan || new Date().getFullYear()}.xlsx`)
    toast.success('Export Excel berhasil dibuat.')
  }

  const summary = data?.summary

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <form onSubmit={submitFilters} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_120px_150px_150px_150px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q || ''}
              onChange={e => setFilter('q', e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Cari nama atau NIS"
            />
          </div>
          <input
            type="number"
            value={filters.tahunTagihan || ''}
            onChange={e => setFilter('tahunTagihan', Number(e.target.value) || new Date().getFullYear())}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Tahun"
          />
          <input
            type="date"
            value={filters.tanggalMulai || ''}
            onChange={e => setFilter('tanggalMulai', e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="date"
            value={filters.tanggalSelesai || ''}
            onChange={e => setFilter('tanggalSelesai', e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={filters.receiptNo || ''}
            onChange={e => setFilter('receiptNo', e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="No kuitansi"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Select value={filters.asrama || ''} onChange={value => setFilter('asrama', value)} placeholder="Semua asrama" options={data?.filterOptions?.asrama ?? []} />
          <Select value={filters.sekolah || ''} onChange={value => setFilter('sekolah', value)} placeholder="Semua sekolah" options={data?.filterOptions?.sekolah ?? []} />
          <select value={filters.jenisKelamin || ''} onChange={e => setFilter('jenisKelamin', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua jenis kelamin</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
          <select value={filters.statusPsb || ''} onChange={e => setFilter('statusPsb', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua status PSB</option>
            {Object.entries(STATUS_PSB_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.statusPembayaran || ''} onChange={e => setFilter('statusPembayaran', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua status bayar</option>
            {Object.entries(STATUS_BAYAR_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto_auto]">
          <select value={filters.jenisBiaya || ''} onChange={e => setFilter('jenisBiaya', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua jenis biaya</option>
            {JENIS_LIST.map(jenis => <option key={jenis} value={jenis}>{JENIS_LABEL[jenis]}</option>)}
          </select>
          <select value={filters.metode || ''} onChange={e => setFilter('metode', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua metode</option>
            <option value="TUNAI">Tunai</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <select value={filters.penerimaId || ''} onChange={e => setFilter('penerimaId', e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Semua penerima</option>
            {data?.filterOptions?.penerima?.map((item: any) => <option key={item.id} value={item.id}>{item.nama}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={!!filters.hanyaPiutang}
              onChange={e => setFilter('hanyaPiutang', e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            Ada piutang
          </label>
          <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
          <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Tampilkan
          </button>
        </div>
      </form>

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white py-24 text-center text-slate-400 shadow-sm">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-emerald-600" />
          Memuat laporan keuangan PSB...
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Terbayar" value={rupiah(summary.totalTerbayar)} icon={Wallet} tone="emerald" />
            <StatCard title="Total Target" value={rupiah(summary.totalTarget)} icon={Banknote} tone="blue" />
            <StatCard title="Total Sisa" value={rupiah(summary.totalSisa)} icon={FileSpreadsheet} tone="rose" />
            <StatCard title="Santri" value={`${summary.jumlahSantri.toLocaleString('id-ID')} orang`} icon={Calendar} tone="slate" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <JenisCard jenis="BANGUNAN" data={summary.byJenis.BANGUNAN} icon={Building2} />
            <JenisCard jenis="KESEHATAN" data={summary.byJenis.KESEHATAN} icon={HeartPulse} />
            <JenisCard jenis="EHB" data={summary.byJenis.EHB} icon={FileSpreadsheet} />
            <JenisCard jenis="EKSKUL" data={summary.byJenis.EKSKUL} icon={Trophy} />
            <JenisCard jenis="SPP_JULI" data={summary.byJenis.SPP_JULI} icon={Banknote} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Rincian Per Santri</h2>
                <p className="mt-0.5 text-xs text-slate-500">{rows.length.toLocaleString('id-ID')} santri sesuai filter aktif</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map(item => <option key={item} value={item}>{item} / halaman</option>)}
                </select>
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={!rows.length}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] text-left text-sm">
                <thead className="border-b bg-white text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Santri</th>
                    <th className="px-4 py-3">Asrama</th>
                    <th className="px-4 py-3">Status</th>
                    {JENIS_LIST.map(jenis => <th key={jenis} className="px-4 py-3 text-right">{JENIS_LABEL[jenis]}</th>)}
                    <th className="px-4 py-3 text-right">Total Bayar</th>
                    <th className="px-4 py-3 text-right">Sisa</th>
                    <th className="px-4 py-3">Kuitansi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-16 text-center text-slate-400">Data tidak ditemukan.</td>
                    </tr>
                  ) : pagedRows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
                        <p className="text-xs text-slate-500">{row.nis || '-'} - {row.sekolah || '-'} {row.kelas_sekolah ? `- ${row.kelas_sekolah}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-semibold">{row.asrama || '-'}</p>
                        <p className="text-xs text-slate-400">{row.kamar || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${STATUS_BAYAR_CLASS[row.status_pembayaran] ?? STATUS_BAYAR_CLASS.TANPA_TAGIHAN}`}>
                          {STATUS_BAYAR_LABEL[row.status_pembayaran] ?? row.status_pembayaran}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">{STATUS_PSB_LABEL[row.status_psb] ?? row.status_psb}</p>
                      </td>
                      {JENIS_LIST.map(jenis => (
                        <td key={jenis} className="px-4 py-3 text-right">
                          <p className="font-mono font-bold text-slate-800">{rupiah(row.biaya[jenis].terbayar)}</p>
                          <p className="text-[11px] text-slate-400">sisa {rupiah(row.biaya[jenis].sisa)}</p>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{rupiah(row.total_terbayar)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">{rupiah(row.total_sisa)}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold text-slate-700">{row.receipt_no_terakhir || '-'}</p>
                        <p className="text-xs text-slate-500">{formatDate(row.tanggal_bayar_terakhir)}</p>
                        <p className="text-xs text-slate-400">{row.penerima_terakhir || '-'}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Menampilkan <b>{rows.length ? (safePage - 1) * pageSize + 1 : 0}</b>-<b>{Math.min(safePage * pageSize, rows.length)}</b> dari <b>{rows.length}</b>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-16 text-center text-xs font-bold text-slate-600">{safePage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'emerald' | 'blue' | 'rose' | 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
        </div>
        <span className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

function JenisCard({ jenis, data, icon: Icon }: { jenis: string; data: any; icon: any }) {
  const percent = data.target > 0 ? Math.min(100, Math.round((data.terbayar / data.target) * 100)) : 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{JENIS_LABEL[jenis]}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="font-mono text-lg font-black text-slate-900">{rupiah(data.terbayar)}</p>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-400">Target</p>
          <p className="font-mono font-bold text-slate-700">{rupiah(data.target)}</p>
        </div>
        <div>
          <p className="text-slate-400">Sisa</p>
          <p className="font-mono font-bold text-rose-700">{rupiah(data.sisa)}</p>
        </div>
      </div>
    </div>
  )
}
