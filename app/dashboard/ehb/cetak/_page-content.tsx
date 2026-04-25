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

function semesterLabel(semester: number) {
  return semester === 1 ? 'SMT. GANJIL' : 'SMT. GENAP'
}

// ── Card: Screen Preview ───────────────────────────────────────────────────────

function KartuPreview({ data }: { data: KartuData }) {
  const jam = parseJamGroup(data.jam_group)
  return (
    <div className="border border-dashed border-slate-400 p-3 bg-white flex flex-col gap-1.5 text-xs rounded"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="w-8 h-8 object-contain shrink-0" alt="logo" />
          <div className="leading-tight">
            <div className="text-[8px] uppercase tracking-wide text-slate-500">Lembaga Pendidikan</div>
            <div className="text-[8px] uppercase tracking-wide text-slate-500">Pondok Pesantren</div>
            <div className="font-bold text-sm leading-none text-slate-900">SUKAHIDENG</div>
            <div className="text-[8px] text-slate-400 mt-0.5">Sukarame - Tasikmalaya - Jawa Barat</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-black leading-none text-slate-900">EHB</div>
          <div className="text-[10px] font-bold text-slate-700">{semesterLabel(data.semester)}</div>
          <div className="text-[9px] text-slate-600">T.A. {data.tahun_ajaran_nama}</div>
        </div>
      </div>

      <hr className="border-slate-300" />

      <div>Nomor Peserta: <span className="font-black text-base">{data.nomor_peserta}</span></div>

      <div className="text-base font-black leading-tight text-slate-900">{data.nama_lengkap}</div>

      <hr className="border-slate-300" />

      <div className="flex gap-3">
        <div className="flex flex-col gap-1 text-slate-500">
          <span>Marhalah</span><span>Asrama</span><span>Ruang</span>
        </div>
        <div className="self-stretch border-l border-slate-300" />
        <div className="flex flex-col gap-1 font-bold text-slate-800">
          <span>{data.marhalah_nama || '-'}</span>
          <span>{data.asrama || '-'}</span>
          <span>{data.nomor_ruangan}</span>
        </div>
      </div>

      <hr className="border-slate-300" />

      <div className="flex items-end justify-between gap-2">
        <div className="text-[9px] text-slate-600 leading-snug flex-1">
          <div className="font-bold text-[10px] text-slate-800 mb-0.5">TATA TERTIB PESERTA</div>
          <ol className="list-decimal list-inside space-y-px">
            <li>Membawa kartu peserta ke dalam ruangan.</li>
            <li>Menggunakan pakaian pengajian.</li>
            <li>Mengikuti EHB sesuai ruangan dan jadwal.</li>
            <li>Tidak membawa catatan dalam bentuk apapun.</li>
            <li>Menempati tempat duduk sesuai nomor urut.</li>
            <li>Hadir di ruangan 10 menit sebelum EHB dimulai.</li>
            <li>Tidak bekerja sama dalam pengerjaan soal.</li>
            <li>Mengisi identitas dan daftar hadir.</li>
          </ol>
        </div>
        <div className="border border-slate-800 text-center px-2 py-1 shrink-0 min-w-[48px]">
          <div className="text-[7px] font-bold tracking-widest">JAM</div>
          <div className="font-black text-xs leading-none">{jam}</div>
        </div>
      </div>
    </div>
  )
}

// ── Card: Print (presisi A4 — 2×3 = 6 per lembar) ────────────────────────────

function KartuPrint({ data }: { data: KartuData }) {
  const jam = parseJamGroup(data.jam_group)
  const s: React.CSSProperties = {
    width: '95mm',
    height: '100mm',
    border: '0.5pt dashed #888',
    padding: '3.5mm',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '7pt',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2mm',
    overflow: 'hidden',
    breakInside: 'avoid',
  }

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2mm' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" style={{ width: '12mm', height: '12mm', objectFit: 'contain', flexShrink: 0 }} alt="" />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '5pt', letterSpacing: '0.4px', color: '#555', textTransform: 'uppercase' }}>Lembaga Pendidikan</div>
            <div style={{ fontSize: '5pt', letterSpacing: '0.4px', color: '#555', textTransform: 'uppercase' }}>Pondok Pesantren</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>SUKAHIDENG</div>
            <div style={{ fontSize: '4.5pt', color: '#777', marginTop: '0.5mm' }}>Sukarame - Tasikmalaya - Jawa Barat</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '20pt', fontWeight: 900, lineHeight: 1, color: '#000' }}>EHB</div>
          <div style={{ fontSize: '7pt', fontWeight: 'bold' }}>{semesterLabel(data.semester)}</div>
          <div style={{ fontSize: '6pt', color: '#444' }}>T.A. {data.tahun_ajaran_nama}</div>
        </div>
      </div>

      <div style={{ borderBottom: '0.4pt solid #aaa' }} />

      <div style={{ fontSize: '7pt' }}>
        Nomor Peserta:&nbsp;
        <span style={{ fontSize: '10pt', fontWeight: 900 }}>{data.nomor_peserta}</span>
      </div>

      <div style={{ fontSize: '13pt', fontWeight: 900, lineHeight: 1.1, color: '#000' }}>{data.nama_lengkap}</div>

      <div style={{ borderBottom: '0.4pt solid #aaa' }} />

      <div style={{ display: 'flex', gap: '3mm', fontSize: '7pt' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm', color: '#555', whiteSpace: 'nowrap' }}>
          <span>Marhalah</span><span>Asrama</span><span>Ruang</span>
        </div>
        <div style={{ borderLeft: '0.4pt solid #aaa' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm', fontWeight: 'bold', color: '#000' }}>
          <span>{data.marhalah_nama || '-'}</span>
          <span>{data.asrama || '-'}</span>
          <span>{data.nomor_ruangan}</span>
        </div>
      </div>

      <div style={{ borderBottom: '0.4pt solid #aaa' }} />

      {/* Tata Tertib + JAM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2mm', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 'bold', marginBottom: '1mm' }}>TATA TERTIB PESERTA</div>
          <ol style={{ margin: 0, paddingLeft: '3.5mm', fontSize: '5.5pt', lineHeight: 1.5 }}>
            <li>Membawa kartu peserta ke dalam ruangan.</li>
            <li>Menggunakan pakaian pengajian.</li>
            <li>Mengikuti EHB sesuai ruangan dan jadwal.</li>
            <li>Tidak membawa catatan dalam bentuk apapun.</li>
            <li>Menempati tempat duduk sesuai nomor urut.</li>
            <li>Hadir di ruangan 10 menit sebelum EHB dimulai.</li>
            <li>Tidak bekerja sama dalam pengerjaan soal.</li>
            <li>Mengisi identitas dan daftar hadir.</li>
          </ol>
        </div>
        <div style={{
          border: '0.8pt solid #000',
          padding: '2mm 2.5mm',
          textAlign: 'center',
          flexShrink: 0,
          minWidth: '16mm',
        }}>
          <div style={{ fontSize: '5.5pt', fontWeight: 'bold', letterSpacing: '1px' }}>JAM</div>
          <div style={{ fontSize: '9pt', fontWeight: 900, lineHeight: 1.1 }}>{jam}</div>
        </div>
      </div>
    </div>
  )
}

// ── Kartu Peserta View ────────────────────────────────────────────────────────

function KartuPesertaView({ onBack }: { onBack: () => void }) {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [loadingInit, setLoadingInit] = useState(true)

  const [filterType, setFilterType] = useState<FilterType>('semua')
  const [marhalahList, setMarhalahList] = useState<MarhalahOption[]>([])
  const [kelasList, setKelasList] = useState<KelasOption[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState<number | ''>('')
  const [selectedKelas, setSelectedKelas] = useState<string>('')

  const [kartuData, setKartuData] = useState<KartuData[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Kartu Peserta EHB',
    pageStyle: `
      @page { size: 210mm 330mm portrait; margin: 8mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  })

  useEffect(() => {
    loadInit()
  }, [])

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
    if (!event || id === '') return
    const kl = await getKelasListForCetak(event.id, id as number)
    setKelasList(kl)
  }, [event])

  const handleFilterTypeChange = useCallback(async (type: FilterType) => {
    setFilterType(type)
    setSelectedMarhalah('')
    setSelectedKelas('')
    setHasLoaded(false)
    setKartuData([])
    if (type !== 'semua' && event) {
      const kl = type === 'kelas'
        ? await getKelasListForCetak(event.id)
        : []
      setKelasList(kl)
    }
  }, [event])

  const handleMuatPreview = async () => {
    if (!event) return
    if (filterType === 'marhalah' && !selectedMarhalah) return toast.error('Pilih marhalah terlebih dahulu')
    if (filterType === 'kelas' && !selectedKelas) return toast.error('Pilih kelas terlebih dahulu')

    setLoadingData(true)
    setHasLoaded(false)
    const data = await getKartuPesertaData(event.id, {
      type: filterType,
      marhalahId: filterType === 'marhalah' ? (selectedMarhalah as number) : undefined,
      kelasId: filterType === 'kelas' ? selectedKelas : undefined,
    })
    setKartuData(data)
    setHasLoaded(true)
    setLoadingData(false)
    if (data.length === 0) toast.error('Tidak ada data peserta untuk filter ini')
  }

  if (loadingInit) return (
    <div className="flex justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
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

  return (
    <div className="space-y-6">
      <PageHeader title="Kartu Peserta EHB" onBack={onBack} />

      {/* Event badge */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">{semesterLabel(event.semester)} • T.A. {event.tahun_ajaran_nama}</span>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-700 text-sm">Filter Peserta</h3>
        </div>
        <div className="p-5 space-y-4">
          {/* Filter type tabs */}
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

          {/* Marhalah dropdown */}
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
                  {marhalahList.map(m => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
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
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                    ))}
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
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{kartuData.length}</span> kartu siap cetak
              &nbsp;·&nbsp; {Math.ceil(kartuData.length / 6)} lembar A4
            </p>
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" /> Cetak / Simpan PDF
            </button>
          </div>

          {/* Screen preview grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {kartuData.map(d => <KartuPreview key={d.id} data={d} />)}
          </div>

          {/* Print area — off-screen, 2×3 kartu per halaman A4 */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden>
            <div ref={printRef}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 95mm)',
                gap: '5mm 4mm',
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
  { view: 'kartu-peserta',    label: 'Kartu Peserta EHB',  desc: 'Kartu identitas ujian untuk dipegang setiap peserta.',     icon: CreditCard },
  { view: 'nomor-peserta',    label: 'Nomor Peserta',       desc: 'Nomor ujian besar untuk ditempel di meja peserta.',        icon: Hash },
  { view: 'daftar-hadir',     label: 'Blanko Daftar Hadir', desc: 'Lembar daftar hadir kosong untuk diisi peserta tiap sesi.', icon: ClipboardList },
  { view: 'tempelan-ruangan', label: 'Tempelan Ruangan',    desc: 'Nomor ruangan beserta daftar peserta di dalamnya.',        icon: LayoutList },
  { view: 'jadwal-mengawas',  label: 'Jadwal Mengawas',     desc: 'Jadwal tugas mengawas seluruh pengawas EHB.',              icon: CalendarCheck },
  { view: 'jadwal-ehb',       label: 'Jadwal EHB',          desc: 'Jadwal ujian keseluruhan untuk ditempel di mading.',       icon: Calendar },
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
