'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, ShieldAlert, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react'
import { ubahPinUangJajanPortal } from './actions'

interface StudentPinCardProps {
  hasPin: boolean
  isLocked: boolean
  santriNama: string
  nis: string
}

export function StudentPinCard({
  hasPin,
  isLocked,
  santriNama,
  nis,
}: StudentPinCardProps) {
  const router = useRouter()
  const [passwordPortal, setPasswordPortal] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [konfirmasiPin, setKonfirmasiPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return

    if (!passwordPortal) {
      toast.error('Masukkan password akun portal orang tua Anda.')
      return
    }

    if (!/^\d{6}$/.test(pinBaru)) {
      toast.error('PIN baru harus terdiri dari tepat 6 digit angka.')
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
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah PIN santri.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
      {/* Header Kartu */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">PIN Transaksi Santri (Koperasi)</h3>
            <p className="text-xs text-slate-500">
              PIN 6-digit untuk transaksi uang jajan {santriNama} (NIS {nis}).
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
            isLocked
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : hasPin
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          {isLocked ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>PIN Terkunci</span>
            </>
          ) : hasPin ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PIN Aktif</span>
            </>
          ) : (
            <span>Belum Ada PIN</span>
          )}
        </span>
      </div>

      {/* Alert jika terkunci */}
      {isLocked && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-800">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span>PIN Santri Sedang Terkunci Sementara</span>
          </div>
          <p className="text-rose-900 leading-relaxed">
            Santri telah 3 kali salah memasukkan PIN di loket koperasi. Dengan mengubah PIN di bawah ini,
            kunci keamanan akan langsung dibuka dan santri dapat langsung bertransaksi kembali dengan PIN baru.
          </p>
        </div>
      )}

      {/* Form Ubah PIN */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Password Akun Portal Orang Tua
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={passwordPortal}
            onChange={e => setPasswordPortal(e.target.value)}
            placeholder="Masukkan password login Anda untuk konfirmasi"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden"
            required
          />
          <p className="mt-0.5 text-[11px] text-slate-400">
            Verifikasi identitas orang tua diperlukan demi keamanan rekening uang jajan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                PIN Baru Santri (6 Digit)
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPin ? 'Sembunyikan' : 'Lihat'}</span>
              </button>
            </div>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pinBaru}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPinBaru(val)
              }}
              placeholder="6 digit angka (misal: 123456)"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold font-mono tracking-widest text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Ulangi PIN Baru
            </label>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={konfirmasiPin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setKonfirmasiPin(val)
              }}
              placeholder="Ketik ulang 6 digit"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold font-mono tracking-widest text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              required
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Gunakan 6 digit angka yang mudah diingat santri tetapi tidak mudah ditebak oleh teman sekamar.
          Informasikan PIN baru ini kepada santri.
        </p>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{isSaving ? 'Memverifikasi & Menyimpan…' : 'Simpan PIN Baru Santri'}</span>
        </button>
      </form>
    </div>
  )
}
