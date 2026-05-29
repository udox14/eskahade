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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},319,a=>{"use strict";let b="SHA-256",c="PBKDF2";async function d(a){let d=new TextEncoder,e=crypto.getRandomValues(new Uint8Array(16)),f=await crypto.subtle.importKey("raw",d.encode(a),{name:c},!1,["deriveBits"]),g=Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:c,salt:e,iterations:1e5,hash:b},f,256))),h=Array.from(e).map(a=>a.toString(16).padStart(2,"0")).join(""),i=g.map(a=>a.toString(16).padStart(2,"0")).join("");return`${h}:${i}`}async function e(a,d){try{let[e,f]=d.split(":");if(!e||!f)return!1;let g=new Uint8Array(e.match(/.{2}/g).map(a=>parseInt(a,16))),h=new TextEncoder,i=await crypto.subtle.importKey("raw",h.encode(a),{name:c},!1,["deriveBits"]),j=await crypto.subtle.deriveBits({name:c,salt:g,iterations:1e5,hash:b},i,256);return Array.from(new Uint8Array(j)).map(a=>a.toString(16).padStart(2,"0")).join("")===f}catch{return!1}}a.s(["hashPassword",()=>d,"verifyPassword",()=>e])},17573,a=>{"use strict";var b=a.i(12259),c=a.i(319);async function d(a,c,d,e){let f=function(a,b){try{if(a){let b=JSON.parse(a);if(Array.isArray(b)&&b.length>0)return b}}catch{}return b?[b]:[]}(d,c);for(let a of e)f.includes(a)||f.push(a);await (0,b.query)("UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?",[JSON.stringify(f),a])}async function e(a){let e,f=await (0,b.queryOne)("SELECT id, nama_lengkap FROM data_guru WHERE id = ?",[a]);if(!f)return null;let g=await (0,b.queryOne)(`SELECT id, role, roles
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
  `,c),g=[];for(let a of f){let b=await e(Number(a.guru_maghrib_id));b&&g.push({sql:"UPDATE kelas SET wali_kelas_id = ? WHERE id = ?",params:[b,a.kelas_id]})}return g.length>0&&await (0,b.batch)(g),{synced:g.length}}a.s(["backfillManualWaliKelasFromGuruMaghrib",()=>f])},92931,a=>{"use strict";var b=a.i(12259),c=a.i(17573);let d=["shubuh","ashar","maghrib"],e={0:"Ahad",1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab"},f=[1,2,3,4,5,6,0],g=new Map(f.map((a,b)=>[a,b])),h=null;async function i(){h??=j().catch(a=>{throw h=null,a}),await h}async function j(){for(let a of(await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS kelas_jadwal_guru_mingguan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      sesi        TEXT NOT NULL,
      hari_index  INTEGER NOT NULL,
      guru_id     INTEGER NOT NULL REFERENCES data_guru(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(kelas_id, sesi, hari_index)
    )
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_lookup
    ON kelas_jadwal_guru_mingguan(kelas_id, sesi, hari_index)
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_guru
    ON kelas_jadwal_guru_mingguan(guru_id, sesi, hari_index)
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key        TEXT NOT NULL,
      nama             TEXT NOT NULL,
      sesi             TEXT NOT NULL,
      tempat           TEXT,
      tahun_ajaran_id  INTEGER REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tahun_ajaran_id, sesi, group_key)
    )
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian_anggota (
      group_id    INTEGER NOT NULL REFERENCES kelas_gabungan_pengajian(id) ON DELETE CASCADE,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, kelas_id)
    )
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_lookup
    ON kelas_gabungan_pengajian(tahun_ajaran_id, sesi, group_key)
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_anggota_kelas
    ON kelas_gabungan_pengajian_anggota(kelas_id)
  `),["ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_nama_snapshot TEXT","ALTER TABLE absensi_guru ADD COLUMN guru_ashar_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_ashar_nama_snapshot TEXT","ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_id_snapshot INTEGER REFERENCES data_guru(id)","ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_nama_snapshot TEXT"]))try{await (0,b.execute)(a)}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}await (0,c.backfillManualWaliKelasFromGuruMaghrib)()}async function k(a){await i();let c=(a||[]).filter(Boolean),d=c.length>0?`WHERE a.kelas_id IN (${c.map(()=>"?").join(",")})`:"";return(0,b.query)(`
    SELECT
      g.id,
      g.group_key,
      g.nama,
      g.sesi,
      g.tempat,
      g.tahun_ajaran_id,
      a.kelas_id,
      k.nama_kelas
    FROM kelas_gabungan_pengajian g
    JOIN kelas_gabungan_pengajian_anggota a ON a.group_id = g.id
    JOIN kelas k ON k.id = a.kelas_id
    ${d}
    ORDER BY g.sesi, g.group_key, k.nama_kelas
  `,c)}function l(a){let b=new Map;for(let c of a)b.set(`${c.kelas_id}|${c.sesi}`,c);return b}function m(a){let b=new Map;for(let c of a)b.has(c.id)||b.set(c.id,[]),b.get(c.id).push(c);for(let a of b.values())a.sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}));return b}async function n(a,c,e){for(let f of(await i(),e)){if(!d.includes(f.sesi))continue;await (0,b.execute)(`
      DELETE FROM kelas_gabungan_pengajian_anggota
      WHERE kelas_id = ?
        AND group_id IN (SELECT id FROM kelas_gabungan_pengajian WHERE sesi = ? AND tahun_ajaran_id IS ?)
    `,[a,f.sesi,c]);let e=String(f.groupKey||"").trim().replace(/\s+/g," ");if(!e)continue;let g=String(f.tempat||"").trim()||null;await (0,b.execute)(`
      INSERT INTO kelas_gabungan_pengajian (group_key, nama, sesi, tempat, tahun_ajaran_id, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tahun_ajaran_id, sesi, group_key) DO UPDATE SET
        nama = excluded.nama,
        tempat = COALESCE(excluded.tempat, kelas_gabungan_pengajian.tempat),
        updated_at = excluded.updated_at
    `,[e,e,f.sesi,g,c]);let h=await (0,b.query)(`
      SELECT id
      FROM kelas_gabungan_pengajian
      WHERE tahun_ajaran_id IS ? AND sesi = ? AND group_key = ?
      LIMIT 1
    `,[c,f.sesi,e]),i=h[0]?.id;i&&await (0,b.execute)(`
      INSERT OR IGNORE INTO kelas_gabungan_pengajian_anggota (group_id, kelas_id)
      VALUES (?, ?)
    `,[i,a])}await (0,b.execute)(`
    DELETE FROM kelas_gabungan_pengajian
    WHERE id NOT IN (SELECT DISTINCT group_id FROM kelas_gabungan_pengajian_anggota)
  `)}function o(a,b){return 2===a&&"maghrib"===b||4===a&&"maghrib"===b||5===a&&("shubuh"===b||"ashar"===b)}function p(a){return(a instanceof Date,new Date(a)).getDay()}async function q(a){await i();let c=(a||[]).filter(Boolean),d=c.length>0?`WHERE r.kelas_id IN (${c.map(()=>"?").join(",")})`:"";return(0,b.query)(`
    SELECT
      r.id,
      r.kelas_id,
      r.sesi,
      r.hari_index,
      r.guru_id,
      g.nama_lengkap as guru_nama
    FROM kelas_jadwal_guru_mingguan r
    JOIN data_guru g ON g.id = r.guru_id
    ${d}
    ORDER BY r.kelas_id, r.sesi, r.hari_index
  `,c)}function r(a){return new Map(a.map(a=>[`${a.kelas_id}|${a.sesi}|${a.hari_index}`,a]))}function s(a,b,c){let e={};for(let f of d){let d=c.get(`${a.id}|${f}|${b}`);if(d){e[f]={id:d.guru_id,nama:d.guru_nama??null,source:"override"};continue}e[f]="shubuh"===f?{id:a.guru_shubuh_id??null,nama:a.guru_shubuh_nama??null,source:"default"}:"ashar"===f?{id:a.guru_ashar_id??null,nama:a.guru_ashar_nama??null,source:"default"}:{id:a.guru_maghrib_id??null,nama:a.guru_maghrib_nama??null,source:"default"}}return e}function t(a,b,c){return s(a,p(b),c)}function u(a,b,c){return b.map(b=>({tanggal:b,hari_index:p(b),guru:t(a,b,c)}))}function v(a,b,c,d){let h=d?.skipStructuralLibur??!0,i=new Map;for(let d of f){if(h&&o(d,b))continue;let e=s(a,d,c)[b];if(!e.id||!e.nama)continue;let f=`${e.id}`;i.has(f)||i.set(f,{nama:e.nama,hari:[]}),i.get(f).hari.push(d)}return 0===i.size?"-":Array.from(i.values()).map(a=>`${a.nama} (${function(a){let b=[...a].sort((a,b)=>(g.get(a)??0)-(g.get(b)??0)),c=[];for(let a of b){let b=g.get(a)??0,d=c[c.length-1];if(!d){c.push([a]);continue}let e=d[d.length-1];b===(g.get(e)??0)+1?d.push(a):c.push([a])}return c.map(a=>{let b=e[a[0]],c=e[a[a.length-1]];return 1===a.length?b:`${b}-${c}`}).join(", ")}(a.hari)})`).join(", ")}function w(a,b,c){return{shubuh:v(a,"shubuh",b,c),ashar:v(a,"ashar",b,c),maghrib:v(a,"maghrib",b,c)}}function x(a,b,c,d){let e=d?.skipStructuralLibur??!0,g=d?.separator??"\n",h=new Set,i=[];for(let d of f){if(e&&o(d,b))continue;let f=s(a,d,c)[b];if(!f.id||!f.nama)continue;let g=`${f.id}`;h.has(g)||(h.add(g),i.push(f.nama))}return i.length>0?i.join(g):"-"}function y(a,b,c){return{shubuh:x(a,"shubuh",b,c),ashar:x(a,"ashar",b,c),maghrib:x(a,"maghrib",b,c)}}a.s(["buildGabunganByKelas",()=>l,"buildGabunganMembersByGroup",()=>m,"buildWeekSchedule",()=>u,"buildWeeklyGuruRuleMap",()=>r,"ensureGuruJadwalSchema",()=>i,"getKelasGabunganPengajian",()=>k,"getWeeklyGuruRules",()=>q,"isPengajianLiburByHariIndex",()=>o,"resolveGuruForDate",()=>t,"resolveGuruForHariIndex",()=>s,"saveKelasGabunganPengajian",()=>n,"summarizeWeeklyGuruAssignmentNames",()=>y,"summarizeWeeklyGuruAssignments",()=>w])},53750,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(9343),f=a.i(92931),g=a.i(13095);let h=["shubuh","ashar","maghrib"],i={shubuh:"Shubuh",ashar:"Ashar",maghrib:"Maghrib"};function j(a,b){return 2===a&&"maghrib"===b||4===a&&"maghrib"===b||5===a&&("shubuh"===b||"ashar"===b)}function k(a,b){let c=[],d=new Date(a),e=new Date(b);for(;d<=e;)c.push(d.toISOString().split("T")[0]),d.setDate(d.getDate()+1);return c}async function l(){return(0,e.getCachedMarhalahList)()}async function m(){return(0,e.getCachedTahunAjaranList)()}async function n(){await (0,f.ensureGuruJadwalSchema)(),await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
      tanggal    TEXT NOT NULL,
      sesi       TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tanggal, sesi)
    )
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
    ON pengajian_libur_sesi(tanggal, sesi)
  `)}async function o(a,b="",c,e){let f=`
    SELECT
      k.id,
      k.tahun_ajaran_id,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      gs.id AS guru_shubuh_id,
      gs.nama_lengkap AS guru_shubuh_nama,
      ga.id AS guru_ashar_id,
      ga.nama_lengkap AS guru_ashar_nama,
      gm.id AS guru_maghrib_id,
      gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE ${b?"k.tahun_ajaran_id = ?":"ta.is_active = 1"}
  `,g=b?[b]:[];a&&(f+=" AND k.marhalah_id = ?",g.push(a));let h=!!(c&&e);return f+=`
    AND (
      EXISTS (
        SELECT 1
        FROM riwayat_pendidikan rp
        JOIN santri s ON s.id = rp.santri_id
        WHERE rp.kelas_id = k.id
          AND rp.status_riwayat = 'aktif'
          AND s.status_global = 'aktif'
      )
      ${h?`OR EXISTS (
        SELECT 1
        FROM absensi_guru ag
        WHERE ag.kelas_id = k.id
          AND ag.tanggal >= ?
          AND ag.tanggal <= ?
      )`:""}
    )
  `,h&&g.push(c,e),f+=" ORDER BY k.nama_kelas",(0,d.query)(f,g)}async function p(a,b,c){if(!a.length)return new Map;let e=a.map(()=>"?").join(","),f=await (0,d.query)(`
    SELECT
      kelas_id,
      tanggal,
      shubuh,
      ashar,
      maghrib,
      guru_shubuh_id_snapshot,
      guru_shubuh_nama_snapshot,
      guru_ashar_id_snapshot,
      guru_ashar_nama_snapshot,
      guru_maghrib_id_snapshot,
      guru_maghrib_nama_snapshot
    FROM absensi_guru
    WHERE kelas_id IN (${e}) AND tanggal >= ? AND tanggal <= ?
  `,[...a,b,c]),g=new Map;return f.forEach(a=>{g.set(`${a.kelas_id}-${a.tanggal}`,a)}),g}async function q(a,b){return new Set((await (0,d.query)(`
    SELECT tanggal, sesi
    FROM pengajian_libur_sesi
    WHERE tanggal >= ? AND tanggal <= ?
  `,[a,b])).map(a=>`${a.tanggal}|${a.sesi}`))}function r(a,b){return"shubuh"===b?{id:a?.guru_shubuh_id_snapshot??null,nama:a?.guru_shubuh_nama_snapshot??null}:"ashar"===b?{id:a?.guru_ashar_id_snapshot??null,nama:a?.guru_ashar_nama_snapshot??null}:{id:a?.guru_maghrib_id_snapshot??null,nama:a?.guru_maghrib_nama_snapshot??null}}function s(a){return!!(a?.id&&a?.nama)}function t(a,b){return s(a)&&s(b)&&String(a.id)!==String(b.id)}function u(){return{wajib:0,hadir:0,badal:0,kosong:0,persentase:0,pct_hadir:0,pct_badal:0,pct_kosong:0}}function v(a,b){let c=a.hadir+(b?a.badal:0);return{...a,persentase:a.wajib>0?Math.round(c/a.wajib*100):0,pct_hadir:a.wajib>0?Math.round(a.hadir/a.wajib*100):0,pct_badal:a.wajib>0?Math.round(a.badal/a.wajib*100):0,pct_kosong:a.wajib>0?Math.round(a.kosong/a.wajib*100):0}}function w(a,b){a.wajib+=1,"A"===b?a.kosong+=1:"B"===b?a.badal+=1:a.hadir+=1}function x(a,b,c){return a?`${b.map(a=>a.nama_kelas).join(" + ")}${a.tempat?` - ${a.tempat}`:""}`:c}async function y(a="",b="",c="",d=""){await n();let e=await o(a,b,c,d);if(!e.length)return[];let g=e.map(a=>String(a.id)),i=c&&d?await p(g,c,d):new Map,k=(0,f.buildWeeklyGuruRuleMap)(await (0,f.getWeeklyGuruRules)(g)),l=new Map;for(let a of i.values())for(let b of h){let c=r(a,b);c.id&&c.nama&&l.set(String(c.id),{id:String(c.id),nama:c.nama})}for(let a of e)for(let b of[0,1,2,3,4,5,6]){let c=h.reduce((c,d)=>{let e=k.get(`${a.id}|${d}|${b}`),f="shubuh"===d?{id:a.guru_shubuh_id,nama:a.guru_shubuh_nama}:"ashar"===d?{id:a.guru_ashar_id,nama:a.guru_ashar_nama}:{id:a.guru_maghrib_id,nama:a.guru_maghrib_nama};return c[d]=e?{id:e.guru_id,nama:e.guru_nama}:f,c},{});for(let a of h){if(j(b,a))continue;let d=c[a];d?.id&&d.nama&&l.set(String(d.id),{id:String(d.id),nama:d.nama})}}return Array.from(l.values()).sort((a,b)=>a.nama.localeCompare(b.nama,void 0,{numeric:!0,sensitivity:"base"}))}async function z(a,b,c,d,e=""){await n();let g=await o(c,e,a,b);if(!g.length)return[];let h=g.map(a=>String(a.id)),i=await p(h,a,b),l=await q(a,b),m=(0,f.buildWeeklyGuruRuleMap)(await (0,f.getWeeklyGuruRules)(h)),u=await (0,f.getKelasGabunganPengajian)(h),v=(0,f.buildGabunganByKelas)(u),w=(0,f.buildGabunganMembersByGroup)(u),y=new Map,A=k(a,b);return g.forEach(a=>{A.forEach(b=>{let c=new Date(b).getDay(),d=i.get(`${a.id}-${b}`),e=(0,f.resolveGuruForDate)(a,b,m),g=(f,g)=>{if(j(c,f)||l.has(`${b}|${f}`))return;let h=v.get(`${a.id}|${f}`),i=h&&w.get(h.id)||[],k=i[0];if(k&&k.kelas_id!==a.id)return;let m=r(d,f),n=e[f],o=s(m)?m:n,p=x(h,i,a.nama_kelas),q=((a,b,c,d)=>{if(!a||!b)return null;let e=String(a);return y.has(e)||y.set(e,{id:e,nama:b,kelas_ajar:new Set,hadir:0,badal:0,kosong:0,libur:0,total_wajib:0,snapshot_berbeda:0}),y.get(e).kelas_ajar.add(`${c} (${d})`),y.get(e)})(o.id,o.nama,p,g);if(!q)return;q.total_wajib+=1,t(m,n)&&(q.snapshot_berbeda+=1);let u=String(d?.[f]||"H").toUpperCase();"L"===u?(q.libur+=1,q.total_wajib=Math.max(q.total_wajib-1,0)):"A"===u?q.kosong+=1:"B"===u?q.badal+=1:q.hadir+=1};g("shubuh","Shubuh"),g("ashar","Ashar"),g("maghrib","Maghrib")})}),Array.from(y.values()).map(a=>{let b=Math.max(a.total_wajib,0),c=a.hadir+(d?a.badal:0),e=b>0?Math.round(c/b*100):0,f=a=>b>0?Math.round(a/b*100):0;return{...a,total_wajib:b,kelas_ajar:Array.from(a.kelas_ajar).join(", "),persentase:e,pct_hadir:f(a.hadir),pct_badal:f(a.badal),pct_kosong:f(a.kosong)}}).sort((a,b)=>a.persentase-b.persentase)}async function A(a,b,c,e,g,l=""){if(await n(),!c)return null;let m=await o(e,l,a,b);if(!m.length)return null;let y=(await (0,d.query)("SELECT id, nama_lengkap FROM data_guru WHERE id = ? LIMIT 1",[c]))[0];if(!y)return null;let z=m.map(a=>String(a.id)),B=await p(z,a,b),C=await q(a,b),D=(0,f.buildWeeklyGuruRuleMap)(await (0,f.getWeeklyGuruRules)(z)),E=await (0,f.getKelasGabunganPengajian)(z),F=(0,f.buildGabunganByKelas)(E),G=(0,f.buildGabunganMembersByGroup)(E),H=k(a,b),I=String(c),J=u(),K={shubuh:u(),ashar:u(),maghrib:u()},L=[],M=new Set;return m.forEach(a=>{H.forEach(b=>{let c=new Date(b).getDay(),d=B.get(`${a.id}-${b}`),e=(0,f.resolveGuruForDate)(a,b,D);h.forEach(f=>{if(j(c,f)||C.has(`${b}|${f}`))return;let g=F.get(`${a.id}|${f}`),h=g&&G.get(g.id)||[],k=h[0];if(k&&k.kelas_id!==a.id)return;let l=r(d,f),m=e[f];if(String((s(l)?l:m).id||"")!==I)return;let n=String(d?.[f]||"H").toUpperCase();if("L"===n)return;let o="A"===n||"B"===n?n:"H",p=x(g,h,a.nama_kelas);M.add(`${p} (${i[f]})`),w(J,o),w(K[f],o),L.push({tanggal:b,hari:["Ahad","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date(b).getDay()]||"",sesi:f,sesi_label:i[f],kelas:p,status:o,status_label:"A"===o?"Kosong/Alfa":"B"===o?"Badal":"Hadir",catatan:"B"===o?"Diisi badal":"-",sumber_guru:s(l)?"snapshot":"jadwal",snapshot_guru_nama:l.nama??null,jadwal_guru_nama:m.nama??null,snapshot_berbeda:t(l,m)})})})}),{guru:{id:String(y.id),nama:y.nama_lengkap},kelas_ajar:Array.from(M).join(", "),total:v(J,g),per_sesi:{shubuh:v(K.shubuh,g),ashar:v(K.ashar,g),maghrib:v(K.maghrib,g)},detail:L.sort((a,b)=>`${a.tanggal}-${a.sesi}`.localeCompare(`${b.tanggal}-${b.sesi}`))}}(0,g.ensureServerEntryExports)([l,m,y,z,A]),(0,c.registerServerReference)(l,"00a817739267a2d202313e1fc4c63c69bacd147e31",null),(0,c.registerServerReference)(m,"006d1c492fdd708b3acc68a0dd6a077062d4d502dc",null),(0,c.registerServerReference)(y,"78d9fcdd4653cb0eda1eea2bdbc9508af87927f578",null),(0,c.registerServerReference)(z,"7cfc828ff1d9e00dc7ea68d0a4243640dfc5549317",null),(0,c.registerServerReference)(A,"7ebebbb8c5be4fec98f75afe7ef8c5474c1097f6c8",null),a.s([],95230),a.i(95230),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"006d1c492fdd708b3acc68a0dd6a077062d4d502dc",()=>m,"00a817739267a2d202313e1fc4c63c69bacd147e31",()=>l,"78d9fcdd4653cb0eda1eea2bdbc9508af87927f578",()=>y,"7cfc828ff1d9e00dc7ea68d0a4243640dfc5549317",()=>z,"7ebebbb8c5be4fec98f75afe7ef8c5474c1097f6c8",()=>A],53750)}];

//# sourceMappingURL=_e36f34e5._.js.map