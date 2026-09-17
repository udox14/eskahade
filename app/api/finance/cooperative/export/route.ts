import { requireFinanceAccess } from '@/lib/finance/access'
import { loadScreen,type ScreenView } from '@/lib/finance/cooperative/screen'
export async function GET(request:Request){
 let session;try{session=await requireFinanceAccess('VIEW')}catch{return new Response('Tidak berwenang',{status:403})}
 const params=new URL(request.url).searchParams,view=params.get('view') as ScreenView
 if(!['home','bills','distributions','reports','settings','cashier'].includes(view))return new Response('Laporan tidak valid',{status:400})
 const query={q:params.get('q')||'',from:params.get('from')||'',to:params.get('to')||''}
 const first=await loadScreen(view,session,{...query,p:'1'})
 if(first.total>5000)return new Response('Batasi tanggal atau pencarian hingga maksimal 5.000 baris per ekspor.',{status:400})
 const escape=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"'
 const encode=new TextEncoder()
 const stream=new ReadableStream({async start(controller){try{controller.enqueue(encode.encode('\uFEFF'+first.columns.map(c=>escape(c.label)).join(',')+'\r\n'));for(let page=1;page<=Math.max(1,Math.ceil(first.total/25));page++){const data=page===1?first:await loadScreen(view,session,{...query,p:String(page)});controller.enqueue(encode.encode(data.rows.map(r=>data.columns.map(c=>escape(r[c.key])).join(',')).join('\r\n')+'\r\n'))}controller.close()}catch(e){controller.error(e)}}})
 return new Response(stream,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="keuangan-'+view+'.csv"','cache-control':'no-store'}})
}
