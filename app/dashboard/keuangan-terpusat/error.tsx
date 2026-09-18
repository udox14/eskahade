'use client'

import Link from 'next/link'
import { WarningCircle } from '@phosphor-icons/react'

export default function CentralFinanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-950">
      <WarningCircle className="h-7 w-7" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-bold">Sistem Keuangan Baru tidak dapat dimuat</h1>
      <p className="mt-1 text-sm text-red-900">
        Coba muat ulang bagian ini. Jika masalah berulang, kembali ke ringkasan dan periksa koneksi atau hak akses.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md bg-red-800 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
        >
          Coba lagi
        </button>
        <Link
          href="/dashboard/keuangan-terpusat"
          className="inline-flex min-h-11 items-center rounded-md border border-red-300 bg-white px-4 text-sm font-bold text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
        >
          Kembali ke ringkasan
        </Link>
      </div>
    </section>
  )
}
