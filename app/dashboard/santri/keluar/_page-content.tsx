'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSantriAktif, getSantriKeluar, getAsramaList, getPengajuanKeluar,
  tetapkanKeluar, aktifkanKembali, getDataSuratBerhenti, catatSuratBerhenti,
  setujuiPengajuanKeluar, tolakPengajuanKeluar
} from './actions'
import {
  UserX, UserCheck, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, Printer, X, AlertTriangle, CheckCircle, Loader2,
  FileText, CalendarDays, LogOut, RotateCcw, Users, Building2
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string | null) {
  if (!s) return '—'
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: id }) }
  catch { return s }
}
function fmtNum(n: number) { return new Intl.NumberFormat('id-ID').format(n) }

type SantriAktif = {
  id: string; nis: string; nama_lengkap: string
  asrama: string | null; kamar: string | null; tahun_masuk: number | null
}
type SantriKeluar = SantriAktif & {
  tanggal_keluar: string | null; alasan_keluar: string | null; ada_surat: number
}
type PengajuanKeluar = {
  id: string
  santri_id: string
  nis: string | null
  nama_lengkap: string | null
  asrama: string
  kamar: string | null
  tanggal_tandai: string
  catatan: string | null
  status_global: string | null
  penanda_nama: string | null
}

// ── Modal Tetapkan Keluar ─────────────────────────────────────────────────────
function ModalKeluar({ santri, onClose, onSuccess }: {
  santri: SantriAktif
  onClose: () => void
  onSuccess: () => void
}) {
  const [tanggal, setTanggal]   = useState(new Date().toISOString().slice(0, 10))
  const [alasan, setAlasan]     = useState('')
  const [buatSurat, setBuatSurat] = useState(true)
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await tetapkanKeluar({
      santriId: santri.id, tanggalKeluar: tanggal,
      alasanKeluar: alasan, buatSurat,
    })
    setSaving(false)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${santri.nama_lengkap} ditetapkan keluar`)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">Tetapkan Keluar</h3>
              <p className="text-sm text-slate-500 mt-0.5">{santri.nama_lengkap}</p>
            </div>
            <button type="button" onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Info santri */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm">
              <p className="text-slate-500 text-xs font-medium mb-1">Data Santri</p>
              <p className="font-semibold text-slate-800">{santri.nama_lengkap}</p>
              <p className="text-slate-500 text-xs">{santri.nis} · {santri.asrama || '—'} / {santri.kamar || '—'}</p>
            </div>

            {/* Tanggal keluar */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Tanggal Keluar
              </label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>

            {/* Alasan */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Alasan Keluar <span className="text-slate-400 font-normal ml-1">(Opsional)</span>
              </label>
              <textarea value={alasan} onChange={e => setAlasan(e.target.value)}
                placeholder="Contoh: Pindah ke pesantren lain, urusan keluarga, dsb..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" />
            </div>

            {/* Opsi buat surat */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <input type="checkbox" checked={buatSurat} onChange={e => setBuatSurat(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-600" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Catat ke Log Surat</p>
                <p className="text-xs text-slate-400">Otomatis muncul di Layanan Surat sebagai Surat Berhenti</p>
              </div>
            </label>

            {/* Warning */}
            <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Santri akan hilang dari semua fitur absensi, SPP, uang jajan, dll. Bisa dikembalikan aktif kapan saja.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 pt-0 flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Tetapkan Keluar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Cetak Surat ─────────────────────────────────────────────────────────
function ModalSetujuiPengajuan({ pengajuan, onClose, onSuccess }: {
  pengajuan: PengajuanKeluar
  onClose: () => void
  onSuccess: () => void
}) {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [alasan, setAlasan] = useState(pengajuan.catatan || '')
  const [buatSurat, setBuatSurat] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await setujuiPengajuanKeluar({
      pengajuanId: pengajuan.id,
      tanggalKeluar: tanggal,
      alasanKeluar: alasan,
      buatSurat,
    })
    setSaving(false)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${pengajuan.nama_lengkap || 'Santri'} dikeluarkan`)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">ACC Santri Keluar</h3>
              <p className="text-sm text-slate-500 mt-0.5">{pengajuan.nama_lengkap || '-'}</p>
            </div>
            <button type="button" onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm">
              <p className="text-slate-500 text-xs font-medium mb-1">Penandaan dari Asrama</p>
              <p className="font-semibold text-slate-800">{pengajuan.penanda_nama || 'Pengurus asrama'}</p>
              <p className="text-slate-500 text-xs">
                {pengajuan.asrama} / {pengajuan.kamar || '—'} · {fmtTgl(pengajuan.tanggal_tandai)}
              </p>
              {pengajuan.catatan ? <p className="text-xs text-slate-600 mt-2">{pengajuan.catatan}</p> : null}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Tanggal Keluar
              </label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Alasan Keluar
              </label>
              <textarea value={alasan} onChange={e => setAlasan(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" />
            </div>

            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <input type="checkbox" checked={buatSurat} onChange={e => setBuatSurat(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-600" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Catat ke Log Surat</p>
                <p className="text-xs text-slate-400">Otomatis muncul sebagai surat berhenti</p>
              </div>
            </label>
          </div>

          <div className="p-5 pt-0 flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'ACC dan Keluarkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalSurat({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getDataSuratBerhenti(santriId).then(d => { setData(d); setLoading(false) })
  }, [santriId])

  const handleCetak = async () => {
    // Catat ke log surat dulu
    if (data) {
      await catatSuratBerhenti(santriId, `Keluar per ${data.tanggal_keluar || '—'}. ${data.alasan_keluar || ''}`)
    }
    window.print()
    toast.success('Surat siap dicetak')
  }

  const tglCetak = format(new Date(), 'dd MMMM yyyy', { locale: id })
  const tahunIni = new Date().getFullYear()

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-start justify-center p-4 overflow-y-auto backdrop-blur-sm print:bg-transparent print:p-0 print:block">
      <div className="w-full max-w-3xl">
        {/* Toolbar cetak */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex items-center justify-between print:hidden">
          <div>
            <p className="font-bold text-slate-800">Preview Surat Pengunduran Diri</p>
            <p className="text-sm text-slate-500">{data?.nama_lengkap || '—'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCetak} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50">
              <Printer className="w-4 h-4" /> Cetak
            </button>
            <button onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview surat */}
        {loading ? (
          <div className="bg-white rounded-2xl p-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : !data ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400">Data tidak ditemukan</div>
        ) : (
          <div ref={printRef}
            className="w-full bg-white shadow-xl print:shadow-none"
            style={{ minHeight: '297mm', fontFamily: 'serif', padding: '2.5cm 2cm', fontSize: '14px', lineHeight: '1.8' }}>

            {/* Kop */}
            <div style={{ marginBottom: '12px' }}>
              <img src="/kop-pesantren.png" alt="Kop" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain' }} />
            </div>
            <hr style={{ borderTop: '3px solid black', marginBottom: '16px' }} />

            {/* Judul */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', margin: 0 }}>
                SURAT PENGUNDURAN DIRI
              </h2>
              <p style={{ margin: '4px 0 0' }}>Nomor : ...../PP-SKH/{tahunIni}</p>
            </div>

            <p style={{ marginBottom: '8px' }}>Yang bertanda tangan di bawah ini :</p>
            <table style={{ width: '100%', marginBottom: '12px', marginLeft: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '160px', fontWeight: 'bold', verticalAlign: 'top' }}>Nama Wali Santri</td>
                  <td style={{ verticalAlign: 'top' }}>: {data.nama_ayah || '.................................................................'} (Ayah/Wali)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Alamat</td>
                  <td style={{ verticalAlign: 'top' }}>: {data.alamat || '.................................................................'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Nomor WA</td>
                  <td style={{ verticalAlign: 'top' }}>: .................................................................</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginBottom: '8px' }}>Selaku wali santri dari :</p>
            <table style={{ width: '100%', marginBottom: '16px', marginLeft: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '160px', fontWeight: 'bold', verticalAlign: 'top' }}>Nama Santri</td>
                  <td style={{ verticalAlign: 'top' }}>: {data.nama_lengkap}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Asrama / Kamar</td>
                  <td style={{ verticalAlign: 'top' }}>: {data.asrama || '—'} / {data.kamar || '—'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Tanggal Keluar</td>
                  <td style={{ verticalAlign: 'top' }}>: {fmtTgl(data.tanggal_keluar)}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
              Dengan ini kami menyatakan untuk mengundurkan diri dari Pondok Pesantren Sukahideng
              dikarenakan <strong>"{data.alasan_keluar || '.................................................................'}"</strong>.
              Demikian pernyataan ini kami buat dengan sesungguhnya.
            </p>

            <p style={{ textAlign: 'right', marginBottom: '8px', fontWeight: 'bold' }}>Sukahideng, {tglCetak}</p>
            <p style={{ fontWeight: 'bold', marginBottom: '32px' }}>Yang membuat pernyataan,</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px 16px', marginBottom: '16px' }}>
              {[
                { label: 'Wali Santri,', nama: data.nama_ayah },
                { label: 'Santri yang bersangkutan,', nama: data.nama_lengkap },
                { label: 'Dewan Santri,', nama: null },
                { label: 'Pengurus Asrama,', nama: null },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '60px' }}>{item.label}</p>
                  <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                    {item.nama || '..................................................'}
                  </p>
                </div>
              ))}
            </div>

            {/* TTD Pimpinan */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <div style={{ textAlign: 'center', minWidth: '280px' }}>
                <p style={{ fontWeight: 'bold' }}>Mengetahui,</p>
                <p style={{ fontWeight: 'bold' }}>Pimpinan Pesantren,</p>
                <div style={{ height: '96px' }} />
                <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>Drs. KH. I. Abdul Basith Wahab</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@media print { body * { visibility: hidden; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  )
}

// ── Tab Santri Aktif ──────────────────────────────────────────────────────────
function TabAktif({ asramaList }: { asramaList: string[] }) {
  const [rows, setRows]         = useState<SantriAktif[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]     = useState('')
  const [asrama, setAsrama]     = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [modalSantri, setModalSantri] = useState<SantriAktif | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asrama, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await getSantriAktif({
        search: s || undefined,
        asrama: a !== 'SEMUA' ? a : undefined,
        page: pg,
        pageSize: ps,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asrama, pageSize])

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={asrama} onChange={e => { setAsrama(e.target.value); if (hasLoaded) load(1, search, e.target.value) }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput, asrama) }}
            className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Nama atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>
          </form>
          <button onClick={() => { setSearch(searchInput); load(1, searchInput, asrama) }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors self-end">
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Baris:</span>
            <select value={pageSize} onChange={e => { const ps = Number(e.target.value); setPageSize(ps); load(1, search, asrama, ps) }}
              className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none">
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Empty / Loading */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Users className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Tekan <strong>Tampilkan</strong> untuk melihat daftar santri</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      )}

      {/* Tabel */}
      {hasLoaded && !loading && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-slate-700">{fmtNum(rows.length)}</strong> dari <strong className="text-slate-700">{fmtNum(total)}</strong> santri aktif</span>
            {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Tidak ada santri yang cocok.
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['No','Nama Santri','Asrama / Kamar','Angkatan',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-300">{(page-1)*pageSize + i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{r.nama_lengkap}</div>
                          <div className="text-xs text-slate-400">{r.nis}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {r.asrama || '—'} / <span className="bg-slate-100 px-1.5 py-0.5 rounded-lg font-bold">{r.kamar || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{r.tahun_masuk || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setModalSantri(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors ml-auto">
                            <LogOut className="w-3.5 h-3.5" /> Tetapkan Keluar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</p>
                    </div>
                    <button onClick={() => setModalSantri(r)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors">
                      <LogOut className="w-3.5 h-3.5" /> Keluar
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => load(page-1)} disabled={page<=1||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Sebelumnya
                  </button>
                  <span className="text-sm text-slate-500">Hal {page}/{totalPages}</span>
                  <button onClick={() => load(page+1)} disabled={page>=totalPages||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal tetapkan keluar */}
      {modalSantri && (
        <ModalKeluar santri={modalSantri} onClose={() => setModalSantri(null)}
          onSuccess={() => { setModalSantri(null); load(page) }} />
      )}
    </div>
  )
}

// ── Tab Santri Keluar ─────────────────────────────────────────────────────────
function TabPengajuan({ asramaList }: { asramaList: string[] }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<PengajuanKeluar[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [modalPengajuan, setModalPengajuan] = useState<PengajuanKeluar | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asrama, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await getPengajuanKeluar({
        search: s || undefined,
        asrama: a !== 'SEMUA' ? a : undefined,
        page: pg,
        pageSize: ps,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asrama, pageSize])

  const handleReject = async (row: PengajuanKeluar) => {
    if (!await confirm(`Tolak penandaan keluar untuk ${row.nama_lengkap || 'santri'}?`)) return
    setRejectingId(row.id)
    const res = await tolakPengajuanKeluar({ pengajuanId: row.id })
    setRejectingId(null)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success('Pengajuan ditolak')
    setRows(prev => prev.filter(item => item.id !== row.id))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={asrama} onChange={e => { setAsrama(e.target.value); if (hasLoaded) load(1, search, e.target.value) }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput, asrama) }}
            className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Nama atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </form>
          <button onClick={() => { setSearch(searchInput); load(1, searchInput, asrama) }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors self-end">
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Baris:</span>
            <select value={pageSize} onChange={e => { const ps = Number(e.target.value); setPageSize(ps); load(1, search, asrama, ps) }}
              className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none">
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Building2 className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Tekan <strong>Tampilkan</strong> untuk melihat penandaan dari asrama</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      )}

      {hasLoaded && !loading && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-slate-700">{fmtNum(total)}</strong> penandaan menunggu ACC</span>
            {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Belum ada penandaan keluar dari asrama.
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['No','Santri','Asrama / Kamar','Ditandai','Catatan','Aksi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-300">{(page-1)*pageSize + i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{r.nama_lengkap || '-'}</div>
                          <div className="text-xs text-slate-400">{r.nis || '-'} · {r.penanda_nama || 'Pengurus asrama'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {r.asrama} / <span className="bg-slate-100 px-1.5 py-0.5 rounded-lg font-bold">{r.kamar || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{fmtTgl(r.tanggal_tandai)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px] truncate" title={r.catatan || ''}>{r.catatan || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModalPengajuan(r)}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors">
                              ACC
                            </button>
                            <button onClick={() => handleReject(r)} disabled={rejectingId === r.id}
                              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                              {rejectingId === r.id ? 'Memproses...' : 'Tolak'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                    <div>
                      <p className="font-semibold text-slate-800">{r.nama_lengkap || '-'}</p>
                      <p className="text-xs text-slate-400">{r.nis || '-'} · {r.asrama} / {r.kamar || '—'}</p>
                    </div>
                    <p className="text-xs text-slate-500">Ditandai {fmtTgl(r.tanggal_tandai)} oleh {r.penanda_nama || 'pengurus asrama'}</p>
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2">{r.catatan || 'Tanpa catatan'}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setModalPengajuan(r)}
                        className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">ACC</button>
                      <button onClick={() => handleReject(r)} disabled={rejectingId === r.id}
                        className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">Tolak</button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => load(page-1)} disabled={page<=1||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Sebelumnya
                  </button>
                  <span className="text-sm text-slate-500">Hal {page}/{totalPages}</span>
                  <button onClick={() => load(page+1)} disabled={page>=totalPages||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modalPengajuan && (
        <ModalSetujuiPengajuan
          pengajuan={modalPengajuan}
          onClose={() => setModalPengajuan(null)}
          onSuccess={() => { setModalPengajuan(null); load(page) }}
        />
      )}
    </div>
  )
}

function TabKeluar({ asramaList }: { asramaList: string[] }) {
  const [rows, setRows]         = useState<SantriKeluar[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]     = useState('')
   const [asrama, setAsrama]     = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [suratId, setSuratId]   = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search, a = asrama, ps = pageSize) => {
    setLoading(true)
    try {
      const res = await getSantriKeluar({
        search: s || undefined,
        asrama: a !== 'SEMUA' ? a : undefined,
        page: pg,
        pageSize: ps,
      })
      setRows(res.rows); setTotal(res.total)
      setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search, asrama, pageSize])

  const handleRestore = async (r: SantriKeluar) => {
    if (!await confirm(`Kembalikan ${r.nama_lengkap} menjadi santri aktif?`)) return
    setRestoringId(r.id)
    const res = await aktifkanKembali(r.id)
    setRestoringId(null)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${r.nama_lengkap} berhasil diaktifkan kembali`)
    setRows(prev => prev.filter(x => x.id !== r.id))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={asrama} onChange={e => { setAsrama(e.target.value); if (hasLoaded) load(1, search, e.target.value) }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput, asrama) }}
            className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Nama atau NIS..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
          </form>
          <button onClick={() => { setSearch(searchInput); load(1, searchInput, asrama) }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-60 transition-colors self-end">
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Baris:</span>
            <select value={pageSize} onChange={e => { const ps = Number(e.target.value); setPageSize(ps); load(1, search, asrama, ps) }}
              className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none">
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <UserX className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Tekan <strong>Tampilkan</strong> untuk melihat daftar santri keluar</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      )}

      {hasLoaded && !loading && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-slate-700">{fmtNum(total)}</strong> santri keluar tercatat</span>
            {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 bg-white rounded-2xl border border-slate-200 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-300" />
              <p className="text-slate-500 text-sm">Tidak ada santri keluar yang cocok.</p>
            </div>
          ) : (
            <>
               {/* Desktop: Compact Table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">No</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Santri</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keluar</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alasan</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2 text-xs text-slate-300">{(page-1)*pageSize + i + 1}</td>
                        <td className="px-4 py-2">
                          <div className="font-semibold text-slate-800 text-xs">{r.nama_lengkap}</div>
                          <div className="text-[10px] text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-xs font-bold text-slate-700">{fmtTgl(r.tanggal_keluar)}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-xs text-slate-500 max-w-[200px] truncate" title={r.alasan_keluar || ''}>
                            {r.alasan_keluar || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setSuratId(r.id)}
                              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                              title="Cetak Surat">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRestore(r)} disabled={restoringId === r.id}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1">
                              {restoringId === r.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <RotateCcw className="w-3 h-3"/>}
                              Aktifkan
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Compact Cards */}
              <div className="md:hidden space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{r.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</p>
                      </div>
                      <div className="shrink-0 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        {fmtTgl(r.tanggal_keluar)}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mb-3 bg-slate-50 p-1.5 rounded-lg italic">
                      {r.alasan_keluar || 'Tanpa alasan'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setSuratId(r.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                        <Printer className="w-3.5 h-3.5" /> Surat
                      </button>
                      <button onClick={() => handleRestore(r)} disabled={restoringId === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                        {restoringId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RotateCcw className="w-3.5 h-3.5"/>}
                        Pulihkan
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => load(page-1)} disabled={page<=1||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Sebelumnya
                  </button>
                  <span className="text-sm text-slate-500">Hal {page}/{totalPages}</span>
                  <button onClick={() => load(page+1)} disabled={page>=totalPages||loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {suratId && <ModalSurat santriId={suratId} onClose={() => setSuratId(null)} />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SantriKeluarPage() {
  const [tab, setTab]           = useState<'aktif' | 'pengajuan' | 'keluar'>('aktif')
  const [asramaList, setAsramaList] = useState<string[]>([])

  useEffect(() => { getAsramaList().then(setAsramaList) }, [])

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-5">
      <DashboardPageHeader
        title="Santri Keluar"
        description="Dewan santri bisa mengeksekusi keluar langsung, atau memproses penandaan keluar dari pengurus asrama."
      />

      {/* Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([
          { key: 'aktif',  label: 'Tetapkan Keluar', icon: LogOut },
          { key: 'pengajuan', label: 'Pengajuan Asrama', icon: Building2 },
          { key: 'keluar', label: 'Daftar Keluar',   icon: UserX  },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'aktif'  && <TabAktif  asramaList={asramaList} />}
      {tab === 'pengajuan' && <TabPengajuan asramaList={asramaList} />}
      {tab === 'keluar' && <TabKeluar asramaList={asramaList} />}
    </div>
  )
}
