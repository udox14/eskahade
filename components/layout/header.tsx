'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from './actions'
import { LogOut, Bell, Calendar, User, Menu, ChevronDown, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface HeaderProps {
  userName: string
  userRole: string
  avatarUrl?: string | null
  onMenuClick?: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', wali_kelas: 'Wali Kelas', pengurus_asrama: 'Pengurus Asrama',
  akademik: 'Akademik', keamanan: 'Keamanan', dewan_santri: 'Dewan Santri', bendahara: 'Bendahara',
}

export function Header({ userName, userRole, avatarUrl, onMenuClick }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const notifications = [
    { id: 1, title: 'Selamat Datang!', desc: 'Sistem manajemen pesantren siap digunakan.', time: 'Baru saja', read: false },
  ]
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="flex items-center justify-between w-full h-full relative px-2 md:px-0">

      {/* KIRI */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex flex-col justify-center min-w-0">
          <h2 className="text-lg font-bold text-slate-800 leading-tight tracking-tight md:hidden truncate">ESKAHADE</h2>
          <h2 className="hidden md:block text-lg font-bold text-slate-800 leading-tight tracking-tight">Sistem Akademik & Kesantrian</h2>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Calendar className="w-3 h-3 text-green-600" />
            <span>{today}</span>
          </div>
        </div>
      </div>

      {/* KANAN */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">

        {/* Notifikasi */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => { setIsNotifOpen(v => !v); setIsProfileOpen(false) }}
            className={cn(
              'p-2 rounded-full transition-colors relative outline-none',
              isNotifOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            )}>
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </button>
          {isNotifOpen && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-700">Notifikasi</h3>
                {unreadCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} Baru</span>}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-sm ${!n.read ? 'font-bold' : 'font-medium'} text-slate-800`}>{n.title}</p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{n.time}</span>
                    </div>
                    <p className="text-xs text-slate-500">{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider desktop */}
        <div className="hidden md:block h-8 w-px bg-slate-200" />

        {/* Profil dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setIsProfileOpen(v => !v); setIsNotifOpen(false) }}
            className="flex items-center gap-2.5 pl-1 rounded-xl hover:bg-slate-100 pr-2 py-1 transition-colors group"
          >
            {/* Nama & role — desktop only */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-700 leading-none max-w-[140px] truncate">{userName}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 mt-0.5">
                {ROLE_LABEL[userRole] || userRole.replace('_', ' ')}
              </span>
            </div>

            {/* Avatar */}
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center text-white font-bold text-xs shadow border-2 border-white ring-1 ring-slate-100 flex-shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                : <span>{initials || <User className="w-4 h-4" />}</span>
              }
            </div>

            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden md:block', isProfileOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              {/* Header info */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <p className="text-sm font-bold text-slate-800 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{ROLE_LABEL[userRole] || userRole}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link href="/dashboard/profil"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Settings className="w-4 h-4 text-slate-400" />
                  Pengaturan Profil
                </Link>
              </div>

              <div className="border-t border-slate-100 py-1">
                <form action={signOut}>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
