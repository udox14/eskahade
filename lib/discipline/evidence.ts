export type SessionEvidence={tanggal:string;sesi:string}
export function validEvidence(items:SessionEvidence[],source:'pengajian'|'berjamaah') {
 if(!Array.isArray(items)||!items.length||items.length>500) throw new Error('Isi minimal satu sesi, maksimal 500 sesi.')
 const allowed=source==='pengajian'?['shubuh','ashar','maghrib']:['shubuh','dzuhur','ashar','maghrib','isya']
 const seen=new Set<string>()
 for(const item of items) {
  if(!item||typeof item.tanggal!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.tanggal)||!Number.isFinite(Date.parse(item.tanggal+'T00:00:00Z'))||new Date(item.tanggal+'T00:00:00Z').toISOString().slice(0,10)!==item.tanggal||!allowed.includes(item.sesi))throw new Error('Tanggal atau sesi tidak valid.')
  const key=item.tanggal+':'+item.sesi
  if(seen.has(key))throw new Error('Sesi duplikat.');seen.add(key)
 }
 return items
}
// Only full ISO dates are evidence. Indonesian short dates in old accumulated
// descriptions have no year and must never inherit the year of the verdict.
export function descriptionEvidence(description:string,source:'pengajian'|'berjamaah') {
 const detail=description.split(/Detail\s*:/i)[1]
 if(!detail)return []
 const matches=[...detail.matchAll(/(\d{4}-\d{2}-\d{2})\s*\((shubuh|dzuhur|ashar|maghrib|isya)\)/g)]
 const items=matches.map(m=>({tanggal:m[1],sesi:m[2]}))
 const remainder=detail.replace(/\d{4}-\d{2}-\d{2}\s*\((?:shubuh|dzuhur|ashar|maghrib|isya)\)/g,'').replace(/[\s,;.]/g,'')
 const count=description.match(/\((\d+)\s+Sesi\)/i)
 if(remainder||count&&Number(count[1])!==items.length)return []
 try{return validEvidence(items,source)}catch{return []}
}
