import { createClient } from '@/lib/supabase/server'
import { 
  Users, School, AlertTriangle, ShieldAlert, 
  MapPin, Stethoscope, UserCog, CreditCard, 
  Activity, Clock, Briefcase, Coins, Database, 
  BarChart3, Receipt, Book, Settings, Wallet, FileText
} from 'lucide-react'
import Link from 'next/link'
import { getRingkasanTunggakan } from '../asrama/spp/actions'

export async function AdminDashboard() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()

  // =========================================================
  // 1. RINGKASAN EKSEKUTIF (MASTER DATA & KEUANGAN)
  // =========================================================
  
  const { count: totalSantri } = await supabase
    .from('santri')
    .select('*', { count: 'exact', head: true })
    .eq('status_global', 'aktif')

  const { count: totalKelas } = await supabase
    .from('kelas')
    .select('*', { count: 'exact', head: true })

  const { count: totalGuru } = await supabase
    .from('data_guru')
    .select('*', { count: 'exact', head: true })

  // Pemasukan SPP Tahun Ini
  const { data: sppTahunIni } = await supabase
    .from('spp_log')
    .select('nominal_bayar')
    .eq('tahun', currentYear)
  
  const totalPemasukanSPP = sppTahunIni?.reduce((sum, item) => sum + item.nominal_bayar, 0) || 0


  // =========================================================
  // 2. PANTAUAN OPERASIONAL (HARIAN / REALTIME)
  // =========================================================

  const { count: izinAktif } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')

  const { count: sakitHariIni } = await supabase
    .from('absen_sakit')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)

  const { count: pelanggaranHariIni } = await supabase
    .from('pelanggaran')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)

  const tunggakanSPP = await getRingkasanTunggakan()


  // =========================================================
  // 3. FEED AKTIVITAS TERBARU
  // =========================================================

  const { data: recentViolations } = await supabase
    .from('pelanggaran')
    .select('*, santri(nama_lengkap, asrama, kamar)')
    .order('created_at', { ascending: false })
    .limit(4)
  
  const { data: recentPermissions } = await supabase
    .from('perizinan')
    .select('*, santri(nama_lengkap, asrama)')
    .order('created_at', { ascending: false })
    .limit(4)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* HEADER HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 opacity-90"></div>
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500 blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 -left-24 h-48 w-48 rounded-full bg-indigo-500 blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 right-10 h-32 w-32 rounded-full bg-emerald-500 blur-3xl opacity-10"></div>
        
        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <p className="text-blue-300 font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4"/> Pusat Kendali Utama
              </p>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">Dashboard Admin</h1>
              <p className="mt-2 text-slate-300 max-w-2xl text-sm md:text-base leading-relaxed">
                Akses cepat ke seluruh modul pengaturan, master data, keuangan, dan pantauan operasional Pesantren Sukahideng secara real-time.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 px-5 rounded-2xl border border-white/10 shadow-lg">
               <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                 <Activity className="h-5 w-5 text-white" />
               </div>
               <div>
                 <p className="text-xs text-emerald-100 font-medium">Status Sistem</p>
                 <p className="text-sm font-bold text-white tracking-wide">Online & Sinkron</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. RINGKASAN GLOBAL */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4"/> Ringkasan Global
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard 
            label="Total Santri Aktif" value={totalSantri} icon={Users} 
            color="bg-blue-600" textColor="text-blue-600" bgLight="bg-blue-50" borderHover="hover:border-blue-300"
            href="/dashboard/santri"
          />
          <StatCard 
            label="Tenaga Pengajar" value={totalGuru} icon={Briefcase} 
            color="bg-purple-600" textColor="text-purple-600" bgLight="bg-purple-50" borderHover="hover:border-purple-300"
            href="/dashboard/master/wali-kelas"
          />
          <StatCard 
            label="Rombongan Belajar" value={totalKelas} icon={School} 
            color="bg-indigo-600" textColor="text-indigo-600" bgLight="bg-indigo-50" borderHover="hover:border-indigo-300"
            href="/dashboard/master/kelas"
          />
          <StatCard 
            label={`Pemasukan SPP ${currentYear}`} 
            value={`Rp ${(totalPemasukanSPP / 1000000).toFixed(1)}Jt`} 
            icon={Coins} 
            color="bg-emerald-600" textColor="text-emerald-600" bgLight="bg-emerald-50" borderHover="hover:border-emerald-300"
            href="/dashboard/keuangan/laporan"
          />
        </div>
      </div>

      {/* 2. MENU AKSES CEPAT ADMIN (GRID FULL) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Database className="w-5 h-5 text-indigo-600"/> Akses Cepat Administrator
            </h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction 
                href="/dashboard/pengaturan/users" icon={UserCog} 
                title="Manajemen User" desc="Hak Akses & Sandi" 
                theme="blue" 
            />
            <QuickAction 
                href="/dashboard/master/kelas" icon={Database} 
                title="Master Kelas" desc="Tahun Ajaran & Kelas" 
                theme="indigo" 
            />
            <QuickAction 
                href="/dashboard/master/wali-kelas" icon={Briefcase} 
                title="Master Guru" desc="Pengajar & Jadwal" 
                theme="purple" 
            />
            <QuickAction 
                href="/dashboard/master/kitab" icon={Book} 
                title="Master Kitab" desc="Buku & Harga UPK" 
                theme="emerald" 
            />
            <QuickAction 
                href="/dashboard/master/pelanggaran" icon={Settings} 
                title="Aturan Pelanggaran" desc="Poin & Kategori Kasus" 
                theme="rose" 
            />
            <QuickAction 
                href="/dashboard/keuangan/tarif" icon={Wallet} 
                title="Pengaturan Tarif" desc="Biaya Angkatan Masuk" 
                theme="amber" 
            />
            <QuickAction 
                href="/dashboard/dewan-santri/sensus" icon={BarChart3} 
                title="Sensus Penduduk" desc="Statistik Demografi" 
                theme="cyan" 
            />
            <QuickAction 
                href="/dashboard/keuangan/laporan" icon={FileText} 
                title="Laporan Keuangan" desc="Arus Kas & Tunggakan" 
                theme="teal" 
            />
        </div>
      </div>

      {/* 3. PANTAUAN OPERASIONAL & FEED */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
            <Activity className="w-4 h-4"/> Pantauan Operasional Harian
        </h3>
        
        {/* Row Widget Operasional */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Sedang Izin" value={izinAktif} icon={MapPin} 
            color="bg-sky-600" textColor="text-sky-600" bgLight="bg-sky-50" borderHover="hover:border-sky-300"
            href="/dashboard/keamanan/perizinan"
          />
          <StatCard 
            label="Sakit Hari Ini" value={sakitHariIni} icon={Stethoscope} 
            color="bg-orange-500" textColor="text-orange-600" bgLight="bg-orange-50" borderHover="hover:border-orange-300"
            href="/dashboard/asrama/absen-sakit"
          />
          <StatCard 
            label="Pelanggaran Hari Ini" value={pelanggaranHariIni} icon={ShieldAlert} 
            color="bg-red-600" textColor="text-red-600" bgLight="bg-red-50" borderHover="hover:border-red-300"
            href="/dashboard/keamanan"
          />
          <StatCard 
            label="Penunggak SPP" value={tunggakanSPP} icon={Receipt} 
            color="bg-rose-600" textColor="text-rose-600" bgLight="bg-rose-50" borderHover="hover:border-rose-300"
            href="/dashboard/asrama/spp"
            subLabel="Peringatan Admin"
          />
        </div>

        {/* Row Feed Aktivitas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tabel Izin Terbaru */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-500"/> Izin Keluar Terbaru
                </h3>
                <Link href="/dashboard/keamanan/perizinan" className="text-xs font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-3 py-1 rounded-full transition-colors">Lihat Semua</Link>
                </div>
                <div className="divide-y divide-slate-100 flex-1 p-2">
                {recentPermissions?.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">Belum ada data izin.</p>
                ) : (
                    recentPermissions?.map((p: any) => (
                    <div key={p.id} className="p-3 mx-2 my-1 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                            p.jenis === 'PULANG' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {p.santri?.nama_lengkap.substring(0, 1)}
                            </div>
                            <div>
                            <p className="text-sm font-bold text-slate-800">{p.santri?.nama_lengkap}</p>
                            <p className="text-xs text-slate-500">{p.jenis === 'PULANG' ? 'Izin Pulang' : 'Keluar Komplek'} • <span className="italic">"{p.alasan}"</span></p>
                            </div>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
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

            {/* FEED PELANGGARAN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50/40">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500"/> Pelanggaran Terkini
                </h3>
                <Link href="/dashboard/keamanan" className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 px-3 py-1 rounded-full transition-colors">Semua Kasus</Link>
                </div>
                
                <div className="flex-1 p-4 space-y-3">
                {recentViolations?.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                    <ShieldAlert className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">Aman terkendali.</p>
                    </div>
                ) : (
                    recentViolations?.map((v: any) => (
                    <div key={v.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            v.jenis === 'BERAT' ? 'bg-red-100 text-red-700 border-red-200' : 
                            v.jenis === 'SEDANG' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                            {v.jenis}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{new Date(v.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors">
                        {v.santri?.nama_lengkap}
                        </p>
                        <p className="text-xs text-slate-500 mb-2">{v.santri?.asrama} - Kamar {v.santri?.kamar}</p>
                        <p className="text-xs text-slate-600 leading-relaxed bg-white p-2 rounded border border-slate-100 line-clamp-2">
                        {v.deskripsi}
                        </p>
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

function StatCard({ label, value, icon: Icon, color, textColor, bgLight, borderHover, href, subLabel }: any) {
  return (
    <Link href={href} className="block group h-full">
      <div className={`bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 h-full flex flex-col justify-between relative overflow-hidden ${borderHover}`}>
        <div className={`absolute top-0 right-0 p-3 lg:p-4 rounded-bl-3xl ${bgLight} transition-transform duration-500 group-hover:scale-125`}>
          <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${textColor}`} />
        </div>
        <div className="z-10 relative">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 pr-10">{label}</p>
          <h4 className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${value.toString().includes('Rp') ? 'text-slate-700' : 'text-slate-800'}`}>
            {value || 0}
          </h4>
          {subLabel && <p className={`text-[10px] font-bold ${textColor} mt-2 bg-white/80 inline-block px-2 py-0.5 rounded border ${borderHover.replace('hover:', '')}`}>{subLabel}</p>}
        </div>
      </div>
    </Link>
  )
}

// Helper Tema Warna untuk Action Card
const themes = {
    blue: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600",
    purple: "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-600 hover:text-white hover:border-purple-600",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
    rose: "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-600",
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-500 hover:text-white hover:border-amber-500",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-600 hover:text-white hover:border-cyan-600",
    teal: "bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-600 hover:text-white hover:border-teal-600"
}

function QuickAction({ href, icon: Icon, title, desc, theme = 'blue' }: any) {
  const colorClass = themes[theme as keyof typeof themes]

  return (
    <Link 
      href={href} 
      className={`group flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${colorClass}`}
    >
      <div className="bg-white/80 p-3 rounded-xl mb-3 shadow-sm group-hover:bg-white/20 transition-colors">
        <Icon className="w-7 h-7" />
      </div>
      <span className="text-sm font-extrabold text-center leading-tight mb-1">{title}</span>
      <span className="text-[10px] text-center font-medium opacity-70 px-2 line-clamp-2">{desc}</span>
    </Link>
  )
}