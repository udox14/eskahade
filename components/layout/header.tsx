'use client'

import { useState, useEffect } from 'react'
import { signOut } from './actions'
import { LogOut, Bell, Menu, Settings, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  userName: string
  userRole: string
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
  admin: 'text-rose-600 dark:text-rose-400',
  wali_kelas: 'text-blue-600 dark:text-blue-400',
  pengurus_asrama: 'text-amber-600 dark:text-amber-400',
  keamanan: 'text-red-600 dark:text-red-400',
  dewan_santri: 'text-violet-600 dark:text-violet-400',
  bendahara: 'text-emerald-600 dark:text-emerald-400',
  sekpen: 'text-cyan-600 dark:text-cyan-400',
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

export function Header({ userName, userRole, avatarUrl, onMenuClick }: HeaderProps) {
  const { setTheme, theme } = useTheme()
  const now = useClock()

  const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const roleLabel = ROLE_LABEL[userRole] || userRole.replace('_', ' ')
  const roleColor = ROLE_COLOR[userRole] || 'text-muted-foreground'
  const firstName = userName.split(' ')[0]

  const dayStr = now?.toLocaleDateString('id-ID', { weekday: 'long' }) ?? ''
  const dateStr = now?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? ''

  const notifications = [
    { id: 1, title: 'Selamat Datang!', desc: 'Sistem manajemen pesantren siap digunakan.', time: 'Baru saja', read: false },
  ]
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="flex items-center justify-between w-full h-full px-3 md:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="hidden md:flex items-center gap-2.5">
          <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 font-normal rounded-lg">
            <span className="text-muted-foreground">{dayStr},</span>
            <span className="font-bold">{dateStr}</span>
          </Badge>
        </div>

        <span className="md:hidden text-sm font-bold tracking-tight">ESKAHADE</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Popover>
          <PopoverTrigger className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
              )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0 rounded-xl overflow-hidden shadow-lg border-border">
            <div className="px-4 py-2.5 border-b flex justify-between items-center bg-card">
              <span className="text-xs font-bold uppercase tracking-wider">Notifikasi</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-h-0 font-bold leading-tight">
                  {unreadCount} baru
                </Badge>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className={cn(
                  'px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors',
                  !n.read && 'bg-primary/5'
                )}>
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <p className="text-xs font-semibold">{n.title}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{n.time}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{n.desc}</p>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="hidden md:block w-px h-5 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-2 h-9 rounded-lg hover:bg-muted transition-colors">
              <div className="hidden md:flex flex-col items-end leading-none">
                <span className="text-xs font-bold">{firstName}</span>
                <span className={cn('text-[10px] font-semibold mt-0.5', roleColor)}>
                  {roleLabel}
                </span>
              </div>
              <Avatar className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-border">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none">{userName}</p>
                <p className={cn("text-xs font-semibold leading-none", roleColor)}>{roleLabel}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <Link href="/dashboard/profil" className="flex items-center w-full px-1.5 py-1 cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                <span>Pengaturan Profil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <form action={signOut} className="w-full">
                <button className="w-full h-full flex items-center px-1.5 py-1 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Keluar</span>
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  )
}
