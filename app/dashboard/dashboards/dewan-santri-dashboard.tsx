import { createClient } from '@/lib/supabase/server'
import { MapPin, Users, Clock, Search, CreditCard, Plus } from 'lucide-react'
import Link from 'next/link'
import { getRingkasanTunggakan } from '../asrama/spp/actions'

export async function DewanSantriDashboard() {
  const supabase = await createClient()

  // 1. Hitung Santri Sedang Izin (Belum Kembali)
  const { count: izinCount } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')

  // 2. Hitung Tunggakan SPP
  const tunggakanSPP = await getRingkasanTunggakan()

  // 3. Izin Terbaru (Live Feed)
  const { data: recentPermissions } = await supabase
    .from('perizinan')
    .select('*, santri(nama_lengkap, asrama, kamar)')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER DEWAN SANTRI */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-purple-200 font-bold uppercase tracking-wider text-xs mb-1">Pengurus Pusat</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Users className="w-8 h-8"/> Dewan Santri
          </h1>
          <p className="mt-2 text-purple-100 max-w-lg">
            Manajemen perizinan keluar masuk santri dan monitoring kedatangan.
          </p>
        </div>
        <MapPin className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      {/* STATISTIK UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget Izin */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Santri Sedang Diluar</p>
            <h4 className="text-4xl font-extrabold text-blue-600">{izinCount || 0}</h4>
            <p className="text-xs text-blue-400 mt-1 font-bold">Izin Aktif</p>
          </div>
          <div className="p-4 rounded-full bg-blue-50 text-blue-600">
            <MapPin className="w-8 h-8"/>
          </div>
        </div>

        {/* Widget Tunggakan */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Penunggak SPP</p>
            <h4 className="text-4xl font-extrabold text-orange-600">{tunggakanSPP || 0}</h4>
            <p className="text-xs text-orange-400 mt-1 font-bold">Perlu Diingatkan</p>
          </div>
          <div className="p-4 rounded-full bg-orange-50 text-orange-600">
            <CreditCard className="w-8 h-8"/>
          </div>
        </div>
      </div>

      {/* AKSES CEPAT & FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: MENU AKSI */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <ActionCard 
                href="/dashboard/keamanan/perizinan"
                title="Input Perizinan"
                desc="Catat izin pulang atau keluar komplek."
                icon={Plus}
                color="bg-purple-600"
             />
             <ActionCard 
                href="/dashboard/keamanan/perizinan/cetak-telat"
                title="Cetak Telat Datang"
                desc="Laporan santri yang belum kembali."
                icon={Clock}
                color="bg-red-600"
             />
             <ActionCard 
                href="/dashboard/santri"
                title="Cari Data Santri"
                desc="Cek profil santri lengkap."
                icon={Search}
                color="bg-slate-700"
             />
          </div>
        </div>

        {/* KOLOM KANAN: LIVE FEED IZIN */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Izin Terbaru</h3>
          <div className="space-y-4">
            {recentPermissions?.length === 0 ? (
              <p className="text-center text-slate-400 py-4 text-sm">Belum ada data.</p>
            ) : (
              recentPermissions?.map((p: any) => (
                <div key={p.id} className="flex gap-3 items-start border-b border-slate-50 pb-2 last:border-0">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${p.jenis === 'PULANG' ? 'bg-purple-600' : 'bg-blue-500'}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.santri?.nama_lengkap}</p>
                    <div className="flex gap-2 text-[10px] text-slate-500 mb-1">
                        <span>{p.santri?.asrama}</span>
                        <span className={`font-bold ${p.status === 'AKTIF' ? 'text-orange-500' : 'text-green-500'}`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic">"{p.alasan}"</p>
                  </div>
                </div>
              ))
            )}
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
        <h4 className="font-bold text-lg">{title}</h4>
        <p className="text-xs opacity-90">{desc}</p>
      </div>
      <Icon className="w-8 h-8 opacity-80"/>
    </Link>
  )
}