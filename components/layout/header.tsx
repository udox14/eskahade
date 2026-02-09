'use client'

import { useState, useRef, useEffect } from "react";
import { signOut } from "./actions";
import { LogOut, Bell, Calendar, User, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userName: string;
  userRole: string;
  onMenuClick?: () => void; // Prop baru untuk tombol menu
}

export function Header({ userName, userRole, onMenuClick }: HeaderProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const notifications = [
    { id: 1, title: "Selamat Datang!", desc: "Sistem manajemen pesantren siap digunakan.", time: "Baru saja", read: false },
    { id: 2, title: "Update Sistem", desc: "Fitur Absen Malam telah ditambahkan.", time: "1 jam lalu", read: true },
  ];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="flex items-center justify-between w-full h-full relative px-2 md:px-0">
      
      {/* BAGIAN KIRI: Info Sistem */}
      <div className="flex items-center gap-3 min-w-0">
        
        {/* TOMBOL MENU MOBILE (Hanya muncul di HP) */}
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex flex-col justify-center min-w-0">
          {/* Tampilan Mobile: Judul Singkat */}
          <h2 className="text-lg font-bold text-slate-800 leading-tight tracking-tight md:hidden truncate">
            SIM Santri
          </h2>
          {/* Tampilan Desktop: Judul Lengkap */}
          <h2 className="hidden md:block text-lg font-bold text-slate-800 leading-tight tracking-tight">
            Sistem Akademik & Kesantrian
          </h2>
          
          {/* Tanggal: Sembunyikan di Mobile */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Calendar className="w-3 h-3 text-green-600" />
            <span>{today}</span>
          </div>
        </div>
      </div>

      {/* BAGIAN KANAN: Profil & Aksi */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        
        {/* Tombol Notifikasi */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={cn(
              "p-2 rounded-full transition-colors relative group outline-none",
              isNotifOpen ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>

          {isNotifOpen && (
             <div className="absolute right-0 top-12 w-72 md:w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
               <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-bold text-sm text-slate-700">Notifikasi</h3>
                 {unreadCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} Baru</span>}
               </div>
               <div className="max-h-64 overflow-y-auto">
                 {notifications.length === 0 ? (
                   <div className="p-8 text-center text-gray-400 text-xs">Tidak ada notifikasi.</div>
                 ) : (
                   notifications.map(notif => (
                     <div key={notif.id} className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!notif.read ? 'font-bold' : 'font-medium'} text-slate-800`}>{notif.title}</p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{notif.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{notif.desc}</p>
                     </div>
                   ))
                 )}
               </div>
             </div>
          )}
        </div>

        {/* Pemisah (Desktop Only) */}
        <div className="hidden md:block h-8 w-[1px] bg-slate-200 mx-1"></div>

        {/* Profil User */}
        <div className="flex items-center gap-3 pl-1">
          {/* Teks Nama & Role (Hanya di Desktop) */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-slate-700 leading-none max-w-[150px] truncate">
              {userName}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-1 border border-green-100">
              {userRole.replace('_', ' ')}
            </span>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md border-2 border-white ring-1 ring-slate-100 flex-shrink-0">
            {initials || <User className="w-4 h-4 md:w-5 md:h-5"/>}
          </div>
        </div>

        {/* Tombol Keluar */}
        <form action={signOut}>
          <button 
            className="ml-1 md:ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
            title="Keluar Aplikasi"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>
    </header>
  );
}