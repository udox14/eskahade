module.exports=[59398,a=>{"use strict";var b=a.i(12259),c=a.i(53058);function d(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function e(){try{return(await (0,b.query)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(d)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function f(a,d,e){if(!a)return!1;if((0,c.isAdmin)(a))return!0;let f=(0,c.getEffectiveRoles)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,b.queryOne)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===e?"can_create":"update"===e?"can_update":"can_delete"} = 1
       LIMIT 1`,[d,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function g(a,b){return f(await (0,c.getSession)(),a,b)}async function h(a,b){let d=await (0,c.getSession)(),e=await f(d,a,b);return d?e?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertCrud",()=>h,"canCrud",()=>g,"canCrudForSession",()=>f,"getCrudPermissionsForAdmin",()=>e])},4552,a=>{"use strict";var b=a.i(53058),c=a.i(54645),d=a.i(59398);async function e(a,d){if(!a)return!1;if((0,b.isAdmin)(a))return!0;let e=(0,b.getEffectiveRoles)(a);if(0===e.length)return!1;try{return await (0,c.canAccessHref)(d,e,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",d,"-",a?.message),!1}}async function f(a,b,c="read"){return"read"===c?e(a,b):(0,d.canCrudForSession)(a,b,c)}async function g(a,c="read"){let d=await (0,b.getSession)();return d?await f(d,a,c)?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertFeature",()=>g,"canAccessFeatureForSession",()=>e])},37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},95459,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(4552),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/asrama/mutasi-asrama",j=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"];async function k(){let a=await (0,d.getDB)();try{await a.prepare(`
      CREATE TABLE IF NOT EXISTS mutasi_asrama_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        asrama_lama    TEXT,
        kamar_lama     TEXT,
        asrama_baru    TEXT NOT NULL,
        kamar_baru     TEXT,
        alasan         TEXT,
        dilakukan_oleh TEXT REFERENCES users(id),
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()}catch{}try{await a.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `).run()}catch{}try{let a=await (0,d.query)("PRAGMA table_info(kamar_config)");a.some(a=>"blok"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN blok TEXT"),a.some(a=>"reserved_baru"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0")}catch{}}async function l(a){await k();let b=Math.max(1,Number(a?.page??1)),c=Math.min(100,Math.max(1,Number(a?.pageSize??25))),e=`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin,
           s.asrama, s.kamar, s.kelas_sekolah, s.sekolah,
           m.nama AS marhalah_nama, k.nama_kelas
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE s.status_global = 'aktif'
  `,f=[];if(a?.asrama===null?e+=" AND (s.asrama IS NULL OR s.asrama = '')":a?.asrama&&(e+=" AND s.asrama = ?",f.push(a.asrama)),a?.search?.trim()){e+=" AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)";let b=`%${a.search.trim()}%`;f.push(b,b)}a?.tanpaKamar&&(e+=" AND (s.kamar IS NULL OR s.kamar = '')");let g=`SELECT COUNT(*) AS total FROM (${e}) base`,h=await (0,d.queryOne)(g,f);return e+=" ORDER BY s.asrama NULLS LAST, s.kamar NULLS LAST, s.nama_lengkap LIMIT ? OFFSET ?",{rows:await (0,d.query)(e,[...f,c,(b-1)*c]),total:h?.total??0,page:b,pageSize:c}}async function m(a){return await k(),(0,d.query)(`SELECT
       kc.nomor_kamar,
       kc.kuota,
       COALESCE(kc.reserved_baru, 0) AS reserved_baru,
       kc.blok,
       COUNT(s.id) AS terisi,
       MAX(0, kc.kuota - COUNT(s.id)) AS slot_kosong_fisik,
       MAX(0, kc.kuota - COALESCE(kc.reserved_baru, 0)) AS slot_efektif_lama,
       MIN(COALESCE(kc.reserved_baru, 0), MAX(0, kc.kuota - COUNT(s.id))) AS sisa_slot_baru
     FROM kamar_config kc
     LEFT JOIN santri s
       ON s.asrama = kc.asrama
      AND s.kamar = kc.nomor_kamar
      AND s.status_global = 'aktif'
     WHERE kc.asrama = ?
     GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
     ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar`,[a])}async function n(){let a=await (0,d.query)(`SELECT asrama, COUNT(*) AS jumlah
     FROM santri
     WHERE status_global = 'aktif'
     GROUP BY asrama`),b=await (0,d.queryOne)(`SELECT COUNT(*) AS jumlah
     FROM santri
     WHERE status_global = 'aktif'
       AND (kamar IS NULL OR kamar = '')`),c=a.find(a=>!a.asrama)?.jumlah??0;return{perAsrama:j.map(b=>({asrama:b,jumlah:a.find(a=>a.asrama===b)?.jumlah??0})),tanpaAsrama:c,tanpaKamar:b?.jumlah??0}}async function o(a){if(await k(),!a.kamarBaru)return null;let b=await (0,d.queryOne)(`SELECT
       kc.nomor_kamar,
       kc.kuota,
       COALESCE(kc.reserved_baru, 0) AS reserved_baru,
       COUNT(s.id) AS terisi,
       MIN(COALESCE(kc.reserved_baru, 0), MAX(0, kc.kuota - COUNT(s.id))) AS sisa_slot_baru
     FROM kamar_config kc
     LEFT JOIN santri s
       ON s.asrama = kc.asrama
      AND s.kamar = kc.nomor_kamar
      AND s.status_global = 'aktif'
     WHERE kc.asrama = ? AND kc.nomor_kamar = ?
     GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru`,[a.asramaBaru,a.kamarBaru]);if(!b)return{error:"Kamar tujuan belum dikonfigurasi di asrama ini"};let c=a.santriSaatIni.filter(b=>b.asrama===a.asramaBaru&&b.kamar===a.kamarBaru).length,e=a.santriSaatIni.length-c,f=a.santriSaatIni.filter(b=>(null==b.kamar||""===b.kamar)&&(b.asrama!==a.asramaBaru||b.kamar!==a.kamarBaru)).length,g=Math.max(0,Number(b.kuota)-Number(b.terisi)),h=Math.min(Number(b.reserved_baru??0),g);return e>g&&!a.overrideKapasitas?{needsOverride:!0,error:`Kamar ${a.kamarBaru} hanya tersisa ${g} slot fisik, tetapi akan menerima ${e} santri.`}:f>h&&!a.overrideKapasitas?{needsOverride:!0,error:`Kamar ${a.kamarBaru} hanya punya ${h} sisa slot santri baru, tetapi akan menerima ${f} santri baru.`}:{nomor_kamar:b.nomor_kamar,kuota:Number(b.kuota),reserved_baru:Number(b.reserved_baru??0),terisi:Number(b.terisi),slot_kosong_fisik:g,sisa_slot_baru:h}}async function p(a=100){return await k(),(0,d.query)(`
    SELECT mal.*, s.nama_lengkap, s.nis, u.full_name AS nama_operator
    FROM mutasi_asrama_log mal
    JOIN santri s ON s.id = mal.santri_id
    LEFT JOIN users u ON u.id = mal.dilakukan_oleh
    ORDER BY mal.created_at DESC
    LIMIT ?
  `,[a])}async function q(a){let b=await (0,e.assertFeature)("/dashboard/asrama/mutasi-asrama");if("error"in b)return b;if(await k(),"pengurus_asrama"===b.role&&b.asrama_binaan&&a.asramaBaru!==b.asrama_binaan)return{error:"Anda hanya bisa memindahkan santri ke asrama binaan Anda"};let c=await (0,d.queryOne)("SELECT asrama, kamar, nama_lengkap FROM santri WHERE id = ?",[a.santriId]);if(!c)return{error:"Santri tidak ditemukan"};let h=await o({asramaBaru:a.asramaBaru,kamarBaru:a.kamarBaru,santriSaatIni:[c],overrideKapasitas:a.overrideKapasitas});if(h&&"error"in h)return h;let j=await (0,d.getDB)();try{return await j.batch([j.prepare("UPDATE santri SET asrama = ?, kamar = ? WHERE id = ?").bind(a.asramaBaru,a.kamarBaru??null,a.santriId),j.prepare(`
        INSERT INTO mutasi_asrama_log (santri_id, asrama_lama, kamar_lama, asrama_baru, kamar_baru, alasan, dilakukan_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(a.santriId,c.asrama??null,c.kamar??null,a.asramaBaru,a.kamarBaru??null,a.alasan??null,b.id??null)]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_mutasi",action:"update",fiturHref:i,logKind:"update",entityType:"mutasi_asrama",entityId:a.santriId,entityLabel:c.nama_lengkap||a.santriId,summary:`Mutasi asrama santri ${c.nama_lengkap||a.santriId}`,details:{asrama_lama:c.asrama??null,kamar_lama:c.kamar??null,asrama_baru:a.asramaBaru,kamar_baru:a.kamarBaru??null,alasan:a.alasan??null}}),(0,g.revalidatePath)(i),{success:!0}}catch(a){return console.error("[mutasiSantri] Error:",a),{error:a.message||"Terjadi kesalahan pada server"}}}async function r(a){let b=await (0,e.assertFeature)("/dashboard/asrama/mutasi-asrama");if("error"in b)return b;if(await k(),"pengurus_asrama"===b.role&&b.asrama_binaan&&a.asramaBaru!==b.asrama_binaan)return{error:"Anda hanya bisa memindahkan santri ke asrama binaan Anda"};if(!a.santriIds.length)return{error:"Tidak ada santri dipilih"};let c=[];for(let b=0;b<a.santriIds.length;b+=100){let e=a.santriIds.slice(b,b+100),f=e.map(()=>"?").join(","),g=await (0,d.query)(`SELECT id, asrama, kamar FROM santri WHERE id IN (${f})`,e);c.push(...g)}let h=await o({asramaBaru:a.asramaBaru,kamarBaru:a.kamarBaru,santriSaatIni:c,overrideKapasitas:a.overrideKapasitas});if(h&&"error"in h)return h;let j=await (0,d.getDB)();try{let d=a.santriIds.map(b=>j.prepare("UPDATE santri SET asrama = ?, kamar = ? WHERE id = ?").bind(a.asramaBaru,a.kamarBaru??null,b)),e=c.map(c=>j.prepare(`
        INSERT INTO mutasi_asrama_log (santri_id, asrama_lama, kamar_lama, asrama_baru, kamar_baru, alasan, dilakukan_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(c.id,c.asrama??null,c.kamar??null,a.asramaBaru,a.kamarBaru??null,a.alasan??null,b.id)),h=[...d,...e];for(let a=0;a<h.length;a+=100)await j.batch(h.slice(a,a+100));return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_mutasi",action:"update",fiturHref:i,logKind:"update",entityType:"mutasi_asrama_batch",entityId:a.asramaBaru,entityLabel:a.asramaBaru,summary:`Mutasi batch ${a.santriIds.length} santri ke asrama ${a.asramaBaru}`,details:{count:a.santriIds.length,asrama_baru:a.asramaBaru,kamar_baru:a.kamarBaru??null,alasan:a.alasan??null}}),(0,g.revalidatePath)(i),{success:!0,count:a.santriIds.length}}catch(a){return console.error("[mutasiBatch] Error:",a),{error:a.message||"Terjadi kesalahan pada server"}}}(0,h.ensureServerEntryExports)([l,m,n,p,q,r]),(0,c.registerServerReference)(l,"403bf016b0ca1b72d794f17ac404a0ccb8e09a1fdd",null),(0,c.registerServerReference)(m,"40381158870976e1f316446bff5635904c6b44c997",null),(0,c.registerServerReference)(n,"0099dc2f20368923fc86c7bceab911397b0e6a2b70",null),(0,c.registerServerReference)(p,"40c894f03a3bfc81c800ef7dc72e26cb676b5e17e0",null),(0,c.registerServerReference)(q,"40bfb298cda8eacaaa5ad251422482383f933fbd95",null),(0,c.registerServerReference)(r,"4024243600f8ddc47925024a9f33ea3801ee2c07d0",null),a.s([],30511),a.i(30511),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"0099dc2f20368923fc86c7bceab911397b0e6a2b70",()=>n,"4024243600f8ddc47925024a9f33ea3801ee2c07d0",()=>r,"40381158870976e1f316446bff5635904c6b44c997",()=>m,"403bf016b0ca1b72d794f17ac404a0ccb8e09a1fdd",()=>l,"40bfb298cda8eacaaa5ad251422482383f933fbd95",()=>q,"40c894f03a3bfc81c800ef7dc72e26cb676b5e17e0",()=>p],95459)}];

//# sourceMappingURL=_a796da83._.js.map