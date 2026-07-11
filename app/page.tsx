import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleUserRound,
  CreditCard,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ESKAHADE — Sistem Informasi Pesantren Sukahideng",
  description:
    "Sistem informasi terpadu Pondok Pesantren Sukahideng untuk pengurus dan orang tua santri.",
};

const modules = [
  { icon: UsersRound, title: "Data Santri", text: "Data induk yang rapi, aman, dan mudah ditelusuri." },
  { icon: BookOpenText, title: "Akademik", text: "Nilai, rapor, hafalan, dan perkembangan belajar." },
  { icon: Building2, title: "Asrama", text: "Kehadiran, layanan, kamar, dan aktivitas keseharian." },
  { icon: CreditCard, title: "Keuangan", text: "Tagihan, pembayaran, dan laporan yang transparan." },
  { icon: ShieldCheck, title: "Kesantrian", text: "Perizinan, keamanan, dan pembinaan santri." },
  { icon: ChartNoAxesCombined, title: "Pelaporan", text: "Ringkasan data untuk keputusan yang lebih tepat." },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="public-theme min-h-dvh overflow-x-hidden">
      <header className="relative z-20 border-b border-[var(--public-line)]/80 bg-[var(--public-cream)]/90 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12" aria-label="Navigasi utama">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--public-gold)]">
            <Image src="/logo.png" alt="Logo Pondok Pesantren Sukahideng" width={52} height={52} className="h-12 w-12 object-contain" priority />
            <div className="leading-tight">
              <span className="block text-[10px] font-extrabold uppercase tracking-[.24em] text-[var(--public-leaf)]">ESKAHADE</span>
              <span className="block text-sm font-extrabold text-[var(--public-forest)] sm:text-base">Pesantren Sukahideng</span>
            </div>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            <a href="#fitur" className="text-sm font-bold text-[var(--public-muted)] transition hover:text-[var(--public-forest)]">Fitur</a>
            <a href="#akses" className="text-sm font-bold text-[var(--public-muted)] transition hover:text-[var(--public-forest)]">Akses Portal</a>
            <Link href="/portal-ortu/login" className="public-button public-button-secondary">Login Orang Tua</Link>
            <Link href="/login" className="public-button public-button-primary">Login Pengurus <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/portal-ortu/login" className="public-button public-button-secondary px-3 text-xs sm:px-4" aria-label="Login Orang Tua">Orang Tua</Link>
            <Link href="/login" className="public-button public-button-primary px-3 text-xs sm:px-4" aria-label="Login Pengurus Pesantren">Pengurus</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[var(--public-cream)]">
          <div className="pointer-events-none absolute -right-44 -top-40 h-[34rem] w-[34rem] rounded-full bg-[var(--public-gold-light)]/55 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-48 -left-52 h-[36rem] w-[36rem] rounded-full bg-[var(--public-leaf-light)] blur-3xl" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:px-12 lg:py-28">
            <div className="public-rise relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--public-gold)]/30 bg-[var(--public-paper)]/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-[var(--public-forest)]">
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-[var(--public-gold)]" />
                Sistem Informasi Pesantren Terpadu
              </div>
              <h1 className="public-display max-w-3xl text-[clamp(3rem,7vw,6.6rem)] font-semibold leading-[.93] tracking-[-.045em] text-[var(--public-forest)]">
                Merawat amanah, <span className="text-[var(--public-leaf)]">menguatkan pendidikan.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--public-muted)] sm:text-lg">
                ESKAHADE menyatukan pengelolaan santri, akademik, asrama, keamanan, dan keuangan dalam satu layanan yang dekat bagi pengurus dan orang tua.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="public-button public-button-primary px-6 py-4 text-base">Login Pengurus Pesantren <ArrowRight aria-hidden className="h-5 w-5" /></Link>
                <Link href="/portal-ortu/login" className="public-button public-button-secondary px-6 py-4 text-base"><CircleUserRound aria-hidden className="h-5 w-5" /> Login Orang Tua</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[var(--public-muted)]">
                {['Akses sesuai wewenang', 'Data terpusat', 'Ramah perangkat mobile'].map(item => (
                  <span key={item} className="flex items-center gap-2"><CheckCircle2 aria-hidden className="h-4 w-4 text-[var(--public-leaf)]" />{item}</span>
                ))}
              </div>
            </div>

            <div className="public-rise public-rise-delay relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="absolute -inset-5 rotate-3 rounded-[2.5rem] border border-[var(--public-gold)]/30" />
              <div className="relative overflow-hidden rounded-[2rem] bg-[var(--public-forest)] p-6 text-white shadow-[0_32px_90px_rgba(18,55,42,.25)] sm:p-8">
                <div className="public-grid absolute inset-0 opacity-60" />
                <div className="public-noise absolute inset-0 opacity-[.07] mix-blend-soft-light" />
                <div className="relative flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[.25em] text-emerald-200/70">Satu ekosistem</p>
                    <h2 className="public-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Pesantren dalam satu pandangan.</h2>
                  </div>
                  <Image src="/logo.png" alt="" aria-hidden width={82} height={82} className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
                </div>
                <div className="relative mt-10 grid grid-cols-2 gap-3">
                  {[
                    { icon: GraduationCap, label: 'Akademik', value: 'Terarah' },
                    { icon: CalendarCheck2, label: 'Kehadiran', value: 'Terpantau' },
                    { icon: HeartHandshake, label: 'Pelayanan', value: 'Lebih dekat' },
                    { icon: LayoutDashboard, label: 'Laporan', value: 'Terpadu' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[.07] p-4 backdrop-blur-sm">
                      <Icon aria-hidden className="h-5 w-5 text-[var(--public-gold-light)]" />
                      <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-white/50">{label}</p>
                      <p className="mt-1 font-extrabold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-[var(--public-gold)] p-4 text-[var(--public-forest-deep)]">
                  <ShieldCheck aria-hidden className="h-8 w-8 shrink-0" />
                  <div><p className="text-sm font-extrabold">Aman, tertata, dan mudah digunakan</p><p className="mt-0.5 text-xs font-semibold opacity-75">Dibangun untuk kebutuhan harian pesantren.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="border-y border-[var(--public-line)] bg-[var(--public-paper)] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-[var(--public-leaf)]">Pengelolaan terpadu</p><h2 className="public-display mt-4 text-4xl font-semibold leading-tight text-[var(--public-forest)] sm:text-5xl">Satu sistem untuk seluruh perjalanan santri.</h2></div>
              <p className="max-w-2xl text-base leading-8 text-[var(--public-muted)] lg:justify-self-end">Informasi penting tidak lagi tersebar. Setiap bagian bekerja dengan data yang sama agar pelayanan lebih cepat, laporan lebih rapi, dan komunikasi lebih terpercaya.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="group rounded-3xl border border-[var(--public-line)] bg-[var(--public-cream)]/55 p-6 transition duration-200 hover:-translate-y-1 hover:border-[var(--public-leaf)]/40 hover:bg-white hover:shadow-[0_20px_50px_rgba(18,55,42,.08)]">
                  <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--public-leaf-light)] text-[var(--public-leaf)]"><Icon aria-hidden className="h-6 w-6" /></span><span className="public-display text-2xl text-[var(--public-gold)]/65">0{index + 1}</span></div>
                  <h3 className="mt-8 text-lg font-extrabold text-[var(--public-forest)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="akses" className="bg-[var(--public-cream)] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.22em] text-[var(--public-leaf)]">Pilih akses Anda</p><h2 className="public-display mt-4 text-4xl font-semibold text-[var(--public-forest)] sm:text-5xl">Dua portal, satu tujuan.</h2><p className="mt-4 leading-7 text-[var(--public-muted)]">Setiap pengguna mendapatkan tampilan dan informasi sesuai kebutuhannya.</p></div>
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-[2rem] bg-[var(--public-forest)] p-7 text-white sm:p-10"><div className="public-grid absolute inset-0 opacity-50" /><div className="relative"><LayoutDashboard aria-hidden className="h-10 w-10 text-[var(--public-gold-light)]" /><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-white/55">Untuk staf dan pengurus</p><h3 className="public-display mt-3 text-3xl font-semibold sm:text-4xl">Portal Pengurus Pesantren</h3><p className="mt-4 max-w-xl leading-7 text-white/65">Kelola operasional, data santri, akademik, keuangan, asrama, dan laporan sesuai kewenangan akun.</p><Link href="/login" className="public-button mt-8 bg-white text-[var(--public-forest)] hover:bg-[var(--public-gold-light)]">Masuk sebagai Pengurus <ArrowRight aria-hidden className="h-4 w-4" /></Link></div></article>
              <article className="rounded-[2rem] border border-[var(--public-line)] bg-[var(--public-paper)] p-7 shadow-[0_20px_60px_rgba(18,55,42,.08)] sm:p-10"><CircleUserRound aria-hidden className="h-10 w-10 text-[var(--public-leaf)]" /><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[var(--public-muted)]">Untuk wali santri</p><h3 className="public-display mt-3 text-3xl font-semibold text-[var(--public-forest)] sm:text-4xl">Portal Orang Tua</h3><p className="mt-4 max-w-xl leading-7 text-[var(--public-muted)]">Pantau kehadiran, pembinaan, riwayat, dan pembayaran putra Anda dengan akses yang sederhana.</p><Link href="/portal-ortu/login" className="public-button public-button-primary mt-8">Masuk sebagai Orang Tua <ArrowRight aria-hidden className="h-4 w-4" /></Link></article>
            </div>
          </div>
        </section>

        <section className="bg-[var(--public-forest-deep)] px-5 py-20 text-center text-white sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl"><Image src="/logo.png" alt="" aria-hidden width={72} height={72} className="mx-auto h-16 w-16 object-contain" /><h2 className="public-display mt-6 text-4xl font-semibold leading-tight sm:text-5xl">Teknologi yang bekerja dalam khidmah.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-white/60">ESKAHADE membantu pengurus melayani lebih tertib dan membantu orang tua tetap dekat dengan perjalanan putranya.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="public-button bg-[var(--public-gold)] text-[var(--public-forest-deep)] hover:bg-[var(--public-gold-light)]">Login Pengurus Pesantren</Link><Link href="/portal-ortu/login" className="public-button border border-white/20 bg-white/5 text-white hover:bg-white/10">Login Orang Tua</Link></div></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[var(--public-forest-deep)] px-5 py-8 text-white/50 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center text-xs sm:flex-row sm:text-left"><p>© {year} Pondok Pesantren Sukahideng. Seluruh hak cipta dilindungi.</p><p>ESKAHADE · Sistem Informasi Manajemen Terpadu</p></div>
      </footer>
    </div>
  );
}
