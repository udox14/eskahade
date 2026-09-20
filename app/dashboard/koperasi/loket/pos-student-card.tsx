'use client'

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
}

export default function PosStudentCard({
  student,
  onReset,
  onPromptPin,
  onOpenPinModal,
  isPinVerified,
}: PosStudentCardProps) {

  const isCardActive = student.card?.status === 'ACTIVE'
  const isCardBlocked = student.card?.status === 'BLOCKED'
  const isCardLost = student.card?.status === 'LOST'
  const isCardRevoked = student.card?.status === 'REVOKED'

  const hasPin = student.pinStatus.hasPin
  const isPinLocked = student.pinStatus.isLocked

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Banner Peringatan jika kartu tidak aktif atau santri tidak aktif */}
      {student.statusGlobal !== 'aktif' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Status santri tidak aktif ({student.statusGlobal}). Transaksi tidak diizinkan.</span>
        </div>
      )}

      {student.card && !isCardActive && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {isCardBlocked
              ? 'Kartu santri sedang DIBLOKIR. Harap hubungi Admin Koperasi.'
              : isCardLost
              ? 'Kartu santri dilaporkan HILANG. Dilarang melakukan transaksi.'
              : 'Kartu santri telah DICABUT (REVOKED).'}
          </span>
        </div>
      )}

      <div className="p-4 sm:p-6 flex flex-col md:flex-row items-center md:items-start gap-5">
        {/* Foto Santri Ukuran Besar (PRD #22.1 Visual Utama Pencocokan Wajah) */}
        <div className="relative shrink-0">
          <div className="w-32 h-40 sm:w-36 sm:h-48 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-100 shadow-sm flex items-center justify-center">
            {student.fotoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={student.fotoUrl}
                alt={student.namaLengkap}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                <User className="w-12 h-12 stroke-[1.5]" />
                <span className="text-[10px] mt-1 text-slate-500">Foto belum tersedia</span>
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-xs border border-slate-200">
            {isCardActive ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 fill-amber-50" />
            )}
          </div>
        </div>

        {/* Rincian Identitas Santri */}
        <div className="flex-1 min-w-0 text-center md:text-left space-y-2.5">
          <div className="flex flex-wrap items-center justify-center md:justify-between gap-2">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  {student.namaLengkap}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {student.jenisKelamin === 'L' ? 'Putra' : 'Putri'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">NIS: {student.nis}</p>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Ganti santri"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ganti Santri</span>
            </button>
          </div>

          {/* Info Asrama & Kamar */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              {student.asrama || 'Tanpa Asrama'}
              {student.kamar ? ` / Kamar ${student.kamar}` : ''}
            </span>

            {/* Status Kartu */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${
                isCardActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isCardBlocked
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
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

            {/* Status PIN */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${
                isPinVerified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isPinLocked
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : hasPin
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
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
          </div>

          {/* Action Bar PIN Verifikasi & Manajemen PIN */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5 border-t border-slate-100">
            {isPinVerified ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Identitas & PIN Santri Sah. Layar transaksi siap digunakan.</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onPromptPin}
                disabled={!isCardActive || isPinLocked || !hasPin}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isPinLocked
                    ? 'PIN Sedang Terkunci'
                    : !hasPin
                    ? 'Santri Belum Memiliki PIN'
                    : 'Verifikasi PIN Santri'}
                </span>
              </button>
            )}

            {/* Tombol Kelola / Ubah / Reset PIN */}
            {onOpenPinModal && (
              <button
                type="button"
                onClick={onOpenPinModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                title="Santri ubah PIN mandiri atau reset PIN darurat oleh petugas"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                <span>Ubah / Reset PIN</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

