module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran ORDER BY kategori DESC, nama_pelanggaran"),["master-pelanggaran"],{tags:["master-pelanggaran"],revalidate:3600}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),k=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,j,"getCachedDataGuru",0,k,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedMasterPelanggaran",0,i,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},66270,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(9343);async function f(a,b){let c=await (0,d.query)(`
    SELECT rp.id, rp.grade_lanjutan,
           s.nama_lengkap, s.nis, s.nama_ayah,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.jumlah_nilai,
           r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a]);if(!c.length)return[];let e=c.length,f=c.map(a=>a.id),h=f.map(()=>"?").join(","),i=await (0,d.query)(`
    SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    WHERE na.riwayat_pendidikan_id IN (${h}) AND na.semester = ?
    ORDER BY mp.nama ASC
  `,[...f,b]),j=await (0,d.query)(`
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
    WHERE riwayat_pendidikan_id IN (${h})
    GROUP BY riwayat_pendidikan_id
  `,f),k=new Map;j.forEach(a=>{k.set(a.riwayat_pendidikan_id,{sakit:a.total_sakit??0,izin:a.total_izin??0,alfa:a.total_alfa??0})});let l=await (0,d.query)(`
    SELECT riwayat_pendidikan_id, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian
    FROM nilai_akhlak
    WHERE riwayat_pendidikan_id IN (${h}) AND semester = ?
  `,[...f,b]),m=new Map;l.forEach(a=>{m.set(a.riwayat_pendidikan_id,[{label:"Akhlak/Budi Pekerti",predikat:g(a.kedisiplinan)},{label:"Ketekunan Ibadah",predikat:g(a.ibadah)},{label:"Kerapihan",predikat:g(a.kesopanan)},{label:"Kebersihan",predikat:g(a.kebersihan)}])});let n=c[0]?.marhalah_id,o=[];n&&(o=await (0,d.query)("SELECT mapel_id, nama_kitab FROM kitab WHERE marhalah_id = ?",[n]));let p={},q={};return i.forEach(a=>{p[a.mapel_id]||(p[a.mapel_id]=0,q[a.mapel_id]=0),a.nilai>0&&(p[a.mapel_id]+=a.nilai,q[a.mapel_id]++)}),Object.keys(p).forEach(a=>{p[a]=q[a]>0?parseFloat((p[a]/q[a]).toFixed(2)):0}),c.map(a=>{let b=i.filter(b=>b.riwayat_pendidikan_id===a.id),c=k.get(a.id)??{sakit:0,izin:0,alfa:0};return{id:a.id,santri:{nama_lengkap:a.nama_lengkap,nis:a.nis,nama_ayah:a.nama_ayah},kelas:{id:a.kelas_id,nama_kelas:a.nama_kelas,grade_lanjutan:a.grade_lanjutan||null,marhalah:{id:a.marhalah_id,nama:a.marhalah_nama}},wali_kelas_nama:a.wali_kelas_nama||"..........................",ranking:{ranking_kelas:a.ranking_kelas??"-",total_santri:e,predikat:a.predikat??"-",rata_rata:a.rata_rata??0,jumlah_nilai:a.jumlah_nilai??0,catatan_wali_kelas:a.catatan_wali_kelas??""},nilai:b.map(a=>{let b=o.find(b=>b.mapel_id===a.mapel_id);return{mapel:a.mapel_nama||"Tanpa Nama",kitab:b?.nama_kitab||"-",angka:a.nilai,rata_kelas:p[a.mapel_id]??0}}),absen:{sakit:c.sakit,izin:c.izin,alfa:c.alfa},kepribadian:m.get(a.id)||[]}})}function g(a){return a>=90?"Sangat Baik":a>=75?"Baik":a>=60?"Cukup":"Kurang"}async function h(){return(await (0,d.query)("SELECT id, nama_kelas FROM kelas",[])).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function i(){try{let a=await (0,e.getCachedTahunAjaranAktif)();if(a?.nama)return a.nama}catch{}let a=new Date,b=a.getFullYear();return a.getMonth()+1>=7?`${b}/${b+1}`:`${b-1}/${b}`}(0,a.i(13095).ensureServerEntryExports)([f,h,i]),(0,c.registerServerReference)(f,"608eb690493be12b4b3d43f0bd8d442c4cc188596e",null),(0,c.registerServerReference)(h,"00ec2a6164f66628c746666f6943b1d2d2574df884",null),(0,c.registerServerReference)(i,"00aae30e3af3663a6c687b8e356203297f4ca94770",null),a.s([],24446),a.i(24446),a.s(["006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"00aae30e3af3663a6c687b8e356203297f4ca94770",()=>i,"00ec2a6164f66628c746666f6943b1d2d2574df884",()=>h,"608eb690493be12b4b3d43f0bd8d442c4cc188596e",()=>f],66270)}];

//# sourceMappingURL=_d003120d._.js.map