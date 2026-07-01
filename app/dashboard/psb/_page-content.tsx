'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Bed,
  Building2,
  Check,
  ClipboardCheck,
  DoorOpen,
  Home,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Undo2,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  batalkanPembayaranPsb,
  bayarPsbBatch,
  getKamarPsb,
  getPsbDashboard,
  kembalikanTahapPsb,
  selesaikanPsb,
  tambahSantriDadakan,
  tempatkanAsramaPsb,
  tempatkanKamarPsb,
  verifikasiSantriPsb,
  type PsbStatus,
} from './actions'

const STATUS_LIST: PsbStatus[] = ['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PAID', 'PLACED_KAMAR', 'DONE']

const STATUS_LABEL: Record<PsbStatus, string> = {
  VERIFICATION: 'Belum Verifikasi',
  VERIFIED: 'Sudah Verifikasi',
  PLACED_ASRAMA: 'Sudah Asrama',
  PLACED_KAMAR: 'Sudah Kamar',
  PAID: 'Sudah Bayar',
  DONE: 'Selesai',
}

const STATUS_COLOR: Record<PsbStatus, string> = {
  VERIFICATION: 'bg-slate-100 text-slate-600',
  VERIFIED: 'bg-blue-50 text-blue-700',
  PLACED_ASRAMA: 'bg-cyan-50 text-cyan-700',
  PLACED_KAMAR: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  DONE: 'bg-emerald-700 text-white',
}

const SEKOLAH_LIST = ['MTSU', 'MTSN', 'MAN', 'SMK', 'SMA', 'SMP', 'LAINNYA']
const PAYMENT_TYPES = ['KESEHATAN', 'EHB', 'EKSKUL'] as const

type RoleKey = 'sekretariat' | 'asrama' | 'kamar' | 'pembayaran'

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    BANGUNAN: 'Dana Bangunan',
    KESEHATAN: 'Biaya Kesehatan',
    EHB: 'Biaya EHB',
    EKSKUL: 'Biaya Ekstrakurikuler',
  }
  return labels[value] ?? value
}

function statusAtLeast(status: PsbStatus, minimum: PsbStatus) {
  return STATUS_LIST.indexOf(status) >= STATUS_LIST.indexOf(minimum)
}

function paymentTarget(row: any) {
  const payment = row.pembayaran
  if (!payment) return 0
  return Number(payment.bangunan?.target ?? 0) + PAYMENT_TYPES.reduce((sum, jenis) => {
    return sum + Number(payment.tahunan?.[jenis]?.nominal ?? 0)
  }, 0)
}

function paymentPaid(row: any) {
  const payment = row.pembayaran
  if (!payment) return 0
  return Number(payment.bangunan?.paid ?? 0) + PAYMENT_TYPES.reduce((sum, jenis) => {
    return sum + (payment.tahunan?.[jenis]?.lunas ? Number(payment.tahunan?.[jenis]?.nominal ?? 0) : 0)
  }, 0)
}

function paymentOutstanding(row: any) {
  return Math.max(0, paymentTarget(row) - paymentPaid(row))
}

export default function PsbPageContent() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null)
  const [q, setQ] = useState('')
  const [tahunTagihan, setTahunTagihan] = useState(new Date().getFullYear())
  const [showDadakanModal, setShowDadakanModal] = useState(false)
  const [paymentModalRow, setPaymentModalRow] = useState<any | null>(null)
  const [dadakan, setDadakan] = useState({ nama_lengkap: '', jenis_kelamin: 'L' as 'L' | 'P', sekolah: '' })
  const [selectedAsrama, setSelectedAsrama] = useState<Record<string, string>>({})
  const [activeRoomAsrama, setActiveRoomAsrama] = useState('')
  const [kamarOptions, setKamarOptions] = useState<Record<string, any[]>>({})
  const [selectedKamar, setSelectedKamar] = useState<Record<string, string>>({})
  const [bangunanNominal, setBangunanNominal] = useState<Record<string, string>>({})
  const [paymentItems, setPaymentItems] = useState<Record<string, Record<string, boolean>>>({})

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    const result = await getPsbDashboard({ q, tahunTagihan })
    setLoading(false)
    setRefreshing(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setData(result)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tahunTagihan])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true)
    }, 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tahunTagihan])

  useEffect(() => {
    if (!data || activeRoomAsrama) return
    setActiveRoomAsrama(data.user?.asrama_binaan || data.asramaList?.[0] || '')
  }, [activeRoomAsrama, data])

  useEffect(() => {
    if (selectedRole !== 'kamar' || !activeRoomAsrama) return
    void loadKamar(activeRoomAsrama, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomAsrama, selectedRole])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const sekretariatRows = useMemo(() => rows.filter((row: any) => row.status === 'VERIFICATION'), [rows])
  const placementRows = useMemo(() => rows.filter((row: any) => row.status === 'VERIFIED'), [rows])
  const roomRows = useMemo(() => {
    return rows.filter((row: any) => row.status === 'PAID' && (!activeRoomAsrama || row.asrama === activeRoomAsrama))
  }, [activeRoomAsrama, rows])
  const paymentRows = useMemo(() => {
    return rows.filter((row: any) => statusAtLeast(row.status, 'PLACED_ASRAMA'))
  }, [rows])

  const sekretariatStats = useMemo(() => {
    const verified = rows.filter((row: any) => statusAtLeast(row.status, 'VERIFIED')).length
    return {
      total: rows.length,
      verified,
      unverified: rows.length - verified,
    }
  }, [rows])

  const asramaStats = data?.asramaStats ?? []
  const totalKuotaBaru = asramaStats.reduce((sum: number, item: any) => sum + Number(item.kuota_baru ?? 0), 0)
  const totalTerisiAsrama = asramaStats.reduce((sum: number, item: any) => sum + Number(item.terisi_baru ?? 0), 0)
  const roomOptions = useMemo(() => {
    return activeRoomAsrama ? (kamarOptions[activeRoomAsrama] ?? []) : []
  }, [activeRoomAsrama, kamarOptions])
  const roomStats = useMemo(() => {
    const totalKuota = roomOptions.reduce((sum: number, room: any) => sum + Number(room.kuota ?? 0), 0)
    const terisi = roomOptions.reduce((sum: number, room: any) => sum + Number(room.terisi ?? 0), 0)
    const over = roomOptions.reduce((sum: number, room: any) => sum + Math.max(0, Number(room.terisi ?? 0) - Number(room.kuota ?? 0)), 0)
    return { totalKuota, terisi, kosong: Math.max(0, totalKuota - terisi), over }
  }, [roomOptions])

  const paymentStats = useMemo(() => {
    const potential = rows.reduce((sum: number, row: any) => sum + paymentTarget(row), 0)
    const paid = rows.reduce((sum: number, row: any) => sum + paymentPaid(row), 0)
    return { potential, paid, unpaid: Math.max(0, potential - paid) }
  }, [rows])

  const run = async (id: string, fn: () => Promise<any>, success: string) => {
    setBusyId(id)
    try {
      const result = await fn()
      if (result?.error) {
        toast.error(result.error)
        return null
      }
      toast.success(success)
      await load(true)
      return result
    } catch (error: any) {
      toast.error(error?.message || 'Proses gagal diselesaikan.')
      return null
    } finally {
      setBusyId(null)
    }
  }

  const handleDadakan = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await run('dadakan', () => tambahSantriDadakan(dadakan), 'Santri dadakan masuk flow PSB')
    if (result) {
      setDadakan({ nama_lengkap: '', jenis_kelamin: 'L', sekolah: '' })
      setShowDadakanModal(false)
    }
  }

  const loadKamar = async (asrama: string, force = false) => {
    if (!asrama || (!force && kamarOptions[asrama])) return
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
    PAYMENT_TYPES.forEach((jenis) => {
      if (picks[jenis]) items.push({ jenis })
    })
    const result = await run(row.id, () => bayarPsbBatch({ santriId: row.id, tahunTagihan, items }), 'Pembayaran PSB tersimpan')
    if (result?.receiptId) {
      window.open(`/dashboard/psb/kuitansi/${result.receiptId}`, '_blank', 'noopener,noreferrer')
      setPaymentItems(prev => ({ ...prev, [row.id]: {} }))
      setBangunanNominal(prev => ({ ...prev, [row.id]: '' }))
      setPaymentModalRow(null)
    }
  }

  const handleRevert = async (row: any) => {
    const ok = window.confirm(`Kembalikan ${row.nama_lengkap} ke tahap sebelumnya?`)
    if (!ok) return
    await run(row.id, () => kembalikanTahapPsb(row.id), 'Santri dikembalikan ke tahap sebelumnya')
  }

  const handleCancelPayment = async (row: any) => {
    const latestReceipt = row.pembayaran?.latestReceipt
    if (!latestReceipt?.id) {
      toast.error('Belum ada pembayaran yang bisa dibatalkan.')
      return
    }
    const ok = window.confirm(`Batalkan pembayaran terakhir ${latestReceipt.receipt_no} untuk ${row.nama_lengkap}?`)
    if (!ok) return
    await run(
      row.id,
      () => batalkanPembayaranPsb({ santriId: row.id, receiptId: latestReceipt.id }),
      'Pembayaran terakhir berhasil dibatalkan'
    )
  }

  const getPreviewItems = (row: any) => {
    const picks = paymentItems[row.id] ?? {}
    const payment = row.pembayaran
    const items: Array<{ label: string; tahun: string; nominal: number }> = []
    if (picks.BANGUNAN) {
      items.push({ label: paymentLabel('BANGUNAN'), tahun: '-', nominal: Number(bangunanNominal[row.id] || 0) })
    }
    PAYMENT_TYPES.forEach(jenis => {
      if (picks[jenis]) {
        items.push({ label: paymentLabel(jenis), tahun: String(tahunTagihan), nominal: Number(payment?.tahunan?.[jenis]?.nominal ?? 0) })
      }
    })
    return items
  }

  const roles = [
    {
      key: 'sekretariat' as const,
      title: 'Kesekretariatan',
      description: 'Verifikasi santri baru dan input santri dadakan.',
      icon: ClipboardCheck,
      can: !!data?.user?.canSekretariat,
      count: sekretariatRows.length,
    },
    {
      key: 'asrama' as const,
      title: 'Penempatan Asrama',
      description: 'Tempatkan santri terverifikasi ke asrama tujuan.',
      icon: Building2,
      can: !!data?.user?.canPenempatan,
      count: placementRows.length,
    },
    {
      key: 'pembayaran' as const,
      title: 'Pembayaran',
      description: 'Input pembayaran dan cetak kuitansi PSB.',
      icon: Wallet,
      can: !!data?.user?.canBayar,
      count: paymentRows.filter((row: any) => row.status !== 'DONE').length,
    },
    {
      key: 'kamar' as const,
      title: 'Penentuan Kamar',
      description: 'Kelola kamar santri yang sudah menyelesaikan pembayaran.',
      icon: Bed,
      can: !!data?.user?.canKamar,
      count: roomRows.length,
    },
  ]

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-24 text-center text-slate-400 shadow-sm">
        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
        Memuat flow PSB...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!selectedRole ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.key}
                type="button"
                disabled={!role.can}
                onClick={() => setSelectedRole(role.key)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                    {role.count} antrean
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-900">{role.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{role.description}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                  {role.can ? 'Masuk halaman kerja' : 'Tidak ada akses akun'}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Kembali ke pilihan tugas"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="font-black text-slate-900">{roles.find(role => role.key === selectedRole)?.title}</h2>
                  <p className="text-xs text-slate-500">
                    Data refresh otomatis setiap 5 detik. {refreshing ? 'Sedang sinkron...' : 'Siap dipakai.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cari nama atau NIS..."
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-2">
                  <button onClick={() => setTahunTagihan(t => t - 1)} className="px-1 text-sm font-bold text-slate-500">-</button>
                  <span className="font-mono text-xs font-bold text-slate-800">{tahunTagihan}</span>
                  <button onClick={() => setTahunTagihan(t => t + 1)} className="px-1 text-sm font-bold text-slate-500">+</button>
                </div>
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {selectedRole === 'sekretariat' ? (
            <SekretariatView
              rows={sekretariatRows}
              stats={sekretariatStats}
              canCreate={!!data?.user?.canSekretariat}
              busyId={busyId}
              onDadakan={() => setShowDadakanModal(true)}
              onVerify={(row: any) => run(row.id, () => verifikasiSantriPsb(row.id), 'Santri terverifikasi')}
            />
          ) : null}

          {selectedRole === 'asrama' ? (
            <AsramaPlacementView
              rows={placementRows}
              stats={asramaStats}
              totalKuotaBaru={totalKuotaBaru}
              totalTerisi={totalTerisiAsrama}
              selectedAsrama={selectedAsrama}
              setSelectedAsrama={setSelectedAsrama}
              busyId={busyId}
              onPlace={(row: any) => run(row.id, () => tempatkanAsramaPsb(row.id, selectedAsrama[row.id] ?? row.asrama), 'Asrama tersimpan')}
              onRevert={handleRevert}
            />
          ) : null}

          {selectedRole === 'pembayaran' ? (
            <PembayaranView
              rows={paymentRows}
              stats={paymentStats}
              busyId={busyId}
              onOpenPayment={setPaymentModalRow}
              onCancelPayment={handleCancelPayment}
              onDone={(row: any) => run(row.id, () => selesaikanPsb(row.id), 'PSB santri selesai')}
              onRevert={handleRevert}
            />
          ) : null}

          {selectedRole === 'kamar' ? (
            <KamarPlacementView
              rows={roomRows}
              user={data?.user}
              asramaList={data?.asramaList ?? []}
              activeAsrama={activeRoomAsrama}
              setActiveAsrama={setActiveRoomAsrama}
              roomOptions={roomOptions}
              roomStats={roomStats}
              selectedKamar={selectedKamar}
              setSelectedKamar={setSelectedKamar}
              busyId={busyId}
              onPlace={async (row: any) => {
                const result = await run(row.id, () => tempatkanKamarPsb(row.id, selectedKamar[row.id] ?? row.kamar), 'Kamar tersimpan')
                if (result && row.asrama) await loadKamar(row.asrama, true)
              }}
              onRevert={async (row: any) => {
                await handleRevert(row)
                if (row.asrama) await loadKamar(row.asrama, true)
              }}
            />
          ) : null}
        </div>
      )}

      {showDadakanModal ? (
        <DadakanModal
          dadakan={dadakan}
          busy={busyId === 'dadakan'}
          setDadakan={setDadakan}
          onClose={() => setShowDadakanModal(false)}
          onSubmit={handleDadakan}
        />
      ) : null}

      {paymentModalRow ? (
        <PaymentModal
          row={paymentModalRow}
          tahunTagihan={tahunTagihan}
          busy={busyId === paymentModalRow.id}
          paymentItems={paymentItems}
          bangunanNominal={bangunanNominal}
          setBangunanNominal={setBangunanNominal}
          togglePayment={togglePayment}
          getPreviewItems={getPreviewItems}
          onClose={() => setPaymentModalRow(null)}
          onSubmit={() => handlePayment(paymentModalRow)}
        />
      ) : null}
    </div>
  )
}

function SekretariatView({ rows, stats, canCreate, busyId, onDadakan, onVerify }: any) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Jumlah Santri Baru" value={stats.total} tone="slate" />
        <StatCard label="Sudah Diverifikasi" value={stats.verified} tone="emerald" />
        <StatCard label="Belum Diverifikasi" value={stats.unverified} tone="amber" />
      </div>
      <div className="flex justify-end">
        {canCreate ? (
          <button onClick={onDadakan} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
            <UserPlus className="h-4 w-4" />
            Santri Dadakan
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Antrean Verifikasi" description="Santri yang sudah diverifikasi akan langsung masuk ke halaman penempatan asrama." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Asrama</th>
                <th className="px-4 py-3">Kamar</th>
                <th className="px-4 py-3">Pembayaran</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <SantriCells row={row} />
                  <td className="px-4 py-3 text-slate-600">{row.asrama || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.kamar || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{rupiah(paymentPaid(row))}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busyId === row.id}
                      onClick={() => onVerify(row)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Verifikasi
                    </button>
                  </td>
                </tr>
              )) : <EmptyRow colSpan={7} text="Tidak ada santri yang menunggu verifikasi." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AsramaPlacementView({ rows, stats, totalKuotaBaru, totalTerisi, selectedAsrama, setSelectedAsrama, busyId, onPlace, onRevert }: any) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total Kuota Santri Baru" value={totalKuotaBaru} tone="slate" />
        <StatCard label="Sudah Ditempatkan" value={totalTerisi} tone="emerald" />
        <StatCard label="Sisa Kuota" value={Math.max(0, totalKuotaBaru - totalTerisi)} tone="blue" />
        <StatCard label="Over Kuota" value={Math.max(0, totalTerisi - totalKuotaBaru)} tone="rose" />
      </div>

      <QuotaAccordion
        icon={<Building2 className="h-4 w-4" />}
        title="Kuota Asrama"
        description="Ringkasan kuota. Buka kalau perlu cek detail, penempatan tetap fokus di tabel bawah."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item: any) => <AsramaQuotaCard key={item.asrama} item={item} />)}
        </div>
      </QuotaAccordion>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Home className="h-4 w-4" />} title="Antrean Penempatan Asrama" description="Data verifikasi sekretariat tampil di sini otomatis tanpa refresh browser." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pilih Asrama</th>
                <th className="px-4 py-3">Catatan Kuota</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => {
                const target = selectedAsrama[row.id] ?? row.asrama ?? ''
                const quota = stats.find((item: any) => item.asrama === target)
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <SantriCells row={row} />
                    <td className="px-4 py-3">
                      <select
                        value={target}
                        onChange={e => setSelectedAsrama((prev: Record<string, string>) => ({ ...prev, [row.id]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Pilih asrama</option>
                        {stats.map((item: any) => <option key={item.asrama} value={item.asrama}>{item.asrama}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">{quota ? <AsramaStatusBadge status={quota.status} over={quota.over} /> : <span className="text-xs text-slate-400">Pilih asrama</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={busyId === row.id}
                          onClick={() => onRevert(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Kembalikan
                        </button>
                        <button
                          disabled={!target || busyId === row.id}
                          onClick={() => onPlace(row)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          Simpan Asrama
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : <EmptyRow colSpan={6} text="Tidak ada santri yang menunggu penempatan asrama." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KamarPlacementView({ rows, user, asramaList, activeAsrama, setActiveAsrama, roomOptions, roomStats, selectedKamar, setSelectedKamar, busyId, onPlace, onRevert }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Asrama yang dikelola</p>
          <h3 className="text-lg font-black text-slate-900">{activeAsrama || user?.asrama_binaan || '-'}</h3>
          <p className="text-sm text-slate-500">Pengurus asrama hanya melihat santri dan kamar dari asrama binaannya.</p>
        </div>
        {!user?.asrama_binaan ? (
          <select
            value={activeAsrama}
            onChange={e => setActiveAsrama(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {asramaList.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
          </select>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Jumlah Kuota Kamar" value={roomStats.totalKuota} tone="slate" />
        <StatCard label="Terisi" value={roomStats.terisi} tone="emerald" />
        <StatCard label="Belum Terisi" value={roomStats.kosong} tone="blue" />
        <StatCard label="Over" value={roomStats.over} tone="rose" />
      </div>

      <QuotaAccordion
        icon={<DoorOpen className="h-4 w-4" />}
        title="Kuota Kamar"
        description="Ringkasan kamar dibuat compact. Kamar penuh tetap bisa dipilih dan akan ditandai over."
      >
        {roomOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {roomOptions.map((room: any) => <KamarQuotaCard key={room.nomor_kamar} room={room} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            Belum ada konfigurasi kamar untuk asrama ini.
          </div>
        )}
      </QuotaAccordion>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Bed className="h-4 w-4" />} title="Antrean Penentuan Kamar" description="Hanya santri yang sudah menyelesaikan pembayaran PSB di asrama aktif yang muncul di tabel ini." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Asrama</th>
                <th className="px-4 py-3">Pilih Kamar</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <SantriCells row={row} />
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.asrama || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedKamar[row.id] ?? row.kamar ?? ''}
                      onChange={e => setSelectedKamar((prev: Record<string, string>) => ({ ...prev, [row.id]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Pilih kamar</option>
                      {roomOptions.map((room: any) => {
                        const over = Number(room.terisi ?? 0) >= Number(room.kuota ?? 0)
                        return <option key={room.nomor_kamar} value={room.nomor_kamar}>Kamar {room.nomor_kamar} - {room.terisi}/{room.kuota}{over ? ' over' : ''}</option>
                      })}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busyId === row.id}
                        onClick={() => onRevert(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Kembalikan
                      </button>
                      <button
                        disabled={!(selectedKamar[row.id] ?? row.kamar) || busyId === row.id}
                        onClick={() => onPlace(row)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        Simpan Kamar
                      </button>
                    </div>
                  </td>
                </tr>
              )) : <EmptyRow colSpan={6} text="Tidak ada santri yang menunggu penentuan kamar untuk asrama ini." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function QuotaAccordion({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900">{title}</h3>
            <p className="truncate text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-500 group-open:bg-blue-50 group-open:text-blue-700">
          <span className="group-open:hidden">Buka</span>
          <span className="hidden group-open:inline">Tutup</span>
        </span>
      </summary>
      <div className="border-t border-slate-100 bg-slate-50/60 p-3">{children}</div>
    </details>
  )
}

function AsramaQuotaCard({ item }: { item: any }) {
  const sisa = Number(item.sisa ?? 0)
  const sisaClass = sisa < 0 ? 'text-rose-700' : 'text-emerald-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{item.asrama}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Santri baru</p>
        </div>
        <AsramaStatusBadge status={item.status} over={item.over} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniMetric label="Kuota" value={item.kuota_baru} />
        <MiniMetric label="Terisi" value={item.terisi_baru} />
        <MiniMetric label="Sisa" value={item.sisa} className={sisaClass} />
      </div>
    </div>
  )
}

function KamarQuotaCard({ room }: { room: any }) {
  const kuota = Number(room.kuota ?? 0)
  const terisi = Number(room.terisi ?? 0)
  const sisa = kuota - terisi
  const sisaClass = sisa < 0 ? 'text-rose-700' : 'text-emerald-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">Kamar {room.nomor_kamar}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{room.blok ? `Blok ${room.blok}` : 'Tanpa blok'}</p>
        </div>
        <KamarStatusBadge terisi={terisi} kuota={kuota} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniMetric label="Kuota" value={kuota} />
        <MiniMetric label="Terisi" value={terisi} />
        <MiniMetric label="Sisa" value={sisa} className={sisaClass} />
      </div>
    </div>
  )
}

function MiniMetric({ label, value, className = 'text-slate-900' }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className={`text-sm font-black ${className}`}>{Number(value || 0).toLocaleString('id-ID')}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

function PembayaranView({ rows, stats, busyId, onOpenPayment, onCancelPayment, onDone, onRevert }: any) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MoneyCard label="Potensi Uang Masuk" value={stats.potential} tone="slate" />
        <MoneyCard label="Uang Sudah Masuk" value={stats.paid} tone="emerald" />
        <MoneyCard label="Belum Masuk" value={stats.unpaid} tone="rose" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Wallet className="h-4 w-4" />} title="Antrean Pembayaran" description="Status verifikasi, asrama, dan kamar ditampilkan sebagai tabel agar bendahara bisa cek cepat." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Asrama</th>
                <th className="px-4 py-3">Kamar</th>
                <th className="px-4 py-3 text-right">Tagihan</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Sisa</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => {
                const outstanding = paymentOutstanding(row)
                const canPay = row.status !== 'DONE' && statusAtLeast(row.status, 'PLACED_ASRAMA') && outstanding > 0
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <SantriCells row={row} />
                    <td className="px-4 py-3 text-slate-600">{row.asrama || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.kamar || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{rupiah(paymentTarget(row))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{rupiah(paymentPaid(row))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">{rupiah(outstanding)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={!canPay || busyId === row.id}
                          onClick={() => onOpenPayment(row)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Input
                        </button>
                        {row.pembayaran?.latestReceipt?.id ? (
                          <button
                            disabled={busyId === row.id}
                            onClick={() => onCancelPayment(row)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            Batalkan
                          </button>
                        ) : null}
                        {row.status === 'PLACED_KAMAR' ? (
                          <button
                            disabled={busyId === row.id}
                            onClick={() => onDone(row)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            Selesai
                          </button>
                        ) : null}
                        <button
                          disabled={busyId === row.id}
                          onClick={() => onRevert(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Kembalikan
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : <EmptyRow colSpan={9} text="Belum ada santri yang masuk tahap pembayaran." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SantriCells({ row }: { row: any }) {
  return (
    <>
      <td className="px-4 py-3">
        <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{row.nis || '-'}</span>
          <Link href={`/dashboard/santri/${row.id}/edit?from=psb`} className="font-bold text-blue-700 hover:underline">Edit</Link>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600">{row.sekolah || '-'}</td>
      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
    </>
  )
}

function StatusBadge({ status }: { status: PsbStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
}

function AsramaStatusBadge({ status, over }: { status: string; over?: number }) {
  if (status === 'OVER') return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700"><AlertTriangle className="h-3 w-3" /> Over {over ? `+${over}` : ''}</span>
  if (status === 'PENUH') return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Penuh</span>
  if (status === 'BELUM_CONFIG') return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Belum config</span>
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Tersedia</span>
}

function KamarStatusBadge({ terisi, kuota }: { terisi: number; kuota: number }) {
  if (kuota <= 0 && terisi > 0) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700"><AlertTriangle className="h-3 w-3" /> Over</span>
  if (terisi > kuota) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700"><AlertTriangle className="h-3 w-3" /> Over +{terisi - kuota}</span>
  if (terisi === kuota) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Penuh</span>
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Tersedia</span>
}

function TableTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span>
      <div>
        <h3 className="font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'emerald' | 'amber' | 'blue' | 'rose' }) {
  const color = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    rose: 'text-rose-700',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-3xl font-black ${color}`}>{Number(value || 0).toLocaleString('id-ID')}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function MoneyCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'emerald' | 'rose' }) {
  const color = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-black ${color}`}>{rupiah(value)}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center text-slate-400">{text}</td>
    </tr>
  )
}

function DadakanModal({ dadakan, busy, setDadakan, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Tutup modal" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative z-10 w-full rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Santri Dadakan</h2>
            </div>
            <p className="text-xs leading-5 text-slate-500">Isi data dasar agar santri langsung masuk tahap penempatan PSB.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Tutup</button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Nama Lengkap</span>
            <input
              required
              autoFocus
              value={dadakan.nama_lengkap}
              onChange={e => setDadakan((prev: any) => ({ ...prev, nama_lengkap: e.target.value }))}
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
                  onClick={() => setDadakan((prev: any) => ({ ...prev, jenis_kelamin: jk }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold ${dadakan.jenis_kelamin === jk ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
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
              onChange={e => setDadakan((prev: any) => ({ ...prev, sekolah: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Belum dipilih</option>
              {SEKOLAH_LIST.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Masukkan ke PSB
          </button>
        </div>
      </form>
    </div>
  )
}

function PaymentModal({ row, tahunTagihan, busy, paymentItems, bangunanNominal, setBangunanNominal, togglePayment, getPreviewItems, onClose, onSubmit }: any) {
  const items = getPreviewItems(row)
  const total = items.reduce((sum: number, item: any) => sum + item.nominal, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Tutup modal pembayaran" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">Pembayaran PSB</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{row.nama_lengkap} - {row.nis}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Tutup</button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[420px_1fr]">
          <div className="space-y-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Asrama / Kamar</p>
              <p className="mt-1 font-bold text-slate-900">{row.asrama || '-'} / {row.kamar || '-'}</p>
            </div>

            <div className="space-y-3">
              <PaymentOption
                title="Uang Bangunan"
                subtitle={`Sisa tagihan ${rupiah(row.pembayaran?.bangunan?.sisa ?? 0)}`}
                checked={!!paymentItems[row.id]?.BANGUNAN}
                disabled={(row.pembayaran?.bangunan?.sisa ?? 0) <= 0}
                onChange={(checked: boolean) => togglePayment(row.id, 'BANGUNAN', checked)}
              />
              {paymentItems[row.id]?.BANGUNAN ? (
                <label className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="mb-1 block text-[11px] font-bold uppercase text-emerald-700">Nominal Bangunan</span>
                  <input
                    type="number"
                    min={1}
                    max={row.pembayaran?.bangunan?.sisa ?? undefined}
                    value={bangunanNominal[row.id] ?? ''}
                    onChange={e => setBangunanNominal((prev: Record<string, string>) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder="Contoh: 500000"
                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              ) : null}

              {PAYMENT_TYPES.map(jenis => (
                <PaymentOption
                  key={jenis}
                  title={paymentLabel(jenis)}
                  subtitle={row.pembayaran?.tahunan?.[jenis]?.lunas ? 'Sudah lunas' : `${rupiah(row.pembayaran?.tahunan?.[jenis]?.nominal ?? 0)} tahun ${tahunTagihan}`}
                  checked={!!paymentItems[row.id]?.[jenis]}
                  disabled={!!row.pembayaran?.tahunan?.[jenis]?.lunas || Number(row.pembayaran?.tahunan?.[jenis]?.nominal ?? 0) <= 0}
                  onChange={(checked: boolean) => togglePayment(row.id, jenis, checked)}
                />
              ))}
            </div>

            <button
              disabled={busy || items.length === 0}
              onClick={onSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Simpan & Cetak Kuitansi
            </button>
          </div>

          <ReceiptPreview row={row} items={items} total={total} tahunTagihan={tahunTagihan} />
        </div>
      </div>
    </div>
  )
}

function PaymentOption({ title, subtitle, checked, disabled, onChange }: any) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'} ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
    </label>
  )
}

function ReceiptPreview({ row, items, total, tahunTagihan }: any) {
  return (
    <div className="bg-slate-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Live Preview</p>
          <h3 className="text-sm font-bold text-slate-900">Kuitansi PSB</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">A4 - 2 Salinan</span>
      </div>

      <div className="space-y-3">
        {[1, 2].map(copy => (
          <div key={copy} className="rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm">
            <div className="border-b-[3px] border-slate-900 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-900">Kuitansi Pembayaran</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">Pondok Pesantren Sukahideng</p>
                  <p className="text-[9px] text-slate-500">Desa Sukarapih Kec. Sukarame Kabupaten Tasikmalaya Jawa Barat 46461</p>
                </div>
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {copy === 1 ? 'Lembar Pembayar' : 'Arsip Pondok'}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[1.1fr_auto_0.9fr] gap-3">
              <div className="space-y-1 text-[11px]">
                <PreviewInfo label="Nama Santri" value={row.nama_lengkap} />
                <PreviewInfo label="NIS" value={row.nis || '-'} />
                <PreviewInfo label="Kelas" value={row.sekolah || '-'} />
                <PreviewInfo label="Asrama" value={`${row.asrama || '-'} / ${row.kamar || '-'}`} />
              </div>

              <div className="pt-1 text-center">
                <p className="text-sm font-black tracking-[0.2em] text-slate-900">BUKTI PEMBAYARAN</p>
                <p className="mt-1 text-[9px] text-slate-500">Pembayaran PSB - Tahun Tagihan {tahunTagihan}</p>
              </div>

              <div className="space-y-1 text-[11px]">
                <PreviewInfo label="No. Bukti" value="Nomor otomatis" />
                <PreviewInfo label="Tanggal" value="Tanggal transaksi" />
                <PreviewInfo label="Metode" value="Tunai" />
                <PreviewInfo label="Petugas" value="Bendahara" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-[11px]">
              <span className="text-slate-500">Terbilang:</span>
              <span className="font-semibold italic text-slate-900">{total ? `${rupiah(total)} dibayarkan` : 'Belum ada item dipilih'}</span>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-left text-[10px] uppercase text-white">
                  <tr>
                    <th className="px-2 py-1.5">Uraian Pembayaran</th>
                    <th className="px-2 py-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? items.map((item: any) => (
                    <tr key={`${item.label}-${item.tahun}`} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-medium">{item.label}</td>
                      <td className="px-2 py-1.5 text-right">{rupiah(item.nominal)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} className="px-2 py-5 text-center text-slate-400">Centang item pembayaran untuk melihat preview.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t-2 border-slate-900 bg-slate-100 font-black">
                  <tr>
                    <td className="px-2 py-1.5">TOTAL PEMBAYARAN INI</td>
                    <td className="px-2 py-1.5 text-right">{rupiah(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-8 px-4 text-center text-[10px] text-slate-500">
              <div>
                <p>Penyetor / Santri</p>
                <p className="mt-6 font-bold text-slate-700">( {row.nama_lengkap || '________________'} )</p>
              </div>
              <div>
                <p>Tasikmalaya, Tanggal transaksi<br />Bendahara</p>
                <p className="mt-6 font-bold text-slate-700">( Bendahara )</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[78px_8px_1fr]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}
