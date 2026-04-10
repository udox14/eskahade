'use client'

import React from 'react'
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { cn } from "@/lib/utils";
import type { FiturAkses } from "@/lib/cache/fitur-akses";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface ClientLayoutProps {
  children: React.ReactNode;
  userRole: string;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  fiturAkses: FiturAkses[];
  globalBottomNavEnabled: boolean;
  userShowBottomNav: boolean;
}

export function ClientLayout({ children, userRole, userEmail, userName, avatarUrl, fiturAkses, globalBottomNavEnabled, userShowBottomNav }: ClientLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false); 

  return (
    <div className="relative flex h-screen w-full bg-background font-sans text-foreground antialiased overflow-hidden selection:bg-primary/20 selection:text-primary">
      
      {/* 1. SIDEBAR DESKTOP (FIXED) */}
      <div 
        className={cn(
          "no-print hidden md:flex flex-col fixed inset-y-0 z-50 shadow-lg border-r border-border transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        <Sidebar 
          userRole={userRole}
          fiturAkses={fiturAkses}
          isCollapsed={isCollapsed} 
          toggleSidebar={() => setIsCollapsed(!isCollapsed)} 
        />
      </div>

      {/* 1.5. SIDEBAR MOBILE (DRAWER VIA SHADCN SHEET) */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 border-r-0 bg-transparent flex flex-col no-print">
          <Sidebar 
            userRole={userRole}
            fiturAkses={fiturAkses}
            isCollapsed={false}
            toggleSidebar={() => {}} 
            onMobileClose={() => setIsMobileOpen(false)} 
          />
        </SheetContent>
      </Sheet>

      {/* 2. AREA KONTEN (DYNAMIC PADDING) */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full relative",
          isCollapsed ? "md:pl-16" : "md:pl-60"
        )}
      >
        {/* HEADER */}
        <div className="no-print sticky top-0 z-40 w-full h-12 bg-card/80 backdrop-blur-md border-b border-border flex items-center px-2 md:px-4 transition-all shrink-0 shadow-sm">
          <Header 
            userName={userName} 
            userRole={userRole}
            avatarUrl={avatarUrl}
            onMenuClick={() => setIsMobileOpen(true)}
          />
        </div>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto w-full relative z-0 p-4 md:p-6 lg:p-8 bg-muted/20 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out h-full min-h-max pb-16 md:pb-4">
            {children}
          </div>
        </main>

        {/* BOTTOM NAV */}
        <div className="absolute bottom-0 w-full z-40">
          <BottomNav
            fiturAkses={fiturAkses}
            userRole={userRole}
            globalEnabled={globalBottomNavEnabled}
            userShowBottomNav={userShowBottomNav}
          />
        </div>
      </div>
    </div>
  );
}