'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import { AlertTriangle, FileBadge, Filter, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForCetak,
  getTempelanPengepakanData,
  type ActiveEvent,
  type TempelanPengepakanItem,
} from './actions'
import { FONT, PageHeader, parseJamGroup } from './_shared'
import { formatTempelanClassName } from './_view-tempelan-humas-packing'

type PrintMode = 'semua' | 'jam' | 'ruangan'

type SampulCard = {
  key: string
  ruanganId: number
  nomorRuangan: number
  jamGroup: string
  semester: number
  tahunAjaranNama: string
  rows: { kelas: string; jumlah: number }[]
  total: number
}

function formatRoomNumber(roomNumber: number) {
  return String(roomNumber).padStart(2, '0')
}

function buildSampulCards(rows: TempelanPengepakanItem[]): SampulCard[] {
  const grouped = new Map<string, SampulCard>()

  rows.forEach(row => {
    const key = `${row.ruangan_id}-${row.jam_group}`
    const card = grouped.get(key) ?? {
      key,
      ruanganId: row.ruangan_id,
      nomorRuangan: row.nomor_ruangan,
      jamGroup: row.jam_group,
      semester: row.semester,
      tahunAjaranNama: row.tahun_ajaran_nama,
      rows: [],
      total: 0,
    }

    card.rows.push({
      kelas: formatTempelanClassName(row.nama_kelas, row.marhalah_nama),
      jumlah: Number(row.jumlah || 0),
    })
    card.total += Number(row.jumlah || 0)
    grouped.set(key, card)
  })

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (a.nomorRuangan !== b.nomorRuangan) return a.nomorRuangan - b.nomorRuangan
      return a.jamGroup.localeCompare(b.jamGroup)
    })
    .map(card => ({
      ...card,
      rows: card.rows.sort((a, b) => a.kelas.localeCompare(b.kelas)),
    }))
}

function SampulSheet({ card }: { card: SampulCard }) {
  const isJam1 = card.jamGroup.includes('1') || card.jamGroup.toLowerCase().includes('pertama') || card.jamGroup.toLowerCase() === 'ke-1'
  const themeColor = isJam1 ? '#ef4444' : '#22c55e'
  const jamText = parseJamGroup(card.jamGroup).toUpperCase()
  const jamNumber = card.jamGroup.match(/\d+/) ? card.jamGroup.match(/\d+/)![0] : (isJam1 ? '1' : '2')
  
  const semesterLabel = card.semester === 1 ? 'GANJIL' : 'GENAP'

  return (
    <div style={{
      width: '215mm',
      height: '330mm',
      padding: '15mm 20mm 15mm 30mm', // top, right, bottom, left (30mm for binding)
      boxSizing: 'border-box',
      fontFamily: '"Montserrat", "Arial", sans-serif',
      position: 'relative',
      backgroundColor: '#fff',
      breakAfter: 'page',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {/* 1. Top Right Logo */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', height: '20mm', marginTop: '-5mm' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3.5mm' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logohitam.png" alt="" style={{ width: '19mm', height: '19mm', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', color: '#000' }}>
            <div style={{ fontSize: '6.5pt', letterSpacing: '1px', marginBottom: '0.5mm' }}>LEMBAGA PENDIDIKAN</div>
            <div style={{ fontSize: '6.5pt', letterSpacing: '1px' }}>PONDOK PESANTREN</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', lineHeight: 0.9, marginTop: '1mm', fontFamily: 'Arial, sans-serif' }}>SUKAHIDENG</div>
            <div style={{ fontSize: '4.5pt', marginTop: '1.5mm', color: '#333' }}>Sukarame - Tasikmalaya - Jawa Barat</div>
          </div>
        </div>
      </div>

      {/* 2. Number and Jam Text */}
      <div style={{ position: 'relative', height: '55mm' }}>
        <div style={{
          position: 'absolute',
          top: '20mm',
          left: 0,
          right: '-20mm', // extends to the edge
          height: '24mm',
          backgroundColor: '#e5e5e5',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '45mm'
        }}>
          <span style={{ fontSize: '30pt', fontWeight: 900, color: '#000', fontFamily: 'Arial, sans-serif' }}>JAM {jamText}</span>
        </div>
        <div style={{
          position: 'absolute',
          top: 0,
          left: '10mm',
          fontSize: '170pt',
          fontWeight: 900,
          color: themeColor,
          lineHeight: 0.75,
          fontFamily: 'Arial, sans-serif',
          zIndex: 2
        }}>
          {jamNumber}
        </div>
      </div>

      {/* 3. EHB Title */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '10mm' }}>
        <div style={{ fontSize: '85pt', fontWeight: 'bold', lineHeight: 0.75, color: '#000', letterSpacing: '-3px', fontFamily: 'Arial, sans-serif' }}>EHB</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '6mm', color: '#000', alignSelf: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '22pt', fontWeight: 'bold', letterSpacing: '-1px', fontFamily: 'Arial, sans-serif' }}>SMT. {semesterLabel}</div>
          <div style={{ fontSize: '16pt', marginTop: '2mm', fontFamily: 'Arial, sans-serif' }}>T. A. {card.tahunAjaranNama}</div>
        </div>
      </div>

      {/* 4. RUANG and Number */}
      <div style={{ paddingLeft: '10mm' }}>
        <div style={{ fontSize: '28pt', fontWeight: 900, color: '#000', fontFamily: 'Arial, sans-serif' }}>RUANG</div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          paddingRight: '10mm',
          marginTop: '-15mm' // Pull number up next to RUANG
        }}>
          <div style={{ 
            fontSize: '180pt', 
            fontWeight: 900, 
            color: themeColor, 
            lineHeight: 0.75,
            fontFamily: 'Arial, sans-serif',
            letterSpacing: '-5px'
          }}>
            {formatRoomNumber(card.nomorRuangan)}
          </div>
        </div>
      </div>

      {/* 5. DATA PESERTA Table */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <table style={{
          width: '130mm',
          borderCollapse: 'collapse',
          fontFamily: 'Arial, sans-serif',
          border: `1.5pt solid ${themeColor}`
        }}>
          <thead>
            <tr>
              <th colSpan={2} style={{
                backgroundColor: themeColor,
                color: '#fff',
                padding: '3mm',
                fontSize: '14pt',
                fontWeight: 'bold',
                border: `1.5pt solid ${themeColor}`
              }}>DATA PESERTA</th>
            </tr>
            <tr>
              <th style={{
                backgroundColor: themeColor,
                color: '#fff',
                padding: '2.5mm',
                fontSize: '12pt',
                fontWeight: 'bold',
                border: `1.5pt solid ${themeColor}`,
                width: '70%'
              }}>KELAS</th>
              <th style={{
                backgroundColor: themeColor,
                color: '#fff',
                padding: '2.5mm',
                fontSize: '12pt',
                fontWeight: 'bold',
                border: `1.5pt solid ${themeColor}`,
                width: '30%'
              }}>JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row, idx) => (
              <tr key={idx}>
                <td style={{
                  border: `0.8pt solid ${themeColor}`,
                  padding: '2mm 4mm',
                  fontSize: '13pt',
                  textAlign: 'center',
                  color: '#000',
                  fontWeight: 'bold'
                }}>{row.kelas}</td>
                <td style={{
                  border: `0.8pt solid ${themeColor}`,
                  padding: '2mm 4mm',
                  fontSize: '13pt',
                  textAlign: 'center',
                  color: '#000',
                  fontWeight: 'bold'
                }}>{row.jumlah}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 6 - card.rows.length) }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td style={{ border: `0.8pt solid ${themeColor}`, padding: '2mm 4mm', height: '7mm' }}></td>
                <td style={{ border: `0.8pt solid ${themeColor}`, padding: '2mm 4mm' }}></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{
                backgroundColor: themeColor,
                color: '#fff',
                padding: '2.5mm',
                fontSize: '12pt',
                fontWeight: 'bold',
                border: `1.5pt solid ${themeColor}`,
                textAlign: 'center'
              }}>JUMLAH</td>
              <td style={{
                backgroundColor: themeColor,
                color: '#fff',
                padding: '2.5mm',
                fontSize: '12pt',
                fontWeight: 'bold',
                border: `1.5pt solid ${themeColor}`,
                textAlign: 'center'
              }}>{card.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function SampulPreview({ cards }: { cards: SampulCard[] }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {cards.slice(0, 3).map(card => (
        <div key={card.key} className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.38 }}>
          <SampulSheet card={card} />
        </div>
      ))}
      {cards.length > 3 && (
        <p className="text-xs font-semibold text-slate-500">Preview menampilkan 3 lembar pertama dari {cards.length} lembar.</p>
      )}
    </div>
  )
}

export function SampulAbsensiView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [data, setData] = useState<TempelanPengepakanItem[]>([])
  
  const [mode, setMode] = useState<PrintMode>('semua')
  const [selectedJam, setSelectedJam] = useState('')
  const [selectedRuangan, setSelectedRuangan] = useState('')
  
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Sampul Absensi EHB',
    pageStyle: `
      @page { size: 215mm 330mm; margin: 0; }
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
          const loaded = await getTempelanPengepakanData(evt.id)
          setData(loaded)
        } catch { }
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const allCards = useMemo(() => buildSampulCards(data), [data])
  
  const uniqueJamGroups = useMemo(() => Array.from(new Set(data.map(d => d.jam_group))).sort(), [data])
  const uniqueRuangan = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach(d => map.set(d.ruangan_id, formatRoomNumber(d.nomor_ruangan)))
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [data])

  useEffect(() => {
    if (!selectedJam && uniqueJamGroups[0]) setSelectedJam(uniqueJamGroups[0])
    if (!selectedRuangan && uniqueRuangan[0]) setSelectedRuangan(uniqueRuangan[0][0].toString())
  }, [uniqueJamGroups, uniqueRuangan, selectedJam, selectedRuangan])

  const filteredCards = useMemo(() => {
    if (mode === 'jam') return allCards.filter(c => c.jamGroup === selectedJam)
    if (mode === 'ruangan') return allCards.filter(c => c.ruanganId.toString() === selectedRuangan)
    return allCards
  }, [mode, selectedJam, selectedRuangan, allCards])

  const handleMuatPreview = () => {
    if (!event) return
    setHasLoaded(true)
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Sampul Absensi" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Sampul Absensi" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Preview Sampul Absensi</h3>
        </div>
        <div className="p-5 flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Mode Cetak
              <select
                value={mode}
                onChange={e => {
                  setMode(e.target.value as PrintMode)
                  setHasLoaded(false)
                }}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white"
              >
                <option value="semua">Semua Ruangan</option>
                <option value="jam">Per Jam</option>
                <option value="ruangan">Per Ruangan</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-500 uppercase">
              Jam Sesi
              <select
                value={selectedJam}
                onChange={e => {
                  setSelectedJam(e.target.value)
                  setHasLoaded(false)
                }}
                disabled={mode !== 'jam'}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {uniqueJamGroups.map(jam => (
                  <option key={jam} value={jam}>Jam {parseJamGroup(jam)}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-500 uppercase">
              Ruangan
              <select
                value={selectedRuangan}
                onChange={e => {
                  setSelectedRuangan(e.target.value)
                  setHasLoaded(false)
                }}
                disabled={mode !== 'ruangan'}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {uniqueRuangan.map(([id, label]) => (
                  <option key={id} value={id}>Ruang {label}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={handleMuatPreview}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
          >
            <FileBadge className="w-4 h-4" /> Muat Preview
          </button>
        </div>
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{filteredCards.length}</span> lembar siap dicetak
            </p>
            <button
              onClick={() => handlePrint()}
              disabled={filteredCards.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Sampul
            </button>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[900px]">
            {filteredCards.length > 0 ? (
              <SampulPreview cards={filteredCards} />
            ) : (
              <div className="py-16 text-sm font-semibold text-slate-500">Tidak ada data pada filter ini.</div>
            )}
          </div>

          <div className="hidden">
            <div ref={printRef}>
              {filteredCards.map(card => (
                <SampulSheet key={card.key} card={card} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
