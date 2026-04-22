module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},7895,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(18558);async function f(a,b){let c=`
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
  `,[(0,d.now)(),a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function i(a){if(!a||!a.length)return{error:"Pilih minimal satu item."};let b=a.map(()=>"?").join(",");return await (0,d.execute)(`UPDATE upk_item SET status_serah = 'SUDAH', tanggal_serah = ? WHERE id IN (${b})`,[(0,d.now)(),...a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function j(a,b){return"LUNAS"===b?await (0,d.execute)("UPDATE upk_transaksi SET sisa_tunggakan = 0, status_lunas = 1 WHERE id = ?",[a]):await (0,d.execute)("UPDATE upk_transaksi SET sisa_kembalian = 0 WHERE id = ?",[a]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),{success:!0}}async function k(){let a=await (0,d.query)("SELECT COUNT(*) as c FROM upk_transaksi",[]),b=a[0]?.c??0;return 0===b?{error:"Tidak ada transaksi untuk direset."}:(await (0,d.execute)("DELETE FROM upk_item",[]),await (0,d.execute)("DELETE FROM upk_transaksi",[]),(0,e.revalidatePath)("/dashboard/akademik/upk/manajemen"),(0,e.revalidatePath)("/dashboard/akademik/upk/kasir"),{success:!0,deleted:b})}(0,a.i(13095).ensureServerEntryExports)([f,g,h,i,j,k]),(0,c.registerServerReference)(f,"60bcfbde3b8adf3ccbe3f195bd1508148fbc7697e0",null),(0,c.registerServerReference)(g,"0090adb1d4e00e3319b49debdb883b291f58ff6fd3",null),(0,c.registerServerReference)(h,"40beb5c2f7d07f9e6194339ffc09d947029cde9e1e",null),(0,c.registerServerReference)(i,"40bdfd39f5b801d7fe3111302aaaecd87a28bbc36d",null),(0,c.registerServerReference)(j,"603a133753d89031879e0c6ee70e7609c086ee9373",null),(0,c.registerServerReference)(k,"002c659b836d174b079baea3bfbd4638702ff59470",null),a.s([],23805),a.i(23805),a.s(["002c659b836d174b079baea3bfbd4638702ff59470",()=>k,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"0090adb1d4e00e3319b49debdb883b291f58ff6fd3",()=>g,"40bdfd39f5b801d7fe3111302aaaecd87a28bbc36d",()=>i,"603a133753d89031879e0c6ee70e7609c086ee9373",()=>j,"60bcfbde3b8adf3ccbe3f195bd1508148fbc7697e0",()=>f],7895)}];

//# sourceMappingURL=_2b6b727c._.js.map