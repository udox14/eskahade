'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, CircleNotch, CloudArrowUp } from '@phosphor-icons/react'
import { uploadBukti } from './actions'

// Kompresi client-side: resize maks 1280px, encode WebP, turunkan kualitas
// bertahap sampai ≤ ~350KB (server menolak > 2MB).
async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 1280
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/webp', quality)
      )
      if (blob && blob.size <= 350 * 1024) {
        return new File([blob], 'bukti.webp', { type: 'image/webp' })
      }
      if (quality === 0.35 && blob) {
        return new File([blob], 'bukti.webp', { type: 'image/webp' })
      }
    }
    return file
  } catch {
    return file
  }
}

export function UploadBukti({
  submissionId,
  buttonLabel = 'Kirim Bukti Pembayaran',
  onDone,
}: {
  submissionId: string
  buttonLabel?: string
  onDone?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      toast.error('Pilih file gambar (foto/screenshot).')
      return
    }
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  async function handleSubmit() {
    if (!file || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.set('submissionId', submissionId)
      formData.set('bukti', compressed)
      const res = await uploadBukti(formData)
      if ('error' in res) {
        toast.error(res.error)
        setSending(false)
        return
      }
      toast.success('Bukti terkirim. Menunggu pemeriksaan petugas.')
      onDone?.()
    } catch {
      toast.error('Gagal mengunggah bukti. Coba lagi.')
      setSending(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-[var(--p-line)] bg-[var(--p-cream)] p-4 text-center active:scale-[0.99] transition"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Pratinjau bukti" className="mx-auto max-h-56 rounded-xl object-contain" />
        ) : (
          <div className="py-5">
            <Camera className="mx-auto w-7 h-7 text-[var(--p-muted)]" />
            <p className="mt-2 text-sm font-bold text-[var(--p-ink)]">Pilih foto bukti</p>
            <p className="mt-0.5 text-[11px] text-[var(--p-muted)]">
              Screenshot m-banking atau foto struk transfer/QRIS
            </p>
          </div>
        )}
      </button>
      {preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 w-full text-center text-[11px] font-bold text-[var(--p-emerald)]"
        >
          Ganti foto
        </button>
      )}

      <button
        type="button"
        disabled={!file || sending}
        onClick={handleSubmit}
        className="mt-4 w-full rounded-2xl bg-[var(--p-emerald)] py-3.5 text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <CloudArrowUp className="w-4 h-4" />}
        {sending ? 'Mengunggah…' : buttonLabel}
      </button>
    </div>
  )
}
