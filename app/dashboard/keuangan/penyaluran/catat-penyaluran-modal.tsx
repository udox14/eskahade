'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import {
  recordDistributionAction,
  getProviderAccountsAction,
} from './actions'
import type {
  FinanceDistributionRecipientType,
  FinanceProviderAccount,
} from '@/lib/finance/distribution-types'
import {
  Bank,
  Money,
  CheckCircle,
  WarningCircle,
  X,
  ArrowRight,
  ShieldCheck,
  UploadSimple,
  Trash,
  FileText,
} from '@phosphor-icons/react'
import { compressImageFile } from '@/lib/image/compress-client'

interface CatatPenyaluranTarget {
  recipientType: FinanceDistributionRecipientType
  recipientId?: string | null
  recipientName: string
  itemType: string
  itemLabel: string
  period: string
  periodLabel: string
  availableAmount: number
}

interface CatatPenyaluranModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newDistributionId?: string) => void
  target: CatatPenyaluranTarget | null
}

function CatatPenyaluranForm({
  onClose,
  onSuccess,
  target,
}: {
  onClose: () => void
  onSuccess: (newDistributionId?: string) => void
  target: CatatPenyaluranTarget
}) {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'FORM' | 'CONFIRM'>('FORM')

  // Form states diinisialisasi langsung dari target props
  const [amountStr, setAmountStr] = useState<string>(() => String(target.availableAmount))
  const [method, setMethod] = useState<'TRANSFER' | 'CASH'>('TRANSFER')
  const [providerAccounts, setProviderAccounts] = useState<FinanceProviderAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() =>
    target.recipientType === 'BENDAHARA' ? 'bendahara_default' : ''
  )
  const [destinationBank, setDestinationBank] = useState<string>(() =>
    target.recipientType === 'BENDAHARA' ? 'BSI (Bank Syariah Indonesia)' : ''
  )
  const [destinationAccount, setDestinationAccount] = useState<string>(() =>
    target.recipientType === 'BENDAHARA' ? '1002345678' : ''
  )
  const [accountHolderName, setAccountHolderName] = useState<string>(() =>
    target.recipientType === 'BENDAHARA' ? 'Yayasan Pesantren Sukahideng' : ''
  )
  const [transferredAt, setTransferredAt] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  )
  const [notes, setNotes] = useState<string>('')
  const [proofAttachmentUrl, setProofAttachmentUrl] = useState<string>('')
  const [uploadingProof, setUploadingProof] = useState<boolean>(false)
  const [proofFileName, setProofFileName] = useState<string>('')

  async function handleUploadProof(file: File) {
    setUploadingProof(true)
    try {
      const base64 = await compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 })
      const response = await fetch('/api/upload-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          folder: 'penyaluran-proofs',
          filenamePrefix: `dist_${target.recipientType.toLowerCase()}`,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || 'Upload bukti transfer gagal.')
      setProofAttachmentUrl(result.url)
      setProofFileName(file.name)
      toast.success('Bukti transfer berhasil diunggah.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah bukti transfer.')
    } finally {
      setUploadingProof(false)
    }
  }

  // Load rekening provider bila penerima katering/laundry
  useEffect(() => {
    if (!target.recipientId) return

    let active = true
    getProviderAccountsAction(target.recipientId)
      .then((accounts) => {
        if (!active) return
        setProviderAccounts(accounts)
        const primary = accounts.find((a) => a.is_primary === 1) || accounts[0]
        if (primary) {
          setSelectedAccountId(primary.id)
          setDestinationBank(primary.bank_name)
          setDestinationAccount(primary.account_number)
          setAccountHolderName(primary.account_holder)
        }
      })
      .catch(() => {
        if (active) setProviderAccounts([])
      })

    return () => {
      active = false
    }
  }, [target.recipientId])

  const parsedAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0
  const maxAvailable = target.availableAmount
  const isAmountValid = parsedAmount > 0 && parsedAmount <= maxAvailable

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId)
    if (accountId === 'custom') {
      setDestinationBank('')
      setDestinationAccount('')
      setAccountHolderName('')
      return
    }
    const acc = providerAccounts.find((a) => a.id === accountId)
    if (acc) {
      setDestinationBank(acc.bank_name)
      setDestinationAccount(acc.account_number)
      setAccountHolderName(acc.account_holder)
    }
  }

  const handleSubmit = () => {
    if (!isAmountValid) {
      toast.error('Nominal penyaluran tidak valid atau melebihi dana siap salur.')
      return
    }

    if (method === 'TRANSFER') {
      if (!destinationBank.trim() || !destinationAccount.trim() || !accountHolderName.trim()) {
        toast.error('Mohon lengkapi seluruh informasi rekening bank tujuan transfer.')
        return
      }
    }

    startTransition(async () => {
      try {
        const res = await recordDistributionAction({
          recipientType: target.recipientType,
          recipientId: target.recipientId,
          itemType: target.itemType,
          period: target.period,
          amount: parsedAmount,
          method,
          destinationBank: method === 'TRANSFER' ? destinationBank.trim() : null,
          destinationAccount: method === 'TRANSFER' ? destinationAccount.trim() : null,
          accountHolderName: method === 'TRANSFER' ? accountHolderName.trim() : null,
          proofAttachmentUrl: proofAttachmentUrl || null,
          transferredAt: new Date(transferredAt).toISOString(),
          notes: notes.trim() || null,
        })

        toast.success(
          `Penyaluran dana Rp ${parsedAmount.toLocaleString('id-ID')} ke ${target.recipientName} berhasil dicatat!`
        )
        onSuccess(res?.data?.id)
        onClose()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal mencatat penyaluran dana.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Catat Penyaluran Dana</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {target.recipientName} &bull; {target.itemLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 'FORM' ? (
            <>
              {/* Info Dana Tersedia */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-emerald-800">Dana Siap Salur</div>
                  <div className="text-xl font-bold text-emerald-950 mt-0.5">
                    Rp {maxAvailable.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Periode: <span className="font-semibold">{target.periodLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAmountStr(String(maxAvailable))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                >
                  Salur Seluruhnya
                </button>
              </div>

              {/* Input Nominal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nominal yang Disalurkan (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                    Rp
                  </div>
                  <input
                    type="text"
                    value={parsedAmount > 0 ? parsedAmount.toLocaleString('id-ID') : amountStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setAmountStr(raw)
                    }}
                    placeholder="0"
                    className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-slate-800 text-base font-bold focus:outline-none focus:ring-2 transition ${
                      !isAmountValid && parsedAmount > 0
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-100'
                    }`}
                  />
                </div>
                {!isAmountValid && parsedAmount > maxAvailable && (
                  <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <WarningCircle size={14} weight="fill" />
                    Nominal melebihi dana siap salur (Maks. Rp {maxAvailable.toLocaleString('id-ID')}).
                  </p>
                )}
                {parsedAmount > 0 && parsedAmount < maxAvailable && (
                  <p className="text-xs text-amber-700 mt-1">
                    Penyaluran parsial: Sisa Rp {(maxAvailable - parsedAmount).toLocaleString('id-ID')} akan tetap berstatus siap salur.
                  </p>
                )}
              </div>

              {/* Pilihan Metode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metode Penyaluran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod('TRANSFER')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-semibold text-sm transition ${
                      method === 'TRANSFER'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Bank size={18} weight={method === 'TRANSFER' ? 'fill' : 'regular'} />
                    Transfer Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('CASH')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-semibold text-sm transition ${
                      method === 'CASH'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Money size={18} weight={method === 'CASH' ? 'fill' : 'regular'} />
                    Tunai (Cash)
                  </button>
                </div>
              </div>

              {/* Form Rekening jika TRANSFER */}
              {method === 'TRANSFER' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  {providerAccounts.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Pilih Rekening Terdaftar
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => handleAccountSelect(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        {providerAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bank_name} - {acc.account_number} a.n {acc.account_holder} {acc.is_primary ? '(Utama)' : ''}
                          </option>
                        ))}
                        <option value="custom">+ Masukkan Rekening Lain</option>
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Bank Tujuan
                      </label>
                      <input
                        type="text"
                        value={destinationBank}
                        onChange={(e) => setDestinationBank(e.target.value)}
                        placeholder="Contoh: BCA / BSI / BRI"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={destinationAccount}
                        onChange={(e) => setDestinationAccount(e.target.value)}
                        placeholder="1234567890"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      placeholder="Atas Nama Pemilik Rekening"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {method === 'CASH' && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-start gap-2.5">
                  <Money size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Dana akan disalurkan secara tunai fisik. Pastikan slip bukti tanda terima fisik ditandatangani saat penyerahan uang.
                  </p>
                </div>
              )}

              {/* Tanggal & Waktu */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tanggal & Waktu Penyaluran
                </label>
                <input
                  type="datetime-local"
                  value={transferredAt}
                  onChange={(e) => setTransferredAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Keterangan tambahan atau nomor referensi bank..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Bukti Lampiran / Transfer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Lampiran Bukti Penyaluran / Transfer</span>
                  {method === 'TRANSFER' && (
                    <span className="text-[10px] text-amber-600 font-bold uppercase">Disarankan untuk Transfer</span>
                  )}
                </label>
                {proofAttachmentUrl ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={20} className="text-emerald-700 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-emerald-950 block truncate">
                          {proofFileName || 'Bukti Transfer Terlampir'}
                        </span>
                        <a
                          href={proofAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-700 underline hover:text-emerald-900"
                        >
                          Lihat File Bukti
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProofAttachmentUrl('')
                        setProofFileName('')
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Hapus Lampiran"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 cursor-pointer transition">
                    <UploadSimple size={22} className="text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-slate-700">
                      {uploadingProof ? 'Mengunggah...' : 'Upload Foto / Screenshot Struk Transfer'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG, atau WebP (Maks. 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingProof}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadProof(file)
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </>
          ) : (
            /* Review & Konfirmasi Step */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Konfirmasi Penyaluran Dana
                </div>

                <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Penerima</span>
                  <span className="font-bold text-slate-800">{target.recipientName}</span>
                </div>

                <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Pos Dana</span>
                  <span className="font-semibold text-slate-800">{target.itemLabel}</span>
                </div>

                <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Periode Tagihan</span>
                  <span className="font-semibold text-slate-800">{target.periodLabel}</span>
                </div>

                <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Metode Penyaluran</span>
                  <span className="font-bold text-slate-800">
                    {method === 'TRANSFER' ? 'Transfer Bank' : 'Tunai (Cash)'}
                  </span>
                </div>

                {method === 'TRANSFER' && (
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Rekening Tujuan</span>
                    <span className="font-medium text-slate-800 text-right">
                      {destinationBank} - {destinationAccount} <br />
                      <span className="text-[11px] text-slate-500">a.n {accountHolderName}</span>
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Bukti Lampiran</span>
                  <span className="font-semibold text-slate-800">
                    {proofAttachmentUrl ? (
                      <span className="text-emerald-700 font-bold">Terlampir</span>
                    ) : (
                      <span className="text-slate-400">Tidak ada lampiran</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="font-bold text-slate-700">Total Nominal Disalurkan</span>
                  <span className="font-extrabold text-emerald-600 text-base">
                    Rp {parsedAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                Penyaluran yang telah disimpan akan tercatat permanen di audit trail dan memotong kuota dana alokasi secara atomik.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          {step === 'FORM' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep('CONFIRM')}
                disabled={!isAmountValid}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                Lanjutkan Review
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('FORM')}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Kembali Edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition disabled:opacity-50 shadow-xs"
              >
                {isPending ? 'Menyimpan...' : 'Konfirmasi & Salurkan Dana'}
                <CheckCircle size={15} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CatatPenyaluranModal({
  isOpen,
  onClose,
  onSuccess,
  target,
}: CatatPenyaluranModalProps) {
  if (!isOpen || !target) return null

  return (
    <CatatPenyaluranForm
      key={`${target.recipientType}-${target.recipientId || 'bendahara'}-${target.itemType}-${target.period}`}
      onClose={onClose}
      onSuccess={onSuccess}
      target={target}
    />
  )
}
