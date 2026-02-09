'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect dilakukan oleh browser, bukan server
    // Ini mencegah error "Prerender Error" di Vercel
    router.replace('/')
  }, [router])

  // Tampilkan loading sebentar sebelum redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-sm text-slate-500">Mengalihkan...</p>
      </div>
    </div>
  )
}