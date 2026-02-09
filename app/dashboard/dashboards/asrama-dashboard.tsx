import { createClient } from '@/lib/supabase/server'
import { Home, Moon, Stethoscope, Users, MapPin, CheckCircle, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { getRingkasanTunggakan } from '../asrama/spp/actions'

export async function AsramaDashboard({ asrama }: { asrama: string }) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Hitung Santri Binaan
  const { count: totalSantri } = await supabase
    .from('santri')
    .select('*', { count: 'exact', head: true })
    .eq('asrama', asrama)
    .eq('status_global', 'aktif')

  // 2. Hitung yang Sakit Hari Ini
  const { data: santriAsrama } = await supabase.from('santri').select('id').eq('asrama', asrama)
  const santriIds = santriAsrama?.map(s => s.id) || []

  const { count: countSakit } = await supabase
    .from('absen_sakit')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', today)
    .in('santri_id', santriIds)

  // 3. Hitung Sedang Izin
  const { count: countIzin } = await supabase
    .from('perizinan')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'AKTIF')
    .in('santri_id', santriIds)

  // 4. Hitung Tunggakan SPP
  const tunggakanSPP = await getRingkasanTunggakan(asrama)

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4">
      {/* HEADER KHUSUS ASRAMA */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-orange-200 font-bold uppercase tracking-wider text-xs mb-1">Dashboard Pengurus</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Home className="w-8 h-8"/> Asrama {asrama}
          </h1>
          <p className="mt-2 text-orange-100 max-w-lg">
            Pantau kondisi santri, absen malam, dan kesehatan harian di asrama binaan Anda.
          </p>
        </div>
        <Home className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 rotate-12"/>
      </div>

      {/* STATISTIK RINGKAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatSmall title="Total Warga" value={totalSantri || 0} icon={Users} color="text-blue-600 bg-blue-50" />
        <StatSmall title="Sakit Hari Ini" value={countSakit || 0} icon={Stethoscope} color="text-red-600 bg-red-50" />
        <StatSmall title="Sedang Izin" value={countIzin || 0} icon={MapPin} color="text-purple-600 bg-purple-50" />
        
        {/* WIDGET BARU: TUNGGAKAN */}
        <Link href="/dashboard/asrama/spp">
          <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm flex flex-col items-center justify-center text-center hover:bg-orange-50 transition-colors cursor-pointer group">
            <div className="p-2 rounded-full mb-2 bg-orange-100 text-orange-600 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5"/>
            </div>
            <h4 className="text-2xl font-bold text-slate-800">{tunggakanSPP}</h4>
            <p className="text-xs text-slate-500 font-medium">Penunggak SPP</p>
          </div>
        </Link>
      </div>

      {/* MENU AKSI (TOMBOL BESAR) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard 
          href="/dashboard/asrama/absen-malam"
          title="Absen Malam"
          desc="Cek kehadiran santri per kamar."
          icon={Moon}
          btnClass="bg-slate-900 text-white hover:bg-slate-800"
        />
        <ActionCard 
          href="/dashboard/asrama/absen-sakit"
          title="Input Sakit Pagi"
          desc="Data santri yang tidak sekolah."
          icon={Stethoscope}
          btnClass="bg-red-600 text-white hover:bg-red-700"
        />
        <ActionCard 
          href="/dashboard/asrama/spp"
          title="Bayar SPP"
          desc="Input pembayaran bulanan santri."
          icon={CreditCard}
          btnClass="bg-green-600 text-white hover:bg-green-700"
        />
      </div>
    </div>
  )
}

function StatSmall({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
      <div className={`p-2 rounded-full mb-2 ${color}`}>
        <Icon className="w-5 h-5"/>
      </div>
      <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      <p className="text-xs text-slate-500 font-medium">{title}</p>
    </div>
  )
}

function ActionCard({ href, title, desc, icon: Icon, btnClass }: any) {
  return (
    <Link href={href} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
          <Icon className="w-5 h-5"/> {title}
        </h3>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <div className={`p-3 rounded-full transition-transform group-hover:scale-110 ${btnClass}`}>
        <Icon className="w-6 h-6"/>
      </div>
    </Link>
  )
}