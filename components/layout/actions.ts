'use server'

import { clearSession, getSession } from '@/lib/auth/session'
import { actorFromSession, getRequestAuditContext, logActivity } from '@/lib/activity-log'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOut() {
  // Logging out must work even while the database cannot verify the session.
  const session = await getSession().catch(() => null)
  await logActivity({
    actor: actorFromSession(session),
    module: 'auth',
    action: 'logout',
    entityType: 'session',
    entityId: session?.id ?? null,
    entityLabel: session?.full_name || session?.email || 'Unknown user',
    summary: 'Logout berhasil',
    details: {
      email: session?.email ?? null,
    },
    status: 'success',
    requestInfo: await getRequestAuditContext(),
  })
  await clearSession()
  revalidatePath('/', 'layout')
  redirect('/login')
}
