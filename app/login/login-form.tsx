'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { login } from "@/app/login/actions"
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (formData: FormData) => {
    setIsSubmitting(true)
    const res = await login(formData)
    if (res?.error) {
      setIsSubmitting(false)
      toast.error("Login Gagal", { description: res.error })
      return
    }
    toast.success("Berhasil Login", { description: "Mengalihkan ke dashboard..." })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex font-sans" style={{ fontFamily: "'Georgia', serif" }}>

      {/* ── Noise texture ── */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* ── LEFT PANEL — branding ── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-16 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #052e10 0%, #0a1a0f 40%, #071810 100%)" }}>

        {/* Glow */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none opacity-25"
          style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 65%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full pointer-events-none opacity-10"
          style={{ background: "radial-gradient(circle, #ca8a04 0%, transparent 65%)" }} />

        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <Link href="/">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-xl hover:scale-105 transition-transform" />
          </Link>
          <div>
            <div className="text-emerald-400 text-[10px] font-bold tracking-[0.25em] uppercase mb-0.5" style={{ fontFamily: "sans-serif" }}>
              Sistem Informasi
            </div>
            <div className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: "sans-serif" }}>
              Pesantren Sukahideng
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/30 text-emerald-400 text-[10px] font-semibold px-3 py-1 rounded-full mb-8 tracking-widest uppercase" style={{ fontFamily: "sans-serif" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Manajemen Terpadu
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
            Kelola Pesantren
            <br />
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #4ade80, #fbbf24)" }}>
              Lebih Cerdas
            </span>
          </h1>

          <p className="text-white/45 text-base leading-relaxed max-w-md" style={{ fontFamily: "sans-serif", fontStyle: "italic" }}>
            "Sistem informasi manajemen terpadu untuk santri, akademik,
            asrama, keuangan, dan keamanan pesantren."
          </p>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { val: "7", label: "Role Pengguna" },
              { val: "40+", label: "Fitur Lengkap" },
              { val: "∞", label: "Data Santri" },
            ].map(({ val, label }) => (
              <div key={label} className="border-l-2 border-emerald-700/50 pl-4">
                <div className="text-2xl font-bold text-emerald-400">{val}</div>
                <div className="text-white/40 text-xs mt-0.5" style={{ fontFamily: "sans-serif" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer left */}
        <div className="relative z-10 text-white/20 text-xs" style={{ fontFamily: "sans-serif" }}>
          © 2025 Pesantren Sukahideng
        </div>
      </div>

      {/* ── RIGHT PANEL — login form ── */}
      <div className="flex-1 flex items-center justify-center bg-[#f8faf8] relative p-6">

        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.4]"
          style={{ backgroundImage: "radial-gradient(circle, #d1fae5 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative z-10 w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/">
              <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain mx-auto mb-3" />
            </Link>
            <h2 className="text-xl font-bold text-slate-800">Pesantren Sukahideng</h2>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Selamat Datang</h2>
              <p className="text-slate-400 text-sm" style={{ fontFamily: "sans-serif" }}>
                Masuk untuk mengakses dashboard manajemen
              </p>
            </div>

            {/* Form */}
            <form action={handleLogin} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" style={{ fontFamily: "sans-serif" }}>
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="email@pesantren.com"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 disabled:opacity-60"
                    style={{ fontFamily: "sans-serif" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" style={{ fontFamily: "sans-serif" }}>
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 disabled:opacity-60"
                    style={{ fontFamily: "sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                style={{
                  fontFamily: "sans-serif",
                  background: "linear-gradient(135deg, #15803d, #166534)",
                  boxShadow: "0 4px 20px rgba(22,163,74,0.25)"
                }}
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                  : <><ArrowRight className="w-4 h-4" /> Masuk Dashboard</>
                }
              </button>

            </form>

            {/* Divider */}
            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-300" style={{ fontFamily: "sans-serif" }}>
                  Butuh bantuan?
                </span>
              </div>
            </div>

            {/* Contact */}
            <a
              href="https://wa.me/6282218943383"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors"
              style={{ fontFamily: "sans-serif" }}
            >
              <ShieldCheck className="w-4 h-4" />
              Hubungi Admin IT untuk reset password
            </a>

          </div>

          {/* Back to home */}
          <div className="text-center mt-6">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors" style={{ fontFamily: "sans-serif" }}>
              ← Kembali ke halaman utama
            </Link>
          </div>

        </div>
      </div>

    </div>
  )
}
