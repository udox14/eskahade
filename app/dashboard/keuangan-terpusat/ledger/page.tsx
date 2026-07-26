import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
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
    <FinanceGuide purpose="Menyediakan jejak pembukuan terperinci untuk penelusuran dan koreksi akuntansi." prerequisites={['Siapkan dokumen sumber untuk jurnal manual.', 'Pastikan periode tanggal efektif masih terbuka.']} steps={['Filter atau cari jurnal.', 'Buka detail untuk memeriksa debit dan kredit.', 'Gunakan reversal hanya untuk jurnal manual yang salah.']} notes={['Transaksi wallet dikoreksi dari modul asal.', 'Referensi jurnal manual harus unik.', 'Reversal tidak menghapus jurnal asal.']} />
    <LedgerClient data={data} initialSearch={q} />
  </main>
}
