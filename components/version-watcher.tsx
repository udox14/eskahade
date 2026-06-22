'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL = 5 * 60 * 1000 // cek setiap 5 menit

export function VersionWatcher() {
  const currentVersion = useRef<string | null>(null)
  const toastShown = useRef(false)

  useEffect(() => {
    // Ambil versi saat ini saat pertama load
    fetch('/api/version', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { currentVersion.current = data.version })
      .catch(() => {}) // Gagal fetch saat awal → tidak masalah

    // Polling versi setiap interval
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const data = await res.json()

        if (
          currentVersion.current !== null &&
          data.version !== currentVersion.current &&
          !toastShown.current
        ) {
          toastShown.current = true
          toast.info('Ada pembaruan sistem! 🚀', {
            description: 'Versi baru tersedia. Klik tombol di bawah untuk memperbarui.',
            duration: Infinity, // tetap tampil sampai user klik
            action: {
              label: 'Perbarui Sekarang',
              onClick: () => window.location.reload(),
            },
            onDismiss: () => {
              // Kalau user dismiss, izinkan muncul lagi di poll berikutnya
              toastShown.current = false
            },
          })
        }
      } catch {
        // Tidak ada internet / server down → abaikan saja
      }
    }, POLL_INTERVAL)

    // Handle ChunkLoadError: kalau browser gagal load chunk JS (hash lama),
    // reload otomatis sekali agar user tidak perlu lakukan manual
    const handleChunkError = (event: ErrorEvent) => {
      const isChunkError =
        event.message?.includes('ChunkLoadError') ||
        event.message?.includes('Loading chunk') ||
        event.message?.includes('Failed to fetch dynamically imported module') ||
        event.error?.name === 'ChunkLoadError'

      if (isChunkError) {
        // Tandai agar tidak loop reload
        const alreadyReloaded = sessionStorage.getItem('chunk_reload')
        if (!alreadyReloaded) {
          sessionStorage.setItem('chunk_reload', '1')
          window.location.reload()
        } else {
          // Sudah pernah reload, tapi masih error → tampilkan pesan
          sessionStorage.removeItem('chunk_reload')
          toast.error('Gagal memuat halaman', {
            description: 'Silakan refresh manual atau tekan Ctrl+Shift+R.',
            duration: Infinity,
            action: {
              label: 'Refresh',
              onClick: () => window.location.reload(),
            },
          })
        }
      }
    }

    window.addEventListener('error', handleChunkError)

    return () => {
      clearInterval(timer)
      window.removeEventListener('error', handleChunkError)
    }
  }, [])

  return null // tidak render apapun
}
