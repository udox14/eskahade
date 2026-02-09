import { createClient } from '@/lib/supabase/server'
import { 
  Users, School, AlertTriangle, BookOpen, ShieldAlert, FileText, 
  UserPlus, MapPin, Stethoscope, UserCog, CreditCard, TrendingUp, 
  Activity, Clock 
} from 'lucide-react'
import Link from 'next/link'
import { getRingkasanTunggakan } from '../asrama/spp/actions'

export async function AdminDashboard() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // --- 1. STATISTIK UTAMA (REALTIME COUNT) ---
  
  // Santri Aktif
  const { count: totalSantri } = await supabase
    .from('santri')
    .select('*', { count: 'exact', head: true })
    .eq('status_global', 'aktif')

  // Total Rombel
  const { count: totalKelas } = await supabase
    .from('kelas')
    .select('*', { count: 'exact', head: true })

  // Santri Sedang Izin (Belum Kembali)
  const { count: izinAktif } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')

  // Santri Sakit Hari Ini
  const { count: sakitHariIni } = await supabase
    .from('absen_sakit')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)

  // Pelanggaran Hari Ini
  const { count: pelanggaranHariIni } = await supabase
    .from('pelanggaran')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)

  // Tunggakan SPP (Global)
  const tunggakanSPP = await getRingkasanTunggakan()

  // --- 2. DATA TERBARU (LIVE FEED) ---

  // 5 Pelanggaran Terakhir
  const { data: recentViolations } = await supabase
    .from('pelanggaran')
    .select('*, santri(nama_lengkap, asrama, kamar)')
    .order('created_at', { ascending: false })
    .limit(4)
  
  // 5 Izin Terakhir
  const { data: recentPermissions } = await supabase
    .from('perizinan')
    .select('*, santri(nama_lengkap, asrama)')
    .order('created_at', { ascending: false })
    .limit(4)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* HEADER HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 opacity-90"></div>
        {/* Decorative Circles */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500 blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 -left-24 h-48 w-48 rounded-full bg-indigo-500 blur-3xl opacity-20"></div>
        
        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <p className="text-blue-300 font-bold uppercase tracking-widest text-xs mb-2">Administrator Panel</p>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Pusat Data Pesantren</h1>
              <p className="mt-2 text-slate-300 max-w-xl text-sm md:text-base leading-relaxed">
                Ringkasan eksekutif seluruh aktivitas akademik, kedisiplinan, asrama, dan keuangan pesantren secara real-time.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
               <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                 <Activity className="h-6 w-6 text-white" />
               </div>
               <div>
                 <p className="text-xs text-slate-400 font-medium">Status Sistem</p>
                 <p className="text-sm font-bold text-green-400">Online & Stabil</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* GRID STATISTIK UTAMA (6 KARTU) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          label="Total Santri" value={totalSantri} icon={Users} 
          color="bg-blue-600" textColor="text-blue-600" bgLight="bg-blue-50"
          href="/dashboard/santri"
        />
        <StatCard 
          label="Rombel Kelas" value={totalKelas} icon={School} 
          color="bg-indigo-600" textColor="text-indigo-600" bgLight="bg-indigo-50"
          href="/dashboard/master/kelas"
        />
        <StatCard 
          label="Sedang Izin" value={izinAktif} icon={MapPin} 
          color="bg-purple-600" textColor="text-purple-600" bgLight="bg-purple-50"
          href="/dashboard/keamanan/perizinan"
        />
        <StatCard 
          label="Sakit Hari Ini" value={sakitHariIni} icon={Stethoscope} 
          color="bg-orange-500" textColor="text-orange-600" bgLight="bg-orange-50"
          href="/dashboard/asrama/absen-sakit"
        />
        <StatCard 
          label="Pelanggaran" value={pelanggaranHariIni} icon={ShieldAlert} 
          color="bg-red-600" textColor="text-red-600" bgLight="bg-red-50"
          subLabel="Hari Ini"
          href="/dashboard/keamanan"
        />
        <StatCard 
          label="Penunggak SPP" value={tunggakanSPP} icon={CreditCard} 
          color="bg-emerald-600" textColor="text-emerald-600" bgLight="bg-emerald-50"
          href="/dashboard/asrama/spp"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI (2/3): QUICK ACTIONS & CHART AREA (FUTURE) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Menu Cepat Modern */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-400"/> Manajemen Cepat
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickAction 
                href="/dashboard/pengaturan/users" icon={UserCog} 
                title="Users" desc="Kelola Akun" 
                color="hover:bg-slate-50 text-slate-600" 
              />
              <QuickAction 
                href="/dashboard/santri/input" icon={UserPlus} 
                title="Santri Baru" desc="Import Data" 
                color="hover:bg-blue-50 text-blue-600" 
              />
              <QuickAction 
                href="/dashboard/master/kelas" icon={School} 
                title="Master Kelas" desc="Atur Rombel" 
                color="hover:bg-indigo-50 text-indigo-600" 
              />
              <QuickAction 
                href="/dashboard/laporan/rapor" icon={FileText} 
                title="Cetak Rapor" desc="Laporan PDF" 
                color="hover:bg-emerald-50 text-emerald-600" 
              />
            </div>
          </div>

          {/* Tabel Izin Terbaru */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Clock className="w-4 h-4 text-purple-500"/> Izin Keluar Terbaru
               </h3>
               <Link href="/dashboard/keamanan/perizinan" className="text-xs font-bold text-purple-600 hover:underline">Lihat Semua</Link>
            </div>
            <div className="divide-y divide-slate-100">
               {recentPermissions?.length === 0 ? (
                 <p className="p-8 text-center text-sm text-slate-400">Belum ada data izin.</p>
               ) : (
                 recentPermissions?.map((p: any) => (
                   <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                           p.jenis === 'PULANG' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                           {p.santri?.nama_lengkap.substring(0, 1)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{p.santri?.nama_lengkap}</p>
                          <p className="text-xs text-slate-500">{p.jenis === 'PULANG' ? 'Izin Pulang' : 'Keluar Komplek'} • <span className="italic">"{p.alasan}"</span></p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                        p.status === 'AKTIF' 
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {p.status}
                      </span>
                   </div>
                 ))
               )}
            </div>
          </div>

        </div>

        {/* KOLOM KANAN (1/3): FEED PELANGGARAN */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50/30">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-red-500"/> Pelanggaran
              </h3>
              <Link href="/dashboard/keamanan" className="text-xs font-bold text-red-600 hover:underline">Lihat Semua</Link>
            </div>
            
            <div className="flex-1 p-2 space-y-2">
              {recentViolations?.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm">Aman terkendali.</p>
                </div>
              ) : (
                recentViolations?.map((v: any) => (
                  <div key={v.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex justify-between items-start mb-2">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                         v.jenis === 'BERAT' ? 'bg-red-100 text-red-700 border-red-200' : 
                         v.jenis === 'SEDANG' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                         'bg-slate-200 text-slate-600 border-slate-300'
                       }`}>
                         {v.jenis}
                       </span>
                       <span className="text-[10px] text-slate-400">{new Date(v.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                       {v.santri?.nama_lengkap}
                    </p>
                    <p className="text-xs text-slate-500 mb-2">{v.santri?.asrama} - Kamar {v.santri?.kamar}</p>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-2 rounded border border-slate-100">
                       {v.deskripsi}
                    </p>
                    <div className="mt-2 text-right">
                       <span className="text-xs font-bold text-red-600">+{v.poin} Poin</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// --- KOMPONEN KECIL ---

function StatCard({ label, value, icon: Icon, color, textColor, bgLight, href, subLabel }: any) {
  return (
    <Link href={href} className="block group">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 h-full flex flex-col justify-between relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${bgLight} transition-transform group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <h4 className="text-2xl font-extrabold text-slate-800">{value || 0}</h4>
          {subLabel && <p className={`text-[10px] font-bold ${textColor} mt-1`}>{subLabel}</p>}
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ href, icon: Icon, title, desc, color }: any) {
  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center justify-center p-4 rounded-xl border border-transparent transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer ${color}`}
    >
      <Icon className="w-8 h-8 mb-2 opacity-80" />
      <span className="text-sm font-bold text-center leading-tight">{title}</span>
      <span className="text-[10px] opacity-70 text-center mt-1">{desc}</span>
    </Link>
  )
}