/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated UI fixture: real React pages/components and built Tailwind CSS,
// synthetic server responses. Does not authenticate or call any database.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'..'),out=path.join(root,'.codex-temp/discipline-ui')
async function run(){
 fs.mkdirSync(out,{recursive:true})
 const incident={id:'umum:x',source_id:'x',source:'umum',santri_id:'s1',tanggal:'2026-09-30',created_at:'2026-10-01',jenis:'RINGAN',deskripsi:'Terlambat mengikuti kegiatan',jumlah_kejadian:1,perlu_verifikasi:0}
 const incidents=[incident,{...incident,id:'pengajian:p',source:'pengajian',jenis:'Tidur',sesi:'shubuh',deskripsi:'Tidur saat pengajian'},{...incident,id:'umum:unknown',jenis:'ALFA_PENGAJIAN',tanggal:null,jumlah_kejadian:0,perlu_verifikasi:1,deskripsi:'Akumulasi Alfa Pengajian (3 Sesi). Detail: 30 Sep (shubuh)'}]
 const mock=`export const incidents=${JSON.stringify(incidents)};
 export const getMasterPelanggaran=async()=>[{id:1,kategori:'RINGAN',nama_pelanggaran:'Terlambat',deskripsi:'Kegiatan wajib',urutan:1}];
 export const getDaftarPelanggar=async()=>({rows:[{id:'s1',nama_lengkap:'Ahmad (data contoh)',nis:'001',asrama:'A',kamar:'1',jumlah_pelanggaran:7,perlu_verifikasi:1}],total:1,page:1,totalPages:1});
 export const getDetailSantri=async()=>({profil:{nama_lengkap:'Ahmad (data contoh)',nis:'001',asrama:'A',kamar:'1'},pelanggaran:incidents,suratPernyataan:[],suratPerjanjian:[]});
 export const getHistoryReviews=async()=>({rows:[{id:'old',nama_lengkap:'Ahmad (data contoh)',jenis:'ALFA_PENGAJIAN',deskripsi:'Akumulasi Alfa Pengajian (3 Sesi). Detail: 30 Sep (shubuh)',version:1,suggestions:[]}],total:1});
 export const verifyHistory=async()=>({success:true});
 export const getPelanggaranAnak=async()=>incidents;
 export const getTotalPelanggaranAnak=async()=>({jumlah:7,pending:1,catatan:3});
 export const requirePortalSessionStrict=async()=>({santri_id:'s1'});
 export const tambahMasterPelanggaran=async()=>({success:true}),editMasterPelanggaran=tambahMasterPelanggaran,hapusMasterPelanggaran=tambahMasterPelanggaran,hapusPelanggaran=tambahMasterPelanggaran,simpanPelanggaran=tambahMasterPelanggaran,importMasterPelanggaranMassal=tambahMasterPelanggaran;
 export const cariSantri=async()=>[],getOpsiExportPelanggaran=async()=>({asramas:['A'],santri:[]}),getDataExportPelanggaran=async()=>({rows:incidents});`
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';
 import Security from '${path.join(root,'app/dashboard/keamanan/_page-content.tsx').replaceAll('\\','/')}';
 import Portal from '${path.join(root,'app/portal-ortu/(app)/pelanggaran/page.tsx').replaceAll('\\','/')}';
 const screen=new URLSearchParams(location.search).get('screen');
 const app=screen==='portal'?Portal({searchParams:Promise.resolve({})}):Promise.resolve(React.createElement(Security));
 app.then(node=>createRoot(document.getElementById('app')).render(node));`
 await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-responses',setup(build){
  build.onResolve({filter:/./},args=>{
   const candidate=args.path.startsWith('.')?path.resolve(path.dirname(args.importer),args.path):args.path
   if(['/lib/portal/data','/lib/portal/session','/app/dashboard/keamanan/actions','/app/dashboard/keamanan/history-actions'].some(s=>candidate.replaceAll('\\','/').endsWith(s))||['@/lib/portal/data','@/lib/portal/session'].includes(args.path))return{path:'mock',namespace:'test'}
   if(args.path==='next/link')return{path:'link',namespace:'test'}
  })
  build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='link'?"import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}":mock,loader:'js',resolveDir:root}))
 }}]})
 const cssDir=path.join(root,'.next/static/css')
 const css=fs.readdirSync(cssDir,{recursive:true}).filter(f=>String(f).endsWith('.css')).map(f=>fs.readFileSync(path.join(cssDir,String(f)),'utf8')).join('\n')
 fs.writeFileSync(path.join(out,'style.css'),css)
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),file=u.pathname.slice(1)
  if(['bundle.js','style.css'].includes(file)){res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,file)));return}
  res.setHeader('Content-Type','text/html; charset=utf-8')
  if(u.pathname==='/inner')res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="app" style="padding:16px"></main><script src="/bundle.js"></script></body></html>')
  else{const w=[360,768,1280].includes(Number(u.searchParams.get('width')))?Number(u.searchParams.get('width')):360;const screen=u.searchParams.get('screen')==='portal'?'portal':'security';res.end(`<html><body style="margin:8px;font-family:Arial"><h1>Uji Pelanggaran · Data Contoh</h1><nav>${[360,768,1280].map(n=>`<a href="?width=${n}&screen=${screen}">${n}px</a>`).join(' · ')} · <a href="?width=${w}&screen=security">Keamanan</a> · <a href="?width=${w}&screen=portal">Portal</a></nav><iframe title="Tampilan ${screen} ${w}px" src="/inner?screen=${screen}" style="width:${w}px;height:1100px;border:1px solid #ddd;margin-top:12px"></iframe></body></html>`)}
 });server.listen(Number(process.env.DISCIPLINE_UI_PORT)||3096,'127.0.0.1',()=>console.log(`Isolated UI fixture: http://127.0.0.1:${server.address().port} (360/768/1280px). Ctrl+C to stop.`))
}
run().catch(e=>{console.error(e);process.exitCode=1})
