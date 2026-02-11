import { createClient } from '@/lib/supabase/server'
import { MapPin, Users, Clock, Search, CreditCard, Plus, Mail, LayoutList, AlertTriangle, FileText } from 'lucide-react'
import Link from 'next/link'
import { getRingkasanTunggakan } from '../asrama/spp/actions'

export async function DewanSantriDashboard() {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // 1. Hitung Santri Sedang Izin (Belum Kembali)
  const { count: izinCount } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')

  // 2. Hitung Santri Telat (Overdue)
  const { count: telatCount } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')
    .lt('tgl_selesai_rencana', now)

  // 3. Hitung Surat Keluar Bulan Ini
  const { count: suratCount } = await supabase
    .from('riwayat_surat')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)

  // 4. Hitung Tunggakan SPP
  const tunggakanSPP = await getRingkasanTunggakan()

  // 5. Feed Surat Terbaru
  const { data: recentSurat } = await supabase
    .from('riwayat_surat')
    .select('*, santri(nama_lengkap)')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* HEADER HERO */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-purple-200 font-bold uppercase tracking-wider text-xs mb-1">Pengurus Pusat</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Users className="w-8 h-8"/> Dewan Santri
          </h1>
          <p className="mt-2 text-purple-100 max-w-lg">
            Pusat administrasi perizinan, persuratan, dan monitoring keuangan asrama.
          </p>
        </div>
        <MapPin className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      {/* STATISTIK UTAMA (GRID 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Izin Aktif */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Sedang Izin</p>
            <h4 className="text-3xl font-extrabold text-blue-600">{izinCount || 0}</h4>
            <p className="text-xs text-blue-500 font-medium">Santri di Luar</p>
          </div>
          <div className="p-3 rounded-full bg-blue-50 text-blue-600"><MapPin className="w-6 h-6"/></div>
        </div>

        {/* Telat (Overdue) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Terlambat</p>
            <h4 className="text-3xl font-extrabold text-red-600">{telatCount || 0}</h4>
            <p className="text-xs text-red-500 font-medium">Overdue</p>
          </div>
          <div className="p-3 rounded-full bg-red-50 text-red-600"><Clock className="w-6 h-6"/></div>
        </div>

        {/* Surat Keluar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Surat Bulan Ini</p>
            <h4 className="text-3xl font-extrabold text-purple-600">{suratCount || 0}</h4>
            <p className="text-xs text-purple-500 font-medium">Dokumen Dibuat</p>
          </div>
          <div className="p-3 rounded-full bg-purple-50 text-purple-600"><Mail className="w-6 h-6"/></div>
        </div>

        {/* Tunggakan SPP */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Penunggak SPP</p>
            <h4 className="text-3xl font-extrabold text-orange-600">{tunggakanSPP || 0}</h4>
            <p className="text-xs text-orange-500 font-medium">Perlu Diingatkan</p>
          </div>
          <div className="p-3 rounded-full bg-orange-50 text-orange-600"><CreditCard className="w-6 h-6"/></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI (2/3): MENU AKSI */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Menu Perizinan & Surat */}
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Administrasi & Layanan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <ActionCard 
                href="/dashboard/keamanan/perizinan"
                title="Input Perizinan"
                desc="Catat izin pulang atau keluar komplek."
                icon={Plus}
                color="bg-indigo-600"
             />
             <ActionCard 
                href="/dashboard/dewan-santri/surat"
                title="Layanan Surat"
                desc="Buat surat izin, keterangan, & tagihan."
                icon={Mail}
                color="bg-purple-600"
             />
          </div>

          {/* Menu Monitoring & Keuangan */}
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mt-4">Monitoring & Kontrol</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <ActionCard 
                href="/dashboard/dewan-santri/setoran"
                title="Monitoring Setoran"
                desc="Audit setoran SPP dari asrama."
                icon={LayoutList}
                color="bg-emerald-600"
             />
             <ActionCard 
                href="/dashboard/keamanan/perizinan/cetak-telat"
                title="Cetak Telat Datang"
                desc="Daftar santri overdue untuk Mading."
                icon={AlertTriangle}
                color="bg-red-600"
             />
          </div>
        </div>

        {/* KOLOM KANAN (1/3): FEED SURAT */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                 <FileText className="w-4 h-4 text-slate-500"/> Surat Terakhir
              </h3>
              <Link href="/dashboard/dewan-santri/surat" className="text-xs font-bold text-blue-600 hover:underline">Semua</Link>
            </div>
            
            <div className="flex-1 p-2 space-y-2">
              {recentSurat?.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Mail className="w-10 h-10 mx-auto mb-2 opacity-20"/>
                  <p className="text-xs">Belum ada surat.</p>
                </div>
              ) : (
                recentSurat?.map((s: any) => (
                  <div key={s.id} className="p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                         s.jenis_surat === 'TAGIHAN' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                         s.jenis_surat === 'IZIN' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                         'bg-slate-100 text-slate-600 border-slate-200'
                       }`}>
                         {s.jenis_surat}
                       </span>
                       <span className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">
                       {s.santri?.nama_lengkap}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 italic">
                       {s.detail_info}
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

function ActionCard({ href, title, desc, icon: Icon, color }: any) {
  return (
    <Link href={href} className={`p-5 rounded-xl text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-1 flex items-center justify-between ${color}`}>
      <div>
        <h4 className="font-bold text-base">{title}</h4>
        <p className="text-xs opacity-90 mt-1">{desc}</p>
      </div>
      <div className="bg-white/20 p-2 rounded-lg">
        <Icon className="w-6 h-6"/>
      </div>
    </Link>
  )
}