module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},2856,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);async function g(){return(await (0,d.query)(`SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`)).map(a=>a.asrama)}function h(a){let b=[],c=[];if(a.asrama&&"SEMUA"!==a.asrama&&(b.push("s.asrama = ?"),c.push(a.asrama)),a.search&&(b.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),c.push(`%${a.search}%`,`%${a.search}%`)),a.tglAwal&&a.tglAkhir){let d=new Date(`${a.tglAwal}T00:00:00+07:00`).toISOString(),e=new Date(`${a.tglAkhir}T23:59:59+07:00`).toISOString();b.push("p.tgl_mulai <= ? AND (p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)"),c.push(e,d)}else if(a.tglAwal){let d=new Date(`${a.tglAwal}T00:00:00+07:00`).toISOString();b.push("(p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)"),c.push(d)}else if(a.tglAkhir){let d=new Date(`${a.tglAkhir}T23:59:59+07:00`).toISOString();b.push("p.tgl_mulai <= ?"),c.push(d)}return"BELUM_KEMBALI"===a.statusFilter?b.push("p.status = 'AKTIF'"):"SUDAH_KEMBALI"===a.statusFilter?b.push("p.status = 'KEMBALI'"):"TERLAMBAT"===a.statusFilter?(b.push("((p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana) OR (p.status = 'AKTIF' AND p.tgl_selesai_rencana < ?))"),c.push(new Date().toISOString())):"TEPAT_WAKTU"===a.statusFilter&&b.push("p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana"),{clauses:b,baseParams:c}}async function i(a){let{page:b=1,pageSize:c=10,...e}=a,{clauses:f,baseParams:g}=h(e),i=f.length>0?f.join(" AND "):"1=1",j=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM perizinan p JOIN santri s ON s.id = p.santri_id WHERE ${i}`,g),k=j?.total??0;return{rows:await (0,d.query)(`SELECT p.id, p.created_at, p.status, p.jenis, p.alasan, p.pemberi_izin,
            p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
            s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar
     FROM perizinan p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${i}
     ORDER BY p.status ASC, p.created_at DESC
     LIMIT ? OFFSET ?`,[...g,c,(b-1)*c]),total:k,page:b,totalPages:Math.ceil(k/c)}}async function j(a){let{clauses:b,baseParams:c}=h(a),e=b.length>0?b.join(" AND "):"1=1";return(0,d.query)(`
    SELECT s.nama_lengkap, s.nis, s.asrama, s.kamar,
           p.jenis, p.alasan, p.pemberi_izin, p.status,
           p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
    ORDER BY p.status ASC, p.tgl_mulai DESC
  `,c)}async function k(a){let{clauses:b,baseParams:c}=h({...a}),e=b.length>0?b.join(" AND "):"1=1",f=await (0,d.queryOne)(`
    SELECT 
      COUNT(p.id) as total_izin,
      SUM(CASE WHEN p.jenis = 'PULANG' THEN 1 ELSE 0 END) as izin_pulang,
      SUM(CASE WHEN p.jenis = 'KELUAR_KOMPLEK' THEN 1 ELSE 0 END) as izin_keluar,
      SUM(CASE WHEN p.status = 'AKTIF' THEN 1 ELSE 0 END) as belum_kembali,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana THEN 1 ELSE 0 END) as tepat_waktu,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as terlambat_kembali
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
  `,c);return{total:f?.total_izin||0,pulang:f?.izin_pulang||0,keluar:f?.izin_keluar||0,aktif:f?.belum_kembali||0,tepat:f?.tepat_waktu||0,telat:f?.terlambat_kembali||0}}async function l(a){let{clauses:b,baseParams:c}=h({...a}),e=b.length>0?b.join(" AND "):"1=1";return(0,d.query)(`
    SELECT s.id, s.nama_lengkap, s.asrama, s.kamar, COUNT(p.id) as total_izin,
           SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as total_telat
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
    GROUP BY s.id, s.nama_lengkap, s.asrama, s.kamar
    HAVING total_izin > 0
    ORDER BY total_izin DESC, total_telat DESC
    LIMIT 5
  `,c)}async function m(a,b){let c,g,h=await (0,e.getSession)();if(!h||!(0,e.hasAnyRole)(h,["admin","keamanan","dewan_santri"]))return{error:"Akses ditolak"};let i=b.get("jenis"),j=b.get("alasan_dropdown"),k=b.get("deskripsi"),l=b.get("pemberi_izin"),m=k.trim()?`${j} - ${k.trim()}`:j;if("PULANG"===i){let a=b.get("date_start"),d=b.get("date_end");c=new Date(`${a}T08:00:00+07:00`).toISOString(),g=new Date(`${d}T17:00:00+07:00`).toISOString()}else{let a=b.get("date_single"),d=b.get("time_start"),e=b.get("time_end");c=new Date(`${a}T${d}:00+07:00`).toISOString(),g=new Date(`${a}T${e}:00+07:00`).toISOString()}return await (0,d.execute)(`
    UPDATE perizinan 
    SET jenis = ?, tgl_mulai = ?, tgl_selesai_rencana = ?, alasan = ?, pemberi_izin = ?
    WHERE id = ? AND status = 'AKTIF'
  `,[i,c,g,m,l,a]),(0,f.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}}async function n(a){let b,c,g=await (0,e.getSession)(),h=a.get("santri_id"),i=a.get("jenis"),j=a.get("alasan_dropdown"),k=a.get("deskripsi"),l=a.get("pemberi_izin"),m=k.trim()?`${j} - ${k.trim()}`:j;if("PULANG"===i){let d=a.get("date_start"),e=a.get("date_end");b=new Date(`${d}T08:00:00+07:00`).toISOString(),c=new Date(`${e}T17:00:00+07:00`).toISOString()}else{let d=a.get("date_single"),e=a.get("time_start"),f=a.get("time_end");b=new Date(`${d}T${e}:00+07:00`).toISOString(),c=new Date(`${d}T${f}:00+07:00`).toISOString()}return await (0,d.execute)(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `,[(0,d.generateId)(),h,i,b,c,m,l,g?.id??null]),(0,f.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}}async function o(a,b){let c=await (0,d.queryOne)("SELECT tgl_selesai_rencana FROM perizinan WHERE id = ?",[a]);if(!c)return{error:"Data izin tidak ditemukan."};let e=new Date(b),g=e>new Date(c.tgl_selesai_rencana);return(await (0,d.execute)("UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ?",[g?"AKTIF":"KEMBALI",e.toISOString(),a]),(0,f.revalidatePath)("/dashboard/keamanan/perizinan"),g)?{success:!0,message:"Terlambat! Masuk antrian verifikasi."}:{success:!0,message:"Tepat waktu. Izin selesai."}}async function p(a){return(0,d.query)(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE nama_lengkap LIKE ?
    LIMIT 5
  `,[`%${a}%`])}async function q(a){let b=await (0,e.getSession)();return b&&(0,e.hasAnyRole)(b,["admin","keamanan","dewan_santri"])?(await (0,d.execute)("DELETE FROM perizinan WHERE id = ?",[a]),(0,f.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}):{error:"Akses ditolak"}}(0,a.i(13095).ensureServerEntryExports)([g,i,j,k,l,m,n,o,p,q]),(0,c.registerServerReference)(g,"000f2b000fc7165c5b789e0778b890c1b1a7b37cf5",null),(0,c.registerServerReference)(i,"40e2423ec4a4851eabab8f6b2993183a38f280187d",null),(0,c.registerServerReference)(j,"405603290651972be103212f5c6d8c36d4f6d9b156",null),(0,c.registerServerReference)(k,"40332215291dd6c24a510e19f2239eece61d118e4d",null),(0,c.registerServerReference)(l,"40ccdd2842fbab93394a55ac543e948e17f7bb7f1b",null),(0,c.registerServerReference)(m,"60a3f5863f5f1f6c89cfdb921494f53430096fc244",null),(0,c.registerServerReference)(n,"403ee24fa9b17f510e75a4e6000f1c135e73693149",null),(0,c.registerServerReference)(o,"60b924b5574e80beaf712b249e12f8bed07efbe917",null),(0,c.registerServerReference)(p,"400b7fc6a8a381c41dcf1e6e2482db95da5e77532b",null),(0,c.registerServerReference)(q,"4098d3486aa5859d9f5bb9ba5ea9d0ed9e87a99a6a",null),a.s([],6560),a.i(6560),a.s(["000f2b000fc7165c5b789e0778b890c1b1a7b37cf5",()=>g,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"400b7fc6a8a381c41dcf1e6e2482db95da5e77532b",()=>p,"40332215291dd6c24a510e19f2239eece61d118e4d",()=>k,"403ee24fa9b17f510e75a4e6000f1c135e73693149",()=>n,"405603290651972be103212f5c6d8c36d4f6d9b156",()=>j,"4098d3486aa5859d9f5bb9ba5ea9d0ed9e87a99a6a",()=>q,"40ccdd2842fbab93394a55ac543e948e17f7bb7f1b",()=>l,"40e2423ec4a4851eabab8f6b2993183a38f280187d",()=>i,"60a3f5863f5f1f6c89cfdb921494f53430096fc244",()=>m,"60b924b5574e80beaf712b249e12f8bed07efbe917",()=>o],2856)}];

//# sourceMappingURL=_c7725e56._.js.map