module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058);a.i(70396);var d=a.i(73727),e=a.i(18558);async function f(){await (0,c.clearSession)(),(0,e.revalidatePath)("/","layout"),(0,d.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([f]),(0,b.registerServerReference)(f,"006f4c55239f4a20efcdddda1e3014433a5c909281",null),a.s(["signOut",()=>f])},34568,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(18558),g=a.i(99911),h=a.i(79237);async function i(){let a=new Date().toISOString(),b=await (0,d.query)(`
    SELECT p.id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
           p.alasan, p.pemberi_izin,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.status = 'AKTIF'
      AND (
        p.tgl_kembali_aktual IS NOT NULL
        OR p.tgl_selesai_rencana < ?
      )
    ORDER BY p.tgl_selesai_rencana ASC
    LIMIT 200
  `,[a]),c=await (0,d.query)(`
    SELECT pl.id, pl.santri_id, pl.keterangan,
           pp.tgl_selesai_datang, pp.nama_periode,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perpulangan_log pl
    JOIN perpulangan_periode pp ON pp.id = pl.periode_id
    JOIN santri s ON s.id = pl.santri_id
    WHERE pl.status_datang = 'TELAT'
    ORDER BY pp.tgl_selesai_datang ASC
    LIMIT 200
  `),e=[];return b.forEach(a=>{let b=new Date(a.tgl_selesai_rencana.replace(" ","T")),c=a.tgl_kembali_aktual?new Date(a.tgl_kembali_aktual.replace(" ","T")):null,d=c||new Date,f=(0,g.formatDistance)(b,d,{locale:h.id,addSuffix:!1});e.push({izin_id:a.id,santri_id:a.santri_id,nama:a.nama_lengkap,info:`${a.asrama||"-"} / ${a.kamar||"-"}`,jenis:"PULANG"===a.jenis?"IZIN PULANG":"KELUAR KOMPLEK",sumber:"perizinan",alasan:a.alasan,batas_kembali:a.tgl_selesai_rencana,tgl_kembali:a.tgl_kembali_aktual,status_label:c?"SUDAH KEMBALI (Menunggu Sidang)":"BELUM KEMBALI (Overdue)",durasi_telat:f})}),c.forEach(a=>{let b=new Date(a.tgl_selesai_datang),c=(0,g.formatDistance)(b,new Date,{locale:h.id,addSuffix:!1});e.push({izin_id:a.id,santri_id:a.santri_id,nama:a.nama_lengkap,info:`${a.asrama||"-"} / ${a.kamar||"-"}`,jenis:"TELAT KEMBALI (PERPULANGAN)",sumber:"perpulangan",alasan:a.keterangan||`Periode: ${a.nama_periode}`,batas_kembali:a.tgl_selesai_datang,tgl_kembali:null,status_label:"BELUM KEMBALI (Telat Perpulangan)",durasi_telat:c})}),e}async function j(a,b,c,g="perizinan"){let h=await (0,e.getSession)();return"MANGKIR"===c?{success:!0,message:"Ditandai Mangkir. Akan muncul lagi nanti."}:("TELAT_MURNI"===c&&await (0,d.execute)(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, 'SEDANG', ?, 25, ?)
    `,[(0,d.generateId)(),b,(0,d.now)(),"perpulangan"===g?"Terlambat kembali ke pondok setelah perpulangan libur semester.":"Terlambat kembali ke pondok (Melebihi batas izin).",h?.id??null]),"perpulangan"===g?(await (0,d.execute)("UPDATE perpulangan_log SET status_datang = ?, tgl_datang = ?, updated_by = ? WHERE id = ?",["TELAT_MURNI"===c?"VONIS":"SUDAH",(0,d.now)(),h?.id??null,a]),(0,f.revalidatePath)("/dashboard/asrama/perpulangan/monitoring")):await (0,d.execute)("UPDATE perizinan SET status = 'KEMBALI' WHERE id = ?",[a]),(0,f.revalidatePath)("/dashboard/keamanan/perizinan/verifikasi-telat"),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0})}(0,a.i(13095).ensureServerEntryExports)([i,j]),(0,c.registerServerReference)(i,"005ca239d3d8fde978a0b349bcd75b869b7ac4ccb4",null),(0,c.registerServerReference)(j,"7867fc7c3e1a32aa80a2a83ea0977054046397e2db",null),a.s([],65053),a.i(65053),a.s(["005ca239d3d8fde978a0b349bcd75b869b7ac4ccb4",()=>i,"006f4c55239f4a20efcdddda1e3014433a5c909281",()=>b.signOut,"7867fc7c3e1a32aa80a2a83ea0977054046397e2db",()=>j],34568)}];

//# sourceMappingURL=_b24cfd32._.js.map