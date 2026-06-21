'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import {
  Calendar,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { OperasionalPrintSheet } from '@/components/operasional/ledger-print-sheet'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type {
  OperasionalLedgerData,
  OperasionalPrintPreference,
  OperasionalScope,
  SaveOperasionalAlokasiPayload,
  SaveOperasionalTransaksiPayload,
} from '@/lib/operasional'
import {
  cancelBendaharaAlokasi,
  deleteBendaharaTransaksi,
  getBendaharaOperasionalPageData,
  postBendaharaAlokasi,
  saveBendaharaAlokasi,
  saveBendaharaPrintPrefs,
  saveBendaharaTransaksi,
} from './actions'

type BendaharaPageData = {
  scope: OperasionalScope
  activeUnitId: string | null
  dashboard: Array<{
    unit_id: string
    unit_name: string
    saldo_awal: number
    alokasi_bendahara: number
    pemasukan_lain: number
    pengeluaran: number
    penyesuaian: number
    saldo_akhir: number
    ada_bukti: number
    tanpa_bukti: number
  }>
  ledger: OperasionalLedgerData | null
  printPreferences: OperasionalPrintPreference | null
}

type AllocationForm = {
  id?: string
  unitId: string
  nominal: string
  catatan: string
}

type CorrectionForm = {
  id?: string
  tanggal: string
  kategori: string
  uraian: string
  nominal: string
  partnerName: string
  catatan: string
}

const DEFAULT_PREFS: OperasionalPrintPreference = {
  unit_id: '',
  report_type: 'bendahara',
  scope_key: '',
  slot1_label: '',
  slot1_nama: '',
  slot1_jabatan: '',
  slot2_label: '',
  slot2_nama: '',
  slot2_jabatan: '',
  slot3_label: '',
  slot3_nama: '',
  slot3_jabatan: '',
}

const BULAN_OPTIONS = [
  { value: 1, label: 'JANUARI' }, { value: 2, label: 'FEBRUARI' }, { value: 3, label: 'MARET' },
  { value: 4, label: 'APRIL' }, { value: 5, label: 'MEI' }, { value: 6, label: 'JUNI' },
  { value: 7, label: 'JULI' }, { value: 8, label: 'AGUSTUS' }, { value: 9, label: 'SEPTEMBER' },
  { value: 10, label: 'OKTOBER' }, { value: 11, label: 'NOVEMBER' }, { value: 12, label: 'DESEMBER' },
]

function getTodayValue() {
  return new Date().toISOString().slice(0, 10)
}

function makeAllocationForm(unitId = ''): AllocationForm {
  return { unitId, nominal: '', catatan: '' }
}

function makeCorrectionForm(): CorrectionForm {
  return {
    tanggal: getTodayValue(),
    kategori: 'Penyesuaian',
    uraian: '',
    nominal: '',
    partnerName: '',
    catatan: '',
  }
}

export default function PageContent({ initialTab = 'monitoring' }: { initialTab?: 'monitoring' | 'alokasi' | 'print' }) {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [data, setData] = useState<BendaharaPageData | null>(null)
  const [activeTab, setActiveTab] = useState<'monitoring' | 'alokasi' | 'print'>(initialTab)
  const [loading, setLoading] = useState(false)
  const [savingAllocation, setSavingAllocation] = useState(false)
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [allocationForm, setAllocationForm] = useState<AllocationForm>(makeAllocationForm())
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>(makeCorrectionForm())
  const [prefs, setPrefs] = useState<OperasionalPrintPreference>(DEFAULT_PREFS)
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const confirm = useConfirm()

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data?.ledger ? `Monitoring_Operasional_${data.ledger.unit.name}_${bulan}_${tahun}` : 'Monitoring_Operasional',
  })

  const activeUnitId = data?.activeUnitId || ''
  const ledger = data?.ledger || null
  const dashboard = data?.dashboard || []

  async function load(targetUnitId?: string | null) {
    setLoading(true)
    try {
      const result = await getBendaharaOperasionalPageData(tahun, bulan, targetUnitId || activeUnitId || undefined)
      setData(result)
      setAllocationForm(prev => prev.unitId ? prev : makeAllocationForm(result.activeUnitId || result.scope.defaultUnitId || ''))
      setPrefs(result.printPreferences || DEFAULT_PREFS)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat monitoring operasional.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan])

  const selectedUnitName = useMemo(
    () => data?.scope.unitOptions.find(unit => unit.id === activeUnitId)?.name || ledger?.unit.name || '-',
    [activeUnitId, data?.scope.unitOptions, ledger?.unit.name]
  )

  async function handleSaveAllocation(postAfterSave = false) {
    if (!allocationForm.unitId) return
    setSavingAllocation(true)
    try {
      const payload: SaveOperasionalAlokasiPayload = {
        id: allocationForm.id,
        tahun,
        bulan,
        unitId: allocationForm.unitId,
        nominal: Number(allocationForm.nominal || 0),
        catatan: allocationForm.catatan,
      }
      const result = await saveBendaharaAlokasi(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (postAfterSave && result.id) {
        const postResult = await postBendaharaAlokasi(result.id)
        if ('error' in postResult) {
          toast.error(postResult.error)
          return
        }
        toast.success('Alokasi berhasil diposting.')
      } else {
        toast.success('Alokasi berhasil disimpan sebagai draft.')
      }
      setAllocationForm(makeAllocationForm(allocationForm.unitId))
      setAllocationModalOpen(false)
      await load(allocationForm.unitId)
    } finally {
      setSavingAllocation(false)
    }
  }

  async function handlePostAllocation(id: string) {
    const result = await postBendaharaAlokasi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Alokasi berhasil diposting.')
    await load(activeUnitId)
  }

  async function handleCancelAllocation(id: string) {
    const ok = await confirm('Batalkan alokasi ini?\nTransaksi sistem terkait akan disembunyikan dari ledger aktif.', { variant: 'warning', confirmLabel: 'Ya, Batalkan' })
    if (!ok) return

    const result = await cancelBendaharaAlokasi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Alokasi berhasil dibatalkan.')
    await load(activeUnitId)
  }

  async function handleSaveCorrection() {
    if (!activeUnitId) return
    setSavingCorrection(true)
    try {
      const payload: SaveOperasionalTransaksiPayload = {
        id: correctionForm.id,
        tanggal: correctionForm.tanggal,
        unitId: activeUnitId,
        tipe: 'PENYESUAIAN',
        kategori: correctionForm.kategori,
        uraian: correctionForm.uraian,
        nominal: Number(correctionForm.nominal || 0),
        partnerName: correctionForm.partnerName,
        catatan: correctionForm.catatan,
      }
      const result = await saveBendaharaTransaksi(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(correctionForm.id ? 'Penyesuaian diperbarui.' : 'Penyesuaian berhasil ditambahkan.')
      setCorrectionForm(makeCorrectionForm())
      setCorrectionModalOpen(false)
      await load(activeUnitId)
    } finally {
      setSavingCorrection(false)
    }
  }

  async function handleDeleteCorrection(id: string) {
    const ok = await confirm('Hapus transaksi penyesuaian ini?', { variant: 'warning', confirmLabel: 'Ya, Hapus' })
    if (!ok) return

    const result = await deleteBendaharaTransaksi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Transaksi manual berhasil dihapus.')
    if (correctionForm.id === id) setCorrectionForm(makeCorrectionForm())
    await load(activeUnitId)
  }

  async function handleSavePrefs() {
    if (!activeUnitId) return
    setSavingPrefs(true)
    try {
      await saveBendaharaPrintPrefs({
        ...prefs,
        unit_id: activeUnitId,
        report_type: 'bendahara',
        scope_key: `bendahara:${activeUnitId}`,
      })
      toast.success('Preferensi cetak bendahara tersimpan.')
      setSignatureModalOpen(false)
      await load(activeUnitId)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menyimpan preferensi cetak.')
    } finally {
      setSavingPrefs(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <DashboardPageHeader
        title="Operasional Unit"
        description="Buat alokasi bulanan, pantau realisasi pengeluaran, dan cetak laporan operasional per unit."
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:w-auto">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select value={bulan} onChange={e => setBulan(Number(e.target.value) || 1)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none sm:flex-none">
                {BULAN_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span className="text-slate-300">/</span>
              <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value) || now.getFullYear())} className="w-24 min-w-0 bg-transparent text-sm font-semibold outline-none" />
            </div>
            <button onClick={() => load(activeUnitId)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Muat
            </button>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        {([
          { key: 'monitoring', label: 'Monitoring' },
          { key: 'alokasi', label: 'Alokasi' },
          { key: 'print', label: 'Cetak' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {!data || loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-slate-400" />
          Memuat dashboard operasional...
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Unit Dipantau</label>
            <select
              value={activeUnitId}
              onChange={async e => {
                const nextUnitId = e.target.value
                setAllocationForm(prev => ({ ...prev, unitId: nextUnitId }))
                await load(nextUnitId)
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            >
              {data.scope.unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>

          {activeTab === 'monitoring' ? (
            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <div className="min-w-0 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Unit Aktif" value={selectedUnitName} tone="slate" />
                  <SummaryCard label="Saldo Awal" value={formatCurrency(ledger?.saldoAwal || 0)} tone="slate" />
                  <SummaryCard label="Pengeluaran" value={formatCurrency(ledger?.totals.pengeluaran || 0)} tone="rose" />
                  <SummaryCard label="Saldo Akhir" value={formatCurrency(ledger?.saldoAkhir || 0)} tone="blue" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-slate-500" />
                    <p className="font-semibold text-slate-800">Rekap Lintas Unit</p>
                  </div>
                  <div className="space-y-3 lg:hidden">
                    {dashboard.map(row => (
                      <button
                        key={row.unit_id}
                        onClick={() => load(row.unit_id)}
                        className={`w-full rounded-2xl border p-4 text-left shadow-sm ${row.unit_id === activeUnitId ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{row.unit_name}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.tanpa_bukti > 0 ? `${row.tanpa_bukti} transaksi tanpa bukti` : 'Semua transaksi sudah terbaca'}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">Buka</span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <InfoRow label="Saldo Awal" value={formatCurrency(row.saldo_awal)} valueClassName="font-mono" />
                          <InfoRow label="Alokasi" value={formatCurrency(row.alokasi_bendahara)} valueClassName="font-mono text-emerald-700" />
                          <InfoRow label="Pemasukan Lain" value={formatCurrency(row.pemasukan_lain)} valueClassName="font-mono" />
                          <InfoRow label="Pengeluaran" value={formatCurrency(row.pengeluaran)} valueClassName="font-mono text-rose-700" />
                          <InfoRow label="Saldo Akhir" value={formatCurrency(row.saldo_akhir)} valueClassName="font-mono" />
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-3">Unit</th>
                          <th className="px-2 py-3 text-right">Saldo Awal</th>
                          <th className="px-2 py-3 text-right">Alokasi</th>
                          <th className="px-2 py-3 text-right">Pemasukan Lain</th>
                          <th className="px-2 py-3 text-right">Pengeluaran</th>
                          <th className="px-2 py-3 text-right">Saldo Akhir</th>
                          <th className="px-2 py-3 text-center">Tanpa Bukti</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.map(row => (
                          <tr key={row.unit_id} className={`border-b border-slate-100 ${row.unit_id === activeUnitId ? 'bg-slate-50' : ''}`}>
                            <td className="px-2 py-3 font-semibold text-slate-800">{row.unit_name}</td>
                            <td className="px-2 py-3 text-right font-mono">{formatCurrency(row.saldo_awal)}</td>
                            <td className="px-2 py-3 text-right font-mono text-emerald-700">{formatCurrency(row.alokasi_bendahara)}</td>
                            <td className="px-2 py-3 text-right font-mono">{formatCurrency(row.pemasukan_lain)}</td>
                            <td className="px-2 py-3 text-right font-mono text-rose-700">{formatCurrency(row.pengeluaran)}</td>
                            <td className="px-2 py-3 text-right font-mono font-semibold">{formatCurrency(row.saldo_akhir)}</td>
                            <td className="px-2 py-3 text-center">
                              <button onClick={() => load(row.unit_id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                {row.tanpa_bukti > 0 ? `${row.tanpa_bukti} transaksi` : '0'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Detail Ledger {selectedUnitName}</p>
                    </div>
                    <button onClick={() => setCorrectionModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <Plus className="h-4 w-4" />
                      Penyesuaian
                    </button>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {!ledger || ledger.transactions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                        Belum ada transaksi pada unit ini.
                      </div>
                    ) : ledger.transactions.map(row => (
                      <div key={row.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{row.uraian}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.tanggal}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            row.tipe === 'PENGELUARAN' ? 'bg-rose-100 text-rose-700' : row.tipe === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {row.tipe}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <InfoRow label="Kategori" value={row.kategori || '-'} />
                          <InfoRow label="Pihak Terkait" value={row.partner_name || '-'} />
                          <InfoRow label="Nominal" value={formatCurrency(row.nominal)} valueClassName="font-mono text-slate-800" />
                          <InfoRow label="Bukti" value={row.receipt_url ? 'Tersedia' : 'Tanpa bukti'} valueClassName={row.receipt_url ? 'text-blue-700' : 'text-amber-700'} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {row.receipt_url ? (
                            <a href={row.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                              Lihat Bukti
                            </a>
                          ) : null}
                          {!row.is_system && row.tipe === 'PENYESUAIAN' ? (
                            <>
                              <button onClick={() => { setCorrectionForm({ id: row.id, tanggal: row.tanggal, kategori: row.kategori || 'Penyesuaian', uraian: row.uraian, nominal: String(row.nominal), partnerName: row.partner_name || '', catatan: row.catatan || '' }); setCorrectionModalOpen(true) }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button onClick={() => handleDeleteCorrection(row.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">{row.is_system ? 'Transaksi sistem' : 'Hanya baca'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-3">Tanggal</th>
                          <th className="px-2 py-3">Tipe</th>
                          <th className="px-2 py-3">Uraian</th>
                          <th className="px-2 py-3 text-right">Nominal</th>
                          <th className="px-2 py-3">Bukti</th>
                          <th className="px-2 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!ledger || ledger.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-2 py-10 text-center text-sm text-slate-400">Belum ada transaksi pada unit ini.</td>
                          </tr>
                        ) : ledger.transactions.map(row => (
                          <tr key={row.id} className="border-b border-slate-100 align-top">
                            <td className="px-2 py-3 text-slate-500">{row.tanggal}</td>
                            <td className="px-2 py-3">
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                row.tipe === 'PENGELUARAN' ? 'bg-rose-100 text-rose-700' : row.tipe === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {row.tipe}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <p className="font-medium text-slate-800">{row.uraian}</p>
                              <p className="text-xs text-slate-500">{row.kategori || '-'}{row.partner_name ? ` • ${row.partner_name}` : ''}</p>
                            </td>
                            <td className="px-2 py-3 text-right font-mono font-semibold">{formatCurrency(row.nominal)}</td>
                            <td className="px-2 py-3">
                              {row.receipt_url ? <a href={row.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">Lihat</a> : <span className="text-xs text-amber-600">Tanpa bukti</span>}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-2">
                                {!row.is_system && row.tipe === 'PENYESUAIAN' ? (
                                  <>
                                    <button onClick={() => { setCorrectionForm({ id: row.id, tanggal: row.tanggal, kategori: row.kategori || 'Penyesuaian', uraian: row.uraian, nominal: String(row.nominal), partnerName: row.partner_name || '', catatan: row.catatan || '' }); setCorrectionModalOpen(true) }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteCorrection(row.id)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400">{row.is_system ? 'Sistem' : 'Read only'}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Alokasi Bulan Aktif</p>
                    </div>
                    <button onClick={() => setAllocationModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                      <Plus className="h-4 w-4" />
                      Alokasi
                    </button>
                  </div>
                  <div className="space-y-3">
                    {!ledger || ledger.allocations.length === 0 ? (
                      <p className="text-sm text-slate-400">Belum ada alokasi untuk unit ini pada periode aktif.</p>
                    ) : ledger.allocations.map(item => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{formatCurrency(item.nominal)}</p>
                            <p className="text-sm text-slate-500">{item.catatan || 'Tanpa catatan.'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                              item.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : item.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                            {item.status === 'draft' ? (
                              <button onClick={() => handlePostAllocation(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Posting
                              </button>
                            ) : null}
                            {item.status !== 'cancelled' ? (
                              <button onClick={() => handleCancelAllocation(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                <XCircle className="h-3.5 w-3.5" />
                                Batalkan
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <p className="font-semibold text-slate-800">Catatan Monitoring</p>
                  </div>
                  <div className="grid gap-3">
                    <InfoRow label="Transaksi dengan bukti" value={`${dashboard.find(row => row.unit_id === activeUnitId)?.ada_bukti ?? 0} item`} />
                    <InfoRow label="Transaksi tanpa bukti" value={`${dashboard.find(row => row.unit_id === activeUnitId)?.tanpa_bukti ?? 0} item`} />
                    <InfoRow label="Total pemasukan lain" value={formatCurrency(ledger?.totals.pemasukan_lain || 0)} />
                    <InfoRow label="Total penyesuaian" value={formatCurrency(ledger?.totals.penyesuaian || 0)} />
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'alokasi' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium text-slate-800">Alokasi dikerjakan lewat modal</p>
                  <p className="mt-1 text-sm text-slate-500">Halaman alokasi sengaja dibuat lebih lega. Daftar alokasi tetap tampil di tab monitoring.</p>
                </div>
                <button onClick={() => setAllocationModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black lg:shrink-0">
                  <Plus className="h-4 w-4" />
                  Buat Alokasi
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Preview Laporan Bendahara</p>
                  <p className="text-sm text-slate-500">Cetak per unit dengan format laporan yang formal dan rapi.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => setSignatureModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Pencil className="h-4 w-4" />
                    Tanda Tangan
                  </button>
                  <button onClick={() => handlePrint()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                    <Printer className="h-4 w-4" />
                    Cetak
                  </button>
                </div>
              </div>

              {ledger ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="absolute left-[-99999px] top-0">
                    <OperasionalPrintSheet ref={printRef} ledger={ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" />
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <div className="max-h-[70vh] overflow-y-auto">
                      <OperasionalPrintSheet ledger={ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" preview />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Pilih unit terlebih dahulu.</p>
              )}
            </div>
          )}
        </>
      )}

      <AppModal open={allocationModalOpen} onClose={() => setAllocationModalOpen(false)} title="Buat Alokasi Operasional">
        <div className="space-y-3">
          <Field label="Unit Tujuan">
            <select value={allocationForm.unitId} onChange={e => setAllocationForm(prev => ({ ...prev, unitId: e.target.value }))} className={inputClass}>
              <option value="">Pilih unit</option>
              {data?.scope.unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </Field>
          <Field label="Nominal">
            <input type="number" value={allocationForm.nominal} onChange={e => setAllocationForm(prev => ({ ...prev, nominal: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Catatan">
            <textarea value={allocationForm.catatan} onChange={e => setAllocationForm(prev => ({ ...prev, catatan: e.target.value }))} className={`${inputClass} min-h-24`} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleSaveAllocation(false)} disabled={savingAllocation || !allocationForm.unitId || !allocationForm.nominal.trim()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {savingAllocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Draft
            </button>
            <button onClick={() => handleSaveAllocation(true)} disabled={savingAllocation || !allocationForm.unitId || !allocationForm.nominal.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {savingAllocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Simpan & Posting
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal open={correctionModalOpen} onClose={() => setCorrectionModalOpen(false)} title={correctionForm.id ? 'Edit Penyesuaian Saldo' : 'Tambah Penyesuaian Saldo'}>
        <div className="space-y-3">
          <Field label="Tanggal"><input type="date" value={correctionForm.tanggal} onChange={e => setCorrectionForm(prev => ({ ...prev, tanggal: e.target.value }))} className={inputClass} /></Field>
          <Field label="Kategori"><input value={correctionForm.kategori} onChange={e => setCorrectionForm(prev => ({ ...prev, kategori: e.target.value }))} className={inputClass} /></Field>
          <Field label="Uraian"><input value={correctionForm.uraian} onChange={e => setCorrectionForm(prev => ({ ...prev, uraian: e.target.value }))} className={inputClass} /></Field>
          <Field label="Nominal"><input type="number" value={correctionForm.nominal} onChange={e => setCorrectionForm(prev => ({ ...prev, nominal: e.target.value }))} className={inputClass} placeholder="Gunakan negatif untuk pengurang saldo" /></Field>
          <Field label="Pihak Terkait"><input value={correctionForm.partnerName} onChange={e => setCorrectionForm(prev => ({ ...prev, partnerName: e.target.value }))} className={inputClass} /></Field>
          <Field label="Catatan"><textarea value={correctionForm.catatan} onChange={e => setCorrectionForm(prev => ({ ...prev, catatan: e.target.value }))} className={`${inputClass} min-h-24`} /></Field>
          <div className="flex gap-2">
            <button onClick={handleSaveCorrection} disabled={savingCorrection || !activeUnitId || !correctionForm.uraian.trim() || !correctionForm.nominal.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {savingCorrection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {correctionForm.id ? 'Simpan Koreksi' : 'Tambah Koreksi'}
            </button>
            <button onClick={() => { setCorrectionForm(makeCorrectionForm()); setCorrectionModalOpen(false) }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal open={signatureModalOpen} onClose={() => setSignatureModalOpen(false)} title="Atur Tanda Tangan Laporan">
        <div className="space-y-4">
          {[1, 2, 3].map(index => (
            <div key={index} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Kolom {index}</p>
              <div className="space-y-3">
                <Field label="Label"><input value={prefs[`slot${index}_label` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_label`]: e.target.value }))} className={inputClass} /></Field>
                <Field label="Nama"><input value={prefs[`slot${index}_nama` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_nama`]: e.target.value }))} className={inputClass} /></Field>
                <Field label="Jabatan"><input value={prefs[`slot${index}_jabatan` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_jabatan`]: e.target.value }))} className={inputClass} /></Field>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={handleSavePrefs} disabled={savingPrefs || !activeUnitId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Preferensi
            </button>
            <button onClick={() => setSignatureModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Tutup
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'rose' | 'blue' }) {
  const toneClass = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }[tone]
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function InfoRow({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-semibold text-slate-800 ${valueClassName}`}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function AppModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="pr-3 text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900'

function formatCurrency(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`
}
