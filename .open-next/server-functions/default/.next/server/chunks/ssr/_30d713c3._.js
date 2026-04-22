module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},44453,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);function g(a){let b=new Date(a),c=b.getDay();b.setDate(b.getDate()-((c<3?c+7:c)-3)),b.setHours(0,0,0,0);let d=new Date(b),e=new Date(b);return e.setDate(e.getDate()+6),{start:d,end:e}}async function h(a,b){let{start:c,end:e}=g(new Date(b)),f=c.toISOString().split("T")[0],h=e.toISOString().split("T")[0],i=await (0,d.query)(`
    SELECT 
      rp.id, 
      s.id AS santri_id, 
      s.nama_lengkap, 
      s.nis,
      s.asrama,
      s.kamar,
      s.sekolah,
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[a]);return i.length?{santri:i,absensi:await (0,d.query)(`
    SELECT ah.riwayat_pendidikan_id, ah.tanggal, ah.shubuh, ah.ashar, ah.maghrib
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
      AND ah.tanggal >= ? AND ah.tanggal <= ?
  `,[a,f,h])}:{santri:[],absensi:[]}}async function i(a){let b=await (0,e.getSession)();if(!b)return{error:"Unauthorized"};let c=[],g=[];for(let b of a){let a=b.shubuh||"H",d=b.ashar||"H",e=b.maghrib||"H";"H"===a&&"H"===d&&"H"===e?c.push({riwayat_id:b.riwayat_id,tanggal:b.tanggal}):g.push({riwayat_id:b.riwayat_id,tanggal:b.tanggal,s:a,a:d,m:e})}for(let a of c)await (0,d.execute)("DELETE FROM absensi_harian WHERE riwayat_pendidikan_id = ? AND tanggal = ?",[a.riwayat_id,a.tanggal]);for(let a of g)await (0,d.execute)(`
      INSERT INTO absensi_harian (id, riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, tanggal) DO UPDATE SET
        shubuh = excluded.shubuh,
        ashar = excluded.ashar,
        maghrib = excluded.maghrib,
        created_by = excluded.created_by
    `,[(0,d.generateId)(),a.riwayat_id,a.tanggal,a.s,a.a,a.m,b.id]);return(0,f.revalidatePath)("/dashboard/akademik/absensi"),{success:!0}}async function j(){return(await (0,d.query)("SELECT id, nama_kelas FROM kelas ORDER BY nama_kelas")).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function k(a){let{start:b,end:c}=g(new Date(a)),e=b.toISOString().split("T")[0],f=c.toISOString().split("T")[0],h=await (0,d.query)(`
    WITH ProblemStudents AS (
      SELECT DISTINCT riwayat_pendidikan_id
      FROM absensi_harian
      WHERE tanggal >= ? AND tanggal <= ?
        AND (shubuh = 'A' OR ashar = 'A' OR maghrib = 'A')
    )
    SELECT 
      rp.id, 
      s.nama_lengkap, 
      s.asrama, 
      s.kamar, 
      s.sekolah, 
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren,
      ah.tanggal,
      ah.shubuh,
      ah.ashar,
      ah.maghrib
    FROM ProblemStudents ps
    JOIN riwayat_pendidikan rp ON rp.id = ps.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN absensi_harian ah ON ah.riwayat_pendidikan_id = ps.riwayat_pendidikan_id
      AND ah.tanggal >= ? AND ah.tanggal <= ?
    ORDER BY s.nama_lengkap
  `,[e,f,e,f]),i=new Map,j={};return h.forEach(a=>{i.has(a.id)||i.set(a.id,{id:a.id,nama_lengkap:a.nama_lengkap,asrama:a.asrama,kamar:a.kamar,sekolah:a.sekolah,kelas_sekolah:a.kelas_sekolah,kelas_pesantren:a.kelas_pesantren}),a.tanggal&&(j[a.id]||(j[a.id]={}),j[a.id][a.tanggal]={shubuh:a.shubuh,ashar:a.ashar,maghrib:a.maghrib})}),{santri:Array.from(i.values()),absensi:j}}(0,a.i(13095).ensureServerEntryExports)([h,i,j,k]),(0,c.registerServerReference)(h,"607ed063823538168fd47e835b7e793aa922637074",null),(0,c.registerServerReference)(i,"40312d4b0d4690513ec1f9b7a841186fcef53183b2",null),(0,c.registerServerReference)(j,"001a4141ec93ed8d192e0cf57b656a1fe433f42a4d",null),(0,c.registerServerReference)(k,"4040e3817ee593090253ad32bc6801183c2da68049",null),a.s([],42957),a.i(42957),a.s(["001a4141ec93ed8d192e0cf57b656a1fe433f42a4d",()=>j,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"40312d4b0d4690513ec1f9b7a841186fcef53183b2",()=>i,"4040e3817ee593090253ad32bc6801183c2da68049",()=>k,"607ed063823538168fd47e835b7e793aa922637074",()=>h],44453)}];

//# sourceMappingURL=_30d713c3._.js.map