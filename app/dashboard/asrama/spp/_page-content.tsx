'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getNominalSPP, getStatusSPP, bayarSPP, getDashboardSPPAll, getClientRestriction, batalkanPembayaranSPP, getSppBillingStart, getTunggakanHistorisSPP, simpanTunggakanHistorisSPP, bayarTunggakanHistorisSPP, getTagihanDitiadakanSPP, simpanTagihanDitiadakanSPP, simpanTagihanDitiadakanKelasSPP, cabutTagihanDitiadakanSPP, getRekapStatistikSPP, getStatusSetoranUnit, getFilterOptions, bayarSPPBulanBerjalan, bayarSemuaSantriAsrama, getSetoranInfoBulanIni, submitSetoranAsrama } from './actions'
import { Search, CreditCard, CheckCircle, Loader2, ArrowLeft, Home, Lock, ChevronLeft, ChevronRight, Filter, Save, PlusCircle, RotateCcw, X, Wallet, Ban, CalendarX, BarChart, AlertCircle, Users, Send, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const SADESA_UNIT = 'SADESA'

export default function SPPPage() {
  const confirm = useConfirm()
  const [view, setView] = useState<'LIST' | 'PAYMENT'>('LIST')
  const [nominal, setNominal] = useState(70000)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [unitSetor, setUnitSetor] = useState(ASRAMA_LIST[0])
  const [scope, setScope] = useState<{ kind: 'ASRAMA' | 'SADESA' | 'ADMIN'; lockedUnit: string | null; defaultUnit: string; allowedUnits: string[]; canAdjustBilling: boolean } | null>(null)
  const [billingStart, setBillingStart] = useState({ tahun: 2026, bulan: 6, value: '2026-06' })

  // Data State
  const [allSantri, setAllSantri] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [rekapStats, setRekapStats] = useState<any>(null)
  const [statusSetoran, setStatusSetoran] = useState<any>(null)
  const [filterOptions, setFilterOptions] = useState<any>({ kamars: [], sekolahs: [], kelasSekolahs: [], kelasPesantrens: [] })
  const [hasLoaded, setHasLoaded] = useState(false)

  // Pagination & Search
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'all'>(25)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter Modal
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<{ kamar: string[]; statusPembayaran: string; sekolah: string; kelasSekolah: string; kelasPesantren: string }>({ kamar: [], statusPembayaran: 'SEMUA', sekolah: '', kelasSekolah: '', kelasPesantren: '' })
  
  // Rekap Panel
  const [rekapExpanded, setRekapExpanded] = useState(false)
  const [rekapBebasList, setRekapBebasList] = useState(false)

  // Quick Pay
  const [payingSantriId, setPayingSantriId] = useState<string | null>(null)
  const [loadingBatchPay, setLoadingBatchPay] = useState(false)

  // Payment view
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([])
  const [tagihanDitiadakan, setTagihanDitiadakan] = useState<any[]>([])
  const [tunggakanHistoris, setTunggakanHistoris] = useState<any[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null)
  
  // Modals for payment view & batch waive
  const [historisModalOpen, setHistorisModalOpen] = useState(false)
  const [historisTahun, setHistorisTahun] = useState(new Date().getFullYear())
  const [historisMonths, setHistorisMonths] = useState<number[]>([])
  const [historisNominal, setHistorisNominal] = useState('70000')
  const [historisCatatan, setHistorisCatatan] = useState('')
  const [savingHistoris, setSavingHistoris] = useState(false)
  const [payingHistorisId, setPayingHistorisId] = useState<string | null>(null)
  const [waiveModalOpen, setWaiveModalOpen] = useState(false)
  const [waiveTargetMonth, setWaiveTargetMonth] = useState<number | null>(null)
  const [waiveMonths, setWaiveMonths] = useState<number[]>([])
  const [waiveReason, setWaiveReason] = useState('')
  const [savingWaive, setSavingWaive] = useState(false)
  const [restoringWaiveKey, setRestoringWaiveKey] = useState<string | null>(null)
  
  // Kelas Waive Modal
  const [kelasWaive, setKelasWaive] = useState('9')
  const [kelasWaiveUnit, setKelasWaiveUnit] = useState('SEMUA')
  const [kelasWaiveMonths, setKelasWaiveMonths] = useState<number[]>([])
  const [kelasWaiveReason, setKelasWaiveReason] = useState('')
  const [savingKelasWaive, setSavingKelasWaive] = useState(false)
  const [kelasWaiveModalOpen, setKelasWaiveModalOpen] = useState(false)

  // Setoran ke Pusat state
  const [setoranInfo, setSetoranInfo] = useState<{
    unit: string
    tahun: number
    bulan: number
    tanggalMulai: string | null
    setoran: any | null
  } | null>(null)
  const [setoranInfoLoading, setSetoranInfoLoading] = useState(false)
  const [setoranNama, setSetoranNama] = useState('')
  const [setoranBulanIni, setSetoranBulanIni] = useState('')
  const [setoranTunggakan, setSetoranTunggakan] = useState('')
  const [submittingSetoran, setSubmittingSetoran] = useState(false)

  const currentMonthIdx = new Date().getMonth() + 1
  const isCurrentYear = new Date().getFullYear() === tahun
  // Bulan yang ditampilkan di list (default bulan berjalan, bisa lihat bulan sebelumnya)
  const [viewMonth, setViewMonth] = useState(currentMonthIdx)
  const maxViewMonth = isCurrentYear ? currentMonthIdx : 12
  const isSadesaMode = unitSetor === SADESA_UNIT
  const isBeforeBillingStart = (year: number, month: number) => (year * 100 + month) < (billingStart.tahun * 100 + billingStart.bulan)

  // Init
  useEffect(() => {
    getNominalSPP(tahun).then(setNominal)
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
  }, [tahun])

  // Load setoran info for current month (independent of main data load)
  useEffect(() => {
    setSetoranInfoLoading(true)
    getSetoranInfoBulanIni()
      .then(setSetoranInfo)
      .catch(() => {})
      .finally(() => setSetoranInfoLoading(false))
  }, [])

  // Load Data
  const loadData = async () => {
    if (!scope || !unitSetor) return
    if (!scope.allowedUnits.includes(unitSetor)) return

    setLoadingData(true)
    try {
      const [santriData, rekapData, setoranData, filtersData] = await Promise.all([
        getDashboardSPPAll(tahun, unitSetor, viewMonth),
        getRekapStatistikSPP(tahun, unitSetor),
        getStatusSetoranUnit(tahun, unitSetor),
        getFilterOptions(unitSetor)
      ])
      setAllSantri(santriData)
      setRekapStats(rekapData)
      setStatusSetoran(setoranData)
      setFilterOptions(filtersData)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat data SPP.')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (hasLoaded) {
      loadData()
    }
    setPage(1)
  }, [scope, unitSetor, tahun, viewMonth])

  // Clamp bulan terpilih jika ganti tahun (mis. tahun berjalan tak boleh > bulan ini)
  useEffect(() => {
    setViewMonth(m => Math.min(m, isCurrentYear ? currentMonthIdx : 12))
  }, [tahun])

  // Filter Logic
  const filteredSantri = useMemo(() => {
    let result = allSantri

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => s.nama_lengkap?.toLowerCase().includes(q))
    }
    if (filters.kamar.length) result = result.filter(s => filters.kamar.includes(s.kamar))
    if (filters.sekolah) result = result.filter(s => s.sekolah === filters.sekolah)
    if (filters.kelasSekolah) result = result.filter(s => s.kelas_sekolah === filters.kelasSekolah)
    if (filters.kelasPesantren) result = result.filter(s => s.kelas_pesantren === filters.kelasPesantren)

    switch (filters.statusPembayaran) {
      case 'LUNAS':
        result = result.filter(s => s.bulan_ini_lunas)
        break
      case 'NUNGGAK':
        result = result.filter(s => s.jumlah_tunggakan > 0)
        break
      case 'AMAN':
        result = result.filter(s => s.jumlah_tunggakan === 0 && !s.bebas_spp)
        break
      case 'BEBAS_SPP':
        result = result.filter(s => s.bebas_spp)
        break
      case 'TIDAK_ADA_TAGIHAN':
        result = result.filter(s => s.tagihan_ditiadakan_bulan_ini)
        break
    }

    return result
  }, [allSantri, searchQuery, filters])

  const paginatedSantri = useMemo(() => {
    if (pageSize === 'all') return filteredSantri
    const start = (page - 1) * pageSize
    return filteredSantri.slice(start, start + pageSize)
  }, [filteredSantri, page, pageSize])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.kamar.length) count++
    if (filters.sekolah) count++
    if (filters.kelasSekolah) count++
    if (filters.kelasPesantren) count++
    if (filters.statusPembayaran !== 'SEMUA') count++
    return count
  }, [filters])

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredSantri.length / pageSize)

  // Quick Pay
  const handleQuickPay = async (e: React.MouseEvent, santri: any) => {
    e.stopPropagation()
    if (!isCurrentYear) return
    const isNoBill = santri.bebas_spp || santri.tagihan_ditiadakan_bulan_ini
    if (santri.bulan_ini_lunas || isNoBill) return

    if (!await confirm(`Bayar SPP ${BULAN_LIST[viewMonth - 1]} ${tahun} untuk ${santri.nama_lengkap}? Nominal: Rp ${nominal.toLocaleString('id-ID')}`)) return

    setPayingSantriId(santri.id)
    const toastId = toast.loading('Memproses...')
    const res = await bayarSPPBulanBerjalan(santri.id, tahun, viewMonth, nominal)
    toast.dismiss(toastId)
    setPayingSantriId(null)
    
    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success('Pembayaran Berhasil!')
      await loadData()
      if (view === 'PAYMENT' && selectedSantri?.id === santri.id) {
        await refreshSelectedStatus()
      }
    }
  }

  // Back button handling
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

  // Payment view functions
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
      await loadData()
      await refreshSelectedStatus()
    }
  }

  const toggleBulan = (idx: number) => {
    if (isBeforeBillingStart(tahun, idx)) return
    if (riwayatBayar.some(r => r.bulan === idx)) return
    if (selectedSantri?.bebas_spp) return
    if (tagihanDitiadakan.some(r => r.bulan === idx)) return
    setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx])
  }

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
    await loadData()
    await refreshSelectedStatus()
  }

  const handleBayarSemuaSantri = async () => {
    const belumLunas = allSantri.filter(s => !s.bebas_spp && !s.tagihan_ditiadakan_bulan_ini && !s.bulan_ini_lunas)
    if (belumLunas.length === 0) return
    if (!await confirm(`Tandai ${belumLunas.length} santri ${unitSetor} SUDAH BAYAR SPP ${BULAN_LIST[viewMonth - 1]} ${tahun}?\n\nNominal per santri: Rp ${nominal.toLocaleString('id-ID')}`)) return
    setLoadingBatchPay(true)
    const toastId = toast.loading('Memproses pembayaran massal...')
    const res = await bayarSemuaSantriAsrama(unitSetor, tahun, viewMonth, nominal)
    toast.dismiss(toastId)
    setLoadingBatchPay(false)
    if ('error' in res) { toast.error(res.error) } else {
      toast.success(`${res.count} santri berhasil ditandai lunas`)
      await loadData()
    }
  }

  // Historis modals
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
    await loadData()
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
    await loadData()
  }

  // Waive modals
  const openSingleWaiveModal = (e: React.MouseEvent, month: number) => {
    e.stopPropagation()
    setWaiveTargetMonth(month)
    setWaiveMonths([month])
    setWaiveReason('')
    setWaiveModalOpen(true)
  }

  const toggleWaiveMonth = (month: number) => {
    if (isBeforeBillingStart(tahun, month)) return
    setWaiveMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b))
  }

  const handleSimpanWaive = async () => {
    if (!selectedSantri) return
    if (!waiveMonths.length) return toast.warning('Pilih minimal satu bulan.')
    if (!waiveReason.trim()) return toast.warning('Alasan wajib diisi.')

    setSavingWaive(true)
    const res = await simpanTagihanDitiadakanSPP([selectedSantri.id], tahun, waiveMonths, waiveReason)
    setSavingWaive(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`Tidak ada tagihan tersimpan untuk bulan tersebut`)
    setWaiveModalOpen(false)
    await loadData()
    await refreshSelectedStatus()
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
    await loadData()
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
    await loadData()
  }

  const handleBackToList = () => { window.history.back() }

  const refreshSetoranInfo = () => {
    getSetoranInfoBulanIni().then(setSetoranInfo).catch(() => {})
  }

  const handleSubmitSetoran = async (e: React.FormEvent) => {
    e.preventDefault()
    const jumlahBulanIni = Number(setoranBulanIni.replace(/\D/g, '') || '0')
    const jumlahTunggakan = Number(setoranTunggakan.replace(/\D/g, '') || '0')
    if (jumlahBulanIni + jumlahTunggakan <= 0) {
      toast.error('Isi minimal satu jumlah setoran.')
      return
    }
    setSubmittingSetoran(true)
    const res = await submitSetoranAsrama(jumlahBulanIni, jumlahTunggakan, setoranNama)
    setSubmittingSetoran(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Setoran berhasil dikirim ke Dewan Santri!')
    setSetoranNama('')
    setSetoranBulanIni('')
    setSetoranTunggakan('')
    refreshSetoranInfo()
  }

  const tunggakanHistorisBelumLunas = tunggakanHistoris.filter(item => item.status !== 'LUNAS')
  const totalHistorisBelumLunas = tunggakanHistorisBelumLunas.reduce((sum, item) => sum + Number(item.nominal_tagihan || 0), 0)

  // ── VIEW: LIST ──────────────────────────────────────────────────────────
  if (view === 'LIST') return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-32">

      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Pembayaran SPP"
          description={isSadesaMode ? 'Monitoring pembayaran seluruh santri kategori SADESA.' : 'Monitoring pembayaran santri per unit/asrama.'}
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">-</button>
            <span className="px-2 font-mono font-bold text-slate-700">{tahun}</span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-slate-100 rounded text-sm font-bold">+</button>
          </div>
          <div className="p-2 rounded-lg border shadow-sm flex items-center gap-2 bg-white">
            <CalendarX className="w-4 h-4 text-slate-400" />
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {BULAN_LIST.map((namaBulan, idx) => {
                const month = idx + 1
                const disabled = isBeforeBillingStart(tahun, month) || month > maxViewMonth
                return <option key={month} value={month} disabled={disabled}>{namaBulan}</option>
              })}
            </select>
          </div>
          <div className={`p-2 rounded-lg border shadow-sm flex items-center gap-2 ${scope?.lockedUnit ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
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
          <button
            onClick={() => {
              setHasLoaded(true)
              loadData()
            }}
            disabled={loadingData}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-black transition-colors shadow-sm disabled:opacity-50 h-9"
          >
            {loadingData ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Search className="w-3.5 h-3.5"/>}
            Tampilkan
          </button>
          {hasLoaded && isCurrentYear && (() => {
            const belumLunas = allSantri.filter(s => !s.bebas_spp && !s.tagihan_ditiadakan_bulan_ini && !s.bulan_ini_lunas)
            if (belumLunas.length === 0) return null
            return (
              <button
                onClick={handleBayarSemuaSantri}
                disabled={loadingBatchPay || loadingData}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 h-9"
              >
                {loadingBatchPay ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Users className="w-3.5 h-3.5"/>}
                Tandai Semua Lunas ({belumLunas.length})
              </button>
            )
          })()}
        </div>
      </div>

      {/* SETORAN KE PUSAT */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10)
        const windowOpen = setoranInfo?.tanggalMulai && today >= setoranInfo.tanggalMulai
        const sudahDikirim = !!setoranInfo?.setoran?.tanggal_setor
        const sudahDikonfirmasi = !!setoranInfo?.setoran?.tanggal_terima
        const fmtTgl = (s: string) => { try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return s } }
        const fmtRpLocal = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`

        return (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <Wallet className="w-4 h-4 text-indigo-600 shrink-0"/>
              <h3 className="font-bold text-slate-800 text-sm">Setoran SPP ke Pusat</h3>
              <span className="text-xs text-slate-400">— {BULAN_LIST[currentMonthIdx - 1]} {new Date().getFullYear()}</span>
            </div>

            {setoranInfoLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400"/></div>
            ) : sudahDikonfirmasi ? (
              <div className="p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0"/>
                <div className="text-sm">
                  <p className="font-bold text-green-700">Sudah Dikonfirmasi Dewan Santri</p>
                  <p className="text-slate-500 mt-0.5">Diterima {fmtTgl(setoranInfo!.setoran.tanggal_terima)} · Total {fmtRpLocal(setoranInfo!.setoran.jumlah_aktual)}</p>
                </div>
              </div>
            ) : sudahDikirim ? (
              <div className="p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0"/>
                <div className="text-sm flex-1">
                  <p className="font-bold text-blue-700">Sudah Dikirim — Menunggu Konfirmasi</p>
                  <p className="text-slate-500 mt-0.5">
                    Dikirim {fmtTgl(setoranInfo!.setoran.tanggal_setor)} · Penyetor: <strong>{setoranInfo!.setoran.nama_penyetor}</strong>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                    {(setoranInfo!.setoran.jumlah_bulan_ini ?? 0) > 0 && <span>Bulan ini: <strong>{fmtRpLocal(setoranInfo!.setoran.jumlah_bulan_ini)}</strong></span>}
                    {(setoranInfo!.setoran.jumlah_tunggakan_bayar ?? 0) > 0 && <span>Tunggakan: <strong>{fmtRpLocal(setoranInfo!.setoran.jumlah_tunggakan_bayar)}</strong></span>}
                    <span className="font-bold text-slate-800">Total: {fmtRpLocal(setoranInfo!.setoran.jumlah_aktual)}</span>
                  </div>
                </div>
              </div>
            ) : !setoranInfo?.tanggalMulai ? (
              <div className="p-4 flex items-center gap-3 text-amber-700 bg-amber-50/60">
                <AlertCircle className="w-4 h-4 shrink-0"/>
                <p className="text-sm font-medium">Dewan Santri belum membuka periode setoran bulan ini.</p>
              </div>
            ) : !windowOpen ? (
              <div className="p-4 flex items-center gap-3 text-blue-700 bg-blue-50/60">
                <Clock className="w-4 h-4 shrink-0"/>
                <p className="text-sm font-medium">Setoran dibuka mulai <strong>{fmtTgl(setoranInfo!.tanggalMulai)}</strong>.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitSetoran} className="p-4 space-y-3">
                <p className="text-xs text-slate-500">Periode setoran sudah dibuka. Isi data setoran di bawah.</p>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Nama Penyetor</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama pengurus yang menyetor..."
                    value={setoranNama}
                    onChange={e => setSetoranNama(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">SPP Bulan Ini</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={setoranBulanIni ? Number(setoranBulanIni.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                        onChange={e => setSetoranBulanIni(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Tunggakan</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={setoranTunggakan ? Number(setoranTunggakan.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                        onChange={e => setSetoranTunggakan(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-bold text-slate-700">
                    Total: {`Rp ${(Number(setoranBulanIni.replace(/\D/g,'') || 0) + Number(setoranTunggakan.replace(/\D/g,'') || 0)).toLocaleString('id-ID')}`}
                  </p>
                  <button
                    type="submit"
                    disabled={submittingSetoran}
                    className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submittingSetoran ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                    Kirim Setoran
                  </button>
                </div>
              </form>
            )}
          </div>
        )
      })()}

      {/* REKAP & STATISTIK / MAIN LIST / PLACEHOLDER */}
      {!hasLoaded ? (
        <div className="bg-white border rounded-xl p-12 text-center text-slate-400 py-32 shadow-sm">
          <Search className="w-12 h-12 mx-auto mb-4 text-slate-300 stroke-[1.5]" />
          <h3 className="text-base font-bold text-slate-700">Data SPP Santri</h3>
          <p className="text-sm mt-2 max-w-md mx-auto text-slate-500">Silakan pilih unit/asrama dan tahun di atas, lalu klik tombol <strong>Tampilkan</strong> untuk memuat data pembayaran SPP santri.</p>
          <button
            onClick={() => {
              setHasLoaded(true)
              loadData()
            }}
            disabled={loadingData}
            className="mt-6 inline-flex items-center gap-2 bg-slate-900 hover:bg-black text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tampilkan Data
          </button>
        </div>
      ) : (
        <>
          {/* REKAP & STATISTIK */}
          {!loadingData && rekapStats && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all">
              <div 
                onClick={() => setRekapExpanded(!rekapExpanded)}
                className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <BarChart className="w-5 h-5 text-indigo-600"/>
              Rekap & Statistik SPP {unitSetor}
            </div>
            {rekapExpanded ? <ChevronLeft className="w-5 h-5 -rotate-90 text-slate-400" /> : <ChevronRight className="w-5 h-5 rotate-90 text-slate-400" />}
          </div>
          
          <div className={`grid gap-4 p-4 ${rekapExpanded ? 'block' : 'hidden'}`}>
            {/* Row 1: Santri Counts */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{rekapStats.totalSantri}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">Total Santri</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-100" onClick={() => setRekapBebasList(!rekapBebasList)}>
                <p className="text-2xl font-bold text-blue-800">{rekapStats.bebasSppCount}</p>
                <p className="text-xs text-blue-600 uppercase tracking-wide mt-1">Bebas SPP</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{rekapStats.wajibSpp}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">Wajib SPP</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-800">{rekapStats.wajibBulanIni}</p>
                <p className="text-xs text-orange-600 uppercase tracking-wide mt-1">Wajib Bulan Ini</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-800">{rekapStats.nunggakBulanIni}</p>
                <p className="text-xs text-red-600 uppercase tracking-wide mt-1">Nunggak Bulan Ini</p>
              </div>
            </div>

            {/* Bebas SPP List Expanded */}
            {rekapBebasList && rekapStats.bebasSppList?.length > 0 && (
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm">
                <span className="font-bold text-blue-800 mb-2 block">Daftar Santri Bebas SPP:</span>
                <div className="flex flex-wrap gap-2">
                  {rekapStats.bebasSppList.map((name: string) => (
                    <span key={name} className="px-2 py-1 bg-white border border-blue-200 rounded-md text-blue-700 text-xs shadow-sm">{name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Row 2: Financials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4"/> Uang Diterima Bulan {BULAN_LIST[currentMonthIdx - 1]} {new Date().getFullYear()}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center bg-white/60 p-2 rounded border border-emerald-100">
                    <span className="text-emerald-700">Total Keseluruhan</span>
                    <span className="font-bold text-emerald-900 text-lg">Rp {rekapStats.uangDiterimaTotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-emerald-600 text-xs">├─ Untuk tagihan bulan berjalan</span>
                    <span className="font-bold text-emerald-800">Rp {rekapStats.uangHarusSetor.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1">
                    <span className="text-emerald-600 text-xs">└─ Untuk tunggakan lama</span>
                    <span className="font-bold text-emerald-800">Rp {rekapStats.uangTunggakanLama.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Home className="w-4 h-4"/> Status Setoran ke Pusat
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">Setoran untuk bulan {BULAN_LIST[currentMonthIdx - 1]} {tahun}</p>
                </div>
                
                {statusSetoran?.[currentMonthIdx] ? (
                  <div className="bg-white border border-green-200 p-3 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                      <CheckCircle className="w-4 h-4"/> Sudah Disetor
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 mt-2">
                      <p>Diterima: <span className="font-bold">{new Date(statusSetoran[currentMonthIdx].tanggal).toLocaleDateString('id-ID')}</span></p>
                      <p>Oleh: <span className="font-bold">{statusSetoran[currentMonthIdx].penerima}</span></p>
                      <p>Total: <span className="font-bold text-green-700 text-sm">Rp {statusSetoran[currentMonthIdx].jumlahAktual.toLocaleString('id-ID')}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-red-200 p-3 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
                      <AlertCircle className="w-4 h-4"/> Belum Disetor
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Uang tagihan bulan berjalan (Rp {rekapStats.uangHarusSetor.toLocaleString('id-ID')}) belum disetorkan ke Dewan Santri.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH & FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5"/>
          <input
            type="text"
            placeholder="Ketik nama santri untuk mencari..."
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        
        <button
          onClick={() => setFilterModalOpen(true)}
          className={`px-4 py-3 rounded-xl border flex items-center gap-2 font-bold transition-colors shadow-sm ${
            activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter {activeFilterCount > 0 && <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{activeFilterCount}</span>}
        </button>

        {scope?.canAdjustBilling && (
          <button
            type="button"
            onClick={() => setKelasWaiveModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
          >
            <CalendarX className="h-4 w-4" />
            Tidak Ada Tagihan Massal
          </button>
        )}
      </div>

      {/* SANTRI LIST / COMPACT TABLE */}
      {loadingData ? (
        <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500"/></div>
      ) : filteredSantri.length === 0 ? (
        <div className="text-center py-20 bg-white text-slate-400 border border-slate-200 shadow-sm rounded-xl">
          <Search className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
          <p className="text-lg font-bold text-slate-500">Tidak ada santri ditemukan</p>
          <p className="text-sm">Coba sesuaikan pencarian atau filter Anda.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 bg-slate-50 px-4 py-3 border-b font-bold text-slate-500 text-xs uppercase tracking-wider items-center">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-4">Nama Santri</div>
            <div className="col-span-2 text-center">Kamar / Kelas</div>
            <div className="col-span-2 text-center">Status {BULAN_LIST[viewMonth - 1]}</div>
            <div className="col-span-1 text-center">Tunggakan</div>
            <div className="col-span-2 text-right">Aksi</div>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {paginatedSantri.map((s: any, idx) => {
              const rowNum = pageSize === 'all' ? idx + 1 : (page - 1) * pageSize + idx + 1
              const isPaid = s.bulan_ini_lunas
              const isNoBill = s.bebas_spp || s.tagihan_ditiadakan_bulan_ini
              const canQuickPay = isCurrentYear && !isPaid && !isNoBill

              return (
                <div key={s.id} onClick={() => handleSelectSantri(s)}
                  className="group flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 md:py-2 items-start md:items-center hover:bg-slate-50 cursor-pointer transition-colors relative">
                  
                  {/* Mobile Row No. & Avatar */}
                  <div className="hidden md:block col-span-1 text-center text-xs font-bold text-slate-400">{rowNum}</div>
                  
                  {/* Avatar & Name */}
                  <div className="w-full md:col-span-4 flex items-center gap-3">
                    {s.foto_url ? (
                      <img src={s.foto_url} alt={s.nama_lengkap} className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 border flex-shrink-0">
                        {String(s.nama_lengkap || '?').split(' ').slice(0, 2).map((p: string) => p[0]).join('')}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 leading-snug truncate">{s.nama_lengkap}</p>
                      {/* Mobile extra info */}
                      <div className="md:hidden flex gap-2 text-xs mt-1 items-center">
                        <span className="text-slate-500 bg-slate-100 px-1.5 rounded">{isSadesaMode ? 'SADESA' : `Kamar ${s.kamar || '-'}`}</span>
                        <span className="text-slate-500">{s.kelas_sekolah || '-'} · {s.kelas_pesantren || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Kamar & Kelas */}
                  <div className="hidden md:flex col-span-2 flex-col items-center justify-center text-xs text-slate-500 text-center">
                    <span className="font-bold text-slate-700">{isSadesaMode ? 'SADESA' : `Kamar ${s.kamar || '-'}`}</span>
                    <span className="opacity-70">{s.kelas_sekolah || '-'} · {s.kelas_pesantren || '-'}</span>
                  </div>

                  {/* Status Bulan Ini */}
                  <div className="md:col-span-2 w-full md:w-auto flex md:justify-center items-center mt-2 md:mt-0">
                    <span className="md:hidden text-xs text-slate-400 w-24">Bulan ini:</span>
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-100"><CheckCircle className="w-3 h-3"/> Lunas</span>
                    ) : isNoBill ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-100"><CalendarX className="w-3 h-3"/> {s.bebas_spp ? 'Bebas SPP' : 'Tidak Ada'}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">Belum Bayar</span>
                    )}
                  </div>

                  {/* Tunggakan */}
                  <div className="md:col-span-1 w-full md:w-auto flex md:justify-center items-center mt-1 md:mt-0">
                    <span className="md:hidden text-xs text-slate-400 w-24">Tunggakan:</span>
                    {s.jumlah_tunggakan > 0 ? (
                      <span className="inline-flex items-center bg-red-50 text-red-600 px-2 py-1 rounded-md text-xs font-bold border border-red-100">{s.jumlah_tunggakan} Bulan</span>
                    ) : s.bebas_spp ? (
                      <span className="text-slate-400 font-bold text-xs">-</span>
                    ) : (
                      <span className="inline-flex items-center bg-green-50 text-green-600 px-2 py-1 rounded-md text-xs font-bold border border-green-100">0</span>
                    )}
                  </div>

                  {/* Aksi / Quick Pay */}
                  <div className="md:col-span-2 w-full md:w-auto flex justify-end md:justify-end mt-3 md:mt-0 border-t md:border-0 pt-2 md:pt-0 border-slate-100">
                    {canQuickPay && (
                      <button 
                        onClick={(e) => handleQuickPay(e, s)}
                        disabled={payingSantriId === s.id}
                        className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-70"
                      >
                        {payingSantriId === s.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CreditCard className="w-3 h-3"/>}
                        Bayar {BULAN_LIST[viewMonth - 1]}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Footer */}
          {filteredSantri.length > 0 && (
            <div className="bg-slate-50 border-t px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>Tampilkan:</span>
                <select 
                  value={pageSize} 
                  onChange={e => { setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}
                  className="bg-white border rounded px-2 py-1 outline-none focus:border-indigo-400"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">Semua</option>
                </select>
                <span>dari {filteredSantri.length} santri</span>
              </div>
              
              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"><ChevronLeft className="w-5 h-5"/></button>
                  <div className="flex items-center">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Simple logic to show window of 5 pages
                      let p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                      if (p < 1) p = 1
                      if (p > totalPages) p = totalPages
                      return (
                        <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-md text-sm font-bold mx-0.5 ${page === p ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-700'}`}>
                          {p}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"><ChevronRight className="w-5 h-5"/></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* FILTER MODAL */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Filter className="w-5 h-5 text-indigo-600"/> Filter Santri</h3>
              <button onClick={() => setFilterModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Status Pembayaran</label>
                <select 
                  value={filters.statusPembayaran} 
                  onChange={e => setFilters(f => ({ ...f, statusPembayaran: e.target.value }))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="LUNAS">Lunas Bulan {BULAN_LIST[viewMonth - 1]}</option>
                  <option value="NUNGGAK">Menunggak</option>
                  <option value="AMAN">Aman (Tidak Menunggak)</option>
                  <option value="BEBAS_SPP">Bebas SPP</option>
                  <option value="TIDAK_ADA_TAGIHAN">Tidak Ada Tagihan (Waived)</option>
                </select>
              </div>

              {!isSadesaMode && filterOptions.kamars?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-500">Kamar {filters.kamar.length > 0 && <span className="text-indigo-600">({filters.kamar.length} dipilih)</span>}</label>
                    {filters.kamar.length > 0 && (
                      <button type="button" onClick={() => setFilters(f => ({ ...f, kamar: [] }))} className="text-[11px] font-bold text-rose-600 hover:underline">Hapus</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {filterOptions.kamars.map((k: string) => {
                      const selected = filters.kamar.includes(k)
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setFilters(f => ({ ...f, kamar: selected ? f.kamar.filter(x => x !== k) : [...f.kamar, k] }))}
                          className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                            selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                          }`}
                        >
                          {selected && <CheckCircle className="w-3 h-3" />}
                          Kamar {k}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {filterOptions.sekolahs?.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Sekolah</label>
                  <select value={filters.sekolah} onChange={e => setFilters(f => ({ ...f, sekolah: e.target.value }))} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    <option value="">Semua Sekolah</option>
                    {filterOptions.sekolahs.map((k: string) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {filterOptions.kelasSekolahs?.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Kelas Sekolah</label>
                    <select value={filters.kelasSekolah} onChange={e => setFilters(f => ({ ...f, kelasSekolah: e.target.value }))} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                      <option value="">Semua</option>
                      {filterOptions.kelasSekolahs.map((k: string) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                )}
                {filterOptions.kelasPesantrens?.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Kelas Pesantren</label>
                    <select value={filters.kelasPesantren} onChange={e => setFilters(f => ({ ...f, kelasPesantren: e.target.value }))} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                      <option value="">Semua</option>
                      {filterOptions.kelasPesantrens.map((k: string) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button 
                onClick={() => { setFilters({ kamar: [], statusPembayaran: 'SEMUA', sekolah: '', kelasSekolah: '', kelasPesantren: '' }); setPage(1); }}
                className="px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Reset Filter
              </button>
              <button 
                onClick={() => { setFilterModalOpen(false); setPage(1); }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-all"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KELAS WAIVE MODAL */}
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
              <Wallet className="w-5 h-5"/> Tunggakan Terdahulu
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

      {/* HISTORIS MODAL */}
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

      {/* SINGLE WAIVE MODAL */}
      {waiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Set Tidak Ada Tagihan</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedSantri?.nama_lengkap || 'Santri'} - {waiveTargetMonth ? BULAN_LIST[waiveTargetMonth - 1] : ''} {tahun}
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
                    const disabled = month !== waiveTargetMonth
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
      )}
    </div>
  )
}
