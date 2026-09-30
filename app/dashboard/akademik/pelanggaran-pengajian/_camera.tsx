'use client'
/* eslint-disable @next/next/no-img-element -- Object URLs are local camera previews, not remote images. */

import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, SwitchCamera, Trash2 } from 'lucide-react'
import { compressEvidencePhoto } from '@/lib/pengajian-violations/compress-photo-client'
import { button, ErrorMessage, Modal, primary } from './_components'

function BlobPreview({
  file,
  alt,
  className,
}: {
  file: File
  alt: string
  className: string
}) {
  const image = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <img ref={image} alt={alt} className={className} />
}

export function EvidenceCamera({
  onClose,
  onUse,
}: {
  onClose: () => void
  onUse: (file: File) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [file, setFile] = useState<File | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (file) return
    let active = true
    setReady(false)
    setError('')

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera memerlukan HTTPS dan peramban yang mendukungnya.')
        }
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        })
        if (!active) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream.current = media
        if (video.current) {
          video.current.srcObject = media
          await video.current.play()
        }
      } catch (reason) {
        if (!active) return
        stream.current?.getTracks().forEach((track) => track.stop())
        stream.current = null
        const name = reason instanceof Error ? reason.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Izin akses kamera belum diberikan. Izinkan kamera pada browser, lalu coba lagi.'
            : name === 'NotFoundError'
            ? 'Kamera tidak ditemukan pada perangkat ini.'
            : name === 'NotReadableError'
            ? 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.'
            : reason instanceof Error
            ? reason.message
            : 'Kamera tidak dapat dibuka. Silakan coba lagi.'
        )
      }
    }

    void start()
    return () => {
      active = false
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
    }
  }, [facing, file, attempt])

  async function capture() {
    const element = video.current
    if (!element || !ready || busy) return
    setBusy(true)
    setError('')

    try {
      const ratio = Math.min(1280 / element.videoWidth, 1280 / element.videoHeight, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(element.videoWidth * ratio))
      canvas.height = Math.max(1, Math.round(element.videoHeight * ratio))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Pemotret tidak tersedia di peramban ini.')
      context.drawImage(element, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.92)
      )
      if (!blob) throw new Error('Foto gagal diambil. Silakan ulangi.')
      setFile(
        await compressEvidencePhoto(new File([blob], 'capture.webp', { type: blob.type }))
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Foto gagal diproses. Silakan ulangi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={file ? 'Pratinjau Foto Kejadian' : 'Ambil Foto Kejadian'}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          {file ? (
            <>
              <button
                type="button"
                className={button}
                onClick={() => setFile(null)}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Ulangi Foto</span>
              </button>
              <button
                type="button"
                className={primary}
                onClick={() => onUse(file)}
              >
                <span>Gunakan Foto Ini</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={onClose}
              >
                Tanpa Foto
              </button>
              <button
                type="button"
                className={primary}
                disabled={!ready || busy || !!error}
                onClick={() => void capture()}
              >
                <Camera className="h-4 w-4" />
                <span>{busy ? 'Memproses…' : 'Ambil Foto'}</span>
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {error && <ErrorMessage message={error} />}

        <div className="relative overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center min-h-[300px]">
          {file ? (
            <BlobPreview
              file={file}
              alt="Preview foto kejadian"
              className="max-h-[50dvh] w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={video}
                muted
                autoPlay
                playsInline
                onLoadedData={() => setReady(true)}
                className={`aspect-[3/4] max-h-[50dvh] w-full object-contain ${
                  facing === 'user' ? '[transform:scaleX(-1)]' : ''
                }`}
              />
              {!ready && !error && (
                <p
                  role="status"
                  className="absolute inset-0 flex items-center justify-center px-5 text-center text-xs text-white"
                >
                  Membuka kamera…
                </p>
              )}
            </>
          )}
        </div>

        {file ? (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
            Format: <span className="font-semibold text-slate-700">WebP</span> · Ukuran:{' '}
            <span className="font-semibold text-slate-700">{Math.ceil(file.size / 1024)} KB</span>{' '}
            · Masa simpan: 30 hari sejak diunggah.
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-slate-400">
              Kamera aktif langsung di peramban. Foto otomatis dikompresi ke WebP.
            </p>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() =>
                error
                  ? setAttempt((n) => n + 1)
                  : setFacing((current) => (current === 'environment' ? 'user' : 'environment'))
              }
              aria-label={error ? 'Coba buka kamera lagi' : 'Ganti kamera'}
            >
              {error ? <RefreshCw className="h-4 w-4" /> : <SwitchCamera className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function EvidenceDraft({
  file,
  disabled,
  onCapture,
  onRemove,
}: {
  file: File | null
  disabled?: boolean
  onCapture: () => void
  onRemove: () => void
}) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4" aria-label="Foto kejadian opsional">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Foto Bukti Kejadian (Opsional)
          </h4>
          <p className="mt-0.5 text-xs text-slate-400">
            Otomatis WebP · Disimpan selama 30 hari di server.
          </p>
        </div>
        <button
          type="button"
          className={button}
          disabled={disabled}
          onClick={onCapture}
        >
          <Camera className="h-4 w-4 text-slate-500" />
          <span>{file ? 'Ambil Ulang' : 'Ambil Foto'}</span>
        </button>
      </div>

      {file && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <BlobPreview
            file={file}
            alt="Foto kejadian yang akan disimpan"
            className="h-16 w-16 rounded-lg border border-slate-200 object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800">Foto Siap Disimpan</p>
            <p className="text-[11px] text-slate-400">
              WebP · {Math.ceil(file.size / 1024)} KB
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition cursor-pointer"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus</span>
          </button>
        </div>
      )}
    </section>
  )
}
