'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import {
  SquaresFour as LayoutDashboard,
  Users,
  BookOpen,
  ShieldWarning as ShieldAlert,
  FileText,
  Gear as Settings,
  Database,
  CalendarCheck,
  TrendUp as TrendingUp,
  ArrowUp as ArrowUpCircle,
  UserPlus,
  Printer,
  ClipboardText as ClipboardCheck,
  UserCheck,
  MapPin,
  Book,
  UserGear as UserCog,
  Moon,
  Stethoscope,
  Clock,
  Gavel,
  CreditCard,
  List as LayoutList,
  FileXls as FileSpreadsheet,
  Funnel as Filter,
  Envelope as Mail,
  ChartBar as BarChart3,
  Briefcase,
  Wallet,
  Coins,
  ShoppingCart,
  Package,
  Image as ImageIcon,
  GraduationCap as School,
  Archive,
  ForkKnife as Utensils,
  Calendar,
  ArrowsLeftRight as ArrowLeftRight,
  Flame,
  Clipboard as ClipboardList,
  ToggleRight,
  SignOut as LogOut,
  Download,
  Warning as FileWarning,
  Shuffle,
  House as Home,
  UserMinus as UserX,
  Door as DoorOpen,
  MagnifyingGlass as Search,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  X
} from "@phosphor-icons/react";

const CalendarRange = Calendar;
const CalendarDays = Calendar;

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
  '/dashboard/akademik/absensi/rekap':               'Lihat rekap absensi santri per periode and filter.',
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
const GROUP_META: Record<string, { label: string; icon: React.ElementType }> = {
  '_standalone':  { label: 'Menu Utama',           icon: LayoutDashboard },
  'Data Santri':  { label: 'Data Santri',          icon: Users },
  'Kesantrian':   { label: 'Kesantrian',           icon: UserCheck },
  'Asrama':       { label: 'Asrama',               icon: Home },
  'Perizinan & Disiplin': { label: 'Izin & Disiplin', icon: ShieldAlert },
  'Akademik':     { label: 'Akademik',             icon: BookOpen },
  'Pengkelasan':  { label: 'Pengkelasan',          icon: Shuffle },
  'Nilai & Rapor':{ label: 'Nilai & Rapor',        icon: FileSpreadsheet },
  'Absensi Akademik': { label: 'Absen Akademik',   icon: CalendarDays },
  'Absensi':      { label: 'Absensi Umum',         icon: ClipboardCheck },
  'Keuangan Pusat': { label: 'Keuangan Pusat',     icon: Wallet },
  'Keuangan Santri': { label: 'Keuangan Santri',   icon: Coins },
  'Keuangan':     { label: 'Keuangan',             icon: CreditCard },
  'Operasional':  { label: 'Kas Operasional',      icon: Briefcase },
  'UPK':          { label: 'UPK & Kitab',          icon: ShoppingCart },
  'EHB':          { label: 'Ujian EHB',            icon: ClipboardList },
  'PSB':          { label: 'Pendaftaran PSB',      icon: UserPlus },
  'Master Data':  { label: 'Master Data',          icon: Database },
}

function getGroupMeta(name: string) {
  return GROUP_META[name] ?? {
    label: name,
    icon: Settings
  }
}

function getTimeKey(hour: number) {
  if (hour >= 4  && hour < 11) return 'pagi'
  if (hour >= 11 && hour < 15) return 'siang'
  if (hour >= 15 && hour < 18) return 'sore'
  return 'malam'
}

const THEME_STYLES: Record<string, { shades: string[]; text: string; border: string; hoverText: string }> = {
  pagi:  { shades: ['bg-emerald-50/60', 'bg-emerald-100/50', 'bg-emerald-50/90', 'bg-emerald-100/70'], text: 'text-emerald-600', border: 'border-emerald-200/50', hoverText: 'group-hover:text-emerald-700' },
  siang: { shades: ['bg-amber-50/60', 'bg-amber-100/50', 'bg-amber-50/90', 'bg-amber-100/70'], text: 'text-amber-600', border: 'border-amber-200/50', hoverText: 'group-hover:text-amber-700' },
  sore:  { shades: ['bg-orange-50/60', 'bg-orange-100/50', 'bg-orange-50/90', 'bg-orange-100/70'], text: 'text-orange-600', border: 'border-orange-200/50', hoverText: 'group-hover:text-orange-700' },
  malam: { shades: ['bg-blue-50/60', 'bg-blue-100/50', 'bg-blue-50/90', 'bg-blue-100/70'], text: 'text-blue-600', border: 'border-blue-200/50', hoverText: 'group-hover:text-blue-700' },
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

function getGreetingImage(hour: number) {
  if (hour >= 4  && hour < 11) return '/hero_pagi.png'
  if (hour >= 11 && hour < 15) return '/hero_siang.png'
  if (hour >= 15 && hour < 18) return '/hero_sore.png'
  return '/hero_malam.png'
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

const GROUP_COLORS: Record<string, { bg: string; text: string; hoverText: string }> = {
  '_standalone':           { bg: 'bg-slate-50 text-slate-500', text: 'text-slate-600', hoverText: 'group-hover:text-slate-800' },
  'Data Santri':           { bg: 'bg-sky-50 text-sky-600', text: 'text-sky-600', hoverText: 'group-hover:text-sky-700' },
  'Kesantrian':            { bg: 'bg-orange-50 text-orange-600', text: 'text-orange-600', hoverText: 'group-hover:text-orange-700' },
  'Asrama':                { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hoverText: 'group-hover:text-emerald-700' },
  'Perizinan & Disiplin':  { bg: 'bg-rose-50 text-rose-600', text: 'text-rose-600', hoverText: 'group-hover:text-rose-700' },
  'Akademik':              { bg: 'bg-blue-50 text-blue-600', text: 'text-blue-600', hoverText: 'group-hover:text-blue-700' },
  'Pengkelasan':           { bg: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-600', hoverText: 'group-hover:text-indigo-700' },
  'Nilai & Rapor':         { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600', hoverText: 'group-hover:text-violet-700' },
  'Absensi Akademik':      { bg: 'bg-teal-50 text-teal-600', text: 'text-teal-600', hoverText: 'group-hover:text-teal-700' },
  'Absensi':               { bg: 'bg-teal-50 text-teal-600', text: 'text-teal-600', hoverText: 'group-hover:text-teal-700' },
  'Keuangan Pusat':        { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hoverText: 'group-hover:text-emerald-700' },
  'Keuangan Santri':       { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600', hoverText: 'group-hover:text-cyan-700' },
  'Keuangan':              { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hoverText: 'group-hover:text-emerald-700' },
  'UPK':                   { bg: 'bg-amber-50 text-amber-600', text: 'text-amber-600', hoverText: 'group-hover:text-amber-700' },
  'Master Data':           { bg: 'bg-rose-50 text-rose-600', text: 'text-rose-600', hoverText: 'group-hover:text-rose-700' },
  'EHB':                   { bg: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-600', hoverText: 'group-hover:text-indigo-700' },
  'Operasional':           { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600', hoverText: 'group-hover:text-cyan-700' },
  'PSB':                   { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600', hoverText: 'group-hover:text-violet-700' },
}

// renderGroupIcon helper is deleted, using getGroupMeta(group).icon directly

interface Props { userName: string; userRole: string; userRoles?: string[]; fiturAkses: FiturAkses[] }

// ── Main Component ─────────────────────────────────────────────────────────────
export function HomeClient({ userName, userRole, userRoles, fiturAkses }: Props) {
  const [now, setNow] = useState<Date | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.scrollTop > 60) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    const mainElement = document.querySelector('main')
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state?.submenu) {
        setActiveGroup(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleOpenGroup = (group: string) => {
    setActiveGroup(group)
    window.history.pushState({ submenu: group }, '', '')
  }

  const handleCloseGroup = () => {
    setActiveGroup(null)
    if (window.history.state?.submenu) {
      window.history.back()
    }
  }

  const hour      = now?.getHours() ?? 9
  const greeting  = getGreeting(hour)
  const heroImage = getGreetingImage(hour)
  const timeKey   = getTimeKey(hour)
  const theme     = THEME_STYLES[timeKey]
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
    <div className="max-w-7xl mx-auto w-full space-y-6 pb-16">
      {/* ── Sticky Hero & Search Container ── */}
      <div 
        className={cn(
          "sticky top-12 z-30 transition-all duration-300 ease-in-out -mx-4 px-4 sm:-mx-8 sm:px-8 flex flex-col",
          isScrolled 
            ? "border-b border-slate-200 shadow-sm py-3 gap-2 border-opacity-30"
            : "py-0 gap-6 mb-2"
        )}
        style={{
          backgroundColor: isScrolled ? 'rgba(248, 250, 252, 0.95)' : 'transparent',
          backdropFilter: isScrolled ? 'blur(8px)' : 'none',
          WebkitBackdropFilter: isScrolled ? 'blur(8px)' : 'none',
        }}
      >
        {/* ── Hero Greeting Card ── */}
        <div 
          className={cn(
            "relative overflow-hidden bg-white select-none transition-all duration-300 ease-in-out flex items-center w-full",
            isScrolled
              ? "rounded-2xl border border-slate-200 bg-slate-100 shadow-none px-4 py-2 min-h-0 h-12 justify-between border-opacity-40"
              : "rounded-[2rem] border border-slate-200 p-6 sm:p-8 min-h-[200px] sm:min-h-[260px] shadow-sm border-opacity-60"
          )}
          style={!isScrolled ? {
            backgroundImage: `url('${heroImage}')`,
            backgroundSize: 'contain',
            backgroundPosition: 'right bottom',
            backgroundRepeat: 'no-repeat'
          } : {
            borderColor: 'rgba(226, 232, 240, 0.5)',
            backgroundColor: 'rgba(241, 245, 249, 0.8)'
          }}
        >
          {isScrolled ? (
            <div className="flex items-center justify-between w-full animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <span className="text-base">{greeting.emoji}</span>
                <span className="text-xs font-semibold text-slate-500">{greeting.text},</span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[120px] sm:max-w-[200px]">{userName}</span>
              </div>
              <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1">
                <span>{roleEmoji}</span>
                <span>{roleLabel}</span>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex w-full animate-in fade-in duration-300">
              {/* Left Side: Greeting & User Name */}
              <div className="space-y-5 flex-1 min-w-0 max-w-[75%] sm:max-w-[60%]">
                <div className="space-y-1.5">
                  <p className="text-slate-600 text-xs sm:text-sm font-bold tracking-wide flex items-center gap-1.5 drop-shadow-sm">
                    <span>{greeting.emoji}</span>
                    <span>{greeting.text},</span>
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-none break-words drop-shadow-sm">
                    {userName}
                    <span className="text-emerald-500">.</span>
                  </h1>
                  <p className="text-slate-500 text-xs sm:text-sm pt-1 font-medium drop-shadow-sm">
                    {greeting.sub}
                  </p>
                </div>

                {/* Mockup Pills row */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Role Card */}
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-2xl shadow-sm backdrop-blur-md bg-opacity-80 border-opacity-60">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[11px] bg-opacity-10">
                      {roleEmoji}
                    </div>
                    <div className="leading-none text-left">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Akses Akun</p>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[85px] sm:max-w-[120px]">{roleLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Search Bar Redesigned ── */}
        <div className="relative group w-full animate-in fade-in duration-200">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu atau layanan di sini..."
            className="w-full pl-11 pr-10 py-3 bg-slate-100 border border-slate-200 focus:border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-20 transition-all duration-200 shadow-inner focus:shadow-sm"
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
                        <FeatureIcon className={cn("w-6 h-6 transition-transform duration-200 group-hover:scale-110", theme.text)} />
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
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 2 & 3: CATEGORY SELECTION & SUB-MENU DETAILS (with smooth native sliding transitions) ── */}
        {searchQuery.trim() === '' && (
          <div className="relative w-full overflow-hidden min-h-[300px]">
            {/* VIEW 2: CATEGORY SELECTION */}
            <div
              className={cn(
                "w-full transition-all duration-300 ease-out transform",
                activeGroup === null
                  ? "relative opacity-100 translate-x-0"
                  : "absolute top-0 left-0 opacity-0 -translate-x-8 pointer-events-none"
              )}
            >
              {groups.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-slate-400 text-center gap-2">
                  <Settings className="w-10 h-10 opacity-20 mb-1" />
                  <p className="font-medium text-sm">Belum ada fitur yang tersedia</p>
                  <p className="text-xs text-slate-500">Hubungi admin untuk mengatur akses Anda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {groups.map((group) => {
                    const meta = getGroupMeta(group)
                    const GroupIcon = meta.icon
                    const items = grouped.get(group)!
                    const accent = GROUP_COLORS[group] ?? { bg: 'bg-slate-50 text-slate-500', text: 'text-slate-600', hoverText: 'group-hover:text-slate-800' }

                    return (
                      <button
                        key={group}
                        onClick={() => handleOpenGroup(group)}
                        className="group flex items-center text-left p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:border-slate-300 hover:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer relative overflow-hidden"
                      >
                        <div className={cn("shrink-0 w-9 h-9 flex items-center justify-center mr-3 transition-transform duration-300 group-hover:scale-110", accent.text)}>
                          <GroupIcon size={22} className="w-5.5 h-5.5" />
                        </div>
                        <div className="flex-1 min-w-0 leading-tight">
                          <span className={cn("block text-sm font-bold text-slate-800 line-clamp-1 mb-0.5 transition-colors", accent.hoverText)}>
                            {group === '_standalone' ? 'Menu Utama' : group}
                          </span>
                          <span className="block text-[10px] sm:text-[11px] text-slate-400 font-medium group-hover:text-slate-500 transition-colors">
                            {items.length} fitur
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* VIEW 3: SUB-MENU DETAILS */}
            <div
              className={cn(
                "w-full transition-all duration-300 ease-out transform",
                activeGroup !== null
                  ? "relative opacity-100 translate-x-0"
                  : "absolute top-0 left-0 opacity-0 translate-x-8 pointer-events-none"
              )}
            >
              {activeGroup !== null && (() => {
                const items = grouped.get(activeGroup)!
                const meta = getGroupMeta(activeGroup)
                const GroupIcon = meta.icon

                return (
                  <div className="space-y-4">
                    {/* Navigation and active stats */}
                    <div className="flex items-center justify-between pb-1">
                      <button
                        onClick={handleCloseGroup}
                        className="group/btn inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4 group-hover/btn:-translate-x-0.5 transition-transform" />
                        Kembali
                      </button>
                      <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-3 py-1">
                        <span className="text-emerald-600 text-[10px] font-bold tracking-tight uppercase">{items.length} fitur aktif</span>
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
                              <FeatureIcon className={cn("w-6 h-6 transition-transform duration-200 group-hover:scale-110", theme.text)} />
                            </div>
                            <div className="flex-1 min-w-0 leading-tight">
                              <h4 className="text-sm font-bold text-slate-800 truncate">{fitur.title}</h4>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{desc}</p>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
