/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, MetricCard } from '@/components/poskestren/poskestren-shell'

import { getMonthlyReport, getPayrollReport } from './actions'

const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
function rupiah(value: unknown) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0)) }

function ReportActions({ exportExcel }: { exportExcel: () => Promise<void> }) {
  const [exporting, setExporting] = useState(false)
  return <div className="no-print flex flex-wrap gap-2"><button className={secondary} onClick={() => window.print()}><Printer className="h-4 w-4" /> Cetak / PDF</button><button className={secondary} disabled={exporting} onClick={async () => { setExporting(true); try { await exportExcel() } catch (e) { toast.error(e instanceof Error ? e.message : 'Ekspor gagal.') } finally { setExporting(false) } }}>{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel</button></div>
}

export function MonthlyReport({ month }: { month: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { setData(await getMonthlyReport(month)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat laporan.') } finally { setLoading(false) } }, [month])
  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />
  if (!data) return <EmptyState title="Laporan tidak tersedia" description="Pilih periode yang valid." />
  const visits = data.visitSummary
  const preventive = data.preventiveSummary
  const finance = data.financeSummary
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const overview = [
      ['Periode', data.period.month],
      ['Pasien unik', visits.unique_patients], ['Kunjungan', visits.visits], ['Selesai', visits.completed],
      ['Dirujuk', visits.referred], ['Sumber Data Sakit', visits.sick_source],
      ['Program preventif', preventive.programs], ['Peserta preventif', preventive.participants],
      ['Pemasukan', finance.income], ['Pengeluaran', finance.expense], ['Belanja obat', finance.medicine_expense],
    ]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overview), 'Ringkasan')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.visitsByDorm), 'Asrama')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.diagnoses), 'Diagnosis')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.medicalStaff), 'Tenaga Medis')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.preventivePrograms), 'Preventif')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.medicineUsage), 'Pemakaian Obat')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.locationStockSummary), 'Saldo Lokasi')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.orderSummary), 'Status Pesanan')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.financeAccounts), 'Saldo Akun')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.expenseCategories), 'Kategori Pengeluaran')
    XLSX.writeFile(workbook, `laporan-poskestren-${month}.xlsx`)
  }
  return <section className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Laporan Bulanan {month}</h2><p className="text-xs text-slate-500">{data.period.from} s.d. {data.period.to} · WIB</p></div><ReportActions exportExcel={exportExcel} /></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Pasien unik" value={visits.unique_patients || 0} />
      <MetricCard label="Kunjungan" value={visits.visits || 0} tone="blue" />
      <MetricCard label="Dirujuk" value={visits.referred || 0} tone="amber" />
      <MetricCard label="Dari Data Sakit" value={visits.sick_source || 0} tone="slate" />
    </div>
    <ReportSection title="Layanan pemeriksaan">
      <div className="grid gap-3 sm:grid-cols-6"><Mini label="Menunggu" value={visits.waiting} /><Mini label="Diperiksa" value={visits.examining} /><Mini label="Menunggu obat" value={visits.waiting_medicine} /><Mini label="Selesai" value={visits.completed} /><Mini label="Dirujuk" value={visits.referred} /><Mini label="Batal" value={visits.cancelled} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3"><SimpleTable title="Kunjungan per asrama" rows={data.visitsByDorm} columns={[['label', 'Asrama'], ['total', 'Kunjungan']]} /><SimpleTable title="Diagnosis terbanyak" rows={data.diagnoses} columns={[['label', 'Diagnosis'], ['total', 'Jumlah']]} /><SimpleTable title="Tenaga medis" rows={data.medicalStaff} columns={[['label', 'Nama'], ['total', 'Kunjungan'], ['referred', 'Rujukan']]} /></div>
    </ReportSection>
    <ReportSection title="Program preventif">
      <div className="grid gap-3 sm:grid-cols-4"><Mini label="Program" value={preventive.programs} /><Mini label="Peserta" value={preventive.participants} /><Mini label="Hadir" value={preventive.present} /><Mini label="Tindak lanjut" value={preventive.follow_up} /></div>
      <SimpleTable title="Rincian program" rows={data.preventivePrograms} columns={[['program_date', 'Tanggal'], ['type_name', 'Jenis'], ['title', 'Program'], ['participants', 'Peserta'], ['present', 'Hadir'], ['follow_up', 'Tindak lanjut']]} />
    </ReportSection>
    <ReportSection title="Obat dan stok">
      <div className="grid gap-3 sm:grid-cols-4"><Mini label="Belanja" value={data.purchaseSummary.purchases} /><Mini label="Nilai belanja" value={rupiah(data.purchaseSummary.total)} /><Mini label="Stok kritis" value={data.stockSummary.critical} /><Mini label="Stok kosong" value={data.stockSummary.empty} /></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4"><Mini label="Saldo pusat" value={data.stockSummary.central_units} /><Mini label="Saldo asrama" value={data.stockSummary.dorm_units} /><Mini label="Transfer bulan ini" value={data.transferSummary.transfers} /><Mini label="Unit transfer" value={data.transferSummary.transferred_units} /></div>
      <SimpleTable title="Pemakaian obat" rows={data.medicineUsage} columns={[['name', 'Obat'], ['used_quantity', 'Total'], ['patient_quantity', 'Pasien'], ['quick_quantity', 'Transaksi cepat'], ['clinical_quantity', 'Klinis'], ['preventive_quantity', 'Preventif'], ['loss_quantity', 'Rusak/kedaluwarsa']]} />
      <SimpleTable title="Saldo per lokasi" rows={data.locationStockSummary} columns={[['location_name', 'Lokasi'], ['location_type', 'Tipe'], ['quantity_base', 'Saldo']]} />
      <SimpleTable title="Status pesanan" rows={data.orderSummary} columns={[['status', 'Status'], ['total', 'Jumlah']]} />
    </ReportSection>
    <ReportSection title="Keuangan">
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Pemasukan" value={rupiah(finance.income)} /><MetricCard label="Pengeluaran" value={rupiah(finance.expense)} tone="rose" /><MetricCard label="Belanja obat" value={rupiah(finance.medicine_expense)} tone="amber" /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><SimpleTable title="Saldo per akun" rows={data.financeAccounts} columns={[['name', 'Akun'], ['balance', 'Saldo']]} moneyKeys={['balance']} /><SimpleTable title="Pengeluaran per kategori" rows={data.expenseCategories} columns={[['name', 'Kategori'], ['total', 'Total']]} moneyKeys={['total']} /></div>
    </ReportSection>
  </section>
}

export function PayrollReport({ month }: { month: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { setData(await getPayrollReport(month)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat penggajian.') } finally { setLoading(false) } }, [month])
  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />
  if (!data) return <EmptyState title="Laporan tidak tersedia" description="Pilih periode yang valid." />
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.medical.map((row: any) => ({
      Nama: row.full_name, Profesi: row.profession, Sesi: row.session_count, 'Pasien Biasa': row.visit_count, 'Pasien Tindakan': row.visit_treatment_count,
      'Subtotal Sesi': row.session_subtotal, 'Subtotal Pasien': row.patient_subtotal, 'Subtotal Tindakan': row.patient_treatment_subtotal, Total: row.total,
      'Tarif Sesi Efektif': row.session_rates.join('; '), 'Tarif Pasien Efektif': row.patient_rates.join('; '), 'Tarif Tindakan Efektif': row.patient_treatment_rates.join('; '),
    }))), 'Tenaga Medis')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.employees.map((row: any) => ({
      Nama: row.full_name, Jabatan: row.position_name, 'Tanggal Efektif': row.effective_from,
      'Gaji Bulanan': row.monthly_salary, Total: row.total,
    }))), 'Karyawan')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Total tenaga medis', data.medicalTotal], ['Total karyawan', data.employeeTotal], ['Total keseluruhan', data.grandTotal]]), 'Ringkasan')
    XLSX.writeFile(workbook, `penggajian-poskestren-${month}.xlsx`)
  }
  return <section className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Laporan Penggajian {month}</h2><p className="text-xs text-slate-500">Rekap saja · tidak membuat pembayaran atau slip gaji</p></div><ReportActions exportExcel={exportExcel} /></div>
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Tenaga medis" value={rupiah(data.medicalTotal)} /><MetricCard label="Karyawan" value={rupiah(data.employeeTotal)} tone="blue" /><MetricCard label="Total penggajian" value={rupiah(data.grandTotal)} tone="amber" /></div>
    <ReportSection title="Tenaga medis">
      {data.medical.length === 0 ? <EmptyState title="Belum ada tenaga medis" description="Personel medis akan muncul setelah ditambahkan." /> : <><div className="space-y-2 md:hidden">{data.medical.map((row: any) => <article key={row.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.full_name}</h3><p className="text-[11px] text-slate-500">{row.profession || 'Tenaga medis'} · {row.session_count} sesi · {row.visit_count} px biasa · {row.visit_treatment_count} px tindakan</p></div><strong className="shrink-0 text-sm text-emerald-700">{rupiah(row.total)}</strong></div><p className="mt-1 text-[11px] text-slate-500">Sesi {rupiah(row.session_subtotal)} · Biasa {rupiah(row.patient_subtotal)} · Tindakan {rupiah(row.patient_treatment_subtotal)}</p></article>)}</div><div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tenaga medis</th><th className="px-4 py-3 text-center">Sesi</th><th className="px-4 py-3 text-right">Subtotal Sesi</th><th className="px-4 py-3 text-center">Px Biasa</th><th className="px-4 py-3 text-right">Subtotal Biasa</th><th className="px-4 py-3 text-center">Px Tindakan</th><th className="px-4 py-3 text-right">Subt. Tindakan</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y">{data.medical.map((row: any) => <tr key={row.id}><td className="px-4 py-3"><p className="font-bold">{row.full_name}</p><p className="text-xs text-slate-500">{row.profession || 'Tenaga medis'}</p></td><td className="px-4 py-3 text-center" title={row.session_rates.join('; ')}>{row.session_count}</td><td className="px-4 py-3 text-right">{rupiah(row.session_subtotal)}</td><td className="px-4 py-3 text-center" title={row.patient_rates.join('; ')}>{row.visit_count}</td><td className="px-4 py-3 text-right">{rupiah(row.patient_subtotal)}</td><td className="px-4 py-3 text-center" title={row.patient_treatment_rates.join('; ')}>{row.visit_treatment_count}</td><td className="px-4 py-3 text-right">{rupiah(row.patient_treatment_subtotal)}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{rupiah(row.total)}</td></tr>)}</tbody></table></div></>}
    </ReportSection>
    <ReportSection title="Karyawan">
      {data.employees.length === 0 ? <EmptyState title="Belum ada karyawan" description="Karyawan aktif pada periode akan muncul di sini." /> : <><div className="space-y-2 md:hidden">{data.employees.map((row: any) => <article key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.full_name}</h3><p className="truncate text-[11px] text-slate-500">{row.position_name || 'Karyawan'} · efektif {row.effective_from || '—'}</p></div><strong className="shrink-0 text-sm text-blue-700">{rupiah(row.total)}</strong></article>)}</div><div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Karyawan</th><th className="px-4 py-3">Jabatan</th><th className="px-4 py-3">Tarif efektif</th><th className="px-4 py-3 text-right">Gaji bulanan</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y">{data.employees.map((row: any) => <tr key={row.id}><td className="px-4 py-3 font-bold">{row.full_name}</td><td className="px-4 py-3">{row.position_name || 'Karyawan'}</td><td className="px-4 py-3">{row.effective_from || '—'}</td><td className="px-4 py-3 text-right">{rupiah(row.monthly_salary)}</td><td className="px-4 py-3 text-right font-black text-blue-700">{rupiah(row.total)}</td></tr>)}</tbody></table></div></>}
    </ReportSection>
  </section>
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</section>
}
function Mini({ label, value }: { label: string; value: unknown }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-1 text-lg font-black">{String(value || 0)}</p></div> }
function SimpleTable({ title, rows, columns, moneyKeys = [] }: { title: string; rows: any[]; columns: Array<[string, string]>; moneyKeys?: string[] }) {
  return <div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><h3 className="bg-slate-50 px-3 py-2 text-sm font-black">{title}</h3>{rows.length === 0 ? <p className="p-4 text-sm text-slate-400">Tidak ada data.</p> : <><div className="divide-y divide-slate-100 md:hidden">{rows.map((row, index) => <article key={index} className="p-3"><p className="truncate text-sm font-black">{moneyKeys.includes(columns[0][0]) ? rupiah(row[columns[0][0]]) : String(row[columns[0][0]] ?? '—')}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{columns.slice(1).map(([key, label]) => <p key={key} className="text-[11px] text-slate-500"><span className="font-bold">{label}:</span> {moneyKeys.includes(key) ? rupiah(row[key]) : String(row[key] ?? '—')}</p>)}</div></article>)}</div><div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-xs"><thead><tr className="border-b border-slate-200">{columns.map(([key, label]) => <th key={key} className="px-3 py-2 font-black text-slate-500">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-0">{columns.map(([key]) => <td key={key} className="px-3 py-2">{moneyKeys.includes(key) ? rupiah(row[key]) : String(row[key] ?? '—')}</td>)}</tr>)}</tbody></table></div></>}</div>
}
function Loading() { return <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> }
