'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ArrowClockwise, CheckCircle, DownloadSimple, GearSix, IdentificationCard, ListChecks,
  Play, Printer, Scan, UsersThree, Warning,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  createQrBatchAction, getCredentialBatchAction, getCredentialFilters, getLatestCredentialBatchAction,
  issueCredentialAction, processQrBatchAction, searchCredentialStudents,
  type CredentialStudentRow,
} from './actions'
import { useKeyboardWedgeScanner } from '@/lib/finance/scanner-client'
import { CredentialActions } from './_credential-actions'
import {
  ConfirmAction, FinanceTour, ResultBanner, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'

const TOUR: TourStep[] = [
  { target: '[data-tour="tabs"]', title: 'Lima tahap penerbitan', body: 'Mulai dari Pilih Santri, lalu jalankan batch QR, lanjut ke cetak kartu.' },
  { target: '[data-tour="select"]', title: 'Saring lalu pilih', body: 'Filter lanjutan bisa menyaring santri yang belum punya QR, sehingga tidak ada yang terlewat maupun tercetak dua kali.' },
  { target: '[data-tour="run"]', title: 'Jalankan enrollment', body: 'Batch QR berjalan otomatis dan bisa dilanjutkan bila terputus tanpa membuat kartu ganda.' },
  { target: '[data-tour="mode"]', title: 'Mode menentukan yang diterima loket', body: 'Mengubah mode akan menangguhkan kredensial jenis lain di seluruh pesantren. Pakai mode transisi bila ingin berpindah bertahap.' },
]

type Filters = { q: string; asrama: string; kamar: string; kelas: string; status: string }
type Options = { asramas: string[]; kamars: string[]; kelas: string[] }
type Batch = {
  id: string; status: string; total_count: number; processed_count: number
  success_count: number; failed_count: number
  errors?: Array<{ santri_id: string; error_message: string | null }>
} | null
type CardPreview = {
  id: string; cardNumber: string; nis: string; name: string
  asrama: string | null; kamar: string | null; photoUrl: string | null; kelas: string | null; qrSvg: string
}
export type CredentialInventoryRow = {
  id: string; santri_id: string; credential_kind: 'QR_STATIC'
  card_number: string | null; status: string; print_count: number; nis: string; nama_lengkap: string
}
type CredentialTab = 'enrollment' | 'qr' | 'cards' | 'settings'
type Selectable = { id: string; qr_id: string | null }

const emptyFilters: Filters = { q: '', asrama: '', kamar: '', kelas: '', status: 'ALL' }

const badge = (value: string | null) => value
  ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${value === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{value}</span>
  : <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">BELUM ADA</span>

function EmptyTab({ icon: Icon, title, description, action }: {
  icon: typeof IdentificationCard; title: string; description: string; action: () => void
}) {
  return <section className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-white p-6 text-center">
    <div>
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-7 w-7" /></span>
      <h2 className="mt-4 font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      <button type="button" onClick={action} className="mt-4 min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Buka Pilih Santri</button>
    </div>
  </section>
}

export function CredentialClient({ credentials }: { credentials: CredentialInventoryRow[] }) {
  const [pending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<CredentialTab>('enrollment')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [options, setOptions] = useState<Options>({ asramas: [], kamars: [], kelas: [] })
  const [rows, setRows] = useState<CredentialStudentRow[]>([])
  const [allSelectable, setAllSelectable] = useState<Selectable[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [batch, setBatch] = useState<Batch>(null)
  const [readerTest, setReaderTest] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [exporting, setExporting] = useState<number | null>(null)
  const [preview, setPreview] = useState<CardPreview | null>(null)
  const [result, setResult] = useState<FinanceResult | null>(null)
  const tour = useFinanceTour('kredensial')

  const load = useCallback(async (nextPage = page, nextFilters = filters, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const found = await searchCredentialStudents({ ...nextFilters, page: nextPage, pageSize: nextPageSize })
      setRows(found.rows)
      setAllSelectable(found.allSelectable)
      setTotal(found.total)
      setTotalPages(found.totalPages)
      setPage(found.page)
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  useEffect(() => {
    getCredentialFilters().then(setOptions)
    getLatestCredentialBatchAction().then(value => setBatch(value as Batch))
    void load(1, filters, 50)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  useKeyboardWedgeScanner(setReaderTest, activeTab === 'settings')

  const selectedRows = useMemo(() => allSelectable.filter(row => selected.has(row.id)), [allSelectable, selected])
  const qrIds = selectedRows.map(row => row.qr_id).filter((id): id is string => Boolean(id))
  const volumes = Array.from({ length: Math.ceil(qrIds.length / 400) }, (_, index) => qrIds.slice(index * 400, index * 400 + 400))
  const pageSelected = rows.length > 0 && rows.every(row => selected.has(row.id))
  const allFilteredSelected = allSelectable.length > 0 && allSelectable.every(row => selected.has(row.id))

  const togglePage = () => setSelected(current => {
    const next = new Set(current)
    if (pageSelected) rows.forEach(row => next.delete(row.id))
    else rows.forEach(row => next.add(row.id))
    return next
  })

  const selectAllFiltered = () => setSelected(allFilteredSelected ? new Set() : new Set(allSelectable.map(row => row.id)))

  const runBatch = async (batchId: string) => {
    let active = await getCredentialBatchAction(batchId) as Batch
    setBatch(active)
    while (active && ['PENDING', 'PROCESSING', 'COMPLETED_WITH_ERRORS'].includes(active.status)) {
      const outcome = await processQrBatchAction(batchId)
      if ('error' in outcome) { toast.error(outcome.error); break }
      active = outcome.batch as Batch
      setBatch(active)
      if (active && ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(active.status)) break
    }
    await load(page)
    toast.success(active?.failed_count ? `Batch selesai dengan ${active.failed_count} kegagalan.` : 'Penerbitan QR selesai.')
  }

  const createQrBatch = () => {
    setActiveTab('qr')
    startTransition(async () => {
      const ids = [...selected]
      if (!ids.length) { toast.error('Pilih santri terlebih dahulu.'); setActiveTab('enrollment'); return }
      const created = await createQrBatchAction({ santriIds: ids, filter: filters })
      if ('error' in created) { toast.error(created.error); return }
      await runBatch(created.id)
    })
  }

  const downloadVolume = async (ids: string[], index: number) => {
    setExporting(index)
    try {
      const response = await fetch('/api/finance/credentials/cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialIds: ids }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Gagal membuat PDF kartu.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kartu-qr-santri-volume-${index + 1}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`PDF volume ${index + 1} diunduh.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat PDF.')
    } finally {
      setExporting(null)
    }
  }

  const loadPreview = async () => {
    if (!qrIds[0]) return
    const response = await fetch(`/api/finance/credentials/cards?id=${encodeURIComponent(qrIds[0])}`, { cache: 'no-store' })
    const payload = await response.json() as CardPreview & { error?: string }
    if (!response.ok) { toast.error(payload.error || 'Preview tidak tersedia.'); return }
    setPreview(payload)
  }

  const tabs: Array<{ id: CredentialTab; label: string; description: string; icon: typeof UsersThree; badge?: number | string }> = [
    { id: 'enrollment', label: 'Pilih Santri', description: 'Cari & pilih', icon: UsersThree, badge: selected.size || undefined },
    { id: 'qr', label: 'Batch QR', description: 'Progres terbit', icon: ListChecks, badge: batch?.failed_count || undefined },
    { id: 'cards', label: 'Kartu', description: 'Preview & PDF', icon: Printer, badge: qrIds.length || undefined },
    { id: 'settings', label: 'Pengaturan', description: 'Mode & alat', icon: GearSix },
  ]

  const resetFilters = () => {
    setFilters(emptyFilters)
    setSelected(new Set())
    void load(1, emptyFilters)
  }

  return <div className="space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <nav data-tour="tabs" aria-label="Bagian modul Keredensial"
      className="sticky top-2 z-30 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
      <div className="flex min-w-max gap-1" role="tablist">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(tab.id)}
            className={`relative flex min-h-14 min-w-36 items-center gap-2 rounded-xl px-3 py-2 text-left transition ${active ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon className="h-5 w-5 shrink-0" weight={active ? 'fill' : 'regular'} />
            <span>
              <span className="block text-sm font-bold leading-tight">{tab.label}</span>
              <span className={`block text-[10px] ${active ? 'text-emerald-100' : 'text-slate-400'}`}>{tab.description}</span>
            </span>
            {tab.badge ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-white text-emerald-800' : 'bg-emerald-50 text-emerald-700'}`}>{tab.badge}</span> : null}
          </button>
        })}
      </div>
    </nav>

    {activeTab === 'settings' ? <section className="grid gap-4" role="tabpanel">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2"><Scan className="h-5 w-5 text-emerald-700" /><h2 className="font-bold">Uji USB reader / scanner</h2></div>
        <p className="mt-1 text-xs text-slate-500">Klik area kosong, lalu tempel kartu atau scan QR. Reader harus mengirim Enter.</p>
        <div className="mt-3 rounded-xl border border-dashed p-4 font-mono text-sm">
          {readerTest ? <span className="text-emerald-700">Terbaca: {readerTest}</span> : <span className="text-slate-400">Siap menerima scan...</span>}
        </div>
      </div>
    </section> : null}

    {activeTab === 'enrollment' ? <section className="rounded-xl border bg-white" role="tabpanel">
      <div className="border-b p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-bold">Pilih santri</h2>
            <p className="text-xs text-slate-500">Saring hasil, pilih sebagian atau semua, lalu jalankan penerbitan. Kolom QR menunjukkan siapa yang belum punya kartu.</p>
          </div>
          <div data-tour="run" className="flex flex-wrap gap-2">
            <button onClick={createQrBatch} disabled={pending || !selected.size} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Play className="h-4 w-4" />Terbitkan QR ({selected.size})</button>
            <button onClick={() => setActiveTab('cards')} disabled={!selected.size} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"><Printer className="h-4 w-4" />Cetak kartu</button>
          </div>
        </div>

        <div data-tour="select" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })}
            onKeyDown={event => { if (event.key === 'Enter') void load(1) }}
            placeholder="Cari nama atau NIS lalu tekan Enter..." className="min-h-11 flex-1 rounded-xl border px-3" />
          <div className="flex gap-2">
            <button onClick={() => setShowFilterModal(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold"><ListChecks className="h-4 w-4" />Filter Lanjutan</button>
            <button onClick={() => void load(1)} className="min-h-11 rounded-xl bg-emerald-700 px-4 font-bold text-white">Cari</button>
            {filters.asrama || filters.kamar || filters.kelas || filters.status !== 'ALL'
              ? <button onClick={resetFilters} className="min-h-11 px-3 text-sm text-slate-500">Reset</button>
              : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={pageSelected} onChange={togglePage} /> Pilih halaman</label>
          <button onClick={selectAllFiltered} className="font-bold text-emerald-700">{allFilteredSelected ? 'Batalkan semua' : `Pilih semua ${total} hasil`}</button>
        </div>
        <span>{selected.size} dipilih</span>
      </div>

      <div className="divide-y">
        {loading ? <p className="p-10 text-center text-sm text-slate-500">Memuat santri...</p>
          : rows.length ? rows.map(row => <label key={row.id} className="grid cursor-pointer gap-3 p-3 hover:bg-slate-50 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => setSelected(current => {
              const next = new Set(current)
              if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
              return next
            })} />
            <div className="flex min-w-0 items-center gap-3">
              {row.foto_url
                ? <img src={row.foto_url} alt="" className="h-11 w-9 rounded object-cover" />
                : <div className="grid h-11 w-9 place-items-center rounded bg-slate-100 text-xs font-bold">{row.nama_lengkap.slice(0, 1)}</div>}
              <div>
                <p className="font-semibold">{row.nama_lengkap}</p>
                <p className="text-xs text-slate-500">{row.nis} · {row.kelas_pesantren || '-'} · {row.asrama || '-'} / {row.kamar || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs"><span>QR</span>{badge(row.qr_status)}</div>
          </label>)
            : <p className="p-10 text-center text-sm text-slate-500">Tidak ada santri sesuai filter.</p>}
      </div>

      <div className="flex items-center justify-between p-3 text-sm">
        <button disabled={page <= 1} onClick={() => void load(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Sebelumnya</button>
        <div className="flex items-center gap-3">
          <span>Halaman {page} / {totalPages}</span>
          <select value={pageSize} onChange={event => {
            const next = Number(event.target.value)
            setPageSize(next)
            void load(1, filters, next)
          }} className="rounded-lg border px-2 py-1">
            <option value={50}>50 baris</option>
            <option value={100}>100 baris</option>
            <option value={5000}>Semua baris</option>
          </select>
        </div>
        <button disabled={page >= totalPages} onClick={() => void load(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Berikutnya</button>
      </div>
    </section> : null}

    {activeTab === 'qr' ? <div role="tabpanel">
      {batch ? <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div><h2 className="font-bold">Batch QR terakhir</h2><p className="text-xs text-slate-500">{batch.id}</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{batch.status}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-600" style={{ width: `${batch.total_count ? batch.processed_count / batch.total_count * 100 : 0}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span>{batch.processed_count}/{batch.total_count} diproses</span>
          <span className="text-emerald-700">{batch.success_count} baru</span>
          <span>{batch.processed_count - batch.success_count - batch.failed_count} dilewati</span>
          <span className="text-red-700">{batch.failed_count} gagal</span>
        </div>
        {['PROCESSING', 'PENDING', 'COMPLETED_WITH_ERRORS'].includes(batch.status)
          ? <button disabled={pending} onClick={() => startTransition(() => runBatch(batch.id))} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold"><ArrowClockwise className="h-4 w-4" />Lanjutkan / retry</button>
          : null}
        {batch.errors?.length ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">
          {batch.errors.map(error => <p key={error.santri_id}>{error.santri_id}: {error.error_message}</p>)}
        </div> : null}
      </section>
        : <EmptyTab icon={ListChecks} title="Belum ada batch QR" description="Pilih santri lalu mulai penerbitan QR dari tab Pilih Santri." action={() => setActiveTab('enrollment')} />}
    </div> : null}

    {activeTab === 'cards' ? <div className="space-y-5" role="tabpanel">
      <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="font-bold">Export kartu QR CR80 dua sisi</h2>
            <p className="text-xs text-slate-500">Delapan kartu per A4. Halaman belakang sudah dicerminkan untuk duplex long-edge.</p>
          </div>
        </div>
        {!qrIds.length
          ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Warning className="mr-1 inline h-4 w-4" />Pilih santri yang sudah memiliki QR aktif pada tab Pilih Santri.</p>
          : <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button onClick={() => void loadPreview()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><IdentificationCard className="h-4 w-4" />Preview kartu pertama</button>
            {volumes.map((ids, index) => <button key={index} disabled={exporting !== null} onClick={() => void downloadVolume(ids, index)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50">
              <DownloadSimple className="h-4 w-4" />{exporting === index ? 'Membuat PDF...' : `Unduh volume ${index + 1} (${ids.length} kartu)`}
            </button>)}
          </div>}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-bold">100 credential terbaru</h2>
          <p className="text-xs text-slate-500">Terbitkan ulang, blokir, tandai hilang, atau cabut credential.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {credentials.length ? credentials.map(credential => <div key={credential.id} className="flex flex-col gap-2 px-4 py-3 text-xs lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-slate-800">{credential.nama_lengkap}</p>
              <p className="text-slate-500">{credential.nis} · {credential.card_number || credential.credential_kind}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={credential.status === 'ACTIVE' ? 'emerald' : 'red'}>{credential.status}</StatusBadge>
              {credential.credential_kind === 'QR_STATIC' ? <span className="text-slate-500">Dicetak {credential.print_count || 0}×</span> : null}
              <CredentialActions id={credential.id} santriId={credential.santri_id} status={credential.status} />
            </div>
          </div>) : <p className="p-10 text-center text-sm text-slate-500">Belum ada credential.</p>}
        </div>
      </section>
    </div> : null}

    {preview ? <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/75 p-4" onClick={() => setPreview(null)}>
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Preview kartu CR80 dua sisi</h2>
            <p className="text-xs text-slate-500">Tampilan diperkecil; PDF memakai ukuran fisik 85,60 × 53,98 mm.</p>
          </div>
          <button onClick={() => setPreview(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">Tutup</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="aspect-[1.586] overflow-hidden rounded-xl border bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow">
            <div className="flex items-center gap-3 border-b border-emerald-600 pb-3">
              <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />
              <div>
                <b className="text-xs text-emerald-800">PONDOK PESANTREN SUKAHIDENG</b>
                <p className="text-[10px] text-slate-500">Kartu Identitas Santri</p>
              </div>
            </div>
            <div className="mt-4 flex gap-4">
              {preview.photoUrl
                ? <img src={preview.photoUrl} alt="" className="h-28 w-24 rounded-lg object-cover" />
                : <div className="grid h-28 w-24 place-items-center rounded-lg bg-slate-200 text-xl font-black">{String(preview.name).slice(0, 1)}</div>}
              <div>
                <h3 className="font-black uppercase">{preview.name}</h3>
                <p className="text-xs font-bold text-emerald-700">NIS {preview.nis}</p>
                <p className="mt-3 text-xs">Kelas: <b>{preview.kelas || '-'}</b><br />Asrama: <b>{preview.asrama || '-'}</b><br />Kamar: <b>{preview.kamar || '-'}</b></p>
              </div>
            </div>
          </div>
          <div className="flex aspect-[1.586] items-center gap-5 rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white shadow">
            <div className="h-32 w-32 shrink-0 rounded-lg bg-white p-2 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: preview.qrSvg }} />
            <div>
              <b>SCAN DI LOKET KEUANGAN</b>
              <p className="mt-2 font-mono text-xs text-emerald-100">{preview.cardNumber}</p>
              <p className="mt-3 text-xs">Kartu bukan penyimpan saldo. Setiap transaksi tetap memerlukan PIN.</p>
            </div>
          </div>
        </div>
      </div>
    </div> : null}

    {showFilterModal ? <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/75 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Filter Lanjutan</h2>
          <button onClick={() => setShowFilterModal(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold">Tutup</button>
        </div>
        <div className="grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-bold">Asrama</span>
            <select value={filters.asrama} onChange={event => setFilters({ ...filters, asrama: event.target.value })} className="min-h-11 w-full rounded-xl border px-3">
              <option value="">Semua asrama</option>{options.asramas.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Kamar</span>
            <select value={filters.kamar} onChange={event => setFilters({ ...filters, kamar: event.target.value })} className="min-h-11 w-full rounded-xl border px-3">
              <option value="">Semua kamar</option>{options.kamars.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Kelas</span>
            <select value={filters.kelas} onChange={event => setFilters({ ...filters, kelas: event.target.value })} className="min-h-11 w-full rounded-xl border px-3">
              <option value="">Semua kelas</option>{options.kelas.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Status Kepemilikan</span>
            <select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} className="min-h-11 w-full rounded-xl border px-3">
              <option value="ALL">Semua status</option>
              <option value="MISSING_QR">Belum punya QR</option>
              <option value="HAS_QR">Sudah punya QR</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => { resetFilters(); setShowFilterModal(false) }} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-500">Reset Filter</button>
          <button onClick={() => { void load(1); setShowFilterModal(false) }} className="min-h-11 rounded-xl bg-emerald-700 px-6 font-bold text-white shadow-sm">Terapkan Filter</button>
        </div>
      </div>
    </div> : null}
  </div>
}
