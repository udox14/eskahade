module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},88283,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(13095);let f=()=>({total:0,keluar_bulan_ini:0,masuk_bulan_ini:0,jenis_kelamin:{L:0,P:0},jenjang:{SLTP:0,SLTA:0,KULIAH:0,TIDAK_SEKOLAH:0,LAINNYA:0,detail:{}},kelas_sekolah:{},marhalah:{},distribusi_kamar:{},santri_kamar:{}});async function g(a){let b=a&&"SEMUA"!==a?"AND s.asrama = ?":"",c=a&&"SEMUA"!==a?[a]:[],e=new Date,g=new Date(e.getFullYear(),e.getMonth(),1).toISOString(),[h,i,j]=await Promise.all([(0,d.query)(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
             s.asrama, s.kamar, s.created_at,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' ${b}
    `,c),(0,d.queryOne)(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) AS L,
        SUM(CASE WHEN s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) AS P,
        SUM(CASE WHEN s.created_at >= ? THEN 1 ELSE 0 END) AS masuk
      FROM santri s
      WHERE s.status_global = 'aktif' ${b}
    `,[g,...c]),(0,d.queryOne)(`
      SELECT COUNT(*) AS total FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI' AND rs.created_at >= ?
      ${b}
    `,[g,...c])]);if(!h.length)return f();let k=f();return k.total=i?.total??h.length,k.jenis_kelamin.L=i?.L??0,k.jenis_kelamin.P=i?.P??0,k.masuk_bulan_ini=i?.masuk??0,k.keluar_bulan_ini=j?.total??0,h.forEach(a=>{let b=function(a){if(!a)return"TIDAK_SEKOLAH";let b=a.toUpperCase();return b.includes("MTS")||b.includes("SMP")||b.includes("SADESA")?"SLTP":b.includes("MA")||b.includes("SMA")||b.includes("SMK")?"SLTA":b.includes("KULIAH")||b.includes("UNIVERSITAS")||b.includes("ST")?"KULIAH":"LAINNYA"}(a.sekolah);void 0!==k.jenjang[b]&&k.jenjang[b]++;let c=a.sekolah?a.sekolah.toUpperCase():"TIDAK SEKOLAH";k.jenjang.detail[c]=(k.jenjang.detail[c]||0)+1;let d=a.kelas_sekolah?a.kelas_sekolah.toUpperCase():"BELUM SET";k.kelas_sekolah[d]=(k.kelas_sekolah[d]||0)+1;let e=a.marhalah_nama||"BELUM MASUK KELAS";k.marhalah[e]=(k.marhalah[e]||0)+1;let f=a.asrama||"LAINNYA",g=a.kamar||"?";k.distribusi_kamar[f]||(k.distribusi_kamar[f]={}),k.distribusi_kamar[f][g]=(k.distribusi_kamar[f][g]||0)+1,k.santri_kamar[f]||(k.santri_kamar[f]={}),k.santri_kamar[f][g]||(k.santri_kamar[f][g]=[]),k.santri_kamar[f][g].push({id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kelas_pesantren:a.nama_kelas||null,sekolah:a.sekolah,kelas_sekolah:a.kelas_sekolah})}),k}(0,e.ensureServerEntryExports)([g]),(0,c.registerServerReference)(g,"40b01be1769daf11ab83f9e501ce7a61431b8247dd",null),a.s([],15342),a.i(15342),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"40b01be1769daf11ab83f9e501ce7a61431b8247dd",()=>g],88283)}];

//# sourceMappingURL=_b3a6cec1._.js.map