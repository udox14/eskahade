'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Calendar,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Wallet2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { OperasionalPrintSheet } from '@/components/operasional/ledger-print-sheet'
import { compressImageFile } from '@/lib/image/compress-client'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type {
  OperasionalLedgerData,
  OperasionalPrintPreference,
  OperasionalScope,
  OperasionalTipe,
  SaveOperasionalTransaksiPayload,
} from '@/lib/operasional'
import {
  deleteRecipientTransaksi,
  getRecipientPageData,
  saveRecipientPrintPrefs,
  saveRecipientTransaksi,
} from './actions'

type RecipientPageData = {
  scope: OperasionalScope
  activeUnitId: string
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
  ledger: OperasionalLedgerData
  printPreferences: OperasionalPrintPreference
}

type TransactionFormState = {
  id?: string
  tanggal: string
  tipe: OperasionalTipe
  sumberPemasukan: 'LAINNYA' | 'ALOKASI_BENDAHARA'
  kategori: string
  uraian: string
  qty: string
  hargaSatuan: string
  nominal: string
  partnerName: string
  catatan: string
  receiptUrl: string
}

const DEFAULT_PREFS: OperasionalPrintPreference = {
  unit_id: '',
  report_type: 'recipient',
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

const KATEGORI_OPTIONS = ['Operasional', 'Konsumsi', 'Transport', 'Perlengkapan', 'Lainnya']
const BULAN_OPTIONS = [
  { value: 1, label: 'JANUARI' }, { value: 2, label: 'FEBRUARI' }, { value: 3, label: 'MARET' },
  { value: 4, label: 'APRIL' }, { value: 5, label: 'MEI' }, { value: 6, label: 'JUNI' },
  { value: 7, label: 'JULI' }, { value: 8, label: 'AGUSTUS' }, { value: 9, label: 'SEPTEMBER' },
  { value: 10, label: 'OKTOBER' }, { value: 11, label: 'NOVEMBER' }, { value: 12, label: 'DESEMBER' },
]

function getTodayValue() {
  return new Date().toISOString().slice(0, 10)
}

function makeEmptyForm(): TransactionFormState {
  return {
    tanggal: getTodayValue(),
    tipe: 'PENGELUARAN',
    sumberPemasukan: 'LAINNYA',
    kategori: 'Operasional',
    uraian: '',
    qty: '1',
    hargaSatuan: '',
    nominal: '',
    partnerName: '',
    catatan: '',
    receiptUrl: '',
  }
}

function mapRowToForm(row: OperasionalLedgerData['transactions'][number]): TransactionFormState {
  return {
    id: row.id,
    tanggal: row.tanggal,
    tipe: row.tipe,
    sumberPemasukan: row.sumber_pemasukan === 'ALOKASI_BENDAHARA' ? 'ALOKASI_BENDAHARA' : 'LAINNYA',
    kategori: row.kategori || 'Operasional',
    uraian: row.uraian,
    qty: String(row.qty ?? 1),
    hargaSatuan: String(row.harga_satuan ?? ''),
    nominal: String(row.nominal ?? ''),
    partnerName: row.partner_name || '',
    catatan: row.catatan || '',
    receiptUrl: row.receipt_url || '',
  }
}

export default function PageContent({ initialTab = 'ledger' }: { initialTab?: 'ledger' | 'print' }) {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [data, setData] = useState<RecipientPageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ledger' | 'print'>(initialTab)
  const [form, setForm] = useState<TransactionFormState>(makeEmptyForm())
  const [saving, setSaving] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefs, setPrefs] = useState<OperasionalPrintPreference>(DEFAULT_PREFS)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const confirm = useConfirm()

  const activeUnitId = data?.activeUnitId || ''
  const activeUnit = data?.scope.unitOptions.find(unit => unit.id === activeUnitId) || data?.ledger.unit || null
  const summary = data?.dashboard[0]

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: activeUnit ? `Kas_Operasional_${activeUnit.name}_${bulan}_${tahun}` : 'Kas_Operasional',
  })

  async function load(targetUnitId?: string | null) {
    setLoading(true)
    try {
      const result = await getRecipientPageData(tahun, bulan, targetUnitId || activeUnitId || undefined)
      setData(result)
      setPrefs(result.printPreferences)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat data kas operasional.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan])

  useEffect(() => {
    if (initialTab === 'print') setSignatureModalOpen(false)
  }, [initialTab])

  const canSaveTransaction = useMemo(() => {
    if (saving || !activeUnitId) return false
    if (!form.uraian.trim() || !form.tanggal) return false
    if (form.tipe === 'PENGELUARAN') return form.qty.trim() !== '' || form.hargaSatuan.trim() !== '' || form.nominal.trim() !== ''
    return form.nominal.trim() !== ''
  }, [activeUnitId, form, saving])

  async function uploadReceipt(file: File) {
    setUploadingReceipt(true)
    try {
      const base64 = await compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.74 })
      const response = await fetch('/api/upload-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          folder: 'operasional-receipts',
          filenamePrefix: activeUnitId || 'receipt',
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || 'Upload kuitansi gagal.')
      setForm(prev => ({ ...prev, receiptUrl: result.url }))
      toast.success('Kuitansi berhasil diupload.')
    } catch (error: any) {
      toast.error(error?.message || 'Gagal upload kuitansi.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function handleSaveTransaction() {
    if (!activeUnitId) return
    setSaving(true)
    try {
      const payload: SaveOperasionalTransaksiPayload = {
        id: form.id,
        tanggal: form.tanggal,
        unitId: activeUnitId,
        tipe: form.tipe,
        sumberPemasukan: form.tipe === 'PEMASUKAN' ? form.sumberPemasukan : null,
        kategori: form.kategori,
        uraian: form.uraian,
        qty: Number(form.qty || 0),
        hargaSatuan: Number(form.hargaSatuan || 0),
        nominal: Number(form.nominal || 0),
        partnerName: form.partnerName,
        catatan: form.catatan,
        receiptUrl: form.receiptUrl,
      }

      const result = await saveRecipientTransaksi(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(form.id ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil disimpan.')
      setForm(makeEmptyForm())
      setTransactionModalOpen(false)
      await load(activeUnitId)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTransaction(id: string) {
    const ok = await confirm(
      'Hapus transaksi ini dari tampilan aktif?\nRiwayat tetap tercatat sebagai soft delete.',
      { variant: 'warning', confirmLabel: 'Ya, Hapus' }
    )
    if (!ok) return

    const result = await deleteRecipientTransaksi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Transaksi berhasil dihapus.')
    if (form.id === id) setForm(makeEmptyForm())
    await load(activeUnitId)
  }

  async function handleSavePrefs() {
    if (!activeUnitId) return
    setSavingPrefs(true)
    try {
      await saveRecipientPrintPrefs({
        ...prefs,
        unit_id: activeUnitId,
        report_type: 'recipient',
        scope_key: `recipient:${activeUnitId}`,
      })
      toast.success('Preferensi tanda tangan tersimpan.')
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
        title="Kas Operasional Unit"
        description="Catat penerimaan, pengeluaran, dan cetak laporan kas operasional unit Anda."
        action={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select value={bulan} onChange={e => setBulan(Number(e.target.value) || 1)} className="bg-transparent text-sm font-semibold outline-none">
                {BULAN_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span className="text-slate-300">/</span>
              <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value) || now.getFullYear())} className="w-20 bg-transparent text-sm font-semibold outline-none" />
            </div>
            <button
              onClick={() => load(activeUnitId)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Muat
            </button>
          </div>
        )}
      />

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
        <button onClick={() => setActiveTab('ledger')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Ledger</button>
        <button onClick={() => setActiveTab('print')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'print' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Cetak</button>
      </div>

      {!data || loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-slate-400" />
          Memuat data kas operasional...
        </div>
      ) : (
        <>
          {!data.scope.lockedUnitId ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Unit Ledger</label>
              <select
                value={activeUnitId}
                onChange={async e => await load(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              >
                {data.scope.unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
          ) : null}

          {activeTab === 'ledger' ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard label="Saldo Awal" value={formatCurrency(summary?.saldo_awal || 0)} tone="slate" />
                <SummaryCard label="Pemasukan" value={formatCurrency((summary?.alokasi_bendahara || 0) + (summary?.pemasukan_lain || 0) + (summary?.penyesuaian || 0))} tone="emerald" />
                <SummaryCard label="Pengeluaran" value={formatCurrency(summary?.pengeluaran || 0)} tone="rose" />
                <SummaryCard label="Saldo Akhir" value={formatCurrency(summary?.saldo_akhir || 0)} tone="blue" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Wallet2 className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Transaksi Operasional</p>
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="font-medium text-slate-800">{form.id ? 'Ada transaksi yang sedang diedit' : 'Tambah transaksi lewat modal'}</p>
                        <p className="mt-1 text-sm text-slate-500">Form dipindahkan ke modal agar halaman utama lebih lapang dan fokus ke monitoring.</p>
                      </div>
                      <button
                        onClick={() => setTransactionModalOpen(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                      >
                        <Plus className="h-4 w-4" />
                        {form.id ? 'Lanjut Edit' : 'Tambah Transaksi'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Riwayat Transaksi</p>
                    </div>
                    <div className="overflow-x-auto">
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
                          {data.ledger.transactions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-2 py-10 text-center text-sm text-slate-400">Belum ada transaksi pada periode ini.</td>
                            </tr>
                          ) : data.ledger.transactions.map(row => (
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
                              <td className="px-2 py-3 text-right font-mono font-semibold text-slate-700">{formatCurrency(row.nominal)}</td>
                              <td className="px-2 py-3">
                                {row.receipt_url ? <a href={row.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">Lihat</a> : <span className="text-xs text-amber-600">Tanpa bukti</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex justify-end gap-2">
                                  {!row.is_system ? (
                                    <>
                                      <button onClick={() => { setForm(mapRowToForm(row)); setTransactionModalOpen(true) }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => handleDeleteTransaction(row.id)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-400">Sistem</span>
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

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 font-semibold text-slate-800">Alokasi Bulan Ini</p>
                    <div className="space-y-3">
                      {data.ledger.allocations.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada alokasi bendahara untuk periode ini.</p>
                      ) : data.ledger.allocations.map(item => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{formatCurrency(item.nominal)}</p>
                              <p className="text-xs text-slate-500">{item.status.toUpperCase()}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              item.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : item.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          {item.catatan ? <p className="mt-2 text-sm text-slate-600">{item.catatan}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <p className="font-semibold text-amber-900">Pengingat Bukti Belanja</p>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      Kuitansi masih opsional, tetapi sistem menandai transaksi pengeluaran tanpa bukti agar bendahara lebih mudah memantau.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Preview Laporan</p>
                  <p className="text-sm text-slate-500">Format F4 portrait dengan tampilan laporan yang lebih formal.</p>
                </div>
                <div className="flex gap-2">
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

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="absolute left-[-99999px] top-0">
                  <OperasionalPrintSheet ref={printRef} ledger={data.ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" />
                </div>
                <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
                  <OperasionalPrintSheet ledger={data.ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AppModal open={transactionModalOpen} onClose={() => setTransactionModalOpen(false)} title={form.id ? 'Edit Transaksi Operasional' : 'Tambah Transaksi Operasional'} maxWidth="max-w-3xl">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tanggal"><input type="date" value={form.tanggal} onChange={e => setForm(prev => ({ ...prev, tanggal: e.target.value }))} className={inputClass} /></Field>
          <Field label="Tipe">
            <select value={form.tipe} onChange={e => setForm(prev => ({ ...prev, tipe: e.target.value as OperasionalTipe }))} className={inputClass}>
              <option value="PENGELUARAN">Pengeluaran</option>
              <option value="PEMASUKAN">Pemasukan</option>
              <option value="PENYESUAIAN">Penyesuaian</option>
            </select>
          </Field>
          {form.tipe === 'PEMASUKAN' ? (
            <Field label="Sumber Pemasukan">
              <select value={form.sumberPemasukan} onChange={e => setForm(prev => ({ ...prev, sumberPemasukan: e.target.value as 'LAINNYA' | 'ALOKASI_BENDAHARA' }))} className={inputClass}>
                <option value="LAINNYA">Lainnya</option>
                <option value="ALOKASI_BENDAHARA">Alokasi Bendahara</option>
              </select>
            </Field>
          ) : null}
          <Field label="Kategori">
            <select value={form.kategori} onChange={e => setForm(prev => ({ ...prev, kategori: e.target.value }))} className={inputClass}>
              {KATEGORI_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Uraian" className="md:col-span-2"><input value={form.uraian} onChange={e => setForm(prev => ({ ...prev, uraian: e.target.value }))} className={inputClass} /></Field>
          {form.tipe === 'PENGELUARAN' ? (
            <>
              <Field label="Qty"><input value={form.qty} onChange={e => setForm(prev => ({ ...prev, qty: e.target.value }))} className={inputClass} type="number" min="0" step="0.01" /></Field>
              <Field label="Harga Satuan"><input value={form.hargaSatuan} onChange={e => setForm(prev => ({ ...prev, hargaSatuan: e.target.value }))} className={inputClass} type="number" min="0" /></Field>
            </>
          ) : (
            <Field label="Nominal" className="md:col-span-2"><input value={form.nominal} onChange={e => setForm(prev => ({ ...prev, nominal: e.target.value }))} className={inputClass} type="number" /></Field>
          )}
          <Field label={form.tipe === 'PENGELUARAN' ? 'Dibayarkan Kepada' : 'Sumber / Pihak Terkait'}>
            <input value={form.partnerName} onChange={e => setForm(prev => ({ ...prev, partnerName: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Foto Kuitansi (Opsional)">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 hover:border-slate-400">
              {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingReceipt ? 'Memproses...' : 'Upload kuitansi'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadReceipt(file) }} />
            </label>
            {form.receiptUrl ? (
              <a href={form.receiptUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                <ImageIcon className="h-3.5 w-3.5" />
                Lihat kuitansi
              </a>
            ) : null}
          </Field>
          <Field label="Catatan" className="md:col-span-2"><textarea value={form.catatan} onChange={e => setForm(prev => ({ ...prev, catatan: e.target.value }))} className={`${inputClass} min-h-24`} /></Field>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={handleSaveTransaction} disabled={!canSaveTransaction} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {form.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
          <button onClick={() => { setForm(makeEmptyForm()); setTransactionModalOpen(false) }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Batal
          </button>
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
            <button onClick={handleSavePrefs} disabled={savingPrefs} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'rose' | 'blue' }) {
  const toneClass = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
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

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
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
  maxWidth = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-3xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900'

function formatCurrency(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`
}
