import Link from 'next/link'
import {
  CalendarCheck,
  CheckCircle,
  ClockCounterClockwise,
  CreditCard,
  Wallet,
  ArrowRight,
  ShieldCheck,
  CaretRight,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import {
  getPelanggaranAnak,
  getRekapAbsensiAnak,
} from '@/lib/portal/data'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { formatRupiah } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'

export const dynamic = 'force-dynamic'

function monthRange() {
  const [y, m] = toWibDateInputValue().split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function getGreeting(): string {
  const now = new Date()
  const wibHours = (now.getUTCHours() + 7) % 24
  if (wibHours >= 4 && wibHours < 11) return 'Pagi, Bapak/Ibu'
  if (wibHours >= 11 && wibHours < 15) return 'Siang, Bapak/Ibu'
  if (wibHours >= 15 && wibHours < 18) return 'Sore, Bapak/Ibu'
  return 'Malam, Bapak/Ibu'
}

export default async function BerandaPage() {
  const session = await requirePortalSessionStrict()
  const { start, end } = monthRange()

  const [absen, pelanggaran, billing] = await Promise.all([
    getRekapAbsensiAnak(session.santri_id, start, end),
    getPelanggaranAnak(session.santri_id),
    getPortalStudentBilling(session.santri_id).catch(() => null),
  ])

  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const pelanggaranBulanIni = pelanggaran.filter(p => p.tanggal >= start && p.tanggal <= end)

  // Evaluasi kondisi actionable untuk SATU Hero Surface
  const tagihanRemaining = billing?.obligations.totalRemaining ?? 0
  const pendingOrders = billing?.pendingOrders ?? []
  const hasPendingOrder = pendingOrders.length > 0
  const hasUnpaidBills = tagihanRemaining > 0
  const hasAlfa = absen.alfa > 0
  const hasNewViolations = pelanggaranBulanIni.length > 0

  const unpaidCount = (billing?.obligations.past.length ?? 0) +
    (billing?.obligations.current.length ?? 0) +
    (billing?.obligations.annual.length ?? 0)

  const isHeroActionable = hasPendingOrder || hasUnpaidBills || hasAlfa || hasNewViolations

  const greeting = getGreeting()

  return (
    <div className="px-5 space-y-6 pb-12">
      {/* 1. TOP AREA: COMPACT GREETING (Tanpa Profile Card Besar) */}
      <div className="flex items-center justify-between pt-5 pb-1">
        <div className="min-w-0 flex-1 pr-3">
          <p className="text-xs font-semibold text-emerald-800 tracking-tight">
            {greeting}
          </p>
          <h1 className="text-base font-bold text-slate-950 truncate mt-0.5 leading-snug">
            {session.nama}
          </h1>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            NIS {session.nis}
            {session.asrama ? ` · Asrama ${session.asrama}` : ''}
            {session.kamar ? ` (${session.kamar})` : ''}
          </p>
        </div>
        <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
          {session.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.foto_url} alt={session.nama} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-sm">
              {session.nama.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* 2. HERO ACTION SURFACE (SATU Surface Utama dengan Visual Anchor Kuat) */}
      {isHeroActionable ? (
        <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
                {hasPendingOrder
                  ? 'Pesanan Menunggu Pembayaran'
                  : hasUnpaidBills
                  ? 'Yang Perlu Diselesaikan'
                  : hasAlfa
                  ? 'Presensi Perlu Perhatian'
                  : 'Catatan Kedisiplinan'}
              </span>
              {hasPendingOrder && (
                <span className="inline-flex items-center rounded-full bg-amber-400/25 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                  Menunggu Bayar
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <p className="text-3xl font-black font-mono tracking-tight text-white">
                {hasPendingOrder
                  ? formatRupiah(pendingOrders[0].totalCharged)
                  : hasUnpaidBills
                  ? formatRupiah(tagihanRemaining)
                  : hasAlfa
                  ? `${absen.alfa} Sesi Alfa`
                  : `${pelanggaranBulanIni.length} Catatan Baru`}
              </p>
              <p className="text-xs text-emerald-100/80 font-medium">
                {hasPendingOrder
                  ? `Pesanan #${pendingOrders[0].orderNumber} · Batas waktu pembayaran aktif`
                  : hasUnpaidBills
                  ? `${unpaidCount} tagihan belum dibayar`
                  : hasAlfa
                  ? 'Ada sesi pengajian tanpa keterangan bulan ini'
                  : 'Catatan kedisiplinan baru pada bulan berjalan'}
              </p>
            </div>

            <div className="pt-1">
              <Link
                href={hasPendingOrder || hasUnpaidBills ? '/portal-ortu/tagihan' : '/portal-ortu/aktivitas'}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#bef264] px-4 py-2.5 text-xs font-bold text-[#064e3b] shadow-xs hover:bg-[#a3e635] active:scale-[0.98] transition"
              >
                <span>{hasPendingOrder || hasUnpaidBills ? 'Bayar sekarang' : 'Lihat detail'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] bg-gradient-to-br from-[#064e3b] to-[#047857] p-5 text-white shadow-[0_6px_20px_rgba(6,78,59,0.12)] relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#bef264]/20 text-[#bef264] flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white">Semua beres</h3>
              <p className="text-xs text-emerald-100/90 mt-0.5 leading-relaxed">
                Tidak ada hal yang perlu ditindaklanjuti saat ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. QUICK ACTIONS (4 Kolom Pastel Tiles Langsung di Canvas, Tanpa Outer Card) */}
      <div>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            href="/portal-ortu/tagihan"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-lime-50/90 p-2.5 text-center active:scale-95 transition hover:bg-lime-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-200/60 text-lime-900">
              <CreditCard className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-lime-950 tracking-tight leading-none">
              Bayar
            </span>
          </Link>

          <Link
            href="/portal-ortu/akun"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-cyan-50/90 p-2.5 text-center active:scale-95 transition hover:bg-cyan-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-200/60 text-cyan-900">
              <Wallet className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-cyan-950 tracking-tight leading-none">
              Uang Jajan
            </span>
          </Link>

          <Link
            href="/portal-ortu/aktivitas"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-emerald-50/90 p-2.5 text-center active:scale-95 transition hover:bg-emerald-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-200/60 text-emerald-900">
              <CalendarCheck className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-emerald-950 tracking-tight leading-none">
              Aktivitas
            </span>
          </Link>

          <Link
            href="/portal-ortu/riwayat"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-orange-50/90 p-2.5 text-center active:scale-95 transition hover:bg-orange-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-200/60 text-orange-900">
              <ClockCounterClockwise className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-orange-950 tracking-tight leading-none">
              Riwayat
            </span>
          </Link>
        </div>
      </div>

      {/* 4. KONDISI ANAK (FLAT LIST, Tanpa Outer Card Pembungkus) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-sm font-bold text-slate-900">
            Kondisi anak
          </h2>
          <Link
            href="/portal-ortu/aktivitas"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
          >
            <span>Lihat semua</span>
            <CaretRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          <Link
            href="/portal-ortu/aktivitas"
            className="flex items-center justify-between py-3.5 group active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CalendarCheck className="w-5 h-5" weight="duotone" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  Pengajian hari ini
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {absen.totalSesi > 0
                    ? `Hadir ${absen.hadir} dari ${absen.totalSesi} sesi`
                    : 'Belum ada jadwal sesi aktif'}
                </p>
              </div>
            </div>
            <CaretRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition shrink-0" />
          </Link>

          <Link
            href="/portal-ortu/aktivitas"
            className="flex items-center justify-between py-3.5 group active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  totalPoin > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <ShieldCheck className="w-5 h-5" weight="duotone" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  Kedisiplinan
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {pelanggaran.length === 0
                    ? 'Tidak ada catatan'
                    : `${totalPoin} poin pelanggaran tercatat`}
                </p>
              </div>
            </div>
            <CaretRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition shrink-0" />
          </Link>
        </div>
      </div>

      {/* 5. UANG JAJAN (Feature Card dengan Identitas Visual Soft Aqua/Turquoise) */}
      {billing && (
        <div className="rounded-[22px] bg-gradient-to-br from-cyan-50/90 via-teal-50/70 to-cyan-50/80 p-5 text-cyan-950 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-100/80 text-cyan-800 flex items-center justify-center">
                <Wallet className="w-4 h-4" weight="duotone" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-900/80">
                Uang Jajan
              </span>
            </div>
            <Link
              href="/portal-ortu/akun"
              className="text-xs font-bold text-cyan-800 hover:text-cyan-950 inline-flex items-center gap-0.5 active:scale-95 transition"
            >
              <span>Atur limit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-1">
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-950">
              {formatRupiah(billing.wallet.balance)}
            </p>
            <p className="text-xs font-medium text-cyan-800/80">
              Saldo tersedia di loket
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-cyan-200/50 flex items-center justify-between text-xs text-cyan-900/90">
            <span className="font-medium">Limit hari ini</span>
            <span className="font-bold font-mono text-cyan-950">
              {formatRupiah(billing.wallet.effectiveDailyLimit)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
