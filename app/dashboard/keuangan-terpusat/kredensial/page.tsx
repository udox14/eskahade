import { guardPage } from '@/lib/auth/guard'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCredentialData } from './actions'
import { CredentialClient } from './_credential-client'
export const dynamic='force-dynamic'
export default async function CredentialPage(){await guardPage('/dashboard/keuangan-terpusat/kredensial');const data=await getCredentialData();return <main className="space-y-5 p-4 md:p-8"><header><p className="text-sm font-semibold text-emerald-700">Saldo tidak menempel pada kartu</p><h1 className="text-2xl font-bold">Kredensial RFID / QR</h1><p className="text-sm text-slate-500">Mode aktif: {data.policy?.mode||'-'} · pergantian mode tidak membuat jurnal.</p></header><CredentialClient/><section className="overflow-hidden rounded-2xl border bg-white">{data.credentials.length?data.credentials.map((c:any)=><div key={c.id} className="flex justify-between border-b p-4 text-sm last:border-0"><span><strong>{c.nama_lengkap}</strong> · {c.nis}</span><span>{c.credential_kind} v{c.token_version} · {c.status}</span></div>):<p className="p-4 text-sm text-slate-500">Belum ada credential.</p>}</section></main>}
