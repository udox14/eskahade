import { guardPage } from '@/lib/auth/guard'

import CetakPoskestrenPageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function CetakPoskestrenPage() {
  await guardPage('/dashboard/poskestren/cetak')
  return <CetakPoskestrenPageContent />
}
