import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getTransactionData } from './actions'
import { TransaksiClient } from './_transaksi-client'

export const dynamic = 'force-dynamic'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await guardPage('/dashboard/keuangan-terpusat/transaksi')
  const { q = '' } = await searchParams
  const data = await getTransactionData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Transaksi" description="Seluruh pergerakan uang pesantren, dalam bahasa sehari-hari." eyebrow="Uang masuk · uang keluar" meta="Rincian jurnal tersedia untuk bendahara dan auditor" />
    <FinanceNav />
    <FinanceGuide
      purpose="Melihat semua uang yang masuk dan keluar, dan menelusuri satu transaksi kalau ada yang perlu dicek."
      prerequisites={['Tidak ada. Halaman ini hanya menampilkan apa yang sudah tercatat dari modul lain.']}
      steps={[
        'Pilih Uang masuk atau Uang keluar, atau cari nama santri.',
        'Klik satu baris untuk melihat keterangan, nomor dokumen, dan waktu pencatatannya.',
        'Bendahara dan auditor bisa menekan Lihat jurnal untuk membuka rincian pembukuannya.',
      ]}
      notes={[
        'Transaksi tidak pernah diedit. Kalau salah, sistem membuat transaksi lawan yang membatalkannya, dan keduanya tetap terlihat.',
        'Angka di sini berasal dari modul asalnya — loket, portal ortu, payout, payroll — bukan diketik ulang di halaman ini.',
        '"Pindah antar pos" berarti uangnya tidak keluar dari pesantren, hanya berpindah peruntukan, misalnya dari saldo titipan ke tagihan SPP.',
      ]}
      commonMistakes={[
        'Mengetik transaksi harian sebagai catatan manual. Transaksi harian punya jalurnya sendiri; catatan manual hanya untuk koreksi pembukuan.',
        'Mengira baris yang sudah dibatalkan hilang dari daftar. Keduanya sengaja tetap terlihat supaya jejaknya utuh.',
      ]}
      glossary={[
        { term: 'Uang masuk', meaning: 'Uang yang benar-benar bertambah, misalnya wali mengisi saldo.' },
        { term: 'Uang keluar', meaning: 'Uang yang benar-benar berkurang, misalnya santri mengambil jajan di loket.' },
        { term: 'Pindah antar pos', meaning: 'Uang berpindah peruntukan tanpa keluar dari pesantren.' },
        { term: 'Jurnal', meaning: 'Catatan pembukuan berpasangan di balik tiap transaksi. Hanya perlu dilihat saat audit atau tutup buku.' },
      ]}
    />
    <TransaksiClient data={data} initialSearch={q} />
  </main>
}
