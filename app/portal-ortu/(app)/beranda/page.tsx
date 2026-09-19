import Link from 'next/link'
import {
  CalendarCheck, ShieldWarning, Sparkle, Receipt, Wallet,
} from '@phosphor-icons/react/dist/ssr'
import { requirePortalSessionStrict } from '@/lib/portal/session'
import {
  getPelanggaranAnak, getRekapAbsensiAnak,
} from '@/lib/portal/data'
import { getPortalStudentBilling } from '@/lib/portal/finance'
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
  const { start, end } = monthRange()

  const [absen, pelanggaran, billing] = await Promise.all([
    getRekapAbsensiAnak(session.santri_id, start, end),
    getPelanggaranAnak(session.santri_id),
    getPortalStudentBilling(session.santri_id).catch(() => null),
  ])
  const totalPoin = pelanggaran.reduce((sum, p) => sum + p.poin, 0)
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

      <div className="px-5 pt-4 space-y-4">
        {/* Ringkasan bulan ini — grid dua kolom asimetris, angka raksasa */}
        <div>
          <p className="portal-section-label mb-3">01 — Ringkasan Bulan Ini</p>
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

        {/* Keuangan & Uang Jajan */}
        {billing && (
          <div>
            <p className="portal-section-label mb-3">02 — Keuangan & Uang Jajan</p>
            <div className="portal-rise portal-rise-4 grid grid-cols-2 border border-[var(--p-line)] divide-x divide-[var(--p-line)]">
              <Link href="/portal-ortu/tagihan" className="p-4">
                <div className="flex items-center justify-between">
                  <Receipt className="w-4 h-4 text-[var(--p-ink)]" />
                  <span className="portal-index text-[var(--p-muted)]">
                    {billing.obligations.totalRemaining > 0 ? 'Tagihan' : 'Lunas'}
                  </span>
                </div>
                <p className="portal-display mt-3 text-xl leading-none text-[var(--p-emerald-deep)] truncate">
                  {billing.obligations.totalRemaining > 0
                    ? formatRupiah(billing.obligations.totalRemaining)
                    : 'Rp 0'}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[var(--p-muted)]">
                  Total sisa tagihan
                </p>
                <p className="mt-1 text-[10px] text-[var(--p-muted)]">
                  {billing.obligations.totalRemaining > 0 ? 'Ketuk untuk bayar' : 'Semua pos lunas'}
                </p>
              </Link>
              <Link href="/portal-ortu/tagihan" className="p-4">
                <div className="flex items-center justify-between">
                  <Wallet className="w-4 h-4 text-[var(--p-ink)]" />
                  <span className="portal-index text-[var(--p-muted)]">Saldo</span>
                </div>
                <p className="portal-display mt-3 text-xl leading-none text-[var(--p-ink)] truncate">
                  {formatRupiah(billing.wallet.balance)}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[var(--p-muted)]">
                  Dompet Uang Jajan
                </p>
                <p className="mt-1 text-[10px] text-[var(--p-muted)]">
                  Limit harian {formatRupiah(billing.wallet.effectiveDailyLimit)}
                </p>
              </Link>
            </div>
          </div>
        )}

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
