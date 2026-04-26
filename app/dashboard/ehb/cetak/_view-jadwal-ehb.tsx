'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { AlertTriangle, Calendar, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getJadwalEhbCetakData,
  type ActiveEvent,
  type JadwalEhbCetakItem,
  type JadwalEhbCetakKelas,
  type JadwalEhbCetakPanitia,
  type JadwalEhbCetakSesi,
} from './actions'
import { FONT, PageHeader } from './_shared'
import { dayNameWib, getDatesBetweenWib, shortDateWib } from '../_date-utils'

type JadwalEhbEvent = ActiveEvent & {
  tanggal_mulai: string | null
  tanggal_selesai: string | null
}

type JadwalEhbCetakData = {
  event: JadwalEhbEvent | null
  sesiList: JadwalEhbCetakSesi[]
  kelasList: JadwalEhbCetakKelas[]
  jadwal: JadwalEhbCetakItem[]
  panitia: JadwalEhbCetakPanitia
}

type JadwalColumn = {
  id: string
  label: string
  kelasIds: string[]
  order: number
}

function dayName(date: string) {
  return dayNameWib(date)
}

function shortDate(date: string) {
  return shortDateWib(date)
}

function formatTimeRange(sesi: JadwalEhbCetakSesi) {
  if (!sesi.waktu_mulai && !sesi.waktu_selesai) return '-'
  return `${sesi.waktu_mulai || '-'}-${sesi.waktu_selesai || '-'}`
}

function buildJadwalMap(jadwal: JadwalEhbCetakItem[]) {
  const map = new Map<string, string[]>()
  jadwal.forEach(item => {
    const key = `${item.tanggal}|${item.sesi_id}|${item.kelas_id}`
    const existing = map.get(key) ?? []
    existing.push(item.mapel_nama)
    map.set(key, existing)
  })
  return map
}

function abbreviateColumnLabel(label: string) {
  return label
    .replace(/Tamhidiyyah/i, 'TMHD')
    .replace(/Ibtidaiyyah/i, 'IBT.')
    .replace(/Mutawassithah/i, 'MTW')
}

function buildColumns(kelasList: JadwalEhbCetakKelas[]): JadwalColumn[] {
  const columns = new Map<string, JadwalColumn>()

  kelasList.forEach(kelas => {
    const marhalah = kelas.marhalah_nama ?? kelas.nama_kelas
    const isMutawassithah = /mutawassithah/i.test(marhalah) || /mutawassithah/i.test(kelas.nama_kelas)

    if (isMutawassithah) {
      columns.set(`kelas-${kelas.id}`, {
        id: `kelas-${kelas.id}`,
        label: abbreviateColumnLabel(kelas.nama_kelas),
        kelasIds: [kelas.id],
        order: (kelas.marhalah_urutan ?? 999) * 1000 + columns.size,
      })
      return
    }

    const id = `marhalah-${marhalah}`
    const existing = columns.get(id)
    if (existing) {
      existing.kelasIds.push(kelas.id)
    } else {
      columns.set(id, {
        id,
        label: abbreviateColumnLabel(marhalah),
        kelasIds: [kelas.id],
        order: (kelas.marhalah_urutan ?? 999) * 1000,
      })
    }
  })

  return Array.from(columns.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'id-ID', { numeric: true }))
}

function getColumnMapel(jadwalMap: Map<string, string[]>, tanggal: string, sesiId: number, column: JadwalColumn) {
  const names = column.kelasIds.flatMap(kelasId => jadwalMap.get(`${tanggal}|${sesiId}|${kelasId}`) ?? [])
  return Array.from(new Set(names)).join(' / ')
}

function PrintHeader({ event }: { event: ActiveEvent }) {
  const semesterLabel = event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = event.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4mm',
      height: '26mm',
      flexShrink: 0,
      marginBottom: '1.5mm',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logohitam.png"
        alt=""
        style={{ width: '23mm', height: '23mm', objectFit: 'contain', flexShrink: 0 }}
      />
      <div style={{ width: '138mm' }}>
        <div style={{ fontSize: '20pt', fontWeight: 700, lineHeight: 0.95 }}>
          EVALUASI HASIL BELAJAR
        </div>
        <div style={{ fontSize: '16pt', lineHeight: 1 }}>
          {semesterLabel} T.A. {tahunAjaran}
        </div>
        <div style={{ fontSize: '9pt', lineHeight: 1.15, marginTop: '1mm' }}>
          LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
        </div>
        <div style={{ borderBottom: '1.1pt solid #000', marginTop: '1.5mm' }} />
      </div>
    </div>
  )
}

function JadwalEhbPrint({ data }: { data: JadwalEhbCetakData }) {
  const event = data.event
  const dates = getDatesBetweenWib(event?.tanggal_mulai, event?.tanggal_selesai)
  const jadwalMap = buildJadwalMap(data.jadwal)
  const columns = buildColumns(data.kelasList)
  const rows = dates.flatMap(tanggal => data.sesiList.map(sesi => ({ tanggal, sesi })))
  const classCount = Math.max(columns.length, 1)
  const rowHeight = Math.max(5.2, Math.min(7.5, 110 / Math.max(rows.length, 1)))
  const classFont = classCount > 10 ? '6.8pt' : classCount > 8 ? '7.3pt' : '8pt'
  const mapelFont = classCount > 10 ? '6.4pt' : classCount > 8 ? '6.8pt' : '7.4pt'

  if (!event) return null

  return (
    <div style={{
      width: '330mm',
      height: '210mm',
      padding: '7mm 8mm',
      boxSizing: 'border-box',
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: '#000',
      overflow: 'hidden',
      breakAfter: 'page',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13.5pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '2mm',
      }}>
        JADWAL EVALUASI HASIL BELAJAR
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', flexShrink: 0 }}>
        <colgroup>
          <col style={{ width: '13mm' }} />
          <col style={{ width: '17mm' }} />
          <col style={{ width: '9mm' }} />
          <col style={{ width: '21mm' }} />
          {columns.map(column => (
            <col key={column.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={thStyle}>HARI</th>
            <th style={thStyle}>TGL</th>
            <th style={thStyle}>SESI</th>
            <th style={thStyle}>WAKTU</th>
            {columns.map(column => (
              <th key={column.id} style={{ ...thStyle, fontSize: classFont }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(tanggal => (
            data.sesiList.map((sesi, sesiIndex) => (
              <tr key={`${tanggal}-${sesi.id}`}>
                {sesiIndex === 0 && (
                  <>
                    <td rowSpan={data.sesiList.length} style={{ ...tdStyle, height: `${rowHeight}mm`, fontWeight: 700, backgroundColor: '#fff' }}>
                      {dayName(tanggal)}
                    </td>
                    <td rowSpan={data.sesiList.length} style={{ ...tdStyle, height: `${rowHeight}mm`, fontWeight: 700, backgroundColor: '#fff' }}>
                      {shortDate(tanggal)}
                    </td>
                  </>
                )}
                <td style={{ ...tdStyle, height: `${rowHeight}mm`, fontWeight: 700 }}>{sesi.nomor_sesi}</td>
                <td style={{ ...tdStyle, height: `${rowHeight}mm`, fontWeight: 700, fontSize: '7.2pt' }}>{formatTimeRange(sesi)}</td>
                {columns.map(column => {
                  const mapel = getColumnMapel(jadwalMap, tanggal, sesi.id, column)
                  const empty = !mapel
                  return (
                    <td
                      key={`${tanggal}-${sesi.id}-${column.id}`}
                      style={{
                        ...tdStyle,
                        height: `${rowHeight}mm`,
                        backgroundColor: empty ? '#9ca3af' : '#fff',
                        color: empty ? '#9ca3af' : '#000',
                        fontSize: mapel && mapel.length > 26 ? '6.1pt' : mapelFont,
                        lineHeight: 1.05,
                        padding: '0.4mm 0.8mm',
                        whiteSpace: 'normal',
                      }}
                    >
                      {mapel ?? '-'}
                    </td>
                  )
                })}
              </tr>
            ))
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 'auto',
        paddingTop: '5mm',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ketua Panitia,</div>
          <div style={{ height: '21mm' }} />
          <div style={{ fontWeight: 700 }}>{data.panitia.ketua || '____________________'}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Sekretaris,</div>
          <div style={{ height: '21mm' }} />
          <div style={{ fontWeight: 700 }}>{data.panitia.sekretaris || '____________________'}</div>
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '8mm',
  padding: '0.8mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '8pt',
  fontWeight: 700,
  backgroundColor: '#f8fafc',
}

const tdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '0.5mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '7.4pt',
  lineHeight: 1,
  overflow: 'hidden',
}

function JadwalPreview({ data }: { data: JadwalEhbCetakData }) {
  return (
    <div className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.35 }}>
      <JadwalEhbPrint data={data} />
    </div>
  )
}

export function JadwalEhbView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [data, setData] = useState<JadwalEhbCetakData | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Jadwal EHB',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      setLoadingInit(false)
    }
    init()
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const dates = getDatesBetweenWib(data.event?.tanggal_mulai, data.event?.tanggal_selesai)
    return {
      tanggal: dates.length,
      sesi: data.sesiList.length,
      kolom: buildColumns(data.kelasList).length,
      jadwal: data.jadwal.length,
    }
  }, [data])

  const handleMuatPreview = async () => {
    if (!event) return
    setLoadingData(true)
    setHasLoaded(false)
    try {
      const loaded = await getJadwalEhbCetakData(event.id)
      setData(loaded)
      setHasLoaded(true)
      if (!loaded.event?.tanggal_mulai || !loaded.event?.tanggal_selesai) {
        toast.error('Rentang tanggal event belum tersedia')
      } else if (loaded.kelasList.length === 0) {
        toast.error('Mapping kelas belum tersedia')
      } else if (loaded.jadwal.length === 0) {
        toast.error('Jadwal EHB belum terisi')
      }
    } catch {
      toast.error('Gagal memuat jadwal EHB')
    } finally {
      setLoadingData(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Jadwal EHB" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Jadwal EHB" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Preview Jadwal EHB</h3>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Format cetak F4 Landscape satu lembar dengan tanda tangan ketua dan sekretaris.
          </p>
          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Muat Preview
          </button>
        </div>
      </div>

      {hasLoaded && data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{stats?.tanggal}</span> tanggal
              <span className="text-slate-400 ml-2">· {stats?.sesi} sesi · {stats?.kolom} kolom · {stats?.jadwal} jadwal terisi</span>
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={!data.event || data.kelasList.length === 0 || data.sesiList.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Jadwal
            </button>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[800px]">
            <JadwalPreview data={data} />
          </div>

          <div className="hidden">
            <div ref={printRef}>
              <JadwalEhbPrint data={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
