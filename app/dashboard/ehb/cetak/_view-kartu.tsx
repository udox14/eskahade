'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Printer, Loader2, AlertTriangle, Users, Filter, Search,
} from 'lucide-react'
import {
  getActiveEventForCetak, getMarhalahListForCetak, getKelasListForCetak,
  getKartuPesertaData, getSantriListForCetak,
  type ActiveEvent, type KartuData, type MarhalahOption, type KelasOption, type PesertaOption,
} from './actions'
import { toast } from 'sonner'
import { 
  FONT, parseJamGroup, PageHeader, HeaderCetak, TataTertibCetak 
} from './_shared'

type FilterType = 'semua' | 'marhalah' | 'kelas' | 'pilihan' | 'blanko'

// ── Kartu Print Component ─────────────────────────────────────────────────────

export function KartuPrint({ data }: { data: KartuData }) {
  const jam = parseJamGroup(data.jam_group)
  const displayNama = data.nama_lengkap
    .replace(/\bM[ou]c?ham+ad\b/gi, 'M.')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div style={{
      width: '158mm',
      height: '98mm',
      border: '1.2pt solid #000',
      padding: '4mm',
      boxSizing: 'border-box' as const,
      fontFamily: FONT,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0',
      breakInside: 'avoid' as const,
      pageBreakInside: 'avoid' as const,
      overflow: 'hidden',
      backgroundColor: '#fff',
    }}>
      <HeaderCetak semester={data.semester} tahun_ajaran_nama={data.tahun_ajaran_nama} />

      <div style={{ marginTop: '2mm', flexShrink: 0 }}>
        <div style={{ fontSize: '8pt', color: '#000', marginBottom: '1mm', paddingLeft: '2mm' }}>
          No. Peserta
        </div>
        <div style={{ display: 'flex', gap: '6mm', alignItems: 'flex-start' }}>
          <div style={{
            width: '32mm',
            flexShrink: 0,
            border: '1pt solid #000',
            display: 'flex',
            flexDirection: 'column' as const,
            textAlign: 'center' as const,
            overflow: 'hidden'
          }}>
            <div style={{ fontSize: '20pt', fontWeight: 900, lineHeight: '1.2', padding: '1.5mm 0', backgroundColor: '#fff' }}>
              {data.nomor_peserta}
            </div>
            <div style={{ backgroundColor: '#333', color: '#fff', padding: '1.5mm 1mm', lineHeight: '1.2' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', letterSpacing: '1px' }}>JAM</div>
              <div style={{ fontSize: '12pt', fontWeight: 900 }}>{jam}</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-start', overflow: 'hidden' }}>
            <div style={{
              fontSize: displayNama.length > 35 ? '16pt' : displayNama.length > 25 ? '20pt' : '25pt',
              fontWeight: 900,
              lineHeight: '1',
              marginBottom: '2mm',
              marginTop: '-1mm',
              whiteSpace: 'nowrap',
            }}>
              {displayNama}
            </div>
            <div style={{ borderTop: '0.8pt solid #000', marginTop: '1mm', paddingTop: '2mm', display: 'flex', fontSize: '15pt', fontWeight: 'normal' }}>
              <div style={{ flex: 1, textAlign: 'left' }}>{data.asrama_kamar}</div>
              <div style={{ width: '1px', backgroundColor: '#000', height: '6mm', margin: '0 4mm' }} />
              <div style={{ flex: 1.5, textAlign: 'left' }}>{data.nama_kelas || '-'}</div>
            </div>
          </div>
        </div>
      </div>
      <TataTertibCetak />
    </div>
  )
}

// ── Blanko Kartu Print ────────────────────────────────────────────────────────

export function BlankoKartuPrint({ event, jamLabel }: { event: ActiveEvent; jamLabel: string }) {
  return (
    <div style={{
      width: '158mm',
      height: '98mm',
      border: '1.2pt solid #000',
      padding: '4mm',
      boxSizing: 'border-box' as const,
      fontFamily: FONT,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0',
      breakInside: 'avoid' as const,
      pageBreakInside: 'avoid' as const,
      overflow: 'hidden',
      backgroundColor: '#fff',
    }}>
      <HeaderCetak semester={event.semester} tahun_ajaran_nama={event.tahun_ajaran_nama} />

      <div style={{ marginTop: '2mm', flexShrink: 0 }}>
        <div style={{ fontSize: '8pt', color: '#000', marginBottom: '1mm', paddingLeft: '2mm' }}>
          No. Peserta
        </div>
        <div style={{ display: 'flex', gap: '8mm', alignItems: 'flex-start' }}>
          <div style={{
            width: '32mm',
            height: '24mm',
            flexShrink: 0,
            border: '1pt solid #000',
            display: 'flex',
            flexDirection: 'column' as const,
            textAlign: 'center' as const,
            overflow: 'hidden'
          }}>
            <div style={{ flex: 1, backgroundColor: '#fff' }} />
            <div style={{ backgroundColor: '#333', color: '#fff', padding: '2mm 1mm', lineHeight: '1.2' }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', letterSpacing: '1px' }}>JAM</div>
              <div style={{ fontSize: '12pt', fontWeight: 900 }}>{jamLabel.toUpperCase()}</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '1.5mm', paddingTop: '0.5mm' }}>
            {[
              { label: 'Nama' },
              { label: 'Asrama' },
              { label: 'Marhalah' }
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-end', gap: '3mm' }}>
                <div style={{ fontSize: '15pt', fontWeight: 'normal', width: '22mm', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.label}</span>
                  <span>:</span>
                </div>
                <div style={{ flex: 1, borderBottom: '0.8pt solid #000', height: '18pt' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <TataTertibCetak />
    </div>
  )
}

function KartuPreview({ data }: { data: KartuData }) {
  return (
    <div style={{ display: 'inline-block', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ zoom: 0.63 }}>
        <KartuPrint data={data} />
      </div>
    </div>
  )
}

// ── Kartu Peserta View Component ──────────────────────────────────────────────

export function KartuPesertaView({ onBack }: { onBack: () => void }) {
  const [event, setEvent]           = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)
  const [filterType, setFilterType]  = useState<FilterType>('semua')
  const [marhalahList, setMarhalahList] = useState<MarhalahOption[]>([])
  const [kelasList, setKelasList]    = useState<KelasOption[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState<number | ''>('')
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  const [kartuData, setKartuData]    = useState<KartuData[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded]    = useState(false)

  const [jamBlanko, setJamBlanko] = useState<string>('Pertama')
  const [pesertaPool, setPesertaPool]   = useState<PesertaOption[]>([])
  const [loadingPool, setLoadingPool]   = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: filterType === 'blanko' ? 'Blanko Kartu EHB' : 'Kartu Peserta EHB',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 5mm; }
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
        const ml = await getMarhalahListForCetak(evt.id)
        setMarhalahList(ml)
      }
      setLoadingInit(false)
    }
    init()
  }, [])

  const handleMarhalahChange = useCallback(async (id: number | '') => {
    setSelectedMarhalah(id)
    setSelectedKelas('')
    if (!event || id === '') { setKelasList([]); return }
    const kl = await getKelasListForCetak(event.id, id as number)
    setKelasList(kl)
  }, [event])

  const handleFilterTypeChange = useCallback(async (type: FilterType) => {
    setFilterType(type)
    setSelectedMarhalah('')
    setSelectedKelas('')
    setHasLoaded(false)
    setKartuData([])
    setKelasList([])
    setSearchQuery('')
    setSelectedIds(new Set())
    if (type === 'kelas' && event) {
      const kl = await getKelasListForCetak(event.id)
      setKelasList(kl)
    }
    if (type === 'pilihan' && event && pesertaPool.length === 0) {
      setLoadingPool(true)
      const pool = await getSantriListForCetak(event.id)
      setPesertaPool(pool)
      setLoadingPool(false)
    }
  }, [event, pesertaPool.length])

  const handleMuatPreview = async () => {
    if (!event) return
    if (filterType === 'marhalah' && !selectedMarhalah)  return toast.error('Pilih marhalah terlebih dahulu')
    if (filterType === 'kelas' && !selectedKelas)         return toast.error('Pilih kelas terlebih dahulu')
    if (filterType === 'pilihan' && selectedIds.size === 0) return toast.error('Pilih minimal 1 peserta')
    setLoadingData(true)
    setHasLoaded(false)
    const data = await getKartuPesertaData(event.id, {
      type:       filterType,
      marhalahId: filterType === 'marhalah' ? (selectedMarhalah as number) : undefined,
      kelasId:    filterType === 'kelas'    ? selectedKelas                : undefined,
      santriIds:  filterType === 'pilihan'  ? Array.from(selectedIds)      : undefined,
    })
    setKartuData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data peserta untuk filter ini')
  }

  if (loadingInit) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Kartu Peserta EHB" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Kartu Peserta EHB" onBack={onBack} />

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Filter Peserta</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { val: 'semua',    label: 'Semua Peserta' },
              { val: 'marhalah', label: 'Per Marhalah'  },
              { val: 'kelas',    label: 'Per Kelas'     },
              { val: 'pilihan',  label: 'Pilih Sendiri' },
              { val: 'blanko',   label: 'Blanko Kosong' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => handleFilterTypeChange(val as FilterType)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  filterType === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(filterType === 'marhalah' || filterType === 'kelas') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Marhalah</label>
                <select value={selectedMarhalah} onChange={e => handleMarhalahChange(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih Marhalah --</option>
                  {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              {filterType === 'kelas' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Kelas</label>
                  <select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!selectedMarhalah}>
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {filterType === 'pilihan' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Cari nama..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full border rounded-lg pl-9 pr-4 py-2 text-sm" />
              </div>
              <div className="border rounded-xl overflow-y-auto divide-y" style={{ maxHeight: '280px' }}>
                {loadingPool ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div> : pesertaPool.filter(p => p.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
                  const checked = selectedIds.has(p.santri_id)
                  return (
                    <label key={p.santri_id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 ${checked ? 'bg-indigo-50' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedIds(prev => {
                        const next = new Set(prev)
                        next.has(p.santri_id) ? next.delete(p.santri_id) : next.add(p.santri_id)
                        return next
                      })} className="w-4 h-4" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nama_lengkap}</p>
                        <p className="text-xs text-slate-400">{p.nama_kelas} · No. {p.nomor_peserta}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {filterType === 'blanko' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Sesi Jam Untuk Blanko</label>
              <div className="flex gap-2">
                {['Pertama', 'Kedua'].map(j => (
                  <button
                    key={j}
                    onClick={() => setJamBlanko(j)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                      jamBlanko === j ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    Jam {j}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filterType !== 'blanko' && (
            <button onClick={handleMuatPreview} disabled={loadingData} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2">
              {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Muat Preview
            </button>
          )}

          {filterType === 'blanko' && (
            <button onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95">
              <Printer className="w-4 h-4" /> Cetak Blanko (4 Kartu)
            </button>
          )}
        </div>
      </div>

      {hasLoaded && filterType !== 'blanko' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{kartuData.length}</span> kartu siap cetak
            </p>
            <button onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all">
              <Printer className="w-4 h-4" /> Cetak Sekarang
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {kartuData.map((d, i) => <KartuPreview key={i} data={d} />)}
          </div>
          <div className="hidden">
            <div ref={printRef} style={{ width: '330mm' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4mm' }}>
                {kartuData.map((d, i) => <KartuPrint key={i} data={d} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {filterType === 'blanko' && (
        <div className="bg-slate-100 border rounded-2xl p-4 flex flex-col items-center gap-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pratinjau Cetak (Skala Tampilan)</div>
          <div className="w-full overflow-auto flex justify-center bg-slate-200/50 rounded-xl p-4 shadow-inner" style={{ maxHeight: '600px' }}>
            <div style={{ zoom: 0.5, transformOrigin: 'top center' }}>
              <div className="bg-white shadow-2xl p-[5mm]" style={{ width: '330mm', minWidth: '330mm' }}>
                 <div className="grid grid-cols-2 gap-[4mm]">
                   {[1, 2, 3, 4].map(i => (
                     <BlankoKartuPrint key={i} event={event} jamLabel={jamBlanko.toUpperCase()} />
                   ))}
                 </div>
              </div>
            </div>
          </div>
          <div className="hidden">
            <div ref={printRef} style={{ width: '330mm' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4mm' }}>
                {[1, 2, 3, 4].map(i => (
                  <BlankoKartuPrint key={i} event={event} jamLabel={jamBlanko.toUpperCase()} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
