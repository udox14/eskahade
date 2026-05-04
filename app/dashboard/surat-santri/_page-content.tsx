'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  cariSantriSurat, getPelanggaranSantri, getSuggestLevel,
  simpanSuratPernyataan, simpanSuratPerjanjian,
  getDaftarSurat, getDataPreviewSurat, hapusSurat, getAsramaList,
} from './actions'
import {
  ScrollText, Gavel, Search, Loader2, X, Trash2,
  ChevronLeft, ChevronRight, Printer, CheckSquare,
  Square, Eye, Filter, Plus, FileText, ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale }) }
  catch { return s }
}

const JENIS_LABEL: Record<string, string> = {
  pernyataan: 'Surat Pernyataan',
  SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', SK: 'SK Pengeluaran',
}

// ═══════════════════════════════════════════════════════════════════════════════
// KOMPONEN SURAT — dirender untuk react-to-print
// ═══════════════════════════════════════════════════════════════════════════════
const SuratPernyataanDoc = ({ data }: { data: any }) => {
  const { surat, pelanggaran } = data
  return (
    <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.8', color: '#000', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
          <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>MASA BAKTI 2025-2026</p>
        </div>
      </div>
      <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>SURAT PERNYATAAN</p>
        <p style={{ margin: '3px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
      </div>
      <p style={{ marginBottom: '10px' }}>Saya yang bertanda tangan dibawah ini,</p>
      <table style={{ width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
        <tbody>
          {([
            ['Nama', surat.nama_lengkap ?? ''],
            ['Asrama/ Kamar', [surat.asrama, surat.kamar].filter(Boolean).join(' / ')],
            ['Kelas Pengajian', surat.nama_kelas ?? ''],
            ['Alamat', surat.alamat ?? ''],
            ['', ''],
            ['Nama Orang Tua', surat.nama_ayah ?? ''],
            ['No Telpon', ''],
          ] as [string, string][]).map(([lbl, val], idx) => (
            <tr key={idx}>
              <td style={{ width: '135px', verticalAlign: 'top', paddingBottom: '3px', whiteSpace: 'nowrap' }}>{lbl}</td>
              <td style={{ width: '12px', verticalAlign: 'top', paddingBottom: '3px' }}>{lbl ? ':' : ''}</td>
              <td style={{ verticalAlign: 'top', paddingBottom: '3px', borderBottom: '1px solid black' }}>{val}&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginBottom: '6px', textIndent: '36px' }}>
        Menyatakan sesungguhnya bahwa pada hari{' '}
        <span style={{ borderBottom: '1px solid black', display: 'inline-block', minWidth: '180px' }}>&nbsp;</span>
        {' '}saya telah melanggar salah satu peraturan Pesantren Sukahideng, yaitu:
      </p>
      <div style={{ marginBottom: '14px' }}>
        {pelanggaran.map((p: any) => (
          <p key={p.id} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px', paddingBottom: '2px' }}>{p.deskripsi}</p>
        ))}
        {Array.from({ length: Math.max(0, 4 - pelanggaran.length) }).map((_, i) => (
          <p key={i} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px' }}>&nbsp;</p>
        ))}
      </div>
      <p style={{ textAlign: 'justify', textIndent: '36px', marginBottom: '4px' }}>
        Saya mengaku bersalah dan berjanji tidak akan mengulanginya. Apabila dikemudian hari saya kembali melanggar salah satu peraturan Pesantren, maka saya bersedia menerima sanksi yang seberat-beratnya tanpa mempersulit pihak siapapun.
      </p>
      <p style={{ textAlign: 'justify', marginBottom: '24px' }}>Demikian surat pernyataan ini saya buat dalam keadaan sehat dan tanpa paksaan dari siapapun.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ textAlign: 'center', minWidth: '220px' }}>
          <p>Sukahideng, {fmtTgl(surat.tanggal)}</p>
          <p style={{ fontWeight: 'bold', marginBottom: '72px' }}>YANG MEMBUAT PERNYATAAN</p>
          <p style={{ borderBottom: '1px solid black', paddingBottom: '2px' }}>&nbsp;</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '52px' }}><p>Mengetahui:</p></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {['KEAMANAN', 'PENGURUS ASRAMA'].map(lbl => (
          <div key={lbl} style={{ textAlign: 'center', minWidth: '180px' }}>
            <p style={{ borderBottom: '1px solid black' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
            <p style={{ fontWeight: 'bold' }}>{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const SuratPerjanjianDoc = ({ data }: { data: any }) => {
  const { surat } = data
  const tglCetak = fmtTgl(surat.tanggal)
  const level: string = surat.level
  return (
    <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.7', color: '#000', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
          <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
          <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA · MASA BAKTI 2025-2026</p>
        </div>
      </div>
      <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>
          {level === 'SK' ? 'SURAT KEPUTUSAN PENGELUARAN' : `SURAT PERJANJIAN ${level}`}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
      </div>
      <p style={{ marginBottom: '12px' }}>Yang bertanda tangan di bawah ini:</p>
      <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse' }}>
        <tbody>
          {([
            ['Nama', surat.nama_lengkap],
            ['Asrama / Kamar', [surat.asrama, surat.kamar].filter(Boolean).join(' / ')],
            ['Kelas Pengajian', surat.nama_kelas],
            ['Alamat', surat.alamat],
            ['Nama Orang Tua', surat.nama_ayah],
          ] as [string, string][]).map(([lbl, val]) => (
            <tr key={lbl}>
              <td style={{ width: '150px', verticalAlign: 'top', paddingBottom: '6px' }}>{lbl}</td>
              <td style={{ verticalAlign: 'top', paddingBottom: '6px' }}>
                : {val || <span style={{ borderBottom: '1px solid black', paddingRight: '160px' }}>&nbsp;</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ textAlign: 'justify', marginBottom: '12px', textIndent: '36px' }}>Dengan ini menyatakan berjanji dan bersanggup untuk:</p>
      <ol style={{ paddingLeft: '24px', marginBottom: '12px' }}>
        <li style={{ marginBottom: '8px' }}>Mentaati seluruh peraturan yang berlaku di Pondok Pesantren Sukahideng.</li>
        <li style={{ marginBottom: '8px' }}>Tidak akan mengulangi pelanggaran yang telah dilakukan.</li>
        <li style={{ marginBottom: '8px' }}>Bersedia menerima sanksi yang lebih berat apabila melanggar kembali.</li>
        {(level === 'SP3' || level === 'SK') && (
          <li style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            {level === 'SK'
              ? 'Apabila melanggar kembali, bersedia dikeluarkan dari Pondok Pesantren Sukahideng.'
              : 'Ini adalah peringatan terakhir. Pelanggaran berikutnya akan berakibat pengeluaran dari pesantren.'}
          </li>
        )}
      </ol>
      {surat.catatan && <p style={{ marginBottom: '12px', fontStyle: 'italic' }}>Catatan: {surat.catatan}</p>}
      <p style={{ marginBottom: '32px' }}>Demikian surat perjanjian ini dibuat dengan sesungguhnya dan penuh kesadaran.</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ textAlign: 'center' }}>
          <p>Orang Tua / Wali,</p>
          <div style={{ height: '64px' }} />
          <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{surat.nama_ayah || '(................................)'}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p>Sukahideng, {tglCetak}</p>
          <p style={{ fontWeight: 'bold' }}>Yang Berjanji,</p>
          <div style={{ height: '48px' }} />
          <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{surat.nama_lengkap}</p>
        </div>
      </div>
      <p style={{ fontWeight: 'bold', margin: '24px 0 40px' }}>Mengetahui:</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {['KEAMANAN', 'DEWAN SANTRI', 'PENGURUS ASRAMA'].map(lbl => (
          <div key={lbl} style={{ textAlign: 'center' }}>
            <p style={{ borderBottom: '1px solid black', marginBottom: '4px', paddingBottom: '48px' }}>&nbsp;</p>
            <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOMBOL CETAK — isolasi hook react-to-print per baris tabel
// ═══════════════════════════════════════════════════════════════════════════════
function TombolCetak({ suratId, tipe }: { suratId: string; tipe: 'pernyataan' | 'perjanjian' }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `@page { size: 215mm 330mm; margin: 0; }`,
  })

  const cetakSurat = async () => {
    if (!data) {
      setLoading(true)
      const d = await getDataPreviewSurat(suratId, tipe)
      setLoading(false)
      if (!d) { toast.error('Data surat tidak ditemukan'); return }
      setData(d)
      // Tunggu render selesai lalu cetak
      setTimeout(() => handlePrint(), 100)
    } else {
      handlePrint()
    }
  }

  return (
    <>
      <button
        onClick={cetakSurat}
        disabled={loading}
        title="Cetak surat"
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      </button>
      {/* Hidden print area — dirender tapi tak terlihat */}
      <div className="hidden">
        <div ref={printRef}>
          {data && tipe === 'pernyataan' && <SuratPernyataanDoc data={data} />}
          {data && tipe === 'perjanjian' && <SuratPerjanjianDoc data={data} />}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOMBOL PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TombolPreview({ suratId, tipe }: { suratId: string; tipe: 'pernyataan' | 'perjanjian' }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `@page { size: 215mm 330mm; margin: 0; }`,
  })

  const openPreview = async () => {
    if (!data) {
      setLoading(true)
      const d = await getDataPreviewSurat(suratId, tipe)
      setLoading(false)
      if (!d) { toast.error('Data surat tidak ditemukan'); return }
      setData(d)
    }
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={openPreview}
        disabled={loading}
        title="Pratinjau surat"
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
      </button>

      {open && data && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl">
            {/* toolbar pratinjau */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">
                Pratinjau — {tipe === 'pernyataan' ? 'Surat Pernyataan' : `SP ${data.surat.level}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* dokumen surat */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div ref={printRef}>
                {tipe === 'pernyataan' ? <SuratPernyataanDoc data={data} /> : <SuratPerjanjianDoc data={data} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BUAT SURAT PERNYATAAN
// ═══════════════════════════════════════════════════════════════════════════════
function FormSuratPernyataan({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [pelanggaran, setPelanggaran] = useState<any[]>([])
  const [loadingP, setLoadingP] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantriSurat(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s); setHasilCari([]); setChecked(new Set())
    setLoadingP(true)
    const p = await getPelanggaranSantri(s.id)
    setPelanggaran(p); setLoadingP(false)
  }

  const handleSimpan = async () => {
    if (!selectedSantri || checked.size === 0) { toast.error('Pilih santri dan minimal 1 pelanggaran'); return }
    setSaving(true)
    const res = await simpanSuratPernyataan(selectedSantri.id, [...checked], tanggal)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Surat Pernyataan berhasil disimpan')
    onSuccess()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Buat Surat Pernyataan</h3>
          <p className="text-xs text-slate-400">Cari santri → pilih pelanggaran → simpan</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        {/* Search santri */}
        {!selectedSantri ? (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cari Santri</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text" autoFocus placeholder="Nama atau NIS..."
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50"
                />
              </div>
              <button type="submit" disabled={searching || keyword.length < 2}
                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Cari
              </button>
            </form>
            {hasilCari.map(s => (
              <button key={s.id} onClick={() => selectSantri(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">{s.nama_lengkap.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                  <p className="text-xs text-slate-400">{s.nis} · {s.asrama}/{s.kamar} · {s.jumlah_pelanggaran}x pelanggaran</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">{selectedSantri.nama_lengkap}</p>
              <p className="text-xs text-slate-400">{selectedSantri.nis} · {selectedSantri.asrama}/{selectedSantri.kamar}</p>
            </div>
            <button onClick={() => { setSelectedSantri(null); setPelanggaran([]); setChecked(new Set()) }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Pilih pelanggaran */}
        {selectedSantri && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Pelanggaran</label>
                {pelanggaran.length > 0 && (
                  <button onClick={() => setChecked(
                    checked.size === pelanggaran.length ? new Set() : new Set(pelanggaran.map((p: any) => p.id))
                  )} className="text-xs text-slate-500 hover:text-slate-700 font-semibold">
                    {checked.size === pelanggaran.length ? 'Batal Semua' : 'Pilih Semua'}
                  </button>
                )}
              </div>
              {loadingP ? (
                <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
              ) : pelanggaran.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Santri ini belum memiliki catatan pelanggaran</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {pelanggaran.map((p: any) => (
                    <button key={p.id}
                      onClick={() => setChecked(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                        checked.has(p.id) ? 'border-slate-700 bg-slate-50' : 'border-slate-200 hover:border-slate-300')}>
                      {checked.has(p.id) ? <CheckSquare className="w-4 h-4 text-slate-700 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.deskripsi}</p>
                        <p className="text-xs text-slate-400">{fmtTgl(p.tanggal)} · {p.jenis} · +{p.poin}p</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Surat</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50 max-w-xs" />
            </div>

            <button onClick={handleSimpan} disabled={saving || checked.size === 0}
              className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan Surat Pernyataan'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BUAT SP / SK
// ═══════════════════════════════════════════════════════════════════════════════
function FormSuratSP({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [level, setLevel] = useState<'SP1' | 'SP2' | 'SP3' | 'SK'>('SP1')
  const [suggestLevel, setSuggestLevel] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantriSurat(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s); setHasilCari([])
    const suggest = await getSuggestLevel(s.id)
    setLevel(suggest as any); setSuggestLevel(suggest)
  }

  const handleSimpan = async () => {
    if (!selectedSantri) { toast.error('Pilih santri dulu'); return }
    setSaving(true)
    const res = await simpanSuratPerjanjian(selectedSantri.id, level, tanggal, catatan)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(`${level === 'SK' ? 'SK Pengeluaran' : level} berhasil disimpan`)
    onSuccess()
  }

  const SP_LEVELS = ['SP1', 'SP2', 'SP3', 'SK'] as const
  const SP_LABEL: Record<string, string> = { SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', SK: 'SK Pengeluaran' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Buat SP / SK Pengeluaran</h3>
          <p className="text-xs text-slate-400">Cari santri → pilih level → simpan</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        {!selectedSantri ? (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cari Santri</label>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" autoFocus placeholder="Nama atau NIS..."
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50" />
              </div>
              <button type="submit" disabled={searching || keyword.length < 2}
                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Cari
              </button>
            </form>
            {hasilCari.map(s => (
              <button key={s.id} onClick={() => selectSantri(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">{s.nama_lengkap.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                  <p className="text-xs text-slate-400">{s.nis} · {s.asrama}/{s.kamar}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">{selectedSantri.nama_lengkap}</p>
              <p className="text-xs text-slate-400">{selectedSantri.nis} · {selectedSantri.asrama}/{selectedSantri.kamar}</p>
            </div>
            <button onClick={() => { setSelectedSantri(null); setSuggestLevel('') }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}

        {selectedSantri && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Pilih Level
                {suggestLevel && <span className="ml-2 text-emerald-600 font-normal normal-case text-[11px]">(Saran: {suggestLevel === 'SK' ? 'SK Pengeluaran' : suggestLevel})</span>}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {SP_LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={cn('py-2.5 rounded-xl text-xs font-bold border transition-all text-center',
                      level === l ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
                    {SP_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Surat</label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Catatan <span className="font-normal normal-case text-slate-400">(opsional)</span></label>
                <input type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Keterangan tambahan..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50" />
              </div>
            </div>

            <button onClick={handleSimpan} disabled={saving}
              className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : `Simpan ${level === 'SK' ? 'SK Pengeluaran' : level}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABEL DAFTAR SURAT
// ═══════════════════════════════════════════════════════════════════════════════
function TabelDaftarSurat({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [asramaFilter, setAsramaFilter] = useState('')
  const [jenisFilter, setJenisFilter] = useState('')
  const [asramaList, setAsramaList] = useState<string[]>([])

  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asramaFilter, j = jenisFilter) => {
    setLoading(true)
    try {
      const res = await getDaftarSurat({ search: s || undefined, asrama: a || undefined, jenis: j || undefined, page: pg })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg)
      setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asramaFilter, jenisFilter])

  useEffect(() => {
    getAsramaList().then(setAsramaList)
  }, [])

  // Reload saat form berhasil submit
  useEffect(() => {
    if (refreshKey > 0) load(1, search, asramaFilter, jenisFilter)
  }, [refreshKey])

  const handleTampilkan = (e?: React.FormEvent) => {
    e?.preventDefault()
    setSearch(searchInput)
    load(1, searchInput, asramaFilter, jenisFilter)
  }

  const handleHapus = async (row: any) => {
    if (!await confirm(`Hapus surat ${JENIS_LABEL[row.tipe === 'pernyataan' ? 'pernyataan' : row.level] ?? ''} atas nama ${row.nama_lengkap}?`)) return
    setDeleting(row.id)
    const res = await hapusSurat(row.id, row.tipe)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Surat dihapus')
    load(page, search, asramaFilter, jenisFilter)
  }

  const jenisLabel = (row: any) => row.tipe === 'pernyataan' ? 'Pernyataan' : (row.level === 'SK' ? 'SK Pengeluaran' : row.level)

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <form onSubmit={handleTampilkan} className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text" placeholder="Cari nama atau NIS (kosongkan untuk semua)..."
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
          />
        </div>
        {asramaList.length > 0 && (
          <select value={asramaFilter} onChange={e => setAsramaFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent">
            <option value="">Semua Asrama</option>
            {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select value={jenisFilter} onChange={e => setJenisFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent">
          <option value="">Semua Jenis</option>
          <option value="pernyataan">Surat Pernyataan</option>
          <option value="SP1">SP 1</option>
          <option value="SP2">SP 2</option>
          <option value="SP3">SP 3</option>
          <option value="SK">SK Pengeluaran</option>
        </select>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-60 flex items-center gap-1.5 transition-colors shadow-sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
          Tampilkan
        </button>
      </form>

      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 border-dashed text-center">
          <FileText className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm font-medium">Data belum dimuat</p>
          <p className="text-xs text-slate-400">Atur filter lalu klik <strong>Tampilkan</strong>, atau langsung tampilkan semua</p>
          <button onClick={() => handleTampilkan()}
            className="mt-1 px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shadow-sm">
            Tampilkan Semua
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-12 bg-white rounded-2xl border border-slate-200 text-center gap-2">
          <FileText className="w-9 h-9 text-slate-200" />
          <p className="text-slate-500 text-sm font-medium">Belum ada surat</p>
          <p className="text-xs text-slate-400">Coba ubah filter atau buat surat baru</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 px-0.5"><strong className="text-slate-700">{total}</strong> surat tercatat</p>

          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['No', 'Nama Santri', 'Asrama / Kamar', 'Pelanggaran / Catatan', 'Jenis Surat', 'Tanggal', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-300">{(page - 1) * 30 + i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{r.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.asrama}/{r.kamar}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                      {r.tipe === 'pernyataan'
                        ? <span className="text-slate-400">{JSON.parse(r.detail || '[]').length} pelanggaran</span>
                        : r.catatan
                          ? <span className="italic text-slate-400 truncate block">{r.catatan}</span>
                          : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">{jenisLabel(r)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtTgl(r.tanggal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <TombolPreview suratId={r.id} tipe={r.tipe} />
                        <TombolCetak suratId={r.id} tipe={r.tipe} />
                        <button
                          onClick={() => handleHapus(r)}
                          disabled={deleting === r.id}
                          title="Hapus surat"
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {deleting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{r.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{r.nis} · {r.asrama}/{r.kamar}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 shrink-0">{jenisLabel(r)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{fmtTgl(r.tanggal)}</span>
                  <div className="flex items-center gap-0.5">
                    <TombolPreview suratId={r.id} tipe={r.tipe} />
                    <TombolCetak suratId={r.id} tipe={r.tipe} />
                    <button onClick={() => handleHapus(r)} disabled={deleting === r.id}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      {deleting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-xs text-slate-500">Hal {page}/{totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE CONTENT
// ═══════════════════════════════════════════════════════════════════════════════
export function PageContent() {
  const confirm = useConfirm()
  const [view, setView] = useState<'menu' | 'pernyataan' | 'sp'>('menu')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSuccess = () => {
    setView('menu')
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-5 pb-16">
      {/* Page header */}
      <DashboardPageHeader
        title="SP & SK"
        description="Surat pernyataan, SP, dan SK Pengeluaran"
      />

      {/* Form area — muncul saat klik card */}
      {view === 'pernyataan' && (
        <FormSuratPernyataan onBack={() => setView('menu')} onSuccess={handleSuccess} />
      )}
      {view === 'sp' && (
        <FormSuratSP onBack={() => setView('menu')} onSuccess={handleSuccess} />
      )}

      {/* Card menu — selalu tampil di view=menu */}
      {view === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card Surat Pernyataan */}
          <button
            onClick={() => setView('pernyataan')}
            className="group relative flex flex-col items-start gap-4 p-6 bg-white border border-slate-200 rounded-2xl text-left hover:border-slate-400 hover:shadow-md transition-all active:scale-[0.98] overflow-hidden"
          >
            {/* subtle bg accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors mb-3">
                <ScrollText className="w-5 h-5 text-slate-600" />
              </div>
              <p className="font-bold text-slate-900">Surat Pernyataan</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Buat surat pernyataan berdasarkan catatan pelanggaran santri.
              </p>
            </div>
            <div className="relative mt-auto pt-3 border-t border-slate-100 w-full">
              <p className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                Klik untuk membuat →
              </p>
            </div>
          </button>

          {/* Card SP & SK */}
          <button
            onClick={() => setView('sp')}
            className="group relative flex flex-col items-start gap-4 p-6 bg-white border border-slate-200 rounded-2xl text-left hover:border-slate-400 hover:shadow-md transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors mb-3">
                <Gavel className="w-5 h-5 text-slate-600" />
              </div>
              <p className="font-bold text-slate-900">SP & SK Pengeluaran</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Buat Surat Perjanjian SP 1–3 atau Surat Keputusan Pengeluaran.
              </p>
            </div>
            <div className="relative mt-auto pt-3 border-t border-slate-100 w-full flex items-center justify-between">
              <div className="flex gap-1">
                {['SP 1', 'SP 2', 'SP 3', 'SK'].map(l => (
                  <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">{l}</span>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">Buat →</p>
            </div>
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Surat</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* Tabel surat — selalu tampil */}
      <TabelDaftarSurat refreshKey={refreshKey} />
    </div>
  )
}
