"use strict";exports.id=5241,exports.ids=[5241],exports.modules={10316:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("search",[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]])},23899:(a,b,c)=>{c.r(b),c.d(b,{"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C,"40032945b4706d8bd0dd3b32180117b651c567e86e":()=>N,"4006310e257e55e95d3a60d83ede8f19d1a83fe7da":()=>O,"40265d817ab333c12c992a6847f686c36800e5c369":()=>F,"4031a11a5df0ae251e1172ac82af78ca5f17d812cb":()=>E,"404773618dae163945d77bb09a542bb15c51ec3a48":()=>Q,"4063179fe44179e94526fda8221d282de5d9462c48":()=>P,"40a7acab8751f876180f8b77d60ca51fe9ac5f0d6a":()=>H,"40ad4a5a3fbeb42a563e975146809bf16cc903be8d":()=>K,"60177ae0e1b8b6698294d43ada229d4c55c001ad0c":()=>L,"6067f808d9855bca14a3fcc21a7ba809c012e24c3c":()=>I,"60969f13652dd59713438731f8e3684f9cd8f57478":()=>J});var d=c(38052),e=c(95349),f=c(42650),g=c(89773),h=c(42434),i=c(46100),j=c(44916),k=c(67597),l=c(89337);let m="/dashboard/psb",n="/dashboard/psb/monitoring",o=["MTSU","MTSN","MAN","SMK","SMA","SMP","LAINNYA"],p=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"],q=["VERIFICATION","VERIFIED","PLACED_ASRAMA","PLACED_KAMAR","PAID","DONE"],r=["KESEHATAN","EHB","EKSKUL"];function s(a){return(0,i.qc)(a)||(0,i.hf)(a,"sekpen")}function t(a){return(0,i.qc)(a)||(0,i.hf)(a,"sekpen")}function u(a){return(0,i.qc)(a)||(0,i.hf)(a,"pengurus_asrama")}function v(a){return(0,i.qc)(a)||(0,i.hf)(a,"bendahara")}function w(a,b){return q.indexOf(a)>=q.indexOf(b)}function x(a){return q.includes(a)?a:"VERIFICATION"}function y(a){let b=a.bangunanTarget<=0||a.bangunanPaid>=a.bangunanTarget,c=r.every(b=>a.payments.some(c=>c.jenis_biaya===b&&Number(c.tahun_tagihan)===a.tahunTagihan));return b&&c}function z(a){if(a.tahun_masuk)return Number(a.tahun_masuk);let b=Number(String(a.tanggal_masuk??"").slice(0,4));if(Number.isFinite(b)&&b>0)return b;let c=a.created_at?new Date(a.created_at).getFullYear():new Date().getFullYear();return Number.isFinite(c)?c:new Date().getFullYear()}async function A(){let a=await (0,j.xA)();await a.batch([a.prepare(`
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
    `)]),(await (0,j.P)("PRAGMA table_info(pembayaran_tahunan)")).some(a=>"psb_receipt_id"===a.name)||await (0,j.g7)("ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)")}async function B(a,b){await A();let c=(0,k.kM)("s"),d=[],e=`s.status_global = 'aktif' AND ((${c}) = 'BARU' OR pf.id IS NOT NULL)`;if((0,i.hf)(a,"pengurus_asrama")&&!(0,i.qc)(a)&&a?.asrama_binaan&&(e+=" AND s.asrama = ?",d.push(a.asrama_binaan)),b?.q?.trim()){e+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let a=`%${b.q.trim()}%`;d.push(a,a)}b?.sekolah&&(e+=" AND s.sekolah = ?",d.push(b.sekolah)),b?.asrama&&(e+=" AND s.asrama = ?",d.push(b.asrama));let f=x(b?.status),g=await (0,j.P)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at, s.kategori_santri,
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
  `,d);return b?.status?g.filter(a=>x(a.status)===f):g}async function C(a,b){if(!a.length)return new Map;let c=a.map(a=>a.id),d=c.map(()=>"?").join(","),e=await (0,j.P)(`SELECT santri_id, jenis_biaya, nominal_bayar, tahun_tagihan
     FROM pembayaran_tahunan
     WHERE santri_id IN (${d})`,c),f=await (0,j.P)("SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings"),g=await (0,j.P)(`SELECT id, santri_id, receipt_no, total, created_at
     FROM psb_payment_receipt
     WHERE santri_id IN (${d})
     ORDER BY datetime(created_at) DESC, created_at DESC`,c),h=new Map;f.forEach(a=>h.set(`${a.tahun_angkatan}:${a.jenis_biaya}`,Number(a.nominal??0)));let i=new Map;return a.forEach(a=>{let c=z(a),d=e.filter(b=>b.santri_id===a.id),f=d.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),j=h.get(`${c}:BANGUNAN`)??0,k=g.find(b=>b.santri_id===a.id)??null,l=Object.fromEntries(r.map(a=>{let e=h.get(`${c}:${a}`)??0,f=d.some(c=>c.jenis_biaya===a&&Number(c.tahun_tagihan)===b);return[a,{nominal:e,lunas:f}]}));i.set(a.id,{tahunMasuk:c,bangunan:{target:j,paid:f,sisa:Math.max(0,j-f)},tahunan:l,latestReceipt:k})}),i}async function D(){let a=(0,k.kM)("s"),b=p.map(()=>"?").join(","),[c,d]=await Promise.all([(0,j.P)(`SELECT asrama,
              SUM(COALESCE(kuota, 0)) AS total_kuota,
              SUM(COALESCE(reserved_baru, 0)) AS kuota_baru
       FROM kamar_config
       WHERE asrama IN (${b})
       GROUP BY asrama`,p),(0,j.P)(`SELECT s.asrama, COUNT(*) AS terisi_baru
       FROM santri s
       LEFT JOIN psb_flow pf ON pf.santri_id = s.id
       WHERE s.status_global = 'aktif'
         AND s.asrama IS NOT NULL
         AND TRIM(s.asrama) <> ''
         AND ((${a}) = 'BARU' OR pf.id IS NOT NULL)
       GROUP BY s.asrama`)]),e=new Map(c.map(a=>[a.asrama,a])),f=new Map(d.map(a=>[a.asrama,Number(a.terisi_baru??0)]));return p.map(a=>{let b=e.get(a),c=Number(b?.total_kuota??0),d=Number(b?.kuota_baru??0),g=d>0?d:c,h=Number(f.get(a)??0);return{asrama:a,total_kuota:c,kuota_baru:g,terisi_baru:h,sisa:g-h,over:Math.max(0,h-g),status:g<=0?h>0?"OVER":"BELUM_CONFIG":h>g?"OVER":h===g?"PENUH":"TERSEDIA"}})}async function E(a){let b=await (0,h.n)(m);if("error"in b)return b;if(!((0,i.qc)(b)||(0,i.pX)(b,["sekpen","pengurus_asrama","bendahara"])))return{error:"Akses ditolak"};let c=Number(a?.tahunTagihan??new Date().getFullYear()),d=await B(b,a),e=await C(d,c),f=await D(),g=q.reduce((a,b)=>({...a,[b]:0}),{});return d.forEach(a=>{g[x(a.status)]+=1}),{rows:d.map(a=>({...a,status:x(a.status),tahun_masuk_fix:e.get(a.id)?.tahunMasuk??z(a),pembayaran:e.get(a.id)??null})),summary:g,asramaStats:f,asramaList:p,sekolahList:o,user:{roles:b.roles,role:b.role,asrama_binaan:b.asrama_binaan,canSekretariat:s(b),canPenempatan:t(b),canKamar:u(b),canBayar:v(b)}}}async function F(a){let b=await (0,h.n)(n);if("error"in b)return b;let c=await B(b,a),d=q.reduce((a,b)=>({...a,[b]:0}),{});return c.forEach(a=>{d[x(a.status)]+=1}),{rows:c.map(a=>({...a,status:x(a.status),tahun_masuk_fix:z(a)})),summary:d,asramaList:p,sekolahList:o}}async function G(){let a=`PSB-${(0,j.Ec)().replace(/-/g,"")}`;for(let b=1;b<=9999;b+=1){let c=`${a}-${String(b).padStart(4,"0")}`;if(!await (0,j.Zy)("SELECT id FROM santri WHERE nis = ?",[c]))return c}return`${a}-${(0,j.$C)().slice(0,8).toUpperCase()}`}async function H(a){let b=await (0,h.n)(m,"create");if("error"in b)return b;if(!s(b))return{error:"Akses ditolak"};await A();let c=String(a.nama_lengkap??"").trim();if(!c)return{error:"Nama santri wajib diisi"};let d="P"===a.jenis_kelamin?"P":"L",e=a.sekolah&&o.includes(a.sekolah)?a.sekolah:null,i=(0,j.$C)(),l=(0,j.$C)(),p=await G(),q=(0,j.Ec)(),r=Number(q.slice(0,4)),t=await (0,j.xA)();return await t.batch([t.prepare(`
      INSERT INTO santri (
        id, nis, nama_lengkap, jenis_kelamin, sekolah, tanggal_masuk, tahun_masuk,
        status_global, kategori_santri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', ?, datetime('now'), datetime('now'))
    `).bind(i,p,c,d,e,q,r,(0,k.Oh)("REGULER")),t.prepare(`
      INSERT INTO psb_flow (
        id, santri_id, status, verified_by, verified_at, created_by, created_at, updated_at
      ) VALUES (?, ?, 'VERIFIED', ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `).bind(l,i,b.id,b.id)]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"psb",action:"create",fiturHref:m,logKind:"create",entityType:"santri",entityId:i,entityLabel:c,summary:`Input santri dadakan PSB: ${c}`,details:{nis:p,jenis_kelamin:d,sekolah:e}}),(0,f.revalidatePath)(m),(0,f.revalidatePath)(n),{success:!0,santriId:i,nis:p}}async function I(a,b){let c=await (0,h.n)(m,"update");if("error"in c)return c;if(!s(c))return{error:"Akses ditolak"};await A();let d=await (0,j.Zy)("SELECT nama_lengkap FROM santri WHERE id = ? AND status_global = ?",[a,"aktif"]);return d?(await (0,j.g7)(`
    INSERT INTO psb_flow (id, santri_id, status, verification_note, verified_by, verified_at, created_by, created_at, updated_at)
    VALUES (?, ?, 'VERIFIED', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    ON CONFLICT(santri_id) DO UPDATE SET
      status = CASE WHEN psb_flow.status = 'VERIFICATION' THEN 'VERIFIED' ELSE psb_flow.status END,
      verification_note = excluded.verification_note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_at = excluded.updated_at
  `,[(0,j.$C)(),a,b?.trim()||null,c.id,c.id]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"psb",action:"update",fiturHref:m,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:d.nama_lengkap,summary:`Verifikasi PSB ${d.nama_lengkap}`,details:{note:b?.trim()||null}}),(0,f.revalidatePath)(m),(0,f.revalidatePath)(n),{success:!0}):{error:"Santri tidak ditemukan"}}async function J(a,b){let c=await (0,h.n)(m,"update");if("error"in c)return c;if(!t(c))return{error:"Akses ditolak"};await A();let d=String(b??"").trim().toUpperCase();if(!p.includes(d))return{error:"Asrama tidak valid"};let e=await (0,j.Zy)(`
    SELECT pf.status, s.nama_lengkap, s.asrama, s.kamar
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!e)return{error:"Santri tidak ditemukan"};if(!w(x(e.status),"VERIFIED"))return{error:"Santri belum diverifikasi sekretariat"};let i=await (0,j.xA)();return await i.batch([i.prepare("UPDATE santri SET asrama = ?, kamar = NULL, updated_at = datetime('now') WHERE id = ?").bind(d,a),i.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_asrama_by, placed_asrama_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_ASRAMA', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA') THEN 'PLACED_ASRAMA' ELSE psb_flow.status END,
        placed_asrama_by = excluded.placed_asrama_by,
        placed_asrama_at = excluded.placed_asrama_at,
        updated_at = excluded.updated_at
    `).bind((0,j.$C)(),a,c.id,c.id)]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"psb",action:"update",fiturHref:m,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:e.nama_lengkap,summary:`Menempatkan ${e.nama_lengkap} ke asrama ${d}`,details:{asrama_lama:e.asrama,kamar_lama:e.kamar,asrama_baru:d}}),(0,f.revalidatePath)(m),(0,f.revalidatePath)(n),{success:!0}}async function K(a){let b=await (0,h.n)(m);if("error"in b)return b;let c=String(a??"").trim().toUpperCase();return c?!(0,i.qc)(b)&&(0,i.hf)(b,"pengurus_asrama")&&b.asrama_binaan!==c?{error:"Anda hanya boleh melihat kamar asrama binaan Anda"}:(await A(),(0,j.P)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru, kc.blok,
           COUNT(s.id) AS terisi,
           (kc.kuota - COUNT(s.id)) AS slot_kosong,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif'
    WHERE kc.asrama = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
    ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar
  `,[c])):[]}async function L(a,b){let c=await (0,h.n)(m,"update");if("error"in c)return c;if(!u(c))return{error:"Akses ditolak"};await A();let d=String(b??"").trim();if(!d)return{error:"Kamar wajib dipilih"};let e=await (0,j.Zy)(`
    SELECT pf.status, s.nama_lengkap, s.asrama
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a]);if(!e)return{error:"Santri tidak ditemukan"};if(!e.asrama)return{error:"Santri belum ditempatkan ke asrama"};if(!w(x(e.status),"PLACED_ASRAMA"))return{error:"Santri belum masuk tahap kamar"};if(!(0,i.qc)(c)&&(0,i.hf)(c,"pengurus_asrama")&&c.asrama_binaan!==e.asrama)return{error:"Anda hanya boleh mengelola asrama binaan Anda"};if(!await (0,j.Zy)(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru,
           COUNT(s.id) AS terisi,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif' AND s.id <> ?
    WHERE kc.asrama = ? AND kc.nomor_kamar = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru
  `,[a,e.asrama,d]))return{error:"Kamar belum dikonfigurasi di asrama ini"};let k=await (0,j.xA)();return await k.batch([k.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ?").bind(d,a),k.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_kamar_by, placed_kamar_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_KAMAR', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR') THEN 'PLACED_KAMAR' ELSE psb_flow.status END,
        placed_kamar_by = excluded.placed_kamar_by,
        placed_kamar_at = excluded.placed_kamar_at,
        updated_at = excluded.updated_at
    `).bind((0,j.$C)(),a,c.id,c.id)]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"psb",action:"update",fiturHref:m,logKind:"update",entityType:"psb_flow",entityId:a,entityLabel:e.nama_lengkap,summary:`Menempatkan ${e.nama_lengkap} ke kamar ${d}`,details:{asrama:e.asrama,kamar:d}}),(0,f.revalidatePath)(m),(0,f.revalidatePath)(n),{success:!0}}async function M(){let a=`PSB/${(0,j.Ec)().replace(/-/g,"")}`,b=await (0,j.Zy)("SELECT COUNT(*) AS total FROM psb_payment_receipt WHERE receipt_no LIKE ?",[`${a}/%`]);return`${a}/${String(Number(b?.total??0)+1).padStart(4,"0")}`}async function N(a){let b=await (0,h.n)(m,"create");if("error"in b)return b;if(!v(b))return{error:"Akses ditolak"};await A();let c=Number(a.tahunTagihan||new Date().getFullYear()),d=a.items.filter(a=>["BANGUNAN","KESEHATAN","EHB","EKSKUL"].includes(a.jenis)).map(a=>({jenis:a.jenis,nominal:Number(a.nominal??0)}));if(!d.length)return{error:"Pilih minimal satu item pembayaran"};let e=await (0,j.Zy)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at, s.kategori_santri,
           'BARU' AS kategori_efektif, pf.id AS psb_flow_id, pf.status,
           pf.verification_note, pf.verified_at, pf.placed_asrama_at, pf.placed_kamar_at, pf.paid_at, pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `,[a.santriId]);if(!e)return{error:"Santri tidak ditemukan"};if(!w(x(e.status),"PLACED_KAMAR"))return{error:"Santri belum ditempatkan ke kamar"};let i=z(e),k=new Map((await (0,j.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[i])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])),l=await (0,j.P)("SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),o=l.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),p=Math.max(0,(k.get("BANGUNAN")??0)-o),q=[];for(let a of d){if("BANGUNAN"===a.jenis){let b=Math.trunc(a.nominal);if(b<=0)return{error:"Nominal bangunan wajib lebih dari 0"};if(b>p)return{error:"Nominal bangunan melebihi sisa tagihan"};q.push({jenis:"BANGUNAN",nominal:b,tahunTagihan:null,keterangan:"Pembayaran PSB - Bangunan"});continue}let b=k.get(a.jenis)??0;if(b<=0)return{error:`Tarif ${a.jenis} angkatan ${i} belum diatur`};if(l.some(b=>b.jenis_biaya===a.jenis&&Number(b.tahun_tagihan)===c))return{error:`${a.jenis} tahun ${c} sudah dibayar`};q.push({jenis:a.jenis,nominal:b,tahunTagihan:c,keterangan:`Pembayaran PSB - ${a.jenis} ${c}`})}let r=(0,j.$C)(),s=await M(),t=q.reduce((a,b)=>a+b.nominal,0),u=[...l.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan})),...q.map(a=>({jenis_biaya:a.jenis,tahun_tagihan:a.tahunTagihan}))],B=y({bangunanTarget:k.get("BANGUNAN")??0,bangunanPaid:o+q.filter(a=>"BANGUNAN"===a.jenis).reduce((a,b)=>a+b.nominal,0),tahunTagihan:c,payments:u})?"DONE":"PAID",C=await (0,j.xA)();await C.batch([C.prepare(`
      INSERT INTO psb_payment_receipt (id, receipt_no, santri_id, tahun_tagihan, total, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(r,s,a.santriId,c,t,b.id),...q.map(c=>C.prepare(`
        INSERT INTO pembayaran_tahunan (
          id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan, psb_receipt_id
        ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
      `).bind((0,j.$C)(),a.santriId,c.jenis,c.tahunTagihan,c.nominal,b.id,c.keterangan,r)),C.prepare(`
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
    `).bind((0,j.$C)(),a.santriId,B,b.id,b.id,B,b.id,B,B,B)]);try{await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"psb",action:"payment",fiturHref:m,logKind:"create",entityType:"psb_payment_receipt",entityId:r,entityLabel:s,summary:`Pembayaran PSB ${e.nama_lengkap}: ${s}`,details:{santri_id:a.santriId,receipt_no:s,total:t,items:q,status_after_payment:B}})}catch(a){console.error("Failed to write PSB payment activity log",a)}try{(0,f.revalidatePath)(m),(0,f.revalidatePath)(n)}catch(a){console.error("Failed to revalidate PSB pages after payment",a)}return{success:!0,receiptId:r,receiptNo:s,total:t,status:B}}async function O(a){let b=await (0,h.n)(m,"update");if("error"in b)return b;if(!(0,i.qc)(b)&&!(0,i.hf)(b,"bendahara"))return{error:"Akses ditolak"};let c=await (0,j.Zy)("SELECT status FROM psb_flow WHERE santri_id = ?",[a]);return c&&w(x(c.status),"PAID")?(await (0,j.g7)(`
    UPDATE psb_flow
    SET status = 'DONE', done_by = ?, done_at = datetime('now'), updated_at = datetime('now')
    WHERE santri_id = ?
  `,[b.id,a]),(0,f.revalidatePath)(m),(0,f.revalidatePath)(n),{success:!0}):{error:"Santri belum menyelesaikan pembayaran PSB"}}async function P(a){var b;let c=await (0,h.n)(m,"update");if("error"in c)return c;if(!(0,i.qc)(c)&&!(0,i.hf)(c,"bendahara"))return{error:"Akses ditolak"};await A();let d=await (0,j.Zy)(`
    SELECT r.id, r.santri_id, r.receipt_no, r.tahun_tagihan, s.nama_lengkap, s.tahun_masuk, s.tanggal_masuk, s.created_at
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    WHERE r.id = ?
  `,[a.receiptId]);if(!d)return{error:"Kuitansi pembayaran tidak ditemukan"};if(d.santri_id!==a.santriId)return{error:"Kuitansi tidak cocok dengan santri"};let e=await (0,j.Zy)(`SELECT id
     FROM psb_payment_receipt
     WHERE santri_id = ?
     ORDER BY datetime(created_at) DESC, created_at DESC
     LIMIT 1`,[a.santriId]);if(!e||e.id!==a.receiptId)return{error:"Hanya pembayaran terakhir yang bisa dibatalkan"};await (0,j.g7)("DELETE FROM pembayaran_tahunan WHERE psb_receipt_id = ?",[a.receiptId]),await (0,j.g7)("DELETE FROM psb_payment_receipt WHERE id = ?",[a.receiptId]);let k=await (0,j.P)("SELECT jenis_biaya, tahun_tagihan, nominal_bayar FROM pembayaran_tahunan WHERE santri_id = ?",[a.santriId]),l=z(d),o=y(b={bangunanTarget:new Map((await (0,j.P)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[l])).map(a=>[a.jenis_biaya,Number(a.nominal??0)])).get("BANGUNAN")??0,bangunanPaid:k.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+Number(b.nominal_bayar??0),0),tahunTagihan:Number(d.tahun_tagihan??new Date().getFullYear()),payments:k.map(a=>({jenis_biaya:a.jenis_biaya,tahun_tagihan:a.tahun_tagihan}))})?"DONE":b.payments.length>0?"PAID":"PLACED_KAMAR";await (0,j.g7)(`
    UPDATE psb_flow
    SET status = ?,
        paid_by = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_by END,
        paid_at = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_at END,
        done_by = CASE WHEN ? = 'DONE' THEN done_by ELSE NULL END,
        done_at = CASE WHEN ? = 'DONE' THEN done_at ELSE NULL END,
        updated_at = datetime('now')
    WHERE santri_id = ?
  `,[o,o,o,o,o,a.santriId]);try{await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"psb",action:"payment_cancel",fiturHref:m,logKind:"delete",entityType:"psb_payment_receipt",entityId:a.receiptId,entityLabel:d.receipt_no,summary:`Pembayaran PSB dibatalkan ${d.nama_lengkap}: ${d.receipt_no}`,details:{santri_id:a.santriId,receipt_no:d.receipt_no,status_after_cancel:o}})}catch(a){console.error("Failed to write PSB payment cancellation log",a)}try{(0,f.revalidatePath)(m),(0,f.revalidatePath)(n)}catch(a){console.error("Failed to revalidate PSB pages after cancellation",a)}return{success:!0,status:o}}async function Q(a){let b=await (0,i.Ht)();if(!b)return{error:"Tidak terautentikasi"};if(!(0,i.pX)(b,["admin","bendahara","sekpen"]))return{error:"Akses ditolak"};await A();let c=await (0,j.Zy)(`
    SELECT r.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, u.full_name AS penerima_nama
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `,[a]);return c?{receipt:c,items:await (0,j.P)(`
    SELECT jenis_biaya, tahun_tagihan, nominal_bayar, keterangan, tanggal_bayar
    FROM pembayaran_tahunan
    WHERE psb_receipt_id = ?
    ORDER BY jenis_biaya
  `,[a])}:{error:"Kuitansi tidak ditemukan"}}(0,l.D)([E,F,H,I,J,K,L,N,O,P,Q]),(0,e.A)(E,"4031a11a5df0ae251e1172ac82af78ca5f17d812cb",null),(0,e.A)(F,"40265d817ab333c12c992a6847f686c36800e5c369",null),(0,e.A)(H,"40a7acab8751f876180f8b77d60ca51fe9ac5f0d6a",null),(0,e.A)(I,"6067f808d9855bca14a3fcc21a7ba809c012e24c3c",null),(0,e.A)(J,"60969f13652dd59713438731f8e3684f9cd8f57478",null),(0,e.A)(K,"40ad4a5a3fbeb42a563e975146809bf16cc903be8d",null),(0,e.A)(L,"60177ae0e1b8b6698294d43ada229d4c55c001ad0c",null),(0,e.A)(N,"40032945b4706d8bd0dd3b32180117b651c567e86e",null),(0,e.A)(O,"4006310e257e55e95d3a60d83ede8f19d1a83fe7da",null),(0,e.A)(P,"4063179fe44179e94526fda8221d282de5d9462c48",null),(0,e.A)(Q,"404773618dae163945d77bb09a542bb15c51ec3a48",null)},40560:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(47408).A)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},67597:(a,b,c)=>{function d(a){return"SADESA"===String(a??"").trim().toUpperCase()?"SADESA":"REGULER"}function e(a="s"){return`CASE
    WHEN ${a}.status_global = 'aktif'
      AND ${a}.created_at IS NOT NULL
      AND date(${a}.created_at) >= date(COALESCE((SELECT value FROM app_settings WHERE key = 'santri_baru_mulai_berlaku'), '2026-07-01'))
      AND datetime(${a}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE((SELECT value FROM app_settings WHERE key = 'santri_baru_durasi_bulan'), '3') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${a}.kategori_santri, ''), 'REGULER')
  END`}c.d(b,{Oh:()=>d,kM:()=>e}),c(44916)},92735:(a,b,c)=>{c.d(b,{DashboardPageHeader:()=>d});let d=(0,c(77943).registerClientReference)(function(){throw Error("Attempted to call DashboardPageHeader() from the server but DashboardPageHeader is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"C:\\DATA\\eskahade\\components\\dashboard\\page-header.tsx","DashboardPageHeader")}};