module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},40621,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);async function g(){return(0,d.query)(`SELECT id, kategori, nama_pelanggaran, poin, deskripsi, urutan
     FROM master_pelanggaran
     ORDER BY CASE kategori WHEN 'RINGAN' THEN 1 WHEN 'SEDANG' THEN 2 WHEN 'BERAT' THEN 3 ELSE 4 END,
              urutan, nama_pelanggaran`)}async function h(a){let b=await (0,e.getSession)();return b&&["admin","keamanan","dewan_santri"].includes(b.role)?(await (0,d.execute)("INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi) VALUES (?, ?, ?, ?)",[a.kategori,a.nama,a.poin,a.deskripsi||null]),(0,f.revalidateTag)("master-pelanggaran","everything"),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0}):{error:"Akses ditolak"}}async function i(a,b){let c=await (0,e.getSession)();return c&&["admin","keamanan","dewan_santri"].includes(c.role)?(await (0,d.execute)("UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, poin=?, deskripsi=? WHERE id=?",[b.kategori,b.nama,b.poin,b.deskripsi||null,a]),(0,f.revalidateTag)("master-pelanggaran","everything"),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0}):{error:"Akses ditolak"}}async function j(a){let b=await (0,e.getSession)();if(!b||!["admin"].includes(b.role))return{error:"Akses ditolak"};let c=await (0,d.queryOne)("SELECT COUNT(*) AS n FROM pelanggaran WHERE master_id=?",[a]);return c&&c.n>0?{error:"Tidak bisa dihapus — sudah dipakai di data pelanggaran"}:(await (0,d.execute)("DELETE FROM master_pelanggaran WHERE id=?",[a]),(0,f.revalidateTag)("master-pelanggaran","everything"),{success:!0})}async function k(a){return(0,d.query)(`SELECT id, nama_lengkap, nis, asrama, kamar, nama_ayah, alamat
     FROM santri
     WHERE status_global = 'aktif'
       AND (nama_lengkap LIKE ? OR nis = ?)
     LIMIT 8`,[`%${a}%`,a])}async function l(a){let b=await (0,e.getSession)();if(!b)return{error:"Tidak terautentikasi"};let c=await (0,d.queryOne)("SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran WHERE id=?",[a.masterId]);if(!c)return{error:"Jenis pelanggaran tidak ditemukan"};let g=a.deskripsiTambahan?`${c.nama_pelanggaran}. ${a.deskripsiTambahan}`:c.nama_pelanggaran;return await (0,d.execute)(`INSERT INTO pelanggaran (id, santri_id, master_id, jenis, deskripsi, tanggal, poin, foto_url, penindak_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,d.generateId)(),a.santriId,a.masterId,c.kategori,g,a.tanggal,c.poin,a.fotoUrl||null,b.id]),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0}}async function m(a){let b=await (0,e.getSession)();if(!b||!["admin","keamanan","dewan_santri"].includes(b.role))return{error:"Akses ditolak"};for(let b of(await (0,d.query)(`SELECT id, pelanggaran_ids FROM surat_pernyataan
     WHERE pelanggaran_ids LIKE ?`,[`%"${a}"%`]))){let c=JSON.parse(b.pelanggaran_ids||"[]").filter(b=>b!==a);0===c.length?await (0,d.execute)("DELETE FROM surat_pernyataan WHERE id=?",[b.id]):await (0,d.execute)("UPDATE surat_pernyataan SET pelanggaran_ids=? WHERE id=?",[JSON.stringify(c),b.id])}return await (0,d.execute)("DELETE FROM pelanggaran WHERE id=?",[a]),(0,f.revalidatePath)("/dashboard/keamanan"),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0}}async function n(a){let{search:b,asrama:c,page:e=1}=a,f=["s.status_global IN ('aktif','keluar')"],g=[];b&&(f.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),g.push(`%${b}%`,`%${b}%`)),c&&(f.push("s.asrama = ?"),g.push(c));let h=f.join(" AND "),i=await (0,d.queryOne)(`SELECT COUNT(DISTINCT p.santri_id) AS total
     FROM pelanggaran p JOIN santri s ON s.id = p.santri_id
     WHERE ${h}`,g),j=i?.total??0;return{rows:await (0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            COUNT(p.id)    AS jumlah_pelanggaran,
            SUM(p.poin)    AS total_poin,
            MAX(p.tanggal) AS terakhir,
            -- Level SP terakhir (ringan: subquery kecil di tabel kecil)
            (SELECT sp.level FROM surat_perjanjian sp
             WHERE sp.santri_id = s.id
             ORDER BY sp.created_at DESC LIMIT 1) AS sp_terakhir
     FROM pelanggaran p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${h}
     GROUP BY p.santri_id
     ORDER BY total_poin DESC, terakhir DESC
     LIMIT ? OFFSET ?`,[...g,30,(e-1)*30]),total:j,page:e,totalPages:Math.ceil(j/30)}}async function o(a){let[b,c,e,f]=await Promise.all([(0,d.queryOne)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
              s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,[a]),(0,d.query)(`SELECT p.id, p.tanggal, p.jenis, p.deskripsi, p.poin, p.foto_url,
              u.full_name AS penindak_nama,
              mp.nama_pelanggaran
       FROM pelanggaran p
       LEFT JOIN users u ON u.id = p.penindak_id
       LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
       WHERE p.santri_id = ?
       ORDER BY p.tanggal DESC, p.created_at DESC`,[a]),(0,d.query)(`SELECT sp.id, sp.tanggal, sp.pelanggaran_ids, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_pernyataan sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,[a]),(0,d.query)(`SELECT sp.id, sp.level, sp.tanggal, sp.catatan, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_perjanjian sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,[a])]);return{profil:b,pelanggaran:c,suratPernyataan:e,suratPerjanjian:f}}async function p(a,b,c){let g=await (0,e.getSession)();if(!g)return{error:"Tidak terautentikasi"};let h=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,[h,a,JSON.stringify(b),c,g.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0,id:h}}async function q(a,b,c,g){let h=await (0,e.getSession)();if(!h)return{error:"Tidak terautentikasi"};let i=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[i,a,b,c,g||null,h.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0,id:i}}async function r(a,b){let[c,e]=await Promise.all([(0,d.queryOne)(`SELECT s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,[a]),b.length>0?(0,d.query)(`SELECT id, tanggal, deskripsi, jenis, poin
           FROM pelanggaran
           WHERE id IN (${b.map(()=>"?").join(",")})
           ORDER BY tanggal ASC`,b):Promise.resolve([])]);return{profil:c,pelanggaran:e}}async function s(a){let b=await (0,d.queryOne)(`SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,[a]);return b?({SP1:"SP2",SP2:"SP3",SP3:"SK",SK:"SK"})[b.level]??"SP1":"SP1"}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k,l,m,n,o,p,q,r,s]),(0,c.registerServerReference)(g,"00f5f1e1f8674a54b7e3c5d3e81cad207494ce7d44",null),(0,c.registerServerReference)(h,"4083cdd60b58be37ef0edcd6bfabcb3f87d3ebf28a",null),(0,c.registerServerReference)(i,"60a9139c9cf526d286ee63ed59e7ee048d881f19c4",null),(0,c.registerServerReference)(j,"4031c3297a25850c438b413e86e6580c21dfe0c89c",null),(0,c.registerServerReference)(k,"400959660b53c2132a1d0ee1abf5763b3e67b2a551",null),(0,c.registerServerReference)(l,"4091f88639fddd82ea7daa363b40cb57c698731b62",null),(0,c.registerServerReference)(m,"409c66e0e7a9d62a83e88ef55ea3657aab6f416f1b",null),(0,c.registerServerReference)(n,"40e8aa0fb45c2dc8825266921e8cce85651e3cb10b",null),(0,c.registerServerReference)(o,"406126b269103857cb31a83ce1d4430828782610ad",null),(0,c.registerServerReference)(p,"703e3f3e3cde2dd2545a54d2ace5c2eba2e37574ef",null),(0,c.registerServerReference)(q,"789978986f872c95ef5f07d63514984d386024fc23",null),(0,c.registerServerReference)(r,"6030a9d0e45fa746a241adb4edbd78684033d5e8bf",null),(0,c.registerServerReference)(s,"40a20a48c44870081ee247df4856d0a0d44b36392a",null),a.s([],2916),a.i(2916),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00f5f1e1f8674a54b7e3c5d3e81cad207494ce7d44",()=>g,"400959660b53c2132a1d0ee1abf5763b3e67b2a551",()=>k,"4031c3297a25850c438b413e86e6580c21dfe0c89c",()=>j,"406126b269103857cb31a83ce1d4430828782610ad",()=>o,"4083cdd60b58be37ef0edcd6bfabcb3f87d3ebf28a",()=>h,"4091f88639fddd82ea7daa363b40cb57c698731b62",()=>l,"409c66e0e7a9d62a83e88ef55ea3657aab6f416f1b",()=>m,"40e8aa0fb45c2dc8825266921e8cce85651e3cb10b",()=>n,"60a9139c9cf526d286ee63ed59e7ee048d881f19c4",()=>i],40621)}];

//# sourceMappingURL=_d48cceb7._.js.map