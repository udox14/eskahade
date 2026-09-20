'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { saveGatewaySettingsAction, type MaskedGatewaySettings } from './actions'
import {
  CreditCard,
  Lock,
  Copy,
  Check,
  ShieldCheck,
  Bank,
  CheckCircle,
  WarningCircle,
  QrCode,
} from '@phosphor-icons/react'

interface GatewayTabProps {
  gatewayConfig: MaskedGatewaySettings
  canMutate: boolean
  onRefresh: () => void
}

export default function GatewayTab({
  gatewayConfig,
  canMutate,
  onRefresh,
}: GatewayTabProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  // Form State
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    gatewayConfig.environment
  )
  const [merchantCode, setMerchantCode] = useState(gatewayConfig.merchantCode)
  const [callbackUrl, setCallbackUrl] = useState(gatewayConfig.callbackUrl)
  const [returnUrl, setReturnUrl] = useState(gatewayConfig.returnUrl)
  const [defaultExpiryMinutes, setDefaultExpiryMinutes] = useState(
    gatewayConfig.defaultExpiryMinutes
  )
  const [newApiKey, setNewApiKey] = useState('')

  // Fee handling
  const [feePayer, setFeePayer] = useState<'CUSTOMER' | 'INSTITUTION'>(
    gatewayConfig.feePayer
  )
  const [defaultVaFee, setDefaultVaFee] = useState(gatewayConfig.defaultVaFee)
  const [defaultQrisFeePercent, setDefaultQrisFeePercent] = useState(
    gatewayConfig.defaultQrisFeePercent
  )
  const [enabledChannels, setEnabledChannels] = useState<Array<'DUITKU_VA' | 'DUITKU_QRIS'>>(
    gatewayConfig.enabledChannels || ['DUITKU_VA', 'DUITKU_QRIS']
  )

  // SNAP Fixed VA
  const [snapPartnerServiceId, setSnapPartnerServiceId] = useState(
    gatewayConfig.snapPartnerServiceId
  )
  const [snapDefaultTrxType, setSnapDefaultTrxType] = useState<'C' | 'O'>(
    gatewayConfig.snapDefaultTrxType
  )
  const [newSnapClientSecret, setNewSnapClientSecret] = useState('')
  const [copiedSnapPayment, setCopiedSnapPayment] = useState(false)
  const [copiedSnapInquiry, setCopiedSnapInquiry] = useState(false)

  // Settlement
  const [settlementBank, setSettlementBank] = useState(
    gatewayConfig.settlementDestinationBank
  )
  const [settlementAccount, setSettlementAccount] = useState(
    gatewayConfig.settlementDestinationAccount
  )
  const [settlementHolder, setSettlementHolder] = useState(
    gatewayConfig.settlementAccountHolder
  )

  const handleCopyWebhook = () => {
    const fullUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${callbackUrl}`
      : callbackUrl
    navigator.clipboard.writeText(fullUrl)
    setCopiedWebhook(true)
    toast.success('URL Webhook Duitku berhasil disalin ke clipboard.')
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  const handleCopySnapUrl = (path: string, type: 'payment' | 'inquiry') => {
    const fullUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${path}`
      : path
    navigator.clipboard.writeText(fullUrl)
    if (type === 'payment') {
      setCopiedSnapPayment(true)
      setTimeout(() => setCopiedSnapPayment(false), 2000)
    } else {
      setCopiedSnapInquiry(true)
      setTimeout(() => setCopiedSnapInquiry(false), 2000)
    }
    toast.success(`URL SNAP ${type === 'payment' ? 'Payment' : 'Inquiry'} berhasil disalin.`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const toastId = toast.loading('Menyimpan pengaturan gateway & settlement...')

    const res = await saveGatewaySettingsAction({
      environment,
      merchantCode: merchantCode.trim(),
      callbackUrl: callbackUrl.trim(),
      returnUrl: returnUrl.trim(),
      defaultExpiryMinutes: Number(defaultExpiryMinutes),
      newApiKey: newApiKey.trim() || undefined,
      feePayer,
      defaultVaFee: Number(defaultVaFee),
      defaultQrisFeePercent: Number(defaultQrisFeePercent),
      enabledChannels,
      snapPartnerServiceId: snapPartnerServiceId.trim(),
      snapDefaultTrxType,
      newSnapClientSecret: newSnapClientSecret.trim() || undefined,
      settlementDestinationBank: settlementBank.trim(),
      settlementDestinationAccount: settlementAccount.trim(),
      settlementAccountHolder: settlementHolder.trim(),
    })

    setIsSaving(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Pengaturan Payment Gateway & Settlement berhasil disimpan.')
      setNewApiKey('')
      setNewSnapClientSecret('')
      onRefresh()
    } else {
      toast.error('Gagal menyimpan pengaturan', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Strict Security & Masking Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" weight="bold" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-slate-100 flex items-center gap-2">
            Isolasi Kredensial & Masking Data Sensitif
          </div>
          <p className="text-slate-300 leading-relaxed">
            Kunci API rahasia (<code className="font-mono text-emerald-300">API Key</code>, <code className="font-mono text-emerald-300">Client Secret</code>, dan <code className="font-mono text-emerald-300">Private Key</code>) dimasking secara ketat di sisi server dan <span className="font-semibold text-white">tidak pernah dibocorkan ke client browser</span>. Untuk memperbarui kredensial, masukkan kunci baru ke dalam kolom input. Jika dibiarkan kosong, kredensial tersimpan yang aktif akan tetap dipertahankan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Duitku Web API V2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" weight="bold" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Konfigurasi Duitku Web API V2
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Checkout & QRIS
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mode Lingkungan (Environment)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canMutate}
                onClick={() => setEnvironment('sandbox')}
                className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  environment === 'sandbox'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Sandbox (Testing)
              </button>
              <button
                type="button"
                disabled={!canMutate}
                onClick={() => setEnvironment('production')}
                className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  environment === 'production'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Production (Live)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Merchant Code / Partner ID
            </label>
            <input
              type="text"
              disabled={!canMutate}
              value={merchantCode}
              onChange={(e) => setMerchantCode(e.target.value)}
              placeholder="Contoh: D12345"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duitku API Key (Secret)
            </label>
            <div className="relative">
              <input
                type="password"
                disabled={!canMutate}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={
                  gatewayConfig.apiKeyConfigured
                    ? '•••••••••••••••••••••••• (Tersimpan aman — kosongkan jika tidak diubah)'
                    : 'Masukkan API Key Duitku...'
                }
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Status saat ini: {gatewayConfig.apiKeyConfigured ? (
                <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" weight="fill" /> Terkonfigurasi
                </span>
              ) : (
                <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                  <WarningCircle className="w-3 h-3" weight="fill" /> Belum Dikonfigurasi
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Callback Webhook (Idempotent Notification)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={!canMutate}
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedWebhook ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waktu Kedaluwarsa Order (Menit)
              </label>
              <input
                type="number"
                disabled={!canMutate}
                value={defaultExpiryMinutes}
                onChange={(e) => setDefaultExpiryMinutes(Number(e.target.value))}
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return URL (Setelah Bayar)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={returnUrl}
                onChange={(e) => setReturnUrl(e.target.value)}
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Fee Payer & Fixed VA (SNAP BI) */}
        <div className="space-y-6">
          {/* Fee Handling */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" weight="bold" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Skema Biaya Transaksi Gateway
                </h3>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Penanggung Biaya Transaksi Gateway
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={() => setFeePayer('CUSTOMER')}
                  className={`text-xs font-semibold py-2.5 px-3 rounded-lg border text-left transition-colors ${
                    feePayer === 'CUSTOMER'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {feePayer === 'CUSTOMER' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    Wali Santri (Customer)
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Biaya ditambahkan ke nominal tagihan saat checkout
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={() => setFeePayer('INSTITUTION')}
                  className={`text-xs font-semibold py-2.5 px-3 rounded-lg border text-left transition-colors ${
                    feePayer === 'INSTITUTION'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {feePayer === 'INSTITUTION' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    Pesantren (Subsidi)
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Biaya dipotong langsung dari kas masuk pesantren
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimasi Biaya VA (Rupiah)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">Rp</span>
                  <input
                    type="number"
                    disabled={!canMutate}
                    value={defaultVaFee}
                    onChange={(e) => setDefaultVaFee(Number(e.target.value))}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimasi Biaya QRIS (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    disabled={!canMutate}
                    value={defaultQrisFeePercent}
                    onChange={(e) => setDefaultQrisFeePercent(Number(e.target.value))}
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                </div>
              </div>
            </div>

            {/* Payment Channels Whitelist */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kanal Pembayaran Aktif (Portal Orang Tua)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  enabledChannels.includes('DUITKU_VA')
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}>
                  <input
                    type="checkbox"
                    disabled={!canMutate}
                    checked={enabledChannels.includes('DUITKU_VA')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEnabledChannels([...enabledChannels, 'DUITKU_VA'])
                      } else {
                        if (enabledChannels.length <= 1) {
                          toast.error('Minimal satu kanal pembayaran wajib diaktifkan.')
                          return
                        }
                        setEnabledChannels(enabledChannels.filter((c) => c !== 'DUITKU_VA'))
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Virtual Account (DUITKU_VA)</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  enabledChannels.includes('DUITKU_QRIS')
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}>
                  <input
                    type="checkbox"
                    disabled={!canMutate}
                    checked={enabledChannels.includes('DUITKU_QRIS')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEnabledChannels([...enabledChannels, 'DUITKU_QRIS'])
                      } else {
                        if (enabledChannels.length <= 1) {
                          toast.error('Minimal satu kanal pembayaran wajib diaktifkan.')
                          return
                        }
                        setEnabledChannels(enabledChannels.filter((c) => c !== 'DUITKU_QRIS'))
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>QRIS Dinamis (DUITKU_QRIS)</span>
                </label>
              </div>
            </div>
          </div>

          {/* SNAP Fixed VA */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" weight="bold" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Fixed Virtual Account SNAP BI
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {gatewayConfig.totalFixedVaRegistered} Santri Terdaftar
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SNAP Partner Service ID
                </label>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={snapPartnerServiceId}
                  onChange={(e) => setSnapPartnerServiceId(e.target.value)}
                  placeholder="Contoh: 88888"
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Trx Type
                </label>
                <select
                  disabled={!canMutate}
                  value={snapDefaultTrxType}
                  onChange={(e) => setSnapDefaultTrxType(e.target.value as 'C' | 'O')}
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                >
                  <option value="C">Close Amount (C) — Berdasarkan Order</option>
                  <option value="O">Open Amount (O) — Fleksibel Top-Up</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SNAP Client Secret (Masked)
              </label>
              <input
                type="password"
                disabled={!canMutate}
                value={newSnapClientSecret}
                onChange={(e) => setNewSnapClientSecret(e.target.value)}
                placeholder={
                  gatewayConfig.snapClientSecretConfigured
                    ? '•••••••••••••••••••••••• (Tersimpan aman — kosongkan jika tidak diubah)'
                    : 'Masukkan SNAP Client Secret...'
                }
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
            </div>

            {/* SNAP Webhook Endpoints */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">
                Endpoint Webhook Runtime SNAP BI
              </label>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                  <div className="truncate mr-2">
                    <span className="font-semibold text-slate-600 block text-[10px] uppercase">Notifikasi Pembayaran VA</span>
                    <code className="text-slate-800 font-mono text-[11px]">/api/finance/gateway/duitku/snap/va/payment</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySnapUrl('/api/finance/gateway/duitku/snap/va/payment', 'payment')}
                    className="p-1 text-slate-500 hover:text-slate-700 shrink-0"
                    title="Salin URL"
                  >
                    {copiedSnapPayment ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                  <div className="truncate mr-2">
                    <span className="font-semibold text-slate-600 block text-[10px] uppercase">Inquiry VA Real-Time</span>
                    <code className="text-slate-800 font-mono text-[11px]">/api/finance/gateway/duitku/snap/va/inquiry</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySnapUrl('/api/finance/gateway/duitku/snap/va/inquiry', 'inquiry')}
                    className="p-1 text-slate-500 hover:text-slate-700 shrink-0"
                    title="Salin URL"
                  >
                    {copiedSnapInquiry ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Rekening Penampung Settlement Bank */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bank className="w-4 h-4 text-emerald-600" weight="bold" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rekening Bank Penampung Settlement Pesantren
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Tujuan pencairan otomatis payment gateway</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bank</label>
            <input
              type="text"
              disabled={!canMutate}
              value={settlementBank}
              onChange={(e) => setSettlementBank(e.target.value)}
              placeholder="Contoh: Bank Syariah Indonesia (BSI)"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Rekening</label>
            <input
              type="text"
              disabled={!canMutate}
              value={settlementAccount}
              onChange={(e) => setSettlementAccount(e.target.value)}
              placeholder="Contoh: 7123456789"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemilik Rekening</label>
            <input
              type="text"
              disabled={!canMutate}
              value={settlementHolder}
              onChange={(e) => setSettlementHolder(e.target.value)}
              placeholder="Contoh: Pesantren SKH"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
        <div className="text-xs text-slate-500">
          Perubahan konfigurasi segera berlaku untuk transaksi pembayaran berikutnya.
        </div>

        {canMutate ? (
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Gateway'}
          </button>
        ) : (
          <div className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            Mode Lihat Saja (Pimpinan)
          </div>
        )}
      </div>
    </form>
  )
}
