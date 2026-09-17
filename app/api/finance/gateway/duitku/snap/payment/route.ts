import { NextRequest,NextResponse } from 'next/server'
import { getFinanceDB,financeQueryOne } from '@/lib/db'
import { verifySnapNotification } from '@/lib/finance/cooperative/snap'
import { receiveOrder } from '@/lib/finance/cooperative/orders'
export async function POST(request:NextRequest){
 if(Number(request.headers.get('content-length')||0)>32768)return new Response(null,{status:413})
 const raw=await request.text();if(raw.length>32768)return new Response(null,{status:413})
 let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return NextResponse.json({responseCode:'4002501',responseMessage:'Invalid body'},{status:400})}
 const timestamp=request.headers.get('x-timestamp')||'',key=process.env.DUITKU_SNAP_PUBLIC_KEY
 const valid=key&&request.headers.get('x-partner-id')===process.env.DUITKU_SNAP_PARTNER_ID&&request.headers.get('channel-id')==='DUITKU-PAYMENT'&&Number.isFinite(Date.parse(timestamp))&&Math.abs(Date.now()-Date.parse(timestamp))<300000&&verifySnapNotification(body,new URL(request.url).pathname,timestamp,request.headers.get('x-signature')||'',key.replace(/\\n/g,'\n'))
 if(!valid)return NextResponse.json({responseCode:'4012500',responseMessage:'Unauthorized signature'},{status:401})
 const id=String(body.trxId||''),event=String(body.paymentRequestId||''),paid=body.paidAmount as {value?:string;currency?:string}|undefined
 const va=await financeQueryOne<{customer_no:string;va_number:string}>('SELECT v.customer_no,v.va_number FROM finance_student_va v JOIN finance_orders o ON o.santri_id=v.santri_id WHERE o.id=?',[id])
 if(!event||!va||body.customerNo!==va.customer_no||body.partnerServiceId!==process.env.DUITKU_SNAP_VA_PREFIX||paid?.currency!=='IDR'||!/^\d+\.00$/.test(paid.value||''))return NextResponse.json({responseCode:'4042512',responseMessage:'Invalid bill'},{status:400})
 try{
 await receiveOrder({orderId:id,reference:event,actorId:'DUITKU_SNAP',amount:Number(paid.value),vaNumber:String(body.virtualAccountNo||'')})
 return NextResponse.json({responseCode:'2002500',responseMessage:'Successful',virtualAccountData:{partnerServiceId:body.partnerServiceId,customerNo:body.customerNo,virtualAccountNo:body.virtualAccountNo,paymentRequestId:event,paidAmount:paid}})
 }catch(error){
 const db=await getFinanceDB();await db.prepare('INSERT OR IGNORE INTO finance_payment_exceptions(id,event_key,order_id,reason,payload_json) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),event,id,error instanceof Error?error.message:'Pembayaran gagal',JSON.stringify(body)).run()
 return NextResponse.json({responseCode:'5002500',responseMessage:'Payment requires review'},{status:500})
 }
}
