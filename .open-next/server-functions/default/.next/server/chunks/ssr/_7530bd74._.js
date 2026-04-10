module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},87994,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(18558);async function f(){let a=await (0,d.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null}:null}async function g(){return(0,c.queryOne)(`
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
     WHERE id = ? AND status_datang = 'SUDAH'`,[f.id,a]),(0,e.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function s(a){let b=await (0,d.getSession)();if(!b||!["admin","keamanan","dewan_santri"].includes(b.role))return{error:"Akses ditolak"};let f=await (0,c.queryOne)("SELECT tgl_selesai_datang FROM perpulangan_periode WHERE id = ?",[a]);if(!f)return{error:"Periode tidak ditemukan."};if(new Date().toISOString().slice(0,10)<=f.tgl_selesai_datang)return{error:"Periode kedatangan belum selesai."};let g=await (0,c.query)(`SELECT id FROM perpulangan_log
     WHERE periode_id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,[a]);return g.length?(await (0,c.batch)(g.map(a=>({sql:"UPDATE perpulangan_log SET status_datang = 'TELAT', updated_by = ? WHERE id = ?",params:[b.id,a.id]}))),(0,e.revalidatePath)("/dashboard/asrama/perpulangan/monitoring"),{success:!0,count:g.length}):{success:!0,count:0}}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i,l,m,n,o,p,q,r,s]),(0,b.registerServerReference)(f,"006e47a6e6cbe6826670fbc89c7837d02ecfa752d2",null),(0,b.registerServerReference)(g,"00e970d87e02418e0ae1c2311279ad9b58b10ba28d",null),(0,b.registerServerReference)(h,"405dad01f9f2f1cdcbf6abc0c4ae4c52954775ef6e",null),(0,b.registerServerReference)(i,"7080191980dc43cce57be2d40d0f870add356e2c67",null),(0,b.registerServerReference)(l,"703e74f0ff9d7b23f65d8019bc8f68a7e28a3989cc",null),(0,b.registerServerReference)(m,"60db9aecaf9d3f0f8bc1fbfc63c732be538aea1ab7",null),(0,b.registerServerReference)(n,"78fd26d897ddc6fa0b5a45a9123010d055ea626782",null),(0,b.registerServerReference)(o,"60122654268b9da92e0cbe8e58f8c2b4a967e9ab01",null),(0,b.registerServerReference)(p,"60abfa7f40551a73f99b04572524cff0f090c5d9b3",null),(0,b.registerServerReference)(q,"606559e52b58f192a1d0d40a16ae1c8a99914f91cd",null),(0,b.registerServerReference)(r,"602dbf84964fdd0cdd670e6122421640232cd0e8f8",null),(0,b.registerServerReference)(s,"407d2b7146d5259931f7a9cae2d2a0b0a751bb1be4",null),a.s(["batalDatang",()=>r,"batalPulang",()=>m,"getDataKamarPerpulangan",()=>i,"getKamarsPerpulangan",()=>h,"getPeriodeAktif",()=>g,"getSessionInfo",()=>f,"konfirmasiDatang",()=>q,"konfirmasiPulang",()=>l,"konfirmasiRombonganKamar",()=>n,"tandaiTelatMassal",()=>s,"updateJenisPulang",()=>o,"updateKeterangan",()=>p])},19899,a=>{"use strict";var b=a.i(24895),c=a.i(87994);a.s([],113),a.i(113),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"006e47a6e6cbe6826670fbc89c7837d02ecfa752d2",()=>c.getSessionInfo,"00e970d87e02418e0ae1c2311279ad9b58b10ba28d",()=>c.getPeriodeAktif,"405dad01f9f2f1cdcbf6abc0c4ae4c52954775ef6e",()=>c.getKamarsPerpulangan,"60122654268b9da92e0cbe8e58f8c2b4a967e9ab01",()=>c.updateJenisPulang,"602dbf84964fdd0cdd670e6122421640232cd0e8f8",()=>c.batalDatang,"606559e52b58f192a1d0d40a16ae1c8a99914f91cd",()=>c.konfirmasiDatang,"60abfa7f40551a73f99b04572524cff0f090c5d9b3",()=>c.updateKeterangan,"60db9aecaf9d3f0f8bc1fbfc63c732be538aea1ab7",()=>c.batalPulang,"703e74f0ff9d7b23f65d8019bc8f68a7e28a3989cc",()=>c.konfirmasiPulang,"7080191980dc43cce57be2d40d0f870add356e2c67",()=>c.getDataKamarPerpulangan,"78fd26d897ddc6fa0b5a45a9123010d055ea626782",()=>c.konfirmasiRombonganKamar],19899)}];

//# sourceMappingURL=_7530bd74._.js.map