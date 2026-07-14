'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReactToPrint } from '@/lib/pdf/client'
import { ArrowLeft, Eye, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getPembagianTugasMengajarData, type PembagianTugasMengajarRow } from '../actions'

function headerCellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: '1px solid #111827',
    padding: '1.4mm 1mm',
    textAlign: 'center',
    fontSize: '10pt',
    fontWeight: 700,
    lineHeight: 1.15,
    verticalAlign: 'middle',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    ...extra,
  }
}

function bodyCellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: '1px solid #111827',
    padding: '1.05mm 0.95mm',
    fontSize: '10pt',
    lineHeight: 1.15,
    verticalAlign: 'middle',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    ...extra,
  }
}

function bodyCellSingleLine(extra?: React.CSSProperties): React.CSSProperties {
  return {
    ...bodyCellStyle(),
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
    overflow: 'hidden',
    textOverflow: 'clip',
    ...extra,
  }
}

function SignatureBlock({ title, name }: { title: string; name: string }) {
  return (
    <div style={{ width: '42%', textAlign: 'center' }}>
      <div style={{ fontSize: '10pt', fontWeight: 600 }}>{title}</div>
      <div style={{ height: '18mm' }} />
      <div style={{ fontSize: '10pt', fontWeight: 700, textDecoration: 'underline' }}>
        {name || '................................'}
      </div>
    </div>
  )
}

function PrintDocument({
  rows,
  pimpinanPesantren,
  wakilAkademik,
}: {
  rows: PembagianTugasMengajarRow[]
  pimpinanPesantren: string
  wakilAkademik: string
}) {
  const tahunAjaran = rows[0]?.tahun_ajaran_nama ?? '................'

  return (
    <div
      style={{
        width: '318mm',
        minHeight: '203mm',
        boxSizing: 'border-box',
        padding: '4mm 5mm 5mm 5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        background: '#fff',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2.8mm' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5mm',
            borderBottom: '1.6pt solid #111827',
            paddingBottom: '2.8mm',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logohitam.png"
            alt="Logo Pesantren"
            style={{ width: '22mm', height: '22mm', objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '14pt', fontWeight: 700, letterSpacing: '0.4pt', lineHeight: 1.1 }}>
              PEMBAGIAN TUGAS MENGAJAR
            </div>
            <div style={{ fontSize: '14pt', fontWeight: 700, marginTop: '0.8mm', lineHeight: 1.1 }}>
              LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
            </div>
            <div style={{ fontSize: '14pt', marginTop: '0.8mm', lineHeight: 1.1 }}>
              TAHUN AJARAN {tahunAjaran}
            </div>
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <colgroup>
          <col style={{ width: '8mm' }} />
          <col />
          <col style={{ width: '16mm' }} />
          <col style={{ width: '9mm' }} />
          <col style={{ width: '9mm' }} />
          <col style={{ width: '7mm' }} />
          <col style={{ width: '7mm' }} />
          <col style={{ width: '8mm' }} />
          <col style={{ width: '12mm' }} />
          <col style={{ width: '26mm' }} />
          <col style={{ width: '58mm' }} />
          <col style={{ width: '58mm' }} />
          <col style={{ width: '58mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={headerCellStyle()}>NO</th>
            <th rowSpan={2} style={headerCellStyle()}>KELAS</th>
            <th colSpan={3} style={headerCellStyle()}>KELOMPOK</th>
            <th colSpan={3} style={headerCellStyle({ letterSpacing: '1pt' })}>JUMLAH</th>
            <th rowSpan={2} style={headerCellStyle()}>GRADE</th>
            <th rowSpan={2} style={headerCellStyle()}>TEMPAT</th>
            <th colSpan={3} style={headerCellStyle()}>PENGAJAR</th>
          </tr>
          <tr>
            <th style={headerCellStyle({ whiteSpace: 'nowrap', wordBreak: 'normal' })}>TINGKAT</th>
            <th style={headerCellStyle()}>L/P</th>
            <th style={headerCellStyle()}>B/L</th>
            <th style={headerCellStyle()}>L</th>
            <th style={headerCellStyle()}>P</th>
            <th style={headerCellStyle()}>J</th>
            <th style={headerCellStyle()}>Malam (19.00-20.30)</th>
            <th style={headerCellStyle()}>Subuh (05.15-06.10)</th>
            <th style={headerCellStyle()}>Ashar (16.00-17.00)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td style={bodyCellStyle({ textAlign: 'center' })}>{index + 1}</td>
              <td style={bodyCellStyle({ textAlign: 'left', whiteSpace: 'nowrap' })}>{row.nama_kelas}</td>
              <td style={bodyCellSingleLine({ textAlign: 'center' })}>{row.tingkat_label}</td>
              <td style={bodyCellSingleLine({ textAlign: 'center' })}>{row.lp_label}</td>
              <td style={bodyCellSingleLine({ textAlign: 'center' })}>{row.bl_label}</td>
              <td style={bodyCellStyle({ textAlign: 'center' })}>{row.total_putra || ''}</td>
              <td style={bodyCellStyle({ textAlign: 'center' })}>{row.total_putri || ''}</td>
              <td style={bodyCellStyle({ textAlign: 'center' })}>{row.total_santri || ''}</td>
              <td style={bodyCellSingleLine({ textAlign: 'center' })}>{row.grade || '-'}</td>
              <td style={bodyCellSingleLine()}>{row.tempat || '-'}</td>
              <td style={bodyCellStyle({ whiteSpace: 'pre-line', wordBreak: 'normal' })}>{row.guru_maghrib_nama || '-'}</td>
              <td style={bodyCellStyle({ whiteSpace: 'pre-line', wordBreak: 'normal' })}>{row.guru_shubuh_nama || '-'}</td>
              <td style={bodyCellStyle({ whiteSpace: 'pre-line', wordBreak: 'normal' })}>{row.guru_ashar_nama || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '8mm' }}>
        <div style={{ textAlign: 'center', fontSize: '10pt', fontWeight: 600, marginBottom: '4mm' }}>Menyetujui,</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SignatureBlock title="Pimpinan Pesantren" name={pimpinanPesantren} />
          <SignatureBlock title="Wakil Pimpinan Bidang Akademik" name={wakilAkademik} />
        </div>
      </div>
    </div>
  )
}

function Preview({
  rows,
  pimpinanPesantren,
  wakilAkademik,
}: {
  rows: PembagianTugasMengajarRow[]
  pimpinanPesantren: string
  wakilAkademik: string
}) {
  return (
    <div className="bg-white shadow-2xl" style={{ zoom: 0.44 }}>
      <PrintDocument rows={rows} pimpinanPesantren={pimpinanPesantren} wakilAkademik={wakilAkademik} />
    </div>
  )
}

export default function CetakPembagianTugasPage() {
  const [rows, setRows] = useState<PembagianTugasMengajarRow[]>([])
  const [pimpinanPesantren, setPimpinanPesantren] = useState('')
  const [wakilAkademik, setWakilAkademik] = useState('')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Pembagian Tugas Mengajar',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: Arial, Helvetica, sans-serif; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const data = await getPembagianTugasMengajarData()
      setRows(data)
      setLoading(false)
    }
    init()
  }, [])

  const handlePreview = () => {
    if (!rows.length) {
      toast.error('Belum ada data kelas untuk dicetak')
      return
    }
    setReady(true)
  }

  const handleTriggerPrint = () => {
    if (!rows.length) {
      toast.error('Belum ada data kelas untuk dicetak')
      return
    }
    handlePrint()
  }

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <DashboardPageHeader
        title="Cetak Pembagian Tugas Mengajar"
        description="Format F4 landscape, margin narrow, lengkap dengan tanda tangan persetujuan."
        action={(
          <Link
            href="/dashboard/master/wali-kelas"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Jadwal Guru
          </Link>
        )}
      />

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-700">Pengaturan Cetak</h2>
          <p className="mt-1 text-xs text-slate-500">Cetak ini selalu memuat semua kelas aktif. Nama penanda tangan bisa diisi manual sebelum preview atau print.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase text-slate-500">Mode Cetak</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">Selalu mencetak semua kelas aktif</p>
            <p className="mt-1 text-xs text-slate-500">Tidak ada filter parsial pada laporan ini.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Pimpinan Pesantren</label>
            <input
              value={pimpinanPesantren}
              onChange={(e) => setPimpinanPesantren(e.target.value)}
              placeholder="Nama penanda tangan"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Wakil Pimpinan Bid. Akademik</label>
            <input
              value={wakilAkademik}
              onChange={(e) => setWakilAkademik(e.target.value)}
              placeholder="Nama penanda tangan"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-4 flex items-center justify-end gap-3">
            <button
              onClick={handlePreview}
              className="flex h-[40px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button
              onClick={handleTriggerPrint}
              className="flex h-[40px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Cetak Semua
            </button>
          </div>
        </div>
      </div>

      {ready && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Menampilkan <span className="font-bold text-slate-800">{rows.length}</span> baris
            <span className="ml-2 text-slate-400">· F4 Landscape · Narrow Margin</span>
          </p>
          <div className="max-h-[820px] overflow-auto rounded-2xl border bg-slate-100 p-4 flex justify-center">
            <Preview rows={rows} pimpinanPesantren={pimpinanPesantren} wakilAkademik={wakilAkademik} />
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={printRef}>
          <PrintDocument rows={rows} pimpinanPesantren={pimpinanPesantren} wakilAkademik={wakilAkademik} />
        </div>
      </div>
    </div>
  )
}
