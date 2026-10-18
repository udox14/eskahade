import { NextResponse } from 'next/server'
import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import { ProofStorageService } from '@/lib/finance/bri/proof-storage-service'
import { execute, now } from '@/lib/db'

export async function POST(request:Request) {
  try {
    const {session,roles}=await authorizeFinanceFeature('/dashboard/keuangan/penyaluran',true)
    if(!roles.some(role=>['admin','bendahara','petugas_koperasi'].includes(role))) return NextResponse.json({error:'Forbidden'},{status:403})
    const body=await request.json() as {base64?:string;filename?:string}
    const raw=body.base64
    if(typeof raw!=='string'||raw.length>8*1024*1024) return NextResponse.json({error:'Berkas tidak valid atau terlalu besar.'},{status:400})
    const match=/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(raw)
    if(!match)return NextResponse.json({error:'Format berkas tidak valid.'},{status:400})
    const buffer=Buffer.from(match[2],'base64')
    const result=await new ProofStorageService().storeFinancialProof({buffer,mimeType:match[1],originalFilename:body.filename||'proof',operatorId:session.id,operatorRole:roles[0]})
    if(!result.success||result.storageMode!=='R2') return NextResponse.json({error:'Penyimpanan bukti privat tidak tersedia.'},{status:503})
    await execute('INSERT INTO finance_proofs(object_key,owner_id,content_hash,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?)',
      [result.objectKey,session.id,result.hash,result.mimeType,result.sizeBytes,now()])
    return NextResponse.json({url:`/api/finance/proofs/${result.objectKey}`},{headers:{'Cache-Control':'no-store'}})
  } catch {return NextResponse.json({error:'Unggahan ditolak.'},{status:403,headers:{'Cache-Control':'no-store'}})}
}
