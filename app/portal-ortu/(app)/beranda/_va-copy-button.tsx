'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'

export function VaCopyButton({ vaNumber }: { vaNumber: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(vaNumber)
    setCopied(true)
    toast.success('Nomor Virtual Account disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
        copied
          ? 'bg-emerald-700 text-white'
          : 'bg-amber-600 hover:bg-amber-700 text-white'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Nomor VA Tersalin!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Salin Nomor VA</span>
        </>
      )}
    </button>
  )
}
