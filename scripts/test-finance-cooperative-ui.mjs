import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),root=process.cwd(),out=path.resolve('tmp/finance-cooperative/ui')
mkdirSync(out,{recursive:true})
let playwright
try{playwright=require('playwright')}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss')
const css=await postcss([tailwind()]).process('@import "tailwindcss";',{from:path.resolve('app/finance-qa.css')})
writeFileSync(path.join(out,'app.css'),css.css)
const data={view:'bills',title:'Tagihan & Pembayaran',description:'Pilih tagihan, terima pembayaran, dan telusuri hak penerima.',columns:[{key:'santri',label:'Santri'},{key:'title',label:'Tagihan'},{key:'penerima',label:'Penerima'},{key:'amount',label:'Tagihan',money:true},{key:'remaining',label:'Sisa',money:true},{key:'status',label:'Status'}],rows:Array.from({length:8},(_,i)=>({id:String(i),santri:['Ahmad Fauzan','Muhammad Raihan','Abdul Hakim'][i%3],title:['SPP September 2026','Uang Makan September 2026','Laundry September 2026'][i%3],penerima:['Bendahara Pesantren','Ibu Siti Aminah','Ibu Dewi'][i%3],amount:150000,remaining:150000,status:'OPEN'})),total:8,page:1,search:'',from:'2026-01-01',to:'2026-12-31',sort:'',dir:'desc',forms:[{action:'expense',title:'Catat pengeluaran',fields:[{name:'amount',label:'Nominal (Rp)',type:'number',required:true},{name:'note',label:'Keterangan',required:true}]},{action:'cancelOrder',title:'Batalkan pesanan aktif',fields:[{name:'id',label:'Nomor pesanan',required:true}]}],canWrite:true,canConfigure:true,recipients:[],shift:null,metrics:[]}
const contents=`import React from 'react';import {createRoot} from 'react-dom/client';import {CooperativeScreen} from './app/dashboard/keuangan-terpusat/_components/cooperative-ui';createRoot(document.getElementById('root')).render(<CooperativeScreen data={${JSON.stringify(data)}}/>);`
await build({stdin:{contents,loader:'tsx',resolveDir:root},outfile:path.join(out,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'mock-server-boundaries',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},a=>({path:a.path,namespace:'mock'}))
 b.onResolve({filter:/cooperative-actions$/},()=>({path:'actions',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},({path:p})=>({resolveDir:root,loader:'js',contents:p==='next/link'?`import React from 'react';export default function Link({href,children,...rest}){return React.createElement('a',{href,...rest},children)}`:p==='next/navigation'?`export const useRouter=()=>({refresh(){}});export const usePathname=()=>'/dashboard/keuangan-terpusat/tagihan';`:`export async function coopAction(form){window.testActions=window.testActions||[];window.testActions.push(Object.fromEntries(form.entries()));return window.testActions.length===1?{success:false,message:'Simulasi koneksi terputus. Coba lagi.'}:{success:true,message:'Perubahan disimpan.'}};export const searchCoopStudents=async()=>[];export const studentCheckout=async()=>({bills:[],settings:{},balance:0});export const scanCoopStudent=async()=>null;`}))
}}]})
writeFileSync(path.join(out,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/app.css"/></head><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><div id="root" style="max-width:1440px;margin:auto;padding:16px"></div><script src="/app.js"></script></body></html>')
const server=createServer((req,res)=>{const file=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(path.join(out,file)))})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const port=server.address().port
let browser
try{browser=await playwright.chromium.launch({headless:true,channel:'msedge'})}catch{browser=await playwright.chromium.launch({headless:true})}
try{
 for(const width of [360,390,768,1366]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:'+port)
 await page.getByRole('heading',{name:'Tagihan & Pembayaran'}).waitFor()
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow '+width)
 if(width===360){
  assert.match(await page.locator('nav').textContent(),/Saat ini: Tagihan & Pembayaran/)
  assert.match(await page.locator('article').first().textContent(),/SPP September 2026.*Sisa.*Rp\s*150\.000/s)
 }
 await page.screenshot({path:path.join(out,'screen-'+width+'.png'),fullPage:true})
 const trigger=page.getByRole('button',{name:'Catat pengeluaran'})
 await trigger.click()
 await page.getByRole('dialog').waitFor({state:'visible'})
 await page.getByLabel('Nominal (Rp)').fill('12000')
 await page.getByLabel('Keterangan',{exact:true}).fill('Beli tinta printer')
 await page.getByRole('dialog').getByRole('button',{name:'Catat pengeluaran',exact:true}).click()
 await page.getByText('Simulasi koneksi terputus. Coba lagi.').waitFor()
 assert.equal(await page.getByLabel('Nominal (Rp)').inputValue(),'12000')
 await page.screenshot({path:path.join(out,'modal-'+width+'.png')})
 await page.getByRole('dialog').getByRole('button',{name:'Catat pengeluaran',exact:true}).click()
 await page.getByText('Perubahan disimpan.').waitFor()
 const keys=await page.evaluate(()=>window.testActions.map(a=>a.key));assert.ok(keys[0]);assert.equal(keys[0],keys[1])
 await page.keyboard.press('Escape')
 assert.equal(await trigger.evaluate(e=>e===document.activeElement),true)
 if(width===360){
  const destructive=page.getByRole('button',{name:'Batalkan pesanan aktif'})
  await destructive.click()
  await page.getByLabel('Nomor pesanan').fill('order-001')
  await page.getByRole('button',{name:'Tinjau dampak'}).click()
  await page.getByText('Periksa dampak sebelum melanjutkan').waitFor()
  assert.equal(await page.getByLabel('Nomor pesanan').isDisabled(),true)
  await page.screenshot({path:path.join(out,'review-destructive-360.png')})
  await page.getByRole('button',{name:'Batalkan pesanan',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testActions.at(-1).id),'order-001')
  await page.keyboard.press('Escape')
  assert.equal(await destructive.evaluate(e=>e===document.activeElement),true)
 }
 assert.deepEqual(errors,[])
 await page.close();console.log('PASS responsive table/modal/keyboard/retry at',width)
 }
}finally{await browser.close();server.close()}
