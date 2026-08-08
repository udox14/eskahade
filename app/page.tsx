import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { getPortalSession } from '@/lib/portal/session'
import TypingHero from '@/components/shared/typing-hero'
import FeaturesDrawer from '@/components/shared/features-drawer'
import {
  ArrowRight,
  LayoutDashboard,
  LogIn,
  UsersRound,
  ShieldCheck,
  CalendarCheck2,
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  Building,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'ESKAHADE — Sistem Informasi Manajemen Pondok Pesantren Sukahideng',
  description:
    'Satu portal digital terpadu Pondok Pesantren Sukahideng untuk administrasi, akademik, keasramaan, tahfidz, keuangan, dan portal orang tua.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const staffSession = await getSession()
  const portalSession = await getPortalSession()

  const isStaff = Boolean(staffSession)
  const isParent = Boolean(portalSession)

  const primaryHref = isStaff
    ? '/dashboard'
    : isParent
    ? '/portal-ortu'
    : '/login'
  const primaryLabel = isStaff
    ? 'Buka Dashboard Internal'
    : isParent
    ? 'Buka Portal Orang Tua'
    : 'Masuk Portal Internal'

  const PrimaryIcon = isStaff || isParent ? LayoutDashboard : LogIn
  const year = new Date().getFullYear()

  return (
    <div className="public-theme h-[100dvh] w-screen overflow-hidden bg-[#fffdf8] text-[#1c2923] relative flex flex-col justify-between font-sans selection:bg-[#247451] selection:text-white">
      
      {/* Decorative Topographic Waves Pattern Overlay */}
      <div className="absolute inset-0 bg-pattern-waves pointer-events-none z-10 opacity-70" />

      {/* Decorative Glowing Blur Blobs */}
      <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-[#12372a]/10 blur-[100px] pointer-events-none animate-blob-1 z-0" />
      <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full bg-[#247451]/10 blur-[120px] pointer-events-none animate-blob-2 z-0" />
      <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#c9952e]/10 blur-[100px] pointer-events-none z-0" />

      {/* Main Container */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-10 lg:px-12 flex items-center justify-center overflow-hidden py-3 sm:py-4 lg:py-0">
        
        {/* Responsive Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center">
          
          {/* Column Left: Brand / Title / Hero & Buttons */}
          <div className="lg:col-span-7 flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-3.5 sm:space-y-4 lg:space-y-5 max-w-xl mx-auto lg:mx-0">

            {/* Brand Identity (Plain Bold Logo) */}
            <div className="flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left gap-2.5 sm:gap-3.5">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 shrink-0 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                <Image
                  src="/logo.png"
                  alt="Logo Sukahideng"
                  width={80}
                  height={80}
                  className="h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 object-contain"
                  priority
                />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <h2 className="text-xs sm:text-sm lg:text-base font-black tracking-[0.16em] text-[#12372a] uppercase leading-tight">
                  PONDOK PESANTREN <br className="hidden lg:block" />
                  SUKAHIDENG
                </h2>
                <p className="text-[11px] sm:text-xs font-semibold text-[#66736c] tracking-wide">
                  Sukarapih - Sukarame - Tasikmalaya - Jawa Barat
                </p>
              </div>
            </div>

            {/* Main Heading & Subtitle */}
            <div className="space-y-1 sm:space-y-1.5 w-full flex flex-col items-center lg:items-start">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#12372a] whitespace-nowrap leading-none">
                ESKAHADE
              </h1>
              <div className="text-xs sm:text-sm lg:text-lg font-extrabold text-[#247451] tracking-wide leading-snug uppercase">
                <div>SISTEM INFORMASI MANAJEMEN</div>
                <div>PONDOK PESANTREN SUKAHIDENG</div>
              </div>
              
              {/* Dynamic Typing Subtext */}
              <div className="text-xs sm:text-sm lg:text-base min-h-[1.8em] leading-relaxed text-[#66736c] font-semibold px-2 lg:px-0 pt-0.5">
                <TypingHero />
              </div>
            </div>

            {/* Brief Description */}
            <p className="text-xs sm:text-sm leading-relaxed text-[#66736c] font-medium max-w-md mx-auto lg:mx-0">
              Platform digital terpadu untuk pengelolaan data santri, presensi shalat berjamaah, perizinan asrama, setoran hafalan, hingga transparansi portal informasi wali santri.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-1 justify-center lg:justify-start w-full max-w-md mx-auto lg:mx-0">
              {staffSession || portalSession ? (
                <Link
                  href={primaryHref}
                  className="inline-flex h-12 sm:h-13 lg:h-14 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl sm:rounded-2xl bg-[#12372a] px-7 text-sm sm:text-base font-extrabold text-white shadow-xl shadow-[#12372a]/20 hover:bg-[#09251c] hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
                >
                  <PrimaryIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#c9952e]" />
                  <span>{primaryLabel}</span>
                  <ArrowRight className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </Link>
              ) : (
                <>
                  {/* Login Internal */}
                  <Link
                    href="/login"
                    className="inline-flex h-12 sm:h-13 lg:h-14 w-full sm:w-auto items-center justify-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-[#12372a] px-6 sm:px-7 text-sm sm:text-base font-extrabold text-white shadow-xl shadow-[#12372a]/20 hover:bg-[#09251c] hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
                  >
                    <LogIn className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#c9952e]" />
                    <span>Portal Internal</span>
                    <ArrowRight className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </Link>

                  {/* Login Orang Tua */}
                  <Link
                    href="/portal-ortu/login"
                    className="inline-flex h-12 sm:h-13 lg:h-14 w-full sm:w-auto items-center justify-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-white border border-[#ddd4c3] px-6 sm:px-7 text-sm sm:text-base font-extrabold text-[#12372a] shadow-sm hover:bg-[#f7f1e5]/60 hover:border-[#247451]/50 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
                  >
                    <UsersRound className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#247451]" />
                    <span>Portal Orang Tua</span>
                    <ArrowRight className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#66736c]" />
                  </Link>
                </>
              )}
            </div>

          </div>

          {/* Column Right: High-Fidelity Sukahideng Smartphone Mockup (Visible on Desktop) */}
          <div className="hidden lg:col-span-5 lg:flex items-center justify-center relative select-none">
            
            {/* Phone Shell Wrapper */}
            <div className="relative w-full max-w-[285px] max-h-[calc(100dvh-7rem)] aspect-[9/18.5] bg-[#09251c] rounded-[3rem] p-3.5 shadow-2xl shadow-[#12372a]/30 border-4 border-[#12372a] overflow-hidden animate-float">
              
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-[#09251c] rounded-b-2xl z-50 flex items-center justify-center">
                <div className="w-12 h-1 bg-[#12372a] rounded-full" />
              </div>
              
              {/* Screen Interior Content */}
              <div className="w-full h-full bg-[#f7f1e5]/90 rounded-[2.5rem] overflow-hidden flex flex-col justify-between p-3.5 pt-8 text-[#1c2923] relative">
                
                {/* Mock Header */}
                <div className="flex justify-between items-center mb-2.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <Image src="/logo.png" alt="Logo" width={16} height={16} className="h-4 w-4 object-contain" />
                    <span className="text-[10px] font-black text-[#12372a] tracking-tight">ESKAHADE Mobile</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#247451] animate-ping" />
                    <span className="text-[7px] font-bold text-[#247451]">Sinkron</span>
                  </div>
                </div>

                {/* Widget 1: Shalat Berjamaah & Presensi */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-[#ddd4c3]/60 flex-1 flex flex-col justify-between max-h-[135px] mb-2.5">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-bold text-[#66736c] uppercase tracking-wider">HARI INI — SHALAT SUBUH</span>
                      <span className="text-[7px] font-bold text-[#247451] bg-[#dcecdf] px-1.5 py-0.5 rounded-full">Komplit</span>
                    </div>
                    <div className="text-xs font-black text-[#12372a] mt-0.5">Presensi Berjamaah Santri</div>
                  </div>
                  
                  <div className="my-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-[#12372a]">98.2%</span>
                    <span className="text-[7px] font-bold text-[#247451] bg-[#dcecdf] px-1.5 py-0.5 rounded">+0.5% dari kemarin</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#f7f1e5]/60 border border-[#ddd4c3]/30">
                      <CheckCircle2 className="h-2.5 w-2.5 text-[#247451]" />
                      <div className="text-[7px] font-bold text-[#12372a]">1,420 Santri Terabsen Berjamaah</div>
                    </div>
                  </div>
                </div>

                {/* Widget 2: Setoran Hafalan Al-Qur'an */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-[#ddd4c3]/60 flex-1 flex flex-col justify-between max-h-[115px] mb-2.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] font-bold text-[#66736c] uppercase tracking-wider">TAHFIDZ & ZIYADAH</span>
                    <BookOpenCheck className="h-3.5 w-3.5 text-[#c9952e]" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-bold text-[#12372a]">Surah Al-Baqarah: Ayat 120-141</div>
                    <div className="text-[7px] font-semibold text-[#66736c]">Pembimbing: Ust. Ahmad Fauzi</div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[7px] font-bold text-[#12372a] bg-[#f7f1e5] border border-[#ddd4c3] px-1.5 py-0.5 rounded">
                      Capaian: Juz 2
                    </span>
                    <span className="text-[7px] font-bold text-[#c9952e] bg-[#f1e2b8]/40 px-1.5 py-0.5 rounded">
                      Nilai: Mumtaz
                    </span>
                  </div>
                </div>

                {/* Widget 3: Info Pesantren & Asrama */}
                <div className="rounded-xl bg-[#12372a] p-2.5 text-white shadow-sm flex flex-col justify-between mb-2 border border-[#09251c]">
                  <div className="flex items-center gap-1">
                    <Building className="h-3 w-3 text-[#c9952e]" />
                    <span className="text-[8px] font-bold text-[#f1e2b8] uppercase tracking-wider">INFO KESANTRIAN & ASRAMA</span>
                  </div>
                  <p className="text-[8.5px] font-medium leading-tight text-[#dcecdf] mt-1">
                    Seluruh perizinan santri & data hafalan terpantau real-time oleh pengurus dan wali santri.
                  </p>
                </div>

                {/* Screen Bottom Menu */}
                <div className="pt-2 border-t border-[#ddd4c3]/50 flex justify-around text-[#66736c]">
                  <div className="flex flex-col items-center gap-0.5 text-[#12372a]">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Beranda</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Building className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Asrama</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <UsersRound className="h-3.5 w-3.5" />
                    <span className="text-[7px] font-extrabold">Portal Ortu</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* Screen Footer */}
      <footer className="relative z-30 shrink-0 py-2.5 sm:py-3 border-t border-[#ddd4c3]/40 text-center text-[10px] sm:text-xs font-bold text-[#66736c] bg-[#fffdf8]/80 backdrop-blur-sm">
        <span>&copy; {year} Pondok Pesantren Sukahideng.</span>
      </footer>

    </div>
  )
}
