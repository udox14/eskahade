'use client'

import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Printer, Loader2, AlertTriangle, Hash, Filter,
} from 'lucide-react'
import {
  getActiveEventForCetak, getRuanganListForCetak, getNomorPesertaData,
  type ActiveEvent, type RuanganOption, type NomorPesertaItem,
} from './actions'
import { toast } from 'sonner'
import { FONT, PageHeader } from './_shared'

// ── Nomor Peserta Print Component ─────────────────────────────────────────────

export function NomorPrint({ data }: { data: NomorPesertaItem }) {
  const semLabel = data.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const ta       = data.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{
      width: '100mm',
      height: '53mm',
      border: '2pt solid #000',
      boxSizing: 'border-box' as const,
      fontFamily: FONT,
      display: 'flex',
      flexDirection: 'column' as const,
      breakInside: 'avoid' as const,
      pageBreakInside: 'avoid' as const,
      overflow: 'hidden',
      backgroundColor: '#fff',
    }}>
      {/* Header section */}
      <div style={{ 
        padding: '3mm', 
        borderBottom: '2pt solid #000', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '2.5mm',
        flexShrink: 0
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logohitam.png"
          alt=""
          style={{ width: '13mm', height: '13mm', objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' as const, textAlign: 'left' }}>
          <div style={{ fontSize: '9pt', fontWeight: 900, lineHeight: 1.1 }}>EVALUASI HASIL BELAJAR</div>
          <div style={{ fontSize: '8pt', fontWeight: 900, lineHeight: 1.1 }}>{semLabel}</div>
          <div style={{ fontSize: '8pt', fontWeight: 900, lineHeight: 1.1 }}>T.A. {ta}</div>
          <div style={{ fontSize: '4.5pt', fontWeight: 'normal', lineHeight: 1.1, marginTop: '1mm', textTransform: 'uppercase' as const }}>
            Lembaga Pendidikan Pondok Pesantren Sukahideng
          </div>
        </div>
      </div>
      
      {/* Number section */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2mm' }}>
        <div style={{ 
          fontSize: '75pt', 
          fontWeight: 900, 
          lineHeight: 1,
          letterSpacing: '-1px'
        }}>
          {data.nomor_peserta}
        </div>
      </div>
    </div>
  )
}

function NomorPreview({ data }: { data: NomorPesertaItem }) {
  return (
    <div style={{ display: 'inline-block', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ zoom: 0.6 }}>
        <NomorPrint data={data} />
      </div>
    </div>
  )
}

// ── Nomor Peserta View Component ──────────────────────────────────────────────

export function NomorPesertaView({ onBack }: { onBack: () => void }) {
  const [event, setEvent]             = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([])
  const [filterMode, setFilterMode]   = useState<'semua' | 'ruangan'>('semua')
  const [selectedRuangan, setSelectedRuangan] = useState<number | ''>('')
  const [nomorData, setNomorData]     = useState<NomorPesertaItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded]     = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Nomor Peserta EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 5mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif !important; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const evt = await getActiveEventForCetak()
      setEvent(evt)
      if (evt) {
        const rl = await getRuanganListForCetak(evt.id)
        setRuanganList(rl)
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const handleMuatPreview = async () => {
    if (!event) return
    if (filterMode === 'ruangan' && !selectedRuangan) return toast.error('Pilih ruangan terlebih dahulu')
    setLoadingData(true)
    setHasLoaded(false)
    const data = await getNomorPesertaData(
      event.id,
      filterMode === 'ruangan' ? (selectedRuangan as number) : undefined,
    )
    setNomorData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data untuk filter ini')
  }

  const handleFilterModeChange = (mode: 'semua' | 'ruangan') => {
    setFilterMode(mode)
    setSelectedRuangan('')
    setHasLoaded(false)
    setNomorData([])
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Nomor Peserta" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Nomor Peserta" onBack={onBack} />

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
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {[
              { val: 'semua',   label: 'Semua Ruangan' },
              { val: 'ruangan', label: 'Per Ruangan'   },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => handleFilterModeChange(val as 'semua' | 'ruangan')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  filterMode === val
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filterMode === 'ruangan' && (
            <div className="max-w-xs">
              <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Ruangan</label>
              <select
                value={selectedRuangan}
                onChange={e => setSelectedRuangan(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Pilih Ruangan --</option>
                {ruanganList.map(r => (
                  <option key={r.id} value={r.id}>
                    Ruangan {String(r.nomor_ruangan).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />} Muat Preview
          </button>
        </div>
      </div>

      {hasLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{nomorData.length}</span> nomor siap cetak
              <span className="text-slate-400 ml-2">· {Math.ceil(nomorData.length / 12)} lembar F4</span>
            </p>
            <button
              onClick={() => handlePrint()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Cetak Sekarang
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {nomorData.map((d, i) => <NomorPreview key={i} data={d} />)}
          </div>

          <div className="hidden">
            <div ref={printRef} style={{ width: '210mm' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 100mm)', gap: '1mm' }}>
                {nomorData.map((d, i) => <NomorPrint key={i} data={d} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
