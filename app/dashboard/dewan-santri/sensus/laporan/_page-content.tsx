'use client'

import { useMemo, useRef, useState } from 'react'
import { getLaporanSensus } from './actions'
import { CheckSquare, Filter, Loader2, Printer, RotateCcw, Square, X } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useReactToPrint } from '@/lib/pdf/client'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const ROOM_NUMBERS = Array.from({ length: 37 }, (_, i) => i + 1)

type MutasiRow = {
  mutasi_key?: string
  id?: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  alamat: string | null
  tipe: 'MASUK' | 'KELUAR'
  ket: string | null
  tgl: string
}
type AsramaReportStats = { total: number; keluar: number; masuk: number; kamar: Record<string, number> }
type ClassStats = Partial<Record<7 | 8 | 9 | 10 | 11 | 12, number>> & { tot: number }
type SekolahStats = {
  MI: number
  MTS: ClassStats
  MTSN: ClassStats
  SMP: ClassStats
  MA: ClassStats
  SMA: ClassStats
  SMK: ClassStats
  SADESA: number
  TOTAL: number
}
type SekolahKey = keyof SekolahStats
type LaporanSensusData = {
  asrama: Record<string, AsramaReportStats>
  sekolah: Record<string, SekolahStats>
  mutasi: MutasiRow[]
  total_santri: number
}

const getMutasiKey = (row: MutasiRow) => row.mutasi_key || `${row.tipe}:${row.id || row.nama_lengkap}:${row.tgl}`

function FooterTtd() {
  return (
    <div className="mt-8 flex justify-between items-end px-10 text-[10px] font-serif break-inside-avoid">
        {/* Kiri */}
        <div className="text-center relative w-48">
            <p className="font-bold mb-12">Ketua Dewan Santri,</p>
            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <img src="/stempel-dewan-santri.png" className="w-16 opacity-80 rotate-[-5deg] mix-blend-multiply absolute top-[-40px] left-4" alt="stempel"/>
                <img src="/ttd-dewan-santri.png" className="w-24 object-contain relative z-10 bottom-2" alt="ttd"/>
            </div>
            <p className="font-bold underline relative z-20">Muhammad Fakhri, S.Pd.</p>
        </div>

        {/* Tengah */}
        <div className="text-center relative w-48">
            <p className="font-bold mb-1">Mengetahui,</p>
            <p className="font-bold mb-12">Wakil Pimpinan Bid. Kesantrian,</p>
            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <img src="/stempel-pesantren.png" className="w-16 opacity-80 rotate-[-5deg] mix-blend-multiply absolute top-[-40px] left-4" alt="stempel"/>
                <img src="/ttd-kesantrian.png" className="w-24 object-contain relative z-10 bottom-2" alt="ttd"/>
            </div>
            <p className="font-bold underline relative z-20">KH. T. Mukhtar Wahab, S.Ag.</p>
        </div>

        {/* Kanan */}
        <div className="text-center relative w-48">
            <p className="mb-1">Tasikmalaya, {format(new Date(), 'dd MMMM yyyy', {locale: id})}</p>
            <p className="font-bold mb-12">Sekretaris Dewan Santri,</p>
            <p className="font-bold underline mt-[50px]">Wahid Hasyim</p>
        </div>
    </div>
  )
}

export default function CetakLaporanSensus() {
  const [bulan, setBulan] = useState(new Date().getMonth() + 1)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [data, setData] = useState<LaporanSensusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterKeterangan, setFilterKeterangan] = useState('')
  const [selectedMutasi, setSelectedMutasi] = useState<Set<string>>(new Set())
  const [excludedMutasi, setExcludedMutasi] = useState<Set<string>>(new Set())

  // Ref untuk area yang akan diprint
  const printRef = useRef<HTMLDivElement>(null)

  const handleGenerate = async () => {
    setLoading(true)
    const res = await getLaporanSensus(bulan, tahun)
    setData(res)
    setFilterKeterangan('')
    setSelectedMutasi(new Set())
    setExcludedMutasi(new Set())
    setLoading(false)
  }

  // Hook Print Professional
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan_Sensus_${bulan}_${tahun}`,
    onAfterPrint: () => console.log("Printed successfully")
  })

  const bulanNama = format(new Date(tahun, bulan - 1, 1), 'MMMM', { locale: id }).toUpperCase()
  const tahunAjaran = bulan > 6 ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`

  // Helper Formatter
  const fmt = (val: number | string | null | undefined) => (val && val !== 0) ? val : '-'

  const mutasiRows = useMemo(() => (data?.mutasi || []) as MutasiRow[], [data])
  const filteredMutasiRows = useMemo(() => {
    const q = filterKeterangan.trim().toLowerCase()
    if (!q) return mutasiRows
    return mutasiRows.filter(row => String(row.ket || '').toLowerCase().includes(q))
  }, [mutasiRows, filterKeterangan])

  const filteredMutasiKeys = useMemo(() => filteredMutasiRows.map(getMutasiKey), [filteredMutasiRows])
  const selectedFilteredCount = filteredMutasiKeys.filter(key => selectedMutasi.has(key)).length
  const excludedFilteredCount = filteredMutasiKeys.filter(key => excludedMutasi.has(key)).length

  const includedMutasiRows = useMemo(
    () => mutasiRows.filter(row => !excludedMutasi.has(getMutasiKey(row))),
    [mutasiRows, excludedMutasi]
  )

  const reportData = useMemo(() => {
    if (!data) return null
    const asramaStats: Record<string, AsramaReportStats> = Object.fromEntries(
      Object.entries(data.asrama || {}).map(([asrama, info]) => [
        asrama,
        { ...info, masuk: 0, keluar: 0 },
      ])
    )

    includedMutasiRows.forEach(row => {
      const asrama = row.asrama || 'LAINNYA'
      if (!asramaStats[asrama]) return
      if (row.tipe === 'MASUK') asramaStats[asrama].masuk += 1
      if (row.tipe === 'KELUAR') asramaStats[asrama].keluar += 1
    })

    return { ...data, asrama: asramaStats, mutasi: includedMutasiRows }
  }, [data, includedMutasiRows])

  const toggleMutasi = (key: string) => {
    setSelectedMutasi(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectFilteredMutasi = () => setSelectedMutasi(prev => new Set([...prev, ...filteredMutasiKeys]))
  const clearSelection = () => setSelectedMutasi(new Set())
  const excludeSelected = () => {
    setExcludedMutasi(prev => new Set([...prev, ...selectedMutasi]))
    setSelectedMutasi(new Set())
  }
  const excludeFiltered = () => setExcludedMutasi(prev => new Set([...prev, ...filteredMutasiKeys]))
  const restoreFiltered = () => setExcludedMutasi(prev => {
    const next = new Set(prev)
    filteredMutasiKeys.forEach(key => next.delete(key))
    return next
  })
  const restoreAll = () => {
    setExcludedMutasi(new Set())
    setSelectedMutasi(new Set())
  }

  // Helper Hitung Total Kolom Sekolah
  const getTotalSekolah = (key: SekolahKey, subKey?: 7 | 8 | 9 | 10 | 11 | 12) => {
    if (!reportData?.sekolah) return 0
    return Object.values(reportData.sekolah).reduce((sum, item) => {
        const value = item[key]
        if (subKey !== undefined) {
            return sum + (typeof value === 'object' ? value[subKey] || 0 : 0)
        }
        return sum + (typeof value === 'number' ? value : 0)
    }, 0)
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* KONTROL PANEL */}
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <DashboardPageHeader
              title="Cetak Laporan Bulanan"
              description="Laporan sensus penduduk format F4 landscape."
              className="flex-1"
          />
          <div className="flex gap-2">
              <select value={bulan} onChange={e=>setBulan(Number(e.target.value))} className="p-2 border rounded font-bold text-slate-700">
                {Array.from({length:12},(_,i)=>i+1).map(b => (
                    <option key={b} value={b}>{format(new Date(2024, b-1, 1), 'MMMM', {locale:id})}</option>
                ))}
              </select>
              <select value={tahun} onChange={e=>setTahun(Number(e.target.value))} className="p-2 border rounded font-bold text-slate-700">
                 <option value={2024}>2024</option>
                 <option value={2025}>2025</option>
                 <option value={2026}>2026</option>
              </select>
              <button onClick={handleGenerate} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition-colors">
                  {loading ? <Loader2 className="animate-spin"/> : "Generate"}
              </button>
              {data && (
                  <button onClick={() => handlePrint()} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex gap-2 items-center shadow hover:bg-green-700 transition-colors">
                      <Printer className="w-4 h-4"/> Print PDF
                  </button>
              )}
          </div>
      </div>

      {data && (
        <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Filter Mutasi Laporan</h3>
              <p className="text-xs text-slate-500">
                Masuk cetak: <strong>{reportData?.mutasi.length || 0}</strong> dari <strong>{mutasiRows.length}</strong> data mutasi.
                {excludedMutasi.size > 0 && <> Exclude aktif: <strong>{excludedMutasi.size}</strong>.</>}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <input
                  value={filterKeterangan}
                  onChange={e => setFilterKeterangan(e.target.value)}
                  placeholder="Cari kolom keterangan"
                  className="w-full min-w-[220px] bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
                {filterKeterangan && (
                  <button onClick={() => setFilterKeterangan('')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button onClick={restoreAll} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={selectFilteredMutasi} disabled={filteredMutasiRows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40">
              <CheckSquare className="h-4 w-4" /> Pilih hasil filter ({selectedFilteredCount}/{filteredMutasiRows.length})
            </button>
            <button onClick={clearSelection} disabled={selectedMutasi.size === 0} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40">
              <Square className="h-4 w-4" /> Kosongkan pilihan
            </button>
            <button onClick={excludeSelected} disabled={selectedMutasi.size === 0} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40">
              Exclude pilihan ({selectedMutasi.size})
            </button>
            <button onClick={excludeFiltered} disabled={filteredMutasiRows.length === 0 || excludedFilteredCount === filteredMutasiRows.length} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40">
              Exclude hasil filter
            </button>
            <button onClick={restoreFiltered} disabled={excludedFilteredCount === 0} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-40">
              Masukkan lagi hasil filter ({excludedFilteredCount})
            </button>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-10 border-b px-3 py-2 text-left"></th>
                  <th className="border-b px-3 py-2 text-left">Nama</th>
                  <th className="border-b px-3 py-2 text-left">Status</th>
                  <th className="border-b px-3 py-2 text-left">Keterangan</th>
                  <th className="border-b px-3 py-2 text-left">Tanggal</th>
                  <th className="border-b px-3 py-2 text-left">Cetak</th>
                </tr>
              </thead>
              <tbody>
                {filteredMutasiRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm font-semibold text-slate-400">Tidak ada mutasi yang cocok.</td>
                  </tr>
                ) : filteredMutasiRows.map(row => {
                  const key = getMutasiKey(row)
                  const excluded = excludedMutasi.has(key)
                  const selected = selectedMutasi.has(key)
                  return (
                    <tr key={key} className={excluded ? 'bg-red-50/60 text-slate-400' : 'hover:bg-slate-50'}>
                      <td className="border-b px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMutasi(key)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                      </td>
                      <td className="border-b px-3 py-2 font-bold text-slate-800">{row.nama_lengkap}</td>
                      <td className={`border-b px-3 py-2 text-xs font-black ${row.tipe === 'MASUK' ? 'text-green-700' : 'text-red-700'}`}>{row.tipe}</td>
                      <td className="border-b px-3 py-2 text-slate-600">{row.ket || '-'}</td>
                      <td className="border-b px-3 py-2 text-slate-500">{format(new Date(row.tgl), 'dd/MM/yyyy')}</td>
                      <td className="border-b px-3 py-2">
                        <button
                          onClick={() => setExcludedMutasi(prev => {
                            const next = new Set(prev)
                            if (next.has(key)) next.delete(key)
                            else next.add(key)
                            return next
                          })}
                          className={`rounded px-2 py-1 text-xs font-bold ${excluded ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                        >
                          {excluded ? 'Exclude' : 'Masuk'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AREA PREVIEW (YANG AKAN DICETAK) */}
      {reportData && (
          <div className="overflow-auto bg-slate-100 p-8 border rounded-xl flex justify-center">
            
            {/* CONTAINER KHUSUS PRINT */}
            <div ref={printRef} className="sensus-print-area bg-white text-black font-serif shadow-2xl">
              
              {/* CSS INJECTED UNTUK PRINT ONLY */}
              <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                      @page { size: 330mm 215mm; margin: 10mm; } /* F4 Landscape */
                      body { background: white; }
                      .print-page { 
                          width: 100%;
                          height: 100%;
                          page-break-after: always; 
                          position: relative;
                      }
                      .print-page:last-child { page-break-after: auto; }
                      
                      .sensus-print-area table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; }
                      .sensus-print-area th, .sensus-print-area td { border: 1px solid black; padding: 4px; text-align: center; vertical-align: middle; }
                      
                      .sensus-print-area .text-left { text-align: left !important; }
                      .sensus-print-area .bg-gray { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                      .sensus-print-area .text-xs { font-size: 8px !important; }
                  }
                  
                  /* Style untuk Preview di Layar */
                  .sensus-print-area .print-page {
                      width: 310mm; /* Lebar F4 Landscape di layar */
                      min-height: 195mm;
                      padding: 20px;
                      background: white;
                      margin-bottom: 20px;
                      border-bottom: 1px dashed #ccc;
                  }
                  
                  .sensus-print-area table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; }
                  .sensus-print-area th, .sensus-print-area td { border: 1px solid black; padding: 4px; text-align: center; vertical-align: middle; }
                  .sensus-print-area .text-left { text-align: left !important; }
                  .sensus-print-area .bg-gray { background-color: #f3f4f6; }
              `}} />

              {/* === HALAMAN 1: COVER === */}
              <div className="print-page flex flex-col items-center justify-center text-center">
                  <div className="border-[3px] border-double border-black w-full h-full flex flex-col items-center justify-center p-10">
                    <img src="/logo.png" alt="Logo" className="w-32 mb-6 grayscale"/>
                    <h1 className="text-4xl font-bold mb-2 uppercase tracking-widest">LAPORAN BULANAN</h1>
                    <h2 className="text-2xl font-bold mb-8">SENSUS PENDUDUK SANTRI</h2>
                    
                    <div className="text-xl font-bold border-t-2 border-b-2 border-black py-4 w-2/3">
                        <p className="mb-2">BULAN : {bulanNama} {tahun}</p>
                        <p>TAHUN AJARAN : {tahunAjaran}</p>
                    </div>

                    <div className="mt-20">
                        <p className="font-bold text-lg">DEWAN SANTRI</p>
                        <p className="text-xl font-black">PONDOK PESANTREN SUKAHIDENG</p>
                        <p className="italic mt-2">Sukarapih - Sukarame - Tasikmalaya</p>
                    </div>
                  </div>
              </div>

              {/* === HALAMAN 2: DATA GABUNGAN (ASRAMA & SEKOLAH) === */}
              <div className="print-page">
                  <div className="text-center font-bold mb-4 uppercase border-b-2 border-black pb-2 text-sm">
                      DATA SANTRI PONDOK PESANTREN SUKAHIDENG BERDASARKAN ASRAMA DAN TINGKAT SATUAN SEKOLAH<br/>
                      BULAN {bulanNama} TAHUN AJARAN {tahunAjaran}
                  </div>

                  {/* 2.1 TABEL ASRAMA */}
                  <div className="mb-6">
                      <h3 className="text-xs font-bold mb-1 uppercase text-left">A. Data Hunian Asrama & Kamar</h3>
                      <table className="text-[9px]"> 
                          <thead className="bg-gray font-bold">
                              <tr>
                                  <th rowSpan={2} className="w-6">NO</th>
                                  <th rowSpan={2} className="w-24">ASRAMA</th>
                                  <th colSpan={37}>RINCIAN PENGHUNI KAMAR (NOMOR KAMAR)</th>
                                  <th rowSpan={2} className="w-10">JML</th>
                                  <th colSpan={2}>MUTASI</th>
                              </tr>
                              <tr>
                                  {ROOM_NUMBERS.map(num => (
                                      <th key={num} className="w-4">{num}</th>
                                  ))}
                                  <th className="w-8">MSK</th>
                                  <th className="w-8">KLR</th>
                              </tr>
                          </thead>
                          <tbody>
                              {ASRAMA_LIST.map((asrama, idx) => {
                                  const info = reportData.asrama[asrama]
                                  return (
                                      <tr key={asrama}>
                                          <td>{idx + 1}</td>
                                          <td className="text-left font-bold pl-1">{asrama}</td>
                                          {ROOM_NUMBERS.map(num => (
                                              <td key={num} className={info.kamar[num] ? 'font-bold' : 'text-slate-300'}>
                                                  {fmt(info.kamar[num])}
                                              </td>
                                          ))}
                                          <td className="font-bold bg-slate-100">{info.total}</td>
                                          <td>{fmt(info.masuk)}</td>
                                          <td>{fmt(info.keluar)}</td>
                                      </tr>
                                  )
                              })}
                              <tr className="bg-gray font-bold">
                                  <td colSpan={2} className="text-right pr-2">TOTAL</td>
                                  <td colSpan={37} className="bg-slate-200"></td> 
                                  <td>{reportData.total_santri}</td>
                                  <td>{reportData.mutasi.filter(m => m.tipe === 'MASUK').length}</td>
                                  <td>{reportData.mutasi.filter(m => m.tipe === 'KELUAR').length}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>

                  {/* 2.2 TABEL SEKOLAH */}
                  <div>
                      <h3 className="text-xs font-bold mb-1 uppercase text-left">B. Data Tingkat Satuan Sekolah</h3>
                      <table className="text-[9px]">
                          <thead className="bg-gray font-bold">
                              <tr>
                                  <th rowSpan={3} className="w-6">NO</th>
                                  <th rowSpan={3} className="w-20">ASRAMA</th>
                                  <th colSpan={22} className="text-center">JENJANG PENDIDIKAN DAN KELAS</th>
                              </tr>
                              <tr>
                                  <th rowSpan={2} className="w-8">MI</th>
                                  <th colSpan={3}>MTs. WAHAB MUHSIN</th>
                                  <th colSpan={3}>MTsN 1 TASIKMALAYA</th>
                                  <th colSpan={3}>SMP KHZ. MUSHTHAFA</th>
                                  <th colSpan={3}>SMK WAHAB MUHSIN</th>
                                  <th colSpan={3}>MAN 1 TASIKMALAYA</th>
                                  <th colSpan={3}>SMA KHZ. MUSHTHAFA</th>
                                  <th rowSpan={2} className="w-8">SADESA</th>
                                  <th rowSpan={2} className="w-10">JML</th>
                              </tr>
                              <tr>
                                  <th className="w-6">7</th><th className="w-6">8</th><th className="w-6">9</th>
                                  <th className="w-6">7</th><th className="w-6">8</th><th className="w-6">9</th>
                                  <th className="w-6">7</th><th className="w-6">8</th><th className="w-6">9</th>
                                  <th className="w-6">10</th><th className="w-6">11</th><th className="w-6">12</th>
                                  <th className="w-6">10</th><th className="w-6">11</th><th className="w-6">12</th>
                                  <th className="w-6">10</th><th className="w-6">11</th><th className="w-6">12</th>
                              </tr>
                          </thead>
                          <tbody>
                              {ASRAMA_LIST.map((asrama, idx) => {
                                  const s = reportData.sekolah[asrama]
                                  return (
                                      <tr key={asrama}>
                                          <td>{idx+1}</td>
                                          <td className="text-left pl-1 font-bold">{asrama}</td>
                                          <td>{fmt(s.MI)}</td>
                                          <td>{fmt(s.MTS[7])}</td><td>{fmt(s.MTS[8])}</td><td>{fmt(s.MTS[9])}</td>
                                          <td>{fmt(s.MTSN[7])}</td><td>{fmt(s.MTSN[8])}</td><td>{fmt(s.MTSN[9])}</td>
                                          <td>{fmt(s.SMP[7])}</td><td>{fmt(s.SMP[8])}</td><td>{fmt(s.SMP[9])}</td>
                                          <td>{fmt(s.SMK[10])}</td><td>{fmt(s.SMK[11])}</td><td>{fmt(s.SMK[12])}</td>
                                          <td>{fmt(s.MA[10])}</td><td>{fmt(s.MA[11])}</td><td>{fmt(s.MA[12])}</td>
                                          <td>{fmt(s.SMA[10])}</td><td>{fmt(s.SMA[11])}</td><td>{fmt(s.SMA[12])}</td>
                                          <td>{fmt(s.SADESA)}</td>
                                          <td className="font-bold bg-slate-100">{s.TOTAL}</td>
                                      </tr>
                                  )
                              })}
                              <tr className="bg-gray font-bold">
                                  <td colSpan={2} className="text-right pr-2">TOTAL</td>
                                  <td>{getTotalSekolah('MI')}</td>
                                  <td>{getTotalSekolah('MTS', 7)}</td><td>{getTotalSekolah('MTS', 8)}</td><td>{getTotalSekolah('MTS', 9)}</td>
                                  <td>{getTotalSekolah('MTSN', 7)}</td><td>{getTotalSekolah('MTSN', 8)}</td><td>{getTotalSekolah('MTSN', 9)}</td>
                                  <td>{getTotalSekolah('SMP', 7)}</td><td>{getTotalSekolah('SMP', 8)}</td><td>{getTotalSekolah('SMP', 9)}</td>
                                  <td>{getTotalSekolah('SMK', 10)}</td><td>{getTotalSekolah('SMK', 11)}</td><td>{getTotalSekolah('SMK', 12)}</td>
                                  <td>{getTotalSekolah('MA', 10)}</td><td>{getTotalSekolah('MA', 11)}</td><td>{getTotalSekolah('MA', 12)}</td>
                                  <td>{getTotalSekolah('SMA', 10)}</td><td>{getTotalSekolah('SMA', 11)}</td><td>{getTotalSekolah('SMA', 12)}</td>
                                  <td>{getTotalSekolah('SADESA')}</td>
                                  <td className="bg-slate-200">{reportData.total_santri}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* === HALAMAN 3: MUTASI & TTD === */}
              <div className="print-page">
                  <div className="text-center font-bold mb-2 uppercase border-b-2 border-black pb-1 text-sm">
                      DATA SANTRI {tahun} REKAPITULASI MUTASI (KELUAR-MASUK)<br/>
                      BULAN {bulanNama} TAHUN AJARAN {tahunAjaran}
                  </div>

                  <table>
                      <thead className="bg-gray font-bold">
                          <tr>
                              <th className="w-8">NO</th>
                              <th>NAMA SANTRI</th>
                              <th className="w-24">ASRAMA</th>
                              <th className="w-32">SEKOLAH/KELAS</th>
                              <th>ALAMAT</th>
                              <th className="w-20">STATUS</th>
                              <th>KETERANGAN</th>
                              <th className="w-24">TANGGAL</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reportData.mutasi.length === 0 ? (
                              <>
                                <tr><td colSpan={8} className="py-10 text-center italic font-bold">NIHIL</td></tr>
                                {Array.from({length: 5}).map((_, i) => (
                                    <tr key={i}><td className="py-4"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                                ))}
                              </>
                          ) : reportData.mutasi.map((m, idx) => (
                              <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td className="text-left pl-2 font-bold">{m.nama_lengkap}</td>
                                  <td>{m.asrama} - {m.kamar}</td>
                                  <td>{m.sekolah} - {m.kelas_sekolah}</td>
                                  <td className="text-left pl-2 text-[9px]">{m.alamat || '-'}</td>
                                  <td className={`font-bold ${m.tipe === 'MASUK' ? 'text-green-700' : 'text-red-700'}`}>{m.tipe}</td>
                                  <td className="text-left pl-2">{m.ket}</td>
                                  <td>{format(new Date(m.tgl), 'dd/MM/yyyy')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  
                  {/* TANDA TANGAN (HANYA DI HALAMAN TERAKHIR) */}
                  <FooterTtd />
              </div>

            </div>
          </div>
      )}
    </div>
  )
}
