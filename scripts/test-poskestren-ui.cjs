const fs=require('node:fs')
const path=require('node:path')
const http=require('node:http')
const assert=require('node:assert/strict')
const esbuild=require('esbuild')
const root=path.resolve(__dirname,'..')
const {chromium}=process.env.PLAYWRIGHT_MODULE_DIR ? require(path.join(process.env.PLAYWRIGHT_MODULE_DIR,'playwright')) : require('playwright')
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ClinicalFields,PrescriptionEditor,readClinicalForm} from './components/poskestren/clinical-form';
import {MedicineCombobox} from './components/poskestren/medicine-combobox';
function App(){const [patient,setPatient]=useState('A'),[items,setItems]=useState([]),[result,setResult]=useState('');
return <main className="mx-auto max-w-4xl p-4"><h1>Formulir pemeriksaan</h1><button onClick={()=>{setPatient(patient==='A'?'B':'A');setItems([])}}>Ganti pasien</button>
<form className="space-y-4" onSubmit={e=>{e.preventDefault();setResult(JSON.stringify({clinical:readClinicalForm(new FormData(e.currentTarget)),items,inventory:new FormData(e.currentTarget).get('inventory')}))}}>
<ClinicalFields key={patient} diagnoses={[{id:'d',name:'Diagnosis uji'}]} initial={{allergies:patient==='A'?'Penisilin':'',complaint:'Keluhan '+patient}}/>
<PrescriptionEditor items={items} onChange={setItems} medicines={[{id:'m',name:'Parasetamol',base_unit:'tablet',total_stock_base:20},{id:'n',name:'Vitamin',base_unit:'tablet',total_stock_base:10}]}/>
<label>Persediaan<MedicineCombobox required name="inventory"><option value="">Pilih persediaan</option><option value="m">Parasetamol</option><option value="n">Vitamin</option></MedicineCombobox></label>
<button type="submit">Simpan</button></form><output className="block break-all text-xs" data-testid="result">{result}</output></main>}
createRoot(document.getElementById('root')).render(<App/>);`
async function main(){
 const bundle=esbuild.buildSync({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}}).outputFiles[0].text
 const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss')
 const css=(await postcss([tailwind({base:root})]).process('@import "tailwindcss";',{from:path.join(root,'ui-check.css')})).css
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle)}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css)}else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const executablePath=process.env.CHROMIUM_EXECUTABLE||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync)
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})})
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:900}})
   const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message)})
   await page.goto('http://127.0.0.1:'+server.address().port)
   await page.locator('select[name="diagnosisId"]').selectOption('d')
   await page.getByRole('button',{name:'Tambah obat'}).click()
   const medicine=page.getByRole('combobox',{name:'Cari obat'}).first()
   await medicine.fill('Parase');await medicine.press('Enter')
   await page.getByLabel('Jumlah',{exact:true}).fill('3')
   await page.getByLabel('Aturan pakai',{exact:true}).fill('3 x 1')
   await page.getByRole('button',{name:'Tambah obat'}).click()
   const external=page.getByRole('combobox',{name:'Cari obat'}).nth(1)
   await external.fill('Obat luar uji');await page.getByRole('option',{name:'Beli dari luar: Obat luar uji'}).click()
   await page.getByLabel('Jumlah',{exact:true}).nth(1).fill('4')
   await page.getByLabel('Satuan',{exact:true}).nth(1).fill('kapsul')
   const inventory=page.getByRole('combobox',{name:'Cari obat'}).last()
   await inventory.fill('');await inventory.press('ArrowDown');await inventory.press('Enter')
   await page.getByRole('button',{name:'Simpan',exact:true}).click()
   const result=JSON.parse(await page.getByTestId('result').textContent())
   assert.equal(result.items[0].medicineId,'m');assert.equal(result.items[0].requestedQuantityBase,3)
   assert.equal(result.items[1].sourceType,'EXTERNAL');assert.equal(result.items[1].medicineName,'Obat luar uji');assert.equal(result.items[1].unit,'kapsul')
   assert.equal(result.inventory,'n')
   assert.equal(result.clinical.allergies,'Penisilin')
   await page.getByRole('button',{name:'Ganti pasien'}).click()
   assert.equal(await page.getByLabel('Alergi obat',{exact:true}).inputValue(),'')
   assert.equal(await page.getByRole('button',{name:'Hapus obat'}).count(),0)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
   assert.deepEqual(errors,[])
   const output=path.join(root,'tmp','poskestren-ui');fs.mkdirSync(output,{recursive:true})
   await page.screenshot({path:path.join(output,'form-'+width+'.png'),fullPage:true})
   await page.close()
  }
  console.log('PASS: desktop/mobile forms, searchable combobox, keyboard selection, external medicine, native form values and patient reset')
 }finally{await browser.close();server.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
