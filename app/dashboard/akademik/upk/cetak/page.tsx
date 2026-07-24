import { guardPage } from '@/lib/auth/guard'
import CetakUpkPageContent from './_page-content'

export default async function CetakUpkPage() {
  await guardPage('/dashboard/akademik/upk/cetak')
  return <CetakUpkPageContent />
}
