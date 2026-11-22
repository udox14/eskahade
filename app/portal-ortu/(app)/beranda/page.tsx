import { publicMediaUrl } from '@/lib/r2/references'
import React from 'react'
import Link from 'next/link'
import {
  CalendarCheck,
  ClockCounterClockwise,
  CreditCard,
  ShieldCheck,
  CaretRight,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import {
  getRekapAbsensiAnak,
  getPelanggaranAnak,
  getTotalPelanggaranAnak,
} from '@/lib/portal/data'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { formatRupiah } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'
import { BerandaWalletCard } from './_beranda-wallet-card'
import { VaCopyButton } from './_va-copy-button'

export const dynamic = 'force-dynamic'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 3 && hour < 11) return 'Selamat pagi,'
  if (hour >= 11 && hour < 15) return 'Selamat siang,'
  if (hour >= 15 && hour < 18) return 'Selamat sore,'
  return 'Selamat malam,'
}

export default async function PortalBerandaPage() {
  const session = await requirePortalSessionStrict()

  const todayStr = toWibDateInputValue()
  const currentYear = Number(todayStr.slice(0, 4))
  const currentMonth = Number(todayStr.slice(5, 7))

  const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
  const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [billing, absen, pelanggaran, disiplin] = await Promise.all([
    getPortalStudentBilling(session.santri_id),
    getRekapAbsensiAnak(session.santri_id, start, end),
    getPelanggaranAnak(session.santri_id),
    getTotalPelanggaranAnak(session.santri_id),
  ])



  const pendingOrders = billing?.pendingOrders ?? []
  const hasPendingOrder = pendingOrders.length > 0
  const currentPeriodLabel =
    billing?.obligations.current[0]?.periodLabel
      ? billing.obligations.current[0].periodLabel.replace(/^Bulan\s+/i, '').trim()
      : 'Bulan Ini'

  const hasRoutineBills = (billing?.obligations.current.length ?? 0) > 0 || (billing?.obligations.past.length ?? 0) > 0
  const hasUsppBills = (billing?.obligations.uspp?.remaining ?? 0) > 0
  const tagihanRemaining = billing?.obligations.totalRemaining ?? 0
  const usppRemaining = billing?.obligations.uspp?.remaining ?? 0
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
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 tracking-tight">
            {greeting}
          </p>
          <h1 className="text-base font-bold text-slate-950 dark:text-slate-100 truncate mt-0.5 leading-snug">
            {session.nama}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            NIS {session.nis}
            {session.asrama ? ` · Asrama ${session.asrama}` : ''}
            {session.kamar ? ` (${session.kamar})` : ''}
          </p>
        </div>
        <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
          {publicMediaUrl(session.foto_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicMediaUrl(session.foto_url)} alt={session.nama} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-sm">
              {session.nama.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* 2. HERO UTAMA: SALDO UANG JAJAN SANTRI */}
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
        paymentChannels={billing?.paymentChannels ?? null}
        transferInReview={(billing?.transfers ?? []).some(t => t.status === 'MENUNGGU_VERIFIKASI' || t.status === 'PERLU_PERBAIKAN')}
      />

      {/* 3. TOMBOL SHORTCUT DI BAWAH HERO */}
      <div>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { href: '/portal-ortu/absensi', label: 'Presensi', Icon: CalendarCheck,
              card: 'bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50',
              chip: 'bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300',
              text: 'text-emerald-950 dark:text-emerald-200' },
            { href: '/portal-ortu/pelanggaran', label: 'Kedisiplinan', Icon: ShieldCheck,
              card: 'bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50',
              chip: 'bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300',
              text: 'text-blue-950 dark:text-blue-200' },
            { href: '/portal-ortu/tagihan', label: 'Cicil USPP', Icon: CreditCard,
              card: 'bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/50',
              chip: 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300',
              text: 'text-amber-950 dark:text-amber-200' },
            { href: '/portal-ortu/riwayat', label: 'Kuitansi', Icon: ClockCounterClockwise,
              card: 'bg-teal-50/90 dark:bg-teal-950/40 hover:bg-teal-100/70 dark:hover:bg-teal-900/50',
              chip: 'bg-teal-200/60 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300',
              text: 'text-teal-950 dark:text-teal-200' },
          ].map(({ href, label, Icon, card, chip, text }) => (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] border border-slate-200/60 dark:border-white/5 p-2.5 text-center active:scale-95 transition ${card}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${chip}`}>
                <Icon className="w-5 h-5" weight="duotone" />
              </div>
              <span className={`text-[11px] font-bold tracking-tight leading-none ${text}`}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. STATUS TAGIHAN PESANTREN */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Tagihan pesantren
          </h2>
          <Link
            href="/portal-ortu/tagihan"
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-0.5"
          >
            <span>Rincian & riwayat</span>
            <CaretRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(() => {
          const open = (billing?.transfers ?? []).find(t => t.status === 'MENUNGGU_VERIFIKASI' || t.status === 'PERLU_PERBAIKAN' ||
            (t.status === 'MENUNGGU_BUKTI' && new Date(t.expiresAt).getTime() > Date.now()))
          if (!open) return null
          const label = open.status === 'MENUNGGU_VERIFIKASI' ? 'Sedang dicek petugas'
            : open.status === 'PERLU_PERBAIKAN' ? 'Perlu unggah ulang bukti' : 'Menunggu bukti transfer'
          return (
            <Link href="/portal-ortu/tagihan" className="flex items-center justify-between gap-3 rounded-[18px] border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 p-4">
              <span className="min-w-0">
                <span className="block text-xs font-bold text-amber-900 dark:text-amber-300">Transfer · {label}</span>
                <span className="block font-mono text-lg font-black text-slate-950 dark:text-white">{formatRupiah(open.expectedAmount)}</span>
              </span>
              <CaretRight className="w-4 h-4 text-amber-700 shrink-0" />
            </Link>
          )
        })()}

        {!billing ? (
          <div className="rounded-[18px] bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 space-y-1 text-slate-600 dark:text-slate-400">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Informasi Tagihan Belum Dapat Dimuat</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tarik ke bawah atau muat ulang halaman untuk memeriksa status tagihan santri.</p>
          </div>
        ) : hasPendingOrder ? (
          /* KONDISI: MENUNGGU PEMBAYARAN VA */
          <div className="rounded-[18px] border border-amber-200/90 dark:border-amber-800/60 overflow-hidden shadow-2xs relative">
            <div className="absolute top-0 right-0 bg-amber-600 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Menunggu Bayar
            </div>

            {(() => {
              const po = pendingOrders[0]
              const vaNumber = billing.fixedVa?.vaNumber || 'Nomor VA belum tersedia'
              const bankLabel = billing.fixedVa?.bankCode ? `Virtual Account ${billing.fixedVa.bankCode}` : 'Virtual Account'

              return (
                <>
                  <div className="bg-amber-50/90 dark:bg-amber-950/40 p-4 space-y-1.5">
                    <div className="min-w-0 pr-28">
                      <div className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-300 font-bold">
                        <span>{bankLabel}</span>
                        <span>·</span>
                        <span className="text-slate-500 dark:text-slate-400 font-normal">Batas aktif</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black font-mono tracking-wider text-slate-950 dark:text-white mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar py-0.5">
                        {vaNumber}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Total transfer tepat: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatRupiah(po.totalCharged)}</strong>
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border-t border-amber-200/80 dark:border-amber-800/60 px-4 py-3 flex items-center justify-between gap-2">
                    <VaCopyButton vaNumber={vaNumber} />
                    <Link
                      href="/portal-ortu/tagihan"
                      className="rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-semibold active:scale-95 transition shrink-0"
                    >
                      Petunjuk
                    </Link>
                  </div>
                </>
              )
            })()}
          </div>
        ) : hasUnpaidBills ? (
          /* KONDISI: ADA TAGIHAN */
          <div className="rounded-[18px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {hasRoutineBills ? 'Total belum dibayar' : 'Sisa uang bangunan'}
                </p>
                <p className="text-3xl font-black font-mono tracking-tight text-slate-950 dark:text-white mt-1">
                  {formatRupiah(hasRoutineBills ? tagihanRemaining : usppRemaining)}
                </p>
              </div>
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/60 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Belum lunas
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 -mt-1.5">
              {hasRoutineBills
                ? `${unpaidCount} tagihan • ${currentPeriodLabel}`
                : 'Dapat dicicil berkala'}
              {hasRoutineBills && hasUsppBills && (
                <>
                  {' · '}Sisa USPP{' '}
                  <strong className="font-mono font-semibold text-slate-800 dark:text-slate-200">{formatRupiah(usppRemaining)}</strong>
                </>
              )}
            </p>

            <Link
              href="/portal-ortu/tagihan"
              className="flex w-full min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] px-4 py-2.5 text-sm font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition"
            >
              Bayar sekarang
              <CaretRight className="w-4 h-4" weight="bold" />
            </Link>
          </div>
        ) : (
          /* KONDISI: TAGIHAN LUNAS */
          <div className="rounded-[18px] border border-emerald-200/90 dark:border-emerald-800/60 overflow-hidden shadow-2xs relative">
            <div className="absolute top-0 right-0 bg-emerald-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Lunas
            </div>

            <div className="bg-emerald-50/90 dark:bg-emerald-950/40 p-4 space-y-1.5">
              <div className="pr-20">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">{currentPeriodLabel}</p>
                <p className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-0.5">
                  Lunas
                </p>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Seluruh tagihan rutin bulan ini telah diselesaikan
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border-t border-emerald-200/80 dark:border-emerald-800/60 px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {hasUsppBills ? (
                  <>Sisa USPP: <strong className="font-mono text-slate-900 dark:text-slate-200">{formatRupiah(usppRemaining)}</strong></>
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

      {/* 5. KONDISI ANAK */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Kondisi anak
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Baris 1: Presensi Pengajian */}
          <Link
            href="/portal-ortu/absensi"
            className="flex items-center gap-3.5 px-5 py-4 group active:bg-slate-50 dark:active:bg-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-100 dark:ring-emerald-900/60">
              <CalendarCheck className="w-5 h-5" weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                Presensi pengajian
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {absen.totalSesi > 0
                  ? `${absen.hadir} dari ${absen.totalSesi} sesi hadir bulan ini${absen.alfa > 0 ? ` · ${absen.alfa} alfa` : ''}`
                  : 'Belum ada jadwal sesi bulan ini'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {absen.totalSesi > 0 && (
                <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                  {Math.round((absen.hadir / absen.totalSesi) * 100)}%
                </span>
              )}
              <CaretRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition" weight="bold" />
            </div>
          </Link>

          {/* Baris 2: Kedisiplinan & Asrama */}
          <Link
            href="/portal-ortu/pelanggaran"
            className="flex items-center gap-3.5 px-5 py-4 group active:bg-slate-50 dark:active:bg-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                disiplin.jumlah > 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 ring-rose-100 dark:ring-rose-900/60'
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 ring-blue-100 dark:ring-blue-900/60'
              }`}
            >
              <ShieldCheck className="w-5 h-5" weight="duotone" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                Kedisiplinan & asrama
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {pelanggaran.length === 0
                  ? 'Tidak ada catatan pelanggaran'
                  : disiplin.pending
                  ? `${disiplin.pending} catatan perlu verifikasi`
                  : 'Ada catatan yang perlu diperhatikan'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  disiplin.jumlah > 0
                    ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60'
                    : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                }`}
              >
                {disiplin.jumlah > 0 ? `${disiplin.jumlah} kejadian` : 'Tertib'}
              </span>
              <CaretRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition" weight="bold" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
