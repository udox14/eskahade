import Link from 'next/link'
import {
  CalendarCheck, CaretRight, Clock, Receipt, ShieldWarning, Sparkle, XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getTunggakanSppSantri } from '@/lib/spp/tunggakan'
import { getNonSppOutstandingSantri } from '@/lib/keuangan/non-spp-outstanding'
import {
  getLatestRejectedSubmission, getPelanggaranAnak, getPendingSubmission, getRekapAbsensiAnak,
} from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { formatRupiah } from '@/lib/portal/format'

export const dynamic = 'force-dynamic'

function monthRange(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default async function BerandaPage() {
  const session = await requirePortalSessionStrict()
  const tampilkanSpp = !session.bebas_spp && !isAsramaTanpaKamar(session.asrama)
  const { start, end } = monthRange()

  const [spp, nonSpp, absen, pelanggaran, pendingSpp, pendingNonSpp, rejectedSpp, rejectedNonSpp] =
    await Promise.all([
      tampilkanSpp ? getTunggakanSppSantri(session.santri_id) : Promise.resolve(null),
      getNonSppOutstandingSantri(session.santri_id),
      getRekapAbsensiAnak(session.santri_id, start, end),
      getPelanggaranAnak(session.santri_id),
      getPendingSubmission(session.santri_id, 'SPP'),
      getPendingSubmission(session.santri_id, 'NON_SPP'),
      getLatestRejectedSubmission(session.santri_id, 'SPP'),
      getLatestRejectedSubmission(session.santri_id, 'NON_SPP'),
    ])

  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const totalTagihan = (spp?.total ?? 0) + (nonSpp?.totalSisa ?? 0)
  const pendingCount = (pendingSpp ? 1 : 0) + (pendingNonSpp ? 1 : 0)
  const rejected = rejectedSpp || rejectedNonSpp

  return (
    <div>
      {/* Hero */}
      <div className="portal-pattern relative overflow-hidden bg-[var(--p-emerald-deep)] px-6 pt-10 pb-20 rounded-b-[2.25rem]">
        <div className="absolute -top-20 -right-14 w-52 h-52 rounded-full bg-[var(--p-emerald)] opacity-60 blur-2xl" />
        <div className="relative portal-rise flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 border border-white/15 shrink-0">
            {session.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.foto_url} alt={session.nama} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center portal-display text-xl text-white/80">
                {session.nama.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-emerald-200/80">
              Assalamu&rsquo;alaikum, Wali dari
            </p>
            <h1 className="portal-display mt-0.5 text-2xl leading-tight text-white truncate">
              {session.nama}
            </h1>
            <p className="mt-0.5 text-xs text-emerald-100/80">
              NIS {session.nis}
              {session.asrama ? ` • ${session.asrama}` : ''}
              {session.kamar ? ` • Kamar ${session.kamar}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-10 space-y-4">
        {/* Kartu total tagihan */}
        <Link
          href="/portal-ortu/tagihan"
          className="portal-rise portal-rise-1 block rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-[0_18px_40px_-18px_rgba(11,94,63,0.3)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--p-muted)]">
                Total Tagihan Berjalan
              </p>
              <p className="portal-display mt-1 text-[1.75rem] leading-none text-[var(--p-emerald-deep)]">
                {formatRupiah(totalTagihan)}
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-[var(--p-gold-soft)] px-3 py-1.5 text-[11px] font-bold text-[#7a5a17]">
              Bayar <CaretRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--p-cream)] px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">SPP Bulanan</p>
              <p className="mt-0.5 text-sm font-extrabold text-[var(--p-ink)]">
                {tampilkanSpp ? formatRupiah(spp?.total ?? 0) : 'Bebas SPP'}
              </p>
              {tampilkanSpp && (spp?.totalBulan ?? 0) > 0 && (
                <p className="text-[10px] text-[var(--p-muted)]">{spp!.totalBulan} bulan belum dibayar</p>
              )}
            </div>
            <div className="rounded-2xl bg-[var(--p-cream)] px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Non-SPP</p>
              <p className="mt-0.5 text-sm font-extrabold text-[var(--p-ink)]">
                {formatRupiah(nonSpp?.totalSisa ?? 0)}
              </p>
              <p className="text-[10px] text-[var(--p-muted)]">Bangunan, kesehatan, dst.</p>
            </div>
          </div>
        </Link>

        {/* Banner pengajuan pending */}
        {pendingCount > 0 && (
          <Link
            href="/portal-ortu/riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-xs leading-relaxed text-amber-800">
              <span className="font-bold">{pendingCount} pengajuan pembayaran</span> sedang menunggu
              pemeriksaan bukti oleh petugas.
            </p>
            <CaretRight className="w-4 h-4 text-amber-500" />
          </Link>
        )}

        {/* Banner pengajuan ditolak */}
        {rejected && (
          <Link
            href="/portal-ortu/riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3.5"
          >
            <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <p className="flex-1 text-xs leading-relaxed text-rose-800">
              <span className="font-bold">Ada pengajuan yang ditolak.</span>{' '}
              {rejected.reject_reason ? `Alasan: ${rejected.reject_reason}. ` : ''}Buka riwayat untuk
              upload ulang bukti.
            </p>
            <CaretRight className="w-4 h-4 text-rose-500" />
          </Link>
        )}

        {/* Ringkasan bulan ini */}
        <div className="portal-rise portal-rise-3 grid grid-cols-2 gap-3">
          <Link
            href="/portal-ortu/absensi"
            className="rounded-3xl bg-[var(--p-emerald)] p-4 text-white shadow-lg shadow-emerald-900/15"
          >
            <CalendarCheck className="w-5 h-5 opacity-80" />
            <p className="portal-display mt-3 text-2xl leading-none">
              {absen.totalSesi > 0 ? `${absen.hadir}/${absen.totalSesi}` : '—'}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-emerald-100/90">
              Kehadiran pengajian bulan ini
            </p>
            {(absen.alfa > 0 || absen.izin > 0 || absen.sakit > 0) && (
              <p className="mt-1 text-[10px] text-emerald-100/70">
                {absen.alfa > 0 ? `${absen.alfa} alfa ` : ''}
                {absen.sakit > 0 ? `${absen.sakit} sakit ` : ''}
                {absen.izin > 0 ? `${absen.izin} izin` : ''}
              </p>
            )}
          </Link>
          <Link
            href="/portal-ortu/pelanggaran"
            className="rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-4 shadow-sm"
          >
            <ShieldWarning className="w-5 h-5 text-[var(--p-gold)]" />
            <p className="portal-display mt-3 text-2xl leading-none text-[var(--p-ink)]">{totalPoin}</p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--p-muted)]">
              Poin pelanggaran ({pelanggaran.length} catatan)
            </p>
          </Link>
        </div>

        {/* Pintasan riwayat */}
        <Link
          href="/portal-ortu/riwayat"
          className="portal-rise portal-rise-4 flex items-center gap-3 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] px-5 py-4 shadow-sm"
        >
          <span className="flex w-10 h-10 items-center justify-center rounded-2xl bg-[var(--p-gold-soft)]">
            <Receipt className="w-5 h-5 text-[var(--p-gold)]" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--p-ink)]">Riwayat Pengajuan</p>
            <p className="text-[11px] text-[var(--p-muted)]">Status pembayaran transfer &amp; QRIS Anda</p>
          </div>
          <CaretRight className="w-4 h-4 text-[var(--p-muted)]" />
        </Link>

        {pelanggaran.length === 0 && absen.alfa === 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <Sparkle className="w-4 h-4 text-[var(--p-emerald)]" />
            <p className="text-xs font-semibold text-emerald-800">
              Alhamdulillah, tidak ada catatan pelanggaran maupun alfa bulan ini.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
