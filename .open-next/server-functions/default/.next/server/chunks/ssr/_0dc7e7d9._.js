module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},3993,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259);async function e(a){let b=await (0,d.query)(`
    SELECT k.id, k.nama_kelas,
           ta.nama AS tahun_ajaran,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           u.full_name AS wali_kelas
    FROM kelas k
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
  `,[]),c=await (0,d.query)(`
    SELECT r.ranking_kelas, r.jumlah_nilai, r.rata_rata,
           rp.kelas_id,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM ranking r
    JOIN riwayat_pendidikan rp ON rp.id = r.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE r.semester = ? AND r.ranking_kelas <= 3
  `,[a]),e=b.map(a=>({kelas_id:a.id,kelas_nama:a.nama_kelas,tahun_ajaran:a.tahun_ajaran||null,marhalah_nama:a.marhalah_nama||"-",marhalah_urutan:a.marhalah_urutan||999,wali_kelas:a.wali_kelas||"-"}));e.sort((a,b)=>a.marhalah_urutan!==b.marhalah_urutan?a.marhalah_urutan-b.marhalah_urutan:a.kelas_nama.localeCompare(b.kelas_nama,void 0,{numeric:!0,sensitivity:"base"}));let f=[];return e.forEach(a=>{let b=c.filter(b=>b.kelas_id===a.kelas_id);for(let c=1;c<=3;c++){let d=b.find(a=>a.ranking_kelas===c);d?f.push({rank:c,jumlah:d.jumlah_nilai,rata:d.rata_rata,kelas_nama:a.kelas_nama,tahun_ajaran:a.tahun_ajaran,marhalah_nama:a.marhalah_nama,marhalah_urutan:a.marhalah_urutan,wali_kelas:a.wali_kelas,santri_nama:d.nama_lengkap,nis:d.nis,asrama:d.asrama||"",kamar:d.kamar||""}):f.push({rank:c,jumlah:"",rata:"",kelas_nama:a.kelas_nama,tahun_ajaran:a.tahun_ajaran,marhalah_nama:a.marhalah_nama,marhalah_urutan:a.marhalah_urutan,wali_kelas:a.wali_kelas,santri_nama:"",nis:"",asrama:"",kamar:""})}}),f}(0,a.i(13095).ensureServerEntryExports)([e]),(0,c.registerServerReference)(e,"40fc4997f09b9a35b6c35e41f4ff254f402159a6df",null),a.s([],82537),a.i(82537),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"40fc4997f09b9a35b6c35e41f4ff254f402159a6df",()=>e],3993)}];

//# sourceMappingURL=_0dc7e7d9._.js.map