(()=>{var a={};a.id=6004,a.ids=[6004],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},338:(a,b,c)=>{"use strict";c.d(b,{Ag:()=>E,Ex:()=>H,FT:()=>M,I7:()=>O,M9:()=>I,U9:()=>D,c3:()=>P,fT:()=>K,gG:()=>J,hz:()=>G,yz:()=>N});var d=c(49796),e=c(16949),f=c(30236),g=c(1501),h=c(23755),i=c(44075),j=c(74812),k=c(24424);let l="/dashboard/psb",m="/dashboard/psb/monitoring",n=["MTSU","MTSN","MAN","SMK","SMA","SMP","LAINNYA"],o=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"],p=["VERIFICATION","VERIFIED","PLACED_ASRAMA","PLACED_KAMAR","PAID","DONE"],q=["KESEHATAN","EHB","EKSKUL"];function r(a){return(0,h.qc)(a)||(0,h.hf)(a,"sekpen")}function s(a){return(0,h.qc)(a)||(0,h.hf)(a,"sekpen")}function t(a){return(0,h.qc)(a)||(0,h.hf)(a,"pengurus_asrama")}function u(a){return(0,h.qc)(a)||(0,h.hf)(a,"bendahara")}function v(a,b){return p.indexOf(a)>=p.indexOf(b)}function w(a){return p.includes(a)?a:"VERIFICATION"}function x(a){let b=a.bangunanTarget<=0||a.bangunanPaid>=a.bangunanTarget,c=q.every(b=>a.payments.some(c=>c.jenis_biaya===b&&Number(c.tahun_tagihan)===a.tahunTagihan));return b&&c}function y(a){if(a.tahun_masuk)return Number(a.tahun_masuk);let b=a.created_at?new Date(a.created_at).getFullYear():new Date().getFullYear();return Number.isFinite(b)?b:new Date().getFullYear()}async function z(){let a=await (0,i.xA)();await a.batch([a.prepare(`
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
    `)]),(await (0,i.P)("PRAGMA table_info(pembayaran_tahunan)")).some(a=>"psb_receipt_id"===a.name)||await (0,i.g7)("ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)")}async function A(a,b){await z();let c=(0,j.kM)("s"),d=[],e=`s.status_global = 'aktif' AND ((${c}) = 'BARU' OR pf.id IS NOT NULL)`;if((0,h.hf)(a,"pengurus_asrama")&&!(0,h.qc)(a)&&a?.asrama_binaan&&(e+=" AND s.asrama = ?",d.push(a.asrama_binaan)),b?.q?.trim()){e+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let a=`%${b.q.trim()}%`;d.push(a,a)}b?.sekolah&&(e+=" AND s.sekolah = ?",d.push(b.sekolah)),b?.asrama&&(e+=" AND s.asrama = ?",d.push(b.asrama));let f=w(b?.status),g=await (0,i.P)(`
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
  `,d);return b?.status?g.filter(a=>w(a.status)===f):g}async function B(a,b){if(!a.length)return new Map;let c=a.map(a=>a.id),d=c.map(()=>"?").join(","),e=await (0,i.P)(`SELECT santri_id, jenis_biaya, nominal_bayar, tahun_tagihan
     FROM pembayaran_tahunan
     WHERE santri_id IN (${d})`,c),f=await (0,i.P)("SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings"),g=await (0,i.P)(`SELECT id, santri_id, receipt_no, total, created_at
     FROM psb_payment_receipt
     WHERE santri_id IN (${d})
     ORDER BY datetime(created_at) DESC, created_at DESC`,c),h=new Map;f.forEach(a=>h.set(`${a.tahun_angkatan}:${a.jenis_biaya}`,Number(a.nominal??0)));let j=new Map;return a.forEach(a=>{let c=y(a),d=e.filter(b=>b.santri_id===a.id),f=d.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),i=h.get(`${c}:BANGUNAN`)??0,k=g.find(b=>b.santri_id===a.id)??null,l=Object.fromEntries(q.map(a=>{let e=h.get(`${c}:${a}`)??0,f=d.some(c=>c.jenis_biaya===a&&Number(c.tahun_tagihan)===b);return[a,{nominal:e,lunas:f}]}));j.set(a.id,{tahunMasuk:c,bangunan:{target:i,paid:f,sisa:Math.max(0,i-f)},tahunan:l,latestReceipt:k})}),j}async function C(){let a=(0,j.kM)("s"),b=o.map(()=>"?").join(","),[c,d]=await Promise.all([(0,i.P)(`SELECT asrama,
              SUM(COALESCE(kuota, 0)) AS total_kuota,
              SUM(COALESCE(reserved_baru, 0)) AS kuota_baru
       FROM kamar_config
       WHERE asrama IN (${b})
       GROUP BY asrama`,o),(0,i.P)(`SELECT s.asrama, COUNT(*) AS terisi_baru
       FROM santri s
       LEFT JOIN psb_flow pf ON pf.santri_id = s.id
       WHERE s.status_global = 'aktif'
         AND s.asrama IS NOT NULL
         AND TRIM(s.asrama) <> ''
         AND ((${a}) = 'BARU' OR pf.id IS NOT NULL)
       GROUP BY s.asrama`)]),e=new Map(c.map(a=>[a.asrama,a])),f=new Map(d.map(a=>[a.asrama,Number(a.terisi_baru??0)]));return o.map(a=>{let b=e.get(a),c=Number(b?.total_kuota??0),d=Number(b?.kuota_baru??0),g=d>0?d:c,h=Number(f.get(a)??0);return{asrama:a,total_kuota:c,kuota_baru:g,terisi_baru:h,sisa:g-h,over:Math.max(0,h-g),status:g<=0?h>0?"OVER":"BELUM_CONFIG":h>g?"OVER":h===g?"PENUH":"TERSEDIA"}})}async function D(a){let b=await (0,g.n)(l);if("error"in b)return b;if(!((0,h.qc)(b)||(0,h.pX)(b,["sekpen","pengurus_asrama","bendahara"])))return{error:"Akses ditolak"};let c=Number(a?.tahunTagihan??new Date().getFullYear()),d=await A(b,a),e=await B(d,c),f=await C(),i=p.reduce((a,b)=>({...a,[b]:0}),{});return d.forEach(a=>{i[w(a.status)]+=1}),{rows:d.map(a=>({...a,status:w(a.status),tahun_masuk_fix:e.get(a.id)?.tahunMasuk??y(a),pembayaran:e.get(a.id)??null})),summary:i,asramaStats:f,asramaList:o,sekolahList:n,user:{roles:b.roles,role:b.role,asrama_binaan:b.asrama_binaan,canSekretariat:r(b),canPenempatan:s(b),canKamar:t(b),canBayar:u(b)}}}async function E(a){let b=await (0,g.n)(m);if("error"in b)return b;let c=await A(b,a),d=p.reduce((a,b)=>({...a,[b]:0}),{});return c.forEach(a=>{d[w(a.status)]+=1}),{rows:c.map(a=>({...a,status:w(a.status),tahun_masuk_fix:y(a)})),summary:d,asramaList:o,sekolahList:n}}async function F(){let a=`PSB-${(0,i.Ec)().replace(/-/g,"")}`;for(let b=1;b<=9999;b+=1){let c=`${a}-${String(b).padStart(4,"0")}`;if(!await (0,i.Zy)("SELECT id FROM santri WHERE nis = ?",[c]))return c}return`${a}-${(0,i.$C)().slice(0,8).toUpperCase()}`}async function G(a){let b=await (0,g.n)(l,"create");if("error"in b)return b;if(!r(b))return{error:"Akses ditolak"};await z();let c=String(a.nama_lengkap??"").trim();if(!c)return{error:"Nama santri wajib diisi"};let d="P"===a.jenis_kelamin?"P":"L",h=a.sekolah&&n.includes(a.sekolah)?a.sekolah:null,k=(0,i.$C)(),o=(0,i.$C)(),p=await F(),q=(0,i.Ec)(),s=Number(q.slice(0,4)),t=await (0,i.xA)();return await t.batch([t.prepare(`
      INSERT INTO santri (
        id, nis, nama_lengkap, jenis_kelamin, sekolah, tanggal_masuk, tahun_masuk,
        status_global, kategori_santri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', ?, datetime('now'), datetime('now'))
    `).bind(k,p,c,d,h,q,s,(0,j.Oh)("REGULER")),t.prepare(`
      INSERT INTO psb_flow (
        id, santri_id, status, verified_by, verified_at, created_by, created_at, updated_at
      ) VALUES (?, ?, 'VERIFIED', ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `).bind(o,k,b.id,b.id)]),await (0,f.Mx)({actor:(0,f.CF)(b),module:"psb",action:"create",fiturHref:l,logKind:"create",entityType:"santri",entityId:k,entityLabel:c,summary:`Input santri dadakan PSB: ${c}`,details:{nis:p,jenis_kelamin:d,sekolah:h}}),(0,e.revalidatePath)(l),(0,e.revalidatePath)(m),{success:!0,santriId:k,nis:p}}async function H(a,b){let c=await (0,g.n)(l,"update");if("error"in c)return c;if(!r(c))return{error:"Akses ditolak"};await z();let d=await (0,i.Zy)("SELECT nama_lengkap FROM santri WHERE id = ? AND status_global = ?",[a,"aktif"]);return d?(await (0,i.g7)(`
    INSERT INTO psb_flow (id, santri_id, status, verification_note, verified_by, verified_at, created_by, created_at, updated_at)
    VALUES (?, ?, 'VERIFIED', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    ON CONFLICT(santri_id) DO UPDATE SET
      status = CASE WHEN psb_flow.status = 'VERIFICATION' THEN 'VERIFIED' ELSE psb_flow.status END,
      verification_note = excluded.verification_note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_at = excluded.updated_at
  `,[(0,i.$C)(),a,b?.trim()||null,c.id,c.id]),await (0,f.Mx)({actor:(0,f.CF)(c),module:"psb",action:"update",fiturHref:l,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:d.nama_lengkap,summary:`Verifikasi PSB ${d.nama_lengkap}`,details:{note:b?.trim()||null}}),(0,e.revalidatePath)(l),(0,e.revalidatePath)(m),{success:!0}):{error:"Santri tidak ditemukan"}}async function I(a,b){let c=await (0,g.n)(l,"update");if("error"in c)return c;if(!s(c))return{error:"Akses ditolak"};await z();let d=String(b??"").trim().toUpperCase();if(!o.includes(d))return{error:"Asrama tidak valid"};let h=await (0,i.Zy)(`
    SELECT pf.status, s.nama_lengkap, s.asrama, s.kamar
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!h)return{error:"Santri tidak ditemukan"};if(!v(w(h.status),"VERIFIED"))return{error:"Santri belum diverifikasi sekretariat"};let j=await (0,i.xA)();return await j.batch([j.prepare("UPDATE santri SET asrama = ?, kamar = NULL, updated_at = datetime('now') WHERE id = ?").bind(d,a),j.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_asrama_by, placed_asrama_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_ASRAMA', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA') THEN 'PLACED_ASRAMA' ELSE psb_flow.status END,
        placed_asrama_by = excluded.placed_asrama_by,
        placed_asrama_at = excluded.placed_asrama_at,
        updated_at = excluded.updated_at
    `).bind((0,i.$C)(),a,c.id,c.id)]),await (0,f.Mx)({actor:(0,f.CF)(c),module:"psb",action:"update",fiturHref:l,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:h.nama_lengkap,summary:`Menempatkan ${h.nama_lengkap} ke asrama ${d}`,details:{asrama_lama:h.asrama,kamar_lama:h.kamar,asrama_baru:d}}),(0,e.revalidatePath)(l),(0,e.revalidatePath)(m),{success:!0}}async function J(a){let b=await (0,g.n)(l);if("error"in b)return b;let c=String(a??"").trim().toUpperCase();return c?!(0,h.qc)(b)&&(0,h.hf)(b,"pengurus_asrama")&&b.asrama_binaan!==c?{error:"Anda hanya boleh melihat kamar asrama binaan Anda"}:(await z(),(0,i.P)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru, kc.blok,
           COUNT(s.id) AS terisi,
           (kc.kuota - COUNT(s.id)) AS slot_kosong,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif'
    WHERE kc.asrama = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
    ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar
  `,[c])):[]}async function K(a,b){let c=await (0,g.n)(l,"update");if("error"in c)return c;if(!t(c))return{error:"Akses ditolak"};await z();let d=String(b??"").trim();if(!d)return{error:"Kamar wajib dipilih"};let j=await (0,i.Zy)(`
    SELECT pf.status, s.nama_lengkap, s.asrama
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!j)return{error:"Santri tidak ditemukan"};if(!j.asrama)return{error:"Santri belum ditempatkan ke asrama"};if(!v(w(j.status),"PLACED_ASRAMA"))return{error:"Santri belum masuk tahap kamar"};if(!(0,h.qc)(c)&&(0,h.hf)(c,"pengurus_asrama")&&c.asrama_binaan!==j.asrama)return{error:"Anda hanya boleh mengelola asrama binaan Anda"};if(!await (0,i.Zy)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru,
           COUNT(s.id) AS terisi,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif' AND s.id <> ?
    WHERE kc.asrama = ? AND kc.nomor_kamar = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru
  `,[a,j.asrama,d]))return{error:"Kamar belum dikonfigurasi di asrama ini"};let k=await (0,i.xA)();return await k.batch([k.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ?").bind(d,a),k.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_kamar_by, placed_kamar_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_KAMAR', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR') THEN 'PLACED_KAMAR' ELSE psb_flow.status END,
        placed_kamar_by = excluded.placed_kamar_by,
        placed_kamar_at = excluded.placed_kamar_at,
        updated_at = excluded.updated_at
    `).bind((0,i.$C)(),a,c.id,c.id)]),await (0,f.Mx)({actor:(0,f.CF)(c),module:"psb",action:"update",fiturHref:l,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:j.nama_lengkap,summary:`Menempatkan ${j.nama_lengkap} ke kamar ${d}`,details:{asrama:j.asrama,kamar:d}}),(0,e.revalidatePath)(l),(0,e.revalidatePath)(m),{success:!0}}async function L(){let a=`PSB/${(0,i.Ec)().replace(/-/g,"")}`,b=await (0,i.Zy)("SELECT COUNT(*) AS total FROM psb_payment_receipt WHERE receipt_no LIKE ?",[`${a}/%`]);return`${a}/${String(Number(b?.total??0)+1).padStart(4,"0")}`}async function M(a){let b=await (0,g.n)(l,"create");if("error"in b)return b;if(!u(b))return{error:"Akses ditolak"};await z();let c=Number(a.tahunTagihan||new Date().getFullYear()),d=a.items.filter(a=>["BANGUNAN","KESEHATAN","EHB","EKSKUL"].includes(a.jenis)).map(a=>({jenis:a.jenis,nominal:Number(a.nominal??0)}));if(!d.length)return{error:"Pilih minimal satu item pembayaran"};let h=await (0,i.Zy)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.created_at, s.kategori_santri,
           'BARU' AS kategori_efektif, pf.id AS psb_flow_id, pf.status,
           pf.verification_note, pf.verified_at, pf.placed_asrama_at, pf.placed_kamar_at, pf.paid_at, pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a.santriId]);if(!h)return{error:"Santri tidak ditemukan"};if(!v(w(h.status),"PLACED_KAMAR"))return{error:"Santri belum ditempatkan ke kamar"};let j=y(h),k=new Map((await (0,i.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[j])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])),n=await (0,i.P)("SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),o=n.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),p=Math.max(0,(k.get("BANGUNAN")??0)-o),q=[];for(let a of d){if("BANGUNAN"===a.jenis){let b=Math.trunc(a.nominal);if(b<=0)return{error:"Nominal bangunan wajib lebih dari 0"};if(b>p)return{error:"Nominal bangunan melebihi sisa tagihan"};q.push({jenis:"BANGUNAN",nominal:b,tahunTagihan:null,keterangan:"Pembayaran PSB - Bangunan"});continue}let b=k.get(a.jenis)??0;if(b<=0)return{error:`Tarif ${a.jenis} angkatan ${j} belum diatur`};if(n.some(b=>b.jenis_biaya===a.jenis&&Number(b.tahun_tagihan)===c))return{error:`${a.jenis} tahun ${c} sudah dibayar`};q.push({jenis:a.jenis,nominal:b,tahunTagihan:c,keterangan:`Pembayaran PSB - ${a.jenis} ${c}`})}let r=(0,i.$C)(),s=await L(),t=q.reduce((a,b)=>a+b.nominal,0),A=[...n.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan})),...q.map(a=>({jenis_biaya:a.jenis,tahun_tagihan:a.tahunTagihan}))],B=x({bangunanTarget:k.get("BANGUNAN")??0,bangunanPaid:o+q.filter(a=>"BANGUNAN"===a.jenis).reduce((a,b)=>a+b.nominal,0),tahunTagihan:c,payments:A})?"DONE":"PAID",C=await (0,i.xA)();await C.batch([C.prepare(`
      INSERT INTO psb_payment_receipt (id, receipt_no, santri_id, tahun_tagihan, total, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(r,s,a.santriId,c,t,b.id),...q.map(c=>C.prepare(`
        INSERT INTO pembayaran_tahunan (
          id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan, psb_receipt_id
        ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
      `).bind((0,i.$C)(),a.santriId,c.jenis,c.tahunTagihan,c.nominal,b.id,c.keterangan,r)),C.prepare(`
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
    `).bind((0,i.$C)(),a.santriId,B,b.id,b.id,B,b.id,B,B,B)]);try{await (0,f.Mx)({actor:(0,f.CF)(b),module:"psb",action:"payment",fiturHref:l,logKind:"create",entityType:"psb_payment_receipt",entityId:r,entityLabel:s,summary:`Pembayaran PSB ${h.nama_lengkap}: ${s}`,details:{santri_id:a.santriId,receipt_no:s,total:t,items:q,status_after_payment:B}})}catch(a){console.error("Failed to write PSB payment activity log",a)}try{(0,e.revalidatePath)(l),(0,e.revalidatePath)(m)}catch(a){console.error("Failed to revalidate PSB pages after payment",a)}return{success:!0,receiptId:r,receiptNo:s,total:t,status:B}}async function N(a){let b=await (0,g.n)(l,"update");if("error"in b)return b;if(!(0,h.qc)(b)&&!(0,h.hf)(b,"bendahara"))return{error:"Akses ditolak"};let c=await (0,i.Zy)("SELECT status FROM psb_flow WHERE santri_id = ?",[a]);return c&&v(w(c.status),"PAID")?(await (0,i.g7)(`
    UPDATE psb_flow
    SET status = 'DONE', done_by = ?, done_at = datetime('now'), updated_at = datetime('now')
    WHERE santri_id = ?
  `,[b.id,a]),(0,e.revalidatePath)(l),(0,e.revalidatePath)(m),{success:!0}):{error:"Santri belum menyelesaikan pembayaran PSB"}}async function O(a){var b;let c=await (0,g.n)(l,"update");if("error"in c)return c;if(!(0,h.qc)(c)&&!(0,h.hf)(c,"bendahara"))return{error:"Akses ditolak"};await z();let d=await (0,i.Zy)(`
    SELECT r.id, r.santri_id, r.receipt_no, r.tahun_tagihan, s.nama_lengkap, s.tahun_masuk, s.created_at
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    WHERE r.id = ?
  `,[a.receiptId]);if(!d)return{error:"Kuitansi pembayaran tidak ditemukan"};if(d.santri_id!==a.santriId)return{error:"Kuitansi tidak cocok dengan santri"};let j=await (0,i.Zy)(`SELECT id
     FROM psb_payment_receipt
     WHERE santri_id = ?
     ORDER BY datetime(created_at) DESC, created_at DESC
     LIMIT 1`,[a.santriId]);if(!j||j.id!==a.receiptId)return{error:"Hanya pembayaran terakhir yang bisa dibatalkan"};await (0,i.g7)("DELETE FROM pembayaran_tahunan WHERE psb_receipt_id = ?",[a.receiptId]),await (0,i.g7)("DELETE FROM psb_payment_receipt WHERE id = ?",[a.receiptId]);let k=await (0,i.P)("SELECT jenis_biaya, tahun_tagihan, nominal_bayar FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),n=y(d),o=x(b={bangunanTarget:new Map((await (0,i.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[n])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])).get("BANGUNAN")??0,bangunanPaid:k.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),tahunTagihan:Number(d.tahun_tagihan??new Date().getFullYear()),payments:k.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan}))})?"DONE":b.payments.length>0?"PAID":"PLACED_KAMAR";await (0,i.g7)(`
    UPDATE psb_flow
    SET status = ?,
        paid_by = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_by END,
        paid_at = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_at END,
        done_by = CASE WHEN ? = 'DONE' THEN done_by ELSE NULL END,
        done_at = CASE WHEN ? = 'DONE' THEN done_at ELSE NULL END,
        updated_at = datetime('now')
    WHERE santri_id = ?
  `,[o,o,o,o,o,a.santriId]);try{await (0,f.Mx)({actor:(0,f.CF)(c),module:"psb",action:"payment_cancel",fiturHref:l,logKind:"delete",entityType:"psb_payment_receipt",entityId:a.receiptId,entityLabel:d.receipt_no,summary:`Pembayaran PSB dibatalkan ${d.nama_lengkap}: ${d.receipt_no}`,details:{santri_id:a.santriId,receipt_no:d.receipt_no,status_after_cancel:o}})}catch(a){console.error("Failed to write PSB payment cancellation log",a)}try{(0,e.revalidatePath)(l),(0,e.revalidatePath)(m)}catch(a){console.error("Failed to revalidate PSB pages after cancellation",a)}return{success:!0,status:o}}async function P(a){let b=await (0,h.Ht)();if(!b)return{error:"Tidak terautentikasi"};if(!(0,h.pX)(b,["admin","bendahara","sekpen"]))return{error:"Akses ditolak"};await z();let c=await (0,i.Zy)(`
    SELECT r.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, u.full_name AS penerima_nama
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `,[a]);return c?{receipt:c,items:await (0,i.P)(`
    SELECT jenis_biaya, tahun_tagihan, nominal_bayar, keterangan, tanggal_bayar
    FROM pembayaran_tahunan
    WHERE psb_receipt_id = ?
    ORDER BY jenis_biaya
  `,[a])}:{error:"Kuitansi tidak ditemukan"}}(0,k.D)([D,E,G,H,I,J,K,M,N,O,P]),(0,d.A)(D,"4034562dc81bd0daac4f53bc6a320a0148befd6914",null),(0,d.A)(E,"40f97e8a2350e5486d65c671ab35b92798d3e34fb4",null),(0,d.A)(G,"40e15bc16e3b2a842502f33fa14b6e098fa8d17223",null),(0,d.A)(H,"604da1541be3e2608893421b7b672b28a07ee4e32f",null),(0,d.A)(I,"6025537da1cb043a04eb35586950b4bd6b4bd8ceec",null),(0,d.A)(J,"40093f87eced176a1ee13f1183263b424f5e9f6731",null),(0,d.A)(K,"607de5705621208ab30d5cb080774a768f47c57818",null),(0,d.A)(M,"40eb2d71d0b71f6c7b95ecca1852e2b9cfd3f2c8f6",null),(0,d.A)(N,"409575ce0dc73cb856b0f6fe0b3c6dbfde87acbb0a",null),(0,d.A)(O,"40188177f0f120fd50d3d4f393b52985af5c5c168d",null),(0,d.A)(P,"40db3fdbeae02c279f84a7f33668384deb6bd30e09",null)},1501:(a,b,c)=>{"use strict";c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},5930:(a,b,c)=>{"use strict";c.r(b),c.d(b,{GlobalError:()=>D.a,__next_app__:()=>L,handler:()=>N,routeModule:()=>M});var d=c(7553),e=c(84006),f=c(67798),g=c(34775),h=c(99373),i=c(73461),j=c(1020),k=c(26349),l=c(54365),m=c(16023),n=c(63747),o=c(24235),p=c(23938),q=c(261),r=c(66758),s=c(77243),t=c(26713),u=c(37527),v=c(22820),w=c(88216),x=c(47929),y=c(79551),z=c(89125),A=c(86439),B=c(77068),C=c(95547),D=c.n(C),E=c(61287),F=c(81494),G=c(70722),H=c(70753),I=c(43954),J={};for(let a in E)0>["default","GlobalError","__next_app__","routeModule","handler"].indexOf(a)&&(J[a]=()=>E[a]);c.d(b,J);let K={children:["",{children:["dashboard",{children:["psb",{children:["kuitansi",{children:["[id]",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(c.bind(c,68037)),"C:\\DATA\\eskahade\\app\\dashboard\\psb\\kuitansi\\[id]\\page.tsx"]}]},{}]},{}]},{}]},{layout:[()=>Promise.resolve().then(c.bind(c,39588)),"C:\\DATA\\eskahade\\app\\dashboard\\layout.tsx"],loading:[()=>Promise.resolve().then(c.bind(c,35705)),"C:\\DATA\\eskahade\\app\\dashboard\\loading.tsx"],metadata:{icon:[async a=>(await Promise.resolve().then(c.bind(c,46055))).default(a)],apple:[],openGraph:[],twitter:[],manifest:void 0}}]},{layout:[()=>Promise.resolve().then(c.bind(c,32056)),"C:\\DATA\\eskahade\\app\\layout.tsx"],"global-error":[()=>Promise.resolve().then(c.t.bind(c,95547,23)),"next/dist/client/components/builtin/global-error.js"],"not-found":[()=>Promise.resolve().then(c.t.bind(c,55091,23)),"next/dist/client/components/builtin/not-found.js"],forbidden:[()=>Promise.resolve().then(c.t.bind(c,45270,23)),"next/dist/client/components/builtin/forbidden.js"],unauthorized:[()=>Promise.resolve().then(c.t.bind(c,28193,23)),"next/dist/client/components/builtin/unauthorized.js"],metadata:{icon:[async a=>(await Promise.resolve().then(c.bind(c,46055))).default(a)],apple:[],openGraph:[],twitter:[],manifest:void 0}}]}.children,L={require:c,loadChunk:()=>Promise.resolve()},M=new d.AppPageRouteModule({definition:{kind:e.RouteKind.APP_PAGE,page:"/dashboard/psb/kuitansi/[id]/page",pathname:"/dashboard/psb/kuitansi/[id]",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:K},distDir:".next",relativeProjectDir:""});async function N(a,b,d){var C;M.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let J=!!(0,h.getRequestMeta)(a,"minimalMode"),O="/dashboard/psb/kuitansi/[id]/page";"/index"===O&&(O="/");let P=await M.prepare(a,b,{srcPage:O,multiZoneDraftMode:!1});if(!P)return b.statusCode=400,b.end("Bad Request"),null==d.waitUntil||d.waitUntil.call(d,Promise.resolve()),null;let{buildId:Q,query:R,params:S,pageIsDynamic:T,buildManifest:U,nextFontManifest:V,reactLoadableManifest:W,serverActionsManifest:X,clientReferenceManifest:Y,subresourceIntegrityManifest:Z,prerenderManifest:$,isDraftMode:_,resolvedPathname:aa,revalidateOnlyGenerated:ab,routerServerContext:ac,nextConfig:ad,parsedUrl:ae,interceptionRoutePatterns:af,deploymentId:ag}=P,ah=(0,q.normalizeAppPath)(O),{isOnDemandRevalidate:ai}=P,aj=ad.experimental.ppr&&!ad.cacheComponents&&(0,I.isInterceptionRouteAppPath)(aa)?null:M.match(aa,$),ak=!!$.routes[aa],al=a.headers["user-agent"]||"",am=(0,t.getBotType)(al),an=(0,p.isHtmlBotRequest)(a),ao=(0,h.getRequestMeta)(a,"isPrefetchRSCRequest")??"1"===a.headers[s.NEXT_ROUTER_PREFETCH_HEADER],ap=(0,h.getRequestMeta)(a,"isRSCRequest")??!!a.headers[s.RSC_HEADER],aq=(0,r.getIsPossibleServerAction)(a),ar=(0,m.checkIsAppPPREnabled)(ad.experimental.ppr);if(!(0,h.getRequestMeta)(a,"postponed")&&ar&&"1"===a.headers[x.NEXT_RESUME_HEADER]&&"POST"===a.method){let b=[];for await(let c of a)b.push(c);let c=Buffer.concat(b).toString("utf8");(0,h.addRequestMeta)(a,"postponed",c)}let as=ar&&(null==(C=$.routes[ah]??$.dynamicRoutes[ah])?void 0:C.renderingMode)==="PARTIALLY_STATIC",at=!1,au=!1,av=as?(0,h.getRequestMeta)(a,"postponed"):void 0,aw=as&&ap&&!ao;J&&(aw=aw&&!!av);let ax=(0,h.getRequestMeta)(a,"segmentPrefetchRSCRequest"),ay=(!an||!as)&&(!al||(0,p.shouldServeStreamingMetadata)(al,ad.htmlLimitedBots)),az=!!((aj||ak||$.routes[ah])&&!(an&&as)),aA=as&&!0===ad.cacheComponents,aB=!0===M.isDev||!az||"string"==typeof av||(aA&&(0,h.getRequestMeta)(a,"onCacheEntryV2")?aw&&!J:aw),aC=an&&as,aD=null;_||!az||aB||aq||av||aw||(aD=aa);let aE=aD;!aE&&M.isDev&&(aE=aa),M.isDev||_||!az||!ap||aw||(0,k.d)(a.headers);let aF={...E,tree:K,GlobalError:D(),handler:N,routeModule:M,__next_app__:L};X&&Y&&(0,o.setManifestsSingleton)({page:O,clientReferenceManifest:Y,serverActionsManifest:X});let aG=a.method||"GET",aH=(0,g.getTracer)(),aI=aH.getActiveScopeSpan(),aJ=async()=>((null==ac?void 0:ac.render404)?await ac.render404(a,b,ae,!1):b.end("This page could not be found"),null);try{let f=M.getVaryHeader(aa,af);b.setHeader("Vary",f);let k=async(c,d)=>{let e=new l.NodeNextRequest(a),f=new l.NodeNextResponse(b);return M.render(e,f,d).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let a=aH.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==i.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let d=a.get("next.route");if(d){let a=`${aG} ${d}`;c.setAttributes({"next.route":d,"http.route":d,"next.span_name":a}),c.updateName(a)}else c.updateName(`${aG} ${O}`)})},m=(0,h.getRequestMeta)(a,"incrementalCache"),o=async({span:e,postponed:f,fallbackRouteParams:g,forceStaticRender:i})=>{let l={query:R,params:S,page:ah,sharedContext:{buildId:Q},serverComponentsHmrCache:(0,h.getRequestMeta)(a,"serverComponentsHmrCache"),fallbackRouteParams:g,renderOpts:{App:()=>null,Document:()=>null,pageConfig:{},ComponentMod:aF,Component:(0,j.T)(aF),params:S,routeModule:M,page:O,postponed:f,shouldWaitOnAllReady:aC,serveStreamingMetadata:ay,supportsDynamicResponse:"string"==typeof f||aB,buildManifest:U,nextFontManifest:V,reactLoadableManifest:W,subresourceIntegrityManifest:Z,setCacheStatus:null==ac?void 0:ac.setCacheStatus,setIsrStatus:null==ac?void 0:ac.setIsrStatus,setReactDebugChannel:null==ac?void 0:ac.setReactDebugChannel,sendErrorsToBrowser:null==ac?void 0:ac.sendErrorsToBrowser,dir:c(33873).join(process.cwd(),M.relativeProjectDir),isDraftMode:_,botType:am,isOnDemandRevalidate:ai,isPossibleServerAction:aq,assetPrefix:ad.assetPrefix,nextConfigOutput:ad.output,crossOrigin:ad.crossOrigin,trailingSlash:ad.trailingSlash,images:ad.images,previewProps:$.preview,deploymentId:ag,enableTainting:ad.experimental.taint,htmlLimitedBots:ad.htmlLimitedBots,reactMaxHeadersLength:ad.reactMaxHeadersLength,multiZoneDraftMode:!1,incrementalCache:m,cacheLifeProfiles:ad.cacheLife,basePath:ad.basePath,serverActions:ad.experimental.serverActions,...at||au?{nextExport:!0,supportsDynamicResponse:!1,isStaticGeneration:!0,isDebugDynamicAccesses:at}:{},cacheComponents:!!ad.cacheComponents,experimental:{isRoutePPREnabled:as,expireTime:ad.expireTime,staleTimes:ad.experimental.staleTimes,dynamicOnHover:!!ad.experimental.dynamicOnHover,inlineCss:!!ad.experimental.inlineCss,authInterrupts:!!ad.experimental.authInterrupts,clientTraceMetadata:ad.experimental.clientTraceMetadata||[],clientParamParsingOrigins:ad.experimental.clientParamParsingOrigins,maxPostponedStateSizeBytes:(0,B.parseMaxPostponedStateSize)(ad.experimental.maxPostponedStateSize)},waitUntil:d.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:()=>{},onInstrumentationRequestError:(b,c,d,e)=>M.onRequestError(a,b,d,e,ac),err:(0,h.getRequestMeta)(a,"invokeError"),dev:M.isDev}};at&&(l.renderOpts.nextExport=!0,l.renderOpts.supportsDynamicResponse=!1,l.renderOpts.isDebugDynamicAccesses=at),i&&(l.renderOpts.supportsDynamicResponse=!1);let n=await k(e,l),{metadata:o}=n,{cacheControl:p,headers:q={},fetchTags:r,fetchMetrics:s}=o;if(r&&(q[x.NEXT_CACHE_TAGS_HEADER]=r),a.fetchMetrics=s,az&&(null==p?void 0:p.revalidate)===0&&!M.isDev&&!as){let a=o.staticBailoutInfo,b=Object.defineProperty(Error(`Page changed from static to dynamic at runtime ${aa}${(null==a?void 0:a.description)?`, reason: ${a.description}`:""}
see more here https://nextjs.org/docs/messages/app-static-to-dynamic-error`),"__NEXT_ERROR_CODE",{value:"E132",enumerable:!1,configurable:!0});if(null==a?void 0:a.stack){let c=a.stack;b.stack=b.message+c.substring(c.indexOf("\n"))}throw b}return{value:{kind:u.CachedRouteKind.APP_PAGE,html:n,headers:q,rscData:o.flightData,postponed:o.postponed,status:o.statusCode,segmentData:o.segmentData},cacheControl:p}},p=async({hasResolved:c,previousCacheEntry:f,isRevalidating:g,span:i,forceStaticRender:j=!1})=>{let k,l=!1===M.isDev,q=c||b.writableEnded;if(ai&&ab&&!f&&!J)return(null==ac?void 0:ac.render404)?await ac.render404(a,b):(b.statusCode=404,b.end("This page could not be found")),null;if(aj&&(k=(0,v.parseFallbackField)(aj.fallback)),k===v.FallbackMode.PRERENDER&&(0,t.isBot)(al)&&(!as||an)&&(k=v.FallbackMode.BLOCKING_STATIC_RENDER),(null==f?void 0:f.isStale)===-1&&(ai=!0),ai&&(k!==v.FallbackMode.NOT_FOUND||f)&&(k=v.FallbackMode.BLOCKING_STATIC_RENDER),!J&&k!==v.FallbackMode.BLOCKING_STATIC_RENDER&&aE&&!q&&!_&&T&&(l||!ak)){if((l||aj)&&k===v.FallbackMode.NOT_FOUND){if(ad.experimental.adapterPath)return await aJ();throw new A.NoFallbackError}if(as&&(ad.cacheComponents?!aw:!ap)){let b=l&&"string"==typeof(null==aj?void 0:aj.fallback)?aj.fallback:ah,c=l&&(null==aj?void 0:aj.fallbackRouteParams)?(0,n.createOpaqueFallbackRouteParams)(aj.fallbackRouteParams):au?(0,n.getFallbackRouteParams)(ah,M):null,f=await M.handleResponse({cacheKey:b,req:a,nextConfig:ad,routeKind:e.RouteKind.APP_PAGE,isFallback:!0,prerenderManifest:$,isRoutePPREnabled:as,responseGenerator:async()=>o({span:i,postponed:void 0,fallbackRouteParams:c,forceStaticRender:!1}),waitUntil:d.waitUntil,isMinimalMode:J});if(null===f)return null;if(f)return delete f.cacheControl,f}}let r=ai||g||!av?void 0:av;if(aA&&!J&&m&&aw&&!j){let b=await m.get(aa,{kind:u.IncrementalCacheKind.APP_PAGE,isRoutePPREnabled:!0,isFallback:!1});b&&b.value&&b.value.kind===u.CachedRouteKind.APP_PAGE&&(r=b.value.postponed,b&&(-1===b.isStale||!0===b.isStale)&&(0,H.scheduleOnNextTick)(async()=>{let b=M.getResponseCache(a);try{await b.revalidate(aa,m,as,!1,a=>p({...a,forceStaticRender:!0}),null,c,d.waitUntil)}catch(a){console.error("Error revalidating the page in the background",a)}}))}if(at&&void 0!==r)return{cacheControl:{revalidate:1,expire:void 0},value:{kind:u.CachedRouteKind.PAGES,html:w.default.EMPTY,pageData:{},headers:void 0,status:void 0}};let s=l&&(null==aj?void 0:aj.fallbackRouteParams)&&(0,h.getRequestMeta)(a,"renderFallbackShell")?(0,n.createOpaqueFallbackRouteParams)(aj.fallbackRouteParams):au?(0,n.getFallbackRouteParams)(ah,M):null;return o({span:i,postponed:r,fallbackRouteParams:s,forceStaticRender:j})},q=async c=>{var f,g,i,j,k;let l,m=await M.handleResponse({cacheKey:aD,responseGenerator:a=>p({span:c,...a}),routeKind:e.RouteKind.APP_PAGE,isOnDemandRevalidate:ai,isRoutePPREnabled:as,req:a,nextConfig:ad,prerenderManifest:$,waitUntil:d.waitUntil,isMinimalMode:J});if(_&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate"),M.isDev&&b.setHeader("Cache-Control","no-store, must-revalidate"),!m){if(aD)throw Object.defineProperty(Error("invariant: cache entry required but not generated"),"__NEXT_ERROR_CODE",{value:"E62",enumerable:!1,configurable:!0});return null}if((null==(f=m.value)?void 0:f.kind)!==u.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant app-page handler received invalid cache entry ${null==(i=m.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E707",enumerable:!1,configurable:!0});let n="string"==typeof m.value.postponed;az&&!aw&&(!n||ao)&&(J||b.setHeader("x-nextjs-cache",ai?"REVALIDATED":m.isMiss?"MISS":m.isStale?"STALE":"HIT"),b.setHeader(s.NEXT_IS_PRERENDER_HEADER,"1"));let{value:q}=m;if(av)l={revalidate:0,expire:void 0};else if(aw)l={revalidate:0,expire:void 0};else if(!M.isDev)if(_)l={revalidate:0,expire:void 0};else if(az){if(m.cacheControl)if("number"==typeof m.cacheControl.revalidate){if(m.cacheControl.revalidate<1)throw Object.defineProperty(Error(`Invalid revalidate configuration provided: ${m.cacheControl.revalidate} < 1`),"__NEXT_ERROR_CODE",{value:"E22",enumerable:!1,configurable:!0});l={revalidate:m.cacheControl.revalidate,expire:(null==(j=m.cacheControl)?void 0:j.expire)??ad.expireTime}}else l={revalidate:x.CACHE_ONE_YEAR,expire:void 0}}else b.getHeader("Cache-Control")||(l={revalidate:0,expire:void 0});if(m.cacheControl=l,"string"==typeof ax&&(null==q?void 0:q.kind)===u.CachedRouteKind.APP_PAGE&&q.segmentData){b.setHeader(s.NEXT_DID_POSTPONE_HEADER,"2");let c=null==(k=q.headers)?void 0:k[x.NEXT_CACHE_TAGS_HEADER];J&&az&&c&&"string"==typeof c&&b.setHeader(x.NEXT_CACHE_TAGS_HEADER,c);let d=q.segmentData.get(ax);return void 0!==d?(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:w.default.fromStatic(d,s.RSC_CONTENT_TYPE_HEADER),cacheControl:m.cacheControl}):(b.statusCode=204,(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:w.default.EMPTY,cacheControl:m.cacheControl}))}let r=aA?(0,h.getRequestMeta)(a,"onCacheEntryV2")??(0,h.getRequestMeta)(a,"onCacheEntry"):(0,h.getRequestMeta)(a,"onCacheEntry");if(r&&await r(m,{url:(0,h.getRequestMeta)(a,"initURL")??a.url}))return null;if(q.headers){let a={...q.headers};for(let[c,d]of(J&&az||delete a[x.NEXT_CACHE_TAGS_HEADER],Object.entries(a)))if(void 0!==d)if(Array.isArray(d))for(let a of d)b.appendHeader(c,a);else"number"==typeof d&&(d=d.toString()),b.appendHeader(c,d)}let t=null==(g=q.headers)?void 0:g[x.NEXT_CACHE_TAGS_HEADER];if(J&&az&&t&&"string"==typeof t&&b.setHeader(x.NEXT_CACHE_TAGS_HEADER,t),!q.status||ap&&as||(b.statusCode=q.status),!J&&q.status&&F.RedirectStatusCode[q.status]&&ap&&(b.statusCode=200),n&&!aw&&b.setHeader(s.NEXT_DID_POSTPONE_HEADER,"1"),ap&&!_){if(void 0===q.rscData){if(q.html.contentType!==s.RSC_CONTENT_TYPE_HEADER)if(ad.cacheComponents)return b.statusCode=404,(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:w.default.EMPTY,cacheControl:m.cacheControl});else throw Object.defineProperty(new G.InvariantError(`Expected RSC response, got ${q.html.contentType}`),"__NEXT_ERROR_CODE",{value:"E789",enumerable:!1,configurable:!0});return(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:q.html,cacheControl:m.cacheControl})}return(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:w.default.fromStatic(q.rscData,s.RSC_CONTENT_TYPE_HEADER),cacheControl:m.cacheControl})}let v=q.html;if(!n||J||ap)return(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:v,cacheControl:m.cacheControl});if(at)return v.push(new ReadableStream({start(a){a.enqueue(y.ENCODED_TAGS.CLOSED.BODY_AND_HTML),a.close()}})),(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:v,cacheControl:{revalidate:0,expire:void 0}});let A=new TransformStream;return v.push(A.readable),o({span:c,postponed:q.postponed,fallbackRouteParams:null,forceStaticRender:!1}).then(async a=>{var b,c;if(!a)throw Object.defineProperty(Error("Invariant: expected a result to be returned"),"__NEXT_ERROR_CODE",{value:"E463",enumerable:!1,configurable:!0});if((null==(b=a.value)?void 0:b.kind)!==u.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant: expected a page response, got ${null==(c=a.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E305",enumerable:!1,configurable:!0});await a.value.html.pipeTo(A.writable)}).catch(a=>{A.writable.abort(a).catch(a=>{console.error("couldn't abort transformer",a)})}),(0,z.sendRenderResult)({req:a,res:b,generateEtags:ad.generateEtags,poweredByHeader:ad.poweredByHeader,result:v,cacheControl:{revalidate:0,expire:void 0}})};if(!aI)return await aH.withPropagatedContext(a.headers,()=>aH.trace(i.BaseServerSpan.handleRequest,{spanName:`${aG} ${O}`,kind:g.SpanKind.SERVER,attributes:{"http.method":aG,"http.target":a.url}},q));await q(aI)}catch(b){throw b instanceof A.NoFallbackError||await M.onRequestError(a,b,{routerKind:"App Router",routePath:O,routeType:"render",revalidateReason:(0,f.c)({isStaticGeneration:az,isOnDemandRevalidate:ai})},!1,ac),b}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},15323:(a,b)=>{"use strict";function c(a,b){let c=a||75;return b?.qualities?.length?b.qualities.reduce((a,b)=>Math.abs(b-c)<Math.abs(a-c)?b:a,0):c}Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"findClosestQuality",{enumerable:!0,get:function(){return c}})},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},24424:(a,b)=>{"use strict";function c(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(b,"D",{enumerable:!0,get:function(){return c}})},26713:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/is-bot")},27268:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,58637,23))},28354:a=>{"use strict";a.exports=require("util")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30236:(a,b,c)=>{"use strict";c.d(b,{CF:()=>k,DS:()=>p,Mx:()=>q,NL:()=>m,Pu:()=>o,bO:()=>r});var d=c(65573),e=c(44075);let f=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),g=null,h=new Map;function i(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function j(a){return null==a?null:"string"==typeof a?i(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(j):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!f.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,j(b)])):String(a)}function k(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function l(){try{let a=await (0,d.b3)(),b=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(b?b.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function m(){g||(g=(async()=>{await (0,e.g7)(`
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,e.$C)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,i(a.summary,300),!(c=a.details)?null:JSON.stringify(j(c)),a.status??"success",d.ipAddress??null,d.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function r(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:j(c),after:j(f)})}return d}},33873:a=>{"use strict";a.exports=require("path")},40005:(a,b,c)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"default",{enumerable:!0,get:function(){return g}});let d=c(15323),e=c(80647);function f({config:a,src:b,width:c,quality:f}){if(b.startsWith("/")&&b.includes("?")&&a.localPatterns?.length===1&&"**"===a.localPatterns[0].pathname&&""===a.localPatterns[0].search)throw Object.defineProperty(Error(`Image with src "${b}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`),"__NEXT_ERROR_CODE",{value:"E871",enumerable:!1,configurable:!0});let g=(0,d.findClosestQuality)(f,a),h=(0,e.getDeploymentId)();return`${a.path}?url=${encodeURIComponent(b)}&w=${c}&q=${g}${b.startsWith("/")&&h?`&dpl=${h}`:""}`}f.__next_img_default=!0;let g=f},41025:a=>{"use strict";a.exports=require("next/dist/server/app-render/dynamic-access-async-storage.external.js")},41824:(a,b)=>{"use strict";function c({widthInt:a,heightInt:b,blurWidth:c,blurHeight:d,blurDataURL:e,objectFit:f}){let g=c?40*c:a,h=d?40*d:b,i=g&&h?`viewBox='0 0 ${g} ${h}'`:"";return`%3Csvg xmlns='http://www.w3.org/2000/svg' ${i}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${i?"none":"contain"===f?"xMidYMid":"cover"===f?"xMidYMid slice":"none"}' style='filter: url(%23b);' href='${e}'/%3E%3C/svg%3E`}Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"getImageBlurSvg",{enumerable:!0,get:function(){return c}})},43954:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/interception-routes")},46488:(a,b,c)=>{"use strict";c.r(b),c.d(b,{"40093f87eced176a1ee13f1183263b424f5e9f6731":()=>d.gG,"40188177f0f120fd50d3d4f393b52985af5c5c168d":()=>d.I7,"4034562dc81bd0daac4f53bc6a320a0148befd6914":()=>d.U9,"409575ce0dc73cb856b0f6fe0b3c6dbfde87acbb0a":()=>d.yz,"40db3fdbeae02c279f84a7f33668384deb6bd30e09":()=>d.c3,"40e15bc16e3b2a842502f33fa14b6e098fa8d17223":()=>d.hz,"40eb2d71d0b71f6c7b95ecca1852e2b9cfd3f2c8f6":()=>d.FT,"40f97e8a2350e5486d65c671ab35b92798d3e34fb4":()=>d.Ag,"6025537da1cb043a04eb35586950b4bd6b4bd8ceec":()=>d.M9,"604da1541be3e2608893421b7b672b28a07ee4e32f":()=>d.Ex,"607de5705621208ab30d5cb080774a768f47c57818":()=>d.fT});var d=c(338)},49796:(a,b,c)=>{"use strict";Object.defineProperty(b,"A",{enumerable:!0,get:function(){return d.registerServerReference}});let d=c(77943)},55743:(a,b,c)=>{"use strict";c.d(b,{HA:()=>j,Yf:()=>h,ZW:()=>i,hj:()=>g});var d=c(44075),e=c(23755);function f(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function g(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(f)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function h(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let f=(0,e.XV)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,d.Zy)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1
       LIMIT 1`,[b,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function i(a,b){return h(await (0,e.Ht)(),a,b)}async function j(a,b){let c=await (0,e.Ht)(),d=await h(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},58637:(a,b,c)=>{let{createProxy:d}=c(78830);a.exports=d("C:\\DATA\\eskahade\\node_modules\\next\\dist\\client\\image-component.js")},62605:(a,b,c)=>{"use strict";function d(a){return a&&a.__esModule?a:{default:a}}c.r(b),c.d(b,{_:()=>d})},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},65003:(a,b,c)=>{"use strict";c.r(b),c.d(b,{"006f0febd6fb8c82aca29b039f392985ea90492e3b":()=>d.C});var d=c(38052)},68037:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>n,dynamic:()=>i});var d=c(5735),e=c(85957),f=c.n(e),g=c(91970),h=c(338);let i="force-dynamic";function j(a){return`Rp ${Number(a||0).toLocaleString("id-ID")}`}function k(a){return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a))}function l({receipt:a,items:b,label:c,printedAt:e}){let g,h,i,l=Number(a.total||0),n=l>0,o=a.nama_lengkap||"________________",p=a.penerima_nama||"Bendahara";return(0,d.jsxs)("section",{className:"receipt-copy",children:[n?(0,d.jsx)("div",{className:"paid-stamp",children:"LUNAS"}):null,(0,d.jsxs)("header",{className:"receipt-header",children:[(0,d.jsx)(f(),{src:"/logo.png",width:78,height:78,alt:"Logo Pesantren Sukahideng",priority:!0}),(0,d.jsxs)("div",{className:"school-heading",children:[(0,d.jsx)("h1",{children:"KUITANSI PEMBAYARAN"}),(0,d.jsx)("h2",{children:"PONDOK PESANTREN SUKAHIDENG"}),(0,d.jsx)("p",{children:"Desa Sukarapih Kec. Sukarame Kabupaten Tasikmalaya Jawa Barat 46461"})]})]}),(0,d.jsx)("div",{className:"header-rule"}),(0,d.jsx)("div",{className:"copy-label",children:c}),(0,d.jsxs)("section",{className:"intro-grid",children:[(0,d.jsxs)("div",{className:"student-info",children:[(0,d.jsx)(m,{label:"Nama Santri",value:o,strong:!0}),(0,d.jsx)(m,{label:"NIS",value:a.nis||"-"}),(0,d.jsx)(m,{label:"Kelas",value:a.sekolah||"-"}),(0,d.jsx)(m,{label:"Asrama",value:`${a.asrama||"-"} / ${a.kamar||"-"}`})]}),(0,d.jsxs)("div",{className:"payment-title",children:[(0,d.jsx)("h3",{children:"BUKTI PEMBAYARAN"}),(0,d.jsxs)("p",{children:["Pembayaran PSB - Tahun Tagihan ",a.tahun_tagihan||"-"]})]}),(0,d.jsxs)("div",{className:"receipt-info",children:[(0,d.jsx)(m,{label:"No. Bukti",value:a.receipt_no,strong:!0}),(0,d.jsx)(m,{label:"Tanggal",value:k(a.created_at)}),(0,d.jsx)(m,{label:"Metode",value:"Tunai"}),(0,d.jsx)(m,{label:"Petugas",value:p})]})]}),(0,d.jsxs)("div",{className:"terbilang",children:[(0,d.jsx)("span",{children:"Terbilang:"}),(0,d.jsx)("strong",{children:(g=Math.floor(Math.abs(Number(l||0))),h=["","Satu","Dua","Tiga","Empat","Lima","Enam","Tujuh","Delapan","Sembilan","Sepuluh","Sebelas"],i=a=>a<12?h[a]:a<20?`${i(a-10)} Belas`:a<100?`${i(Math.floor(a/10))} Puluh ${i(a%10)}`.trim():a<200?`Seratus ${i(a-100)}`.trim():a<1e3?`${i(Math.floor(a/100))} Ratus ${i(a%100)}`.trim():a<2e3?`Seribu ${i(a-1e3)}`.trim():a<1e6?`${i(Math.floor(a/1e3))} Ribu ${i(a%1e3)}`.trim():a<1e9?`${i(Math.floor(a/1e6))} Juta ${i(a%1e6)}`.trim():`${i(Math.floor(a/1e9))} Miliar ${i(a%1e9)}`.trim(),`${i(g).replace(/\s+/g," ")} Rupiah`)})]}),(0,d.jsxs)("table",{className:"main-table",children:[(0,d.jsx)("thead",{children:(0,d.jsxs)("tr",{children:[(0,d.jsx)("th",{className:"no-col",children:"No."}),(0,d.jsx)("th",{children:"Uraian Pembayaran"}),(0,d.jsx)("th",{className:"amount-col",children:"Jumlah (Rp)"})]})}),(0,d.jsx)("tbody",{children:b.map((a,b)=>{var c;return(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{className:"no-col",children:b+1}),(0,d.jsx)("td",{children:{BANGUNAN:"Dana Bangunan",KESEHATAN:"Biaya Kesehatan",EHB:"Biaya EHB",EKSKUL:"Biaya Ekstrakurikuler"}[c=a.jenis_biaya]??c}),(0,d.jsx)("td",{className:"amount-col",children:j(a.nominal_bayar)})]},`${a.jenis_biaya}-${b}`)})}),(0,d.jsx)("tfoot",{children:(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{colSpan:2,children:"TOTAL PEMBAYARAN INI"}),(0,d.jsx)("td",{className:"amount-col",children:j(l)})]})})]}),(0,d.jsx)("p",{className:"arrears-caption",children:"Catatan - sisa tagihan yang belum terbayar:"}),(0,d.jsxs)("table",{className:"arrears-table",children:[(0,d.jsx)("thead",{children:(0,d.jsxs)("tr",{children:[(0,d.jsx)("th",{children:"Item"}),(0,d.jsx)("th",{className:"amount-col",children:"Sisa (Rp)"})]})}),(0,d.jsxs)("tbody",{children:[(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{children:"PSB"}),(0,d.jsx)("td",{className:"amount-col due-zero",children:"Rp 0"})]}),(0,d.jsxs)("tr",{className:"total-arrears",children:[(0,d.jsx)("td",{children:"Total Sisa Tunggakan"}),(0,d.jsx)("td",{className:"amount-col due-zero",children:"Rp 0"})]})]})]}),(0,d.jsxs)("div",{className:"summary-block",children:[(0,d.jsx)("div",{}),(0,d.jsx)("table",{children:(0,d.jsxs)("tbody",{children:[(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{children:"JUMLAH"}),(0,d.jsx)("td",{children:":"}),(0,d.jsx)("td",{children:j(l)})]}),(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{children:"PEMBAYARAN"}),(0,d.jsx)("td",{children:":"}),(0,d.jsx)("td",{children:j(l)})]}),(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{children:"KEMBALI"}),(0,d.jsx)("td",{children:":"}),(0,d.jsx)("td",{children:"Rp 0"})]})]})})]}),(0,d.jsxs)("section",{className:"signature-section",children:[(0,d.jsxs)("div",{className:"signature-box",children:[(0,d.jsx)("p",{children:"Penyetor / Santri"}),(0,d.jsx)("div",{className:"signature-line"}),(0,d.jsxs)("strong",{children:["( ",o," )"]})]}),(0,d.jsxs)("div",{className:"signature-box",children:[(0,d.jsxs)("p",{children:["Tasikmalaya, ",k(a.created_at),(0,d.jsx)("br",{}),"Bendahara"]}),(0,d.jsx)("div",{className:"signature-line"}),(0,d.jsxs)("strong",{children:["( ",p," )"]})]})]}),(0,d.jsxs)("footer",{className:"receipt-footer",children:[(0,d.jsxs)("span",{children:["Dicetak: ",new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(e))]}),(0,d.jsx)("span",{children:"Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem"}),(0,d.jsx)("span",{children:"PSB"})]})]})}function m({label:a,value:b,strong:c=!1}){return(0,d.jsxs)("div",{className:"info-row",children:[(0,d.jsx)("span",{children:a}),(0,d.jsx)("b",{children:":"}),c?(0,d.jsx)("strong",{children:b}):(0,d.jsx)("em",{children:b})]})}async function n({params:a}){let{id:b}=await a,c=await (0,h.c3)(b);if("error"in c)return(0,g.notFound)();let{receipt:e,items:f}=c,i=new Date().toISOString();return(0,d.jsxs)("main",{className:"receipt-page",children:[(0,d.jsx)("div",{className:"print-actions",children:(0,d.jsx)("span",{children:"Gunakan Ctrl+P untuk mencetak"})}),(0,d.jsx)(l,{receipt:e,items:f,label:"Lembar Pembayar",printedAt:i}),(0,d.jsx)("div",{className:"copy-divider"}),(0,d.jsx)(l,{receipt:e,items:f,label:"Arsip Pondok",printedAt:i}),(0,d.jsx)("style",{children:`
        .receipt-page {
          min-height: 100vh;
          background: #f5f5f5;
          padding: 14px 0;
          color: #111;
          font-family: "Times New Roman", Times, serif;
        }
        .print-actions {
          width: 210mm;
          margin: 0 auto 8px;
          text-align: right;
          font-family: Arial, sans-serif;
        }
        .print-actions span {
          display: inline-block;
          border: 1px solid #bbb;
          border-radius: 4px;
          background: white;
          padding: 5px 9px;
          font-size: 11px;
          color: #444;
        }
        .receipt-copy {
          position: relative;
          width: 210mm;
          height: 147.5mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          padding: 3mm 10mm 5.5mm;
          overflow: hidden;
        }
        .receipt-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 14mm;
          text-align: left;
        }
        .receipt-header img {
          width: 13mm;
          height: 13mm;
          object-fit: contain;
        }
        .school-heading {
          min-width: 0;
        }
        .school-heading h1,
        .school-heading h2,
        .school-heading p {
          margin: 0;
        }
        .school-heading h1 {
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.05;
        }
        .school-heading h2 {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
        }
        .school-heading p {
          margin-top: 1px;
          font-family: Arial, sans-serif;
          font-size: 7.8px;
          line-height: 1.15;
        }
        .header-rule {
          height: 0;
          margin: 1mm 0 1.5mm;
          border-top: 2px solid #111;
        }
        .copy-label {
          display: inline-block;
          margin-left: 0;
          margin-bottom: 2mm;
          border: 1px solid #b7b7b7;
          border-radius: 999px;
          padding: 1px 8px;
          font-size: 7px;
          color: #777;
          background: #fff;
        }
        .intro-grid {
          display: grid;
          grid-template-columns: 42% 1fr 32%;
          column-gap: 7px;
          align-items: start;
          margin-bottom: 2mm;
        }
        .student-info,
        .receipt-info {
          padding-top: 0;
        }
        .info-row {
          display: grid;
          grid-template-columns: 25mm 4px 1fr;
          column-gap: 2px;
          min-height: 3.2mm;
          align-items: baseline;
          font-size: 8px;
          line-height: 1.12;
        }
        .receipt-info .info-row {
          grid-template-columns: 17mm 4px 1fr;
        }
        .info-row span,
        .info-row b {
          font-weight: 400;
          color: #555;
        }
        .info-row strong {
          font-style: normal;
          font-weight: 800;
          color: #111;
          text-transform: uppercase;
        }
        .info-row em {
          font-style: normal;
          color: #111;
        }
        .payment-title {
          text-align: center;
          padding-top: 0;
        }
        .payment-title h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          line-height: 1;
        }
        .payment-title p {
          margin: 3px 0 0;
          color: #777;
          font-size: 7px;
        }
        .terbilang {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 4.8mm;
          border: 1px solid #9a9a9a;
          padding: 1px 5px;
          box-sizing: border-box;
          font-size: 7.8px;
          color: #555;
        }
        .terbilang strong {
          color: #111;
          font-size: 7.8px;
          font-style: italic;
          font-weight: 800;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table {
          margin-top: 1.6mm;
          font-size: 7.8px;
        }
        .main-table th {
          background: #111;
          color: #fff;
          padding: 1.5px 4px;
          border-right: 1px solid #555;
          text-align: left;
          font-weight: 800;
        }
        .main-table th:last-child {
          border-right: 0;
        }
        .main-table td {
          padding: 1.5px 4px;
          border-bottom: 1px solid #ddd;
        }
        .main-table tfoot td {
          border-top: 2px solid #111;
          border-bottom: 0;
          background: #f1f1f1;
          font-weight: 900;
          text-align: center;
        }
        .no-col {
          width: 8mm;
          text-align: center !important;
        }
        .amount-col {
          width: 32mm;
          text-align: right !important;
          font-family: "Courier New", monospace;
          font-weight: 700;
        }
        .arrears-caption {
          margin: 2mm 0 .8mm;
          font-size: 7.2px;
          font-style: italic;
          color: #666;
        }
        .arrears-table {
          font-size: 7.2px;
          color: #111;
        }
        .arrears-table th {
          padding: 1.4px 4px;
          border: 1px solid #ddd;
          background: #f3f3f3;
          text-align: left;
          font-weight: 800;
        }
        .arrears-table td {
          padding: 1.4px 4px;
          border: 1px solid #eee;
        }
        .total-arrears td {
          background: #fff1f1;
          font-weight: 800;
        }
        .due-zero {
          color: #c00;
        }
        .summary-block {
          display: grid;
          grid-template-columns: 1fr 44mm;
          margin-top: 1.7mm;
          font-size: 7.8px;
        }
        .summary-block table td {
          padding: .5px 0;
          border: 0;
        }
        .summary-block table td:nth-child(1) {
          width: 18mm;
        }
        .summary-block table td:nth-child(2) {
          width: 3mm;
          text-align: center;
        }
        .summary-block table td:nth-child(3) {
          font-family: "Courier New", monospace;
          font-weight: 800;
          text-align: right;
        }
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14mm;
          margin-top: 2mm;
          padding: 0 12mm;
          text-align: center;
          font-size: 7.7px;
        }
        .signature-box p {
          height: 8.5mm;
          margin: 0;
          line-height: 1.25;
        }
        .signature-line {
          border-top: 1px solid #111;
          height: 0;
          margin: 0 auto 1mm;
        }
        .signature-box strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 7.4px;
          font-weight: 800;
        }
        .receipt-footer {
          position: absolute;
          left: 10mm;
          right: 10mm;
          bottom: 2mm;
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          gap: 4mm;
          border-top: 1px solid #ddd;
          padding-top: .7mm;
          font-size: 6.4px;
          color: #999;
        }
        .receipt-footer span:nth-child(2) {
          text-align: center;
        }
        .receipt-footer span:nth-child(3) {
          text-align: right;
        }
        .copy-divider {
          width: 210mm;
          height: 0;
          margin: 0 auto;
          border-top: .5px dashed #9b9b9b;
        }
        .paid-stamp {
          position: absolute;
          right: 34mm;
          bottom: 40mm;
          z-index: 0;
          transform: rotate(-13deg);
          border: 3px double rgba(10, 120, 56, .16);
          border-radius: 7px;
          padding: 4px 16px;
          color: rgba(10, 120, 56, .14);
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: .10em;
          pointer-events: none;
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          .receipt-page {
            background: #fff;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-copy {
            margin: 0;
          }
          .copy-divider {
            margin: 0;
          }
        }
      `})]})}},70722:a=>{"use strict";a.exports=require("next/dist/shared/lib/invariant-error")},74812:(a,b,c)=>{"use strict";c.d(b,{Av:()=>f,FY:()=>m,GP:()=>n,Lx:()=>e,Oh:()=>j,Wd:()=>o,kM:()=>k,mp:()=>h,uq:()=>g});var d=c(44075);let e=["REGULER","SADESA"],f=["BARU",...e],g="santri_baru_mulai_berlaku",h="santri_baru_durasi_bulan",i="2026-07-01";function j(a){return"SADESA"===String(a??"").trim().toUpperCase()?"SADESA":"REGULER"}function k(a="s"){let b=`(SELECT value FROM app_settings WHERE key = '${g}')`,c=`(SELECT value FROM app_settings WHERE key = '${h}')`;return`CASE
    WHEN ${a}.status_global = 'aktif'
      AND ${a}.created_at IS NOT NULL
      AND date(${a}.created_at) >= date(COALESCE(${b}, '${i}'))
      AND datetime(${a}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${c}, '3') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${a}.kategori_santri, ''), 'REGULER')
  END`}async function l(){await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `),await (0,d.g7)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[g,i]),await (0,d.g7)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[h,String(3)])}async function m(){await l();let[a,b]=await Promise.all([(0,d.Zy)("SELECT value FROM app_settings WHERE key = ?",[g]),(0,d.Zy)("SELECT value FROM app_settings WHERE key = ?",[h])]);return{mulaiBerlaku:n(a?.value),durasiBulan:o(b?.value)}}function n(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:i}function o(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}},77068:a=>{"use strict";a.exports=require("next/dist/shared/lib/size-limit")},80420:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,51455,23))},80647:(a,b)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0});var c={getDeploymentId:function(){return e},getDeploymentIdQueryOrEmptyString:function(){return f}};for(var d in c)Object.defineProperty(b,d,{enumerable:!0,get:c[d]});function e(){return!1}function f(){return""}},81505:(a,b,c)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"getImgProps",{enumerable:!0,get:function(){return j}}),c(92332);let d=c(80647),e=c(41824),f=c(86012),g=["-moz-initial","fill","none","scale-down",void 0];function h(a){return void 0!==a.default}function i(a){return void 0===a?a:"number"==typeof a?Number.isFinite(a)?a:NaN:"string"==typeof a&&/^[0-9]+$/.test(a)?parseInt(a,10):NaN}function j({src:a,sizes:b,unoptimized:c=!1,priority:j=!1,preload:k=!1,loading:l,className:m,quality:n,width:o,height:p,fill:q=!1,style:r,overrideSrc:s,onLoad:t,onLoadingComplete:u,placeholder:v="empty",blurDataURL:w,fetchPriority:x,decoding:y="async",layout:z,objectFit:A,objectPosition:B,lazyBoundary:C,lazyRoot:D,...E},F){var G;let H,I,J,{imgConf:K,showAltText:L,blurComplete:M,defaultLoader:N}=F,O=K||f.imageConfigDefault;if("allSizes"in O)H=O;else{let a=[...O.deviceSizes,...O.imageSizes].sort((a,b)=>a-b),b=O.deviceSizes.sort((a,b)=>a-b),c=O.qualities?.sort((a,b)=>a-b);H={...O,allSizes:a,deviceSizes:b,qualities:c}}if(void 0===N)throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"),"__NEXT_ERROR_CODE",{value:"E163",enumerable:!1,configurable:!0});let P=E.loader||N;delete E.loader,delete E.srcSet;let Q="__next_img_default"in P;if(Q){if("custom"===H.loader)throw Object.defineProperty(Error(`Image with src "${a}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`),"__NEXT_ERROR_CODE",{value:"E252",enumerable:!1,configurable:!0})}else{let a=P;P=b=>{let{config:c,...d}=b;return a(d)}}if(z){"fill"===z&&(q=!0);let a={intrinsic:{maxWidth:"100%",height:"auto"},responsive:{width:"100%",height:"auto"}}[z];a&&(r={...r,...a});let c={responsive:"100vw",fill:"100vw"}[z];c&&!b&&(b=c)}let R="",S=i(o),T=i(p);if((G=a)&&"object"==typeof G&&(h(G)||void 0!==G.src)){let b=h(a)?a.default:a;if(!b.src)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E460",enumerable:!1,configurable:!0});if(!b.height||!b.width)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E48",enumerable:!1,configurable:!0});if(I=b.blurWidth,J=b.blurHeight,w=w||b.blurDataURL,R=b.src,!q)if(S||T){if(S&&!T){let a=S/b.width;T=Math.round(b.height*a)}else if(!S&&T){let a=T/b.height;S=Math.round(b.width*a)}}else S=b.width,T=b.height}let U=!j&&!k&&("lazy"===l||void 0===l);(!(a="string"==typeof a?a:R)||a.startsWith("data:")||a.startsWith("blob:"))&&(c=!0,U=!1),H.unoptimized&&(c=!0),Q&&!H.dangerouslyAllowSVG&&a.split("?",1)[0].endsWith(".svg")&&(c=!0);let V=i(n),W=Object.assign(q?{position:"absolute",height:"100%",width:"100%",left:0,top:0,right:0,bottom:0,objectFit:A,objectPosition:B}:{},L?{}:{color:"transparent"},r),X=M||"empty"===v?null:"blur"===v?`url("data:image/svg+xml;charset=utf-8,${(0,e.getImageBlurSvg)({widthInt:S,heightInt:T,blurWidth:I,blurHeight:J,blurDataURL:w||"",objectFit:W.objectFit})}")`:`url("${v}")`,Y=g.includes(W.objectFit)?"fill"===W.objectFit?"100% 100%":"cover":W.objectFit,Z=X?{backgroundSize:Y,backgroundPosition:W.objectPosition||"50% 50%",backgroundRepeat:"no-repeat",backgroundImage:X}:{},$=function({config:a,src:b,unoptimized:c,width:e,quality:f,sizes:g,loader:h}){if(c){let a=(0,d.getDeploymentId)();if(b.startsWith("/")&&!b.startsWith("//")&&a){let c=b.includes("?")?"&":"?";b=`${b}${c}dpl=${a}`}return{src:b,srcSet:void 0,sizes:void 0}}let{widths:i,kind:j}=function({deviceSizes:a,allSizes:b},c,d){if(d){let c=/(^|\s)(1?\d?\d)vw/g,e=[];for(let a;a=c.exec(d);)e.push(parseInt(a[2]));if(e.length){let c=.01*Math.min(...e);return{widths:b.filter(b=>b>=a[0]*c),kind:"w"}}return{widths:b,kind:"w"}}return"number"!=typeof c?{widths:a,kind:"w"}:{widths:[...new Set([c,2*c].map(a=>b.find(b=>b>=a)||b[b.length-1]))],kind:"x"}}(a,e,g),k=i.length-1;return{sizes:g||"w"!==j?g:"100vw",srcSet:i.map((c,d)=>`${h({config:a,src:b,quality:f,width:c})} ${"w"===j?c:d+1}${j}`).join(", "),src:h({config:a,src:b,quality:f,width:i[k]})}}({config:H,src:a,unoptimized:c,width:S,quality:V,sizes:b,loader:P}),_=U?"lazy":l;return{props:{...E,loading:_,fetchPriority:x,width:S,height:T,decoding:y,className:m,style:{...W,...Z},sizes:$.sizes,srcSet:$.srcSet,src:s||$.src},meta:{unoptimized:c,preload:k||j,placeholder:v,fill:q}}}},85957:(a,b,c)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0});var d={default:function(){return k},getImageProps:function(){return j}};for(var e in d)Object.defineProperty(b,e,{enumerable:!0,get:d[e]});let f=c(62605),g=c(81505),h=c(58637),i=f._(c(40005));function j(a){let{props:b}=(0,g.getImgProps)(a,{defaultLoader:i.default,imgConf:{deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],qualities:[75],path:"/_next/image",loader:"default",dangerouslyAllowSVG:!1,unoptimized:!0}});for(let[a,c]of Object.entries(b))void 0===c&&delete b[a];return{props:b}}let k=h.Image},86012:(a,b)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0});var c={VALID_LOADERS:function(){return e},imageConfigDefault:function(){return f}};for(var d in c)Object.defineProperty(b,d,{enumerable:!0,get:c[d]});let e=["default","imgix","cloudinary","akamai","custom"],f={deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],path:"/_next/image",loader:"default",loaderFile:"",domains:[],disableStaticImages:!1,minimumCacheTTL:14400,formats:["image/webp"],maximumRedirects:3,maximumResponseBody:5e7,dangerouslyAllowLocalIP:!1,dangerouslyAllowSVG:!1,contentSecurityPolicy:"script-src 'none'; frame-src 'none'; sandbox;",contentDispositionType:"attachment",localPatterns:void 0,remotePatterns:[],qualities:[75],unoptimized:!1}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},92332:(a,b)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"warnOnce",{enumerable:!0,get:function(){return c}});let c=a=>{}}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[3445,7471,5303,5704,2116,4726,4756,1455,515,5789],()=>b(b.s=5930));module.exports=c})();