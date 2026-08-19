'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FINANCE_FIELD_CLASS, FinanceTabs, FinanceTour, FormField, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { RupiahInput, SantriPicker } from '../_components/finance-inputs'
import {
  addArrearsAction, addTariffAction, generateBillsAction, markArrearsLunasAction, saveBillingStartAction,
  setExemptionAction, addSkipAction, cabutSkipAction, catatBebasTahunanAction, hapusBebasTahunanAction,
  type SantriSearchRow, type BebasTahunanRow,
} from './actions'
import type { ServiceKind, ServiceTariffRow } from '@/lib/finance/service-tariffs'
import type { MealServiceKind, ServiceArrearsWithStudent, ServiceBillSkipRow } from '@/lib/finance/service-billing'
import type { PermanentExemptionKind, ExemptedSantriRow } from '@/lib/finance/exemptions'
import type { SppBillingStart } from '@/lib/spp/tunggakan'
import { NON_SPP_JENIS_ALL, type NonSppJenis } from '@/lib/keuangan/non-spp-jenis'

type TabData = {
  tariffs: ServiceTariffRow[]
  billingStart: SppBillingStart | null
  arrears: ServiceArrearsWithStudent[]
}

const TABS: { id: ServiceKind; label: string }[] = [
  { id: 'SPP', label: 'SPP' },
  { id: 'MAKAN', label: 'Uang Makan' },
  { id: 'LAUNDRY', label: 'Uang Laundry' },
]

function currentYyyymm() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`
}

const TOUR: TourStep[] = [
  { target: '[data-tour="pembebasan"]', title: 'Bebaskan biaya lebih dulu', body: 'Santri yang dibebaskan biaya sebaiknya dicatat sebelum tagihan dibuat. Pembebasan setelah tagihan terbit tidak menghapus tagihan yang sudah ada.' },
  { target: '[data-tour="layanan"]', title: 'Tiga layanan, satu pola', body: 'SPP, Uang Makan, dan Uang Laundry memakai sistem tarif yang sama. Makan dan Laundry punya tambahan generate tagihan, skip, dan tunggakan.' },
  { target: '[data-tour="mulai"]', title: 'Tanggal awal tagihan', body: 'Bulan pertama santri mulai ditagih. Santri yang masuk setelah bulan ini otomatis mulai dari bulan masuknya sendiri.' },
  { target: '[data-tour="tarif"]', title: 'Tarif berjenjang waktu', body: 'Tarif baru ditambahkan beserta bulan efektifnya, bukan menimpa yang lama. Karena itu ganti tarif di tengah tahun tidak mengubah tagihan bulan yang sudah terbit.' },
]

export function TarifLayananClient({ initialData, exempted, bebasTahunan, skip }: {
  initialData: Record<ServiceKind, TabData>
  exempted: ExemptedSantriRow[]
  bebasTahunan: BebasTahunanRow[]
  skip: Record<MealServiceKind, ServiceBillSkipRow[]>
}) {
  /** Jenis layanan turun jadi dropdown supaya tidak ada dua baris tab bertumpuk. */
  const [layanan, setLayanan] = useState<ServiceKind>('SPP')
  /** Tab mengelompokkan pekerjaan, bukan jenis layanan. */
  const [tab, setTab] = useState<'tarif' | 'generate' | 'pengecualian'>('tarif')
  const data = initialData[layanan]
  const tour = useFinanceTour('tarif-layanan')
  const layananLabel = TABS.find(item => item.id === layanan)?.label ?? layanan

  return (
    <div className="space-y-4 sm:space-y-5">
      <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />

      <div data-tour="layanan" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="text-xs font-bold text-slate-800">
          Jenis layanan
          <select value={layanan} onChange={event => setLayanan(event.target.value as ServiceKind)}
            className={`mt-1 ${FINANCE_FIELD_CLASS} sm:w-64`}>
            {TABS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <p className="text-[11px] leading-4 text-slate-500 sm:max-w-md sm:text-right">
          Seluruh panel di bawah mengikuti jenis layanan yang dipilih di sini.
          {layanan === 'SPP' ? ' SPP tidak punya generate bulanan maupun pengecualian per bulan.' : ''}
        </p>
      </div>

      <FinanceTabs
        label="Kelompok pekerjaan tarif layanan"
        active={tab}
        onChange={(id: string) => setTab(id as typeof tab)}
        tabs={[
          { id: 'tarif', label: 'Tarif', hint: `Tanggal awal dan riwayat tarif ${layananLabel}` },
          { id: 'generate', label: 'Generate tagihan', hint: 'Buat tagihan bulanan dan catat tunggakan lama' },
          { id: 'pengecualian', label: 'Pengecualian', hint: 'Lewati bulan tertentu dan bebaskan biaya santri' },
        ]}
      />

      {tab === 'tarif' ? <>
        <BillingStartPanel serviceKind={layanan} billingStart={data.billingStart} />
        <TariffPanel serviceKind={layanan} tariffs={data.tariffs} />
      </> : null}

      {tab === 'generate' ? (layanan === 'SPP'
        ? <SectionPanel title="Tidak berlaku untuk SPP" description="Tagihan SPP dibuat lewat jadwal otomatis, bukan dari halaman ini.">
            <p className="p-4 text-xs text-slate-500">Pilih Uang Makan atau Uang Laundry untuk memakai generate bulanan dan backfill tunggakan.</p>
          </SectionPanel>
        : <>
            <GenerateBillsPanel serviceKind={layanan as MealServiceKind} />
            <ArrearsPanel serviceKind={layanan as MealServiceKind} arrears={data.arrears} />
          </>) : null}

      {tab === 'pengecualian' ? <>
        {layanan === 'SPP'
          ? null
          : <SkipTagihanPanel serviceKind={layanan as MealServiceKind} rows={skip[layanan as MealServiceKind]} />}
        <div data-tour="pembebasan"><PembebasanBiayaPanel exempted={exempted} bebasTahunan={bebasTahunan} /></div>
      </> : null}
    </div>
  )
}

function BillingStartPanel({ serviceKind, billingStart }: { serviceKind: ServiceKind; billingStart: SppBillingStart | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(billingStart?.value ?? '')
  const [result, setResult] = useState<FinanceResult | null>(null)

  function handleSave() {
    if (pending) return
    startTransition(async () => {
      const res = await saveBillingStartAction({ serviceKind, value })
      if (!res.success) {
        setResult({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResult({ tone: 'success', message: 'Tanggal awal tagihan disimpan.' })
      toast.success('Tanggal awal tagihan disimpan.')
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Tanggal Awal Tagihan" description="Bulan pertama santri mulai ditagih (santri yang masuk setelah tanggal ini otomatis mulai dari bulan masuknya).">
      <div data-tour="mulai" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <FormField label="Bulan mulai (YYYY-MM)">
            <input type="month" value={value} onChange={e => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
        </div>
        <button type="button" disabled={pending || !value} onClick={handleSave}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
          Simpan
        </button>
      </div>
      {result && <div className="px-4 pb-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
    </SectionPanel>
  )
}

function TariffPanel({ serviceKind, tariffs }: { serviceKind: ServiceKind; tariffs: ServiceTariffRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [effectiveMonth, setEffectiveMonth] = useState(currentYyyymm())
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)

  function handleAdd() {
    if (pending) return
    const amountRupiah = Number(amount)
    startTransition(async () => {
      const res = await addTariffAction({ serviceKind, effectiveMonth, amountRupiah })
      if (!res.success) {
        setResult({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResult({ tone: 'success', message: `Tarif ${formatRupiah(amountRupiah)} berlaku mulai ${effectiveMonth}.` })
      toast.success('Tarif baru disimpan.')
      setAmount('')
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Riwayat Tarif" description="Tarif baru cuma berlaku untuk tagihan yang dibuat mulai bulan itu — tagihan bulan sebelumnya yang sudah ada tidak berubah.">
      <div data-tour="tarif" className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-40">
          <FormField label="Berlaku mulai">
            <input type="month" value={effectiveMonth} onChange={e => setEffectiveMonth(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
        </div>
        <div className="w-full sm:w-56">
          <FormField label="Nominal">
            <RupiahInput value={Number(amount) || 0} onValueChange={next => setAmount(next ? String(next) : '')} min={1} />
          </FormField>
        </div>
        <button type="button" disabled={pending || !amount} onClick={handleAdd}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
          Tambah Tarif
        </button>
      </div>
      {result && <div className="px-4 pt-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
      <div className="divide-y divide-slate-100">
        {tariffs.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">Belum ada tarif yang diatur.</p>
        ) : (
          tariffs.map(row => (
            <div key={row.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="font-semibold text-slate-700">{row.effective_month}</span>
              <span className="font-bold text-slate-900">{formatRupiah(row.amount_rupiah)}</span>
            </div>
          ))
        )}
      </div>
    </SectionPanel>
  )
}

function GenerateBillsPanel({ serviceKind }: { serviceKind: MealServiceKind }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [yyyymm, setYyyymm] = useState(currentYyyymm())
  const [result, setResult] = useState<FinanceResult | null>(null)

  function handleGenerate() {
    if (pending) return
    startTransition(async () => {
      const res = await generateBillsAction({ serviceKind, yyyymm })
      if (!res.success) {
        setResult({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResult({
        tone: 'success',
        message: `${res.created} tagihan baru dibuat.`,
        detail: `${res.skippedExisting} santri sudah punya tagihan bulan ini, ${res.skippedNotBillable} belum masuk periode tagihan, dari ${res.totalEligible} santri yang ditempatkan ke vendor.`,
      })
      toast.success(`${res.created} tagihan dibuat.`)
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Generate Tagihan Bulanan" description="Buat tagihan untuk semua santri yang sudah ditempatkan ke vendor — aman diklik ulang, santri yang sudah punya tagihan bulan ini dilewati.">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <FormField label="Bulan tagihan">
            <input type="month" value={yyyymm} onChange={e => setYyyymm(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
        </div>
        <button type="button" disabled={pending} onClick={handleGenerate}
          className="h-10 shrink-0 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">
          {pending ? 'Memproses...' : `Generate Tagihan ${yyyymm}`}
        </button>
      </div>
      {result && <div className="px-4 pb-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
    </SectionPanel>
  )
}

function ArrearsPanel({ serviceKind, arrears }: { serviceKind: MealServiceKind; arrears: ServiceArrearsWithStudent[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [selectedSantri, setSelectedSantri] = useState<SantriSearchRow | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)

  function handleAdd() {
    if (pending || !selectedSantri) return
    const amountRupiah = Number(amount)
    startTransition(async () => {
      const res = await addArrearsAction({ serviceKind, santriId: selectedSantri.id, label, amountRupiah })
      if ('error' in res) {
        setResult({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResult({ tone: 'success', message: `Tunggakan lama ${selectedSantri.nama_lengkap} berhasil dicatat.` })
      toast.success('Tunggakan lama dicatat.')
      setSelectedSantri(null)
      setLabel('')
      setAmount('')
      router.refresh()
    })
  }

  function handleMarkLunas(id: string) {
    if (markingId) return
    setMarkingId(id)
    startTransition(async () => {
      const res = await markArrearsLunasAction(id)
      setMarkingId(null)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Ditandai lunas.')
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Tunggakan Lama (Backfill)" description="Catat utang dari sebelum fitur ini ada — bentuk bebas, tidak perlu per bulan presisi.">
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-4 sm:items-end">
        <FormField label="Santri">
          <SantriPicker selected={selectedSantri} onSelect={setSelectedSantri} />
        </FormField>
        <FormField label="Label">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Tunggakan sebelum Agustus 2026" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </FormField>
        <FormField label="Nominal (Rp)">
          <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="200000" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </FormField>
        <button type="button" disabled={pending || !selectedSantri || !label || !amount} onClick={handleAdd}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
          Tambah
        </button>
      </div>
      {result && <div className="px-4 pt-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
      <div className="divide-y divide-slate-100">
        {arrears.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">Belum ada tunggakan lama yang dicatat.</p>
        ) : (
          arrears.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-800">{row.full_name} <span className="font-normal text-slate-400">({row.nis})</span></p>
                <p className="text-slate-500">{row.label} — {formatRupiah(row.amount_rupiah)}</p>
              </div>
              {row.status === 'LUNAS' ? (
                <StatusBadge tone="emerald">Lunas</StatusBadge>
              ) : (
                <button type="button" disabled={markingId === row.id} onClick={() => handleMarkLunas(row.id)}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50">
                  Tandai Lunas
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </SectionPanel>
  )
}

const PERMANENT_KINDS: { id: PermanentExemptionKind; label: string }[] = [
  { id: 'SPP', label: 'SPP' },
  { id: 'MAKAN', label: 'Uang Makan' },
  { id: 'LAUNDRY', label: 'Uang Laundry' },
  { id: 'USPP', label: 'USPP' },
]

const TAHUNAN_LABEL: Record<NonSppJenis, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB',
  EKSKUL: 'Ekstrakurikuler',
}

function SkipTagihanPanel({ serviceKind, rows }: { serviceKind: MealServiceKind; rows: ServiceBillSkipRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [cabutId, setCabutId] = useState<string | null>(null)
  const [selectedSantri, setSelectedSantri] = useState<SantriSearchRow | null>(null)
  const [yyyymm, setYyyymm] = useState(currentYyyymm())
  const [alasan, setAlasan] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)

  function handleAdd() {
    if (pending || !selectedSantri) return
    const [tahun, bulan] = yyyymm.split('-').map(Number)
    startTransition(async () => {
      const res = await addSkipAction({ serviceKind, santriId: selectedSantri.id, tahun, bulan, alasan })
      if (!res.success) {
        setResult({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResult({ tone: 'success', message: `Tagihan ${selectedSantri.nama_lengkap} bulan ${yyyymm} ditiadakan.` })
      toast.success('Skip tagihan disimpan.')
      setSelectedSantri(null)
      setAlasan('')
      router.refresh()
    })
  }

  function handleCabut(id: string) {
    if (cabutId) return
    setCabutId(id)
    startTransition(async () => {
      await cabutSkipAction(id)
      setCabutId(null)
      toast.success('Skip tagihan dicabut.')
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Skip Tagihan Bulan Tertentu" description="Satu santri tidak ditagih untuk satu bulan spesifik — beda dari pembebasan permanen di atas. Berlaku sebelum tombol Generate Tagihan diklik untuk bulan itu.">
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-4 sm:items-end">
        <FormField label="Santri">
          <SantriPicker selected={selectedSantri} onSelect={setSelectedSantri} />
        </FormField>
        <FormField label="Bulan">
          <input type="month" value={yyyymm} onChange={e => setYyyymm(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </FormField>
        <FormField label="Alasan">
          <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Pulang pasca pelepasan" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </FormField>
        <button type="button" disabled={pending || !selectedSantri} onClick={handleAdd}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
          Tiadakan
        </button>
      </div>
      {result && <div className="px-4 pt-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">Belum ada skip tagihan aktif.</p>
        ) : (
          rows.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-800">{row.full_name} <span className="font-normal text-slate-400">({row.nis})</span></p>
                <p className="text-slate-500">{row.tahun}-{String(row.bulan).padStart(2, '0')}{row.alasan ? ` — ${row.alasan}` : ''}</p>
              </div>
              <button type="button" disabled={cabutId === row.id} onClick={() => handleCabut(row.id)}
                className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50">
                Cabut
              </button>
            </div>
          ))
        )}
      </div>
    </SectionPanel>
  )
}

function PembebasanBiayaPanel({ exempted, bebasTahunan }: { exempted: ExemptedSantriRow[]; bebasTahunan: BebasTahunanRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedSantri, setSelectedSantri] = useState<SantriSearchRow | null>(null)
  const [checked, setChecked] = useState<Set<PermanentExemptionKind>>(new Set())
  const [alasan, setAlasan] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)

  const [selectedSantriTahunan, setSelectedSantriTahunan] = useState<SantriSearchRow | null>(null)
  const [jenis, setJenis] = useState<NonSppJenis>('KESEHATAN')
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [keterangan, setKeterangan] = useState('')
  const [resultTahunan, setResultTahunan] = useState<FinanceResult | null>(null)

  function toggleKind(kind: PermanentExemptionKind) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function handleSavePermanen() {
    if (pending || !selectedSantri || checked.size === 0) return
    startTransition(async () => {
      for (const serviceKind of checked) {
        const res = await setExemptionAction({ santriId: selectedSantri.id, serviceKind, isActive: true, alasan })
        if (!res.success) {
          setResult({ tone: 'error', message: res.error })
          toast.error(res.error)
          return
        }
      }
      setResult({ tone: 'success', message: `${selectedSantri.nama_lengkap} dibebaskan dari ${Array.from(checked).join(', ')}.` })
      toast.success('Pembebasan disimpan.')
      setSelectedSantri(null)
      setChecked(new Set())
      setAlasan('')
      router.refresh()
    })
  }

  function handleCabutPermanen(santriId: string, serviceKind: PermanentExemptionKind) {
    startTransition(async () => {
      await setExemptionAction({ santriId, serviceKind, isActive: false })
      toast.success('Pembebasan dicabut.')
      router.refresh()
    })
  }

  function handleSaveTahunan() {
    if (pending || !selectedSantriTahunan) return
    startTransition(async () => {
      const res = await catatBebasTahunanAction({ santriId: selectedSantriTahunan.id, jenis, tahun, keterangan })
      if ('error' in res) {
        setResultTahunan({ tone: 'error', message: res.error })
        toast.error(res.error)
        return
      }
      setResultTahunan({ tone: 'success', message: `${selectedSantriTahunan.nama_lengkap} dibebaskan dari ${TAHUNAN_LABEL[jenis]} tahun ${tahun}.` })
      toast.success('Pembebasan tahunan disimpan.')
      setSelectedSantriTahunan(null)
      setKeterangan('')
      router.refresh()
    })
  }

  function handleCabutTahunan(row: BebasTahunanRow) {
    startTransition(async () => {
      await hapusBebasTahunanAction({ santriId: row.santri_id, jenis: row.jenis_biaya, tahun: row.tahun_tagihan })
      toast.success('Pembebasan tahunan dicabut.')
      router.refresh()
    })
  }

  return (
    <SectionPanel title="Pembebasan Biaya" description="Santri yang dibebaskan dari satu atau beberapa layanan sekaligus — berlaku lintas SPP/Makan/Laundry/USPP/Non-SPP tahunan, tidak terikat tab di bawah.">
      <div className="border-b border-slate-100 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Bebas Permanen — SPP / Makan / Laundry / USPP</p>
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2">
            <FormField label="Santri">
              <SantriPicker selected={selectedSantri} onSelect={setSelectedSantri} />
            </FormField>
          </div>
          <FormField label="Alasan">
            <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Yatim, beasiswa penuh, dll" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
          <button type="button" disabled={pending || !selectedSantri || checked.size === 0} onClick={handleSavePermanen}
            className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
            Bebaskan
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {PERMANENT_KINDS.map(kind => (
            <label key={kind.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={checked.has(kind.id)} onChange={() => toggleKind(kind.id)} className="h-4 w-4 rounded border-slate-300" />
              {kind.label}
            </label>
          ))}
        </div>
        {result && <div className="mt-3"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}
        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {exempted.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Belum ada santri yang dibebaskan permanen.</p>
          ) : (
            exempted.map(row => (
              <div key={`${row.santri_id}:${row.service_kind}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{row.nama_lengkap} <span className="font-normal text-slate-400">({row.nis})</span></p>
                  <p className="text-slate-500">{PERMANENT_KINDS.find(k => k.id === row.service_kind)?.label ?? row.service_kind}{row.alasan ? ` — ${row.alasan}` : ''}</p>
                </div>
                <button type="button" onClick={() => handleCabutPermanen(row.santri_id, row.service_kind)}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">
                  Cabut
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Bebas Tahunan — Bangunan / Kesehatan / EHB / Ekskul</p>
        <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2">
            <FormField label="Santri">
              <SantriPicker selected={selectedSantriTahunan} onSelect={setSelectedSantriTahunan} />
            </FormField>
          </div>
          <FormField label="Jenis">
            <select value={jenis} onChange={e => setJenis(e.target.value as NonSppJenis)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {NON_SPP_JENIS_ALL.map(item => <option key={item} value={item}>{TAHUNAN_LABEL[item]}</option>)}
            </select>
          </FormField>
          <FormField label="Tahun">
            <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
          <button type="button" disabled={pending || !selectedSantriTahunan} onClick={handleSaveTahunan}
            className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">
            Bebaskan
          </button>
        </div>
        <div className="mt-3">
          <FormField label="Keterangan (opsional)">
            <input value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Dibebaskan oleh yayasan" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </FormField>
        </div>
        {resultTahunan && <div className="mt-3"><ResultBanner result={resultTahunan} onDismiss={() => setResultTahunan(null)} /></div>}
        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {bebasTahunan.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Belum ada pembebasan tahunan aktif.</p>
          ) : (
            bebasTahunan.map(row => (
              <div key={`${row.santri_id}:${row.jenis_biaya}:${row.tahun_tagihan}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{row.nama_lengkap} <span className="font-normal text-slate-400">({row.nis})</span></p>
                  <p className="text-slate-500">{TAHUNAN_LABEL[row.jenis_biaya]} {row.tahun_tagihan}{row.keterangan ? ` — ${row.keterangan}` : ''}</p>
                </div>
                <button type="button" onClick={() => handleCabutTahunan(row)}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">
                  Cabut
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionPanel>
  )
}
