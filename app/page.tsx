import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  ClipboardList,
  DoorOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PackageCheck,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
} from "lucide-react";

const highlights = [
  { label: "Modul aktif", value: "12+", tone: "text-emerald-300" },
  { label: "Akses per peran", value: "7 role", tone: "text-sky-300" },
  { label: "Siap dipasang", value: "PWA", tone: "text-amber-300" },
];

const coreModules = [
  {
    icon: Users,
    title: "Data Santri",
    desc: "Induk data, input santri, export, foto, santri keluar, nonaktif sementara, dan arsip alumni.",
    accent: "bg-emerald-500",
  },
  {
    icon: DoorOpen,
    title: "Asrama",
    desc: "Absen malam, berjamaah, data sakit, kamar, kepengurusan, perpulangan, dan monitoring kembali.",
    accent: "bg-lime-500",
  },
  {
    icon: ShieldCheck,
    title: "Perizinan & Disiplin",
    desc: "Perizinan santri, verifikasi telat, pelanggaran, SP/SK, dan denda buku pribadi.",
    accent: "bg-rose-500",
  },
  {
    icon: GraduationCap,
    title: "Akademik",
    desc: "Tes klasifikasi, penempatan kelas, grading, kenaikan kelas, absensi, nilai, leger, ranking, dan rapor.",
    accent: "bg-sky-500",
  },
  {
    icon: Banknote,
    title: "Keuangan",
    desc: "Loket pembayaran, tarif, laporan, SPP asrama, uang jajan, status setoran, dan kas operasional unit.",
    accent: "bg-amber-500",
  },
  {
    icon: ClipboardList,
    title: "EHB",
    desc: "Jadwal, ruangan, pengawas, absensi peserta, absensi pengawas, susulan, cetak, kepanitiaan, dan keuangan EHB.",
    accent: "bg-indigo-500",
  },
];

const workflows = [
  { icon: FileText, title: "Kesantrian", text: "Sensus penduduk, laporan sensus, dan layanan surat." },
  { icon: PackageCheck, title: "UPK", text: "Kasir, katalog, belanja, pemasukan, dan pengeluaran kitab." },
  { icon: WalletCards, title: "Operasional Unit", text: "Alokasi bulanan, transaksi, dan laporan kas unit." },
  { icon: BadgeCheck, title: "Master & Audit", text: "User, tahun ajaran, kelas, kitab, fitur akses, dan log aktivitas." },
];

const dashboardRows = [
  ["Data Santri", "Nonaktif Sementara", "Aktif"],
  ["Asrama", "Santri Kembali", "Monitoring"],
  ["Keuangan Santri", "Kas Operasional Unit", "Posting"],
  ["EHB", "Absensi Pengawas", "Siap Cetak"],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#07130d] text-white">
      <section
        className="relative min-h-[88svh] overflow-hidden border-b border-white/10 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(7,19,13,0.96), rgba(7,19,13,0.78) 48%, rgba(7,19,13,0.9)), url('/icon-512x512.png')",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(250,204,21,0.14),transparent_28%),linear-gradient(180deg,transparent,rgba(7,19,13,0.92))]" />

        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo Sukahideng" width={40} height={40} className="h-10 w-10 object-contain" priority />
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Sukahideng</p>
              <p className="text-sm font-bold text-white">ESKAHADE</p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-emerald-300/60 hover:bg-emerald-300/10"
          >
            Masuk
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-16 sm:px-8 md:pt-24 lg:grid-cols-[1.04fr_0.96fr] lg:px-10">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
              <LayoutDashboard className="h-4 w-4" />
              Sistem Informasi Pesantren
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">
              ESKAHADE
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
              Satu dashboard untuk mengurus data santri, asrama, akademik, keuangan,
              UPK, EHB, surat, perizinan, dan audit aktivitas pesantren.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-500 px-6 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"
              >
                Masuk ke Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#fitur"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 px-6 text-sm font-bold text-white transition hover:border-sky-300/60 hover:bg-sky-300/10"
              >
                Lihat Modul
              </a>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3">
              {highlights.map((item) => (
                <div key={item.label} className="border-l border-white/15 pl-4">
                  <p className={`text-2xl font-black ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="self-end border border-white/15 bg-[#0b1c14]/90 p-4 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ringkasan Hari Ini</p>
                <p className="mt-1 text-xl font-black text-white">Operasional Pesantren</p>
              </div>
              <Smartphone className="h-6 w-6 text-amber-300" />
            </div>
            <div className="grid grid-cols-2 gap-3 py-4">
              <Metric label="Absensi" value="Berjalan" tone="bg-emerald-300 text-emerald-950" />
              <Metric label="Keuangan" value="Terpantau" tone="bg-amber-300 text-amber-950" />
              <Metric label="EHB" value="Siap" tone="bg-sky-300 text-sky-950" />
              <Metric label="Audit" value="Tercatat" tone="bg-rose-300 text-rose-950" />
            </div>
            <div className="space-y-2">
              {dashboardRows.map(([group, title, status]) => (
                <div key={title} className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/10 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{group}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{title}</p>
                  </div>
                  <span className="self-center rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="bg-[#f5f7f2] px-5 py-16 text-slate-950 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Modul Saat Ini</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">
              Fitur landing page sudah disesuaikan dengan menu aplikasi.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreModules.map(({ icon: Icon, title, desc, accent }) => (
              <article key={title} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${accent}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-slate-950 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Alur Kerja</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">
              Dibuat untuk pekerjaan harian pengurus, bukan sekadar arsip data.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Tiap role hanya melihat menu yang relevan, dari admin, keamanan, sekpen,
              dewan santri, pengurus asrama, wali kelas, sampai bendahara.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {workflows.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-md border border-slate-200 bg-slate-50 p-5">
                <Icon className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-4 text-base font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#07130d] px-5 py-8 text-slate-400 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo Sukahideng" width={36} height={36} className="h-9 w-9 object-contain" />
            <div>
              <p className="text-sm font-bold text-white">ESKAHADE</p>
              <p className="text-xs">Sistem Informasi Manajemen Pesantren Sukahideng</p>
            </div>
          </div>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-100">
            Masuk
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <span className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-black ${tone}`}>{value}</span>
    </div>
  );
}
