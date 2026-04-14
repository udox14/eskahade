'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from './actions'
import { LogOut, Bell, User, Menu, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface HeaderProps {
  userName: string
  userRole: string
  userRoles?: string[]
  avatarUrl?: string | null
  onMenuClick?: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  wali_kelas: 'Wali Kelas',
  pengurus_asrama: 'Pengurus Asrama',
  akademik: 'Akademik',
  keamanan: 'Keamanan',
  dewan_santri: 'Dewan Santri',
  bendahara: 'Bendahara',
  sekpen: 'Sekretaris Pendidikan',
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'text-rose-600',
  wali_kelas: 'text-blue-600',
  pengurus_asrama: 'text-amber-600',
  keamanan: 'text-red-600',
  dewan_santri: 'text-violet-600',
  bendahara: 'text-emerald-600',
  sekpen: 'text-cyan-600',
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function Header({ userName, userRole, userRoles, avatarUrl, onMenuClick }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const now = useClock()

  const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const effectiveRoles = (userRoles && userRoles.length > 0) ? userRoles : [userRole]
  const roleLabel = effectiveRoles.map(r => ROLE_LABEL[r] || r.replace('_', ' ')).join(' • ')
  const roleColor = ROLE_COLOR[effectiveRoles[0]] || 'text-slate-600'
  const firstName = userName.split(' ')[0]

  const dayStr = now?.toLocaleDateString('id-ID', { weekday: 'long' }) ?? ''
  const dateStr = now?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? ''

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
    <header className="flex items-center justify-between w-full h-full px-3 md:px-5">

      {/* ── KIRI ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tanggal — desktop */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Pill tanggal */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-400">{dayStr},</span>
            <span className="text-xs font-bold text-slate-700">{dateStr}</span>
          </div>
        </div>

        {/* Nama app — mobile only */}
        <span className="md:hidden text-sm font-bold text-slate-800 tracking-tight">ESKAHADE</span>
      </div>

      {/* ── KANAN ── */}
      <div className="flex items-center gap-1.5">

        {/* Notifikasi */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setIsNotifOpen(v => !v); setIsProfileOpen(false) }}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              isNotifOpen
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden z-50">
              <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-bold">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={cn(
                    'px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors',
                    !n.read && 'bg-blue-50/40'
                  )}>
                    <div className="flex justify-between items-start gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-slate-200 mx-1" />

        {/* Profil */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setIsProfileOpen(v => !v); setIsNotifOpen(false) }}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-lg transition-colors',
              isProfileOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
            )}
          >
            {/* Info nama — desktop */}
            <div className="hidden md:flex flex-col items-end leading-none">
              <span className="text-xs font-bold text-slate-800">{firstName}</span>
              <span className={cn('text-[10px] font-semibold mt-0.5', roleColor)}>
                {roleLabel}
              </span>
            </div>

            {/* Avatar */}
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">{initials}</span>
                </div>
              )}
            </div>

            <ChevronDown className={cn(
              'hidden md:block w-3 h-3 text-slate-400 transition-transform duration-200',
              isProfileOpen && 'rotate-180'
            )} />
          </button>

          {/* Dropdown profil */}
          {isProfileOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-slate-100">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                        <span className="text-white font-bold text-[10px]">{initials}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{userName}</p>
                    <p className={cn('text-[11px] font-semibold', roleColor)}>{roleLabel}</p>
                  </div>
                </div>
              </div>

              {/* Menu */}
              <div className="py-1">
                <Link
                  href="/dashboard/profil"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  Pengaturan Profil
                </Link>
              </div>

              <div className="border-t border-slate-100 py-1">
                <form action={signOut}>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors">
                    <LogOut className="w-3.5 h-3.5" />
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
