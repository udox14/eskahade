'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Printer, ChevronLeft, CreditCard, Hash,
  ClipboardList, LayoutList, CalendarCheck, Calendar,
  Construction, Loader2, AlertTriangle, Users, Filter,
} from 'lucide-react'
import {
  getActiveEventForCetak, getMarhalahListForCetak, getKelasListForCetak,
  getKartuPesertaData,
  type ActiveEvent, type KartuData, type MarhalahOption, type KelasOption,
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

type FilterType = 'semua' | 'marhalah' | 'kelas'

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

// F4 Landscape: 330mm × 210mm, 4 kartu per lembar (2 kolom × 2 baris)
// Margin halaman: 5mm → usable: 320 × 200mm
// Gap antar kartu: 4mm → tiap kartu: (320-4)/2 × (200-4)/2 = 158 × 98mm

const FONT = '"Times New Roman", Times, serif'

// ── Kartu Print (presisi mm, Times New Roman) ─────────────────────────────────

function KartuPrint({ data }: { data: KartuData }) {
  const jam       = parseJamGroup(data.jam_group)
  const semLabel  = data.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const ta        = data.tahun_ajaran_nama.replace('/', '-')

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

      {/* ── HEADER: Logo + Judul ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5mm', flexShrink: 0, marginBottom: '2mm' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logohitam.png"
          alt=""
          style={{ width: '22mm', height: '22mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '19pt', fontWeight: 900, letterSpacing: '0.5px', lineHeight: '1.1' }}>
            EVALUASI HASIL BELAJAR
          </div>
          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginTop: '1mm' }}>
            {semLabel} T.A. {ta}
          </div>
          <div style={{ fontSize: '8.5pt', fontWeight: 'normal', marginTop: '1.5mm', textTransform: 'uppercase' }}>
            LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
          </div>
          <div style={{ borderBottom: '1pt solid #000', marginTop: '2mm', width: '100%' }} />
        </div>
      </div>

      {/* ── MAIN CONTENT: Nomor Peserta + Nama + Info ───────────────────────── */}
      <div style={{ marginTop: '2mm', flexShrink: 0 }}>
        <div style={{ fontSize: '8pt', color: '#000', marginBottom: '1mm', paddingLeft: '2mm' }}>
          No. Peserta
        </div>
        <div style={{ display: 'flex', gap: '6mm', alignItems: 'flex-start' }}>

          {/* Kotak kiri: Nomor (putih) + JAM (hitam) */}
          <div style={{
            width: '32mm',
            flexShrink: 0,
            border: '1pt solid #000',
            display: 'flex',
            flexDirection: 'column' as const,
            textAlign: 'center' as const,
            overflow: 'hidden'
          }}>
            {/* Nomor Peserta */}
            <div style={{
              fontSize: '28pt',
              fontWeight: 900,
              lineHeight: '1.2',
              padding: '1mm 0',
              backgroundColor: '#fff',
            }}>
              {data.nomor_peserta}
            </div>
            {/* JAM label */}
            <div style={{
              backgroundColor: '#333',
              color: '#fff',
              padding: '1.5mm 1mm',
              lineHeight: '1.2',
            }}>
              <div style={{ fontSize: '8pt', fontWeight: 'bold', letterSpacing: '1px' }}>JAM</div>
              <div style={{ fontSize: '11pt', fontWeight: 900 }}>{jam}</div>
            </div>
          </div>

          {/* Kanan: Nama + Info */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column' as const,
            justifyContent: 'flex-start',
          }}>
            <div style={{
              fontSize: '34pt',
              fontWeight: 900,
              lineHeight: '1',
              marginBottom: '2mm',
              marginTop: '-1mm',
              whiteSpace: 'nowrap',
            }}>
              {data.nama_lengkap}
            </div>
            <div style={{ borderTop: '0.8pt solid #000', marginTop: '1mm', paddingTop: '2mm', display: 'flex', fontSize: '15pt', fontWeight: 'normal' }}>
              <div style={{ flex: 1, textAlign: 'left', paddingLeft: '2mm' }}>{data.asrama_kamar}</div>
              <div style={{ width: '1px', backgroundColor: '#000', height: '6mm', margin: '0 4mm' }} />
              <div style={{ flex: 1.5, textAlign: 'left' }}>{data.nama_kelas || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TATA TERTIB ─────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 'auto',
        border: '0.8pt solid #000',
        padding: '2mm 3mm',
        position: 'relative' as const,
      }}>
        {/* Judul di tengah garis */}
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

        {/* 2 kolom aturan */}
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
    </div>
  )
}

// ── Screen Preview (zoom dari KartuPrint agar 100% akurat) ────────────────────

function KartuPreview({ data }: { data: KartuData }) {
  // Kartu cetak: 158mm ≈ 597px. Zoom 0.63 → ≈376px per kartu, proporsional
  return (
    <div style={{
      display: 'inline-block',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
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

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Kartu Peserta EHB',
    // F4 Landscape: 330mm × 210mm
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
    if (type === 'kelas' && event) {
      const kl = await getKelasListForCetak(event.id)
      setKelasList(kl)
    }
  }, [event])

  const handleMuatPreview = async () => {
    if (!event) return
    if (filterType === 'marhalah' && !selectedMarhalah) return toast.error('Pilih marhalah terlebih dahulu')
    if (filterType === 'kelas' && !selectedKelas)       return toast.error('Pilih kelas terlebih dahulu')
    setLoadingData(true)
    setHasLoaded(false)
    const data = await getKartuPesertaData(event.id, {
      type: filterType,
      marhalahId: filterType === 'marhalah' ? (selectedMarhalah as number) : undefined,
      kelasId:    filterType === 'kelas'    ? selectedKelas                : undefined,
    })
    setKartuData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data peserta untuk filter ini')
  }

  if (loadingInit) return (
    <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  )

  if (!event) return (
    <div className="space-y-6">
      <PageHeader title="Kartu Peserta EHB" onBack={onBack} />
      <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  const semLabel = event.semester === 1 ? 'Semester Ganjil' : 'Semester Genap'

  return (
    <div className="space-y-6">
      <PageHeader title="Kartu Peserta EHB" onBack={onBack} />

      {/* Event badge */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">{semLabel} · T.A. {event.tahun_ajaran_nama}</span>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Filter Peserta</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['semua', 'marhalah', 'kelas'] as FilterType[]).map(ft => (
              <button
                key={ft}
                onClick={() => handleFilterTypeChange(ft)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  filterType === ft
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {ft === 'semua' ? 'Semua Peserta' : ft === 'marhalah' ? 'Per Marhalah' : 'Per Kelas'}
              </button>
            ))}
          </div>

          {(filterType === 'marhalah' || filterType === 'kelas') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Marhalah</label>
                <select
                  value={selectedMarhalah}
                  onChange={e => handleMarhalahChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Marhalah --</option>
                  {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              {filterType === 'kelas' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Kelas</label>
                  <select
                    value={selectedKelas}
                    onChange={e => setSelectedKelas(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    disabled={!selectedMarhalah}
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleMuatPreview}
            disabled={loadingData}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Muat Preview
          </button>
        </div>
      </div>

      {/* Preview + Print */}
      {hasLoaded && kartuData.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{kartuData.length}</span> kartu siap cetak
              &nbsp;·&nbsp; {Math.ceil(kartuData.length / 4)} lembar F4
            </p>
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" /> Cetak / Simpan PDF
            </button>
          </div>

          {/* Screen preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {kartuData.map(d => <KartuPreview key={d.id} data={d} />)}
          </div>

          {/* Print area — off-screen, 2×2 kartu per lembar F4 Landscape */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden>
            <div ref={printRef}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 158mm)',
                gap: '4mm',
              }}>
                {kartuData.map(d => <KartuPrint key={d.id} data={d} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared sub-view components ────────────────────────────────────────────────

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="border-b pb-4 flex items-center gap-3">
      <button
        onClick={onBack}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Printer className="w-7 h-7 text-indigo-600" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Cetak Administrasi EHB</p>
      </div>
    </div>
  )
}

function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title={label} onBack={onBack} />
      <div className="bg-white border rounded-xl flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Construction className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-base mb-1">Format Sedang Disiapkan</p>
          <p className="text-sm text-slate-400 max-w-sm">
            Format cetak untuk <span className="font-semibold text-slate-500">{label}</span> akan segera ditambahkan.
          </p>
        </div>
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

  if (view === 'kartu-peserta') return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <KartuPesertaView onBack={() => setView('menu')} />
    </div>
  )

  const activeMenu = MENU_ITEMS.find(m => m.view === view)
  if (view !== 'menu' && activeMenu) return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <PlaceholderView label={activeMenu.label} onBack={() => setView('menu')} />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Printer className="w-7 h-7 text-indigo-600" /> Cetak Administrasi EHB
        </h1>
        <p className="text-sm text-slate-500 mt-1">Pilih jenis administrasi yang ingin dicetak.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all group active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <Icon className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm mb-1">{item.label}</p>
                  <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <span className="text-xs font-bold text-indigo-500 group-hover:text-indigo-700 flex items-center gap-1 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Buka
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
