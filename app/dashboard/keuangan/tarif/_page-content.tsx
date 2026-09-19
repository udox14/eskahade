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
import {
  Tag,
  ShieldCheck,
  Wallet,
  CreditCard,
  GearSix,
  ArrowClockwise,
  Eye,
} from '@phosphor-icons/react'

interface PengaturanKeuanganContentProps {
  initialData: PengaturanKeuanganData
}

type TabKey = 'tarif' | 'pembebasan' | 'limit' | 'gateway'

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
    { key: 'gateway', label: 'Payment Gateway Duitku', icon: CreditCard },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-100">
              <GearSix className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Pengaturan Keuangan
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi tarif terversi, pembebasan biaya santri, limit buku besar uang jajan, dan gateway pembayaran.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!canMutate && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Eye className="w-4 h-4 text-amber-600" />
              <span>Akses Mode Lihat Saja ({userRole.toUpperCase()})</span>
            </div>
          )}

          <button
            type="button"
            onClick={refreshData}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
          >
            <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Internal Sub-Navigation Tabs (UI_UX_GUIDELINES #24) */}
      <div className="border-b border-slate-200/80">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
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

      {/* Tab Panels */}
      <div>
        {activeTab === 'tarif' && (
          <TarifTab
            tariffs={data.tariffs}
            academicYears={data.academicYears}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'pembebasan' && (
          <PembebasanTab
            exemptions={data.exemptions}
            academicYears={data.academicYears}
            canMutate={canMutate}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'limit' && (
          <LimitJajanTab
            globalDailyLimit={data.globalDailyLimit}
            studentLimits={data.studentLimits}
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
      </div>
    </div>
  )
}
