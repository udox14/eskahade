import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getBillItems } from './actions'
import { TagihanClient } from './_tagihan-client'

export const dynamic = 'force-dynamic'

export default async function TagihanPage() {
  await guardPage('/dashboard/keuangan-terpusat/tagihan')
  const { items, scope } = await getBillItems()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader
      title="Tagihan"
      description="Lihat siapa yang sudah lunas, baru nyicil, dan belum bayar pada tiap item pembayaran."
      eyebrow="Piutang santri"
      meta={scope ? `Scope asrama: ${scope}` : `${items.length} item pembayaran tercatat`}
    />
    <FinanceNav />
    <FinanceGuide
      purpose="Menjawab satu pertanyaan harian bendahara: untuk item pembayaran tertentu, siapa saja yang sudah lunas, nyicil, dan belum bayar."
      prerequisites={[
        'Tagihannya sudah dibuat — otomatis lewat Tarif Layanan/SPP, atau manual di halaman Operasi.',
        'Pembayaran dicatat lewat jalur resmi (portal, loket, atau konfirmasi) agar status tagihan ikut bergerak.',
      ]}
      steps={[
        'Pilih item pembayaran, misalnya Uang Makan bulan berjalan.',
        'Baca ringkasannya: berapa santri lunas, nyicil, belum bayar, dan berapa rupiah sudah terkumpul.',
        'Buka tab status untuk melihat daftar santrinya, saring per asrama bila perlu.',
        'Unduh daftarnya bila akan ditindaklanjuti di luar sistem.',
      ]}
      notes={[
        'Status dihitung dari tagihan itu sendiri: Lunas bila terbayar penuh, Nyicil bila baru sebagian, Belum bayar bila belum ada rupiah masuk.',
        'Tagihan yang ditiadakan berstatus Ditiadakan dan tidak dihitung sebagai piutang.',
        'Halaman ini hanya membaca — pembayaran tetap dicatat lewat loket, portal, atau konfirmasi.',
        'Bendahara asrama hanya melihat santri binaannya.',
      ]}
      commonMistakes={[
        'Menyimpulkan santri menunggak padahal tagihan bulan itu memang belum digenerate.',
        'Menghitung sisa piutang dengan menjumlahkan seluruh item, termasuk yang sudah ditiadakan.',
        'Menagih dari hasil unduhan lama — angka di sini bergerak setiap ada pembayaran masuk.',
      ]}
      glossary={[
        { term: 'Item pembayaran', meaning: 'Satu jenis tagihan pada satu periode, misalnya "Uang Makan Agustus 2026". Non-SPP dibedakan lewat judulnya.' },
        { term: 'Nyicil', meaning: 'Tagihan sudah dibayar sebagian tapi belum lunas — sisanya masih tercatat sebagai piutang.' },
        { term: 'Ditiadakan', meaning: 'Tagihan dibatalkan sehingga tidak ditagihkan ke santri dan tidak dihitung dalam piutang.' },
        FINANCE_GLOSSARY.makerChecker,
      ]}
    />
    <TagihanClient items={items} scope={scope} />
  </main>
}
