import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getFinanceControlData } from './actions'
import { FinanceControlClient } from './_control-client'

export const dynamic='force-dynamic'

export default async function FinanceControlPage(){
  await guardPage('/dashboard/keuangan-terpusat/kontrol')
  const data=await getFinanceControlData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Kontrol & Audit" description="Pantau audit trail dan ubah pengaturan runtime modul keuangan." eyebrow="Kontrol internal" meta="Akses tindakan mengikuti pemisahan bendahara dan checker"/>
    <FinanceNav/>
    <FinanceGuide
      purpose="Menyatukan kontrol operasional dan bukti audit tanpa mengekspos kunci keamanan."
      prerequisites={['Pastikan perubahan pengaturan sudah disepakati bersama pimpinan.', 'Baca pesan kesalahan event gagal sebelum mencoba kirim ulang.', 'Untuk penelusuran selisih, siapkan tanggal dan nama pelaku yang dicurigai.']}
      steps={[
        'Periksa empat indikator kontrol di bagian atas.',
        'Sesuaikan pengaturan runtime bila memang perlu berubah.',
        'Tindak lanjuti event gagal dan sesi yang mencurigakan.',
        'Checker menelusuri audit trail untuk memastikan tidak ada tindakan janggal.',
      ]}
      notes={[
        'Mengirim ulang event tidak mengubah transaksi keuangannya sama sekali.',
        'Semua perubahan di halaman ini ikut tercatat di audit trail.',
      ]}
      commonMistakes={[
        'Mengubah batas waktu pengembalian alokasi di tengah bulan, sehingga wali kehilangan kesempatan yang tadinya masih terbuka.',
        'Mengira ambang peringatan lunak akan menolak transaksi. Ambang itu hanya memunculkan penanda untuk diperiksa.',
        'Mengirim ulang event gagal berkali-kali tanpa membaca pesan kesalahannya.',
        'Memperpanjang masa berlaku instruksi top-up terlalu lama, sehingga makin banyak pembayaran terlambat yang perlu direview manual.',
      ]}
      glossary={[
        { term: 'Pengaturan runtime', meaning: 'Nilai yang mengubah perilaku modul keuangan tanpa perlu memasang ulang aplikasi.' },
        { term: 'Antrean event', meaning: 'Daftar notifikasi dan integrasi yang menunggu dikirim. Terpisah dari jurnal, jadi kegagalannya tidak mengubah pembukuan.' },
        { term: 'Audit trail', meaning: 'Catatan permanen setiap tindakan keuangan beserta kondisi sebelum dan sesudahnya.' },
        { term: 'Peringatan lunak', meaning: 'Penanda bahwa suatu angka melewati ambang wajar. Bukan penolakan — hanya minta diperiksa.' },
      ]}
    />
    <FinanceControlClient data={data}/>
  </main>
}
