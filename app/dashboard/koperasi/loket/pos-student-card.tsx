'use client'

import { publicMediaUrl } from '@/lib/r2/references'
import {
  User,
  Home,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  KeyRound,
  ShieldAlert,
} from 'lucide-react'
import type { StudentLoketProfile } from './actions'

interface PosStudentCardProps {
  student: StudentLoketProfile
  onReset: () => void
  onPromptPin: () => void
  onOpenPinModal?: () => void
  isPinVerified: boolean
  /** false: kartu & PIN tidak dipakai lagi (modul Kredensial nonaktif). */
  showCredentials?: boolean
}

export default function PosStudentCard({
  student,
  onReset,
  onPromptPin,
  onOpenPinModal,
  isPinVerified,
  showCredentials = false,
}: PosStudentCardProps) {
  const isActiveStudent = student.statusGlobal === 'aktif'
  const isCardActive = student.card?.status === 'ACTIVE'
  const isCardBlocked = student.card?.status === 'BLOCKED'
  const isCardLost = student.card?.status === 'LOST'
  const isCardRevoked = student.card?.status === 'REVOKED'
  const hasPin = student.pinStatus.hasPin
  const isPinLocked = student.pinStatus.isLocked

  const isStatusHealthy = showCredentials ? isActiveStudent && isCardActive : isActiveStudent

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {!isActiveStudent && (
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>Status santri tidak aktif ({student.statusGlobal}). Transaksi tidak diizinkan.</span>
        </div>
      )}

      {showCredentials && student.card && !isCardActive && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            {isCardBlocked
              ? 'Kartu santri sedang diblokir. Hubungi Admin Koperasi.'
              : isCardLost
                ? 'Kartu santri dilaporkan hilang. Transaksi tidak diizinkan.'
                : 'Kartu santri telah dicabut.'}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 p-4 sm:p-5 md:flex-row md:items-start">
        {/* Foto Santri untuk Pencocokan Wajah */}
        <div className="relative shrink-0">
          <div className="flex h-36 w-28 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100 shadow-2xs sm:h-40 sm:w-32">
            {student.fotoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={publicMediaUrl(student.fotoUrl)}
                alt={student.namaLengkap}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                <User className="h-10 w-10 stroke-[1.5]" aria-hidden="true" />
                <span className="mt-1 text-[10px] text-slate-500">Foto belum ada</span>
              </div>
            )}
          </div>
          <div
            title={isStatusHealthy ? 'Santri aktif' : 'Status perlu perhatian'}
            className="absolute -bottom-2 -right-2 rounded-full border border-slate-200 bg-white p-1 shadow-xs"
          >
            {isStatusHealthy ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 fill-emerald-50" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500 fill-amber-50" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Rincian Identitas */}
        <div className="min-w-0 flex-1 space-y-2.5 text-center md:text-left">
          <div className="flex flex-col items-center justify-between gap-2 md:flex-row md:items-start">
            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <h2 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                  {student.namaLengkap}
                </h2>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {student.jenisKelamin === 'L' ? 'Putra' : 'Putri'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 tabular-nums">NIS {student.nis}</p>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ganti Santri</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 md:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">
              <Home className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {student.asrama || 'Tanpa Asrama'}
              {student.kamar ? ` / Kamar ${student.kamar}` : ''}
            </span>

            {showCredentials && (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold ${
                    isCardActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : isCardBlocked
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {isCardActive
                      ? 'Kartu Aktif'
                      : isCardBlocked
                        ? 'Kartu Diblokir'
                        : isCardLost
                          ? 'Kartu Hilang'
                          : isCardRevoked
                            ? 'Kartu Dicabut'
                            : 'Belum Ada Kartu'}
                  </span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold ${
                    isPinVerified
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : isPinLocked
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : hasPin
                          ? 'border-sky-200 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {isPinVerified
                      ? 'PIN Terverifikasi'
                      : isPinLocked
                        ? 'PIN Terkunci'
                        : hasPin
                          ? 'Perlu Verifikasi PIN'
                          : 'PIN Belum Diatur'}
                  </span>
                </span>
              </>
            )}
          </div>

          {showCredentials && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-2 md:justify-start">
              {isPinVerified ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>Identitas &amp; PIN santri sah. Layar transaksi siap digunakan.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onPromptPin}
                  disabled={!isCardActive || isPinLocked || !hasPin}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isPinLocked
                      ? 'PIN Sedang Terkunci'
                      : !hasPin
                        ? 'Santri Belum Memiliki PIN'
                        : 'Verifikasi PIN Santri'}
                  </span>
                </button>
              )}

              {onOpenPinModal && (
                <button
                  type="button"
                  onClick={onOpenPinModal}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                  <span>Ubah / Reset PIN</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
