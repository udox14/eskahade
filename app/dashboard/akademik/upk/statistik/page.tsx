import { guardPage } from '@/lib/auth/guard'
import StatistikUPKPage from './_page-content'

export default async function Page() {
  await guardPage('/dashboard/akademik/upk/statistik')
  return <StatistikUPKPage />
}
