'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, Filter, Loader2, MapPinned, Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getRuanganListForCetak,
  getTempelanRuanganData,
  getTempelanRuanganSemuaData,
  type ActiveEvent,
  type RuanganOption,
  type TempelanRuanganItem,
} from './actions'
import { FONT, PageHeader } from './_shared'

type ClassCount = {
  kelas: string
  jumlah: number
}

type JamSummary = {
  jamGroup: string
  kelas: ClassCount[]
  total: number
}

function naturalJamCompare(a: string, b: string) {
  return a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' })
}

function buildJamSummary(data: TempelanRuanganItem[]): JamSummary[] {
  const groups = new Map<string, Map<string, number>>()

  data.forEach(item => {
    const jamMap = groups.get(item.jam_group) ?? new Map<string, number>()
    const kelas = item.nama_kelas ?? '-'
    jamMap.set(kelas, (jamMap.get(kelas) ?? 0) + 1)
    groups.set(item.jam_group, jamMap)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => naturalJamCompare(a, b))
    .map(([jamGroup, kelasMap]) => {
      const kelas = Array.from(kelasMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' }))
        .map(([nama, jumlah]) => ({ kelas: nama, jumlah }))

      return {
        jamGroup,
        kelas,
        total: kelas.reduce((sum, item) => sum + item.jumlah, 0),
      }
    })
}

function getSeatNumbers(data: TempelanRuanganItem[]) {
  return Array.from(new Map(data.map(item => [item.nomor_kursi, item.nomor_peserta])).entries())
    .sort(([a], [b]) => a - b)
}

function formatRoomNumber(roomNumber: number) {
  return String(roomNumber).padStart(2, '0')
}

function TempelanPrint({ data }: { data: TempelanRuanganItem[] }) {
  const first = data[0]
  const jamSummary = buildJamSummary(data)
  const seatMap = new Map(getSeatNumbers(data))
  const maxSeat = Math.max(0, ...Array.from(seatMap.keys()))
  const capacity = first?.kapasitas && first.kapasitas > 0 ? first.kapasitas : Math.max(maxSeat, 40)
  const columns = 8
  const rows = Math.max(1, Math.ceil(capacity / columns))
  const semesterLabel = first?.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = first?.tahun_ajaran_nama.replace('/', '-') ?? ''
  const roomNumber = first?.nomor_ruangan ?? 0
  const summaryRows = Math.max(3, ...jamSummary.map(jam => jam.kelas.length + 1))

  return (
    <div style={{
      width: '330mm',
      height: '210mm',
      padding: '7mm 12mm 8mm 12mm',
      boxSizing: 'border-box',
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: '#000',
      overflow: 'hidden',
      breakAfter: 'page',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5mm',
        height: '39mm',
        flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logohitam.png"
          alt=""
          style={{ width: '36mm', height: '36mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', width: '154mm' }}>
          <div style={{ fontSize: '27pt', fontWeight: 900, lineHeight: 0.95, letterSpacing: '0' }}>
            EVALUASI HASIL BELAJAR
          </div>
          <div style={{ fontSize: '25pt', lineHeight: 0.95, letterSpacing: '0' }}>
            {semesterLabel} T.A. {tahunAjaran}
          </div>
          <div style={{ fontSize: '14pt', lineHeight: 1.1, marginTop: '2mm' }}>
            LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
          </div>
          <div style={{ borderBottom: '1.2pt solid #000', marginTop: '2mm', width: '100%' }} />
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '102mm 1fr',
        gap: '8mm',
        minHeight: 0,
        paddingTop: '5mm',
      }}>
        <div style={{
          border: '3pt solid #000',
          height: '137mm',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}>
          <div style={{
            height: '33mm',
            backgroundColor: '#000',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '42pt',
            fontWeight: 900,
            letterSpacing: '1pt',
          }}>
            RUANGAN
          </div>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '230pt',
            fontWeight: 900,
            lineHeight: 0.8,
            letterSpacing: '-8pt',
            paddingBottom: '8mm',
          }}>
            {roomNumber}
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '7mm',
          minWidth: 0,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, jamSummary.length)}, 1fr)`,
            border: '1pt solid #000',
          }}>
            {jamSummary.map(summary => (
              <div key={summary.jamGroup} style={{ borderLeft: '1pt solid #000', marginLeft: '-1pt' }}>
                <div style={{
                  height: '9mm',
                  backgroundColor: '#000',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '18pt',
                  fontWeight: 900,
                }}>
                  {summary.jamGroup.toUpperCase()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 22mm' }}>
                  <div style={summaryThStyle}>Kelas</div>
                  <div style={summaryThStyle}>Jml</div>
                  {Array.from({ length: summaryRows }).map((_, idx) => {
                    const row = summary.kelas[idx]
                    const isTotal = idx === summaryRows - 1
                    return (
                      <div key={`${summary.jamGroup}-${idx}`} style={{ display: 'contents' }}>
                        <div style={{
                          ...summaryTdStyle,
                          fontWeight: isTotal ? 900 : 400,
                          textAlign: isTotal ? 'center' : 'left',
                          paddingLeft: isTotal ? '1mm' : '2mm',
                        }}>
                          {isTotal ? 'Total' : row?.kelas ?? ''}
                        </div>
                        <div style={{ ...summaryTdStyle, textAlign: 'center', fontWeight: isTotal ? 900 : 400 }}>
                          {isTotal ? summary.total : row?.jumlah ?? ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            height: '79mm',
            borderTop: '1.5pt solid #0b5a83',
            borderLeft: '1.5pt solid #0b5a83',
          }}>
            {Array.from({ length: rows * columns }).map((_, index) => {
              const row = Math.floor(index / columns)
              const col = index % columns
              const seatNumber = row % 2 === 0
                ? row * columns + col + 1
                : row * columns + (columns - col)
              const nomorPeserta = seatMap.get(seatNumber)

              return (
                <div key={index} style={{
                  borderRight: '1.5pt solid #0b5a83',
                  borderBottom: '1.5pt solid #0b5a83',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '6mm',
                  boxSizing: 'border-box',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '13pt',
                  fontWeight: 900,
                }}>
                  {nomorPeserta ?? ''}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const summaryThStyle: React.CSSProperties = {
  borderRight: '1pt solid #000',
  borderBottom: '1pt solid #000',
  height: '8mm',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '15pt',
  fontWeight: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const summaryTdStyle: React.CSSProperties = {
  borderRight: '1pt solid #000',
  borderBottom: '1pt solid #000',
  height: '8mm',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '14pt',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

function TempelanPreview({ data }: { data: TempelanRuanganItem[] }) {
  return (
    <div className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.35 }}>
      <TempelanPrint data={data} />
    </div>
  )
}

export function TempelanRuanganView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([])
  const [selectedRuangan, setSelectedRuangan] = useState<number | ''>('')
  const [tempelanData, setTempelanData] = useState<TempelanRuanganItem[]>([])
  const [bulkData, setBulkData] = useState<TempelanRuanganItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Tempelan Ruangan EHB',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  const bulkPrintRef = useRef<HTMLDivElement>(null)
  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Semua Tempelan Ruangan EHB',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      if (evt) {
        const rooms = await getRuanganListForCetak(evt.id)
        setRuanganList(rooms)
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const bulkRooms = useMemo(() => {
    const grouped = new Map<number, TempelanRuanganItem[]>()
    bulkData.forEach(item => {
      const room = grouped.get(item.ruangan_id) ?? []
      room.push(item)
      grouped.set(item.ruangan_id, room)
    })
    return Array.from(grouped.values()).sort((a, b) => a[0].nomor_ruangan - b[0].nomor_ruangan)
  }, [bulkData])

  const handleMuatPreview = async () => {
    if (!event) return
    if (!selectedRuangan) return toast.error('Pilih ruangan terlebih dahulu')

    setLoadingData(true)
    setHasLoaded(false)
    const data = await getTempelanRuanganData(event.id, selectedRuangan as number)
    setTempelanData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data peserta untuk ruangan ini')
  }

  const handleCetakSemua = async () => {
    if (!event) return
    setLoadingBulk(true)
    try {
      const data = await getTempelanRuanganSemuaData(event.id)
      if (data.length === 0) {
        toast.error('Tidak ada data tempelan ruangan')
        setLoadingBulk(false)
        return
      }
      setBulkData(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 800)
    } catch {
      toast.error('Gagal memuat data tempelan')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Ruangan" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  const selectedRoomNumber = tempelanData[0]?.nomor_ruangan

  return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Ruangan" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Filter Ruangan</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Ruangan</label>
            <select
              value={selectedRuangan}
              onChange={e => {
                setSelectedRuangan(e.target.value ? Number(e.target.value) : '')
                setHasLoaded(false)
                setTempelanData([])
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Ruangan --</option>
              {ruanganList.map(r => (
                <option key={r.id} value={r.id}>
                  Ruangan {formatRoomNumber(r.nomor_ruangan)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleMuatPreview}
              disabled={loadingData || loadingBulk}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]"
            >
              {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPinned className="w-4 h-4" />} Muat Preview
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCetakSemua}
              disabled={loadingBulk || loadingData}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]"
            >
              {loadingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Cetak Semua
            </button>
          </div>
        </div>
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{tempelanData.length}</span> peserta ditemukan
              {selectedRoomNumber && <span className="text-slate-400 ml-2">· Ruangan {formatRoomNumber(selectedRoomNumber)} · 1 lembar F4 Landscape</span>}
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={tempelanData.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Ruangan Ini
            </button>
          </div>

          {tempelanData.length > 0 && (
            <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[800px]">
              <TempelanPreview data={tempelanData} />
            </div>
          )}

          <div className="hidden">
            <div ref={printRef}>
              {tempelanData.length > 0 && <TempelanPrint data={tempelanData} />}
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={bulkPrintRef}>
          {bulkRooms.map(room => (
            <TempelanPrint key={room[0].ruangan_id} data={room} />
          ))}
        </div>
      </div>
    </div>
  )
}
