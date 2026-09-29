'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { ubahPinUangJajanPortal } from './actions'

interface StudentPinCardProps {
  hasPin: boolean
  isLocked: boolean
  santriNama: string
  nis: string
  isModal?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

export function StudentPinCard({
  hasPin,
  isLocked,
  santriNama,
  nis,
  isModal = false,
  onSuccess,
  onCancel,
}: StudentPinCardProps) {
  const router = useRouter()
  const formId = useId()
  const [passwordPortal, setPasswordPortal] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [konfirmasiPin, setKonfirmasiPin] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return

    if (!passwordPortal) {
      toast.error('Masukkan kata sandi portal orang tua Anda untuk konfirmasi.')
      return
    }

    if (!/^\d{6}$/.test(pinBaru)) {
      toast.error('PIN baru harus terdiri dari 6 digit angka.')
      return
    }

    if (pinBaru !== konfirmasiPin) {
      toast.error('Konfirmasi PIN baru tidak sesuai.')
      return
    }

    setIsSaving(true)
    try {
      const res = await ubahPinUangJajanPortal(passwordPortal, pinBaru, konfirmasiPin)
      if (res?.error) {
        toast.error(res.error)
        return
      }

      toast.success('PIN transaksi santri berhasil diperbarui!')
      setPasswordPortal('')
      setPinBaru('')
      setKonfirmasiPin('')
      onSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah PIN santri.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
      {/* Alert jika terkunci */}
      {isLocked && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-rose-950 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-xs text-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>PIN Sedang Terkunci</span>
          </p>
          <p className="text-[11px] text-rose-700 leading-relaxed">
            Santri salah memasukkan PIN 3 kali di loket. Buat PIN baru di bawah ini untuk langsung membuka kunci.
          </p>
        </div>
      )}

      {/* Input 1: Password Ortu (Verifikasi) */}
      <div>
        <label htmlFor={`${formId}-password`} className="block font-bold text-slate-700 text-xs mb-1">
          Password Portal Orang Tua
        </label>
        <input
          id={`${formId}-password`}
          type="password"
          autoComplete="current-password"
          value={passwordPortal}
          onChange={e => setPasswordPortal(e.target.value)}
          placeholder="Masukkan kata sandi akun Anda"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          required
        />
      </div>

      {/* Input 2: PIN Baru 6 Digit */}
      <div>
        <label htmlFor={`${formId}-pin`} className="block font-bold text-slate-700 text-xs mb-1">
          PIN Baru Santri (6 Digit Angka)
        </label>
        <input
          id={`${formId}-pin`}
          type="password"
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={pinBaru}
          onChange={e => setPinBaru(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          required
        />
      </div>

      {/* Input 3: Konfirmasi PIN Baru */}
      <div>
        <label htmlFor={`${formId}-confirm`} className="block font-bold text-slate-700 text-xs mb-1">
          Ulangi PIN Baru
        </label>
        <input
          id={`${formId}-confirm`}
          type="password"
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={konfirmasiPin}
          onChange={e => setKonfirmasiPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          required
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer active:scale-95 transition"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] text-[#bef264] text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" /> : null}
          <span>Simpan PIN</span>
        </button>
      </div>
    </form>
  )
}
