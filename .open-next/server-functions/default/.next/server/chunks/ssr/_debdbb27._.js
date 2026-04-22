module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},68476,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(13095);let f=["ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4"];async function g(){let a=await (0,d.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null,isPutri:f.includes(a.asrama_binaan||"")}:null}async function h(a){return(await (0,c.query)(`
    SELECT DISTINCT kamar FROM santri 
    WHERE asrama = ? AND status_global = 'aktif'
  `,[a])).map(a=>a.kamar||"Tanpa Kamar").sort((a,b)=>(parseInt(a)||999)-(parseInt(b)||999))}async function i(a,b){let[d,e]=b.split("-"),f=`${d}-${e}-01`,g=`${d}-${e}-31`,h=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `,[a]);if(!h.length)return{santriList:[],alfaPerSantri:{},detailPerSantri:{}};let i=await (0,c.query)(`
    SELECT a.santri_id, a.tanggal, a.status FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ? AND s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY a.tanggal
  `,[f,g,a]),j={},k={};return i.forEach(a=>{j[a.santri_id]||(j[a.santri_id]={}),j[a.santri_id][a.tanggal]=a.status,"ALFA"===a.status&&(k[a.santri_id]=(k[a.santri_id]||0)+1)}),{santriList:h,alfaPerSantri:k,detailPerSantri:j}}async function j(a,b,d){let[e,f]=b.split("-"),g=`${e}-${f}-01`,h=`${e}-${f}-31`,i=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `,[a]);if(!i.length)return{santriList:[],detail:{}};let j=await (0,c.query)(`
    SELECT a.santri_id, a.tanggal, a.shubuh, a.ashar, a.maghrib, a.isya FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ? AND s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY a.tanggal
  `,[g,h,a]),k={};return j.forEach(a=>{k[a.santri_id]||(k[a.santri_id]={}),k[a.santri_id][a.tanggal]={shubuh:d&&"H"===a.shubuh?"S":a.shubuh,ashar:d&&"H"===a.ashar?"S":a.ashar,maghrib:d&&"H"===a.maghrib?"S":a.maghrib,isya:d&&"H"===a.isya?"S":a.isya}}),{santriList:i,detail:k}}async function k(a){return(0,c.query)(`
    SELECT id, nama_lengkap, nis, kamar FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY CAST(kamar AS INTEGER), nama_lengkap
  `,[a])}async function l(a,b,d){let e=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           a.tanggal, a.shubuh, a.ashar, a.maghrib, a.isya
    FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND (a.shubuh = 'A' OR a.ashar = 'A' OR a.maghrib = 'A' OR a.isya = 'A')
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `,[b,d,a]),f={},g={};return e.forEach(a=>{f[a.id]||(f[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar}),g[a.id]||(g[a.id]={}),g[a.id][a.tanggal]={shubuh:"A"===a.shubuh?"A":null,ashar:"A"===a.ashar?"A":null,maghrib:"A"===a.maghrib?"A":null,isya:"A"===a.isya?"A":null}}),{santriList:Object.values(f),detail:g}}async function m(a){if(!a.length)return{success:!0,count:0};let b=new Set(["shubuh","ashar","maghrib","isya"]),d=a.filter(a=>b.has(a.waktu));if(!d.length)return{success:!0,count:0};let e={};d.forEach(a=>{let b=`${a.santriId}|${a.tanggal}`;e[b]||(e[b]=new Set),e[b].add(a.waktu)});let f=[];Object.entries(e).forEach(([a,b])=>{let[c,d]=a.split("|"),e=[];b.has("shubuh")&&e.push("shubuh = NULL"),b.has("ashar")&&e.push("ashar = NULL"),b.has("maghrib")&&e.push("maghrib = NULL"),b.has("isya")&&e.push("isya = NULL"),f.push({sql:`UPDATE absen_berjamaah SET ${e.join(", ")} WHERE santri_id = ? AND tanggal = ?`,params:[c,d]}),f.push({sql:"DELETE FROM absen_berjamaah WHERE santri_id = ? AND tanggal = ? AND shubuh IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL",params:[c,d]})});for(let a=0;a<f.length;a+=50)await (0,c.batch)(f.slice(a,a+50));return{success:!0,count:d.length}}async function n(a){if(!a||!a.length)return{success:!0,count:0};let b=await (0,d.getSession)(),e=b?.id||null,f=a.map(a=>({sql:`
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, ashar, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = COALESCE(absen_berjamaah.shubuh, excluded.shubuh),
        ashar  = COALESCE(absen_berjamaah.ashar, excluded.ashar)
    `,params:[a.santri_id,a.tanggal,a.shubuh||null,a.ashar||null,e]}));try{for(let a=0;a<f.length;a+=50){let b=f.slice(a,a+50);await (0,c.batch)(b)}return{success:!0,count:a.length}}catch(a){return{error:a.message}}}(0,e.ensureServerEntryExports)([g,h,i,j,k,l,m,n]),(0,b.registerServerReference)(g,"0067066001b21cd0b9bbd7e1ab32c8363d4651f01e",null),(0,b.registerServerReference)(h,"40f1dc92ebff13ad417175800d41dcb780e11829d2",null),(0,b.registerServerReference)(i,"60da06eb6b913a504bba6d6dbd269d7cbe56ab3965",null),(0,b.registerServerReference)(j,"70d1d4309ae54cafb78b31116feccd32508a627709",null),(0,b.registerServerReference)(k,"40c35b2e442906d5a916b4eff6ce296124e08d88f6",null),(0,b.registerServerReference)(l,"702e6370017b49fc603c532064b97d6f9a0d022559",null),(0,b.registerServerReference)(m,"4074f388175613b957be4c2ef74f46bbea13395d3f",null),(0,b.registerServerReference)(n,"40f359e74d9767255ffc2d69d6a49289f11c6ab900",null),a.s(["deleteAbsenBerjamaahRecords",()=>m,"getKamarList",()=>h,"getRekapAbsenBerjamaah",()=>j,"getRekapAbsenMalam",()=>i,"getRekapBerjamaahAlfaRange",()=>l,"getSantriByAsrama",()=>k,"getSessionRekap",()=>g,"importAbsenBerjamaahFingerprint",()=>n])},59553,a=>{"use strict";var b=a.i(24895),c=a.i(68476);a.s([],11331),a.i(11331),a.s(["0067066001b21cd0b9bbd7e1ab32c8363d4651f01e",()=>c.getSessionRekap,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"40f1dc92ebff13ad417175800d41dcb780e11829d2",()=>c.getKamarList,"60da06eb6b913a504bba6d6dbd269d7cbe56ab3965",()=>c.getRekapAbsenMalam],59553)}];

//# sourceMappingURL=_debdbb27._.js.map