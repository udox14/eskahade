'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { AlertTriangle, CalendarCheck, Loader2, Printer } from 'lucide-react'
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
import { FONT, PageHeader } from './_shared'
import { dayNameWib, longDateWib } from '../_date-utils'

type JadwalPengawasCetakData = {
  sesiList: JadwalPengawasCetakSesi[]
  tanggalList: JadwalPengawasCetakTanggal[]
  activeSlots: JadwalPengawasCetakSlot[]
  ruanganList: JadwalPengawasCetakRuangan[]
  jadwal: JadwalPengawasCetakItem[]
  pengawasList: PengawasCetakItem[]
}

const TUGAS_PENGAWAS = [
  'Mengambil amplop soal 10 menit sebelum EHB dimulai.',
  'Memeriksa dan membereskan posisi duduk peserta EHB berdasarkan urutan nomor tes.',
  'Membagikan soal dan lembar jawaban EHB.',
  'Mengabsen peserta EHB dan memeriksa kartu peserta.',
  'Memisahkan lembar jawaban berdasarkan marhalah.',
  'Bertanggung jawab atas kelancaran dan ketertiban pelaksanaan EHB.',
  'Berhak memberikan sanksi bagi peserta test yang melanggar aturan.',
]

function dayName(date: string) {
  return dayNameWib(date, true)
}

function longDate(date: string) {
  return longDateWib(date)
}

function mediumDate(date: string) {
  return longDateWib(date, false)
}

function formatTimeRange(sesi: JadwalPengawasCetakSesi) {
  if (!sesi.waktu_mulai && !sesi.waktu_selesai) return '-'
  return `${sesi.waktu_mulai || '-'} - ${sesi.waktu_selesai || '-'}`
}

function romanize(num: number) {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  return romans[num - 1] ?? String(num)
}

function buildPengawasCodes(pengawasList: PengawasCetakItem[]) {
  const map = new Map<number, number>()
  pengawasList.forEach((pengawas, index) => map.set(pengawas.id, index + 1))
  return map
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
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
      height: '28mm',
      flexShrink: 0,
      marginBottom: '2mm',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logohitam.png"
        alt=""
        style={{ width: '25mm', height: '25mm', objectFit: 'contain', flexShrink: 0 }}
      />
      <div style={{ width: '130mm' }}>
        <div style={{ fontSize: '21pt', fontWeight: 700, lineHeight: 0.95 }}>
          EVALUASI HASIL BELAJAR
        </div>
        <div style={{ fontSize: '17pt', lineHeight: 1 }}>
          {semesterLabel} T.A. {tahunAjaran}
        </div>
        <div style={{ fontSize: '9.5pt', lineHeight: 1.15, marginTop: '1mm' }}>
          LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
        </div>
        <div style={{ borderBottom: '1.2pt solid #000', marginTop: '1.5mm' }} />
      </div>
    </div>
  )
}

function JadwalPage({
  event,
  data,
  pengawasCodes,
}: {
  event: ActiveEvent
  data: JadwalPengawasCetakData
  pengawasCodes: Map<number, number>
}) {
  const sesiById = new Map(data.sesiList.map(sesi => [sesi.id, sesi]))
  const slotByDate = new Map<string, JadwalPengawasCetakSesi[]>()
  data.tanggalList.forEach(({ tanggal }) => {
    const sesiIds = data.activeSlots
      .filter(slot => slot.tanggal === tanggal)
      .map(slot => slot.sesi_id)
    const sessions = data.sesiList.filter(sesi => sesiIds.includes(sesi.id))
    slotByDate.set(tanggal, sessions)
  })

  const assignmentMap = new Map<string, number[]>()
  data.jadwal.forEach(item => {
    const key = `${item.tanggal}|${item.sesi_id}|${item.ruangan_id}`
    const existing = assignmentMap.get(key) ?? []
    const code = pengawasCodes.get(item.pengawas_id)
    if (code) existing.push(code)
    assignmentMap.set(key, existing)
  })

  const totalSessionColumns = data.tanggalList.reduce((sum, { tanggal }) => {
    return sum + (slotByDate.get(tanggal)?.length ?? 0)
  }, 0)

  return (
    <div style={pageStyle}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '2mm',
      }}>
        JADWAL PENGAWAS EHB
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '13mm' }} />
          {Array.from({ length: totalSessionColumns }).map((_, index) => (
            <col key={index} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={3} style={{ ...jadwalThStyle, fontSize: '6.8pt', lineHeight: 0.95 }}>
              RUA<br />NG
            </th>
            {data.tanggalList.map(({ tanggal }) => {
              const sessions = slotByDate.get(tanggal) ?? []
              return (
                <th key={tanggal} colSpan={Math.max(1, sessions.length)} style={{ ...jadwalThStyle, fontSize: '8.5pt' }}>
                  {dayName(tanggal)}
                </th>
              )
            })}
          </tr>
          <tr>
            {data.tanggalList.map(({ tanggal }) => {
              const sessions = slotByDate.get(tanggal) ?? []
              return (
                <th key={tanggal} colSpan={Math.max(1, sessions.length)} style={{ ...jadwalThStyle, fontSize: '6.8pt' }}>
                  {mediumDate(tanggal)}
                </th>
              )
            })}
          </tr>
          <tr>
            {data.tanggalList.flatMap(({ tanggal }) => {
              const sessions = slotByDate.get(tanggal) ?? []
              return sessions.map(sesi => (
                <th key={`${tanggal}-${sesi.id}`} style={{ ...jadwalThStyle, fontSize: '6.6pt' }}>
                  {romanize(sesi.nomor_sesi)}
                </th>
              ))
            })}
          </tr>
        </thead>
        <tbody>
          {data.ruanganList.map(ruangan => (
            <tr key={ruangan.id}>
              <td style={{ ...jadwalTdStyle, fontWeight: 700, backgroundColor: '#f2f2f2' }}>
                {ruangan.nomor_ruangan}
              </td>
              {data.tanggalList.flatMap(({ tanggal }) => {
                const sessions = slotByDate.get(tanggal) ?? []
                return sessions.map(sesi => {
                  const key = `${tanggal}|${sesi.id}|${ruangan.id}`
                  const codes = (assignmentMap.get(key) ?? []).sort((a, b) => a - b)
                  return (
                    <td key={`${ruangan.id}-${tanggal}-${sesi.id}`} style={jadwalTdStyle}>
                      {codes.join(', ')}
                    </td>
                  )
                })
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: '6mm',
        border: '1pt solid #000',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}>
        <div style={{
          backgroundColor: '#e5e7eb',
          borderBottom: '1pt solid #000',
          textAlign: 'center',
          fontSize: '9pt',
          fontWeight: 700,
          padding: '1.5mm',
        }}>
          WAKTU PELAKSANAAN EHB
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0',
          fontSize: '8.2pt',
          lineHeight: 1.25,
        }}>
          {data.tanggalList.map(({ tanggal }, index) => {
            const sessions = slotByDate.get(tanggal) ?? []
            return (
              <div key={tanggal} style={{
                breakInside: 'avoid',
                padding: '2.5mm 3mm',
                borderRight: index % 2 === 0 ? '1pt solid #000' : '0',
                borderBottom: index < data.tanggalList.length - 2 ? '1pt solid #000' : '0',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '1.5mm' }}>{dayName(tanggal)} - {longDate(tanggal)}</div>
                {sessions.map(sesi => (
                  <div key={sesi.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '18mm 1fr',
                    gap: '2mm',
                    marginBottom: '0.8mm',
                  }}>
                    <span style={{
                      border: '0.8pt solid #000',
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '0.5mm 0',
                    }}>
                      SESI {romanize(sesi.nomor_sesi)}
                    </span>
                    <span style={{ paddingTop: '0.5mm' }}>{formatTimeRange(sesiById.get(sesi.id) ?? sesi)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PengawasPage({
  event,
  pengawasList,
}: {
  event: ActiveEvent
  pengawasList: PengawasCetakItem[]
}) {
  const columns = chunkArray(pengawasList, Math.ceil(Math.max(pengawasList.length, 1) / 3))

  return (
    <div style={pageStyle}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '2mm',
      }}>
        DAFTAR KODE PENGAWAS
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: '1.2pt solid #000',
        borderLeft: '1.2pt solid #000',
      }}>
        {[0, 1, 2].map(colIndex => (
          <table key={colIndex} style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...pengawasThStyle, width: '10mm' }}>Kode</th>
                <th style={pengawasThStyle}>Nama Pengawas</th>
              </tr>
            </thead>
            <tbody>
              {(columns[colIndex] ?? []).map((pengawas, index) => {
                const code = colIndex * Math.ceil(Math.max(pengawasList.length, 1) / 3) + index + 1
                return (
                  <tr key={pengawas.id}>
                    <td style={{ ...pengawasTdStyle, textAlign: 'center' }}>{code}</td>
                    <td style={pengawasTdStyle}>{pengawas.nama_pengawas}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>

      <div style={{
        marginTop: '6mm',
        border: '1pt solid #000',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}>
        <div style={{
          backgroundColor: '#e5e7eb',
          borderBottom: '1pt solid #000',
          textAlign: 'center',
          fontSize: '10pt',
          fontWeight: 700,
          padding: '1.8mm',
        }}>
          TATA TERTIB PENGAWAS
        </div>
        <div style={{ display: 'grid', gap: '1.8mm', fontSize: '9.4pt', lineHeight: 1.3, padding: '3mm 4mm' }}>
          {TUGAS_PENGAWAS.map((task, index) => (
            <div key={task} style={{ display: 'grid', gridTemplateColumns: '7mm 1fr', gap: '3mm', alignItems: 'start' }}>
              <div style={{ fontWeight: 700 }}>{index + 1}.</div>
              <div>{task}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function JadwalMengawasPrint({
  event,
  data,
}: {
  event: ActiveEvent
  data: JadwalPengawasCetakData
}) {
  const pengawasCodes = buildPengawasCodes(data.pengawasList)

  return (
    <>
      <JadwalPage event={event} data={data} pengawasCodes={pengawasCodes} />
      <PengawasPage event={event} pengawasList={data.pengawasList} />
    </>
  )
}

const pageStyle: React.CSSProperties = {
  width: '210mm',
  minHeight: '330mm',
  padding: '8mm',
  boxSizing: 'border-box',
  fontFamily: FONT,
  backgroundColor: '#fff',
  color: '#000',
  overflow: 'hidden',
  breakAfter: 'page',
}

const jadwalThStyle: React.CSSProperties = {
  border: '1pt solid #000',
  backgroundColor: '#e5e7eb',
  height: '5.2mm',
  padding: '0.5mm',
  textAlign: 'center',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 700,
}

const jadwalTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '6.1mm',
  padding: '0.4mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '8.4pt',
  lineHeight: 1,
}

const pengawasThStyle: React.CSSProperties = {
  borderRight: '1.2pt solid #000',
  borderBottom: '1.2pt solid #000',
  backgroundColor: '#e5e7eb',
  height: '7mm',
  padding: '1mm',
  textAlign: 'center',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '8.5pt',
  fontWeight: 700,
}

const pengawasTdStyle: React.CSSProperties = {
  borderRight: '1.2pt solid #000',
  borderBottom: '1.2pt solid #000',
  height: '6.1mm',
  padding: '0.8mm 1.2mm',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '8.2pt',
  lineHeight: 1.1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

function JadwalPreview({ event, data }: { event: ActiveEvent; data: JadwalPengawasCetakData }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.38 }}>
        <JadwalPage event={event} data={data} pengawasCodes={buildPengawasCodes(data.pengawasList)} />
      </div>
      <div className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.38 }}>
        <PengawasPage event={event} pengawasList={data.pengawasList} />
      </div>
    </div>
  )
}

export function JadwalMengawasView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [data, setData] = useState<JadwalPengawasCetakData | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Jadwal Pengawas EHB',
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
      setLoadingInit(false)
    }
    init()
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    return {
      tanggal: data.tanggalList.length,
      sesi: data.sesiList.length,
      ruangan: data.ruanganList.length,
      pengawas: data.pengawasList.length,
      terisi: data.jadwal.length,
    }
  }, [data])

  const handleMuatPreview = async () => {
    if (!event) return
    setLoadingData(true)
    setHasLoaded(false)
    try {
      const loaded = await getJadwalPengawasCetakData(event.id)
      setData(loaded)
      setHasLoaded(true)
      if (loaded.tanggalList.length === 0 || loaded.ruanganList.length === 0) {
        toast.error('Tanggal ujian atau ruangan belum tersedia')
      } else if (loaded.jadwal.length === 0) {
        toast.error('Jadwal pengawas belum terisi')
      }
    } catch {
      toast.error('Gagal memuat jadwal pengawas')
    } finally {
      setLoadingData(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Jadwal Mengawas" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Jadwal Mengawas" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Preview Jadwal Pengawas</h3>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Format cetak F4 Portrait dengan dua halaman: matriks jadwal dan daftar kode pengawas.
          </p>
          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />} Muat Preview
          </button>
        </div>
      </div>

      {hasLoaded && data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{stats?.tanggal}</span> tanggal
              <span className="text-slate-400 ml-2">· {stats?.ruangan} ruangan · {stats?.pengawas} pengawas · {stats?.terisi} slot terisi</span>
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={!data || data.tanggalList.length === 0 || data.ruanganList.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Jadwal
            </button>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[900px]">
            <JadwalPreview event={event} data={data} />
          </div>

          <div className="hidden">
            <div ref={printRef}>
              <JadwalMengawasPrint event={event} data={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
