'use client'

import React from 'react'
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretDown as ChevronDown,
  X,
  MagnifyingGlass,
  Palette
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { FiturAkses } from "@/lib/cache/fitur-akses";
import {
  getActiveMenu,
  getIcon,
  getMenuTitle,
  GROUP_ICON,
  GROUP_ORDER,
  ROLE_LABEL,
  sortFiturItems,
} from "@/lib/menu/config";
import type { SidebarGroupConfig } from "@/lib/menu/groups";

type ThemeKey = 'light' | 'emerald' | 'blue' | 'purple' | 'rose' | 'slate';

type ThemeColor = {
  bg: string;
  baseText: string;
  borderBase: string;
  logoText: string;
  toggleBtn: string;
  glowText: string;
  activeText: string;
  activeBg: string;
  activeBorder: string;
  hoverBg: string;
  hoverText: string;
  mutedText: string;
  folderActiveBg: string;
  folderOpenBg: string;
  indicator: string;
  glowBg: string;
  lineDivider: string;
  footerBg: string;
  footerGlow: string;
  themeIcon: string;
  themeActiveBorder: string;
  roleBadge: string;
  roleLabel: string;
  searchBg: string;
  searchBorder: string;
  searchFocus: string;
};

const PASTEL_LIGHT: ThemeColor = {
  bg: "bg-[#fffdf8]",
  baseText: "text-[#34483c]",
  borderBase: "border-[#e4ddcf]",
  logoText: "text-[#12372a]",
  toggleBtn: "bg-white border-[#ddd4c3] text-[#66736c] hover:bg-[#eaf3e9] hover:text-[#12372a] hover:border-[#9ab5a2] shadow-sm",
  glowText: "text-[#247451]",
  activeText: "text-[#12372a]",
  activeBg: "bg-[#eaf3e9]",
  activeBorder: "border-[#9ab5a2]",
  hoverBg: "hover:bg-[#f5f2eb]",
  hoverText: "group-hover:text-[#12372a]",
  mutedText: "text-[#66736c]",
  folderActiveBg: "bg-[#eaf3e9] border-[#c9d8ce]",
  folderOpenBg: "border-[#c9d8ce]",
  indicator: "before:bg-[#247451] before:shadow-none",
  glowBg: "bg-transparent",
  lineDivider: "before:bg-[#ddd4c3]",
  footerBg: "bg-[#f7f1e5] border-[#e4ddcf]",
  footerGlow: "bg-transparent",
  themeIcon: "text-[#66736c]",
  themeActiveBorder: "border-[#247451]",
  roleBadge: "bg-white/80 text-[#34483c] border border-[#ddd4c3]",
  roleLabel: "text-[#66736c]",
  searchBg: "bg-white",
  searchBorder: "border border-[#ddd4c3]",
  searchFocus: "focus:bg-white focus:border-[#9ab5a2] focus:ring-1 focus:ring-[#9ab5a2]",
};

const THEME_COLORS: Record<ThemeKey, ThemeColor> = {
  light: PASTEL_LIGHT,
  emerald: {
    ...PASTEL_LIGHT,
    bg: "bg-emerald-50",
    borderBase: "border-emerald-100",
    logoText: "text-emerald-950",
    toggleBtn: "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-950 hover:border-emerald-300 shadow-sm",
    glowText: "text-emerald-700",
    activeText: "text-emerald-950",
    activeBg: "bg-emerald-100",
    activeBorder: "border-emerald-300",
    hoverBg: "hover:bg-emerald-100",
    hoverText: "group-hover:text-emerald-950",
    mutedText: "text-emerald-800",
    folderActiveBg: "bg-emerald-100 border-emerald-200",
    folderOpenBg: "border-emerald-200",
    indicator: "before:bg-emerald-600 before:shadow-none",
    lineDivider: "before:bg-emerald-200",
    footerBg: "bg-emerald-100 border-emerald-200",
    themeActiveBorder: "border-emerald-600",
    roleBadge: "bg-white/80 text-emerald-900 border border-emerald-200",
    roleLabel: "text-emerald-700",
    searchBorder: "border border-emerald-200",
    searchFocus: "focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300",
  },
  blue: {
    ...PASTEL_LIGHT,
    bg: "bg-sky-50",
    borderBase: "border-sky-100",
    logoText: "text-sky-950",
    toggleBtn: "bg-white border-sky-200 text-sky-700 hover:bg-sky-100 hover:text-sky-950 hover:border-sky-300 shadow-sm",
    glowText: "text-sky-700",
    activeText: "text-sky-950",
    activeBg: "bg-sky-100",
    activeBorder: "border-sky-300",
    hoverBg: "hover:bg-sky-100",
    hoverText: "group-hover:text-sky-950",
    mutedText: "text-sky-800",
    folderActiveBg: "bg-sky-100 border-sky-200",
    folderOpenBg: "border-sky-200",
    indicator: "before:bg-sky-600 before:shadow-none",
    lineDivider: "before:bg-sky-200",
    footerBg: "bg-sky-100 border-sky-200",
    themeActiveBorder: "border-sky-600",
    roleBadge: "bg-white/80 text-sky-900 border border-sky-200",
    roleLabel: "text-sky-700",
    searchBorder: "border border-sky-200",
    searchFocus: "focus:bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-300",
  },
  purple: {
    ...PASTEL_LIGHT,
    bg: "bg-violet-50",
    borderBase: "border-violet-100",
    logoText: "text-violet-950",
    toggleBtn: "bg-white border-violet-200 text-violet-700 hover:bg-violet-100 hover:text-violet-950 hover:border-violet-300 shadow-sm",
    glowText: "text-violet-700",
    activeText: "text-violet-950",
    activeBg: "bg-violet-100",
    activeBorder: "border-violet-300",
    hoverBg: "hover:bg-violet-100",
    hoverText: "group-hover:text-violet-950",
    mutedText: "text-violet-800",
    folderActiveBg: "bg-violet-100 border-violet-200",
    folderOpenBg: "border-violet-200",
    indicator: "before:bg-violet-600 before:shadow-none",
    lineDivider: "before:bg-violet-200",
    footerBg: "bg-violet-100 border-violet-200",
    themeActiveBorder: "border-violet-600",
    roleBadge: "bg-white/80 text-violet-900 border border-violet-200",
    roleLabel: "text-violet-700",
    searchBorder: "border border-violet-200",
    searchFocus: "focus:bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-300",
  },
  rose: {
    ...PASTEL_LIGHT,
    bg: "bg-rose-50",
    borderBase: "border-rose-100",
    logoText: "text-rose-950",
    toggleBtn: "bg-white border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-950 hover:border-rose-300 shadow-sm",
    glowText: "text-rose-700",
    activeText: "text-rose-950",
    activeBg: "bg-rose-100",
    activeBorder: "border-rose-300",
    hoverBg: "hover:bg-rose-100",
    hoverText: "group-hover:text-rose-950",
    mutedText: "text-rose-800",
    folderActiveBg: "bg-rose-100 border-rose-200",
    folderOpenBg: "border-rose-200",
    indicator: "before:bg-rose-600 before:shadow-none",
    lineDivider: "before:bg-rose-200",
    footerBg: "bg-rose-100 border-rose-200",
    themeActiveBorder: "border-rose-600",
    roleBadge: "bg-white/80 text-rose-900 border border-rose-200",
    roleLabel: "text-rose-700",
    searchBorder: "border border-rose-200",
    searchFocus: "focus:bg-white focus:border-rose-400 focus:ring-1 focus:ring-rose-300",
  },
  slate: {
    ...PASTEL_LIGHT,
    bg: "bg-slate-50",
    borderBase: "border-slate-200",
    logoText: "text-slate-900",
    toggleBtn: "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 shadow-sm",
    glowText: "text-slate-700",
    activeText: "text-slate-900",
    activeBg: "bg-slate-100",
    activeBorder: "border-slate-300",
    hoverBg: "hover:bg-slate-100",
    hoverText: "group-hover:text-slate-900",
    mutedText: "text-slate-700",
    folderActiveBg: "bg-slate-100 border-slate-200",
    folderOpenBg: "border-slate-200",
    indicator: "before:bg-slate-600 before:shadow-none",
    lineDivider: "before:bg-slate-200",
    footerBg: "bg-slate-100 border-slate-200",
    themeActiveBorder: "border-slate-600",
    roleBadge: "bg-white/80 text-slate-800 border border-slate-200",
    roleLabel: "text-slate-600",
    searchBorder: "border border-slate-200",
    searchFocus: "focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300",
  },
};
const OPEN_GROUPS_KEY = 'eskahade_sidebar_open_groups';

function persistOpenFolders(folders: Record<string, boolean>) {
  try {
    const open = Object.keys(folders).filter(k => folders[k]);
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(open));
  } catch {}
}

interface SidebarProps {
  userRole?: string;
  userRoles?: string[];
  fiturAkses: FiturAkses[];
  sidebarGroups?: SidebarGroupConfig[];
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ userRole = 'wali_kelas', userRoles, fiturAkses, sidebarGroups = [], isCollapsed, toggleSidebar, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeKey>('light');

  const [mounted, setMounted] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const initializedFoldersRef = useRef(false);

  // Build grouped menu dari fiturAkses
  const groupMap = new Map<string, FiturAkses[]>();
  for (const f of fiturAkses) {
    if (!groupMap.has(f.group_name)) groupMap.set(f.group_name, []);
    groupMap.get(f.group_name)!.push(f);
  }

  // Urutan & label grup dari tabel sidebar_groups (DB), dengan fallback ke
  // GROUP_ORDER legacy kalau tabel kosong/belum migrasi.
  const groupCfgMap = new Map<string, SidebarGroupConfig>();
  for (const g of sidebarGroups) groupCfgMap.set(g.group_name, g);

  const minUrutanOf = (group: string) => Math.min(...groupMap.get(group)!.map(i => i.urutan));

  // Semua grup terdaftar (termasuk yang disembunyikan) dianggap "terkonfigurasi"
  // supaya grup nonaktif TIDAK jatuh ke fallback GROUP_ORDER dan ikut tampil.
  const configuredSet = new Set(sidebarGroups.map(g => g.group_name));
  const cfgOrdered = [...sidebarGroups]
    .filter(g => g.is_active && groupMap.has(g.group_name))
    .sort((a, b) => (a.urutan - b.urutan) || a.group_name.localeCompare(b.group_name))
    .map(g => g.group_name);
  const fallbackOrder = GROUP_ORDER.filter(g => groupMap.has(g) && !configuredSet.has(g));
  const fallbackSet = new Set(fallbackOrder);
  const leftoverOrder = Array.from(groupMap.keys())
    .filter(g => !configuredSet.has(g) && !fallbackSet.has(g))
    .sort((a, b) => (minUrutanOf(a) - minUrutanOf(b)) || a.localeCompare(b));
  const orderedGroups = [...cfgOrdered, ...fallbackOrder, ...leftoverOrder];

  const groupLabel = (group: string) => groupCfgMap.get(group)?.label || group;

  const groupedMenu = orderedGroups
    .map(g => ({ group: g, label: groupLabel(g), items: sortFiturItems(groupMap.get(g)!) }))
    .map(g => {
      if (!searchQuery) return g;
      const lowerQuery = searchQuery.toLowerCase();
      const filteredItems = g.items.filter(i =>
        getMenuTitle(i.title).toLowerCase().includes(lowerQuery) ||
        (g.group !== '_standalone' && g.label.toLowerCase().includes(lowerQuery))
      );
      return { ...g, items: filteredItems };
    })
    .filter(g => g.items.length > 0);

  const activeHref = getActiveMenu(pathname, fiturAkses);

  // Mount: pulihkan grup sidebar yang terbuka
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('app-theme') as ThemeKey;
    if (savedTheme && THEME_COLORS[savedTheme]) setTheme(savedTheme);

    if (!initializedFoldersRef.current) {
      const savedRaw = localStorage.getItem(OPEN_GROUPS_KEY);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (Array.isArray(parsed)) {
            const groupNames = new Set(groupedMenu.filter(g => g.group !== '_standalone').map(g => g.group));
            const valid = parsed.filter((g): g is string => typeof g === 'string' && groupNames.has(g));
            if (valid.length > 0) {
              const next: Record<string, boolean> = {};
              valid.forEach(g => { next[g] = true; });
              setOpenFolders(next);
            }
          }
        } catch {}
      }
      initializedFoldersRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-buka grup berisi halaman aktif (dan persist)
  useEffect(() => {
    if (!mounted) return;
    const activeGroup = groupedMenu.find(g =>
      g.group !== '_standalone' && g.items.some(i => i.href === activeHref)
    );
    if (activeGroup) {
      setOpenFolders(prev => {
        if (prev[activeGroup.group]) return prev;
        const next = { ...prev, [activeGroup.group]: true };
        persistOpenFolders(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pathname]);

  // Tutup drawer mobile saat pindah halaman
  useEffect(() => {
    if (isMobileOpen) onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const changeTheme = (newTheme: ThemeKey) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const toggleFolder = (group: string) => {
    if (isCollapsed) {
      toggleSidebar();
      const next = { [group]: true };
      setOpenFolders(next);
      persistOpenFolders(next);
    } else {
      setOpenFolders(prev => {
        const next = { ...prev, [group]: !prev[group] };
        persistOpenFolders(next);
        return next;
      });
    }
  };

  if (!mounted) return null;

  const c = THEME_COLORS[theme];
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole];
  const roleLabels = effectiveRoles.filter(r => !r.includes(':')).map(r => ROLE_LABEL[r] ?? r.replace('_', ' '));

  // renderNavContent dipakai untuk desktop (mobile=false) DAN drawer mobile (mobile=true)
  const renderNavContent = (mobile = false) => {
    const collapsed = !mobile && isCollapsed;
    const searching = searchQuery.trim().length > 0;

    return (
      <div className={cn("flex flex-col h-full w-full relative transition-colors duration-500", c.baseText, c.bg)}>

        {/* ── LOGO BAR — h-12 sejajar header ── */}
        <div className={cn(
          "flex items-center justify-center border-b shrink-0 transition-all duration-300 overflow-hidden relative w-full",
          c.borderBase,
          collapsed ? "h-12 px-0 justify-center" : "h-12 gap-2.5 px-4"
        )}>
          <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 blur-[24px] rounded-full pointer-events-none transition-colors duration-500", c.glowBg)} />
          {collapsed ? (
            <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain drop-shadow-lg relative z-10 hover:scale-105 transition-transform" />
          ) : (
            <>
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-xl relative z-10 shrink-0" />
              <div className="flex flex-col min-w-0 justify-center relative z-10">
                <span className={cn("text-[9px] font-semibold uppercase tracking-[0.12em] leading-tight transition-colors duration-300", c.glowText)}>Pondok Pesantren</span>
                <h1 className={cn("text-[15px] font-black font-serif tracking-wide leading-tight drop-shadow-md", c.logoText)}>SUKAHIDENG</h1>
              </div>
            </>
          )}
          {mobile && (
            <button
              onClick={onMobileClose}
              className={cn("absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors z-10", c.mutedText, c.hoverBg, c.activeText)}
              aria-label="Tutup menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── PINNED: Cari Menu + Item Standalone ── */}
        {!collapsed && (
          <div className={cn("px-3 py-3 border-b shrink-0", c.borderBase)}>
            <div className="relative">
              <MagnifyingGlass className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4", c.mutedText)} />
              <input
                type="text"
                placeholder="Cari fitur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-8 py-1.5 text-xs rounded-lg outline-none transition-all duration-300 placeholder:opacity-70",
                  c.searchBg,
                  c.baseText,
                  c.searchBorder,
                  c.searchFocus
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={cn("absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5", c.mutedText, c.hoverBg, c.activeText)}
                  aria-label="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── NAV — grup menu (scrollable) ── */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 transition-colors pb-10">
          {groupedMenu.map(({ group, label, items }) => {

            // Item standalone (top-level, tanpa folder)
            if (group === '_standalone') {
              return items.map((fitur) => {
                const Icon = getIcon(fitur.icon);
                const isActive = activeHref === fitur.href;
                return (
                  <div key={fitur.href} className="animate-in fade-in slide-in-from-left-2 duration-500">
                    <Link
                      href={fitur.href}
                      prefetch={true}
                      onClick={mobile ? onMobileClose : undefined}
                      className={cn(
                        "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl overflow-hidden",
                        collapsed ? "justify-center p-2.5 mb-1" : "justify-start px-3 py-2 mb-0.5",
                        isActive
                          ? `${c.activeBg} ${c.activeText} font-bold border-l-4 ${c.activeBorder}`
                          : `${c.mutedText} ${c.hoverBg} ${c.hoverText} hover:translate-x-1 border-l-4 border-transparent`
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={cn(
                          "flex-shrink-0 transition-all duration-300 w-4 h-4",
                          isActive ? c.activeText : `${c.mutedText} ${c.hoverText}`
                        )} />
                        {!collapsed && (
                          <span className={cn(
                            "text-xs tracking-normal transition-colors duration-300",
                            isActive ? c.activeText : `${c.mutedText} ${c.hoverText}`
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

            const GroupIcon = GROUP_ICON[group] ?? getIcon('Settings');
            const isOpen = searching || !!openFolders[group];
            const hasActiveChild = items.some(i => i.href === activeHref);

            return (
              <div key={group} className="animate-in fade-in slide-in-from-left-2 duration-500">
                <button
                  onClick={() => toggleFolder(group)}
                  className={cn(
                    "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl",
                    collapsed ? "justify-center p-2.5 mb-1" : "justify-between px-3 py-2 mb-0.5",
                    hasActiveChild && !isOpen && isCollapsed
                      ? `${c.folderActiveBg} ${c.activeText} shadow-lg border`
                      : `${c.mutedText} ${c.hoverBg} ${c.hoverText} hover:translate-x-1`,
                    isOpen && !collapsed
                      ? `bg-transparent ${c.activeText} border-l-2 ${c.folderOpenBg}`
                      : "border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <GroupIcon className={cn(
                      "flex-shrink-0 transition-all duration-300 w-4 h-4",
                      hasActiveChild ? c.glowText : `opacity-80 ${c.hoverText} group-hover:opacity-100`
                    )} />
                    {!collapsed && (
                      <span className={cn(
                        "font-semibold text-xs tracking-normal transition-colors",
                        hasActiveChild || isOpen ? c.activeText : `${c.mutedText} ${c.hoverText}`
                      )}>
                        {label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <div className={cn(
                      "transition-transform duration-300",
                      hasActiveChild ? c.activeText : `opacity-40 ${c.hoverText} group-hover:opacity-100`,
                      isOpen ? "rotate-180" : "rotate-0"
                    )}>
                      <ChevronDown size={16} />
                    </div>
                  )}
                </button>

                {!collapsed && (
                  <div className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}>
                    <div className="min-w-0 overflow-hidden">
                      <div className={cn("pl-3 space-y-0.5 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full", c.lineDivider)}>
                        {items.map((fitur) => {
                          const ItemIcon = getIcon(fitur.icon);
                          const isActive = activeHref === fitur.href;
                          return (
                            <Link
                              key={fitur.href}
                              href={fitur.href}
                              prefetch={true}
                              onClick={mobile ? onMobileClose : undefined}
                              className={cn(
                                "flex items-center pl-6 pr-2 py-1.5 rounded-r-xl text-xs transition-all duration-300 relative group overflow-hidden",
                                isActive
                                  ? `${c.activeText} ${c.activeBg} font-bold before:absolute before:left-1.5 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:rounded-full ${c.indicator}`
                                  : `${c.mutedText} ${c.hoverText} ${c.hoverBg} font-medium hover:translate-x-1 before:absolute before:left-[7px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-current before:opacity-20 before:rounded-full hover:before:opacity-60`
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
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── FOOTER: tema + role ── */}
        {!collapsed && (
          <div className={cn("p-4 border-t shrink-0 backdrop-blur-md relative overflow-hidden", c.footerBg)}>
            <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none", c.footerGlow)} />

            {/* Theme switcher */}
            <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
              <Palette className={cn("w-3.5 h-3.5", c.themeIcon)} />
              {(Object.keys(THEME_COLORS) as ThemeKey[]).map(t => (
                <button
                  key={t}
                  onClick={() => changeTheme(t)}
                  title={t.charAt(0).toUpperCase() + t.slice(1)}
                  aria-label={'Tema ' + t}
                  aria-pressed={theme === t}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all duration-200 active:scale-95 motion-reduce:transition-none",
                    theme === t ? c.themeActiveBorder + ' scale-110' : "border-transparent opacity-70 hover:opacity-100 hover:scale-110"
                  )}
                  style={{
                    backgroundColor:
                      t === 'light'   ? '#e8dfcf' :
                      t === 'emerald' ? '#d1fae5' :
                      t === 'blue'    ? '#dbeafe' :
                      t === 'purple'  ? '#ede9fe' :
                      t === 'rose'    ? '#ffe4e6' : '#e2e8f0'
                  }}
                />
              ))}
            </div>

            {/* Role badge */}
            <div className="flex flex-col gap-1.5 mt-2 relative z-10">
              <span className={cn("text-[9px] uppercase tracking-widest font-semibold ml-1", c.roleLabel)}>
                Akses Admin
              </span>
              <div className={cn("flex flex-wrap gap-1", roleLabels.length > 2 ? "" : "items-center")}>
                {roleLabels.slice(0, 2).map((label, idx) => (
                  <span key={idx} className={cn("text-[10px] font-bold px-2 py-1 rounded-md", c.roleBadge)}>
                    {label}
                  </span>
                ))}
                {roleLabels.length > 2 && (
                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md", c.roleBadge)}>
                    +{roleLabels.length - 2}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop sidebar */}
      <div className={cn(
        "no-print hidden md:flex flex-col fixed inset-y-0 z-50 border-r border-slate-200 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-60"
      )}>
        {renderNavContent()}

        {/* Tombol collapse (desktop) */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute -right-3.5 top-16 flex items-center justify-center w-7 h-7 rounded-full border shadow-md transition-all duration-300 z-50 hidden md:flex opacity-60 hover:opacity-100 hover:scale-110",
            c.toggleBtn
          )}
          title={isCollapsed ? "Perlebar Sidebar" : "Lipat Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} className="ml-0.5" /> : <ChevronLeft size={14} className="mr-0.5" />}
        </button>
      </div>

      {/* Drawer mobile */}
      <div className={cn(
        "no-print fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 text-white shadow-2xl transform transition-transform duration-300 md:hidden",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {renderNavContent(true)}
      </div>
    </>
  );
}
