'use client'

import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileSpreadsheet, FileText, Printer, Users } from 'lucide-react'

import { DashboardPageHeader } from '@/components/dashboard/page-header'

import { MonthlyReport, PayrollReport } from '../laporan/_page-content'

type View = 'menu' | 'laporan-bulanan' | 'penggajian'

const MENU_ITEMS: Array<{
  view: Exclude<View, 'menu'>
  label: string
  description: string
  icon: typeof FileText
}> = [
  {
    view: 'laporan-bulanan',
    label: 'Laporan Bulanan POSKESTREN',
    description: 'Rekap layanan pemeriksaan, program preventif, obat, stok, dan keuangan per periode.',
    icon: FileText,
  },
  {
    view: 'penggajian',
    label: 'Laporan Penggajian POSKESTREN',
    description: 'Rekap honor tenaga medis dan gaji karyawan berdasarkan periode yang dipilih.',
    icon: Users,
  },
]

function isView(value: string | null): value is View {
  return value === 'laporan-bulanan' || value === 'penggajian'
}

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date()).slice(0, 7)
}

export default function CetakPoskestrenPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialView = searchParams.get('tab')
  const view: View = isView(initialView) ? initialView : 'menu'

  function changeView(nextView: View) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextView === 'menu') {
      params.delete('tab')
      params.delete('periode')
    } else {
      params.set('tab', nextView)
    }
    const query = params.toString()
    router.replace(`/dashboard/poskestren/cetak${query ? `?${query}` : ''}`, { scroll: false })
  }

  function changePeriod(nextPeriod: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periode', nextPeriod)
    router.replace(`/dashboard/poskestren/cetak?${params.toString()}`, { scroll: false })
  }

  const period = searchParams.get('periode') || currentMonth()

  if (view === 'laporan-bulanan') {
    return (
      <ReportFrame period={period} onPeriodChange={changePeriod} onBack={() => changeView('menu')}>
        <MonthlyReport month={period} />
      </ReportFrame>
    )
  }

  if (view === 'penggajian') {
    return (
      <ReportFrame period={period} onPeriodChange={changePeriod} onBack={() => changeView('menu')}>
        <PayrollReport month={period} />
      </ReportFrame>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <DashboardPageHeader
        title="Cetak Administrasi POSKESTREN"
        description="Pilih dokumen laporan dan administrasi POSKESTREN yang akan dicetak atau diekspor."
        className="border-b border-slate-200 pb-4"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => changeView(item.view)}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-emerald-500 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 transition-colors group-hover:bg-emerald-100">
                  <Icon className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{item.label}</p>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                      <Printer className="h-3 w-3" />
                      <FileSpreadsheet className="h-3 w-3" />
                      Cetak / Excel
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReportFrame({
  period,
  onPeriodChange,
  onBack,
  children,
}: {
  period: string
  onPeriodChange: (period: string) => void
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="no-print flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu Cetak
        </button>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
          Periode
          <input
            type="month"
            value={period}
            onChange={event => onPeriodChange(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3"
          />
        </label>
      </div>
      {children}
    </div>
  )
}
