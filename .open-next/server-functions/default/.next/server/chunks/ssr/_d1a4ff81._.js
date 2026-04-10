module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},82050,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558),g=a.i(13095);async function h(){let a=new Date;a.setMonth(a.getMonth()-3);let b=a.toISOString().slice(0,10),c=await (0,d.query)(`
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    INNER JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
      AND rp.status_riwayat = 'aktif'
    INNER JOIN santri s ON s.id = rp.santri_id
      AND s.status_global = 'aktif'
    WHERE ah.tanggal >= ?
      AND (
        (ah.shubuh  = 'A' AND (ah.verif_shubuh  IS NULL OR ah.verif_shubuh  = 'BELUM'))
        OR
        (ah.ashar   = 'A' AND (ah.verif_ashar   IS NULL OR ah.verif_ashar   = 'BELUM'))
        OR
        (ah.maghrib = 'A' AND (ah.verif_maghrib IS NULL OR ah.verif_maghrib = 'BELUM'))
      )
    ORDER BY ah.tanggal DESC
    LIMIT 2000
  `,[b]),e=new Map;return c.forEach(a=>{["shubuh","ashar","maghrib"].forEach(b=>{let c="A"===a[b],d=null==a[`verif_${b}`]||"BELUM"===a[`verif_${b}`];c&&d&&(e.has(a.santri_id)||e.set(a.santri_id,{santri_id:a.santri_id,nama:a.nama_lengkap,nis:a.nis,info:`${a.asrama||"-"} / ${a.kamar||"-"}`,items:[]}),e.get(a.santri_id).items.push({absen_id:a.id,tanggal:a.tanggal,sesi:b,status_verif:a[`verif_${b}`]}))})}),Array.from(e.values())}let i=["shubuh","ashar","maghrib"];function j(a){if(!i.includes(a))throw Error(`Sesi tidak valid: ${a}`);return`verif_${a}`}async function k(a){let b=await (0,e.getSession)();if(!a||0===a.length)return{error:"Tidak ada data untuk disimpan"};let c=[];for(let e of a){let{santriId:a,items:f,vonis:g}=e;if("ALFA_MURNI"===g){let e=f.length,g=10*e,h=f.sort((a,b)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime()).map(a=>{let b=new Date(a.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short"});return`${b} (${a.sesi})`}).join(", ");for(let i of(c.push({id:(0,d.generateId)(),santri_id:a,tanggal:(0,d.now)(),jenis:"ALFA_PENGAJIAN",deskripsi:`Akumulasi Alfa Pengajian (${e} Sesi).
Detail: ${h}`,poin:g,penindak_id:b?.id??null}),f))await (0,d.execute)(`UPDATE absensi_harian SET ${j(i.sesi)} = 'OK' WHERE id = ?`,[i.absen_id])}else if("BELUM"===g)for(let a of f)await (0,d.execute)(`UPDATE absensi_harian SET ${j(a.sesi)} = 'BELUM' WHERE id = ?`,[a.absen_id]);else{let a="SAKIT"===g?"S":"IZIN"===g?"I":"H";for(let b of f)await (0,d.execute)(`UPDATE absensi_harian SET ${function(a){if(!i.includes(a))throw Error(`Sesi tidak valid: ${a}`);return a}(b.sesi)} = ?, ${j(b.sesi)} = NULL WHERE id = ?`,[a,b.absen_id])}}for(let a of c)await (0,d.execute)(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,[a.id,a.santri_id,a.tanggal,a.jenis,a.deskripsi,a.poin,a.penindak_id]);return(0,f.revalidatePath)("/dashboard/akademik/absensi/verifikasi"),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0,count:a.length}}(0,g.ensureServerEntryExports)([h,k]),(0,c.registerServerReference)(h,"00f605a1c4870ea72985931eb4e9cc1e0f1f6186f5",null),(0,c.registerServerReference)(k,"4045a8d0579b2d76ef7c90ac24e66bef4cb550e474",null),a.s([],83654),a.i(83654),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00f605a1c4870ea72985931eb4e9cc1e0f1f6186f5",()=>h,"4045a8d0579b2d76ef7c90ac24e66bef4cb550e474",()=>k],82050)}];

//# sourceMappingURL=_d1a4ff81._.js.map