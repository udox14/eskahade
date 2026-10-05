import { getInterview, getInterviewHistory } from '../actions'
import { resolveDocumentLetterhead } from '@/lib/print/letterhead-server'
import InterviewForm from '../interview-form'
import Link from 'next/link'
import { WarningCircle, ArrowLeft } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params
  let data
  try {
    const interview = await getInterview(id)
    const [history, letterhead] = await Promise.all([
      getInterviewHistory(id),
      resolveDocumentLetterhead('supervisi'),
    ])
    data = { interview, history, letterhead }
  } catch {
    data = null
  }

  if (!data) {
    return (
      <div className="space-y-4 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto mt-12 shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <WarningCircle className="h-6 w-6" weight="duotone" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Wawancara Tidak Dapat Dibuka</h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Data wawancara tidak ditemukan, belum memiliki akses, atau sesi telah berakhir.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/sekpen/supervisi"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Rekap Supervisi</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <InterviewForm
      initial={data.interview}
      history={data.history}
      letterhead={data.letterhead}
    />
  )
}
