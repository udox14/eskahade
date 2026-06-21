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
  Download, FileWarning, Shuffle, Home, UserX, DoorOpen,
  Search, ChevronLeft, X
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
  FileWarning, Shuffle, Home, UserX, DoorOpen,
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
  '/dashboard/asrama/kamar':                         'Lihat kartu kamar, anggota kamar, ketua kamar, dan mutasi kamar dalam satu asrama.',
  '/dashboard/asrama/kepengurusan':                 'Atur pembina asrama, rois, sekretaris, bendahara, dan pembina kamar per asrama.',
  '/dashboard/asrama/perpindahan-kamar':             'Proses perpindahan santri antar kamar dalam satu asrama.',
  '/dashboard/asrama/mutasi-asrama':                 'Pindahkan santri antar asrama, assign santri baru, atau mutasi batch.',
  '/dashboard/asrama/absen-sakit':                   'Data santri sakit per sesi pagi, sore, dan malam.',
  '/dashboard/asrama/layanan':                       'Kelola data katering (tempat makan) dan laundry santri.',
  '/dashboard/asrama/perpulangan':                   'Kelola izin perpulangan santri per periode.',
  '/dashboard/asrama/santri-kembali':                'Konfirmasi kedatangan santri yang izin pulang ke asrama.',
  '/dashboard/asrama/perpulangan/monitoring':        'Pantau status perpulangan dan kedatangan santri.',
  '/dashboard/asrama/perpulangan/cetak-telat':       'Cetak daftar santri yang terlambat kembali dari perpulangan.',
  '/dashboard/asrama/perpulangan/verifikasi-telat':  'Proses sidang dan vonis telat datang dari data perpulangan.',
  '/dashboard/keamanan/perizinan':                   'Input dan pantau perizinan pulang atau keluar komplek santri.',
  '/dashboard/keamanan/perizinan/cetak-telat':       'Cetak daftar santri yang terlambat kembali.',
  '/dashboard/keamanan/perizinan/verifikasi-telat':  'Proses sidang dan vonis santri yang terlambat datang.',
  '/dashboard/keamanan/verifikasi-panggilan':        'Tentukan daftar panggilan dari alfa pengajian dan berjamaah dengan konteks izin dan sakit.',
  '/dashboard/keamanan/verifikasi-berjamaah':        'Proses vonis final alfa berjamaah dari hasil pemanggilan.',
  '/dashboard/keamanan/denda-buku-pribadi':          'Catat denda kehilangan buku pribadi santri dan status pembayarannya.',
  '/dashboard/keamanan/rekap-asrama':                'Rekap absen malam dan shalat berjamaah per waktu.',
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
  '/dashboard/akademik/absensi/vonis-final':         'Proses vonis final alfa pengajian dari hasil pemanggilan.',
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
  '/dashboard/master/guru-kitab':                    'Atur pembagian kitab yang diajar guru per kelas, sesi, dan tahun ajaran.',
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

// ── Accent per grup ──────────────────────────────────────────────────────────
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
  'Operasional':  { dot: 'bg-cyan-500',    line: 'bg-cyan-100',     label: 'text-cyan-600',    iconHover: 'group-hover:text-cyan-600' },
  'PSB':          { dot: 'bg-indigo-500',  line: 'bg-indigo-100',   label: 'text-indigo-600',  iconHover: 'group-hover:text-indigo-600' },
}

// ── Metadata Kategori Menu (SPA Native Feel) ──────────────────────────────────
const GROUP_META: Record<string, { label: string; icon: React.ElementType; textAccent: string }> = {
  '_standalone':  { label: 'Menu Utama',           icon: LayoutDashboard,    textAccent: 'text-slate-600' },
  'Data Santri':  { label: 'Data Santri',          icon: Users,              textAccent: 'text-sky-600' },
  'Kesantrian':   { label: 'Kesantrian',           icon: UserCheck,          textAccent: 'text-orange-600' },
  'Asrama':       { label: 'Asrama',               icon: Home,               textAccent: 'text-lime-600' },
  'Perizinan & Disiplin': { label: 'Izin & Disiplin', icon: ShieldAlert,      textAccent: 'text-red-600' },
  'Akademik':     { label: 'Akademik',             icon: BookOpen,           textAccent: 'text-blue-600' },
  'Pengkelasan':  { label: 'Pengkelasan',          icon: Shuffle,            textAccent: 'text-indigo-600' },
  'Nilai & Rapor':{ label: 'Nilai & Rapor',        icon: FileSpreadsheet,    textAccent: 'text-violet-600' },
  'Absensi Akademik': { label: 'Absen Akademik',   icon: CalendarDays,       textAccent: 'text-teal-600' },
  'Absensi':      { label: 'Absensi Umum',         icon: ClipboardCheck,     textAccent: 'text-emerald-600' },
  'Keuangan Pusat': { label: 'Keuangan Pusat',     icon: Wallet,             textAccent: 'text-emerald-600' },
  'Keuangan Santri': { label: 'Keuangan Santri',   icon: Coins,              textAccent: 'text-cyan-600' },
  'Keuangan':     { label: 'Keuangan',             icon: CreditCard,         textAccent: 'text-emerald-600' },
  'Operasional':  { label: 'Kas Operasional',      icon: Briefcase,          textAccent: 'text-cyan-600' },
  'UPK':          { label: 'UPK & Kitab',          icon: ShoppingCart,       textAccent: 'text-amber-600' },
  'EHB':          { label: 'Ujian EHB',            icon: ClipboardList,      textAccent: 'text-indigo-600' },
  'PSB':          { label: 'Pendaftaran PSB',      icon: UserPlus,           textAccent: 'text-rose-600' },
  'Master Data':  { label: 'Master Data',          icon: Database,           textAccent: 'text-rose-600' },
}

function getGroupMeta(name: string) {
  return GROUP_META[name] ?? {
    label: name,
    icon: Settings,
    textAccent: 'text-slate-600'
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', keamanan: 'Petugas Keamanan', sekpen: 'Sekretaris Pendidikan',
  dewan_santri: 'Dewan Santri', pengurus_asrama: 'Pengurus Asrama',
  wali_kelas: 'Wali Kelas', guru: 'Guru', bendahara: 'Bendahara',
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
  'Operasional',
  'UPK',
  'EHB',
  'PSB',
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

function formatJam(date: Date) {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

interface Props { userName: string; userRole: string; userRoles?: string[]; fiturAkses: FiturAkses[] }

// ── Main Component ─────────────────────────────────────────────────────────────
export function HomeClient({ userName, userRole, userRoles, fiturAkses }: Props) {
  const [now, setNow] = useState<Date | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const hour      = now?.getHours() ?? 9
  const greeting  = getGreeting(hour)
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole]
  const roleLabel = effectiveRoles.filter(r => !r.includes(':')).map(r => ROLE_LABEL[r] ?? r.replace('_', ' ')).join(' • ')
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

  // Search filter
  const allFeatures = fiturAkses.filter(f => f.href !== '/dashboard')
  const filteredFeatures = allFeatures.filter(fitur => {
    const titleMatch = fitur.title.toLowerCase().includes(searchQuery.toLowerCase())
    const descMatch = (FITUR_DESC[fitur.href] || '').toLowerCase().includes(searchQuery.toLowerCase())
    const groupMatch = fitur.group_name.toLowerCase().includes(searchQuery.toLowerCase())
    return titleMatch || descMatch || groupMatch
  })

  return (
    <div className="space-y-6 pb-16">

      {/* ── Hero Greeting Card ── */}
      <div 
        className="relative overflow-hidden rounded-3xl bg-slate-100 select-none shadow-md border border-slate-200/85 p-6 sm:p-8"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.8)), url('/hero-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Glow orbs */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 right-12 w-48 h-48 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Content (Asymmetric Flex Layout for Bold & Premium Feel) */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          
          {/* Left Side: Greeting & User Name */}
          <div className="space-y-3.5 flex-1 min-w-0">
            {/* Category Portal Pill & Mobile Clock row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 border border-emerald-200/40 px-2.5 py-1 rounded-lg">
                Portal Utama
              </span>
              
              {/* Mobile-only Clock & Date Pill */}
              <div className="md:hidden flex items-center gap-2 bg-slate-900/5 border border-slate-900/10 rounded-full px-2.5 py-1 select-none">
                <span className="text-[10px] font-bold text-slate-600 leading-none">
                  {now ? now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                </span>
                <span className="w-px h-2.5 bg-slate-300 shrink-0" />
                <span className="text-[10px] font-black text-emerald-600 font-mono leading-none tracking-wider">
                  {now ? formatJam(now).substring(0, 5) : '00:00'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-500 text-xs sm:text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>{greeting.emoji}</span>
                <span>{greeting.text},</span>
              </p>
              <h1 className="text-3xl sm:text-4.5xl font-black text-slate-800 tracking-tight leading-none break-words">
                {userName}
                <span className="text-emerald-505">.</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm pt-1 font-semibold italic">
                "{greeting.sub}"
              </p>
            </div>
          </div>

          {/* Right Side: Large Digital Clock & Date Widget (Desktop Only) */}
          <div className="hidden md:flex shrink-0 flex-col items-end text-right bg-white/70 border border-slate-200/50 p-4 sm:p-5 rounded-2xl shadow-sm backdrop-blur-md min-w-[170px] relative overflow-hidden select-none">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1 block">Waktu Saat Ini</span>
            <span className="text-3xl sm:text-3.5xl font-black text-slate-800 font-mono tracking-wider leading-none">
              {now ? formatJam(now) : '00.00.00'}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2 block leading-none">
              {now ? formatTanggal(now) : '—'}
            </span>
          </div>

        </div>

        {/* Bottom stats and role info bar */}
        <div className="flex items-center gap-3 pt-4 mt-6 border-t border-slate-200/60 flex-wrap relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7.5 h-7.5 rounded-full bg-slate-900/5 flex items-center justify-center shrink-0 border border-slate-900/10 text-xs shadow-sm">
              {roleEmoji}
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black leading-none mb-0.5">Akses Akun</p>
              <p className="text-xs font-bold text-slate-700 leading-none">{roleLabel}</p>
            </div>
          </div>
          
          <div className="ml-auto inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/40 rounded-full px-3.5 py-1 text-emerald-700 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="text-emerald-700 text-xs font-black">{totalFitur}</span>
            <span className="text-slate-500 text-[10px] font-bold">layanan aktif</span>
          </div>
        </div>

      </div>

      {/* ── Search Bar Redesigned ── */}
      <div className="relative group animate-in fade-in duration-200">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari menu atau layanan di sini..."
          className="w-full pl-11 pr-10 py-3.5 bg-slate-100 border border-transparent rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-250 focus:ring-4 focus:ring-emerald-500/5 transition-all duration-200 shadow-inner focus:shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      {/* ── SPA Views Container ── */}
      <div className="relative">
        
        {/* ── VIEW 1: SEARCH RESULTS ── */}
        {searchQuery.trim() !== '' && (
          <div className="space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Hasil Pencarian ({filteredFeatures.length})
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Bersihkan
              </button>
            </div>

            {filteredFeatures.length === 0 ? (
              <div className="flex flex-col items-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-center gap-2">
                <Search className="w-8 h-8 opacity-20 mb-1" />
                <p className="font-medium text-sm">Tidak menemukan "{searchQuery}"</p>
                <p className="text-xs text-slate-500">Coba kata kunci lain atau cari per kategori.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredFeatures.map(fitur => {
                  const meta = getGroupMeta(fitur.group_name)
                  const FeatureIcon = getIcon(fitur.icon)
                  const desc = FITUR_DESC[fitur.href] || 'Akses fitur ini untuk mengelola data terkait.'

                  return (
                    <Link
                      key={fitur.href}
                      href={fitur.href}
                      className="flex items-center gap-3.5 p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all duration-200 active:scale-[0.98] group"
                    >
                      {/* Clean direct icon (no badge container) */}
                      <div className="w-9 h-9 flex items-center justify-center shrink-0">
                        <FeatureIcon className={cn("w-6 h-6 transition-transform duration-200 group-hover:scale-110", meta.textAccent)} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[120px]">
                            {fitur.group_name === '_standalone' ? 'Menu Utama' : fitur.group_name}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 truncate">{fitur.title}</h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0 ml-1" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 2: CATEGORY SELECTION (default state - clean horizontal list) ── */}
        {searchQuery.trim() === '' && activeGroup === null && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-slate-400 text-center gap-2">
                <Settings className="w-10 h-10 opacity-20 mb-1" />
                <p className="font-medium text-sm">Belum ada fitur yang tersedia</p>
                <p className="text-xs text-slate-500">Hubungi admin untuk mengatur akses Anda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {groups.map(group => {
                  const meta = getGroupMeta(group)
                  const GroupIcon = meta.icon
                  const items = grouped.get(group)!

                  return (
                    <button
                      key={group}
                      onClick={() => setActiveGroup(group)}
                      className="group flex items-center gap-3 p-3.5 bg-white border border-slate-200/80 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left active:scale-[0.97] cursor-pointer"
                    >
                      {/* Stylized direct icon on the left (no enclosing box/badge) */}
                      <div className="shrink-0 flex items-center justify-center w-8 h-8">
                        <GroupIcon className={cn("w-7 h-7 transition-transform duration-200 group-hover:scale-110", meta.textAccent)} strokeWidth={1.8} />
                      </div>

                      {/* Text content on the right */}
                      <div className="flex-1 min-w-0 leading-tight">
                        <span className="block text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                          {group === '_standalone' ? 'Menu Utama' : group}
                        </span>
                        <span className="inline-block text-[9px] text-slate-400 font-bold mt-0.5">
                          {items.length} fitur
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 3: SUB-MENU DETAILS ── */}
        {searchQuery.trim() === '' && activeGroup !== null && (() => {
          const items = grouped.get(activeGroup)!
          const meta = getGroupMeta(activeGroup)
          const GroupIcon = meta.icon

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Navigation and active stats */}
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={() => setActiveGroup(null)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Kembali
                </button>
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-3 py-1">
                  <span className="text-emerald-600 text-[10px] font-bold tracking-tight uppercase">{items.length} fitur aktif</span>
                </div>
              </div>

              {/* Sub-menu Banner with simple clean left border accent */}
              <div className="p-4 bg-white border border-slate-200 rounded-3xl flex items-center gap-3.5 shadow-sm overflow-hidden relative select-none pl-6">
                {/* Left accent bar instead of colored badge */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", GROUP_ACCENT[activeGroup]?.dot || 'bg-slate-400')} />

                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  <GroupIcon className={cn("w-8 h-8", meta.textAccent)} strokeWidth={1.8} />
                </div>
                <div className="leading-tight">
                  <h2 className="text-base sm:text-lg font-black text-slate-800">
                    {activeGroup === '_standalone' ? 'Menu Utama' : activeGroup}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Daftar fitur dan layanan yang dapat Anda akses</p>
                </div>
              </div>

              {/* Grid lists of submenu features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(fitur => {
                  const FeatureIcon = getIcon(fitur.icon)
                  const desc = FITUR_DESC[fitur.href] || 'Akses fitur ini untuk mengelola data terkait.'

                  return (
                    <Link
                      key={fitur.href}
                      href={fitur.href}
                      className="flex items-center gap-3.5 p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all duration-200 active:scale-[0.98] group"
                    >
                      {/* Clean direct icon (no badge) */}
                      <div className="w-9 h-9 flex items-center justify-center shrink-0">
                        <FeatureIcon className={cn("w-6 h-6 transition-transform duration-200 group-hover:scale-110", meta.textAccent)} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0 leading-tight">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{fitur.title}</h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0 ml-1" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })()}

      </div>

    </div>
  )
}
