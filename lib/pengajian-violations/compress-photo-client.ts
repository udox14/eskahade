'use client'

import { compressImageFile } from '@/lib/image/compress-client'
import { PHOTO_MAX_BYTES } from './photo'

// Reuse the application's encoder. Keep resolution/quality floors so a size
// target never silently turns an evidence photo into an unreadable thumbnail.
export async function compressEvidencePhoto(file:File):Promise<File> {
 let best:File|null=null
 for(const [size,quality] of [[960,.78],[960,.66],[960,.56],[800,.62],[640,.62]] as const){
  const data=await compressImageFile(file,{maxWidth:size,maxHeight:size,quality,mimeType:'image/webp'})
  if(!data.startsWith('data:image/webp;base64,'))throw new Error('Peramban ini belum mendukung WebP. Coba peramban yang lebih baru.')
  const payload=atob(data.slice(data.indexOf(',')+1)),bytes=Uint8Array.from(payload,char=>char.charCodeAt(0))
  best=new File([bytes],'foto-kejadian.webp',{type:'image/webp'})
  if(best.size<=80*1024)return best
 }
 if(best&&best.size<=PHOTO_MAX_BYTES)return best
 throw new Error('Foto masih terlalu besar. Ambil ulang dengan pencahayaan lebih baik.')
}
