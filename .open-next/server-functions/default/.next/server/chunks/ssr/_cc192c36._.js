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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},80589,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/akademik/upk/pengeluaran",j="/dashboard/akademik/upk/belanja";function k(a){let b=parseInt(String(a??"0"),10);return Number.isFinite(b)?b:0}async function l(a,b){var c;let e=await (0,d.queryOne)("SELECT * FROM upk_belanja WHERE id = ?",[a]);if(!e)return{error:"Data hutang toko tidak ditemukan."};let f=k(e.dibayar)+b;if(f<0)return{error:"Pembayaran hutang toko tidak boleh kurang dari 0."};if(f>k(e.total))return{error:"Nominal melebihi sisa hutang toko."};let g=Math.max(0,k(e.total)-f);return await (0,d.execute)("UPDATE upk_belanja SET dibayar = ?, sisa_hutang = ?, status_pembayaran = ?, updated_at = ? WHERE id = ?",[f,g,(c=k(e.total),f<=0?"HUTANG":f>=c?"LUNAS":"SEBAGIAN"),(0,d.now)(),a]),{success:!0}}async function m(a=(0,d.today)()){let b=await (0,d.queryOne)(`
    SELECT
      COALESCE(SUM(nominal), 0) AS total,
      COALESCE(SUM(CASE WHEN kategori = 'KONSUMSI' THEN nominal ELSE 0 END), 0) AS konsumsi,
      COALESCE(SUM(CASE WHEN kategori = 'TRANSPORT' THEN nominal ELSE 0 END), 0) AS transport,
      COALESCE(SUM(CASE WHEN kategori = 'BAYAR_HUTANG_TOKO' THEN nominal ELSE 0 END), 0) AS hutang_toko,
      COALESCE(SUM(CASE WHEN kategori = 'BAYAR_PINJAMAN_MODAL' THEN nominal ELSE 0 END), 0) AS hutang_modal,
      COALESCE(SUM(CASE WHEN kategori = 'ROYALTI_PENULIS' THEN nominal ELSE 0 END), 0) AS royalti
    FROM upk_pengeluaran
    WHERE tanggal = ?
  `,[a]),c=await (0,d.queryOne)("SELECT COALESCE(SUM(sisa_hutang), 0) AS total FROM upk_belanja WHERE sisa_hutang > 0",[]),e=await (0,d.queryOne)(`
    SELECT
      COALESCE((SELECT SUM(nominal) FROM upk_pemasukan WHERE kategori = 'PINJAMAN_MODAL'), 0)
      - COALESCE((SELECT SUM(nominal) FROM upk_pengeluaran WHERE kategori = 'BAYAR_PINJAMAN_MODAL'), 0)
      AS total
  `,[]);return{tanggal:a,total:k(b?.total),konsumsi:k(b?.konsumsi),transport:k(b?.transport),hutang_toko:k(b?.hutang_toko),hutang_modal:k(b?.hutang_modal),royalti:k(b?.royalti),sisa_hutang_toko:k(c?.total),sisa_hutang_modal:Math.max(0,k(e?.total))}}async function n(a=(0,d.today)()){return(0,d.query)(`
    SELECT p.*, u.full_name AS user_name
    FROM upk_pengeluaran p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.tanggal = ?
    ORDER BY p.waktu_catat DESC, p.created_at DESC
  `,[a])}async function o(){return(0,d.query)(`
    SELECT id, tanggal, jenis, toko_nama, total, dibayar, sisa_hutang
    FROM upk_belanja
    WHERE sisa_hutang > 0
    ORDER BY tanggal ASC, created_at ASC
  `,[])}async function p(){return(0,d.query)(`
    SELECT
      COALESCE(p.sumber, 'Tanpa nama') AS sumber,
      COALESCE(SUM(p.nominal), 0) AS total_pinjaman,
      COALESCE((
        SELECT SUM(pg.nominal)
        FROM upk_pengeluaran pg
        WHERE pg.kategori = 'BAYAR_PINJAMAN_MODAL'
          AND COALESCE(pg.penerima, 'Tanpa nama') = COALESCE(p.sumber, 'Tanpa nama')
      ), 0) AS total_dibayar,
      COALESCE(SUM(p.nominal), 0) - COALESCE((
        SELECT SUM(pg.nominal)
        FROM upk_pengeluaran pg
        WHERE pg.kategori = 'BAYAR_PINJAMAN_MODAL'
          AND COALESCE(pg.penerima, 'Tanpa nama') = COALESCE(p.sumber, 'Tanpa nama')
      ), 0) AS sisa
    FROM upk_pemasukan p
    WHERE p.kategori = 'PINJAMAN_MODAL'
    GROUP BY COALESCE(p.sumber, 'Tanpa nama')
    HAVING sisa > 0
    ORDER BY sumber
  `,[])}async function q(){return(0,d.query)(`
    SELECT uk.id, uk.nama_kitab, m.nama AS marhalah_nama
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    WHERE uk.is_active = 1
    ORDER BY m.urutan, uk.nama_kitab
  `,[])}async function r(a){var b;let c=await (0,e.getSession)(),h=a.id?.trim(),m=a.tanggal||(0,d.today)(),n="KONSUMSI"===(b=a.kategori)||"TRANSPORT"===b||"BAYAR_HUTANG_TOKO"===b||"BAYAR_PINJAMAN_MODAL"===b||"ROYALTI_PENULIS"===b||"OPERASIONAL"===b?b:"LAINNYA",o=Math.max(0,k(a.nominal)),p="BAYAR_HUTANG_TOKO"===n&&a.belanjaId?.trim()||null,q="ROYALTI_PENULIS"===n&&k(a.katalogId)||null,r="ROYALTI_PENULIS"===n&&a.namaKitab?.trim()||null;if(o<=0)return{error:"Nominal pengeluaran harus lebih dari 0."};if("BAYAR_HUTANG_TOKO"===n&&!p)return{error:"Pilih hutang toko yang dibayar."};if("BAYAR_PINJAMAN_MODAL"===n&&!a.penerima?.trim())return{error:"Pilih atau isi pemberi pinjaman."};if("ROYALTI_PENULIS"===n&&!a.penerima?.trim())return{error:"Nama penulis/penerima wajib diisi."};let s=h?await (0,d.queryOne)("SELECT id, kategori, nominal, belanja_id FROM upk_pengeluaran WHERE id = ?",[h]):null;if(s?.kategori==="BAYAR_HUTANG_TOKO"&&s.belanja_id){let a=await l(s.belanja_id,-k(s.nominal));if("error"in a)return a}if("BAYAR_HUTANG_TOKO"===n&&p){let a=await l(p,o);if("error"in a)return s?.kategori==="BAYAR_HUTANG_TOKO"&&s.belanja_id&&await l(s.belanja_id,k(s.nominal)),a}if(h)await (0,d.execute)(`
      UPDATE upk_pengeluaran
      SET tanggal = ?, kategori = ?, penerima = ?, nominal = ?, belanja_id = ?,
          katalog_id = ?, nama_kitab = ?, catatan = ?, updated_at = ?
      WHERE id = ?
    `,[m,n,a.penerima?.trim()||null,o,p,q,r,a.catatan?.trim()||null,(0,d.now)(),h]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_upk_pengeluaran",action:"update",fiturHref:"/dashboard/akademik/upk/pengeluaran",logKind:"update",entityType:"upk_pengeluaran",entityId:h,entityLabel:a.penerima?.trim()||n,summary:`Memperbarui pengeluaran UPK ${n}`,details:{tanggal:m,kategori:n,nominal:o,penerima:a.penerima?.trim()||null,belanja_id:p,nama_kitab:r}});else{let b=(0,d.generateId)();await (0,d.execute)(`
      INSERT INTO upk_pengeluaran
        (id, tanggal, waktu_catat, kategori, penerima, nominal, belanja_id,
         katalog_id, nama_kitab, catatan, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[b,m,(0,d.now)(),n,a.penerima?.trim()||null,o,p,q,r,a.catatan?.trim()||null,c?.id??null,(0,d.now)(),(0,d.now)()]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_upk_pengeluaran",action:"create",fiturHref:"/dashboard/akademik/upk/pengeluaran",logKind:"create",entityType:"upk_pengeluaran",entityId:b,entityLabel:a.penerima?.trim()||n,summary:`Menambahkan pengeluaran UPK ${n}`,details:{tanggal:m,kategori:n,nominal:o,penerima:a.penerima?.trim()||null,belanja_id:p,nama_kitab:r}})}return(0,g.revalidatePath)(i),(0,g.revalidatePath)(j),{success:!0}}async function s(a){let b=await (0,e.getSession)();if(!a)return{error:"Data pengeluaran tidak valid."};let c=await (0,d.queryOne)("SELECT id, kategori, nominal, belanja_id FROM upk_pengeluaran WHERE id = ?",[a]);if(!c)return{error:"Data pengeluaran tidak ditemukan."};if("BAYAR_HUTANG_TOKO"===c.kategori&&c.belanja_id){let a=await l(c.belanja_id,-k(c.nominal));if("error"in a)return a}return await (0,d.execute)("DELETE FROM upk_pengeluaran WHERE id = ?",[a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_pengeluaran",action:"delete",fiturHref:"/dashboard/akademik/upk/pengeluaran",logKind:"delete",entityType:"upk_pengeluaran",entityId:a,entityLabel:c.kategori,summary:`Menghapus pengeluaran UPK ${c.kategori}`,details:{nominal:c.nominal,belanja_id:c.belanja_id}}),(0,g.revalidatePath)(i),(0,g.revalidatePath)(j),{success:!0}}(0,h.ensureServerEntryExports)([m,n,o,p,q,r,s]),(0,c.registerServerReference)(m,"404fba619dd8eabfbcccc1b78bdf84cc03289cbb9f",null),(0,c.registerServerReference)(n,"40ecc8ba250180c97c308c89ea3866a32f0c9263e9",null),(0,c.registerServerReference)(o,"000af19d4580c499cf822c4fa01b038bd047018632",null),(0,c.registerServerReference)(p,"00ba1935109cdb8e70cfd464ed5961fa881b6eecdd",null),(0,c.registerServerReference)(q,"006bfed9deccba8b86aa43b3215a364b74ce41ff75",null),(0,c.registerServerReference)(r,"401690f4cd394bd94ed9df7ecca4664cd5a4c4c6d1",null),(0,c.registerServerReference)(s,"407046e0f41ff110618ef97ec7f45b8632e8fa6f00",null),a.s([],87108),a.i(87108),a.s(["000af19d4580c499cf822c4fa01b038bd047018632",()=>o,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"006bfed9deccba8b86aa43b3215a364b74ce41ff75",()=>q,"00ba1935109cdb8e70cfd464ed5961fa881b6eecdd",()=>p,"401690f4cd394bd94ed9df7ecca4664cd5a4c4c6d1",()=>r,"404fba619dd8eabfbcccc1b78bdf84cc03289cbb9f",()=>m,"407046e0f41ff110618ef97ec7f45b8632e8fa6f00",()=>s,"40ecc8ba250180c97c308c89ea3866a32f0c9263e9",()=>n],80589)}];

//# sourceMappingURL=_cc192c36._.js.map