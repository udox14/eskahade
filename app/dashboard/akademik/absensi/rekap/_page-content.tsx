'use client'

import { useState, useEffect, useRef } from 'react'
import { getUserScope, getRekapAbsensi, getDetailAbsensiSantri, getReferensiFilter } from './actions'
import { Search, Filter, Loader2, Home, BookOpen, X, Calendar, Printer, Palette, Circle } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

type PrintMode = 'colorful' | 'bw'
type PrintStatus = 'hadir' | 'alfa' | 'sakit' | 'izin'

const PRINT_STATUS_OPTIONS: { key: PrintStatus; label: string; field: string }[] = [
  { key: 'hadir', label: 'Hadir', field: 'total_h' },
  { key: 'alfa', label: 'Alfa', field: 'total_a' },
  { key: 'sakit', label: 'Sakit', field: 'total_s' },
  { key: 'izin', label: 'Izin', field: 'total_i' },
]

export default function RekapAbsensiPage() {
  const [scope, setScope] = useState<any>(null)
  const [filterAsrama, setFilterAsrama] = useState('')
  const [filterKamar, setFilterKamar] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [searchName, setSearchName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [printMode, setPrintMode] = useState<PrintMode>('colorful')
  const [printStatuses, setPrintStatuses] = useState<Record<PrintStatus, boolean>>({
    hadir: true,
    alfa: true,
    sakit: true,
    izin: false,
  })

  const [refKelas, setRefKelas] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [hasSearched, setHasSearched] = useState(false)

  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detailAbsen, setDetailAbsen] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Rekap Absensi Santri ${startDate} sd ${endDate}`,
  })

  useEffect(() => {
    async function init() {
      const now = new Date()
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))

      const s = await getUserScope()
      setScope(s)

      if (s.type === 'ASRAMA') setFilterAsrama(s.value ?? '')
      if (s.type === 'KELAS') setFilterKelas(s.value ?? '')

      const ref = await getReferensiFilter()
      setRefKelas(ref.kelas)
    }
    init()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getRekapAbsensi(searchName, filterAsrama, filterKelas, filterKamar, startDate, endDate)
    setData(res)
    setLoading(false)
  }

  const handleViewDetail = async (santri: any) => {
    setSelectedSantri(santri)
    setLoadingDetail(true)
    const res = await getDetailAbsensiSantri(santri.id, startDate, endDate)
    setDetailAbsen(res)
    setLoadingDetail(false)
  }

  const closeDetail = () => {
    setSelectedSantri(null)
    setDetailAbsen([])
  }

  const setRange = (type: 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date()
    if (type === 'THIS_MONTH') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'))
      setEndDate(format(now, 'yyyy-MM-dd'))
    }
  }

  const fmtDate = (d: string) => {
    if (!d) return ''
    try { return format(new Date(d), 'd MMMM yyyy', { locale: localeId }) }
    catch { return d }
  }

  const selectedKelasName = filterKelas
    ? refKelas.find((k: any) => String(k.id) === String(filterKelas))?.nama_kelas || ''
    : 'Semua Kelas'

  const isBW = printMode === 'bw'
  const S = {
    headerBg: isBW ? '#000000' : '#1e1b4b',
    headerBorder: isBW ? '#000000' : '#312e81',
    stripeBg: isBW ? '#ffffff' : '#f8f7ff',
    titleColor: isBW ? '#000000' : '#1e1b4b',
    subColor: isBW ? '#000000' : '#374151',
    metaColor: isBW ? '#000000' : '#6b7280',
    borderColor: isBW ? '#000000' : '#e5e7eb',
    hadirBg: isBW ? '#ffffff' : '#f0fdf4',
    hadirColor: isBW ? '#000000' : '#16a34a',
    alfaBg: isBW ? '#ffffff' : '#fef2f2',
    alfaColor: isBW ? '#000000' : '#dc2626',
    sakitBg: isBW ? '#ffffff' : '#fffbeb',
    sakitColor: isBW ? '#000000' : '#d97706',
    izinBg: isBW ? '#ffffff' : '#eff6ff',
    izinColor: isBW ? '#000000' : '#2563eb',
  }

  const canPrint = hasSearched && !loading && data.length > 0
  const selectedPrintStatuses = PRINT_STATUS_OPTIONS.filter(option => printStatuses[option.key])
  const printableData = data.filter(row =>
    selectedPrintStatuses.some(option => Number(row[option.field] || 0) > 0)
  )
  const canPrintSelected = canPrint && selectedPrintStatuses.length > 0 && printableData.length > 0

  const togglePrintStatus = (status: PrintStatus) => {
    setPrintStatuses(current => ({
      ...current,
      [status]: !current[status],
    }))
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Filter className="w-6 h-6 text-blue-600" /> Rekapitulasi Kehadiran
          </h1>
          <p className="text-slate-500 text-sm">Monitoring kedisiplinan pengajian santri.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRange('THIS_WEEK')} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">7 Hari Terakhir</button>
          <button onClick={() => setRange('THIS_MONTH')} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">Bulan Ini</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dari</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sampai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/5">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Asrama</label>
            <select
              value={filterAsrama}
              onChange={(e) => {
                setFilterAsrama(e.target.value)
                setFilterKamar('')
              }}
              disabled={scope?.type === 'ASRAMA'}
              className={`w-full p-2 border border-slate-200 rounded-xl text-sm outline-none ${scope?.type === 'ASRAMA' ? 'bg-slate-100 text-slate-500' : 'bg-white focus:ring-2 focus:ring-blue-500'}`}
            >
              <option value="">Semua Asrama</option>
              {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="w-full md:w-1/6">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kamar</label>
            <select
              value={filterKamar}
              onChange={(e) => setFilterKamar(e.target.value)}
              disabled={!filterAsrama}
              className="w-full p-2 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">Semua</option>
              {Array.from({ length: 50 }, (_, i) => i + 1).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-1/5">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Kelas</label>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              disabled={scope?.type === 'KELAS'}
              className={`w-full p-2 border border-slate-200 rounded-xl text-sm outline-none ${scope?.type === 'KELAS' ? 'bg-slate-100 text-slate-500' : 'bg-white focus:ring-2 focus:ring-blue-500'}`}
            >
              <option value="">Semua Kelas</option>
              {refKelas.map((k: any) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>

          <div className="w-full md:flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nama Santri..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition-colors h-[38px] disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tampilkan"}
          </button>
        </div>

        {canPrint && (
          <div className="flex flex-col gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              <b>{data.length}</b> santri siap dicetak untuk periode <b>{fmtDate(startDate)}</b> sampai <b>{fmtDate(endDate)}</b>.
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center bg-white rounded-lg p-1 gap-1 border border-slate-200">
                {PRINT_STATUS_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => togglePrintStatus(option.key)}
                    title={`Cetak ${option.label}`}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printStatuses[option.key] ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-white rounded-lg p-1 gap-1 border border-slate-200">
                <button
                  onClick={() => setPrintMode('colorful')}
                  title="Cetak Berwarna"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'colorful' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Palette className="w-3.5 h-3.5" /> Berwarna
                </button>
                <button
                  onClick={() => setPrintMode('bw')}
                  title="Cetak Hitam Putih"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'bw' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Circle className="w-3.5 h-3.5" /> Hitam Putih
                </button>
              </div>
              <button
                onClick={() => handlePrint()}
                disabled={!canPrintSelected}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                <Printer className="w-4 h-4" /> Cetak / PDF
              </button>
            </div>
            {!canPrintSelected && (
              <p className="text-xs font-medium text-red-500 md:text-right">Pilih minimal satu status yang punya data untuk dicetak.</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full py-32 text-slate-400">
            <Search className="w-16 h-16 mb-4 text-slate-200" />
            <p className="text-lg font-medium text-slate-500">Siap Menampilkan Data</p>
            <p className="text-sm">Silakan pilih filter dan klik tombol <b>Tampilkan</b>.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-32"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-32 text-slate-400">Tidak ada data ditemukan sesuai filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="px-6 py-3">Nama Santri</th>
                  <th className="px-6 py-3">Kelas / Asrama</th>
                  <th className="px-6 py-3 text-center text-green-600">Hadir</th>
                  <th className="px-6 py-3 text-center text-red-600">Alfa</th>
                  <th className="px-6 py-3 text-center text-yellow-600">Sakit</th>
                  <th className="px-6 py-3 text-center text-blue-600">Izin</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3 font-medium text-slate-800">{row.nama} <br /><span className="text-[10px] text-slate-400 font-mono">{row.nis}</span></td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {row.info_kelas}</div>
                      <div className="flex items-center gap-1 mt-1"><Home className="w-3 h-3" /> {row.info_asrama}</div>
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-green-600">{row.total_h || '-'}</td>
                    <td className="px-6 py-3 text-center font-bold text-red-600 bg-red-50/50">{row.total_a || '-'}</td>
                    <td className="px-6 py-3 text-center font-medium text-yellow-600">{row.total_s || '-'}</td>
                    <td className="px-6 py-3 text-center font-medium text-blue-600">{row.total_i || '-'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleViewDetail(row)}
                        className="text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-100 hover:text-blue-600 transition-colors"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSantri && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{selectedSantri.nama}</h3>
                <p className="text-xs text-slate-500">{selectedSantri.info_kelas} - {selectedSantri.info_asrama}</p>
              </div>
              <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-0 overflow-y-auto flex-1">
              {loadingDetail ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
              ) : detailAbsen.length === 0 ? (
                <div className="py-10 text-center text-slate-400 italic">Tidak ada catatan ketidakhadiran. Rajin!</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="px-5 py-2">Tanggal</th>
                      <th className="px-5 py-2 text-center">Shubuh</th>
                      <th className="px-5 py-2 text-center">Ashar</th>
                      <th className="px-5 py-2 text-center">Maghrib</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detailAbsen.map((d: any) => (
                      <tr key={`${d.tanggal}-${d.shubuh}-${d.ashar}-${d.maghrib}`}>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(d.tanggal), 'dd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="px-5 py-3 text-center"><BadgeStatus status={d.shubuh} /></td>
                        <td className="px-5 py-3 text-center"><BadgeStatus status={d.ashar} /></td>
                        <td className="px-5 py-3 text-center"><BadgeStatus status={d.maghrib} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 text-right">
              <button onClick={closeDetail} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={printRef}>
          <style>{`
            @page { size: F4 portrait; margin: 10mm 8mm 10mm 8mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}</style>
          <PrintRekapSantri
            data={printableData}
            selectedStatuses={selectedPrintStatuses}
            fmtDate={fmtDate}
            startDate={startDate}
            endDate={endDate}
            filterAsrama={filterAsrama || 'Semua Asrama'}
            filterKamar={filterKamar || 'Semua Kamar'}
            filterKelas={selectedKelasName}
            searchName={searchName}
            S={S}
          />
        </div>
      </div>
    </div>
  )
}

function BadgeStatus({ status }: { status: string }) {
  if (status === 'A') return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">A</span>
  if (status === 'S') return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">S</span>
  if (status === 'I') return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">I</span>
  return <span className="text-slate-300">-</span>
}

function PrintRekapSantri({ data, selectedStatuses, fmtDate, startDate, endDate, filterAsrama, filterKamar, filterKelas, searchName, S }: any) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
      <PrintHeader
        title="REKAP ABSENSI SANTRI"
        subtitle={`${fmtDate(startDate)} - ${fmtDate(endDate)}`}
        meta={`Asrama: ${filterAsrama} | Kamar: ${filterKamar} | Kelas: ${filterKelas}${searchName ? ` | Cari: ${searchName}` : ''}`}
        S={S}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: S.headerBg, color: '#ffffff' }}>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '24px', border: `1px solid ${S.headerBorder}` }}>No</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', border: `1px solid ${S.headerBorder}` }}>Nama Santri</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', width: '145px', border: `1px solid ${S.headerBorder}` }}>Asrama / Kamar</th>
            {selectedStatuses.map((option: any) => (
              <th key={option.key} style={{ padding: '5px 4px', textAlign: 'center', width: '56px', border: `1px solid ${S.headerBorder}`, backgroundColor: S.headerBg }}>{option.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, idx: number) => (
            <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : S.stripeBg }}>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, color: S.metaColor }}>{idx + 1}</td>
              <td style={{ padding: '4px 6px', fontWeight: 'bold', border: `1px solid ${S.borderColor}` }}>{row.nama}</td>
              <td style={{ padding: '4px 6px', color: S.metaColor, fontSize: '9px', border: `1px solid ${S.borderColor}` }}>{row.info_asrama}</td>
              {selectedStatuses.map((option: any) => {
                const styleKey = option.key === 'izin' ? 'izin' : option.key
                const bg = S[`${styleKey}Bg`] || '#ffffff'
                const color = S[`${styleKey}Color`] || '#000000'
                return (
                  <td key={option.key} style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: bg }}><b style={{ color }}>{row[option.field] || '-'}</b></td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <PrintFooter total={`Total: ${data.length} santri`} S={S} />
    </div>
  )
}

function PrintHeader({ title, subtitle, meta, S }: any) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: `2px solid ${S.headerBg}`, paddingBottom: '8px' }}>
      <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: S.titleColor }}>{title}</div>
      <div style={{ fontSize: '11px', marginTop: '3px', color: S.subColor }}>{subtitle}</div>
      <div style={{ fontSize: '10px', marginTop: '2px', color: S.metaColor }}>{meta}</div>
    </div>
  )
}

function PrintFooter({ total, S }: any) {
  return (
    <div style={{ marginTop: '10px', fontSize: '9px', color: S.metaColor, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${S.borderColor}`, paddingTop: '6px' }}>
      <span>{total}</span>
      <span>Dicetak: {format(new Date(), 'd MMMM yyyy HH:mm', { locale: localeId })}</span>
    </div>
  )
}
