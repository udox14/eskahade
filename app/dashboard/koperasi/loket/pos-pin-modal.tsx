'use client'

import React, { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import {
  KeyRound,
  X,
  ShieldAlert,
  Printer,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import {
  changeStudentPinAtLoketAction,
  resetStudentPinAtLoketAction,
  type StudentLoketProfile,
} from './actions'

interface PosPinModalProps {
  isOpen: boolean
  student: StudentLoketProfile | null
  isViewOnly: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PosPinModal({
  isOpen,
  student,
  isViewOnly,
  onClose,
  onSuccess,
}: PosPinModalProps) {
  const [activeTab, setActiveTab] = useState<'CHANGE' | 'RESET'>('CHANGE')

  // Tab Ubah PIN State
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isChangingPin, setIsChangingPin] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)

  // Tab Reset PIN State
  const [resetReason, setResetReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isResettingPin, setIsResettingPin] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)

  const printSlipRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printSlipRef,
    documentTitle: student ? `Slip-PIN-${student.nis}` : 'Slip-PIN-Santri',
  })

  if (!isOpen || !student) return null

  // Reset internal fields on tab change or close
  const handleClose = () => {
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
    setChangeError(null)
    setResetReason('')
    setCustomReason('')
    setResetError(null)
    setGeneratedPin(null)
    onClose()
  }

  // 1. Eksekusi Santri Ubah PIN Sendiri
  const handleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError(null)

    if (!oldPin) {
      setChangeError('Masukkan PIN lama santri.')
      return
    }

    if (!/^\d{6}$/.test(newPin)) {
      setChangeError('PIN baru harus terdiri dari tepat 6 digit angka.')
      return
    }

    if (newPin !== confirmPin) {
      setChangeError('Konfirmasi PIN baru tidak sesuai.')
      return
    }

    setIsChangingPin(true)
    try {
      const res = await changeStudentPinAtLoketAction(student.id, oldPin, newPin, confirmPin)
      if (res.success) {
        toast.success('PIN santri berhasil diubah!')
        setOldPin('')
        setNewPin('')
        setConfirmPin('')
        onSuccess()
        onClose()
      }
    } catch (err: unknown) {
      setChangeError(err instanceof Error ? err.message : 'Gagal mengubah PIN.')
    } finally {
      setIsChangingPin(false)
    }
  }

  // 2. Eksekusi Petugas Reset PIN Darurat
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)

    const finalReason = resetReason === 'LAINNYA' ? customReason.trim() : resetReason.trim()
    if (!finalReason) {
      setResetError('Pilih atau masukkan alasan reset PIN darurat.')
      return
    }

    setIsResettingPin(true)
    try {
      const res = await resetStudentPinAtLoketAction(student.id, finalReason)
      if (res.success && res.newPlaintextPin) {
        setGeneratedPin(res.newPlaintextPin)
        toast.success('PIN santri berhasil di-reset!')
        onSuccess()
      }
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Gagal mereset PIN santri.')
    } finally {
      setIsResettingPin(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kelola PIN Transaksi Santri</h2>
              <p className="text-xs text-slate-500">
                {student.namaLengkap} • NIS {student.nis}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Hanya tampil jika belum dalam tampilan struk hasil reset) */}
        {!generatedPin && (
          <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('CHANGE')
                setChangeError(null)
                setResetError(null)
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'CHANGE'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Ubah PIN (Santri)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('RESET')
                setChangeError(null)
                setResetError(null)
              }}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'RESET'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Reset PIN Lupa (Petugas)
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* ───────────────── HASIL GENERATE RESET PIN (TAMPILAN SATU KALI) ───────────────── */}
          {generatedPin ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">PIN Baru Berhasil Dibuat!</h3>
                <p className="text-xs text-slate-600">
                  Kunci keamanan santri telah dibuka. Berikan PIN baru di bawah ini kepada santri:
                </p>

                {/* Display PIN Besar */}
                <div className="py-3 px-6 bg-white rounded-xl border border-emerald-300 shadow-inner inline-block my-2">
                  <div className="text-3xl font-extrabold font-mono tracking-[0.4em] text-emerald-950 select-all">
                    {generatedPin}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    PIN hanya ditampilkan <strong>sekali ini saja</strong>. Demi keamanan, PIN tidak disimpan dalam bentuk teks biasa.
                  </span>
                </div>
              </div>

              {/* Printable Thermal Slip (Offscreen / Target Ref) */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 font-mono text-xs">
                <div ref={printSlipRef} className="p-4 bg-white text-slate-900 space-y-2">
                  <div className="text-center border-b border-slate-200 pb-2">
                    <p className="font-bold text-xs uppercase">Pondok Pesantren Sukahideng</p>
                    <p className="text-[10px] text-slate-600">Koperasi Santri • Bukti Reset PIN</p>
                  </div>
                  <div className="py-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nama:</span>
                      <span className="font-bold">{student.namaLengkap}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">NIS:</span>
                      <span className="font-bold">{student.nis}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Asrama:</span>
                      <span>{student.asrama || '-'} {student.kamar ? `/ ${student.kamar}` : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Waktu:</span>
                      <span>{new Date().toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <div className="border-y border-dashed border-slate-300 py-3 text-center my-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">PIN Transaksi Baru</p>
                    <p className="text-2xl font-bold font-mono tracking-widest text-slate-900">{generatedPin}</p>
                  </div>
                  <p className="text-[9px] text-slate-500 text-center leading-tight">
                    * Bersifat rahasia. Jangan berikan kepada siapapun. Ubah PIN ini secara berkala melalui Portal Ortu atau Loket Kasir.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handlePrint()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Slip PIN</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                >
                  Selesai & Tutup
                </button>
              </div>
            </div>
          ) : activeTab === 'CHANGE' ? (
            /* ───────────────── TAB 1: SANTRI UBAH PIN DENGAN PIN LAMA ───────────────── */
            <form onSubmit={handleChangeSubmit} className="space-y-4">
              {student.pinStatus.isLocked ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-950 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">PIN Santri Sedang Terkunci</p>
                    <p className="text-rose-800 leading-relaxed">
                      Santri telah gagal memasukkan PIN 3 kali berturut-turut. PIN tidak dapat diubah menggunakan PIN lama. Harap gunakan tab <strong>Reset PIN Lupa (Petugas)</strong> di sebelah atas.
                    </p>
                  </div>
                </div>
              ) : !student.pinStatus.hasPin ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Santri Belum Memiliki PIN</p>
                    <p className="text-amber-800 leading-relaxed">
                      Santri belum memiliki PIN transaksi sebelumnya. Gunakan tab <strong>Reset PIN Lupa (Petugas)</strong> untuk membuatkan PIN awal santri.
                    </p>
                  </div>
                </div>
              ) : null}

              {changeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{changeError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PIN Lama Santri (6 Digit)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={oldPin}
                  onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ketik 6 digit PIN lama santri"
                  disabled={student.pinStatus.isLocked || !student.pinStatus.hasPin || isChangingPin}
                  className="w-full px-3 py-2 text-xs font-mono font-bold tracking-widest border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIN Baru (6 Digit)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 digit baru"
                    disabled={student.pinStatus.isLocked || !student.pinStatus.hasPin || isChangingPin}
                    className="w-full px-3 py-2 text-xs font-mono font-bold tracking-widest border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konfirmasi PIN Baru
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Ulangi 6 digit"
                    disabled={student.pinStatus.isLocked || !student.pinStatus.hasPin || isChangingPin}
                    className="w-full px-3 py-2 text-xs font-mono font-bold tracking-widest border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Santri dapat memasukkan sendiri PIN baru melalui papan tombol (keyboard/numpad).
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isChangingPin}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    student.pinStatus.isLocked ||
                    !student.pinStatus.hasPin ||
                    isChangingPin ||
                    newPin.length !== 6 ||
                    confirmPin.length !== 6
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isChangingPin ? 'Memverifikasi...' : 'Simpan PIN Baru'}
                </button>
              </div>
            </form>
          ) : (
            /* ───────────────── TAB 2: RESET PIN LUPA OLEH PETUGAS ───────────────── */
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {isViewOnly ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-950 flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Akses Ditolak (Hanya Lihat)</p>
                    <p className="text-rose-800 leading-relaxed">
                      Akun Anda tidak memiliki kewenangan untuk mereset PIN santri. Fitur ini hanya dapat dilakukan oleh Admin atau Petugas Koperasi yang bertugas.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <RefreshCw className="w-4 h-4 text-indigo-600" />
                      <span>Prosedur Reset PIN Darurat</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Gunakan fitur ini jika santri lupa PIN atau PIN terkunci. Sistem akan membuatkan PIN acak baru secara otomatis, mencatat log audit petugas kasir, dan membuka status kunci santri.
                    </p>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Alasan Reset PIN (Wajib Diisi Audit Petugas)
                    </label>
                    <select
                      value={resetReason}
                      onChange={e => setResetReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                      required
                    >
                      <option value="">-- Pilih Alasan Reset --</option>
                      <option value="Santri lupa PIN saat penarikan">Santri lupa PIN saat transaksi di loket</option>
                      <option value="PIN terkunci karena salah memasukkan 3 kali">PIN terkunci (salah 3 kali)</option>
                      <option value="Inisialisasi PIN awal santri">Inisialisasi PIN awal kartu santri</option>
                      <option value="Permintaan wali santri melalui asrama">Permintaan wali santri melalui pengurus</option>
                      <option value="LAINNYA">Lainnya (masukkan catatan khusus)...</option>
                    </select>
                  </div>

                  {resetReason === 'LAINNYA' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Keterangan Alasan Lainnya
                      </label>
                      <input
                        type="text"
                        value={customReason}
                        onChange={e => setCustomReason(e.target.value)}
                        placeholder="Contoh: Kartu baru diterbitkan, PIN belum diterima santri"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isResettingPin}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isResettingPin || !resetReason || (resetReason === 'LAINNYA' && !customReason.trim())}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                    >
                      {isResettingPin ? 'Mereset...' : 'Generate & Reset PIN Baru'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
