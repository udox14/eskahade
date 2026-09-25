// lib/menu/config.ts
//
// Konfigurasi menu bersama (dipakai Sidebar & BottomNav).
// Sumber data item menu tetap dari tabel `fitur_akses` (DB D1) —
// modul ini hanya menyediakan: resolusi ikon, urutan grup, judul,
// label role, dan deteksi menu aktif (longest-prefix match).

import React from 'react'
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
  Palette,
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
  UserMinus,
  Door as DoorOpen,
  ChalkboardTeacher,
  SignIn,
  Eye,
  ListChecks,
  Chalkboard,
  ChartPie,
  IdentificationBadge,
  Notebook,
  ChartLine,
  ShieldCheck,
  UserCirclePlus,
  PresentationChart,
  Table,
  Sun,
  Bed,
  UsersThree,
  IdentificationCard,
  Columns,
  HandCoins,
  Cardholder,
  Wrench,
  CalendarBlank,
  ListDashes,
  Bank,
  PiggyBank,
  PlusCircle,
  MinusCircle,
  Bookmark,
  Books,
  CalendarDots,
  WashingMachine,
  Buildings,
} from "@phosphor-icons/react";

const CalendarRange = Calendar;
const CalendarDays = Calendar;
const UserX = UserMinus;

export const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Palette, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight, LogOut, CalendarRange, Download,
  FileWarning, Shuffle, Home, UserX, UserMinus,
  DoorOpen,
  ChalkboardTeacher, SignIn, Eye, ListChecks, Chalkboard, ChartPie,
  IdentificationBadge, Notebook, ChartLine, ShieldCheck, UserCirclePlus,
  PresentationChart, Table, Sun, Bed, UsersThree, IdentificationCard,
  Columns, HandCoins, Cardholder, Wrench, CalendarBlank, ListDashes,
  Bank, PiggyBank, PlusCircle, MinusCircle, Bookmark, Books, CalendarDots,
  WashingMachine, Buildings,
  // Alias nama icon Lucide yang dipakai oleh modul keuangan baru.
  Landmark: Bank,
  ScanLine: IdentificationCard,
  SendHorizontal: ArrowUpCircle,
  BadgeDollarSign: Coins,
  Settings2: Wrench,
  ReceiptText: FileText,
  CashRegister: Wallet,
  QrCode: IdentificationCard,
};

export function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings;
}

export const GROUP_ICON: Record<string, React.ElementType> = {
  '_standalone': LayoutDashboard,
  'Data Santri': Users,
  'Kesantrian': FileText,
  'Asrama': Home,
  'Perizinan & Disiplin': ShieldAlert,
  'Akademik': School,
  'Pengkelasan': School,
  'Nilai & Rapor': BookOpen,
  'Absensi Akademik': CalendarCheck,
  'Absensi': CalendarCheck,
  'Keuangan Pusat': Coins,
  'Keuangan Santri': Wallet,
  'Keuangan': Coins,
  'Operasional': Wallet,
  'UPK': Package,
  'EHB': ClipboardList,
  'PSB': ClipboardList,
  'POSKESTREN': Stethoscope,
  'Monitoring Pimpinan': Eye,
  'Master Data': Database,
};

export const MENU_TITLE_MAP: Record<string, string> = {
  'Manajemen User': 'User',
  'Manajemen Santri': 'Tools Santri',
  'Manajemen Guru & Jadwal': 'Guru & Jadwal',
  'Manajemen Kelas': 'Kelas',
  'Manajemen Kitab': 'Kitab',
  'Pembagian Kitab Guru': 'Kitab Guru',
  'Manajemen Fitur': 'Fitur Akses',
};

export function getMenuTitle(title: string) {
  return MENU_TITLE_MAP[title] ?? title;
}

// Urutan item dalam grup: kolom `urutan` di fitur_akses adalah sumber kebenaran
// (diubah lewat admin UI /dashboard/pengaturan/fitur-akses → tab Susunan).
export function sortFiturItems(items: FiturAkses[]) {
  return [...items].sort((a, b) => (a.urutan - b.urutan) || (a.id - b.id));
}

export const GROUP_ORDER = [
  '_standalone',
  'Monitoring Pimpinan',
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
  'POSKESTREN',
  'Master Data',
];

export { ROLE_LABEL } from './role-label'

// Deteksi menu aktif: longest-prefix match (href terpanjang diuji dulu).
// `/dashboard` khusus exact-match; lainnya cocok bila pathname sama persis
// atau berada di sub-halaman (contoh: /dashboard/asrama/absen-malam/5
// tetap men-highlight menu Absen Malam).
export function getActiveMenu(pathname: string, items: FiturAkses[]): string | null {
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length);
  for (const item of sorted) {
    if (item.href === '/dashboard') {
      if (pathname === '/dashboard') return item.href;
    } else {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.href;
    }
  }
  return null;
}
