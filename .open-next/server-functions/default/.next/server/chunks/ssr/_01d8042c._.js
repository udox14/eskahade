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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},319,a=>{"use strict";let b="SHA-256",c="PBKDF2";async function d(a){let d=new TextEncoder,e=crypto.getRandomValues(new Uint8Array(16)),f=await crypto.subtle.importKey("raw",d.encode(a),{name:c},!1,["deriveBits"]),g=Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:c,salt:e,iterations:1e5,hash:b},f,256))),h=Array.from(e).map(a=>a.toString(16).padStart(2,"0")).join(""),i=g.map(a=>a.toString(16).padStart(2,"0")).join("");return`${h}:${i}`}async function e(a,d){try{let[e,f]=d.split(":");if(!e||!f)return!1;let g=new Uint8Array(e.match(/.{2}/g).map(a=>parseInt(a,16))),h=new TextEncoder,i=await crypto.subtle.importKey("raw",h.encode(a),{name:c},!1,["deriveBits"]),j=await crypto.subtle.deriveBits({name:c,salt:g,iterations:1e5,hash:b},i,256);return Array.from(new Uint8Array(j)).map(a=>a.toString(16).padStart(2,"0")).join("")===f}catch{return!1}}a.s(["hashPassword",()=>d,"verifyPassword",()=>e])},8752,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(319),e=a.i(53058),f=a.i(6846);a.i(70396);var g=a.i(73727);async function h(a){let b=a.get("email"),h=a.get("password"),i=String(b||"").toLowerCase().trim(),j=await (0,f.getRequestAuditContext)();if(console.log("[LOGIN] Step 1: email=",b?b.substring(0,5)+"***":"EMPTY"),!b||!h)return{error:"Email dan password wajib diisi."};let k=null;try{k=await (0,c.queryOne)("SELECT id, email, password_hash, full_name, role, roles, asrama_binaan FROM users WHERE email = ?",[i]),console.log("[LOGIN] Step 2: user found=",!!k,"role=",k?.role)}catch(a){return console.error("[LOGIN] Step 2 ERROR:",a?.message),{error:"Gagal terhubung ke database. Coba lagi nanti."}}if(!k)return console.log("[LOGIN] Step 2: user NOT FOUND"),await (0,f.logActivity)({actor:{email:i},module:"auth",action:"login",entityType:"session",entityLabel:i||"unknown",summary:`Login gagal untuk ${i||"email kosong"}`,details:{reason:"user_not_found",email:i},status:"failed",requestInfo:j}),{error:"Email atau Password salah."};let l=!1;try{console.log("[LOGIN] Step 3: hash preview=",k.password_hash?.substring(0,10)),l=await (0,d.verifyPassword)(h,k.password_hash),console.log("[LOGIN] Step 3: password valid=",l)}catch(a){return console.error("[LOGIN] Step 3 ERROR:",a?.message),{error:"Terjadi kesalahan saat verifikasi. Coba lagi."}}if(!l)return await (0,f.logActivity)({actor:{id:k.id,name:k.full_name,email:k.email,roles:[k.role]},module:"auth",action:"login",entityType:"session",entityId:k.id,entityLabel:k.full_name||k.email,summary:`Login gagal untuk ${k.full_name||k.email}`,details:{reason:"invalid_password",email:k.email},status:"failed",requestInfo:j}),{error:"Email atau Password salah."};let m=[];try{k.roles?(m=JSON.parse(k.roles),Array.isArray(m)&&0!==m.length||(m=[k.role])):m=[k.role]}catch{m=[k.role]}try{console.log("[LOGIN] Step 4: setting session for roles=",m),await (0,e.setSession)({id:k.id,email:k.email,full_name:k.full_name||"",role:m[0],roles:m,asrama_binaan:k.asrama_binaan}),console.log("[LOGIN] Step 4: session set OK")}catch(a){return console.error("[LOGIN] Step 4 ERROR:",a?.message),{error:"Gagal menyimpan sesi: "+a?.message}}await (0,f.logActivity)({actor:{id:k.id,name:k.full_name,email:k.email,roles:m},module:"auth",action:"login",entityType:"session",entityId:k.id,entityLabel:k.full_name||k.email,summary:"Login berhasil",details:{email:k.email,primary_role:m[0]},status:"success",requestInfo:j}),console.log("[LOGIN] Step 5: redirecting to /dashboard"),(0,g.redirect)("/dashboard")}(0,a.i(13095).ensureServerEntryExports)([h]),(0,b.registerServerReference)(h,"40ef6274c191fb55eab31561fb1fba43d76960200e",null),a.s([],4450),a.i(4450),a.s(["40ef6274c191fb55eab31561fb1fba43d76960200e",()=>h],8752)}];

//# sourceMappingURL=_01d8042c._.js.map