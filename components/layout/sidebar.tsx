'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  ChevronLeft, ChevronRight, ChevronDown, Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog, RefreshCw, Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet, Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package, Image as ImageIcon, School
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  href?: string;       // Khusus untuk link langsung (bukan folder)
  roles?: Role[];      // Role untuk link langsung
  items?: MenuItem[];  // Anak menu untuk folder
}

// STRUKTUR NAVIGASI BARU (REVISED)
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
    title: "Kesantrian", // Gabungan Asrama, Disiplin, dan Kesiswaan
    icon: ShieldAlert,
    items: [
      { title: "Sensus Penduduk", href: "/dashboard/dewan-santri/sensus", icon: BarChart3, roles: ['admin', 'dewan_santri'] },
      { title: "Laporan Sensus", href: "/dashboard/dewan-santri/sensus/laporan", icon: Printer, roles: ['admin', 'dewan_santri'] },
      { title: "Manajemen Foto", href: "/dashboard/santri/foto", icon: ImageIcon, roles: ['admin', 'dewan_santri'] },
      { title: "Layanan Surat", href: "/dashboard/dewan-santri/surat", icon: Mail, roles: ['admin', 'dewan_santri'] },
      { title: "Absen Malam", href: "/dashboard/asrama/absen-malam", icon: Moon, roles: ['admin', 'pengurus_asrama'] },
      { title: "Absen Sakit Pagi", href: "/dashboard/asrama/absen-sakit", icon: Stethoscope, roles: ['admin', 'pengurus_asrama'] },
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
      { title: "Kenaikan Kelas", href: "/dashboard/akademik/kenaikan", icon: ArrowUpCircle, roles: ['admin', 'sekpen', 'wali_kelas'] },
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
    title: "Absensi", // Gabungan Absen Santri dan Guru
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
  
  // STATE UNTUK FOLDER ACCORDION
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userRole) {
        setActiveRole(userRole);
    }
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

  useEffect(() => {
    checkRole();
  }, []);

  // AUTO-OPEN FOLDER BERDASARKAN URL AKTIF
  useEffect(() => {
    const activeGroup = menuNodes.find(n => n.isGroup && n.items?.some(i => i.href === pathname));
    if (activeGroup) {
      setOpenFolders(prev => ({ ...prev, [activeGroup.title]: true }));
    }
  }, [pathname]);

  // TOGGLE FOLDER
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

  return (
    <div className="flex flex-col h-full w-full text-white/90 relative">
      
      {/* Tombol Toggle (Hanya Desktop) */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 bg-green-700 text-white p-1 rounded-full border border-green-600 shadow-md hover:bg-green-600 transition-colors z-50 hidden md:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* HEADER LOGO */}
      <div className={cn(
        "flex items-center border-b border-white/10 shrink-0 bg-black/10 backdrop-blur-sm transition-all duration-300 overflow-hidden",
        isCollapsed ? "h-16 justify-center" : "h-24 px-4 gap-4"
      )}>
        {isCollapsed ? (
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-md" title="Pondok Pesantren Sukahideng" />
        ) : (
          <>
             <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-lg" />
            <div className="flex flex-col min-w-0 justify-center h-full py-2">
              <span className="text-[10px] font-bold text-green-200/90 uppercase tracking-widest leading-tight">Pondok Pesantren</span>
              <h1 className="text-base font-bold font-serif text-white tracking-wide leading-none drop-shadow-md truncate mt-0.5">SUKAHIDENG</h1>
            </div>
          </>
        )}
      </div>

      {/* MENU ITEMS (LINKS & FOLDERS) */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/40 transition-colors pb-10">
        {menuNodes.map((node, idx) => {
          
          // --- RENDER UNTUK DIRECT LINK (Dashboard / Data Santri) ---
          if (!node.isGroup) {
            // Cek role
            if (!node.roles?.includes(currentRole as Role)) return null;
            
            const isActive = pathname === node.href;
            return (
              <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500">
                <Link
                  href={node.href!}
                  onClick={onMobileClose}
                  className={cn(
                    "w-full flex items-center transition-all duration-200 group relative outline-none",
                    isCollapsed ? "justify-center p-3 rounded-xl mb-2" : "justify-start px-4 py-3 rounded-lg mb-1",
                    isActive ? "bg-white/10 text-white shadow-md ring-1 ring-white/20" : "text-green-100/80 hover:bg-white/5 hover:text-white"
                  )}
                  title={isCollapsed ? node.title : undefined}
                >
                  <div className="flex items-center space-x-3">
                    <node.icon className={cn(
                      "flex-shrink-0 transition-colors",
                      isCollapsed ? "w-6 h-6" : "w-5 h-5",
                      isActive ? "text-green-300" : "text-green-400/70 group-hover:text-green-300"
                    )} />
                    {!isCollapsed && (
                      <span className={cn("font-bold text-sm tracking-wide", isActive && "text-white")}>
                        {node.title}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )
          }

          // --- RENDER UNTUK FOLDER ACCORDION ---
          const allowedItems = node.items!.filter(item => item.roles.includes(currentRole as any));
          if (allowedItems.length === 0) return null;

          const isOpen = openFolders[node.title];
          const hasActiveChild = allowedItems.some(i => i.href === pathname);

          return (
            <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500">
              
              {/* FOLDER HEADER (Tombol) */}
              <button
                onClick={() => toggleFolder(node.title)}
                className={cn(
                  "w-full flex items-center transition-all duration-200 group relative outline-none",
                  isCollapsed ? "justify-center p-3 rounded-xl mb-2" : "justify-between px-4 py-3 rounded-lg mb-1",
                  
                  // Pewarnaan state Aktif / Hover
                  hasActiveChild && !isOpen && isCollapsed ? "bg-white/10 text-white shadow-md ring-1 ring-white/20" : "text-green-100/80 hover:bg-white/5 hover:text-white",
                  isOpen && !isCollapsed ? "bg-black/20 text-white shadow-inner" : ""
                )}
                title={isCollapsed ? node.title : undefined}
              >
                <div className="flex items-center space-x-3">
                  <node.icon className={cn(
                    "flex-shrink-0 transition-colors",
                    isCollapsed ? "w-6 h-6" : "w-5 h-5",
                    hasActiveChild ? "text-green-300" : "text-green-400/70 group-hover:text-green-300"
                  )} />
                  {!isCollapsed && (
                    <span className={cn("font-bold text-sm tracking-wide", hasActiveChild && "text-white")}>
                      {node.title}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className={cn("transition-transform duration-200", hasActiveChild ? "text-green-300" : "text-green-400/50 group-hover:text-green-300")}>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                )}
              </button>

              {/* FOLDER ITEMS (Anak Menu) */}
              {!isCollapsed && (
                <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[1000px] opacity-100 mb-4 mt-1" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="pl-4 space-y-1 relative before:absolute before:left-6 before:top-0 before:bottom-0 before:w-[1px] before:bg-white/10">
                    {allowedItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onMobileClose}
                          className={cn(
                            "flex items-center pl-6 pr-4 py-2.5 rounded-r-lg text-sm font-medium transition-all relative group",
                            isActive
                              ? "text-green-300 bg-white/5 shadow-sm before:absolute before:left-2 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:bg-green-400 before:rounded-full"
                              : "text-green-100/60 hover:text-white hover:bg-white/5 before:absolute before:left-[10px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-white/20 before:rounded-full hover:before:bg-white/60"
                          )}
                        >
                          <item.icon className={cn("w-4 h-4 mr-3 flex-shrink-0 transition-opacity", isActive ? "opacity-100" : "opacity-50 group-hover:opacity-100")} />
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

      {/* FOOTER */}
      {!isCollapsed && (
        <div className="p-4 border-t border-white/10 text-[10px] text-green-200/40 text-center shrink-0 bg-black/10 whitespace-nowrap overflow-hidden">
          <p>&copy; 2024 Sistem Pesantren</p>
          <div className="mt-2 flex items-center justify-center gap-2 bg-black/20 rounded py-1 px-2">
            <div className="flex flex-col items-center">
                <span className="font-mono font-bold text-green-400 uppercase">AKSES: {currentRole.replace('_', ' ')}</span>
            </div>
            <button 
              onClick={checkRole} 
              disabled={isRefreshing}
              className="text-white hover:text-green-300 transition-colors p-1"
              title="Refresh Hak Akses"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}