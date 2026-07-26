import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getBreakGlassData } from './actions'
import { BreakGlassClient } from './_break-glass-client'

export const dynamic='force-dynamic'

export default async function BreakGlassPage(){
  await guardPage('/dashboard/keuangan-terpusat/break-glass')
  const data=await getBreakGlassData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Break-glass Keuangan" description="Akses darurat berjangka untuk admin teknis yang tidak memiliki role operasional keuangan." eyebrow="Darurat · 30 menit · selalu diaudit" meta="Aktivasi dan penggunaan wajib direview checker"/>
    <FinanceNav/>
    <FinanceGuide purpose="Memberi akses sementara saat insiden teknis benar-benar menghalangi operasional keuangan." prerequisites={['Pastikan masalah tidak dapat diselesaikan bendahara berwenang.','Siapkan alasan insiden yang spesifik dan dapat diaudit.']} steps={['Admin teknis mengaktifkan akses.','Kerjakan pemulihan dalam 30 menit.','Checker mereview dan/atau mencabut akses.']} notes={['Admin dengan role keuangan native tidak boleh memakai break-glass.','Aktivasi sendiri tidak boleh direview sendiri.','Akses dapat dicabut sebelum kedaluwarsa.']}/>
    <BreakGlassClient data={data}/>
  </main>
}
