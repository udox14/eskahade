'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { saveGatewaySettingsAction, type MaskedGatewaySettings } from './actions'
import {
  CreditCard,
  Lock,
  Check,
  ShieldCheck,
  Bank,
  CheckCircle,
  Buildings,
  Info,
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

  // Form State
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    gatewayConfig.environment
  )
  const [partnerServiceId, setPartnerServiceId] = useState(
    gatewayConfig.partnerServiceId
  )
  const [cooperativeAdminFee, setCooperativeAdminFee] = useState<number>(
    gatewayConfig.cooperativeAdminFee || 2000
  )

  // Settlement / Collection Account
  const [settlementBank, setSettlementBank] = useState(
    gatewayConfig.settlementDestinationBank || 'Bank BRI'
  )
  const [settlementAccount, setSettlementAccount] = useState(
    gatewayConfig.settlementDestinationAccount
  )
  const [settlementHolder, setSettlementHolder] = useState(
    gatewayConfig.settlementAccountHolder || 'Koperasi Eskahade'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const toastId = toast.loading('Menyimpan pengaturan BRI & Koperasi...')

    const res = await saveGatewaySettingsAction({
      partnerServiceId: partnerServiceId.trim(),
      cooperativeAdminFee: Number(cooperativeAdminFee),
      settlementDestinationBank: settlementBank.trim(),
      settlementDestinationAccount: settlementAccount.trim(),
      settlementAccountHolder: settlementHolder.trim(),
    })

    setIsSaving(false)
    toast.dismiss(toastId)

    if (res.success) {
      toast.success('Pengaturan integrasi BRI & Koperasi berhasil disimpan.')
      onRefresh()
    } else {
      toast.error('Gagal menyimpan pengaturan', {
        description: res.error || 'Terjadi kesalahan sistem.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Strict Security & Cloudflare Secrets Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" weight="bold" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-slate-100 flex items-center gap-2">
            Isolasi Kredensial & Keamanan Protokol Bank BRI
          </div>
          <p className="text-slate-300 leading-relaxed">
            Kredensial resmi BRI (<code className="font-mono text-emerald-300">Client ID</code>, <code className="font-mono text-emerald-300">Client Secret</code>, dan <code className="font-mono text-emerald-300">Private Key RSA</code>) dikelola ketat melalui <span className="font-semibold text-white">Cloudflare Secrets</span> di server dan tidak pernah disimpan dalam database D1 maupun dibocorkan ke client browser.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Konfigurasi BRIVA Institusi */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" weight="bold" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Virtual Account BRI (BRIVA) Institusi
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Provider Aktif: BRI
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mode Lingkungan (Environment)
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
              <span className={`w-2.5 h-2.5 rounded-full ${environment === 'production' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span className="font-semibold">{environment === 'production' ? 'Production (Live)' : 'Sandbox (Testing)'}</span>
              <span className="text-[11px] text-slate-400 ml-auto">Terkontrol oleh Deployment</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Environment BRI ditentukan melalui konfigurasi runtime Cloudflare (fail-closed) dan tidak dapat dialihkan ke production dari antarmuka ini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Partner Service ID Institusi BRI
            </label>
            <input
              type="text"
              disabled={!canMutate}
              value={partnerServiceId}
              onChange={(e) => setPartnerServiceId(e.target.value)}
              placeholder="Contoh: 8888 (Kode institusi Koperasi dari BRI)"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Partner Service ID adalah identitas partner institusi Koperasi di BRI. Nomor BRIVA santri dibentuk dari kombinasi konfigurasi ini dan customer number santri di boundary adapter BRI.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Status Fixed BRIVA Santri:</span>
              <span className="font-mono font-bold text-emerald-700">
                {gatewayConfig.totalFixedVaRegistered} Santri Aktif
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Setiap santri billable memiliki tepat 1 nomor Fixed BRIVA permanen unik. Santri AL-BAGHORY (bebas tagihan penduduk setempat) tidak memiliki VA secara sistematis.
            </p>
          </div>
        </div>

        {/* Card 2: Biaya Administrasi Koperasi */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" weight="bold" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Biaya Administrasi Koperasi (Hak Koperasi)
                </h3>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominal Biaya Admin Koperasi per Checkout (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  disabled={!canMutate}
                  min={0}
                  step={500}
                  value={cooperativeAdminFee}
                  onChange={(e) => setCooperativeAdminFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0" weight="bold" />
                Pemisahan Hak Dana Tegas
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Biaya administrasi koperasi merupakan <span className="font-semibold">pendapatan operasional Koperasi Eskahade</span>, bukan fee bank BRI dan <span className="font-semibold">tidak disalurkan</span> ke Pesantren, Katering, atau Laundry. Dicatat secara append-only pada buku besar pendapatan koperasi (<code className="font-mono text-emerald-900">finance_cooperative_income</code>).
              </p>
            </div>
          </div>

          {/* Card 3: Rekening Penampungan Koperasi BRI */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bank className="w-4 h-4 text-emerald-600" weight="bold" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rekening Penampungan Koperasi BRI (Collection)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Penampungan
                </label>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={settlementBank}
                  onChange={(e) => setSettlementBank(e.target.value)}
                  placeholder="Bank BRI"
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Rekening Koperasi
                </label>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={settlementAccount}
                  onChange={(e) => setSettlementAccount(e.target.value)}
                  placeholder="Nomor rekening penampungan Koperasi"
                  className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Atas Nama Pemilik Rekening
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={settlementHolder}
                onChange={(e) => setSettlementHolder(e.target.value)}
                placeholder="Koperasi Eskahade"
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tombol Simpan */}
      {canMutate && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan BRI & Koperasi'}
          </button>
        </div>
      )}
    </form>
  )
}
