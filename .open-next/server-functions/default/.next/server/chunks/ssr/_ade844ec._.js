module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},66270,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259);async function e(a,b){let c=await (0,d.query)(`
    SELECT rp.id,
           s.nama_lengkap, s.nis, s.nama_ayah,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a]);if(!c.length)return[];let e=c.map(a=>a.id),f=e.map(()=>"?").join(","),g=await (0,d.query)(`
    SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    WHERE na.riwayat_pendidikan_id IN (${f}) AND na.semester = ?
    ORDER BY mp.nama
  `,[...e,b]),h=await (0,d.query)(`
    SELECT
      riwayat_pendidikan_id,
      SUM(CASE WHEN shubuh  = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'S' THEN 1 ELSE 0 END) AS total_sakit,
      SUM(CASE WHEN shubuh  = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'I' THEN 1 ELSE 0 END) AS total_izin,
      SUM(CASE WHEN shubuh  = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'A' THEN 1 ELSE 0 END) AS total_alfa
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${f})
    GROUP BY riwayat_pendidikan_id
  `,e),i=new Map;h.forEach(a=>{i.set(a.riwayat_pendidikan_id,{sakit:a.total_sakit??0,izin:a.total_izin??0,alfa:a.total_alfa??0})});let j=c[0]?.marhalah_id,k=[];return j&&(k=await (0,d.query)("SELECT mapel_id, nama_kitab FROM kitab WHERE marhalah_id = ?",[j])),c.map(a=>{let b=g.filter(b=>b.riwayat_pendidikan_id===a.id),c=i.get(a.id)??{sakit:0,izin:0,alfa:0};return{id:a.id,santri:{nama_lengkap:a.nama_lengkap,nis:a.nis,nama_ayah:a.nama_ayah},kelas:{id:a.kelas_id,nama_kelas:a.nama_kelas,marhalah:{id:a.marhalah_id,nama:a.marhalah_nama}},wali_kelas_nama:a.wali_kelas_nama||"..........................",ranking:{ranking_kelas:a.ranking_kelas??"-",predikat:a.predikat??"-",rata_rata:a.rata_rata??0,catatan_wali_kelas:a.catatan_wali_kelas??""},nilai:b.map(a=>{let b=k.find(b=>b.mapel_id===a.mapel_id);return{mapel:a.mapel_nama||"Tanpa Nama",kitab:b?.nama_kitab||"-",angka:a.nilai}}),absen:{sakit:c.sakit,izin:c.izin,alfa:c.alfa}}})}async function f(){return(await (0,d.query)("SELECT id, nama_kelas FROM kelas",[])).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}(0,a.i(13095).ensureServerEntryExports)([e,f]),(0,c.registerServerReference)(e,"607f2d2e265de61133a813d6b28620213ce8606226",null),(0,c.registerServerReference)(f,"00e3857e94642da3a5ab2be362bef310cd833c1fbe",null),a.s([],24446),a.i(24446),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00e3857e94642da3a5ab2be362bef310cd833c1fbe",()=>f,"607f2d2e265de61133a813d6b28620213ce8606226",()=>e],66270)}];

//# sourceMappingURL=_ade844ec._.js.map