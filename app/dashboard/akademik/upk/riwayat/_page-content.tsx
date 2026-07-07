'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { rupiah, tanggalWaktu } from '@/lib/upk-utils'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getDetailTransaksiUPK,
  getRiwayatTransaksiUPK,
  voidTransaksiUPK,
} from './actions'

type UnitUPK = 'PUTRA' | 'PUTRI'
type JenisTransaksiUPK = 'PENJUALAN' | 'GRATIS_SANTRI' | 'GRATIS_GURU'

type RiwayatItem = {
  id: string
  tanggal: string
  nomor: number
  unit: UnitUPK
  nis: string | null
  nama_santri: string
  kelas_nama: string | null
  marhalah_nama: string | null
  total_tagihan: number
  total_bayar: number
  sisa_kembalian: number
  kembalian_ditahan: number
  sisa_tunggakan: number
  status: string
  catatan: string | null
  jenis_transaksi: JenisTransaksiUPK
  penerima_type: string
  guru_id: number | null
  harga_modal_total: number
  pengeluaran_id: string | null
  paid_at: string | null
  void_reason: string | null
  voided_at: string | null
  cashier_name: string | null
  voided_by_name: string | null
  total_item: number
}

type DetailTransaksi = RiwayatItem & {
  items: Array<{
    id: string
    katalog_id: number | null
    nama_kitab: string
    qty: number
    harga_jual: number
    subtotal: number
    harga_modal: number
    modal_subtotal: number
    status_serah: string
    masuk_pesanan: number
  }>
}

function nomorAntrian(value: number) {
  return String(value || 0).padStart(3, '0')
}

function tanggalPendek(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function RiwayatTransaksiUPKPage() {
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')
  const [unit, setUnit] = useState<'' | UnitUPK>('')
  const [status, setStatus] = useState<'SEMUA' | 'SELESAI' | 'VOID'>('SEMUA')
  const [jenis, setJenis] = useState<'PENJUALAN' | 'GRATIS'>('PENJUALAN')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [rows, setRows] = useState<RiwayatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<DetailTransaksi | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [voidTarget, setVoidTarget] = useState<RiwayatItem | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRiwayatTransaksiUPK({
        tanggalDari,
        tanggalSampai,
        unit,
        status,
        jenis,
        search: submittedSearch,
      })
      setRows(data)
    } catch (error) {
      console.error('[UPK Riwayat] Gagal memuat transaksi', error)
      toast.error('Gagal memuat riwayat transaksi.')
    } finally {
      setLoading(false)
    }
  }, [tanggalDari, tanggalSampai, unit, status, jenis, submittedSearch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summary = useMemo(() => {
    return rows.reduce((acc, row) => {
      if (row.status === 'VOID') {
        acc.void += 1
        return acc
      }
      if (row.jenis_transaksi !== 'PENJUALAN') {
        acc.gratis += 1
        acc.modalGratis += row.harga_modal_total || 0
        return acc
      }
      acc.transaksi += 1
      acc.tagihan += row.total_tagihan || 0
      acc.bayar += row.total_bayar || 0
      acc.tunggakan += row.sisa_tunggakan || 0
      return acc
    }, { transaksi: 0, gratis: 0, void: 0, tagihan: 0, bayar: 0, tunggakan: 0, modalGratis: 0 })
  }, [rows])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    const data = await getDetailTransaksiUPK(id)
    setLoadingDetail(false)
    if (!data) return toast.error('Detail transaksi tidak ditemukan.')
    setDetail(data)
  }

  const openVoid = (row: RiwayatItem) => {
    setVoidTarget(row)
    setVoidReason('')
  }

  const submitVoid = async () => {
    if (!voidTarget) return
    if (voidReason.trim().length < 5) {
      toast.warning('Alasan void minimal 5 karakter.')
      return
    }
    setVoiding(true)
    const result = await voidTransaksiUPK({ id: voidTarget.id, alasan: voidReason })
    setVoiding(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Transaksi berhasil di-void')
    setVoidTarget(null)
    setVoidReason('')
    loadData()
  }

  const applySearch = () => setSubmittedSearch(search)

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <DashboardPageHeader
        title="Riwayat Transaksi UPK"
        description="Pantau transaksi selesai dan void transaksi jika diperlukan."
        className="border-b pb-4"
        action={(
          <div className="grid w-full grid-cols-2 gap-2 xl:w-auto xl:grid-cols-4">
            <div className="rounded-lg border bg-white px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Transaksi</p>
              <p className="text-lg font-extrabold text-slate-800">{summary.transaksi.toLocaleString('id-ID')}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Diterima</p>
              <p className="text-lg font-extrabold text-emerald-700">{rupiah(summary.bayar)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Tunggakan</p>
              <p className="text-lg font-extrabold text-amber-700">{rupiah(summary.tunggakan)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Void</p>
              <p className="text-lg font-extrabold text-red-700">{summary.void.toLocaleString('id-ID')}</p>
            </div>
          </div>
        )}
      />

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:w-[320px]">
          <button onClick={() => setJenis('PENJUALAN')} className={`rounded-lg px-3 py-2 text-sm font-bold ${jenis === 'PENJUALAN' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Penjualan
          </button>
          <button onClick={() => setJenis('GRATIS')} className={`rounded-lg px-3 py-2 text-sm font-bold ${jenis === 'GRATIS' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Gratis
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_150px_150px_1fr_auto]">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={tanggalDari}
              onChange={(e) => setTanggalDari(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold"
            />
          </div>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={tanggalSampai}
              onChange={(e) => setTanggalSampai(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold"
            />
          </div>
          <select value={unit} onChange={(e) => setUnit(e.target.value as '' | UnitUPK)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
            <option value="">Semua Unit</option>
            <option value="PUTRA">Putra</option>
            <option value="PUTRI">Putri</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'SEMUA' | 'SELESAI' | 'VOID')} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
            <option value="SEMUA">Semua Status</option>
            <option value="SELESAI">Selesai</option>
            <option value="VOID">Void</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Cari santri, NIS, atau nomor..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button onClick={applySearch} className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200">
            <RefreshCw className="h-4 w-4" /> Muat
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
          <p className="font-bold text-slate-800">Daftar Transaksi</p>
          <p className="text-xs font-semibold text-slate-500">{rows.length} transaksi</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3 text-right">Tagihan</th>
                <th className="px-4 py-3 text-right">Diterima</th>
                <th className="px-4 py-3 text-right">Tunggakan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-600" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400">Belum ada transaksi pada filter ini.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className={row.status === 'VOID' ? 'bg-red-50/30 text-slate-500' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-700">{tanggalPendek(row.tanggal)}</p>
                    <p className="text-[11px] text-slate-400">{tanggalWaktu(row.paid_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono font-extrabold text-slate-800">{nomorAntrian(row.nomor)}</p>
                    <p className="text-[11px] font-bold text-slate-400">{row.unit}</p>
                    {row.jenis_transaksi !== 'PENJUALAN' && <p className="mt-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-700">GRATIS</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{row.nama_santri}</p>
                    <p className="text-xs text-slate-500">
                      {row.jenis_transaksi === 'GRATIS_GURU' ? 'Guru' : row.nis || '-'} · {row.kelas_nama || row.marhalah_nama || row.penerima_type || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{row.jenis_transaksi === 'PENJUALAN' ? rupiah(row.total_tagihan) : rupiah(row.harga_modal_total)}</td>
                  <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{row.jenis_transaksi === 'PENJUALAN' ? rupiah(row.total_bayar) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">{rupiah(row.sisa_tunggakan)}</td>
                  <td className="px-4 py-3">
                    {row.status === 'VOID' ? (
                      <div>
                        <span className="rounded bg-red-100 px-2 py-1 text-[11px] font-extrabold text-red-700">VOID</span>
                        <p className="mt-1 line-clamp-1 text-xs text-red-700">{row.void_reason}</p>
                      </div>
                    ) : (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-extrabold text-emerald-700">SELESAI</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.cashier_name || '-'}</p>
                    {row.status === 'VOID' && <p className="text-[11px] text-red-600">Void: {row.voided_by_name || '-'}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openDetail(row.id)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" title="Detail">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openVoid(row)}
                        disabled={row.status === 'VOID'}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                        title="Void transaksi"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-800">Detail Transaksi {nomorAntrian(detail.nomor)}</h2>
                <p className="text-xs text-slate-500">{detail.nama_santri} · {tanggalWaktu(detail.paid_at)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoBox label={detail.jenis_transaksi === 'PENJUALAN' ? 'Tagihan' : 'Modal'} value={rupiah(detail.jenis_transaksi === 'PENJUALAN' ? detail.total_tagihan : detail.harga_modal_total)} />
                <InfoBox label="Diterima" value={detail.jenis_transaksi === 'PENJUALAN' ? rupiah(detail.total_bayar) : '-'} tone="text-emerald-700" />
                <InfoBox label="Tunggakan" value={rupiah(detail.sisa_tunggakan)} tone="text-amber-700" />
                <InfoBox label="Kembalian" value={rupiah(detail.sisa_kembalian)} tone="text-blue-700" />
              </div>
              {detail.status === 'VOID' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-extrabold">Transaksi sudah di-void</p>
                  <p>{detail.void_reason}</p>
                  <p className="mt-1 text-xs">Oleh {detail.voided_by_name || '-'} pada {tanggalWaktu(detail.voided_at)}</p>
                </div>
              )}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Kitab</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">{detail.jenis_transaksi === 'PENJUALAN' ? 'Harga' : 'Modal'}</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2">Serah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-bold text-slate-800">{item.nama_kitab}</td>
                        <td className="px-3 py-2 text-center font-mono">{item.qty}</td>
                        <td className="px-3 py-2 text-right font-mono">{rupiah(detail.jenis_transaksi === 'PENJUALAN' ? item.harga_jual : item.harga_modal)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{rupiah(detail.jenis_transaksi === 'PENJUALAN' ? item.subtotal : item.modal_subtotal)}</td>
                        <td className="px-3 py-2 text-xs font-bold text-slate-500">
                          {item.masuk_pesanan ? 'Pesanan' : item.status_serah === 'BATAL' ? 'Batal' : 'Diserahkan'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="border-b bg-red-50 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-red-900">
                <AlertTriangle className="h-5 w-5" /> Void Transaksi {nomorAntrian(voidTarget.nomor)}
              </h2>
              <p className="mt-1 text-sm text-red-700">{voidTarget.nama_santri} · {rupiah(voidTarget.total_bayar)}</p>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-600">
                Transaksi akan ditandai VOID dan stok kitab yang sudah diserahkan akan dikembalikan.
              </p>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500">Alasan Void</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Contoh: salah santri, nominal salah, transaksi dobel..."
                  autoFocus
                />
              </div>
              <div className="flex flex-col justify-end gap-2 border-t pt-3 sm:flex-row">
                <button onClick={() => setVoidTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button onClick={submitVoid} disabled={voiding} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  {voiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Void Transaksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBox({ label, value, tone = 'text-slate-800' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className={`font-mono text-sm font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}
