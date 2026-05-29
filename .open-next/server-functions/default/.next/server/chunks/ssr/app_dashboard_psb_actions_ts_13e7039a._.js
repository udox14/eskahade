module.exports=[9366,a=>{"use strict";var b=a.i(37936),c=a.i(18558),d=a.i(6846),e=a.i(4552),f=a.i(53058),g=a.i(12259),h=a.i(85972),i=a.i(13095);let j="/dashboard/psb",k="/dashboard/psb/monitoring",l=["MTSU","MTSN","MAN","SMK","SMA","SMP","LAINNYA"],m=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"],n=["VERIFICATION","VERIFIED","PLACED_ASRAMA","PLACED_KAMAR","PAID","DONE"],o=["KESEHATAN","EHB","EKSKUL"];function p(a){return(0,f.isAdmin)(a)||(0,f.hasRole)(a,"sekpen")}function q(a){return(0,f.isAdmin)(a)||(0,f.hasRole)(a,"sekpen")}function r(a){return(0,f.isAdmin)(a)||(0,f.hasRole)(a,"pengurus_asrama")}function s(a){return(0,f.isAdmin)(a)||(0,f.hasRole)(a,"bendahara")}function t(a,b){return n.indexOf(a)>=n.indexOf(b)}function u(a){return n.includes(a)?a:"VERIFICATION"}function v(a){let b=a.bangunanTarget<=0||a.bangunanPaid>=a.bangunanTarget,c=o.every(b=>a.payments.some(c=>c.jenis_biaya===b&&Number(c.tahun_tagihan)===a.tahunTagihan));return b&&c}function w(a){if(a.tahun_masuk)return Number(a.tahun_masuk);let b=a.created_at?new Date(a.created_at).getFullYear():new Date().getFullYear();return Number.isFinite(b)?b:new Date().getFullYear()}async function x(){let a=await (0,g.getDB)();await a.batch([a.prepare(`
      CREATE TABLE IF NOT EXISTS psb_flow (
        id                    TEXT PRIMARY KEY,
        santri_id             TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        status                TEXT NOT NULL DEFAULT 'VERIFICATION',
        verification_note     TEXT,
        verified_by           TEXT REFERENCES users(id),
        verified_at           TEXT,
        placed_asrama_by      TEXT REFERENCES users(id),
        placed_asrama_at      TEXT,
        placed_kamar_by       TEXT REFERENCES users(id),
        placed_kamar_at       TEXT,
        paid_by               TEXT REFERENCES users(id),
        paid_at               TEXT,
        done_by               TEXT REFERENCES users(id),
        done_at               TEXT,
        created_by            TEXT REFERENCES users(id),
        created_at            TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(santri_id)
      )
    `),a.prepare(`
      CREATE TABLE IF NOT EXISTS psb_payment_receipt (
        id             TEXT PRIMARY KEY,
        receipt_no     TEXT NOT NULL UNIQUE,
        santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        tahun_tagihan  INTEGER NOT NULL,
        total          INTEGER NOT NULL DEFAULT 0,
        created_by     TEXT REFERENCES users(id),
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)]),(await (0,g.query)("PRAGMA table_info(pembayaran_tahunan)")).some(a=>"psb_receipt_id"===a.name)||await (0,g.execute)("ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)")}async function y(a,b){await x();let c=(0,h.getKategoriSantriEfektifSql)("s"),d=[],e=`s.status_global = 'aktif' AND ((${c}) = 'BARU' OR pf.id IS NOT NULL)`;if((0,f.hasRole)(a,"pengurus_asrama")&&!(0,f.isAdmin)(a)&&a?.asrama_binaan&&(e+=" AND s.asrama = ?",d.push(a.asrama_binaan)),b?.q?.trim()){e+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let a=`%${b.q.trim()}%`;d.push(a,a)}b?.sekolah&&(e+=" AND s.sekolah = ?",d.push(b.sekolah)),b?.asrama&&(e+=" AND s.asrama = ?",d.push(b.asrama));let i=u(b?.status),j=await (0,g.query)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.created_at, s.kategori_santri,
           ${c} AS kategori_efektif,
           pf.id AS psb_flow_id,
           COALESCE(pf.status, 'VERIFICATION') AS status,
           pf.verification_note,
           pf.verified_at,
           pf.placed_asrama_at,
           pf.placed_kamar_at,
           pf.paid_at,
           pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE ${e}
    ORDER BY s.created_at DESC, s.nama_lengkap
  `,d);return b?.status?j.filter(a=>u(a.status)===i):j}async function z(a,b){if(!a.length)return new Map;let c=a.map(a=>a.id),d=c.map(()=>"?").join(","),e=await (0,g.query)(`SELECT santri_id, jenis_biaya, nominal_bayar, tahun_tagihan
     FROM pembayaran_tahunan
     WHERE santri_id IN (${d})`,c),f=await (0,g.query)("SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings"),h=await (0,g.query)(`SELECT id, santri_id, receipt_no, total, created_at
     FROM psb_payment_receipt
     WHERE santri_id IN (${d})
     ORDER BY datetime(created_at) DESC, created_at DESC`,c),i=new Map;f.forEach(a=>i.set(`${a.tahun_angkatan}:${a.jenis_biaya}`,Number(a.nominal??0)));let j=new Map;return a.forEach(a=>{let c=w(a),d=e.filter(b=>b.santri_id===a.id),f=d.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),g=i.get(`${c}:BANGUNAN`)??0,k=h.find(b=>b.santri_id===a.id)??null,l=Object.fromEntries(o.map(a=>{let e=i.get(`${c}:${a}`)??0,f=d.some(c=>c.jenis_biaya===a&&Number(c.tahun_tagihan)===b);return[a,{nominal:e,lunas:f}]}));j.set(a.id,{tahunMasuk:c,bangunan:{target:g,paid:f,sisa:Math.max(0,g-f)},tahunan:l,latestReceipt:k})}),j}async function A(){let a=(0,h.getKategoriSantriEfektifSql)("s"),b=m.map(()=>"?").join(","),[c,d]=await Promise.all([(0,g.query)(`SELECT asrama,
              SUM(COALESCE(kuota, 0)) AS total_kuota,
              SUM(COALESCE(reserved_baru, 0)) AS kuota_baru
       FROM kamar_config
       WHERE asrama IN (${b})
       GROUP BY asrama`,m),(0,g.query)(`SELECT s.asrama, COUNT(*) AS terisi_baru
       FROM santri s
       LEFT JOIN psb_flow pf ON pf.santri_id = s.id
       WHERE s.status_global = 'aktif'
         AND s.asrama IS NOT NULL
         AND TRIM(s.asrama) <> ''
         AND ((${a}) = 'BARU' OR pf.id IS NOT NULL)
       GROUP BY s.asrama`)]),e=new Map(c.map(a=>[a.asrama,a])),f=new Map(d.map(a=>[a.asrama,Number(a.terisi_baru??0)]));return m.map(a=>{let b=e.get(a),c=Number(b?.total_kuota??0),d=Number(b?.kuota_baru??0),g=d>0?d:c,h=Number(f.get(a)??0);return{asrama:a,total_kuota:c,kuota_baru:g,terisi_baru:h,sisa:g-h,over:Math.max(0,h-g),status:g<=0?h>0?"OVER":"BELUM_CONFIG":h>g?"OVER":h===g?"PENUH":"TERSEDIA"}})}async function B(a){let b=await (0,e.assertFeature)(j);if("error"in b)return b;if(!((0,f.isAdmin)(b)||(0,f.hasAnyRole)(b,["sekpen","pengurus_asrama","bendahara"])))return{error:"Akses ditolak"};let c=Number(a?.tahunTagihan??new Date().getFullYear()),d=await y(b,a),g=await z(d,c),h=await A(),i=n.reduce((a,b)=>({...a,[b]:0}),{});return d.forEach(a=>{i[u(a.status)]+=1}),{rows:d.map(a=>({...a,status:u(a.status),tahun_masuk_fix:g.get(a.id)?.tahunMasuk??w(a),pembayaran:g.get(a.id)??null})),summary:i,asramaStats:h,asramaList:m,sekolahList:l,user:{roles:b.roles,role:b.role,asrama_binaan:b.asrama_binaan,canSekretariat:p(b),canPenempatan:q(b),canKamar:r(b),canBayar:s(b)}}}async function C(a){let b=await (0,e.assertFeature)(k);if("error"in b)return b;let c=await y(b,a),d=n.reduce((a,b)=>({...a,[b]:0}),{});return c.forEach(a=>{d[u(a.status)]+=1}),{rows:c.map(a=>({...a,status:u(a.status),tahun_masuk_fix:w(a)})),summary:d,asramaList:m,sekolahList:l}}async function D(){let a=`PSB-${(0,g.today)().replace(/-/g,"")}`;for(let b=1;b<=9999;b+=1){let c=`${a}-${String(b).padStart(4,"0")}`;if(!await (0,g.queryOne)("SELECT id FROM santri WHERE nis = ?",[c]))return c}return`${a}-${(0,g.generateId)().slice(0,8).toUpperCase()}`}async function E(a){let b=await (0,e.assertFeature)(j,"create");if("error"in b)return b;if(!p(b))return{error:"Akses ditolak"};await x();let f=String(a.nama_lengkap??"").trim();if(!f)return{error:"Nama santri wajib diisi"};let i="P"===a.jenis_kelamin?"P":"L",m=a.sekolah&&l.includes(a.sekolah)?a.sekolah:null,n=(0,g.generateId)(),o=(0,g.generateId)(),q=await D(),r=(0,g.today)(),s=Number(r.slice(0,4)),t=await (0,g.getDB)();return await t.batch([t.prepare(`
      INSERT INTO santri (
        id, nis, nama_lengkap, jenis_kelamin, sekolah, tanggal_masuk, tahun_masuk,
        status_global, kategori_santri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', ?, datetime('now'), datetime('now'))
    `).bind(n,q,f,i,m,r,s,(0,h.normalizeKategoriSantriDasar)("REGULER")),t.prepare(`
      INSERT INTO psb_flow (
        id, santri_id, status, verified_by, verified_at, created_by, created_at, updated_at
      ) VALUES (?, ?, 'VERIFIED', ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `).bind(o,n,b.id,b.id)]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(b),module:"psb",action:"create",fiturHref:j,logKind:"create",entityType:"santri",entityId:n,entityLabel:f,summary:`Input santri dadakan PSB: ${f}`,details:{nis:q,jenis_kelamin:i,sekolah:m}}),(0,c.revalidatePath)(j),(0,c.revalidatePath)(k),{success:!0,santriId:n,nis:q}}async function F(a,b){let f=await (0,e.assertFeature)(j,"update");if("error"in f)return f;if(!p(f))return{error:"Akses ditolak"};await x();let h=await (0,g.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ? AND status_global = ?",[a,"aktif"]);return h?(await (0,g.execute)(`
    INSERT INTO psb_flow (id, santri_id, status, verification_note, verified_by, verified_at, created_by, created_at, updated_at)
    VALUES (?, ?, 'VERIFIED', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    ON CONFLICT(santri_id) DO UPDATE SET
      status = CASE WHEN psb_flow.status = 'VERIFICATION' THEN 'VERIFIED' ELSE psb_flow.status END,
      verification_note = excluded.verification_note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_at = excluded.updated_at
  `,[(0,g.generateId)(),a,b?.trim()||null,f.id,f.id]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(f),module:"psb",action:"update",fiturHref:j,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:h.nama_lengkap,summary:`Verifikasi PSB ${h.nama_lengkap}`,details:{note:b?.trim()||null}}),(0,c.revalidatePath)(j),(0,c.revalidatePath)(k),{success:!0}):{error:"Santri tidak ditemukan"}}async function G(a,b){let f=await (0,e.assertFeature)(j,"update");if("error"in f)return f;if(!q(f))return{error:"Akses ditolak"};await x();let h=String(b??"").trim().toUpperCase();if(!m.includes(h))return{error:"Asrama tidak valid"};let i=await (0,g.queryOne)(`
    SELECT pf.status, s.nama_lengkap, s.asrama, s.kamar
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!i)return{error:"Santri tidak ditemukan"};if(!t(u(i.status),"VERIFIED"))return{error:"Santri belum diverifikasi sekretariat"};let l=await (0,g.getDB)();return await l.batch([l.prepare("UPDATE santri SET asrama = ?, kamar = NULL, updated_at = datetime('now') WHERE id = ?").bind(h,a),l.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_asrama_by, placed_asrama_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_ASRAMA', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA') THEN 'PLACED_ASRAMA' ELSE psb_flow.status END,
        placed_asrama_by = excluded.placed_asrama_by,
        placed_asrama_at = excluded.placed_asrama_at,
        updated_at = excluded.updated_at
    `).bind((0,g.generateId)(),a,f.id,f.id)]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(f),module:"psb",action:"update",fiturHref:j,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:i.nama_lengkap,summary:`Menempatkan ${i.nama_lengkap} ke asrama ${h}`,details:{asrama_lama:i.asrama,kamar_lama:i.kamar,asrama_baru:h}}),(0,c.revalidatePath)(j),(0,c.revalidatePath)(k),{success:!0}}async function H(a){let b=await (0,e.assertFeature)(j);if("error"in b)return b;let c=String(a??"").trim().toUpperCase();return c?!(0,f.isAdmin)(b)&&(0,f.hasRole)(b,"pengurus_asrama")&&b.asrama_binaan!==c?{error:"Anda hanya boleh melihat kamar asrama binaan Anda"}:(await x(),(0,g.query)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru, kc.blok,
           COUNT(s.id) AS terisi,
           (kc.kuota - COUNT(s.id)) AS slot_kosong,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif'
    WHERE kc.asrama = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
    ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar
  `,[c])):[]}async function I(a,b){let h=await (0,e.assertFeature)(j,"update");if("error"in h)return h;if(!r(h))return{error:"Akses ditolak"};await x();let i=String(b??"").trim();if(!i)return{error:"Kamar wajib dipilih"};let l=await (0,g.queryOne)(`
    SELECT pf.status, s.nama_lengkap, s.asrama
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!l)return{error:"Santri tidak ditemukan"};if(!l.asrama)return{error:"Santri belum ditempatkan ke asrama"};if(!t(u(l.status),"PLACED_ASRAMA"))return{error:"Santri belum masuk tahap kamar"};if(!(0,f.isAdmin)(h)&&(0,f.hasRole)(h,"pengurus_asrama")&&h.asrama_binaan!==l.asrama)return{error:"Anda hanya boleh mengelola asrama binaan Anda"};if(!await (0,g.queryOne)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru,
           COUNT(s.id) AS terisi,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif' AND s.id <> ?
    WHERE kc.asrama = ? AND kc.nomor_kamar = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru
  `,[a,l.asrama,i]))return{error:"Kamar belum dikonfigurasi di asrama ini"};let m=await (0,g.getDB)();return await m.batch([m.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ?").bind(i,a),m.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_kamar_by, placed_kamar_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_KAMAR', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR') THEN 'PLACED_KAMAR' ELSE psb_flow.status END,
        placed_kamar_by = excluded.placed_kamar_by,
        placed_kamar_at = excluded.placed_kamar_at,
        updated_at = excluded.updated_at
    `).bind((0,g.generateId)(),a,h.id,h.id)]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(h),module:"psb",action:"update",fiturHref:j,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:l.nama_lengkap,summary:`Menempatkan ${l.nama_lengkap} ke kamar ${i}`,details:{asrama:l.asrama,kamar:i}}),(0,c.revalidatePath)(j),(0,c.revalidatePath)(k),{success:!0}}async function J(){let a=`PSB/${(0,g.today)().replace(/-/g,"")}`,b=await (0,g.queryOne)("SELECT COUNT(*) AS total FROM psb_payment_receipt WHERE receipt_no LIKE ?",[`${a}/%`]);return`${a}/${String(Number(b?.total??0)+1).padStart(4,"0")}`}async function K(a){let b=await (0,e.assertFeature)(j,"create");if("error"in b)return b;if(!s(b))return{error:"Akses ditolak"};await x();let f=Number(a.tahunTagihan||new Date().getFullYear()),h=a.items.filter(a=>["BANGUNAN","KESEHATAN","EHB","EKSKUL"].includes(a.jenis)).map(a=>({jenis:a.jenis,nominal:Number(a.nominal??0)}));if(!h.length)return{error:"Pilih minimal satu item pembayaran"};let i=await (0,g.queryOne)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.created_at, s.kategori_santri,
           'BARU' AS kategori_efektif, pf.id AS psb_flow_id, pf.status,
           pf.verification_note, pf.verified_at, pf.placed_asrama_at, pf.placed_kamar_at, pf.paid_at, pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a.santriId]);if(!i)return{error:"Santri tidak ditemukan"};if(!t(u(i.status),"PLACED_KAMAR"))return{error:"Santri belum ditempatkan ke kamar"};let l=w(i),m=new Map((await (0,g.query)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[l])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])),n=await (0,g.query)("SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),o=n.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),p=Math.max(0,(m.get("BANGUNAN")??0)-o),q=[];for(let a of h){if("BANGUNAN"===a.jenis){let b=Math.trunc(a.nominal);if(b<=0)return{error:"Nominal bangunan wajib lebih dari 0"};if(b>p)return{error:"Nominal bangunan melebihi sisa tagihan"};q.push({jenis:"BANGUNAN",nominal:b,tahunTagihan:null,keterangan:"Pembayaran PSB - Bangunan"});continue}let b=m.get(a.jenis)??0;if(b<=0)return{error:`Tarif ${a.jenis} angkatan ${l} belum diatur`};if(n.some(b=>b.jenis_biaya===a.jenis&&Number(b.tahun_tagihan)===f))return{error:`${a.jenis} tahun ${f} sudah dibayar`};q.push({jenis:a.jenis,nominal:b,tahunTagihan:f,keterangan:`Pembayaran PSB - ${a.jenis} ${f}`})}let r=(0,g.generateId)(),y=await J(),z=q.reduce((a,b)=>a+b.nominal,0),A=[...n.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan})),...q.map(a=>({jenis_biaya:a.jenis,tahun_tagihan:a.tahunTagihan}))],B=v({bangunanTarget:m.get("BANGUNAN")??0,bangunanPaid:o+q.filter(a=>"BANGUNAN"===a.jenis).reduce((a,b)=>a+b.nominal,0),tahunTagihan:f,payments:A})?"DONE":"PAID",C=await (0,g.getDB)();await C.batch([C.prepare(`
      INSERT INTO psb_payment_receipt (id, receipt_no, santri_id, tahun_tagihan, total, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(r,y,a.santriId,f,z,b.id),...q.map(c=>C.prepare(`
        INSERT INTO pembayaran_tahunan (
          id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan, psb_receipt_id
        ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
      `).bind((0,g.generateId)(),a.santriId,c.jenis,c.tahunTagihan,c.nominal,b.id,c.keterangan,r)),C.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, paid_by, paid_at, done_by, done_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), ?, CASE WHEN ? = 'DONE' THEN datetime('now') ELSE NULL END, ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE
          WHEN ? = 'DONE' THEN 'DONE'
          WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR','PAID') THEN 'PAID'
          ELSE psb_flow.status
        END,
        paid_by = excluded.paid_by,
        paid_at = excluded.paid_at,
        done_by = CASE WHEN ? = 'DONE' THEN excluded.done_by ELSE psb_flow.done_by END,
        done_at = CASE WHEN ? = 'DONE' THEN excluded.done_at ELSE psb_flow.done_at END,
        updated_at = excluded.updated_at
    `).bind((0,g.generateId)(),a.santriId,B,b.id,b.id,B,b.id,B,B,B)]);try{await (0,d.logActivity)({actor:(0,d.actorFromSession)(b),module:"psb",action:"payment",fiturHref:j,logKind:"create",entityType:"psb_payment_receipt",entityId:r,entityLabel:y,summary:`Pembayaran PSB ${i.nama_lengkap}: ${y}`,details:{santri_id:a.santriId,receipt_no:y,total:z,items:q,status_after_payment:B}})}catch(a){console.error("Failed to write PSB payment activity log",a)}try{(0,c.revalidatePath)(j),(0,c.revalidatePath)(k)}catch(a){console.error("Failed to revalidate PSB pages after payment",a)}return{success:!0,receiptId:r,receiptNo:y,total:z,status:B}}async function L(a){let b=await (0,e.assertFeature)(j,"update");if("error"in b)return b;if(!(0,f.isAdmin)(b)&&!(0,f.hasRole)(b,"bendahara"))return{error:"Akses ditolak"};let d=await (0,g.queryOne)("SELECT status FROM psb_flow WHERE santri_id = ?",[a]);return d&&t(u(d.status),"PAID")?(await (0,g.execute)(`
    UPDATE psb_flow
    SET status = 'DONE', done_by = ?, done_at = datetime('now'), updated_at = datetime('now')
    WHERE santri_id = ?
  `,[b.id,a]),(0,c.revalidatePath)(j),(0,c.revalidatePath)(k),{success:!0}):{error:"Santri belum menyelesaikan pembayaran PSB"}}async function M(a){var b;let h=await (0,e.assertFeature)(j,"update");if("error"in h)return h;if(!(0,f.isAdmin)(h)&&!(0,f.hasRole)(h,"bendahara"))return{error:"Akses ditolak"};await x();let i=await (0,g.queryOne)(`
    SELECT r.id, r.santri_id, r.receipt_no, r.tahun_tagihan, s.nama_lengkap, s.tahun_masuk, s.created_at
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    WHERE r.id = ?
  `,[a.receiptId]);if(!i)return{error:"Kuitansi pembayaran tidak ditemukan"};if(i.santri_id!==a.santriId)return{error:"Kuitansi tidak cocok dengan santri"};let l=await (0,g.queryOne)(`SELECT id
     FROM psb_payment_receipt
     WHERE santri_id = ?
     ORDER BY datetime(created_at) DESC, created_at DESC
     LIMIT 1`,[a.santriId]);if(!l||l.id!==a.receiptId)return{error:"Hanya pembayaran terakhir yang bisa dibatalkan"};await (0,g.execute)("DELETE FROM pembayaran_tahunan WHERE psb_receipt_id = ?",[a.receiptId]),await (0,g.execute)("DELETE FROM psb_payment_receipt WHERE id = ?",[a.receiptId]);let m=await (0,g.query)("SELECT jenis_biaya, tahun_tagihan, nominal_bayar FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),n=w(i),o=v(b={bangunanTarget:new Map((await (0,g.query)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[n])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])).get("BANGUNAN")??0,bangunanPaid:m.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),tahunTagihan:Number(i.tahun_tagihan??new Date().getFullYear()),payments:m.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan}))})?"DONE":b.payments.length>0?"PAID":"PLACED_KAMAR";await (0,g.execute)(`
    UPDATE psb_flow
    SET status = ?,
        paid_by = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_by END,
        paid_at = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_at END,
        done_by = CASE WHEN ? = 'DONE' THEN done_by ELSE NULL END,
        done_at = CASE WHEN ? = 'DONE' THEN done_at ELSE NULL END,
        updated_at = datetime('now')
    WHERE santri_id = ?
  `,[o,o,o,o,o,a.santriId]);try{await (0,d.logActivity)({actor:(0,d.actorFromSession)(h),module:"psb",action:"payment_cancel",fiturHref:j,logKind:"delete",entityType:"psb_payment_receipt",entityId:a.receiptId,entityLabel:i.receipt_no,summary:`Pembayaran PSB dibatalkan ${i.nama_lengkap}: ${i.receipt_no}`,details:{santri_id:a.santriId,receipt_no:i.receipt_no,status_after_cancel:o}})}catch(a){console.error("Failed to write PSB payment cancellation log",a)}try{(0,c.revalidatePath)(j),(0,c.revalidatePath)(k)}catch(a){console.error("Failed to revalidate PSB pages after cancellation",a)}return{success:!0,status:o}}async function N(a){let b=await (0,f.getSession)();if(!b)return{error:"Tidak terautentikasi"};if(!(0,f.hasAnyRole)(b,["admin","bendahara","sekpen"]))return{error:"Akses ditolak"};await x();let c=await (0,g.queryOne)(`
    SELECT r.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, u.full_name AS penerima_nama
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `,[a]);return c?{receipt:c,items:await (0,g.query)(`
    SELECT jenis_biaya, tahun_tagihan, nominal_bayar, keterangan, tanggal_bayar
    FROM pembayaran_tahunan
    WHERE psb_receipt_id = ?
    ORDER BY jenis_biaya
  `,[a])}:{error:"Kuitansi tidak ditemukan"}}(0,i.ensureServerEntryExports)([B,C,E,F,G,H,I,K,L,M,N]),(0,b.registerServerReference)(B,"405faafb95c77cef1ae4398bcfcedb77149ac85502",null),(0,b.registerServerReference)(C,"403e6ddb04a2689a811d66d1934640b5e3ebed14b2",null),(0,b.registerServerReference)(E,"409cf96faf3707394638f6c488cdea83d23586dae4",null),(0,b.registerServerReference)(F,"60e268ffa0329a1b4aa289e1818f485158a2026c10",null),(0,b.registerServerReference)(G,"603e4122138bb38f2a007d32d77e44037ece5b018c",null),(0,b.registerServerReference)(H,"40a8ea2f6dbe6a5b6d5e8857301b36f2b698c0ddc0",null),(0,b.registerServerReference)(I,"607d38f57ffc10c1ab246ee7b17b7ec3244aff10f9",null),(0,b.registerServerReference)(K,"409454d00e229d55b1e9b8ea59db790382ea3d55e0",null),(0,b.registerServerReference)(L,"40eb4ba0a40c018616919f42850bf07179ef5fe102",null),(0,b.registerServerReference)(M,"4052f19bf5b9ebe0c93118e1add55531489142cf62",null),(0,b.registerServerReference)(N,"406d100e89ffb22c3ae68cfefe2499568cb085c39e",null),a.s(["batalkanPembayaranPsb",()=>M,"bayarPsbBatch",()=>K,"getKamarPsb",()=>H,"getPsbDashboard",()=>B,"getPsbMonitoring",()=>C,"getPsbReceipt",()=>N,"selesaikanPsb",()=>L,"tambahSantriDadakan",()=>E,"tempatkanAsramaPsb",()=>G,"tempatkanKamarPsb",()=>I,"verifikasiSantriPsb",()=>F])}];

//# sourceMappingURL=app_dashboard_psb_actions_ts_13e7039a._.js.map