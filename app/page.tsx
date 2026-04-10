import Link from "next/link";
import { ArrowRight, BookOpen, Users, ShieldCheck, BarChart3, GraduationCap, Star } from "lucide-react";

export default function LandingPage() {
  const features = [
    { icon: Users, label: "Data Santri", desc: "Manajemen data induk lengkap" },
    { icon: BookOpen, label: "Akademik", desc: "Nilai, rapor & absensi" },
    { icon: ShieldCheck, label: "Keamanan", desc: "Perizinan & pelanggaran" },
    { icon: BarChart3, label: "Keuangan", desc: "SPP & laporan keuangan" },
    { icon: GraduationCap, label: "Asrama", desc: "Absen & layanan asrama" },
    { icon: Star, label: "Multi-Role", desc: "Akses sesuai wewenang" },
  ];

  return (
    <div className="min-h-screen bg-[#0a1a0f] font-sans overflow-x-hidden" style={{ fontFamily: "'Georgia', serif" }}>

      {/* ── Noise texture overlay ── */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* ── Radial glow bg ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #ca8a04 0%, transparent 70%)" }} />
      </div>

      {/* ── HERO ── */}
      <main className="relative z-10 min-h-screen flex flex-col">

        {/* Topbar */}
        <nav className="flex items-center justify-between px-8 md:px-16 py-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-lg" />
            <span className="text-emerald-400 font-bold text-sm tracking-widest uppercase" style={{ fontFamily: "sans-serif" }}>
              Sukahideng
            </span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition-colors border border-white/10 hover:border-emerald-500/50 px-4 py-2 rounded-full"
            style={{ fontFamily: "sans-serif" }}
          >
            Masuk <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>

        {/* Hero content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-700/40 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-10 tracking-widest uppercase"
            style={{ fontFamily: "sans-serif" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistem Informasi Manajemen
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] mb-6 tracking-tight">
            Pondok Pesantren
            <br />
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #4ade80 0%, #fbbf24 50%, #4ade80 100%)", backgroundSize: "200% auto", animation: "shimmer 4s linear infinite" }}>
                Sukahideng
              </span>
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-white/50 text-lg md:text-xl max-w-2xl leading-relaxed mb-14"
            style={{ fontFamily: "sans-serif", fontStyle: "italic" }}>
            "Membangun generasi Qur'ani yang berakhlak mulia, cerdas, dan mandiri
            melalui sistem pendidikan terpadu."
          </p>

          {/* CTA */}
          <Link
            href="/login"
            className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-bold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{
              fontFamily: "sans-serif",
              background: "linear-gradient(135deg, #15803d, #166534)",
              boxShadow: "0 0 40px rgba(22,163,74,0.3)"
            }}
          >
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }} />
            <span className="relative">Masuk ke Dashboard</span>
            <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <p className="mt-5 text-xs text-white/25" style={{ fontFamily: "sans-serif" }}>
            Khusus staf & pengurus yang berwenang
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="relative px-8 md:px-16 mb-0">
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-800/50 to-transparent" />
        </div>

        {/* ── Features strip ── */}
        <div className="relative z-10 bg-[#0d1f12]/80 backdrop-blur-sm border-t border-emerald-900/30 px-8 md:px-16 py-10">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center group-hover:border-emerald-500/50 group-hover:bg-emerald-900/50 transition-all duration-300">
                  <Icon className="w-5 h-5 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <span className="text-white/80 text-xs font-bold" style={{ fontFamily: "sans-serif" }}>{label}</span>
                <span className="text-white/30 text-[10px] leading-tight" style={{ fontFamily: "sans-serif" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-center py-5 border-t border-white/5">
          <p className="text-white/20 text-xs" style={{ fontFamily: "sans-serif" }}>
            © 2025 Pesantren Sukahideng · Powered by Sukahideng App
          </p>
        </div>

      </main>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

    </div>
  );
}
