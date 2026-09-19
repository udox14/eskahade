'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getPenyaluranPageData, type PenyaluranPageData } from './actions'
import type {
  FinanceDistributionRecipientType,
} from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import CatatPenyaluranModal from './catat-penyaluran-modal'
import RekeningModal from './rekening-modal'
import BuktiPenyaluranModal from './bukti-penyaluran-modal'
import {
  Bank,
  CheckCircle,
  CurrencyCircleDollar,
  HandCoins,
  Users,
  Printer,
  CalendarBlank,
  MagnifyingGlass,
  ArrowRight,
} from '@phosphor-icons/react'

interface PenyaluranContentProps {
  initialData: PenyaluranPageData
}

export default function PenyaluranContent({ initialData }: PenyaluranContentProps) {
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<PenyaluranPageData>(initialData)
  const [activeTab, setActiveTab] = useState<FinanceDistributionRecipientType | 'RIWAYAT'>(
    initialData.activeTab
  )
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.selectedPeriod)
  const [historySearch, setHistorySearch] = useState<string>('')

  // Modal states
  const [disburseModalTarget, setDisburseModalTarget] = useState<{
    recipientType: FinanceDistributionRecipientType
    recipientId?: string | null
    recipientName: string
    itemType: string
    itemLabel: string
    period: string
    periodLabel: string
    availableAmount: number
  } | null>(null)

  const [rekeningModalProvider, setRekeningModalProvider] = useState<{
    id: string
    name: string
    type: 'Makan' | 'Cuci'
  } | null>(null)

  const [receiptDistributionId, setReceiptDistributionId] = useState<string | null>(null)

  const canDisburse = data.userPermissions.canDisburse

  const refreshData = (
    tab = activeTab,
    period = selectedPeriod,
    search = historySearch,
    page = 1
  ) => {
    startTransition(async () => {
      try {
        const next = await getPenyaluranPageData({
          tab,
          period,
          historySearch: search,
          historyPage: page,
        })
        setData(next)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal memuat data penyaluran.')
      }
    })
  }

  const handleTabChange = (tab: FinanceDistributionRecipientType | 'RIWAYAT') => {
    setActiveTab(tab)
    refreshData(tab, selectedPeriod, historySearch, 1)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    refreshData(activeTab, period, historySearch, 1)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    refreshData(activeTab, selectedPeriod, historySearch, 1)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <HandCoins size={28} className="text-emerald-600" weight="duotone" />
            Penyaluran Dana
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pengelolaan & penyaluran dana hak Bendahara Pesantren, Katering, dan Laundry.
          </p>
        </div>

        {/* Filter Periode */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <CalendarBlank size={16} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Periode:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              disabled={isPending}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {data.periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Dana Masuk */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dana Masuk Periode Ini
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <CurrencyCircleDollar size={20} weight="fill" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            Rp {data.summary.totalDanaMasuk.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Users size={14} className="text-slate-400" />
            {data.summary.totalSantriSudahBayar} santri telah membayar
          </div>
        </div>

        {/* Card 2: Siap Disalurkan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Siap Disalurkan
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <HandCoins size={20} weight="fill" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            Rp {data.summary.totalSiapDisalurkan.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            Tersedia untuk disalurkan ke penerima
          </div>
        </div>

        {/* Card 3: Sudah Disalurkan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sudah Disalurkan
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <CheckCircle size={20} weight="fill" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            Rp {data.summary.totalSudahDisalurkan.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-500 mt-1">Akumulasi penyaluran tercatat</div>
        </div>

        {/* Card 4: Status Santri */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Santri Terdaftar
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Users size={20} weight="fill" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {data.summary.totalSantriTerdaftar}{' '}
            <span className="text-xs font-normal text-slate-500">santri</span>
          </div>
          <div className="text-xs text-amber-700 mt-1 font-medium">
            {data.summary.totalSantriBelumBayar} santri belum lunas
          </div>
        </div>
      </div>

      {/* Tabs Navigasi */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex space-x-1 sm:space-x-2">
          {(
            [
              { id: 'BENDAHARA', label: 'Bendahara Pesantren' },
              { id: 'KATERING', label: 'Katering (Makan)' },
              { id: 'LAUNDRY', label: 'Laundry (Cuci)' },
              { id: 'RIWAYAT', label: 'Riwayat Penyaluran' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`py-3 px-4 text-xs font-bold transition border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'RIWAYAT' && (
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center gap-2 pb-2">
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari transaksi / penerima..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-emerald-500 w-52"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition"
            >
              Cari
            </button>
          </form>
        )}
      </div>

      {/* TAB CONTENT: BENDAHARA */}
      {activeTab === 'BENDAHARA' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Pos Penyaluran ke Bendahara Pesantren</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Alokasi pembayaran SPP, USPP, EHB, Ekstrakurikuler, dan Kesehatan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Pos Finansial</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4 text-center">Santri Bayar / Terdaftar</th>
                  <th className="py-3 px-4 text-right">Dana Masuk</th>
                  <th className="py-3 px-4 text-right">Sudah Disalurkan</th>
                  <th className="py-3 px-4 text-right">Siap Salur</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.bendaharaRows.map((row) => (
                  <tr key={row.itemType} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800">{row.itemLabel}</span>
                      <span className="block text-[11px] text-slate-400 font-mono">{row.itemType}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{row.period}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-slate-800">{row.santriSudahBayar}</span>
                      <span className="text-slate-400"> / {row.santriTerdaftar}</span>
                      {row.santriBelumBayar > 0 && (
                        <span className="block text-[10px] text-amber-600 font-medium">
                          ({row.santriBelumBayar} belum)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                      Rp {row.totalDanaMasuk.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600">
                      Rp {row.sudahDisalurkan.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`font-bold ${
                          row.sisaSiapSalur > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        Rp {row.sisaSiapSalur.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {canDisburse && row.sisaSiapSalur > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDisburseModalTarget({
                              recipientType: 'BENDAHARA',
                              recipientId: null,
                              recipientName: 'Bendahara Pesantren',
                              itemType: row.itemType,
                              itemLabel: row.itemLabel,
                              period: row.period,
                              periodLabel: row.period,
                              availableAmount: row.sisaSiapSalur,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 transition shadow-xs"
                        >
                          Salurkan Dana
                          <ArrowRight size={12} />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          {row.sisaSiapSalur === 0 ? 'Tersalurkan Penuh' : 'Lihat Saja'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: KATERING & LAUNDRY */}
      {(activeTab === 'KATERING' || activeTab === 'LAUNDRY') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">
                Daftar Penyedia {activeTab === 'KATERING' ? 'Katering (Makan)' : 'Laundry (Cuci)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hak penyaluran dihitung dari alokasi santri aktif pada periode {selectedPeriod}.
              </p>
            </div>
          </div>

          {data.providerRows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Tidak ada data penyedia jasa yang terdaftar di master jasa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Nama Penyedia</th>
                    <th className="py-3 px-4 text-center">Santri Terdaftar</th>
                    <th className="py-3 px-4 text-center">Sudah / Belum Bayar</th>
                    <th className="py-3 px-4 text-right">Dana Masuk</th>
                    <th className="py-3 px-4 text-right">Sudah Disalurkan</th>
                    <th className="py-3 px-4 text-right">Sisa Siap Salur</th>
                    <th className="py-3 px-4">Rekening Utama</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.providerRows.map((p) => (
                    <tr key={p.providerId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{p.providerName}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {p.santriTerdaftar} santri
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-emerald-700">{p.santriSudahBayar}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="font-medium text-amber-700">{p.santriBelumBayar}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                        Rp {p.totalDanaMasuk.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        Rp {p.sudahDisalurkan.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-bold ${
                            p.sisaSiapSalur > 0 ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          Rp {p.sisaSiapSalur.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.primaryAccount ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {p.primaryAccount.bank_name} - {p.primaryAccount.account_number}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              a.n {p.primaryAccount.account_holder}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum diatur</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setRekeningModalProvider({
                                id: p.providerId,
                                name: p.providerName,
                                type: p.providerType,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 transition"
                          >
                            Rekening ({p.accountsCount})
                          </button>

                          {canDisburse && p.sisaSiapSalur > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDisburseModalTarget({
                                  recipientType: activeTab as 'KATERING' | 'LAUNDRY',
                                  recipientId: p.providerId,
                                  recipientName: p.providerName,
                                  itemType: activeTab === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI',
                                  itemLabel:
                                    activeTab === 'KATERING'
                                      ? 'Uang Makan (Katering)'
                                      : 'Uang Nyuci (Laundry)',
                                  period: selectedPeriod,
                                  periodLabel: selectedPeriod,
                                  availableAmount: p.sisaSiapSalur,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition shadow-xs"
                            >
                              Salurkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RIWAYAT PENYALURAN */}
      {activeTab === 'RIWAYAT' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Riwayat Transaksi Penyaluran</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Seluruh histori pengeluaran dana ke Bendahara, Katering, dan Laundry beserta bukti kuitansi.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total {data.history.totalItems} transaksi
            </div>
          </div>

          {data.history.items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada riwayat penyaluran dana yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">No. Transaksi</th>
                    <th className="py-3 px-4">Tanggal & Waktu</th>
                    <th className="py-3 px-4">Penerima</th>
                    <th className="py-3 px-4">Pos Item & Periode</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                    <th className="py-3 px-4">Petugas</th>
                    <th className="py-3 px-4 text-center">Kuitansi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.history.items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {row.distribution_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {new Date(row.transferred_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{row.recipient_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">
                          {FINANCE_ITEM_LABELS[row.item_type as FinanceItemType] || row.item_type}
                        </span>
                        <span className="block text-[11px] text-slate-500">Periode: {row.period}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            row.method === 'TRANSFER'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-amber-50 text-amber-800 border border-amber-100'
                          }`}
                        >
                          {row.method === 'TRANSFER' ? <Bank size={12} /> : <HandCoins size={12} />}
                          {row.method === 'TRANSFER' ? 'Transfer' : 'Tunai'}
                        </span>
                        {row.destination_bank && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {row.destination_bank} ({row.destination_account})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                        Rp {row.total_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{row.operator_name}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReceiptDistributionId(row.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 transition"
                          >
                            <Printer size={13} />
                            Cetak
                          </button>
                          {row.proof_attachment_url && (
                            <a
                              href={row.proof_attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition"
                              title="Lihat Bukti Transfer Eksternal"
                            >
                              Bukti &rarr;
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.history.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Halaman {data.history.page} dari {data.history.totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={data.history.page <= 1 || isPending}
                  onClick={() =>
                    refreshData(activeTab, selectedPeriod, historySearch, data.history.page - 1)
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={data.history.page >= data.history.totalPages || isPending}
                  onClick={() =>
                    refreshData(activeTab, selectedPeriod, historySearch, data.history.page + 1)
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CatatPenyaluranModal
        isOpen={!!disburseModalTarget}
        onClose={() => setDisburseModalTarget(null)}
        onSuccess={() => refreshData()}
        target={disburseModalTarget}
      />

      <RekeningModal
        isOpen={!!rekeningModalProvider}
        onClose={() => setRekeningModalProvider(null)}
        onUpdated={() => refreshData()}
        provider={rekeningModalProvider}
        canManage={canDisburse}
      />

      <BuktiPenyaluranModal
        isOpen={!!receiptDistributionId}
        onClose={() => setReceiptDistributionId(null)}
        distributionId={receiptDistributionId}
      />
    </div>
  )
}
