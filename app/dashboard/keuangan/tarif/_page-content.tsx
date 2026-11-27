// app/dashboard/keuangan/tarif/_page-content.tsx
// Halaman Pengaturan Keuangan Terpadu Pesantren

'use client'

import React, { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getPengaturanKeuanganData,
  type PengaturanKeuanganData,
} from './actions'
import TarifTab from './tarif-tab'
import PembebasanTab from './pembebasan-tab'
import LimitJajanTab from './limit-jajan-tab'
import GatewayTab from './gateway-tab'
import PaymentChannelTab from './payment-channel-tab'
import KopTab from './kop-tab'
import {
  Tag,
  ShieldCheck,
  Wallet,
  CreditCard,
  Printer,
  ArrowClockwise,
  Eye,
  Bank,
} from '@phosphor-icons/react'

interface PengaturanKeuanganContentProps {
  initialData: PengaturanKeuanganData
}

type TabKey = 'tarif' | 'pembebasan' | 'limit' | 'jalur' | 'gateway' | 'kop'

export default function PengaturanKeuanganContent({
  initialData,
}: PengaturanKeuanganContentProps) {
  const [data, setData] = useState<PengaturanKeuanganData>(initialData)
  const [refreshSeq, setRefreshSeq] = useState(0)
  // Peran Koperasi hanya mengelola Jalur Pembayaran & BRIVA/Koperasi; buka tab itu lebih dulu.
  const [activeTab, setActiveTab] = useState<TabKey>(
    !initialData.userPermissions.canMutate && initialData.userPermissions.canConfigureKoperasi
      ? 'jalur'
      : 'tarif'
  )
  const [isPending, startTransition] = useTransition()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const refreshData = () => {
    startTransition(async () => {
      try {
        const next = await getPengaturanKeuanganData()
        setData(next)
        setRefreshSeq((n) => n + 1)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyegarkan data pengaturan.')
      }
    })
  }

  const canMutate = data.userPermissions.canMutate
  const canConfigureKoperasi = data.userPermissions.canConfigureKoperasi
  const userRole = data.userPermissions.role

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Tag; badge?: number }> = [
    { key: 'tarif', label: 'Tarif & Cicilan', icon: Tag, badge: data.tariffs.length },
    {
      key: 'pembebasan',
      label: 'Pembebasan Biaya',
      icon: ShieldCheck,
      badge: data.exemptions.filter((e) => e.status === 'ACTIVE').length,
    },
    { key: 'limit', label: 'Limit Uang Jajan', icon: Wallet },
    { key: 'jalur', label: 'Jalur Pembayaran', icon: Bank },
    { key: 'gateway', label: 'BRIVA & Koperasi', icon: CreditCard },
    { key: 'kop', label: 'Kop & Cetak', icon: Printer },
  ]

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = tabs.length - 1
    if (nextIdx !== null) {
      e.preventDefault()
      tabRefs.current[nextIdx]?.focus()
    }
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* 1. Header — Segarkan sejajar di kanan judul pada mobile & desktop */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem] text-balance">
            Pengaturan Keuangan
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {!canMutate && (
              <div className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                <Eye className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                <span>
                  {canConfigureKoperasi
                    ? 'Tarif, pembebasan, limit & kop: lihat saja'
                    : `Mode Lihat Saja (${userRole.toUpperCase()})`}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={refreshData}
              disabled={isPending}
              aria-label="Segarkan pengaturan keuangan"
              className="inline-flex min-h-[40px] sm:min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ArrowClockwise
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isPending ? 'animate-spin' : ''}`}
                weight="bold"
                aria-hidden="true"
              />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        <p className="text-sm leading-5 text-slate-500 text-pretty">
          Konfigurasi tarif terversi, pembebasan biaya santri, limit uang jajan, jalur pembayaran, BRIVA, dan profil kop cetak resmi.
        </p>

        {!canMutate && (
          <div className="md:hidden inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              {canConfigureKoperasi
                ? 'Tarif, pembebasan, limit & kop: lihat saja'
                : `Mode Lihat Saja (${userRole.toUpperCase()})`}
            </span>
          </div>
        )}
      </header>

      {/* 2. Accessible Underline Tabs (tanpa scrollbar tebal di mobile) */}
      <div className="border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Kategori pengaturan keuangan"
          className="-mb-px flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab, idx) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[idx] = el
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => setActiveTab(tab.key)}
                className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}
                  weight={isActive ? 'bold' : 'regular'}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      isActive ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-t-full bg-emerald-600" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Tab Panels */}
      <div aria-busy={isPending} className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        {activeTab === 'tarif' && (
          <TarifTab
            key={`tarif-${refreshSeq}`}
            tariffs={data.tariffs}
            tariffOverrides={data.tariffOverrides}
            koperasiCutover={data.koperasiCutover}
            academicYears={data.academicYears}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'pembebasan' && (
          <PembebasanTab
            exemptions={data.exemptions}
            academicYears={data.academicYears}
            legacySppCount={data.legacySppCount}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'limit' && (
          <LimitJajanTab
            key={`limit-${refreshSeq}`}
            globalDailyLimit={data.globalDailyLimit}
            initialStudentLimits={data.studentLimits}
            initialPagination={data.studentLimitsPagination}
            initialAsramaList={data.asramaList}
            initialKelasList={data.kelasList}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'jalur' && (
          <PaymentChannelTab canMutate={canConfigureKoperasi} refreshSeq={refreshSeq} />
        )}

        {activeTab === 'gateway' && (
          <GatewayTab
            key={`gateway-${refreshSeq}`}
            gatewayConfig={data.gatewayConfig}
            canMutate={canConfigureKoperasi}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'kop' && (
          <KopTab
            key={`kop-${refreshSeq}`}
            initialProfiles={data.printSettings.profiles}
            initialConfigs={data.printSettings.configs}
            canMutate={canMutate}
          />
        )}
      </div>
    </div>
  )
}
