import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ESKAHADE — Sistem Informasi Pesantren Sukahideng",
  description:
    "Sistem informasi terpadu Pondok Pesantren Sukahideng untuk pengurus dan orang tua santri.",
};

const modules = [
  { icon: UsersRound, title: "Data Santri", text: "Pusat data terintegrasi yang akurat dan mudah diakses kapan saja." },
  { icon: BookOpenText, title: "Akademik", text: "Pantau perkembangan nilai, target hafalan, dan presensi." },
  { icon: Building2, title: "Asrama", text: "Manajemen asrama, perizinan, dan aktivitas keseharian santri." },
  { icon: CreditCard, title: "Keuangan", text: "Informasi tagihan dan pembayaran yang transparan dan tertib." },
  { icon: ShieldCheck, title: "Kesantrian", text: "Pembinaan karakter dan keamanan rekam jejak kedisiplinan." },
  { icon: ChartNoAxesCombined, title: "Pelaporan", text: "Rekapitulasi terotomatisasi untuk pengambilan keputusan." },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="public-theme min-h-dvh flex flex-col bg-[var(--public-cream)] overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[var(--public-line)]/50 bg-[var(--public-cream)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-lg transition-transform hover:scale-105 active:scale-95">
            <Image src="/logo.png" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <div>
              <span className="block text-[10px] font-extrabold uppercase tracking-[.24em] text-[var(--public-leaf)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-[var(--public-forest)]">Pesantren Sukahideng</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 sm:flex">
            <a href="#fitur" className="text-sm font-bold text-[var(--public-muted)] hover:text-[var(--public-forest)] transition-colors">Layanan</a>
            <a href="#akses" className="text-sm font-bold text-[var(--public-muted)] hover:text-[var(--public-forest)] transition-colors">Akses Portal</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative px-5 py-16 sm:px-8 sm:py-24 lg:py-32 bg-[var(--public-forest)] text-white overflow-hidden rounded-b-[3rem] shadow-[0_20px_50px_rgba(18,55,42,.15)]">
          {/* Subtle Texture for Premium feel without being AI Slop */}
          <div className="public-grid absolute inset-0 opacity-40 mix-blend-overlay" />
          <div className="public-noise absolute inset-0 opacity-[.05] mix-blend-soft-light" />
          <div className="absolute top-0 right-0 h-[40rem] w-[40rem] -translate-y-1/2 translate-x-1/3 rounded-full bg-[var(--public-leaf)]/30 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-[40rem] w-[40rem] translate-y-1/3 -translate-x-1/4 rounded-full bg-[var(--public-gold)]/20 blur-[120px] pointer-events-none" />

          <div className="mx-auto max-w-7xl relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
            <div className="flex-1 text-center lg:text-left public-rise">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--public-gold-light)] backdrop-blur-sm">
                <ShieldCheck aria-hidden className="h-4 w-4" />
                Sistem Informasi Terpadu
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-[1.1] public-display">
                Manajemen Modern <br className="hidden lg:block" />
                <span className="text-[var(--public-gold)]">Pesantren Sukahideng</span>
              </h1>
              <p className="text-base sm:text-lg text-white/70 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Platform digital untuk mempermudah operasional kepengurusan dan mendekatkan orang tua dengan perjalanan pendidikan putra-putrinya.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link href="/login" className="group flex items-center justify-center gap-2 rounded-2xl bg-[var(--public-gold)] px-7 py-4 text-sm font-extrabold text-[var(--public-forest-deep)] transition-all hover:bg-[var(--public-gold-light)] hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(201,149,46,.3)] w-full sm:w-auto">
                  Login Pengurus <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/portal-ortu/login" className="group flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-sm font-extrabold text-white transition-all hover:bg-white/10 hover:-translate-y-1 backdrop-blur-sm w-full sm:w-auto">
                  <CircleUserRound aria-hidden className="h-4 w-4" /> Login Orang Tua
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full max-w-md lg:max-w-lg public-rise public-rise-delay">
              <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-3xl opacity-50" />
                <div className="relative grid grid-cols-2 gap-4">
                  {[
                    { label: 'Akademik', value: 'Terpadu', icon: BookOpenText },
                    { label: 'Pelayanan', value: 'Efisien', icon: UsersRound },
                    { label: 'Keuangan', value: 'Transparan', icon: CreditCard },
                    { label: 'Keamanan', value: 'Terjamin', icon: ShieldCheck },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex flex-col items-start rounded-2xl bg-[var(--public-forest-deep)]/50 p-5 border border-white/5 transition-transform hover:-translate-y-1">
                      <Icon className="h-6 w-6 text-[var(--public-gold)] mb-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</span>
                      <span className="font-semibold text-white mt-1">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="fitur" className="py-24 lg:py-32 bg-[var(--public-cream)] px-5 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--public-leaf)] mb-3">Layanan Terintegrasi</p>
                <h2 className="text-3xl sm:text-4xl font-semibold text-[var(--public-forest)] public-display leading-tight">Satu platform untuk seluruh siklus administrasi santri.</h2>
              </div>
              <p className="text-[var(--public-muted)] max-w-md font-medium leading-relaxed">Dari pendaftaran, pendataan asrama, hingga laporan hasil belajar, semuanya terkoneksi demi efisiensi.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ icon: Icon, title, text }, idx) => (
                <div key={title} className="group relative overflow-hidden rounded-[2rem] bg-[var(--public-paper)] p-8 border border-[var(--public-line)]/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(18,55,42,.08)] hover:border-[var(--public-leaf)]/30">
                  <div className="absolute top-0 right-0 p-8 opacity-5 font-bold text-6xl pointer-events-none group-hover:opacity-10 transition-opacity">0{idx + 1}</div>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--public-leaf-light)] text-[var(--public-leaf)] transition-transform group-hover:scale-110">
                    <Icon aria-hidden className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--public-forest)] mb-3">{title}</h3>
                  <p className="text-sm text-[var(--public-muted)] leading-relaxed font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PORTAL ACCESS SECTION */}
        <section id="akses" className="py-24 lg:py-32 bg-[var(--public-paper)] px-5 sm:px-8 border-t border-[var(--public-line)]/50">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-semibold text-[var(--public-forest)] mb-4 public-display">Pilih Portal Akses</h2>
              <p className="text-[var(--public-muted)] font-medium">Gunakan portal sesuai dengan peran Anda di pesantren.</p>
            </div>
            
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--public-forest)] p-8 sm:p-12 text-white transition-transform hover:-translate-y-2 shadow-xl shadow-[var(--public-forest)]/20">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-30" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[var(--public-gold)] text-[var(--public-forest-deep)] shadow-lg shadow-[var(--public-gold)]/20">
                      <LayoutDashboard aria-hidden className="h-8 w-8" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/50 mb-2">Internal Pesantren</p>
                    <h3 className="text-3xl font-semibold mb-4 public-display">Portal Pengurus</h3>
                    <p className="text-white/70 mb-10 leading-relaxed font-medium">Sistem untuk staf dan pengurus mengelola operasional harian, data asrama, dan pelaporan secara real-time.</p>
                  </div>
                  <Link href="/login" className="inline-flex w-full sm:w-fit items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-extrabold text-[var(--public-forest)] transition hover:bg-[var(--public-gold-light)] hover:scale-[1.02]">
                    Masuk Pengurus <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--public-cream)] p-8 sm:p-12 border border-[var(--public-line)] transition-transform hover:-translate-y-2 shadow-xl shadow-[var(--public-line)]/30">
                <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-[var(--public-leaf-light)] blur-[80px]" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white text-[var(--public-leaf)] shadow-sm border border-[var(--public-line)]/50">
                      <CircleUserRound aria-hidden className="h-8 w-8" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--public-muted)] mb-2">Wali Santri</p>
                    <h3 className="text-3xl font-semibold text-[var(--public-forest)] mb-4 public-display">Portal Orang Tua</h3>
                    <p className="text-[var(--public-muted)] mb-10 leading-relaxed font-medium">Akses bagi wali santri untuk memantau perkembangan akademik, absensi, serta riwayat keuangan.</p>
                  </div>
                  <Link href="/portal-ortu/login" className="inline-flex w-full sm:w-fit items-center justify-center gap-2 rounded-xl bg-[var(--public-leaf)] px-8 py-4 text-sm font-extrabold text-white transition hover:bg-[#1d6345] hover:scale-[1.02] shadow-lg shadow-[var(--public-leaf)]/20">
                    Masuk Orang Tua <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[var(--public-forest-deep)] px-5 py-12 sm:px-8 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/5 p-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Pondok Pesantren Sukahideng</p>
              <p className="text-[10px] text-white/50">Sistem Informasi Manajemen Terpadu</p>
            </div>
          </div>
          <p className="text-[11px] text-white/40 font-medium tracking-wide">© {year} ESKAHADE. Seluruh Hak Cipta Dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}

