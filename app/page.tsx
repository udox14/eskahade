import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building,
  ChevronRight,
  FileText,
  PieChart,
  Shield,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ESKAHADE — Sistem Informasi Pesantren",
  description:
    "Sistem informasi terpadu Pondok Pesantren Sukahideng",
};

const features = [
  { icon: Users, title: "Data Santri", desc: "Manajemen data induk santri yang akurat dan terpusat." },
  { icon: BookOpen, title: "Akademik", desc: "Pemantauan nilai, hafalan, dan absensi kegiatan belajar." },
  { icon: Building, title: "Asrama", desc: "Pengelolaan kamar, perizinan, dan kedisiplinan santri." },
  { icon: FileText, title: "Keuangan", desc: "Sistem informasi tagihan dan pencatatan pembayaran." },
  { icon: Shield, title: "Kesantrian", desc: "Rekam jejak pembinaan karakter dan pelanggaran." },
  { icon: PieChart, title: "Laporan", desc: "Rekapitulasi otomatis untuk evaluasi kepengurusan." },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="public-theme min-h-dvh flex flex-col bg-[#FBFBFA] selection:bg-[var(--public-leaf)] selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#FBFBFA]/80 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="h-9 w-9 object-contain" priority />
            <span className="text-sm font-bold tracking-tight text-[var(--public-forest)]">ESKAHADE</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden px-6 pt-24 pb-32 lg:px-8 lg:pt-32 lg:pb-40">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[var(--public-leaf-light)] to-[var(--public-gold-light)] opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
          </div>
          
          <div className="mx-auto max-w-3xl text-center public-rise">
            <div className="mb-8 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-[var(--public-leaf)] bg-[var(--public-leaf)]/10 ring-1 ring-inset ring-[var(--public-leaf)]/20">
                Sistem Informasi Terpadu
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl mb-6">
              Platform Digital <br />
              <span className="text-[var(--public-forest)]">Pesantren Sukahideng</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Menghadirkan kemudahan dalam mengelola administrasi kepengurusan dan transparansi informasi bagi orang tua santri.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="w-full sm:w-auto rounded-full bg-[var(--public-forest)] px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d281e] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-forest)]">
                Portal Pengurus
              </Link>
              <Link href="/portal-ortu/login" className="w-full sm:w-auto rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors">
                Portal Orang Tua
              </Link>
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section className="bg-white py-24 sm:py-32 border-y border-black/[0.04]">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Layanan Terpusat</h2>
              <p className="mt-4 text-lg text-gray-600">Seluruh aspek manajerial pesantren diakses dari satu tempat.</p>
            </div>
            
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-3">
                {features.map((feature) => (
                  <div key={feature.title} className="flex flex-col">
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FBFBFA] ring-1 ring-black/[0.04]">
                        <feature.icon className="h-5 w-5 text-[var(--public-leaf)]" aria-hidden="true" />
                      </div>
                      {feature.title}
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                      <p className="flex-auto">{feature.desc}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="relative isolate px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Siap mengakses portal?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-gray-600">
              Pilih portal yang sesuai dengan akses Anda untuk masuk ke dalam sistem.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[var(--public-forest)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d281e]">
                Pengurus <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/portal-ortu/login" className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[var(--public-leaf)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1d6345]">
                Orang Tua <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-black/[0.04]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={24} height={24} className="h-6 w-6 opacity-80" />
            <p className="text-sm text-gray-500">© {year} Pondok Pesantren Sukahideng</p>
          </div>
          <p className="text-sm text-gray-500">Sistem Informasi Terpadu</p>
        </div>
      </footer>
    </div>
  );
}

