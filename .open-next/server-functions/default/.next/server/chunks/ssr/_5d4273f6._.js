module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},52201,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);async function g(a){return(0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            s.nama_ayah, s.alamat,
            k.nama_kelas,
            COUNT(p.id) AS jumlah_pelanggaran
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     LEFT JOIN pelanggaran p ON p.santri_id = s.id
     WHERE s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis = ?)
     GROUP BY s.id
     LIMIT 8`,[`%${a}%`,a])}async function h(a){return(0,d.query)(`SELECT p.id, p.tanggal, p.deskripsi, p.jenis, p.poin
     FROM pelanggaran p
     WHERE p.santri_id = ?
     ORDER BY p.tanggal DESC`,[a])}async function i(a){let b=await (0,d.queryOne)(`SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,[a]);return b?({SP1:"SP2",SP2:"SP3",SP3:"SK",SK:"SK"})[b.level]??"SP1":"SP1"}async function j(a,b,c){let g=await (0,e.getSession)();if(!g)return{error:"Tidak terautentikasi"};if(0===b.length)return{error:"Pilih minimal 1 pelanggaran"};let h=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,[h,a,JSON.stringify(b),c,g.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0,id:h}}async function k(a,b,c,g){let h=await (0,e.getSession)();if(!h)return{error:"Tidak terautentikasi"};let i=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[i,a,b,c,g||null,h.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0,id:i}}async function l(a){let{search:b,asrama:c,jenis:e,page:f=1}=a,g=[],h=[];b&&(g.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),h.push(`%${b}%`,`%${b}%`)),c&&(g.push("s.asrama = ?"),h.push(c));let i=g.length?`AND ${g.join(" AND ")}`:"",j=e&&"pernyataan"!==e?"AND 0=1":"",k=!e||["SP1","SP2","SP3","SK"].includes(e)?e&&"pernyataan"!==e?`AND sp.level = '${e}'`:"":"AND 0=1",l=`
    SELECT
      'pernyataan' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      sp.pelanggaran_ids AS detail,
      NULL AS level,
      NULL AS catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_pernyataan sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${i} ${j}

    UNION ALL

    SELECT
      'perjanjian' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      NULL AS detail,
      sp.level,
      sp.catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_perjanjian sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${i} ${k}
  `,m=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM (${l}) t`,[...h,...h]),n=m?.total??0;return{rows:await (0,d.query)(`SELECT * FROM (${l}) t ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...h,...h,30,(f-1)*30]),total:n,page:f,totalPages:Math.ceil(n/30)}}async function m(a,b){if("pernyataan"===b){let b=await (0,d.queryOne)(`SELECT sp.id, sp.tanggal, sp.pelanggaran_ids,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_pernyataan sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,[a]);if(!b)return null;let c=JSON.parse(b.pelanggaran_ids||"[]");return{tipe:"pernyataan",surat:b,pelanggaran:c.length?await (0,d.query)(`SELECT id, tanggal, deskripsi, jenis, poin FROM pelanggaran
           WHERE id IN (${c.map(()=>"?").join(",")}) ORDER BY tanggal ASC`,c):[]}}{let b=await (0,d.queryOne)(`SELECT sp.id, sp.tanggal, sp.level, sp.catatan,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_perjanjian sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,[a]);return b?{tipe:"perjanjian",surat:b,pelanggaran:[]}:null}}async function n(a,b){let c=await (0,e.getSession)();return c&&["admin","keamanan","dewan_santri"].includes(c.role)?(await (0,d.execute)(`DELETE FROM ${"pernyataan"===b?"surat_pernyataan":"surat_perjanjian"} WHERE id = ?`,[a]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0}):{error:"Akses ditolak"}}async function o(){return(await (0,d.query)("SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama")).map(a=>a.asrama)}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k,l,m,n,o]),(0,c.registerServerReference)(g,"4016b4081f290ec3b9fd79ed1667796973a28e95e3",null),(0,c.registerServerReference)(h,"40b153973aae9a814014869d2c2fc234e8ff2cc8ee",null),(0,c.registerServerReference)(i,"405aa6d07cc8afbb2dd4cd4b26a4c7bf58b2688c58",null),(0,c.registerServerReference)(j,"70b3065e966032eb613a3ac525b137470a15fba3dd",null),(0,c.registerServerReference)(k,"789d889a8a958888964938a9dd616003c5790b8826",null),(0,c.registerServerReference)(l,"40b999a2fc131a3a1974aa5876145fa6ed7a87a8f1",null),(0,c.registerServerReference)(m,"6045494fdc24209a3c1b1006b47e5b5fb6fdba26a2",null),(0,c.registerServerReference)(n,"60fee665d61f19df3463fef40f92b84680f195c6f7",null),(0,c.registerServerReference)(o,"00f8d1dde2ee73ce047eb7988cad55dfee2ce09041",null),a.s([],72377),a.i(72377),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00f8d1dde2ee73ce047eb7988cad55dfee2ce09041",()=>o,"4016b4081f290ec3b9fd79ed1667796973a28e95e3",()=>g,"405aa6d07cc8afbb2dd4cd4b26a4c7bf58b2688c58",()=>i,"40b153973aae9a814014869d2c2fc234e8ff2cc8ee",()=>h,"40b999a2fc131a3a1974aa5876145fa6ed7a87a8f1",()=>l,"6045494fdc24209a3c1b1006b47e5b5fb6fdba26a2",()=>m,"60fee665d61f19df3463fef40f92b84680f195c6f7",()=>n,"70b3065e966032eb613a3ac525b137470a15fba3dd",()=>j,"789d889a8a958888964938a9dd616003c5790b8826",()=>k],52201)}];

//# sourceMappingURL=_5d4273f6._.js.map