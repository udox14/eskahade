import Link from "next/link";
import { ArrowRight, BookOpen, Users, ShieldCheck, BarChart3, GraduationCap, Star, Sparkles, Zap, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const features = [
    { icon: Users, label: "Data Santri", desc: "Manajemen data induk & digitalisasi arsip santri.", color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: BookOpen, label: "Akademik", desc: "Sistem penilaian, rapor digital, & kontrol kurikulum.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: ShieldCheck, label: "Perizinan", desc: "Kontrol keluar-masuk santri dengan notifikasi real-time.", color: "text-purple-400", bg: "bg-purple-500/10" },
    { icon: BarChart3, label: "Keuangan", desc: "Monitoring SPP, donasi, & laporan cashflow transparan.", color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: GraduationCap, label: "Asrama", desc: "Manajemen kamar, absensi jamaah, & poin kedisiplinan.", color: "text-rose-400", bg: "bg-rose-500/10" },
    { icon: Star, label: "Multi-Role", desc: "Akses granular untuk Pengasuh, Asatidz, hingga Admin IT.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 selection:bg-teal-500/30 overflow-x-hidden relative">

      {/* ── Background Elements ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl group-hover:border-teal-500/50 transition-all duration-500 shadow-2xl">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="text-white font-black text-sm uppercase tracking-[.3em] block leading-none mb-1">Sukahideng</span>
            <span className="text-teal-500/60 font-black text-[9px] uppercase tracking-widest block leading-none">Intelligence System</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/login" className="hidden sm:block text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Documentation</Link>
          <Link href="/login">
            <Button size="sm" className="h-10 px-6 rounded-2xl bg-white text-slate-950 hover:bg-teal-500 hover:text-white font-black text-[10px] uppercase tracking-widest gap-2 shadow-2xl transition-all active:scale-95 group">
              Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero section ── */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-40">
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          
          <Badge variant="outline" className="h-8 px-5 rounded-full border-teal-500/20 bg-teal-500/5 text-teal-400 font-black text-[10px] uppercase tracking-[.3em] gap-2 shadow-2xl backdrop-blur-md">
            <Sparkles className="w-3 h-3 animate-pulse" /> Platform Terpadu v2.0
          </Badge>

          <h1 className="text-5xl md:text-8xl font-black leading-[0.95] tracking-tight text-white max-w-5xl">
            Digitalisasi Masa Depan <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-blue-500 to-indigo-500 animate-gradient-x">Pesantren Modern.</span>
          </h1>

          <p className="text-slate-400 text-sm md:text-lg max-w-2xl font-medium leading-relaxed italic">
            "Sistem Informasi Manajemen Terpadu yang dirancang khusus untuk skalabilitas, transparansi, dan efisiensi operasional Pondok Pesantren Sukahideng."
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link href="/login">
              <Button className="h-14 px-10 rounded-[2rem] bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-widest gap-3 shadow-[0_20px_50px_rgba(20,184,166,0.3)] border-teal-500/20 transition-all hover:scale-105 active:scale-95 group">
                Mulai Digitalisasi <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="ghost" className="h-14 px-8 rounded-[2rem] text-slate-400 hover:text-white hover:bg-white/5 font-black text-xs uppercase tracking-widest gap-2">
              Pelajari Fitur <Zap className="w-4 h-4" />
            </Button>
          </div>

          {/* Social Proof / Stats */}
          <div className="pt-20 grid grid-cols-2 md:grid-cols-4 gap-12 border-t border-white/5 w-full mt-20">
             <div className="space-y-1">
                <p className="font-black text-3xl tabular-nums text-white">40+</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modul Terintegrasi</p>
             </div>
             <div className="space-y-1">
                <p className="font-black text-3xl tabular-nums text-white">7</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Otoritas Pengguna</p>
             </div>
             <div className="space-y-1">
                <p className="font-black text-3xl tabular-nums text-white">100%</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Uptime Cloud System</p>
             </div>
             <div className="space-y-1">
                <p className="font-black text-3xl tabular-nums text-white">∞</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Limitless Database</p>
             </div>
          </div>
        </div>

        {/* ── Features Grid ── */}
        <div id="features" className="pt-60 space-y-20">
          <div className="text-center space-y-4">
            <Badge variant="outline" className="font-black text-[9px] uppercase tracking-[.4em] border-slate-800 text-slate-500">Core Capabilities</Badge>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Ekosistem Manajemen Cerdas</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="group relative p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-teal-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/10 hover:-translate-y-2">
                <div className={cn("inline-flex p-4 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner", f.bg)}>
                  <f.icon className={cn("w-6 h-6", f.color)} />
                </div>
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">{f.label}</h3>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">{f.desc}</p>
                
                <div className="absolute top-6 right-8 text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-teal-500 transition-colors">
                  0{i+1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 bg-black/50 backdrop-blur-3xl py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
             <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain opacity-50" />
             <span className="text-slate-600 font-black text-[10px] uppercase tracking-[.3em]">© 2025 Pesantren Sukahideng · Intelligence</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-teal-500 transition-colors">Privacy</Link>
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-teal-500 transition-colors">Terms</Link>
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-teal-500 transition-colors">Support</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
