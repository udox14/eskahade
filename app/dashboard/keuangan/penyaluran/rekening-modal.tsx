'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getProviderAccountsAction,
  saveProviderAccountAction,
  updateProviderAccountAction,
  deleteProviderAccountAction,
} from './actions'
import type { FinanceProviderAccount } from '@/lib/finance/distribution-types'
import {
  Bank,
  Plus,
  Trash,
  Check,
  Star,
  X,
} from '@phosphor-icons/react'

interface RekeningModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  provider: {
    id: string
    name: string
    type: 'Makan' | 'Cuci'
  } | null
  canManage: boolean
}

export default function RekeningModal({
  isOpen,
  onClose,
  onUpdated,
  provider,
  canManage,
}: RekeningModalProps) {
  const [isPending, startTransition] = useTransition()
  const [accounts, setAccounts] = useState<FinanceProviderAccount[]>([])
  const [showAddForm, setShowAddForm] = useState<boolean>(false)

  // Form states
  const [bankName, setBankName] = useState<string>('')
  const [accountNumber, setAccountNumber] = useState<string>('')
  const [accountHolder, setAccountHolder] = useState<string>('')
  const [isPrimary, setIsPrimary] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>('')

  const resetForm = () => {
    setBankName('')
    setAccountNumber('')
    setAccountHolder('')
    setIsPrimary(false)
    setNotes('')
  }

  const loadAccounts = () => {
    if (!provider) return
    startTransition(async () => {
      try {
        const data = await getProviderAccountsAction(provider.id)
        setAccounts(data)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal memuat rekening penyedia.')
      }
    })
  }

  useEffect(() => {
    if (!isOpen || !provider) return
    let active = true
    getProviderAccountsAction(provider.id)
      .then((data) => {
        if (active) setAccounts(data)
      })
      .catch((err: unknown) => {
        if (active) toast.error(err instanceof Error ? err.message : 'Gagal memuat rekening penyedia.')
      })
    return () => {
      active = false
    }
  }, [isOpen, provider])

  if (!isOpen || !provider) return null

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      toast.error('Mohon lengkapi nama bank, nomor rekening, dan nama pemilik.')
      return
    }

    startTransition(async () => {
      try {
        await saveProviderAccountAction({
          providerId: provider.id,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim(),
          isPrimary,
          notes: notes.trim() || null,
        })
        toast.success('Rekening baru berhasil disimpan.')
        resetForm()
        setShowAddForm(false)
        loadAccounts()
        onUpdated()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan rekening.')
      }
    })
  }

  const handleSetPrimary = (account: FinanceProviderAccount) => {
    if (!canManage) return
    startTransition(async () => {
      try {
        await updateProviderAccountAction({
          id: account.id,
          bankName: account.bank_name,
          accountNumber: account.account_number,
          accountHolder: account.account_holder,
          isPrimary: true,
          notes: account.notes,
        })
        toast.success(`Rekening ${account.bank_name} diset sebagai rekening utama.`)
        loadAccounts()
        onUpdated()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal memperbarui rekening utama.')
      }
    })
  }

  const handleDelete = (account: FinanceProviderAccount) => {
    if (!canManage) return
    if (!window.confirm(`Hapus rekening ${account.bank_name} - ${account.account_number}?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteProviderAccountAction(account.id)
        toast.success('Rekening berhasil dihapus.')
        loadAccounts()
        onUpdated()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus rekening.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Rekening Pembayaran</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {provider.name} &bull; Penyedia {provider.type === 'Makan' ? 'Katering' : 'Laundry'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* List Rekening */}
          {accounts.length === 0 && !showAddForm ? (
            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Bank size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Belum Ada Rekening Bank</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Tambahkan nomor rekening tujuan transfer untuk mempercepat pencatatan penyaluran dana.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                >
                  <Plus size={14} />
                  Tambah Rekening
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`p-4 rounded-xl border transition flex items-center justify-between ${
                    acc.is_primary
                      ? 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{acc.bank_name}</span>
                      {acc.is_primary === 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Star size={10} weight="fill" />
                          Utama
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono font-semibold text-slate-600">
                      {acc.account_number}
                    </div>
                    <div className="text-xs text-slate-500">
                      a.n <span className="font-medium text-slate-700">{acc.account_holder}</span>
                    </div>
                    {acc.notes && (
                      <div className="text-[11px] text-slate-400 italic mt-0.5">{acc.notes}</div>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      {acc.is_primary === 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(acc)}
                          disabled={isPending}
                          title="Jadikan Rekening Utama"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition"
                        >
                          <Star size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(acc)}
                        disabled={isPending}
                        title="Hapus Rekening"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Form Tambah Rekening */}
          {showAddForm ? (
            <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mt-4">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tambah Rekening Baru
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nama Bank <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: BCA / BSI / Mandiri"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nomor Rekening <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1234567890"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Pemilik Rekening <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Atas Nama Pemilik"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cabang atau keterangan tambahan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryCheck"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="primaryCheck" className="text-xs text-slate-700 font-medium">
                  Jadikan rekening utama
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                >
                  <Check size={14} />
                  Simpan Rekening
                </button>
              </div>
            </form>
          ) : (
            canManage && accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50/20 transition flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                Tambah Rekening Baru
              </button>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
