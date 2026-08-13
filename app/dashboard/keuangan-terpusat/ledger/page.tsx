import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getLedgerData } from './actions'
import { LedgerClient } from './_ledger-client'

export const dynamic = 'force-dynamic'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await guardPage('/dashboard/keuangan-terpusat/ledger')
  const { q = '' } = await searchParams
  const data = await getLedgerData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Ledger & Jurnal" description="Telusuri detail debit-kredit, posting penyesuaian manual, dan reversal yang terkontrol." eyebrow={data.scope ? `Scope ${data.scope}` : 'Ledger global'} meta="Jurnal posted tidak pernah dihapus" />
    <FinanceNav />
    <FinanceGuide
      purpose="Menyediakan jejak pembukuan terperinci untuk penelusuran dan koreksi akuntansi."
      prerequisites={['Siapkan dokumen sumber untuk jurnal manual.', 'Pastikan periode tanggal efektifnya masih terbuka.', 'Pahami akun mana yang harus didebit dan dikredit sebelum mengisi.']}
      steps={[
        'Filter atau cari jurnal yang ingin ditelusuri.',
        'Buka detail untuk memeriksa seluruh baris debit dan kredit.',
        'Untuk penyesuaian, isi formulir jurnal manual sampai indikator menyatakan seimbang.',
        'Gunakan reversal hanya untuk jurnal manual yang keliru.',
      ]}
      notes={[
        'Jurnal yang sudah diposting tidak dapat diubah maupun dihapus.',
        'Transaksi yang menyentuh dompet santri dikoreksi dari modul asalnya, bukan dari sini.',
        'Setiap jurnal hanya boleh direversal satu kali.',
      ]}
      commonMistakes={[
        'Mengira reversal menghapus jurnal yang salah. Reversal menambah jurnal lawan; keduanya tetap terlihat.',
        'Memakai jurnal manual untuk memperbaiki saldo santri. Itu akan ditolak — perbaiki dari modul transaksinya.',
        'Memilih tanggal efektif di periode yang sudah ditutup, lalu bingung kenapa ditolak.',
        'Menganggap nomor referensi harus unik. Boleh dipakai ulang, tapi jadi menyulitkan penelusuran nanti.',
      ]}
      glossary={[
        FINANCE_GLOSSARY.reversal,
        FINANCE_GLOSSARY.suspense,
        { term: 'Debit & kredit', meaning: 'Dua sisi setiap jurnal. Totalnya wajib sama persis; database menolak jurnal yang tidak seimbang.' },
        { term: 'Tanggal efektif', meaning: 'Tanggal transaksi menurut pembukuan, menentukan periode mana yang terpengaruh — bukan tanggal Anda mengetiknya.' },
      ]}
    />
    <LedgerClient data={data} initialSearch={q} />
  </main>
}
