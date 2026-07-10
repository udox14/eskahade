import React from 'react'
import { requirePortalSession } from '@/lib/portal/session'
import { BottomNav } from '../_components/bottom-nav'

export const dynamic = 'force-dynamic'

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  await requirePortalSession()

  return (
    <div className="min-h-dvh pb-28">
      {children}
      <BottomNav />
    </div>
  )
}
