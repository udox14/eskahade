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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},53457,a=>{"use strict";let b=["AL-BAGHORY"];function c(a){return b.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!b.includes(a)),a.s(["isAsramaTanpaKamar",()=>c])},84213,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(53457),g=a.i(6846),h=a.i(18558),i=a.i(13095);let j=["ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4"];async function k(){let a=await (0,e.getSession)();return a?(0,e.isAdmin)(a)?{role:"admin",asrama_binaan:null}:(0,e.hasRole)(a,"pengurus_asrama")&&j.includes(a.asrama_binaan||"")?{role:"pengurus_asrama",asrama_binaan:a.asrama_binaan}:null:null}async function l(a){return(0,f.isAsramaTanpaKamar)(a)?[]:(await (0,d.query)(`SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function m(a,b,c){if(!await (0,e.getSession)()||(0,f.isAsramaTanpaKamar)(a))return[];let g=await (0,d.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `,[a,b]);if(!g.length)return[];let h=g.map(a=>a.id),i=h.map(()=>"?").join(","),j=[];try{j=await (0,d.query)(`SELECT santri_id, shubuh, dzuhur, ashar, maghrib, isya FROM absen_berjamaah WHERE tanggal = ? AND santri_id IN (${i})`,[c,...h])}catch{}let k={};return j.forEach(a=>{k[a.santri_id]=a}),g.map(a=>({...a,shubuh:k[a.id]?.shubuh??null,dzuhur:k[a.id]?.dzuhur??null,ashar:k[a.id]?.ashar??null,maghrib:k[a.id]?.maghrib??null,isya:k[a.id]?.isya??null}))}async function n(a,b){let c=await (0,e.getSession)();if(!c||!(0,e.hasAnyRole)(c,["admin","pengurus_asrama"]))return{error:"Unauthorized"};if((0,e.hasRole)(c,"pengurus_asrama")&&!j.includes(c.asrama_binaan||""))return{error:"Tidak punya akses"};let f=a.map(a=>a.santri_id),i=f.length?await (0,d.query)(`SELECT DISTINCT asrama, kamar
         FROM santri
         WHERE id IN (${f.map(()=>"?").join(",")})`,f):[],k=await (0,d.getDB)(),l=[],m=a.filter(a=>!a.shubuh&&!a.dzuhur&&!a.ashar&&!a.maghrib&&!a.isya).map(a=>a.santri_id),n=a.filter(a=>a.shubuh||a.dzuhur||a.ashar||a.maghrib||a.isya);for(let a=0;a<m.length;a+=100){let c=m.slice(a,a+100);l.push(k.prepare(`DELETE FROM absen_berjamaah WHERE tanggal = ? AND santri_id IN (${c.map(()=>"?").join(",")})`).bind(b,...c))}for(let a of n)l.push(k.prepare(`
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, dzuhur, ashar, maghrib, isya, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = excluded.shubuh, dzuhur = excluded.dzuhur, ashar = excluded.ashar,
        maghrib = excluded.maghrib, isya = excluded.isya,
        created_by = excluded.created_by
    `).bind(a.santri_id,b,a.shubuh,a.dzuhur,a.ashar,a.maghrib,a.isya,c.id));for(let a=0;a<l.length;a+=100)await k.batch(l.slice(a,a+100));return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"asrama_absen_berjamaah",action:"update",fiturHref:"/dashboard/asrama/absen-berjamaah",logKind:"update",entityType:"absen_berjamaah_batch",entityId:b,entityLabel:b,summary:`Menyimpan absen berjamaah ${a.length} santri`,details:{tanggal:b,count:a.length,alfa_shubuh:a.filter(a=>a.shubuh).length,alfa_dzuhur:a.filter(a=>a.dzuhur).length,alfa_ashar:a.filter(a=>a.ashar).length,alfa_maghrib:a.filter(a=>a.maghrib).length,alfa_isya:a.filter(a=>a.isya).length,scope:i}}),(0,h.revalidatePath)("/dashboard/asrama/absen-berjamaah"),{success:!0}}(0,i.ensureServerEntryExports)([k,l,m,n]),(0,c.registerServerReference)(k,"008e9703c703ee15932fcfcaa81b95180661aea963",null),(0,c.registerServerReference)(l,"40c21b7ef473d52c10e499ef0358642416b9ca57c0",null),(0,c.registerServerReference)(m,"70cc18a137fb5d39264cd53b6c820b9c85a5bd9769",null),(0,c.registerServerReference)(n,"6008c51729d0ec5ddb814e5659977d265654c160da",null),a.s([],84987),a.i(84987),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"008e9703c703ee15932fcfcaa81b95180661aea963",()=>k,"40c21b7ef473d52c10e499ef0358642416b9ca57c0",()=>l,"6008c51729d0ec5ddb814e5659977d265654c160da",()=>n,"70cc18a137fb5d39264cd53b6c820b9c85a5bd9769",()=>m],84213)}];

//# sourceMappingURL=_26c75ab1._.js.map