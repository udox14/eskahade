'use client'

import { useState, useEffect } from 'react'
import {
  getAllPeriode, tambahPeriode, aktifkanPeriode,
  nonaktifkanPeriode, perpanjangTglDatang, hapusPeriode,
} from './actions'
import {
  CalendarRange, Plus, CheckCircle, XCircle, Trash2,
  CalendarClock, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function fmtTgl(s: string) {
  try { return format(new Date(s), 'dd MMM yyyy', { locale: localeId }) }
  catch { return s }
}

function BadgeAktif({ active }: { active: boolean }) {
  if (active)
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">AKTIF</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">NONAKTIF</span>
}

// ─── Form tambah periode ──────────────────────────────────────────────────────
function FormTambah({ onSuccess }: { onSuccess: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nama_periode: '',
    tgl_mulai_pulang: today,
    tgl_selesai_pulang: today,
    tgl_mulai_datang: today,
    tgl_selesai_datang: today,
  })

  const handleSubmit = async () => {
    setLoading(true)
    const res = await tambahPeriode(form)
    setLoading(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Periode berhasil ditambahkan')
    setOpen(false)
    setForm({ nama_periode: '', tgl_mulai_pulang: today, tgl_selesai_pulang: today, tgl_mulai_datang: today, tgl_selesai_datang: today })
    onSuccess()
  }

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <Plus className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-slate-700 text-sm flex-1 text-left">Tambah Periode Baru</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          <div className="pt-3">{field('Nama Periode (contoh: Liburan Semester Ganjil 2025)', 'nama_periode')}</div>

          <div className="grid grid-cols-2 gap-3">
            {field('Mulai Perpulangan', 'tgl_mulai_pulang', 'date')}
            {field('Selesai Perpulangan', 'tgl_selesai_pulang', 'date')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Mulai Kedatangan', 'tgl_mulai_datang', 'date')}
            {field('Selesai Kedatangan', 'tgl_selesai_datang', 'date')}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !form.nama_periode.trim()}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : 'Simpan Periode'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Card periode ─────────────────────────────────────────────────────────────
function CardPeriode({ p, onRefresh }: { p: any; onRefresh: () => void }) {
  const [loadingAktif, setLoadingAktif] = useState(false)
  const [loadingHapus, setLoadingHapus] = useState(false)
  const [showPerpanjang, setShowPerpanjang] = useState(false)
  const [tglBaru, setTglBaru] = useState(p.tgl_selesai_datang)
  const [loadingPerpanjang, setLoadingPerpanjang] = useState(false)

  const handleAktifkan = async () => {
    setLoadingAktif(true)
    const res = p.is_active ? await nonaktifkanPeriode(p.id) : await aktifkanPeriode(p.id)
    setLoadingAktif(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(p.is_active ? 'Periode dinonaktifkan' : 'Periode diaktifkan')
    onRefresh()
  }

  const handleHapus = async () => {
    if (!confirm(`Hapus periode "${p.nama_periode}"?`)) return
    setLoadingHapus(true)
    const res = await hapusPeriode(p.id)
    setLoadingHapus(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Periode dihapus')
    onRefresh()
  }

  const handlePerpanjang = async () => {
    setLoadingPerpanjang(true)
    const res = await perpanjangTglDatang(p.id, tglBaru)
    setLoadingPerpanjang(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Tanggal kedatangan diperpanjang')
    setShowPerpanjang(false)
    onRefresh()
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${p.is_active ? 'border-emerald-200' : 'border-slate-200'}`}>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-800">{p.nama_periode}</h3>
              <BadgeAktif active={!!p.is_active} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Dibuat {fmtTgl(p.created_at)}</p>
          </div>
        </div>

        {/* Jadwal */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
            <p className="text-[9px] font-bold text-amber-500 mb-1">PERPULANGAN</p>
            <p className="text-xs font-semibold text-amber-800">{fmtTgl(p.tgl_mulai_pulang)}</p>
            <p className="text-[10px] text-amber-600">s/d {fmtTgl(p.tgl_selesai_pulang)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
            <p className="text-[9px] font-bold text-emerald-500 mb-1">KEDATANGAN</p>
            <p className="text-xs font-semibold text-emerald-800">{fmtTgl(p.tgl_mulai_datang)}</p>
            <p className="text-[10px] text-emerald-600">s/d {fmtTgl(p.tgl_selesai_datang)}</p>
          </div>
        </div>

        {/* Perpanjang form */}
        {showPerpanjang && (
          <div className="mb-3 flex items-center gap-2">
            <input
              type="date"
              value={tglBaru}
              onChange={e => setTglBaru(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              onClick={handlePerpanjang}
              disabled={loadingPerpanjang}
              className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {loadingPerpanjang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan'}
            </button>
            <button onClick={() => setShowPerpanjang(false)} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200">
              Batal
            </button>
          </div>
        )}

        {/* Aksi */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAktifkan}
            disabled={loadingAktif}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              p.is_active
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            } disabled:opacity-60`}
          >
            {loadingAktif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
            {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>

          <button
            onClick={() => setShowPerpanjang(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-200 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Perpanjang Datang
          </button>

          {!p.is_active && (
            <button
              onClick={handleHapus}
              disabled={loadingHapus}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors disabled:opacity-60 ml-auto"
            >
              {loadingHapus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PeriodePerpulanganPage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setList(await getAllPeriode())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-blue-600" /> Periode Perpulangan
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Kelola jadwal perpulangan dan kedatangan santri</p>
      </div>

      <FormTambah onSuccess={load} />

      {loading ? (
        <div className="flex justify-center py-10 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          Belum ada periode. Tambahkan periode baru di atas.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(p => <CardPeriode key={p.id} p={p} onRefresh={load} />)}
        </div>
      )}
    </div>
  )
}
