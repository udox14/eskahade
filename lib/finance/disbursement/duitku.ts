import { createHash } from 'node:crypto'
/* eslint-disable @typescript-eslint/no-explicit-any */

const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`${name} belum dikonfigurasi.`);return value}
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex')
const endpoint=(path:string,sandboxPath:string)=>(process.env.DUITKU_PRODUCTION==='true'?'https://passport.duitku.com/webapi/api/disbursement/':'https://sandbox.duitku.com/webapi/api/disbursement/')+(process.env.DUITKU_PRODUCTION==='true'?path:sandboxPath)

export type DisbursementParty={bankCode:string;bankAccount:string;accountName:string;amountRupiah:number;purpose:string;senderId:string;senderName:string}

async function call(url:string,payload:Record<string,unknown>){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({})) as Record<string,any>;if(!response.ok)throw new Error(`Duitku disbursement HTTP ${response.status}`);return body}

export async function startDuitkuBifastTransfer(party:DisbursementParty){
  const userId=Number(required('DUITKU_DISBURSEMENT_USER_ID')),email=required('DUITKU_DISBURSEMENT_EMAIL'),secret=required('DUITKU_DISBURSEMENT_SECRET')
  const type='BIFAST',timestamp=Date.now()
  const inquirySignature=sha256(`${email}${timestamp}${party.bankCode}${type}${party.bankAccount}${party.amountRupiah}${party.purpose}${secret}`)
  const inquiry=await call(endpoint('inquiryclearing','inquiryclearingsandbox'),{userId,email,bankCode:party.bankCode,bankAccount:party.bankAccount,amountTransfer:party.amountRupiah,senderId:party.senderId,senderName:party.senderName,purpose:party.purpose,type,timestamp,signature:inquirySignature})
  if(String(inquiry.responseCode)!=='00')throw new Error(`Inquiry payout ditolak: ${inquiry.responseDesc||inquiry.responseCode}`)
  const accountName=String(inquiry.accountName||''),custRefNumber=String(inquiry.custRefNumber||''),disburseId=String(inquiry.disburseId||'')
  if(!accountName||!custRefNumber||!disburseId)throw new Error('Respons inquiry Duitku tidak lengkap.')
  const transferTimestamp=Date.now()
  const transferSignature=sha256(`${email}${transferTimestamp}${party.bankCode}${type}${party.bankAccount}${accountName}${custRefNumber}${party.amountRupiah}${party.purpose}${disburseId}${secret}`)
  const transfer=await call(endpoint('transferclearing','transferclearingsandbox'),{disburseId,userId,email,bankCode:party.bankCode,bankAccount:party.bankAccount,amountTransfer:party.amountRupiah,accountName,custRefNumber,type,purpose:party.purpose,timestamp:transferTimestamp,signature:transferSignature})
  if(!['00','68'].includes(String(transfer.responseCode||transfer.statusCode)))throw new Error(`Transfer payout ditolak: ${transfer.responseDesc||transfer.statusDesc||transfer.responseCode}`)
  return{disburseId,custRefNumber,accountName,inquiry,transfer}
}

export function verifyDuitkuDisbursementCallback(payload:Record<string,string>,bankAccount:string):boolean{
  const expected=sha256(`${required('DUITKU_DISBURSEMENT_EMAIL')}${payload.bankCode||''}${bankAccount}${payload.accountName||''}${payload.custRefNumber||''}${payload.amountTransfer||''}${payload.disburseId||''}${required('DUITKU_DISBURSEMENT_SECRET')}`)
  const supplied=String(payload.signature||'').toLowerCase();if(expected.length!==supplied.length)return false;let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^supplied.charCodeAt(i);return mismatch===0
}
