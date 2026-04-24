'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSessionInfo, getPeriodeAktif, getKamarsPerpulangan,
  getDataKamarPerpulangan, konfirmasiPulang, batalPulang,
  konfirmasiRombonganKamar, updateJenisPulang, updateKeterangan,
  konfirmasiDatang, batalDatang,
} from './actions'
import {
  LogOut, Home, ChevronLeft, ChevronRight, Loader2,
  Bus, Car, Users, CheckCircle2, AlertCircle, CalendarRange,
  RefreshCw, PenLine,
} from 'lucide-react'
import { toast } from 'sonner'

const ASRAMA_LIST = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4', 'AL-BAGHORY']
type Tab = 'pulang' | 'datang'

// ─── Badge status pulang ──────────────────────────────────────────────────────
function BadgeStatusPulang({ status }: { status: string }) {
  if (status === 'PULANG')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">PULANG</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">BELUM</span>
}

function BadgeStatusDatang({ status }: { status: string }) {
  if (status === 'SUDAH')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">SUDAH</span>
  if (status === 'TELAT')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">TELAT</span>
  if (status === 'VONIS')
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">DIVONIS</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">BELUM</span>
}

function BadgeJenis({ jenis, onClick }: { jenis: string | null; onClick: () => void }) {
  if (jenis === 'ROMBONGAN')
    return (
      <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 active:scale-95 transition-transform">
        <Bus className="w-3 h-3" /> ROMBONGAN
      </button>
    )
  if (jenis === 'DIJEMPUT')
    return (
      <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 active:scale-95 transition-transform">
        <Car className="w-3 h-3" /> DIJEMPUT
      </button>
    )
  return (
    <button onClick={onClick} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 active:scale-95 transition-transform">
      BELUM DIATUR
    </button>
  )
}

// ─── Row santri tab Perpulangan ───────────────────────────────────────────────
function RowPulang({
  santri, periodeId, busy, onKonfirmasi, onBatal, onToggleJenis, onKetChange,
}: {
  santri: any; periodeId: number; busy: boolean
  onKonfirmasi: (logId: string, ket: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
  onToggleJenis: (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => Promise<void>
  onKetChange: (logId: string, ket: string) => void
}) {
  const [ket, setKet] = useState(santri.keterangan || '')
  const [editKet, setEditKet] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sudahPulang = santri.status_pulang === 'PULANG'

  const handleToggleJenis = () => {
    const next = santri.jenis_pulang === 'ROMBONGAN' ? 'DIJEMPUT' : 'ROMBONGAN'
    onToggleJenis(santri.log_id, next as 'ROMBONGAN' | 'DIJEMPUT')
  }

  const handleKetBlur = () => {
    setEditKet(false)
    if (ket !== (santri.keterangan || '')) {
      onKetChange(santri.log_id, ket)
    }
  }

  return (
    <div className={`p-3.5 border-b border-slate-100 last:border-b-0 transition-colors ${sudahPulang ? 'bg-amber-50/40' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        {/* Info santri */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{santri.nama_lengkap}</p>
            <BadgeStatusPulang status={santri.status_pulang} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{santri.nis} · Kamar {santri.kamar}</p>

          {/* Jenis + keterangan */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <BadgeJenis jenis={santri.jenis_pulang} onClick={handleToggleJenis} />
            {sudahPulang && santri.tgl_pulang && (
              <span className="text-[10px] text-slate-400">
                {new Date(santri.tgl_pulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Keterangan */}
          {editKet ? (
            <input
              ref={inputRef}
              value={ket}
              onChange={e => setKet(e.target.value)}
              onBlur={handleKetBlur}
              placeholder="Keterangan (opsional)..."
              className="mt-1.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditKet(true)}
              className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <PenLine className="w-3 h-3" />
              {ket ? <span className="text-slate-600">{ket}</span> : <span>Tambah keterangan...</span>}
            </button>
          )}
        </div>

        {/* Tombol aksi */}
        <div className="shrink-0">
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : sudahPulang ? (
            <button
              onClick={() => onBatal(santri.log_id)}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all"
            >
              Batal
            </button>
          ) : (
            <button
              onClick={() => onKonfirmasi(santri.log_id, ket)}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all shadow-sm"
            >
              PULANG
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Row santri tab Kedatangan ────────────────────────────────────────────────
function RowDatang({
  santri, busy,
  onKonfirmasi, onBatal,
}: {
  santri: any; busy: boolean
  onKonfirmasi: (logId: string) => Promise<void>
  onBatal: (logId: string) => Promise<void>
}) {
  const sudahDatang = santri.status_datang === 'SUDAH'
  const isTelat = santri.status_datang === 'TELAT' || santri.status_datang === 'VONIS'

  return (
    <div className={`p-3.5 border-b border-slate-100 last:border-b-0 transition-colors ${sudahDatang ? 'bg-emerald-50/40' : isTelat ? 'bg-rose-50/40' : 'bg-white'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm truncate">{santri.nama_lengkap}</p>
            <BadgeStatusDatang status={santri.status_datang} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-slate-400">{santri.nis}</p>
            <BadgeJenis jenis={santri.jenis_pulang} onClick={() => {}} />
          </div>
          {santri.keterangan && (
            <p className="text-xs text-slate-500 mt-1 italic">"{santri.keterangan}"</p>
          )}
          {sudahDatang && santri.tgl_datang && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Datang: {new Date(santri.tgl_datang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : isTelat ? (
            <span className="px-3 py-1.5 bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200">Telat</span>
          ) : sudahDatang ? (
            <button
              onClick={() => onBatal(santri.log_id)}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all"
            >
              Batal
            </button>
          ) : (
            <button
              onClick={() => onKonfirmasi(santri.log_id)}
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
            >
              SUDAH
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PerpulanganPage() {
  const [asrama, setAsrama] = useState(ASRAMA_LIST[0])
  const [asramaBinaan, setAsramaBinaan] = useState<string | null>(null)
  const [role, setRole] = useState<string>('')

  const [periode, setPeriode] = useState<any>(null)
  const [loadingPeriode, setLoadingPeriode] = useState(true)

  const [kamars, setKamars] = useState<string[]>([])
  const [loadingKamars, setLoadingKamars] = useState(false)
  const [kamarIdx, setKamarIdx] = useState(0)

  // Data santri kamar aktif (lazy + cache per kamar)
  const [santriList, setSantriList] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [tab, setTab] = useState<Tab>('pulang')
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

  // ── Init: session + periode ──
  useEffect(() => {
    getSessionInfo().then(s => {
      if (!s) return
      setRole(s.role)
      if (s.asrama_binaan) {
        setAsramaBinaan(s.asrama_binaan)
        setAsrama(s.asrama_binaan)
      }
    })
    getPeriodeAktif().then(p => {
      setPeriode(p)
      setLoadingPeriode(false)
    })
  }, [])

  // ── Load kamar saat asrama berubah ──
  useEffect(() => {
    if (!asrama) return
    setLoadingKamars(true)
    setKamars([])
    setSantriList([])
    setKamarCache({})
    setKamarIdx(0)
    getKamarsPerpulangan(asrama).then(res => {
      setKamars(res)
      setLoadingKamars(false)
    })
  }, [asrama])

  // ── Lazy load santri kamar aktif ──
  useEffect(() => {
    if (!kamars.length || !periode?.id) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    const cacheKey = `${asrama}__${kamar}__${periode.id}`
    if (kamarCache[cacheKey]) {
      setSantriList(kamarCache[cacheKey])
      return
    }

    setLoadingKamar(true)
    setSantriList([])
    getDataKamarPerpulangan(asrama, kamar, periode.id).then(res => {
      setSantriList(res)
      setKamarCache(prev => ({ ...prev, [cacheKey]: res }))
      setLoadingKamar(false)
    })
  }, [kamarIdx, kamars, asrama, periode])

  const activeKamar = kamars[kamarIdx] ?? ''

  // ── Helper: update santri di state + cache ──
  const updateSantriState = useCallback((logId: string, patch: Partial<any>) => {
    const cacheKey = `${asrama}__${activeKamar}__${periode?.id}`
    setSantriList(prev => {
      const updated = prev.map(s => s.log_id === logId ? { ...s, ...patch } : s)
      setKamarCache(c => ({ ...c, [cacheKey]: updated }))
      return updated
    })
  }, [asrama, activeKamar, periode])

  const setBusy = (logId: string, val: boolean) =>
    setBusyMap(prev => ({ ...prev, [logId]: val }))

  // ── Actions: Perpulangan ──
  const handleKonfirmasiPulang = async (logId: string, ket: string) => {
    setBusy(logId, true)
    const res = await konfirmasiPulang(logId, periode.id, ket)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_pulang: 'PULANG', keterangan: ket || null, tgl_pulang: new Date().toISOString() })
    toast.success('Konfirmasi pulang tersimpan')
  }

  const handleBatalPulang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalPulang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_pulang: 'BELUM', keterangan: null, tgl_pulang: null })
    toast.success('Dibatalkan')
  }

  const handleToggleJenis = async (logId: string, jenisBaru: 'ROMBONGAN' | 'DIJEMPUT') => {
    const res = await updateJenisPulang(logId, jenisBaru)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { jenis_pulang: jenisBaru })
  }

  const handleKetChange = useCallback(async (logId: string, ket: string) => {
    await updateKeterangan(logId, ket)
    updateSantriState(logId, { keterangan: ket || null })
  }, [updateSantriState])

  const handleKonfirmasiRombongan = async () => {
    if (!periode?.id || !activeKamar) return
    const res = await konfirmasiRombonganKamar(periode.id, asrama, activeKamar, 'Rombongan')
    if ('error' in res) { toast.error(res.error); return }
    if (res.count === 0) { toast.info('Tidak ada santri rombongan yang belum pulang'); return }
    // Update state semua yang rombongan dan BELUM
    setSantriList(prev => {
      const updated = prev.map(s =>
        s.jenis_pulang === 'ROMBONGAN' && s.status_pulang === 'BELUM'
          ? { ...s, status_pulang: 'PULANG', keterangan: 'Rombongan', tgl_pulang: new Date().toISOString() }
          : s
      )
      const cacheKey = `${asrama}__${activeKamar}__${periode.id}`
      setKamarCache(c => ({ ...c, [cacheKey]: updated }))
      return updated
    })
    toast.success(`${res.count} santri rombongan dikonfirmasi pulang`)
  }

  // ── Actions: Kedatangan ──
  const handleKonfirmasiDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await konfirmasiDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_datang: 'SUDAH', tgl_datang: new Date().toISOString() })
    toast.success('Kedatangan dikonfirmasi')
  }

  const handleBatalDatang = async (logId: string) => {
    setBusy(logId, true)
    const res = await batalDatang(logId, periode.id)
    setBusy(logId, false)
    if ('error' in res) { toast.error(res.error); return }
    updateSantriState(logId, { status_datang: 'BELUM', tgl_datang: null })
    toast.success('Dibatalkan')
  }

  // ── Derived stats ──
  const sudahPulang = santriList.filter(s => s.status_pulang === 'PULANG').length
  const belumPulang = santriList.filter(s => s.status_pulang === 'BELUM').length
  const sudahDatang = santriList.filter(s => s.status_datang === 'SUDAH').length
  const belumDatang = santriList.filter(s => s.status_pulang === 'PULANG' && s.status_datang === 'BELUM').length

  // Untuk tab datang: hanya tampilkan yang sudah PULANG
  const listDatang = santriList.filter(s => s.status_pulang === 'PULANG')
  const adaRombonganBelum = santriList.some(s => s.jenis_pulang === 'ROMBONGAN' && s.status_pulang === 'BELUM')

  if (loadingPeriode) {
    return (
      <div className="flex justify-center items-center py-20 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
      </div>
    )
  }

  if (!periode) {
    return (
      <div className="max-w-lg mx-auto pt-10 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <CalendarRange className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Belum Ada Periode Aktif</p>
          <p className="text-sm text-slate-500">Dewan santri atau keamanan belum mengatur periode perpulangan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-32 select-none">

      {/* ── HEADER ── */}
      <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-xl mb-4 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-lg">Perpulangan & Kedatangan</h1>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-sm">
            <p className="font-semibold text-amber-300">{periode.nama_periode}</p>
            <p className="text-xs text-slate-300 mt-0.5">
              Pulang: {periode.tgl_mulai_pulang} s/d {periode.tgl_selesai_pulang}
            </p>
            <p className="text-xs text-slate-300">
              Datang: {periode.tgl_mulai_datang} s/d {periode.tgl_selesai_datang}
            </p>
          </div>

          {/* Pilih asrama (hanya jika bukan pengurus asrama) */}
          {!asramaBinaan && (
            <select
              value={asrama}
              onChange={e => setAsrama(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {ASRAMA_LIST.map(a => <option key={a} value={a} className="text-slate-900">{a}</option>)}
            </select>
          )}
          {asramaBinaan && (
            <div className="flex items-center gap-2 text-sm bg-white/10 rounded-xl px-3 py-2">
              <Home className="w-4 h-4 text-slate-300" />
              <span className="font-semibold">{asramaBinaan}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── TAB ── */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl mx-4 mb-4">
        {(['pulang', 'datang'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'pulang' ? '✈️ Perpulangan' : '🏠 Kedatangan'}
          </button>
        ))}
      </div>

      {/* ── NAVIGASI KAMAR ── */}
      {loadingKamars ? (
        <div className="flex justify-center py-4 gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar kamar...
        </div>
      ) : kamars.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-4">Tidak ada kamar ditemukan.</p>
      ) : (
        <div className="mx-4 mb-3">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
            <button
              onClick={() => setKamarIdx(i => Math.max(0, i - 1))}
              disabled={kamarIdx === 0}
              className="p-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="text-center">
              <p className="font-bold text-slate-800">Kamar {activeKamar}</p>
              <p className="text-xs text-slate-400">{kamarIdx + 1} / {kamars.length}</p>
            </div>
            <button
              onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))}
              disabled={kamarIdx === kamars.length - 1}
              className="p-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-colors active:scale-95"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Stats kamar */}
          {!loadingKamar && santriList.length > 0 && (
            <div className="flex gap-2 mt-2">
              {tab === 'pulang' ? (
                <>
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-amber-700">{sudahPulang}</p>
                    <p className="text-[10px] text-amber-500 font-medium">Sudah Pulang</p>
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-slate-600">{belumPulang}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Belum Pulang</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-700">{sudahDatang}</p>
                    <p className="text-[10px] text-emerald-500 font-medium">Sudah Datang</p>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-amber-600">{belumDatang}</p>
                    <p className="text-[10px] text-amber-500 font-medium">Belum Datang</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BULK ROMBONGAN (tab pulang saja) ── */}
      {tab === 'pulang' && !loadingKamar && adaRombonganBelum && (
        <div className="mx-4 mb-3">
          <button
            onClick={handleKonfirmasiRombongan}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-2xl text-sm font-bold hover:bg-teal-700 active:scale-[0.98] transition-all shadow-sm"
          >
            <Bus className="w-4 h-4" /> Konfirmasi Semua Rombongan
          </button>
        </div>
      )}

      {/* ── DAFTAR SANTRI ── */}
      <div className="mx-4">
        {loadingKamar ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex justify-center items-center py-10 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Memuat santri...</span>
          </div>
        ) : santriList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-10 text-slate-400 text-sm">
            Tidak ada santri di kamar ini.
          </div>
        ) : tab === 'pulang' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {santriList.map(s => (
              <RowPulang
                key={s.id}
                santri={s}
                periodeId={periode.id}
                busy={!!busyMap[s.log_id]}
                onKonfirmasi={handleKonfirmasiPulang}
                onBatal={handleBatalPulang}
                onToggleJenis={handleToggleJenis}
                onKetChange={handleKetChange}
              />
            ))}
          </div>
        ) : listDatang.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-10 text-slate-400 text-sm">
            Belum ada santri yang dikonfirmasi pulang di kamar ini.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {listDatang.map(s => (
              <RowDatang
                key={s.id}
                santri={s}
                busy={!!busyMap[s.log_id]}
                onKonfirmasi={handleKonfirmasiDatang}
                onBatal={handleBatalDatang}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}