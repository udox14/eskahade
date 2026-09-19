'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateGlobalDailyLimitAction, type StudentWalletLimitRow } from './actions'
import {
  Coins,
  Info,
  MagnifyingGlass,
  ShieldCheck,
} from '@phosphor-icons/react'

interface LimitJajanTabProps {
  globalDailyLimit: number
  studentLimits: StudentWalletLimitRow[]
  canMutate: boolean
  onRefresh: () => void
}

export default function LimitJajanTab({
  globalDailyLimit,
  studentLimits,
  canMutate,
  onRefresh,
}: LimitJajanTabProps) {
  const [globalInput, setGlobalInput] = useState<string>(
    globalDailyLimit.toLocaleString('id-ID')
  )
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSaveGlobalLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseInt(globalInput.replace(/\D/g, ''), 10)
    if (isNaN(numeric) || numeric < 0) {
      toast.error('Nominal limit harian harus bernilai angka non-negatif.')
      return
    }

    setIsSaving(true)
    const toastId = toast.loading('Memperbarui limit harian global...')

    const res = await updateGlobalDailyLimitAction(numeric)

    setIsSaving(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success(`Limit harian global berhasil diatur ke Rp ${numeric.toLocaleString('id-ID')}/hari.`)
      onRefresh()
    } else {
      toast.error('Gagal memperbarui limit', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  const filteredStudents = studentLimits.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.nama_lengkap.toLowerCase().includes(q) ||
      s.nis.toLowerCase().includes(q) ||
      (s.asrama && s.asrama.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {/* Strict Dana Titipan Rule Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" weight="bold" />
        <div>
          <span className="font-bold">Prinsip Dana Titipan Uang Jajan (PRD #15 & #16):</span> Saldo uang jajan santri bersumber mutlak dari buku besar transaksi (<code className="font-mono bg-amber-100/60 px-1 py-0.5 rounded">finance_wallet_ledger</code>) dan <span className="font-bold underline">dilarang keras untuk diedit manual secara langsung</span>. Saldo bertambah hanya via top-up sah atau setoran tunai, dan berkurang hanya melalui penarikan loket atau koreksi berotoritas.
        </div>
      </div>

      {/* Global Limit Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" weight="bold" />
              <h3 className="text-sm font-bold text-slate-800">
                Limit Penarikan Harian Global Pesantren
              </h3>
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Batas penarikan maksimum per santri per hari yang diberlakukan di loket koperasi pesantren. Jika wali santri menetapkan limit lebih rendah di Portal Ortu, sistem otomatis memilih nilai yang paling ketat:
              <span className="font-mono font-semibold text-slate-700 block mt-1">
                Limit Efektif = min(Limit Global Pesantren, Limit Harian Orang Tua)
              </span>
            </p>
          </div>

          <form onSubmit={handleSaveGlobalLimit} className="flex items-center gap-3 shrink-0">
            <div className="relative w-44">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="text"
                disabled={!canMutate || isSaving}
                value={globalInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setGlobalInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '')
                }}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {canMutate ? (
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 shrink-0"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Limit'}
              </button>
            ) : (
              <span className="text-xs text-slate-400 italic">Read-only</span>
            )}
          </form>
        </div>
      </div>

      {/* Student Limits & Authoritative Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-600" weight="bold" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Monitoring Limit & Saldo Titipan Santri
            </span>
          </div>
          <div className="w-64">
            <div className="relative">
              <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari santri atau asrama..."
                className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Santri</th>
                <th className="px-4 py-3 text-right">Saldo Saat Ini (Read-Only)</th>
                <th className="px-4 py-3 text-right">Limit Harian Ortu</th>
                <th className="px-4 py-3 text-right">Limit Global Pesantren</th>
                <th className="px-4 py-3 text-right font-bold text-emerald-800">Limit Efektif Harian</th>
                <th className="px-4 py-3 text-center">Status Aturan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data santri yang cocok.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const hasParentLimit = s.parent_daily_limit !== null
                  const isParentStrict = hasParentLimit && s.parent_daily_limit! < globalDailyLimit

                  return (
                    <tr key={s.santri_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div>{s.nama_lengkap}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          NIS: {s.nis} {s.asrama ? `• ${s.asrama}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        Rp {s.saldo_uang_jajan.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {hasParentLimit ? (
                          `Rp ${s.parent_daily_limit!.toLocaleString('id-ID')}`
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum Diatur</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        Rp {globalDailyLimit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                        Rp {s.effective_daily_limit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isParentStrict ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            Mengikuti Ortu
                          </span>
                        ) : hasParentLimit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Mengikuti Global
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Default Global
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
