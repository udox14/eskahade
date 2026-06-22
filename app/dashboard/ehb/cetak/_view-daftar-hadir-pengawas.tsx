'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import { AlertTriangle, CalendarDays, Clipboard, ClipboardCheck, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getJadwalPengawasCetakData,
  type ActiveEvent,
  type JadwalPengawasCetakItem,
  type JadwalPengawasCetakRuangan,
  type JadwalPengawasCetakSesi,
  type JadwalPengawasCetakSlot,
  type JadwalPengawasCetakTanggal,
  type PengawasCetakItem,
} from './actions'
import { PageHeader, FONT } from './_shared'
import { dayNameWib, longDateWib } from '../_date-utils'

type JadwalPengawasCetakData = {
  sesiList: JadwalPengawasCetakSesi[]
  tanggalList: JadwalPengawasCetakTanggal[]
  activeSlots: JadwalPengawasCetakSlot[]
  ruanganList: JadwalPengawasCetakRuangan[]
  jadwal: JadwalPengawasCetakItem[]
  pengawasList: PengawasCetakItem[]
}

type PrintMode = 'semua' | 'hari' | 'sesi'

type PrintSlot = {
  key: string
  tanggal: string
  sesi: JadwalPengawasCetakSesi
}

function formatHeaderSesi(sesi: JadwalPengawasCetakSesi) {
  const waktu = sesi.waktu_mulai || sesi.waktu_selesai
    ? ` (${sesi.waktu_mulai || '-'} - ${sesi.waktu_selesai || '-'})`
    : ''
  return `${sesi.label || `Sesi ${sesi.nomor_sesi}`}${waktu}`
}

function formatWaSesi(sesi: JadwalPengawasCetakSesi) {
  const label = sesi.label || `SESI ${sesi.nomor_sesi}`
  return label.toUpperCase()
}

function buildSlots(data: JadwalPengawasCetakData) {
  const sesiById = new Map(data.sesiList.map(sesi => [sesi.id, sesi]))
  return data.activeSlots
    .map(slot => {
      const sesi = sesiById.get(slot.sesi_id)
      if (!sesi) return null
      return {
        key: `${slot.tanggal}|${sesi.id}`,
        tanggal: slot.tanggal,
        sesi,
      }
    })
    .filter((slot): slot is PrintSlot => Boolean(slot))
}

function buildWhatsAppText(data: JadwalPengawasCetakData, slots: PrintSlot[]) {
  const sortedRooms = [...data.ruanganList].sort((a, b) => a.nomor_ruangan - b.nomor_ruangan)
  const assignmentMap = new Map<string, JadwalPengawasCetakItem>()

  data.jadwal.forEach(item => {
    assignmentMap.set(`${item.tanggal}|${item.sesi_id}|${item.ruangan_id}`, item)
  })

  return slots.map(slot => {
    const lines = [
      'JADWAL PENGAWAS EHB',
      `Hari ${dayNameWib(slot.tanggal, true)}, ${longDateWib(slot.tanggal)}`,
      formatWaSesi(slot.sesi),
      '',
      ...sortedRooms.map(ruangan => {
        const assignment = assignmentMap.get(`${slot.tanggal}|${slot.sesi.id}|${ruangan.id}`)
        const nama = assignment?.nama_pengawas?.trim().toUpperCase() || '-'
        return `R.${ruangan.nomor_ruangan} - ${nama}`
      }),
    ]

    return lines.join('\n')
  }).join('\n\n')
}

function PrintHeader({ event }: { event: ActiveEvent }) {
  const semesterLabel = event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = event.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ ...kopStyle, fontFamily: FONT }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logohitam.png"
        alt=""
        style={{ width: '25mm', height: '25mm', objectFit: 'contain', flexShrink: 0 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '21pt', fontWeight: 900, lineHeight: 0.95 }}>
          EVALUASI HASIL BELAJAR
        </div>
        <div style={{ fontSize: '17pt', lineHeight: 1 }}>
          {semesterLabel} T.A. {tahunAjaran}
        </div>
        <div style={{ fontSize: '9.5pt', lineHeight: 1.15, marginTop: '1mm' }}>
          LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
        </div>
        <div style={{ borderBottom: '1.2pt solid #000', marginTop: '1.5mm', width: '100%' }} />
      </div>
    </div>
  )
}

function AttendanceSheet({
  event,
  data,
  slot,
}: {
  event: ActiveEvent
  data: JadwalPengawasCetakData
  slot: PrintSlot
}) {
  const assignmentByRoom = new Map<number, JadwalPengawasCetakItem>()
  data.jadwal
    .filter(item => item.tanggal === slot.tanggal && item.sesi_id === slot.sesi.id)
    .forEach(item => assignmentByRoom.set(item.ruangan_id, item))

  const displayRuanganList = [...data.ruanganList]
  if (displayRuanganList.length % 2 !== 0) {
    displayRuanganList.push({ id: -1, nomor_ruangan: displayRuanganList.length + 1 } as any)
  }

  const rowHeight = Math.max(6.4, Math.min(10.5, 222 / Math.max(displayRuanganList.length, 1)))

  return (
    <div style={pageStyle}>
      <PrintHeader event={event} />

      <div style={titleStyle}>DAFTAR HADIR PENGAWAS</div>
      <div style={metaStyle}>
        <div>Hari/Tanggal</div>
        <div>: {dayNameWib(slot.tanggal, true)}, {longDateWib(slot.tanggal)}</div>
        <div>Sesi EHB</div>
        <div>: {formatHeaderSesi(slot.sesi)}</div>
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: '26mm' }} />
          <col />
          <col style={{ width: '29mm' }} />
          <col style={{ width: '29mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={thStyle}>RUANGAN</th>
            <th style={thStyle}>NAMA PENGAWAS</th>
            <th style={thStyle} colSpan={2}>TANDA TANGAN</th>
          </tr>
        </thead>
        <tbody>
          {displayRuanganList.map((ruangan, index) => {
            const assignment = ruangan.id === -1 ? null : assignmentByRoom.get(ruangan.id)
            const isEmpty = ruangan.id !== -1 && !assignment
            return (
              <tr key={ruangan.id === -1 ? 'dummy' : ruangan.id}>
                <td style={{ ...tdStyle, height: `${rowHeight}mm`, textAlign: 'center' }}>
                  {ruangan.id === -1 ? '' : ruangan.nomor_ruangan}
                </td>
                <td style={{
                  ...tdStyle,
                  height: `${rowHeight}mm`,
                  backgroundColor: isEmpty ? '#e5e7eb' : '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'clip',
                  textTransform: 'uppercase',
                }}>
                  {ruangan.id === -1 ? '' : (assignment?.nama_pengawas ?? '')}
                </td>
                {index % 2 === 0 ? (
                  <>
                    <td rowSpan={2} style={signatureTdStyle}>
                      <span style={signatureNumberStyle}>{index + 1}</span>
                    </td>
                    <td rowSpan={2} style={signatureTdStyle}>
                      {displayRuanganList.length > index + 1 && (
                        <span style={signatureNumberStyle}>{index + 2}</span>
                      )}
                    </td>
                  </>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AttendancePrint({
  event,
  data,
  slots,
}: {
  event: ActiveEvent
  data: JadwalPengawasCetakData
  slots: PrintSlot[]
}) {
  return (
    <>
      {slots.map(slot => (
        <AttendanceSheet key={slot.key} event={event} data={data} slot={slot} />
      ))}
    </>
  )
}

function AttendancePreview({
  event,
  data,
  slots,
}: {
  event: ActiveEvent
  data: JadwalPengawasCetakData
  slots: PrintSlot[]
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {slots.slice(0, 3).map(slot => (
        <div key={slot.key} className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.38 }}>
          <AttendanceSheet event={event} data={data} slot={slot} />
        </div>
      ))}
      {slots.length > 3 && (
        <p className="text-xs font-semibold text-slate-500">Preview menampilkan 3 lembar pertama dari {slots.length} lembar.</p>
      )}
    </div>
  )
}

const kopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4mm',
  height: '28mm',
  flexShrink: 0,
  marginBottom: '2mm',
}

const pageStyle: React.CSSProperties = {
  width: '210mm',
  height: '330mm',
  padding: '8mm 10mm 8mm 20mm', // top, right, bottom, left (20mm for binding)
  boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#fff',
  color: '#000',
  overflow: 'hidden',
  breakAfter: 'page',
}

const titleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '15pt',
  fontWeight: 700,
  lineHeight: 1,
  marginBottom: '4mm',
}

const metaStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32mm 1fr',
  gap: '1.2mm 2mm',
  fontSize: '12pt',
  lineHeight: 1.1,
  marginBottom: '4mm',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const thStyle: React.CSSProperties = {
  border: '1pt solid #000',
  backgroundColor: '#e5e7eb',
  height: '12mm',
  padding: '1mm 1.5mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '12pt',
  fontWeight: 700,
  lineHeight: 1,
}

const tdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '0.8mm 1.5mm',
  verticalAlign: 'middle',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '12pt',
  fontWeight: 400,
  lineHeight: 1,
}

const signatureTdStyle: React.CSSProperties = {
  ...tdStyle,
  position: 'relative',
  padding: 0,
}

const signatureNumberStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1mm',
  left: '1.2mm',
  fontSize: '9pt',
  lineHeight: 1,
}

export function DaftarHadirPengawasView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [data, setData] = useState<JadwalPengawasCetakData | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [mode, setMode] = useState<PrintMode>('semua')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlotKey, setSelectedSlotKey] = useState('')

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Daftar Hadir Pengawas EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      if (evt) {
        try {
          const loaded = await getJadwalPengawasCetakData(evt.id)
          setData(loaded)
        } catch {
          // ignore error initially
        }
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const slots = useMemo(() => data ? buildSlots(data) : [], [data])
  const filteredSlots = useMemo(() => {
    if (mode === 'hari') return slots.filter(slot => slot.tanggal === selectedDate)
    if (mode === 'sesi') return slots.filter(slot => slot.key === selectedSlotKey)
    return slots
  }, [mode, selectedDate, selectedSlotKey, slots])

  useEffect(() => {
    if (!data) return
    if (!selectedDate && data.tanggalList[0]) setSelectedDate(data.tanggalList[0].tanggal)
    if (!selectedSlotKey && slots[0]) setSelectedSlotKey(slots[0].key)
  }, [data, selectedDate, selectedSlotKey, slots])

  const handleMuatPreview = async () => {
    if (!event) return
    setLoadingData(true)
    setHasLoaded(false)
    try {
      const loaded = await getJadwalPengawasCetakData(event.id)
      setData(loaded)
      setHasLoaded(true)
      if (loaded.activeSlots.length === 0 || loaded.ruanganList.length === 0) {
        toast.error('Tanggal/sesi ujian atau ruangan belum tersedia')
      }
    } catch {
      toast.error('Gagal memuat data daftar hadir pengawas')
    } finally {
      setLoadingData(false)
    }
  }

  const handleCopyWhatsApp = async () => {
    if (!data || filteredSlots.length === 0) return

    try {
      await navigator.clipboard.writeText(buildWhatsAppText(data, filteredSlots))
      toast.success('Jadwal pengawas siap ditempel ke WA')
    } catch {
      toast.error('Gagal copy jadwal pengawas')
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Daftar Hadir Pengawas" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Daftar Hadir Pengawas" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Preview Blanko Daftar Hadir Pengawas</h3>
        </div>
        <div className="p-5 flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Mode Cetak
              <select
                value={mode}
                onChange={event => setMode(event.target.value as PrintMode)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white"
              >
                <option value="semua">Semua sesi</option>
                <option value="hari">Per hari</option>
                <option value="sesi">Per sesi</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-500 uppercase">
              Hari
              <select
                value={selectedDate}
                onChange={event => setSelectedDate(event.target.value)}
                disabled={!data || mode !== 'hari'}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {data?.tanggalList.map(item => (
                  <option key={item.tanggal} value={item.tanggal}>
                    {dayNameWib(item.tanggal, true)}, {longDateWib(item.tanggal, false)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-500 uppercase">
              Sesi
              <select
                value={selectedSlotKey}
                onChange={event => setSelectedSlotKey(event.target.value)}
                disabled={!data || mode !== 'sesi'}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {slots.map(slot => (
                  <option key={slot.key} value={slot.key}>
                    {dayNameWib(slot.tanggal, true)}, {longDateWib(slot.tanggal, false)} - {slot.sesi.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Muat Preview
          </button>
        </div>
      </div>

      {hasLoaded && data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{filteredSlots.length}</span> lembar siap dicetak
              <span className="text-slate-400 ml-2">- {data.ruanganList.length} ruangan per lembar</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopyWhatsApp}
                disabled={filteredSlots.length === 0 || data.ruanganList.length === 0}
                className="bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 disabled:text-slate-400 border border-slate-200 font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Clipboard className="w-4 h-4" /> Copy WA
              </button>
              <button
                onClick={() => handlePrint()}
                disabled={filteredSlots.length === 0 || data.ruanganList.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak Blanko
              </button>
            </div>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[900px]">
            {filteredSlots.length > 0 ? (
              <AttendancePreview event={event} data={data} slots={filteredSlots} />
            ) : (
              <div className="py-16 text-sm font-semibold text-slate-500">Tidak ada sesi pada filter ini.</div>
            )}
          </div>

          <div className="hidden">
            <div ref={printRef}>
              <AttendancePrint event={event} data={data} slots={filteredSlots} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
