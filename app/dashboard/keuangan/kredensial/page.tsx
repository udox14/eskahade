import Link from 'next/link'
import { guardPage } from '@/lib/auth/guard'
import { isCredentialsModuleEnabled } from '@/lib/finance/credentials-switch'
import { getKredensialData } from './actions'
import KredensialContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KredensialPage() {
  // guardPage redirects when access is denied; it must not be wrapped in try/catch
  // (redirect() throws, and catching it would silently grant access).
  await guardPage('/dashboard/keuangan/kredensial')

  // Kartu santri tidak lagi dipakai untuk pencairan. Modul dinonaktifkan, data tetap tersimpan.
  if (!await isCredentialsModuleEnabled()) {
    return (
      <div className="max-w-2xl space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Kredensial &amp; Kartu dinonaktifkan</h1>
        <p className="text-sm text-slate-600">
          Kartu santri dan PIN tidak lagi digunakan untuk pencairan uang jajan. Data kartu dan riwayat PIN tetap tersimpan
          dan tidak dihapus. Pencairan kini dilakukan melalui perwakilan asrama.
        </p>
        <Link href="/dashboard/koperasi/pencairan-uang-jajan" className="inline-block text-sm font-semibold text-emerald-700 underline">
          Buka Pencairan Uang Jajan
        </Link>
      </div>
    )
  }

  const initialData = await getKredensialData({
    page: 1,
    pageSize: 50,
  })

  return <KredensialContent initialData={initialData} />
}
