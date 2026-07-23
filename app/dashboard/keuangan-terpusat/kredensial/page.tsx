import { guardPage } from '@/lib/auth/guard'
import type { CredentialMode } from '@/lib/finance/types'
import { CredentialClient,type CredentialInventoryRow } from './_credential-client'
import { getCredentialData } from './actions'
import { FinanceGuide,FinanceNav,FinancePageHeader } from '../_components/finance-ui'

export const dynamic='force-dynamic'

export default async function CredentialPage(){
  await guardPage('/dashboard/keuangan-terpusat/kredensial')
  const data=await getCredentialData(),mode=(data.policy?.mode||'HYBRID') as CredentialMode
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Keredensial" description="Enrollment cepat, integrasi reader, dan penerbitan kartu QR santri." eyebrow={`Mode aktif: ${mode}`} meta="Saldo dan PIN tidak pernah menempel pada kartu"/>
    <FinanceNav/>
    <FinanceGuide purpose="Mendaftarkan ribuan credential dengan alur scan berurutan dan batch yang dapat dilanjutkan." prerequisites={["Hubungkan USB reader/scanner dalam mode keyboard dan pastikan suffix Enter aktif.","Izinkan kamera jika memakai scan QR melalui perangkat."]} steps={["Filter dan pilih santri.","Jalankan batch QR atau antrean RFID.","Verifikasi hasil lalu export kartu QR per volume PDF."]} notes={["QR disimpan terenkripsi dan validasi memakai HMAC.","Credential lama harus direvoke saat penggantian.","Kartu QR tetap membutuhkan PIN saat transaksi."]}/>
    <CredentialClient initialMode={mode} credentials={data.credentials as CredentialInventoryRow[]}/>
  </main>
}
