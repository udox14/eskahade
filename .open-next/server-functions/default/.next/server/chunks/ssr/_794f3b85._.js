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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},36142,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/akademik/upk/pemasukan";function j(a){let b=parseInt(String(a??"0"),10);return Number.isFinite(b)?b:0}async function k(a=(0,d.today)()){let b=await (0,d.queryOne)(`
    SELECT
      COUNT(*) AS total_transaksi,
      COALESCE(SUM(total_tagihan), 0) AS total_tagihan,
      COALESCE(SUM(total_bayar), 0) AS total_bayar,
      COALESCE(SUM(sisa_tunggakan), 0) AS total_tunggakan,
      COALESCE(SUM(sisa_kembalian), 0) AS total_kembalian_ditahan
    FROM upk_antrian
    WHERE tanggal = ? AND status = 'SELESAI'
  `,[a]),c=await (0,d.queryOne)(`
    SELECT
      COALESCE(SUM(CASE WHEN kategori = 'SETORAN_PENJUALAN' THEN nominal ELSE 0 END), 0) AS total_setoran,
      COALESCE(SUM(CASE WHEN kategori = 'PINJAMAN_MODAL' THEN nominal ELSE 0 END), 0) AS total_pinjaman,
      COALESCE(SUM(CASE WHEN kategori = 'LAINNYA' THEN nominal ELSE 0 END), 0) AS total_lainnya
    FROM upk_pemasukan
    WHERE tanggal = ?
  `,[a]),e=j(b?.total_bayar),f=j(c?.total_setoran);return{tanggal:a,total_transaksi:j(b?.total_transaksi),total_tagihan:j(b?.total_tagihan),total_bayar:e,total_tunggakan:j(b?.total_tunggakan),total_kembalian_ditahan:j(b?.total_kembalian_ditahan),total_setoran:f,total_pinjaman:j(c?.total_pinjaman),total_lainnya:j(c?.total_lainnya),sisa_belum_direkap:Math.max(0,e-f),selisih:f-e}}async function l(a=(0,d.today)()){return(0,d.query)(`
    SELECT p.*, u.full_name AS user_name
    FROM upk_pemasukan p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.tanggal = ?
    ORDER BY p.waktu_catat DESC, p.created_at DESC
  `,[a])}async function m(a){var b;let c=await (0,e.getSession)(),h=a.id?.trim(),k=a.tanggal||(0,d.today)(),l="PINJAMAN_MODAL"===(b=a.kategori)||"LAINNYA"===b?b:"SETORAN_PENJUALAN",m=Math.max(0,j(a.nominal)),n="SETORAN_PENJUALAN"===l?Math.max(0,j(a.penjualanSeharusnya)):0,o="SETORAN_PENJUALAN"===l?m-n:0;if(m<=0)return{error:"Nominal pemasukan harus lebih dari 0."};if(h)await (0,d.execute)(`
      UPDATE upk_pemasukan
      SET tanggal = ?, kategori = ?, sumber = ?, nominal = ?, penjualan_seharusnya = ?, selisih = ?,
          catatan = ?, updated_at = ?
      WHERE id = ?
    `,[k,l,a.sumber?.trim()||null,m,n,o,a.catatan?.trim()||null,(0,d.now)(),h]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_upk_pemasukan",action:"update",fiturHref:"/dashboard/akademik/upk/pemasukan",logKind:"update",entityType:"upk_pemasukan",entityId:h,entityLabel:a.sumber?.trim()||l,summary:`Memperbarui pemasukan UPK ${l}`,details:{tanggal:k,kategori:l,nominal:m,penjualan_seharusnya:n,selisih:o}});else{let b=(0,d.generateId)();await (0,d.execute)(`
      INSERT INTO upk_pemasukan
        (id, tanggal, waktu_catat, kategori, sumber, nominal, penjualan_seharusnya,
         selisih, catatan, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[b,k,(0,d.now)(),l,a.sumber?.trim()||null,m,n,o,a.catatan?.trim()||null,c?.id??null,(0,d.now)(),(0,d.now)()]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_upk_pemasukan",action:"create",fiturHref:"/dashboard/akademik/upk/pemasukan",logKind:"create",entityType:"upk_pemasukan",entityId:b,entityLabel:a.sumber?.trim()||l,summary:`Menambahkan pemasukan UPK ${l}`,details:{tanggal:k,kategori:l,nominal:m,penjualan_seharusnya:n,selisih:o}})}return(0,g.revalidatePath)(i),{success:!0}}async function n(a){let b=await (0,e.getSession)();if(!a)return{error:"Data pemasukan tidak valid."};let c=await (0,d.queryOne)("SELECT id, kategori, sumber, nominal FROM upk_pemasukan WHERE id = ?",[a]);return await (0,d.execute)("DELETE FROM upk_pemasukan WHERE id = ?",[a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_pemasukan",action:"delete",fiturHref:"/dashboard/akademik/upk/pemasukan",logKind:"delete",entityType:"upk_pemasukan",entityId:a,entityLabel:c?.sumber??c?.kategori??a,summary:`Menghapus pemasukan UPK ${c?.kategori??""}`.trim(),details:{nominal:c?.nominal??null}}),(0,g.revalidatePath)(i),{success:!0}}(0,h.ensureServerEntryExports)([k,l,m,n]),(0,c.registerServerReference)(k,"409048306df911b6ce014b0ce632508b53ddf9abee",null),(0,c.registerServerReference)(l,"40eb4ffa03b8136836ec6a270b9acc7652609ff6d1",null),(0,c.registerServerReference)(m,"40c86077e251e23225ccc17c3fb116c40b22daeacc",null),(0,c.registerServerReference)(n,"40ea088ef686eba4509a3f7d9f85a29a1d02eb4aaf",null),a.s([],94878),a.i(94878),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"409048306df911b6ce014b0ce632508b53ddf9abee",()=>k,"40c86077e251e23225ccc17c3fb116c40b22daeacc",()=>m,"40ea088ef686eba4509a3f7d9f85a29a1d02eb4aaf",()=>n,"40eb4ffa03b8136836ec6a270b9acc7652609ff6d1",()=>l],36142)}];

//# sourceMappingURL=_794f3b85._.js.map