'use client'

import React, { useState, useEffect } from 'react'
import { Button, ActionIcon, TextInput, NativeSelect, Modal, Alert, SegmentedControl, Pagination as MantinePagination, Group } from '@mantine/core'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction, getSppBillingStart, simpanSppBillingStart, getMonitoringPrintMeta, getDaftarPenunggak, getDaftarBebasSpp, getPenunggakExportData, getSppSetoranWindow, simpanSppSetoranWindow } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, UserCheck, Eye, Check, Search, Save, FileText, Download, CalendarDays
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import dynamic from 'next/dynamic'

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  unit_setor: string
  total_santri: number
  bebas_spp: number
  tidak_ada_tagihan: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  penunggak: number
  total_nominal: number
  nominal_bulan_ini: number
  nominal_tunggakan_lalu: number
  nominal_tunggakan_berjalan?: number
  nominal_tunggakan_historis?: number
  persentase: number
  tanggal_setor: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
  belum_ada_tagihan?: boolean
  is_sadesa?: boolean
}

type CacheEntry = {
  tahun: number
  bulan: number
  data: AsramaRow[]
  nominal: number
}
let _setoranCache: CacheEntry | null = null
const MonitoringPrintControls = dynamic(() => import('./_print-controls'), { ssr: false })

export default function MonitoringSetoranPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [nominal, setNominal] = useState(70000)
  const [data, setData] = useState<AsramaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [userAsrama, setUserAsrama] = useState<string | null>(null)
  const [billingStart, setBillingStart] = useState({ tahun: 2026, bulan: 6, value: '2026-06' })
  const [billingStartInput, setBillingStartInput] = useState('2026-06')
  const [savingBillingStart, setSavingBillingStart] = useState(false)
  const [tahunAjaranNama, setTahunAjaranNama] = useState<string | null>(null)
  const [setoranWindow, setSetoranWindow] = useState<string | null>(null)
  const [setoranWindowInput, setSetoranWindowInput] = useState('')
  const [savingSetoranWindow, setSavingSetoranWindow] = useState(false)
  const [isSetoranWindowModalOpen, setIsSetoranWindowModalOpen] = useState(false)
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  // TABS & PENUNGGAK STATE
  const [activeTab, setActiveTab] = useState<'setoran' | 'penunggak' | 'bebas'>('setoran')
  const [penunggakList, setPenunggakList] = useState<any[]>([])
  const [selectedAsramaPenunggak, setSelectedAsramaPenunggak] = useState<string>('')
  const [loadingPenunggak, setLoadingPenunggak] = useState(false)
  const [searchPenunggak, setSearchPenunggak] = useState('')
  const [pagePenunggak, setPagePenunggak] = useState(1)
  const [pageSizePenunggak, setPageSizePenunggak] = useState<number | 'all'>(25)

  // BEBAS SPP STATE
  const [bebasList, setBebasList] = useState<any[]>([])
  const [selectedAsramaBebas, setSelectedAsramaBebas] = useState<string>('')
  const [loadingBebas, setLoadingBebas] = useState(false)
  const [searchBebas, setSearchBebas] = useState('')
  const [pageBebas, setPageBebas] = useState(1)
  const [pageSizeBebas, setPageSizeBebas] = useState<number | 'all'>(25)

  // EXPORT EXCEL STATE
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportAsrama, setExportAsrama] = useState<string>('SEMUA')
  const [exportPeriode, setExportPeriode] = useState<'BULAN_INI' | 'SEMUA_BULAN'>('SEMUA_BULAN')
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    if (activeTab === 'penunggak' && selectedAsramaPenunggak) {
      setLoadingPenunggak(true)
      getDaftarPenunggak(tahun, bulan, selectedAsramaPenunggak).then(res => {
        setPenunggakList(res)
        setPagePenunggak(1) // Reset page to 1
        setLoadingPenunggak(false)
      }).catch(err => {
        toast.error(err?.message || "Gagal memuat daftar penunggak")
        setLoadingPenunggak(false)
      })
    } else {
      setPenunggakList([])
    }
  }, [activeTab, selectedAsramaPenunggak, tahun, bulan])

  const filteredPenunggak = React.useMemo(() => {
    if (!searchPenunggak.trim()) return penunggakList
    const queryStr = searchPenunggak.toLowerCase()
    return penunggakList.filter(p => p.nama_lengkap.toLowerCase().includes(queryStr))
  }, [penunggakList, searchPenunggak])

  const paginatedPenunggak = React.useMemo(() => {
    if (pageSizePenunggak === 'all') return filteredPenunggak
    const start = (pagePenunggak - 1) * pageSizePenunggak
    return filteredPenunggak.slice(start, start + pageSizePenunggak)
  }, [filteredPenunggak, pagePenunggak, pageSizePenunggak])

  const totalPagesPenunggak = pageSizePenunggak === 'all' ? 1 : Math.ceil(filteredPenunggak.length / pageSizePenunggak)

  useEffect(() => {
    if (activeTab === 'bebas' && selectedAsramaBebas) {
      setLoadingBebas(true)
      getDaftarBebasSpp(selectedAsramaBebas).then(res => {
        setBebasList(res)
        setPageBebas(1)
        setLoadingBebas(false)
      }).catch(err => {
        toast.error(err?.message || "Gagal memuat daftar bebas SPP")
        setLoadingBebas(false)
      })
    } else {
      setBebasList([])
    }
  }, [activeTab, selectedAsramaBebas])

  const filteredBebas = React.useMemo(() => {
    if (!searchBebas.trim()) return bebasList
    const queryStr = searchBebas.toLowerCase()
    return bebasList.filter(p => p.nama_lengkap.toLowerCase().includes(queryStr))
  }, [bebasList, searchBebas])

  const paginatedBebas = React.useMemo(() => {
    if (pageSizeBebas === 'all') return filteredBebas
    const start = (pageBebas - 1) * pageSizeBebas
    return filteredBebas.slice(start, start + pageSizeBebas)
  }, [filteredBebas, pageBebas, pageSizeBebas])

  const totalPagesBebas = pageSizeBebas === 'all' ? 1 : Math.ceil(filteredBebas.length / pageSizeBebas)

  function formatUnpaidMonths(unpaidMonths: { tahun: number; bulan: number }[]): string {
    if (!unpaidMonths || unpaidMonths.length === 0) return '-'
    
    // Sort chronologically
    const sorted = [...unpaidMonths].sort((a, b) => (a.tahun * 100 + a.bulan) - (b.tahun * 100 + b.bulan))
    
    const groups: { tahun: number; bulan: number }[][] = []
    let currentGroup: { tahun: number; bulan: number }[] = []
    
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i]
      if (currentGroup.length === 0) {
        currentGroup.push(item)
      } else {
        const last = currentGroup[currentGroup.length - 1]
        const diff = (item.tahun * 12 + item.bulan) - (last.tahun * 12 + last.bulan)
        if (diff === 1) {
          currentGroup.push(item)
        } else {
          groups.push(currentGroup)
          currentGroup = [item]
        }
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }
    
    // Format each group
    const formattedGroups = groups.map(group => {
      if (group.length === 1) {
        return `${BULAN_NAMA[group[0].bulan].toUpperCase()} ${group[0].tahun}`
      }
      const start = group[0]
      const end = group[group.length - 1]
      if (start.tahun === end.tahun) {
        return `${BULAN_NAMA[start.bulan].toUpperCase()} - ${BULAN_NAMA[end.bulan].toUpperCase()} ${start.tahun}`
      } else {
        return `${BULAN_NAMA[start.bulan].toUpperCase()} ${start.tahun} - ${BULAN_NAMA[end.bulan].toUpperCase()} ${end.tahun}`
      }
    })
    
    return formattedGroups.join(', ')
  }

  const handleExportExcelPenunggak = async () => {
    setExportingExcel(true)
    try {
      const rawData = await getPenunggakExportData(
        tahun,
        bulan,
        exportAsrama,
        exportPeriode
      )

      if (!rawData || rawData.length === 0) {
        toast.error("Tidak ada data penunggak untuk diexport.")
        setExportingExcel(false)
        return
      }

      const excelRows = rawData.map((row: any, idx: number) => {
        return {
          'No': idx + 1,
          'Nama': row.nama_lengkap,
          'Asrama': row.asrama || '-',
          'Kamar': row.kamar || '-',
          'Sekolah': row.sekolah || '-',
          'Kelas Sekolah': row.kelas_sekolah || '-',
          'Kelas Pesantren': row.kelas_pesantren || '-',
          'Bulan Tunggakan': formatUnpaidMonths(row.unpaidMonths),
          'Keterangan': ''
        }
      })

      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(excelRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Penunggak SPP')

      const wscols = [
        { wch: 6 },   // No
        { wch: 30 },  // Nama
        { wch: 18 },  // Asrama
        { wch: 10 },  // Kamar
        { wch: 15 },  // Sekolah
        { wch: 15 },  // Kelas Sekolah
        { wch: 18 },  // Kelas Pesantren
        { wch: 35 },  // Bulan Tunggakan
        { wch: 25 },  // Keterangan
      ]
      worksheet['!cols'] = wscols

      const asramaSuffix = exportAsrama === 'SEMUA' ? 'Semua_Asrama' : exportAsrama.replace(/\s+/g, '_')
      const periodSuffix = exportPeriode === 'BULAN_INI' 
        ? `${BULAN_NAMA[bulan].toUpperCase()}_${tahun}` 
        : `s.d_${BULAN_NAMA[bulan].toUpperCase()}_${tahun}`

      const filename = `Tunggakan_SPP_${asramaSuffix}_${periodSuffix}.xlsx`
      XLSX.writeFile(workbook, filename)

      toast.success("Data penunggak berhasil diexport ke Excel!")
      setIsExportModalOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengexport file Excel")
    } finally {
      setExportingExcel(false)
    }
  }
  
  // MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeRow, setActiveRow] = useState<AsramaRow | null>(null)

  // SETORAN FORM (Inside Modal)
  const [savingSetoran, setSavingSetoran] = useState(false)
  const [formJumlah, setFormJumlah] = useState('')
  const [formPenyetor, setFormPenyetor] = useState('')
  const [isEditingForm, setIsEditingForm] = useState(false)

  const tahunList = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const load = async (forceRefresh = false) => {
    if (!forceRefresh && _setoranCache && _setoranCache.tahun === tahun && _setoranCache.bulan === bulan) {
      const rows = _setoranCache.data
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.unit_setor === userAsrama) : rows)
      setNominal(_setoranCache.nominal)
      setHasLoaded(true)
      if (isModalOpen && activeRow) {
        const updatedRow = rows.find((r: AsramaRow) => r.unit_setor === activeRow.unit_setor)
        if (updatedRow) setActiveRow(updatedRow)
      }
      return
    }
    setLoading(true)
    try {
      const [rows, settings] = await Promise.all([
        getMonitoringSetoran(tahun, bulan),
        getSppSettings(tahun),
      ])
      _setoranCache = { tahun, bulan, data: rows, nominal: settings.nominal }
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.unit_setor === userAsrama) : rows)
      setNominal(settings.nominal)
      setHasLoaded(true)

      if (isModalOpen && activeRow) {
        const updatedRow = rows.find((r: AsramaRow) => r.unit_setor === activeRow.unit_setor)
        if (updatedRow) setActiveRow(updatedRow)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat monitoring SPP.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getClientRestriction().then(setUserAsrama)
    getSppBillingStart().then(res => {
      setBillingStart(res)
      setBillingStartInput(res.value)
    })
    getMonitoringPrintMeta().then(res => setTahunAjaranNama(res.tahunAjaranNama))
  }, [])

  useEffect(() => {
    setHasLoaded(false)
    getSppSetoranWindow(tahun, bulan).then(w => {
      setSetoranWindow(w)
      setSetoranWindowInput(w ?? '')
    })
  }, [tahun, bulan])

  function prevBulan() {
    if (bulan === 1) { setBulan(12); setTahun(t => t - 1) }
    else setBulan(b => b - 1)
  }
  function nextBulan() {
    if (bulan === 12) { setBulan(1); setTahun(t => t + 1) }
    else setBulan(b => b + 1)
  }

  function openDetailModal(row: AsramaRow) {
    setActiveRow(row)
    setFormJumlah(row.jumlah_aktual != null ? String(row.jumlah_aktual) : String(row.total_nominal))
    setFormPenyetor(row.nama_penyetor ?? '')
    setIsEditingForm(false)
    setIsModalOpen(true)
  }

  async function handleSimpanSetoran() {
    if (!activeRow) return
    setSavingSetoran(true)
    try {
      const res = await simpanSetoran(
        activeRow.unit_setor, tahun, bulan,
        Number(formJumlah.replace(/\D/g, '')),
        formPenyetor
      )
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Setoran berhasil disimpan')
      setIsEditingForm(false)
      load(true)
    } finally {
      setSavingSetoran(false)
    }
  }

  async function handleSimpanBillingStart(e: React.FormEvent) {
    e.preventDefault()
    setSavingBillingStart(true)
    try {
      const res = await simpanSppBillingStart(billingStartInput)
      if ('error' in res) { toast.error(res.error); return }
      const updated = await getSppBillingStart()
      setBillingStart(updated)
      setBillingStartInput(updated.value)
      toast.success('Awal tagihan SPP diperbarui')
      load(true)
    } finally {
      setSavingBillingStart(false)
    }
  }

  async function handleSimpanSetoranWindow(e: React.FormEvent): Promise<boolean> {
    e.preventDefault()
    setSavingSetoranWindow(true)
    try {
      const res = await simpanSppSetoranWindow(tahun, bulan, setoranWindowInput)
      if ('error' in res) { toast.error(res.error); return false }
      setSetoranWindow(setoranWindowInput)
      toast.success('Tanggal mulai setoran diperbarui')
      return true
    } finally {
      setSavingSetoranWindow(false)
    }
  }

  const rankMap = React.useMemo(() => {
    const ranked = data
      .filter(r => r.tanggal_setor !== null && !r.belum_ada_tagihan)
      .sort((a, b) => new Date(a.tanggal_setor!).getTime() - new Date(b.tanggal_setor!).getTime())
    const map = new Map<string, number>()
    ranked.forEach((r, i) => map.set(r.unit_setor, i + 1))
    return map
  }, [data])

  const filteredData = React.useMemo(() => {
    if (filterAsrama === 'SEMUA') return data
    if (filterAsrama === 'SUDAH_SETOR') return data.filter(r => r.tanggal_setor !== null)
    if (filterAsrama === 'BELUM_SETOR') return data.filter(r => !r.tanggal_setor && !r.belum_ada_tagihan)
    return data.filter(r => r.unit_setor === filterAsrama)
  }, [data, filterAsrama])

  const totalSantri    = filteredData.reduce((a, r) => a + r.total_santri, 0)
  const totalBebasSpp  = filteredData.reduce((a, r) => a + r.bebas_spp, 0)
  const totalTidakAdaTagihan = filteredData.reduce((a, r) => a + r.tidak_ada_tagihan, 0)
  const totalWajib     = filteredData.reduce((a, r) => a + r.wajib_bayar, 0)
  const totalBayar     = filteredData.reduce((a, r) => a + r.bayar_bulan_ini, 0)
  const totalTunggak   = filteredData.reduce((a, r) => a + r.penunggak, 0)
  const totalNominal   = filteredData.reduce((a, r) => a + r.total_nominal, 0)
  const totalNominalBulanIni = filteredData.reduce((a, r) => a + r.nominal_bulan_ini, 0)
  const totalNominalTunggakan = filteredData.reduce((a, r) => a + r.nominal_tunggakan_lalu, 0)
  const pctKeseluruhan = totalWajib > 0 ? Math.round((totalBayar / totalWajib) * 100) : 0
  const selectedBeforeBillingStart = (tahun * 100 + bulan) < (billingStart.tahun * 100 + billingStart.bulan)
  const tahunAjaranDisplay = tahunAjaranNama ?? deriveAcademicYear(tahun, bulan)

  function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
  function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-3 max-w-[100vw] overflow-hidden text-slate-800">
      
      {/* ── Header ── */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monitoring SPP</h1>
        <p className="text-sm text-slate-500 mt-1">Laporan setoran tunai unit bulan {BULAN_NAMA[bulan]} {tahun}</p>
      </div>

      {/* ── Controls Bar ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 bg-white border border-slate-200 shadow-sm rounded-xl p-3">
        <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 min-w-[10.5rem]">
          <button onClick={prevBulan} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
          <div className="flex-1 px-2 text-center text-base font-semibold text-slate-700">{BULAN_NAMA[bulan]} {tahun}</div>
          <button onClick={nextBulan} disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
          <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">Tarif: <span className="text-slate-900 font-semibold">{fmtRp(nominal)}</span></span>
        </div>

        {!userAsrama && (
          <NativeSelect
            value={filterAsrama}
            onChange={e => setFilterAsrama(e.target.value)}
            data={[
              { label: 'Semua Asrama', value: 'SEMUA' },
              { label: 'Sudah Setor', value: 'SUDAH_SETOR' },
              { label: 'Belum Setor', value: 'BELUM_SETOR' },
              ...(hasLoaded && data.length > 0 ? data.map(r => ({ label: r.unit_setor, value: r.unit_setor })) : []),
            ]}
          />
        )}

        <form onSubmit={handleSimpanBillingStart} className="flex items-center gap-2 flex-1 min-w-[220px]">
          <CalendarCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Mulai Tagihan</span>
          <TextInput
            type="month"
            value={billingStartInput}
            onChange={e => setBillingStartInput(e.target.value)}
            className="flex-1 min-w-0"
            size="sm"
          />
          <ActionIcon type="submit" loading={savingBillingStart} color="dark" size="lg" radius="md" title="Simpan mulai tagihan">
            <Save className="w-3.5 h-3.5"/>
          </ActionIcon>
        </form>

        <Group gap="xs" className="w-full sm:w-auto sm:ml-auto" wrap="wrap">
          <Button
            onClick={() => load()}
            loading={loading}
            leftSection={!loading ? <RefreshCw className="w-3.5 h-3.5"/> : undefined}
            color={!hasLoaded ? 'blue' : 'gray'}
            variant={!hasLoaded ? 'filled' : 'light'}
            className="flex-1 sm:flex-none"
          >
            {loading ? 'Memuat...' : (_setoranCache && _setoranCache.tahun === tahun && _setoranCache.bulan === bulan ? 'Tarik Data (Cache)' : 'Tarik Data')}
          </Button>
          <Button
            type="button"
            onClick={() => setIsSetoranWindowModalOpen(true)}
            leftSection={<CalendarDays className="w-3.5 h-3.5"/>}
            color={setoranWindow ? 'indigo' : 'gray'}
            variant={setoranWindow ? 'light' : 'outline'}
            title="Atur tanggal mulai setoran"
            className="flex-1 sm:flex-none"
          >
            {setoranWindow ? format(new Date(setoranWindow), 'd MMM') : 'Mulai Setor'}
          </Button>
        </Group>
      </div>

      {/* Tabs Menu */}
      <SegmentedControl
        value={activeTab}
        onChange={v => setActiveTab(v as typeof activeTab)}
        data={[
          { label: 'Setoran Unit', value: 'setoran' },
          { label: 'Daftar Penunggak', value: 'penunggak' },
          { label: 'Bebas SPP', value: 'bebas' },
        ]}
        fullWidth
        mb="md"
      />

      {activeTab === 'setoran' && (
        <>
          {hasLoaded && <MonitoringPrintControls hasLoaded={hasLoaded} data={data} bulan={bulan} tahun={tahun} nominal={nominal} tahunAjaran={tahunAjaranDisplay} />}

          {selectedBeforeBillingStart && hasLoaded && (
            <Alert color="blue" mb="md">
              Periode {BULAN_NAMA[bulan]} {tahun} berstatus <strong>BELUM ADA TAGIHAN</strong>. Awal tagihan aktif dimulai {BULAN_NAMA[billingStart.bulan]} {billingStart.tahun}.
            </Alert>
          )}

          {/* ── Ringkasan Total - Sleek Version ── */}
          {!userAsrama && hasLoaded && filteredData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              <StatCard title="Total Santri" value={fmt(totalSantri)} icon={Users} />
              <StatCard title="Tidak Ada Tagihan" value={fmt(totalTidakAdaTagihan)} icon={CalendarCheck} color="text-blue-600" />
              <StatCard title="Wajib SPP" value={fmt(totalWajib)} icon={UserCheck} />
              <StatCard title="Telah Lunas" value={fmt(totalBayar)} sub={`${pctKeseluruhan}%`} icon={CheckCircle2} color="text-emerald-600" />
              <StatCard title="Penunggak" value={fmt(totalTunggak)} icon={AlertCircle} color="text-rose-600" />
              <div className="col-span-2 md:col-span-1 border border-indigo-100 bg-indigo-50/50 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                 <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1">Uang Tercatat</div>
                 <div className="text-xl font-bold text-indigo-900 leading-none">{fmtRp(totalNominal)}</div>
                 <div className="text-[10px] text-slate-500 mt-1">Bulan ini {fmtRp(totalNominalBulanIni)} + tunggakan {fmtRp(totalNominalTunggakan)}</div>
              </div>
            </div>
          )}

          {/* ── Tabel Utama ── */}
          <div className="bg-white border md:rounded-2xl shadow-sm rounded-xl overflow-hidden min-h-[40vh]">
            {loading ? (
              <div className="flex justify-center flex-col items-center py-24 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-3 text-blue-500" />
                <span className="text-sm font-medium">Sinkronisasi data...</span>
              </div>
            ) : !hasLoaded ? (
              <div className="flex flex-col items-center justify-center py-32 text-center text-slate-400">
                 <Search className="w-10 h-10 mb-3 opacity-50"/>
                 <p className="text-sm font-medium">Tidak ada data aktif. Klik Tarik Data.</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="py-24 text-center text-sm font-medium text-slate-400">
                {hasLoaded ? 'Tidak ada data untuk filter ini.' : 'Tidak ditemukan data.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 font-medium">Unit Setor & Populasi</th>
                      <th className="py-3 px-5 font-medium">Progres Pembayaran</th>
                      <th className="py-3 px-5 font-medium text-right">Uang Tercatat</th>
                      <th className="py-3 px-5 font-medium text-center">Rekap Fiskal</th>
                      <th className="py-3 px-5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((row) => (
                      <tr key={row.unit_setor} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-5">
                          <p className="font-semibold text-slate-800">{row.unit_setor}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{fmt(row.total_santri)} Santri ({fmt(row.wajib_bayar)} Wajib)</p>
                          {row.tidak_ada_tagihan > 0 && <p className="text-[10px] font-semibold text-blue-600 mt-0.5">{fmt(row.tidak_ada_tagihan)} Tidak Ada Tagihan</p>}
                        </td>
                        <td className="py-3 px-5 w-48 lg:w-64">
                          {row.belum_ada_tagihan ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                              <CalendarCheck className="w-3.5 h-3.5"/> Belum Ada Tagihan
                            </span>
                          ) : (
                            <>
                              <div className="flex justify-between items-center text-[11px] font-medium mb-1.5">
                                <span className="text-slate-500">{fmt(row.bayar_bulan_ini)} Lunas</span>
                                <span className={row.persentase >= 80 ? 'text-emerald-600' : row.persentase >= 50 ? 'text-yellow-600' : 'text-rose-600'}>{row.persentase}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-700 ${row.persentase >= 80 ? 'bg-emerald-500' : row.persentase >= 50 ? 'bg-yellow-400' : 'bg-rose-500'}`} style={{ width: `${row.persentase}%`}}></div>
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <p className="font-semibold text-slate-900">{row.belum_ada_tagihan ? '-' : fmtRp(row.total_nominal)}</p>
                          {!row.belum_ada_tagihan && row.nominal_tunggakan_lalu > 0 && (
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                              {fmtRp(row.nominal_bulan_ini)} bulan ini + {fmtRp(row.nominal_tunggakan_lalu)} tunggakan
                            </p>
                          )}
                          {row.penunggak > 0 && <p className="text-[10px] font-medium text-rose-500 mt-0.5">-{fmt(row.penunggak)} Orang Nunggak</p>}
                        </td>
                        <td className="py-3 px-5 text-center">
                          {row.belum_ada_tagihan ? (
                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md inline-block">Tidak Ditagihkan</span>
                          ) : row.tanggal_setor ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="inline-flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                                <CheckCircle2 className="w-3.5 h-3.5"/> Disetor {format(new Date(row.tanggal_setor), 'dd/MM HH:mm')}
                              </div>
                              {rankMap.has(row.unit_setor) && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                  #{rankMap.get(row.unit_setor)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md inline-block">Belum Laporan</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button onClick={() => openDetailModal(row)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <Eye className="w-4 h-4"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'penunggak' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-end">
              <NativeSelect
                label={<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit / Asrama</span>}
                value={selectedAsramaPenunggak}
                onChange={e => { setSelectedAsramaPenunggak(e.target.value); setSearchPenunggak(''); }}
                data={[
                  { label: '-- Pilih Asrama --', value: '' },
                  ...data.map((r: AsramaRow) => ({ label: r.unit_setor, value: r.unit_setor })),
                  { label: 'Semua Asrama', value: 'SEMUA' },
                ]}
              />

              {selectedAsramaPenunggak && (
                <TextInput
                  label={<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cari Nama</span>}
                  leftSection={<Search className="w-4 h-4"/>}
                  placeholder="Cari santri..."
                  value={searchPenunggak}
                  onChange={e => { setSearchPenunggak(e.target.value); setPagePenunggak(1); }}
                  className="flex-1 sm:flex-none"
                />
              )}

              <Button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                leftSection={<Download className="w-4 h-4"/>}
                color="teal"
              >
                Export Excel
              </Button>
            </div>

            {selectedAsramaPenunggak && (
              <div className="text-right w-full md:w-auto text-xs text-slate-500">
                Menampilkan <span className="font-bold text-slate-700">{filteredPenunggak.length}</span> penunggak
              </div>
            )}
          </div>

          {/* Table / List */}
          {!selectedAsramaPenunggak ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
              <h3 className="text-base font-bold text-slate-600">Pilih Asrama Terlebih Dahulu</h3>
              <p className="text-sm mt-1 max-w-md mx-auto">Silakan tentukan unit atau asrama dari menu dropdown di atas untuk memuat daftar santri yang menunggak pembayaran SPP.</p>
            </div>
          ) : loadingPenunggak ? (
            <div className="bg-white border rounded-2xl py-20 text-center text-slate-400 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-semibold">Memuat daftar penunggak...</p>
            </div>
          ) : filteredPenunggak.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-80" />
              <h3 className="text-base font-bold text-slate-600">Lunas SPP</h3>
              <p className="text-sm mt-1">Luar biasa! Tidak ada santri yang memiliki tunggakan SPP pada filter asrama ini.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 text-center w-12">#</th>
                      <th className="py-3 px-5">Nama Santri</th>
                      <th className="py-3 px-5">Asrama / Kamar</th>
                      <th className="py-3 px-5 text-center">Tunggakan (Bulan)</th>
                      <th className="py-3 px-5 text-right">Total Tunggakan</th>
                      <th className="py-3 px-5 text-right pr-6 w-40">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPenunggak.map((p, idx) => {
                      const rowNum = pageSizePenunggak === 'all' ? idx + 1 : (pagePenunggak - 1) * pageSizePenunggak + idx + 1
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 text-center font-bold text-slate-400">{rowNum}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">{p.nama_lengkap}</td>
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-slate-700">{p.asrama || 'Tidak ada'}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Kamar: {p.kamar || '-'}</p>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                              {p.total_tunggakan_bulan} Bulan
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-950">
                            {fmtRp(p.total_tunggakan_nominal)}
                          </td>
                          <td className="py-3.5 px-5 text-right pr-6">
                            <a
                              href={`/dashboard/dewan-santri/surat?action=tagihan&santriId=${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Cetak Surat
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer for Penunggak */}
              {filteredPenunggak.length > 0 && (
                <div className="bg-slate-50 border-t px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <Group gap="xs" align="center">
                    <span className="text-sm text-slate-600">Tampilkan:</span>
                    <NativeSelect
                      value={String(pageSizePenunggak)}
                      onChange={e => { setPageSizePenunggak(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPagePenunggak(1); }}
                      data={[
                        { label: '25', value: '25' },
                        { label: '50', value: '50' },
                        { label: '100', value: '100' },
                        { label: 'Semua', value: 'all' },
                      ]}
                      size="xs"
                    />
                    <span className="text-sm text-slate-600">dari {filteredPenunggak.length} penunggak</span>
                  </Group>

                  {pageSizePenunggak !== 'all' && totalPagesPenunggak > 1 && (
                    <MantinePagination
                      value={pagePenunggak}
                      onChange={setPagePenunggak}
                      total={totalPagesPenunggak}
                      withEdges
                      size="sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bebas' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
              <NativeSelect
                label={<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit / Asrama</span>}
                value={selectedAsramaBebas}
                onChange={e => { setSelectedAsramaBebas(e.target.value); setSearchBebas(''); }}
                data={[
                  { label: '-- Pilih Asrama --', value: '' },
                  ...data.map((r: AsramaRow) => ({ label: r.unit_setor, value: r.unit_setor })),
                  { label: 'Semua Asrama', value: 'SEMUA' },
                ]}
              />

              {selectedAsramaBebas && (
                <TextInput
                  label={<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cari Nama</span>}
                  leftSection={<Search className="w-4 h-4"/>}
                  placeholder="Cari santri..."
                  value={searchBebas}
                  onChange={e => { setSearchBebas(e.target.value); setPageBebas(1); }}
                  className="flex-1 sm:flex-none"
                />
              )}
            </div>

            {selectedAsramaBebas && (
              <div className="text-right w-full md:w-auto text-xs text-slate-500">
                Menampilkan <span className="font-bold text-slate-700">{filteredBebas.length}</span> santri bebas SPP
              </div>
            )}
          </div>

          {/* Table / List */}
          {!selectedAsramaBebas ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
              <h3 className="text-base font-bold text-slate-600">Pilih Asrama Terlebih Dahulu</h3>
              <p className="text-sm mt-1 max-w-md mx-auto">Silakan tentukan unit atau asrama dari menu dropdown di atas untuk memuat daftar santri yang dibebaskan dari SPP.</p>
            </div>
          ) : loadingBebas ? (
            <div className="bg-white border rounded-2xl py-20 text-center text-slate-400 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-semibold">Memuat daftar bebas SPP...</p>
            </div>
          ) : filteredBebas.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-80" />
              <h3 className="text-base font-bold text-slate-600">Tidak Ada Santri Bebas SPP</h3>
              <p className="text-sm mt-1">Tidak ada santri yang dibebaskan dari kewajiban SPP pada filter asrama ini.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 text-center w-12">#</th>
                      <th className="py-3 px-5">Nama Santri</th>
                      <th className="py-3 px-5">Asrama / Kamar</th>
                      <th className="py-3 px-5">Sekolah / Kelas</th>
                      <th className="py-3 px-5">Kelas Pesantren</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBebas.map((p, idx) => {
                      const rowNum = pageSizeBebas === 'all' ? idx + 1 : (pageBebas - 1) * pageSizeBebas + idx + 1
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 text-center font-bold text-slate-400">{rowNum}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            {p.nama_lengkap}
                            {p.nis && <p className="text-[10px] text-slate-500 font-normal mt-0.5">NIS: {p.nis}</p>}
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-slate-700">{p.asrama || 'Tidak ada'}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Kamar: {p.kamar || '-'}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-slate-700">{p.sekolah || '-'}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Kelas: {p.kelas_sekolah || '-'}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              {p.kelas_pesantren || '-'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer for Bebas */}
              {filteredBebas.length > 0 && (
                <div className="bg-slate-50 border-t px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <Group gap="xs" align="center">
                    <span className="text-sm text-slate-600">Tampilkan:</span>
                    <NativeSelect
                      value={String(pageSizeBebas)}
                      onChange={e => { setPageSizeBebas(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPageBebas(1); }}
                      data={[
                        { label: '25', value: '25' },
                        { label: '50', value: '50' },
                        { label: '100', value: '100' },
                        { label: 'Semua', value: 'all' },
                      ]}
                      size="xs"
                    />
                    <span className="text-sm text-slate-600">dari {filteredBebas.length} santri</span>
                  </Group>

                  {pageSizeBebas !== 'all' && totalPagesBebas > 1 && (
                    <MantinePagination
                      value={pageBebas}
                      onChange={setPageBebas}
                      total={totalPagesBebas}
                      withEdges
                      size="sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Detail Kompak ── */}
      <Modal
        opened={isModalOpen && activeRow !== null}
        onClose={() => setIsModalOpen(false)}
        title={activeRow ? <><span className="text-lg font-bold text-slate-900">{activeRow.unit_setor}</span><p className="text-xs text-slate-500">Laporan Rekapitulasi SPP Fisik</p></> : null}
        size="sm"
        centered
      >
        {activeRow && (
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              <NanoChip label="Bebas SPP" value={activeRow.bebas_spp} />
              <NanoChip label="Tidak Ada Tagihan" value={activeRow.tidak_ada_tagihan} color="text-blue-600 bg-blue-50 border-blue-100" />
              <NanoChip label="Wajib SPP" value={activeRow.wajib_bayar} />
              <NanoChip label="Telah Lunas" value={activeRow.bayar_bulan_ini} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
              <NanoChip label="Penunggak" value={activeRow.penunggak} color="text-rose-600 bg-rose-50 border-rose-100" />
              <NanoChip label="Bayar Tunggakan" value={activeRow.bayar_tunggakan_lalu} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Validasi Setoran Tunai</h3>

              {activeRow.belum_ada_tagihan ? (
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3"><CalendarCheck className="w-5 h-5"/></div>
                  <p className="text-lg font-bold text-blue-800 leading-tight mb-1">Belum Ada Tagihan</p>
                  <p className="text-xs text-blue-600/80">Periode ini berada sebelum awal tagihan SPP yang ditetapkan.</p>
                </div>
              ) : activeRow.tanggal_setor && !isEditingForm ? (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-5 h-5"/></div>
                  <p className="text-2xl font-bold text-emerald-700 leading-tight mb-1">{fmtRp(activeRow.jumlah_aktual ?? activeRow.total_nominal)}</p>
                  <p className="text-xs text-emerald-600/80 mb-3">Diserahkan oleh {activeRow.nama_penyetor || '-'} pada {format(new Date(activeRow.tanggal_setor), 'd MMM yyyy')}</p>
                  <button onClick={() => setIsEditingForm(true)} className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 transition-colors">Revisi Nominal / Laporan</button>
                </div>
              ) : (
                <form onSubmit={e=>{e.preventDefault(); handleSimpanSetoran();}} className="space-y-4">
                  <TextInput
                    label="Diserahkan Oleh"
                    required
                    placeholder="Nama pengurus..."
                    value={formPenyetor}
                    onChange={e => setFormPenyetor(e.target.value)}
                  />
                  <TextInput
                    label={<span className="flex justify-between w-full">Total Uang Fisik <span className="text-slate-400 font-normal">Target: {fmtRp(activeRow.total_nominal)}</span></span>}
                    required
                    value={fmt(Number(formJumlah.replace(/\D/g, '')))}
                    onChange={e => setFormJumlah(e.target.value)}
                    leftSection={<span className="text-slate-400 text-sm">Rp</span>}
                    fw={600}
                  />
                  {activeRow.nominal_tunggakan_lalu > 0 && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      Target sistem berasal dari {fmtRp(activeRow.nominal_bulan_ini)} SPP bulan {BULAN_NAMA[bulan]} dan {fmtRp(activeRow.nominal_tunggakan_lalu)} pelunasan tunggakan yang tercatat bulan ini.
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {isEditingForm && (
                      <Button type="button" onClick={() => setIsEditingForm(false)} variant="outline" color="gray" className="flex-1">Batal</Button>
                    )}
                    <Button
                      type="submit"
                      loading={savingSetoran}
                      color="dark"
                      leftSection={!savingSetoran ? <Check className="w-4 h-4"/> : undefined}
                      className={isEditingForm ? 'flex-1' : 'w-full'}
                    >
                      {savingSetoran ? 'Menyimpan...' : 'Pelunasan Valid'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Mulai Setor ── */}
      <Modal
        opened={isSetoranWindowModalOpen}
        onClose={() => setIsSetoranWindowModalOpen(false)}
        title={<><span className="text-lg font-bold text-slate-900">Mulai Setor</span><p className="text-xs text-slate-500">Tanggal asrama mulai bisa setor — {BULAN_NAMA[bulan]} {tahun}</p></>}
        size="sm"
        centered
      >
        <form
          onSubmit={async (e) => {
            const ok = await handleSimpanSetoranWindow(e)
            if (ok) setIsSetoranWindowModalOpen(false)
          }}
          className="space-y-4"
        >
          <TextInput
            type="date"
            label="Tanggal Mulai Setor"
            value={setoranWindowInput}
            onChange={e => setSetoranWindowInput(e.target.value)}
            autoFocus
            description={`Setelah tanggal ini asrama dapat melaporkan setoran tunai untuk ${BULAN_NAMA[bulan]} ${tahun}.`}
          />
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={() => setIsSetoranWindowModalOpen(false)} variant="outline" color="gray" className="flex-1">
              Batal
            </Button>
            <Button
              type="submit"
              loading={savingSetoranWindow}
              disabled={!setoranWindowInput}
              color="indigo"
              leftSection={!savingSetoranWindow ? <Save className="w-4 h-4"/> : undefined}
              className="flex-1"
            >
              {savingSetoranWindow ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Export Excel ── */}
      <Modal
        opened={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={<><span className="text-lg font-bold text-slate-900">Export Excel Penunggak</span><p className="text-xs text-slate-500">Konfigurasi data export excel</p></>}
        size="sm"
        centered
      >
        <div className="space-y-4">
          <NativeSelect
            label="Pilihan Asrama"
            value={exportAsrama}
            onChange={e => setExportAsrama(e.target.value)}
            data={[
              { label: 'Semua Asrama', value: 'SEMUA' },
              ...data.map(r => ({ label: r.unit_setor, value: r.unit_setor }))
            ]}
          />

          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter Periode</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportPeriode"
                  value="BULAN_INI"
                  checked={exportPeriode === 'BULAN_INI'}
                  onChange={() => setExportPeriode('BULAN_INI')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">Hanya Bulan Ini</p>
                  <p className="text-xs text-slate-500">Mengekspor data santri yang menunggak khusus pada bulan {BULAN_NAMA[bulan]} {tahun}.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="exportPeriode"
                  value="SEMUA_BULAN"
                  checked={exportPeriode === 'SEMUA_BULAN'}
                  onChange={() => setExportPeriode('SEMUA_BULAN')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">Semua Bulan (Akumulasi)</p>
                  <p className="text-xs text-slate-500">Mengekspor data santri yang menunggak pada bulan mana pun hingga bulan {BULAN_NAMA[bulan]} {tahun}.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setIsExportModalOpen(false)} disabled={exportingExcel} variant="outline" color="gray" className="flex-1">
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleExportExcelPenunggak}
              loading={exportingExcel}
              color="teal"
              leftSection={!exportingExcel ? <Download className="w-4 h-4"/> : undefined}
              className="flex-1"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({title, value, sub, icon: Icon, color}: {title: string, value: string, sub?: string, icon: any, color?: string}) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 flex flex-col justify-center bg-white shadow-sm">
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{title}</div>
        <Icon className={`w-3.5 h-3.5 ${color || 'text-slate-400'}`} />
      </div>
      <div className={`text-xl font-bold leading-none ${color || 'text-slate-800'}`}>{value} <span className="text-xs font-semibold ml-0.5">{sub}</span></div>
    </div>
  )
}

function NanoChip({label, value, color}: {label: string, value: string|number, color?: string}) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${color || 'border-slate-200 bg-white text-slate-700'}`}>
      <span className="text-[10px] font-medium opacity-70">{label}:</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  )
}

function deriveAcademicYear(tahun: number, bulan: number) {
  return bulan >= 7 ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`
}
