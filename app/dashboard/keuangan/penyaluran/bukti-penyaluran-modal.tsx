'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { getDistributionReceiptAction } from './actions'
import type { DistributionDetailWithItems } from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import {
  Printer,
  X,
  CheckCircle,
  Bank,
  Money,
} from '@phosphor-icons/react'

interface BuktiPenyaluranModalProps {
  isOpen: boolean
  onClose: () => void
  distributionId: string | null
}

export default function BuktiPenyaluranModal({
  isOpen,
  onClose,
  distributionId,
}: BuktiPenyaluranModalProps) {
  const [isPending] = useTransition()
  const [data, setData] = useState<DistributionDetailWithItems | null>(null)

  useEffect(() => {
    if (!isOpen || !distributionId) return
    let active = true
    getDistributionReceiptAction(distributionId)
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err: unknown) => {
        if (active) toast.error(err instanceof Error ? err.message : 'Gagal memuat bukti penyaluran.')
      })
    return () => {
      active = false
    }
  }, [isOpen, distributionId])

  if (!isOpen || !distributionId) return null

  const handlePrint = () => {
    window.print()
  }

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} weight="fill" className="text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-base">Bukti Penyaluran Dana</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-xs"
            >
              <Printer size={15} />
              Cetak Kuitansi
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt Slip Body (Print Ready) */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-slate-800" id="printable-receipt">
          {isPending || !data ? (
            <div className="text-center py-12 text-slate-400 text-sm">Memuat rincian kuitansi...</div>
          ) : (
            <>
              {/* Slip Kop */}
              <div className="border-b-2 border-slate-900 pb-4 text-center">
                <h2 className="text-lg font-black uppercase tracking-wider text-slate-950">
                  Pesantren Sukahideng
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Sistem Administrasi & Keuangan Terpadu Pesantren
                </p>
                <div className="inline-block mt-2 px-3 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-widest">
                  Tanda Terima Penyaluran Dana
                </div>
              </div>

              {/* Reference Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Nomor Transaksi
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {data.distribution_number}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Waktu Penyaluran
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatDateTime(data.transferred_at)}
                  </span>
                </div>
              </div>

              {/* Detail Transaksi Box */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="px-4 py-2.5 flex justify-between bg-slate-50/50">
                  <span className="text-slate-500 font-medium">Pihak Penerima Dana</span>
                  <span className="font-bold text-slate-900 text-sm">{data.recipient_name}</span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-500 font-medium">Pos Item Finansial</span>
                  <span className="font-semibold text-slate-800">
                    {FINANCE_ITEM_LABELS[data.item_type as FinanceItemType] || data.item_type}
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-500 font-medium">Periode Tagihan</span>
                  <span className="font-medium text-slate-800">{data.period}</span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-500 font-medium">Metode Penyaluran</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    {data.method === 'TRANSFER' ? (
                      <>
                        <Bank size={14} className="text-slate-600" />
                        Transfer Bank
                      </>
                    ) : (
                      <>
                        <Money size={14} className="text-slate-600" />
                        Tunai (Cash)
                      </>
                    )}
                  </span>
                </div>
                {data.method === 'TRANSFER' && (
                  <div className="px-4 py-2.5 flex justify-between bg-slate-50/30">
                    <span className="text-slate-500 font-medium">Rekening Tujuan</span>
                    <span className="font-medium text-slate-900 text-right">
                      {data.destination_bank} &bull; {data.destination_account}
                      <span className="block text-[11px] text-slate-500">
                        a.n {data.account_holder_name}
                      </span>
                    </span>
                  </div>
                )}
                {data.notes && (
                  <div className="px-4 py-2 flex justify-between bg-slate-50/20">
                    <span className="text-slate-500 font-medium">Catatan</span>
                    <span className="text-slate-700 italic text-right max-w-xs">{data.notes}</span>
                  </div>
                )}
                {data.proof_attachment_url && (
                  <div className="px-4 py-2.5 flex justify-between items-center bg-blue-50/40">
                    <span className="text-slate-600 font-medium">Bukti Transfer Eksternal</span>
                    <a
                      href={data.proof_attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      Buka Bukti / Struk Transfer &rarr;
                    </a>
                  </div>
                )}
                <div className="px-4 py-3 flex justify-between items-center bg-emerald-50/40">
                  <span className="font-bold text-slate-900 text-sm">Total Dana Disalurkan</span>
                  <span className="font-black text-emerald-700 text-lg">
                    Rp {data.total_amount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Rincian Santri Terkait */}
              {data.items && data.items.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Rincian Alokasi Santri ({data.items.length} transaksi)
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg text-xs divide-y divide-slate-100">
                    {data.items.map((item, idx) => (
                      <div key={item.id} className="px-3 py-1.5 flex justify-between items-center hover:bg-slate-50">
                        <span className="text-slate-700">
                          {idx + 1}. <span className="font-semibold">{item.santri_name}</span> ({item.santri_nis})
                        </span>
                        <span className="font-mono font-medium text-slate-900">
                          Rp {item.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature Blocks */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <p className="text-slate-500">Penerima Dana,</p>
                  <div className="h-16 flex items-end justify-center">
                    <div className="border-b border-slate-400 w-44"></div>
                  </div>
                  <p className="font-bold text-slate-800 mt-1">{data.recipient_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Petugas / Bendahara,</p>
                  <div className="h-16 flex items-end justify-center">
                    <div className="border-b border-slate-400 w-44"></div>
                  </div>
                  <p className="font-bold text-slate-800 mt-1">{data.operator_name}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer (Hidden on Print) */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
