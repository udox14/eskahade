import { queryOne, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { BookOpen, CalendarCheck, FileText, Users, TrendingUp, ClipboardCheck, ArrowUpCircle, School, UserCheck } from 'lucide-react'
import Link from 'next/link'

export async function AkademikDashboard({ role }: { role: string }) {
  if (role === 'wali_kelas') {
    const session = await getSession()

    let namaKelas = 'Belum Ditentukan'
    let totalSantriKelas = 0

    if (session?.id) {
      const kelas = await queryOne<{ id: string; nama_kelas: string }>(
        'SELECT id, nama_kelas FROM kelas WHERE wali_kelas_id = ? LIMIT 1',
        [session.id]
      )
      if (kelas) {
        namaKelas = kelas.nama_kelas
        const row = await queryOne<{ total: number }>(
          "SELECT COUNT(*) AS total FROM riwayat_pendidikan WHERE kelas_id = ? AND status_riwayat = 'aktif'",
          [kelas.id]
        )
        totalSantriKelas = row?.total || 0
      }
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-teal-200 font-bold uppercase tracking-wider text-xs mb-1">Dashboard Wali Kelas</p>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <School className="w-8 h-8"/> {namaKelas}
            </h1>
            <p className="mt-2 text-teal-100 max-w-lg">Kelola nilai, ranking, dan rapor untuk santri di kelas binaan Anda.</p>
          </div>
          <Users className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="bg-teal-100 p-3 rounded-full text-teal-700"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Jumlah Santri</p>
              <p className="text-2xl font-extrabold text-slate-800">{totalSantriKelas} <span className="text-sm font-normal text-slate-400">Siswa</span></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-700"><FileText className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Laporan</p>
              <p className="text-sm font-medium text-slate-700">Siap Cetak</p>
            </div>
          </div>
        </div>

        <h3 className="font-bold text-lg text-slate-700 mt-4">Menu Kelas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MenuCard href="/dashboard/akademik/nilai/input" icon={BookOpen} title="Input Nilai" desc="Isi nilai akademik via Excel." color="text-blue-600 bg-blue-50 hover:bg-blue-100" />
          <MenuCard href="/dashboard/akademik/ranking" icon={TrendingUp} title="Ranking Kelas" desc="Lihat peringkat juara." color="text-purple-600 bg-purple-50 hover:bg-purple-100" />
          <MenuCard href="/dashboard/laporan/rapor" icon={FileText} title="Cetak Rapor" desc="Download PDF rapor santri." color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100" />
        </div>
      </div>
    )
  }

  // Sekpen / Global
  const { total: totalSantri } = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM santri WHERE status_global = 'aktif'", []
  ) ?? { total: 0 }

  const { total: totalKelas } = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM kelas', []
  ) ?? { total: 0 }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-200 font-bold uppercase tracking-wider text-xs mb-1">Seksi Pendidikan (Sekpen)</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3"><BookOpen className="w-8 h-8"/> Akademik Pusat</h1>
          <p className="mt-2 text-blue-100 max-w-lg">Manajemen kurikulum, klasifikasi santri, kenaikan kelas, dan pengawasan KBM.</p>
        </div>
        <BookOpen className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase">Total Siswa Aktif</p>
          <p className="text-3xl font-extrabold text-slate-800">{totalSantri}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase">Jumlah Rombel</p>
          <p className="text-3xl font-extrabold text-slate-800">{totalKelas}</p>
        </div>
      </div>

      <h3 className="font-bold text-lg text-slate-700">Menu Utama</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Manajemen Kelas</p>
          <MenuCard href="/dashboard/santri/tes-klasifikasi" icon={ClipboardCheck} title="Tes Klasifikasi" desc="Seleksi & penempatan level santri baru." color="text-pink-600 bg-pink-50 hover:bg-pink-100" />
          <MenuCard href="/dashboard/santri/atur-kelas" icon={Users} title="Penempatan Kelas" desc="Masukkan santri ke kelas definitif." color="text-indigo-600 bg-indigo-50 hover:bg-indigo-100" />
          <MenuCard href="/dashboard/akademik/kenaikan" icon={ArrowUpCircle} title="Kenaikan Kelas" desc="Proses perpindahan tahun ajaran." color="text-slate-700 bg-slate-100 hover:bg-slate-200" />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Kegiatan Harian</p>
          <MenuCard href="/dashboard/akademik/absensi" icon={CalendarCheck} title="Absen Pengajian" desc="Input kehadiran mingguan (Rapel)." color="text-green-600 bg-green-50 hover:bg-green-100" />
          <MenuCard href="/dashboard/akademik/absensi/verifikasi" icon={UserCheck} title="Verifikasi Absen" desc="Proses sidang alfa mingguan." color="text-orange-600 bg-orange-50 hover:bg-orange-100" />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Laporan & Nilai</p>
          <MenuCard href="/dashboard/akademik/nilai/input" icon={BookOpen} title="Input Nilai" desc="Import nilai akademik via Excel." color="text-blue-600 bg-blue-50 hover:bg-blue-100" />
          <MenuCard href="/dashboard/laporan/rapor" icon={FileText} title="Cetak Rapor" desc="Download PDF rapor santri." color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100" />
        </div>
      </div>
    </div>
  )
}

function MenuCard({ href, icon: Icon, title, desc, color }: any) {
  return (
    <Link href={href} className={`flex items-start gap-4 p-4 rounded-xl border border-transparent transition-all ${color}`}>
      <div className="bg-white p-2 rounded-lg shadow-sm shrink-0"><Icon className="w-6 h-6 opacity-90"/></div>
      <div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <p className="text-xs opacity-80 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}