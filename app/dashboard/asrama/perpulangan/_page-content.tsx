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
  CheckCircle2,
  Home,
  Loader2,
  Lock,
  LogOut,
  PenLine,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

type Tab = 'pulang' | 'datang'
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

function statusBadge(status: string, scope: 'pulang' | 'datang') {
  if (scope === 'pulang') {
    return status === 'PULANG'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-500'
  }

  if (status === 'SUDAH') return 'bg-emerald-100 text-emerald-700'
  if (status === 'TELAT' || status === 'VONIS') return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
}

function jenisTone(jenis: SantriRow['jenis_pulang']) {
  if (jenis === 'ROMBONGAN') return 'bg-teal-100 text-teal-700'
  if (jenis === 'DIJEMPUT') return 'bg-violet-100 text-violet-700'
  return 'bg-slate-100 text-slate-500'
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
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function JenisButton({
  jenis,
  disabled = false,
  onClick,
}: {
  jenis: SantriRow['jenis_pulang']
  disabled?: boolean
  onClick?: () => void
}) {
  const Icon = jenis === 'ROMBONGAN' ? Bus : jenis === 'DIJEMPUT' ? Car : Home
  const label = jenis ?? 'BELUM DIATUR'

  if (!onClick) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${jenisTone(jenis)}`}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${jenisTone(jenis)}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

function RowPulang({
  santri,
  busy,
  onKonfirmasi,
  onBatal,
  onToggleJenis,
  onSimpanKeterangan,
}: {
  santri: SantriRow
  busy: boolean
  onKonfirmasi: (logId: string, ket: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
  onToggleJenis: (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => Promise<void>
  onSimpanKeterangan: (logId: string, ket: string) => Promise<void>
}) {
  const [ket, setKet] = useState(santri.keterangan ?? '')

  useEffect(() => {
    setKet(santri.keterangan ?? '')
  }, [santri.keterangan])

  const nextJenis = santri.jenis_pulang === 'ROMBONGAN' ? 'DIJEMPUT' : 'ROMBONGAN'

  return (
    <div className={`grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto] ${santri.status_pulang === 'PULANG' ? 'bg-amber-50/50' : 'bg-white'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-slate-800">{santri.nama_lengkap}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(santri.status_pulang, 'pulang')}`}>
            {santri.status_pulang}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{santri.nis} • Kamar {santri.kamar}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <JenisButton
            jenis={santri.jenis_pulang}
            disabled={busy}
            onClick={() => onToggleJenis(santri.log_id, nextJenis)}
          />
          {santri.tgl_pulang ? (
            <span className="text-xs text-slate-400">Pulang {localTime(santri.tgl_pulang)}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Keterangan</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <PenLine className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              placeholder="Opsional"
              className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <button
            onClick={() => onSimpanKeterangan(santri.log_id, ket)}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Simpan
          </button>
        </div>
      </div>

      <div className="flex items-center lg:justify-end">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : santri.status_pulang === 'PULANG' ? (
          <button
            onClick={() => onBatal(santri.log_id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Batal
          </button>
        ) : (
          <button
            onClick={() => onKonfirmasi(santri.log_id, ket)}
            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
          >
            Tandai Pulang
          </button>
        )}
      </div>
    </div>
  )
}

function RowDatang({
  santri,
  busy,
  onKonfirmasi,
  onBatal,
}: {
  santri: SantriRow
  busy: boolean
  onKonfirmasi: (logId: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
}) {
  const isLate = santri.status_datang === 'TELAT' || santri.status_datang === 'VONIS'

  return (
    <div className={`grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] ${santri.status_datang === 'SUDAH' ? 'bg-emerald-50/50' : isLate ? 'bg-rose-50/50' : 'bg-white'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-slate-800">{santri.nama_lengkap}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(santri.status_datang, 'datang')}`}>
            {santri.status_datang}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{santri.nis} • Kamar {santri.kamar}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <JenisButton jenis={santri.jenis_pulang} />
          {santri.keterangan ? <span className="text-xs text-slate-500">{santri.keterangan}</span> : null}
        </div>
      </div>

      <div className="space-y-1 text-sm text-slate-500">
        <p>Pulang: <span className="font-semibold text-slate-700">{localTime(santri.tgl_pulang)}</span></p>
        <p>Datang: <span className="font-semibold text-slate-700">{localTime(santri.tgl_datang)}</span></p>
      </div>

      <div className="flex items-center lg:justify-end">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : isLate ? (
          <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            Menunggu Verifikasi
          </span>
        ) : santri.status_datang === 'SUDAH' ? (
          <button
            onClick={() => onBatal(santri.log_id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Batal
          </button>
        ) : (
          <button
            onClick={() => onKonfirmasi(santri.log_id)}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            Tandai Datang
          </button>
        )}
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
  const [selectedKamar, setSelectedKamar] = useState('')
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [santriList, setSantriList] = useState<SantriRow[]>([])
  const [loadingSantri, setLoadingSantri] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('pulang')
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

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
    setSelectedKamar('')
    setSantriList([])

    getKamarsPerpulangan(asrama).then((rows) => {
      setKamars(rows)
      setSelectedKamar(rows[0] ?? '')
      setLoadingKamars(false)
    })
  }, [asrama])

  const loadSantri = useCallback(async () => {
    if (!periode?.id || !asrama || !selectedKamar) {
      setSantriList([])
      return
    }

    setLoadingSantri(true)
    const rows = await getDataKamarPerpulangan(asrama, selectedKamar, periode.id)
    setSantriList(rows)
    setLoadingSantri(false)
  }, [asrama, periode?.id, selectedKamar])

  useEffect(() => {
    loadSantri()
  }, [loadSantri])

  const setBusy = (logId: string, value: boolean) => {
    setBusyMap((prev) => ({ ...prev, [logId]: value }))
  }

  const patchSantri = useCallback((logId: string, patch: Partial<SantriRow>) => {
    setSantriList((prev) => prev.map((item) => item.log_id === logId ? { ...item, ...patch } : item))
  }, [])

  const handleKonfirmasiPulang = async (logId: string, ket: string) => {
    setBusy(logId, true)
    const res = await konfirmasiPulang(logId, periode.id, ket)
    setBusy(logId, false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, {
      status_pulang: 'PULANG',
      keterangan: ket || null,
      tgl_pulang: new Date().toISOString(),
    })
    toast.success('Status pulang tersimpan.')
  }

  const handleBatalPulang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalPulang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, {
      status_pulang: 'BELUM',
      tgl_pulang: null,
      status_datang: 'BELUM',
      tgl_datang: null,
    })
    toast.success('Status pulang dibatalkan.')
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

  const handleSimpanKeterangan = async (logId: string, ket: string) => {
    const res = await updateKeterangan(logId, ket)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, { keterangan: ket || null })
    toast.success('Keterangan disimpan.')
  }

  const handleKonfirmasiRombongan = async () => {
    if (!periode?.id || !selectedKamar) return
    const res = await konfirmasiRombonganKamar(periode.id, asrama, selectedKamar, 'Rombongan')
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    if (res.count === 0) {
      toast.info('Tidak ada santri rombongan yang menunggu konfirmasi.')
      return
    }

    setSantriList((prev) => prev.map((item) => (
      item.jenis_pulang === 'ROMBONGAN' && item.status_pulang === 'BELUM'
        ? { ...item, status_pulang: 'PULANG', keterangan: 'Rombongan', tgl_pulang: new Date().toISOString() }
        : item
    )))
    toast.success(`${res.count} santri rombongan ditandai pulang.`)
  }

  const handleKonfirmasiDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await konfirmasiDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, { status_datang: 'SUDAH', tgl_datang: new Date().toISOString() })
    toast.success('Kedatangan dikonfirmasi.')
  }

  const handleBatalDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    patchSantri(logId, { status_datang: 'BELUM', tgl_datang: null })
    toast.success('Status datang dibatalkan.')
  }

  const filteredSantri = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const base = tab === 'datang'
      ? santriList.filter((item) => item.status_pulang === 'PULANG')
      : santriList

    if (!keyword) return base

    return base.filter((item) => {
      const source = `${item.nama_lengkap} ${item.nis} ${item.keterangan ?? ''}`.toLowerCase()
      return source.includes(keyword)
    })
  }, [santriList, search, tab])

  const summary = useMemo(() => ({
    total: santriList.length,
    sudahPulang: santriList.filter((item) => item.status_pulang === 'PULANG').length,
    belumPulang: santriList.filter((item) => item.status_pulang === 'BELUM').length,
    sudahDatang: santriList.filter((item) => item.status_datang === 'SUDAH').length,
    telat: santriList.filter((item) => item.status_datang === 'TELAT' || item.status_datang === 'VONIS').length,
    belumDatang: santriList.filter((item) => item.status_pulang === 'PULANG' && item.status_datang === 'BELUM').length,
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
      <div className="mx-auto max-w-3xl space-y-4 pb-24">
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
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <DashboardPageHeader
        title="Perpulangan"
        description="Kelola status pulang dan datang santri per kamar. Semua data menggunakan periode aktif saat ini."
        action={(
          <button
            onClick={loadSantri}
            disabled={loadingSantri || !selectedKamar}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loadingSantri ? 'animate-spin' : ''}`} />
            Perbarui Data
          </button>
        )}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Periode Aktif</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{periode.nama_periode}</p>
            <p className="mt-1 text-sm text-slate-500">
              Pulang {periode.tgl_mulai_pulang} s/d {periode.tgl_selesai_pulang} • Datang {periode.tgl_mulai_datang} s/d {periode.tgl_selesai_datang}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${asramaBinaan ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              {asramaBinaan ? <Lock className="h-4 w-4 text-emerald-700" /> : <Home className="h-4 w-4 text-slate-400" />}
              <select
                value={asrama}
                onChange={(e) => setAsrama(e.target.value)}
                disabled={Boolean(asramaBinaan)}
                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed"
              >
                {ASRAMA_LIST.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <select
              value={selectedKamar}
              onChange={(e) => setSelectedKamar(e.target.value)}
              disabled={loadingKamars || kamars.length === 0}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {kamars.length === 0 ? <option value="">Pilih kamar</option> : null}
              {kamars.map((item) => (
                <option key={item} value={item}>Kamar {item}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau NIS"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
        </div>

        {roomFeatureBlocked ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Asrama ini tidak memakai skema kamar, jadi tidak ikut fitur perpulangan berbasis kamar.
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatsCard label="Total Santri" value={summary.total} tone="slate" />
        <StatsCard label="Sudah Pulang" value={summary.sudahPulang} tone="amber" />
        <StatsCard label="Belum Pulang" value={summary.belumPulang} tone="slate" />
        <StatsCard label="Sudah Datang" value={summary.sudahDatang} tone="emerald" />
        <StatsCard label="Belum Datang" value={summary.belumDatang} tone="amber" />
        <StatsCard label="Telat" value={summary.telat} tone="rose" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-800">Daftar Santri {selectedKamar ? `Kamar ${selectedKamar}` : ''}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tab perpulangan mencatat keberangkatan, tab kedatangan hanya menampilkan santri yang sudah ditandai pulang.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl bg-slate-100 p-1">
                {(['pulang', 'datang'] as Tab[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setTab(item)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === item ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {item === 'pulang' ? 'Perpulangan' : 'Kedatangan'}
                  </button>
                ))}
              </div>

              {tab === 'pulang' && adaRombonganBelum ? (
                <button
                  onClick={handleKonfirmasiRombongan}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
                >
                  <Bus className="h-4 w-4" />
                  Konfirmasi Semua Rombongan
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loadingKamars || loadingSantri ? (
          <div className="flex justify-center gap-2 py-14 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data santri...</span>
          </div>
        ) : !selectedKamar ? (
          <div className="py-14 text-center text-sm text-slate-400">
            Pilih kamar terlebih dahulu untuk menampilkan data perpulangan.
          </div>
        ) : filteredSantri.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400">
            {search ? 'Tidak ada santri yang cocok dengan pencarian.' : tab === 'datang' ? 'Belum ada santri pulang yang perlu dicatat datangnya.' : 'Tidak ada santri di kamar ini.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tab === 'pulang'
              ? filteredSantri.map((santri) => (
                <RowPulang
                  key={santri.log_id}
                  santri={santri}
                  busy={Boolean(busyMap[santri.log_id])}
                  onKonfirmasi={handleKonfirmasiPulang}
                  onBatal={handleBatalPulang}
                  onToggleJenis={handleToggleJenis}
                  onSimpanKeterangan={handleSimpanKeterangan}
                />
              ))
              : filteredSantri.map((santri) => (
                <RowDatang
                  key={santri.log_id}
                  santri={santri}
                  busy={Boolean(busyMap[santri.log_id])}
                  onKonfirmasi={handleKonfirmasiDatang}
                  onBatal={handleBatalDatang}
                />
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
