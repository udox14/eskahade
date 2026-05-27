'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, Boxes, Filter, Loader2, Megaphone, Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getRuanganListForCetak,
  getTempelanHumasData,
  getTempelanHumasKelasList,
  getTempelanPengepakanData,
  type ActiveEvent,
  type RuanganOption,
  type TempelanHumasItem,
  type TempelanHumasKelasOption,
  type TempelanPengepakanItem,
} from './actions'
import { FONT, PageHeader } from './_shared'

type HumasCard = {
  kelasId: string
  namaKelas: string
  marhalahNama: string | null
  semester: number
  tahunAjaranNama: string
  rows: { nomorRuangan: number; jumlah: number }[]
  total: number
}

type PengepakanCard = {
  ruanganId: number
  nomorRuangan: number
  semester: number
  tahunAjaranNama: string
  jamGroups: {
    jamGroup: string
    rows: { kelas: string; jumlah: number }[]
    total: number
  }[]
}

type PrintableCard = HumasCard | PengepakanCard

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, 'id-ID', { numeric: true, sensitivity: 'base' })
}

function formatRoomNumber(roomNumber: number) {
  return String(roomNumber).padStart(2, '0')
}

export function formatTempelanClassName(namaKelas: string | null | undefined, marhalahNama?: string | null) {
  const raw = (namaKelas || marhalahNama || '-').trim()
  const source = raw || '-'
  const replacements: [RegExp, string][] = [
    [/\bTamhidiyyah\b/gi, 'TMH'],
    [/\bIbtidaiyyah\b/gi, 'IBT'],
    [/\bMutawassithah\b/gi, 'MTW'],
    [/\bMutaqaddimah\b/gi, 'MTQ'],
    [/\bTAMHIDIYYAH\b/g, 'TMH'],
    [/\bIBTIDAIYYAH\b/g, 'IBT'],
    [/\bMUTAWASSITHAH\b/g, 'MTW'],
    [/\bMUTAQADDIMAH\b/g, 'MTQ'],
  ]

  let text = source
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })

  return text
    .replace(/\s+/g, ' ')
    .replace(/\b(TMH|IBT|MTW|MTQ)\s+(\d+)\s*-\s*0*(\d+)\b/gi, (_, level, grade, group) => `${String(level).toUpperCase()} ${Number(grade)}-${Number(group)}`)
    .replace(/\b(TMH|IBT|MTW|MTQ)\s+0*(\d+)\b/gi, (_, level, grade) => `${String(level).toUpperCase()} ${Number(grade)}`)
    .replace(/-\s*0+(\d+)/g, '-$1')
    .toUpperCase()
}

function buildHumasCards(rows: TempelanHumasItem[]): HumasCard[] {
  const grouped = new Map<string, HumasCard>()

  rows.forEach(row => {
    const card = grouped.get(row.kelas_id) ?? {
      kelasId: row.kelas_id,
      namaKelas: row.nama_kelas,
      marhalahNama: row.marhalah_nama,
      semester: row.semester,
      tahunAjaranNama: row.tahun_ajaran_nama,
      rows: [],
      total: 0,
    }
    card.rows.push({ nomorRuangan: row.nomor_ruangan, jumlah: Number(row.jumlah || 0) })
    card.total += Number(row.jumlah || 0)
    grouped.set(row.kelas_id, card)
  })

  return Array.from(grouped.values()).map(card => ({
    ...card,
    rows: card.rows.sort((a, b) => a.nomorRuangan - b.nomorRuangan),
  }))
}

function buildPengepakanCards(rows: TempelanPengepakanItem[]): PengepakanCard[] {
  const grouped = new Map<number, PengepakanCard>()

  rows.forEach(row => {
    const card = grouped.get(row.ruangan_id) ?? {
      ruanganId: row.ruangan_id,
      nomorRuangan: row.nomor_ruangan,
      semester: row.semester,
      tahunAjaranNama: row.tahun_ajaran_nama,
      jamGroups: [],
    }

    let jam = card.jamGroups.find(item => item.jamGroup === row.jam_group)
    if (!jam) {
      jam = { jamGroup: row.jam_group, rows: [], total: 0 }
      card.jamGroups.push(jam)
    }

    jam.rows.push({
      kelas: formatTempelanClassName(row.nama_kelas, row.marhalah_nama),
      jumlah: Number(row.jumlah || 0),
    })
    jam.total += Number(row.jumlah || 0)
    grouped.set(row.ruangan_id, card)
  })

  return Array.from(grouped.values())
    .sort((a, b) => a.nomorRuangan - b.nomorRuangan)
    .map(card => ({
      ...card,
      jamGroups: card.jamGroups
        .sort((a, b) => naturalCompare(a.jamGroup, b.jamGroup))
        .map(jam => ({ ...jam, rows: jam.rows.sort((a, b) => naturalCompare(a.kelas, b.kelas)) })),
    }))
}

function chunkPairs<T>(items: T[]) {
  const pairs: T[][] = []
  for (let index = 0; index < items.length; index += 2) pairs.push(items.slice(index, index + 2))
  return pairs
}

function VerticalHeader({ semester, tahunAjaranNama }: { semester: number; tahunAjaranNama: string }) {
  const semLabel = semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = tahunAjaranNama.replace('/', '-')

  return (
    <div style={{
      width: '39mm',
      height: '100%',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        left: '-107mm',
        top: '126mm',
        width: '250mm',
        transform: 'rotate(-90deg)',
        transformOrigin: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4mm',
        fontFamily: FONT,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logohitam.png" alt="" style={{ width: '18mm', height: '18mm', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ width: '111mm', color: '#000' }}>
          <div style={{ fontSize: '12pt', fontWeight: 900, lineHeight: 0.95 }}>
            EVALUASI HASIL BELAJAR
          </div>
          <div style={{ fontSize: '10.5pt', lineHeight: 1.1, marginTop: '1.2mm' }}>
            {semLabel} T.A. {tahunAjaran}
          </div>
          <div style={{ fontSize: '6.4pt', lineHeight: 1.1, marginTop: '1mm' }}>
            LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
          </div>
          <div style={{ borderBottom: '0.8pt solid #000', marginTop: '1.4mm', width: '100%' }} />
        </div>
      </div>
    </div>
  )
}

function F4PairSheet<T extends PrintableCard>({
  items,
  renderItem,
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}) {
  return (
    <>
      {chunkPairs(items).map((pair, pageIndex) => (
        <div key={pageIndex} style={{
          width: '216mm',
          height: '330mm',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: '#fff',
          color: '#000',
          fontFamily: FONT,
          overflow: 'hidden',
          breakAfter: 'page',
        }}>
          {pair.map((item, itemIndex) => (
            <div key={itemIndex} style={{
              width: '108mm',
              height: '330mm',
              boxSizing: 'border-box',
              borderLeft: itemIndex === 1 ? '0.4pt solid transparent' : undefined,
            }}>
              {renderItem(item)}
            </div>
          ))}
          {pair.length === 1 && <div style={{ width: '108mm', height: '330mm' }} />}
        </div>
      ))}
    </>
  )
}

function HumasPrintItem({ card }: { card: HumasCard }) {
  const rows = card.rows.slice(0, 7)

  return (
    <div style={{
      width: '108mm',
      height: '330mm',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      backgroundColor: '#fff',
    }}>
      <div style={{
        width: '96mm',
        height: '142mm',
        border: '0.8pt solid #000',
        display: 'flex',
        flexDirection: 'row',
        boxSizing: 'border-box',
      }}>
        {/* Left Column - Vertical Header */}
        <div style={{
          width: '21mm',
          height: '100%',
          borderRight: '0.8pt solid #000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4mm 0',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          {/* Rotated text centered vertically in upper area */}
          <div style={{
            position: 'absolute',
            top: '52mm',
            left: '10.5mm',
            width: '100mm',
            height: '21mm',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}>
            <div style={{ fontSize: '14pt', fontWeight: 900, lineHeight: 1, letterSpacing: '0.8px', color: '#000' }}>
              PANITIA
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 900, lineHeight: 1, marginTop: '2.5mm', letterSpacing: '0.5px', color: '#000' }}>
              EVALUASI HASIL BELAJAR
            </div>
            <div style={{ fontSize: '6.2pt', fontWeight: 'bold', lineHeight: 1, marginTop: '2mm', letterSpacing: '0.2px', color: '#000' }}>
              LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
            </div>
          </div>

          {/* Logo at the bottom */}
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logohitam.png" 
              alt="" 
              style={{ width: '13mm', height: '13mm', objectFit: 'contain' }} 
            />
          </div>
        </div>

        {/* Right Column - Main Details */}
        <div style={{
          flex: 1,
          height: '100%',
          padding: '4mm',
          boxSizing: 'border-box',
        }}>
          <fieldset style={{
            border: '0.8pt solid #000',
            borderRadius: '0px',
            padding: '3mm 4mm',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <legend style={{
              padding: '0 2.5mm',
              fontSize: '11.5pt',
              fontWeight: 500,
              fontFamily: 'Arial, Helvetica, sans-serif',
              letterSpacing: '1px',
              textAlign: 'center',
            }}>
              MARHALAH
            </legend>

            {/* Class Name */}
            <div style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '22pt',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: 1,
              marginTop: '1mm',
              marginBottom: '5mm',
              color: '#000',
            }}>
              {formatTempelanClassName(card.namaKelas, card.marhalahNama)}
            </div>

            {/* Table */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '10.5pt',
              color: '#000',
            }}>
              <colgroup>
                <col style={{ width: '60%' }} />
                <col style={{ width: '40%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#e5e5e5' }}>
                  <th style={{ ...humasThStyle, border: '0.8pt solid #000' }}>RUANG</th>
                  <th style={{ ...humasThStyle, border: '0.8pt solid #000' }}>JML</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, index) => {
                  const row = rows[index]
                  return (
                    <tr key={index}>
                      <td style={{ ...humasTdStyle, border: '0.8pt solid #000' }}>
                        {row ? formatRoomNumber(row.nomorRuangan) : ''}
                      </td>
                      <td style={{ ...humasTdStyle, border: '0.8pt solid #000' }}>
                        {row?.jumlah ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Total Footer Box - Separated */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '10.5pt',
              color: '#000',
              marginTop: '4mm',
            }}>
              <colgroup>
                <col style={{ width: '60%' }} />
                <col style={{ width: '40%' }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ ...humasTdStyle, fontWeight: 'bold', border: '0.8pt solid #000', backgroundColor: '#fff' }}>
                    JUMLAH
                  </td>
                  <td style={{ ...humasTdStyle, fontWeight: 'bold', border: '0.8pt solid #000', backgroundColor: '#fff' }}>
                    {card.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </fieldset>
        </div>
      </div>
    </div>
  )
}

function PengepakanPrintItem({ card }: { card: PengepakanCard }) {
  const jam1 = card.jamGroups.find(j => j.jamGroup.toLowerCase().includes('1')) || { jamGroup: 'JAM 1', rows: [], total: 0 }
  const jam2 = card.jamGroups.find(j => j.jamGroup.toLowerCase().includes('2')) || { jamGroup: 'JAM 2', rows: [], total: 0 }

  return (
    <div style={{
      width: '108mm',
      height: '330mm',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      backgroundColor: '#fff',
    }}>
      <div style={{
        width: '96mm',
        height: '142mm',
        border: '0.8pt solid #000',
        display: 'flex',
        flexDirection: 'row',
        boxSizing: 'border-box',
      }}>
        {/* Left Column - Vertical Header (Identical to Humas) */}
        <div style={{
          width: '21mm',
          height: '100%',
          borderRight: '0.8pt solid #000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4mm 0',
          boxSizing: 'border-box',
          position: 'relative',
        }}>
          {/* Rotated text centered vertically in upper area */}
          <div style={{
            position: 'absolute',
            top: '52mm',
            left: '10.5mm',
            width: '100mm',
            height: '21mm',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}>
            <div style={{ fontSize: '14pt', fontWeight: 900, lineHeight: 1, letterSpacing: '0.8px', color: '#000' }}>
              PANITIA
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 900, lineHeight: 1, marginTop: '2.5mm', letterSpacing: '0.5px', color: '#000' }}>
              EVALUASI HASIL BELAJAR
            </div>
            <div style={{ fontSize: '6.2pt', fontWeight: 'bold', lineHeight: 1, marginTop: '2mm', letterSpacing: '0.2px', color: '#000' }}>
              LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
            </div>
          </div>

          {/* Logo at the bottom */}
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logohitam.png" 
              alt="" 
              style={{ width: '13mm', height: '13mm', objectFit: 'contain' }} 
            />
          </div>
        </div>

        {/* Right Column - Main Details */}
        <div style={{
          flex: 1,
          height: '100%',
          padding: '4mm',
          boxSizing: 'border-box',
        }}>
          <fieldset style={{
            border: '0.8pt solid #000',
            borderRadius: '0px',
            padding: '2mm 3.5mm 3.5mm 3.5mm',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <legend style={{
              padding: '0 2.5mm',
              fontSize: '11.5pt',
              fontWeight: 500,
              fontFamily: 'Arial, Helvetica, sans-serif',
              letterSpacing: '1px',
              textAlign: 'center',
            }}>
              RUANG
            </legend>

            {/* Room Number */}
            <div style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '22pt',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: 1,
              marginTop: '0.5mm',
              marginBottom: '3.5mm',
              color: '#000',
            }}>
              {formatRoomNumber(card.nomorRuangan)}
            </div>

            {/* Table JAM 1 - 6 rows */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '9pt',
              color: '#000',
              marginBottom: '3mm',
            }}>
              <colgroup>
                <col style={{ width: '70%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#e5e5e5' }}>
                  <th colSpan={2} style={{ ...packingThStyle, height: '5.2mm', border: '0.8pt solid #000', fontWeight: 'bold' }}>
                    JAM 1
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#e5e5e5' }}>
                  <th style={{ ...packingThStyle, height: '4.8mm', border: '0.8pt solid #000' }}>MARHALAH</th>
                  <th style={{ ...packingThStyle, height: '4.8mm', border: '0.8pt solid #000' }}>JP</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, index) => {
                  const row = jam1.rows[index]
                  return (
                    <tr key={index}>
                      <td style={{ ...packingTdStyle, height: '4.5mm', fontSize: '9pt', border: '0.8pt solid #000', textAlign: 'center' }}>
                        {row?.kelas ?? ''}
                      </td>
                      <td style={{ ...packingTdStyle, height: '4.5mm', fontSize: '9pt', border: '0.8pt solid #000', textAlign: 'center' }}>
                        {row?.jumlah ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Table JAM 2 - 5 rows */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '9pt',
              color: '#000',
            }}>
              <colgroup>
                <col style={{ width: '70%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#e5e5e5' }}>
                  <th colSpan={2} style={{ ...packingThStyle, height: '5.2mm', border: '0.8pt solid #000', fontWeight: 'bold' }}>
                    JAM 2
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#e5e5e5' }}>
                  <th style={{ ...packingThStyle, height: '4.8mm', border: '0.8pt solid #000' }}>MARHALAH</th>
                  <th style={{ ...packingThStyle, height: '4.8mm', border: '0.8pt solid #000' }}>JP</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, index) => {
                  const row = jam2.rows[index]
                  return (
                    <tr key={index}>
                      <td style={{ ...packingTdStyle, height: '4.5mm', fontSize: '9pt', border: '0.8pt solid #000', textAlign: 'center' }}>
                        {row?.kelas ?? ''}
                      </td>
                      <td style={{ ...packingTdStyle, height: '4.5mm', fontSize: '9pt', border: '0.8pt solid #000', textAlign: 'center' }}>
                        {row?.jumlah ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </fieldset>
        </div>
      </div>
    </div>
  )
}

const humasThStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '11pt',
  fontWeight: 500,
  height: '7mm',
  padding: 0,
}

const humasTdStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '11pt',
  fontWeight: 400,
  height: '6.2mm',
  lineHeight: 1,
  padding: 0,
  verticalAlign: 'middle',
}

const packingThStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '10pt',
  fontWeight: 500,
  height: '5.2mm',
  padding: 0,
}

const packingTdStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '10.5pt',
  fontWeight: 400,
  height: '4.8mm',
  lineHeight: 1,
  padding: 0,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}

function PrintPreview<T extends PrintableCard>({
  items,
  renderItem,
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}) {
  return (
    <div className="bg-white shadow-2xl flex-shrink-0" style={{ zoom: 0.43 }}>
      <F4PairSheet items={items} renderItem={renderItem} />
    </div>
  )
}

const f4PortraitPageStyle = `
  @page { size: 216mm 330mm; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { box-sizing: border-box; }
  }
`

export function TempelanHumasView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [kelasList, setKelasList] = useState<TempelanHumasKelasOption[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [rows, setRows] = useState<TempelanHumasItem[]>([])
  const [bulkRows, setBulkRows] = useState<TempelanHumasItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Tempelan Humas EHB',
    pageStyle: f4PortraitPageStyle,
  })

  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Semua Tempelan Humas EHB',
    pageStyle: f4PortraitPageStyle,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      if (evt) {
        const kelas = await getTempelanHumasKelasList(evt.id)
        setKelasList(kelas)
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const cards = useMemo(() => buildHumasCards(rows), [rows])
  const bulkCards = useMemo(() => buildHumasCards(bulkRows), [bulkRows])

  const handleMuatPreview = async () => {
    if (!event) return
    if (!selectedKelas) return toast.error('Pilih kelas terlebih dahulu')

    setLoadingData(true)
    setHasLoaded(false)
    const data = await getTempelanHumasData(event.id, selectedKelas)
    setRows(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data untuk kelas ini')
  }

  const handleCetakSemua = async () => {
    if (!event) return
    setLoadingBulk(true)
    try {
      const data = await getTempelanHumasData(event.id)
      if (data.length === 0) {
        toast.error('Tidak ada data tempelan humas')
        setLoadingBulk(false)
        return
      }
      setBulkRows(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 800)
    } catch {
      toast.error('Gagal memuat data tempelan humas')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Humas" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Humas" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Filter Kelas</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Kelas</label>
            <select
              value={selectedKelas}
              onChange={e => {
                setSelectedKelas(e.target.value)
                setRows([])
                setHasLoaded(false)
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Pilih kelas --</option>
              {kelasList.map(kelas => (
                <option key={kelas.kelas_id} value={kelas.kelas_id}>
                  {formatTempelanClassName(kelas.nama_kelas, kelas.marhalah_nama)}
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
              {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Muat Preview
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
              <span className="font-bold text-slate-800">{cards.length}</span> tempelan siap
              {cards[0] && <span className="text-slate-400 ml-2">- {formatTempelanClassName(cards[0].namaKelas, cards[0].marhalahNama)} - F4 Portrait</span>}
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={cards.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Kelas Ini
            </button>
          </div>

          {cards.length > 0 && (
            <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[820px]">
              <PrintPreview items={cards} renderItem={card => <HumasPrintItem card={card} />} />
            </div>
          )}

          <div className="hidden">
            <div ref={printRef}>
              <F4PairSheet items={cards} renderItem={card => <HumasPrintItem card={card} />} />
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={bulkPrintRef}>
          <F4PairSheet items={bulkCards} renderItem={card => <HumasPrintItem card={card} />} />
        </div>
      </div>
    </div>
  )
}

export function TempelanPengepakanView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([])
  const [selectedRuangan, setSelectedRuangan] = useState<number | ''>('')
  const [rows, setRows] = useState<TempelanPengepakanItem[]>([])
  const [bulkRows, setBulkRows] = useState<TempelanPengepakanItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Tempelan Pengepakan EHB',
    pageStyle: f4PortraitPageStyle,
  })

  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Semua Tempelan Pengepakan EHB',
    pageStyle: f4PortraitPageStyle,
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

  const cards = useMemo(() => buildPengepakanCards(rows), [rows])
  const bulkCards = useMemo(() => buildPengepakanCards(bulkRows), [bulkRows])

  const handleMuatPreview = async () => {
    if (!event) return
    if (!selectedRuangan) return toast.error('Pilih ruangan terlebih dahulu')

    setLoadingData(true)
    setHasLoaded(false)
    const data = await getTempelanPengepakanData(event.id, selectedRuangan as number)
    setRows(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data untuk ruangan ini')
  }

  const handleCetakSemua = async () => {
    if (!event) return
    setLoadingBulk(true)
    try {
      const data = await getTempelanPengepakanData(event.id)
      if (data.length === 0) {
        toast.error('Tidak ada data tempelan pengepakan')
        setLoadingBulk(false)
        return
      }
      setBulkRows(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 800)
    } catch {
      toast.error('Gagal memuat data tempelan pengepakan')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Pengepakan" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Tempelan Pengepakan" onBack={onBack} />

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
                setRows([])
                setHasLoaded(false)
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Pilih ruangan --</option>
              {ruanganList.map(room => (
                <option key={room.id} value={room.id}>
                  Ruangan {formatRoomNumber(room.nomor_ruangan)}
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
              {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />} Muat Preview
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
              <span className="font-bold text-slate-800">{cards.length}</span> tempelan siap
              {cards[0] && <span className="text-slate-400 ml-2">- Ruangan {formatRoomNumber(cards[0].nomorRuangan)} - F4 Portrait</span>}
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={cards.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Ruangan Ini
            </button>
          </div>

          {cards.length > 0 && (
            <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[820px]">
              <PrintPreview items={cards} renderItem={card => <PengepakanPrintItem card={card} />} />
            </div>
          )}

          <div className="hidden">
            <div ref={printRef}>
              <F4PairSheet items={cards} renderItem={card => <PengepakanPrintItem card={card} />} />
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={bulkPrintRef}>
          <F4PairSheet items={bulkCards} renderItem={card => <PengepakanPrintItem card={card} />} />
        </div>
      </div>
    </div>
  )
}
