'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  Image as ImageIcon, School, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight
} from 'lucide-react'

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
  '/dashboard':                                      'Halaman utama — beranda aplikasi ESKAHADE.',
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
  '/dashboard/keamanan/perizinan/cetak-telat':       'Cetak daftar santri yang terlambat kembali untuk ditempel di mading.',
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
  '/dashboard/akademik/absensi':                     'Input absensi pengajian santri secara mingguan (rapel).',
  '/dashboard/akademik/absensi/rekap':               'Lihat rekap absensi santri per periode dan filter.',
  '/dashboard/akademik/absensi/verifikasi':          'Verifikasi dan proses sidang alfa santri mingguan.',
  '/dashboard/akademik/absensi/cetak':               'Cetak surat pemanggilan untuk santri yang banyak alfa.',
  '/dashboard/akademik/absensi/cetak-blanko':        'Cetak blanko absen kosong untuk diisi manual di kelas.',
  '/dashboard/akademik/absensi-guru':                'Catat kehadiran guru pengajar setiap pertemuan.',
  '/dashboard/akademik/absensi-guru/rekap':          'Lihat rekap kinerja kehadiran guru per periode.',
  '/dashboard/keuangan/pembayaran':                  'Loket pembayaran — proses tagihan santri dari berbagai sumber.',
  '/dashboard/keuangan/laporan':                     'Laporan arus kas, pemasukan, dan tunggakan keuangan.',
  '/dashboard/asrama/spp':                           'Input dan pantau pembayaran SPP bulanan per asrama.',
  '/dashboard/asrama/uang-jajan':                    'Kelola saldo dan pengeluaran uang jajan harian santri.',
  '/dashboard/asrama/status-setoran':                'Lihat status setoran SPP asrama binaan Anda.',
  '/dashboard/dewan-santri/setoran':                 'Monitor status setoran SPP dari semua asrama.',
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

// ── Warna per grup ────────────────────────────────────────────────────────────
const GROUP_STYLE: Record<string, { header: string; card: string; icon: string; badge: string }> = {
  '_standalone':  { header: 'text-slate-700',  card: 'hover:border-slate-400 hover:bg-slate-50',  icon: 'bg-slate-100 text-slate-600',    badge: 'bg-slate-100 text-slate-600' },
  'Kesantrian':   { header: 'text-orange-700', card: 'hover:border-orange-300 hover:bg-orange-50', icon: 'bg-orange-100 text-orange-600',  badge: 'bg-orange-100 text-orange-700' },
  'Pengkelasan':  { header: 'text-blue-700',   card: 'hover:border-blue-300 hover:bg-blue-50',    icon: 'bg-blue-100 text-blue-600',      badge: 'bg-blue-100 text-blue-700' },
  'Nilai & Rapor':{ header: 'text-purple-700', card: 'hover:border-purple-300 hover:bg-purple-50', icon: 'bg-purple-100 text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  'Absensi':      { header: 'text-teal-700',   card: 'hover:border-teal-300 hover:bg-teal-50',    icon: 'bg-teal-100 text-teal-600',      badge: 'bg-teal-100 text-teal-700' },
  'Keuangan':     { header: 'text-green-700',  card: 'hover:border-green-300 hover:bg-green-50',  icon: 'bg-green-100 text-green-600',    badge: 'bg-green-100 text-green-700' },
  'UPK':          { header: 'text-amber-700',  card: 'hover:border-amber-300 hover:bg-amber-50',  icon: 'bg-amber-100 text-amber-600',    badge: 'bg-amber-100 text-amber-700' },
  'Master Data':  { header: 'text-rose-700',   card: 'hover:border-rose-300 hover:bg-rose-50',    icon: 'bg-rose-100 text-rose-600',      badge: 'bg-rose-100 text-rose-700' },
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', keamanan: 'Keamanan', sekpen: 'Sekretaris Pendidikan',
  dewan_santri: 'Dewan Santri', pengurus_asrama: 'Pengurus Asrama',
  wali_kelas: 'Wali Kelas', bendahara: 'Bendahara',
}

const GROUP_ORDER = ['_standalone', 'Kesantrian', 'Pengkelasan', 'Nilai & Rapor', 'Absensi', 'Keuangan', 'UPK', 'Master Data']

// ── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting(hour: number) {
  if (hour >= 4  && hour < 11) return { text: 'Selamat Pagi',  emoji: '🌅' }
  if (hour >= 11 && hour < 15) return { text: 'Selamat Siang', emoji: '☀️' }
  if (hour >= 15 && hour < 18) return { text: 'Selamat Sore',  emoji: '🌤️' }
  return { text: 'Selamat Malam', emoji: '🌙' }
}

function formatTanggal(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  userName: string
  userRole: string
  fiturAkses: FiturAkses[]
}

// ── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ fitur, style }: { fitur: FiturAkses; style: typeof GROUP_STYLE[string] }) {
  const [showInfo, setShowInfo] = useState(false)
  const Icon = getIcon(fitur.icon)
  const desc = FITUR_DESC[fitur.href] || 'Akses fitur ini untuk mengelola data terkait.'

  return (
    <div className="relative group">
      <Link
        href={fitur.href}
        className={cn(
          "flex flex-col items-center gap-2.5 p-4 bg-white border border-gray-200 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 text-center",
          style.card
        )}
      >
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110", style.icon)}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold text-gray-700 leading-tight">{fitur.title}</span>
      </Link>

      {/* Tombol info */}
      <button
        onClick={e => { e.preventDefault(); setShowInfo(v => !v) }}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Lihat deskripsi"
      >
        <Info className="w-3 h-3 text-gray-500" />
      </button>

      {/* Popup deskripsi */}
      {showInfo && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowInfo(false)}
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 z-30 w-48 pointer-events-none">
            <div className="bg-slate-800 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl leading-relaxed pointer-events-auto">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", style.badge)}>
                  {fitur.title}
                </span>
                <button onClick={() => setShowInfo(false)}>
                  <X className="w-3 h-3 text-white/60 hover:text-white" />
                </button>
              </div>
              {desc}
              {/* Panah ke bawah */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function HomeClient({ userName, userRole, fiturAkses }: Props) {
  const [now, setNow] = useState<Date | null>(null)

  // Pakai device time — hanya jalan di client
  useEffect(() => {
    setNow(new Date())
  }, [])

  const hour = now?.getHours() ?? 9
  const greeting = getGreeting(hour)
  const firstName = userName.split(' ')[0]
  const roleLabel = ROLE_LABEL[userRole] ?? userRole.replace('_', ' ')

  // Group fitur
  const grouped = new Map<string, FiturAkses[]>()
  for (const f of fiturAkses) {
    // Skip dashboard utama dari shortcut (sudah di sini)
    if (f.href === '/dashboard') continue
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  return (
    <div className="space-y-8 pb-12">

      {/* ── Greeting card ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 rounded-3xl p-7 text-white shadow-xl">
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-300 text-sm font-medium mb-1">
                {now ? formatTanggal(now) : ''}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {greeting.emoji} {greeting.text},
                <br />
                <span className="text-yellow-300">{firstName}!</span>
              </h1>
              <p className="text-emerald-200/70 text-sm mt-2">
                Anda masuk sebagai <span className="text-white font-semibold">{roleLabel}</span>
              </p>
            </div>
            {/* Logo kecil */}
            <img
              src="/logo.png"
              alt="Logo"
              className="w-14 h-14 object-contain opacity-80 shrink-0 drop-shadow-xl"
            />
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-emerald-300/60">Akses cepat:</span>
            <span className="text-xs bg-white/10 text-white/80 px-2.5 py-1 rounded-full">
              {fiturAkses.filter(f => f.href !== '/dashboard').length} fitur tersedia
            </span>
          </div>
        </div>
      </div>

      {/* ── Shortcut per grup ── */}
      {groups.map(group => {
        const items = grouped.get(group)!
        const style = GROUP_STYLE[group] ?? GROUP_STYLE['_standalone']

        return (
          <div key={group}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className={cn("text-xs font-bold uppercase tracking-widest", style.header)}>
                {group === '_standalone' ? 'Menu Utama' : group}
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400">{items.length} fitur</span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {items.map(fitur => (
                <FeatureCard key={fitur.href} fitur={fitur} style={style} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Belum ada fitur yang tersedia</p>
          <p className="text-sm mt-1">Hubungi admin untuk mengatur akses fitur Anda</p>
        </div>
      )}
    </div>
  )
}
