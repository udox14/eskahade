export const PHOTO_MAX_BYTES = 120 * 1024
export const PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const PHOTO_PREFIX = 'pengajian-evidence/'

// Inspect the actual WebP header and dimensions; MIME and extensions alone are insufficient.
export function validateEvidenceWebP(bytes: Uint8Array): void {
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
 const text = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length))
 if(bytes.length<30 || bytes.length>PHOTO_MAX_BYTES || text(0,4)!=='RIFF' || text(8,4)!=='WEBP' || view.getUint32(4,true)+8!==bytes.length) throw new Error('Foto harus WebP valid, maksimal 120 KB.')
 let width=0,height=0,image=false
 for(let offset=12;offset+8<=bytes.length;){
  const tag=text(offset,4),size=view.getUint32(offset+4,true),start=offset+8
  if(start+size>bytes.length)throw new Error('Foto WebP tidak valid.')
  if(tag==='ANIM'||tag==='ANMF')throw new Error('Foto animasi tidak didukung.')
  if(tag==='VP8X'&&size>=10){if(bytes[start]&2)throw new Error('Foto animasi tidak didukung.');width=1+bytes[start+4]+(bytes[start+5]<<8)+(bytes[start+6]<<16);height=1+bytes[start+7]+(bytes[start+8]<<8)+(bytes[start+9]<<16)}
  if(tag==='VP8 '&&size>=10&&text(start+3,3)==='\x9d\x01\x2a'){image=true;width=Math.max(width,view.getUint16(start+6,true)&0x3fff);height=Math.max(height,view.getUint16(start+8,true)&0x3fff)}
  if(tag==='VP8L'&&size>=5&&bytes[start]===0x2f){image=true;const packed=view.getUint32(start+1,true);width=Math.max(width,(packed&0x3fff)+1);height=Math.max(height,((packed>>>14)&0x3fff)+1)}
  offset=start+size+(size%2)
 }
 if(!image||width<1||height<1||width>960||height>960)throw new Error('Dimensi foto maksimal 960 piksel.')
}
