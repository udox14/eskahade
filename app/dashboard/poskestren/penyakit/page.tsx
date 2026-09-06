import { guardPage } from '@/lib/auth/guard'

import PenyakitPageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PenyakitPage() {
  await guardPage('/dashboard/poskestren/penyakit')
  return <PenyakitPageContent />
}
