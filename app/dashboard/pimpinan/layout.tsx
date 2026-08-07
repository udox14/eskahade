import React from 'react'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { PimpinanNav } from './_components/pimpinan-nav'

export const dynamic = 'force-dynamic'

export default async function PimpinanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PimpinanNav />
      {children}
    </div>
  )
}
