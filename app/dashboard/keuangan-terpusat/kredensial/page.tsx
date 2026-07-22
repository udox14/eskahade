import { guardPage } from '@/lib/auth/guard'
import type { CredentialMode } from '@/lib/finance/types'
import { CredentialClient } from './_credential-client'
import { CredentialActions } from './_credential-actions'
import { getCredentialData } from './actions'
import { FinanceGuide,FinanceNav,FinancePageHeader,SectionPanel,StatusBadge } from '../_components/finance-ui'

export const dynamic='force-dynamic'
type CredentialInventoryRow={id:string;santri_id:string;credential_kind:'RFID_UID'|'QR_STATIC';card_number:string|null;status:string;print_count:number;nis:string;nama_lengkap:string}

export default async function CredentialPage(){
  await guardPage('/dashboard/keuangan-terpusat/kredensial')
  const data=await getCredentialData(),mode=(data.policy?.mode||'HYBRID') as CredentialMode
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Kredensial RFID / QR" description="Enrollment cepat, integrasi reader, dan penerbitan kartu QR santri." eyebrow={`Mode aktif: ${mode}`} meta="Saldo dan PIN tidak pernah menempel pada kartu"/>
    <FinanceNav/>
    <FinanceGuide purpose="Mendaftarkan ribuan credential dengan alur scan berurutan dan batch yang dapat dilanjutkan." prerequisites={["Hubungkan USB reader/scanner dalam mode keyboard dan pastikan suffix Enter aktif.","Izinkan kamera jika memakai scan QR melalui perangkat."]} steps={["Filter dan pilih santri.","Jalankan batch QR atau antrean RFID.","Verifikasi hasil lalu export kartu QR per volume PDF."]} notes={["QR disimpan terenkripsi dan validasi memakai HMAC.","Credential lama harus direvoke saat penggantian.","Kartu QR tetap membutuhkan PIN saat transaksi."]}/>
    <CredentialClient initialMode={mode}/>
    <SectionPanel title="100 credential terbaru" description="Inventaris ringkas; pencarian lengkap tersedia pada panel enrollment.">
      <div className="divide-y divide-slate-100">{data.credentials.length?(data.credentials as CredentialInventoryRow[]).map(credential=><div key={credential.id} className="flex flex-col gap-2 px-4 py-3 text-xs lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-800">{credential.nama_lengkap}</p><p className="text-slate-500">{credential.nis} · {credential.card_number||credential.credential_kind}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={credential.status==='ACTIVE'?'emerald':credential.status==='SUSPENDED_BY_POLICY'?'amber':'red'}>{credential.status}</StatusBadge>{credential.credential_kind==='QR_STATIC'?<span className="text-slate-400">Dicetak {credential.print_count||0}×</span>:null}<CredentialActions id={credential.id} santriId={credential.santri_id} kind={credential.credential_kind} status={credential.status}/></div></div>):<p className="p-10 text-center text-sm text-slate-500">Belum ada credential.</p>}</div>
    </SectionPanel>
  </main>
}
