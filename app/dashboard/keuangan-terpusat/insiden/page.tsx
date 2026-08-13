import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getIncidentData } from './actions'
import { IncidentClient } from './_incident-client'

export const dynamic = 'force-dynamic'

export default async function IncidentPage() {
  await guardPage('/dashboard/keuangan-terpusat/insiden')
  const data = await getIncidentData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Incident Keuangan" description="Aktifkan jalur penerimaan darurat dengan dual control dan catat setiap bukti ke ledger." eyebrow={data.scope ? `Scope ${data.scope}` : 'Kontrol pusat'} meta="Maksimal 24 jam · seluruh tindakan diaudit" />
    <FinanceNav />
    <FinanceGuide
      purpose="Menjaga operasional penerimaan saat jalur normal terganggu tanpa mengorbankan kontrol dan audit."
      prerequisites={['Pengusul Bendahara dan penyetuju harus dua orang berbeda.', 'Tentukan channel dan durasi insiden — maksimal 24 jam.', 'Penerimaan tunai wajib memakai shift kas yang masih terbuka.']}
      steps={[
        'Checker mengaktifkan incident beserta alasan dan masa berlakunya.',
        'Petugas mencatat tiap penerimaan dan menerbitkan nomor bukti.',
        'Serahkan bukti ke wali sebagai tanda terima.',
        'Bendahara menutup incident setelah jalur normal pulih.',
      ]}
      notes={[
        'Transfer darurat wajib memiliki referensi bank yang bisa ditelusuri.',
        'Dua incident tidak boleh tumpang tindih waktunya.',
        'Saldo langsung masuk ke dompet Titipan santri dan tidak dapat dihapus.',
      ]}
      commonMistakes={[
        'Mencatat penerimaan sebelum uang benar-benar diterima. Saldo santri langsung bertambah dan koreksinya harus lewat jurnal.',
        'Memakai nomor referensi yang sama untuk dua penerimaan berbeda. Yang kedua akan dianggap kiriman ulang bila nominalnya juga sama.',
        'Membiarkan incident tetap terbuka setelah gateway pulih. Tutup segera agar jalur darurat tidak jadi kebiasaan.',
        'Lupa menyerahkan nomor bukti ke wali, sehingga tidak ada pegangan bila terjadi selisih.',
      ]}
      glossary={[
        FINANCE_GLOSSARY.titipan,
        { term: 'Incident mode', meaning: 'Jendela waktu terbatas ketika penerimaan dana boleh dicatat manual karena jalur pembayaran normal terganggu.' },
        { term: 'Channel', meaning: 'Cara uang diterima selama incident: tunai lewat loket, atau transfer darurat ke rekening pesantren.' },
        { term: 'Nomor bukti', meaning: 'Nomor yang terbit otomatis untuk tiap penerimaan; menjadi tanda terima wali sekaligus jejak audit.' },
      ]}
    />
    <IncidentClient data={data} />
  </main>
}
