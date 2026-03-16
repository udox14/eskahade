'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  getMonitoringSetoran, getSppSettings, simpanSetoran,
  getClientRestriction, konfirmasiSetoran, updateTanggalTutupBuku,
  getDaftarPenunggak, getAsramaList, getKamarList, simpanAlasanPenunggak
} from './actions'
import {
  Building2, Users, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  Banknote, RefreshCw, UserCheck, UserX, ArrowLeftRight, Pencil, X, Check,
  Settings, Download, FileSpreadsheet, Printer, Search, Filter,
  TrendingUp, ShieldCheck, CalendarCheck, Clock, BadgeCheck, SendHorizonal,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// ── SheetJS (xlsx) ────────────────────────────────────────────────────────
declare const XLSX: any

const BULAN_NAMA = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

type AsramaRow = {
  asrama: string
  total_santri: number
  bebas_spp: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  penunggak: number
  total_nominal: number
  persentase: number
  tanggal_setor: string | null
  tanggal_terima: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
  jumlah_bulan_ini: number
  jumlah_tunggakan_bayar: number
  orang_bulan_ini: number
  orang_tunggakan: number
  status_setoran: string | null
  konfirmasi_bulan_ini_at: string | null
  konfirmasi_tunggakan_at: string | null
  aktual_bulan_ini: number
  aktual_tunggakan: number
}

type Penunggak = {
  id: string
  nama_lengkap: string
  nis: string
  asrama: string
  kamar: string
  sekolah: string | null
  kelas_sekolah: string | null
  nama_kelas: string | null
  marhalah_nama: string | null
  alasan: string | null
}

function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n) }
function fmtRp(n: number) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

// ── Komponen StatCard ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, colorClass }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; colorClass: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-slate-900 leading-none">
        {value}
        {sub && <span className="text-sm font-semibold text-emerald-600 ml-2">{sub}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

// ── Komponen KonfirmasiModal ──────────────────────────────────────────────
function KonfirmasiModal({
  asrama, tipe, nominal, onClose, onConfirm
}: {
  asrama: string
  tipe: 'bulan_ini' | 'tunggakan'
  nominal: number
  onClose: () => void
  onConfirm: (aktual: number) => void
}) {
  const [aktual, setAktual] = useState(String(nominal))
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    const val = Number(aktual.replace(/\D/g, ''))
    if (!val) return toast.error('Masukkan jumlah yang valid')
    setSaving(true)
    onConfirm(val)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg mb-1">Konfirmasi Terima</h3>
        <p className="text-sm text-slate-500 mb-4">
          Asrama <strong>{asrama}</strong> — {tipe === 'bulan_ini' ? 'SPP Bulan Ini' : 'Tunggakan'}
        </p>
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Jumlah yang Diterima
          </label>
          <input
            type="text"
            value={aktual}
            onChange={e => setAktual(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Rp 0"
            autoFocus
          />
          {Number(aktual.replace(/\D/g, '')) < nominal && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Selisih Rp {fmt(nominal - Number(aktual.replace(/\D/g, '')))} akan jadi tunggakan
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-600 hover:bg-slate-50 font-medium">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab Monitoring ────────────────────────────────────────────────────────
function TabMonitoring({
  tahun, bulan, userAsrama
}: { tahun: number; bulan: number; userAsrama: string | null }) {
  const [nominal, setNominal] = useState(70000)
  const [tanggalTutupBuku, setTanggalTutupBuku] = useState(10)
  const [data, setData] = useState<AsramaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [editTanggal, setEditTanggal] = useState(false)
  const [newTanggal, setNewTanggal] = useState('10')
  const [savingTanggal, setSavingTanggal] = useState(false)
  const [konfirmasiModal, setKonfirmasiModal] = useState<{
    asrama: string; tipe: 'bulan_ini' | 'tunggakan'; nominal: number
  } | null>(null)
  const [editSetoran, setEditSetoran] = useState<{ asrama: string; jumlah: string; nama: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, settings] = await Promise.all([
        getMonitoringSetoran(tahun, bulan),
        getSppSettings(tahun),
      ])
      setData(userAsrama ? rows.filter(r => r.asrama === userAsrama) : rows)
      setNominal(settings.nominal)
      setTanggalTutupBuku(settings.tanggal_tutup_buku)
      setNewTanggal(String(settings.tanggal_tutup_buku))
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [tahun, bulan, userAsrama])

  useEffect(() => { load() }, [load])

  const handleSaveTanggal = async () => {
    const val = Number(newTanggal)
    if (val < 1 || val > 31) return toast.error('Tanggal harus antara 1-31')
    setSavingTanggal(true)
    const res = await updateTanggalTutupBuku(tahun, val)
    setSavingTanggal(false)
    if ('error' in res) return toast.error(res.error)
    setTanggalTutupBuku(val)
    setEditTanggal(false)
    toast.success('Tanggal tutup buku disimpan')
  }

  const handleKonfirmasi = async (aktual: number) => {
    if (!konfirmasiModal) return
    const res = await konfirmasiSetoran(konfirmasiModal.asrama, tahun, bulan, konfirmasiModal.tipe, aktual)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Setoran dikonfirmasi!')
    setKonfirmasiModal(null)
    load()
  }

  const handleSaveEditSetoran = async () => {
    if (!editSetoran) return
    setSavingEdit(true)
    const res = await simpanSetoran(
      editSetoran.asrama, tahun, bulan,
      Number(editSetoran.jumlah.replace(/\D/g, '')),
      editSetoran.nama
    )
    setSavingEdit(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Setoran disimpan')
    setEditSetoran(null)
    load()
  }

  const totalSantri   = data.reduce((a, r) => a + r.total_santri, 0)
  const totalWajib    = data.reduce((a, r) => a + r.wajib_bayar, 0)
  const totalBayar    = data.reduce((a, r) => a + r.bayar_bulan_ini, 0)
  const totalTunggak  = data.reduce((a, r) => a + r.penunggak, 0)
  const totalNominal  = data.reduce((a, r) => a + r.total_nominal, 0)
  const pct           = totalWajib > 0 ? Math.round((totalBayar / totalWajib) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Tanggal tutup buku */}
      {!userAsrama && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Batas Bayar Santri {tahun}</div>
              <div className="font-bold text-slate-800">Tanggal {tanggalTutupBuku} setiap bulan</div>
            </div>
          </div>
          {editTanggal ? (
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={31}
                value={newTanggal}
                onChange={e => setNewTanggal(e.target.value)}
                className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={handleSaveTanggal} disabled={savingTanggal}
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1">
                {savingTanggal ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Simpan
              </button>
              <button onClick={() => setEditTanggal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditTanggal(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors">
              <Settings className="w-3.5 h-3.5" /> Ubah
            </button>
          )}
        </div>
      )}

      {/* Summary cards */}
      {!userAsrama && hasLoaded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Santri Aktif" value={fmt(totalSantri)} icon={Users} colorClass="bg-slate-100 text-slate-600" />
          <StatCard label="Wajib Bayar" value={fmt(totalWajib)} icon={UserCheck} colorClass="bg-blue-100 text-blue-600" />
          <StatCard label="Sudah Bayar" value={fmt(totalBayar)} sub={`${pct}%`} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
          <StatCard label="Penunggak" value={fmt(totalTunggak)} icon={UserX} colorClass="bg-red-100 text-red-600" />
        </div>
      )}

      {/* Tombol muat */}
      <div className="flex justify-end">
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Memuat...' : 'Perbarui'}
        </button>
      </div>

      {/* Loading / empty */}
      {loading ? (
        <div className="flex justify-center items-center py-20 gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      ) : !hasLoaded ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-emerald-300" />
          </div>
          <p className="text-slate-500 font-semibold">Pilih bulan & tahun</p>
          <button onClick={load} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700">
            Tampilkan
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Tidak ada data untuk periode ini.</div>
      ) : (
        <>
          {/* Kartu per asrama */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.map(row => {
              const isEditing = editSetoran?.asrama === row.asrama
              const barColor = row.persentase >= 80 ? 'bg-emerald-500' : row.persentase >= 50 ? 'bg-amber-400' : 'bg-red-400'
              const sudahKirim = !!row.status_setoran && row.status_setoran !== 'belum'

              return (
                <div key={row.asrama} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header kartu */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 rounded-xl">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{row.asrama}</h3>
                        <span className="text-xs text-slate-400">{fmt(row.total_santri)} santri</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      row.persentase >= 80 ? 'bg-emerald-100 text-emerald-700' :
                      row.persentase >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.persentase}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-5 pb-4">
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${row.persentase}%` }} />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="px-5 pb-4 grid grid-cols-3 gap-2">
                    {[
                      { icon: ShieldCheck, label: 'Bebas SPP', value: fmt(row.bebas_spp), color: 'text-purple-600', bg: 'bg-purple-50' },
                      { icon: UserCheck, label: 'Wajib Bayar', value: fmt(row.wajib_bayar), color: 'text-blue-600', bg: 'bg-blue-50' },
                      { icon: CheckCircle2, label: 'Sudah Bayar', value: fmt(row.bayar_bulan_ini), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { icon: UserX, label: 'Penunggak', value: fmt(row.penunggak), color: 'text-red-600', bg: 'bg-red-50' },
                      { icon: ArrowLeftRight, label: 'Bayar Tunggakan', value: fmt(row.bayar_tunggakan_lalu), color: 'text-orange-600', bg: 'bg-orange-50' },
                      { icon: Banknote, label: 'Total Terkumpul', value: fmtRp(row.total_nominal), color: 'text-slate-700', bg: 'bg-slate-50', small: true },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-xl p-2.5`}>
                        <div className="flex items-center gap-1 mb-1">
                          <s.icon className={`w-3 h-3 ${s.color}`} />
                          <span className="text-[10px] text-slate-500 leading-tight">{s.label}</span>
                        </div>
                        <div className={`font-bold ${s.small ? 'text-xs' : 'text-base'} ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 mx-5" />

                  {/* Section setoran */}
                  <div className="px-5 py-4 space-y-3">
                    {!sudahKirim ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                        <SendHorizonal className="w-4 h-4" />
                        <span>Belum ada setoran dari pengurus asrama</span>
                      </div>
                    ) : (
                      <>
                        {/* Info penyetor */}
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>
                            Disetor oleh <strong className="text-slate-700">{row.nama_penyetor || '—'}</strong>
                            {row.tanggal_setor && (
                              <> · {format(new Date(row.tanggal_setor), 'd MMM yyyy HH:mm', { locale: idLocale })}</>
                            )}
                          </span>
                        </div>

                        {/* Baris SPP Bulan Ini */}
                        {row.orang_bulan_ini > 0 && (
                          <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-bold text-emerald-700">SPP Bulan Ini</div>
                              <div className="text-sm text-slate-600 mt-0.5">
                                {fmt(row.orang_bulan_ini)} orang · <span className="font-bold text-slate-800">{fmtRp(row.jumlah_bulan_ini)}</span>
                              </div>
                              {row.konfirmasi_bulan_ini_at && (
                                <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                  <BadgeCheck className="w-3 h-3" />
                                  Dikonfirmasi · {row.aktual_bulan_ini !== row.jumlah_bulan_ini && (
                                    <span className="text-amber-600">Diterima: {fmtRp(row.aktual_bulan_ini)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!row.konfirmasi_bulan_ini_at ? (
                              <button
                                onClick={() => setKonfirmasiModal({ asrama: row.asrama, tipe: 'bulan_ini', nominal: row.jumlah_bulan_ini })}
                                className="shrink-0 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">
                                <Check className="w-3 h-3" /> Terima
                              </button>
                            ) : (
                              <BadgeCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                        )}

                        {/* Baris Tunggakan */}
                        {row.orang_tunggakan > 0 && (
                          <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-bold text-amber-700">Bayar Tunggakan</div>
                              <div className="text-sm text-slate-600 mt-0.5">
                                {fmt(row.orang_tunggakan)} orang · <span className="font-bold text-slate-800">{fmtRp(row.jumlah_tunggakan_bayar)}</span>
                              </div>
                              {row.konfirmasi_tunggakan_at && (
                                <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                  <BadgeCheck className="w-3 h-3" />
                                  Dikonfirmasi · {row.aktual_tunggakan !== row.jumlah_tunggakan_bayar && (
                                    <span className="text-amber-600">Diterima: {fmtRp(row.aktual_tunggakan)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!row.konfirmasi_tunggakan_at ? (
                              <button
                                onClick={() => setKonfirmasiModal({ asrama: row.asrama, tipe: 'tunggakan', nominal: row.jumlah_tunggakan_bayar })}
                                className="shrink-0 bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-amber-600 flex items-center gap-1.5">
                                <Check className="w-3 h-3" /> Terima
                              </button>
                            ) : (
                              <BadgeCheck className="w-5 h-5 text-amber-500 shrink-0" />
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Edit manual (fallback) */}
                    {!isEditing ? (
                      <button
                        onClick={() => setEditSetoran({
                          asrama: row.asrama,
                          jumlah: row.jumlah_aktual != null ? String(row.jumlah_aktual) : '',
                          nama: row.nama_penyetor ?? '',
                        })}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 py-1.5 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                        <Pencil className="w-3 h-3" />
                        {sudahKirim ? 'Edit manual' : 'Catat setoran manual'}
                      </button>
                    ) : (
                      <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Manual</div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Nama penyetor"
                            value={editSetoran.nama}
                            onChange={e => setEditSetoran(s => s ? { ...s, nama: e.target.value } : s)}
                            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          <input type="text" placeholder="Jumlah (Rp)"
                            value={editSetoran.jumlah}
                            onChange={e => setEditSetoran(s => s ? { ...s, jumlah: e.target.value } : s)}
                            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditSetoran(null)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white flex items-center gap-1">
                            <X className="w-3 h-3" /> Batal
                          </button>
                          <button onClick={handleSaveEditSetoran} disabled={savingEdit}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60 flex items-center gap-1">
                            {savingEdit ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total keseluruhan */}
          {!userAsrama && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ringkasan Keseluruhan</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Total Terkumpul</div>
                  <div className="text-xl font-bold text-emerald-700">{fmtRp(totalNominal)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Potensi Penuh</div>
                  <div className="text-xl font-bold text-slate-700">{fmtRp(totalWajib * nominal)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Selisih</div>
                  <div className={`text-xl font-bold ${totalNominal >= totalWajib * nominal ? 'text-emerald-600' : 'text-red-600'}`}>
                    {totalNominal >= totalWajib * nominal ? '+' : ''}{fmtRp(totalNominal - totalWajib * nominal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Kepatuhan</div>
                  <div className="text-2xl font-bold text-blue-700">{pct}%</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal konfirmasi */}
      {konfirmasiModal && (
        <KonfirmasiModal
          asrama={konfirmasiModal.asrama}
          tipe={konfirmasiModal.tipe}
          nominal={konfirmasiModal.nominal}
          onClose={() => setKonfirmasiModal(null)}
          onConfirm={handleKonfirmasi}
        />
      )}
    </div>
  )
}

// ── Tab Daftar Penunggak ──────────────────────────────────────────────────
function TabPenunggak({ tahun, bulan }: { tahun: number; bulan: number }) {
  const [data, setData] = useState<Penunggak[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [search, setSearch] = useState('')
  const [alasanDraft, setAlasanDraft] = useState<Record<string, string>>({})
  const [savingAlasan, setSavingAlasan] = useState<Record<string, boolean>>({})
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAsramaList().then(setAsramaList)
  }, [])

  useEffect(() => {
    if (filterAsrama !== 'SEMUA') {
      getKamarList(filterAsrama).then(list => { setKamarList(list); setFilterKamar('SEMUA') })
    } else {
      setKamarList([])
      setFilterKamar('SEMUA')
    }
  }, [filterAsrama])

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await getDaftarPenunggak({
        tahun, bulan,
        asramaFilter: filterAsrama !== 'SEMUA' ? filterAsrama : undefined,
        kamarFilter:  filterKamar  !== 'SEMUA' ? filterKamar  : undefined,
        page: pg,
      })
      setData(res.rows)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(pg)
      // Init alasan draft dari DB
      const init: Record<string, string> = {}
      res.rows.forEach(r => { if (r.alasan) init[r.id] = r.alasan })
      setAlasanDraft(prev => ({ ...prev, ...init }))
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [tahun, bulan, filterAsrama, filterKamar])

  const handleSaveAlasan = async (santriId: string) => {
    setSavingAlasan(p => ({ ...p, [santriId]: true }))
    await simpanAlasanPenunggak(santriId, tahun, bulan, alasanDraft[santriId] ?? '')
    setSavingAlasan(p => ({ ...p, [santriId]: false }))
    toast.success('Alasan disimpan')
  }

  // Export Excel
  const handleExportExcel = () => {
    if (typeof XLSX === 'undefined') return toast.error('SheetJS belum dimuat')
    const wsData = [
      ['No', 'Nama Santri', 'Asrama', 'Kamar', 'Kelas Pesantren', 'Sekolah', 'Kelas Sekolah', 'Alasan'],
      ...data.map((r, i) => [
        i + 1, r.nama_lengkap, r.asrama, r.kamar,
        r.nama_kelas ? `${r.marhalah_nama ?? ''} - ${r.nama_kelas}` : '—',
        r.sekolah ?? '—', r.kelas_sekolah ?? '—',
        alasanDraft[r.id] ?? r.alasan ?? '',
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Penunggak')
    XLSX.writeFile(wb, `penunggak-spp-${BULAN_NAMA[bulan]}-${tahun}.xlsx`)
  }

  // Print PDF
  const handlePrint = () => { window.print() }

  const filtered = data.filter(r =>
    r.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
    r.nis.includes(search)
  )

  return (
    <div className="space-y-4">
      {/* Load SheetJS */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" async />

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Asrama</label>
            <select value={filterAsrama} onChange={e => setFilterAsrama(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="SEMUA">Semua Asrama</option>
              {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {kamarList.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Kamar</label>
              <select value={filterKamar} onChange={e => setFilterKamar(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="SEMUA">Semua Kamar</option>
                {kamarList.map(k => <option key={k} value={k}>Kamar {k}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Nama atau NIS..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
        </div>
      </div>

      {/* Tabel */}
      {!hasLoaded ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Pilih filter lalu klik <strong>Tampilkan</strong>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat...</span>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-500">
              <span className="font-bold text-slate-800">{data.length}</span> dari <span className="font-bold text-slate-800">{total}</span> penunggak
              {filterAsrama !== 'SEMUA' && <span> · {filterAsrama}</span>}
              {filterKamar !== 'SEMUA' && <span> · Kamar {filterKamar}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportExcel}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <Printer className="w-4 h-4 text-blue-600" /> Cetak PDF
              </button>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
              <p className="font-medium">Tidak ada penunggak!</p>
              <p className="text-xs mt-1">Semua santri sudah membayar SPP bulan ini.</p>
            </div>
          ) : (
            <div ref={printRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Print header (hidden on screen) */}
              <div className="hidden print:block px-6 pt-6 pb-2">
                <h2 className="text-lg font-bold">Daftar Penunggak SPP</h2>
                <p className="text-sm text-slate-500">{BULAN_NAMA[bulan]} {tahun}{filterAsrama !== 'SEMUA' ? ` · ${filterAsrama}` : ''}</p>
              </div>

              {/* Desktop table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-8">No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Santri</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Asrama</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Kamar</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Kelas Pesantren</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Sekolah</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[180px]">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{r.nama_lengkap}</div>
                          <div className="text-xs text-slate-400">{r.nis}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{r.asrama || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                            {r.kamar || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {r.nama_kelas ? (
                            <div>
                              <div className="font-medium text-slate-700">{r.nama_kelas}</div>
                              {r.marhalah_nama && <div className="text-slate-400">{r.marhalah_nama}</div>}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {r.sekolah ? (
                            <div>
                              <div className="font-medium text-slate-700">{r.sekolah}</div>
                              {r.kelas_sekolah && <div className="text-slate-400">Kelas {r.kelas_sekolah}</div>}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 print:text-slate-700">
                          <div className="flex items-center gap-2 print:hidden">
                            <input
                              type="text"
                              placeholder="Isi alasan..."
                              value={alasanDraft[r.id] ?? ''}
                              onChange={e => setAlasanDraft(p => ({ ...p, [r.id]: e.target.value }))}
                              onBlur={() => handleSaveAlasan(r.id)}
                              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            />
                            {savingAlasan[r.id] && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
                          </div>
                          <div className="hidden print:block text-xs">{alasanDraft[r.id] ?? r.alasan ?? ''}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button key={pg} onClick={() => load(pg)} disabled={loading}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                        pg === page ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{pg}</button>
                  )
                })}
              </div>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          [ref="printRef"], [ref="printRef"] * { visibility: visible; }
        }
      `}</style>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function MonitoringSPPPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [activeTab, setActiveTab] = useState<'monitoring' | 'penunggak'>('monitoring')
  const [userAsrama, setUserAsrama] = useState<string | null>(null)

  const tahunList = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  useEffect(() => {
    getClientRestriction().then(setUserAsrama)
  }, [])

  function prevBulan() {
    if (bulan === 1) { setBulan(12); setTahun(t => t - 1) }
    else setBulan(b => b - 1)
  }
  function nextBulan() {
    if (bulan === 12) { setBulan(1); setTahun(t => t + 1) }
    else setBulan(b => b + 1)
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5">

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitoring SPP</h1>
        <p className="text-sm text-slate-500 mt-0.5">Rekap pembayaran & setoran SPP per asrama</p>
      </div>

      {/* ── Navigator Bulan/Tahun ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Prev/Next */}
          <div className="flex items-center gap-1">
            <button onClick={prevBulan} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="min-w-[150px] text-center font-bold text-slate-900 text-lg">
              {BULAN_NAMA[bulan]} {tahun}
            </div>
            <button
              onClick={nextBulan}
              disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Pilih bulan */}
          <select value={bulan} onChange={e => setBulan(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {BULAN_NAMA.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
          </select>

          {/* Pilih tahun */}
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'monitoring', label: 'Monitoring Setoran', icon: TrendingUp },
          { key: 'penunggak', label: 'Daftar Penunggak', icon: UserX },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'monitoring' ? (
        <TabMonitoring tahun={tahun} bulan={bulan} userAsrama={userAsrama} />
      ) : (
        <TabPenunggak tahun={tahun} bulan={bulan} />
      )}
    </div>
  )
}
