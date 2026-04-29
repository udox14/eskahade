'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  Image as ImageIcon, School, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight, ChevronRight, LogOut, CalendarRange,
  Download, FileWarning, Shuffle, Home, UserX
} from 'lucide-react'

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight, LogOut, CalendarRange, Download,
  FileWarning, Shuffle, Home, UserX,
}
function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}

// ── Deskripsi tiap fitur ──────────────────────────────────────────────────────
const FITUR_DESC: Record<string, string> = {
  '/dashboard/santri':                               'Lihat dan kelola seluruh data induk santri yang aktif.',
  '/dashboard/dewan-santri/sensus':                  'Input dan kelola data sensus penduduk santri per asrama.',
  '/dashboard/dewan-santri/sensus/laporan':          'Cetak laporan hasil sensus penduduk dalam format yang rapi.',
  '/dashboard/santri/input':                         'Input data santri baru beserta identitas awalnya.',
  '/dashboard/santri/export':                        'Export data santri aktif sesuai kebutuhan administrasi.',
  '/dashboard/santri/keluar':                        'Catat santri yang keluar atau berhenti di tengah tahun.',
  '/dashboard/santri/foto':                          'Upload dan kelola foto profil santri.',
  '/dashboard/dewan-santri/surat':                   'Buat surat izin, keterangan, dan tagihan untuk santri.',
  '/dashboard/asrama/absen-malam':                   'Catat kehadiran santri saat apel malam per kamar.',
  '/dashboard/asrama/absen-berjamaah':               'Rekam kehadiran shalat berjamaah santri per waktu.',
  '/dashboard/asrama/perpindahan-kamar':             'Proses perpindahan santri antar kamar dalam satu asrama.',
  '/dashboard/asrama/mutasi-asrama':                 'Pindahkan santri antar asrama, assign santri baru, atau mutasi batch.',
  '/dashboard/asrama/absen-sakit':                   'Data santri sakit per sesi pagi, sore, dan malam.',
  '/dashboard/asrama/layanan':                       'Kelola data katering (tempat makan) dan laundry santri.',
  '/dashboard/asrama/perpulangan':                   'Kelola izin perpulangan santri per periode.',
  '/dashboard/asrama/santri-kembali':                'Konfirmasi kedatangan santri yang izin pulang ke asrama.',
  '/dashboard/asrama/perpulangan/monitoring':        'Pantau status perpulangan dan kedatangan santri.',
  '/dashboard/keamanan/perizinan':                   'Input dan pantau perizinan pulang atau keluar komplek santri.',
  '/dashboard/keamanan/perizinan/cetak-telat':       'Cetak daftar santri yang terlambat kembali.',
  '/dashboard/keamanan/perizinan/verifikasi-telat':  'Proses sidang dan vonis santri yang terlambat datang.',
  '/dashboard/keamanan/denda-buku-pribadi':          'Catat denda kehilangan buku pribadi santri dan status pembayarannya.',
  '/dashboard/keamanan/rekap-asrama':                'Rekap absen malam dan shalat berjamaah per bulan.',
  '/dashboard/keamanan/rekap-absen-malam':           'Rekap absensi malam santri per bulan per asrama.',
  '/dashboard/keamanan/rekap-absen-berjamaah':       'Rekap shalat berjamaah santri (Shubuh, Ashar, Maghrib, Isya) per bulan.',
  '/dashboard/keamanan':                             'Input pelanggaran dan kelola catatan disiplin santri.',
  '/dashboard/santri/tes-klasifikasi':               'Input hasil tes penempatan level untuk santri baru.',
  '/dashboard/santri/atur-kelas':                    'Tempatkan santri ke kelas pesantren yang sesuai.',
  '/dashboard/akademik/grading':                     'Lihat dan verifikasi nilai grading santri per kelas.',
  '/dashboard/akademik/kenaikan':                    'Proses kenaikan kelas santri di akhir tahun ajaran.',
  '/dashboard/akademik/nilai/input':                 'Input nilai akademik santri per mata pelajaran.',
  '/dashboard/akademik/leger':                       'Lihat rekap nilai lengkap seluruh santri dalam satu kelas.',
  '/dashboard/akademik/ranking':                     'Lihat peringkat dan prestasi santri per kelas.',
  '/dashboard/laporan/rapor':                        'Cetak rapor santri dalam format PDF siap print.',
  '/dashboard/akademik/absensi':                     'Input absensi pengajian santri secara mingguan.',
  '/dashboard/akademik/absensi/rekap':               'Lihat rekap absensi santri per periode dan filter.',
  '/dashboard/akademik/absensi/verifikasi':          'Verifikasi dan proses sidang alfa santri mingguan.',
  '/dashboard/akademik/absensi/cetak':               'Cetak surat pemanggilan untuk santri yang banyak alfa.',
  '/dashboard/akademik/absensi/cetak-blanko':        'Cetak blanko absen kosong untuk diisi manual di kelas.',
  '/dashboard/akademik/absensi-guru':                'Catat kehadiran guru pengajar setiap pertemuan.',
  '/dashboard/akademik/absensi-guru/rekap':          'Lihat rekap kinerja kehadiran guru per periode.',
  '/dashboard/keuangan/pembayaran':                  'Loket pembayaran — proses tagihan santri.',
  '/dashboard/keuangan/laporan':                     'Laporan arus kas, pemasukan, dan tunggakan keuangan.',
  '/dashboard/asrama/spp':                           'Input dan pantau pembayaran SPP bulanan per asrama.',
  '/dashboard/asrama/uang-jajan':                    'Kelola saldo dan pengeluaran uang jajan harian santri.',
  '/dashboard/asrama/status-setoran':                'Lihat status setoran SPP asrama binaan Anda.',
  '/dashboard/dewan-santri/setoran':                 'Monitor status setoran SPP dari semua asrama.',
  '/dashboard/dewan-santri/uang-jajan':              'Pantau saldo & topup uang jajan santri per asrama.',
  '/dashboard/keuangan/tarif':                       'Atur nominal biaya masuk dan SPP per angkatan.',
  '/dashboard/akademik/upk/kasir':                   'Proses pembelian kitab dan kebutuhan santri.',
  '/dashboard/akademik/upk/katalog':                 'Kelola katalog, stok, toko, harga beli, dan harga jual UPK.',
  '/dashboard/akademik/upk/belanja':                 'Rencanakan belanja kitab, tambah stok, dan pantau hutang toko.',
  '/dashboard/pengaturan/users':                     'Kelola akun pengguna, reset password, dan hak akses.',
  '/dashboard/pengaturan/tahun-ajaran':              'Atur tahun ajaran aktif dan arsip tahun sebelumnya.',
  '/dashboard/master/santri-tools':                  'Alat bantu massal: naik kelas, arsip, dan reset data santri.',
  '/dashboard/master/wali-kelas':                    'Kelola data guru pengajar dan jadwal mengajar.',
  '/dashboard/master/kelas':                         'Kelola daftar kelas, marhalah, dan kapasitas.',
  '/dashboard/master/kitab':                         'Kelola daftar kitab pelajaran per marhalah dan mapel.',
  '/dashboard/santri/arsip':                         'Kelola santri yang lulus, keluar, atau diarsipkan.',
  '/dashboard/pengaturan/fitur-akses':               'Atur fitur apa saja yang bisa diakses oleh tiap role.',
  '/dashboard/ehb/jadwal':                           'Atur jadwal ujian EHB: event, sesi, dan distribusi kelas.',
  '/dashboard/ehb/ruangan':                          'Kelola ruangan ujian dan plotting penempatan santri.',
  '/dashboard/ehb/pengawas':                         'Kelola pengawas EHB dan jadwal tugasnya per ruangan.',
  '/dashboard/ehb/absensi-pengawas':                 'Catat kehadiran pengawas EHB dan badal per hari dan sesi.',
  '/dashboard/ehb/absensi':                          'Catat kehadiran peserta EHB per sesi dan ruangan.',
  '/dashboard/ehb/susulan':                          'Kelola peserta yang mengikuti ujian susulan EHB.',
  '/dashboard/ehb/cetak':                            'Cetak administrasi EHB: kartu peserta, blanko, jadwal, dan tempelan ruangan.',
  '/dashboard/ehb/kepanitiaan':                       'Kelola susunan panitia EHB dan cetak organigram kepanitiaan.',
  '/dashboard/ehb/keuangan':                          'Susun RAB dan kelola anggaran pelaksanaan EHB.',
}

// ── Accent per grup — hanya dot + garis, bukan badge ─────────────────────────
const GROUP_ACCENT: Record<string, { dot: string; line: string; label: string; iconHover: string }> = {
  '_standalone':  { dot: 'bg-slate-400',    line: 'bg-slate-200',    label: 'text-slate-500',   iconHover: 'group-hover:text-slate-700' },
  'Data Santri':  { dot: 'bg-sky-400',      line: 'bg-sky-100',      label: 'text-sky-600',     iconHover: 'group-hover:text-sky-600' },
  'Kesantrian':   { dot: 'bg-orange-400',   line: 'bg-orange-100',   label: 'text-orange-600',  iconHover: 'group-hover:text-orange-600' },
  'Asrama':       { dot: 'bg-lime-500',     line: 'bg-lime-100',     label: 'text-lime-700',    iconHover: 'group-hover:text-lime-700' },
  'Perizinan & Disiplin': { dot: 'bg-red-400', line: 'bg-red-100',   label: 'text-red-600',     iconHover: 'group-hover:text-red-600' },
  'Akademik':     { dot: 'bg-blue-400',     line: 'bg-blue-100',     label: 'text-blue-600',    iconHover: 'group-hover:text-blue-600' },
  'Pengkelasan':  { dot: 'bg-blue-400',     line: 'bg-blue-100',     label: 'text-blue-600',    iconHover: 'group-hover:text-blue-600' },
  'Nilai & Rapor':{ dot: 'bg-violet-400',   line: 'bg-violet-100',   label: 'text-violet-600',  iconHover: 'group-hover:text-violet-600' },
  'Absensi Akademik': { dot: 'bg-teal-400', line: 'bg-teal-100',     label: 'text-teal-600',    iconHover: 'group-hover:text-teal-600' },
  'Absensi':      { dot: 'bg-teal-400',     line: 'bg-teal-100',     label: 'text-teal-600',    iconHover: 'group-hover:text-teal-600' },
  'Keuangan Pusat': { dot: 'bg-emerald-500', line: 'bg-emerald-100', label: 'text-emerald-600', iconHover: 'group-hover:text-emerald-600' },
  'Keuangan Santri': { dot: 'bg-cyan-500',  line: 'bg-cyan-100',     label: 'text-cyan-600',    iconHover: 'group-hover:text-cyan-600' },
  'Keuangan':     { dot: 'bg-emerald-500',  line: 'bg-emerald-100',  label: 'text-emerald-600', iconHover: 'group-hover:text-emerald-600' },
  'UPK':          { dot: 'bg-amber-400',    line: 'bg-amber-100',    label: 'text-amber-600',   iconHover: 'group-hover:text-amber-600' },
  'Master Data':  { dot: 'bg-rose-400',     line: 'bg-rose-100',     label: 'text-rose-600',    iconHover: 'group-hover:text-rose-600' },
  'EHB':          { dot: 'bg-indigo-500',  line: 'bg-indigo-100',   label: 'text-indigo-600',  iconHover: 'group-hover:text-indigo-600' },
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', keamanan: 'Petugas Keamanan', sekpen: 'Sekretaris Pendidikan',
  dewan_santri: 'Dewan Santri', pengurus_asrama: 'Pengurus Asrama',
  wali_kelas: 'Wali Kelas', bendahara: 'Bendahara',
}

const ROLE_EMOJI: Record<string, string> = {
  admin: '🛡️', keamanan: '🔐', sekpen: '📋',
  dewan_santri: '🏛️', pengurus_asrama: '🏠', wali_kelas: '📚', bendahara: '💰',
}

const GROUP_ORDER = [
  '_standalone',
  'Data Santri',
  'Kesantrian',
  'Asrama',
  'Perizinan & Disiplin',
  'Akademik',
  'Pengkelasan',
  'Nilai & Rapor',
  'Absensi Akademik',
  'Absensi',
  'Keuangan Pusat',
  'Keuangan Santri',
  'Keuangan',
  'UPK',
  'EHB',
  'Master Data',
]

function getGreeting(hour: number) {
  if (hour >= 4  && hour < 11) return { text: 'Selamat Pagi',  sub: 'Semoga hari ini penuh berkah.', emoji: '🌅' }
  if (hour >= 11 && hour < 15) return { text: 'Selamat Siang', sub: 'Jangan lupa istirahat sejenak.', emoji: '☀️' }
  if (hour >= 15 && hour < 18) return { text: 'Selamat Sore',  sub: 'Semangat menyelesaikan tugas.', emoji: '🌤️' }
  return { text: 'Selamat Malam', sub: 'Istirahat yang cukup ya.', emoji: '🌙' }
}

function formatTanggal(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props { userName: string; userRole: string; userRoles?: string[]; fiturAkses: FiturAkses[] }

// ── Feature Card — clean minimal, no icon badge ───────────────────────────────
function FeatureCard({ fitur, accent }: { fitur: FiturAkses; accent: typeof GROUP_ACCENT[string] }) {
  const Icon = getIcon(fitur.icon)
  const desc = FITUR_DESC[fitur.href] || 'Akses fitur ini untuk mengelola data terkait.'

  return (
    <Link href={fitur.href} title={desc}
      className="group relative flex flex-col items-center gap-2 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center active:scale-95"
    >
      {/* Icon — plain, no colored badge */}
      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center transition-all duration-200 group-hover:bg-slate-100 group-hover:border-slate-200">
        {React.createElement(Icon, {
          className: cn('w-5 h-5 text-slate-500 transition-colors duration-200', accent.iconHover),
        })}
      </div>

      {/* Label */}
      <span className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-tight line-clamp-2 w-full">
        {fitur.title}
      </span>

      {/* Subtle hover arrow */}
      <ChevronRight className="absolute top-2.5 right-2 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function HomeClient({ userName, userRole, userRoles, fiturAkses }: Props) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const hour      = now?.getHours() ?? 9
  const greeting  = getGreeting(hour)
  const firstName = userName.split(' ')[0]
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole]
  const roleLabel = effectiveRoles.map(r => ROLE_LABEL[r] ?? r.replace('_', ' ')).join(' • ')
  const roleEmoji = ROLE_EMOJI[effectiveRoles[0]] ?? '👤'
  const totalFitur = fiturAkses.filter(f => f.href !== '/dashboard').length

  // Group fitur
  const grouped = new Map<string, FiturAkses[]>()
  for (const f of fiturAkses) {
    if (f.href === '/dashboard') continue
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">

      {/* ── Hero Greeting Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 select-none">

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
        }} />

        {/* Glow orbs */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 right-12 w-48 h-48 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-8 right-1/3 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 p-5 sm:p-8">

          {/* Top: date pill + logo */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/10 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="text-[11px] font-medium text-white/50 leading-none">
                {now ? formatTanggal(now) : '—'}
              </span>
            </div>
            <img src="/logo.png" alt="Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain opacity-80 shrink-0 drop-shadow-xl" />
          </div>

          {/* Greeting text */}
          <div className="space-y-1">
            <p className="text-white/40 text-sm font-medium">
              {greeting.emoji} {greeting.text}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
              {firstName}
              <span className="text-emerald-400">.</span>
            </h1>
            <p className="text-white/30 text-sm pt-0.5">{greeting.sub}</p>
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-white/8" />

          {/* Bottom: role + stats */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base">{roleEmoji}</span>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest leading-none mb-0.5">Login sebagai</p>
                <p className="text-sm font-bold text-white/80 leading-none">{roleLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-3 py-1.5">
              <span className="text-emerald-400 text-xs font-bold">{totalFitur}</span>
              <span className="text-white/40 text-xs">fitur aktif</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Menu Groups ── */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-400 text-center gap-2">
          <Settings className="w-10 h-10 opacity-20 mb-1" />
          <p className="font-medium text-sm">Belum ada fitur yang tersedia</p>
          <p className="text-xs text-slate-500">Hubungi admin untuk mengatur akses Anda.</p>
        </div>
      ) : (
        groups.map(group => {
          const items  = grouped.get(group)!
          const accent = GROUP_ACCENT[group] ?? GROUP_ACCENT['_standalone']

          return (
            <div key={group}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', accent.dot)} />
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.14em]', accent.label)}>
                  {group === '_standalone' ? 'Menu Utama' : group}
                </span>
                <div className={cn('flex-1 h-px', accent.line)} />
                <span className="text-[10px] text-slate-400 tabular-nums font-medium">{items.length}</span>
              </div>

              {/* Grid — 3 kolom di HP, makin banyak di desktop */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {items.map(fitur => (
                  <FeatureCard key={fitur.href} fitur={fitur} accent={accent} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
