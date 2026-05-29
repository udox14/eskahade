module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},6846,a=>{"use strict";var b=a.i(5246),c=a.i(12259);let d=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),e=null,f=new Map;function g(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function h(a){return null==a?null:"string"==typeof a?g(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(h):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!d.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,h(b)])):String(a)}function i(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function j(){try{let a=await (0,b.headers)(),c=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(c?c.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function k(){e||(e=(async()=>{await (0,c.execute)(`
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
      `),await (0,c.execute)(`
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
      `),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)");try{await (0,c.execute)(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `),await (0,c.execute)(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)}catch{}})().catch(a=>{throw e=null,a})),await e}async function l(a,b){if(!a||!b)return!0;let d=`${a}:${b}`,e=f.get(d);if(e&&e.expiresAt>Date.now())return e.values[b];await k();let g=await (0,c.queryOne)(`SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]),h=g?{create:1===g.log_create,update:1===g.log_update,delete:1===g.log_delete}:{create:!0,update:!0,delete:!0},i=Date.now()+6e4;return f.set(`${a}:create`,{expiresAt:i,values:h}),f.set(`${a}:update`,{expiresAt:i,values:h}),f.set(`${a}:delete`,{expiresAt:i,values:h}),h[b]}async function m(){return await k(),(0,c.query)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`)}async function n(a,b,d){await k();let e=await (0,c.queryOne)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]);if(!e)throw Error("Konfigurasi log fitur tidak ditemukan.");let g={create:b.create??1===e.log_create,update:b.update??1===e.log_update,delete:b.delete??1===e.log_delete};await (0,c.execute)(`UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,[+!!g.create,+!!g.update,+!!g.delete,d,a]);let h=Date.now()+6e4,i={create:g.create,update:g.update,delete:g.delete};f.set(`${a}:create`,{expiresAt:h,values:i}),f.set(`${a}:update`,{expiresAt:h,values:i}),f.set(`${a}:delete`,{expiresAt:h,values:i})}async function o(a){try{var b,d;if(await k(),!await l(a.fiturHref,a.logKind))return;let e=a.requestInfo??await j(),f=a.actor??null;await (0,c.execute)(`INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},3525,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/akademik/upk/kasir";function j(a){let b=parseInt(String(a??"0"),10);return Number.isFinite(b)?b:0}async function k(a,b,c){if(b<=0)return;let f=await (0,d.queryOne)("SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?",[a]);if(!f)return;let g=Math.min(f.stok_lama||0,b),h=Math.min(f.stok_baru||0,b-g);await (0,d.execute)("UPDATE upk_katalog SET stok_lama = stok_lama - ?, stok_baru = stok_baru - ?, stok_updated_at = ?, updated_at = ? WHERE id = ?",[g,h,(0,d.now)(),(0,d.now)(),a]),await (0,d.execute)(`
    INSERT INTO upk_stok_mutasi
      (id, katalog_id, antrian_id, antrian_item_id, tanggal, unit, tipe, qty_lama, qty_baru, total_qty, catatan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENJUALAN', ?, ?, ?, ?, ?, ?)
  `,[(0,d.generateId)(),a,c.antrianId,c.itemId,(0,d.today)(),c.unit,g,h,g+h,c.catatan,(await (0,e.getSession)())?.id??null,(0,d.now)()])}async function l(a,b){let c=b.trim();return c.length<2?[]:(0,d.query)(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar,
           k.id AS kelas_id, k.nama_kelas, k.marhalah_id,
           m.nama AS marhalah_nama
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE s.status_global = 'aktif'
      AND s.jenis_kelamin = ?
      AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
    ORDER BY s.nama_lengkap
    LIMIT 12
  `,["PUTRA"===a?"L":"P",`%${c}%`,`%${c}%`])}async function m(a){return(await (0,d.query)(`
    SELECT uk.id, uk.nama_kitab, uk.marhalah_id, uk.stok_lama, uk.stok_baru,
           uk.harga_jual, uk.is_active,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           t.nama AS toko_nama
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE uk.is_active = 1
    ORDER BY
      CASE WHEN uk.marhalah_id = ? THEN 0 ELSE 1 END,
      m.urutan, uk.nama_kitab
  `,[a??-1])).map(b=>({...b,jumlah_stok:(b.stok_lama||0)+(b.stok_baru||0),is_default:!!a&&b.marhalah_id===a}))}async function n(a){let b=await (0,e.getSession)();if(!a.santri?.id)return{error:"Pilih santri dulu."};if(!a.items.length)return{error:"Pilih minimal satu kitab."};let c=(0,d.today)(),h=await (0,d.queryOne)("SELECT MAX(nomor) AS nomor FROM upk_antrian WHERE tanggal = ? AND unit = ?",[c,a.unit]),k=(h?.nomor||0)+1,l=(0,d.generateId)(),m=a.items.reduce((a,b)=>a+Math.max(1,j(b.qty))*Math.max(0,j(b.hargaJual)),0);for(let e of(await (0,d.execute)(`
    INSERT INTO upk_antrian
      (id, tanggal, nomor, unit, santri_id, nis, nama_santri, kelas_id, kelas_nama,
       marhalah_id, marhalah_nama, total_tagihan, status, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ANTRIAN', ?, ?, ?, ?)
  `,[l,c,k,a.unit,a.santri.id,a.santri.nis,a.santri.nama_lengkap,a.santri.kelas_id,a.santri.nama_kelas,a.santri.marhalah_id,a.santri.marhalah_nama,m,a.catatan?.trim()||null,b?.id??null,(0,d.now)(),(0,d.now)()]),a.items)){let a=Math.max(1,j(e.qty)),b=Math.max(0,j(e.hargaJual));await (0,d.execute)(`
      INSERT INTO upk_antrian_item
        (id, antrian_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, harga_jual, subtotal, status_serah, masuk_pesanan, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUDAH', 0, ?, ?)
    `,[(0,d.generateId)(),l,e.katalogId,e.namaKitab,e.marhalahId,e.marhalahNama,a,b,a*b,(0,d.now)(),(0,d.now)()])}return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_kasir",action:"create",fiturHref:"/dashboard/akademik/upk/kasir",logKind:"create",entityType:"upk_antrian",entityId:l,entityLabel:a.santri.nama_lengkap,summary:`Membuat antrian UPK untuk ${a.santri.nama_lengkap}`,details:{nomor:k,unit:a.unit,total_item:a.items.length,total_tagihan:m}}),(0,g.revalidatePath)(i),{success:!0,id:l,nomor:k}}async function o(a,b=""){let c=[(0,d.today)(),a],e="WHERE a.tanggal = ? AND a.unit = ? AND a.status = 'ANTRIAN'";if(b.trim()){e+=" AND (a.nama_santri LIKE ? OR a.nis LIKE ? OR CAST(a.nomor AS TEXT) LIKE ?)";let a=`%${b.trim()}%`;c.push(a,a,a)}return await (0,d.query)(`
    SELECT a.*, COUNT(ai.id) AS total_item
    FROM upk_antrian a
    LEFT JOIN upk_antrian_item ai ON ai.antrian_id = a.id
    ${e}
    GROUP BY a.id
    ORDER BY a.nomor ASC
    LIMIT 50
  `,c)}async function p(a){let b=await (0,d.queryOne)("SELECT * FROM upk_antrian WHERE id = ?",[a]);if(!b)return null;let c=await (0,d.query)(`
    SELECT ai.*, uk.stok_lama, uk.stok_baru
    FROM upk_antrian_item ai
    LEFT JOIN upk_katalog uk ON uk.id = ai.katalog_id
    WHERE ai.antrian_id = ?
    ORDER BY ai.nama_kitab
  `,[a]);return{...b,items:c.map(a=>({...a,jumlah_stok:(a.stok_lama||0)+(a.stok_baru||0)}))}}async function q(a){let b=await (0,e.getSession)(),c=await (0,d.queryOne)("SELECT * FROM upk_antrian WHERE id = ?",[a.antrianId]);if(!c)return{error:"Antrian tidak ditemukan."};if("ANTRIAN"!==c.status)return{error:"Antrian ini sudah diproses."};let h=await (0,d.query)("SELECT * FROM upk_antrian_item WHERE antrian_id = ?",[a.antrianId]),l=new Map(a.items.map(a=>[a.itemId,a])),m=0;for(let a of h){let b=l.get(a.id),c=Math.max(1,j(b?.qty??a.qty));if((b?.diserahkan??!0)&&a.katalog_id){let b=await (0,d.queryOne)("SELECT stok_lama, stok_baru FROM upk_katalog WHERE id = ?",[a.katalog_id]);if((b?.stok_lama||0)+(b?.stok_baru||0)<c)return{error:`Stok ${a.nama_kitab} tidak cukup. Tandai belum diserahkan agar masuk Pesanan.`}}}for(let b of h){let e=l.get(b.id),f=Math.max(1,j(e?.qty??b.qty)),g=f*j(b.harga_jual),h=e?.diserahkan??!0;m+=g,await (0,d.execute)(`
      UPDATE upk_antrian_item
      SET qty = ?, subtotal = ?, status_serah = ?, masuk_pesanan = ?, updated_at = ?
      WHERE id = ?
    `,[f,g,h?"SUDAH":"BELUM",+!h,(0,d.now)(),b.id]),h&&b.katalog_id&&await k(b.katalog_id,f,{antrianId:a.antrianId,itemId:b.id,unit:a.unit,catatan:`Penjualan antrian ${String(c.nomor).padStart(3,"0")}`})}let n=Math.max(0,j(a.totalBayar)),o=n-m,p=o>0&&a.kembalianDitahan?o:0,q=o<0?Math.abs(o):0;return await (0,d.execute)(`
    UPDATE upk_antrian
    SET total_tagihan = ?, total_bayar = ?, sisa_kembalian = ?, kembalian_ditahan = ?,
        sisa_tunggakan = ?, status = 'SELESAI', cashier_by = ?, paid_at = ?, updated_at = ?
    WHERE id = ?
  `,[m,n,p,+!!a.kembalianDitahan,q,b?.id??null,(0,d.now)(),(0,d.now)(),a.antrianId]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_kasir",action:"payment",fiturHref:"/dashboard/akademik/upk/kasir",logKind:"update",entityType:"upk_antrian",entityId:a.antrianId,entityLabel:c.nama_santri,summary:`Menyelesaikan antrian UPK ${String(c.nomor).padStart(3,"0")}`,details:{unit:a.unit,total_item:h.length,total_tagihan:m,total_bayar:n,sisa_tunggakan:q,sisa_kembalian:p,kembalian_ditahan:a.kembalianDitahan}}),(0,g.revalidatePath)(i),(0,g.revalidatePath)("/dashboard/akademik/upk/pesanan"),{success:!0}}(0,h.ensureServerEntryExports)([l,m,n,o,p,q]),(0,c.registerServerReference)(l,"60c06551b307438f59779e27ecec69ad2bfeabbcd9",null),(0,c.registerServerReference)(m,"4057cc687a544ce7b4a75f6a6fd67a917a34bca6b4",null),(0,c.registerServerReference)(n,"4024aaf248d42aaf9844212ccae488c52b29816f74",null),(0,c.registerServerReference)(o,"6024bbec6c6570241083fae022e9370dfa0af575a1",null),(0,c.registerServerReference)(p,"406e795f606d12a829f4042c341159e21b618c4500",null),(0,c.registerServerReference)(q,"40ba123c1b3f6bec10178aedb56e1cb420c46274ec",null),a.s([],33287),a.i(33287),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"4024aaf248d42aaf9844212ccae488c52b29816f74",()=>n,"4057cc687a544ce7b4a75f6a6fd67a917a34bca6b4",()=>m,"406e795f606d12a829f4042c341159e21b618c4500",()=>p,"40ba123c1b3f6bec10178aedb56e1cb420c46274ec",()=>q,"6024bbec6c6570241083fae022e9370dfa0af575a1",()=>o,"60c06551b307438f59779e27ecec69ad2bfeabbcd9",()=>l],3525)}];

//# sourceMappingURL=_4bdfdfda._.js.map