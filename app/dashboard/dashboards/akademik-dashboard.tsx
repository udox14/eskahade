import { createClient } from '@/lib/supabase/server'
import { BookOpen, CalendarCheck, FileText, Users, TrendingUp, ClipboardCheck, ArrowUpCircle, School, UserCheck } from 'lucide-react'
import Link from 'next/link'

export async function AkademikDashboard({ role }: { role: string }) {
  const supabase = await createClient()

  // --- TAMPILAN KHUSUS WALI KELAS ---
  if (role === 'wali_kelas') {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Cari Kelas Binaan
    let namaKelas = "Belum Ditentukan"
    let totalSantriKelas = 0

    if (user) {
      const { data: kelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas, marhalah(nama)')
        .eq('wali_kelas_id', user.id)
        .single()
      
      if (kelas) {
        // PERBAIKAN: Handle tipe data marhalah (Array/Object) untuk menghindari error TypeScript
        const mData = kelas.marhalah as any
        const namaMarhalah = Array.isArray(mData) ? mData[0]?.nama : mData?.nama
        
        namaKelas = `${kelas.nama_kelas} (${namaMarhalah || '?'})`
        
        const { count } = await supabase
          .from('riwayat_pendidikan')
          .select('*', { count: 'exact', head: true })
          .eq('kelas_id', kelas.id)
          .eq('status_riwayat', 'aktif')
        
        totalSantriKelas = count || 0
      }
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {/* HEADER WALI KELAS */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-teal-200 font-bold uppercase tracking-wider text-xs mb-1">
              Dashboard Wali Kelas
            </p>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <School className="w-8 h-8"/> {namaKelas}
            </h1>
            <p className="mt-2 text-teal-100 max-w-lg">
              Kelola nilai, ranking, dan rapor untuk santri di kelas binaan Anda.
            </p>
          </div>
          <Users className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
        </div>

        {/* STATISTIK KELAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="bg-teal-100 p-3 rounded-full text-teal-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Jumlah Santri</p>
              <p className="text-2xl font-extrabold text-slate-800">{totalSantriKelas} <span className="text-sm font-normal text-slate-400">Siswa</span></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4">
             <div className="bg-blue-100 p-3 rounded-full text-blue-700">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Laporan</p>
              <p className="text-sm font-medium text-slate-700">Siap Cetak</p>
            </div>
          </div>
        </div>

        {/* MENU WALI KELAS */}
        <h3 className="font-bold text-lg text-slate-700 mt-4">Menu Kelas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MenuCard 
             href="/dashboard/akademik/nilai/input"
             icon={BookOpen}
             title="Input Nilai"
             desc="Isi nilai akademik via Excel."
             color="text-blue-600 bg-blue-50 hover:bg-blue-100"
           />
           <MenuCard 
             href="/dashboard/akademik/ranking"
             icon={TrendingUp}
             title="Ranking Kelas"
             desc="Lihat peringkat juara."
             color="text-purple-600 bg-purple-50 hover:bg-purple-100"
           />
           <MenuCard 
             href="/dashboard/laporan/rapor"
             icon={FileText}
             title="Cetak Rapor"
             desc="Download PDF rapor santri."
             color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
           />
        </div>
      </div>
    )
  }

  // --- TAMPILAN KHUSUS SEKPEN (GLOBAL) ---
  
  // Statistik Ringkas Global
  const { count: totalSantri } = await supabase.from('santri').select('*', { count: 'exact', head: true }).eq('status_global', 'aktif')
  const { count: totalKelas } = await supabase.from('kelas').select('*', { count: 'exact', head: true })

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER SEKPEN */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-200 font-bold uppercase tracking-wider text-xs mb-1">
            Seksi Pendidikan (Sekpen)
          </p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <BookOpen className="w-8 h-8"/> Akademik Pusat
          </h1>
          <p className="mt-2 text-blue-100 max-w-lg">
            Manajemen kurikulum, klasifikasi santri, kenaikan kelas, dan pengawasan KBM.
          </p>
        </div>
        <BookOpen className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      {/* STATISTIK GLOBAL */}
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

      {/* MENU SEKPEN */}
      <h3 className="font-bold text-lg text-slate-700">Menu Utama</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* PENERIMAAN & KELAS */}
        <div className="space-y-4">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Manajemen Kelas</p>
           <MenuCard 
             href="/dashboard/santri/tes-klasifikasi"
             icon={ClipboardCheck}
             title="Tes Klasifikasi"
             desc="Seleksi & penempatan level santri baru."
             color="text-pink-600 bg-pink-50 hover:bg-pink-100"
           />
           <MenuCard 
             href="/dashboard/santri/atur-kelas"
             icon={Users}
             title="Penempatan Kelas"
             desc="Masukkan santri ke kelas definitif."
             color="text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
           />
           <MenuCard 
             href="/dashboard/akademik/kenaikan"
             icon={ArrowUpCircle}
             title="Kenaikan Kelas"
             desc="Proses perpindahan tahun ajaran."
             color="text-slate-700 bg-slate-100 hover:bg-slate-200"
           />
        </div>

        {/* KEGIATAN HARIAN */}
        <div className="space-y-4">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Kegiatan Harian</p>
           <MenuCard 
             href="/dashboard/akademik/absensi"
             icon={CalendarCheck}
             title="Absen Pengajian"
             desc="Input kehadiran mingguan (Rapel)."
             color="text-green-600 bg-green-50 hover:bg-green-100"
           />
           <MenuCard 
               href="/dashboard/akademik/absensi/verifikasi"
               icon={UserCheck}
               title="Verifikasi Absen"
               desc="Proses sidang alfa mingguan."
               color="text-orange-600 bg-orange-50 hover:bg-orange-100"
           />
        </div>

        {/* LAPORAN */}
        <div className="space-y-4">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Laporan & Nilai</p>
           <MenuCard 
             href="/dashboard/akademik/nilai/input"
             icon={BookOpen}
             title="Input Nilai"
             desc="Import nilai akademik via Excel."
             color="text-blue-600 bg-blue-50 hover:bg-blue-100"
           />
           <MenuCard 
             href="/dashboard/laporan/rapor"
             icon={FileText}
             title="Cetak Rapor"
             desc="Download PDF rapor santri."
             color="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
           />
        </div>

      </div>
    </div>
  )
}

function MenuCard({ href, icon: Icon, title, desc, color }: any) {
  return (
    <Link href={href} className={`flex items-start gap-4 p-4 rounded-xl border border-transparent transition-all ${color}`}>
      <div className="bg-white p-2 rounded-lg shadow-sm shrink-0">
        <Icon className="w-6 h-6 opacity-90"/>
      </div>
      <div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <p className="text-xs opacity-80 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}