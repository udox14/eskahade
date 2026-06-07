'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getNominalSPP, getStatusSPP, bayarSPP, getKamarsSPP, getDashboardSPPKamar, getDashboardSPPSadesa, getClientRestriction, simpanSppBatch, batalkanPembayaranSPP, getSppBillingStart, searchDashboardSPP, getTunggakanHistorisSPP, simpanTunggakanHistorisSPP, bayarTunggakanHistorisSPP, getTagihanDitiadakanSPP, simpanTagihanDitiadakanSPP, simpanTagihanDitiadakanKelasSPP, cabutTagihanDitiadakanSPP } from './actions'
import { Search, CreditCard, CheckCircle, Loader2, ArrowLeft, Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle, RotateCcw, X, WalletCards, Ban, CalendarX } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const SADESA_UNIT = 'SADESA'

type FilterStatus = 'SEMUA' | 'SUDAH_BAYAR_INI' | 'NUNGGAK' | 'AMAN'

export default function SPPPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [unitSetor, setUnitSetor] = useState(ASRAMA_LIST[0])
  const [scope, setScope] = useState<{ kind: 'ASRAMA' | 'SADESA' | 'ADMIN'; lockedUnit: string | null; defaultUnit: string; allowedUnits: string[]; canAdjustBilling: boolean } | null>(null)

  // Daftar kamar (ringan, hanya nama kamar)
  const [kamars, setKamars] = useState<string[]>([])
  const [kamarIdx, setKamarIdx] = useState(0)
  const [loadingKamars, setLoadingKamars] = useState(false)

  // Data santri kamar aktif (lazy)
  const [santriKamar, setSantriKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(false)
  // Cache: kamar → santri[], supaya tidak re-fetch kamar yang sudah pernah dibuka
  const [kamarCache, setKamarCache] = useState<Record<string, any[]>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // Payment view
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [tagihanDitiadakan, setTagihanDitiadakan] = useState<any[]>([])
  const [tunggakanHistoris, setTunggakanHistoris] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [billingStart, setBillingStart] = useState({ tahun: 2026, bulan: 6, value: '2026-06' })
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null)
  const [historisModalOpen, setHistorisModalOpen] = useState(false)
  const [historisTahun, setHistorisTahun] = useState(new Date().getFullYear())
  const [historisMonths, setHistorisMonths] = useState<number[]>([])
  const [historisNominal, setHistorisNominal] = useState('70000')
  const [historisCatatan, setHistorisCatatan] = useState('')
  const [savingHistoris, setSavingHistoris] = useState(false)
  const [payingHistorisId, setPayingHistorisId] = useState<string | null>(null)
  const [waiveModalOpen, setWaiveModalOpen] = useState(false)
  const [waiveMode, setWaiveMode] = useState<'SINGLE' | 'BATCH'>('SINGLE')
  const [waiveTargetMonth, setWaiveTargetMonth] = useState<number | null>(null)
  const [waiveMonths, setWaiveMonths] = useState<number[]>([])
  const [waiveReason, setWaiveReason] = useState('')
  const [savingWaive, setSavingWaive] = useState(false)
  const [restoringWaiveKey, setRestoringWaiveKey] = useState<string | null>(null)
  const [kelasWaive, setKelasWaive] = useState('9')
  const [kelasWaiveUnit, setKelasWaiveUnit] = useState('SEMUA')
  const [kelasWaiveMonths, setKelasWaiveMonths] = useState<number[]>([])
  const [kelasWaiveReason, setKelasWaiveReason] = useState('')
  const [savingKelasWaive, setSavingKelasWaive] = useState(false)
  const [kelasWaiveModalOpen, setKelasWaiveModalOpen] = useState(false)

  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun
  const isSadesaMode = unitSetor === SADESA_UNIT
  const currentUnitLabel = isSadesaMode ? 'SADESA' : unitSetor

  // Init
  useEffect(() => {
    getNominalSPP().then(setNominal)
    getSppBillingStart().then(setBillingStart)
    getClientRestriction()
      .then(res => {
        if (!res) return
        setScope(res)
        setUnitSetor(res.defaultUnit)
        setKelasWaiveUnit(res.kind === 'ADMIN' ? 'SEMUA' : res.defaultUnit)
      })
      .catch((error: any) => {
        toast.error(error?.message || 'Gagal memuat batas akses SPP.')
      })
  }, [])

  // Load daftar kamar saat asrama/tahun berubah — ringan, hanya distinct kamar
  useEffect(() => {
    if (!scope || !unitSetor) return
    if (!scope.allowedUnits.includes(unitSetor)) return
    setLoadingKamars(true)
    setKamars([])
    setSantriKamar([])
    setKamarCache({})
    setKamarIdx(0)
    setDrafts({})
    getKamarsSPP(tahun, unitSetor)
      .then(res => {
        setKamars(res)
      })
      .catch((error: any) => {
        toast.error(error?.message || 'Gagal memuat daftar kamar.')
      })
      .finally(() => {
        setLoadingKamars(false)
      })
  }, [scope, unitSetor, tahun])

  // Load santri kamar aktif — lazy, dengan cache
  useEffect(() => {
    if (!scope) return
    if (!scope.allowedUnits.includes(unitSetor)) return

    if (isSadesaMode) {
      setLoadingKamar(true)
      setSantriKamar([])
      getDashboardSPPSadesa(tahun)
        .then(res => {
          setSantriKamar(res)
        })
        .catch((error: any) => {
          toast.error(error?.message || 'Gagal memuat daftar santri SADESA.')
        })
        .finally(() => {
          setLoadingKamar(false)
        })
      return
    }

    if (!kamars.length) return
    const kamar = kamars[kamarIdx]
    if (!kamar) return

    // Kalau sudah di-cache, pakai cache
    if (kamarCache[kamar]) {
      setSantriKamar(kamarCache[kamar])
      return
    }

    setLoadingKamar(true)
    setSantriKamar([])
    getDashboardSPPKamar(tahun, unitSetor, kamar)
      .then(res => {
        setSantriKamar(res)
        setKamarCache(prev => ({ ...prev, [kamar]: res }))
      })
      .catch((error: any) => {
        toast.error(error?.message || 'Gagal memuat daftar santri kamar.')
      })
      .finally(() => {
        setLoadingKamar(false)
      })
  }, [scope, kamarIdx, kamars, isSadesaMode, tahun, unitSetor])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!scope) return
    if (!scope.allowedUnits.includes(unitSetor)) return
    if (q.length < 2) {
      setSearchResults([])
      setLoadingSearch(false)
      return
    }

    setLoadingSearch(true)
    const timer = window.setTimeout(() => {
      searchDashboardSPP(tahun, unitSetor, q)
        .then(setSearchResults)
        .catch((error: any) => {
          toast.error(error?.message || 'Gagal mencari data santri.')
        })
        .finally(() => setLoadingSearch(false))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [scope, searchQuery, tahun, unitSetor])

  // Invalidate cache kamar tertentu setelah simpan batch
  const invalidateKamar = (kamar: string) => {
    setKamarCache(prev => { const n = { ...prev }; delete n[kamar]; return n })
  }

  const refreshActiveList = async () => {
    if (isSadesaMode) {
      const data = await getDashboardSPPSadesa(tahun)
      setSantriKamar(data)
      return
    }
    if (!activeKamar) return
    const data = await getDashboardSPPKamar(tahun, unitSetor, activeKamar)
    setSantriKamar(data)
    setKamarCache(prev => ({ ...prev, [activeKamar]: data }))
  }

  // Back button
  useEffect(() => {
    if (view === 'PAYMENT') window.history.pushState({ view: 'PAYMENT' }, '')
  }, [view])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'PAYMENT') {
        setView('LIST')
        setSelectedSantri(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Payment
  useEffect(() => {
    if (view === 'PAYMENT' && selectedSantri) {
      Promise.all([
        getStatusSPP(selectedSantri.id, tahun),
        getTagihanDitiadakanSPP(selectedSantri.id, tahun),
      ]).then(([status, ditiadakan]) => {
        setRiwayatBayar(status)
        setTagihanDitiadakan(ditiadakan)
        setSelectedMonths([])
      })
      loadTunggakanHistoris(selectedSantri.id)
    }
  }, [view, selectedSantri, tahun])

  const refreshSelectedStatus = async () => {
    if (!selectedSantri) return
    const [status, ditiadakan] = await Promise.all([
      getStatusSPP(selectedSantri.id, tahun),
      getTagihanDitiadakanSPP(selectedSantri.id, tahun),
    ])
    setRiwayatBayar(status)
    setTagihanDitiadakan(ditiadakan)
    setSelectedMonths([])
  }

  const loadTunggakanHistoris = async (santriId = selectedSantri?.id) => {
    if (!santriId) return
    const data = await getTunggakanHistorisSPP(santriId)
    setTunggakanHistoris(data)
  }

  const handleSelectSantri = (santri: any) => {
    setSelectedSantri(santri)
    setView('PAYMENT')
  }

  const handleBayar = async () => {
    if (selectedMonths.length === 0) return
    if (!await confirm(`Bayar SPP ${selectedMonths.length} bulan? Total: Rp ${(selectedMonths.length * nominal).toLocaleString('id-ID')}`)) return
    const toastId = toast.loading('Memproses...')
    const res = await bayarSPP(selectedSantri.id, tahun, selectedMonths, nominal)
    toast.dismiss(toastId)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success('Pembayaran Berhasil!')
      // Invalidate cache kamar santri ini supaya refresh saat kembali
      invalidateKamar(selectedSantri.kamar)
      await refreshActiveList()
      await refreshSelectedStatus()
    }
  }

  const toggleDraft = (e: React.MouseEvent, santri: any) => {
    e.stopPropagation()
    setDrafts(prev => {
      const next = { ...prev }
      if (next[santri.id]) { delete next[santri.id] }
      else { next[santri.id] = { nominal, bulan: currentMonthIdx, nama: santri.nama_lengkap } }
      return next
    })
  }

  const handleSimpanBatch = async () => {
    const listPayload = Object.keys(drafts).map(id => ({
      santriId: id, bulan: drafts[id].bulan, tahun, nominal: drafts[id].nominal,
    }))
    if (!listPayload.length) return
    if (!await confirm(`Simpan pembayaran untuk ${listPayload.length} santri?`)) return
    setIsSavingBatch(true)
    const res = await simpanSppBatch(listPayload)
    setIsSavingBatch(false)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success(`Sukses menyimpan ${(res as any).count} pembayaran!`)
      // Invalidate cache kamar aktif
      invalidateKamar(kamars[kamarIdx])
      await refreshActiveList()
      setDrafts({})
    }
  }

  const toggleBulan = (idx: number) => {
    if (isBeforeBillingStart(tahun, idx)) return
    if (riwayatBayar.some(r => r.bulan === idx)) return
    if (selectedSantri?.bebas_spp) return
    if (tagihanDitiadakan.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

  const isBeforeBillingStart = (year: number, month: number) => (year * 100 + month) < (billingStart.tahun * 100 + billingStart.bulan)

  const handleBatalkanPembayaran = async (e: React.MouseEvent, dataBayar: any) => {
    e.stopPropagation()
    if (!await confirm(`Batalkan status lunas bulan ${BULAN_LIST[dataBayar.bulan - 1]}? Bulan ini akan kembali menjadi belum bayar / nunggak.`)) return
    setCancelingPaymentId(dataBayar.id)
    const res = await batalkanPembayaranSPP(dataBayar.id)
    setCancelingPaymentId(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Status lunas dibatalkan')
    invalidateKamar(selectedSantri.kamar)
    await refreshActiveList()
    await refreshSelectedStatus()
  }

  const openHistorisModal = () => {
    setHistorisTahun(billingStart.bulan === 1 ? billingStart.tahun - 1 : billingStart.tahun)
    setHistorisNominal(String(nominal))
    setHistorisMonths([])
    setHistorisCatatan('')
    setHistorisModalOpen(true)
  }

  const toggleHistorisMonth = (month: number) => {
    setHistorisMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b))
  }

  const isHistorisMonthAllowed = (year: number, month: number) => (year * 100 + month) < (billingStart.tahun * 100 + billingStart.bulan)

  const handleSimpanHistoris = async () => {
    if (!selectedSantri) return
    const cleanNominal = Number(historisNominal.replace(/\D/g, ''))
    if (!historisMonths.length) return toast.warning('Pilih minimal satu bulan tunggakan.')
    setSavingHistoris(true)
    const res = await simpanTunggakanHistorisSPP(selectedSantri.id, historisTahun, historisMonths, cleanNominal, historisCatatan)
    setSavingHistoris(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`Tunggakan historis tersimpan: ${res.count} bulan`)
    setHistorisModalOpen(false)
    await loadTunggakanHistoris()
    await refreshActiveList()
  }

  const handleBayarHistoris = async (item: any) => {
    if (!await confirm(`Lunaskan tunggakan ${BULAN_LIST[item.bulan - 1]} ${item.tahun}?`)) return
    setPayingHistorisId(item.id)
    const res = await bayarTunggakanHistorisSPP(item.id)
    setPayingHistorisId(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Tunggakan historis dilunasi')
    await loadTunggakanHistoris()
    await refreshActiveList()
  }

  const openSingleWaiveModal = (e: React.MouseEvent, month: number) => {
    e.stopPropagation()
    setWaiveMode('SINGLE')
    setWaiveTargetMonth(month)
    setWaiveMonths([month])
    setWaiveReason('')
    setWaiveModalOpen(true)
  }

  const openBatchWaiveModal = () => {
    setWaiveMode('BATCH')
    setWaiveTargetMonth(null)
    setWaiveMonths([currentMonthIdx])
    setWaiveReason('')
    setWaiveModalOpen(true)
  }

  const toggleWaiveMonth = (month: number) => {
    if (isBeforeBillingStart(tahun, month)) return
    setWaiveMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b))
  }

  const handleSimpanWaive = async () => {
    const targetIds = waiveMode === 'SINGLE'
      ? selectedSantri ? [selectedSantri.id] : []
      : Object.keys(drafts)
    if (!targetIds.length) return toast.warning('Pilih minimal satu santri.')
    if (!waiveMonths.length) return toast.warning('Pilih minimal satu bulan.')
    if (!waiveReason.trim()) return toast.warning('Alasan wajib diisi.')

    setSavingWaive(true)
    const res = await simpanTagihanDitiadakanSPP(targetIds, tahun, waiveMonths, waiveReason)
    setSavingWaive(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`Tidak ada tagihan tersimpan: ${res.count} data`)
    setWaiveModalOpen(false)
    setDrafts({})
    await refreshActiveList()
    if (selectedSantri) await refreshSelectedStatus()
  }

  const handleCabutWaive = async (e: React.MouseEvent, month: number) => {
    e.stopPropagation()
    if (!selectedSantri) return
    if (!await confirm(`Aktifkan kembali tagihan ${BULAN_LIST[month - 1]} ${tahun}?`)) return
    const key = `${tahun}-${month}`
    setRestoringWaiveKey(key)
    const res = await cabutTagihanDitiadakanSPP(selectedSantri.id, tahun, month)
    setRestoringWaiveKey(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Tagihan aktif kembali')
    await refreshActiveList()
    await refreshSelectedStatus()
  }

  const toggleKelasWaiveMonth = (month: number) => {
    if (isBeforeBillingStart(tahun, month)) return
    setKelasWaiveMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b))
  }

  const handleSimpanKelasWaive = async () => {
    if (!kelasWaiveMonths.length) return toast.warning('Pilih minimal satu bulan.')
    if (!kelasWaiveReason.trim()) return toast.warning('Alasan wajib diisi.')
    if (!await confirm(`Tiadakan tagihan SPP kelas ${kelasWaive} untuk ${kelasWaiveMonths.length} bulan?`)) return
    setSavingKelasWaive(true)
    const res = await simpanTagihanDitiadakanKelasSPP(kelasWaiveUnit, tahun, kelasWaiveMonths, Number(kelasWaive), kelasWaiveReason)
    setSavingKelasWaive(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`Tidak ada tagihan tersimpan untuk ${res.santriCount} santri`)
    setKelasWaiveReason('')
    setKelasWaiveModalOpen(false)
    await refreshActiveList()
  }

  const handleBackToList = () => { window.history.back() }

  const activeKamar = kamars[kamarIdx] ?? ''

  const isSearching = searchQuery.trim().length >= 2
  const sourceSantri = isSearching ? searchResults : santriKamar
  const filteredSantri = sourceSantri.filter(s => {
    if (filterStatus === 'SUDAH_BAYAR_INI') return s.bulan_ini_lunas
    if (filterStatus === 'NUNGGAK') return s.jumlah_tunggakan > 0
    if (filterStatus === 'AMAN') return s.jumlah_tunggakan === 0
    return true
  })

  const totalDraft = Object.keys(drafts).length
  const totalNominalDraft = Object.values(drafts).reduce((a: number, b: any) => a + b.nominal, 0)
  const tunggakanHistorisBelumLunas = tunggakanHistoris.filter(item => item.status !== 'LUNAS')
  const totalHistorisBelumLunas = tunggakanHistorisBelumLunas.reduce((sum, item) => sum + Number(item.nominal_tagihan || 0), 0)
  const waiveModal = waiveModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Set Tidak Ada Tagihan</h3>
            <p className="mt-1 text-xs text-slate-500">
              {waiveMode === 'SINGLE'
                ? `${selectedSantri?.nama_lengkap || 'Santri'} - ${waiveTargetMonth ? BULAN_LIST[waiveTargetMonth - 1] : ''} ${tahun}`
                : `${Object.keys(drafts).length} santri dipilih - Tahun ${tahun}`}
            </p>
          </div>
          <button onClick={() => setWaiveModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-500">Bulan</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BULAN_LIST.map((bulanNama, idx) => {
                const month = idx + 1
                const disabled = waiveMode === 'SINGLE' ? month !== waiveTargetMonth : isBeforeBillingStart(tahun, month)
                const selected = waiveMonths.includes(month)
                return (
                  <button key={month} type="button" onClick={() => !disabled && toggleWaiveMonth(month)} disabled={disabled}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                    }`}>
                    {bulanNama}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Alasan</label>
            <textarea value={waiveReason} onChange={e => setWaiveReason(e.target.value)} rows={3}
              placeholder="Contoh: Pulang libur kenaikan kelas / tidak berada di pesantren."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Status ini tidak dicatat sebagai pembayaran dan bulan terkait tidak dihitung sebagai tunggakan.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button onClick={() => setWaiveModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
          <button onClick={handleSimpanWaive} disabled={savingWaive} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 hover:bg-blue-800">
            {savingWaive ? <Loader2 className="w-4 h-4 animate-spin"/> : <CalendarX className="w-4 h-4"/>}
            Simpan
          </button>
        </div>
      </div>
    </div>
  ) : null

  // ── VIEW: LIST ──────────────────────────────────────────────────────────
  if (view === 'LIST') return (
    <div className="space-y-6 max-w-5xl mx-auto pb-32">

      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Dashboard SPP"
          description={isSadesaMode ? 'Monitoring pembayaran seluruh santri kategori SADESA.' : 'Monitoring pembayaran santri per kamar.'}
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">-</button>
            <span className="px-2 font-mono font-bold text-slate-700">{tahun}</span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">+</button>
          </div>
          <div className={`p-2 rounded-lg border flex items-center gap-2 ${scope?.lockedUnit ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
            {scope?.lockedUnit ? <Lock className="w-3 h-3 text-orange-600"/> : <Home className="w-4 h-4 text-slate-400"/>}
            <select
              value={unitSetor}
              onChange={e => setUnitSetor(e.target.value)}
              disabled={!!scope?.lockedUnit}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              {(scope?.allowedUnits || [...ASRAMA_LIST]).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5"/>
          <input
            type="text"
            placeholder="Cari nama santri..."
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0"/>
          {(['SEMUA', 'SUDAH_BAYAR_INI', 'NUNGGAK', 'AMAN'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === f
                  ? f === 'SUDAH_BAYAR_INI' ? 'bg-green-100 text-green-700 shadow-sm'
                  : f === 'NUNGGAK' ? 'bg-red-100 text-red-700 shadow-sm'
                  : 'bg-white shadow text-slate-800'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}>
              {f === 'SEMUA' ? 'Semua' : f === 'SUDAH_BAYAR_INI' ? `Lunas ${BULAN_LIST[currentMonthIdx - 1]}` : f === 'NUNGGAK' ? 'Menunggak' : 'Aman'}
            </button>
          ))}
        </div>
        {scope?.canAdjustBilling && (
          <button
            type="button"
            onClick={() => setKelasWaiveModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
          >
            <CalendarX className="h-4 w-4" />
            Tidak Ada Tagihan
          </button>
        )}
      </div>

      {/* KAMAR NAVIGATOR */}
      {loadingKamars ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400"/></div>
      ) : !isSadesaMode && kamars.length > 0 && (
        <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border">
          <button onClick={() => setKamarIdx(i => Math.max(0, i - 1))} disabled={kamarIdx === 0}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronLeft className="w-6 h-6"/>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Kamar Saat Ini</span>
            <select value={kamarIdx} onChange={e => setKamarIdx(Number(e.target.value))}
              className="font-bold text-lg text-slate-800 text-center outline-none bg-transparent cursor-pointer">
              {kamars.map((k, idx) => <option key={k} value={idx}>{k}</option>)}
            </select>
          </div>
          <button onClick={() => setKamarIdx(i => Math.min(kamars.length - 1, i + 1))} disabled={kamarIdx === kamars.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronRight className="w-6 h-6"/>
          </button>
        </div>
      )}

      {/* SANTRI LIST */}
      {loadingKamar || loadingSearch ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
      ) : !isSadesaMode && !activeKamar && !isSearching ? null : filteredSantri.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">
          {isSearching ? 'Tidak ada santri yang cocok dengan pencarian.' : santriKamar.length === 0 ? (isSadesaMode ? 'Belum ada santri kategori SADESA.' : 'Tidak ada santri di kamar ini.') : 'Tidak ada santri yang cocok dengan filter.'}
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b font-bold text-slate-700 text-sm flex justify-between items-center">
            <span className="text-lg">{isSearching ? 'HASIL PENCARIAN' : (isSadesaMode ? 'UNIT SADESA' : `KAMAR ${activeKamar}`)}</span>
            <span className="text-xs bg-white border px-2 py-1 rounded font-normal text-slate-500">{filteredSantri.length} Santri</span>
          </div>
          <div className="divide-y">
            {filteredSantri.map((s: any) => {
              const isPaid = s.bulan_ini_lunas
              const isDraft = !!drafts[s.id]
              const isNoBill = s.bebas_spp || s.tagihan_ditiadakan_bulan_ini
              return (
                <div key={s.id} onClick={() => handleSelectSantri(s)}
                  className={`p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer group ${isDraft ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {s.foto_url ? (
                      <img
                        src={s.foto_url}
                        alt={s.nama_lengkap}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600 group-hover:bg-white group-hover:text-emerald-600 border flex-shrink-0">
                        {String(s.nama_lengkap || '?').split(' ').slice(0, 2).map((part: string) => part[0]).join('')}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 leading-snug line-clamp-2">{s.nama_lengkap}</p>
                      <div className="flex gap-2 text-xs text-slate-400 items-center">
                        <span>{isSadesaMode ? 'Unit SADESA' : `Kamar ${s.kamar || '-'}`}</span>
                        {s.jumlah_tunggakan > 0 && <span className="text-red-500 font-bold bg-red-50 px-1 rounded">-{s.jumlah_tunggakan} Bln</span>}
                        {isNoBill && <span className="text-blue-600 font-bold bg-blue-50 px-1 rounded">{s.bebas_spp ? 'Bebas SPP' : 'Tidak ada tagihan'}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isCurrentYear && !isPaid && !isNoBill ? (
                      <button onClick={(e) => toggleDraft(e, s)}
                        className={`w-32 h-10 px-3 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1 transition-all ${
                          isDraft ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 hover:border-emerald-500 hover:text-emerald-600'
                        }`}>
                        {isDraft ? <><CheckCircle className="w-3 h-3"/> Siap Bayar</> : <><PlusCircle className="w-3 h-3"/> Bayar {BULAN_LIST[currentMonthIdx - 1]}</>}
                      </button>
                    ) : isNoBill ? (
                      <span className="w-32 h-10 text-xs font-bold text-blue-700 inline-flex items-center justify-center gap-1 bg-blue-50 px-2 rounded-lg border border-blue-100">
                        <CalendarX className="w-3 h-3"/> Tidak Ada
                      </span>
                    ) : (
                      <span className="w-32 h-10 text-xs font-bold text-green-600 inline-flex items-center justify-center gap-1 bg-green-50 px-2 rounded-lg border border-green-100">
                        <CheckCircle className="w-3 h-3"/> Lunas
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FLOATING SAVE */}
      {totalDraft > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="space-y-2">
          <button onClick={handleSimpanBatch} disabled={isSavingBatch}
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95 disabled:opacity-70">
            <div className="text-left">
              <p className="text-xs text-slate-400">{totalDraft} Santri Dipilih</p>
              <p className="text-xl font-bold text-emerald-400">Total: Rp {totalNominalDraft.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
              {isSavingBatch ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
              {isSavingBatch ? 'Menyimpan...' : 'SIMPAN'}
            </div>
          </button>
          {scope?.canAdjustBilling && (
            <button onClick={openBatchWaiveModal}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-lg hover:bg-blue-50 inline-flex items-center justify-center gap-2">
              <CalendarX className="w-4 h-4"/> Set Tidak Ada Tagihan
            </button>
          )}
          </div>
        </div>
      )}
      {kelasWaiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tidak Ada Tagihan Massal</h3>
                <p className="mt-1 text-xs text-slate-500">Tiadakan tagihan SPP berdasarkan kelas sekolah dan bulan tertentu.</p>
              </div>
              <button onClick={() => setKelasWaiveModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Unit</label>
                  <select
                    value={kelasWaiveUnit}
                    onChange={e => setKelasWaiveUnit(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {scope?.kind === 'ADMIN' && <option value="SEMUA">Semua Unit</option>}
                    {(scope?.allowedUnits || []).map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Kelas Sekolah</label>
                  <select
                    value={kelasWaive}
                    onChange={e => setKelasWaive(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[7, 8, 9, 10, 11, 12].map(kelas => <option key={kelas} value={kelas}>Kelas {kelas}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Bulan</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {BULAN_LIST.map((bulanNama, idx) => {
                    const month = idx + 1
                    const selected = kelasWaiveMonths.includes(month)
                    const disabled = isBeforeBillingStart(tahun, month)
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => !disabled && toggleKelasWaiveMonth(month)}
                        disabled={disabled}
                        className={`h-10 rounded-lg border text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {bulanNama.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Alasan</label>
                <textarea
                  value={kelasWaiveReason}
                  onChange={e => setKelasWaiveReason(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Pulang libur kenaikan kelas / EHB hanya satu pekan."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Santri yang sudah bebas SPP permanen atau sudah membayar bulan tersebut tidak akan diproses.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
              <button onClick={() => setKelasWaiveModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
              <button
                onClick={handleSimpanKelasWaive}
                disabled={savingKelasWaive}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {savingKelasWaive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Massal
              </button>
            </div>
          </div>
        </div>
      )}
      {waiveModal}
    </div>
  )

  // ── VIEW: PAYMENT ───────────────────────────────────────────────────────
  if (view === 'PAYMENT') return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-in slide-in-from-right-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleBackToList} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600"/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Input Pembayaran</h1>
          <p className="text-sm text-slate-500">Membayar untuk: <span className="font-bold text-emerald-600">{selectedSantri.nama_lengkap}</span></p>
          {isSadesaMode && <p className="text-xs text-slate-400">Unit setor: SADESA</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {BULAN_LIST.map((namaBulan, idx) => {
          const bulanIndex = idx + 1
          const dataBayar = riwayatBayar.find(r => r.bulan === bulanIndex)
          const dataDitiadakan = tagihanDitiadakan.find(r => r.bulan === bulanIndex)
          const isSelected = selectedMonths.includes(bulanIndex)
          const belumAdaTagihan = isBeforeBillingStart(tahun, bulanIndex)
          const bebasPermanen = !!selectedSantri?.bebas_spp
          const noBill = bebasPermanen || !!dataDitiadakan
          let style = 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
          if (dataBayar) style = 'bg-green-100 border-green-500 text-green-800 cursor-default'
          else if (isSelected) style = 'bg-emerald-600 text-white border-emerald-600 shadow-sm transform scale-105'
          else if (belumAdaTagihan) style = 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
          else if (noBill) style = 'bg-blue-50 border-blue-200 text-blue-700 cursor-default'
          else if ((tahun < new Date().getFullYear()) || (tahun === new Date().getFullYear() && bulanIndex < currentMonthIdx)) {
            style = 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          }
          return (
            <div key={bulanIndex} onClick={() => toggleBulan(bulanIndex)}
              className={`p-4 rounded-xl border-2 flex flex-col justify-between h-32 transition-all cursor-pointer ${style}`}>
              <div className="flex justify-between items-start">
                <span className="font-bold text-lg">{namaBulan}</span>
                {dataBayar && (
                  <button
                    onClick={(e) => handleBatalkanPembayaran(e, dataBayar)}
                    disabled={cancelingPaymentId === dataBayar.id}
                    className="p-1 rounded-md bg-white/70 hover:bg-white text-rose-700 border border-rose-200 disabled:opacity-60"
                    title="Batalkan status lunas"
                  >
                    {cancelingPaymentId === dataBayar.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <RotateCcw className="w-4 h-4"/>}
                  </button>
                )}
                {!dataBayar && !belumAdaTagihan && dataDitiadakan && scope?.canAdjustBilling && (
                  <button
                    onClick={(e) => handleCabutWaive(e, bulanIndex)}
                    disabled={restoringWaiveKey === `${tahun}-${bulanIndex}`}
                    className="p-1 rounded-md bg-white/80 hover:bg-white text-blue-700 border border-blue-200 disabled:opacity-60"
                    title="Aktifkan tagihan kembali"
                  >
                    {restoringWaiveKey === `${tahun}-${bulanIndex}` ? <Loader2 className="w-4 h-4 animate-spin"/> : <RotateCcw className="w-4 h-4"/>}
                  </button>
                )}
                {!dataBayar && !belumAdaTagihan && !noBill && scope?.canAdjustBilling && (
                  <button
                    onClick={(e) => openSingleWaiveModal(e, bulanIndex)}
                    className="p-1 rounded-md bg-white/80 hover:bg-white text-blue-700 border border-blue-200"
                    title="Tiadakan tagihan bulan ini"
                  >
                    <Ban className="w-4 h-4"/>
                  </button>
                )}
                {!dataBayar && isSelected && <CheckCircle className="w-5 h-5 text-white/50"/>}
              </div>
              <div className="text-xs mt-2">
                {dataBayar ? (
                  <>
                    <p className="font-medium opacity-80">LUNAS</p>
                    <p className="font-bold">Rp {(dataBayar.nominal_bayar ?? nominal).toLocaleString('id-ID')}</p>
                    <p className="opacity-60">{format(new Date(dataBayar.tanggal_bayar), 'dd/MM/yy', { locale: id })}</p>
                  </>
                ) : belumAdaTagihan ? (
                  <>
                    <p className="font-medium opacity-80">BELUM ADA</p>
                    <p className="font-bold text-base">TAGIHAN</p>
                  </>
                ) : noBill ? (
                  <>
                    <p className="font-medium opacity-80">TIDAK ADA</p>
                    <p className="font-bold text-base">TAGIHAN</p>
                    <p className="opacity-70 line-clamp-1">{bebasPermanen ? 'Bebas SPP permanen' : dataDitiadakan?.alasan || 'Ditiadakan'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium opacity-80">Tagihan</p>
                    <p className="font-bold text-lg">Rp {nominal.toLocaleString('id-ID')}</p>
                    {style.includes('bg-red-50') && <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 inline-block">NUNGGAK</span>}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-orange-900">
              <WalletCards className="w-5 h-5"/> Tunggakan Terdahulu
            </h2>
            <p className="mt-1 text-xs text-orange-700">
              Khusus bulan sebelum awal tagihan sistem ({BULAN_LIST[billingStart.bulan - 1]} {billingStart.tahun}).
            </p>
          </div>
          <button onClick={openHistorisModal} className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white hover:bg-orange-800">
            <PlusCircle className="w-4 h-4"/> Tambah
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-orange-100 bg-white">
          {tunggakanHistoris.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">Belum ada tunggakan terdahulu yang dicatat.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tunggakanHistoris.map((item) => {
                const lunas = item.status === 'LUNAS'
                return (
                  <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{BULAN_LIST[item.bulan - 1]} {item.tahun}</p>
                      <p className="text-xs text-slate-500">
                        Rp {Number(item.nominal_tagihan || 0).toLocaleString('id-ID')}
                        {item.catatan ? ` · ${item.catatan}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${lunas ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {lunas ? `LUNAS ${item.tanggal_lunas || ''}` : 'BELUM LUNAS'}
                      </span>
                      {!lunas && (
                        <button onClick={() => handleBayarHistoris(item)} disabled={payingHistorisId === item.id}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                          {payingHistorisId === item.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle className="w-3 h-3"/>}
                          Lunaskan
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {totalHistorisBelumLunas > 0 && (
          <div className="mt-3 text-right text-sm font-bold text-orange-900">
            Sisa tunggakan terdahulu: Rp {totalHistorisBelumLunas.toLocaleString('id-ID')}
          </div>
        )}
      </div>

      {selectedMonths.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-4">
          <button onClick={handleBayar}
            className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-2xl flex items-center justify-between px-6 hover:bg-black transition-transform active:scale-95">
            <div className="text-left">
              <p className="text-xs text-slate-400">Total Bayar ({selectedMonths.length} Bulan)</p>
              <p className="text-xl font-bold text-green-400">Rp {(selectedMonths.length * nominal).toLocaleString('id-ID')}</p>
            </div>
            <div className="flex items-center gap-2 font-bold bg-white/10 px-4 py-2 rounded-lg">
              BAYAR SEKARANG <CreditCard className="w-5 h-5"/>
            </div>
          </button>
        </div>
      )}

      {historisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tambah Tunggakan Terdahulu</h3>
                <p className="mt-1 text-xs text-slate-500">Pilih bulan sebelum {BULAN_LIST[billingStart.bulan - 1]} {billingStart.tahun}.</p>
              </div>
              <button onClick={() => setHistorisModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Tahun</label>
                  <input type="number" value={historisTahun} onChange={e => setHistorisTahun(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Nominal per Bulan</label>
                  <input value={Number(historisNominal.replace(/\D/g, '') || 0).toLocaleString('id-ID')} onChange={e => setHistorisNominal(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">Bulan yang Masih Nunggak</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BULAN_LIST.map((bulanNama, idx) => {
                    const month = idx + 1
                    const disabled = !isHistorisMonthAllowed(historisTahun, month)
                    const selected = historisMonths.includes(month)
                    return (
                      <button key={month} type="button" onClick={() => !disabled && toggleHistorisMonth(month)} disabled={disabled}
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected ? 'border-orange-700 bg-orange-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                        }`}>
                        {bulanNama}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Catatan</label>
                <input value={historisCatatan} onChange={e => setHistorisCatatan(e.target.value)} placeholder="Opsional"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
              <button onClick={() => setHistorisModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={handleSimpanHistoris} disabled={savingHistoris} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {savingHistoris ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {waiveModal}
    </div>
  )
}
