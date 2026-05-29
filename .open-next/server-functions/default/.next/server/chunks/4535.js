"use strict";exports.id=4535,exports.ids=[4535],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},10316:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("search",[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]])},22687:(a,b,c)=>{c.d(b,{O5:()=>f,TX:()=>e});let d=["AL-BAGHORY"],e=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!d.includes(a));function f(a){return d.includes((a||"").trim().toUpperCase())}},38576:(a,b,c)=>{c.d(b,{r:()=>e});var d=c(99829);let e=(0,d.createServerReference)("4032c0379df19752379940c5537bf7deebaafef8c2",d.callServer,void 0,d.findSourceMapURL,"getKamarList")},40560:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},44562:(a,b,c)=>{c.r(b),c.d(b,{"006f0febd6fb8c82aca29b039f392985ea90492e3b":()=>d.C,"00c5228da427b0dc3f5db313bee80afbc79adabc59":()=>k,"4032c0379df19752379940c5537bf7deebaafef8c2":()=>l,"4066bdef5a0a0d471c493e544e4a46e8cbf1d3f922":()=>p,"40881aaa8e9267a4da9b747337ad65989fdc893db1":()=>n,"4098d3881f47a51c9f7dee2c2d95355646023e6522":()=>r,"40fc20a18afcbfb416bb388b51e72e56dd8f03a637":()=>s,"7002cb31dba4e34cc007949fd627739cbd88fea199":()=>m,"701a94538334c754a0ee4e2478afc7c63a9b139d74":()=>o,"702e778475e5617e599dc54e7f878331e75840ea3d":()=>q});var d=c(38052),e=c(95349),f=c(44916),g=c(46100),h=c(51214),i=c(89337);let j=["ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4"];async function k(){let a=await (0,g.Ht)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null,isPutri:j.includes(a.asrama_binaan||"")}:null}async function l(a){return(0,h.O5)(a)?[]:(await (0,f.P)(`
    SELECT DISTINCT kamar FROM santri 
    WHERE asrama = ? AND status_global = 'aktif'
  `,[a])).map(a=>a.kamar||"Tanpa Kamar").sort((a,b)=>(parseInt(a)||999)-(parseInt(b)||999))}async function m(a,b,c){if((0,h.O5)(a))return{santriList:[],alfaPerSantri:{},detailPerSantri:{}};let[d,e]=b.split("-"),g=c||`${d}-${e}-01`,i=c||`${d}-${e}-31`,j=await (0,f.P)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar, a.santri_id, a.tanggal, a.status FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `,[g,i,a]),k={},l={},m={};return j.forEach(a=>{k[a.id]||(k[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar}),l[a.santri_id]||(l[a.santri_id]={}),l[a.santri_id][a.tanggal]=a.status,m[a.santri_id]=(m[a.santri_id]||0)+1}),{santriList:Object.values(k),alfaPerSantri:m,detailPerSantri:l}}async function n(a){if((0,h.O5)(a))return[];let b=await (0,f.P)(`
    SELECT
      s.id,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      a.tanggal,
      a.keterangan
    FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE s.asrama = ?
      AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal DESC
  `,[a]),c={};return b.forEach(a=>{c[a.id]||(c[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar,total_alfa:0,tanggal:[]}),c[a.id].total_alfa+=1,c[a.id].tanggal.push({tanggal:a.tanggal,keterangan:a.keterangan||null})}),Object.values(c)}async function o(a,b,c){if((0,h.O5)(a))return{santriList:[],detail:{}};let[d,e]=b.split("-"),g=`${d}-${e}-01`,i=`${d}-${e}-31`,j=await (0,f.P)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `,[a]);if(!j.length)return{santriList:[],detail:{}};let k=await (0,f.P)(`
    SELECT a.santri_id, a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ? AND s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY a.tanggal
  `,[g,i,a]),l={};return k.forEach(a=>{l[a.santri_id]||(l[a.santri_id]={}),l[a.santri_id][a.tanggal]={shubuh:c&&"H"===a.shubuh?"S":a.shubuh,dzuhur:c&&"H"===a.dzuhur?"S":a.dzuhur,ashar:c&&"H"===a.ashar?"S":a.ashar,maghrib:c&&"H"===a.maghrib?"S":a.maghrib,isya:c&&"H"===a.isya?"S":a.isya}}),{santriList:j,detail:l}}async function p(a){return(0,h.O5)(a)?[]:(0,f.P)(`
    SELECT id, nama_lengkap, nis, kamar FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY CAST(kamar AS INTEGER), nama_lengkap
  `,[a])}async function q(a,b,c){if((0,h.O5)(a))return{santriList:[],detail:{}};let d=await (0,f.P)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya
    FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND (a.shubuh = 'A' OR a.dzuhur = 'A' OR a.ashar = 'A' OR a.maghrib = 'A' OR a.isya = 'A')
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `,[b,c,a]),e={},g={};return d.forEach(a=>{e[a.id]||(e[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar}),g[a.id]||(g[a.id]={}),g[a.id][a.tanggal]={shubuh:"A"===a.shubuh?"A":null,dzuhur:"A"===a.dzuhur?"A":null,ashar:"A"===a.ashar?"A":null,maghrib:"A"===a.maghrib?"A":null,isya:"A"===a.isya?"A":null}}),{santriList:Object.values(e),detail:g}}async function r(a){if(!a.length)return{success:!0,count:0};let b=new Set(["shubuh","dzuhur","ashar","maghrib","isya"]),c=a.filter(a=>b.has(a.waktu));if(!c.length)return{success:!0,count:0};let d={};c.forEach(a=>{let b=`${a.santriId}|${a.tanggal}`;d[b]||(d[b]=new Set),d[b].add(a.waktu)});let e=[];Object.entries(d).forEach(([a,b])=>{let[c,d]=a.split("|"),f=[];b.has("shubuh")&&f.push("shubuh = NULL"),b.has("dzuhur")&&f.push("dzuhur = NULL"),b.has("ashar")&&f.push("ashar = NULL"),b.has("maghrib")&&f.push("maghrib = NULL"),b.has("isya")&&f.push("isya = NULL"),e.push({sql:`UPDATE absen_berjamaah SET ${f.join(", ")} WHERE santri_id = ? AND tanggal = ?`,params:[c,d]}),e.push({sql:"DELETE FROM absen_berjamaah WHERE santri_id = ? AND tanggal = ? AND shubuh IS NULL AND dzuhur IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL",params:[c,d]})});for(let a=0;a<e.length;a+=50)await (0,f.vA)(e.slice(a,a+50));return{success:!0,count:c.length}}async function s(a){if(!a||!a.length)return{success:!0,count:0};let b=await (0,g.Ht)(),c=b?.id||null,d=a.map(a=>({sql:`
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, ashar, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = COALESCE(absen_berjamaah.shubuh, excluded.shubuh),
        ashar  = COALESCE(absen_berjamaah.ashar, excluded.ashar)
    `,params:[a.santri_id,a.tanggal,a.shubuh||null,a.ashar||null,c]}));try{for(let a=0;a<d.length;a+=50){let b=d.slice(a,a+50);await (0,f.vA)(b)}return{success:!0,count:a.length}}catch(a){return{error:a.message}}}(0,i.D)([k,l,m,n,o,p,q,r,s]),(0,e.A)(k,"00c5228da427b0dc3f5db313bee80afbc79adabc59",null),(0,e.A)(l,"4032c0379df19752379940c5537bf7deebaafef8c2",null),(0,e.A)(m,"7002cb31dba4e34cc007949fd627739cbd88fea199",null),(0,e.A)(n,"40881aaa8e9267a4da9b747337ad65989fdc893db1",null),(0,e.A)(o,"701a94538334c754a0ee4e2478afc7c63a9b139d74",null),(0,e.A)(p,"4066bdef5a0a0d471c493e544e4a46e8cbf1d3f922",null),(0,e.A)(q,"702e778475e5617e599dc54e7f878331e75840ea3d",null),(0,e.A)(r,"4098d3881f47a51c9f7dee2c2d95355646023e6522",null),(0,e.A)(s,"40fc20a18afcbfb416bb388b51e72e56dd8f03a637",null)},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},46674:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("x",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]])},51214:(a,b,c)=>{c.d(b,{O5:()=>e});let d=["AL-BAGHORY"];function e(a){return d.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!d.includes(a))},55743:(a,b,c)=>{c.d(b,{HA:()=>j,Yf:()=>h,ZW:()=>i,hj:()=>g});var d=c(44075),e=c(23755);function f(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function g(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(f)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function h(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let f=(0,e.XV)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,d.Zy)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1
       LIMIT 1`,[b,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function i(a,b){return h(await (0,e.Ht)(),a,b)}async function j(a,b){let c=await (0,e.Ht)(),d=await h(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},80343:(a,b,c)=>{c.d(b,{A:()=>e});var d=c(99829);let e=(0,d.createServerReference)("00c5228da427b0dc3f5db313bee80afbc79adabc59",d.callServer,void 0,d.findSourceMapURL,"getSessionRekap")},84009:(a,b,c)=>{c.d(b,{DashboardPageHeader:()=>f});var d=c(48249),e=c(33191);function f({title:a,description:b,action:c,className:f}){return(0,d.jsxs)("div",{className:(0,e.cn)("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",f),children:[(0,d.jsxs)("div",{className:"min-w-0",children:[(0,d.jsx)("h1",{className:"text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem]",children:a}),(0,d.jsx)("p",{className:"mt-1 text-sm leading-5 text-slate-500",children:b})]}),c?(0,d.jsx)("div",{className:"w-full sm:w-auto sm:shrink-0",children:c}):null]})}}};