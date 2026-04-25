'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Printer, ChevronLeft, CreditCard, Hash,
  ClipboardList, LayoutList, CalendarCheck, Calendar,
  Construction, Loader2, AlertTriangle, Users, Filter, Search, X,
} from 'lucide-react'
import {
  getActiveEventForCetak, getMarhalahListForCetak, getKelasListForCetak,
  getKartuPesertaData, getSantriListForCetak,
  getRuanganListForCetak, getNomorPesertaData,
  type ActiveEvent, type KartuData, type MarhalahOption, type KelasOption, type PesertaOption,
  type RuanganOption, type NomorPesertaItem,
} from './actions'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type View =
  | 'menu'
  | 'kartu-peserta'
  | 'nomor-peserta'
  | 'daftar-hadir'
  | 'tempelan-ruangan'
  | 'jadwal-mengawas'
  | 'jadwal-ehb'

type FilterType = 'semua' | 'marhalah' | 'kelas' | 'pilihan' | 'blanko'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDINAL: Record<string, string> = {
  '1': 'PERTAMA', '2': 'KEDUA', '3': 'KETIGA', '4': 'KEEMPAT',
  '5': 'KELIMA', '6': 'KEENAM', '7': 'KETUJUH', '8': 'KEDELAPAN',
}

function parseJamGroup(jamGroup: string): string {
  const match = jamGroup.match(/(\d+)/)
  if (match) return ORDINAL[match[1]] ?? `KE-${match[1]}`
  return jamGroup.toUpperCase()
}

const FONT = '"Times New Roman", Times, serif'

// ── Shared Print Components ──────────────────────────────────────────────────

function HeaderCetak({ semester, tahun_ajaran_nama }: { semester: number; tahun_ajaran_nama: string }) {
  const semLabel  = semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const ta        = tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '4mm', 
      flexShrink: 0, 
      marginBottom: '2mm',
      width: '100%'
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logohitam.png"
        alt=""
        style={{ width: '20mm', height: '20mm', objectFit: 'contain', flexShrink: 0 }}
      />
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 0.5, marginBottom: '4mm' }}>
          EVALUASI HASIL BELAJAR
        </div>
        <div style={{ fontSize: '15pt', fontWeight: 'normal', lineHeight: 0.5, marginBottom: '3mm' }}>
          {semLabel} T.A. {ta}
        </div>
        <div style={{ fontSize: '8.5pt', fontWeight: 'normal', lineHeight: 0.5, textTransform: 'uppercase' }}>
          LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
        </div>
        <div style={{ borderBottom: '1pt solid #000', marginTop: '3mm', width: '100%' }} />
      </div>
    </div>
  )
}

function TataTertibCetak() {
  return (
    <div style={{
      marginTop: 'auto',
      border: '0.8pt solid #000',
      padding: '2mm 3mm',
      position: 'relative' as const,
    }}>
      <div style={{
        position: 'absolute' as const,
        top: '-1.5mm',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fff',
        padding: '0 3mm',
        fontSize: '7.5pt',
        fontWeight: 'bold',
        whiteSpace: 'nowrap' as const,
      }}>
        TATA TERTIB PESERTA
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: '0 6mm',
        fontSize: '6.5pt',
        lineHeight: '1.5',
        fontFamily: FONT,
        paddingTop: '1mm',
      }}>
        <div>
          <div>1. Seluruh santri wajib mengikuti kegiatan EHB</div>
          <div>2. Membawa kartu peserta ke dalam ruangan</div>
          <div>3. Mengikuti EHB sesuai ruangan dan jadwal</div>
          <div>4. Ketentuan pakaian peserta:</div>
          <div style={{ paddingLeft: '5mm' }}>a. Putra: seragam berjama&#39;ah</div>
          <div style={{ paddingLeft: '5mm' }}>b. Putri: maksi hitam, baju dan kerudung putih</div>
          <div>5. Dilarang membawa catatan dalam bentuk apapun</div>
        </div>
        <div>
          <div>6. Menempati tempat duduk sesuai nomor urut</div>
          <div>7. Hadir di ruangan 10 menit sebelum EHB dimulai</div>
          <div>8. Dilarang bekerja sama dalam pengerjaan soal</div>
          <div>9. Mengisi dan melengkapi identitas pada lembar jawaban</div>
          <div>10. Mengisi daftar hadir sesuai dengan urutan nomor tes</div>
          <div>11. Boleh menanyakan hal yang tidak dimengerti kepada pengawas selain kisi-kisi atau jawaban</div>
        </div>
      </div>
    </div>
  )
}

// ── Kartu Print (presisi mm, Times New Roman) ─────────────────────────────────

function KartuPrint({ data }: { data: KartuData }) {
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

// ── Blanko Kartu Print (Kartu Kosong dengan Garis) ─────────────────────────────

function BlankoKartuPrint({ event, jamLabel }: { event: ActiveEvent; jamLabel: string }) {
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

// ── Screen Preview (zoom dari KartuPrint agar 100% akurat) ────────────────────

function KartuPreview({ data }: { data: KartuData }) {
  return (
    <div style={{ display: 'inline-block', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ zoom: 0.63 }}>
        <KartuPrint data={data} />
      </div>
    </div>
  )
}

// ── Kartu Peserta View ────────────────────────────────────────────────────────

function KartuPesertaView({ onBack }: { onBack: () => void }) {
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

  // State untuk Blanko
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

  useEffect(() => { loadInit() }, [])

  const loadInit = async () => {
    setLoadingInit(true)
    const evt = await getActiveEventForCetak()
    setEvent(evt)
    if (evt) {
      const ml = await getMarhalahListForCetak(evt.id)
      setMarhalahList(ml)
    }
    setLoadingInit(false)
  }

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

// ── Nomor Peserta Print (F4 Landscape 4×3 = 12 per lembar) ───────────────────

function NomorPrint({ data }: { data: NomorPesertaItem }) {
  const semLabel = data.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const ta       = data.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{
      width: '68mm',
      height: '80mm',
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

// ── Nomor Peserta View ────────────────────────────────────────────────────────

function NomorPesertaView({ onBack }: { onBack: () => void }) {
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

          {/* Screen preview grid */}
          <div className="flex flex-wrap gap-3">
            {nomorData.map((d, i) => <NomorPreview key={i} data={d} />)}
          </div>

          {/* Hidden print area */}
          <div className="hidden">
            <div ref={printRef} style={{ width: '210mm' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 68mm)', gap: '1mm' }}>
                {nomorData.map((d, i) => <NomorPrint key={i} data={d} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-view components ────────────────────────────────────────────────

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="border-b pb-4 flex items-center gap-3">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
      <div><h1 className="text-2xl font-bold text-slate-800">{title}</h1><p className="text-sm text-slate-500">Cetak Administrasi EHB</p></div>
    </div>
  )
}

function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title={label} onBack={onBack} />
      <div className="bg-white border rounded-xl flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><Construction className="w-8 h-8 text-indigo-400" /></div>
        <p className="font-bold text-slate-700">Format Sedang Disiapkan</p>
      </div>
    </div>
  )
}

// ── Menu items ────────────────────────────────────────────────────────────────

const MENU_ITEMS: { view: View; label: string; desc: string; icon: React.ElementType }[] = [
  { view: 'kartu-peserta',    label: 'Kartu Peserta EHB',   desc: 'Kartu identitas ujian untuk dipegang setiap peserta.',      icon: CreditCard },
  { view: 'nomor-peserta',    label: 'Nomor Peserta',        desc: 'Nomor ujian besar untuk ditempel di meja peserta.',         icon: Hash },
  { view: 'daftar-hadir',     label: 'Blanko Daftar Hadir',  desc: 'Lembar daftar hadir kosong untuk diisi peserta tiap sesi.',  icon: ClipboardList },
  { view: 'tempelan-ruangan', label: 'Tempelan Ruangan',     desc: 'Nomor ruangan beserta daftar peserta di dalamnya.',         icon: LayoutList },
  { view: 'jadwal-mengawas',  label: 'Jadwal Mengawas',      desc: 'Jadwal tugas mengawas seluruh pengawas EHB.',               icon: CalendarCheck },
  { view: 'jadwal-ehb',       label: 'Jadwal EHB',           desc: 'Jadwal ujian keseluruhan untuk ditempel di mading.',        icon: Calendar },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function CetakEhbPage() {
  const [view, setView] = useState<View>('menu')

  if (view === 'kartu-peserta') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><KartuPesertaView onBack={() => setView('menu')} /></div>
  if (view === 'nomor-peserta') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><NomorPesertaView onBack={() => setView('menu')} /></div>

  const activeMenu = MENU_ITEMS.find(m => m.view === view)
  if (view !== 'menu' && activeMenu) return <div className="max-w-6xl mx-auto pb-20 space-y-6"><PlaceholderView label={activeMenu.label} onBack={() => setView('menu')} /></div>

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4"><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Printer className="w-7 h-7 text-indigo-600" /> Cetak Administrasi EHB</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button key={item.view} onClick={() => setView(item.view)} className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all group active:scale-[0.98]">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors"><Icon className="w-5 h-5 text-indigo-500" /></div>
                <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 text-sm mb-1">{item.label}</p><p className="text-xs text-slate-400 leading-snug">{item.desc}</p></div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
