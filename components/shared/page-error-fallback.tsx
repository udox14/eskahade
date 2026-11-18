'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, ServerCrash } from 'lucide-react'

// Shown when a server component fails, e.g. while the database is overloaded.
// The session cookie is untouched, so a retry normally continues where the
// user was instead of sending them back to /login.
export default function PageErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    console.error('[page-error]', error.digest ?? error.message)
  }, [error])

  const retry = () =>
    startTransition(() => {
      router.refresh()
      reset()
    })

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
        <ServerCrash className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Halaman belum dapat dimuat</h2>
        <p className="mt-2 text-sm text-gray-600">
          Server sedang sibuk atau terjadi gangguan sementara. Anda tidak keluar dari akun —
          silakan coba lagi beberapa saat lagi.
        </p>
        {error.digest && <p className="mt-3 text-xs text-gray-400">Kode: {error.digest}</p>}
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden />
          Coba lagi
        </button>
      </div>
    </div>
  )
}
