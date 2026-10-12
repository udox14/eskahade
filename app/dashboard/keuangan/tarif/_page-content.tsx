// app/dashboard/keuangan/tarif/_page-content.tsx
// Halaman Pengaturan Keuangan Terpadu Pesantren
// Menghilangkan dekorasi berlebih pada header, menyelaraskan tipografi, dan menambahkan tab Kop & Cetak.

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getPengaturanKeuanganData,
  type PengaturanKeuanganData,
} from './actions'
import TarifTab from './tarif-tab'
import PembebasanTab from './pembebasan-tab'
import LimitJajanTab from './limit-jajan-tab'
import GatewayTab from './gateway-tab'
import KopTab from './kop-tab'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  Tag,
  ShieldCheck,
  Wallet,
  CreditCard,
  Printer,
  ArrowClockwise,
  Eye,
} from '@phosphor-icons/react'

interface PengaturanKeuanganContentProps {
  initialData: PengaturanKeuanganData
}

type TabKey = 'tarif' | 'pembebasan' | 'limit' | 'gateway' | 'kop'

export default function PengaturanKeuanganContent({
  initialData,
}: PengaturanKeuanganContentProps) {
  const [data, setData] = useState<PengaturanKeuanganData>(initialData)
  const [activeTab, setActiveTab] = useState<TabKey>('tarif')
  const [isPending, startTransition] = useTransition()

  const refreshData = () => {
    startTransition(async () => {
      try {
        const next = await getPengaturanKeuanganData()
        setData(next)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyegarkan data pengaturan.')
      }
    })
  }

  const canMutate = data.userPermissions.canMutate
  const userRole = data.userPermissions.role

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Tag; badge?: number }> = [
    { key: 'tarif', label: 'Tarif & Cicilan', icon: Tag, badge: data.tariffs.length },
    { key: 'pembebasan', label: 'Pembebasan Biaya', icon: ShieldCheck, badge: data.exemptions.filter(e => e.status === 'ACTIVE').length },
    { key: 'limit', label: 'Limit Uang Jajan', icon: Wallet },
    { key: 'gateway', label: 'BRIVA & Koperasi', icon: CreditCard },
    { key: 'kop', label: 'Kop & Cetak', icon: Printer },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Standard Page Header (Matching existing application pattern without decorative icon) */}
      <DashboardPageHeader
        title="Pengaturan Keuangan"
        description="Konfigurasi tarif terversi, pembebasan biaya santri, limit buku besar uang jajan, gateway pembayaran, dan profil kop cetak resmi."
        action={
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {!canMutate && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Eye className="w-4 h-4 text-amber-600" />
                <span>Mode Lihat Saja ({userRole.toUpperCase()})</span>
              </div>
            )}

            <button
              type="button"
              onClick={refreshData}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
            >
              <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" />
              <span>Segarkan</span>
            </button>
          </div>
        }
      />

      {/* 2. Internal Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} weight={isActive ? 'bold' : 'regular'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-emerald-200/70 text-emerald-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Tab Panels */}
      <div>
        {activeTab === 'tarif' && (
          <TarifTab
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
            globalDailyLimit={data.globalDailyLimit}
            initialStudentLimits={data.studentLimits}
            initialPagination={data.studentLimitsPagination}
            initialAsramaList={data.asramaList}
            initialKelasList={data.kelasList}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'gateway' && (
          <GatewayTab
            gatewayConfig={data.gatewayConfig}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'kop' && (
          <KopTab
            initialProfiles={data.printSettings.profiles}
            initialConfigs={data.printSettings.configs}
            canMutate={canMutate}
          />
        )}
      </div>
    </div>
  )
}
