import { guardPage } from '@/lib/auth/guard'
import { CredentialClient,type CredentialInventoryRow } from './_credential-client'
import { getCredentialData } from './actions'
import { FINANCE_GLOSSARY,FinanceGuide,FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'

export const dynamic='force-dynamic'

export default async function CredentialPage(){
  await guardPage('/dashboard/keuangan-terpusat/kredensial')
  const data=await getCredentialData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Kredensial" description="Pendaftaran kartu massal, integrasi reader, dan pencetakan kartu QR santri." eyebrow="Kredensial: QR Code" meta={data.scope?`Scope asrama ${data.scope} · saldo dan PIN tidak pernah menempel pada kartu`:'Saldo dan PIN tidak pernah menempel pada kartu'}/>
    <FinanceNav/>
    <FinanceGuide
      purpose="Mendaftarkan ribuan kartu santri lewat alur scan berurutan dan batch yang dapat dilanjutkan bila terputus."
      prerequisites={['Hubungkan USB reader dalam mode keyboard dan pastikan reader mengirim Enter setelah tiap scan.', 'Uji reader lebih dulu di tab Pengaturan sebelum memulai antrean panjang.', 'Izinkan akses kamera bila memakai scan QR lewat perangkat.']}
      steps={[
        'Saring dan pilih santri di tab Pilih Santri.',
        'Jalankan batch QR, atau mulai antrean RFID untuk scan satu per satu.',
        'Periksa hasilnya di tab Batch QR — batch yang terputus dapat dilanjutkan.',
        'Cetak kartu per volume PDF di tab Kartu.',
      ]}
      notes={[
        'Token QR disimpan terenkripsi; loket memvalidasi tanpa pernah menampilkan tokennya.',
        'Kartu pengganti otomatis mencabut kartu lama pemilik yang sama.',
        'Kartu tidak menyimpan saldo — setiap pencairan tetap memerlukan PIN santri.',
      ]}
      commonMistakes={[
        'Mencetak ulang kartu tanpa mencabut yang lama, sehingga dua kartu aktif untuk satu santri.',
        
        'Memulai antrean RFID tanpa menguji reader dulu, lalu semua scan tertahan karena reader tidak mengirim Enter.',
        'Memilih "Pilih semua hasil" tanpa menyaring, sehingga santri yang sudah punya kartu ikut diproses ulang.',
      ]}
      glossary={[
        { term: 'RFID', meaning: 'Kartu tempel. Nomor uniknya dibaca reader; nomor itu sendiri tidak berarti apa-apa tanpa PIN.' },
        { term: 'QR statis', meaning: 'Kode QR tercetak di kartu. Isinya token acak yang disimpan terenkripsi, bukan data santri.' },
        { term: 'Mode kredensial', meaning: 'Jenis kartu yang diterima loket. Mode transisi menerima keduanya sampai tanggal tertentu.' },
        { term: 'Batch penerbitan', meaning: 'Antrean penerbitan QR massal yang mencatat progresnya, sehingga dapat dilanjutkan bila terputus.' },
        FINANCE_GLOSSARY.makerChecker,
      ]}
    />
    <CredentialClient credentials={data.credentials as CredentialInventoryRow[]}/>
  </main>
}
