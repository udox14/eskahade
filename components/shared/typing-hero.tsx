'use client'

import { useState, useEffect } from 'react'

interface TypingHeroProps {
  phrases?: string[]
  speed?: number
  deleteSpeed?: number
  delay?: number
}

const defaultPhrases = [
  'Pusat tata kelola administrasi, akademik, & asrama santri.',
  'Transparansi presensi, hafalan, & perizinan bagi wali santri.',
  'Rekapitulasi shalat berjamaah & aktivitas pengajian santri.',
  'Integrasi keuangan, SPP, dan kasir layanan UPK pesantren.',
]

export default function TypingHero({
  phrases = defaultPhrases,
  speed = 70,
  deleteSpeed = 35,
  delay = 2200,
}: TypingHeroProps) {
  const [text, setText] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    const currentPhrase = phrases[phraseIndex]

    if (isDeleting) {
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, text.length - 1))
      }, deleteSpeed)
    } else {
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, text.length + 1))
      }, speed)
    }

    if (!isDeleting && text === currentPhrase) {
      timer = setTimeout(() => setIsDeleting(true), delay)
    }

    if (isDeleting && text === '') {
      setIsDeleting(false)
      setPhraseIndex((prev) => (prev + 1) % phrases.length)
    }

    return () => clearTimeout(timer)
  }, [text, isDeleting, phraseIndex, phrases, speed, deleteSpeed, delay])

  return (
    <span className="inline-flex items-center min-h-[1.5em]">
      <span className="text-[#247451] font-semibold">{text}</span>
      <span
        className="ml-1 inline-block w-[2px] h-[1.1em] bg-[#247451] animate-[blink_1s_infinite]"
        aria-hidden="true"
      />
      <style jsx global>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  )
}
