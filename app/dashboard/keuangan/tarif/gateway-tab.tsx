'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { saveGatewaySettingsAction, type MaskedGatewaySettings } from './actions'
import { CreditCard, Lock, ShieldCheck, Bank, Info } from '@phosphor-icons/react'

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

  const environment = gatewayConfig.environment
  const [partnerServiceId, setPartnerServiceId] = useState(gatewayConfig.partnerServiceId)
  // Fix bug: pakai ?? 0 agar biaya Rp0 (gratis) tidak tertimpa menjadi 2000
  const [adminFeeInput, setAdminFeeInput] = useState<string>(
    String(gatewayConfig.cooperativeAdminFee ?? 0)
  )

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
    const cooperativeAdminFee = Math.max(0, parseInt(adminFeeInput.replace(/\D/g, ''), 10) || 0)

    setIsSaving(true)
    const toastId = toast.loading('Menyimpan pengaturan BRI & Koperasi…')

    const res = await saveGatewaySettingsAction({
      partnerServiceId: partnerServiceId.trim(),
      cooperativeAdminFee,
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Banner Keamanan Kredensial */}
      <div className="flex items-start gap-3 rounded-xl bg-slate-900 p-4 text-white shadow-2xs">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" weight="bold" aria-hidden="true" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-slate-100">Keamanan Kredensial Bank BRI</div>
          <p className="leading-relaxed text-slate-300">
            Kredensial resmi BRI (Client ID, Client Secret, dan kunci privat) tersimpan terisolasi di server
            Cloudflare Secrets dan tidak pernah disimpan di database maupun ditampilkan ke browser.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Card 1: Konfigurasi BRIVA Institusi */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Virtual Account BRI (BRIVA)
              </h3>
            </div>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              Bank Aktif: BRI
            </span>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Mode Integrasi</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  environment === 'production' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="font-semibold">
                {environment === 'production' ? 'Production (Aktif)' : 'Sandbox (Uji Coba)'}
              </span>
              <span className="ml-auto text-[11px] text-slate-400">Diatur di server</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Peralihan ke mode Production dikunci di konfigurasi server dan tidak dapat diubah dari layar ini.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Partner Service ID Institusi BRI
            </label>
            <input
              type="text"
              disabled={!canMutate}
              value={partnerServiceId}
              onChange={(e) => setPartnerServiceId(e.target.value)}
              placeholder="Contoh: 8888 (Kode institusi Koperasi dari BRI)"
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Kode institusi resmi dari BRI yang menjadi awalan nomor Fixed BRIVA tiap santri.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Fixed BRIVA Terdaftar</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                {gatewayConfig.totalFixedVaRegistered} santri aktif
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Setiap santri wajib tagihan memiliki 1 nomor Fixed BRIVA permanen. Santri asrama bebas tagihan
              (AL-BAGHORY) tidak diterbitkan nomor VA.
            </p>
          </div>
        </section>

        {/* Card 2 & 3 */}
        <div className="space-y-5">
          {/* Biaya Admin Koperasi BRIVA */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Biaya Admin Koperasi (BRIVA)
              </h3>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Nominal Biaya Admin per Transaksi BRIVA (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={!canMutate}
                  value={adminFeeInput}
                  onChange={(e) => setAdminFeeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Isi 0 jika tanpa biaya admin Koperasi. Biaya layanan bank BRI mengikuti ketentuan bank dan terpisah dari
                biaya ini.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-950">
                <Info className="h-4 w-4 shrink-0 text-emerald-700" weight="bold" aria-hidden="true" />
                <span>Pemisahan Hak Dana</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                Biaya admin Koperasi merupakan <strong>pendapatan operasional Koperasi</strong>, bukan biaya bank BRI,
                dan <strong>tidak disalurkan</strong> ke Pesantren, Katering, maupun Laundry.
              </p>
            </div>
          </section>

          {/* Rekening Penampungan */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bank className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Rekening Penampungan Koperasi BRI
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Bank</label>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={settlementBank}
                  onChange={(e) => setSettlementBank(e.target.value)}
                  placeholder="Bank BRI"
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Nomor Rekening Koperasi</label>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={!canMutate}
                  value={settlementAccount}
                  onChange={(e) => setSettlementAccount(e.target.value)}
                  placeholder="Nomor rekening penampungan"
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Atas Nama Pemilik Rekening</label>
              <input
                type="text"
                disabled={!canMutate}
                value={settlementHolder}
                onChange={(e) => setSettlementHolder(e.target.value)}
                placeholder="Koperasi Eskahade"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </section>
        </div>
      </div>

      {canMutate && (
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-[40px] rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Menyimpan…' : 'Simpan Pengaturan BRI & Koperasi'}
          </button>
        </div>
      )}
    </form>
  )
}
