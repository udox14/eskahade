'use client'

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
  Flame, ClipboardList, ToggleRight, ChevronRight
} from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight,
}
function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}

// ── Deskripsi tiap fitur ──────────────────────────────────────────────────────
const FITUR_DESC: Record<string, string> = {
  '/dashboard/santri':                               'Lihat dan kelola seluruh data induk santri yang aktif.',
  '/dashboard/dewan-santri/sensus':                  'Input dan kelola data sensus penduduk santri per asrama.',
  '/dashboard/dewan-santri/sensus/laporan':          'Cetak laporan hasil sensus penduduk dalam format yang rapi.',
  '/dashboard/santri/foto':                          'Upload dan kelola foto profil santri.',
  '/dashboard/dewan-santri/surat':                   'Buat surat izin, keterangan, dan tagihan untuk santri.',
  '/dashboard/asrama/absen-malam':                   'Catat kehadiran santri saat apel malam per kamar.',
  '/dashboard/asrama/absen-berjamaah':               'Rekam kehadiran shalat berjamaah santri per waktu.',
  '/dashboard/asrama/perpindahan-kamar':             'Proses perpindahan santri antar kamar dalam satu asrama.',
  '/dashboard/asrama/absen-sakit':                   'Input data santri yang sakit dan tidak bisa mengikuti kegiatan.',
  '/dashboard/asrama/layanan':                       'Kelola data katering (tempat makan) dan laundry santri.',
  '/dashboard/keamanan/perizinan':                   'Input dan pantau perizinan pulang atau keluar komplek santri.',
  '/dashboard/keamanan/perizinan/cetak-telat':       'Cetak daftar santri yang terlambat kembali.',
  '/dashboard/keamanan/perizinan/verifikasi-telat':  'Proses sidang dan vonis santri yang terlambat datang.',
  '/dashboard/keamanan/rekap-asrama':                'Rekap absen malam dan shalat berjamaah per bulan.',
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
  '/dashboard/akademik/upk/kasir':                   'Kasir UPK — proses pembelian kitab dan kebutuhan santri.',
  '/dashboard/akademik/upk/manajemen':               'Kelola stok, harga, dan transaksi toko UPK pesantren.',
  '/dashboard/pengaturan/users':                     'Kelola akun pengguna, reset password, dan hak akses.',
  '/dashboard/pengaturan/tahun-ajaran':              'Atur tahun ajaran aktif dan arsip tahun sebelumnya.',
  '/dashboard/master/santri-tools':                  'Alat bantu massal: naik kelas, arsip, dan reset data santri.',
  '/dashboard/master/wali-kelas':                    'Kelola data guru pengajar dan jadwal mengajar.',
  '/dashboard/master/kelas':                         'Kelola daftar kelas, marhalah, dan kapasitas.',
  '/dashboard/master/kitab':                         'Kelola daftar kitab/buku yang dijual di UPK.',
  '/dashboard/master/pelanggaran':                   'Atur jenis-jenis pelanggaran dan poin sanksi.',
  '/dashboard/santri/arsip':                         'Kelola santri yang lulus, keluar, atau diarsipkan.',
  '/dashboard/pengaturan/fitur-akses':               'Atur fitur apa saja yang bisa diakses oleh tiap role.',
}

// ── Update Accent untuk kompatibel dengan dark mode native Tailwind / Shadcn  ───
const GROUP_ACCENT: Record<string, { dot: string; line: string; label: string; iconHover: string; bgSoft: string }> = {
  '_standalone':  { dot: 'bg-slate-400',    line: 'bg-slate-200/50 dark:bg-slate-800',    label: 'text-slate-600 dark:text-slate-400',   iconHover: 'group-hover:text-slate-700 dark:group-hover:text-slate-300', bgSoft: 'group-hover:bg-slate-100/50 dark:group-hover:bg-slate-800/50' },
  'Kesantrian':   { dot: 'bg-orange-400',   line: 'bg-orange-500/20 dark:bg-orange-900/30',   label: 'text-orange-600 dark:text-orange-400',  iconHover: 'group-hover:text-orange-600 dark:group-hover:text-orange-400', bgSoft: 'group-hover:bg-orange-50/50 dark:group-hover:bg-orange-950/20' },
  'Pengkelasan':  { dot: 'bg-blue-400',     line: 'bg-blue-500/20 dark:bg-blue-900/30',     label: 'text-blue-600 dark:text-blue-400',    iconHover: 'group-hover:text-blue-600 dark:group-hover:text-blue-400', bgSoft: 'group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/20' },
  'Nilai & Rapor':{ dot: 'bg-violet-400',   line: 'bg-violet-500/20 dark:bg-violet-900/30',   label: 'text-violet-600 dark:text-violet-400',  iconHover: 'group-hover:text-violet-600 dark:group-hover:text-violet-400', bgSoft: 'group-hover:bg-violet-50/50 dark:group-hover:bg-violet-950/20' },
  'Absensi':      { dot: 'bg-teal-400',     line: 'bg-teal-500/20 dark:bg-teal-900/30',     label: 'text-teal-600 dark:text-teal-400',    iconHover: 'group-hover:text-teal-600 dark:group-hover:text-teal-400', bgSoft: 'group-hover:bg-teal-50/50 dark:group-hover:bg-teal-950/20' },
  'Keuangan':     { dot: 'bg-emerald-500',  line: 'bg-emerald-500/20 dark:bg-emerald-900/30',  label: 'text-emerald-600 dark:text-emerald-400', iconHover: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400', bgSoft: 'group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/20' },
  'UPK':          { dot: 'bg-amber-400',    line: 'bg-amber-500/20 dark:bg-amber-900/30',    label: 'text-amber-600 dark:text-amber-400',   iconHover: 'group-hover:text-amber-600 dark:group-hover:text-amber-400', bgSoft: 'group-hover:bg-amber-50/50 dark:group-hover:bg-amber-950/20' },
  'Master Data':  { dot: 'bg-rose-400',     line: 'bg-rose-500/20 dark:bg-rose-900/30',     label: 'text-rose-600 dark:text-rose-400',    iconHover: 'group-hover:text-rose-600 dark:group-hover:text-rose-400', bgSoft: 'group-hover:bg-rose-50/50 dark:group-hover:bg-rose-950/20' },
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

const GROUP_ORDER = ['_standalone', 'Kesantrian', 'Pengkelasan', 'Nilai & Rapor', 'Absensi', 'Keuangan', 'UPK', 'Master Data']

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

interface Props { userName: string; userRole: string; fiturAkses: FiturAkses[] }

// ── Feature Card ───────────────────────────────────────────
function FeatureCard({ fitur, accent }: { fitur: FiturAkses; accent: typeof GROUP_ACCENT[string] }) {
  const Icon = getIcon(fitur.icon)
  const desc = FITUR_DESC[fitur.href] || 'Akses fitur ini untuk mengelola data terkait.'

  return (
    <Link href={fitur.href} title={desc} className="block w-full h-full">
      <Card className={cn("group h-full flex flex-col items-center gap-2 p-3 sm:p-3.5 bg-card hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center active:scale-95 shadow-sm", accent.bgSoft)}>
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center transition-all duration-200 group-hover:bg-background group-hover:border-transparent group-hover:shadow-sm">
          <Icon className={cn('w-5 h-5 text-muted-foreground transition-colors duration-200', accent.iconHover)} />
        </div>

        {/* Label */}
        <span className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight line-clamp-2 w-full mt-1">
          {fitur.title}
        </span>

        {/* Subtle hover arrow */}
        <ChevronRight className="absolute top-2.5 right-2 w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Card>
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function HomeClient({ userName, userRole, fiturAkses }: Props) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => { setNow(new Date()) }, [])

  const hour      = now?.getHours() ?? 9
  const greeting  = getGreeting(hour)
  const firstName = userName.split(' ')[0]
  const roleLabel = ROLE_LABEL[userRole] ?? userRole.replace('_', ' ')
  const roleEmoji = ROLE_EMOJI[userRole] ?? '👤'
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
    <div className="max-w-5xl mx-auto space-y-6 lg:space-y-8">

      {/* ── Hero Greeting Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-xl select-none">
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
        }} />

        {/* Glow orbs */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-primary/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 right-12 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-white/70 leading-none tracking-wide">
                {now ? formatTanggal(now) : '—'}
              </span>
            </div>
            <div className="hidden sm:block">
              <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain opacity-90 drop-shadow-2xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-white/50 text-sm font-medium flex items-center gap-2">
              <span className="text-lg">{greeting.emoji}</span> {greeting.text}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none drop-shadow-md">
              {firstName}
              <span className="text-primary">.</span>
            </h1>
            <p className="text-white/40 text-sm pt-1 max-w-sm">{greeting.sub}</p>
          </div>

          <div className="my-5 h-px bg-white/10 w-full" />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-lg">{roleEmoji}</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold leading-none mb-1">Akses Sistem</p>
                <p className="text-sm font-bold text-white/90 leading-none">{roleLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 backdrop-blur-sm">
              <span className="text-primary text-sm font-black">{totalFitur}</span>
              <span className="text-white/60 text-xs font-medium">Fitur Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu Groups ── */}
      {groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 px-4 bg-muted/30 border-dashed text-center gap-3 shadow-none">
          <div className="w-12 h-12 rounded-full bg-background border flex items-center justify-center">
            <Settings className="w-6 h-6 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Belum ada fitur yang tersedia</p>
            <p className="text-sm text-muted-foreground">Hubungi administrator untuk mengatur hak akses Anda.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(group => {
            const items  = grouped.get(group)!
            const accent = GROUP_ACCENT[group] ?? GROUP_ACCENT['_standalone']

            return (
              <div key={group} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2 px-1">
                  <span className={cn('w-2 h-2 rounded-full shrink-0 animate-in zoom-in duration-500 hidden sm:block', accent.dot)} />
                  <h3 className={cn('text-xs font-bold uppercase tracking-[0.15em]', accent.label)}>
                    {group === '_standalone' ? 'Menu Utama' : group}
                  </h3>
                  <div className={cn('flex-1 h-px opacity-60', accent.line)} />
                  <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground px-2 h-5 rounded-full border-border/50">
                    {items.length}
                  </Badge>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
                  {items.map((fitur, i) => (
                    <div key={fitur.href} className="animate-in fade-in slide-in-from-bottom-2 h-full z-10" style={{ animationDelay: `${i * 30}ms` }}>
                      <FeatureCard fitur={fitur} accent={accent} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
