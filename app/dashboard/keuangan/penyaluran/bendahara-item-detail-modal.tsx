'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import {
  X,
  MagnifyingGlass,
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  User,
  CheckCircle,
  Clock,
  Wallet,
} from '@phosphor-icons/react'
import { getBendaharaStudentsByItemAction } from './actions'
import type { BendaharaItemStudentsResult } from '@/lib/finance/distribution-types'

export interface BendaharaDetailTarget {
  key: string
  itemType: string
  itemLabel: string
  period: string
  initialStatus?: 'ALL' | 'BELUM_BAYAR' | 'SUDAH_BAYAR'
}

interface BendaharaItemDetailModalProps {
  isOpen: boolean
  onClose: () => void
  target: BendaharaDetailTarget | null
}

export default function BendaharaItemDetailModal({
  isOpen,
  onClose,
  target,
}: BendaharaItemDetailModalProps) {
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<BendaharaItemStudentsResult | null>(null)

  const [page, setPage] = useState<number>(1)
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  // Filter status awal mengikuti angka yang diklik pengguna. Komponen ini di-mount
  // ulang (via `key`) setiap kali target berubah, sehingga tidak butuh effect sinkronisasi.
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM_BAYAR' | 'SUDAH_BAYAR'>(
    target?.initialStatus ?? 'ALL'
  )

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadData = useCallback(() => {
    if (!target?.itemType || !target?.period) return

    startTransition(async () => {
      try {
        const res = await getBendaharaStudentsByItemAction({
          itemType: target.itemType,
          period: target.period,
          status: statusFilter,
          search: debouncedSearch,
          page,
          pageSize: 50,
        })
        setData(res)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal memuat rincian santri.')
      }
    })
  }, [target, statusFilter, debouncedSearch, page])

  useEffect(() => {
    if (isOpen && target) {
      loadData()
    }
  }, [isOpen, target, loadData])

  const handleModalClose = () => {
    setData(null)
    setPage(1)
    setSearch('')
    onClose()
  }

  if (!isOpen || !target) return null

  const items = data?.items || []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1
  const pageSize = data?.pageSize ?? 50
  const currentPage = data?.page ?? page

  const totalSisa = items.reduce((acc, item) => acc + item.remaining, 0)
  const formatRupiah = (val: number) => `Rp ${val.toLocaleString('id-ID')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Wallet size={22} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">{target.itemLabel}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {target.itemType}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rincian status pembayaran santri • Periode{' '}
                <span className="font-semibold text-slate-700">{target.period}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isPending}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
              title="Muat Ulang Data"
            >
              <ArrowClockwise size={18} className={isPending ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleModalClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Santri Ditampilkan</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">
              {totalCount}
              <span className="text-xs font-normal text-slate-400 ml-1">santri</span>
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">Sesuai filter yang aktif</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Sisa Tagihan Halaman Ini</span>
            <span className="text-lg font-bold text-amber-700 mt-0.5 block">{formatRupiah(totalSisa)}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Belum dibayar pada daftar di bawah</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Cakupan Data</span>
            <span className="text-[13px] font-semibold text-slate-700 mt-1 block">
              Santri berkewajiban saja
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Santri bebas tagihan tidak ditampilkan
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama santri / NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'BELUM_BAYAR' | 'SUDAH_BAYAR')
                setPage(1)
              }}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="BELUM_BAYAR">Belum Bayar</option>
              <option value="SUDAH_BAYAR">Sudah Bayar</option>
            </select>
          </div>
        </div>

        {/* Tabel */}
        <div className="flex-1 overflow-y-auto min-h-[280px]">
          {isPending && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <ArrowClockwise size={28} className="animate-spin text-emerald-500" />
              <span className="text-xs">Memuat rincian santri...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center px-4">
              <User size={36} className="text-slate-300 mb-2" weight="duotone" />
              <span className="text-sm font-semibold text-slate-600">Tidak ada santri ditemukan</span>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {search || statusFilter !== 'ALL'
                  ? 'Tidak ada santri yang cocok dengan filter atau kata kunci pencarian.'
                  : 'Belum ada kewajiban yang terbentuk untuk pos dan periode ini.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5 text-center w-12">No</th>
                  <th className="py-2.5 px-4">Santri</th>
                  <th className="py-2.5 px-3">Asrama / Kamar</th>
                  <th className="py-2.5 px-3">Kelas</th>
                  <th className="py-2.5 px-3 text-right">Kewajiban</th>
                  <th className="py-2.5 px-3 text-right">Terbayar</th>
                  <th className="py-2.5 px-3 text-right">Sisa</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {items.map((item, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <tr key={item.santriId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5 text-center text-slate-400 text-[11px]">{rowNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.namaLengkap}</div>
                        <div className="text-[10px] text-slate-400">NIS: {item.nis}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-700 font-medium">{item.asrama || '-'}</span>
                        {item.kamar && (
                          <span className="text-slate-400 text-[10px] block">Kamar {item.kamar}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{item.kelas || '-'}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">
                        {formatRupiah(item.amountExpected)}
                        {item.amountExempted > 0 && (
                          <span className="text-[10px] text-indigo-600 block">
                            bebas {formatRupiah(item.amountExempted)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                        {formatRupiah(item.amountPaid)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {formatRupiah(item.remaining)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {item.statusBayar === 'SUDAH_BAYAR' ? (
                          item.remaining <= 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle size={12} weight="fill" /> Lunas
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock size={12} weight="fill" /> Sebagian
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Belum Bayar
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Menampilkan{' '}
            <span className="font-semibold text-slate-800">
              {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>
            -
            <span className="font-semibold text-slate-800">
              {Math.min(currentPage * pageSize, totalCount)}
            </span>{' '}
            dari <span className="font-bold text-slate-900">{totalCount}</span> santri
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isPending}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Halaman Sebelumnya"
            >
              <CaretLeft size={14} weight="bold" />
            </button>
            <span className="px-2 text-xs font-semibold">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Halaman Selanjutnya"
            >
              <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
