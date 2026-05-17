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
  getAutoRules,
  saveAutoRule,
  deleteAutoRule,
  skipAutoPotongToday,
  runAutoPotongNow,
  type DompetType,
  type TransaksiJenis,
  type AutoRuleScope,
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
type AutoRuleRow = Awaited<ReturnType<typeof getAutoRules>>[number]
type ActionResult =
  | Awaited<ReturnType<typeof simpanTopup>>
  | Awaited<ReturnType<typeof simpanJajanMassal>>
  | Awaited<ReturnType<typeof simpanTransaksiDompet>>
  | Awaited<ReturnType<typeof transferSaldo>>

function getActionError(res: ActionResult) {
  return 'error' in res ? res.error : null
}

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function parseNominal(value: string) {
  return parseInt(value.replace(/\D/g, ''), 10) || 0
}

function describeDays(days: string) {
  try {
    const parsed = JSON.parse(days) as number[]
    if (parsed.length === 7) return 'Setiap hari'
    return DAY_OPTIONS.filter(day => parsed.includes(day.value)).map(day => day.label).join(', ')
  } catch {
    return '-'
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

  const [draftJajan, setDraftJajan] = useState<Record<string, number>>({})
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<SantriKamarRow | null>(null)
  const [walletNominal, setWalletNominal] = useState('')
  const [walletDompet, setWalletDompet] = useState<DompetType>('JAJAN')
  const [walletJenis, setWalletJenis] = useState<TransaksiJenis>('MASUK')
  const [transferNominal, setTransferNominal] = useState('')
  const [transferArah, setTransferArah] = useState<'JAJAN_TO_TABUNGAN' | 'TABUNGAN_TO_JAJAN'>('JAJAN_TO_TABUNGAN')
  const [history, setHistory] = useState<RiwayatTabunganRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [autoRules, setAutoRules] = useState<AutoRuleRow[]>([])
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false)
  const [ruleScope, setRuleScope] = useState<AutoRuleScope>('ASRAMA')
  const [ruleKamar, setRuleKamar] = useState('')
  const [ruleSantriId, setRuleSantriId] = useState('')
  const [ruleNominal, setRuleNominal] = useState('10000')
  const [ruleJam, setRuleJam] = useState('06:00')
  const [ruleDays, setRuleDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [ruleActive, setRuleActive] = useState(true)

  const setDrafts = (val: SetStateAction<Record<string, number>>) => setDraftJajan(val)

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
      setDrafts({})
    })

    getKamarsTabungan(asrama).then(res => {
      setKamars(res.kamars)
      setLoadingKamars(false)
      setRuleKamar(res.kamars[0] ?? '')
    })
    getStatsTabungan(asrama).then(res => {
      setStats(res)
      setLoadingStats(false)
    })
    getAutoRules(asrama).then(setAutoRules)
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
  const allRuleSantriOptions = [...searchRows, ...santriKamar].filter((row, index, arr) => arr.findIndex(item => item.id === row.id) === index)

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
    getAutoRules(asrama).then(setAutoRules)
  }

  const handleSelectJajan = (santriId: string, nominal: number, saldo: number) => {
    if (nominal > saldo) { toast.warning('Saldo uang jajan tidak cukup.'); return }
    setDraftJajan(prev => {
      if (prev[santriId] === nominal) { const n = { ...prev }; delete n[santriId]; return n }
      return { ...prev, [santriId]: nominal }
    })
  }

  const handleManualInput = (santriId: string, value: string, saldo: number) => {
    const val = parseInt(value) || 0
    if (val > saldo) return
    if (val > 0) setDraftJajan(prev => ({ ...prev, [santriId]: val }))
    else setDraftJajan(prev => { const n = { ...prev }; delete n[santriId]; return n })
  }

  const toggleManualMode = (santriId: string) => {
    setManualMode(prev => ({ ...prev, [santriId]: !prev[santriId] }))
    setDraftJajan(prev => { const n = { ...prev }; delete n[santriId]; return n })
  }

  const handleSimpanJajan = async () => {
    const list = (Object.entries(draftJajan) as [string, number][]).map(([id, nominal]) => ({ santriId: id, nominal }))
    if (!list.length) return
    const overLimit = list.filter(l => l.nominal > 20000)
    const warn = overLimit.length ? `\n\n${overLimit.length} santri mengambil > 20.000.` : ''
    if (!await confirm(`Simpan jajan untuk ${list.length} santri?\nTotal: ${fmtRp(list.reduce((a, b) => a + b.nominal, 0))}${warn}`)) return

    setIsSaving(true)
    const toastId = toast.loading('Memproses transaksi...')
    const res = await simpanJajanMassal(list)
    setIsSaving(false)
    toast.dismiss(toastId)

    const error = getActionError(res)
    if (error) toast.error('Gagal', { description: error })
    else {
      toast.success('Berhasil', { description: 'Saldo uang jajan santri telah terpotong.' })
      setDraftJajan({})
      refreshAfterMutasi(activeKamar)
    }
  }

  const openModal = async (santri: SantriKamarRow) => {
    setSelectedSantri(santri)
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

  const handleSkipToday = async (santri: SantriKamarRow) => {
    if (!await confirm(`Lewati auto-potong hari ini untuk ${santri.nama_lengkap}?`)) return
    const res = await skipAutoPotongToday(santri.id, 'Pulang / tidak membawa uang jajan')
    if ('error' in res) toast.error('Gagal', { description: res.error })
    else toast.success('Auto-potong hari ini dilewati')
  }

  const toggleRuleDay = (day: number) => {
    setRuleDays(prev => prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day])
  }

  const handleSaveRule = async (e: FormEvent) => {
    e.preventDefault()
    const res = await saveAutoRule({
      scope_type: ruleScope,
      asrama,
      kamar: ruleScope === 'KAMAR' ? ruleKamar : null,
      santri_id: ruleScope === 'SANTRI' ? ruleSantriId : null,
      nominal: parseNominal(ruleNominal),
      jam: ruleJam,
      days: ruleDays,
      is_active: ruleActive,
    })
    if ('error' in res) toast.error('Gagal', { description: res.error })
    else {
      toast.success('Rule auto-potong tersimpan')
      getAutoRules(asrama).then(setAutoRules)
    }
  }

  const totalJajanDraft = Object.values(draftJajan).reduce((a, b) => a + b, 0)

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
              const draftVal = draftJajan[s.id]
              const finalSaldo = s.saldo_jajan - (draftVal || 0)
              const isLow = finalSaldo <= 5000
              const isManual = manualMode[s.id]

              return (
                <div key={s.id} className={`p-4 transition-colors ${draftVal ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
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
                      <div className="mt-1 flex justify-end gap-2">
                        <button onClick={() => handleSkipToday(s)} className="text-[10px] font-bold text-amber-600 hover:underline">
                          Skip auto
                        </button>
                        <button onClick={() => openModal(s)}
                          className="flex items-center justify-end gap-1 text-[10px] font-bold text-blue-600 hover:underline">
                          <Plus className="h-3 w-3"/> Detail
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isManual ? (
                      <div className="flex flex-1 animate-in items-center gap-2 fade-in">
                        <input type="number" placeholder="0"
                          className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                          autoFocus
                          onChange={e => handleManualInput(s.id, e.target.value, s.saldo_jajan)}
                        />
                        <button onClick={() => toggleManualMode(s.id)} className="whitespace-nowrap text-xs text-slate-500 underline">Batal</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
                          {JAJAN_OPTS.map(opt => (
                            <button key={opt} onClick={() => handleSelectJajan(s.id, opt, s.saldo_jajan)}
                              disabled={s.saldo_jajan < opt}
                              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                draftVal === opt
                                  ? 'scale-105 border-orange-600 bg-orange-600 text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-400 disabled:bg-slate-50 disabled:opacity-30'
                              }`}>
                              {opt / 1000}k
                            </button>
                          ))}
                        </div>
                        <button onClick={() => toggleManualMode(s.id)}
                          className="rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">
                          Manual
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalJajanDraft > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 animate-in px-4 slide-in-from-bottom-4">
          <button onClick={handleSimpanJajan} disabled={isSaving}
            className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-6 py-4 text-white shadow-2xl transition-transform hover:bg-black active:scale-95">
            <div className="text-left">
              <p className="text-xs text-slate-400">Total Jajan Hari Ini</p>
              <p className="text-xl font-bold text-orange-400">{fmtRp(totalJajanDraft)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-bold">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5"/>}
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </div>
          </button>
        </div>
      )}

      {isAutoModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b bg-slate-50 p-5">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Settings className="h-5 w-5 text-emerald-700"/> Auto Potong Uang Jajan
                </h3>
                <p className="mt-1 text-sm text-slate-500">Atur rule massal, override santri, dan jadwal potong otomatis.</p>
              </div>
              <button onClick={() => setIsAutoModalOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-white hover:text-slate-800">
                Tutup
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <form onSubmit={handleSaveRule} className="space-y-3 border-b p-5 lg:border-b-0 lg:border-r">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Cakupan</label>
                    <select value={ruleScope} onChange={e => setRuleScope(e.target.value as AutoRuleScope)} className="w-full rounded-lg border px-2 py-2 text-sm">
                      <option value="ASRAMA">Semua asrama</option>
                      <option value="KAMAR">Per kamar</option>
                      <option value="SANTRI">Override santri</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Jam WIB</label>
                    <input value={ruleJam} onChange={e => setRuleJam(e.target.value)} type="time" className="w-full rounded-lg border px-2 py-2 text-sm"/>
                  </div>
                </div>

                {ruleScope === 'KAMAR' && (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Kamar</label>
                    <select value={ruleKamar} onChange={e => setRuleKamar(e.target.value)} className="w-full rounded-lg border px-2 py-2 text-sm">
                      {kamars.map(kamar => <option key={kamar} value={kamar}>Kamar {kamar}</option>)}
                    </select>
                  </div>
                )}

                {ruleScope === 'SANTRI' && (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Santri</label>
                    <select value={ruleSantriId} onChange={e => setRuleSantriId(e.target.value)} className="w-full rounded-lg border px-2 py-2 text-sm">
                      <option value="">Pilih dari daftar/search...</option>
                      {allRuleSantriOptions.map(s => <option key={s.id} value={s.id}>{s.nama_lengkap} - {s.nis}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nominal</label>
                  <input value={ruleNominal} onChange={e => setRuleNominal(e.target.value)} inputMode="numeric" placeholder="Nominal" className="w-full rounded-lg border px-2 py-2 text-sm"/>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hari Aktif</label>
                  <div className="flex flex-wrap gap-1">
                    {DAY_OPTIONS.map(day => (
                      <button key={day.value} type="button" onClick={() => toggleRuleDay(day.value)}
                        className={`rounded-lg border px-2 py-1 text-xs font-bold ${ruleDays.includes(day.value) ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={ruleActive} onChange={e => setRuleActive(e.target.checked)} />
                  Rule aktif
                </label>

                <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Simpan Rule</button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await runAutoPotongNow()
                    if ('error' in res) toast.error('Gagal', { description: res.error })
                    else toast.success(`Diproses: ${res.result.deducted} santri`)
                    refreshAfterMutasi(activeKamar)
                  }}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  Proses Sekarang
                </button>
              </form>

              <div className="min-h-0 p-5">
                <h4 className="mb-3 text-sm font-bold text-slate-700">Rule Aktif</h4>
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {autoRules.length === 0 ? <p className="text-xs text-slate-400">Belum ada rule.</p> : autoRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 whitespace-normal break-words leading-snug">
                          {rule.scope_type === 'ASRAMA' ? 'Semua asrama' : rule.scope_type === 'KAMAR' ? `Kamar ${rule.kamar}` : rule.santri_nama}
                        </p>
                        <p className="text-slate-500">{fmtRp(rule.nominal)} · {rule.jam} · {describeDays(rule.days)}</p>
                      </div>
                      <button onClick={() => deleteAutoRule(rule.id).then(() => getAutoRules(asrama).then(setAutoRules))} className="p-1 text-slate-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
              <button onClick={() => selectedSantri && handleSkipToday(selectedSantri)} className="flex items-center gap-1 text-sm font-bold text-amber-600 hover:underline">
                <Ban className="h-4 w-4"/> Skip auto hari ini
              </button>
              <button onClick={() => setIsModalOpen(false)} className="text-sm font-bold text-slate-500 hover:text-slate-800">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
