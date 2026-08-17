import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
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
      <FinanceGuide
        purpose="Menetapkan tarif SPP, Uang Makan, dan Uang Laundry secara berjenjang waktu, lalu menerbitkan tagihan bulanannya."
        prerequisites={[
          'Tarif baru sudah disepakati pimpinan beserta bulan mulai berlakunya.',
          'Santri sudah ditempatkan ke vendor makan/laundry bila ingin menagih layanan itu.',
          'Daftar santri yang dibebaskan biaya sudah dipastikan, sebelum tagihan dibuat.',
        ]}
        steps={[
          'Tetapkan bulan pertama santri mulai ditagih pada Tanggal Awal Tagihan.',
          'Tambahkan tarif beserta bulan efektifnya — tarif lama tetap tersimpan.',
          'Untuk Makan dan Laundry, jalankan Generate Tagihan Bulanan.',
          'Catat tunggakan lama atau pembebasan bila ada, lalu tandai lunas saat dibayar.',
        ]}
        notes={[
          'Mengganti tarif di tengah tahun tidak mengubah tagihan bulan yang sudah dibuat.',
          'Generate tagihan aman diklik ulang: santri yang sudah punya tagihan bulan itu dilewati.',
          'Santri yang masuk setelah tanggal awal tagihan otomatis ditagih mulai bulan masuknya.',
        ]}
        commonMistakes={[
          'Mengubah tarif bulan berjalan lalu mengira tagihan yang sudah terbit ikut berubah. Terbitkan koreksi, jangan tunggu tarifnya menyusul sendiri.',
          'Menjalankan generate tagihan sebelum penempatan vendor selesai, sehingga sebagian santri terlewat dan harus ditambah manual.',
          'Mencatat pembebasan biaya setelah tagihan terbit. Tagihannya tetap ada dan harus dibatalkan terpisah di halaman Operasi.',
          'Mengisi bulan efektif dengan bulan lampau, yang membuat riwayat tarif sulit ditelusuri.',
        ]}
        glossary={[
          FINANCE_GLOSSARY.uspp,
          { term: 'Effective-dated', meaning: 'Tarif disimpan beserta bulan mulai berlakunya. Tarif lama tidak ditimpa, sehingga tagihan bulan lampau tetap dapat dipertanggungjawabkan.' },
          { term: 'Tanggal awal tagihan', meaning: 'Bulan pertama seorang santri mulai ditagih. Santri yang masuk setelahnya mulai dari bulan masuknya sendiri.' },
          { term: 'Skip tagihan', meaning: 'Pengecualian satu bulan untuk santri tertentu, misalnya sedang pulang lama. Berbeda dari pembebasan permanen.' },
          { term: 'Tunggakan', meaning: 'Kewajiban bulan lampau yang dicatat manual agar ikut terhitung, biasanya warisan pencatatan sebelum sistem ini.' },
        ]}
      />
      <TarifLayananClient
        initialData={{ SPP: spp, MAKAN: makan, LAUNDRY: laundry }}
        exempted={exempted}
        bebasTahunan={bebasTahunan}
        skip={{ MAKAN: skipMakan, LAUNDRY: skipLaundry }}
      />
    </main>
  )
}
