import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getAllocationData } from './actions'
import { AllocationClient } from './_allocation-client'

export const dynamic = 'force-dynamic'

export default async function AllocationPage() {
  await guardPage('/dashboard/keuangan-terpusat/alokasi')
  const data = await getAllocationData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Alokasi Dana" description="Telusuri perpindahan Titipan ke kebutuhan santri dan kembalikan dana yang belum digunakan." eyebrow={data.scope ? `Scope ${data.scope}` : 'Scope global'} meta="Return mengikuti cutoff dan saldo aktual" />
    <FinanceNav />
    <FinanceGuide
      purpose="Memastikan dana Titipan bergerak ke tujuan yang benar dan sisa yang sah dapat dikembalikan."
      prerequisites={['Pastikan pengelola layanan belum mencairkan dananya.', 'Periksa cutoff pengembalian dan saldo dompet tujuan.', 'Konfirmasi permintaan pengembalian datang dari wali utama.']}
      steps={[
        'Cari alokasi berdasarkan nama santri, NIS, atau referensi tagihan.',
        'Buka detail untuk memeriksa status, cutoff, dan saldo tujuan.',
        'Kembalikan alokasi yang masih memenuhi syarat.',
      ]}
      notes={[
        'Alokasi tagihan (SPP, USPP, Non-SPP) tidak dapat dikembalikan dari halaman ini.',
        'Pengembalian menambah jurnal lawan dan tidak menghapus jurnal alokasi aslinya.',
        'Saldo dompet tujuan tidak boleh menjadi negatif — database menolaknya.',
      ]}
      commonMistakes={[
        'Mengembalikan alokasi Makan setelah dapur sudah memakai dananya. Cek dulu ke pengelola, karena saldo dompet tidak otomatis mencerminkan pemakaian fisik.',
        'Mengira pengembalian membatalkan tagihan. Untuk tagihan yang keliru, batalkan tagihannya di halaman Operasi.',
        'Menunggu sampai lewat cutoff. Setelah cutoff, dana terkunci di tujuan dan tidak bisa ditarik dari sini.',
      ]}
      glossary={[
        FINANCE_GLOSSARY.titipan,
        FINANCE_GLOSSARY.cutoff,
        { term: 'Reserved', meaning: 'Dana sudah disisihkan untuk suatu tujuan, tapi layanan belum menagihnya. Masih bisa dikembalikan.' },
        { term: 'Committed', meaning: 'Dana sudah menjadi hak tujuan. Untuk Makan/Laundry/Jajan masih bisa dikembalikan selama belum lewat cutoff.' },
        { term: 'Disbursed', meaning: 'Dana sudah dicairkan ke pengelola. Tidak dapat dikembalikan.' },
      ]}
    />
    <AllocationClient data={data} />
  </main>
}
