import { BookOpen, CalendarDays, GraduationCap, Link2Off, UserRound } from 'lucide-react'
import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { getGuruPortalData } from './actions'

export const dynamic = 'force-dynamic'

const SESSION_LABEL: Record<string, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
}

const SOURCE_LABEL: Record<string, string> = {
  default: 'Default',
  override: 'Jadwal mingguan',
  campuran: 'Campuran',
}

export default async function GuruPage() {
  await guardPage('/dashboard/guru')
  const data = await getGuruPortalData()

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Guru"
        description="Portal awal untuk akun guru dan ringkasan jadwal mengajar."
      />

      {data.needsSourceLink ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Link2Off className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-amber-950">Akun belum tertaut ke data guru</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Akun ini sudah memiliki akses role Guru, tetapi belum punya link ke data guru. Admin dapat menjalankan sinkron akun guru di Manajemen User agar jadwal pribadi muncul otomatis.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-slate-400">Nama Guru</p>
                  <p className="truncate font-bold text-slate-900">{data.guru?.nama_lengkap || data.user?.full_name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">{data.guru?.gelar || data.guru?.kode_guru || data.user?.email}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Kelas Diampu</p>
                  <p className="font-bold text-slate-900">{data.stats.totalKelas} kelas</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Slot Jadwal</p>
                  <p className="font-bold text-slate-900">{data.stats.totalSlot} slot</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900">Jadwal Mengajar</h2>
            </div>

            {data.schedules.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Belum ada jadwal mengajar aktif yang terhubung ke akun ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Kelas</th>
                      <th className="px-5 py-3">Marhalah</th>
                      <th className="px-5 py-3">Sesi</th>
                      <th className="px-5 py-3">Hari</th>
                      <th className="px-5 py-3">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.schedules.map(item => (
                      <tr key={`${item.kelas_id}-${item.sesi}`} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-semibold text-slate-900">{item.nama_kelas}</td>
                        <td className="px-5 py-4 text-slate-600">{item.marhalah_nama || '-'}</td>
                        <td className="px-5 py-4 text-slate-700">{SESSION_LABEL[item.sesi]}</td>
                        <td className="px-5 py-4 text-slate-700">{item.hari}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                            {SOURCE_LABEL[item.sumber]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
