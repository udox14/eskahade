import { guardPage } from '@/lib/auth/guard'
import { HREF } from '@/lib/pengajian-violations/types'
import PageContent from './_page-content'

export const dynamic = 'force-dynamic'
export default async function Page() {
 await guardPage(HREF)
 return <PageContent />
}
