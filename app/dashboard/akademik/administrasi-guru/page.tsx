import { guardPage } from '@/lib/auth/guard'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function AdministrasiGuruPage() {
  await guardPage('/dashboard/akademik/administrasi-guru')
  return <PageContent />
}
