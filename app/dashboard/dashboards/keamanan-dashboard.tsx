import { createClient } from '@/lib/supabase/server'
import { ShieldAlert, AlertTriangle, Plus, Clock } from 'lucide-react'
import Link from 'next/link'

export async function KeamananDashboard() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // 1. Hitung Santri Telat Kembali (Overdue) - PENGGANTI IZIN
  // Logic: Status masih AKTIF (Belum 'Kembali' di sistem) TAPI waktu rencana sudah lewat
  const { count: telatCount } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')
    .lt('tgl_selesai_rencana', now)

  // 2. Hitung Pelanggaran Hari Ini
  const { count: pelanggaranToday } = await supabase
    .from('pelanggaran')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)

  // 3. Pelanggaran Terbaru (Live Feed)
  const { data: recent } = await supabase
    .from('pelanggaran')
    .select('*, santri(nama_lengkap, asrama, kamar)')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER SPESIFIK */}
      <div className="bg-gradient-to-r from-red-800 to-rose-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-red-200 font-bold uppercase tracking-wider text-xs mb-1">Pusat Komando</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <ShieldAlert className="w-8 h-8"/> Keamanan & Disiplin
          </h1>
          <p className="mt-2 text-red-100 max-w-lg">
            Penegakan disiplin, monitoring keterlambatan, dan penindakan pelanggaran.
          </p>
        </div>
        <ShieldAlert className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      {/* STATISTIK UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget Pelanggaran */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Pelanggaran Hari Ini</p>
            <h4 className="text-4xl font-extrabold text-red-600">{pelanggaranToday || 0}</h4>
            <p className="text-xs text-red-400 mt-1 font-bold">Kasus Baru</p>
          </div>
          <div className="p-4 rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="w-8 h-8"/>
          </div>
        </div>

        {/* Widget Telat (LINK KE DAFTAR NAMA) */}
        <Link href="/dashboard/keamanan/perizinan/verifikasi-telat" className="block group">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md hover:border-orange-300 transition-all cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1 group-hover:text-orange-600 transition-colors">Telat Kembali (Overdue)</p>
              <h4 className="text-4xl font-extrabold text-orange-600">{telatCount || 0}</h4>
              <p className="text-xs text-orange-400 mt-1 font-bold underline decoration-dotted">Klik untuk lihat nama</p>
            </div>
            <div className="p-4 rounded-full bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
              <Clock className="w-8 h-8"/>
            </div>
          </div>
        </Link>
      </div>

      {/* AKSES CEPAT & FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: MENU AKSI (Verifikasi Absen DIHAPUS) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <ActionCard 
                href="/dashboard/keamanan/input"
                title="Input Pelanggaran"
                desc="Catat kasus indisipliner santri."
                icon={Plus}
                color="bg-red-600"
             />
             <ActionCard 
                href="/dashboard/keamanan/perizinan/verifikasi-telat"
                title="Sidang Keterlambatan"
                desc="Proses/Vonis santri yang telat."
                icon={Clock}
                color="bg-orange-600"
             />
             <ActionCard 
                href="/dashboard/keamanan/perizinan/cetak-telat"
                title="Cetak Daftar Panggil"
                desc="List santri telat untuk Mading."
                icon={ShieldAlert}
                color="bg-slate-700"
             />
             {/* Slot kosong bisa diisi fitur lain nanti */}
          </div>
        </div>

        {/* KOLOM KANAN: LIVE FEED PELANGGARAN */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Pelanggaran Terkini</h3>
          <div className="space-y-4">
            {recent?.length === 0 ? (
              <p className="text-center text-slate-400 py-4 text-sm">Belum ada data.</p>
            ) : (
              recent?.map((v: any) => (
                <div key={v.id} className="flex gap-3 items-start">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${v.jenis === 'BERAT' ? 'bg-red-600' : 'bg-orange-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{v.santri?.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-500 font-mono mb-1">{v.santri?.asrama} - {v.santri?.kamar}</p>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">{v.deskripsi}</p>
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