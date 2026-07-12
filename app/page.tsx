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
  { icon: UsersRound, title: "Data Santri", text: "Pusat data terintegrasi yang akurat dan mudah diakses." },
  { icon: BookOpenText, title: "Akademik", text: "Pantau perkembangan nilai, hafalan, dan absensi kelas." },
  { icon: Building2, title: "Asrama", text: "Manajemen kamar, perizinan, dan kegiatan keseharian." },
  { icon: CreditCard, title: "Keuangan", text: "Informasi tagihan dan pembayaran yang transparan." },
  { icon: ShieldCheck, title: "Kesantrian", text: "Pembinaan karakter dan keamanan kedisiplinan santri." },
  { icon: ChartNoAxesCombined, title: "Pelaporan", text: "Rekapitulasi otomatis untuk evaluasi menyeluruh." },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="public-theme min-h-dvh flex flex-col bg-white">
      {/* HEADER - No login buttons here to keep it clean as requested */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--public-leaf)] rounded-md">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="h-10 w-10 object-contain" priority />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--public-leaf)]">ESKAHADE</span>
              <span className="block text-sm font-bold text-gray-900">Pesantren Sukahideng</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <a href="#fitur" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Fitur Utama</a>
            <a href="#akses" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pilihan Akses</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative px-5 py-16 sm:px-8 sm:py-24 lg:py-32 overflow-hidden bg-gray-50/50">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-3xl mx-auto public-rise">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--public-leaf)]">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                Sistem Informasi Terpadu
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
                Sistem Informasi Terpadu <br className="hidden sm:block" />
                <span className="text-[var(--public-leaf)]">Pesantren Sukahideng</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Platform digital untuk mempermudah pengelolaan administrasi pesantren dan memberikan transparansi informasi bagi orang tua santri.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login" className="flex items-center justify-center gap-2 rounded-xl bg-[var(--public-leaf)] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1d6345] w-full sm:w-auto shadow-sm">
                  Login Pengurus <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <Link href="/portal-ortu/login" className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 w-full sm:w-auto shadow-sm">
                  <CircleUserRound aria-hidden className="h-4 w-4" /> Login Orang Tua
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-gray-500">
                {['Tampilan Responsif', 'Data Terintegrasi', 'Keamanan Terjamin'].map(item => (
                  <span key={item} className="flex items-center gap-1.5"><CheckCircle2 aria-hidden className="h-4 w-4 text-[var(--public-leaf)]" />{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="fitur" className="py-20 sm:py-24 bg-white px-5 sm:px-8 border-t border-gray-100">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Layanan Terintegrasi</h2>
              <p className="text-gray-600">Seluruh data administrasi, akademik, dan keuangan dikelola dalam satu platform yang saling terhubung.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-gray-200">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[var(--public-leaf)]">
                    <Icon aria-hidden className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PORTAL ACCESS SECTION */}
        <section id="akses" className="py-20 sm:py-24 bg-gray-50/50 px-5 sm:px-8 border-t border-gray-100">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Pilih Portal Akses</h2>
              <p className="text-gray-600">Gunakan portal sesuai dengan peran Anda di Pesantren Sukahideng.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-white border border-gray-100 p-8 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--public-leaf)]">
                    <LayoutDashboard aria-hidden className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Portal Pengurus</h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">Akses untuk pengurus pesantren mengelola operasional harian, data santri, dan laporan secara real-time.</p>
                </div>
                <Link href="/login" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--public-leaf)] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1d6345]">
                  Masuk sebagai Pengurus <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl bg-white border border-gray-100 p-8 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-700">
                    <CircleUserRound aria-hidden className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Portal Orang Tua</h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">Akses untuk wali santri memantau perkembangan nilai, absensi, dan riwayat pembayaran.</p>
                </div>
                <Link href="/portal-ortu/login" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:border-gray-300">
                  Masuk sebagai Orang Tua <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="h-8 w-8 opacity-80" />
            <p className="text-xs font-semibold text-gray-500">© {year} Pondok Pesantren Sukahideng</p>
          </div>
          <p className="text-xs text-gray-500 font-medium">Sistem Informasi Manajemen Terpadu</p>
        </div>
      </footer>
    </div>
  );
}

