import { requireFinanceAccess } from '@/lib/finance/access'
import { CredentialClient,type CredentialInventoryRow } from './_credential-client'
import { getCredentialData } from './actions'
import { FinanceGuide,FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'

export const dynamic='force-dynamic'

export default async function CredentialPage(){
  await requireFinanceAccess('CARDS')
  const data=await getCredentialData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Kartu QR Santri" description="Pendaftaran kartu massal, integrasi reader, dan pencetakan kartu QR santri." eyebrow="Kredensial: QR Code" meta={data.scope?`Scope asrama ${data.scope} · saldo dan PIN tidak pernah menempel pada kartu`:'Saldo dan PIN tidak pernah menempel pada kartu'}/>
    <FinanceNav/>
    <FinanceGuide
      purpose="Menerbitkan kartu QR santri secara massal, dalam batch yang dapat dilanjutkan bila terputus."
      prerequisites={['Uji scanner lebih dulu di tab Pengaturan; scanner harus mengirim Enter setelah tiap scan.', 'Izinkan akses kamera bila memindai QR lewat perangkat.']}
      steps={[
        'Saring dan pilih santri di tab Pilih Santri.',
        'Jalankan batch penerbitan QR.',
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
        
        'Menguji scanner hanya sekali lalu menganggap semua unit beres; scanner yang tidak mengirim Enter membuat scan tertahan.',
        'Memilih "Pilih semua hasil" tanpa menyaring, sehingga santri yang sudah punya kartu ikut diproses ulang.',
      ]}
      glossary={[
        { term: 'QR statis', meaning: 'Kode QR tercetak di kartu. Isinya token acak yang disimpan terenkripsi, bukan data santri.' },
        { term: 'PIN santri', meaning: 'Enam digit milik santri. QR saja tidak cukup — tanpa PIN, kartu yang jatuh tidak bisa dipakai orang lain.' },
        { term: 'Batch penerbitan', meaning: 'Antrean penerbitan QR massal yang mencatat progresnya, sehingga dapat dilanjutkan bila terputus.' },

      ]}
    />
    <CredentialClient credentials={data.credentials as CredentialInventoryRow[]}/>
  </main>
}
