/* eslint-disable react-hooks/static-components */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Download, Loader2, PieChart, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, MetricCard } from '@/components/poskestren/poskestren-shell'
import {
  academicYearStartForMonth,
  currentWibMonth,
  type DiseaseMetricBasis,
  type DiseasePeriodMode,
  type DiseaseReportInput,
  type DiseaseReportOptions,
  type DiseaseReportResult,
  type DiseaseReportRow,
} from '@/lib/poskestren/disease-report'

import { getDiseaseCaseReport, getDiseaseReportOptions } from './actions'

const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569', '#ea580c']

type SortKey = 'diagnosisName' | 'uniqueStudents' | 'episodes' | 'uniqueSharePercent' | 'uniqueActivePercent' | 'episodeSharePercent' | 'episodesPer100Active'

function isoTodayWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function monthBounds(month: string) {
  const [year, number] = month.split('-').map(Number)
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`,
  }
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
}

function genderLabel(value: string) {
  return value === 'L' ? 'Laki-laki' : value === 'P' ? 'Perempuan' : 'Semua jenis kelamin'
}

function readInput(searchParams: URLSearchParams): DiseaseReportInput {
  const periodMode = (['month', 'semester', 'range'].includes(searchParams.get('mode') || '') ? searchParams.get('mode') : 'month') as DiseasePeriodMode
  const month = /^\d{4}-\d{2}$/.test(searchParams.get('bulan') || '') ? searchParams.get('bulan')! : currentWibMonth()
  const defaults = monthBounds(month)
  const academicYearStart = Number(searchParams.get('tahun')) || academicYearStartForMonth(month)
  return {
    periodMode,
    month,
    academicYearStart,
    semester: searchParams.get('semester') === '2' ? 2 : 1,
    from: searchParams.get('dari') || defaults.from,
    to: searchParams.get('sampai') || (month === currentWibMonth() ? isoTodayWib() : defaults.to),
    asrama: searchParams.get('asrama') || '',
    gender: searchParams.get('jk') === 'L' || searchParams.get('jk') === 'P' ? searchParams.get('jk') as 'L' | 'P' : '',
    basis: searchParams.get('basis') === 'episodes' || searchParams.get('basis') === 'both' ? searchParams.get('basis') as DiseaseMetricBasis : 'unique',
  }
}

export function DiseaseReport({ basePath }: { basePath: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const input = useMemo(() => readInput(new URLSearchParams(searchParams.toString())), [searchParams])
  const [options, setOptions] = useState<DiseaseReportOptions | null>(null)
  const [data, setData] = useState<DiseaseReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'uniqueStudents', direction: 'desc' })

  useEffect(() => {
    void getDiseaseReportOptions().then(setOptions).catch(error => toast.error(error instanceof Error ? error.message : 'Gagal memuat pilihan laporan.'))
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    void getDiseaseCaseReport(input)
      .then(result => { if (active) setData(result) })
      .catch(error => { if (active) toast.error(error instanceof Error ? error.message : 'Gagal memuat laporan penyakit.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [input])

  const update = useCallback((changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${basePath}?${params.toString()}`, { scroll: false })
  }, [basePath, router, searchParams])

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    const rows = (data?.rows || []).filter(row => !needle || row.diagnosisName.toLocaleLowerCase('id-ID').includes(needle))
    return [...rows].sort((a, b) => {
      const left = a[sort.key]
      const right = b[sort.key]
      const compared = typeof left === 'string'
        ? left.localeCompare(String(right), 'id')
        : Number(left) - Number(right)
      return sort.direction === 'asc' ? compared : -compared
    })
  }, [data, search, sort])

  function changeSort(key: SortKey) {
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'diagnosisName' ? 'asc' : 'desc' })
  }

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const summary = [
        ['Laporan', 'Laporan Kasus Penyakit POSKESTREN'],
        ['Periode', data.period.label],
        ['Tanggal awal', data.period.from], ['Tanggal akhir', data.period.to],
        ['Asrama', data.filters.asrama || 'Semua asrama'],
        ['Jenis kelamin', genderLabel(data.filters.gender)],
        ['Basis tampilan', data.filters.basis],
        ['Santri terdiagnosis', data.totals.diagnosedStudents],
        ['Episode diagnosis', data.totals.episodes],
        ['Santri aktif akhir periode', data.totals.activeStudents],
        ['Jenis diagnosis', data.totals.diagnoses],
        [],
        ['Catatan', 'Episode per 100 santri aktif dapat melebihi 100 jika terjadi pemeriksaan berulang.'],
      ]
      const reportRows = data.rows.map((row, index) => ({
        No: index + 1,
        Diagnosis: row.diagnosisName,
        'Santri Unik': row.uniqueStudents,
        'Episode': row.episodes,
        '% Santri Sakit': row.uniqueSharePercent,
        '% Santri Aktif': row.uniqueActivePercent,
        '% Seluruh Episode': row.episodeSharePercent,
        'Episode per 100 Santri Aktif': row.episodesPer100Active,
      }))
      const graphRows = data.rows.map(row => ({ Diagnosis: row.diagnosisName, 'Santri Unik': row.uniqueStudents, Episode: row.episodes }))
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Ringkasan')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), 'Kasus Penyakit')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(graphRows), 'Data Grafik')
      XLSX.writeFile(workbook, `laporan-kasus-penyakit-${data.period.from}-${data.period.to}.xlsx`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ekspor Excel gagal.')
    } finally {
      setExporting(false)
    }
  }

  const basis = input.basis || 'unique'
  return (
    <div className="print-area space-y-5">
      <style>{`@media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .disease-report-card { break-inside: avoid; } }`}</style>
      <div className="no-print space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Mode periode</span><select value={input.periodMode} onChange={event => update({ mode: event.target.value })} className={inputClass}><option value="month">Bulanan</option><option value="semester">Semester</option><option value="range">Rentang bebas</option></select></label>
          {input.periodMode === 'month' ? <label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Bulan</span><input type="month" value={input.month} onChange={event => update({ bulan: event.target.value })} className={inputClass} /></label> : null}
          {input.periodMode === 'semester' ? <><label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Tahun</span><select value={input.academicYearStart} onChange={event => update({ tahun: event.target.value })} className={inputClass}>{(options?.academicYearStarts || [input.academicYearStart!]).map(year => <option key={year} value={year}>{year}/{year + 1}</option>)}</select></label><label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Semester</span><select value={input.semester} onChange={event => update({ semester: event.target.value })} className={inputClass}><option value="1">Semester 1 (Jul–Des)</option><option value="2">Semester 2 (Jan–Jun)</option></select></label></> : null}
          {input.periodMode === 'range' ? <><label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Dari</span><input type="date" value={input.from} onChange={event => update({ dari: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Sampai</span><input type="date" value={input.to} onChange={event => update({ sampai: event.target.value })} className={inputClass} /></label></> : null}
          <label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Asrama</span><select value={input.asrama} onChange={event => update({ asrama: event.target.value })} className={inputClass}><option value="">Semua asrama</option>{options?.asrama.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Jenis kelamin</span><select value={input.gender} onChange={event => update({ jk: event.target.value })} className={inputClass}><option value="">Semua</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/70 p-1">{([['unique', 'Santri Unik'], ['episodes', 'Episode'], ['both', 'Keduanya']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => update({ basis: value })} className={`rounded-lg px-3 py-2 text-xs font-bold ${basis === value ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}</div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className={secondary}><Printer className="h-4 w-4" /> Cetak / PDF</button><button type="button" disabled={exporting || !data} onClick={exportExcel} className={secondary}>{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel</button></div>
        </div>
      </div>

      {loading ? <div className="flex justify-center rounded-2xl border bg-white p-16"><Loader2 className="h-7 w-7 animate-spin text-emerald-600" /></div> : data ? <>
        <header className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end"><div><h2 className="text-xl font-black text-slate-900">Laporan Kasus Penyakit POSKESTREN</h2><p className="mt-1 text-xs text-slate-500">{data.period.label} · {data.period.from} s.d. {data.period.to} · WIB</p><p className="mt-1 text-xs text-slate-500">{data.filters.asrama || 'Semua asrama'} · {genderLabel(data.filters.gender)} · Basis {basis === 'unique' ? 'santri unik' : basis === 'episodes' ? 'episode' : 'santri unik dan episode'}</p></div><p className="text-[10px] text-slate-400">Dicetak {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date())} WIB</p></header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Santri terdiagnosis" value={data.totals.diagnosedStudents.toLocaleString('id-ID')} detail="Unik dalam periode" /><MetricCard label="Episode diagnosis" value={data.totals.episodes.toLocaleString('id-ID')} detail="Seluruh pemeriksaan final" tone="blue" /><MetricCard label="Santri aktif" value={data.totals.activeStudents.toLocaleString('id-ID')} detail="Pada akhir periode" tone="amber" /><MetricCard label="Jenis diagnosis" value={data.totals.diagnoses.toLocaleString('id-ID')} detail="Diagnosis tercatat" tone="slate" /></div>
        {data.rows.length ? <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]"><BarChart rows={visibleRows} basis={basis} /><DonutChart rows={visibleRows} basis={basis} /></div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="no-print mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-black text-slate-900">Rincian diagnosis</h3><p className="text-xs text-slate-500">Klik judul kolom untuk mengurutkan.</p></div><label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari diagnosis..." className={`${inputClass} pl-9`} /></label></div><DiseaseTable rows={visibleRows} basis={basis} onSort={changeSort} /></section>
        </> : <EmptyState title="Belum ada kasus penyakit" description="Tidak ada diagnosis final yang sesuai dengan periode dan filter terpilih." />}
      </> : <EmptyState title="Laporan tidak tersedia" description="Periksa kembali periode dan filter yang dipilih." />}
    </div>
  )
}

function BarChart({ rows, basis }: { rows: DiseaseReportRow[]; basis: DiseaseMetricBasis }) {
  const chartRows = [...rows].sort((a, b) => (basis === 'episodes' ? b.episodes - a.episodes : b.uniqueStudents - a.uniqueStudents)).slice(0, 10)
  const max = Math.max(1, ...chartRows.map(row => Math.max(row.uniqueStudents, row.episodes)))
  return <section className="disease-report-card rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="flex items-center gap-2 font-black text-slate-900"><BarChart3 className="h-4 w-4 text-emerald-600" /> Diagnosis terbanyak</h3><p className="mt-1 text-xs text-slate-500">Maksimal 10 diagnosis dari hasil pencarian.</p><div className="mt-5 space-y-3">{chartRows.map(row => <div key={row.diagnosisKey}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-bold text-slate-700">{row.diagnosisName}</span><span className="shrink-0 text-slate-500">{basis === 'both' ? `${row.uniqueStudents} santri · ${row.episodes} episode` : basis === 'episodes' ? `${row.episodes} episode` : `${row.uniqueStudents} santri`}</span></div><div className="space-y-1">{basis !== 'episodes' ? <div className="h-2.5 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${row.uniqueStudents / max * 100}%` }} /></div> : null}{basis !== 'unique' ? <div className="h-2.5 overflow-hidden rounded-full bg-blue-50"><div className="h-full rounded-full bg-blue-600" style={{ width: `${row.episodes / max * 100}%` }} /></div> : null}</div></div>)}</div>{basis === 'both' ? <div className="mt-4 flex gap-4 text-[11px] font-bold text-slate-500"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Santri unik</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />Episode</span></div> : null}</section>
}

function DonutChart({ rows, basis }: { rows: DiseaseReportRow[]; basis: DiseaseMetricBasis }) {
  const value = (row: DiseaseReportRow) => basis === 'episodes' ? row.episodes : row.uniqueStudents
  const sorted = [...rows].sort((a, b) => value(b) - value(a))
  const top = sorted.slice(0, 7)
  const other = sorted.slice(7).reduce((sum, row) => sum + value(row), 0)
  const slices = [...top.map(row => ({ label: row.diagnosisName, value: value(row) })), ...(other ? [{ label: 'Lainnya', value: other }] : [])]
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  return <section className="disease-report-card rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="flex items-center gap-2 font-black text-slate-900"><PieChart className="h-4 w-4 text-blue-600" /> Komposisi diagnosis</h3><p className="mt-1 text-xs text-slate-500">Proporsi pasangan diagnosis–santri{basis === 'episodes' ? ' berdasarkan episode' : ''}.</p><div className="mt-4 flex flex-col items-center gap-5 sm:flex-row"><div className="relative h-40 w-40 shrink-0"><svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-label="Diagram komposisi diagnosis"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="7" />{slices.map((slice, index) => { const size = total ? slice.value / total * 100 : 0; const current = offset; offset += size; return <circle key={slice.label} cx="21" cy="21" r="15.9" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="7" pathLength="100" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={-current} /> })}</svg><div className="absolute inset-0 flex items-center justify-center text-center"><div><strong className="block text-xl text-slate-900">{total}</strong><span className="text-[10px] text-slate-500">total hitungan</span></div></div></div><div className="min-w-0 flex-1 space-y-1.5">{slices.map((slice, index) => <div key={slice.label} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="truncate font-semibold text-slate-700">{slice.label}</span></span><span className="shrink-0 text-slate-500">{formatPercent(total ? slice.value / total * 100 : 0)}</span></div>)}</div></div></section>
}

function DiseaseTable({ rows, basis, onSort }: { rows: DiseaseReportRow[]; basis: DiseaseMetricBasis; onSort: (key: SortKey) => void }) {
  const Header = ({ field, children }: { field: SortKey; children: React.ReactNode }) => <th className="whitespace-nowrap px-3 py-3 text-right"><button type="button" onClick={() => onSort(field)} className="font-black hover:text-emerald-700">{children}</button></th>
  return <><div className="space-y-2 md:hidden">{rows.map(row => <article key={row.diagnosisKey} className="rounded-xl border border-slate-200 p-3"><h4 className="font-black text-slate-800">{row.diagnosisName}</h4><div className="mt-2 grid grid-cols-2 gap-2 text-xs">{basis !== 'episodes' ? <><Value label="Santri unik" value={row.uniqueStudents} /><Value label="% santri sakit" value={formatPercent(row.uniqueSharePercent)} /><Value label="% santri aktif" value={formatPercent(row.uniqueActivePercent)} /></> : null}{basis !== 'unique' ? <><Value label="Episode" value={row.episodes} /><Value label="% episode" value={formatPercent(row.episodeSharePercent)} /><Value label="Per 100 aktif" value={row.episodesPer100Active.toLocaleString('id-ID', { maximumFractionDigits: 2 })} /></> : null}</div></article>)}</div><div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-xs"><thead className="border-y border-slate-200 bg-slate-50 text-slate-500"><tr><th className="px-3 py-3"><button type="button" onClick={() => onSort('diagnosisName')} className="font-black hover:text-emerald-700">Diagnosis</button></th>{basis !== 'episodes' ? <><Header field="uniqueStudents">Santri unik</Header><Header field="uniqueSharePercent">% santri sakit</Header><Header field="uniqueActivePercent">% santri aktif</Header></> : null}{basis !== 'unique' ? <><Header field="episodes">Episode</Header><Header field="episodeSharePercent">% episode</Header><Header field="episodesPer100Active">Episode/100 aktif</Header></> : null}</tr></thead><tbody>{rows.map(row => <tr key={row.diagnosisKey} className="border-b border-slate-100"><td className="px-3 py-3 font-bold text-slate-800">{row.diagnosisName}</td>{basis !== 'episodes' ? <><td className="px-3 py-3 text-right font-black">{row.uniqueStudents}</td><td className="px-3 py-3 text-right">{formatPercent(row.uniqueSharePercent)}</td><td className="px-3 py-3 text-right">{formatPercent(row.uniqueActivePercent)}</td></> : null}{basis !== 'unique' ? <><td className="px-3 py-3 text-right font-black">{row.episodes}</td><td className="px-3 py-3 text-right">{formatPercent(row.episodeSharePercent)}</td><td className="px-3 py-3 text-right">{row.episodesPer100Active.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td></> : null}</tr>)}</tbody></table></div></>
}

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[10px] font-bold uppercase text-slate-400">{label}</span><strong className="mt-0.5 block text-slate-700">{value}</strong></div>
}
