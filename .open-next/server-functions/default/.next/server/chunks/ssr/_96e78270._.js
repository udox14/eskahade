module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},86529,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558),g=a.i(13095);async function h(){let a=await (0,e.getSession)();return a?{mapel:await (0,d.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),kelas:(0,e.hasAnyRole)(a,["admin","sekpen","akademik"])?await (0,d.query)(`
      SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
      FROM kelas k
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      ORDER BY k.nama_kelas
    `):(0,e.hasRole)(a,"wali_kelas")?await (0,d.query)(`
      SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
      FROM kelas k
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE k.wali_kelas_id = ?
      ORDER BY k.nama_kelas
    `,[a.id]):[]}:{mapel:[],kelas:[]}}async function i(a){return(await (0,d.query)(`
    SELECT rp.id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[a])).map(a=>({riwayat_id:a.id,nis:a.nis,nama:a.nama_lengkap}))}async function j(a,b,c){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, na.nilai
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akademik na ON na.riwayat_pendidikan_id = rp.id 
         AND na.mapel_id = ? AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,c,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,nilai:a.nilai??0}))}async function k(a,b,c){return c.length?(await (0,d.batch)(c.map(c=>({sql:`INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,params:[(0,d.generateId)(),c.riwayat_id,b,a,c.nilai]}))),(0,f.revalidatePath)("/dashboard/akademik/nilai"),{success:!0,count:c.length}):{error:"Tidak ada data."}}async function l(a,b,c,e){let g=await i(a),h=new Map;g.forEach(a=>h.set(String(a.nis).trim(),a.riwayat_id));let j=new Map;e.forEach(a=>j.set(a.nama.toUpperCase().trim(),a.id));let k=[],l=[],m=[],n=[];if(c.forEach((a,c)=>{let d=String(a.NIS||a.nis||"").trim(),e=h.get(d);if(!e)return void n.push(`Baris ${c+2}: NIS '${d}' tidak ditemukan.`);Object.keys(a).forEach(c=>{let d=c.toUpperCase().trim(),f=j.get(d);if(f){let d=Number(a[c]);!isNaN(d)&&d>=0&&d<=100&&k.push({riwayatId:e,mapelId:f,semester:b,nilai:d})}});let f=b=>{let c=Number(a[b]||a[b.toLowerCase()]);return isNaN(c)?80:Math.min(100,Math.max(0,c))};(void 0!==a.KEDISIPLINAN||void 0!==a.IBADAH)&&l.push({riwayatId:e,semester:b,kedisiplinan:f("KEDISIPLINAN"),kebersihan:f("KEBERSIHAN"),kesopanan:f("KESOPANAN"),ibadah:f("IBADAH"),kemandirian:f("KEMANDIRIAN")});let g=String(a["CATATAN WALI KELAS"]||a.catatan_wali_kelas||"").trim();g&&m.push({riwayatId:e,semester:b,catatan:g})}),n.length>0)return{error:`Ditemukan masalah:
${n.slice(0,5).join("\n")}`};let o=[];if(k.length>0&&o.push(...k.map(a=>({sql:`INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,params:[(0,d.generateId)(),a.riwayatId,a.mapelId,a.semester,a.nilai]}))),l.length>0&&o.push(...l.map(a=>({sql:`INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
              kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
              kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,params:[(0,d.generateId)(),a.riwayatId,a.semester,a.kedisiplinan,a.kebersihan,a.kesopanan,a.ibadah,a.kemandirian]}))),m.length>0)for(let a of m)await (0,d.execute)(`
        INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
      `,[(0,d.generateId)(),a.riwayatId,a.semester,a.catatan]);return o.length>0&&await (0,d.batch)(o),(0,f.revalidatePath)("/dashboard/akademik/nilai"),(0,f.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}}async function m(a,b){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap,
           na.kedisiplinan, na.kebersihan, na.kesopanan, na.ibadah, na.kemandirian
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akhlak na ON na.riwayat_pendidikan_id = rp.id AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,kedisiplinan:a.kedisiplinan??80,kebersihan:a.kebersihan??80,kesopanan:a.kesopanan??80,ibadah:a.ibadah??80,kemandirian:a.kemandirian??80}))}let n=[{key:"kedisiplinan",label:"Akhlak/Budi Pekerti"},{key:"ibadah",label:"Ketekunan Ibadah"},{key:"kesopanan",label:"Kerapihan"},{key:"kebersihan",label:"Kebersihan"},{key:"kemandirian",label:"Kemandirian"}];async function o(a,b){return b.length?(await (0,d.batch)(b.map(b=>({sql:`INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
            kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
            kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,params:[(0,d.generateId)(),b.riwayat_id,a,b.kedisiplinan,b.kebersihan,b.kesopanan,b.ibadah,b.kemandirian]}))),(0,f.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}):{error:"Tidak ada data."}}async function p(a,b){return(await (0,d.query)(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a])).map(a=>({riwayat_id:a.riwayat_id,nis:a.nis,nama:a.nama_lengkap,catatan_wali_kelas:a.catatan_wali_kelas??""}))}async function q(a,b){if(!b.length)return{error:"Tidak ada data."};for(let c of b)await (0,d.execute)(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
    `,[(0,d.generateId)(),c.riwayat_id,a,c.catatan]);return(0,f.revalidatePath)("/dashboard/laporan/rapor"),{success:!0}}(0,g.ensureServerEntryExports)([h,i,j,k,l,m,o,p,q,n]),(0,c.registerServerReference)(h,"003ce72a930f22fd1e7261eb40f6a983baccfdb3c1",null),(0,c.registerServerReference)(i,"407d7a6ea528dc32b0f2fe038144ee38aed7c995ae",null),(0,c.registerServerReference)(j,"703e538464bc08da88079bdcbc3ec1e6d2e1234c5a",null),(0,c.registerServerReference)(k,"7091ab07885f3f164ab98a377e267681b4486e1e89",null),(0,c.registerServerReference)(l,"78f9d20eb8e1826052699a6f81120d1bcc1026f36c",null),(0,c.registerServerReference)(m,"60a40d6ad2e075350cf7ea0d6b7376f9441cec9166",null),(0,c.registerServerReference)(o,"6098408fe4642d9e4560b17e2d804084bdd0b021b8",null),(0,c.registerServerReference)(p,"608b2c52e2d6cbe9655a726714060e884c91fb0d84",null),(0,c.registerServerReference)(q,"604edd15057dfac17a0424676b8e865ca0e389c3fb",null),(0,c.registerServerReference)(n,"7fa3701e15cd38d5b6d149199f25edc74f41e54a01",null),a.s([],40768),a.i(40768),a.s(["003ce72a930f22fd1e7261eb40f6a983baccfdb3c1",()=>h,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"407d7a6ea528dc32b0f2fe038144ee38aed7c995ae",()=>i,"604edd15057dfac17a0424676b8e865ca0e389c3fb",()=>q,"608b2c52e2d6cbe9655a726714060e884c91fb0d84",()=>p,"6098408fe4642d9e4560b17e2d804084bdd0b021b8",()=>o,"60a40d6ad2e075350cf7ea0d6b7376f9441cec9166",()=>m,"703e538464bc08da88079bdcbc3ec1e6d2e1234c5a",()=>j,"7091ab07885f3f164ab98a377e267681b4486e1e89",()=>k,"78f9d20eb8e1826052699a6f81120d1bcc1026f36c",()=>l,"7fa3701e15cd38d5b6d149199f25edc74f41e54a01",0,n],86529)}];

//# sourceMappingURL=_96e78270._.js.map