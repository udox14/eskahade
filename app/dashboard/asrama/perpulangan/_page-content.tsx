'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  batalDatang,
  batalPulang,
  getDataKamarPerpulangan,
  getKamarsPerpulangan,
  getPeriodeAktif,
  getSessionInfo,
  konfirmasiDatang,
  konfirmasiPulang,
  konfirmasiRombonganKamar,
  updateJenisPulang,
  updateKeterangan,
} from './actions'
import {
  Bus,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

type Tab = 'pulang' | 'datang'
type ModalState =
  | { type: 'catatan'; santri: SantriRow }
  | { type: 'rombongan' }
  | null

type SantriRow = {
  id: string
  nama_lengkap: string
  nis: string
  kamar: string
  log_id: string
  jenis_pulang: 'ROMBONGAN' | 'DIJEMPUT' | null
  status_pulang: 'BELUM' | 'PULANG'
  status_datang: 'BELUM' | 'SUDAH' | 'TELAT' | 'VONIS'
  keterangan: string | null
  tgl_pulang: string | null
  tgl_datang: string | null
}

function localTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function StatsCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'slate' | 'amber' | 'emerald' | 'rose'
}) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
  } as const

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}

function JenisBadge({
  jenis,
  disabled = false,
  onClick,
}: {
  jenis: SantriRow['jenis_pulang']
  disabled?: boolean
  onClick?: () => void
}) {
  const baseClass = jenis === 'ROMBONGAN'
    ? 'bg-teal-100 text-teal-700'
    : 'bg-violet-100 text-violet-700'
  const Icon = jenis === 'ROMBONGAN' ? Bus : Car
  const label = jenis === 'ROMBONGAN' ? 'Romb.' : 'Jemput'

  if (!jenis) return null

  if (!onClick) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${baseClass}`}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${baseClass}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

function StatusToggle({
  checked,
  busy,
  activeLabel,
  idleLabel,
  activeClassName,
  idleClassName,
  onClick,
}: {
  checked: boolean
  busy: boolean
  activeLabel: string
  idleLabel: string
  activeClassName: string
  idleClassName: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full rounded-xl px-3 py-2.5 text-sm font-bold transition ${checked ? activeClassName : idleClassName} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memproses...
        </span>
      ) : checked ? activeLabel : idleLabel}
    </button>
  )
}

function PerpulanganCard({
  santri,
  busy,
  onToggleStatus,
  onToggleJenis,
  onOpenCatatan,
}: {
  santri: SantriRow
  busy: boolean
  onToggleStatus: (santri: SantriRow) => Promise<void>
  onToggleJenis: (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => Promise<void>
  onOpenCatatan: (santri: SantriRow) => void
}) {
  const nextJenis = santri.jenis_pulang === 'ROMBONGAN' ? 'DIJEMPUT' : 'ROMBONGAN'
  const sudahPulang = santri.status_pulang === 'PULANG'

  return (
    <div className={`rounded-xl border p-3 transition ${sudahPulang ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-800">{santri.nama_lengkap}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Kamar {santri.kamar}</span>
            <JenisBadge
              jenis={santri.jenis_pulang}
              disabled={busy}
              onClick={() => onToggleJenis(santri.log_id, nextJenis)}
            />
            {sudahPulang ? <span>Pulang {localTime(santri.tgl_pulang)}</span> : null}
          </div>
        </div>

        <button
          onClick={() => onOpenCatatan(santri)}
          className={`rounded-lg p-2 transition ${santri.keterangan ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
          title="Catatan"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      {santri.keterangan ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{santri.keterangan}</p>
      ) : null}

      <div className="mt-3">
        <StatusToggle
          checked={sudahPulang}
          busy={busy}
          activeLabel="SUDAH PULANG"
          idleLabel="BELUM PULANG"
          activeClassName="bg-amber-500 text-white hover:bg-amber-600"
          idleClassName="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          onClick={() => onToggleStatus(santri)}
        />
      </div>
    </div>
  )
}

function KedatanganCard({
  santri,
  busy,
  onToggleStatus,
}: {
  santri: SantriRow
  busy: boolean
  onToggleStatus: (santri: SantriRow) => Promise<void>
}) {
  const sudahDatang = santri.status_datang === 'SUDAH'
  const isLate = santri.status_datang === 'TELAT' || santri.status_datang === 'VONIS'

  return (
    <div className={`rounded-xl border p-3 transition ${sudahDatang ? 'border-emerald-200 bg-emerald-50/70' : isLate ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-800">{santri.nama_lengkap}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Kamar {santri.kamar}</span>
            <JenisBadge jenis={santri.jenis_pulang} />
            <span>Pulang {localTime(santri.tgl_pulang)}</span>
            {sudahDatang ? <span>Datang {localTime(santri.tgl_datang)}</span> : null}
          </div>
        </div>
      </div>

      {santri.keterangan ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{santri.keterangan}</p>
      ) : null}

      <div className="mt-3">
        {isLate ? (
          <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-sm font-bold text-rose-700">
            MENUNGGU VERIFIKASI TELAT
          </div>
        ) : (
          <StatusToggle
            checked={sudahDatang}
            busy={busy}
            activeLabel="SUDAH DATANG"
            idleLabel="BELUM DATANG"
            activeClassName="bg-emerald-600 text-white hover:bg-emerald-700"
            idleClassName="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            onClick={() => onToggleStatus(santri)}
          />
        )}
      </div>
    </div>
  )
}

function SimpleModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function PerpulanganPage() {
  const [asrama, setAsrama] = useState<string>(ASRAMA_LIST[0] || '')
  const [asramaBinaan, setAsramaBinaan] = useState<string | null>(null)
  const [periode, setPeriode] = useState<any>(null)
  const [loadingPeriode, setLoadingPeriode] = useState(true)
  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [santriList, setSantriList] = useState<SantriRow[]>([])
  const [loadingSantri, setLoadingSantri] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('pulang')
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState<ModalState>(null)
  const [modalText, setModalText] = useState('')
  const [savingModal, setSavingModal] = useState(false)

  const loadPeriode = async () => {
    setLoadingPeriode(true)
    const [session, activePeriode] = await Promise.all([getSessionInfo(), getPeriodeAktif()])
    if (session?.asrama_binaan) {
      setAsramaBinaan(session.asrama_binaan)
      setAsrama(session.asrama_binaan)
    }
    setPeriode(activePeriode)
    setLoadingPeriode(false)
  }

  useEffect(() => {
    loadPeriode()
  }, [])

  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setKamarIdx(0)
    setSantriList([])

    getKamarsPerpulangan(asrama).then((rows) => {
      setKamars(rows)
      setKamarIdx(0)
      setLoadingKamars(false)
    })
  }, [asrama])

  const activeKamar = kamars[kamarIdx] ?? ''

  const loadSantri = useCallback(async () => {
    if (!periode?.id || !asrama || !activeKamar) {
      setSantriList([])
      return
    }

    setLoadingSantri(true)
    const rows = await getDataKamarPerpulangan(asrama, activeKamar, periode.id)
    setSantriList(rows)
    setLoadingSantri(false)
  }, [activeKamar, asrama, periode?.id])

  useEffect(() => {
    loadSantri()
  }, [loadSantri])

  const setBusy = (logId: string, value: boolean) => {
    setBusyMap((prev) => ({ ...prev, [logId]: value }))
  }

  const patchSantri = useCallback((logId: string, patch: Partial<SantriRow>) => {
    setSantriList((prev) => prev.map((item) => item.log_id === logId ? { ...item, ...patch } : item))
  }, [])

  const handleTogglePulang = async (santri: SantriRow) => {
    setBusy(santri.log_id, true)
    const res = santri.status_pulang === 'PULANG'
      ? await batalPulang(santri.log_id, periode.id)
      : await konfirmasiPulang(santri.log_id, periode.id, santri.keterangan ?? '')
    setBusy(santri.log_id, false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    if (santri.status_pulang === 'PULANG') {
      patchSantri(santri.log_id, {
        status_pulang: 'BELUM',
        tgl_pulang: null,
        status_datang: 'BELUM',
        tgl_datang: null,
      })
      toast.success('Status pulang dibatalkan.')
      return
    }

    patchSantri(santri.log_id, {
      status_pulang: 'PULANG',
      tgl_pulang: new Date().toISOString(),
    })
    toast.success('Status pulang disimpan.')
  }

  const handleToggleDatang = async (santri: SantriRow) => {
    setBusy(santri.log_id, true)
    const res = santri.status_datang === 'SUDAH'
      ? await batalDatang(santri.log_id, periode.id)
      : await konfirmasiDatang(santri.log_id, periode.id)
    setBusy(santri.log_id, false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    if (santri.status_datang === 'SUDAH') {
      patchSantri(santri.log_id, {
        status_datang: 'BELUM',
        tgl_datang: null,
      })
      toast.success('Status datang dibatalkan.')
      return
    }

    patchSantri(santri.log_id, {
      status_datang: 'SUDAH',
      tgl_datang: new Date().toISOString(),
    })
    toast.success('Kedatangan dikonfirmasi.')
  }

  const handleToggleJenis = async (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => {
    const res = await updateJenisPulang(logId, jenisBaru)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, { jenis_pulang: jenisBaru })
    toast.success('Jenis pulang diperbarui.')
  }

  const openCatatanModal = (santri: SantriRow) => {
    setModal({ type: 'catatan', santri })
    setModalText(santri.keterangan ?? '')
  }

  const openRombonganModal = () => {
    setModal({ type: 'rombongan' })
    setModalText('Rombongan')
  }

  const closeModal = () => {
    setModal(null)
    setModalText('')
    setSavingModal(false)
  }

  const handleSaveCatatan = async () => {
    if (!modal || modal.type !== 'catatan') return
    setSavingModal(true)
    const res = await updateKeterangan(modal.santri.log_id, modalText)
    setSavingModal(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(modal.santri.log_id, { keterangan: modalText || null })
    toast.success('Catatan disimpan.')
    closeModal()
  }

  const handleKonfirmasiRombongan = async () => {
    if (!periode?.id || !activeKamar) return
    setSavingModal(true)
    const res = await konfirmasiRombonganKamar(periode.id, asrama, activeKamar, modalText)
    setSavingModal(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    if (res.count === 0) {
      toast.info('Tidak ada santri rombongan yang menunggu konfirmasi.')
      closeModal()
      return
    }

    setSantriList((prev) => prev.map((item) => (
      item.jenis_pulang === 'ROMBONGAN' && item.status_pulang === 'BELUM'
        ? { ...item, status_pulang: 'PULANG', keterangan: modalText || 'Rombongan', tgl_pulang: new Date().toISOString() }
        : item
    )))
    toast.success(`${res.count} santri rombongan ditandai pulang.`)
    closeModal()
  }

  const filteredSantri = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const base = tab === 'datang'
      ? santriList.filter((item) => item.status_pulang === 'PULANG')
      : santriList

    if (!keyword) return base

    return base.filter((item) => {
      const source = `${item.nama_lengkap} ${item.kamar} ${item.keterangan ?? ''}`.toLowerCase()
      return source.includes(keyword)
    })
  }, [santriList, search, tab])

  const summary = useMemo(() => ({
    total: santriList.length,
    sudahPulang: santriList.filter((item) => item.status_pulang === 'PULANG').length,
    belumPulang: santriList.filter((item) => item.status_pulang === 'BELUM').length,
    sudahDatang: santriList.filter((item) => item.status_datang === 'SUDAH').length,
    belumDatang: santriList.filter((item) => item.status_pulang === 'PULANG' && item.status_datang === 'BELUM').length,
    telat: santriList.filter((item) => item.status_datang === 'TELAT' || item.status_datang === 'VONIS').length,
  }), [santriList])

  const adaRombonganBelum = santriList.some((item) => item.jenis_pulang === 'ROMBONGAN' && item.status_pulang === 'BELUM')
  const roomFeatureBlocked = isAsramaTanpaKamar(asramaBinaan ?? asrama)

  if (loadingPeriode) {
    return (
      <div className="flex justify-center gap-2 py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Memuat halaman perpulangan...</span>
      </div>
    )
  }

  if (!periode) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24">
        <DashboardPageHeader
          title="Perpulangan"
          description="Kelola status pulang dan datang santri per kamar dalam periode aktif."
        />
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-lg font-bold text-slate-700">Belum ada periode aktif</p>
          <p className="mt-2 text-sm text-slate-500">Atur atau aktifkan periode perpulangan terlebih dahulu dari halaman pengaturan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-32 mx-auto max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <DashboardPageHeader
            title="Perpulangan"
            description="Kelola status pulang dan datang santri per kamar pada periode aktif."
            className="flex-1"
          />
          <div className={`rounded-lg border p-2 flex items-center gap-2 w-fit ${asramaBinaan ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}>
            {asramaBinaan ? <Lock className="h-4 w-4 text-emerald-700" /> : <Home className="h-4 w-4 text-slate-400" />}
            <select
              value={asrama}
              onChange={(e) => setAsrama(e.target.value)}
              disabled={Boolean(asramaBinaan)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed"
            >
              {ASRAMA_LIST.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-emerald-900 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Periode Aktif</p>
              <p className="mt-1 text-lg font-bold">{periode.nama_periode}</p>
              <p className="mt-2 text-xs text-emerald-100">
                Pulang {periode.tgl_mulai_pulang} s/d {periode.tgl_selesai_pulang}
              </p>
              <p className="text-xs text-emerald-100">
                Datang {periode.tgl_mulai_datang} s/d {periode.tgl_selesai_datang}
              </p>
            </div>
            <button
              onClick={loadSantri}
              disabled={loadingSantri || !activeKamar}
              className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Perbarui"
            >
              <RefreshCw className={`h-4 w-4 ${loadingSantri ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-[10px] font-bold uppercase text-emerald-200">Pulang</p>
              <p className="mt-1 text-lg font-bold">{summary.sudahPulang}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-[10px] font-bold uppercase text-emerald-200">Datang</p>
              <p className="mt-1 text-lg font-bold">{summary.sudahDatang}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-[10px] font-bold uppercase text-emerald-200">Telat</p>
              <p className="mt-1 text-lg font-bold">{summary.telat}</p>
            </div>
          </div>
        </div>
      </div>

      {loadingKamars ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : roomFeatureBlocked ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Asrama ini tidak ikut fitur perpulangan berbasis kamar.
        </div>
      ) : kamars.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl border bg-white p-2 shadow-sm">
          <button
            onClick={() => setKamarIdx((idx) => Math.max(0, idx - 1))}
            disabled={kamarIdx === 0}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Kamar</p>
            <p className="text-lg font-bold text-slate-800">{activeKamar}</p>
          </div>
          <button
            onClick={() => setKamarIdx((idx) => Math.min(kamars.length - 1, idx + 1))}
            disabled={kamarIdx === kamars.length - 1}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Tidak ada kamar ditemukan.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatsCard label="Total" value={summary.total} tone="slate" />
        <StatsCard label="Blm Pulang" value={summary.belumPulang} tone="amber" />
        <StatsCard label="Blm Datang" value={summary.belumDatang} tone="rose" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            {(['pulang', 'datang'] as Tab[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${tab === item ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {item === 'pulang' ? 'Perpulangan' : 'Kedatangan'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau catatan"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {tab === 'pulang' && adaRombonganBelum ? (
              <button
                onClick={openRombonganModal}
                className="shrink-0 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
              >
                Romb.
              </button>
            ) : null}
          </div>
        </div>

        {loadingSantri ? (
          <div className="flex justify-center gap-2 py-14 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data santri...</span>
          </div>
        ) : !activeKamar ? (
          <div className="py-14 text-center text-sm text-slate-400">
            Pilih kamar terlebih dahulu.
          </div>
        ) : filteredSantri.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400">
            {search ? 'Tidak ada santri yang cocok dengan pencarian.' : tab === 'datang' ? 'Belum ada santri yang perlu dicatat datangnya.' : 'Tidak ada santri di kamar ini.'}
          </div>
        ) : (
          <div className="space-y-3 p-3">
            {tab === 'pulang'
              ? filteredSantri.map((santri) => (
                <PerpulanganCard
                  key={santri.log_id}
                  santri={santri}
                  busy={Boolean(busyMap[santri.log_id])}
                  onToggleStatus={handleTogglePulang}
                  onToggleJenis={handleToggleJenis}
                  onOpenCatatan={openCatatanModal}
                />
              ))
              : filteredSantri.map((santri) => (
                <KedatanganCard
                  key={santri.log_id}
                  santri={santri}
                  busy={Boolean(busyMap[santri.log_id])}
                  onToggleStatus={handleToggleDatang}
                />
              ))}
          </div>
        )}
      </section>

      {modal?.type === 'catatan' ? (
        <SimpleModal
          title="Catatan Santri"
          description={modal.santri.nama_lengkap}
          onClose={closeModal}
        >
          <div className="space-y-4">
            <textarea
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              rows={4}
              placeholder="Tulis catatan perpulangan..."
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={handleSaveCatatan}
              disabled={savingModal}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingModal ? 'Menyimpan...' : 'Simpan Catatan'}
            </button>
          </div>
        </SimpleModal>
      ) : null}

      {modal?.type === 'rombongan' ? (
        <SimpleModal
          title="Konfirmasi Semua Rombongan"
          description={`Kamar ${activeKamar} • isi keterangan yang akan dipakai untuk semua santri rombongan.`}
          onClose={closeModal}
        >
          <div className="space-y-4">
            <textarea
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              rows={4}
              placeholder="Contoh: Rombongan gelombang 1"
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
            <button
              onClick={handleKonfirmasiRombongan}
              disabled={savingModal}
              className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingModal ? 'Memproses...' : 'Konfirmasi Semua Rombongan'}
            </button>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  )
}
