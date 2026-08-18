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
    <FinancePageHeader title="Payroll Guru" description="Gaji tetap bulanan dengan potongan opsional untuk hari alfa dan hari badal." eyebrow="Submodul terpisah · ledger bersama" meta="Tiap bulan hanya dua angka per guru" />
    <FinanceNav />
    <FinanceGuide
      purpose="Menghitung gaji guru dari gaji bulanan tetap, dikurangi potongan hari alfa dan hari badal bila ada."
      prerequisites={['Kompensasi tiap guru sudah diisi: gaji bulanan dan tarif potongan.', 'Checker siap menyetujui hasil perhitungan.']}
      steps={[
        'Isi kompensasi tiap guru sekali saja: gaji bulanan, potongan per hari alfa, potongan per hari badal.',
        'Buat periode bulanan, lalu tekan Hitung untuk menarik semua guru yang kompensasinya berlaku.',
        'Isi jumlah hari alfa dan hari badal per guru. Guru yang hadir penuh cukup dibiarkan nol.',
        'Periksa total, lalu minta checker menyetujui.',
      ]}
      notes={[
        'Tarif potongan 0 berarti guru dibayar penuh berapa pun hari alfa/badalnya.',
        'Potongan tidak pernah membuat gaji jadi negatif; batas bawahnya nol.',
        'Menghitung ulang tidak menghapus jumlah hari yang sudah Anda ketik.',
        'Persetujuan mencatat kewajiban gaji; pencairan uangnya dilakukan dari halaman Payout.',
      ]}
      commonMistakes={[
        'Mengira persetujuan berarti gaji sudah dibayar. Yang terjadi baru pencatatan kewajiban.',
        'Mengisi tarif potongan padahal pesantren tidak memotong gaji — biarkan 0 supaya guru dibayar penuh.',
        'Menambah kompensasi dengan tanggal berlaku mundur, sehingga perhitungan ulang periode lama ikut berubah.',
      ]}
      glossary={[
        { term: 'Hari alfa', meaning: 'Hari guru tidak mengajar tanpa keterangan.' },
        { term: 'Hari badal', meaning: 'Hari jadwal guru diisi guru lain sebagai pengganti.' },
        { term: 'Kompensasi', meaning: 'Gaji bulanan dan tarif potongan seorang guru, berlaku sejak tanggal tertentu.' },
        { term: 'Akrual', meaning: 'Pencatatan kewajiban gaji di pembukuan sebelum uangnya benar-benar dibayarkan.' },
      ]}
    />
    <PayrollClient data={data} />
  </main>
}
