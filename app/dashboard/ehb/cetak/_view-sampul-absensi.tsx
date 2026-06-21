'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import { AlertTriangle, FileBadge, Filter, Loader2, Printer, Settings2, Save } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getActiveEventForCetak,
  getTempelanPengepakanData,
  getSampulSettings,
  setSampulSettings,
  type ActiveEvent,
  type TempelanPengepakanItem,
} from './actions'
import { PageHeader, parseJamGroup } from './_shared'
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

type SampulSettings = {
  ruangX: number
  ruangY: number
  ruangSize: number
  tableX: number
  tableY: number
  tableScale: number
}

const DEFAULT_SETTINGS: SampulSettings = {
  ruangX: 105,
  ruangY: 135,
  ruangSize: 180,
  tableX: 0,
  tableY: 200,
  tableScale: 100
}

function SampulSheet({ card, settings }: { card: SampulCard, settings: SampulSettings }) {
  const isJam1 = card.jamGroup.includes('1') || card.jamGroup.toLowerCase().includes('pertama') || card.jamGroup.toLowerCase() === 'ke-1'
  const themeColor = isJam1 ? '#b91c1c' : '#15803d' // Darker red and darker green
  
  // Background images
  const bgImage = isJam1 ? '/bg-sampul-1.png' : '/bg-sampul-2.png'

  return (
    <div style={{
      width: '215mm',
      height: '330mm',
      boxSizing: 'border-box',
      fontFamily: '"Montserrat", "Arial", sans-serif',
      position: 'relative',
      backgroundColor: '#fff',
      breakAfter: 'page',
      overflow: 'hidden'
    }}>
      {/* Background Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={bgImage} 
        alt="" 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: 0, 
          objectFit: 'fill' 
        }} 
      />

      {/* Room Number */}
      <div style={{
        position: 'absolute',
        left: `${settings.ruangX}mm`,
        top: `${settings.ruangY}mm`,
        fontSize: `${settings.ruangSize}pt`,
        fontWeight: 900,
        color: themeColor,
        lineHeight: 0.8,
        letterSpacing: '-2px',
        zIndex: 1,
      }}>
        {formatRoomNumber(card.nomorRuangan)}
      </div>

      {/* Table DATA PESERTA */}
      <div style={{
        position: 'absolute',
        top: `${settings.tableY}mm`,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1,
      }}>
        <div style={{
          transform: `scale(${settings.tableScale / 100}) translateX(${settings.tableX}mm)`,
          transformOrigin: 'top center'
        }}>
          <table style={{
            width: '130mm',
            borderCollapse: 'collapse',
            fontFamily: 'Arial, sans-serif',
            border: '2pt solid #000',
            backgroundColor: '#fff'
          }}>
            <thead>
              <tr>
                <th colSpan={2} style={{
                  backgroundColor: themeColor,
                  color: '#fff',
                  padding: '3mm',
                  fontSize: '14pt',
                  fontWeight: 'bold',
                  border: '1.5pt solid #000'
                }}>DATA PESERTA</th>
              </tr>
              <tr>
                <th style={{
                  backgroundColor: themeColor,
                  color: '#fff',
                  padding: '2.5mm',
                  fontSize: '12pt',
                  fontWeight: 'bold',
                  border: '1.5pt solid #000',
                  width: '70%'
                }}>KELAS</th>
                <th style={{
                  backgroundColor: themeColor,
                  color: '#fff',
                  padding: '2.5mm',
                  fontSize: '12pt',
                  fontWeight: 'bold',
                  border: '1.5pt solid #000',
                  width: '30%'
                }}>JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{
                    border: '1pt solid #000',
                    padding: '2mm 4mm',
                    fontSize: '13pt',
                    textAlign: 'center',
                    color: '#000',
                    fontWeight: 'bold'
                  }}>{row.kelas}</td>
                  <td style={{
                    border: '1pt solid #000',
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
                  <td style={{ border: '1pt solid #000', padding: '2mm 4mm', height: '7mm' }}></td>
                  <td style={{ border: '1pt solid #000', padding: '2mm 4mm' }}></td>
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
                  border: '1.5pt solid #000',
                  textAlign: 'center'
                }}>JUMLAH</td>
                <td style={{
                  backgroundColor: themeColor,
                  color: '#fff',
                  padding: '2.5mm',
                  fontSize: '12pt',
                  fontWeight: 'bold',
                  border: '1.5pt solid #000',
                  textAlign: 'center'
                }}>{card.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function SampulPreview({ cards, settings }: { cards: SampulCard[], settings: SampulSettings }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {cards.slice(0, 3).map(card => (
        <div key={card.key} className="bg-white shadow-xl flex-shrink-0" style={{ zoom: 0.38 }}>
          <SampulSheet card={card} settings={settings} />
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
  const [savingSettings, setSavingSettings] = useState(false)
  
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<SampulSettings>(DEFAULT_SETTINGS)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Sampul Map EHB',
    pageStyle: `
      @page { size: 215mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const [evt, dbSettings] = await Promise.all([
        getActiveEventForCetak(),
        getSampulSettings()
      ])
      
      if (dbSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...dbSettings })
      }

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

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await setSampulSettings(settings)
      toast.success('Konfigurasi posisi berhasil disimpan!')
    } catch {
      toast.error('Gagal menyimpan konfigurasi.')
    } finally {
      setSavingSettings(false)
    }
  }

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
      <PageHeader title="Sampul Map" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Sampul Map" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm">Preview Sampul Map</h3>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Pengaturan Posisi Tabel & Angka"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        {showSettings && (
          <div className="bg-slate-100 border-b border-indigo-100 p-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <label className="text-xs font-bold text-slate-600 block">
                Posisi Ruang X
                <input type="range" min="0" max="215" value={settings.ruangX} onChange={e => setSettings({...settings, ruangX: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.ruangX} mm</div>
              </label>
              <label className="text-xs font-bold text-slate-600 block">
                Posisi Ruang Y
                <input type="range" min="0" max="330" value={settings.ruangY} onChange={e => setSettings({...settings, ruangY: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.ruangY} mm</div>
              </label>
              <label className="text-xs font-bold text-slate-600 block">
                Ukuran Font Ruang
                <input type="range" min="50" max="300" value={settings.ruangSize} onChange={e => setSettings({...settings, ruangSize: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.ruangSize} pt</div>
              </label>
              
              <label className="text-xs font-bold text-slate-600 block">
                Posisi Tabel X
                <input type="range" min="-100" max="100" value={settings.tableX} onChange={e => setSettings({...settings, tableX: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.tableX} mm</div>
              </label>
              <label className="text-xs font-bold text-slate-600 block">
                Posisi Tabel Y
                <input type="range" min="0" max="330" value={settings.tableY} onChange={e => setSettings({...settings, tableY: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.tableY} mm</div>
              </label>
              <label className="text-xs font-bold text-slate-600 block">
                Skala Tabel (%)
                <input type="range" min="50" max="150" value={settings.tableScale} onChange={e => setSettings({...settings, tableScale: Number(e.target.value)})} className="w-full mt-2 accent-indigo-600" />
                <div className="text-center mt-1 text-slate-500">{settings.tableScale}%</div>
              </label>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan ke Database
              </button>
            </div>
          </div>
        )}

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
              <Printer className="w-4 h-4" /> Cetak Sampul Map
            </button>
          </div>

          <div className="bg-slate-100 border rounded-2xl p-4 flex justify-center overflow-auto max-h-[900px]">
            {filteredCards.length > 0 ? (
              <SampulPreview cards={filteredCards} settings={settings} />
            ) : (
              <div className="py-16 text-sm font-semibold text-slate-500">Tidak ada data pada filter ini.</div>
            )}
          </div>

          <div className="hidden">
            <div ref={printRef}>
              {filteredCards.map(card => (
                <SampulSheet key={card.key} card={card} settings={settings} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
