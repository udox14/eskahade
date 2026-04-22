module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},87994,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(18558);async function f(){let a=await (0,d.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null}:null}async function g(){return(0,c.queryOne)(`
    SELECT id, nama_periode,
           tgl_mulai_pulang, tgl_selesai_pulang,
           tgl_mulai_datang, tgl_selesai_datang
    FROM perpulangan_periode
    WHERE is_active = 1
    LIMIT 1
  `)}async function h(a){return(await (0,c.query)(`SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function i(a,b,e){let f=await (0,d.getSession)();if(!f)return[];let g=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           s.kab_kota, s.alamat,
           pl.id         AS log_id,
           pl.jenis_pulang,
           pl.status_pulang,
           pl.keterangan,
           pl.tgl_pulang,
           pl.status_datang,
           pl.tgl_datang
    FROM santri s
    LEFT JOIN perpulangan_log pl
      ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `,[e,a,b]),h=g.filter(a=>null===a.log_id);return h.length>0?(await (0,c.batch)(h.map(a=>{var b,d;let g;return{sql:`INSERT OR IGNORE INTO perpulangan_log
              (id, santri_id, periode_id, jenis_pulang, status_pulang, status_datang, created_by)
            VALUES (?, ?, ?, ?, 'BELUM', 'BELUM', ?)`,params:[(0,c.generateId)(),a.id,e,(b=a.kab_kota,d=a.alamat,(g=(b||d||"").toLowerCase().trim())?g.includes("tasikmalaya")?"DIJEMPUT":"ROMBONGAN":"DIJEMPUT"),f.id]}})),await (0,c.query)(`
      SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
             pl.id         AS log_id,
             pl.jenis_pulang,
             pl.status_pulang,
             pl.keterangan,
             pl.tgl_pulang,
             pl.status_datang,
             pl.tgl_datang
      FROM santri s
      LEFT JOIN perpulangan_log pl
        ON pl.santri_id = s.id AND pl.periode_id = ?
      WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
      ORDER BY s.nama_lengkap
    `,[e,a,b])):g}async function j(a){let b=new Date().toISOString().slice(0,10),d=await (0,c.queryOne)("SELECT tgl_mulai_pulang, tgl_selesai_pulang FROM perpulangan_periode WHERE id = ? AND is_active = 1",[a]);return d?b<d.tgl_mulai_pulang||b>d.tgl_selesai_pulang?`Di luar periode perpulangan (${d.tgl_mulai_pulang} s/d ${d.tgl_selesai_pulang}).`:null:"Tidak ada periode aktif."}async function k(a){let b=new Date().toISOString().slice(0,10),d=await (0,c.queryOne)("SELECT tgl_mulai_datang, tgl_selesai_datang FROM perpulangan_periode WHERE id = ? AND is_active = 1",[a]);return d?b<d.tgl_mulai_datang||b>d.tgl_selesai_datang?`Di luar periode kedatangan (${d.tgl_mulai_datang} s/d ${d.tgl_selesai_datang}).`:null:"Tidak ada periode aktif."}async function l(a,b,f){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};let h=await j(b);return h?{error:h}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'BELUM'`,[f||null,(0,c.now)(),g.id,a]),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function m(a,b){let f=await (0,d.getSession)();if(!f)return{error:"Unauthorized"};let g=await j(b);return g?{error:g}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_pulang = 'BELUM', keterangan = NULL, tgl_pulang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'BELUM'`,[f.id,a]),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function n(a,b,f,g){let h=await (0,d.getSession)();if(!h)return{error:"Unauthorized"};let i=await j(a);if(i)return{error:i};let k=await (0,c.query)(`SELECT pl.id
     FROM perpulangan_log pl
     JOIN santri s ON s.id = pl.santri_id
     WHERE pl.periode_id = ?
       AND pl.jenis_pulang = 'ROMBONGAN'
       AND pl.status_pulang = 'BELUM'
       AND s.asrama = ? AND s.kamar = ?`,[a,b,f]);if(!k.length)return{success:!0,count:0};let l=(0,c.now)();return await (0,c.batch)(k.map(a=>({sql:`UPDATE perpulangan_log
          SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
          WHERE id = ?`,params:[g||"Rombongan",l,h.id,a.id]}))),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0,count:k.length}}async function o(a,b){let e=await (0,d.getSession)();return e?(await (0,c.execute)("UPDATE perpulangan_log SET jenis_pulang = ?, updated_by = ? WHERE id = ?",[b,e.id,a]),{success:!0}):{error:"Unauthorized"}}async function p(a,b){let e=await (0,d.getSession)();return e?(await (0,c.execute)("UPDATE perpulangan_log SET keterangan = ?, updated_by = ? WHERE id = ?",[b||null,e.id,a]),{success:!0}):{error:"Unauthorized"}}async function q(a,b){let f=await (0,d.getSession)();if(!f)return{error:"Unauthorized"};let g=await k(b);return g?{error:g}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_datang = 'SUDAH', tgl_datang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,[(0,c.now)(),f.id,a]),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function r(a,b){let f=await (0,d.getSession)();if(!f)return{error:"Unauthorized"};let g=await k(b);return g?{error:g}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_datang = 'BELUM', tgl_datang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'SUDAH'`,[f.id,a]),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function s(a){let b=await (0,d.getSession)();if(!b||!(0,d.hasAnyRole)(b,["admin","keamanan","dewan_santri"]))return{error:"Akses ditolak"};let f=await (0,c.queryOne)("SELECT tgl_selesai_datang FROM perpulangan_periode WHERE id = ?",[a]);if(!f)return{error:"Periode tidak ditemukan."};if(new Date().toISOString().slice(0,10)<=f.tgl_selesai_datang)return{error:"Periode kedatangan belum selesai."};let g=await (0,c.query)(`SELECT id FROM perpulangan_log
     WHERE periode_id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,[a]);return g.length?(await (0,c.batch)(g.map(a=>({sql:"UPDATE perpulangan_log SET status_datang = 'TELAT', updated_by = ? WHERE id = ?",params:[b.id,a.id]}))),(0,e.revalidatePath)("/dashboard/asrama/perpulangan/monitoring"),{success:!0,count:g.length}):{success:!0,count:0}}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i,l,m,n,o,p,q,r,s]),(0,b.registerServerReference)(f,"00cf59f652e0b71ff855bac2b28f2f31bbc6cb46ce",null),(0,b.registerServerReference)(g,"00c3d33b40503ae6f6050b47f86a5b144168d73c1f",null),(0,b.registerServerReference)(h,"404f34b09b629f955d84e311d183a337bdb7b2f42f",null),(0,b.registerServerReference)(i,"703c219c2bbd6e8d74d4c1fd217b50afcc6035e87d",null),(0,b.registerServerReference)(l,"7045037108006bc16a8fe61b49b1812ace09fcfac5",null),(0,b.registerServerReference)(m,"6034b18b32c01debaa9692b1e0cb2378e3389cc99a",null),(0,b.registerServerReference)(n,"7869dcada2ac5377257c053db3c984aa79ded43726",null),(0,b.registerServerReference)(o,"6049b22db08e6a42565bbf9b93d154efa3412ed10f",null),(0,b.registerServerReference)(p,"605c1fd560c6f333b7e53ccd90c86eb1ba6555e745",null),(0,b.registerServerReference)(q,"60085d7a3c423eb6328fd7e777a45b633a0e6a70c4",null),(0,b.registerServerReference)(r,"601c63274f772df71914f4fa72784d3c2c0201bde7",null),(0,b.registerServerReference)(s,"40b1479abbd7daa8764abcddd3e57a33d50aa97b07",null),a.s(["batalDatang",()=>r,"batalPulang",()=>m,"getDataKamarPerpulangan",()=>i,"getKamarsPerpulangan",()=>h,"getPeriodeAktif",()=>g,"getSessionInfo",()=>f,"konfirmasiDatang",()=>q,"konfirmasiPulang",()=>l,"konfirmasiRombonganKamar",()=>n,"tandaiTelatMassal",()=>s,"updateJenisPulang",()=>o,"updateKeterangan",()=>p])},19899,a=>{"use strict";var b=a.i(24895),c=a.i(87994);a.s([],113),a.i(113),a.s(["006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"00c3d33b40503ae6f6050b47f86a5b144168d73c1f",()=>c.getPeriodeAktif,"00cf59f652e0b71ff855bac2b28f2f31bbc6cb46ce",()=>c.getSessionInfo,"404f34b09b629f955d84e311d183a337bdb7b2f42f",()=>c.getKamarsPerpulangan,"60085d7a3c423eb6328fd7e777a45b633a0e6a70c4",()=>c.konfirmasiDatang,"601c63274f772df71914f4fa72784d3c2c0201bde7",()=>c.batalDatang,"6034b18b32c01debaa9692b1e0cb2378e3389cc99a",()=>c.batalPulang,"6049b22db08e6a42565bbf9b93d154efa3412ed10f",()=>c.updateJenisPulang,"605c1fd560c6f333b7e53ccd90c86eb1ba6555e745",()=>c.updateKeterangan,"703c219c2bbd6e8d74d4c1fd217b50afcc6035e87d",()=>c.getDataKamarPerpulangan,"7045037108006bc16a8fe61b49b1812ace09fcfac5",()=>c.konfirmasiPulang,"7869dcada2ac5377257c053db3c984aa79ded43726",()=>c.konfirmasiRombonganKamar],19899)}];

//# sourceMappingURL=_7530bd74._.js.map