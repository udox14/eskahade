'use client'

import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Printer, Loader2, AlertTriangle, ClipboardList, Filter,
} from 'lucide-react'
import {
  getActiveEventForCetak, getRuanganListForCetak, getJamGroupList,
  getDaftarHadirSesi, getDaftarHadirData, getDaftarHadirSemuaData,
  type ActiveEvent, type RuanganOption, type DaftarHadirSesi, type DaftarHadirItem, type DaftarHadirSemuaItem,
} from './actions'
import { toast } from 'sonner'
import { FONT, PageHeader } from './_shared'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNama(nama: string) {
  return nama.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function abbreviateAsrama(asrama: string | null, kamar: string | null) {
  if (!asrama) return '-'
  let abbr = asrama
  const mapping: Record<string, string> = {
    'AL-FALAH': 'ALF',
    'ASY-SYIFA 1': 'ASY 1',
    'ASY-SYIFA 2': 'ASY 2',
    'ASY-SYIFA 3': 'ASY 3',
    'ASY-SYIFA 4': 'ASY 4',
    'AS-SALAM': 'ASAS',
    'BAHAGIA': 'BHG',
    'AL-BAGHORY': 'BGR',
  }
  abbr = mapping[asrama] || asrama.substring(0, 3).toUpperCase()
  return `${abbr}/ ${kamar || '-'}`
}

function abbreviateKelas(kelas: string | null) {
  if (!kelas) return '-'
  return kelas
    .replace(/Tamhidiyyah/i, 'TMH')
    .replace(/Ibtidaiyyah/i, 'IBT')
    .replace(/Mutawassithah/i, 'MTW')
}

function getDayName(dateStr: string) {
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
  return days[new Date(dateStr).getDay()]
}

// ── Print Component ──────────────────────────────────────────────────────────

function DaftarHadirPrint({
  event,
  ruangan,
  jamGroup,
  peserta,
  sesiList,
  pageInfo
}: {
  event: ActiveEvent
  ruangan: number
  jamGroup: string
  peserta: DaftarHadirItem[]
  sesiList: DaftarHadirSesi[]
  pageInfo: { current: number; total: number }
}) {
  const sessionsByDate = sesiList.reduce((acc, s) => {
    if (!acc[s.tanggal]) acc[s.tanggal] = []
    acc[s.tanggal].push(s.label)
    return acc
  }, {} as Record<string, string[]>)

  const dates = Object.keys(sessionsByDate).sort()

  return (
    <div style={{
      width: '320mm',
      height: '200mm',
      padding: '15mm 5mm 5mm 5mm',
      boxSizing: 'border-box' as const,
      fontFamily: FONT,
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column' as const,
      breakAfter: 'page' as const,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', fontSize: '11pt', fontWeight: 900, borderBottom: '1.5pt solid #000', paddingBottom: '2mm', marginBottom: '3mm' }}>
        DAFTAR HADIR EVALUASI HASIL BELAJAR {event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'} T.A. {event.tahun_ajaran_nama} - {jamGroup.toUpperCase()} (RUANGAN {String(ruangan).padStart(2, '0')})
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2pt solid #000' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...thStyle, width: '8mm' }}>NO</th>
            <th rowSpan={2} style={{ ...thStyle, width: '22mm' }}>NO. PESERTA</th>
            <th rowSpan={2} style={{ ...thStyle, width: '60mm' }}>NAMA LENGKAP</th>
            <th rowSpan={2} style={{ ...thStyle, width: '25mm' }}>ASRAMA</th>
            <th rowSpan={2} style={{ ...thStyle, width: '18mm' }}>KELAS</th>
            {dates.map(date => (
              <th key={date} colSpan={sessionsByDate[date].length} style={thStyle}>
                {getDayName(date)}
              </th>
            ))}
          </tr>
          <tr>
            {dates.map(date => sessionsByDate[date].map((label, idx) => (
              <th key={`${date}-${idx}`} style={{ ...thStyle, fontSize: '7pt', padding: '1mm 0.5mm' }}>
                {label.toUpperCase()}
              </th>
            )))}
          </tr>
        </thead>
        <tbody>
          {peserta.map((p, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{i + 1 + (pageInfo.current - 1) * 20}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{p.nomor_peserta}</td>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatNama(p.nama_lengkap)}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontSize: '8pt' }}>{abbreviateAsrama(p.asrama, p.kamar)}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{abbreviateKelas(p.nama_kelas)}</td>
              {dates.map(date => sessionsByDate[date].map((_, idx) => (
                <td key={`${date}-${idx}`} style={{ ...tdStyle, minWidth: '15mm' }}></td>
              )))}
            </tr>
          ))}
          {/* Fill empty rows if less than 20 */}
          {Array.from({ length: Math.max(0, 20 - peserta.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ ...tdStyle, height: '8mm' }}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              {dates.map(date => sessionsByDate[date].map((_, idx) => (
                <td key={`${date}-${idx}`} style={tdStyle}></td>
              )))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Info */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '8pt', paddingTop: '2mm' }}>
        <div>Halaman {pageInfo.current} dari {pageInfo.total}</div>
        <div>Dicetak pada: {new Date().toLocaleString('id-ID')}</div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '2mm 1mm',
  fontSize: '8pt',
  fontWeight: 'bold',
  backgroundColor: '#f8fafc',
}

const tdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1mm 2mm',
  fontSize: '9pt',
  height: '7mm',
}

// ── Main View Component ──────────────────────────────────────────────────────

export function DaftarHadirView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([])
  const [jamGroupList, setJamGroupList] = useState<{ jam_group: string }[]>([])

  const [selectedRuangan, setSelectedRuangan] = useState<number | ''>('')
  const [selectedJamGroup, setSelectedJamGroup] = useState<string>('')

  const [pesertaData, setPesertaData] = useState<DaftarHadirItem[]>([])
  const [sesiList, setSesiList] = useState<DaftarHadirSesi[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Bulk Print State
  const [bulkData, setBulkData] = useState<DaftarHadirSemuaItem[]>([])
  const [loadingBulk, setLoadingBulk] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Blanko Daftar Hadir EHB',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  })

  const bulkPrintRef = useRef<HTMLDivElement>(null)
  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: `Semua Daftar Hadir - ${selectedJamGroup}`,
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      if (evt) {
        const [rl, jl] = await Promise.all([
          getRuanganListForCetak(evt.id),
          getJamGroupList(evt.id)
        ])
        setRuanganList(rl)
        setJamGroupList(jl)
        if (jl.length > 0) {
          const firstJam = jl[0].jam_group
          setSelectedJamGroup(firstJam)
          const sl = await getDaftarHadirSesi(evt.id, firstJam)
          setSesiList(sl)
        }
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const handleJamGroupChange = async (jg: string) => {
    setSelectedJamGroup(jg)
    setHasLoaded(false)
    if (event) {
      const sl = await getDaftarHadirSesi(event.id, jg)
      setSesiList(sl)
    }
  }

  const handleMuatPreview = async () => {
    if (!event) return
    if (!selectedRuangan) return toast.error('Pilih ruangan terlebih dahulu')
    if (!selectedJamGroup) return toast.error('Pilih jam group terlebih dahulu')

    setLoadingData(true)
    setHasLoaded(false)
    const data = await getDaftarHadirData(event.id, selectedRuangan as number, selectedJamGroup)
    setPesertaData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data peserta untuk filter ini')
  }

  const handleCetakSemua = async () => {
    if (!event || !selectedJamGroup) return
    setLoadingBulk(true)
    try {
      const data = await getDaftarHadirSemuaData(event.id, selectedJamGroup)
      if (data.length === 0) {
        toast.error('Tidak ada data untuk jam ini')
        setLoadingBulk(false)
        return
      }
      setBulkData(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 800)
    } catch (e) {
      toast.error('Gagal memuat data masal')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Blanko Daftar Hadir" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  const chunks = []
  for (let i = 0; i < pesertaData.length; i += 20) {
    chunks.push(pesertaData.slice(i, i + 20))
  }
  if (chunks.length === 0 && hasLoaded) chunks.push([]) // For empty preview

  // Group bulk data by room
  const bulkRooms = Array.from(new Set(bulkData.map(d => d.nomor_ruangan))).sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <PageHeader title="Blanko Daftar Hadir" onBack={onBack} />

      <div className="bg-white border rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Ruangan</label>
          <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- Pilih Ruangan --</option>
            {ruanganList.map(r => <option key={r.id} value={r.id}>Ruangan {String(r.nomor_ruangan).padStart(2, '0')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Jam</label>
          <select value={selectedJamGroup} onChange={e => handleJamGroupChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {jamGroupList.map(j => <option key={j.jam_group} value={j.jam_group}>{j.jam_group}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleMuatPreview} disabled={loadingData || loadingBulk} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]">
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Muat Preview
          </button>
        </div>
        <div className="flex items-end">
          <button onClick={handleCetakSemua} disabled={loadingBulk || loadingData} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center justify-center gap-2 h-[38px]">
            {loadingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Cetak Semua
          </button>
        </div>
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{pesertaData.length}</span> peserta ditemukan
              <span className="text-slate-400 ml-2">· {chunks.length} lembar F4 Landscape</span>
            </p>
            <button onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all">
              <Printer className="w-4 h-4" /> Cetak Ruangan Ini
            </button>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex flex-col items-center gap-6 overflow-auto max-h-[800px]">
            {chunks.map((chunk, idx) => (
              <div key={idx} className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.35 }}>
                <DaftarHadirPrint
                  event={event}
                  ruangan={selectedRuangan as number}
                  jamGroup={selectedJamGroup}
                  peserta={chunk}
                  sesiList={sesiList}
                  pageInfo={{ current: idx + 1, total: chunks.length }}
                />
              </div>
            ))}
          </div>

          <div className="hidden">
            <div ref={printRef}>
              {chunks.map((chunk, idx) => (
                <DaftarHadirPrint
                  key={idx}
                  event={event}
                  ruangan={selectedRuangan as number}
                  jamGroup={selectedJamGroup}
                  peserta={chunk}
                  sesiList={sesiList}
                  pageInfo={{ current: idx + 1, total: chunks.length }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Bulk Print Area */}
      <div className="hidden">
        <div ref={bulkPrintRef}>
          {bulkRooms.map(nr => {
            const roomPeserta = bulkData.filter(d => d.nomor_ruangan === nr)
            const roomChunks = []
            for (let i = 0; i < roomPeserta.length; i += 20) {
              roomChunks.push(roomPeserta.slice(i, i + 20))
            }
            return roomChunks.map((chunk, idx) => (
              <DaftarHadirPrint
                key={`${nr}-${idx}`}
                event={event}
                ruangan={nr}
                jamGroup={selectedJamGroup}
                peserta={chunk}
                sesiList={sesiList}
                pageInfo={{ current: idx + 1, total: roomChunks.length }}
              />
            ))
          })}
        </div>
      </div>
    </div>
  )
}
