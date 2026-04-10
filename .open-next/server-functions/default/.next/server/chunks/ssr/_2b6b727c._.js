module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",null),a.s(["signOut",()=>f])},7895,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(18558);async function f(a,b){let c=`
    SELECT t.id, t.nama_pemesan, t.info_tambahan,
           t.total_tagihan, t.total_bayar,
           t.sisa_kembalian, t.sisa_tunggakan, t.status_lunas,
           t.created_at
    FROM upk_transaksi t
  `,e=[];a&&(c+=" WHERE t.nama_pemesan LIKE ?",e.push(`%${a}%`)),c+=" ORDER BY t.created_at DESC";let f=await (0,d.query)(c,e);if(!f.length)return[];let g=f.map(a=>a.id),h=g.map(()=>"?").join(","),i=await (0,d.query)(`
    SELECT ui.id, ui.transaksi_id, ui.kitab_id, ui.status_serah, ui.is_gratis,
           k.nama_kitab
    FROM upk_item ui
    LEFT JOIN kitab k ON k.id = ui.kitab_id
    WHERE ui.transaksi_id IN (${h})
  `,g),j=new Map;return i.forEach(a=>{j.has(a.transaksi_id)||j.set(a.transaksi_id,[]),j.get(a.transaksi_id).push(a)}),f.map(a=>{let b=j.get(a.id)||[];return{...a,status_lunas:!!a.status_lunas,upk_item:b,total_item:b.length,item_belum:b.filter(a=>"BELUM"===a.status_serah).length,items_detail:b,list_barang_belum:b.filter(a=>"BELUM"===a.status_serah).map(a=>a.nama_kitab).join(", ")}}).filter(a=>{let c=a.upk_item.some(a=>"BELUM"===a.status_serah),d=a.sisa_tunggakan>0,e=a.sisa_kembalian>0;return"PENDING_BARANG"===b?c:"HUTANG"===b?d:"KEMBALIAN"!==b||e})}async function g(){let a=await (0,d.query)(`
    SELECT ui.is_gratis,
           k.id AS kitab_id, k.nama_kitab,
           m.nama AS marhalah_nama
    FROM upk_item ui
    LEFT JOIN kitab k ON k.id = ui.kitab_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ui.status_serah = 'BELUM'
  `,[]),b={};return a.forEach(a=>{let c=a.kitab_id;b[c]||(b[c]={id:c,nama:a.nama_kitab,marhalah:a.marhalah_nama||"-",total_butuh:0,total_gratis:0}),b[c].total_butuh++,a.is_gratis&&b[c].total_gratis++}),Object.values(b).sort((a,b)=>a.marhalah.localeCompare(b.marhalah))}async function h(a){return await (0,d.execute)(`
    UPDATE upk_item SET status_serah = 'SUDAH', tanggal_serah = ?
    WHERE transaksi_id = ? AND status_serah = 'BELUM'
  `,[(0,d.now)(),a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function i(a){if(!a||!a.length)return{error:"Pilih minimal satu item."};let b=a.map(()=>"?").join(",");return await (0,d.execute)(`UPDATE upk_item SET status_serah = 'SUDAH', tanggal_serah = ? WHERE id IN (${b})`,[(0,d.now)(),...a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function j(a,b){return"LUNAS"===b?await (0,d.execute)("UPDATE upk_transaksi SET sisa_tunggakan = 0, status_lunas = 1 WHERE id = ?",[a]):await (0,d.execute)("UPDATE upk_transaksi SET sisa_kembalian = 0 WHERE id = ?",[a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function k(){let a=await (0,d.query)("SELECT COUNT(*) as c FROM upk_transaksi",[]),b=a[0]?.c??0;return 0===b?{error:"Tidak ada transaksi untuk direset."}:(await (0,d.execute)("DELETE FROM upk_item",[]),await (0,d.execute)("DELETE FROM upk_transaksi",[]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),(0,e.revalidatePath)("/dashboard/akademik/upk/kasir"),{success:!0,deleted:b})}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i,j,k]),(0,c.registerServerReference)(f,"60667e3415d9e443ef20d61f0435ca3cf5a2bee0b4",null),(0,c.registerServerReference)(g,"00dc8cd723c47e528e02019dfffbe51e9aa01c0568",null),(0,c.registerServerReference)(h,"4001fe7f1d6b91577fac0ceb6a899ff1cc0cb1bb0e",null),(0,c.registerServerReference)(i,"4000dba03f791905310ccdd5e0588ebab458819189",null),(0,c.registerServerReference)(j,"60ea1b6cd687097b06a55ca3c59455b66d3e6ca2dc",null),(0,c.registerServerReference)(k,"00330a60a8fe3dccd4386ce6ad0b5fb62e233932ae",null),a.s([],23805),a.i(23805),a.s(["00330a60a8fe3dccd4386ce6ad0b5fb62e233932ae",()=>k,"005289e5d664eb30fe22168a654a1891fa9b9f59a3",()=>b.signOut,"00dc8cd723c47e528e02019dfffbe51e9aa01c0568",()=>g,"4000dba03f791905310ccdd5e0588ebab458819189",()=>i,"60667e3415d9e443ef20d61f0435ca3cf5a2bee0b4",()=>f,"60ea1b6cd687097b06a55ca3c59455b66d3e6ca2dc",()=>j],7895)}];

//# sourceMappingURL=_2b6b727c._.js.map