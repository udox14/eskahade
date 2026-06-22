'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
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
} from 'lucide-react'
import { Button, ActionIcon, TextInput, NativeSelect, Textarea, SegmentedControl, Modal } from '@mantine/core'
import { toast } from '@/lib/toast'
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              <NativeSelect
                value={String(bulan)}
                onChange={e => setBulan(Number(e.target.value) || 1)}
                data={BULAN_OPTIONS.map(o => ({ label: o.label, value: String(o.value) }))}
                size="xs"
                variant="unstyled"
                fw={600}
              />
              <span className="text-slate-300">/</span>
              <TextInput
                type="number"
                value={String(tahun)}
                onChange={e => setTahun(Number(e.target.value) || now.getFullYear())}
                size="xs"
                variant="unstyled"
                fw={600}
                w={64}
              />
            </div>
            <Button
              onClick={() => load(activeUnitId)}
              loading={loading}
              color="dark"
              leftSection={!loading ? <RefreshCw className="h-4 w-4"/> : undefined}
            >
              Muat
            </Button>
          </div>
        )}
      />

      <SegmentedControl
        value={activeTab}
        onChange={v => setActiveTab(v as 'ledger' | 'print')}
        data={[{ label: 'Ledger', value: 'ledger' }, { label: 'Cetak', value: 'print' }]}
        fullWidth
      />

      {!data || loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-slate-400" />
          Memuat data kas operasional...
        </div>
      ) : (
        <>
          {!data.scope.lockedUnitId ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <NativeSelect
                label="Unit Ledger"
                value={activeUnitId}
                onChange={async e => await load(e.target.value)}
                data={data.scope.unitOptions.map(unit => ({ label: unit.name, value: unit.id }))}
              />
            </div>
          ) : null}

          {activeTab === 'ledger' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Saldo Awal" value={formatCurrency(summary?.saldo_awal || 0)} tone="slate" />
                <SummaryCard label="Pemasukan" value={formatCurrency((summary?.alokasi_bendahara || 0) + (summary?.pemasukan_lain || 0) + (summary?.penyesuaian || 0))} tone="emerald" />
                <SummaryCard label="Pengeluaran" value={formatCurrency(summary?.pengeluaran || 0)} tone="rose" />
                <SummaryCard label="Saldo Akhir" value={formatCurrency(summary?.saldo_akhir || 0)} tone="blue" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="min-w-0 space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Wallet2 className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Transaksi Operasional</p>
                    </div>
                    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{form.id ? 'Ada transaksi yang sedang diedit' : 'Tambah transaksi lewat modal'}</p>
                        <p className="mt-1 text-sm text-slate-500">Form dipindahkan ke modal agar halaman utama lebih lapang dan fokus ke monitoring.</p>
                      </div>
                      <Button onClick={() => setTransactionModalOpen(true)} color="dark" leftSection={<Plus className="h-4 w-4"/>} className="lg:shrink-0">
                        {form.id ? 'Lanjut Edit' : 'Tambah Transaksi'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-800">Riwayat Transaksi</p>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {data.ledger.transactions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                          Belum ada transaksi pada periode ini.
                        </div>
                      ) : data.ledger.transactions.map(row => (
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
                            {!row.is_system ? (
                              <>
                                <Button size="xs" variant="default" onClick={() => { setForm(mapRowToForm(row)); setTransactionModalOpen(true) }} leftSection={<Pencil className="h-3.5 w-3.5"/>}>Edit</Button>
                                <Button size="xs" color="pink" variant="light" onClick={() => handleDeleteTransaction(row.id)} leftSection={<Trash2 className="h-3.5 w-3.5"/>}>Hapus</Button>
                              </>
                            ) : (
                              <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">Transaksi sistem</span>
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
                                      <ActionIcon variant="default" size="sm" onClick={() => { setForm(mapRowToForm(row)); setTransactionModalOpen(true) }}><Pencil className="h-3.5 w-3.5"/></ActionIcon>
                                      <ActionIcon variant="light" color="pink" size="sm" onClick={() => handleDeleteTransaction(row.id)}><Trash2 className="h-3.5 w-3.5"/></ActionIcon>
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

                <div className="min-w-0 space-y-6">
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
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Preview Laporan</p>
                  <p className="text-sm text-slate-500">Format F4 portrait dengan tampilan laporan yang lebih formal.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => setSignatureModalOpen(true)} variant="default" leftSection={<Pencil className="h-4 w-4"/>}>
                    Tanda Tangan
                  </Button>
                  <Button onClick={() => handlePrint()} color="dark" leftSection={<Printer className="h-4 w-4"/>}>
                    Cetak
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="absolute left-[-99999px] top-0">
                  <OperasionalPrintSheet ref={printRef} ledger={data.ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" />
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <div className="max-h-[70vh] overflow-y-auto">
                    <OperasionalPrintSheet ledger={data.ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" preview />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AppModal open={transactionModalOpen} onClose={() => setTransactionModalOpen(false)} title={form.id ? 'Edit Transaksi Operasional' : 'Tambah Transaksi Operasional'} maxWidth="max-w-3xl">
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Tanggal" type="date" value={form.tanggal} onChange={e => setForm(prev => ({ ...prev, tanggal: e.target.value }))} />
          <NativeSelect
            label="Tipe"
            value={form.tipe}
            onChange={e => setForm(prev => ({ ...prev, tipe: e.target.value as OperasionalTipe }))}
            data={[{ label: 'Pengeluaran', value: 'PENGELUARAN' }, { label: 'Pemasukan', value: 'PEMASUKAN' }, { label: 'Penyesuaian', value: 'PENYESUAIAN' }]}
          />
          {form.tipe === 'PEMASUKAN' ? (
            <NativeSelect
              label="Sumber Pemasukan"
              value={form.sumberPemasukan}
              onChange={e => setForm(prev => ({ ...prev, sumberPemasukan: e.target.value as 'LAINNYA' | 'ALOKASI_BENDAHARA' }))}
              data={[{ label: 'Lainnya', value: 'LAINNYA' }, { label: 'Alokasi Bendahara', value: 'ALOKASI_BENDAHARA' }]}
            />
          ) : null}
          <NativeSelect
            label="Kategori"
            value={form.kategori}
            onChange={e => setForm(prev => ({ ...prev, kategori: e.target.value }))}
            data={KATEGORI_OPTIONS.map(o => ({ label: o, value: o }))}
          />
          <TextInput label="Uraian" value={form.uraian} onChange={e => setForm(prev => ({ ...prev, uraian: e.target.value }))} className="md:col-span-2" />
          {form.tipe === 'PENGELUARAN' ? (
            <>
              <TextInput label="Qty" value={form.qty} onChange={e => setForm(prev => ({ ...prev, qty: e.target.value }))} type="number" min={0} step={0.01} />
              <TextInput label="Harga Satuan" value={form.hargaSatuan} onChange={e => setForm(prev => ({ ...prev, hargaSatuan: e.target.value }))} type="number" min={0} />
            </>
          ) : (
            <TextInput label="Nominal" value={form.nominal} onChange={e => setForm(prev => ({ ...prev, nominal: e.target.value }))} type="number" className="md:col-span-2" />
          )}
          <TextInput
            label={form.tipe === 'PENGELUARAN' ? 'Dibayarkan Kepada' : 'Sumber / Pihak Terkait'}
            value={form.partnerName}
            onChange={e => setForm(prev => ({ ...prev, partnerName: e.target.value }))}
          />
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Foto Kuitansi (Opsional)</p>
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
          </div>
          <Textarea label="Catatan" value={form.catatan} onChange={e => setForm(prev => ({ ...prev, catatan: e.target.value }))} minRows={3} className="md:col-span-2" />
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={handleSaveTransaction} loading={saving} disabled={!canSaveTransaction} color="dark" leftSection={!saving ? <Save className="h-4 w-4"/> : undefined}>
            {form.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Button>
          <Button onClick={() => { setForm(makeEmptyForm()); setTransactionModalOpen(false) }} variant="default">
            Batal
          </Button>
        </div>
      </AppModal>

      <AppModal open={signatureModalOpen} onClose={() => setSignatureModalOpen(false)} title="Atur Tanda Tangan Laporan">
        <div className="space-y-4">
          {[1, 2, 3].map(index => (
            <div key={index} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Kolom {index}</p>
              <div className="space-y-3">
                <TextInput label="Label" value={prefs[`slot${index}_label` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_label`]: e.target.value }))} />
                <TextInput label="Nama" value={prefs[`slot${index}_nama` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_nama`]: e.target.value }))} />
                <TextInput label="Jabatan" value={prefs[`slot${index}_jabatan` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_jabatan`]: e.target.value }))} />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={handleSavePrefs} loading={savingPrefs} color="dark" leftSection={!savingPrefs ? <Save className="h-4 w-4"/> : undefined}>
              Simpan Preferensi
            </Button>
            <Button onClick={() => setSignatureModalOpen(false)} variant="default">
              Tutup
            </Button>
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

function InfoRow({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-semibold text-slate-800 ${valueClassName}`}>{value}</span>
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
  const size = maxWidth === 'max-w-3xl' ? 'xl' : 'md'
  return (
    <Modal opened={open} onClose={onClose} title={<span className="text-base font-semibold">{title}</span>} size={size} centered>
      {children}
    </Modal>
  )
}

function formatCurrency(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`
}
