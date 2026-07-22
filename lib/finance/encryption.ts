function keySecret():string{const value=process.env.FINANCE_ENCRYPTION_KEY;if(!value)throw new Error('FINANCE_ENCRYPTION_KEY belum dikonfigurasi.');return value}
async function key(){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(keySecret()));return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt'])}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
const unhex=(value:string)=>new Uint8Array(value.match(/.{2}/g)?.map(part=>parseInt(part,16))||[])
export async function encryptFinanceValue(value:string):Promise<string>{const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value));return `v1.${hex(iv)}.${hex(new Uint8Array(encrypted))}`}
export async function decryptFinanceValue(value:string):Promise<string>{const [version,ivHex,dataHex]=value.split('.');if(version!=='v1'||!ivHex||!dataHex)throw new Error('Format data terenkripsi tidak valid.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(ivHex)},await key(),unhex(dataHex));return new TextDecoder().decode(plain)}
