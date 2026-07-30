import type { ReactNode } from 'react'

import { getEffectiveRoles, getSession } from '@/lib/auth/session'
import { PoskestrenModuleNav } from '@/components/poskestren/poskestren-shell'

export default async function PoskestrenLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const roles = getEffectiveRoles(session)
  const canFinance = roles.includes('admin') || roles.includes('demo') || roles.includes('poskestren:bendahara')

  return (
    <div className="space-y-5">
      <PoskestrenModuleNav canFinance={canFinance} />
      {children}
    </div>
  )
}

