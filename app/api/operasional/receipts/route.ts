import { NextResponse } from 'next/server'
import { authorizeReceiptUnit, uploadPrivateImage } from '@/lib/r2/private-proofs'
import { draftReceiptUrl } from '@/lib/r2/references'

export async function POST(request:Request) {
  try {
    // Bound the body before JSON/base64 expansion; never accept unbounded image input.
    const reader = request.body?.getReader()
    if (!reader) throw new Error('Invalid input')
    const chunks:Uint8Array[] = []; let size=0
    while (true) {
      const {done,value} = await reader.read(); if (done) break
      size+=value.byteLength
      if (size>4.1*1024*1024) { await reader.cancel(); throw new Error('Too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let offset=0
    for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength }
    const body = JSON.parse(new TextDecoder().decode(bytes))
    const unitId = typeof body.unitId === 'string' ? body.unitId : ''
    const staff = await authorizeReceiptUnit(unitId, true)
    const match = typeof body.base64 === 'string' && /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.base64)
    if (!match) throw new Error('Invalid input')
    const file = new File([Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))], 'kuitansi', {type:match[1]})
    const key = await uploadPrivateImage(file, 'operasional-receipts', {ownerId:staff.id, unitId})
    return NextResponse.json({reference:key,url:draftReceiptUrl(key)}, {headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({error:'Unggahan bukti ditolak. Periksa akses, format, dan ukuran gambar (maksimal 3MB).'}, {status:400,headers:{'Cache-Control':'no-store'}})
  }
}
