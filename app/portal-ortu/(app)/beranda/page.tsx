import Link from 'next/link'
import {
  CalendarCheck,
  ShieldCheck,
  CreditCard,
  ClockCounterClockwise,
  CaretRight,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import {
  getPelanggaranAnak,
  getRekapAbsensiAnak,
} from '@/lib/portal/data'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { formatRupiah, namaBulanId } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'
import { VaCopyButton } from './_va-copy-button'
import { BerandaWalletCard } from './_beranda-wallet-card'

export const dynamic = 'force-dynamic'

function monthRange() {
  const [y, m] = toWibDateInputValue().split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, year: y, month: m }
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
  const { start, end, year, month } = monthRange()

  const [absen, pelanggaran, billing] = await Promise.all([
    getRekapAbsensiAnak(session.santri_id, start, end),
    getPelanggaranAnak(session.santri_id),
    getPortalStudentBilling(session.santri_id).catch(() => null),
  ])

  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const currentMonthName = namaBulanId(month)
  const currentPeriodLabel = `Bulan ${currentMonthName} ${year}`

  // Evaluasi finansial
  const tagihanRemaining = billing?.obligations.totalRemaining ?? 0
  const usppRemaining = billing?.obligations.uspp?.remaining ?? 0
  const pendingOrders = billing?.pendingOrders ?? []
  const hasPendingOrder = pendingOrders.length > 0
  const hasRoutineBills = tagihanRemaining > 0
  const hasUsppBills = usppRemaining > 0
  const hasUnpaidBills = hasRoutineBills || hasUsppBills

  const unpaidCount =
    (billing?.obligations.past.length ?? 0) +
    (billing?.obligations.current.length ?? 0) +
    (billing?.obligations.annual.length ?? 0)

  const greeting = getGreeting()

  return (
    <div className="px-5 space-y-4 pb-20 pt-1">
      {/* 1. TOP AREA: COMPACT GREETING & IDENTITAS SANTRI */}
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

      {/* 2. HERO UTAMA: SALDO UANG JAJAN SANTRI (INTERAKTIF DENGAN DRAWER TOP-UP & LIMIT LANGSUNG DARI BERANDA) */}
      <BerandaWalletCard
        santriId={session.santri_id}
        balance={billing?.wallet.balance ?? 0}
        effectiveDailyLimit={billing?.wallet.effectiveDailyLimit ?? 0}
        parentLimits={{
          parentDailyLimit: billing?.wallet.parentDailyLimit ?? null,
          parentWeeklyLimit: billing?.wallet.parentWeeklyLimit ?? null,
          parentMonthlyLimit: billing?.wallet.parentMonthlyLimit ?? null,
          globalDailyLimit: billing?.wallet.globalDailyLimit ?? 100000,
        }}
        gatewayInfo={billing?.gatewayInfo ?? null}
        fixedVa={billing?.fixedVa ?? null}
      />

      {/* 3. TOMBOL SHORTCUT DI BAWAH HERO (Format Pastel Tiles, Aksi Spesifik Non-Navbar) */}
      <div>
        <div className="grid grid-cols-4 gap-2.5">
          {/* Shortcut 1: Presensi Pengajian */}
          <Link
            href="/portal-ortu/absensi"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-emerald-50/90 p-2.5 text-center active:scale-95 transition hover:bg-emerald-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-200/60 text-emerald-900">
              <CalendarCheck className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-emerald-950 tracking-tight leading-none">
              Presensi
            </span>
          </Link>

          {/* Shortcut 2: Kedisiplinan / Poin Pelanggaran */}
          <Link
            href="/portal-ortu/pelanggaran"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-blue-50/90 p-2.5 text-center active:scale-95 transition hover:bg-blue-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-200/60 text-blue-900">
              <ShieldCheck className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-blue-950 tracking-tight leading-none">
              Kedisiplinan
            </span>
          </Link>

          {/* Shortcut 3: Cicilan USPP (Uang Gedung) */}
          <Link
            href="/portal-ortu/tagihan"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-amber-50/90 p-2.5 text-center active:scale-95 transition hover:bg-amber-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200/60 text-amber-900">
              <CreditCard className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-amber-950 tracking-tight leading-none">
              Cicil USPP
            </span>
          </Link>

          {/* Shortcut 4: Kuitansi Resmi / Bukti Bayar */}
          <Link
            href="/portal-ortu/riwayat"
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] bg-teal-50/90 p-2.5 text-center active:scale-95 transition hover:bg-teal-100/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-200/60 text-teal-900">
              <ClockCounterClockwise className="w-5 h-5" weight="duotone" />
            </div>
            <span className="text-[11px] font-bold text-teal-950 tracking-tight leading-none">
              Kuitansi
            </span>
          </Link>
        </div>
      </div>

      {/* 4. STATUS TAGIHAN PESANTREN (Two-Tone Split Card: Bagian Bawah Putih Solid) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-sm font-bold text-slate-900">
            Tagihan pesantren
          </h2>
          <Link
            href="/portal-ortu/tagihan"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
          >
            <span>Rincian & riwayat</span>
            <CaretRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!billing ? (
          <div className="rounded-[18px] bg-slate-50 border border-slate-200/80 p-4 space-y-1 text-slate-600">
            <p className="text-xs font-semibold text-slate-800">Informasi Tagihan Belum Dapat Dimuat</p>
            <p className="text-[11px] text-slate-500">Tarik ke bawah atau muat ulang halaman untuk memeriksa status tagihan santri.</p>
          </div>
        ) : hasPendingOrder ? (
          /* KONDISI: MENUNGGU PEMBAYARAN VA (AMBER + DOCK BAWAH PUTIH) */
          <div className="rounded-[18px] border border-amber-200/90 overflow-hidden shadow-2xs relative">
            {/* Corner Ribbon Flush Sudut Kanan Atas */}
            <div className="absolute top-0 right-0 bg-amber-600 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Menunggu Bayar
            </div>

            {(() => {
              const po = pendingOrders[0]
              const vaNumber = billing.fixedVa?.vaNumber || po.orderNumber
              const bankLabel = billing.fixedVa?.bankCode ? `Virtual Account ${billing.fixedVa.bankCode}` : 'Virtual Account'

              return (
                <>
                  <div className="bg-amber-50/90 p-4 space-y-1.5">
                    <div className="min-w-0 pr-28">
                      <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
                        <span>{bankLabel}</span>
                        <span>·</span>
                        <span className="text-slate-500 font-normal">Batas aktif</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black font-mono tracking-wider text-slate-950 mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar py-0.5">
                        {vaNumber}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Total transfer tepat: <strong className="font-mono text-slate-900">{formatRupiah(po.totalCharged)}</strong>
                    </p>
                  </div>

                  <div className="bg-white border-t border-amber-200/80 px-4 py-3 flex items-center justify-between gap-2">
                    <VaCopyButton vaNumber={vaNumber} />
                    <Link
                      href="/portal-ortu/tagihan"
                      className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 text-xs font-semibold active:scale-95 transition shrink-0"
                    >
                      Petunjuk
                    </Link>
                  </div>
                </>
              )
            })()}
          </div>
        ) : hasUnpaidBills ? (
          /* KONDISI: ADA TAGIHAN (MERAH MURNI + DOCK BAWAH PUTIH) */
          <div className="rounded-[18px] border border-red-200/90 overflow-hidden shadow-2xs relative">
            {/* Corner Ribbon Flush Sudut Kanan Atas */}
            <div className="absolute top-0 right-0 bg-red-600 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Belum Lunas
            </div>

            <div className="bg-red-50/90 p-4 space-y-1.5">
              <div className="pr-24">
                <p className="text-xs text-red-700 font-bold">{currentPeriodLabel}</p>
                <p className="text-2xl font-black font-mono text-slate-950 mt-0.5">
                  {formatRupiah(hasRoutineBills ? tagihanRemaining : usppRemaining)}
                </p>
              </div>
              <p className="text-[11px] text-slate-600">
                {hasRoutineBills
                  ? `${unpaidCount} tagihan belum dibayar`
                  : 'Sisa uang bangunan santri (dapat dicicil berkala)'}
              </p>
            </div>

            <div className="bg-white border-t border-red-200/80 px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">
                {hasUsppBills ? (
                  <>Sisa USPP: <strong className="font-mono text-slate-900">{formatRupiah(usppRemaining)}</strong></>
                ) : (
                  <span>Status: Perlu Diselesaikan</span>
                )}
              </span>
              <Link
                href="/portal-ortu/tagihan"
                className="rounded-xl bg-red-600 hover:bg-red-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs active:scale-95 transition"
              >
                Bayar sekarang &rarr;
              </Link>
            </div>
          </div>
        ) : (
          /* KONDISI: TAGIHAN LUNAS (EMERALD + DOCK BAWAH PUTIH) */
          <div className="rounded-[18px] border border-emerald-200/90 overflow-hidden shadow-2xs relative">
            {/* Corner Ribbon Flush Sudut Kanan Atas */}
            <div className="absolute top-0 right-0 bg-emerald-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Lunas
            </div>

            <div className="bg-emerald-50/90 p-4 space-y-1.5">
              <div className="pr-20">
                <p className="text-xs text-emerald-800 font-bold">{currentPeriodLabel}</p>
                <p className="text-2xl font-black font-mono text-emerald-800 mt-0.5">
                  Lunas
                </p>
              </div>
              <p className="text-[11px] text-slate-600">
                Seluruh tagihan rutin bulan ini telah diselesaikan
              </p>
            </div>

            <div className="bg-white border-t border-emerald-200/80 px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">
                {hasUsppBills ? (
                  <>Sisa USPP: <strong className="font-mono text-slate-900">{formatRupiah(usppRemaining)}</strong></>
                ) : (
                  <span>Semua kewajiban beres</span>
                )}
              </span>
              <Link
                href="/portal-ortu/riwayat"
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs active:scale-95 transition"
              >
                Bukti bayar &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 5. KONDISI ANAK (LIST RAPI, TANPA TULISAN "BUKU AKTIVITAS") */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-sm font-bold text-slate-900">
            Kondisi anak
          </h2>
        </div>

        <div className="divide-y divide-slate-100 bg-white rounded-[18px] border border-slate-200/80 px-4 shadow-2xs">
          {/* Baris 1: Presensi Pengajian */}
          <Link
            href="/portal-ortu/absensi"
            className="flex items-center justify-between py-3.5 group active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CalendarCheck className="w-5 h-5" weight="duotone" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Presensi pengajian bulan ini
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {absen.totalSesi > 0
                    ? `${absen.hadir} dari ${absen.totalSesi} sesi hadir${absen.alfa > 0 ? ` · ${absen.alfa} sesi alfa` : ''}`
                    : 'Belum ada jadwal sesi aktif'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {absen.totalSesi > 0 && (
                <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {Math.round((absen.hadir / absen.totalSesi) * 100)}%
                </span>
              )}
              <CaretRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
            </div>
          </Link>

          {/* Baris 2: Kedisiplinan & Asrama */}
          <Link
            href="/portal-ortu/pelanggaran"
            className="flex items-center justify-between py-3.5 group active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  totalPoin > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <ShieldCheck className="w-5 h-5" weight="duotone" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Kedisiplinan & asrama
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {pelanggaran.length === 0
                    ? 'Tertib · Tidak ada catatan pelanggaran'
                    : `${pelanggaran.length} catatan kedisiplinan tercatat`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  totalPoin > 0
                    ? 'text-rose-700 bg-rose-50 font-mono'
                    : 'text-slate-600 bg-slate-100 font-mono'
                }`}
              >
                {totalPoin} Poin
              </span>
              <CaretRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
