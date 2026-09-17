import Link from 'next/link'
import {
  CalendarCheck, CaretRight, Clock, Receipt, ShieldWarning, Sparkle, XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalOpenBills } from '@/lib/finance/cooperative/portal-summary'
import {
  getLatestRejectedSubmission, getPelanggaranAnak, getPendingSubmission, getRekapAbsensiAnak,
} from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { formatRupiah } from '@/lib/portal/format'
import { toWibDateInputValue } from '@/lib/date/wib'

export const dynamic = 'force-dynamic'

// "Bulan ini" harus mengikuti WIB, bukan waktu server — di dev lokal (WIB)
// new Date() polos bisa menyimpang dari tanggal WIB yang sebenarnya.
function monthRange() {
  const [y, m] = toWibDateInputValue().split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default async function BerandaPage() {
  const session = await requirePortalSessionStrict()
  const tampilkanSpp = !session.bebas_spp && !isAsramaTanpaKamar(session.asrama)
  const { start, end } = monthRange()

  const [sppBills, nonSppBills, absen, pelanggaran, pendingSpp, pendingNonSpp, rejectedSpp, rejectedNonSpp] =
    await Promise.all([
      tampilkanSpp ? getPortalOpenBills(session.santri_id, 'SPP') : Promise.resolve([]),
      getPortalOpenBills(session.santri_id, 'NON_SPP'),
      getRekapAbsensiAnak(session.santri_id, start, end),
      getPelanggaranAnak(session.santri_id),
      getPendingSubmission(session.santri_id, 'SPP'),
      getPendingSubmission(session.santri_id, 'NON_SPP'),
      getLatestRejectedSubmission(session.santri_id, 'SPP'),
      getLatestRejectedSubmission(session.santri_id, 'NON_SPP'),
    ])

  const totalSpp = sppBills.reduce((sum, bill) => sum + Number(bill.amount_rupiah), 0)
  const totalNonSpp = nonSppBills.reduce((sum, bill) => sum + Number(bill.amount_rupiah), 0)
  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
  const totalTagihan = totalSpp + totalNonSpp
  const pendingCount = (pendingSpp ? 1 : 0) + (pendingNonSpp ? 1 : 0)
  const rejected = rejectedSpp || rejectedNonSpp
  const persenHadir = absen.totalSesi > 0 ? Math.round((absen.hadir / absen.totalSesi) * 100) : null
  // pelanggaran (kartu ringkasan) sengaja all-time; banner "bersih" di bawah
  // harus dihitung khusus bulan berjalan supaya klaim "bulan ini" akurat.
  const pelanggaranBulanIni = pelanggaran.filter(p => p.tanggal >= start && p.tanggal <= end)

  return (
    <div>
      {/* Header identitas — siku, spine merah, kartu identitas sebaris (bukan hero blob) */}
      <div className="relative bg-[var(--p-ink)] pl-7 pr-6 pt-10 pb-6 border-l-4 border-[var(--p-red)]">
        <div className="relative portal-rise flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 overflow-hidden bg-white/10 border border-white/15">
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
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-white/55">
              Assalamu&rsquo;alaikum, Wali dari
            </p>
            <h1 className="portal-display mt-0.5 text-2xl leading-tight text-white truncate">
              {session.nama}
            </h1>
          </div>
        </div>
        <div className="relative portal-rise mt-4 flex divide-x divide-white/15 border-t border-white/15 pt-3 text-[10px] text-white/60">
          <span className="pr-3 font-semibold">NIS {session.nis}</span>
          {session.asrama && <span className="px-3 font-semibold">{session.asrama}</span>}
          {session.kamar && <span className="pl-3 font-semibold">Kamar {session.kamar}</span>}
        </div>
      </div>

      {/* Strip total tagihan — full-bleed, angka besar, menyambung langsung dari header */}
      <Link
        href="/portal-ortu/keuangan?tab=tagihan"
        className="portal-rise portal-rise-1 block border-b border-[var(--p-line)] bg-[var(--p-white)] px-5 py-5"
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="portal-section-label">01 — Total Tagihan Berjalan</p>
            <p className="portal-display mt-2 text-[2.35rem] leading-none text-[var(--p-ink)]">
              {formatRupiah(totalTagihan)}
            </p>
          </div>
          <span className="flex items-center gap-1 shrink-0 bg-[var(--p-red)] px-3 py-2 text-[11px] font-bold text-white rounded-[var(--p-radius-sm)]">
            Bayar <CaretRight className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 border border-[var(--p-line)]">
          <div className="border-r border-[var(--p-line)] px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">SPP Bulanan</p>
            <p className="mt-0.5 text-sm font-extrabold text-[var(--p-ink)]">
              {tampilkanSpp ? formatRupiah(totalSpp) : 'Bebas SPP'}
            </p>
            {tampilkanSpp && sppBills.length > 0 && (
              <p className="text-[10px] text-[var(--p-muted)]">{sppBills.length} bulan belum dibayar</p>
            )}
          </div>
          <div className="px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Non-SPP</p>
            <p className="mt-0.5 text-sm font-extrabold text-[var(--p-ink)]">
              {formatRupiah(totalNonSpp)}
            </p>
            <p className="text-[10px] text-[var(--p-muted)]">Bangunan, kesehatan, dst.</p>
          </div>
        </div>
      </Link>

      <div className="px-5 pt-4 space-y-4">
        {/* Banner pengajuan pending */}
        {pendingCount > 0 && (
          <Link
            href="/portal-ortu/keuangan?tab=riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 border-l-4 border-[var(--p-warning)] bg-[var(--p-warning-soft)] px-4 py-3.5"
          >
            <Clock className="w-4 h-4 shrink-0 text-[var(--p-warning)]" />
            <p className="flex-1 text-xs leading-relaxed text-[var(--p-ink)]">
              <span className="font-bold">{pendingCount} pengajuan pembayaran</span> sedang menunggu
              pemeriksaan bukti oleh petugas.
            </p>
            <CaretRight className="w-4 h-4 text-[var(--p-warning)]" />
          </Link>
        )}

        {/* Banner pengajuan ditolak */}
        {rejected && (
          <Link
            href="/portal-ortu/keuangan?tab=riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 border-l-4 border-[var(--p-red)] bg-[var(--p-danger-soft)] px-4 py-3.5"
          >
            <XCircle className="w-4 h-4 shrink-0 text-[var(--p-red)]" />
            <p className="flex-1 text-xs leading-relaxed text-[var(--p-ink)]">
              <span className="font-bold">Ada pengajuan yang ditolak.</span>{' '}
              {rejected.reject_reason ? `Alasan: ${rejected.reject_reason}. ` : ''}Buka riwayat untuk
              upload ulang bukti.
            </p>
            <CaretRight className="w-4 h-4 text-[var(--p-red)]" />
          </Link>
        )}

        {/* Ringkasan bulan ini — grid dua kolom asimetris, angka raksasa */}
        <div>
          <p className="portal-section-label mb-3">02 — Ringkasan Bulan Ini</p>
          <div className="portal-rise portal-rise-3 grid grid-cols-2 border border-[var(--p-line)] divide-x divide-[var(--p-line)]">
            <Link href="/portal-ortu/absensi" className="p-4">
              <div className="flex items-center justify-between">
                <CalendarCheck className="w-4 h-4 text-[var(--p-ink)]" />
                <span className="portal-index text-[var(--p-muted)]">{persenHadir !== null ? `${persenHadir}%` : '—'}</span>
              </div>
              <p className="portal-display mt-3 text-3xl leading-none text-[var(--p-ink)]">
                {absen.totalSesi > 0 ? `${absen.hadir}/${absen.totalSesi}` : '—'}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-[var(--p-muted)]">
                Kehadiran pengajian
              </p>
              {(absen.alfa > 0 || absen.izin > 0 || absen.sakit > 0) ? (
                <p className="mt-1 text-[10px] text-[var(--p-red)] font-semibold">
                  {absen.alfa > 0 ? `${absen.alfa} alfa ` : ''}
                  {absen.sakit > 0 ? `${absen.sakit} sakit ` : ''}
                  {absen.izin > 0 ? `${absen.izin} izin` : ''}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-[var(--p-muted)]">Update Selasa malam</p>
              )}
            </Link>
            <Link href="/portal-ortu/pelanggaran" className="p-4">
              <div className="flex items-center justify-between">
                <ShieldWarning className="w-4 h-4 text-[var(--p-red)]" />
                <span className="portal-index text-[var(--p-muted)]">{pelanggaran.length}</span>
              </div>
              <p className="portal-display mt-3 text-3xl leading-none text-[var(--p-ink)]">{totalPoin}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-[var(--p-muted)]">
                Poin pelanggaran
              </p>
              <p className="mt-1 text-[10px] text-[var(--p-muted)]">{pelanggaran.length} catatan tercatat</p>
            </Link>
          </div>
        </div>

        {/* Pintasan riwayat */}
        <Link
          href="/portal-ortu/keuangan?tab=riwayat"
          className="portal-rise portal-rise-4 flex items-center gap-3 border border-[var(--p-line)] px-5 py-4"
        >
          <span className="flex w-9 h-9 items-center justify-center bg-[var(--p-paper)] border border-[var(--p-line)] shrink-0">
            <Receipt className="w-4.5 h-4.5 text-[var(--p-ink)]" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--p-ink)]">Riwayat Pengajuan</p>
            <p className="text-[11px] text-[var(--p-muted)]">Status pembayaran transfer &amp; QRIS Anda</p>
          </div>
          <CaretRight className="w-4 h-4 text-[var(--p-muted)]" />
        </Link>

        {pelanggaranBulanIni.length === 0 && absen.alfa === 0 && (
          <div className="flex items-center gap-2.5 border-l-4 border-[var(--p-success)] bg-[var(--p-success-soft)] px-4 py-3">
            <Sparkle className="w-4 h-4 text-[var(--p-success)]" />
            <p className="text-xs font-semibold text-[var(--p-success)]">
              Alhamdulillah, tidak ada catatan pelanggaran maupun alfa bulan ini.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
