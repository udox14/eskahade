'use client'

import React from 'react'
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  ChevronLeft, ChevronRight, ChevronDown, Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog, Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet, Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package, Image as ImageIcon, School, Palette, Archive, Utensils, CalendarDays, ArrowLeftRight, Flame, ClipboardList, ToggleRight,
  LogOut, CalendarRange, Download, FileWarning, Shuffle, Home, UserX, UserMinus, DoorOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { FiturAkses } from "@/lib/cache/fitur-akses";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Palette, Archive, Utensils, CalendarDays, ArrowLeftRight,
  Flame, ClipboardList, ToggleRight, LogOut, CalendarRange, Download,
  FileWarning, Shuffle, Home, UserX, UserMinus,
  DoorOpen,
};

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings;
}

const GROUP_ICON: Record<string, React.ElementType> = {
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
  'Master Data': Database,
};

const MENU_TITLE_MAP: Record<string, string> = {
  'Manajemen User': 'User',
  'Manajemen Santri': 'Tools Santri',
  'Manajemen Guru & Jadwal': 'Guru & Jadwal',
  'Manajemen Kelas': 'Kelas',
  'Manajemen Kitab': 'Kitab',
  'Pembagian Kitab Guru': 'Kitab Guru',
  'Manajemen Fitur': 'Fitur Akses',
};

function getMenuTitle(title: string) {
  return MENU_TITLE_MAP[title] ?? title;
}

const GROUP_ITEM_ORDER: Record<string, string[]> = {
  'Master Data': [
    'Tahun Ajaran',
    'Setup Tahun Ajaran',
    'Kelas',
    'Kitab',
    'Kitab Guru',
    'Guru & Jadwal',
    'Tools Santri',
    'Arsip Alumni',
    'Periode Perpulangan',
    'Master Pelanggaran',
    'User',
    'Fitur Akses',
    'Log Aktivitas',
  ],
};

function sortGroupItems(group: string, items: FiturAkses[]) {
  const preferredOrder = GROUP_ITEM_ORDER[group];
  if (!preferredOrder) return items;

  const rankMap = new Map(preferredOrder.map((title, index) => [title, index]));
  return [...items].sort((a, b) => {
    const aTitle = getMenuTitle(a.title);
    const bTitle = getMenuTitle(b.title);
    const aRank = rankMap.get(aTitle);
    const bRank = rankMap.get(bTitle);

    if (aRank != null && bRank != null) return aRank - bRank;
    if (aRank != null) return -1;
    if (bRank != null) return 1;
    return a.urutan - b.urutan;
  });
}

type ThemeStyle = {
  activeBg: string;
  activeText: string;
  activeIcon: string;
  activeBorder: string;
  indicator: string;
  folderActiveBg: string;
  folderOpenBg: string;
  roleBadge: string;
  roleLabel: string;
  logoGlow: string;
  glowText: string;
};

const THEME_STYLES: Record<string, ThemeStyle> = {
  pagi: {
    activeBg: "bg-emerald-50/80 shadow-sm",
    activeText: "text-emerald-700 font-bold",
    activeIcon: "text-emerald-600",
    activeBorder: "border-emerald-500",
    indicator: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    folderActiveBg: "bg-emerald-50/40 border-emerald-200/50",
    folderOpenBg: "border-emerald-300/40 bg-emerald-50/20",
    roleBadge: "bg-emerald-50 border-emerald-200/60 text-emerald-800",
    roleLabel: "text-emerald-600/80",
    logoGlow: "bg-emerald-500/5",
    glowText: "text-emerald-600",
  },
  siang: {
    activeBg: "bg-amber-50/80 shadow-sm",
    activeText: "text-amber-700 font-bold",
    activeIcon: "text-amber-600",
    activeBorder: "border-amber-500",
    indicator: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    folderActiveBg: "bg-amber-50/40 border-amber-200/50",
    folderOpenBg: "border-amber-300/40 bg-amber-50/20",
    roleBadge: "bg-amber-50 border-amber-200/60 text-amber-800",
    roleLabel: "text-amber-600/80",
    logoGlow: "bg-amber-500/5",
    glowText: "text-amber-600",
  },
  sore: {
    activeBg: "bg-orange-50/80 shadow-sm",
    activeText: "text-orange-700 font-bold",
    activeIcon: "text-orange-600",
    activeBorder: "border-orange-500",
    indicator: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]",
    folderActiveBg: "bg-orange-50/40 border-orange-200/50",
    folderOpenBg: "border-orange-300/40 bg-orange-50/20",
    roleBadge: "bg-orange-50 border-orange-200/60 text-orange-800",
    roleLabel: "text-orange-600/80",
    logoGlow: "bg-orange-500/5",
    glowText: "text-orange-600",
  },
  malam: {
    activeBg: "bg-blue-50/80 shadow-sm",
    activeText: "text-blue-700 font-bold",
    activeIcon: "text-blue-600",
    activeBorder: "border-blue-500",
    indicator: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    folderActiveBg: "bg-blue-50/40 border-blue-200/50",
    folderOpenBg: "border-blue-300/40 bg-blue-50/20",
    roleBadge: "bg-blue-50 border-blue-200/60 text-blue-800",
    roleLabel: "text-blue-600/80",
    logoGlow: "bg-blue-500/5",
    glowText: "text-blue-600",
  },
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  keamanan: 'Keamanan',
  sekpen: 'SEKPEN',
  dewan_santri: 'Dewan Santri',
  pengurus_asrama: 'Pengurus Asrama',
  wali_kelas: 'Wali Kelas',
  guru: 'Guru',
  bendahara: 'Bendahara',
};

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
];

interface SidebarProps {
  userRole?: string;
  userRoles?: string[];
  fiturAkses: FiturAkses[];
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onMobileClose?: () => void;
}

export function Sidebar({ userRole = 'wali_kelas', userRoles, fiturAkses, isCollapsed, toggleSidebar, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [timeKey, setTimeKey] = useState<string>('pagi');
  const [mounted, setMounted] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    const hr = new Date().getHours();
    if (hr >= 4 && hr < 11) setTimeKey('pagi');
    else if (hr >= 11 && hr < 15) setTimeKey('siang');
    else if (hr >= 15 && hr < 18) setTimeKey('sore');
    else setTimeKey('malam');
  }, []);

  // Build grouped menu dari fiturAkses
  const groupMap = new Map<string, FiturAkses[]>();
  for (const f of fiturAkses) {
    if (!groupMap.has(f.group_name)) groupMap.set(f.group_name, []);
    groupMap.get(f.group_name)!.push(f);
  }
  const groupedMenu = GROUP_ORDER
    .filter(g => groupMap.has(g))
    .map(g => ({ group: g, items: sortGroupItems(g, groupMap.get(g)!) }));

  useEffect(() => {
    const activeGroup = groupedMenu.find(g =>
      g.group !== '_standalone' && g.items.some(i => i.href === pathname)
    );
    if (activeGroup) {
      setOpenFolders(prev => ({ ...prev, [activeGroup.group]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleFolder = (title: string) => {
    if (isCollapsed) {
      toggleSidebar();
      setOpenFolders({ [title]: true });
    } else {
      setOpenFolders(prev => ({ ...prev, [title]: !prev[title] }));
    }
  };

  const style = THEME_STYLES[timeKey];
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole];
  const roleLabels = effectiveRoles.filter(r => !r.includes(':')).map(r => ROLE_LABEL[r] ?? r.replace('_', ' '));

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-slate-200/60 text-slate-600 relative transition-colors duration-500 select-none">

      <button
        onClick={toggleSidebar}
        className={cn(
          "absolute -right-3 top-16 flex items-center justify-center w-6 h-10 rounded-md border shadow-sm transition-all duration-300 z-50 hidden md:flex opacity-60 hover:opacity-100 hover:w-7 hover:-right-3.5",
          "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-350"
        )}
        title={isCollapsed ? "Perlebar Sidebar" : "Lipat Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} className="ml-0.5" /> : <ChevronLeft size={14} className="mr-0.5" />}
      </button>

      <div className={cn(
        "flex items-center justify-center border-b border-slate-200/60 shrink-0 transition-all duration-300 overflow-hidden relative w-full",
        isCollapsed ? "h-12 px-0 justify-center" : "h-12 gap-2.5 px-4"
      )}>
        <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 blur-[24px] rounded-full pointer-events-none transition-colors duration-500", style.logoGlow)} />
        {isCollapsed ? (
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain drop-shadow-sm relative z-10 hover:scale-105 transition-transform" />
        ) : (
          <>
            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-md relative z-10 shrink-0" />
            <div className="flex flex-col min-w-0 justify-center relative z-10">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.12em] leading-tight">Pondok Pesantren</span>
              <h1 className="text-[14px] font-black font-serif text-slate-800 tracking-wide leading-tight drop-shadow-sm">SUKAHIDENG</h1>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 transition-colors pb-10">
        {groupedMenu.map(({ group, items }) => {

          if (group === '_standalone') {
            return items.map((fitur) => {
              const Icon = getIcon(fitur.icon);
              const isActive = pathname === fitur.href;
              return (
                <div key={fitur.href} className="animate-in fade-in slide-in-from-left-2 duration-500">
                  <Link
                    href={fitur.href}
                    onClick={onMobileClose}
                    className={cn(
                      "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl overflow-hidden",
                      isCollapsed ? "justify-center p-2.5 mb-1" : "justify-start px-3 py-2 mb-0.5",
                      isActive
                        ? `${style.activeBg} ${style.activeText} border-l-4 ${style.activeBorder}`
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/80 hover:translate-x-0.5 border-l-4 border-transparent"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn(
                        "flex-shrink-0 transition-all duration-300 w-4 h-4",
                        isActive ? style.activeIcon : "text-slate-400 group-hover:text-slate-700"
                      )} />
                      {!isCollapsed && (
                        <span className={cn(
                          "text-xs tracking-normal transition-colors duration-300",
                          isActive ? style.activeText : "text-slate-600 group-hover:text-slate-800"
                        )}>
                          {getMenuTitle(fitur.title)}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              );
            });
          }

          const GroupIcon = GROUP_ICON[group] ?? Settings;
          const isOpen = openFolders[group];
          const hasActiveChild = items.some(i => i.href === pathname);

          return (
            <div key={group} className="animate-in fade-in slide-in-from-left-2 duration-500">
              <button
                onClick={() => toggleFolder(group)}
                className={cn(
                  "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl",
                  isCollapsed ? "justify-center p-2.5 mb-1" : "justify-between px-3 py-2 mb-0.5",
                  hasActiveChild && !isOpen && isCollapsed
                    ? `${style.activeBg} border ${style.activeBorder}`
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/80 hover:translate-x-0.5",
                  isOpen && !isCollapsed
                    ? `${style.folderOpenBg} text-slate-800 border-l-2 ${style.activeBorder}`
                    : "border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center space-x-3">
                  <GroupIcon className={cn(
                    "flex-shrink-0 transition-all duration-300 w-4 h-4",
                    hasActiveChild ? style.activeIcon : "text-slate-400 group-hover:text-slate-700"
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      "font-semibold text-xs tracking-normal transition-colors",
                      hasActiveChild || isOpen ? "text-slate-800" : "text-slate-600 group-hover:text-slate-800"
                    )}>
                      {group}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className={cn(
                    "transition-transform duration-300",
                    hasActiveChild ? style.activeText : "text-slate-400 group-hover:text-slate-600",
                    isOpen ? "rotate-180" : "rotate-0"
                  )}>
                    <ChevronDown size={14} />
                  </div>
                )}
              </button>

              {!isCollapsed && (
                <div className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  isOpen ? "max-h-[1000px] opacity-100 mb-4 mt-2" : "max-h-0 opacity-0"
                )}>
                  <div className="pl-3 space-y-0.5 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 before:rounded-full">
                    {items.map((fitur) => {
                      const ItemIcon = getIcon(fitur.icon);
                      const isActive = pathname === fitur.href;
                      return (
                        <Link
                          key={fitur.href}
                          href={fitur.href}
                          onClick={onMobileClose}
                          className={cn(
                            "flex items-center pl-6 pr-2 py-1.5 rounded-r-xl text-xs transition-all duration-300 relative group overflow-hidden",
                            isActive
                              ? `${style.activeText} ${style.activeBg} font-bold before:absolute before:left-1.5 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:rounded-full ${style.indicator}`
                              : `text-slate-500 hover:text-slate-800 hover:bg-slate-50/60 font-medium hover:translate-x-1 before:absolute before:left-[7px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-slate-250 before:rounded-full hover:before:bg-slate-400`
                          )}
                        >
                          <ItemIcon className={cn(
                            "w-3.5 h-3.5 mr-2 flex-shrink-0 transition-all duration-300",
                            isActive ? `opacity-100 ${style.activeIcon} scale-110` : "text-slate-400 group-hover:text-slate-600 group-hover:scale-110"
                          )} />
                          <span className="truncate">{getMenuTitle(fitur.title)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-200/60 shrink-0 bg-slate-50/50 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100/50 rounded-full blur-2xl pointer-events-none" />

          {/* Role badge */}
          <div className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 border relative z-10", style.roleBadge)}>
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200/50 shadow-inner">
              <UserCog className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={cn("text-[9px] uppercase tracking-widest font-bold leading-none mb-0.5", style.roleLabel)}>
                Akses
              </span>
              <span className="text-xs font-bold text-slate-800 truncate capitalize leading-tight">
                {roleLabels.length <= 2
                  ? roleLabels.join(' • ')
                  : `${roleLabels[0]} +${roleLabels.length - 1}`
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
