'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardList, FileText, LayoutList, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useReactToPrint } from '@/lib/pdf/client'
import { TesKlasifikasiTabs } from '../_tabs'
import { getPenjadwalanData, getCetakJadwalData } from '../penjadwalan/actions'

type View = 'menu' | 'jadwal' | 'blanko-absensi' | 'blanko-penilaian'
type PrintMode = 'all' | 'sesi' | 'ruangan'

const MENU_ITEMS: { view: View; label: string; desc: string; icon: React.ElementType; ready: boolean }[] = [
  { view: 'jadwal', label: 'Jadwal Peserta', desc: 'Cetak jadwal tes klasifikasi semua peserta, per sesi, atau per ruangan.', icon: LayoutList, ready: true },
  { view: 'blanko-absensi', label: 'Blanko Absensi', desc: 'Lembar daftar hadir peserta tes klasifikasi per sesi dan ruangan.', icon: ClipboardList, ready: true },
  { view: 'blanko-penilaian', label: 'Blanko Penilaian', desc: 'Lembar penilaian tes klasifikasi per peserta.', icon: FileText, ready: false },
]

function formatDate(date: string) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatTime(row: { waktu_mulai?: string | null; waktu_selesai?: string | null }) {
  return `${row.waktu_mulai || '-'} - ${row.waktu_selesai || '-'}`
}

function formatSekolah(sekolah: string | null | undefined) {
  const value = String(sekolah || '').toUpperCase().trim()
  const map: Record<string, string> = {
    MTSU: 'MTs',
    MTSN: 'MTsN',
    SMP: 'SMP',
    MAN: 'MA',
    SMA: 'SMA',
    SMK: 'SMK',
  }
  return map[value] || value || '-'
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks.length ? chunks : [[]]
}

function PrintSheet({ event, rows, mode, selectedSesi, selectedRuangan }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
    if (mode === 'ruangan' && selectedRuangan) return String(row.ruangan_id) === selectedRuangan
    return true
  })
  const groupsMap = new Map<string, any[]>()
  filtered.forEach(row => {
    const key = `${row.tanggal}|${row.sesi_id}|${row.ruangan_id}`
    groupsMap.set(key, [...(groupsMap.get(key) || []), row])
  })
  const groups = Array.from(groupsMap.values())

  return (
    <div>
      {groups.map((items, groupIndex) => {
        const first = items[0]
        return (
          <div
            key={`${first.sesi_id}-${first.ruangan_id}-${groupIndex}`}
            style={{
              width: '210mm',
              minHeight: '330mm',
              padding: '8mm',
              boxSizing: 'border-box',
              fontFamily: '"Arial Narrow", Arial, sans-serif',
              fontSize: '11pt',
              color: '#000',
              background: '#fff',
              breakAfter: 'page',
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              JADWAL PESERTA TES KLASIFIKASI TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm 8mm', marginBottom: '4mm', fontSize: '11pt' }}>
              <div><b>Tanggal:</b> {formatDate(first.tanggal)}</div>
              <div><b>Waktu:</b> {formatTime(first)}</div>
              <div><b>Ruangan:</b> {first.nama_ruangan}</div>
              <div><b>Tempat:</b> {first.tempat || '-'}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10mm' }} />
                <col />
                <col style={{ width: '29mm' }} />
                <col style={{ width: '31mm' }} />
                <col style={{ width: '25mm' }} />
                <col style={{ width: '24mm' }} />
                <col style={{ width: '27mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'Nama Lengkap', 'Asrama/Kamar', 'Tanggal tes', 'Waktu', 'Ruangan', 'Tempat'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{index + 1}</td>
                    <td style={printTd}>{row.nama_lengkap}</td>
                    <td style={printTd}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={printTd}>{formatDate(row.tanggal)}</td>
                    <td style={printTd}>{formatTime(row)}</td>
                    <td style={printTd}>{row.nama_ruangan}</td>
                    <td style={printTd}>{row.tempat || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function AbsensiSheet({ event, rows, mode, selectedSesi, selectedRuangan }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
    if (mode === 'ruangan' && selectedRuangan) return String(row.ruangan_id) === selectedRuangan
    return true
  })
  const groupsMap = new Map<string, any[]>()
  filtered.forEach(row => {
    const key = `${row.tanggal}|${row.sesi_id}|${row.ruangan_id}`
    groupsMap.set(key, [...(groupsMap.get(key) || []), row])
  })

  return (
    <div>
      {Array.from(groupsMap.values()).flatMap(items => {
        const first = items[0]
        return chunkRows(items, 30).map((chunk, chunkIndex) => {
          const padded = [...chunk]
          while (padded.length < 30) padded.push(null)

          return (
            <div key={`${first.sesi_id}-${first.ruangan_id}-${chunkIndex}`} style={absensiPageStyle}>
              <div style={absensiTitleStyle}>DAFTAR HADIR PESERTA TES KLASIFIKASI</div>
              <div style={absensiSubtitleStyle}>TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}</div>
              <div style={absensiMetaStyle}>
                <div>Tanggal</div><div>: {formatDate(first.tanggal)}</div>
                <div>Sesi/Waktu</div><div>: {first.sesi_label || `Sesi ${first.nomor_sesi}`} ({formatTime(first)})</div>
                <div>Ruangan</div><div>: {first.nama_ruangan}</div>
                <div>Tempat</div><div>: {first.tempat || '-'}</div>
              </div>

              <table style={absensiTableStyle}>
                <colgroup>
                  <col style={{ width: '11mm' }} />
                  <col />
                  <col style={{ width: '31mm' }} />
                  <col style={{ width: '20mm' }} />
                  <col style={{ width: '32mm' }} />
                  <col style={{ width: '32mm' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={absensiThStyle}>NO</th>
                    <th style={absensiThStyle}>NAMA LENGKAP</th>
                    <th style={absensiThStyle}>ASRAMA/KAMAR</th>
                    <th style={absensiThStyle}>SEKOLAH</th>
                    <th style={absensiThStyle} colSpan={2}>TANDA TANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  {padded.map((row, index) => (
                    <tr key={row?.id || `blank-${index}`}>
                      <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{chunkIndex * 30 + index + 1}</td>
                      <td style={{ ...absensiTdStyle, textTransform: 'uppercase' }}>{row?.nama_lengkap || ''}</td>
                      <td style={absensiTdStyle}>{row ? `${row.asrama || '-'}/${row.kamar || '-'}` : ''}</td>
                      <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{row ? formatSekolah(row.sekolah) : ''}</td>
                      {index % 2 === 0 ? (
                        <>
                          <td rowSpan={2} style={signatureTdStyle}>
                            <span style={signatureNumberStyle}>{chunkIndex * 30 + index + 1}</span>
                          </td>
                          <td rowSpan={2} style={signatureTdStyle}>
                            {index < 29 && <span style={signatureNumberStyle}>{chunkIndex * 30 + index + 2}</span>}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      })}
    </div>
  )
}

const printTh: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1.2mm',
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.1,
}

const printTd: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1.1mm',
  verticalAlign: 'middle',
  lineHeight: 1.12,
}

const absensiPageStyle: React.CSSProperties = {
  width: '210mm',
  height: '330mm',
  padding: '8mm 10mm 8mm 20mm',
  boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#fff',
  color: '#000',
  overflow: 'hidden',
  breakAfter: 'page',
}

const absensiTitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '15pt',
  fontWeight: 700,
  lineHeight: 1,
  marginTop: '2mm',
}

const absensiSubtitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '12pt',
  fontWeight: 700,
  lineHeight: 1,
  marginTop: '2mm',
  marginBottom: '5mm',
}

const absensiMetaStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 1fr 24mm 1fr',
  gap: '1.2mm 2mm',
  fontSize: '11pt',
  lineHeight: 1.1,
  marginBottom: '4mm',
}

const absensiTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const absensiThStyle: React.CSSProperties = {
  border: '1pt solid #000',
  backgroundColor: '#e5e7eb',
  height: '9mm',
  padding: '1mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '10pt',
  fontWeight: 700,
  lineHeight: 1,
}

const absensiTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '7.6mm',
  padding: '0.7mm 1.2mm',
  verticalAlign: 'middle',
  fontSize: '10pt',
  lineHeight: 1,
}

const signatureTdStyle: React.CSSProperties = {
  ...absensiTdStyle,
  position: 'relative',
  padding: 0,
}

const signatureNumberStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1mm',
  left: '1.2mm',
  fontSize: '8.5pt',
  lineHeight: 1,
}

function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <TesKlasifikasiTabs />
      <DashboardPageHeader title={label} description="Format cetak ini akan dilanjutkan setelah format jadwal." />
      <button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Placeholder fitur cetak berikutnya.
      </div>
    </div>
  )
}

export default function CetakTesKlasifikasiPage() {
  const [view, setView] = useState<View>('menu')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [printData, setPrintData] = useState<{ event: any; rows: any[] } | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [selectedSesi, setSelectedSesi] = useState('')
  const [selectedRuangan, setSelectedRuangan] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const absensiPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Jadwal Tes Klasifikasi',
    filename: 'jadwal-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintAbsensi = useReactToPrint({
    contentRef: absensiPrintRef,
    documentTitle: 'Blanko Absensi Tes Klasifikasi',
    filename: 'blanko-absensi-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const activeEvent = data?.activeEvent
  const rows = printData?.rows || []

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const loaded = await getPenjadwalanData()
        setData(loaded)
        if (loaded.activeEvent) {
          setPrintData(await getCetakJadwalData(loaded.activeEvent.id))
        }
      } catch (error: any) {
        toast.error('Gagal memuat data cetak', { description: error?.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (view === 'blanko-absensi') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <TesKlasifikasiTabs />
        <DashboardPageHeader title="Blanko Absensi Tes Klasifikasi" description="Cetak daftar hadir peserta per sesi dan ruangan." />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="sesi">Per Sesi</option>
                  <option value="ruangan">Per Ruangan</option>
                </select>
              </div>
              {printMode === 'sesi' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                  <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih sesi</option>
                    {(data?.sesiList || []).map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} - {sesi.label}</option>)}
                  </select>
                </div>
              )}
              {printMode === 'ruangan' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ruangan</label>
                  <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih ruangan</option>
                    {(data?.ruanganList || []).map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={async () => {
                  setPrintData(await getCetakJadwalData(activeEvent.id))
                  window.setTimeout(() => handlePrintAbsensi(), 100)
                }}
                disabled={rows.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-100 p-4">
              <div className="max-h-[760px] overflow-auto">
                <div style={{ zoom: 0.35 }} className="origin-top-left bg-white shadow">
                  <AbsensiSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                </div>
              </div>
            </div>
            <div className="hidden">
              <div ref={absensiPrintRef}>
                <AbsensiSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }
  if (view === 'blanko-penilaian') return <PlaceholderView label="Blanko Penilaian Tes Klasifikasi" onBack={() => setView('menu')} />

  if (view === 'jadwal') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <TesKlasifikasiTabs />
        <DashboardPageHeader title="Jadwal Peserta Tes Klasifikasi" description="Cetak jadwal peserta semua, per sesi, atau per ruangan." />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="sesi">Per Sesi</option>
                  <option value="ruangan">Per Ruangan</option>
                </select>
              </div>
              {printMode === 'sesi' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                  <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih sesi</option>
                    {(data?.sesiList || []).map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} - {sesi.label}</option>)}
                  </select>
                </div>
              )}
              {printMode === 'ruangan' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ruangan</label>
                  <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih ruangan</option>
                    {(data?.ruanganList || []).map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={async () => {
                  setPrintData(await getCetakJadwalData(activeEvent.id))
                  window.setTimeout(() => handlePrint(), 100)
                }}
                disabled={rows.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-100 p-4">
              <div className="max-h-[640px] overflow-auto">
                <div style={{ zoom: 0.36 }} className="origin-top-left bg-white shadow">
                  <PrintSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                </div>
              </div>
            </div>
            <div className="hidden">
              <div ref={printRef}>
                <PrintSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <TesKlasifikasiTabs />
      <DashboardPageHeader
        title="Cetak Tes Klasifikasi"
        description="Pilih dokumen administrasi tes klasifikasi yang akan dicetak."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 transition-colors group-hover:bg-emerald-100">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="mb-1 text-sm font-bold text-slate-800">{item.label}</p>
                    {!item.ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Soon</span>}
                  </div>
                  <p className="text-xs leading-snug text-slate-400">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
