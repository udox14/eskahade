'use client'

import Link from 'next/link'
import { Bell } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { UnreadBadge, useUnreadCount } from './shared'

/** Tombol bell sederhana (tanpa dropdown) untuk layar mobile/hero: menuju halaman notifikasi. */
export function NotificationBadgeLink({
  audience,
  href,
  className,
}: {
  audience: 'staff' | 'portal'
  href: string
  className?: string
}) {
  const { count } = useUnreadCount(audience)
  return (
    <Link
      href={href}
      title="Notifikasi"
      aria-label={count > 0 ? `Notifikasi, ${count} belum dibaca` : 'Notifikasi'}
      className={cn('relative flex items-center justify-center transition active:scale-95 motion-reduce:transition-none', className)}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      <UnreadBadge count={count} />
    </Link>
  )
}
