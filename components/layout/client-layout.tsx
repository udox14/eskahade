'use client'

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header"; // Header baru akan dipakai di sini
import { cn } from "@/lib/utils";

interface ClientLayoutProps {
  children: React.ReactNode;
  userRole: string;
  userEmail: string;
  userName: string; // TAMBAHAN
}

export function ClientLayout({ children, userRole, userEmail, userName }: ClientLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="relative flex h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased overflow-hidden selection:bg-green-100 selection:text-green-900">
      
      {/* 1. SIDEBAR (FIXED POSITION) */}
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

      {/* 2. AREA KONTEN (DYNAMIC PADDING) */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full",
          isCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        
        {/* HEADER */}
        <div className="sticky top-0 z-40 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm flex items-center px-6 transition-all">
          <div className="w-full">
            {/* Pass Data Nama & Role ke Header */}
            <Header userName={userName} userRole={userRole} />
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