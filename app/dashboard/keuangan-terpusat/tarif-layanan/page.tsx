import { guardPage } from '@/lib/auth/guard'
import { FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getTarifLayananData, getExemptionData, getBebasTahunanData, getSkipData } from './actions'
import { TarifLayananClient } from './_page-content'

export const dynamic = 'force-dynamic'

export default async function TarifLayananPage() {
  await guardPage('/dashboard/keuangan-terpusat/tarif-layanan')

  const [spp, makan, laundry, exempted, bebasTahunan, skipMakan, skipLaundry] = await Promise.all([
    getTarifLayananData('SPP'),
    getTarifLayananData('MAKAN'),
    getTarifLayananData('LAUNDRY'),
    getExemptionData(),
    getBebasTahunanData(),
    getSkipData('MAKAN'),
    getSkipData('LAUNDRY'),
  ])

  return (
    <main className="space-y-4 sm:space-y-5">
      <FinancePageHeader
        title="Tarif Layanan"
        description="Atur tarif SPP, Uang Makan, dan Uang Laundry — satu sistem effective-dated, tidak menimpa tagihan bulan yang sudah dibuat."
        eyebrow="Bendahara pusat"
        meta="Ganti tarif mid-tahun tidak memengaruhi bulan yang sudah lewat"
      />
      <FinanceNav />
      <TarifLayananClient
        initialData={{ SPP: spp, MAKAN: makan, LAUNDRY: laundry }}
        exempted={exempted}
        bebasTahunan={bebasTahunan}
        skip={{ MAKAN: skipMakan, LAUNDRY: skipLaundry }}
      />
    </main>
  )
}
