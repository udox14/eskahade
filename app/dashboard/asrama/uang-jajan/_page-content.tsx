'use client'

import { useState, useEffect, type FormEvent, type SetStateAction } from 'react'
import {
  getStatsTabungan,
  getSantriKamarTabungan,
  simpanTopup,
  simpanJajanMassal,
  getClientRestriction,
  getRiwayatTabunganSantri,
  hapusTransaksi,
  getKamarsTabungan,
  searchSantriTabungan,
  simpanTransaksiDompet,
  transferSaldo,
  getAutoSetting,
  saveAutoSetting,
  saveSantriAutoNominal,
  setSantriAutoExcluded,
  runAutoPotongNow,
  type DompetType,
  type TransaksiJenis,
  type AutoMode,
} from './actions'
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Home,
  Lock,
  History,
  Trash2,
  Search,
  Wallet,
  PiggyBank,
  ArrowRightLeft,
  CalendarClock,
  Ban,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST
const JAJAN_OPTS = [5000, 10000, 15000, 20000]
const DAY_OPTIONS = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Min' },
]

type StatsTabungan = Awaited<ReturnType<typeof getStatsTabungan>>
type SantriKamarRow = Awaited<ReturnType<typeof getSantriKamarTabungan>>[number]
type RiwayatTabunganRow = Awaited<ReturnType<typeof getRiwayatTabunganSantri>>[number]
type AutoSettingRow = Awaited<ReturnType<typeof getAutoSetting>>
type ActionResult =
  | Awaited<ReturnType<typeof simpanTopup>>
  | Awaited<ReturnType<typeof simpanJajanMassal>>
  | Awaited<ReturnType<typeof simpanTransaksiDompet>>
  | Awaited<ReturnType<typeof transferSaldo>>
  | Awaited<ReturnType<typeof saveAutoSetting>>
  | Awaited<ReturnType<typeof saveSantriAutoNominal>>
  | Awaited<ReturnType<typeof setSantriAutoExcluded>>

function getActionError(res: ActionResult) {
  return 'error' in res ? res.error : null
}

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function parseNominal(value: string) {
  return parseInt(value.replace(/\D/g, ''), 10) || 0
}

function fmtShortNominal(n: number) {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}k`
  return fmtRp(n)
}

function parseDaysValue(days: string) {
  try {
    const parsed = JSON.parse(days) as number[]
    return parsed.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  } catch {
    return [1, 2, 3, 4, 5, 6]
  }
}

export default function UangJajanPage() {
  const confirm = useConfirm()
  const [asrama, setAsrama] = useState<string>(ASRAMA_LIST[0] || '')
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  const [stats, setStats] = useState<StatsTabungan | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const [santriKamar, setSantriKamar] = useState<SantriKamarRow[]>([])
  const [searchRows, setSearchRows] = useState<SantriKamarRow[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [kamarCache, setKamarCache] = useState<Record<string, SantriKamarRow[]>>({})
  const [searchText, setSearchText] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [savingAutoSantri, setSavingAutoSantri] = useState<Record<string, boolean>>({})
  const [customNominalSantri, setCustomNominalSantri] = useState<SantriKamarRow | null>(null)
  const [customNominalValue, setCustomNominalValue] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<SantriKamarRow | null>(null)
  const [walletNominal, setWalletNominal] = useState('')
  const [walletDompet, setWalletDompet] = useState<DompetType>('JAJAN')
  const [walletJenis, setWalletJenis] = useState<TransaksiJenis>('MASUK')
  const [transferNominal, setTransferNominal] = useState('')
  const [transferArah, setTransferArah] = useState<'JAJAN_TO_TABUNGAN' | 'TABUNGAN_TO_JAJAN'>('JAJAN_TO_TABUNGAN')
  const [history, setHistory] = useState<RiwayatTabunganRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [autoSetting, setAutoSetting] = useState<AutoSettingRow | null>(null)
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false)
  const [settingMode, setSettingMode] = useState<AutoMode>('MANUAL')
  const [settingJam, setSettingJam] = useState('06:00')
  const [settingDays, setSettingDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [settingActive, setSettingActive] = useState(true)

  useEffect(() => {
    getClientRestriction().then(res => {
      if (res) { setUserAsrama(res); setAsrama(res) }
    })
  }, [])

  useEffect(() => {
    if (!asrama) return
    Promise.resolve().then(() => {
      setLoadingKamars(true)
      setLoadingStats(true)
      setKamars([])
      setSantriKamar([])
      setSearchRows([])
      setKamarCache({})
      setKamarIdx(0)
    })

    getKamarsTabungan(asrama).then(res => {
      setKamars(res.kamars)
      setLoadingKamars(false)
    })
    getStatsTabungan(asrama).then(res => {
      setStats(res)
      setLoadingStats(false)
    })
    getAutoSetting(asrama).then(setting => {
      setAutoSetting(setting)
      setSettingMode(setting.mode)
      setSettingJam(setting.jam)
      setSettingDays(parseDaysValue(setting.days))
      setSettingActive(Boolean(setting.is_active))
    })
  }, [asrama])

  useEffect(() => {
    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return
    if (kamarCache[kamar]) {
      Promise.resolve().then(() => setSantriKamar(kamarCache[kamar]))
      return
    }
    Promise.resolve().then(() => {
      setLoadingKamar(true)
      setSantriKamar([])
    })
    getSantriKamarTabungan(asrama, kamar).then(res => {
      setSantriKamar(res)
      setKamarCache(prev => ({ ...prev, [kamar]: res }))
      setLoadingKamar(false)
    })
  }, [asrama, kamarCache, kamarIdx, kamars])

  useEffect(() => {
    const q = searchText.trim()
    if (!q) {
      Promise.resolve().then(() => {
        setSearchRows([])
        setLoadingSearch(false)
      })
      return
    }
    const timer = window.setTimeout(() => {
      setLoadingSearch(true)
      searchSantriTabungan(asrama, q).then(res => {
        setSearchRows(res)
        setLoadingSearch(false)
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [asrama, searchText])

  const activeKamar = kamars[kamarIdx] ?? ''
  const roomFeatureBlocked = isAsramaTanpaKamar(userAsrama ?? asrama)
  const listMode = searchText.trim() ? 'search' : 'kamar'
  const visibleSantri = listMode === 'search' ? searchRows : santriKamar
  const isAutoMode = autoSetting?.mode === 'AUTO'

  const refreshAfterMutasi = (kamar?: string) => {
    const targetKamar = kamar || activeKamar
    if (targetKamar) {
      setKamarCache(prev => { const n = { ...prev }; delete n[targetKamar]; return n })
      setLoadingKamar(true)
      getSantriKamarTabungan(asrama, targetKamar).then(res => {
        setSantriKamar(res)
        setKamarCache(prev => ({ ...prev, [targetKamar]: res }))
        setLoadingKamar(false)
      })
    }
    if (searchText.trim()) {
      setLoadingSearch(true)
      searchSantriTabungan(asrama, searchText.trim()).then(res => {
        setSearchRows(res)
        setLoadingSearch(false)
      })
    }
    getStatsTabungan(asrama).then(setStats)
    getAutoSetting(asrama).then(setting => {
      setAutoSetting(setting)
      setSettingMode(setting.mode)
      setSettingJam(setting.jam)
      setSettingDays(parseDaysValue(setting.days))
      setSettingActive(Boolean(setting.is_active))
    })
  }

  const handleDirectJajanDeduction = async (santri: SantriKamarRow, nominal: number) => {
    if (nominal > santri.saldo_jajan) {
      toast.warning('Saldo uang jajan tidak cukup.')
      return false
    }
    const labelNominal = fmtRp(nominal)
    if (!await confirm(`Potong saldo jajan ${santri.nama_lengkap} sebesar ${labelNominal}?`)) return false

    setIsSaving(true)
    const toastId = toast.loading('Memproses transaksi...')
    const res = await simpanTransaksiDompet(
      santri.id,
      'JAJAN',
      'KELUAR',
      nominal,
      'Jajan Harian'
    )
    setIsSaving(false)
    toast.dismiss(toastId)

    const error = getActionError(res)
    if (error) {
      toast.error('Gagal', { description: error })
      return false
    } else {
      toast.success('Berhasil', { description: `Saldo jajan ${santri.nama_lengkap} terpotong ${labelNominal}.` })
      refreshAfterMutasi(santri.kamar ?? activeKamar)
      return true
    }
  }

  const handleSaveAutoNominal = async (santri: SantriKamarRow, nominal: number) => {
    if (!nominal) {
      toast.warning('Nominal auto tidak valid')
      return false
    }
    setSavingAutoSantri(prev => ({ ...prev, [santri.id]: true }))
    const res = await saveSantriAutoNominal(santri.id, nominal, asrama)
    setSavingAutoSantri(prev => ({ ...prev, [santri.id]: false }))
    const error = getActionError(res)
    if (error) {
      toast.error('Gagal', { description: error })
      return false
    }
    toast.success('Nominal auto tersimpan', { description: `${santri.nama_lengkap}: ${fmtRp(nominal)}` })
    refreshAfterMutasi(santri.kamar ?? activeKamar)
    return true
  }

  const handleSaveCustomNominal = async (e: FormEvent) => {
    e.preventDefault()
    if (!customNominalSantri) return
    const nominal = parseNominal(customNominalValue)
    if (!nominal) return toast.warning('Nominal tidak valid')

    if (isAutoMode) {
      const ok = await handleSaveAutoNominal(customNominalSantri, nominal)
      if (ok) setCustomNominalSantri(null)
    } else {
      const ok = await handleDirectJajanDeduction(customNominalSantri, nominal)
      if (ok) setCustomNominalSantri(null)
    }
  }

  const openModal = async (santri: SantriKamarRow, intent: 'history' | 'topup' = 'history') => {
    setSelectedSantri(santri)
    if (intent === 'topup') {
      setWalletDompet('JAJAN')
      setWalletJenis('MASUK')
      setWalletNominal('')
    }
    setIsModalOpen(true)
    setLoadingHistory(true)
    setHistory(await getRiwayatTabunganSantri(santri.id))
    setLoadingHistory(false)
  }

  const reloadSelectedHistory = async (santri: SantriKamarRow) => {
    setLoadingHistory(true)
    setHistory(await getRiwayatTabunganSantri(santri.id))
    setLoadingHistory(false)
  }

  const handleWalletSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSantri) return
    const nominal = parseNominal(walletNominal)
    if (!nominal) return toast.warning('Nominal tidak valid')

    setIsSaving(true)
    const res = await simpanTransaksiDompet(selectedSantri.id, walletDompet, walletJenis, nominal, `${walletJenis === 'MASUK' ? 'Setor' : 'Tarik'} ${walletDompet === 'JAJAN' ? 'Uang Jajan' : 'Tabungan'}`)
    setIsSaving(false)
    const error = getActionError(res)
    if (error) return toast.error('Gagal', { description: error })

    toast.success('Transaksi tersimpan')
    setWalletNominal('')
    await reloadSelectedHistory(selectedSantri)
    refreshAfterMutasi(selectedSantri.kamar ?? activeKamar)
  }

  const handleTransferSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSantri) return
    const nominal = parseNominal(transferNominal)
    if (!nominal) return toast.warning('Nominal transfer tidak valid')

    setIsSaving(true)
    const res = await transferSaldo(selectedSantri.id, transferArah, nominal, 'Transfer antar dompet')
    setIsSaving(false)
    const error = getActionError(res)
    if (error) return toast.error('Gagal', { description: error })

    toast.success('Transfer berhasil')
    setTransferNominal('')
    await reloadSelectedHistory(selectedSantri)
    refreshAfterMutasi(selectedSantri.kamar ?? activeKamar)
  }

  const handleDeleteHistory = async (id: string) => {
    if (!selectedSantri) return
    if (!await confirm('Hapus transaksi ini? Jika transaksi transfer, pasangan transfernya ikut dibatalkan.')) return
    const toastId = toast.loading('Menghapus...')
    const res = await hapusTransaksi(id)
    toast.dismiss(toastId)
    if (res?.success) {
      toast.success('Transaksi dibatalkan')
      await reloadSelectedHistory(selectedSantri)
      refreshAfterMutasi(selectedSantri.kamar ?? activeKamar)
    } else if ('error' in res) {
      toast.error('Gagal', { description: res.error })
    }
  }

  const handleToggleSkipAuto = async (santri: SantriKamarRow) => {
    const willExclude = !santri.auto_excluded
    const label = willExclude ? 'Skip auto-potong' : 'Aktifkan auto-potong'
    if (!await confirm(`${label} untuk ${santri.nama_lengkap}?`)) return
    const res = await setSantriAutoExcluded(santri.id, willExclude, willExclude ? 'Pulang / tidak berada di pesantren' : 'Diaktifkan kembali oleh user')
    if ('error' in res) toast.error('Gagal', { description: res.error })
    else {
      toast.success(willExclude ? 'Santri masuk Skip Auto' : 'Auto santri aktif kembali')
      refreshAfterMutasi(santri.kamar ?? activeKamar)
    }
  }

  const toggleSettingDay = (day: number) => {
    setSettingDays(prev => prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day])
  }

  const handleSaveAutoSetting = async (e: FormEvent) => {
    e.preventDefault()
    const res = await saveAutoSetting({
      asrama,
      mode: settingMode,
      jam: settingJam,
      days: settingDays,
      is_active: settingActive,
    })
    if ('error' in res) toast.error('Gagal', { description: res.error })
    else {
      toast.success('Pengaturan auto tersimpan')
      const setting = await getAutoSetting(asrama)
      setAutoSetting(setting)
      setSettingMode(setting.mode)
      setSettingJam(setting.jam)
      setSettingDays(parseDaysValue(setting.days))
      setSettingActive(Boolean(setting.is_active))
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-32">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <DashboardPageHeader
          title="Uang Jajan"
          description="Kelola saldo uang jajan, tabungan, dan potongan harian santri."
          className="flex-1"
        />
        <div className={`flex w-fit items-center gap-2 rounded-lg border p-2 ${userAsrama ? 'border-emerald-200 bg-emerald-50' : 'bg-white'}`}>
          {userAsrama ? <Lock className="h-4 w-4 text-emerald-700"/> : <Home className="h-4 w-4 text-slate-400"/>}
          <select
            value={asrama}
            onChange={e => setAsrama(e.target.value)}
            disabled={!!userAsrama}
            className="cursor-pointer bg-transparent text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed"
          >
            {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-900 p-5 text-white shadow-sm">
          {loadingStats ? (
            <Loader2 className="h-5 w-5 animate-spin"/>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-300">Uang Jajan</p>
                  <p className="font-mono text-2xl font-bold">{fmtRp(stats?.uang_jajan_fisik || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-300">Tabungan</p>
                  <p className="font-mono text-2xl font-bold">{fmtRp(stats?.tabungan_fisik || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-300">Total Titipan</p>
                  <p className="font-mono text-2xl font-bold">{fmtRp(stats?.total_titipan || 0)}</p>
                </div>
              </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
                <div className="flex items-center justify-between rounded bg-white/10 p-2">
                  <span className="flex items-center gap-1 opacity-80"><TrendingUp className="h-3 w-3"/> Masuk Jajan</span>
                  <span className="font-bold text-green-300">+{fmtRp(stats?.masuk_bulan_ini || 0)}</span>
                </div>
                <div className="flex items-center justify-between rounded bg-white/10 p-2">
                  <span className="flex items-center gap-1 opacity-80"><TrendingDown className="h-3 w-3"/> Keluar Jajan</span>
                  <span className="font-bold text-yellow-300">-{fmtRp(stats?.keluar_bulan_ini || 0)}</span>
                </div>
                <div className="flex items-center justify-between rounded bg-white/10 p-2">
                  <span className="flex items-center gap-1 opacity-80"><CalendarClock className="h-3 w-3"/> Auto</span>
                  <span className="font-bold text-orange-300">-{fmtRp(stats?.auto_bulan_ini || 0)}</span>
                </div>
                <button
                  onClick={() => setIsAutoModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded bg-white/10 p-2 font-bold text-white transition-colors hover:bg-white/20"
                >
                  <Settings className="h-3 w-3"/> Atur Auto
                </button>
              </div>
            </>
          )}
        </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cari Santri Cepat</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Ketik nama atau NIS untuk mencari lintas kamar..."
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {!searchText.trim() && (loadingKamars ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-emerald-600"/></div>
      ) : kamars.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-white p-2 shadow-sm">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft className="h-6 w-6"/>
          </button>
          <div className="text-center">
            <span className="text-xs font-bold uppercase text-slate-500">Kamar</span>
            <p className="text-lg font-bold text-slate-800">{activeKamar}</p>
          </div>
          <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight className="h-6 w-6"/>
          </button>
        </div>
      ))}

      {(loadingKamar && listMode === 'kamar') || loadingSearch ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600"/></div>
      ) : roomFeatureBlocked ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center text-slate-400">
          Asrama ini tidak memakai kamar, jadi tidak ikut fitur uang jajan asrama.
        </div>
      ) : visibleSantri.length === 0 && listMode === 'search' ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center text-slate-400">Tidak ada santri yang cocok.</div>
      ) : visibleSantri.length === 0 && !loadingKamar && activeKamar ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center text-slate-400">Kamar kosong.</div>
      ) : visibleSantri.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="divide-y">
            {visibleSantri.map(s => {
              const finalSaldo = s.saldo_jajan
              const isLow = finalSaldo <= 5000

              return (
                <div key={s.id} className="p-4 transition-colors hover:bg-slate-50">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <SantriPhotoAvatar
                        src={s.foto_url}
                        name={s.nama_lengkap}
                        alt={`Foto ${s.nama_lengkap}`}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 whitespace-normal break-words leading-snug">{s.nama_lengkap}</p>
                        <p className="text-xs font-mono text-slate-500">{s.nis}{s.kamar ? ` · Kamar ${s.kamar}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-bold ${finalSaldo < 0 ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-emerald-700'}`}>
                        {fmtRp(finalSaldo)}
                      </p>
                      <p className="text-xs font-semibold text-blue-700">Tabungan {fmtRp(s.saldo_tabungan)}</p>
                      {isAutoMode && (
                        <p className={`text-xs font-bold ${s.auto_excluded ? 'text-amber-600' : s.auto_nominal ? 'text-orange-600' : 'text-slate-400'}`}>
                          {s.auto_excluded ? 'Skip Auto aktif' : s.auto_nominal ? `Auto ${fmtRp(s.auto_nominal)}` : 'Auto belum diatur'}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                        {isAutoMode && (
                          <button
                            onClick={() => handleToggleSkipAuto(s)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
                              s.auto_excluded
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            <Ban className="h-3 w-3"/> {s.auto_excluded ? 'Aktifkan Auto' : 'Skip Auto'}
                          </button>
                        )}
                        <button onClick={() => openModal(s, 'topup')}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100">
                          <Plus className="h-3 w-3"/> Isi Saldo
                        </button>
                        <button onClick={() => openModal(s, 'history')}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100">
                          <History className="h-3 w-3"/> Riwayat
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
                      {JAJAN_OPTS.map(opt => (
                        <button key={opt} onClick={() => isAutoMode ? handleSaveAutoNominal(s, opt) : handleDirectJajanDeduction(s, opt)}
                          disabled={savingAutoSantri[s.id] || (!isAutoMode && s.saldo_jajan < opt)}
                          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                            (isAutoMode ? s.auto_nominal === opt : false)
                              ? 'scale-105 border-orange-600 bg-orange-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-orange-400 disabled:bg-slate-50 disabled:opacity-30'
                          }`}>
                          {opt / 1000}k
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setCustomNominalSantri(s)
                          setCustomNominalValue(isAutoMode && s.auto_nominal ? String(s.auto_nominal) : '')
                        }}
                        disabled={savingAutoSantri[s.id]}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          isAutoMode && s.auto_nominal && !JAJAN_OPTS.includes(s.auto_nominal)
                            ? 'scale-105 border-orange-600 bg-orange-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-400 disabled:bg-slate-50 disabled:opacity-30'
                        }`}
                      >
                        {isAutoMode && s.auto_nominal && !JAJAN_OPTS.includes(s.auto_nominal) ? fmtShortNominal(s.auto_nominal) : 'Custom'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {customNominalSantri && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in">
          <form onSubmit={handleSaveCustomNominal} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <p className="text-sm font-bold text-slate-800">
                {isAutoMode ? 'Nominal Auto' : 'Potong Saldo Jajan'}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">{customNominalSantri.nama_lengkap}</p>
            </div>
            <input
              value={customNominalValue}
              onChange={e => setCustomNominalValue(e.target.value)}
              inputMode="numeric"
              autoFocus
              placeholder="Nominal Rp..."
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomNominalSantri(null)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                disabled={isSaving || !parseNominal(customNominalValue)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-40"
              >
                {isSaving ? 'Memproses...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAutoModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b bg-slate-50 p-5">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Settings className="h-5 w-5 text-emerald-700"/> Atur Mode & Jadwal
                </h3>
                <p className="mt-1 text-sm text-slate-500">Atur cara pakai, jadwal, dan status pemotongan uang jajan.</p>
              </div>
              <button onClick={() => setIsAutoModalOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-white hover:text-slate-800">
                Tutup
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <form onSubmit={handleSaveAutoSetting} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cara pakai</label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    {(['MANUAL', 'AUTO'] as AutoMode[]).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSettingMode(mode)}
                        className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                          settingMode === mode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {settingMode === 'AUTO' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Jam WIB</label>
                        <input value={settingJam} onChange={e => setSettingJam(e.target.value)} type="time" className="w-full rounded-lg border px-2 py-2 text-sm"/>
                      </div>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">
                        <input type="checkbox" checked={settingActive} onChange={e => setSettingActive(e.target.checked)} />
                        Auto aktif
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hari Aktif</label>
                      <div className="flex flex-wrap gap-1">
                        {DAY_OPTIONS.map(day => (
                          <button key={day.value} type="button" onClick={() => toggleSettingDay(day.value)}
                            className={`rounded-lg border px-2 py-1 text-xs font-bold ${settingDays.includes(day.value) ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-xs text-orange-800">
                  {settingMode === 'AUTO'
                    ? 'Jadwal pemotongan otomatis uang jajan santri diatur di sini. Nominal potong diatur per santri dari tombol nominal/custom di kartu santri.'
                    : 'Mode MANUAL aktif. Tidak ada pemotongan otomatis. Anda dapat memotong uang jajan santri langsung dari tombol nominal/custom di kartu santri.'}
                </div>

                <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Simpan Pengaturan</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedSantri && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <SantriPhotoAvatar
                  src={selectedSantri.foto_url}
                  name={selectedSantri.nama_lengkap}
                  alt={`Foto ${selectedSantri.nama_lengkap}`}
                  size="md"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 text-lg font-bold text-slate-800">{selectedSantri.nama_lengkap}</h3>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p className="flex items-center gap-2 font-mono text-emerald-700"><Wallet className="h-4 w-4"/> Uang Jajan: {fmtRp(selectedSantri.saldo_jajan)}</p>
                    <p className="flex items-center gap-2 font-mono text-blue-700"><PiggyBank className="h-4 w-4"/> Tabungan: {fmtRp(selectedSantri.saldo_tabungan)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-emerald-700">
                    <Plus className="h-3 w-3"/> Setor / Tarik
                  </p>
                  <form onSubmit={handleWalletSubmit} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={walletDompet} onChange={e => setWalletDompet(e.target.value as DompetType)} className="rounded-lg border px-2 py-2 text-sm">
                        <option value="JAJAN">Uang Jajan</option>
                        <option value="TABUNGAN">Tabungan</option>
                      </select>
                      <select value={walletJenis} onChange={e => setWalletJenis(e.target.value as TransaksiJenis)} className="rounded-lg border px-2 py-2 text-sm">
                        <option value="MASUK">Setor</option>
                        <option value="KELUAR">Tarik</option>
                      </select>
                    </div>
                    <input value={walletNominal} onChange={e => setWalletNominal(e.target.value)} inputMode="numeric" placeholder="Nominal Rp..."
                      className="w-full rounded-xl border border-slate-200 p-2 outline-none focus:ring-2 focus:ring-emerald-500"/>
                    <button disabled={isSaving} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                      {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-blue-700">
                    <ArrowRightLeft className="h-3 w-3"/> Transfer Dompet
                  </p>
                  <form onSubmit={handleTransferSubmit} className="space-y-2">
                    <select value={transferArah} onChange={e => setTransferArah(e.target.value as 'JAJAN_TO_TABUNGAN' | 'TABUNGAN_TO_JAJAN')} className="w-full rounded-lg border px-2 py-2 text-sm">
                      <option value="JAJAN_TO_TABUNGAN">Uang Jajan ke Tabungan</option>
                      <option value="TABUNGAN_TO_JAJAN">Tabungan ke Uang Jajan</option>
                    </select>
                    <input value={transferNominal} onChange={e => setTransferNominal(e.target.value)} inputMode="numeric" placeholder="Nominal transfer..."
                      className="w-full rounded-xl border border-slate-200 p-2 outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button disabled={isSaving} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                      {isSaving ? 'Memproses...' : 'Transfer'}
                    </button>
                  </form>
                </div>
              </div>

              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <History className="h-4 w-4"/> Riwayat Terakhir
                </h4>
                {loadingHistory ? (
                  <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400"/></div>
                ) : history.length === 0 ? (
                  <p className="text-center text-xs italic text-slate-400">Belum ada transaksi.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-white">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-bold ${h.jenis === 'MASUK' ? 'text-green-600' : 'text-orange-600'}`}>
                              {h.jenis === 'MASUK' ? '+' : '-'} {fmtRp(h.nominal)}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${h.dompet === 'JAJAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                              {h.dompet === 'JAJAN' ? 'Uang Jajan' : 'Tabungan'}
                            </span>
                            {h.source === 'AUTO_POTONG' && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Auto</span>}
                            {h.source === 'TRANSFER' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Transfer</span>}
                          </div>
                          <p className="truncate text-[10px] text-slate-500">
                            {format(new Date(h.created_at), 'dd MMM HH:mm', { locale: id })} · {h.keterangan}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteHistory(h.id)}
                          className="p-2 text-slate-300 hover:text-red-500" title="Hapus (Koreksi)">
                          <Trash2 className="h-4 w-4"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50 p-4">
              <button onClick={() => selectedSantri && handleToggleSkipAuto(selectedSantri)} className="flex items-center gap-1 text-sm font-bold text-amber-600 hover:underline">
                <Ban className="h-4 w-4"/> {selectedSantri.auto_excluded ? 'Aktifkan auto' : 'Skip auto'}
              </button>
              <button onClick={() => setIsModalOpen(false)} className="text-sm font-bold text-slate-500 hover:text-slate-800">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
