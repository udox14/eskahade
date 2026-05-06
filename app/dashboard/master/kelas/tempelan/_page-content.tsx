'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useReactToPrint } from 'react-to-print'
import { AlertTriangle, ArrowLeft, Eye, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getKelasTempelanList,
  getTempelanKelasData,
  getTempelanKelasSemuaData,
  getTahunAjaranAktif,
  type TempelanKelasItem,
} from '../actions'

function getClassFontSize(name: string) {
  const len = name.trim().length
  if (len <= 6) return '82pt'
  if (len <= 10) return '72pt'
  if (len <= 14) return '62pt'
  if (len <= 18) return '54pt'
  return '46pt'
}

function getPlaceFontSize(place: string) {
  const len = place.trim().length
  if (len <= 16) return '28pt'
  if (len <= 26) return '24pt'
  if (len <= 36) return '20pt'
  return '17pt'
}

function TempelanKelasPrint({ item }: { item: TempelanKelasItem }) {
  const tempat = item.tempat?.trim() || 'Tempat belum diatur'

  return (
    <div
      style={{
        width: '318mm',
        height: '203mm',
        boxSizing: 'border-box',
        padding: '8mm 10mm',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '"Times New Roman", Times, serif',
        display: 'flex',
        flexDirection: 'column',
        border: '1.5pt solid #0f172a',
        breakAfter: 'page',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5mm',
          borderBottom: '2.2pt solid #0f172a',
          paddingBottom: '4mm',
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logohitam.png"
          alt="Logo Pesantren"
          style={{ width: '25mm', height: '25mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '17pt', fontWeight: 400, letterSpacing: '0.3pt', lineHeight: 1.05 }}>
            SEKSI PENGAJARAN DEWAN SANTRI
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 700, letterSpacing: '0.2pt', lineHeight: 1.1, marginTop: '0.8mm' }}>
            LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
          </div>
          <div style={{ fontSize: '13pt', fontWeight: 400, letterSpacing: '0.8pt', lineHeight: 1.1, marginTop: '0.8mm' }}>
            TAHUN AJARAN {item.tahun_ajaran_nama}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          marginTop: '7mm',
          border: '2pt solid #1e3a8a',
          borderRadius: '4mm',
          padding: '10mm 12mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            width: '100%',
            fontSize: getClassFontSize(item.nama_kelas),
            fontWeight: 900,
            letterSpacing: '-0.6pt',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            textTransform: 'uppercase',
          }}
        >
          {item.nama_kelas}
        </div>

        <div
          style={{
            width: '100%',
            marginTop: '8mm',
            fontSize: getPlaceFontSize(tempat),
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '0.2pt',
            textTransform: 'uppercase',
          }}
        >
          {tempat}
        </div>
      </div>

      <div
        style={{
          marginTop: '4mm',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          fontSize: '10pt',
          color: '#334155',
          flexShrink: 0,
        }}
      >
        <span>{item.marhalah_nama || 'Tanpa marhalah'}</span>
      </div>
    </div>
  )
}

function TempelanPreview({ item }: { item: TempelanKelasItem }) {
  return (
    <div className="bg-white shadow-2xl" style={{ zoom: 0.34 }}>
      <TempelanKelasPrint item={item} />
    </div>
  )
}

export default function TempelanKelasPage() {
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [kelasList, setKelasList] = useState<TempelanKelasItem[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [previewItem, setPreviewItem] = useState<TempelanKelasItem | null>(null)
  const [bulkItems, setBulkItems] = useState<TempelanKelasItem[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Tempelan Kelas',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Semua Tempelan Kelas',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const [tahun, kelas] = await Promise.all([getTahunAjaranAktif(), getKelasTempelanList()])
      setTahunAktif(tahun)
      setKelasList(kelas)
      setLoadingInit(false)
    }
    init()
  }, [])

  const totalLabel = useMemo(() => {
    if (bulkItems.length === 0) return `${kelasList.length} kelas tersedia`
    return `${bulkItems.length} lembar siap dicetak`
  }, [bulkItems, kelasList.length])

  const handleLoadPreview = async () => {
    if (!selectedKelas) return toast.error('Pilih kelas terlebih dahulu')
    setLoadingPreview(true)
    setHasLoadedPreview(false)
    const data = await getTempelanKelasData(selectedKelas)
    setPreviewItem(data)
    setHasLoadedPreview(true)
    setLoadingPreview(false)
    if (!data) toast.error('Data kelas tidak ditemukan')
  }

  const handleLoadBulk = async () => {
    setLoadingBulk(true)
    try {
      const data = await getTempelanKelasSemuaData()
      if (data.length === 0) {
        toast.error('Belum ada kelas untuk dicetak')
        setLoadingBulk(false)
        return
      }
      setBulkItems(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 500)
    } catch {
      toast.error('Gagal memuat tempelan kelas')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <DashboardPageHeader
        title="Tempelan Kelas"
        description="Cetak tempelan nama kelas dan tempat untuk tahun ajaran aktif."
        action={(
          <Link
            href="/dashboard/master/kelas"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Kelas
          </Link>
        )}
      />

      {!tahunAktif ? (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3 border border-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Belum ada tahun ajaran aktif, jadi tempelan belum bisa disiapkan.</p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <p className="text-sm font-bold text-blue-900">Tahun ajaran aktif: {tahunAktif.nama}</p>
          <span className="text-xs text-blue-600 ml-auto">{totalLabel}</span>
        </div>
      )}

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-700">Siapkan Cetakan</h2>
          <p className="mt-1 text-xs text-slate-500">Format F4 Landscape, margin narrow, bisa per kelas atau semua sekaligus.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Pilih Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => {
                setSelectedKelas(e.target.value)
                setPreviewItem(null)
                setHasLoadedPreview(false)
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih kelas --</option>
              {kelasList.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas} {kelas.tempat ? `• ${kelas.tempat}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleLoadPreview}
              disabled={loadingPreview || loadingBulk}
              className="flex h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Muat Preview
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleLoadBulk}
              disabled={loadingBulk || loadingPreview || !tahunAktif}
              className="flex h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Cetak Semua
            </button>
          </div>
        </div>
      </div>

      {hasLoadedPreview && previewItem && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Preview untuk <span className="font-bold text-slate-800">{previewItem.nama_kelas}</span>
              <span className="ml-2 text-slate-400">· 1 lembar F4 Landscape</span>
            </p>
            <button
              onClick={() => handlePrint()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Cetak Kelas Ini
            </button>
          </div>

          <div className="max-h-[780px] overflow-auto rounded-2xl border bg-slate-100 p-4 flex justify-center">
            <TempelanPreview item={previewItem} />
          </div>
        </div>
      )}

      <div className="hidden">
        <div ref={printRef}>
          {previewItem ? <TempelanKelasPrint item={previewItem} /> : null}
        </div>
      </div>

      <div className="hidden">
        <div ref={bulkPrintRef}>
          {bulkItems.map(item => (
            <TempelanKelasPrint key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
