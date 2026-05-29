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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},319,a=>{"use strict";let b="SHA-256",c="PBKDF2";async function d(a){let d=new TextEncoder,e=crypto.getRandomValues(new Uint8Array(16)),f=await crypto.subtle.importKey("raw",d.encode(a),{name:c},!1,["deriveBits"]),g=Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:c,salt:e,iterations:1e5,hash:b},f,256))),h=Array.from(e).map(a=>a.toString(16).padStart(2,"0")).join(""),i=g.map(a=>a.toString(16).padStart(2,"0")).join("");return`${h}:${i}`}async function e(a,d){try{let[e,f]=d.split(":");if(!e||!f)return!1;let g=new Uint8Array(e.match(/.{2}/g).map(a=>parseInt(a,16))),h=new TextEncoder,i=await crypto.subtle.importKey("raw",h.encode(a),{name:c},!1,["deriveBits"]),j=await crypto.subtle.deriveBits({name:c,salt:g,iterations:1e5,hash:b},i,256);return Array.from(new Uint8Array(j)).map(a=>a.toString(16).padStart(2,"0")).join("")===f}catch{return!1}}a.s(["hashPassword",()=>d,"verifyPassword",()=>e])},17573,a=>{"use strict";var b=a.i(12259),c=a.i(319);async function d(a,c,d,e){let f=function(a,b){try{if(a){let b=JSON.parse(a);if(Array.isArray(b)&&b.length>0)return b}}catch{}return b?[b]:[]}(d,c);for(let a of e)f.includes(a)||f.push(a);await (0,b.query)("UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?",[JSON.stringify(f),a])}async function e(a){let e,f=await (0,b.queryOne)("SELECT id, nama_lengkap FROM data_guru WHERE id = ?",[a]);if(!f)return null;let g=await (0,b.queryOne)(`SELECT id, role, roles
     FROM users
     WHERE lower(trim(full_name)) = lower(trim(?))
       AND (
         role IN ('wali_kelas', 'sekpen')
         OR EXISTS (
           SELECT 1
           FROM json_each(COALESCE(users.roles, '[]'))
           WHERE value IN ('wali_kelas', 'sekpen')
         )
       )
     LIMIT 1`,[f.nama_lengkap]);if(g)return await d(g.id,g.role,g.roles,["guru"]),g.id;let h=(e=f.nama_lengkap.toLowerCase().replace(/[^a-z0-9]/g,""),`${e}@sukahideng.or.id`),i=await (0,b.queryOne)("SELECT id, role, roles, source_type, source_ref_id FROM users WHERE email = ? LIMIT 1",[h]);if(i)return await d(i.id,i.role,i.roles,["wali_kelas","guru"]),i.source_type||i.source_ref_id||await (0,b.query)("UPDATE users SET source_type = ?, source_ref_id = ?, updated_at = datetime('now') WHERE id = ?",["guru",String(f.id),i.id]),i.id;let j=crypto.randomUUID(),k=await (0,c.hashPassword)("eskahade2026");return await (0,b.query)(`INSERT INTO users (id, email, password_hash, full_name, role, roles, source_type, source_ref_id)
     VALUES (?, ?, ?, ?, 'wali_kelas', ?, 'guru', ?)`,[j,h,k,f.nama_lengkap,JSON.stringify(["wali_kelas","guru"]),String(f.id)]),j}async function f(a){let c=a?.filter(Boolean)??[],d=c.length>0?`WHERE k.id IN (${c.map(()=>"?").join(",")}) AND k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL`:"WHERE k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL",f=await (0,b.query)(`
    SELECT k.id as kelas_id, k.guru_maghrib_id
    FROM kelas k
    ${d}
  `,c),g=[];for(let a of f){let b=await e(Number(a.guru_maghrib_id));b&&g.push({sql:"UPDATE kelas SET wali_kelas_id = ? WHERE id = ?",params:[b,a.kelas_id]})}return g.length>0&&await (0,b.batch)(g),{synced:g.length}}a.s(["backfillManualWaliKelasFromGuruMaghrib",()=>f])},3301,a=>{"use strict";var b=a.i(24895),c=a.i(66332);a.s([],68853),a.i(68853),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00c760672cf8460368f5c22c4ff6565a15db8f857d",()=>c.getActiveEventForKeuangan,"400b6724087d474e0ad422f678e8d4500c5b362b12",()=>c.getRabAutoBasis,"403eef2266cefc8b19bd0133f634baf0597aa3d249",()=>c.getHonorItems,"405164079b93abd2bff75cde3c99f9fedf8645a3b1",()=>c.getKeuanganSigners,"4052c2ebe1f82305128bed9d2245cd5370af1b90c3",()=>c.getHonorPanitiaData,"405727327d1090b351ca4df31661fa18cbb2c9634e",()=>c.getTransaksiItems,"4059370bd7f1ff1d458bdec907c75179331cc8ea1a",()=>c.getHonorTarif,"40860f6452c44924af2644a15ad54d8230d45ebfbc",()=>c.getHonorMapelConfig,"40ba3005bbcdd94ca405aafe3fb30b14dadc25acc0",()=>c.getRabItems,"6028085fcc88a7a6533237194dcff3923d177b9989",()=>c.saveTransaksiItems,"60680c76ceba2f234eb65c7879f06575f595541dcd",()=>c.saveHonorPanitiaBatch,"60a2937422fe729d4d7014dc7bdaf6acb594c7e085",()=>c.saveHonorMapelConfig,"70dc832b0d000e096a3255a4909055948254019154",()=>c.saveRabItems],3301)}];

//# sourceMappingURL=_bd974496._.js.map