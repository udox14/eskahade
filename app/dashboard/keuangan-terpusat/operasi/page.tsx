import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getOperationsData } from './actions'
import { OperationsClient } from './_operations-client'

export const dynamic = 'force-dynamic'

export default async function OperationsPage() {
  await guardPage('/dashboard/keuangan-terpusat/operasi')
  const data = await getOperationsData()

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader
      title="Operasi & Rekonsiliasi"
      description="Kendalikan tagihan, mutasi bank, settlement gateway, dan tutup buku dari satu workspace."
      eyebrow="Bendahara pusat"
      meta="Selesaikan pengecualian sebelum menutup periode"
    />
    <FinanceNav />
    <FinanceGuide
      purpose="Menjaga kesesuaian catatan aplikasi, settlement gateway, mutasi rekening, dan periode pembukuan."
      prerequisites={['Unduh mutasi resmi dari rekening utama.', 'Siapkan referensi dan tanggal settlement dari dashboard gateway.', 'Pastikan payout gagal sudah ditindaklanjuti di halaman Payout.']}
      steps={[
        'Bereskan antrean pengecualian: review top-up terlambat.',
        'Impor mutasi bank, lalu cocokkan baris yang belum terjelaskan ke jurnal.',
        'Posting settlement gateway sesuai bukti pencairan.',
        'Buka tab Tutup buku, penuhi seluruh checklist, baru kunci periode.',
      ]}
      notes={[
        'Jangan menutup periode jika masih ada selisih — checklist akan menahannya.',
        'Reopen membutuhkan dua persetujuan berbeda dan hanya berlaku sekali pakai.',
        'Semua review manual tercatat di audit log beserta nama Anda.',
      ]}
      commonMistakes={[
        'Menganggap mutasi sudah beres karena berstatus cocok. Pencocokan otomatis hanya jalan untuk pasangan satu-ke-satu; sisanya wajib diperiksa manual.',
        'Memakai nomor referensi settlement yang sama untuk pencairan berbeda. Sistem membedakan berdasarkan isi, tapi catatan Anda ikut membingungkan.',
        'Menyelesaikan review top-up terlambat tanpa mencocokkan referensi provider ke mutasi rekening.',
        'Membuat tagihan SPP untuk santri bebas SPP — akan ditolak, tapi sering diulang karena NIS-nya salah ketik.',
      ]}
      glossary={[
        FINANCE_GLOSSARY.settlement,
        FINANCE_GLOSSARY.suspense,
        FINANCE_GLOSSARY.uspp,
        { term: 'Tutup buku', meaning: 'Mengunci periode sehingga tidak ada jurnal baru yang boleh masuk dengan tanggal efektif di dalamnya.' },
        { term: 'Mutasi belum cocok', meaning: 'Baris rekening koran yang belum dikaitkan ke jurnal mana pun — artinya ada uang bergerak yang belum dijelaskan.' },
      ]}
    />
    <OperationsClient data={data} />
  </main>
}
