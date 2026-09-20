'use client'

import React, { useEffect, useState, useTransition } from 'react'
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  Utensils,
  Receipt,
  Info,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import {
  getStudentPaymentDetail,
  type StudentPaymentDetailResponse,
  type ObligationBreakdownItem,
} from './actions'
import type { FinanceObligationStatus } from '@/lib/finance/types'

interface StatusPembayaranDetailDrawerProps {
  santriId: string | null
  selectedPeriod: string
  onClose: () => void
  onRecordPayment?: (santriId: string) => void
}

type DrilldownTab = 'BULANAN' | 'TAHUNAN' | 'USPP' | 'TUNGGAKAN' | 'RIWAYAT'

/**
 * Format nominal Rupiah konsisten sesuai UI_UX_GUIDELINES:
 * "Rp150.000" (tanpa spasi setelah Rp, tanpa desimal ,00)
 */
function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

export function StatusPembayaranDetailDrawer({
  santriId,
  selectedPeriod,
  onClose,
  onRecordPayment,
}: StatusPembayaranDetailDrawerProps) {
  const [detail, setDetail] = useState<StudentPaymentDetailResponse | null>(null)
  const [activeTab, setActiveTab] = useState<DrilldownTab>('BULANAN')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!santriId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [santriId, onClose])

  // Fetch student detail when santriId changes
  useEffect(() => {
    if (!santriId) return

    let cancelled = false
    startTransition(async () => {
      try {
        const res = await getStudentPaymentDetail(santriId)
        if (!cancelled) {
          setDetail(res)
          setErrorMessage(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Gagal memuat rincian kewajiban santri.'
          setErrorMessage(msg)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [santriId])

  if (!santriId) return null

  const renderStatusBadge = (status: FinanceObligationStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3 w-3" />
            Lunas
          </span>
        )
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-3 w-3" />
            Cicilan
          </span>
        )
      case 'EXEMPTED':
        return (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20">
            Bebas
          </span>
        )
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            Belum Lunas
          </span>
        )
    }
  }

  const renderObligationCard = (item: ObligationBreakdownItem) => {
    return (
      <div
        key={item.id}
        className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{item.itemLabel}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Periode: <span className="font-medium text-slate-700">{item.periodLabel}</span>
            </p>
            {item.providerName && (
              <p className="text-xs text-slate-500 mt-0.5">
                Vendor: <span className="font-medium text-slate-700">{item.providerName}</span>
              </p>
            )}
          </div>
          <div>{renderStatusBadge(item.status)}</div>
        </div>

        {/* Breakdown angka */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block">Tarif Tagihan</span>
            <span className="font-mono font-medium text-slate-700">{formatRupiah(item.amountExpected)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Sudah Dibayar</span>
            <span className="font-mono font-medium text-emerald-600">{formatRupiah(item.amountPaid)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Pembebasan</span>
            <span className="font-mono font-medium text-sky-600">
              {item.amountExempted > 0 ? formatRupiah(item.amountExempted) : '-'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Sisa Tagihan</span>
            <span className="font-mono font-bold text-slate-900">{formatRupiah(item.remaining)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      aria-labelledby="drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop click dismiss */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div className="w-screen max-w-xl md:max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full pointer-events-auto animate-in slide-in-from-right duration-300">
          {/* 1. DRAWER HEADER */}
          <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            {detail ? (
              <div className="flex items-center gap-3.5 min-w-0">
                <SantriPhotoAvatar
                  name={detail.santri.namaLengkap}
                  size="md"
                  clickable={false}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 id="drawer-title" className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                      {detail.santri.namaLengkap}
                    </h3>
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    NIS {detail.santri.nis} · {detail.santri.asrama || 'Non-Asrama'}{detail.santri.kamar ? ` / ${detail.santri.kamar}` : ''}
                    {detail.santri.tahunMasuk ? ` · Angkatan ${detail.santri.tahunMasuk}` : ''}
                    {selectedPeriod ? ` · Periode ${selectedPeriod}` : ''}
                  </p>
                  {(detail.santri.tempatMakan || detail.santri.tempatMencuci) && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      {detail.santri.tempatMakan && (
                        <span className="flex items-center gap-1">
                          <Utensils className="h-3 w-3 text-slate-400" />
                          {detail.santri.tempatMakan}
                        </span>
                      )}
                      {detail.santri.tempatMencuci && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-400" />
                          {detail.santri.tempatMencuci}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-pulse flex items-center gap-3">
                <div className="w-12 h-14 bg-slate-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-5 w-44 bg-slate-200 rounded" />
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Tutup detail"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 2. SUMMARY STRIP (KPI RINGKAS) */}
          {detail && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Total Tagihan</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {formatRupiah(detail.summary.totalTagihan)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sudah Dibayar</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {formatRupiah(detail.summary.totalDibayar)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Pembebasan</span>
                <span className="font-mono font-bold text-sky-600 text-sm">
                  {detail.summary.totalPotongan > 0 ? formatRupiah(detail.summary.totalPotongan) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sisa Kewajiban</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatRupiah(detail.summary.grandTotalTunggakan)}
                </span>
              </div>
            </div>
          )}

          {/* 3. DRILLDOWN TABS */}
          <div className="px-6 border-b border-slate-200 bg-white">
            <nav className="-mb-px flex space-x-6 overflow-x-auto text-xs font-semibold" aria-label="Drilldown Tabs">
              {[
                { id: 'BULANAN', label: 'Bulanan', count: detail?.drilldown.bulanan.length },
                { id: 'TAHUNAN', label: 'Tahunan', count: detail?.drilldown.tahunan.length },
                { id: 'USPP', label: 'USPP', count: detail?.drilldown.usppInstallments?.length },
                {
                  id: 'TUNGGAKAN',
                  label: 'Tunggakan',
                  count: (detail?.drilldown.tunggakanModern.length ?? 0) + (detail?.drilldown.tunggakanLegacy.length ?? 0),
                  alert: (detail?.summary.grandTotalTunggakan ?? 0) > 0,
                },
                { id: 'RIWAYAT', label: 'Riwayat Bayar', count: detail?.drilldown.riwayatBayar.length },
              ].map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as DrilldownTab)}
                    className={`whitespace-nowrap border-b-2 py-3 px-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'border-emerald-600 font-semibold text-emerald-700'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          tab.alert
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 4. SCROLLABLE TAB CONTENT */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/30">
            {/* Error State */}
            {errorMessage && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Loading Skeleton */}
            {isPending && (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-100 rounded" />
                    <div className="h-8 w-full bg-slate-50 rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Content saat loaded */}
            {!isPending && detail && (
              <>
                {/* TAB 1: BULANAN */}
                {activeTab === 'BULANAN' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Tagihan Bulanan Santri (SPP, Makan, Nyuci)</span>
                      <span>{detail.drilldown.bulanan.length} Item</span>
                    </div>

                    {detail.drilldown.bulanan.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                        Belum ada data kewajiban bulanan untuk santri ini.
                      </div>
                    ) : (
                      detail.drilldown.bulanan.map(renderObligationCard)
                    )}
                  </div>
                )}

                {/* TAB 2: TAHUNAN */}
                {activeTab === 'TAHUNAN' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Iuran Tahunan (EHB, Ekstrakurikuler, Kesehatan)</span>
                      <span>{detail.drilldown.tahunan.length} Item</span>
                    </div>

                    {detail.drilldown.tahunan.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                        Belum ada data kewajiban tahunan untuk santri ini.
                      </div>
                    ) : (
                      detail.drilldown.tahunan.map(renderObligationCard)
                    )}
                  </div>
                )}

                {/* TAB 3: USPP */}
                {activeTab === 'USPP' && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Uang Pangkal Bangunan (USPP)</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Kewajiban satu kali sepanjang santri menempuh pendidikan (LIFETIME).
                          </p>
                        </div>
                        {detail.drilldown.uspp ? (
                          renderStatusBadge(detail.drilldown.uspp.status)
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Belum Ada
                          </span>
                        )}
                      </div>

                      {detail.drilldown.uspp ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block">Total Tarif</span>
                            <span className="font-mono font-semibold text-slate-800">
                              {formatRupiah(detail.drilldown.uspp.amountExpected)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Terbayar</span>
                            <span className="font-mono font-semibold text-emerald-600">
                              {formatRupiah(detail.drilldown.uspp.amountPaid)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Pembebasan</span>
                            <span className="font-mono font-semibold text-sky-600">
                              {detail.drilldown.uspp.amountExempted > 0
                                ? formatRupiah(detail.drilldown.uspp.amountExempted)
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Sisa Cicilan</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRupiah(detail.drilldown.uspp.remaining)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Tarif USPP belum dimaterialisasikan untuk santri ini.
                        </p>
                      )}

                      <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 flex items-start gap-2">
                        <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          USPP dapat diangsur secara bertahap selama masa pendidikan santri sesuai aturan angkatan masuk.
                        </span>
                      </div>
                    </div>

                    {/* Histori Cicilan Khusus USPP */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <h5 className="font-semibold uppercase tracking-wider text-slate-700">
                          Histori Cicilan USPP
                        </h5>
                        <span>{detail.drilldown.usppInstallments.length} Pembayaran</span>
                      </div>

                      {detail.drilldown.usppInstallments.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                          Belum ada catatan pembayaran cicilan USPP untuk santri ini.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                          <ul className="divide-y divide-slate-100 text-xs">
                            {detail.drilldown.usppInstallments.map((inst) => (
                              <li key={inst.id} className="p-3.5 hover:bg-slate-50/80 transition flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {inst.paymentNumber}
                                    </span>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 font-medium">
                                      {inst.channel} ({inst.method})
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">
                                    {formatDateDisplay(inst.paidAt)}
                                    {inst.externalReference ? ` · Ref: ${inst.externalReference}` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-emerald-600 block text-sm">
                                    {formatRupiah(inst.amount)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Cicilan USPP</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: TUNGGAKAN */}
                {activeTab === 'TUNGGAKAN' && (
                  <div className="space-y-4">
                    {/* Ringkasan Tunggakan */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold">Akumulasi Seluruh Tunggakan Santri</p>
                        <p className="text-amber-800 leading-relaxed">
                          Total tunggakan keseluruhan: <strong className="font-mono">{formatRupiah(detail.summary.grandTotalTunggakan)}</strong> (termasuk tagihan aktif berjalan dan tunggakan pra-cutover).
                        </p>
                      </div>
                    </div>

                    {/* 1. Tunggakan Sistem Baru */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Kewajiban Sistem Baru yang Belum Lunas ({detail.drilldown.tunggakanModern.length})
                      </h5>
                      {detail.drilldown.tunggakanModern.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                          Tidak ada kewajiban sistem baru yang menunggak.
                        </div>
                      ) : (
                        detail.drilldown.tunggakanModern.map(renderObligationCard)
                      )}
                    </div>

                    {/* 2. Tunggakan SPP Pra-Cutover */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <span>Tunggakan SPP Pra-Cutover (&lt; Juli 2026)</span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] text-amber-800 font-semibold">
                            Coexistence
                          </span>
                        </h5>
                        <span className="text-xs font-mono font-bold text-amber-900">
                          {formatRupiah(detail.summary.totalLegacyTunggakan)}
                        </span>
                      </div>

                      {detail.drilldown.tunggakanLegacy.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                          Tidak ada catatan tunggakan SPP historis sebelum cutover.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-200/80 bg-white overflow-hidden shadow-sm">
                          <div className="p-3 bg-amber-50/40 border-b border-amber-100 text-[11px] text-amber-800">
                            Data di bawah ini tercatat pada sistem legacy <code>spp_tunggakan_historis</code> dan dimonitor melalui coexistence adapter tanpa membuat duplikasi kewajiban di sistem baru.
                          </div>
                          <ul className="divide-y divide-slate-100 text-xs">
                            {detail.drilldown.tunggakanLegacy.map((leg) => (
                              <li key={leg.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-slate-800 block">{leg.monthLabel}</span>
                                  <span className="text-[11px] text-slate-400">ID: {leg.id}</span>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <span className="font-mono font-bold text-amber-700 block">
                                    {formatRupiah(leg.nominalTagihan)}
                                  </span>
                                  <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                                    Belum Lunas
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 5: RIWAYAT BAYAR (PAYMENT-DRIVEN) */}
                {activeTab === 'RIWAYAT' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Catatan Pembayaran Diterima</span>
                      <span>{detail.drilldown.riwayatBayar.length} Pembayaran</span>
                    </div>

                    {detail.drilldown.riwayatBayar.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-1">
                        <Receipt className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                        <p className="font-medium text-slate-700">Belum ada riwayat pembayaran yang tercatat.</p>
                        <p className="text-slate-400">Pembayaran melalui Duitku atau kasir loket akan muncul di sini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detail.drilldown.riwayatBayar.map((pay) => (
                          <div
                            key={pay.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                          >
                            {/* Header Pembayaran */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 text-sm">
                                    {pay.paymentNumber}
                                  </span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                    {pay.channel} ({pay.method})
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400">
                                  {formatDateDisplay(pay.paidAt)}
                                  {pay.externalReference ? ` · Ref: ${pay.externalReference}` : ''}
                                </p>
                              </div>

                              <div className="text-right space-y-1">
                                <span className="font-mono font-bold text-slate-900 text-sm block">
                                  {formatRupiah(pay.grossAmount)}
                                </span>
                                <div>
                                  {pay.allocationStatus === 'ALLOCATED' && (
                                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                      {pay.allocationStatusLabel}
                                    </span>
                                  )}
                                  {pay.allocationStatus === 'PARTIALLY_ALLOCATED' && (
                                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                      {pay.allocationStatusLabel}
                                    </span>
                                  )}
                                  {pay.allocationStatus === 'UNALLOCATED' && (
                                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                      {pay.allocationStatusLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Rincian Alokasi Terdistribusi */}
                            {pay.allocations.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                                <span className="text-slate-400 text-[11px] font-medium block">
                                  Alokasi Pos Kewajiban:
                                </span>
                                <div className="space-y-1">
                                  {pay.allocations.map((alc) => (
                                    <div key={alc.id} className="flex items-center justify-between text-slate-700">
                                      <span>{alc.itemLabel}</span>
                                      <span className="font-mono font-medium text-emerald-700">
                                        {formatRupiah(alc.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Rincian Koreksi / Penyesuaian Terkait jika ada */}
                            {pay.corrections && pay.corrections.length > 0 && (
                              <div className="pt-2 border-t border-rose-100 space-y-1 text-xs">
                                <span className="text-rose-600 text-[11px] font-medium flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-rose-500" />
                                  Koreksi / Penyesuaian Terkait:
                                </span>
                                <div className="space-y-1">
                                  {pay.corrections.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between text-rose-700 bg-rose-50/60 px-2 py-1 rounded">
                                      <span className="truncate mr-2">
                                        <span className="font-semibold">{c.correctionNumber}</span> ({c.correctionType})
                                        {c.reason ? ` · ${c.reason}` : ''}
                                      </span>
                                      <span className="font-mono font-semibold text-rose-700 shrink-0">
                                        -{formatRupiah(c.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Peringatan Remainder Unallocated / Perlu Rekonsiliasi */}
                            {pay.unallocatedAmount > 0 && (
                              <div className="rounded-lg bg-amber-50/80 border border-amber-200/70 p-2.5 text-xs text-amber-900 flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-amber-900 flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                    <span>
                                      {pay.allocationStatus === 'UNALLOCATED'
                                        ? 'Pembayaran Belum Teralokasi'
                                        : 'Sisa Belum Teralokasi'}
                                    </span>
                                  </span>
                                  <p className="text-[11px] text-amber-800">
                                    Nominal ini belum dialokasikan ke pos manapun dan memerlukan rekonsiliasi.
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-amber-900 text-xs shrink-0">
                                  {formatRupiah(pay.unallocatedAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 5. DRAWER FOOTER */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {detail?.userPermissions?.canRecordPayment
                  ? 'Pencatatan pembayaran tunai aktif'
                  : 'Mode Tinjauan Finansial (Read-Only)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              {detail?.userPermissions?.canRecordPayment && detail.santri && onRecordPayment && (
                <button
                  type="button"
                  onClick={() => onRecordPayment(detail.santri.id)}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 font-medium text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Catat Pembayaran Tunai</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
