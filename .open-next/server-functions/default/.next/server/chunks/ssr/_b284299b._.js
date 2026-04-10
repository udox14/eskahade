module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},3525,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558);async function g(){let a=await (0,d.query)(`
    SELECT k.id, k.nama_kitab, k.harga,
           m.id AS marhalah_id, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan
    FROM kitab k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    ORDER BY k.nama_kitab
  `,[]),b={};a.forEach(a=>{let c=a.marhalah_nama||"Umum / Lainnya",d=a.marhalah_urutan||999;b[c]||(b[c]=[]),b[c].push({id:a.id,nama:a.nama_kitab,harga:a.harga,urutan_marhalah:d})});let c={};return Object.keys(b).sort((a,c)=>(b[a][0]?.urutan_marhalah||999)-(b[c][0]?.urutan_marhalah||999)).forEach(a=>{c[a]=b[a]}),c}async function h(a){return(0,d.query)(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `,[`%${a}%`])}async function i(a){let b=await (0,e.getSession)(),{santriId:c,namaPemesan:g,infoTambahan:h,totalTagihan:i,totalBayar:j,items:k}=a,l=j-i,m=l>0?l:0,n=l<0?Math.abs(l):0,o=(0,d.generateId)();for(let a of(await (0,d.execute)(`
    INSERT INTO upk_transaksi (id, santri_id, nama_pemesan, info_tambahan, total_tagihan, total_bayar,
      sisa_kembalian, sisa_tunggakan, status_lunas, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,[o,c,g,h,i,j,m,n,+(0===n),b?.id??null,(0,d.now)()]),k))await (0,d.execute)(`
      INSERT INTO upk_item (id, transaksi_id, kitab_id, harga_saat_ini, is_gratis, status_serah)
      VALUES (?, ?, ?, ?, ?, 'BELUM')
    `,[(0,d.generateId)(),o,a.id,a.hargaAsli,+!!a.isGratis]);return(0,f.revalidatePath)("/dashboard/akademik/upk"),{success:!0}}(0,a.i(13095).ensureServerEntryExports)([g,h,i]),(0,c.registerServerReference)(g,"00d65007be0bb5bb075bd85915d8edbc3b3d8f7e1d",null),(0,c.registerServerReference)(h,"4016b9492b992016f4f9f15d0f3466d156378fac75",null),(0,c.registerServerReference)(i,"400a11e17e39b0d0abac8cf1d967ddc8ac755ae399",null),a.s([],33287),a.i(33287),a.s(["005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00d65007be0bb5bb075bd85915d8edbc3b3d8f7e1d",()=>g,"400a11e17e39b0d0abac8cf1d967ddc8ac755ae399",()=>i,"4016b9492b992016f4f9f15d0f3466d156378fac75",()=>h],3525)}];

//# sourceMappingURL=_b284299b._.js.map