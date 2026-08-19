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
    <FinancePageHeader title="Payroll Guru" description="Gaji tetap bulanan dengan potongan opsional untuk sesi alfa dan sesi badal, ditarik dari rekap absensi guru." eyebrow="Submodul terpisah · ledger bersama" meta="Angka absensi datang dari sekpen, bukan diketik di sini" />
    <FinanceNav />
    <FinanceGuide
      purpose="Menghitung gaji guru dari gaji bulanan tetap, dikurangi potongan sesi alfa dan sesi badal menurut rekap absensi guru yang sudah dinyatakan final oleh sekpen."
      prerequisites={[
        'Kompensasi tiap guru sudah diisi: gaji bulanan dan tarif potongan per sesi.',
        'Rekap absensi guru bulan tersebut sudah dikunci sekpen di menu Akademik › Rekap Kinerja Guru.',
        'Checker siap menyetujui hasil perhitungan.',
      ]}
      steps={[
        'Isi kompensasi tiap guru sekali saja: gaji bulanan, potongan per sesi alfa, potongan per sesi badal.',
        'Tunggu sekpen mengunci rekap absensi bulan tersebut. Selama belum dikunci, tombol Hitung tidak aktif.',
        'Buat periode bulanan, lalu tekan Hitung. Guru yang berhak beserta jumlah sesi alfa dan badalnya ditarik sekaligus.',
        'Periksa total. Bila ada angka absensi yang keliru, minta sekpen memperbaikinya lalu tekan Hitung lagi.',
        'Minta checker menyetujui.',
      ]}
      notes={[
        'Jumlah sesi alfa dan badal tidak dapat diketik di halaman ini. Satu angka hanya boleh punya satu pemilik, dan pemiliknya sekpen.',
        'Satuannya sesi, bukan hari: shubuh, ashar, dan maghrib dihitung terpisah, sama seperti di rekap absensi.',
        'Tarif potongan 0 berarti guru dibayar penuh berapa pun sesi alfa/badalnya.',
        'Potongan tidak pernah membuat gaji jadi negatif; batas bawahnya nol.',
        'Guru yang tidak punya jadwal mengajar pada bulan itu dihitung nol sesi alfa, jadi gajinya utuh.',
        'Persetujuan mencatat kewajiban gaji; pencairan uangnya dilakukan dari halaman Payout.',
      ]}
      commonMistakes={[
        'Mengira persetujuan berarti gaji sudah dibayar. Yang terjadi baru pencatatan kewajiban.',
        'Menyetujui padahal rekap absensi sudah dikoreksi setelah perhitungan terakhir — tekan Hitung dulu, halaman ini akan memperingatkan.',
        'Memasukkan tarif potongan harian ke kolom per sesi, sehingga potongan bisa jadi tiga kali lipat.',
        'Mengisi tarif potongan padahal pesantren tidak memotong gaji — biarkan 0 supaya guru dibayar penuh.',
        'Menambah kompensasi dengan tanggal berlaku mundur, sehingga perhitungan ulang periode lama ikut berubah.',
      ]}
      glossary={[
        { term: 'Sesi', meaning: 'Satu waktu pengajian: shubuh, ashar, atau maghrib. Satu hari bisa berisi tiga sesi.' },
        { term: 'Sesi alfa', meaning: 'Sesi yang jadwalnya milik guru itu tetapi tidak diisi siapa pun.' },
        { term: 'Sesi badal', meaning: 'Sesi yang jadwalnya milik guru itu tetapi diisi guru lain sebagai pengganti.' },
        { term: 'Kunci rekap', meaning: 'Pernyataan sekpen bahwa angka absensi satu bulan sudah final dan boleh dipakai menghitung gaji.' },
        { term: 'Kompensasi', meaning: 'Gaji bulanan dan tarif potongan seorang guru, berlaku sejak tanggal tertentu.' },
        { term: 'Akrual', meaning: 'Pencatatan kewajiban gaji di pembukuan sebelum uangnya benar-benar dibayarkan.' },
      ]}
    />
    <PayrollClient data={data} />
  </main>
}
