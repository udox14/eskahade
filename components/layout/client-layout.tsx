'use client'

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

interface ClientLayoutProps {
  children: React.ReactNode;
  userRole: string;
  userEmail: string;
  userName: string;
}

export function ClientLayout({ children, userRole, userEmail, userName }: ClientLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false); // State Mobile

  return (
    <div className="relative flex h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased overflow-hidden selection:bg-green-100 selection:text-green-900">
      
      {/* 1. SIDEBAR DESKTOP (FIXED) */}
      <div 
        className={cn(
          "hidden md:flex flex-col fixed inset-y-0 z-50 shadow-2xl transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="h-full w-full bg-gradient-to-b from-green-900 via-green-800 to-green-950 text-white">
           <Sidebar 
             userRole={userRole} 
             isCollapsed={isCollapsed} 
             toggleSidebar={() => setIsCollapsed(!isCollapsed)} 
           />
        </div>
      </div>

      {/* 1.5. SIDEBAR MOBILE (DRAWER) */}
      {/* Overlay Gelap */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Drawer Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-green-900 via-green-800 to-green-950 text-white shadow-2xl transform transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
         <Sidebar 
            userRole={userRole} 
            isCollapsed={false} // Di mobile selalu lebar
            toggleSidebar={() => {}} // Tombol collapse tidak aktif di mobile
            onMobileClose={() => setIsMobileOpen(false)} // Tutup saat link diklik
         />
      </div>

      {/* 2. AREA KONTEN (DYNAMIC PADDING) */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full",
          isCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        
        {/* HEADER */}
        <div className="sticky top-0 z-40 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm flex items-center px-4 md:px-6 transition-all">
          <div className="w-full">
            <Header 
                userName={userName} 
                userRole={userRole} 
                onMenuClick={() => setIsMobileOpen(true)} // Buka menu mobile
            />
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent bg-slate-50/50">
          <div className="max-w-7xl mx-auto w-full space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}