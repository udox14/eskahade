import Link from 'next/link'
import {
  CalendarCheck, CaretRight, Clock, Receipt, ShieldWarning, Sparkle, XCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import { syncPortalSppBills, syncPortalNonSppBills, getPortalOpenBills } from '@/lib/finance/portal-bills-sync'
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

  await Promise.all([
    syncPortalSppBills(session.santri_id, tampilkanSpp),
    syncPortalNonSppBills(session.santri_id),
  ])

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
  // pelanggaran (kartu ringkasan) sengaja all-time; banner "bersih" di bawah
  // harus dihitung khusus bulan berjalan supaya klaim "bulan ini" akurat.
  const pelanggaranBulanIni = pelanggaran.filter(p => p.tanggal >= start && p.tanggal <= end)

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden bg-[var(--p-ink)] px-6 pt-10 pb-20 rounded-b-[var(--p-radius-lg)]">
        <div className="absolute top-0 left-6 right-6 h-[3px] bg-[var(--p-red)]" />
        <div className="relative portal-rise flex items-center gap-4">
          <div className="w-14 h-14 rounded-[var(--p-radius-md)] overflow-hidden bg-white/10 border border-white/15 shrink-0">
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
            <p className="mt-0.5 text-xs text-white/65">
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
          className="portal-rise portal-rise-1 portal-card block p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--p-muted)]">
                Total Tagihan Berjalan
              </p>
              <p className="portal-display mt-1 text-[1.75rem] leading-none text-[var(--p-ink)]">
                {formatRupiah(totalTagihan)}
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-[var(--p-radius-sm)] bg-[var(--p-red)] px-3 py-1.5 text-[11px] font-bold text-white">
              Bayar <CaretRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-[var(--p-line)] rounded-[var(--p-radius-md)] border border-[var(--p-line)] overflow-hidden">
            <div className="px-3.5 py-3">
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

        {/* Banner pengajuan pending */}
        {pendingCount > 0 && (
          <Link
            href="/portal-ortu/riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 rounded-[var(--p-radius-md)] border-l-4 border-[var(--p-warning)] bg-[var(--p-warning-soft)] px-4 py-3.5"
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
            href="/portal-ortu/riwayat"
            className="portal-rise portal-rise-2 flex items-center gap-3 rounded-[var(--p-radius-md)] border-l-4 border-[var(--p-red)] bg-[var(--p-danger-soft)] px-4 py-3.5"
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

        {/* Ringkasan bulan ini */}
        <div className="portal-rise portal-rise-3 grid grid-cols-2 gap-3">
          <Link
            href="/portal-ortu/absensi"
            className="rounded-[var(--p-radius-lg)] bg-[var(--p-ink)] p-4 text-white"
          >
            <CalendarCheck className="w-5 h-5 opacity-80" />
            <p className="portal-display mt-3 text-2xl leading-none">
              {absen.totalSesi > 0 ? `${absen.hadir}/${absen.totalSesi}` : '—'}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-white/70">
              Kehadiran pengajian bulan ini
            </p>
            <p className="mt-1.5 text-[9.5px] font-medium text-white/70 bg-white/10 w-fit px-2 py-0.5 rounded-full">
              Update: Selasa malam
            </p>
            {(absen.alfa > 0 || absen.izin > 0 || absen.sakit > 0) && (
              <p className="mt-1 text-[10px] text-white/60">
                {absen.alfa > 0 ? `${absen.alfa} alfa ` : ''}
                {absen.sakit > 0 ? `${absen.sakit} sakit ` : ''}
                {absen.izin > 0 ? `${absen.izin} izin` : ''}
              </p>
            )}
          </Link>
          <Link
            href="/portal-ortu/pelanggaran"
            className="portal-card p-4"
          >
            <ShieldWarning className="w-5 h-5 text-[var(--p-red)]" />
            <p className="portal-display mt-3 text-2xl leading-none text-[var(--p-ink)]">{totalPoin}</p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--p-muted)]">
              Poin pelanggaran ({pelanggaran.length} catatan)
            </p>
          </Link>
        </div>

        {/* Pintasan riwayat */}
        <Link
          href="/portal-ortu/riwayat"
          className="portal-rise portal-rise-4 portal-card flex items-center gap-3 px-5 py-4"
        >
          <span className="flex w-10 h-10 items-center justify-center rounded-[var(--p-radius-md)] bg-[var(--p-paper)] border border-[var(--p-line)]">
            <Receipt className="w-5 h-5 text-[var(--p-ink)]" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--p-ink)]">Riwayat Pengajuan</p>
            <p className="text-[11px] text-[var(--p-muted)]">Status pembayaran transfer &amp; QRIS Anda</p>
          </div>
          <CaretRight className="w-4 h-4 text-[var(--p-muted)]" />
        </Link>

        {pelanggaranBulanIni.length === 0 && absen.alfa === 0 && (
          <div className="flex items-center gap-2.5 rounded-[var(--p-radius-md)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-4 py-3">
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
