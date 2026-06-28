"use strict";exports.id=1261,exports.ids=[1261],exports.modules={1501:(a,b,c)=>{c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},3041:(a,b,c)=>{c.d(b,{AM:()=>O,DK:()=>C,HL:()=>D,VF:()=>L,W1:()=>N,Yb:()=>M,Zm:()=>Q,bD:()=>H,bo:()=>K,h2:()=>J,l8:()=>B,m$:()=>A,mJ:()=>z,mv:()=>P,sn:()=>I,te:()=>G});var d=c(49796),e=c(44075),f=c(23755),g=c(30236),h=c(16949),i=c(24424);let j="/dashboard/keuangan/non-spp",k=["KESEHATAN","EHB","EKSKUL"],l=["BANGUNAN",...k],m="keuangan_non_spp_cutoff_tanggal",n="2026-07-01";function o(a){let b=Number(a??0);return Number.isFinite(b)?b:0}function p(){return{BANGUNAN:0,KESEHATAN:0,EHB:0,EKSKUL:0}}function q(a){let b=a?.nama?.match(/\b(20\d{2}|19\d{2})\b/);return b?Number(b[1]):new Date().getFullYear()}function r(a="p"){return`COALESCE(${a}.status, 'AKTIF') != 'VOID'`}function s(a="p"){return`((${a}.tahun_ajaran_id = ?) OR (${a}.tahun_ajaran_id IS NULL AND ${a}.tahun_tagihan = ?))`}function t(a){let b=String(a??"").slice(0,10);return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:null}function u(a){if(a.tahun_masuk)return Number(a.tahun_masuk);let b=Number(String(a.tanggal_masuk??"").slice(0,4));if(Number.isFinite(b)&&b>0)return b;let c=a.created_at?new Date(a.created_at).getFullYear():new Date().getFullYear();return Number.isFinite(c)?c:new Date().getFullYear()}function v(a,b){let c=t(a.created_at);return!!c&&c<b&&!a.psb_flow_id}async function w(){await (0,e.g7)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `),await (0,e.g7)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[m,n]),await (0,e.g7)(`
    CREATE TABLE IF NOT EXISTS keuangan_non_spp_opening_balance (
      id                TEXT PRIMARY KEY,
      santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      tahun_ajaran_id   INTEGER NOT NULL REFERENCES tahun_ajaran(id),
      jenis_biaya       TEXT NOT NULL,
      nominal_tagihan   INTEGER NOT NULL DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'AKTIF',
      catatan           TEXT,
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      void_reason       TEXT,
      voided_by         TEXT REFERENCES users(id),
      voided_at         TEXT
    )
  `),await (0,e.g7)(`
    CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_santri_ta
      ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, status)
  `),await (0,e.g7)(`
    CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_ta_status
      ON keuangan_non_spp_opening_balance(tahun_ajaran_id, status)
  `),await (0,e.g7)(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_non_spp_opening_balance_active
      ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, jenis_biaya)
      WHERE COALESCE(status, 'AKTIF') != 'VOID'
  `)}async function x(){await w();let a=await (0,e.Zy)("SELECT value FROM app_settings WHERE key = ?",[m]);return t(a?.value)??n}function y(a){let b=new Map;return a.forEach(a=>{b.has(a.santri_id)||b.set(a.santri_id,[]),b.get(a.santri_id).push(a)}),b}async function z(){return(0,e.P)("SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC")}async function A(){return(0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE is_active = 1 LIMIT 1")}async function B(a,b){let c=p(),d=await (0,e.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ?",[a,b]);return(d.length?d:await (0,e.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id IS NULL AND tahun_angkatan = ?",[b])).forEach(a=>{l.includes(a.jenis_biaya)&&(c[a.jenis_biaya]=o(a.nominal))}),c}async function C(a){let b=await (0,e.P)(`
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
  `,[a,a]),c=new Map;return b.forEach(a=>{c.has(a.tahun_angkatan)||c.set(a.tahun_angkatan,{tahun:a.tahun_angkatan,legacy:1===a.source_rank,...p()});let b=c.get(a.tahun_angkatan);b[a.jenis_biaya]=o(a.nominal),b.legacy=b.legacy&&1===a.source_rank}),Array.from(c.values())}async function D(a){let b=await (0,f.Ht)(),c=Number(a.tahunAjaranId),d=Number(a.tahunAngkatan);if(!Number.isInteger(c)||c<=0)return{error:"Tahun ajaran tidak valid."};if(!Number.isInteger(d)||d<=0)return{error:"Tahun angkatan tidak valid."};for(let b of l){let f=Math.max(0,o(a.tarif[b])),g=await (0,e.Zy)("SELECT id FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ? AND jenis_biaya = ?",[c,d,b]);g?await (0,e.g7)("UPDATE biaya_settings SET nominal = ? WHERE id = ?",[f,g.id]):await (0,e.g7)("INSERT INTO biaya_settings (tahun_ajaran_id, tahun_angkatan, jenis_biaya, nominal) VALUES (?, ?, ?, ?)",[c,d,b,f])}return await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"update_tarif",fiturHref:j,logKind:"update",entityType:"biaya_settings",entityLabel:`${c}/${d}`,summary:`Menyimpan tarif Non-SPP angkatan ${d}`,details:{tahun_ajaran_id:c,tahun_angkatan:d,tarif:a.tarif}}),(0,h.revalidateTag)("biaya-settings","everything"),(0,h.revalidatePath)(j),{success:!0}}async function E(a){let b=await (0,e.P)(`
    SELECT tahun_angkatan, jenis_biaya, nominal, 0 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id = ?
    UNION ALL
    SELECT tahun_angkatan, jenis_biaya, nominal, 1 AS source_rank
    FROM biaya_settings
    WHERE tahun_ajaran_id IS NULL
    ORDER BY source_rank ASC
  `,[a]),c=new Map;return b.forEach(a=>{let b=`${a.tahun_angkatan}-${a.jenis_biaya}`;c.has(b)||c.set(b,o(a.nominal))}),c}async function F(a){let b=await x(),c=`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.status_global = 'aktif'
  `,d=[];if(a.asrama&&"SEMUA"!==a.asrama&&(c+=" AND s.asrama = ?",d.push(a.asrama)),a.kamar&&"SEMUA"!==a.kamar&&(c+=" AND s.kamar = ?",d.push(a.kamar)),a.search.trim()){c+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let b=`%${a.search.trim()}%`;d.push(b,b)}c+=" ORDER BY s.nama_lengkap";let f=await (0,e.P)(c,d),g=await E(a.tahunAjaranId),h=y(await (0,e.P)(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.tahun_ajaran_id = ?
      AND COALESCE(ob.status, 'AKTIF') != 'VOID'
  `,[a.tahunAjaranId])),i=`
    SELECT p.*
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    WHERE s.status_global = 'aktif'
      AND ${r("p")}
      AND (
        p.jenis_biaya = 'BANGUNAN'
        OR (${s("p")})
      )
  `,j=[a.tahunAjaranId,a.tahunTagihan];if(a.asrama&&"SEMUA"!==a.asrama&&(i+=" AND s.asrama = ?",j.push(a.asrama)),a.kamar&&"SEMUA"!==a.kamar&&(i+=" AND s.kamar = ?",j.push(a.kamar)),a.search.trim()){i+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let b=`%${a.search.trim()}%`;j.push(b,b)}let m=await (0,e.P)(i,j),n=new Map;return m.forEach(a=>{n.has(a.santri_id)||n.set(a.santri_id,[]),n.get(a.santri_id).push(a)}),f.map(a=>{let c=u(a),d=v(a,b),e=n.get(a.id)??[],f=h.get(a.id)??[],i=p();f.forEach(a=>{l.includes(a.jenis_biaya)&&(i[a.jenis_biaya]+=o(a.nominal_tagihan))});let j=p();l.forEach(a=>{j[a]=d?i[a]:g.get(`${c}-${a}`)??0});let m=e.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+o(b.nominal_bayar),0),q=d&&j.BANGUNAN<=0?0:m,r=Math.max(0,j.BANGUNAN-q),s=Object.fromEntries(k.map(a=>{let b=e.filter(b=>b.jenis_biaya===a),c=b.reduce((a,b)=>a+o(b.nominal_bayar),0),f=d&&j[a]<=0?0:c,g=Math.max(0,j[a]-f);return[a,{tarif:j[a],paid:f,sisa:g,lunas:j[a]>0&&g<=0,paymentIds:b.filter(a=>!a.psb_receipt_id).map(a=>a.id),hasPsbPayment:b.some(a=>!!a.psb_receipt_id)}]})),t=r+k.reduce((a,b)=>a+s[b].sisa,0);return{...a,tahun_masuk_fix:c,is_legacy_settled:d,legacy_cutoff_tanggal:b,opening_balance:i,opening_balance_rows:f,tarif:j,bangunan:{tarif:j.BANGUNAN,paid:q,sisa:r,status:j.BANGUNAN<=0?"-":r<=0?"LUNAS":q>0?"CICIL":"BELUM",paymentIds:e.filter(a=>"BANGUNAN"===a.jenis_biaya).map(a=>a.id)},tahunan:s,total_kurang:t,is_full_tahunan:k.every(a=>s[a].lunas)}})}async function G(a){let b=q(await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]));return F({tahunAjaranId:a.tahunAjaranId,tahunTagihan:b,asrama:a.asrama||"SEMUA",kamar:a.kamar||"SEMUA",search:a.search||""})}async function H(a){let b=await (0,f.Ht)();if(!l.includes(a.jenis))return{error:"Jenis biaya tidak valid."};let c=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]);if(!c)return{error:"Tahun ajaran tidak ditemukan."};let d=await x(),i=await (0,e.Zy)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `,[a.santriId]);if(!i)return{error:"Santri tidak ditemukan."};let k=u(i),m=q(c),n=v(i,d),t=n?p():await B(c.id,k);n&&(await (0,e.P)(`
      SELECT *
      FROM keuangan_non_spp_opening_balance
      WHERE santri_id = ?
        AND tahun_ajaran_id = ?
        AND COALESCE(status, 'AKTIF') != 'VOID'
    `,[i.id,c.id])).forEach(a=>{l.includes(a.jenis_biaya)&&(t[a.jenis_biaya]+=o(a.nominal_tagihan))});let w=t[a.jenis]??0;if(w<=0)return{error:`Tarif ${a.jenis} belum diatur untuk angkatan ini.`};let y=Math.max(0,o(a.nominal));if("BANGUNAN"===a.jenis){let a=await (0,e.Zy)(`SELECT COALESCE(SUM(nominal_bayar), 0) AS total FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = 'BANGUNAN' AND ${r()}`,[i.id]),b=Math.max(0,w-o(a?.total));if(b<=0)return{error:"Uang Bangunan santri ini sudah lunas."};y=y>0?Math.min(y,b):b}else{let b=await (0,e.Zy)(`SELECT COALESCE(SUM(nominal_bayar), 0) AS total
       FROM pembayaran_tahunan p
       WHERE santri_id = ? AND jenis_biaya = ? AND ${r("p")} AND ${s("p")}`,[i.id,a.jenis,c.id,m]),d=Math.max(0,w-o(b?.total));if(d<=0)return{error:`${a.jenis} tahun ajaran ini sudah lunas.`};y=d}if(y<=0)return{error:"Nominal pembayaran tidak valid."};let z=(0,e.$C)();return await (0,e.g7)(`
    INSERT INTO pembayaran_tahunan
      (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
  `,[z,i.id,a.jenis,"BANGUNAN"===a.jenis?null:m,c.id,y,b?.id??null,"BANGUNAN"===a.jenis?"Pembayaran Bangunan inline":`Pembayaran ${a.jenis} ${c.nama}`]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"payment",fiturHref:j,logKind:"create",entityType:"pembayaran_tahunan",entityId:z,entityLabel:i.nama_lengkap||i.nis||i.id,summary:`Mencatat pembayaran ${a.jenis} untuk ${i.nama_lengkap||i.nis||i.id}`,details:{santri_id:i.id,tahun_ajaran_id:c.id,jenis_biaya:a.jenis,nominal:y}}),(0,h.revalidatePath)(j),{success:!0,id:z}}async function I(a){let b=await (0,f.Ht)(),c=Array.from(new Set(a.santriIds.filter(Boolean))),d=a.jenis.filter(a=>l.includes(a));if(!c.length)return{error:"Pilih santri terlebih dahulu."};if(!d.length)return{error:"Pilih jenis biaya terlebih dahulu."};let i=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]);if(!i)return{error:"Tahun ajaran tidak ditemukan."};let k=q(i),m=new Map((await F({tahunAjaranId:i.id,tahunTagihan:k,asrama:"SEMUA",kamar:"SEMUA",search:""})).map(a=>[a.id,a])),n=(0,e.$C)(),o=0,p=0,r=0;for(let a of c){let c=m.get(a);if(!c){p+=d.length;continue}for(let f of d){let d="BANGUNAN"===f?c.bangunan.sisa:c.tahunan[f]?.sisa;if(!d||d<=0){p+=1;continue}let g=(0,e.$C)();await (0,e.g7)(`
        INSERT INTO pembayaran_tahunan
          (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, batch_id, nominal_bayar, penerima_id, keterangan, tanggal_bayar, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF')
      `,[g,a,f,"BANGUNAN"===f?null:k,i.id,n,d,b?.id??null,`Bulk Non-SPP ${i.nama}`]),o+=1,r+=d}}return await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"bulk_payment",fiturHref:j,logKind:"create",entityType:"pembayaran_tahunan",entityId:n,entityLabel:`Batch ${n}`,summary:`Mencatat bulk pembayaran Non-SPP untuk ${c.length} santri`,details:{batch_id:n,tahun_ajaran_id:i.id,jenis:d,inserted:o,skipped:p,total:r}}),(0,h.revalidatePath)(j),{success:!0,batchId:n,inserted:o,skipped:p,total:r}}async function J(a){let b=await (0,f.Ht)(),c=a.alasan.trim();if(c.length<5)return{error:"Alasan void minimal 5 karakter."};if(!a.paymentId&&!a.batchId)return{error:"Target void tidak valid."};let d=[],i=r("p");a.paymentId?(i+=" AND p.id = ?",d.push(a.paymentId)):(i+=" AND p.batch_id = ?",d.push(a.batchId));let k=await (0,e.P)(`SELECT p.* FROM pembayaran_tahunan p WHERE ${i}`,d);if(!k.length)return{error:"Transaksi aktif tidak ditemukan atau sudah di-void."};let l=(0,e.tB)();return a.paymentId?await (0,e.g7)(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `,[c,b?.id??null,l,a.paymentId]):await (0,e.g7)(`
      UPDATE pembayaran_tahunan
      SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
      WHERE batch_id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `,[c,b?.id??null,l,a.batchId]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"void",fiturHref:j,logKind:"update",entityType:"pembayaran_tahunan",entityId:a.paymentId||a.batchId,entityLabel:a.paymentId?"Transaksi Non-SPP":`Batch ${a.batchId}`,summary:`Void ${k.length} transaksi Non-SPP`,details:{payment_id:a.paymentId,batch_id:a.batchId,alasan:c,count:k.length}}),(0,h.revalidatePath)(j),{success:!0,count:k.length}}async function K(a){let b=await (0,f.Ht)();if(await w(),!l.includes(a.jenis))return{error:"Jenis biaya tidak valid."};let c=Math.max(0,o(a.nominal));if(c<=0)return{error:"Nominal tagihan awal wajib lebih dari 0."};let d=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a.tahunAjaranId]);if(!d)return{error:"Tahun ajaran tidak ditemukan."};let i=await x(),k=await (0,e.Zy)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a.santriId]);if(!k)return{error:"Santri tidak ditemukan."};if(!v(k,i))return{error:"Tagihan awal hanya untuk santri legacy/migrasi."};let m=await (0,e.Zy)(`
    SELECT id FROM keuangan_non_spp_opening_balance
    WHERE santri_id = ? AND tahun_ajaran_id = ? AND jenis_biaya = ? AND COALESCE(status, 'AKTIF') != 'VOID'
  `,[k.id,d.id,a.jenis]),n=a.catatan?.trim()||`Tagihan awal migrasi ${d.nama}`;if(m)return await (0,e.g7)(`
      UPDATE keuangan_non_spp_opening_balance
      SET nominal_tagihan = ?, catatan = ?
      WHERE id = ?
    `,[c,n,m.id]),(0,h.revalidatePath)(j),(0,h.revalidatePath)(`${j}/buku-besar/${k.id}`),{success:!0,id:m.id};let p=(0,e.$C)();return await (0,e.g7)(`
    INSERT INTO keuangan_non_spp_opening_balance
      (id, santri_id, tahun_ajaran_id, jenis_biaya, nominal_tagihan, status, catatan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'AKTIF', ?, ?, datetime('now'))
  `,[p,k.id,d.id,a.jenis,c,n,b?.id??null]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"opening_balance",fiturHref:j,logKind:"create",entityType:"keuangan_non_spp_opening_balance",entityId:p,entityLabel:k.nama_lengkap||k.nis||k.id,summary:`Menandai tagihan awal ${a.jenis} untuk ${k.nama_lengkap||k.nis||k.id}`,details:{santri_id:k.id,tahun_ajaran_id:d.id,jenis_biaya:a.jenis,nominal:c}}),(0,h.revalidatePath)(j),(0,h.revalidatePath)(`${j}/buku-besar/${k.id}`),{success:!0,id:p}}async function L(a){let b=await (0,f.Ht)();await w();let c=a.alasan.trim();if(c.length<5)return{error:"Alasan void minimal 5 karakter."};let d=await (0,e.Zy)(`
    SELECT *
    FROM keuangan_non_spp_opening_balance
    WHERE id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
  `,[a.openingBalanceId]);return d?(await (0,e.g7)(`
    UPDATE keuangan_non_spp_opening_balance
    SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
    WHERE id = ?
  `,[c,b?.id??null,(0,e.tB)(),d.id]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"keuangan_non_spp",action:"opening_balance_void",fiturHref:j,logKind:"update",entityType:"keuangan_non_spp_opening_balance",entityId:d.id,entityLabel:d.jenis_biaya,summary:`Void tagihan awal ${d.jenis_biaya}`,details:{santri_id:d.santri_id,tahun_ajaran_id:d.tahun_ajaran_id,alasan:c}}),(0,h.revalidatePath)(j),(0,h.revalidatePath)(`${j}/buku-besar/${d.santri_id}`),{success:!0}):{error:"Tagihan awal aktif tidak ditemukan."}}async function M(a,b){if(!a)return null;let c=await x(),d=await (0,e.Zy)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `,[a]);if(!d)return null;let f=await (0,e.P)(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `,[a]),g=u(d),h=v(d,c),i=b?await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[b]):await A(),j=i?await (0,e.P)(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.santri_id = ?
      AND ob.tahun_ajaran_id = ?
      AND COALESCE(ob.status, 'AKTIF') != 'VOID'
  `,[d.id,i.id]):[],m=i&&!h?await B(i.id,g):p();h&&j.forEach(a=>{l.includes(a.jenis_biaya)&&(m[a.jenis_biaya]+=o(a.nominal_tagihan))});let n=q(i),r=f.filter(a=>"VOID"!==(a.status||"AKTIF")),s=r.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+o(b.nominal_bayar),0),t=h&&m.BANGUNAN<=0?0:s,w={BANGUNAN:Math.max(0,m.BANGUNAN-t),KESEHATAN:0,EHB:0,EKSKUL:0};return k.forEach(a=>{let b=r.filter(b=>b.jenis_biaya===a&&(b.tahun_ajaran_id&&b.tahun_ajaran_id===i?.id||!b.tahun_ajaran_id&&b.tahun_tagihan===n)).reduce((a,b)=>a+o(b.nominal_bayar),0),c=h&&m[a]<=0?0:b;w[a]=Math.max(0,m[a]-c)}),{santri:{...d,tahun_masuk_fix:g,is_legacy_settled:h,legacy_cutoff_tanggal:c},payments:f,openingBalances:j,saldo:w,tarif:m}}async function N(a){if(!a)return null;let b=await x(),c=await (0,e.Zy)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `,[a]);if(!c)return null;let d=u(c),f=v(c,b),g=await z(),h=await (0,e.P)(`
    SELECT p.*, ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE p.santri_id = ?
    ORDER BY datetime(p.tanggal_bayar) DESC, p.tanggal_bayar DESC, p.id DESC
  `,[a]),i=h.filter(a=>"VOID"!==(a.status||"AKTIF")),j=await (0,e.P)(`
    SELECT ob.*, u.full_name AS penerima_nama
    FROM keuangan_non_spp_opening_balance ob
    LEFT JOIN users u ON u.id = ob.created_by
    WHERE ob.santri_id = ?
    ORDER BY datetime(ob.created_at) DESC, ob.created_at DESC
  `,[a]),m=y(j.filter(a=>"VOID"!==(a.status||"AKTIF"))),n=i.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+o(b.nominal_bayar),0),r=await Promise.all(g.map(async b=>{let c=f?p():await B(b.id,d);f&&(m.get(a)??[]).filter(a=>a.tahun_ajaran_id===b.id).forEach(a=>{l.includes(a.jenis_biaya)&&(c[a.jenis_biaya]+=o(a.nominal_tagihan))});let e=q(b),g={BANGUNAN:{tarif:c.BANGUNAN,paid:f&&c.BANGUNAN<=0?0:n,sisa:Math.max(0,c.BANGUNAN-(f&&c.BANGUNAN<=0?0:n))},KESEHATAN:{tarif:c.KESEHATAN,paid:0,sisa:0},EHB:{tarif:c.EHB,paid:0,sisa:0},EKSKUL:{tarif:c.EKSKUL,paid:0,sisa:0}};k.forEach(a=>{let d=i.filter(c=>c.jenis_biaya===a&&(c.tahun_ajaran_id&&c.tahun_ajaran_id===b.id||!c.tahun_ajaran_id&&c.tahun_tagihan===e)).reduce((a,b)=>a+o(b.nominal_bayar),0),h=f&&c[a]<=0?0:d;g[a]={tarif:c[a],paid:h,sisa:Math.max(0,c[a]-h)}});let h=l.reduce((a,b)=>a+g[b].tarif,0),j=g.BANGUNAN.paid+k.reduce((a,b)=>a+g[b].paid,0),r=l.reduce((a,b)=>a+g[b].sisa,0);return{id:b.id,nama:b.nama,is_active:b.is_active,tahun_tagihan:e,categories:g,potential:h,received:j,remaining:r,complete:r<=0&&h>0}}));return{santri:{...c,tahun_masuk_fix:d,is_legacy_settled:f,legacy_cutoff_tanggal:b},yearly:r,payments:h,openingBalances:j}}async function O(a){let b=`%${a.trim()}%`;return(0,e.P)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at,
           pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.status_global = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
    ORDER BY s.nama_lengkap
    LIMIT 12
  `,[b,b])}async function P(a){let b=await (0,e.Zy)("SELECT id, nama, is_active FROM tahun_ajaran WHERE id = ?",[a]);if(!b)return null;let c=q(b),d=await (0,e.P)(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, u.full_name AS penerima_nama, vu.full_name AS voided_by_name
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN users u ON u.id = p.penerima_id
    LEFT JOIN users vu ON vu.id = p.voided_by
    WHERE (
      p.jenis_biaya = 'BANGUNAN'
      OR ${s("p")}
    )
    ORDER BY p.tanggal_bayar DESC, p.id DESC
  `,[b.id,c]),f=d.filter(a=>"VOID"!==(a.status||"AKTIF")),g={BANGUNAN:0,KESEHATAN:0,EHB:0,EKSKUL:0,TOTAL:0};f.forEach(a=>{l.includes(a.jenis_biaya)&&(g[a.jenis_biaya]+=o(a.nominal_bayar)),g.TOTAL+=o(a.nominal_bayar)});let h=await F({tahunAjaranId:b.id,tahunTagihan:c,asrama:"SEMUA",kamar:"SEMUA",search:""}),i=h.filter(a=>a.is_legacy_settled&&a.total_kurang<=0).length,j=h.filter(a=>a.is_legacy_settled&&a.total_kurang>0).length,m={BANGUNAN:{target:0,terima:0,kurang:0},KESEHATAN:{target:0,terima:0,kurang:0},EHB:{target:0,terima:0,kurang:0},EKSKUL:{target:0,terima:0,kurang:0},TOTAL:{target:0,terima:0,kurang:0}};return h.forEach(a=>{m.BANGUNAN.target+=a.bangunan.tarif,m.BANGUNAN.terima+=a.bangunan.paid,m.BANGUNAN.kurang+=a.bangunan.sisa,m.TOTAL.target+=a.bangunan.tarif,m.TOTAL.terima+=a.bangunan.paid,m.TOTAL.kurang+=a.bangunan.sisa,k.forEach(b=>{m[b].target+=a.tahunan[b].tarif,m[b].terima+=a.tahunan[b].paid,m[b].kurang+=a.tahunan[b].sisa,m.TOTAL.target+=a.tahunan[b].tarif,m.TOTAL.terima+=a.tahunan[b].paid,m.TOTAL.kurang+=a.tahunan[b].sisa})}),{tahunAjaran:b,cashFlow:g,targets:m,list:d,legacy:{cutoffTanggal:await x(),settledCount:i,piutangCount:j}}}async function Q(a){let b=await (0,e.Zy)(`
    SELECT p.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.created_at,
           ta.nama AS tahun_ajaran_nama, u.full_name AS penerima_nama
    FROM pembayaran_tahunan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
    LEFT JOIN users u ON u.id = p.penerima_id
    WHERE p.id = ?
  `,[a]);return b?{receipt:b}:{error:"Transaksi tidak ditemukan."}}(0,i.D)([z,A,B,C,D,G,H,I,J,K,L,M,N,O,P,Q]),(0,d.A)(z,"0075b6fe3f3946f33b123279fc414d6653d61411f4",null),(0,d.A)(A,"00fb292c31ffce5f04da45dc74cfa22bbb43f9c3ab",null),(0,d.A)(B,"60e888e5fcb01fe4c6d9c70ac4a9f0e846e5b91d09",null),(0,d.A)(C,"4052675297bac2ac19cc31323fc6334b3cf1bf310e",null),(0,d.A)(D,"4003d671afacd8450a5af57c4681d41ecd15042ad9",null),(0,d.A)(G,"4077c107760f8fbe8bae53cfd00fb5c77e3f3627b5",null),(0,d.A)(H,"40497c55aeb4d06bc21f0d35b2386735ba31ce7dc5",null),(0,d.A)(I,"4043c3f3cc1e590e5f1c12691a350f3530eafdc796",null),(0,d.A)(J,"400020bfd5369fd2c76922aff83ba2051dbaa487d6",null),(0,d.A)(K,"40e6003d07aaf5cda0472fa971a13c4b32e9b0c196",null),(0,d.A)(L,"40e8fc20c4eaf8ff9836c1fe16df7fc561b4f181f0",null),(0,d.A)(M,"60e9d7a17d5cb67e25a85d7e4c31567b942544285f",null),(0,d.A)(N,"407f9ccd12a2df9828a0338e42200d23fd01eef9e2",null),(0,d.A)(O,"40a3f560a2c0c61479eb012b34344b4c29db00ffe0",null),(0,d.A)(P,"40f50e94fe486b28a15c45932dc01d649f48e63dc1",null),(0,d.A)(Q,"40dc6caf9db459115d6e7c45e2f8b05a0a1261c7a6",null)},22278:(a,b,c)=>{c.r(b),c.d(b,{"0075b6fe3f3946f33b123279fc414d6653d61411f4":()=>d.mJ,"00fb292c31ffce5f04da45dc74cfa22bbb43f9c3ab":()=>d.m$,"400020bfd5369fd2c76922aff83ba2051dbaa487d6":()=>d.h2,"4003d671afacd8450a5af57c4681d41ecd15042ad9":()=>d.HL,"4043c3f3cc1e590e5f1c12691a350f3530eafdc796":()=>d.sn,"40497c55aeb4d06bc21f0d35b2386735ba31ce7dc5":()=>d.bD,"4052675297bac2ac19cc31323fc6334b3cf1bf310e":()=>d.DK,"4077c107760f8fbe8bae53cfd00fb5c77e3f3627b5":()=>d.te,"407f9ccd12a2df9828a0338e42200d23fd01eef9e2":()=>d.W1,"40a3f560a2c0c61479eb012b34344b4c29db00ffe0":()=>d.AM,"40dc6caf9db459115d6e7c45e2f8b05a0a1261c7a6":()=>d.Zm,"40e6003d07aaf5cda0472fa971a13c4b32e9b0c196":()=>d.bo,"40e8fc20c4eaf8ff9836c1fe16df7fc561b4f181f0":()=>d.VF,"40f50e94fe486b28a15c45932dc01d649f48e63dc1":()=>d.mv,"60e888e5fcb01fe4c6d9c70ac4a9f0e846e5b91d09":()=>d.l8,"60e9d7a17d5cb67e25a85d7e4c31567b942544285f":()=>d.Yb});var d=c(3041)},30236:(a,b,c)=>{c.d(b,{CF:()=>k,DS:()=>p,Mx:()=>q,NL:()=>m,Pu:()=>o,bO:()=>r});var d=c(65573),e=c(44075);let f=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),g=null,h=new Map;function i(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function j(a){return null==a?null:"string"==typeof a?i(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(j):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!f.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,j(b)])):String(a)}function k(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function l(){try{let a=await (0,d.b3)(),b=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(b?b.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function m(){g||(g=(async()=>{await (0,e.g7)(`
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,e.$C)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,i(a.summary,300),!(c=a.details)?null:JSON.stringify(j(c)),a.status??"success",d.ipAddress??null,d.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function r(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:j(c),after:j(f)})}return d}},45502:(a,b,c)=>{c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},55743:(a,b,c)=>{c.d(b,{HA:()=>k,Yf:()=>i,ZW:()=>j,hj:()=>h});var d=c(44075),e=c(23755),f=c(65926);function g(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function h(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(g)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function i(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let g=(0,e.XV)(a);if(0===g.length)return!1;try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1`,[b])).some(a=>(0,f.Q)([a.role],g))}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function j(a,b){return i(await (0,e.Ht)(),a,b)}async function k(a,b){let c=await (0,e.Ht)(),d=await i(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},89991:(a,b,c)=>{c.r(b),c.d(b,{"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C});var d=c(38052)}};