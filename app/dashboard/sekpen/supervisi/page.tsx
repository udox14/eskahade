import { getSupervisiHome } from './actions'
import SupervisiHome from './home'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let initial
  try {
    initial = await getSupervisiHome()
  } catch {
    initial = null
  }

  if (!initial) {
    return (
      <div className="space-y-4 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <WarningCircle className="h-6 w-6" weight="duotone" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Akses Supervisi Belum Tersedia</h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Anda belum diberi akses untuk modul Supervisi, atau kegiatan supervisi belum diinisialisasi. Silakan hubungi administrator sekretariat pendidikan.
          </p>
        </div>
      </div>
    )
  }

  return <SupervisiHome initial={initial} />
}
