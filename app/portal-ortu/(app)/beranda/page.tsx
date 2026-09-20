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
      {/* Header identitas — bersih, ramah, proporsional */}
      <div className="bg-white border-b border-slate-200/80 px-5 pt-6 pb-5">
        <div className="portal-rise flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
            {session.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.foto_url} alt={session.nama} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xl text-slate-600">
                {session.nama.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Assalamu&rsquo;alaikum, Wali dari
            </p>
            <h1 className="portal-display mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl truncate">
              {session.nama}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">NIS {session.nis}</span>
              {session.asrama && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{session.asrama}</span>}
              {session.kamar && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Kamar {session.kamar}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {/* Ringkasan bulan ini */}
        <div>
          <p className="portal-section-label mb-2.5">Ringkasan Bulan Ini</p>
          <div className="portal-rise portal-rise-3 grid grid-cols-2 gap-3">
            <Link href="/portal-ortu/absensi" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-colors block">
              <div className="flex items-center justify-between">
                <CalendarCheck className="w-4 h-4 text-emerald-700" />
                <span className="portal-index text-xs text-slate-500 font-semibold">{persenHadir !== null ? `${persenHadir}%` : '—'}</span>
              </div>
              <p className="portal-display mt-2 text-2xl font-bold leading-none text-slate-900">
                {absen.totalSesi > 0 ? `${absen.hadir}/${absen.totalSesi}` : '—'}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-slate-600">
                Kehadiran pengajian
              </p>
              {(absen.alfa > 0 || absen.izin > 0 || absen.sakit > 0) ? (
                <p className="mt-1 text-xs text-rose-600 font-medium">
                  {absen.alfa > 0 ? `${absen.alfa} alfa ` : ''}
                  {absen.sakit > 0 ? `${absen.sakit} sakit ` : ''}
                  {absen.izin > 0 ? `${absen.izin} izin` : ''}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Update Selasa malam</p>
              )}
            </Link>
            <Link href="/portal-ortu/pelanggaran" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-rose-300 transition-colors block">
              <div className="flex items-center justify-between">
                <ShieldWarning className="w-4 h-4 text-rose-600" />
                <span className="portal-index text-xs text-slate-500 font-semibold">{pelanggaran.length}</span>
              </div>
              <p className="portal-display mt-2 text-2xl font-bold leading-none text-slate-900">{totalPoin}</p>
              <p className="mt-1.5 text-xs font-semibold text-slate-600">
                Poin pelanggaran
              </p>
              <p className="mt-1 text-xs text-slate-400">{pelanggaran.length} catatan tercatat</p>
            </Link>
          </div>
        </div>

        {/* Keuangan & Uang Jajan */}
        {billing && (
          <div>
            <p className="portal-section-label mb-2.5">Keuangan & Uang Jajan</p>
            <div className="portal-rise portal-rise-4 grid grid-cols-2 gap-3">
              <Link href="/portal-ortu/tagihan" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-colors block">
                <div className="flex items-center justify-between">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${billing.obligations.totalRemaining > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {billing.obligations.totalRemaining > 0 ? 'Tagihan' : 'Lunas'}
                  </span>
                </div>
                <p className="portal-display mt-2 text-lg font-bold leading-none text-slate-900 truncate">
                  {billing.obligations.totalRemaining > 0
                    ? formatRupiah(billing.obligations.totalRemaining)
                    : 'Rp0'}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-slate-600">
                  Total sisa tagihan
                </p>
                <p className="mt-1 text-xs text-emerald-700 font-medium">
                  {billing.obligations.totalRemaining > 0 ? 'Ketuk untuk bayar' : 'Semua pos lunas'}
                </p>
              </Link>
              <Link href="/portal-ortu/tagihan" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-colors block">
                <div className="flex items-center justify-between">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Saldo</span>
                </div>
                <p className="portal-display mt-2 text-lg font-bold leading-none text-slate-900 truncate">
                  {formatRupiah(billing.wallet.balance)}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-slate-600">
                  Dompet Uang Jajan
                </p>
                <p className="mt-1 text-xs text-slate-400 truncate">
                  Limit: {formatRupiah(billing.wallet.effectiveDailyLimit)}/hari
                </p>
              </Link>
            </div>
          </div>
        )}

        {pelanggaranBulanIni.length === 0 && absen.alfa === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3.5 shadow-2xs">
            <Sparkle className="w-4 h-4 shrink-0 text-emerald-700" />
            <p className="text-xs font-medium text-emerald-900 leading-relaxed">
              Alhamdulillah, tidak ada catatan pelanggaran maupun alfa bulan ini.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
