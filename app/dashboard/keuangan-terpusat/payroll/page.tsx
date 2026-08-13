import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getPayrollData } from './actions'
import { PayrollClient } from './_payroll-client'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  await guardPage('/dashboard/keuangan-terpusat/payroll')
  const data = await getPayrollData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Payroll Guru" description="Kelola kebijakan, kompensasi, absensi terverifikasi, perhitungan, dan akrual payroll." eyebrow="Submodul terpisah · ledger bersama" meta="Tarif mengikuti versi efektif pada periode" />
    <FinanceNav />
    <FinanceGuide
      purpose="Menghitung payroll secara konsisten dari master kompensasi dan data kehadiran yang sudah diverifikasi."
      prerequisites={['Kebijakan payroll dan kompensasi tiap guru sudah tersedia.', 'Semua sesi mengajar tercatat lengkap dengan guru terjadwal dan statusnya.', 'Checker siap memverifikasi absensi dan menyetujui batch.']}
      steps={[
        'Buat kebijakan payroll, lalu isi kompensasi tiap guru.',
        'Buat periode bulanan.',
        'Catat absensi mengajar, lalu minta checker memverifikasi setiap barisnya.',
        'Kunci absensi, hitung payroll, periksa rinciannya, baru setujui batch.',
      ]}
      notes={[
        'Sesi yang tidak tercatat tidak dihitung sebagai kehadiran maupun ketidakhadiran.',
        'Versi kebijakan lama tidak pernah ditimpa; periode lama tetap memakai versinya sendiri.',
        'Perubahan tarif dicatat sebagai baris efektif baru, bukan mengubah angka lama.',
        'Persetujuan batch mencatat kewajiban gaji; pencairan uangnya dilakukan dari halaman Payout.',
      ]}
      commonMistakes={[
        'Mengubah kompensasi guru dengan tanggal efektif mundur, sehingga periode yang sudah dihitung ikut berubah saat dihitung ulang.',
        'Mengunci absensi padahal masih ada sesi yang belum dicatat. Setelah terkunci, sesi itu tidak bisa ditambahkan lagi.',
        'Mengira persetujuan batch berarti gaji sudah dibayar. Yang terjadi baru pencatatan kewajiban.',
        'Memilih status Digantikan tanpa mengisi guru pengganti, atau mengisi pengganti yang sama dengan guru terjadwal.',
      ]}
      glossary={[
        { term: 'Periode payroll', meaning: 'Satu bulan penggajian. Kebijakan yang dipakai dikunci saat periode dibuat.' },
        { term: 'Kebijakan payroll', meaning: 'Aturan cara menghitung: apakah gaji tetap dipotong saat absen, dan berapa persen honor guru pengganti.' },
        { term: 'Kompensasi efektif', meaning: 'Gaji tetap dan tarif sesi seorang guru terhitung dari tanggal tertentu. Baris baru tidak menghapus baris lama.' },
        { term: 'Akrual', meaning: 'Pencatatan kewajiban gaji di pembukuan sebelum uangnya benar-benar dibayarkan.' },
      ]}
    />
    <PayrollClient data={data} />
  </main>
}
