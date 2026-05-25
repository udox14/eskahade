'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, ClipboardList, Loader2, Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getSensusRuanganData,
  type ActiveEvent,
  type SensusRuanganItem,
} from './actions'
import { FONT, PageHeader } from './_shared'
import { formatTempelanClassName } from './_view-tempelan-humas-packing'

type RoomSummary = {
  ruanganId: number
  nomorRuangan: number
  kapasitas: number
  rows: { kelas: string; jumlah: number }[]
  total: number
}

type JamPage = {
  jamGroup: string
  semester: number
  tahunAjaranNama: string
  rooms: RoomSummary[]
  total: number
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' })
}

function buildJamPages(rows: SensusRuanganItem[]): JamPage[] {
  const grouped = new Map<string, JamPage>()

  rows.forEach(row => {
    const page = grouped.get(row.jam_group) ?? {
      jamGroup: row.jam_group,
      semester: row.semester,
      tahunAjaranNama: row.tahun_ajaran_nama,
      rooms: [],
      total: 0,
    }

    let room = page.rooms.find(item => item.ruanganId === row.ruangan_id)
    if (!room) {
      room = {
        ruanganId: row.ruangan_id,
        nomorRuangan: row.nomor_ruangan,
        kapasitas: Number(row.kapasitas || 0),
        rows: [],
        total: 0,
      }
      page.rooms.push(room)
    }

    const jumlah = Number(row.jumlah || 0)
    room.rows.push({
      kelas: formatTempelanClassName(row.nama_kelas, row.marhalah_nama),
      jumlah,
    })
    room.total += jumlah
    page.total += jumlah
    grouped.set(row.jam_group, page)
  })

  return Array.from(grouped.values())
    .sort((a, b) => naturalCompare(a.jamGroup, b.jamGroup))
    .map(page => ({
      ...page,
      rooms: page.rooms
        .sort((a, b) => a.nomorRuangan - b.nomorRuangan)
        .map(room => ({
          ...room,
          rows: room.rows.sort((a, b) => naturalCompare(a.kelas, b.kelas)),
        })),
    }))
}

function SensusRoomCard({ room }: { room: RoomSummary }) {
  const emptyRows = Math.max(0, 4 - room.rows.length)

  return (
    <table style={roomTableStyle}>
      <colgroup>
        <col style={{ width: '72%' }} />
        <col style={{ width: '28%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={roomHeadStyle}>{room.nomorRuangan}</th>
          <th style={roomHeadStyle}>{room.kapasitas || room.total}</th>
        </tr>
      </thead>
      <tbody>
        {room.rows.map((row, index) => (
          <tr key={`${row.kelas}-${index}`}>
            <td style={roomCellStyle}>{row.kelas}</td>
            <td style={{ ...roomCellStyle, textAlign: 'right', paddingRight: '1.4mm' }}>{row.jumlah}</td>
          </tr>
        ))}
        {Array.from({ length: emptyRows }).map((_, index) => (
          <tr key={`empty-${index}`}>
            <td style={roomCellStyle}>&nbsp;</td>
            <td style={roomCellStyle}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SensusJamPrintPage({ page }: { page: JamPage }) {
  const semesterLabel = page.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'

  return (
    <div style={{
      width: '216mm',
      height: '330mm',
      padding: '5mm 9mm 7mm',
      boxSizing: 'border-box',
      backgroundColor: '#fff',
      color: '#000',
      fontFamily: FONT,
      overflow: 'hidden',
      breakAfter: 'page',
    }}>
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        marginBottom: '3mm',
      }}>
        <div style={{ fontSize: '11pt', fontWeight: 800, lineHeight: 1.05 }}>
          SENSUS PESERTA PER RUANGAN
        </div>
        <div style={{ fontSize: '8pt', lineHeight: 1.15, marginTop: '0.8mm' }}>
          EHB {semesterLabel} T.A. {page.tahunAjaranNama.replace('/', '-')} - {page.jamGroup.toUpperCase()}
        </div>
        <div style={{ fontSize: '7pt', lineHeight: 1.1, marginTop: '0.8mm' }}>
          {page.rooms.length} ruangan - {page.total} peserta
        </div>
      </div>

      <div style={{
        columnCount: 3,
        columnGap: '10mm',
        columnFill: 'auto',
        height: '309mm',
      }}>
        {page.rooms.map(room => (
          <div key={room.ruanganId} style={{
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
            marginBottom: '2.2mm',
          }}>
            <SensusRoomCard room={room} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SensusPreview({ pages }: { pages: JamPage[] }) {
  return (
    <div className="bg-white shadow-2xl flex-shrink-0" style={{ zoom: 0.43 }}>
      {pages.map(page => <SensusJamPrintPage key={page.jamGroup} page={page} />)}
    </div>
  )
}

const roomTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '7.8pt',
  color: '#000',
}

const roomHeadStyle: React.CSSProperties = {
  border: '0.75pt solid #000',
  height: '4.9mm',
  padding: '0 1mm',
  fontSize: '8pt',
  fontWeight: 800,
  textAlign: 'center',
  verticalAlign: 'middle',
}

const roomCellStyle: React.CSSProperties = {
  border: '0.75pt solid #000',
  height: '4.65mm',
  padding: '0 1mm',
  fontSize: '7.8pt',
  fontWeight: 400,
  lineHeight: 1,
  textAlign: 'center',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

const f4PortraitPageStyle = `
  @page { size: 216mm 330mm; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { box-sizing: border-box; }
  }
`

export function SensusRuanganView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [rows, setRows] = useState<SensusRuanganItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Sensus Ruangan EHB',
    pageStyle: f4PortraitPageStyle,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      setLoadingInit(false)
    }
    init()
  }, [])

  const pages = useMemo(() => buildJamPages(rows), [rows])

  const handleMuatPreview = async () => {
    if (!event) return
    setLoadingData(true)
    setHasLoaded(false)
    try {
      const data = await getSensusRuanganData(event.id)
      setRows(data)
      setHasLoaded(true)
      if (data.length === 0) toast.error('Tidak ada data sensus ruangan')
    } catch {
      toast.error('Gagal memuat data sensus ruangan')
    } finally {
      setLoadingData(false)
    }
  }

  const handleCetakSemua = async () => {
    if (!event) return
    setLoadingData(true)
    try {
      const data = await getSensusRuanganData(event.id)
      if (data.length === 0) {
        toast.error('Tidak ada data sensus ruangan')
        setLoadingData(false)
        return
      }
      setRows(data)
      setHasLoaded(true)
      setTimeout(() => {
        handlePrint()
        setLoadingData(false)
      }, 800)
    } catch {
      toast.error('Gagal memuat data sensus ruangan')
      setLoadingData(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Sensus Ruangan" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Sensus Ruangan" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Format Sensus Per Jam</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Muat Preview
          </button>

          <button
            onClick={handleCetakSemua}
            disabled={loadingData}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Cetak Semua Jam
          </button>
        </div>
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{pages.length}</span> halaman siap
              <span className="text-slate-400 ml-2">- 1 halaman untuk 1 jam - F4 Portrait</span>
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={pages.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Preview
            </button>
          </div>

          {pages.length > 0 && (
            <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[820px]">
              <SensusPreview pages={pages} />
            </div>
          )}
        </div>
      )}

      <div className="hidden">
        <div ref={printRef}>
          {pages.map(page => <SensusJamPrintPage key={page.jamGroup} page={page} />)}
        </div>
      </div>
    </div>
  )
}
