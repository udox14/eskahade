'use client'

import React from 'react'
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  ChevronLeft, ChevronRight, ChevronDown, Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog, Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet, Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package, Image as ImageIcon, School, Palette, Archive, Utensils, CalendarDays, ArrowLeftRight, Flame, ClipboardList, ToggleRight,
  LogOut, CalendarRange, Download, FileWarning, Shuffle, Home, UserX, UserMinus
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
  'UPK': Package,
  'EHB': ClipboardList,
  'Master Data': Database,
};

const MENU_TITLE_MAP: Record<string, string> = {
  'Manajemen User': 'User',
  'Manajemen Santri': 'Tools Santri',
  'Manajemen Guru & Jadwal': 'Guru & Jadwal',
  'Manajemen Kelas': 'Kelas',
  'Manajemen Kitab': 'Kitab',
  'Manajemen Fitur': 'Fitur Akses',
};

function getMenuTitle(title: string) {
  return MENU_TITLE_MAP[title] ?? title;
}

const GROUP_ITEM_ORDER: Record<string, string[]> = {
  'Master Data': [
    'Tahun Ajaran',
    'Kelas',
    'Kitab',
    'Guru & Jadwal',
    'Tools Santri',
    'Arsip Alumni',
    'Periode Perpulangan',
    'Master Pelanggaran',
    'User',
    'Fitur Akses',
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

type ThemeKey = 'emerald' | 'blue' | 'purple' | 'rose' | 'slate';

type ThemeColor = {
  bg: string;
  toggleBtn: string;
  glowText: string;
  activeText: string;
  activeBg: string;
  activeBorder: string;
  hoverBg: string;
  mutedText: string;
  folderActiveBg: string;
  folderOpenBg: string;
  indicator: string;
  glowBg: string;
  roleBadge: string;
  roleLabel: string;
};

const THEME_COLORS: Record<ThemeKey, ThemeColor> = {
  emerald: {
    bg: "bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-950",
    toggleBtn: "bg-emerald-900 border-emerald-500/30 text-emerald-400 hover:bg-emerald-700 hover:text-emerald-100 hover:border-emerald-400",
    glowText: "text-emerald-400",
    activeText: "text-white",
    activeBg: "bg-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
    activeBorder: "border-emerald-400",
    hoverBg: "hover:bg-black/10",
    mutedText: "text-emerald-100/60",
    folderActiveBg: "bg-black/20 border-emerald-500/20",
    folderOpenBg: "border-emerald-500/30",
    indicator: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    glowBg: "bg-emerald-400/10",
    roleBadge: "bg-emerald-500/20 border-emerald-400/30 text-emerald-300",
    roleLabel: "text-emerald-400/70",
  },
  blue: {
    bg: "bg-gradient-to-b from-blue-950 via-blue-900 to-slate-950",
    toggleBtn: "bg-blue-900 border-blue-500/30 text-blue-400 hover:bg-blue-700 hover:text-blue-100 hover:border-blue-400",
    glowText: "text-blue-400",
    activeText: "text-white",
    activeBg: "bg-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
    activeBorder: "border-blue-400",
    hoverBg: "hover:bg-black/10",
    mutedText: "text-blue-100/60",
    folderActiveBg: "bg-black/20 border-blue-500/20",
    folderOpenBg: "border-blue-500/30",
    indicator: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]",
    glowBg: "bg-blue-400/10",
    roleBadge: "bg-blue-500/20 border-blue-400/30 text-blue-300",
    roleLabel: "text-blue-400/70",
  },
  purple: {
    bg: "bg-gradient-to-b from-purple-950 via-purple-900 to-slate-950",
    toggleBtn: "bg-purple-900 border-purple-500/30 text-purple-400 hover:bg-purple-700 hover:text-purple-100 hover:border-purple-400",
    glowText: "text-purple-400",
    activeText: "text-white",
    activeBg: "bg-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
    activeBorder: "border-purple-400",
    hoverBg: "hover:bg-black/10",
    mutedText: "text-purple-100/60",
    folderActiveBg: "bg-black/20 border-purple-500/20",
    folderOpenBg: "border-purple-500/30",
    indicator: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
    glowBg: "bg-purple-400/10",
    roleBadge: "bg-purple-500/20 border-purple-400/30 text-purple-300",
    roleLabel: "text-purple-400/70",
  },
  rose: {
    bg: "bg-gradient-to-b from-rose-950 via-rose-900 to-slate-950",
    toggleBtn: "bg-rose-900 border-rose-500/30 text-rose-400 hover:bg-rose-700 hover:text-rose-100 hover:border-rose-400",
    glowText: "text-rose-400",
    activeText: "text-white",
    activeBg: "bg-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
    activeBorder: "border-rose-400",
    hoverBg: "hover:bg-black/10",
    mutedText: "text-rose-100/60",
    folderActiveBg: "bg-black/20 border-rose-500/20",
    folderOpenBg: "border-rose-500/30",
    indicator: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]",
    glowBg: "bg-rose-400/10",
    roleBadge: "bg-rose-500/20 border-rose-400/30 text-rose-300",
    roleLabel: "text-rose-400/70",
  },
  slate: {
    bg: "bg-gradient-to-b from-slate-950 via-slate-900 to-black",
    toggleBtn: "bg-slate-900 border-slate-500/30 text-slate-400 hover:bg-slate-800 hover:text-slate-100 hover:border-slate-400",
    glowText: "text-slate-300",
    activeText: "text-white",
    activeBg: "bg-black/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
    activeBorder: "border-slate-400",
    hoverBg: "hover:bg-white/5",
    mutedText: "text-slate-400",
    folderActiveBg: "bg-black/30 border-slate-500/20",
    folderOpenBg: "border-slate-500/30",
    indicator: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.8)]",
    glowBg: "bg-slate-400/10",
    roleBadge: "bg-slate-500/20 border-slate-400/30 text-slate-300",
    roleLabel: "text-slate-400/70",
  }
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  keamanan: 'Keamanan',
  sekpen: 'Sekretaris Pen.',
  dewan_santri: 'Dewan Santri',
  pengurus_asrama: 'Pengurus Asrama',
  wali_kelas: 'Wali Kelas',
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
  'UPK',
  'EHB',
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
  const [theme, setTheme] = useState<ThemeKey>('emerald');
  const [mounted, setMounted] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('app-theme') as ThemeKey;
    if (savedTheme && THEME_COLORS[savedTheme]) setTheme(savedTheme);
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

  const changeTheme = (newTheme: ThemeKey) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const toggleFolder = (title: string) => {
    if (isCollapsed) {
      toggleSidebar();
      setOpenFolders({ [title]: true });
    } else {
      setOpenFolders(prev => ({ ...prev, [title]: !prev[title] }));
    }
  };

  const c = mounted ? THEME_COLORS[theme] : THEME_COLORS['emerald'];
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole];
  const roleLabels = effectiveRoles.map(r => ROLE_LABEL[r] ?? r.replace('_', ' '));

  return (
    <div className={cn("flex flex-col h-full w-full text-white/90 relative transition-colors duration-500", c.bg)}>

      <button
        onClick={toggleSidebar}
        className={cn(
          "absolute -right-3 top-16 flex items-center justify-center w-6 h-10 rounded-md border shadow-sm transition-all duration-300 z-50 hidden md:flex opacity-60 hover:opacity-100 hover:w-7 hover:-right-3.5",
          c.toggleBtn
        )}
        title={isCollapsed ? "Perlebar Sidebar" : "Lipat Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} className="ml-0.5" /> : <ChevronLeft size={14} className="mr-0.5" />}
      </button>

      <div className={cn(
        "flex items-center justify-center border-b border-white/5 shrink-0 transition-all duration-300 overflow-hidden relative w-full",
        isCollapsed ? "h-12 px-0 justify-center" : "h-12 gap-2.5 px-4"
      )}>
        <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 blur-[24px] rounded-full pointer-events-none transition-colors duration-500", c.glowBg)} />
        {isCollapsed ? (
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain drop-shadow-lg relative z-10 hover:scale-105 transition-transform" />
        ) : (
          <>
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-xl relative z-10 shrink-0" />
            <div className="flex flex-col min-w-0 justify-center relative z-10">
              <span className={cn("text-[9px] font-semibold uppercase tracking-[0.12em] leading-tight transition-colors duration-300", c.glowText)}>Pondok Pesantren</span>
              <h1 className="text-[15px] font-black font-serif text-white tracking-wide leading-tight drop-shadow-md">SUKAHIDENG</h1>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/40 transition-colors pb-10">
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
                        ? `${c.activeBg} ${c.activeText} font-bold border-l-4 ${c.activeBorder}`
                        : `${c.mutedText} ${c.hoverBg} hover:text-white hover:translate-x-1 border-l-4 border-transparent`
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn(
                        "flex-shrink-0 transition-all duration-300",
                        isCollapsed ? "w-4 h-4" : "w-4 h-4",
                        isActive ? c.activeText : `${c.mutedText} group-hover:text-white`
                      )} />
                      {!isCollapsed && (
                        <span className={cn(
                          "text-xs tracking-normal transition-colors duration-300",
                          isActive ? "text-white" : `${c.mutedText} group-hover:text-white`
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
                    ? `${c.folderActiveBg} text-white shadow-lg border`
                    : `${c.mutedText} ${c.hoverBg} hover:text-white hover:translate-x-1`,
                  isOpen && !isCollapsed
                    ? `bg-black/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border-l-2 ${c.folderOpenBg}`
                    : "border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center space-x-3">
                  <GroupIcon className={cn(
                    "flex-shrink-0 transition-all duration-300",
                    isCollapsed ? "w-4 h-4" : "w-4 h-4",
                    hasActiveChild ? c.glowText : `opacity-80 group-hover:text-white group-hover:opacity-100`
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      "font-semibold text-xs tracking-normal transition-colors",
                      hasActiveChild || isOpen ? "text-white" : `${c.mutedText} group-hover:text-white`
                    )}>
                      {group}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className={cn(
                    "transition-transform duration-300",
                    hasActiveChild ? c.activeText : `opacity-40 group-hover:text-white group-hover:opacity-100`,
                    isOpen ? "rotate-180" : "rotate-0"
                  )}>
                    <ChevronDown size={16} />
                  </div>
                )}
              </button>

              {!isCollapsed && (
                <div className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  isOpen ? "max-h-[1000px] opacity-100 mb-4 mt-2" : "max-h-0 opacity-0"
                )}>
                  <div className="pl-3 space-y-0.5 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10 before:rounded-full">
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
                              ? `text-white ${c.activeBg} font-bold before:absolute before:left-1.5 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:rounded-full ${c.indicator}`
                              : `${c.mutedText} hover:text-white ${c.hoverBg} font-medium hover:translate-x-1 before:absolute before:left-[7px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-white/20 before:rounded-full hover:before:bg-white/60`
                          )}
                        >
                          <ItemIcon className={cn(
                            "w-3.5 h-3.5 mr-2 flex-shrink-0 transition-all duration-300",
                            isActive ? `opacity-100 ${c.activeText} scale-110` : "opacity-40 group-hover:opacity-100 group-hover:scale-110"
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
        <div className="p-4 border-t border-white/10 shrink-0 bg-black/20 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          {/* Theme switcher */}
          <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
            <Palette className="w-3.5 h-3.5 text-white/30" />
            {(Object.keys(THEME_COLORS) as ThemeKey[]).map(t => (
              <button
                key={t}
                onClick={() => changeTheme(t)}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 transition-all duration-300",
                  theme === t ? "border-white scale-125" : "border-transparent opacity-40 hover:opacity-100 hover:scale-110"
                )}
                style={{
                  backgroundColor:
                    t === 'emerald' ? '#10b981' :
                    t === 'blue'    ? '#3b82f6' :
                    t === 'purple'  ? '#a855f7' :
                    t === 'rose'    ? '#f43f5e' : '#475569'
                }}
              />
            ))}
          </div>

          {/* Role badge */}
          <div className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 border relative z-10", c.roleBadge)}>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <UserCog className="w-3.5 h-3.5 text-white/70" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={cn("text-[9px] uppercase tracking-widest font-semibold leading-none mb-0.5", c.roleLabel)}>
                Akses
              </span>
              <span className="text-xs font-bold text-white truncate capitalize leading-tight">
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
