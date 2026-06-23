'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useTransition } from 'react'
import {
  BadgeCheck,
  Banknote,
  Check,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  getPendaftarDetail,
  getPendaftarList,
  setVerifikasiPendaftar,
  terimaPendaftar,
  tolakPendaftar,
} from './actions'

type Row = Record<string, any>
type Stats = { total: number; berkas: number; bayar: number; diterima: number }

const STATUS_LABEL: Record<string, string> = {
  menunggu: 'Menunggu',
  verifikasi_berkas: 'Berkas OK',
  lunas: 'Lunas',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
}

// Label untuk modal detail (kolom DB -> judul).
const DETAIL_SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Identitas Santri',
    rows: [
      ['nama_lengkap', 'Nama Lengkap'], ['nama_panggilan', 'Nama Panggilan'], ['jenis_kelamin', 'Jenis Kelamin'],
      ['tempat_lahir', 'Tempat Lahir'], ['tanggal_lahir', 'Tanggal Lahir'], ['nik', 'NIK'], ['nisn', 'NISN'],
      ['asal_sd', 'Asal SD/MI'], ['asal_smp', 'Asal SMP/MTs'], ['status_anak', 'Status Anak'],
      ['anak_ke', 'Anak Ke-'], ['jumlah_saudara', 'Jumlah Saudara'], ['golongan_darah', 'Gol. Darah'],
      ['cita_cita', 'Cita-cita'], ['hobi', 'Hobi'],
    ],
  },
  {
    title: 'Orang Tua / Wali',
    rows: [
      ['nama_ayah', 'Nama Ayah'], ['pendidikan_ayah', 'Pendidikan Ayah'], ['pekerjaan_ayah', 'Pekerjaan Ayah'],
      ['wa_ayah', 'WA Ayah'], ['penghasilan_ayah', 'Penghasilan Ayah'],
      ['nama_ibu', 'Nama Ibu'], ['pendidikan_ibu', 'Pendidikan Ibu'], ['pekerjaan_ibu', 'Pekerjaan Ibu'],
      ['wa_ibu', 'WA Ibu'], ['penghasilan_ibu', 'Penghasilan Ibu'],
      ['alamat_lengkap', 'Alamat'], ['provinsi', 'Provinsi'], ['kabupaten', 'Kabupaten/Kota'],
      ['kecamatan', 'Kecamatan'], ['desa', 'Desa'], ['kode_pos', 'Kode Pos'],
    ],
  },
  {
    title: 'Pendaftaran & Kelengkapan',
    rows: [
      ['keinginan', 'Atas Keinginan'], ['sekolah_santri', 'Sekolah'], ['kelas', 'Kelas'],
      ['lemari', 'Bawa Lemari'], ['kasur', 'Bawa Kasur'], ['kartu_kesehatan', 'Kartu Kesehatan'],
      ['alasan_pindah', 'Alasan Pindah'], ['kebiasaan_kurang_baik', 'Kebiasaan Kurang Baik'], ['penyakit', 'Penyakit'],
    ],
  },
]

const BERKAS_LABEL: Record<string, string> = {
  fcKK: 'FC Kartu Keluarga',
  fcAkte: 'FC Akte Kelahiran',
  fcKtpAyah: 'FC KTP Ayah',
  fcKtpIbu: 'FC KTP Ibu',
  pasFoto: 'Pas Foto',
}

export default function PendaftarPageContent() {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, berkas: 0, bayar: 0, diterima: 0 })
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<{ pendaftar: Row; berkas: { jenis: string; url: string }[] } | null>(null)
  const [pending, startTransition] = useTransition()

  async function load(query = '') {
    setLoading(true)
    const res = await getPendaftarList({ q: query || undefined })
    if ('error' in res) toast.error(res.error)
    else {
      setRows(res.rows)
      setStats(res.stats)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function act(fn: () => Promise<any>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res && 'error' in res) toast.error(res.error)
      else {
        toast.success(okMsg)
        await load(q)
        if (detail) {
          const d = await getPendaftarDetail(String(detail.pendaftar.id))
          if (!('error' in d)) setDetail(d)
        }
      }
    })
  }

  async function openDetail(id: string) {
    const res = await getPendaftarDetail(id)
    if ('error' in res) toast.error(res.error)
    else setDetail(res)
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Pendaftar" value={stats.total} />
        <StatCard label="Berkas Terverifikasi" value={stats.berkas} />
        <StatCard label="Pembayaran Lunas" value={stats.bayar} />
        <StatCard label="Diterima" value={stats.diterima} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
            placeholder="Cari nama / no. pendaftaran…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <button
          onClick={() => load(q)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">No. Daftar</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Sekolah</th>
              <th className="px-4 py-3 font-medium">Berkas</th>
              <th className="px-4 py-3 font-medium">Bayar</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada pendaftar.</td></tr>
            ) : (
              rows.map((r) => {
                const id = String(r.id)
                const accepted = !!r.santri_id
                const berkasOk = Number(r.berkas_verified) === 1
                const bayarOk = Number(r.bayar_verified) === 1
                return (
                  <tr key={id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.no_reg}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.nama_lengkap}</td>
                    <td className="px-4 py-3 text-slate-600">{r.sekolah_santri ?? '-'}</td>
                    <td className="px-4 py-3"><Pill ok={berkasOk} /></td>
                    <td className="px-4 py-3"><Pill ok={bayarOk} /></td>
                    <td className="px-4 py-3"><StatusBadge status={String(r.status)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <IconBtn title="Verifikasi berkas" active={berkasOk} disabled={pending} onClick={() => act(() => setVerifikasiPendaftar(id, 'berkas', !berkasOk), 'Status berkas diperbarui')}><BadgeCheck className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Verifikasi bayar" active={bayarOk} disabled={pending} onClick={() => act(() => setVerifikasiPendaftar(id, 'bayar', !bayarOk), 'Status bayar diperbarui')}><Banknote className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Detail" onClick={() => openDetail(id)}><Eye className="h-4 w-4" /></IconBtn>
                        {!accepted && (
                          <IconBtn title="Terima jadi santri" accent disabled={pending} onClick={() => { if (confirm(`Terima ${r.nama_lengkap} menjadi santri baru?`)) act(() => terimaPendaftar(id), 'Pendaftar diterima menjadi santri') }}><UserCheck className="h-4 w-4" /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <DetailModal
          data={detail}
          pending={pending}
          onClose={() => setDetail(null)}
          onTerima={(id) => { if (confirm('Terima pendaftar ini menjadi santri baru?')) act(() => terimaPendaftar(id), 'Pendaftar diterima menjadi santri') }}
          onTolak={(id) => { const a = prompt('Alasan penolakan (opsional):') ?? undefined; act(() => tolakPendaftar(id, a), 'Pendaftar ditolak') }}
          onVerify={(id, kind, val) => act(() => setVerifikasiPendaftar(id, kind, val), 'Status diperbarui')}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? 'OK' : 'Menunggu'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'diterima' ? 'bg-emerald-50 text-emerald-700'
    : status === 'ditolak' ? 'bg-rose-50 text-rose-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{STATUS_LABEL[status] ?? status}</span>
}

function IconBtn({ children, title, active, accent, disabled, onClick }: { children: React.ReactNode; title: string; active?: boolean; accent?: boolean; disabled?: boolean; onClick: () => void }) {
  const base = 'flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50'
  const tone = accent ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    : active ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  return <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${tone}`}>{children}</button>
}

function DetailModal({
  data, pending, onClose, onTerima, onTolak, onVerify,
}: {
  data: { pendaftar: Row; berkas: { jenis: string; url: string }[] }
  pending: boolean
  onClose: () => void
  onTerima: (id: string) => void
  onTolak: (id: string) => void
  onVerify: (id: string, kind: 'berkas' | 'bayar', val: boolean) => void
}) {
  const p = data.pendaftar
  const id = String(p.id)
  const accepted = !!p.santri_id
  const berkasMap = new Map(data.berkas.map((b) => [b.jenis, b.url]))

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{p.nama_lengkap}</h2>
            <p className="font-mono text-xs text-slate-500">{p.no_reg}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {DETAIL_SECTIONS.map((sec) => (
            <div key={sec.title} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">{sec.title}</div>
              <dl className="divide-y divide-slate-100">
                {sec.rows.map(([key, label]) => {
                  const v = p[key]
                  if (v === null || v === undefined || v === '') return null
                  return (
                    <div key={key} className="grid grid-cols-2 gap-2 px-4 py-2 text-sm">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-800">{String(v)}</dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">Berkas</div>
            <dl className="divide-y divide-slate-100">
              {Object.entries(BERKAS_LABEL).map(([jenis, label]) => {
                const url = berkasMap.get(jenis)
                return (
                  <div key={jenis} className="grid grid-cols-2 gap-2 px-4 py-2 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">Lihat berkas</a> : <span className="text-slate-400">—</span>}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onVerify(id, 'berkas', Number(p.berkas_verified) !== 1)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Check className="h-4 w-4" /> {Number(p.berkas_verified) === 1 ? 'Batalkan verifikasi berkas' : 'Verifikasi berkas'}
          </button>
          <button onClick={() => onVerify(id, 'bayar', Number(p.bayar_verified) !== 1)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Banknote className="h-4 w-4" /> {Number(p.bayar_verified) === 1 ? 'Batalkan verifikasi bayar' : 'Verifikasi bayar'}
          </button>
          {!accepted ? (
            <>
              <button onClick={() => onTerima(id)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Terima jadi Santri
              </button>
              <button onClick={() => onTolak(id)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> Tolak
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" /> Sudah diterima sebagai santri
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
