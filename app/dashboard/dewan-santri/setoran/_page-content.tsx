'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getMonitoringSetoran, getSppSettings, simpanSetoran, getClientRestriction } from './actions'
import {
  Building2, Users, ShieldCheck, AlertCircle, CheckCircle2,
  TrendingUp, CalendarCheck, Banknote, RefreshCw, ChevronLeft,
  ChevronRight, Clock, UserCheck, UserX, ArrowLeftRight, Pencil, X, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

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
  nama_penyetor: string | null
  jumlah_aktual: number | null
}

type SetoranFormState = {
  asrama: string
  jumlahAktual: string
  namaPenyetor: string
}

export default function MonitoringSetoranPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [nominal, setNominal] = useState(70000)
  const [data, setData] = useState<AsramaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [userAsrama, setUserAsrama] = useState<string | null>(null)
  const [setoranForm, setSetoranForm] = useState<SetoranFormState | null>(null)
  const [savingSetoran, setSavingSetoran] = useState(false)

  const tahunList = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const load = async () => {
    setLoading(true)
    try {
      const [rows, settings] = await Promise.all([
        getMonitoringSetoran(tahun, bulan),
        getSppSettings(tahun),
      ])
      setData(userAsrama ? rows.filter((r: AsramaRow) => r.asrama === userAsrama) : rows)
      setNominal(settings.nominal)
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }

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

  async function handleSimpanSetoran() {
    if (!setoranForm) return
    setSavingSetoran(true)
    try {
      const res = await simpanSetoran(
        setoranForm.asrama, tahun, bulan,
        Number(setoranForm.jumlahAktual.replace(/\D/g, '')),
        setoranForm.namaPenyetor
      )
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Setoran berhasil disimpan')
      setSetoranForm(null)
      load()
    } finally {
      setSavingSetoran(false)
    }
  }

  const totalSantri    = data.reduce((a, r) => a + r.total_santri, 0)
  const totalBebasSpp  = data.reduce((a, r) => a + r.bebas_spp, 0)
  const totalWajib     = data.reduce((a, r) => a + r.wajib_bayar, 0)
  const totalBayar     = data.reduce((a, r) => a + r.bayar_bulan_ini, 0)
  const totalTunggak   = data.reduce((a, r) => a + r.penunggak, 0)
  const totalNominal   = data.reduce((a, r) => a + r.total_nominal, 0)
  const pctKeseluruhan = totalWajib > 0 ? Math.round((totalBayar / totalWajib) * 100) : 0

  function fmt(n: number) {
    return new Intl.NumberFormat('id-ID').format(n)
  }
  function fmtRp(n: number) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Monitoring Setoran SPP</h1>
        <p className="text-sm text-slate-500 mt-1">Rekap pembayaran SPP per asrama</p>
      </div>

      {/* ── Filter Bulan + Tahun ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Navigator bulan */}
          <div className="flex items-center gap-2">
            <button onClick={prevBulan} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="min-w-[160px] text-center">
              <span className="text-lg font-semibold text-slate-900">
                {BULAN_NAMA[bulan]} {tahun}
              </span>
            </div>
            <button
              onClick={nextBulan}
              disabled={tahun === now.getFullYear() && bulan === now.getMonth() + 1}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Pilih bulan langsung */}
          <select
            value={bulan}
            onChange={e => setBulan(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {BULAN_NAMA.slice(1).map((b, i) => (
              <option key={i + 1} value={i + 1}>{b}</option>
            ))}
          </select>

          {/* Pilih tahun */}
          <select
            value={tahun}
            onChange={e => setTahun(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tahunList.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Tarif */}
          <div className="flex items-center gap-2 ml-auto bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Banknote className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Tarif {tahun}: <strong>{fmtRp(nominal)}</strong>
            </span>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              !hasLoaded ? 'bg-blue-600 text-white hover:bg-blue-700 shadow' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Memuat...' : !hasLoaded ? 'Tampilkan' : 'Perbarui'}
          </button>
        </div>
      </div>

      {/* ── Ringkasan Total ── */}
      {!userAsrama && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Santri', value: fmt(totalSantri), icon: Users, color: 'bg-slate-50 text-slate-600 border-slate-100' },
            { label: 'Wajib Bayar', value: fmt(totalWajib), icon: UserCheck, color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { label: 'Sudah Bayar', value: fmt(totalBayar), sub: `${pctKeseluruhan}%`, icon: CheckCircle2, color: 'bg-green-50 text-green-600 border-green-100' },
            { label: 'Penunggak', value: fmt(totalTunggak), icon: AlertCircle, color: 'bg-red-50 text-red-600 border-red-100' },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl border p-4 ${item.color.split(' ').slice(2).join(' ')} bg-white`}>
              <div className={`inline-flex p-2 rounded-lg mb-2 ${item.color.split(' ').slice(0, 2).join(' ')}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{item.value}
                {item.sub && <span className="text-sm font-medium text-green-600 ml-2">{item.sub}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Kartu Per Asrama ── */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-slate-500">Memuat data...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          {!hasLoaded ? (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-blue-300"/>
              </div>
              <p className="text-slate-500 font-semibold">Data belum dimuat</p>
              <p className="text-sm text-slate-400">Pilih bulan &amp; tahun lalu tekan <strong>Tampilkan</strong>.</p>
              <button onClick={load} className="mt-1 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow">
                Tampilkan Sekarang
              </button>
            </>
          ) : (
            <p className="text-slate-400">Tidak ada data asrama untuk periode ini.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map(row => {
            const isEditingSetoran = setoranForm?.asrama === row.asrama
            const barColor = row.persentase >= 80 ? 'bg-green-500' : row.persentase >= 50 ? 'bg-yellow-400' : 'bg-red-400'

            return (
              <div key={row.asrama} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Card Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{row.asrama}</h3>
                      <span className="text-xs text-slate-400">{fmt(row.total_santri)} santri</span>
                    </div>
                  </div>
                  {/* Persen badge */}
                  <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                    row.persentase >= 80 ? 'bg-green-100 text-green-700' :
                    row.persentase >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {row.persentase}%
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-5 pb-4">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${row.persentase}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="px-5 pb-4 grid grid-cols-3 gap-3">
                  <StatBox
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-purple-500" />}
                    label="Bebas SPP"
                    value={fmt(row.bebas_spp)}
                    sub="santri"
                    color="text-purple-700"
                  />
                  <StatBox
                    icon={<UserCheck className="w-3.5 h-3.5 text-blue-500" />}
                    label="Wajib Bayar"
                    value={fmt(row.wajib_bayar)}
                    sub="santri"
                    color="text-blue-700"
                  />
                  <StatBox
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    label="Sudah Bayar"
                    value={fmt(row.bayar_bulan_ini)}
                    sub="santri"
                    color="text-green-700"
                  />
                  <StatBox
                    icon={<UserX className="w-3.5 h-3.5 text-red-500" />}
                    label="Penunggak"
                    value={fmt(row.penunggak)}
                    sub="santri"
                    color="text-red-700"
                  />
                  <StatBox
                    icon={<ArrowLeftRight className="w-3.5 h-3.5 text-orange-500" />}
                    label="Bayar Tunggakan"
                    value={fmt(row.bayar_tunggakan_lalu)}
                    sub="bln lalu"
                    color="text-orange-700"
                  />
                  <StatBox
                    icon={<Banknote className="w-3.5 h-3.5 text-emerald-500" />}
                    label="Total Setor"
                    value={fmtRp(row.total_nominal)}
                    color="text-emerald-700"
                    small
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 mx-5" />

                {/* Tanggal Setor */}
                <div className="px-5 py-3">
                  {!isEditingSetoran ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarCheck className={`w-4 h-4 ${row.tanggal_setor ? 'text-green-500' : 'text-slate-300'}`} />
                        {row.tanggal_setor ? (
                          <span className="text-slate-700">
                            Disetor{row.nama_penyetor ? ` oleh <strong>${row.nama_penyetor}</strong>` : ''} •{' '}
                            <span className="text-green-700 font-medium">
                              {format(new Date(row.tanggal_setor), 'd MMM yyyy', { locale: idLocale })}
                            </span>
                            {row.jumlah_aktual != null && (
                              <span className="ml-2 text-slate-500">({fmtRp(row.jumlah_aktual)})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belum disetor</span>
                        )}
                      </div>
                      <button
                        onClick={() => setSetoranForm({
                          asrama: row.asrama,
                          jumlahAktual: row.jumlah_aktual != null ? String(row.jumlah_aktual) : String(row.total_nominal),
                          namaPenyetor: row.nama_penyetor ?? '',
                        })}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        {row.tanggal_setor ? 'Edit' : 'Catat Setoran'}
                      </button>
                    </div>
                  ) : (
                    /* Form setoran inline */
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nama penyetor"
                          value={setoranForm.namaPenyetor}
                          onChange={e => setSetoranForm(f => f ? { ...f, namaPenyetor: e.target.value } : f)}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Jumlah aktual (Rp)"
                          value={setoranForm.jumlahAktual}
                          onChange={e => setSetoranForm(f => f ? { ...f, jumlahAktual: e.target.value } : f)}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setSetoranForm(null)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <X className="w-3 h-3" /> Batal
                        </button>
                        <button
                          onClick={handleSimpanSetoran}
                          disabled={savingSetoran}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingSetoran
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Check className="w-3 h-3" />
                          }
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
      )}

      {/* ── Total keseluruhan di bawah ── */}
      {!loading && data.length > 0 && !userAsrama && (
        <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-wrap gap-6 items-center">
          <div>
            <div className="text-xs text-slate-500">Total terkumpul</div>
            <div className="text-xl font-bold text-emerald-700">{fmtRp(totalNominal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Potensi (wajib × tarif)</div>
            <div className="text-xl font-bold text-slate-800">{fmtRp(totalWajib * nominal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Selisih</div>
            <div className={`text-xl font-bold ${totalNominal >= totalWajib * nominal ? 'text-green-700' : 'text-red-600'}`}>
              {fmtRp(totalNominal - totalWajib * nominal)}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500">Kepatuhan keseluruhan</div>
            <div className="text-2xl font-bold text-blue-700">{pctKeseluruhan}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Komponen kecil ──────────────────────────────────────────────────────────
function StatBox({
  icon, label, value, sub, color, small
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: string
  small?: boolean
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-slate-500 leading-tight">{label}</span>
      </div>
      <div className={`font-bold leading-tight ${small ? 'text-sm' : 'text-lg'} ${color ?? 'text-slate-800'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}