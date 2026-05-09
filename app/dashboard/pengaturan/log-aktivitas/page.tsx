import { redirect } from 'next/navigation'

import { getSession, isAdmin } from '@/lib/auth/session'
import { guardPage } from '@/lib/auth/guard'

import { getActivityLogPage } from './actions'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function ActivityLogPage({ searchParams }: PageProps) {
  await guardPage('/dashboard/pengaturan/log-aktivitas')

  const session = await getSession()
  if (!session || !isAdmin(session)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const data = await getActivityLogPage({
    page: Number(readParam(params?.page) || 1),
    pageSize: Number(readParam(params?.pageSize) || 20),
    module: readParam(params?.module),
    action: readParam(params?.action),
    actor: readParam(params?.actor),
    q: readParam(params?.q),
    startDate: readParam(params?.startDate),
    endDate: readParam(params?.endDate),
  })

  return <PageContent {...data} />
}
