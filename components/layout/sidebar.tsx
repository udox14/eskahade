'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, BookOpen, ShieldAlert, FileText, Settings,
  Database, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  ChevronLeft, ChevronRight, Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog, RefreshCw, Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Definisi Role Sesuai Instruksi
type Role = 'admin' | 'keamanan' | 'sekpen' | 'dewan_santri' | 'pengurus_asrama' | 'wali_kelas';

const menuGroups = [
  {
    label: "Utama",
    items: [
      { 
        title: "Dashboard", 
        href: "/dashboard", 
        icon: LayoutDashboard, 
        roles: ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas'] 
      },
      { 
        title: "Data Santri", 
        href: "/dashboard/santri", 
        icon: Users, 
        roles: ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas'] 
      },
    ]
  },
  {
    label: "Akademik (Sekpen)",
    items: [
      { 
        title: "Tes Klasifikasi", 
        href: "/dashboard/santri/tes-klasifikasi", 
        icon: ClipboardCheck, 
        roles: ['admin', 'sekpen'] 
      },
      { 
        title: "Penempatan Kelas", 
        href: "/dashboard/santri/atur-kelas", 
        icon: UserPlus, 
        roles: ['admin', 'sekpen'] 
      },
      { 
        title: "Absen Pengajian", 
        href: "/dashboard/akademik/absensi", 
        icon: CalendarCheck, 
        roles: ['admin', 'sekpen'] 
      },
      // MENU BARU: REKAP ABSENSI
      // Bisa diakses oleh banyak role untuk monitoring
      { 
        title: "Rekap Absensi", 
        href: "/dashboard/akademik/absensi/rekap", 
        icon: Filter, 
        roles: ['admin', 'sekpen', 'wali_kelas', 'keamanan', 'dewan_santri', 'pengurus_asrama'] 
      },
      { 
        title: "Verifikasi Absen", 
        href: "/dashboard/akademik/absensi/verifikasi", 
        icon: UserCheck, 
        roles: ['admin', 'sekpen'] 
      },
      { 
        title: "Cetak Pemanggilan", 
        href: "/dashboard/akademik/absensi/cetak", 
        icon: Printer, 
        roles: ['admin', 'sekpen'] 
      },
      { 
        title: "Input Nilai", 
        href: "/dashboard/akademik/nilai/input", 
        icon: BookOpen, 
        roles: ['admin', 'sekpen', 'wali_kelas'] 
      },
      { 
        title: "Ranking & Prestasi", 
        href: "/dashboard/akademik/ranking", 
        icon: TrendingUp, 
        roles: ['admin', 'sekpen', 'wali_kelas'] 
      },
      { 
        title: "Kenaikan Kelas", 
        href: "/dashboard/akademik/kenaikan", 
        icon: ArrowUpCircle, 
        roles: ['admin', 'sekpen', 'wali_kelas'] 
      },
      { 
        title: "Leger Nilai", 
        href: "/dashboard/akademik/leger", 
        icon: FileSpreadsheet, 
        roles: ['admin', 'sekpen', 'wali_kelas'] 
      },
      { 
        title: "Cetak Rapor", 
        href: "/dashboard/laporan/rapor", 
        icon: FileText, 
        roles: ['admin', 'sekpen', 'wali_kelas'] 
      },
    ]
  },
  {
    label: "Asrama & Kesantrian",
    items: [
      { title: "Absen Malam", href: "/dashboard/asrama/absen-malam", icon: Moon, roles: ['admin', 'pengurus_asrama', 'keamanan'] },
      { title: "Absen Sakit Pagi", href: "/dashboard/asrama/absen-sakit", icon: Stethoscope, roles: ['admin', 'pengurus_asrama'] },
      { title: "Pembayaran SPP", href: "/dashboard/asrama/spp", icon: CreditCard, roles: ['admin', 'pengurus_asrama'] },
      { title: "Status Setoran", href: "/dashboard/asrama/status-setoran", icon: LayoutList, roles: ['admin', 'pengurus_asrama'] },
      
      { title: "Perizinan Santri", href: "/dashboard/keamanan/perizinan", icon: MapPin, roles: ['admin', 'dewan_santri'] },
      { title: "Monitoring Setoran", href: "/dashboard/dewan-santri/setoran", icon: LayoutList, roles: ['admin', 'dewan_santri'] },
      
      { title: "Cetak Telat Datang", href: "/dashboard/keamanan/perizinan/cetak-telat", icon: Clock, roles: ['admin', 'dewan_santri', 'keamanan'] },
      { title: "Verifikasi Telat", href: "/dashboard/keamanan/perizinan/verifikasi-telat", icon: Gavel, roles: ['admin', 'keamanan'] },
      { title: "Pelanggaran & SP", href: "/dashboard/keamanan", icon: ShieldAlert, roles: ['admin', 'keamanan'] },
    ]
  },
  {
    label: "Master Data & Admin",
    items: [
      { title: "Manajemen User", href: "/dashboard/pengaturan/users", icon: UserCog, roles: ['admin'] },
      { title: "Manajemen Wali Kelas", href: "/dashboard/master/wali-kelas", icon: UserCheck, roles: ['admin', 'sekpen'] },
      { title: "Manajemen Kelas", href: "/dashboard/master/kelas", icon: Database, roles: ['admin', 'sekpen'] },
      { title: "Manajemen Kitab", href: "/dashboard/master/kitab", icon: Book, roles: ['admin', 'sekpen'] },
      { title: "Master Pelanggaran", href: "/dashboard/master/pelanggaran", icon: Settings, roles: ['admin', 'keamanan'] },
    ]
  }
];

interface SidebarProps {
  userRole?: string;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export function Sidebar({ userRole = 'wali_kelas', isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  
  const [activeRole, setActiveRole] = useState<string>(userRole);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  useEffect(() => {
    if (userRole) {
        setActiveRole(userRole);
    }
  }, [userRole]);

  const checkRole = async () => {
    setIsRefreshing(true);
    setDebugMsg("Checking...");
    const supabase = createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        console.error("Auth Error:", authError);
        setDebugMsg("Auth Fail");
        setIsRefreshing(false);
        return;
    }

    const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
    
    if (error) {
        console.error("Supabase Error:", JSON.stringify(error, null, 2));
        setDebugMsg(`DB Err: ${error.code}`);
    } else if (data) {
        setDebugMsg(`DB Role: ${data.role}`);
        if (data.role) setActiveRole(data.role);
    } else {
        setDebugMsg("No Profile");
    }
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    checkRole();
  }, []);

  const normalizedRole = (activeRole || 'wali_kelas').trim().toLowerCase();
  
  const validRoles: Role[] = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas'];
  const currentRole = validRoles.includes(normalizedRole as Role) ? (normalizedRole as Role) : 'wali_kelas';

  return (
    <div className="flex flex-col h-full w-full text-white/90 relative">
      
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 bg-green-700 text-white p-1 rounded-full border border-green-600 shadow-md hover:bg-green-600 transition-colors z-50 hidden md:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={cn(
        "flex items-center border-b border-white/10 shrink-0 bg-black/10 backdrop-blur-sm transition-all duration-300 overflow-hidden",
        isCollapsed ? "h-16 justify-center" : "h-24 px-4 gap-4"
      )}>
        {isCollapsed ? (
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-10 h-10 object-contain drop-shadow-md" 
            title="Pondok Pesantren Sukahideng" 
          />
        ) : (
          <>
             <img 
               src="/logo.png" 
               alt="Logo" 
               className="w-14 h-14 object-contain drop-shadow-lg" 
             />
            <div className="flex flex-col min-w-0 justify-center h-full py-2">
              <span className="text-[10px] font-bold text-green-200/90 uppercase tracking-widest leading-tight">
                Pondok Pesantren
              </span>
              <h1 className="text-base font-bold font-serif text-white tracking-wide leading-none drop-shadow-md truncate mt-0.5">
                SUKAHIDENG
              </h1>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-6 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40 transition-colors">
        {menuGroups.map((group, idx) => {
          const allowedItems = group.items.filter(item => item.roles.includes(currentRole));
          
          if (allowedItems.length === 0) return null;

          return (
            <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500">
              
              {!isCollapsed && (
                <h3 className="text-[10px] font-bold text-green-200/60 uppercase tracking-widest mb-2 px-4 whitespace-nowrap overflow-hidden">
                  {group.label}
                </h3>
              )}

              <div className="space-y-1">
                {allowedItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={isCollapsed ? item.title : undefined}
                      className={cn(
                        "flex items-center rounded-lg transition-all duration-200 text-sm font-medium group relative",
                        isCollapsed ? "justify-center p-2.5" : "space-x-3 px-4 py-2.5",
                        isActive 
                          ? "bg-white/10 text-white shadow-lg shadow-black/5 ring-1 ring-white/20" 
                          : "text-green-100/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className={cn(
                        "transition-colors flex-shrink-0", 
                        isCollapsed ? "w-5 h-5" : "w-4 h-4",
                        isActive ? "text-green-300" : "text-green-400/70 group-hover:text-green-300"
                      )} />
                      
                      {!isCollapsed && (
                        <span className="whitespace-nowrap overflow-hidden">{item.title}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {!isCollapsed && (
        <div className="p-4 border-t border-white/10 text-[10px] text-green-200/40 text-center shrink-0 bg-black/10 whitespace-nowrap overflow-hidden">
          <p>&copy; 2024 Sistem Pesantren</p>
          <div className="mt-2 flex items-center justify-center gap-2 bg-black/20 rounded py-1 px-2">
            <div className="flex flex-col items-center">
                <span className="font-mono font-bold text-green-400 uppercase">AKSES: {currentRole}</span>
                {debugMsg && <span className="text-[9px] text-gray-400">{debugMsg}</span>}
            </div>
            <button 
              onClick={checkRole} 
              disabled={isRefreshing}
              className="text-white hover:text-green-300 transition-colors p-1"
              title="Refresh Hak Akses dari Database"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}