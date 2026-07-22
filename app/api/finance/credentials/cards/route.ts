import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import { requireFinanceAccess } from '@/lib/finance/access'
import { decryptFinanceValue } from '@/lib/finance/encryption'
import { financeQuery, generateId, getFinanceDB, query } from '@/lib/db'

export const dynamic='force-dynamic'
const MAX_CARDS=400

const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]!))
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'S'

type CardRow={id:string;santri_id:string;card_number:string;token_encrypted:string;nis:string;full_name:string;asrama:string|null;kamar:string|null;photo_url:string|null}
type MasterRow={id:string;kelas_pesantren:string|null}

function cardFront(row:CardRow,kelas:string|null,origin:string){
  const photo=row.photo_url?`<img class="photo" src="${esc(row.photo_url)}" alt="">`:`<div class="photo fallback">${esc(initials(row.full_name))}</div>`
  return `<article class="card front"><div class="brand"><img src="${esc(origin)}/logo.png" alt=""><div><b>PONDOK PESANTREN SUKAHIDENG</b><span>Kartu Identitas Santri</span></div></div><div class="identity">${photo}<div class="details"><h2>${esc(row.full_name)}</h2><p class="nis">NIS ${esc(row.nis)}</p><dl><dt>Kelas</dt><dd>${esc(kelas||'-')}</dd><dt>Asrama</dt><dd>${esc(row.asrama||'-')}</dd><dt>Kamar</dt><dd>${esc(row.kamar||'-')}</dd></dl></div></div><div class="card-no">${esc(row.card_number)}</div></article>`
}

function cardBack(row:CardRow,svg:string){
  return `<article class="card back"><div class="qr">${svg}</div><div class="back-copy"><b>SCAN DI LOKET KEUANGAN</b><span>${esc(row.card_number)}</span><p>Kartu ini bukan penyimpan saldo. Setiap transaksi tetap memerlukan PIN santri.</p><small>Jika kartu hilang, segera laporkan kepada petugas untuk diblokir.</small></div></article>`
}

const withCrop=(card:string)=>`<div class="cut"><i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>${card}</div>`

function buildHtml(cards:Array<{row:CardRow;kelas:string|null;svg:string}>,origin:string){
  const pages:string[]=[]
  for(let offset=0;offset<cards.length;offset+=8){
    const sheet=cards.slice(offset,offset+8)
    const backs=[] as typeof sheet
    for(let row=0;row<sheet.length;row+=2){const pair=sheet.slice(row,row+2);backs.push(...pair.reverse())}
    pages.push(`<section class="sheet">${sheet.map(card=>withCrop(cardFront(card.row,card.kelas,origin))).join('')}</section>`)
    pages.push(`<section class="sheet">${backs.map(card=>withCrop(cardBack(card.row,card.svg))).join('')}</section>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${esc(origin)}/"><style>
    @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{width:190mm;height:277mm;display:grid;grid-template-columns:85.6mm 85.6mm;grid-template-rows:repeat(4,53.98mm);gap:6mm 8mm;align-content:center;justify-content:center;page-break-after:always}
    .sheet:last-child{page-break-after:auto}.cut{position:relative;width:85.6mm;height:53.98mm}.card{position:relative;width:85.6mm;height:53.98mm;overflow:hidden;border:.15mm solid #94a3b8;border-radius:2.6mm;background:#fff}
    .crop{position:absolute;width:2mm;height:2mm;z-index:2}.crop:before,.crop:after{content:"";position:absolute;background:#111827}.crop:before{width:2mm;height:.12mm}.crop:after{width:.12mm;height:2mm}.tl{left:-2mm;top:-2mm}.tl:before{bottom:0}.tl:after{right:0}.tr{right:-2mm;top:-2mm}.tr:before{bottom:0}.tr:after{left:0}.bl{left:-2mm;bottom:-2mm}.bl:before{top:0}.bl:after{right:0}.br{right:-2mm;bottom:-2mm}.br:before{top:0}.br:after{left:0}
    .front{padding:4mm;background:linear-gradient(145deg,#fff 0 72%,#ecfdf5 72%)}.brand{display:flex;align-items:center;gap:2.5mm;border-bottom:.35mm solid #059669;padding-bottom:2mm}.brand img{width:8mm;height:8mm;object-fit:contain}.brand b{display:block;font-size:7.2pt;color:#065f46}.brand span{display:block;font-size:5.8pt;color:#64748b;margin-top:.5mm}
    .identity{display:flex;gap:3mm;padding-top:3mm}.photo{width:20mm;height:25mm;border-radius:1.8mm;object-fit:cover;background:#e2e8f0;border:.3mm solid #cbd5e1}.fallback{display:grid;place-items:center;font-weight:800;font-size:15pt;color:#475569}.details{min-width:0;flex:1}.details h2{font-size:10pt;line-height:1.15;margin:0 0 1.2mm;text-transform:uppercase;max-height:8mm;overflow:hidden}.nis{margin:0 0 2mm;font-size:7pt;font-weight:bold;color:#047857}.details dl{display:grid;grid-template-columns:12mm 1fr;margin:0;font-size:6.3pt;line-height:1.45}.details dt{color:#64748b}.details dd{margin:0;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-no{position:absolute;right:3mm;bottom:2mm;font:5.5pt monospace;color:#64748b}
    .back{display:flex;align-items:center;gap:4mm;padding:5mm;background:linear-gradient(135deg,#064e3b,#047857);color:#fff}.qr{display:grid;place-items:center;width:31mm;height:31mm;padding:1.5mm;border-radius:2mm;background:#fff;flex:none}.qr svg{width:28mm;height:28mm}.back-copy b{display:block;font-size:8pt}.back-copy span{display:block;margin:1.5mm 0 2.5mm;font:6pt monospace;color:#d1fae5}.back-copy p{font-size:6.5pt;line-height:1.4;margin:0 0 2mm}.back-copy small{display:block;font-size:5.5pt;line-height:1.35;color:#d1fae5}
  </style></head><body>${pages.join('')}</body></html>`
}

export async function GET(request:Request){
  try{await requireFinanceAccess('CONFIGURE')}catch{return NextResponse.json({error:'Tidak berwenang melihat kartu.'},{status:403})}
  const id=new URL(request.url).searchParams.get('id')||''
  const rows=await financeQuery<CardRow>(`SELECT c.id,c.santri_id,c.card_number,c.token_encrypted,s.nis,s.full_name,s.asrama,s.kamar,s.photo_url FROM student_credentials c JOIN finance_student_snapshots s ON s.santri_id=c.santri_id WHERE c.id=? AND c.credential_kind='QR_STATIC' AND c.status IN ('ACTIVE','SUSPENDED_BY_POLICY') AND c.token_encrypted IS NOT NULL`,[id])
  const row=rows[0]
  if(!row)return NextResponse.json({error:'Kartu QR tidak ditemukan.'},{status:404})
  const masters=await query<MasterRow>(`SELECT s.id,k.nama_kelas kelas_pesantren FROM santri s LEFT JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif' LEFT JOIN kelas k ON k.id=rp.kelas_id WHERE s.id=?`,[row.santri_id])
  const token=await decryptFinanceValue(row.token_encrypted),svg=await QRCode.toString(token,{type:'svg',errorCorrectionLevel:'M',margin:0})
  return NextResponse.json({id:row.id,cardNumber:row.card_number,nis:row.nis,name:row.full_name,asrama:row.asrama,kamar:row.kamar,photoUrl:row.photo_url,kelas:masters[0]?.kelas_pesantren||null,qrSvg:svg},{headers:{'Cache-Control':'no-store'}})
}

export async function POST(request:Request){
  let session
  try{session=await requireFinanceAccess('CONFIGURE')}catch{return NextResponse.json({error:'Tidak berwenang mencetak credential.'},{status:403})}
  const body=await request.json().catch(()=>null) as {credentialIds?:unknown}|null
  const ids=Array.isArray(body?.credentialIds)?[...new Set(body!.credentialIds.filter((id):id is string=>typeof id==='string'&&id.length>0))]:[]
  if(!ids.length||ids.length>MAX_CARDS)return NextResponse.json({error:`Pilih 1-${MAX_CARDS} kartu per volume.`},{status:400})
  const rows:CardRow[]=[]
  for(let offset=0;offset<ids.length;offset+=80){const chunk=ids.slice(offset,offset+80);rows.push(...await financeQuery<CardRow>(`SELECT c.id,c.santri_id,c.card_number,c.token_encrypted,s.nis,s.full_name,s.asrama,s.kamar,s.photo_url FROM student_credentials c JOIN finance_student_snapshots s ON s.santri_id=c.santri_id WHERE c.id IN (${chunk.map(()=>'?').join(',')}) AND c.credential_kind='QR_STATIC' AND c.status IN ('ACTIVE','SUSPENDED_BY_POLICY') AND c.token_encrypted IS NOT NULL`,chunk))}
  const byId=new Map(rows.map(row=>[row.id,row])),ordered=ids.map(id=>byId.get(id)).filter((row):row is CardRow=>Boolean(row))
  if(ordered.length!==ids.length)return NextResponse.json({error:'Sebagian kartu QR tidak tersedia atau sudah dicabut.'},{status:409})
  const masters:MasterRow[]=[]
  for(let offset=0;offset<ordered.length;offset+=80){const chunk=ordered.slice(offset,offset+80).map(row=>row.santri_id);masters.push(...await query<MasterRow>(`SELECT s.id,k.nama_kelas kelas_pesantren FROM santri s LEFT JOIN riwayat_pendidikan rp ON rp.santri_id=s.id AND rp.status_riwayat='aktif' LEFT JOIN kelas k ON k.id=rp.kelas_id WHERE s.id IN (${chunk.map(()=>'?').join(',')})`,chunk))}
  const classMap=new Map(masters.map(row=>[row.id,row.kelas_pesantren]))
  const cards=await Promise.all(ordered.map(async row=>{const token=await decryptFinanceValue(row.token_encrypted);return{row,kelas:classMap.get(row.santri_id)||null,svg:await QRCode.toString(token,{type:'svg',errorCorrectionLevel:'M',margin:0})}}))
  const origin=new URL(request.url).origin,html=buildHtml(cards,origin),accountId=process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),apiToken=process.env.CLOUDFLARE_BROWSER_RENDERING_API_TOKEN?.trim()
  if(!accountId||!apiToken)return NextResponse.json({error:'Konfigurasi PDF Cloudflare belum lengkap.'},{status:500})
  const upstream=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,{method:'POST',headers:{Authorization:`Bearer ${apiToken}`,'Content-Type':'application/json'},body:JSON.stringify({html,pdfOptions:{printBackground:true,preferCSSPageSize:true}})})
  if(!upstream.ok){let error='Gagal membuat PDF kartu.';try{const payload=await upstream.json() as {errors?:Array<{message?:string}>};error=payload?.errors?.[0]?.message||error}catch{}return NextResponse.json({error},{status:upstream.status})}
  const db=await getFinanceDB()
  for(let offset=0;offset<ids.length;offset+=50)await db.batch(ids.slice(offset,offset+50).map(id=>db.prepare(`UPDATE student_credentials SET print_count=print_count+1,last_printed_at=datetime('now') WHERE id=?`).bind(id)))
  await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'EXPORT_CREDENTIAL_CARDS','STUDENT_CREDENTIAL',NULL,?)`).bind(generateId(),session.id,JSON.stringify({count:ids.length,credentialIds:ids})).run()
  return new Response(upstream.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="kartu-qr-santri-${Date.now()}.pdf"`,'Cache-Control':'no-store'}})
}
