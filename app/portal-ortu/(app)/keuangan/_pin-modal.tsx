'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, CircleNotch, Key, XCircle } from '@phosphor-icons/react'
import { BottomSheet } from '../../_components/bottom-sheet'
import { resetPortalStudentPin } from './actions'

export function PinModal({
  open,
  onClose,
  hasPin,
}: {
  open: boolean
  onClose: () => void
  hasPin: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [accountPassword, setAccountPassword] = useState('')
  const [newPin, setNewPin] = useState('')

  function handleSubmit() {
    if (pending) return
    startTransition(async () => {
      const result = await resetPortalStudentPin({ accountPassword, newPin })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('PIN pencairan santri berhasil diperbarui.')
      setAccountPassword('')
      setNewPin('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Atur PIN Anak">
      <div className={`flex items-center gap-2.5 rounded-[var(--p-radius-md)] border px-4 py-3 ${
        hasPin ? 'border-[#cde3d4] bg-[var(--p-success-soft)]' : 'border-[var(--p-line)] bg-[var(--p-paper)]'
      }`}>
        {hasPin ? (
          <CheckCircle className="w-4 h-4 shrink-0 text-[var(--p-success)]" weight="fill" />
        ) : (
          <XCircle className="w-4 h-4 shrink-0 text-[var(--p-muted)]" />
        )}
        <p className={`text-xs font-bold ${hasPin ? 'text-[var(--p-success)]' : 'text-[var(--p-muted)]'}`}>
          {hasPin ? 'PIN sudah diset' : 'PIN belum diset'}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-[var(--p-muted)] leading-relaxed">
        Demi keamanan, PIN yang sudah tersimpan tidak bisa ditampilkan ulang — Anda hanya bisa menggantinya dengan PIN baru.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password Akun Wali</label>
          <input
            type="password"
            value={accountPassword}
            onChange={e => setAccountPassword(e.target.value)}
            placeholder="Masukkan password akun portal Anda..."
            className="portal-field"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">PIN Baru Santri (4-8 Digit)</label>
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            placeholder="Contoh: 123456"
            className="portal-field"
          />
        </div>

        <button
          disabled={pending}
          onClick={handleSubmit}
          className="portal-btn portal-btn-accent w-full"
        >
          {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
          {pending ? 'Menyimpan PIN...' : hasPin ? 'Ganti PIN Santri' : 'Atur PIN Santri'}
        </button>
      </div>
    </BottomSheet>
  )
}
