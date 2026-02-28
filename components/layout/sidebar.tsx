'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  ChevronLeft, ChevronRight, ChevronDown, Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog, RefreshCw, Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet, Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package, Image as ImageIcon, School, Palette, Archive, Utensils
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// --- KONFIGURASI TEMA (PALET WARNA PREMIUM) ---
type ThemeKey = 'emerald' | 'blue' | 'purple' | 'rose' | 'slate';

const THEME_COLORS: Record<ThemeKey, any> = {
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
    glowBg: "bg-emerald-400/10"
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
    glowBg: "bg-blue-400/10"
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
    glowBg: "bg-purple-400/10"
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
    glowBg: "bg-rose-400/10"
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
    glowBg: "bg-slate-400/10"
  }
};

type Role = 'admin' | 'keamanan' | 'sekpen' | 'dewan_santri' | 'pengurus_asrama' | 'wali_kelas' | 'bendahara';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

interface MenuNode {
  isGroup: boolean;
  title: string;
  icon: React.ElementType;
  href?: string;       
  roles?: Role[];      
  items?: MenuItem[];  
}

// STRUKTUR NAVIGASI
const menuNodes: MenuNode[] = [
  // --- DIRECT LINKS (Top Level) ---
  {
    isGroup: false,
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']
  },
  {
    isGroup: false,
    title: "Data Santri",
    href: "/dashboard/santri",
    icon: Users,
    roles: ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']
  },
  
  // --- FOLDERS (Accordion) ---
  {
    isGroup: true,
    title: "Kesantrian", 
    icon: ShieldAlert,
    items: [
      { title: "Sensus Penduduk", href: "/dashboard/dewan-santri/sensus", icon: BarChart3, roles: ['admin', 'dewan_santri'] },
      { title: "Laporan Sensus", href: "/dashboard/dewan-santri/sensus/laporan", icon: Printer, roles: ['admin', 'dewan_santri'] },
      { title: "Manajemen Foto", href: "/dashboard/santri/foto", icon: ImageIcon, roles: ['admin', 'dewan_santri'] },
      { title: "Layanan Surat", href: "/dashboard/dewan-santri/surat", icon: Mail, roles: ['admin', 'dewan_santri'] },
      { title: "Absen Malam", href: "/dashboard/asrama/absen-malam", icon: Moon, roles: ['admin', 'pengurus_asrama'] },
      { title: "Absen Sakit Pagi", href: "/dashboard/asrama/absen-sakit", icon: Stethoscope, roles: ['admin', 'pengurus_asrama'] },
      { title: "Katering & Laundry", href: "/dashboard/asrama/layanan", icon: Utensils, roles: ['admin', 'dewan_santri', 'pengurus_asrama'] },
      { title: "Perizinan Santri", href: "/dashboard/keamanan/perizinan", icon: MapPin, roles: ['admin', 'dewan_santri'] },
      { title: "Cetak Telat Datang", href: "/dashboard/keamanan/perizinan/cetak-telat", icon: Clock, roles: ['admin', 'keamanan'] },
      { title: "Verifikasi Telat", href: "/dashboard/keamanan/perizinan/verifikasi-telat", icon: Gavel, roles: ['admin', 'keamanan'] },
      { title: "Pelanggaran & SP", href: "/dashboard/keamanan", icon: ShieldAlert, roles: ['admin', 'keamanan'] },
    ]
  },
  {
    isGroup: true,
    title: "Pengkelasan", 
    icon: School,
    items: [
      { title: "Tes Klasifikasi", href: "/dashboard/santri/tes-klasifikasi", icon: ClipboardCheck, roles: ['admin', 'sekpen'] },
      { title: "Penempatan Kelas", href: "/dashboard/santri/atur-kelas", icon: UserPlus, roles: ['admin', 'sekpen'] },
      { title: "Grading Santri", href: "/dashboard/akademik/grading", icon: BarChart3, roles: ['admin', 'sekpen', 'wali_kelas'] },
      { title: "Kenaikan Kelas", href: "/dashboard/akademik/kenaikan", icon: ArrowUpCircle, roles: ['admin', 'sekpen'] },
    ]
  },
  {
    isGroup: true,
    title: "Nilai & Rapor",
    icon: BookOpen,
    items: [
      { title: "Input Nilai", href: "/dashboard/akademik/nilai/input", icon: BookOpen, roles: ['admin', 'sekpen', 'wali_kelas'] },
      { title: "Leger Nilai", href: "/dashboard/akademik/leger", icon: FileSpreadsheet, roles: ['admin', 'sekpen', 'wali_kelas'] },
      { title: "Ranking & Prestasi", href: "/dashboard/akademik/ranking", icon: TrendingUp, roles: ['admin', 'sekpen', 'wali_kelas'] },
      { title: "Cetak Rapor", href: "/dashboard/laporan/rapor", icon: FileText, roles: ['admin', 'sekpen', 'wali_kelas'] },
    ]
  },
  {
    isGroup: true,
    title: "Absensi", 
    icon: CalendarCheck,
    items: [
      { title: "Absen Pengajian", href: "/dashboard/akademik/absensi", icon: CalendarCheck, roles: ['admin', 'sekpen'] },
      { title: "Rekap Absensi", href: "/dashboard/akademik/absensi/rekap", icon: Filter, roles: ['admin', 'sekpen', 'wali_kelas', 'keamanan', 'dewan_santri', 'pengurus_asrama'] },
      { title: "Verifikasi Absen", href: "/dashboard/akademik/absensi/verifikasi", icon: UserCheck, roles: ['admin', 'sekpen'] },
      { title: "Cetak Pemanggilan", href: "/dashboard/akademik/absensi/cetak", icon: Printer, roles: ['admin', 'sekpen'] },
      { title: "Cetak Blanko Absen", href: "/dashboard/akademik/absensi/cetak-blanko", icon: FileText, roles: ['admin', 'sekpen'] },
      { title: "Absen Guru", href: "/dashboard/akademik/absensi-guru", icon: Briefcase, roles: ['admin', 'sekpen'] },
      { title: "Rekap Absen Guru", href: "/dashboard/akademik/absensi-guru/rekap", icon: UserCheck, roles: ['admin', 'sekpen'] },
    ]
  },
  {
    isGroup: true,
    title: "Keuangan", 
    icon: Coins,
    items: [
      { title: "Loket Pembayaran", href: "/dashboard/keuangan/pembayaran", icon: Coins, roles: ['admin', 'bendahara'] },
      { title: "Laporan Keuangan", href: "/dashboard/keuangan/laporan", icon: FileText, roles: ['admin', 'bendahara'] },
      { title: "Pembayaran SPP", href: "/dashboard/asrama/spp", icon: CreditCard, roles: ['admin', 'pengurus_asrama'] },
      { title: "Uang Jajan", href: "/dashboard/asrama/uang-jajan", icon: Wallet, roles: ['admin', 'pengurus_asrama'] },
      { title: "Status Setoran", href: "/dashboard/asrama/status-setoran", icon: LayoutList, roles: ['admin', 'pengurus_asrama'] },
      { title: "Monitoring Setoran", href: "/dashboard/dewan-santri/setoran", icon: LayoutList, roles: ['admin', 'dewan_santri'] },
      { title: "Pengaturan Tarif", href: "/dashboard/keuangan/tarif", icon: Settings, roles: ['admin', 'bendahara'] },
    ]
  },
  {
    isGroup: true,
    title: "UPK", 
    icon: Package,
    items: [
      { title: "Kasir UPK", href: "/dashboard/akademik/upk/kasir", icon: ShoppingCart, roles: ['admin', 'sekpen'] },
      { title: "Manajemen UPK", href: "/dashboard/akademik/upk/manajemen", icon: Package, roles: ['admin', 'sekpen'] },
    ]
  },
  {
    isGroup: true,
    title: "Master Data",
    icon: Database,
    items: [
      { title: "Manajemen User", href: "/dashboard/pengaturan/users", icon: UserCog, roles: ['admin'] },
      { title: "Manajemen Guru & Jadwal", href: "/dashboard/master/wali-kelas", icon: UserCheck, roles: ['admin'] },
      { title: "Manajemen Kelas", href: "/dashboard/master/kelas", icon: Database, roles: ['admin'] },
      { title: "Manajemen Kitab", href: "/dashboard/master/kitab", icon: Book, roles: ['admin'] },
      { title: "Master Pelanggaran", href: "/dashboard/master/pelanggaran", icon: Settings, roles: ['admin'] },
      { title: "Arsip Alumni", href: "/dashboard/santri/arsip", icon: Archive, roles: ['admin'] },
    ]
  }
];

interface SidebarProps {
  userRole?: string;
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onMobileClose?: () => void;
}

export function Sidebar({ userRole = 'wali_kelas', isCollapsed, toggleSidebar, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  
  const [activeRole, setActiveRole] = useState<string>(userRole);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // STATE TEMA
  const [theme, setTheme] = useState<ThemeKey>('emerald');
  const [mounted, setMounted] = useState(false);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('app-theme') as ThemeKey;
    if (savedTheme && THEME_COLORS[savedTheme]) {
        setTheme(savedTheme);
    }
  }, []);

  const changeTheme = (newTheme: ThemeKey) => {
      setTheme(newTheme);
      localStorage.setItem('app-theme', newTheme);
  };

  useEffect(() => {
    if (userRole) setActiveRole(userRole);
  }, [userRole]);

  const checkRole = async () => {
    setIsRefreshing(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (data?.role) setActiveRole(data.role);
    }
    setIsRefreshing(false);
  };

  useEffect(() => { checkRole(); }, []);

  useEffect(() => {
    const activeGroup = menuNodes.find(n => n.isGroup && n.items?.some(i => i.href === pathname));
    if (activeGroup) {
      setOpenFolders(prev => ({ ...prev, [activeGroup.title]: true }));
    }
  }, [pathname]);

  const toggleFolder = (title: string) => {
    if (isCollapsed) {
      toggleSidebar(); 
      setOpenFolders({ [title]: true }); 
    } else {
      setOpenFolders(prev => ({ ...prev, [title]: !prev[title] }));
    }
  };

  const normalizedRole = (activeRole || 'wali_kelas').trim().toLowerCase();
  const validRoles: Role[] = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara'];
  const currentRole = validRoles.includes(normalizedRole as Role) ? (normalizedRole as Role) : 'wali_kelas';

  // AMBIL WARNA BERDASARKAN TEMA
  const c = mounted ? THEME_COLORS[theme] : THEME_COLORS['emerald'];

  return (
    <div className={cn("flex flex-col h-full w-full text-white/90 relative transition-colors duration-500", c.bg)}>
      
      {/* Tombol Toggle */}
      <button 
        onClick={toggleSidebar}
        className={cn(
          "absolute -right-3 top-24 flex items-center justify-center w-6 h-10 rounded-md border shadow-sm transition-all duration-300 z-50 hidden md:flex opacity-60 hover:opacity-100 hover:w-7 hover:-right-3.5", 
          c.toggleBtn
        )}
        title={isCollapsed ? "Perlebar Sidebar" : "Lipat Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} className="ml-0.5" /> : <ChevronLeft size={14} className="mr-0.5" />}
      </button>

      {/* HEADER LOGO */}
      <div className={cn(
        "flex items-center justify-center border-b border-white/5 shrink-0 transition-all duration-300 overflow-hidden relative w-full",
        isCollapsed ? "h-20" : "h-28 gap-3"
      )}>
        {/* Subtle background glow */}
        <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 blur-[30px] rounded-full pointer-events-none transition-colors duration-500", c.glowBg)}></div>
        
        {isCollapsed ? (
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-lg relative z-10 hover:scale-105 transition-transform" />
        ) : (
          <>
             <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-xl relative z-10" />
            <div className="flex flex-col min-w-0 justify-center relative z-10">
              <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5 transition-colors duration-300", c.glowText)}>Pondok Pesantren</span>
              <h1 className="text-xl font-black font-serif text-white tracking-wide leading-none drop-shadow-md">SUKAHIDENG</h1>
            </div>
          </>
        )}
      </div>

      {/* MENU ITEMS */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/40 transition-colors pb-10">
        {menuNodes.map((node, idx) => {
          
          if (!node.isGroup) {
            if (!node.roles?.includes(currentRole as Role)) return null;
            
            const isActive = pathname === node.href;
            return (
              <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500">
                <Link
                  href={node.href!}
                  onClick={onMobileClose}
                  className={cn(
                    "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl overflow-hidden",
                    isCollapsed ? "justify-center p-3 mb-2" : "justify-start px-4 py-3.5 mb-1",
                    isActive 
                      ? `${c.activeBg} ${c.activeText} font-bold border-l-4 ${c.activeBorder}` 
                      : `${c.mutedText} ${c.hoverBg} hover:text-white hover:translate-x-1 border-l-4 border-transparent`
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <node.icon className={cn(
                      "flex-shrink-0 transition-all duration-300",
                      isCollapsed ? "w-6 h-6" : "w-5 h-5",
                      isActive ? c.activeText : `${c.mutedText} group-hover:text-white`
                    )} />
                    {!isCollapsed && (
                      <span className={cn(
                        "text-sm tracking-wide transition-colors duration-300", 
                        isActive ? "text-white" : `${c.mutedText} group-hover:text-white`
                      )}>
                        {node.title}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )
          }

          const allowedItems = node.items!.filter(item => item.roles.includes(currentRole as any));
          if (allowedItems.length === 0) return null;

          const isOpen = openFolders[node.title];
          const hasActiveChild = allowedItems.some(i => i.href === pathname);

          return (
            <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500">
              
              <button
                onClick={() => toggleFolder(node.title)}
                className={cn(
                  "w-full flex items-center transition-all duration-300 group relative outline-none rounded-xl",
                  isCollapsed ? "justify-center p-3 mb-2" : "justify-between px-4 py-3.5 mb-1",
                  hasActiveChild && !isOpen && isCollapsed 
                    ? `${c.folderActiveBg} text-white shadow-lg border` 
                    : `${c.mutedText} ${c.hoverBg} hover:text-white hover:translate-x-1`,
                  isOpen && !isCollapsed 
                    ? `bg-black/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border-l-2 ${c.folderOpenBg}` 
                    : "border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center space-x-3">
                  <node.icon className={cn(
                    "flex-shrink-0 transition-all duration-300",
                    isCollapsed ? "w-6 h-6" : "w-5 h-5",
                    hasActiveChild ? c.glowText : `opacity-80 group-hover:text-white group-hover:opacity-100`
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      "font-semibold text-sm tracking-wide transition-colors", 
                      hasActiveChild || isOpen ? "text-white" : `${c.mutedText} group-hover:text-white`
                    )}>
                      {node.title}
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
                  )}
                >
                  <div className="pl-4 space-y-1.5 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10 before:rounded-full">
                    {allowedItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onMobileClose}
                          className={cn(
                            "flex items-center pl-7 pr-4 py-2.5 rounded-r-xl text-sm transition-all duration-300 relative group overflow-hidden",
                            isActive
                              ? `text-white ${c.activeBg} font-bold before:absolute before:left-1.5 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:rounded-full ${c.indicator}`
                              : `${c.mutedText} hover:text-white ${c.hoverBg} font-medium hover:translate-x-1 before:absolute before:left-[7px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-white/20 before:rounded-full hover:before:bg-white/60`
                          )}
                        >
                          <item.icon className={cn(
                            "w-4 h-4 mr-3 flex-shrink-0 transition-all duration-300", 
                            isActive ? `opacity-100 ${c.activeText} scale-110` : "opacity-40 group-hover:opacity-100 group-hover:scale-110"
                          )} />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </nav>

      {/* FOOTER & THEME PICKER */}
      {!isCollapsed && (
        <div className="p-4 border-t border-white/10 shrink-0 bg-black/20 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center justify-center gap-2 mb-4 relative z-10">
              <Palette className="w-4 h-4 text-white/40 mr-1"/>
              {Object.keys(THEME_COLORS).map(t => (
                  <button
                      key={t}
                      onClick={() => changeTheme(t as ThemeKey)}
                      className={cn(
                          "w-4 h-4 rounded-full border-2 transition-all duration-300",
                          theme === t ? "border-white scale-125" : "border-transparent opacity-40 hover:opacity-100 hover:scale-110"
                      )}
                      style={{
                          backgroundColor: t === 'emerald' ? '#10b981' : t === 'blue' ? '#3b82f6' : t === 'purple' ? '#a855f7' : t === 'rose' ? '#f43f5e' : '#475569'
                      }}
                  />
              ))}
          </div>

          <div className="flex items-center justify-between relative z-10 px-2">
            <div className="flex flex-col">
              <span className={cn("text-[10px] uppercase tracking-wider mb-1 font-bold", c.mutedText)}>Login Akses:</span>
              <span className="font-bold text-xs text-white capitalize bg-white/10 px-2.5 py-1 rounded-md border border-white/5 inline-block w-fit">
                {currentRole.replace('_', ' ')}
              </span>
            </div>
            
            <button 
              onClick={checkRole} 
              disabled={isRefreshing}
              className={cn("bg-white/5 hover:bg-white/10 p-2.5 rounded-full border border-white/10 transition-all duration-300 hover:shadow-lg active:scale-90", c.glowText)}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}