'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSantriAktif, getAsramaList, getPengajuanKeluar,
  tolakPengajuanKeluar, setujuiPengajuanKeluar,
  getDataSuratBerhenti, catatSuratBerhenti,
  tetapkanKeluarBulk, ubahDataKeluar, aktifkanKembaliKeluar,
  getDaftarKeluar, getAsramaSemuaKeluar, getGrupAlumni,
  type JenisKeluar, type PayloadKeluar,
} from './actions'
import {
  UserX, Search, Filter, ChevronLeft, ChevronRight,
  X, AlertTriangle, CheckCircle, Loader2, Printer, GraduationCap,
  LogOut, PauseCircle, RotateCcw, Users, Building2, Pencil, Info,
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
const TODAY = () => new Date().toISOString().slice(0, 10)

const JENIS_META: Record<JenisKeluar, { label: string; desc: string; badge: string; ring: string; btn: string; icon: any }> = {
  alumni: {
    label: 'Alumni',
    desc: 'Lulus / tamat. Data diarsipkan & dikelompokkan per angkatan.',
    badge: 'bg-blue-100 text-blue-700',
    ring: 'focus:ring-blue-500',
    btn: 'bg-blue-600 hover:bg-blue-700',
    icon: GraduationCap,
  },
  berhenti: {
    label: 'Berhenti',
    desc: 'Keluar permanen (boyong / dikeluarkan).',
    badge: 'bg-rose-100 text-rose-700',
    ring: 'focus:ring-rose-500',
    btn: 'bg-rose-600 hover:bg-rose-700',
    icon: LogOut,
  },
  nonaktif: {
    label: 'Nonaktif Sementara',
    desc: 'Cuti / izin panjang. Akan kembali aktif. BUKAN keluar permanen.',
    badge: 'bg-amber-100 text-amber-700',
    ring: 'focus:ring-amber-500',
    btn: 'bg-amber-600 hover:bg-amber-700',
    icon: PauseCircle,
  },
}

type GrupAlumni = {
  key: string
  angkatan: number | null
  catatan: string | null
  tanggal_arsip: string
  jumlah: number
}
type DaftarRow = {
  id: string; nis: string; nama_lengkap: string
  asrama: string | null; kamar: string | null; tahun_masuk: number | null
  status_global: string; jenis: JenisKeluar | null
  tanggal_keluar: string | null; alasan_keluar: string | null
  tanggal_mulai: string | null; tanggal_rencana_aktif: string | null
  alasan_nonaktif: string | null; catatan_nonaktif: string | null
  arsip_id: string | null; grup_alumni: string | null; angkatan: number | null; tanggal_arsip: string | null
  ada_surat: number
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL: pilih/ubah jenis keluar (dipakai untuk Tetapkan, Ubah, dan ACC)
// ════════════════════════════════════════════════════════════════════════════
function JenisKeluarModal({
  title, subtitle, initial, count, submitLabel, onClose, onSubmit, onSuccess,
}: {
  title: string
  subtitle?: string
  initial?: Partial<DaftarRow> & { jenis?: JenisKeluar }
  count?: number
  submitLabel: string
  onClose: () => void
  onSubmit: (payload: PayloadKeluar) => Promise<{ error?: string } | { success?: boolean; berhasil?: number; gagal?: number; errors?: string[] }>
  onSuccess: () => void
}) {
  const [jenis, setJenis] = useState<JenisKeluar>(initial?.jenis ?? 'berhenti')
  const [tanggal, setTanggal] = useState(
    initial?.tanggal_keluar?.slice(0, 10) || initial?.tanggal_mulai?.slice(0, 10) ||
    initial?.tanggal_arsip?.slice(0, 10) || TODAY()
  )
  const [tanggalRencana, setTanggalRencana] = useState(initial?.tanggal_rencana_aktif?.slice(0, 10) || '')
  const [alasan, setAlasan] = useState(initial?.alasan_keluar || initial?.alasan_nonaktif || '')
  const [catatan, setCatatan] = useState(initial?.catatan_nonaktif || '')
  const [buatSurat, setBuatSurat] = useState(initial ? false : true)
  // alumni group
  const [grupMode, setGrupMode] = useState<'existing' | 'new'>(initial?.grup_alumni !== undefined && initial?.arsip_id ? 'existing' : 'new')
  const [grupBaru, setGrupBaru] = useState(initial?.grup_alumni || '')
  const [grupList, setGrupList] = useState<GrupAlumni[]>([])
  const [grupKey, setGrupKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGrupAlumni().then((g) => {
      setGrupList(g as GrupAlumni[])
      if (g.length === 0) setGrupMode('new')
    })
  }, [])

  const buildPayload = (): PayloadKeluar | { error: string } => {
    if (jenis === 'berhenti') {
      return { jenis, tanggalKeluar: tanggal, alasanKeluar: alasan, buatSurat }
    }
    if (jenis === 'nonaktif') {
      if (!alasan.trim()) return { error: 'Alasan nonaktif wajib diisi' }
      return { jenis, tanggalMulai: tanggal, tanggalRencanaAktif: tanggalRencana || undefined, alasan, catatan }
    }
    // alumni
    if (grupMode === 'existing') {
      const g = grupList.find(x => x.key === grupKey)
      if (!g) return { error: 'Pilih grup angkatan tujuan' }
      return { jenis, grup: { mode: 'existing', angkatan: g.angkatan, catatan: g.catatan, tanggal_arsip: g.tanggal_arsip } }
    }
    if (!grupBaru.trim()) return { error: 'Isi nama/keterangan grup angkatan (mis. "Wisuda 2024")' }
    return { jenis, grup: { mode: 'new', catatan: grupBaru, tanggalArsip: tanggal } }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = buildPayload()
    if ('error' in payload) { toast.error(payload.error as string); return }
    setSaving(true)
    const res = await onSubmit(payload as PayloadKeluar)
    setSaving(false)
    if (res && 'error' in res && res.error) { toast.error('Gagal', { description: res.error }); return }
    const gagal = (res as any)?.gagal ?? 0
    if (gagal > 0) toast.warning(`Selesai dengan ${gagal} gagal`, { description: (res as any)?.errors?.[0] })
    else toast.success('Berhasil disimpan')
    onSuccess()
  }

  const meta = JENIS_META[jenis]

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="font-bold text-slate-900">{title}</h3>
              {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
              {count ? <p className="text-sm text-slate-500 mt-0.5">{count} santri terpilih</p> : null}
            </div>
            <button type="button" onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Pilih jenis */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Jenis Keluar</label>
              <div className="grid grid-cols-3 gap-2">
                {(['alumni', 'berhenti', 'nonaktif'] as JenisKeluar[]).map(j => {
                  const m = JENIS_META[j]
                  const active = jenis === j
                  return (
                    <button key={j} type="button" onClick={() => setJenis(j)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        active ? `${m.badge} border-transparent ring-2 ring-offset-1 ring-current` : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}>
                      <m.icon className="w-5 h-5" />
                      {m.label.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              <p className="flex items-start gap-1.5 text-xs text-slate-500 mt-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {meta.desc}
              </p>
            </div>

            {/* Field per jenis */}
            {jenis === 'berhenti' && (
              <>
                <Field label="Tanggal Keluar">
                  <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} max={TODAY()}
                    className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                </Field>
                <Field label="Alasan Keluar" optional>
                  <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2}
                    placeholder="Contoh: pindah pesantren, urusan keluarga..."
                    className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${meta.ring}`} />
                </Field>
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={buatSurat} onChange={e => setBuatSurat(e.target.checked)} className="w-4 h-4 rounded accent-rose-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Catat ke Log Surat Berhenti</p>
                    <p className="text-xs text-slate-400">Muncul di Layanan Surat</p>
                  </div>
                </label>
              </>
            )}

            {jenis === 'nonaktif' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tanggal Mulai">
                    <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                  </Field>
                  <Field label="Rencana Aktif" optional>
                    <input type="date" value={tanggalRencana} onChange={e => setTanggalRencana(e.target.value)}
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                  </Field>
                </div>
                <Field label="Alasan Nonaktif">
                  <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2}
                    placeholder="Contoh: sakit, izin pulang panjang..."
                    className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${meta.ring}`} />
                </Field>
                <Field label="Catatan" optional>
                  <input type="text" value={catatan} onChange={e => setCatatan(e.target.value)}
                    className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                </Field>
              </>
            )}

            {jenis === 'alumni' && (
              <>
                <Field label="Grup Angkatan">
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-2">
                    {grupList.length > 0 && (
                      <button type="button" onClick={() => setGrupMode('existing')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${grupMode === 'existing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                        Grup Lama
                      </button>
                    )}
                    <button type="button" onClick={() => setGrupMode('new')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${grupMode === 'new' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                      Grup Baru
                    </button>
                  </div>
                  {grupMode === 'existing' ? (
                    <select value={grupKey} onChange={e => setGrupKey(e.target.value)}
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${meta.ring}`}>
                      <option value="">— Pilih grup —</option>
                      {grupList.map(g => (
                        <option key={g.key} value={g.key}>
                          {g.catatan || `Angkatan ${g.angkatan ?? '?'}`} · {fmtTgl(g.tanggal_arsip)} ({g.jumlah})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={grupBaru} onChange={e => setGrupBaru(e.target.value)}
                      placeholder='Contoh: "Wisuda Angkatan 2024"'
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                  )}
                </Field>
                {grupMode === 'new' && (
                  <Field label="Tanggal Arsip">
                    <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} max={TODAY()}
                      className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${meta.ring}`} />
                  </Field>
                )}
              </>
            )}

            <div className="flex gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Data santri tetap tersimpan & bisa diaktifkan kembali kapan saja. Salah jenis? Bisa diedit dari Daftar.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 pt-3 flex gap-2 border-t border-slate-100 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2 ${meta.btn}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <meta.icon className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}{optional && <span className="text-slate-400 font-normal ml-1 normal-case">(opsional)</span>}
      </label>
      {children}
    </div>
  )
}

// ── Modal Cetak Surat (tetap) ────────────────────────────────────────────────
function ModalSurat({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getDataSuratBerhenti(santriId).then(d => { setData(d); setLoading(false) })
  }, [santriId])

  const handleCetak = async () => {
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

        {loading ? (
          <div className="bg-white rounded-2xl p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
        ) : !data ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400">Data tidak ditemukan</div>
        ) : (
          <div ref={printRef} className="w-full bg-white shadow-xl print:shadow-none"
            style={{ minHeight: '297mm', fontFamily: 'serif', padding: '2.5cm 2cm', fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '12px' }}>
              <img src="/kop-pesantren.png" alt="Kop" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain' }} />
            </div>
            <hr style={{ borderTop: '3px solid black', marginBottom: '16px' }} />
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', margin: 0 }}>SURAT PENGUNDURAN DIRI</h2>
              <p style={{ margin: '4px 0 0' }}>Nomor : ...../PP-SKH/{tahunIni}</p>
            </div>
            <p style={{ marginBottom: '8px' }}>Yang bertanda tangan di bawah ini :</p>
            <table style={{ width: '100%', marginBottom: '12px', marginLeft: '16px' }}>
              <tbody>
                <tr><td style={{ width: '160px', fontWeight: 'bold', verticalAlign: 'top' }}>Nama Wali Santri</td><td style={{ verticalAlign: 'top' }}>: {data.nama_ayah || '.................................................................'} (Ayah/Wali)</td></tr>
                <tr><td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Alamat</td><td style={{ verticalAlign: 'top' }}>: {data.alamat || '.................................................................'}</td></tr>
                <tr><td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Nomor WA</td><td style={{ verticalAlign: 'top' }}>: .................................................................</td></tr>
              </tbody>
            </table>
            <p style={{ marginBottom: '8px' }}>Selaku wali santri dari :</p>
            <table style={{ width: '100%', marginBottom: '16px', marginLeft: '16px' }}>
              <tbody>
                <tr><td style={{ width: '160px', fontWeight: 'bold', verticalAlign: 'top' }}>Nama Santri</td><td style={{ verticalAlign: 'top' }}>: {data.nama_lengkap}</td></tr>
                <tr><td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Asrama / Kamar</td><td style={{ verticalAlign: 'top' }}>: {data.asrama || '—'} / {data.kamar || '—'}</td></tr>
                <tr><td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Tanggal Keluar</td><td style={{ verticalAlign: 'top' }}>: {fmtTgl(data.tanggal_keluar)}</td></tr>
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
                  <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{item.nama || '..................................................'}</p>
                </div>
              ))}
            </div>
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

// ── Filter bar bersama ───────────────────────────────────────────────────────
function FilterBar({ asramaList, searchInput, setSearchInput, asrama, setAsrama, pageSize, setPageSize, onApply, loading, accent }: {
  asramaList: string[]
  searchInput: string; setSearchInput: (v: string) => void
  asrama: string; setAsrama: (v: string) => void
  pageSize: number; setPageSize: (v: number) => void
  onApply: () => void; loading: boolean; accent: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
          <select value={asrama} onChange={e => { setAsrama(e.target.value) }}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="SEMUA">Semua Asrama</option>
            {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <form onSubmit={e => { e.preventDefault(); onApply() }} className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Nama atau NIS..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
        </form>
        <button onClick={onApply} disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-colors self-end ${accent}`}>
          <Filter className="w-4 h-4" />{loading ? 'Memuat...' : 'Tampilkan'}
        </button>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Baris:</span>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none">
            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function Pager({ page, totalPages, loading, onGo }: { page: number; totalPages: number; loading: boolean; onGo: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onGo(page - 1)} disabled={page <= 1 || loading}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Sebelumnya
      </button>
      <span className="text-sm text-slate-500">Hal {page}/{totalPages}</span>
      <button onClick={() => onGo(page + 1)} disabled={page >= totalPages || loading}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
        Berikutnya <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Tab 1: Tetapkan Keluar (bulk select) ─────────────────────────────────────
type SantriAktif = { id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null; tahun_masuk: number | null }

function TabTetapkan({ asramaList }: { asramaList: string[] }) {
  const [rows, setRows] = useState<SantriAktif[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await getSantriAktif({
        search: searchInput || undefined,
        asrama: asrama !== 'SEMUA' ? asrama : undefined,
        page: pg, pageSize,
      })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
      setSelected(new Set())
    } finally { setLoading(false) }
  }, [searchInput, asrama, pageSize])

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => setSelected(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))

  const selectedSantri = rows.filter(r => selected.has(r.id))

  return (
    <div className="space-y-4">
      <FilterBar asramaList={asramaList} searchInput={searchInput} setSearchInput={setSearchInput}
        asrama={asrama} setAsrama={setAsrama} pageSize={pageSize} setPageSize={setPageSize}
        onApply={() => load(1)} loading={loading} accent="bg-slate-800 hover:bg-slate-900" />

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Users className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Tekan <strong>Tampilkan</strong> untuk melihat santri aktif</p>
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
            <span><strong className="text-slate-700">{fmtNum(rows.length)}</strong> dari <strong className="text-slate-700">{fmtNum(total)}</strong> santri aktif</span>
            {totalPages > 1 && <span>Hal {page}/{totalPages}</span>}
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">Tidak ada santri yang cocok.</div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="w-4 h-4 rounded accent-slate-700" />
                      </th>
                      {['Nama Santri', 'Asrama / Kamar', 'Angkatan'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(r => (
                      <tr key={r.id} className={`transition-colors ${selected.has(r.id) ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4 rounded accent-slate-700" /></td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{r.nama_lengkap}</div>
                          <div className="text-xs text-slate-400">{r.nis}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.asrama || '—'} / <span className="bg-slate-100 px-1.5 py-0.5 rounded-lg font-bold">{r.kamar || '—'}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{r.tahun_masuk || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {rows.map(r => (
                  <label key={r.id} className={`flex items-center gap-3 bg-white rounded-2xl border p-4 shadow-sm cursor-pointer ${selected.has(r.id) ? 'border-slate-400' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4 rounded accent-slate-700" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</p>
                    </div>
                  </label>
                ))}
              </div>

              <Pager page={page} totalPages={totalPages} loading={loading} onGo={load} />
            </>
          )}
        </>
      )}

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-semibold">{selected.size} terpilih</span>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
            <LogOut className="w-4 h-4" /> Tetapkan Keluar
          </button>
          <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {modalOpen && (
        <JenisKeluarModal
          title="Tetapkan Santri Keluar"
          count={selected.size}
          submitLabel="Tetapkan"
          onClose={() => setModalOpen(false)}
          onSubmit={(payload) => tetapkanKeluarBulk({ santriIds: selectedSantri.map(s => s.id), payload })}
          onSuccess={() => { setModalOpen(false); load(page) }}
        />
      )}
    </div>
  )
}

// ── Tab 2: Pengajuan Asrama ──────────────────────────────────────────────────
type PengajuanKeluar = {
  id: string; santri_id: string; nis: string | null; nama_lengkap: string | null
  asrama: string; kamar: string | null; tanggal_tandai: string; catatan: string | null
  status_global: string | null; penanda_nama: string | null
}

function TabPengajuan({ asramaList }: { asramaList: string[] }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<PengajuanKeluar[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [modalPengajuan, setModalPengajuan] = useState<PengajuanKeluar | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await getPengajuanKeluar({
        search: searchInput || undefined,
        asrama: asrama !== 'SEMUA' ? asrama : undefined,
        page: pg, pageSize,
      })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [searchInput, asrama, pageSize])

  const handleReject = async (row: PengajuanKeluar) => {
    if (!await confirm(`Tolak penandaan keluar untuk ${row.nama_lengkap || 'santri'}?`)) return
    setRejectingId(row.id)
    const res = await tolakPengajuanKeluar({ pengajuanId: row.id })
    setRejectingId(null)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success('Pengajuan ditolak')
    setRows(prev => prev.filter(item => item.id !== row.id)); setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-4">
      <FilterBar asramaList={asramaList} searchInput={searchInput} setSearchInput={setSearchInput}
        asrama={asrama} setAsrama={setAsrama} pageSize={pageSize} setPageSize={setPageSize}
        onApply={() => load(1)} loading={loading} accent="bg-amber-600 hover:bg-amber-700" />

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
            <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">Belum ada penandaan keluar dari asrama.</div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Santri', 'Asrama / Kamar', 'Ditandai', 'Catatan', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{r.nama_lengkap || '-'}</div>
                          <div className="text-xs text-slate-400">{r.nis || '-'} · {r.penanda_nama || 'Pengurus asrama'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{r.asrama} / <span className="bg-slate-100 px-1.5 py-0.5 rounded-lg font-bold">{r.kamar || '—'}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-600">{fmtTgl(r.tanggal_tandai)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px] truncate" title={r.catatan || ''}>{r.catatan || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModalPengajuan(r)} className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors">Proses</button>
                            <button onClick={() => handleReject(r)} disabled={rejectingId === r.id} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
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
                      <button onClick={() => setModalPengajuan(r)} className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">Proses</button>
                      <button onClick={() => handleReject(r)} disabled={rejectingId === r.id} className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">Tolak</button>
                    </div>
                  </div>
                ))}
              </div>

              <Pager page={page} totalPages={totalPages} loading={loading} onGo={load} />
            </>
          )}
        </>
      )}

      {modalPengajuan && (
        <JenisKeluarModal
          title="Proses Pengajuan Keluar"
          subtitle={modalPengajuan.nama_lengkap || undefined}
          initial={{ alasan_keluar: modalPengajuan.catatan || '' }}
          submitLabel="Setujui"
          onClose={() => setModalPengajuan(null)}
          onSubmit={(payload) => setujuiPengajuanKeluar({ pengajuanId: modalPengajuan.id, payload })}
          onSuccess={() => { setModalPengajuan(null); load(page) }}
        />
      )}
    </div>
  )
}

// ── Tab 3: Daftar Santri Keluar (gabungan + edit + restore) ──────────────────
function TabDaftar({ asramaList }: { asramaList: string[] }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<DaftarRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [asrama, setAsrama] = useState('SEMUA')
  const [pageSize, setPageSize] = useState(20)
  const [jenis, setJenis] = useState<JenisKeluar | 'semua'>('semua')
  const [editRow, setEditRow] = useState<DaftarRow | null>(null)
  const [suratId, setSuratId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (pg = 1, j = jenis) => {
    setLoading(true)
    try {
      const res = await getDaftarKeluar({
        jenis: j,
        search: searchInput || undefined,
        asrama: asrama !== 'SEMUA' ? asrama : undefined,
        page: pg, pageSize,
      })
      setRows(res.rows as DaftarRow[]); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [jenis, searchInput, asrama, pageSize])

  const handleRestore = async (r: DaftarRow) => {
    if (!await confirm(`Kembalikan ${r.nama_lengkap} menjadi santri aktif?`)) return
    setBusyId(r.id)
    const res = await aktifkanKembaliKeluar(r.id)
    setBusyId(null)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(`${r.nama_lengkap} diaktifkan kembali`)
    setRows(prev => prev.filter(x => x.id !== r.id)); setTotal(prev => prev - 1)
  }

  // info ringkas per jenis untuk kolom "Keterangan"
  const ket = (r: DaftarRow) => {
    if (r.jenis === 'alumni') return r.grup_alumni || (r.angkatan ? `Angkatan ${r.angkatan}` : 'Alumni')
    if (r.jenis === 'nonaktif') return r.alasan_nonaktif || '—'
    return r.alasan_keluar || '—'
  }
  const tgl = (r: DaftarRow) => r.jenis === 'alumni' ? r.tanggal_arsip : r.jenis === 'nonaktif' ? r.tanggal_mulai : r.tanggal_keluar

  return (
    <div className="space-y-4">
      {/* Chip filter jenis */}
      <div className="flex gap-2 flex-wrap">
        {([
          { k: 'semua', label: 'Semua' },
          { k: 'alumni', label: 'Alumni' },
          { k: 'berhenti', label: 'Berhenti' },
          { k: 'nonaktif', label: 'Nonaktif' },
        ] as const).map(c => (
          <button key={c.k} onClick={() => { setJenis(c.k); load(1, c.k) }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              jenis === c.k
                ? (c.k === 'semua' ? 'bg-slate-800 text-white border-slate-800' : `${JENIS_META[c.k as JenisKeluar].badge} border-transparent`)
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      <FilterBar asramaList={asramaList} searchInput={searchInput} setSearchInput={setSearchInput}
        asrama={asrama} setAsrama={setAsrama} pageSize={pageSize} setPageSize={setPageSize}
        onApply={() => load(1)} loading={loading} accent="bg-slate-800 hover:bg-slate-900" />

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
              <p className="text-slate-500 text-sm">Tidak ada data yang cocok.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Santri', 'Jenis', 'Tanggal', 'Keterangan', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider last:text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(r => {
                      const m = r.jenis ? JENIS_META[r.jenis] : null
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2">
                            <div className="font-semibold text-slate-800 text-xs">{r.nama_lengkap}</div>
                            <div className="text-[10px] text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</div>
                          </td>
                          <td className="px-4 py-2">
                            {m && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.badge}`}><m.icon className="w-3 h-3" />{m.label}</span>}
                          </td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{fmtTgl(tgl(r))}</td>
                          <td className="px-4 py-2 text-xs text-slate-500 max-w-[220px] truncate" title={ket(r)}>{ket(r)}</td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1.5">
                              {r.jenis === 'berhenti' && (
                                <button onClick={() => setSuratId(r.id)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors" title="Cetak Surat"><Printer className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => setEditRow(r)} className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                              <button onClick={() => handleRestore(r)} disabled={busyId === r.id} className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Aktifkan
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {rows.map(r => {
                  const m = r.jenis ? JENIS_META[r.jenis] : null
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{r.nama_lengkap}</p>
                          <p className="text-[10px] text-slate-400">{r.nis} · {r.asrama || '—'} / {r.kamar || '—'}</p>
                        </div>
                        {m && <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.badge}`}><m.icon className="w-3 h-3" />{m.label}</span>}
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2">{fmtTgl(tgl(r))} · {ket(r)}</p>
                      <div className="flex gap-2">
                        {r.jenis === 'berhenti' && (
                          <button onClick={() => setSuratId(r.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Surat</button>
                        )}
                        <button onClick={() => setEditRow(r)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                        <button onClick={() => handleRestore(r)} disabled={busyId === r.id} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                          {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Aktifkan
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Pager page={page} totalPages={totalPages} loading={loading} onGo={load} />
            </>
          )}
        </>
      )}

      {editRow && (
        <JenisKeluarModal
          title="Edit / Ubah Jenis Keluar"
          subtitle={editRow.nama_lengkap}
          initial={{ ...editRow, jenis: editRow.jenis ?? 'berhenti' }}
          submitLabel="Simpan Perubahan"
          onClose={() => setEditRow(null)}
          onSubmit={(payload) => ubahDataKeluar({ santriId: editRow.id, payload })}
          onSuccess={() => { setEditRow(null); load(page) }}
        />
      )}
      {suratId && <ModalSurat santriId={suratId} onClose={() => setSuratId(null)} />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SantriKeluarPage() {
  const [tab, setTab] = useState<'tetapkan' | 'pengajuan' | 'daftar'>('tetapkan')
  const [asramaAktif, setAsramaAktif] = useState<string[]>([])
  const [asramaSemua, setAsramaSemua] = useState<string[]>([])

  useEffect(() => {
    getAsramaList().then(setAsramaAktif)
    getAsramaSemuaKeluar().then(setAsramaSemua)
    // Set tab dari ?tab= (mis. redirect dari menu lama)
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'daftar' || t === 'pengajuan' || t === 'tetapkan') setTab(t)
  }, [])

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-5">
      <DashboardPageHeader
        title="Santri Keluar"
        description="Satu pintu untuk Alumni, Berhenti, & Nonaktif Sementara. Data tidak terhapus — bisa diedit & diaktifkan kembali."
      />

      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([
          { key: 'tetapkan', label: 'Tetapkan Keluar', icon: LogOut },
          { key: 'pengajuan', label: 'Pengajuan Asrama', icon: Building2 },
          { key: 'daftar', label: 'Daftar Santri Keluar', icon: UserX },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'tetapkan' && <TabTetapkan asramaList={asramaAktif} />}
      {tab === 'pengajuan' && <TabPengajuan asramaList={asramaAktif} />}
      {tab === 'daftar' && <TabDaftar asramaList={asramaSemua} />}
    </div>
  )
}
