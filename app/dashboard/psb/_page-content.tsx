'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  Eye,
  X,
  Clock,
  CheckCircle2,
  Circle,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { printIframe } from '@/lib/utils'

import {
  bayarPsbBatch,
  voidPsbReceipt,
  bypassPsbPayment,
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

import { PsbReceiptCopy } from './psb-receipt-copy'

const STATUS_LIST: PsbStatus[] = ['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PAID', 'PLACED_KAMAR', 'DONE']

const PAGE_SIZE = 25

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

function paginate<T>(rows: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE
  return rows.slice(start, start + PAGE_SIZE)
}

function Pagination({ total, page, setPage }: { total: number; page: number; setPage: (updater: (p: number) => number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (total <= PAGE_SIZE) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="text-xs text-slate-500">
        Menampilkan <span className="font-bold text-slate-700">{from}-{to}</span> dari <span className="font-bold text-slate-700">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Sebelumnya
        </button>
        <span className="font-mono text-xs font-bold text-slate-700">{page} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Berikutnya
        </button>
      </div>
    </div>
  )
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    BANGUNAN: 'Dana Bangunan',
    KESEHATAN: 'Biaya Kesehatan',
    EHB: 'Biaya EHB',
    EKSKUL: 'Biaya Ekstrakurikuler',
    SPP_JULI: 'SPP Bulan Juli',
  }
  return labels[value] ?? value
}

function statusAtLeast(status: PsbStatus, minimum: PsbStatus) {
  return STATUS_LIST.indexOf(status) >= STATUS_LIST.indexOf(minimum)
}

function paymentTarget(row: any) {
  const payment = row.pembayaran
  if (!payment) return 0
  const sppJuli = Number(payment.sppJuli?.nominal ?? 0)
  return Number(payment.bangunan?.target ?? 0) + sppJuli + PAYMENT_TYPES.reduce((sum, jenis) => {
    return sum + Number(payment.tahunan?.[jenis]?.nominal ?? 0)
  }, 0)
}

function paymentPaid(row: any) {
  const payment = row.pembayaran
  if (!payment) return 0
  const sppJuliPaid = payment.sppJuli?.lunas ? Number(payment.sppJuli?.nominal ?? 0) : 0
  return Number(payment.bangunan?.paid ?? 0) + sppJuliPaid + PAYMENT_TYPES.reduce((sum, jenis) => {
    return sum + (payment.tahunan?.[jenis]?.lunas ? Number(payment.tahunan?.[jenis]?.nominal ?? 0) : 0)
  }, 0)
}

function paymentOutstanding(row: any) {
  return Math.max(0, paymentTarget(row) - paymentPaid(row))
}

export default function PsbPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // State awal dibaca dari URL agar tombol kembali (browser/HP/tombol halaman)
  // mengembalikan user ke tugas & halaman PSB yang sama, bukan landing.
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(() => {
    const role = searchParams.get('role')
    return (['sekretariat', 'asrama', 'kamar', 'pembayaran'] as const).includes(role as RoleKey) ? (role as RoleKey) : null
  })
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [tahunTagihan, setTahunTagihan] = useState(() => Number(searchParams.get('tahun')) || new Date().getFullYear())
  const [showDadakanModal, setShowDadakanModal] = useState(false)
  const [paymentModalRow, setPaymentModalRow] = useState<any | null>(null)
  const [dadakan, setDadakan] = useState({ nama_lengkap: '', jenis_kelamin: 'L' as 'L' | 'P', sekolah: '' })
  const [selectedAsrama, setSelectedAsrama] = useState<Record<string, string>>({})
  const [activeRoomAsrama, setActiveRoomAsrama] = useState('')
  const [kamarOptions, setKamarOptions] = useState<Record<string, any[]>>({})
  const [selectedKamar, setSelectedKamar] = useState<Record<string, string>>({})
  const [bangunanNominal, setBangunanNominal] = useState<Record<string, string>>({})
  const [paymentItems, setPaymentItems] = useState<Record<string, Record<string, boolean>>>({})
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({})
  const [verificationRow, setVerificationRow] = useState<any>(null)
  const [metode, setMetode] = useState<'TUNAI' | 'TRANSFER'>('TUNAI')
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))

  // Reset ke halaman 1 tiap ganti tugas/pencarian — tapi jangan saat mount awal,
  // supaya halaman yang dipulihkan dari URL tidak ketimpa.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    setPage(1)
  }, [selectedRole, q, tahunTagihan])

  // Simpan state tugas/pencarian/halaman ke URL (replace, tanpa nambah history)
  // agar bisa dipulihkan saat kembali dari halaman Edit santri.
  useEffect(() => {
    const sp = new URLSearchParams()
    if (selectedRole) sp.set('role', selectedRole)
    if (q.trim()) sp.set('q', q.trim())
    sp.set('tahun', String(tahunTagihan))
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, q, tahunTagihan, page])

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const result = await getPsbDashboard({ q, tahunTagihan })
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      setData(result)
    } catch (error: any) {
      // Jangan biarkan spinner muter selamanya kalau query gagal.
      toast.error(error?.message || 'Gagal memuat data PSB.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
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
      // Skip polling kalau tab tidak aktif atau ada modal terbuka — hemat query
      // berat pada dataset besar.
      if (document.hidden || showDadakanModal || paymentModalRow || verificationRow) return
      void load(true)
    }, 10000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tahunTagihan, showDadakanModal, paymentModalRow, verificationRow])

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
  const goBack = () => {
    setVerificationRow(null)
  }
  const roomRows = useMemo(() => {
    return rows.filter((row: any) => (row.status === 'PAID' || row.status === 'PLACED_KAMAR') && (!activeRoomAsrama || row.asrama === activeRoomAsrama))
  }, [activeRoomAsrama, rows])
  const paymentRows = useMemo(() => {
    return rows.filter((row: any) => row.status === 'PLACED_ASRAMA')
  }, [rows])
  // Santri yang punya kuitansi aktif — muncul di seksi "Sudah Bayar" agar
  // bendahara tetap bisa void tanpa perlu revert tahap lebih dulu.
  const paidRows = useMemo(() => {
    return rows.filter((row: any) => row.pembayaran?.latestReceipt?.id)
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
    if (picks.SPP_JULI) items.push({ jenis: 'SPP_JULI' })
    const result = await run(row.id, () => bayarPsbBatch({ santriId: row.id, tahunTagihan, items, metode }), 'Pembayaran PSB tersimpan')
    if (result?.receiptId) {
      printIframe(`/dashboard/psb/kuitansi/${result.receiptId}`)
      setPaymentItems(prev => ({ ...prev, [row.id]: {} }))
      setBangunanNominal(prev => ({ ...prev, [row.id]: '' }))
      setPaymentModalRow(null)
    }
  }

  const handleLunasSemua = (row: any) => {
    const picks: Record<string, boolean> = { BANGUNAN: true }
    PAYMENT_TYPES.forEach(jenis => picks[jenis] = true)
    if (!row.pembayaran?.sppJuli?.lunas) picks.SPP_JULI = true

    setPaymentItems(prev => ({
      ...prev,
      [row.id]: picks
    }))
    
    setBangunanNominal(prev => ({
      ...prev,
      [row.id]: String(row.pembayaran?.bangunan?.sisa ?? 0)
    }))
  }

  const handleCicilSemua = async (row: any) => {
    await run(
      row.id,
      () => bypassPsbPayment({ santriId: row.id, alasan: 'Dicicil - lanjut tanpa pelunasan' }),
      'Santri lanjut ke tahap kamar (dicicil)'
    )
    setPaymentModalRow(null)
  }

  const handleBypass = async (row: any) => {
    const reason = window.prompt(`Alasan menggratiskan santri ${row.nama_lengkap}? (Wajib diisi)`)
    if (!reason?.trim()) {
      if (reason !== null) toast.error('Alasan wajib diisi')
      return
    }
    
    await run(
      row.id,
      () => bypassPsbPayment({ santriId: row.id, alasan: reason.trim() }), 'Pembayaran berhasil digratiskan/di-bypass')
    setPaymentModalRow(null)
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
    const reason = window.prompt(`Alasan membatalkan pembayaran ${latestReceipt.receipt_no} untuk ${row.nama_lengkap}? (Wajib diisi)`)
    if (!reason?.trim()) {
      if (reason !== null) toast.error('Alasan pembatalan wajib diisi')
      return
    }
    
    await run(
      row.id,
      () => voidPsbReceipt({ receiptId: latestReceipt.id, santriId: row.id, alasan: reason.trim() }),
      'Pembayaran terakhir berhasil dibatalkan (VOID)'
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
    if (picks.SPP_JULI) {
      items.push({ label: paymentLabel('SPP_JULI'), tahun: String(tahunTagihan), nominal: Number(payment?.sppJuli?.nominal ?? 0) })
    }
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
      count: paymentRows.length,
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
      <div className="rounded-xl border border-slate-200 bg-white py-24 text-center text-slate-400 shadow-sm">
        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
        Memuat flow PSB...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
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
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-xl bg-slate-900 p-2.5 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {role.count} antrean
                  </span>
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900">{role.title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{role.description}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {role.can ? 'Masuk halaman kerja' : 'Tidak ada akses akun'}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                  <h2 className="font-bold text-slate-900">{roles.find(role => role.key === selectedRole)?.title}</h2>
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
              rows={paginate(sekretariatRows, page)}
              footer={<Pagination total={sekretariatRows.length} page={page} setPage={setPage} />}
              stats={sekretariatStats}
              canCreate={!!data?.user?.canSekretariat}
              busyId={busyId}
              onDadakan={() => setShowDadakanModal(true)}
              onVerify={(row: any) => setVerificationRow(row)}
            />
          ) : null}

          {selectedRole === 'asrama' ? (
            <AsramaPlacementView
              rows={paginate(placementRows, page)}
              footer={<Pagination total={placementRows.length} page={page} setPage={setPage} />}
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
              rows={paginate(paymentRows, page)}
              footer={<Pagination total={paymentRows.length} page={page} setPage={setPage} />}
              paidRows={paidRows}
              stats={paymentStats}
              busyId={busyId}
              onOpenPayment={(row: any) => { setMetode('TUNAI'); setPaymentModalRow(row) }}
              onCancelPayment={handleCancelPayment}
              onRevert={handleRevert}
            />
          ) : null}

          {selectedRole === 'kamar' ? (
            <KamarPlacementView
              rows={paginate(roomRows, page)}
              footer={<Pagination total={roomRows.length} page={page} setPage={setPage} />}
              user={data?.user}
              asramaList={data?.asramaList ?? []}
              activeAsrama={activeRoomAsrama}
              setActiveAsrama={setActiveRoomAsrama}
              roomOptions={roomOptions}
              roomStats={roomStats}
              selectedKamar={selectedKamar}
              setSelectedKamar={setSelectedKamar}
              busyId={busyId}
              onDone={(row: any) => run(row.id, () => selesaikanPsb(row.id), 'PSB santri selesai')}
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
          onClose={goBack}
          onSubmit={handleDadakan}
        />
      ) : null}

      {verificationRow ? (
        <VerificationPanel
          row={verificationRow}
          busy={busyId === verificationRow.id}
          onClose={() => setVerificationRow(null)}
          onSubmit={async (items: any, note: string) => {
            const result = await run(verificationRow.id, () => verifikasiSantriPsb(verificationRow.id, items, note), 'Santri terverifikasi')
            if (result) setVerificationRow(null)
          }}
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
          metode={metode}
          setMetode={setMetode}
          onBypass={() => handleBypass(paymentModalRow)}
          onCicilSemua={() => handleCicilSemua(paymentModalRow)}
          onLunasSemua={() => handleLunasSemua(paymentModalRow)}
          onClose={() => setPaymentModalRow(null)}
          onSubmit={() => handlePayment(paymentModalRow)}
        />
      ) : null}
    </div>
  )
}

function SekretariatView({ rows, footer, stats, canCreate, busyId, onDadakan, onVerify }: any) {
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Antrean Verifikasi" description="Santri yang sudah diverifikasi akan langsung masuk ke halaman penempatan asrama." />
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap min-w-[980px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <SantriCells row={row} />
                  <td className="px-4 py-3 text-slate-600">{row.kab_kota || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busyId === row.id}
                      onClick={() => onVerify(row)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                      Verifikasi
                    </button>
                  </td>
                </tr>
              )) : <EmptyRow colSpan={5} text="Tidak ada santri yang menunggu verifikasi." />}
            </tbody>
          </table>
        </div>
      </div>
      {footer}
    </div>
  )
}

function AsramaPlacementView({ rows, footer, stats, totalKuotaBaru, totalTerisi, selectedAsrama, setSelectedAsrama, busyId, onPlace, onRevert }: any) {
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Home className="h-4 w-4" />} title="Antrean Penempatan Asrama" description="Data verifikasi sekretariat tampil di sini otomatis tanpa refresh browser." />
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap min-w-[960px] text-left text-sm">
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
                          title="Kembalikan ke tahap sebelumnya"
                          aria-label="Kembalikan ke tahap sebelumnya"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
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
      {footer}
    </div>
  )
}

function KamarPlacementView({ rows, footer, user, asramaList, activeAsrama, setActiveAsrama, roomOptions, roomStats, selectedKamar, setSelectedKamar, busyId, onPlace, onRevert, onDone }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Asrama yang dikelola</p>
          <h3 className="text-lg font-bold text-slate-900">{activeAsrama || user?.asrama_binaan || '-'}</h3>
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Bed className="h-4 w-4" />} title="Antrean Penentuan Kamar" description="Santri yang sudah membayar tampil di sini. Simpan kamar lalu klik Selesai untuk menuntaskan PSB (step terakhir)." />
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap min-w-[960px] text-left text-sm">
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
                      {row.status === 'PLACED_KAMAR' ? (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => onDone(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          Selesai
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : <EmptyRow colSpan={6} text="Tidak ada santri yang menunggu penentuan kamar untuk asrama ini." />}
            </tbody>
          </table>
        </div>
      </div>
      {footer}
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
    <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="truncate text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 group-open:bg-blue-50 group-open:text-blue-700">
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
          <p className="truncate text-sm font-bold text-slate-900">{item.asrama}</p>
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
          <p className="text-sm font-bold text-slate-900">Kamar {room.nomor_kamar}</p>
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
      <p className={`text-sm font-bold ${className}`}>{Number(value || 0).toLocaleString('id-ID')}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

function PembayaranView({ rows, footer, paidRows, stats, busyId, onOpenPayment, onCancelPayment, onRevert }: any) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MoneyCard label="Potensi Uang Masuk" value={stats.potential} tone="slate" />
        <MoneyCard label="Uang Sudah Masuk" value={stats.paid} tone="emerald" />
        <MoneyCard label="Belum Masuk" value={stats.unpaid} tone="rose" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TableTitle icon={<Wallet className="h-4 w-4" />} title="Antrean Pembayaran" description="Status verifikasi, asrama, dan kamar ditampilkan sebagai tabel agar bendahara bisa cek cepat." />
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap min-w-[1180px] text-left text-sm">
            <thead className="border-y bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Asrama</th>
                <th className="px-4 py-3 text-right">Tagihan</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Sisa</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((row: any) => {
                const outstanding = paymentOutstanding(row)
                // Buka modal kalau masih ada tagihan, ATAU santri belum lolos tahap bayar
                // (mis. gratis/tanpa tarif) supaya tombol GRATISKAN tetap bisa diakses.
                const canPay = row.status !== 'DONE'
                  && statusAtLeast(row.status, 'PLACED_ASRAMA')
                  && (outstanding > 0 || !statusAtLeast(row.status, 'PAID'))
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <SantriCells row={row} />
                    <td className="px-4 py-3 text-slate-600">
                      {row.asrama ? `${row.asrama} / ${row.kamar || '-'}` : '-'}
                    </td>
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
                        <button
                          disabled={busyId === row.id}
                          onClick={() => onRevert(row)}
                          title="Kembalikan ke tahap sebelumnya"
                          aria-label="Kembalikan ke tahap sebelumnya"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
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
      {footer}

      <QuotaAccordion
        icon={<Undo2 className="h-4 w-4" />}
        title={`Sudah Bayar (${paidRows?.length ?? 0})`}
        description="Santri yang punya kuitansi aktif. Buka kalau bendahara perlu membatalkan (void) pembayaran."
      >
        {paidRows?.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap min-w-[820px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Santri</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kuitansi</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paidRows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.asrama ? `${row.asrama} / ${row.kamar || '-'}` : '-'}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.pembayaran?.latestReceipt?.receipt_no || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{rupiah(row.pembayaran?.latestReceipt?.total ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={!row.pembayaran?.latestReceipt?.id}
                            onClick={() => printIframe(`/dashboard/psb/kuitansi/${row.pembayaran.latestReceipt.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            <Printer className="h-3.5 w-3.5" /> Cetak Ulang
                          </button>
                          <button
                            disabled={busyId === row.id}
                            onClick={() => onCancelPayment(row)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            Batalkan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            Belum ada pembayaran yang bisa dibatalkan.
          </div>
        )}
      </QuotaAccordion>
    </div>
  )
}

function SantriCells({ row }: { row: any }) {
  // Bawa URL PSB saat ini (role/pencarian/halaman) sebagai `return` agar tombol
  // kembali di halaman Edit balik ke state yang sama.
  const searchParams = useSearchParams()
  const returnUrl = `/dashboard/psb${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const editHref = `/dashboard/santri/${row.id}/edit?from=psb&return=${encodeURIComponent(returnUrl)}`
  return (
    <>
      <td className="px-4 py-3">
        <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{row.nis || '-'}</span>
          <Link href={editHref} className="font-bold text-blue-700 hover:underline">Edit</Link>
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
    <div className="border-b bg-slate-50 px-5 py-3">
      <h3 className="font-bold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{Number(value || 0).toLocaleString('id-ID')}</p>
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{rupiah(value)}</p>
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
      <form onSubmit={onSubmit} className="relative z-10 w-full rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:max-w-md sm:rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">Santri Dadakan</h2>
            </div>
            <p className="text-[11px] mt-1 leading-relaxed text-slate-500">Isi data dasar agar santri langsung masuk tahap penempatan PSB.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
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

function PaymentModal({ row, tahunTagihan, busy, paymentItems, bangunanNominal, setBangunanNominal, togglePayment, getPreviewItems, metode, setMetode, onBypass, onCicilSemua, onLunasSemua, onClose, onSubmit }: any) {
  const items = getPreviewItems(row)
  const total = items.reduce((sum: number, item: any) => sum + item.nominal, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Tutup modal pembayaran" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700" />
              <h2 className="text-base font-bold text-slate-800">Pembayaran PSB</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">{row.nama_lengkap} - {row.nis}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[420px_1fr]">
          <div className="space-y-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Asrama / Kamar</p>
              <p className="mt-1 font-bold text-slate-900">{row.asrama || '-'} / {row.kamar || '-'}</p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase text-slate-500">Metode Pembayaran</p>
              <div className="grid grid-cols-2 gap-2">
                {(['TUNAI', 'TRANSFER'] as const).map(m => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMetode(m)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${metode === m ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {m === 'TUNAI' ? 'Tunai' : 'Transfer'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onBypass}
                disabled={busy}
                className="flex flex-1 items-center justify-center rounded-xl bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200"
              >
                GRATISKAN
              </button>
              <button
                type="button"
                onClick={onLunasSemua}
                disabled={busy}
                className="flex flex-1 items-center justify-center rounded-xl bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-200"
              >
                BAYAR SEMUA
              </button>
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

              <PaymentOption
                title={paymentLabel('SPP_JULI')}
                subtitle={row.pembayaran?.sppJuli?.lunas ? 'Sudah lunas' : `${rupiah(row.pembayaran?.sppJuli?.nominal ?? 0)} — dicatat ke Pembayaran SPP asrama`}
                checked={!!paymentItems[row.id]?.SPP_JULI}
                disabled={!!row.pembayaran?.sppJuli?.lunas || Number(row.pembayaran?.sppJuli?.nominal ?? 0) <= 0}
                onChange={(checked: boolean) => togglePayment(row.id, 'SPP_JULI', checked)}
              />
            </div>

            {items.length > 0 ? (
              <button
                disabled={busy}
                onClick={onSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Simpan & Cetak Kuitansi
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={onCicilSemua}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Lewati (Cicil)
              </button>
            )}
          </div>

          <ReceiptPreview row={row} items={items} total={total} tahunTagihan={tahunTagihan} metode={metode} />
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

function ReceiptPreview({ row, items, total, tahunTagihan, metode }: any) {
  const mockReceipt = {
    total,
    nama_lengkap: row.nama_lengkap,
    nis: row.nis,
    sekolah: row.sekolah,
    asrama: row.asrama,
    kamar: row.kamar,
    tahun_tagihan: tahunTagihan,
    receipt_no: 'Nomor otomatis',
    created_at: new Date().toISOString(),
    penerima_nama: 'Bendahara',
    metode,
  }

  const frameRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    const scaler = scalerRef.current
    if (!frame || !scaler) return
    const fit = () => {
      const naturalW = scaler.offsetWidth
      const naturalH = scaler.offsetHeight
      if (!naturalW || !naturalH) return
      const scale = frame.clientWidth / naturalW
      scaler.style.transform = `scale(${scale})`
      frame.style.height = `${naturalH * scale}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="bg-slate-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Live Preview</p>
          <h3 className="text-sm font-bold text-slate-900">Kuitansi PSB</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">Kertas NCR</span>
      </div>

      <div ref={frameRef} className="relative w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div ref={scalerRef} className="origin-top-left" style={{ width: '21cm' }}>
          <PsbReceiptCopy receipt={mockReceipt} items={items} printedAt={new Date().toISOString()} />
        </div>
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

const VERIFICATION_DOCS = [
  { id: 'formulir', label: 'Formulir Pendaftaran' },
  { id: 'sp_ortu', label: 'Surat Pernyataan Orang Tua' },
  { id: 'sp_santri', label: 'Surat Pernyataan Santri' },
  { id: 'kk', label: 'Kartu Keluarga (2 lembar)' },
  { id: 'akta', label: 'Akta Kelahiran (2 lembar)' },
  { id: 'ktp', label: 'KTP Kedua Orang Tua (2 lembar)' },
  { id: 'foto', label: 'Foto 3 x 4 calon santri berlatar biru (3 lembar)' },
]

function VerificationPanel({ row, busy, onClose, onSubmit }: any) {
  const initialItems = useMemo(() => {
    try {
      return row.verification_items ? JSON.parse(row.verification_items) : {}
    } catch {
      return {}
    }
  }, [row.verification_items])

  const [items, setItems] = useState<Record<string, 'LENGKAP' | 'MENYUSUL'>>(initialItems)
  const [note, setNote] = useState(row.verification_note || '')

  const markAllComplete = () => {
    const all: Record<string, 'LENGKAP'> = {}
    VERIFICATION_DOCS.forEach(doc => all[doc.id] = 'LENGKAP')
    setItems(all)
  }

  const isAllComplete = VERIFICATION_DOCS.every(doc => items[doc.id] === 'LENGKAP')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Verifikasi Berkas</h2>
            <p className="text-xs text-slate-500">{row.nama_lengkap}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2">
            <div className="flex items-center gap-2 text-blue-700">
              <FileCheck className="h-4 w-4" />
              <span className="text-xs font-semibold">Tandai semua berkas lengkap?</span>
            </div>
            <button
              onClick={markAllComplete}
              disabled={isAllComplete}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              LENGKAP SEMUA
            </button>
          </div>

          <div className="space-y-1.5">
            {VERIFICATION_DOCS.map(doc => {
              const status = items[doc.id]
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-xs font-medium text-slate-700">{doc.label}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setItems(prev => ({ ...prev, [doc.id]: 'LENGKAP' }))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        status === 'LENGKAP'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {status === 'LENGKAP' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      Lengkap
                    </button>
                    <button
                      onClick={() => setItems(prev => ({ ...prev, [doc.id]: 'MENYUSUL' }))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        status === 'MENYUSUL'
                          ? 'border-amber-600 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {status === 'MENYUSUL' ? <Clock className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      Menyusul
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Catatan Tambahan (Opsional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Catatan verifikasi..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </div>

        <div className="border-t p-4">
          <button
            disabled={busy || Object.keys(items).length < VERIFICATION_DOCS.length}
            onClick={() => onSubmit(items, note)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Simpan Verifikasi
          </button>
          {Object.keys(items).length < VERIFICATION_DOCS.length && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Pilih kelengkapan untuk semua dokumen terlebih dahulu.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
