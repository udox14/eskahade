'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, ListTree } from 'lucide-react'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { DiagnosisMaster } from './diagnosis-master'
import { DiseaseReport } from './disease-report'

type Tab = 'laporan' | 'master'

export default function PenyakitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'master' ? 'master' : 'laporan'
  function changeTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'laporan') params.delete('tab')
    else params.set('tab', next)
    router.replace(`/dashboard/poskestren/penyakit?${params.toString()}`, { scroll: false })
  }
  return <div className="mx-auto max-w-7xl space-y-6 pb-24">
    <DashboardPageHeader title="Penyakit" description="Analisis kasus penyakit dan pengelolaan master diagnosis POSKESTREN." className="border-b border-slate-200 pb-4" />
    <PoskestrenTabs tabs={[{ value: 'laporan', label: 'Laporan Kasus', icon: BarChart3 }, { value: 'master', label: 'Master Diagnosis', icon: ListTree }]} active={tab} onChange={changeTab} />
    {tab === 'laporan' ? <DiseaseReport basePath="/dashboard/poskestren/penyakit" /> : <DiagnosisMaster />}
  </div>
}
