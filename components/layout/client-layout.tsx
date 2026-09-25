'use client'

import React from 'react'

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardMenuContext } from "@/components/layout/menu-context";
import { cn } from "@/lib/utils";
import type { FiturAkses } from "@/lib/cache/fitur-akses";
import type { SidebarGroupConfig } from "@/lib/menu/groups";
import { IconContext } from "@phosphor-icons/react";

interface ClientLayoutProps {
  children: React.ReactNode;
  userRole: string;
  userRoles?: string[];
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  fiturAkses: FiturAkses[];
  sidebarGroups?: SidebarGroupConfig[];
  globalBottomNavEnabled: boolean;
  userShowBottomNav: boolean;
}

export function ClientLayout({ children, userRole, userRoles, userName, avatarUrl, fiturAkses, sidebarGroups = [], globalBottomNavEnabled, userShowBottomNav }: ClientLayoutProps) {
  // State collapse dipersist ke localStorage agar pilihan user bertahan antar sesi
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('eskahade_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const isDashboardHome = pathname === '/dashboard';
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const showSetupReturn = returnTo === '/dashboard/setup-tahun-ajaran' && pathname !== '/dashboard/setup-tahun-ajaran';

  // Halaman kuitansi dirender tanpa chrome (sidebar/header/padding) agar hasil
  // cetak & tampilan hanya berisi dokumen kuitansi, konsisten di semua device.
  if (pathname?.includes('/kuitansi/')) {
    return <IconContext.Provider value={{ weight: "duotone" }}>{children}</IconContext.Provider>;
  }

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      <DashboardMenuContext.Provider value={() => setIsMobileOpen(true)}>
      <div className="relative flex h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased selection:bg-green-100 selection:text-green-900">
      
      {/* 1. SIDEBAR — desktop rail + drawer mobile + overlay dikelola di dalam komponen */}
      <Sidebar
        userRole={userRole}
        userRoles={userRoles}
        fiturAkses={fiturAkses}
        sidebarGroups={sidebarGroups}
        isCollapsed={isCollapsed}
        toggleSidebar={() => {
          setIsCollapsed(prev => {
            const next = !prev;
            try {
              localStorage.setItem('eskahade_sidebar_collapsed', String(next));
            } catch {}
            return next;
          });
        }}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* 2. AREA KONTEN (DYNAMIC PADDING) */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full [--dashboard-sidebar-offset:0px]",
          isCollapsed ? "md:pl-16 md:[--dashboard-sidebar-offset:4rem]" : "md:pl-60 md:[--dashboard-sidebar-offset:15rem]"
        )}
      >
        {/* HEADER */}
        {!isDashboardHome && <div className="no-print sticky top-0 z-40 w-full h-12 bg-white border-b border-slate-100 flex items-center px-4 md:px-8 transition-all">
          <div className="w-full">
            <Header 
                userName={userName} 
                userRole={userRole}
                userRoles={userRoles}
                avatarUrl={avatarUrl}
                onMenuClick={() => setIsMobileOpen(true)}
            />
          </div>
        </div>}

        {/* MAIN CONTENT */}
        <main className={cn("flex-1 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent", isDashboardHome ? "bg-[#f7f1e5]" : "bg-slate-50/50 p-4 md:p-8")}>
          <div className={cn("w-full", isDashboardHome ? "min-h-full pb-16 md:pb-0" : "max-w-7xl mx-auto space-y-6 pb-20 md:pb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out")}>
            {showSetupReturn ? (
              <div className="no-print sticky top-0 z-30 flex justify-end">
                <Link
                  href="/dashboard/setup-tahun-ajaran"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm backdrop-blur transition hover:bg-emerald-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Setup
                </Link>
              </div>
            ) : null}
            {children}
          </div>
        </main>

        {/* BOTTOM NAV — mobile only, di dalam flex column jadi tidak nutup konten */}
        <BottomNav
          fiturAkses={fiturAkses}
          userRole={userRole}
          userRoles={userRoles}
          globalEnabled={globalBottomNavEnabled}
          userShowBottomNav={userShowBottomNav}
          onOpenMenu={() => setIsMobileOpen(true)}
        />
      </div>
    </div>
    </DashboardMenuContext.Provider>
    </IconContext.Provider>
  );
}
