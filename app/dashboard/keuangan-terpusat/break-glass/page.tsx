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
    <FinanceGuide
      purpose="Memberi akses sementara saat insiden teknis benar-benar menghalangi operasional keuangan."
      prerequisites={['Pastikan masalahnya memang tidak dapat diselesaikan bendahara berwenang.', 'Coba hubungi bendahara lebih dulu — break-glass adalah pilihan terakhir.', 'Siapkan alasan insiden yang spesifik dan dapat diaudit.']}
      steps={[
        'Admin teknis mengaktifkan akses beserta alasan insiden.',
        'Kerjakan pemulihan dalam 30 menit — akses berakhir otomatis.',
        'Cabut akses segera setelah selesai, jangan tunggu kedaluwarsa.',
        'Checker Dewan Santri meninjau aktivasi dan tindakan yang dilakukan.',
      ]}
      notes={[
        'Admin yang sudah punya role keuangan sendiri tidak boleh memakai break-glass.',
        'Aktivasi sendiri tidak boleh direview oleh diri sendiri.',
        'Seluruh tindakan selama akses aktif tercatat di audit log.',
      ]}
      commonMistakes={[
        'Memakai break-glass untuk pekerjaan rutin yang sebenarnya bisa menunggu bendahara.',
        'Menulis alasan yang terlalu umum seperti "perbaikan sistem". Checker perlu tahu insiden apa dan apa dampaknya.',
        'Membiarkan akses menyala sampai kedaluwarsa sendiri padahal pekerjaan sudah selesai.',
        'Lupa memberi tahu checker, sehingga aktivasi menggantung tanpa review.',
      ]}
      glossary={[
        { term: 'Break-glass', meaning: 'Akses darurat berjangka yang melewati pembagian kewenangan normal, dengan ganti rugi berupa pengawasan penuh sesudahnya.' },
        { term: 'Admin teknis', meaning: 'Pemegang role admin yang tidak punya role keuangan apa pun. Hanya mereka yang boleh mengaktifkan break-glass.' },
        { term: 'Review checker', meaning: 'Peninjauan wajib oleh Dewan Santri bidang bendahara atas setiap aktivasi, termasuk yang sudah berakhir.' },
      ]}
    />
    <BreakGlassClient data={data}/>
  </main>
}
