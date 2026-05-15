'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Bed, Check, ClipboardCheck, Home, Loader2, Printer, RefreshCw,
  Search, UserPlus, Wallet
} from 'lucide-react'
import { toast } from 'sonner'

import {
  bayarPsbBatch,
  getKamarPsb,
  getPsbDashboard,
  selesaikanPsb,
  tambahSantriDadakan,
  tempatkanAsramaPsb,
  tempatkanKamarPsb,
  verifikasiSantriPsb,
  type PsbStatus,
} from './actions'

const STATUS_LABEL: Record<PsbStatus, string> = {
  VERIFICATION: 'Belum Verifikasi',
  VERIFIED: 'Sudah Verifikasi',
  PLACED_ASRAMA: 'Sudah Asrama',
  PLACED_KAMAR: 'Sudah Kamar',
  PAID: 'Sudah Bayar',
  DONE: 'Selesai',
}

const STATUS_TABS: Array<{ key: 'ALL' | PsbStatus; label: string }> = [
  { key: 'ALL', label: 'Semua' },
  { key: 'VERIFICATION', label: 'Sekretariat' },
  { key: 'VERIFIED', label: 'Penempatan' },
  { key: 'PLACED_ASRAMA', label: 'Kamar' },
  { key: 'PLACED_KAMAR', label: 'Pembayaran' },
  { key: 'PAID', label: 'Final' },
]

const SEKOLAH_LIST = ['MTSU', 'MTSN', 'MAN', 'SMK', 'SMA', 'SMP', 'LAINNYA']

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

export default function PsbPageContent() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'ALL' | PsbStatus>('ALL')
  const [q, setQ] = useState('')
  const [tahunTagihan, setTahunTagihan] = useState(new Date().getFullYear())
  const [dadakan, setDadakan] = useState({ nama_lengkap: '', jenis_kelamin: 'L' as 'L' | 'P', sekolah: '' })
  const [selectedAsrama, setSelectedAsrama] = useState<Record<string, string>>({})
  const [kamarOptions, setKamarOptions] = useState<Record<string, any[]>>({})
  const [selectedKamar, setSelectedKamar] = useState<Record<string, string>>({})
  const [bangunanNominal, setBangunanNominal] = useState<Record<string, string>>({})
  const [paymentItems, setPaymentItems] = useState<Record<string, Record<string, boolean>>>({})

  const load = async () => {
    setLoading(true)
    const result = await getPsbDashboard({ q, tahunTagihan })
    setLoading(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setData(result)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunTagihan])

  const rows = useMemo(() => {
    const all = data?.rows ?? []
    if (tab === 'ALL') return all
    return all.filter((row: any) => row.status === tab)
  }, [data, tab])

  const run = async (id: string, fn: () => Promise<any>, success: string) => {
    setBusyId(id)
    const result = await fn()
    setBusyId(null)
    if (result?.error) {
      toast.error(result.error)
      return null
    }
    toast.success(success)
    await load()
    return result
  }

  const handleDadakan = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await run('dadakan', () => tambahSantriDadakan(dadakan), 'Santri dadakan masuk flow PSB')
    if (result) setDadakan({ nama_lengkap: '', jenis_kelamin: 'L', sekolah: '' })
  }

  const loadKamar = async (asrama: string) => {
    if (!asrama || kamarOptions[asrama]) return
    const result = await getKamarPsb(asrama)
    if (Array.isArray(result)) {
      setKamarOptions(prev => ({ ...prev, [asrama]: result }))
    } else if (result?.error) {
      toast.error(result.error)
    }
  }

  const togglePayment = (santriId: string, key: string, checked: boolean) => {
    setPaymentItems(prev => ({
      ...prev,
      [santriId]: { ...(prev[santriId] ?? {}), [key]: checked },
    }))
  }

  const handlePayment = async (row: any) => {
    const picks = paymentItems[row.id] ?? {}
    const items: any[] = []
    if (picks.BANGUNAN) {
      items.push({ jenis: 'BANGUNAN', nominal: Number(bangunanNominal[row.id] || 0) })
    }
    ;(['KESEHATAN', 'EHB', 'EKSKUL'] as const).forEach((jenis) => {
      if (picks[jenis]) items.push({ jenis })
    })
    const result = await run(row.id, () => bayarPsbBatch({ santriId: row.id, tahunTagihan, items }), 'Pembayaran PSB tersimpan')
    if (result?.receiptId) {
      window.open(`/dashboard/psb/kuitansi/${result.receiptId}`, '_blank')
      setPaymentItems(prev => ({ ...prev, [row.id]: {} }))
      setBangunanNominal(prev => ({ ...prev, [row.id]: '' }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        {(['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PLACED_KAMAR', 'PAID', 'DONE'] as PsbStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setTab(status)}
            className={`rounded-lg border bg-white p-3 text-left shadow-sm transition-colors ${tab === status ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <p className="text-[11px] font-bold uppercase text-slate-500">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{data?.summary?.[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {data?.user?.canSekretariat ? (
            <form onSubmit={handleDadakan} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Santri Dadakan</h2>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Nama Lengkap</span>
                  <input
                    required
                    value={dadakan.nama_lengkap}
                    onChange={e => setDadakan(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama santri"
                  />
                </label>
                <div>
                  <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Jenis Kelamin</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['L', 'P'] as const).map(jk => (
                      <button
                        type="button"
                        key={jk}
                        onClick={() => setDadakan(prev => ({ ...prev, jenis_kelamin: jk }))}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold ${dadakan.jenis_kelamin === jk ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                      >
                        {jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Sekolah</span>
                  <select
                    value={dadakan.sekolah}
                    onChange={e => setDadakan(prev => ({ ...prev, sekolah: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Belum dipilih</option>
                    {SEKOLAH_LIST.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <button
                  disabled={busyId === 'dadakan'}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {busyId === 'dadakan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Masukkan ke PSB
                </button>
              </div>
            </form>
          ) : null}

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Filter</h2>
              <button onClick={load} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Muat ulang">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load()}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cari nama atau NIS"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={load} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Cari</button>
                <button onClick={() => { setQ(''); setTab('ALL') }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Reset</button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <button onClick={() => setTahunTagihan(t => t - 1)} className="font-bold text-slate-500">-</button>
                <span className="font-mono text-sm font-bold text-slate-800">{tahunTagihan}</span>
                <button onClick={() => setTahunTagihan(t => t + 1)} className="font-bold text-slate-500">+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${tab === item.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-lg border bg-white py-20 text-center text-slate-400">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
              Memuat data PSB...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border bg-white py-20 text-center text-slate-400">Belum ada data pada tahap ini.</div>
          ) : (
            rows.map((row: any) => {
              const payment = row.pembayaran
              const opts = row.asrama ? kamarOptions[row.asrama] ?? [] : []
              return (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">{row.nama_lengkap}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{STATUS_LABEL[row.status as PsbStatus]}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.nis} · {row.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'} · {row.sekolah || 'Sekolah belum diisi'} · {row.asrama || 'Belum asrama'} {row.kamar ? `kamar ${row.kamar}` : ''}
                      </p>
                    </div>
                    <Link href={`/dashboard/santri/${row.id}/edit`} className="text-xs font-bold text-blue-700 hover:underline">
                      Edit Data
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                        <ClipboardCheck className="h-4 w-4" /> Sekretariat
                      </div>
                      <button
                        disabled={!data?.user?.canSekretariat || row.status !== 'VERIFICATION' || busyId === row.id}
                        onClick={() => run(row.id, () => verifikasiSantriPsb(row.id), 'Santri terverifikasi')}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        <Check className="h-4 w-4" /> Verifikasi
                      </button>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                        <Home className="h-4 w-4" /> Penempatan
                      </div>
                      <div className="flex gap-2">
                        <select
                          disabled={!data?.user?.canPenempatan || row.status !== 'VERIFIED'}
                          value={selectedAsrama[row.id] ?? row.asrama ?? ''}
                          onChange={e => setSelectedAsrama(prev => ({ ...prev, [row.id]: e.target.value }))}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none"
                        >
                          <option value="">Asrama</option>
                          {data?.asramaList?.map((a: string) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <button
                          disabled={!data?.user?.canPenempatan || row.status !== 'VERIFIED' || busyId === row.id}
                          onClick={() => run(row.id, () => tempatkanAsramaPsb(row.id, selectedAsrama[row.id] ?? row.asrama), 'Asrama tersimpan')}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                        <Bed className="h-4 w-4" /> Kamar
                      </div>
                      <div className="flex gap-2">
                        <select
                          disabled={!data?.user?.canKamar || row.status !== 'PLACED_ASRAMA' || !row.asrama}
                          value={selectedKamar[row.id] ?? row.kamar ?? ''}
                          onFocus={() => row.asrama && loadKamar(row.asrama)}
                          onChange={e => setSelectedKamar(prev => ({ ...prev, [row.id]: e.target.value }))}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none"
                        >
                          <option value="">Kamar</option>
                          {opts.map((k: any) => <option key={k.nomor_kamar} value={k.nomor_kamar}>{k.nomor_kamar} · sisa {k.sisa_slot_baru}</option>)}
                        </select>
                        <button
                          disabled={!data?.user?.canKamar || row.status !== 'PLACED_ASRAMA' || busyId === row.id}
                          onClick={() => run(row.id, () => tempatkanKamarPsb(row.id, selectedKamar[row.id] ?? row.kamar), 'Kamar tersimpan')}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                        <Wallet className="h-4 w-4" /> Pembayaran
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" disabled={!data?.user?.canBayar || row.status !== 'PLACED_KAMAR'} checked={!!paymentItems[row.id]?.BANGUNAN} onChange={e => togglePayment(row.id, 'BANGUNAN', e.target.checked)} />
                          Bangunan, sisa {rupiah(payment?.bangunan?.sisa ?? 0)}
                        </label>
                        {paymentItems[row.id]?.BANGUNAN ? (
                          <input
                            type="number"
                            value={bangunanNominal[row.id] ?? ''}
                            onChange={e => setBangunanNominal(prev => ({ ...prev, [row.id]: e.target.value }))}
                            placeholder="Nominal bangunan"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
                          />
                        ) : null}
                        {(['KESEHATAN', 'EHB', 'EKSKUL'] as const).map(jenis => (
                          <label key={jenis} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              disabled={!data?.user?.canBayar || row.status !== 'PLACED_KAMAR' || payment?.tahunan?.[jenis]?.lunas}
                              checked={!!paymentItems[row.id]?.[jenis]}
                              onChange={e => togglePayment(row.id, jenis, e.target.checked)}
                            />
                            {jenis} {payment?.tahunan?.[jenis]?.lunas ? '(lunas)' : rupiah(payment?.tahunan?.[jenis]?.nominal ?? 0)}
                          </label>
                        ))}
                        <button
                          disabled={!data?.user?.canBayar || row.status !== 'PLACED_KAMAR' || busyId === row.id}
                          onClick={() => handlePayment(row)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <Banknote className="h-4 w-4" /> Simpan & Cetak
                        </button>
                        {row.status === 'PAID' && data?.user?.canBayar ? (
                          <button
                            disabled={busyId === row.id}
                            onClick={() => run(row.id, () => selesaikanPsb(row.id), 'PSB santri selesai')}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                          >
                            <Printer className="h-4 w-4" /> Tandai Selesai
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
