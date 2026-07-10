import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { LoginForm } from './_login-form'

export const dynamic = 'force-dynamic'

export default async function PortalLoginPage() {
  const session = await getPortalSession()
  if (session) redirect('/portal-ortu/beranda')

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Panel atas emerald dengan pola titik */}
      <div className="portal-pattern relative overflow-hidden bg-[var(--p-emerald-deep)] px-7 pt-16 pb-24 rounded-b-[2.5rem]">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[var(--p-emerald)] opacity-60 blur-2xl" />
        <div className="relative portal-rise">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-emerald-200/80">
            Pondok Pesantren Sukahideng
          </p>
          <h1 className="portal-display mt-3 text-4xl leading-tight text-white">
            Portal<br />Orang&nbsp;Tua
          </h1>
          <p className="mt-3 text-sm text-emerald-100/80 max-w-[16rem]">
            Pantau pengajian, keamanan, dan pembayaran putra Anda dari rumah.
          </p>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-12 pb-10">
        <LoginForm />
      </div>
    </div>
  )
}
