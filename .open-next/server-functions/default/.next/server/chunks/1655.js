"use strict";exports.id=1655,exports.ids=[1655],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},3041:(a,b,c)=>{c.d(b,{AM:()=>E,DK:()=>u,HL:()=>v,W1:()=>D,Yb:()=>C,Zm:()=>G,bD:()=>z,h2:()=>B,l8:()=>t,m$:()=>s,mJ:()=>r,mv:()=>F,sn:()=>A,te:()=>y});var d=c(49796),e=c(44075),f=c(23755),g=c(30236),h=c(16949),i=c(24424);let j="/dashboard/keuangan/non-spp",k=["KESEHATAN","EHB","EKSKUL"],l=["BANGUNAN",...k];function m(a){let b=Number(a??0);return Number.isFinite(b)?b:0}function n(){return{BANGUNAN:0,KESEHATAN:0,EHB:0,EKSKUL:0}}function o(a){let b=a?.nama?.match(/\b(20\d{2}|19\d{2})\b/);return b?Number(b[1]):new Date().getFullYear()}function p(a="p"){return`COALESCE(${a}.status, 'AKTIF') != 'VOID'`}function q(a="p"){return`((${a}.tahun_ajaran_id = ?) OR (${a}.tahun_ajaran_id IS NULL AND ${a}.tahun_tagihan = ?))`}async function r(){return(0,e.P)("SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC")}async function s(){return(0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE is_active = 1 LIMIT 1")}async function t(a,b){let c=n(),d=await (0,e.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ?",[a,b]);return(d.length?d:await (0,e.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id IS NULL AND tahun_angkatan = ?",[b])).forEach(a=>{l.includes(a.jenis_biaya)&&(c[a.jenis_biaya]=m(a.nominal))}),c}async function u(a){let b=await (0,e.P)(`
    SELECT tahun_angkatan, jenis_biaya, nominal, 0 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id = ?
    UNION ALL
    SELECT tahun_angkatan, jenis_biaya, nominal, 1 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id IS NULL
      AND tahun_angkatan NOT IN (
        SELECT DISTINCT tahun_angkatan FROM biaya_settings WHERE tahun_ajaran_id = ?
      )
    ORDER BY tahun_angkatan DESC, source_rank ASC
  `,[a,a]),c=new Map;return b.forEach(a=>{c.has(a.tahun_angkatan)||c.set(a.tahun_angkatan,{tahun:a.tahun_angkatan,legacy:1===a.source_rank,...n()});let b=c.get(a.tahun_angkatan);b[a.jenis_biaya]=m(a.nominal),b.legacy=b.legacy&&1===a.source_rank}),Array.from(c.values())}async function v(a){let b=await (0,f.Ht)(),c=Number(a.tahunAjaranId),d=Number(a.tahunAngkatan);if(!Number.isInteger(c)||c<=0)return{error:"Tahun ajaran tidak valid."};if(!Number.isInteger(d)||d<=0)return{error:"Tahun angkatan tidak valid."};for(let b of l){let f=Math.max(0,m(a.tarif[b])),g=await (0,e.Zy)("SELECT id FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ? AND jenis_biaya = ?",[c,d,b]);g?await (0,e.g7)("UPDATE biaya_settings SET nominal = ? WHERE id = ?",[f,g.id]):await (0,e.g7)("INSERT INTO biaya_settings (tahun_ajaran_id, tahun_angkatan, jenis_biaya, nominal) VALUES (?, ?, ?, ?)",[c,d,b,f])}return await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"update_tarif",fiturHref:j,logKind:"update",entityType:"biaya_settings",entityLabel:`${c}/${d}`,summary:`Menyimpan tarif Non-SPP angkatan ${d}`,details:{tahun_ajaran_id:c,tahun_angkatan:d,tarif:a.tarif}}),(0,h.revalidateTag)("biaya-settings","everything"),(0,h.revalidatePath)(j),{success:!0}}async function w(a){let b=await (0,e.P)(`
    SELECT tahun_angkatan, jenis_biaya, nominal, 0 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id = ?
    UNION ALL
    SELECT tahun_angkatan, jenis_biaya, nominal, 1 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id IS NULL
    ORDER BY source_rank ASC
  `,[a]),c=new Map;return b.forEach(a=>{let b=`${a.tahun_angkatan}-${a.jenis_biaya}`;c.has(b)||c.set(b,m(a.nominal))}),c}async function x(a){let b=`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif'
  `,c=[];if(a.asrama&&"SEMUA"!==a.asrama&&(b+=" AND asrama = ?",c.push(a.asrama)),a.kamar&&"SEMUA"!==a.kamar&&(b+=" AND kamar = ?",c.push(a.kamar)),a.search.trim()){b+=" AND (nama_lengkap LIKE ? OR nis LIKE ?)";let d=`%${a.search.trim()}%`;c.push(d,d)}b+=" ORDER BY nama_lengkap";let d=await (0,e.P)(b,c),f=await w(a.tahunAjaranId),g=`
    SELECT p.*
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    WHERE s.status_global = 'aktif'
      AND ${p("p")}
      AND (
        p.jenis_biaya = 'BANGUNAN'
        OR (${q("p")})
      )
  `,h=[a.tahunAjaranId,a.tahunTagihan];if(a.asrama&&"SEMUA"!==a.asrama&&(g+=" AND s.asrama = ?",h.push(a.asrama)),a.kamar&&"SEMUA"!==a.kamar&&(g+=" AND s.kamar = ?",h.push(a.kamar)),a.search.trim()){g+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let b=`%${a.search.trim()}%`;h.push(b,b)}let i=await (0,e.P)(g,h),j=new Map;return i.forEach(a=>{j.has(a.santri_id)||j.set(a.santri_id,[]),j.get(a.santri_id).push(a)}),d.map(a=>{let b=a.tahun_masuk||(a.created_at?new Date(a.created_at).getFullYear():new Date().getFullYear()),c=j.get(a.id)??[],d=n();l.forEach(a=>{d[a]=f.get(`${b}-${a}`)??0});let e=c.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+m(b.nominal_bayar),0),g=Math.max(0,d.BANGUNAN-e),h=Object.fromEntries(k.map(a=>{let b=c.filter(b=>b.jenis_biaya===a),e=b.reduce((a,b)=>a+m(b.nominal_bayar),0),f=Math.max(0,d[a]-e);return[a,{tarif:d[a],paid:e,sisa:f,lunas:d[a]>0&&f<=0,paymentIds:b.filter(a=>!a.psb_receipt_id).map(a=>a.id),hasPsbPayment:b.some(a=>!!a.psb_receipt_id)}]})),i=g+k.reduce((a,b)=>a+h[b].sisa,0);return{...a,tahun_masuk_fix:b,tarif:d,bangunan:{tarif:d.BANGUNAN,paid:e,sisa:g,status:d.BANGUNAN<=0?"-":g<=0?"LUNAS":e>0?"CICIL":"BELUM",paymentIds:c.filter(a=>"BANGUNAN"===a.jenis_biaya).map(a=>a.id)},tahunan:h,total_kurang:i,is_full_tahunan:k.every(a=>h[a].lunas)}})}async function y(a){let b=o(await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]));return x({tahunAjaranId:a.tahunAjaranId,tahunTagihan:b,asrama:a.asrama||"SEMUA",kamar:a.kamar||"SEMUA",search:a.search||""})}async function z(a){let b=await (0,f.Ht)();if(!l.includes(a.jenis))return{error:"Jenis biaya tidak valid."};let c=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]);if(!c)return{error:"Tahun ajaran tidak ditemukan."};let d=await (0,e.Zy)("SELECT id, nama_lengkap, nis, tahun_masuk, created_at FROM santri WHERE id = ?",[a.santriId]);if(!d)return{error:"Santri tidak ditemukan."};let i=d.tahun_masuk||(d.created_at?new Date(d.created_at).getFullYear():new Date().getFullYear()),k=o(c),n=(await t(c.id,i))[a.jenis]??0;if(n<=0)return{error:`Tarif ${a.jenis} belum diatur untuk angkatan ini.`};let r=Math.max(0,m(a.nominal));if("BANGUNAN"===a.jenis){let a=await (0,e.Zy)(`SELECT COALESCE(SUM(nominal_bayar), 0) AS total FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = 'BANGUNAN' AND ${p()}`,[d.id]),b=Math.max(0,n-m(a?.total));if(b<=0)return{error:"Uang Bangunan santri ini sudah lunas."};r=r>0?Math.min(r,b):b}else{let b=await (0,e.Zy)(`SELECT COALESCE(SUM(nominal_bayar), 0) AS total
       FROM pembayaran_tahunan p
       WHERE santri_id = ? AND jenis_biaya = ? AND ${p("p")} AND ${q("p")}`,[d.id,a.jenis,c.id,k]),f=Math.max(0,n-m(b?.total));if(f<=0)return{error:`${a.jenis} tahun ajaran ini sudah lunas.`};r=f}if(r<=0)return{error:"Nominal pembayaran tidak valid."};let s=(0,e.$C)();return await (0,e.g7)(`
    INSERT INTO pembayaran_tahunan
      (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
  `,[s,d.id,a.jenis,"BANGUNAN"===a.jenis?null:k,c.id,r,b?.id??null,"BANGUNAN"===a.jenis?"Pembayaran Bangunan inline":`Pembayaran ${a.jenis} ${c.nama}`]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"payment",fiturHref:j,logKind:"create",entityType:"pembayaran_tahunan",entityId:s,entityLabel:d.nama_lengkap||d.nis||d.id,summary:`Mencatat pembayaran ${a.jenis} untuk ${d.nama_lengkap||d.nis||d.id}`,details:{santri_id:d.id,tahun_ajaran_id:c.id,jenis_biaya:a.jenis,nominal:r}}),(0,h.revalidatePath)(j),{success:!0,id:s}}async function A(a){let b=await (0,f.Ht)(),c=Array.from(new Set(a.santriIds.filter(Boolean))),d=a.jenis.filter(a=>l.includes(a));if(!c.length)return{error:"Pilih santri terlebih dahulu."};if(!d.length)return{error:"Pilih jenis biaya terlebih dahulu."};let i=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]);if(!i)return{error:"Tahun ajaran tidak ditemukan."};let k=o(i),m=new Map((await x({tahunAjaranId:i.id,tahunTagihan:k,asrama:"SEMUA",kamar:"SEMUA",search:""})).map(a=>[a.id,a])),n=(0,e.$C)(),p=0,q=0,r=0;for(let a of c){let c=m.get(a);if(!c){q+=d.length;continue}for(let f of d){let d="BANGUNAN"===f?c.bangunan.sisa:c.tahunan[f]?.sisa;if(!d||d<=0){q+=1;continue}let g=(0,e.$C)();await (0,e.g7)(`
        INSERT INTO pembayaran_tahunan
          (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, batch_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
      `,[g,a,f,"BANGUNAN"===f?null:k,i.id,n,d,b?.id??null,`Bulk Non-SPP ${i.nama}`]),p+=1,r+=d}}return await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"bulk_payment",fiturHref:j,logKind:"create",entityType:"pembayaran_tahunan",entityId:n,entityLabel:`Batch ${n}`,summary:`Mencatat bulk pembayaran Non-SPP untuk ${c.length} santri`,details:{batch_id:n,tahun_ajaran_id:i.id,jenis:d,inserted:p,skipped:q,total:r}}),(0,h.revalidatePath)(j),{success:!0,batchId:n,inserted:p,skipped:q,total:r}}async function B(a){let b=await (0,f.Ht)(),c=a.alasan.trim();if(c.length<5)return{error:"Alasan void minimal 5 karakter."};if(!a.paymentId&&!a.batchId)return{error:"Target void tidak valid."};let d=[],i=p("p");a.paymentId?(i+=" AND p.id = ?",d.push(a.paymentId)):(i+=" AND p.batch_id = ?",d.push(a.batchId));let k=await (0,e.P)(`SELECT p.* FROM pembayaran_tahunan p WHERE ${i}`,d);if(!k.length)return{error:"Transaksi aktif tidak ditemukan atau sudah di-void."};let l=(0,e.tB)();return a.paymentId?await (0,e.g7)(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `,[c,b?.id??null,l,a.paymentId]):await (0,e.g7)(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE batch_id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `,[c,b?.id??null,l,a.batchId]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"void",fiturHref:j,logKind:"update",entityType:"pembayaran_tahunan",entityId:a.paymentId||a.batchId,entityLabel:a.paymentId?"Transaksi Non-SPP":`Batch ${a.batchId}`,summary:`Void ${k.length} transaksi Non-SPP`,details:{payment_id:a.paymentId,batch_id:a.batchId,alasan:c,count:k.length}}),(0,h.revalidatePath)(j),{success:!0,count:k.length}}async function C(a,b){if(!a)return null;let c=await (0,e.Zy)("SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at FROM santri WHERE id = ?",[a]);if(!c)return null;let d=await (0,e.P)(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `,[a]),f=c.tahun_masuk||(c.created_at?new Date(c.created_at).getFullYear():new Date().getFullYear()),g=b?await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[b]):await s(),h=g?await t(g.id,f):n(),i=o(g),j=d.filter(a=>"VOID"!==(a.status||"AKTIF")),l=j.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+m(b.nominal_bayar),0),p={BANGUNAN:Math.max(0,h.BANGUNAN-l),KESEHATAN:0,EHB:0,EKSKUL:0};return k.forEach(a=>{let b=j.filter(b=>b.jenis_biaya===a&&(b.tahun_ajaran_id&&b.tahun_ajaran_id===g?.id||!b.tahun_ajaran_id&&b.tahun_tagihan===i)).reduce((a,b)=>a+m(b.nominal_bayar),0);p[a]=Math.max(0,h[a]-b)}),{santri:{...c,tahun_masuk_fix:f},payments:d,saldo:p,tarif:h}}async function D(a){if(!a)return null;let b=await (0,e.Zy)(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE id = ?
  `,[a]);if(!b)return null;let c=b.tahun_masuk||(b.created_at?new Date(b.created_at).getFullYear():new Date().getFullYear()),d=await r(),f=await (0,e.P)(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY datetime(p.tanggal_bayar) DESC, p.tanggal_bayar DESC, p.id DESC
  `,[a]),g=f.filter(a=>"VOID"!==(a.status||"AKTIF")),h=g.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+m(b.nominal_bayar),0),i=await Promise.all(d.map(async a=>{let b=await t(a.id,c),d=o(a),e={BANGUNAN:{tarif:b.BANGUNAN,paid:h,sisa:Math.max(0,b.BANGUNAN-h)},KESEHATAN:{tarif:b.KESEHATAN,paid:0,sisa:0},EHB:{tarif:b.EHB,paid:0,sisa:0},EKSKUL:{tarif:b.EKSKUL,paid:0,sisa:0}};k.forEach(c=>{let f=g.filter(b=>b.jenis_biaya===c&&(b.tahun_ajaran_id&&b.tahun_ajaran_id===a.id||!b.tahun_ajaran_id&&b.tahun_tagihan===d)).reduce((a,b)=>a+m(b.nominal_bayar),0);e[c]={tarif:b[c],paid:f,sisa:Math.max(0,b[c]-f)}});let f=l.reduce((a,b)=>a+e[b].tarif,0),i=e.BANGUNAN.paid+k.reduce((a,b)=>a+e[b].paid,0),j=l.reduce((a,b)=>a+e[b].sisa,0);return{id:a.id,nama:a.nama,is_active:a.is_active,tahun_tagihan:d,categories:e,potential:f,received:i,remaining:j,complete:j<=0&&f>0}}));return{santri:{...b,tahun_masuk_fix:c},yearly:i,payments:f}}async function E(a){let b=`%${a.trim()}%`;return(0,e.P)(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
    LIMIT 12
  `,[b,b])}async function F(a){let b=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a]);if(!b)return null;let c=o(b),d=await (0,e.P)(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE (
      p.jenis_biaya = 'BANGUNAN'
      OR ${q("p")}
    )
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `,[b.id,c]),f=d.filter(a=>"VOID"!==(a.status||"AKTIF")),g={BANGUNAN:0,KESEHATAN:0,EHB:0,EKSKUL:0,TOTAL:0};f.forEach(a=>{l.includes(a.jenis_biaya)&&(g[a.jenis_biaya]+=m(a.nominal_bayar)),g.TOTAL+=m(a.nominal_bayar)});let h=await x({tahunAjaranId:b.id,tahunTagihan:c,asrama:"SEMUA",kamar:"SEMUA",search:""}),i={BANGUNAN:{target:0,terima:0,kurang:0},KESEHATAN:{target:0,terima:0,kurang:0},EHB:{target:0,terima:0,kurang:0},EKSKUL:{target:0,terima:0,kurang:0},TOTAL:{target:0,terima:0,kurang:0}};return h.forEach(a=>{i.BANGUNAN.target+=a.bangunan.tarif,i.BANGUNAN.terima+=a.bangunan.paid,i.BANGUNAN.kurang+=a.bangunan.sisa,i.TOTAL.target+=a.bangunan.tarif,i.TOTAL.terima+=a.bangunan.paid,i.TOTAL.kurang+=a.bangunan.sisa,k.forEach(b=>{i[b].target+=a.tahunan[b].tarif,i[b].terima+=a.tahunan[b].paid,i[b].kurang+=a.tahunan[b].sisa,i.TOTAL.target+=a.tahunan[b].tarif,i.TOTAL.terima+=a.tahunan[b].paid,i.TOTAL.kurang+=a.tahunan[b].sisa})}),{tahunAjaran:b,cashFlow:g,targets:i,list:d}}async function G(a){let b=await (0,e.Zy)(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.created_at,
           ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    WHERE p.id = ?
  `,[a]);return b?{receipt:b}:{error:"Transaksi tidak ditemukan."}}(0,i.D)([r,s,t,u,v,y,z,A,B,C,D,E,F,G]),(0,d.A)(r,"0075b6fe3f3946f33b123279fc414d6653d61411f4",null),(0,d.A)(s,"00fb292c31ffce5f04da45dc74cfa22bbb43f9c3ab",null),(0,d.A)(t,"60e888e5fcb01fe4c6d9c70ac4a9f0e846e5b91d09",null),(0,d.A)(u,"4052675297bac2ac19cc31323fc6334b3cf1bf310e",null),(0,d.A)(v,"4003d671afacd8450a5af57c4681d41ecd15042ad9",null),(0,d.A)(y,"4077c107760f8fbe8bae53cfd00fb5c77e3f3627b5",null),(0,d.A)(z,"40497c55aeb4d06bc21f0d35b2386735ba31ce7dc5",null),(0,d.A)(A,"4043c3f3cc1e590e5f1c12691a350f3530eafdc796",null),(0,d.A)(B,"400020bfd5369fd2c76922aff83ba2051dbaa487d6",null),(0,d.A)(C,"60e9d7a17d5cb67e25a85d7e4c31567b942544285f",null),(0,d.A)(D,"407f9ccd12a2df9828a0338e42200d23fd01eef9e2",null),(0,d.A)(E,"40a3f560a2c0c61479eb012b34344b4c29db00ffe0",null),(0,d.A)(F,"40f50e94fe486b28a15c45932dc01d649f48e63dc1",null),(0,d.A)(G,"40dc6caf9db459115d6e7c45e2f8b05a0a1261c7a6",null)},30236:(a,b,c)=>{c.d(b,{CF:()=>k,DS:()=>p,Mx:()=>q,NL:()=>m,Pu:()=>o,bO:()=>r});var d=c(65573),e=c(44075);let f=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),g=null,h=new Map;function i(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function j(a){return null==a?null:"string"==typeof a?i(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(j):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!f.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,j(b)])):String(a)}function k(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function l(){try{let a=await (0,d.b3)(),b=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(b?b.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function m(){g||(g=(async()=>{await (0,e.g7)(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id            TEXT PRIMARY KEY,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          actor_name    TEXT,
          actor_roles   TEXT,
          module        TEXT NOT NULL,
          action        TEXT NOT NULL,
          entity_type   TEXT,
          entity_id     TEXT,
          entity_label  TEXT,
          summary       TEXT NOT NULL,
          details_json  TEXT,
          status        TEXT NOT NULL DEFAULT 'success',
          ip_address    TEXT,
          user_agent    TEXT
        )
      `),await (0,e.g7)(`
        CREATE TABLE IF NOT EXISTS activity_log_config (
          fitur_href   TEXT PRIMARY KEY,
          group_name   TEXT NOT NULL,
          title        TEXT NOT NULL,
          log_create   INTEGER NOT NULL DEFAULT 1,
          log_update   INTEGER NOT NULL DEFAULT 1,
          log_delete   INTEGER NOT NULL DEFAULT 1,
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
        )
      `),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)");try{await (0,e.g7)(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `),await (0,e.g7)(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)}catch{}})().catch(a=>{throw g=null,a})),await g}async function n(a,b){if(!a||!b)return!0;let c=`${a}:${b}`,d=h.get(c);if(d&&d.expiresAt>Date.now())return d.values[b];await m();let f=await (0,e.Zy)(`SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]),g=f?{create:1===f.log_create,update:1===f.log_update,delete:1===f.log_delete}:{create:!0,update:!0,delete:!0},i=Date.now()+6e4;return h.set(`${a}:create`,{expiresAt:i,values:g}),h.set(`${a}:update`,{expiresAt:i,values:g}),h.set(`${a}:delete`,{expiresAt:i,values:g}),g[b]}async function o(){return await m(),(0,e.P)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`)}async function p(a,b,c){await m();let d=await (0,e.Zy)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]);if(!d)throw Error("Konfigurasi log fitur tidak ditemukan.");let f={create:b.create??1===d.log_create,update:b.update??1===d.log_update,delete:b.delete??1===d.log_delete};await (0,e.g7)(`UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,[+!!f.create,+!!f.update,+!!f.delete,c,a]);let g=Date.now()+6e4,i={create:f.create,update:f.update,delete:f.delete};h.set(`${a}:create`,{expiresAt:g,values:i}),h.set(`${a}:update`,{expiresAt:g,values:i}),h.set(`${a}:delete`,{expiresAt:g,values:i})}async function q(a){try{var b,c;if(await m(),!await n(a.fiturHref,a.logKind))return;let d=a.requestInfo??await l(),f=a.actor??null;await (0,e.g7)(`INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,e.$C)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,i(a.summary,300),!(c=a.details)?null:JSON.stringify(j(c)),a.status??"success",d.ipAddress??null,d.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function r(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:j(c),after:j(f)})}return d}},31788:(a,b,c)=>{c.r(b),c.d(b,{"0075b6fe3f3946f33b123279fc414d6653d61411f4":()=>d.mJ,"00fb292c31ffce5f04da45dc74cfa22bbb43f9c3ab":()=>d.m$,"400020bfd5369fd2c76922aff83ba2051dbaa487d6":()=>d.h2,"4003d671afacd8450a5af57c4681d41ecd15042ad9":()=>d.HL,"4043c3f3cc1e590e5f1c12691a350f3530eafdc796":()=>d.sn,"40497c55aeb4d06bc21f0d35b2386735ba31ce7dc5":()=>d.bD,"4052675297bac2ac19cc31323fc6334b3cf1bf310e":()=>d.DK,"4077c107760f8fbe8bae53cfd00fb5c77e3f3627b5":()=>d.te,"407f9ccd12a2df9828a0338e42200d23fd01eef9e2":()=>d.W1,"40a3f560a2c0c61479eb012b34344b4c29db00ffe0":()=>d.AM,"40dc6caf9db459115d6e7c45e2f8b05a0a1261c7a6":()=>d.Zm,"40f50e94fe486b28a15c45932dc01d649f48e63dc1":()=>d.mv,"60e888e5fcb01fe4c6d9c70ac4a9f0e846e5b91d09":()=>d.l8,"60e9d7a17d5cb67e25a85d7e4c31567b942544285f":()=>d.Yb});var d=c(3041)},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},55743:(a,b,c)=>{c.d(b,{HA:()=>k,Yf:()=>i,ZW:()=>j,hj:()=>h});var d=c(44075),e=c(23755),f=c(65926);function g(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function h(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(g)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function i(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let g=(0,e.XV)(a);if(0===g.length)return!1;try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1`,[b])).some(a=>(0,f.Q)([a.role],g))}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function j(a,b){return i(await (0,e.Ht)(),a,b)}async function k(a,b){let c=await (0,e.Ht)(),d=await i(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},89991:(a,b,c)=>{c.r(b),c.d(b,{"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C});var d=c(38052)}};